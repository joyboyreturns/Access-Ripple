import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { safeDisplayUrl, assertSafeUrl } from './url-safety.js';
import { errorEvidence, stableId } from './evidence.js';
import { BLOCKED_PATH, runInteractions } from './interaction.js';
import type { AccessibilityEvidence, ControlEvidence, InteractionMode, PageEvidence, RuntimeErrorEvidence, ScanCoverage, ScanLimits, ScanResult } from '../graph/schema.js';
import { buildGraph } from '../graph/build-graph.js';

const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

/**
 * A small picture of the rendered page, so a repair can be seen and not only
 * counted. It is kept small on purpose: the scan is stored on disk and sent
 * to the browser as JSON.
 */
async function captureScreenshot(page: import('playwright').Page): Promise<{ dataUrl: string } | undefined> {
  try {
    const buffer = await page.screenshot({ type: 'jpeg', quality: 52, scale: 'css', timeout: 8000 });
    if (buffer.length > 220_000) return undefined;
    return { dataUrl: `data:image/jpeg;base64,${buffer.toString('base64')}` };
  } catch {
    return undefined;
  }
}

const DEFAULT_LIMITS: ScanLimits = {
  maxPages: 5,
  maxDepth: 2,
  navigationTimeoutMs: 20_000,
  // A busy page can take tens of seconds to inspect, so the budget is wide
  // enough to reach more than one page on a heavy site. A quick site still
  // finishes as soon as it is done.
  totalTimeoutMs: 100_000,
  maxControlsPerPage: 200,
  maxRequestsPerPage: 300,
  maxFindingsPerPage: 100,
  maxInteractionsPerPage: 4,
  maxInteractionsPerScan: 10,
  maxScreenshots: 5,
};

/**
 * Some sites answer an automated browser with a challenge page instead of the
 * site. Reporting that as a scanned page would be a lie, so it is recognised
 * and reported as refused.
 */
const REFUSAL_PATTERNS = /just a moment|attention required|access denied|verify you are human|checking your browser|are you a robot|enable javascript and cookies/i;

function looksLikeRefusal(title: string, controlCount: number, documentStatus: number): boolean {
  // 403, 429 and 503 are the server refusing this browser, not a missing page.
  if ([401, 403, 429, 503].includes(documentStatus)) return true;
  if (controlCount > 0) return false;
  return REFUSAL_PATTERNS.test(title);
}

interface ExtractedControl {
  role: string;
  accessibleName?: string;
  selector?: string;
  href?: string;
  formAction?: string;
  method?: string;
}

export interface ScanInput {
  id: string;
  url: string;
  sample?: 'checkout';
  previousScanId?: string;
  interactionMode?: InteractionMode;
  onUpdate: (scan: ScanResult) => void;
}

function initialResult(input: ScanInput): ScanResult {
  const now = new Date().toISOString();
  return {
    id: input.id,
    createdAt: now,
    updatedAt: now,
    status: 'queued',
    inputUrl: safeDisplayUrl(input.url),
    canonicalOrigin: new URL(input.url).origin,
    sample: input.sample,
    limits: { ...DEFAULT_LIMITS },
    progress: { completedPages: 0, totalPageLimit: DEFAULT_LIMITS.maxPages, message: 'Waiting for a scan worker.' },
    pages: [],
    previousScanId: input.previousScanId,
    interactionPolicy: { mode: input.interactionMode ?? 'safe', tested: 0, skipped: 0 },
  };
}

async function inspectControls(page: import('playwright').Page, pageUrl: string, limit: number): Promise<{ controls: ControlEvidence[]; links: string[] }> {
  const extracted = await page.evaluate(`(() => { const maxControls = ${limit};
    const elements = Array.from(document.querySelectorAll('a[href],button,input,select,textarea,[role=button],[role=link]')).filter((element) => {
      if (element.matches('input[type="hidden"],[hidden],[inert]') || element.closest('[hidden],[aria-hidden="true"],[inert]')) return false;
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || element.getClientRects().length === 0) return false;
      return true;
    }).slice(0, maxControls);
    return elements.map((element) => {
      const anchor = element.matches('a[href]') ? element : null;
      const input = element.matches('input') ? element : null;
      const labelledBy = element.getAttribute('aria-labelledby')?.split(/\\s+/).map((id) => document.getElementById(id)?.textContent?.trim()).filter(Boolean).join(' ');
      const label = input?.labels ? Array.from(input.labels).map((item) => item.textContent?.trim()).filter(Boolean).join(' ') : '';
      const name = element.getAttribute('aria-label') || labelledBy || element.getAttribute('title') || label || element.textContent?.trim() || input?.placeholder || input?.name || '';
      if (/[{};]|:hover|:focus|\\.[A-Za-z_-]+\\s*\\{/i.test(name) && name.length > 24) return null;
      const form = element.form || element.closest('form');
      const submitsForm = (element.tagName === 'BUTTON' && element.type === 'submit') || (input && ['submit','image'].includes(input.type));
      let selector = '';
      if (element.id) selector = '#' + CSS.escape(element.id);
      else {
        // The path has to point at exactly one element. A short path is not
        // enough on a list-heavy page, where many rows share the same shape
        // and would otherwise collapse into one control.
        const parts = [];
        let current = element;
        const step = (node) => {
          const tag = node.tagName.toLowerCase();
          const siblings = node.parentElement ? Array.from(node.parentElement.children).filter((child) => child.tagName === node.tagName) : [];
          const nth = siblings.length > 1 ? ':nth-of-type(' + (siblings.indexOf(node) + 1) + ')' : '';
          return tag + nth;
        };
        while (current && current !== document.body && parts.length < 10) {
          parts.unshift(step(current));
          current = current.parentElement;
        }
        selector = parts.join(' > ');
        // Still ambiguous: keep climbing until the path is unique.
        let guard = 0;
        while (current && current !== document.body && document.querySelectorAll(selector).length > 1 && guard < 6) {
          parts.unshift(step(current));
          current = current.parentElement;
          selector = parts.join(' > ');
          guard += 1;
        }
        if (document.querySelectorAll(selector).length > 1) {
          // The last resort: mark this one element so the selector is exact.
          const mark = 'data-accessripple-ref';
          element.setAttribute(mark, String(document.querySelectorAll('[' + mark + ']').length));
          selector = '[' + mark + '="' + element.getAttribute(mark) + '"]';
        }
      }
      return {
        role: element.getAttribute('role') || (anchor ? 'link' : input?.type || element.tagName.toLowerCase()),
        accessibleName: String(name).replace(/\\s+/g, ' ').slice(0, 120) || undefined,
        selector: selector.slice(0, 240),
        href: anchor?.href || undefined,
        formAction: submitsForm ? (element.hasAttribute('formaction') ? element.formAction : form?.action || undefined) : undefined,
        method: submitsForm ? (element.hasAttribute('formmethod') ? element.formMethod : form?.method || '').toUpperCase() || undefined : undefined,
      };
    }).filter(Boolean);
  })()` ) as ExtractedControl[];

  const controls = extracted.map((control) => ({
    id: stableId('control', `${pageUrl}|${control.role}|${control.accessibleName ?? ''}|${control.selector ?? ''}`),
    role: control.role,
    accessibleName: control.accessibleName,
    selector: control.selector,
    href: control.href ? safeDisplayUrl(control.href) : undefined,
    formAction: control.formAction ? safeDisplayUrl(control.formAction) : undefined,
    method: control.method,
    evidenceLabel: 'observed' as const,
  }));
  const links = [...new Set(extracted.map((control) => control.href).filter((href): href is string => Boolean(href)))];
  return { controls, links };
}

async function runAxe(page: import('playwright').Page, pageId: string, maxFindings: number): Promise<AccessibilityEvidence[]> {
  try {
    // The check source is installed before the page's own scripts, so a site
    // with a strict Content Security Policy can still be checked. If it is
    // not there for some reason, try the ordinary way once.
    const present = await page.evaluate(() => Boolean((window as unknown as { axe?: unknown }).axe));
    if (!present) await page.addScriptTag({ content: axeSource });
    const results = await page.evaluate(async () => {
      const axe = (window as unknown as { axe?: { run: (context: Document, options: object) => Promise<any> } }).axe;
      if (!axe) return null;
      return axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } });
    });
    if (!results) return [];
    const output: AccessibilityEvidence[] = [];
    for (const [items, status] of [[results.violations, 'detected'], [results.incomplete, 'needs-review']] as const) {
      for (const item of items ?? []) {
        for (const node of item.nodes ?? []) {
          if (output.length >= maxFindings) return output;
          output.push({
            id: stableId('finding', `${pageId}|${item.id}|${(node.target ?? []).join(',')}`),
            ruleId: String(item.id).slice(0, 100),
            impact: String(item.impact ?? 'unknown').slice(0, 30),
            status,
            help: String(item.help ?? item.id).slice(0, 240),
            helpUrl: String(item.helpUrl ?? '').slice(0, 400),
            targets: (node.target ?? []).slice(0, 5).map((target: unknown) => String(target).slice(0, 240)),
            // The markup of the failing element, so a developer can see what
            // the check was actually looking at.
            snippet: String(node.html ?? '').replace(/\s+/g, ' ').trim().slice(0, 400) || undefined,
            evidenceLabel: 'observed',
          });
        }
      }
    }
    return output;
  } catch (error) {
    return [{
      id: stableId('finding', `${pageId}|axe-run-error`),
      ruleId: 'accessibility-check-incomplete',
      impact: 'unknown',
      status: 'needs-review',
      help: 'The automated checks could not run on this page.',
      helpUrl: 'https://github.com/dequelabs/axe-core',
      targets: [],
      evidenceLabel: 'observed',
      snippet: undefined,
      reason: error instanceof Error ? error.message.slice(0, 200) : 'unknown error',
    } as AccessibilityEvidence];
  }
}

function shouldCrawlLink(href: string, origin: string, isSample: boolean): boolean {
  try {
    const url = new URL(href);
    if (url.origin !== origin || !['http:', 'https:'].includes(url.protocol)) return false;
    if (!isSample && BLOCKED_PATH.test(url.pathname)) return false;
    return true;
  } catch { return false; }
}

/** Explain coverage honestly: how many pages were inspected, what stopped the crawl, and what stayed out of reach. */
function summarizeCoverage(pages: PageEvidence[], queueRemaining: number, visitedCount: number, limits: ScanLimits, startedAt: number, interactions: { tested: number; skipped: number }): ScanCoverage {
  const deepLinks = new Set<string>();
  for (const page of pages) {
    if (page.depth >= limits.maxDepth) for (const href of page.outgoingLinks) deepLinks.add(href);
  }
  const visited = new Set(pages.map((page) => page.url));
  const timeExpired = Date.now() - startedAt >= limits.totalTimeoutMs;
  return {
    pagesInspected: pages.filter((page) => page.status === 'complete').length,
    pagesBlocked: pages.filter((page) => page.status === 'skipped').length,
    pagesFailed: pages.filter((page) => page.status === 'failed').length,
    destinationsNotReached: queueRemaining,
    destinationsBeyondDepth: [...deepLinks].filter((href) => !visited.has(href)).length,
    stoppedBy: queueRemaining === 0 ? null : timeExpired ? 'time-limit' : visitedCount >= limits.maxPages ? 'page-limit' : null,
    interactionsTested: interactions.tested,
    interactionsSkipped: interactions.skipped,
  };
}

export async function performScan(input: ScanInput): Promise<ScanResult> {
  const { chromium } = await import('playwright');
  const scan = initialResult(input);
  scan.status = 'running';
  scan.progress.message = 'Opening a controlled browser.';
  input.onUpdate(scan);

  const startedAt = Date.now();
  const origin = new URL(input.url).origin;
  const sampleOrigin = input.sample ? origin : undefined;
  const queue: Array<{ url: string; depth: number }> = [];
  const visited = new Set<string>();
  const pending = new Set<string>();
  // Pending work is deduplicated so already-queued destinations never consume the page budget
  // or crowd out links revealed by an observed interaction.
  const enqueue = (rawUrl: string, depth: number): void => {
    const display = safeDisplayUrl(rawUrl);
    if (visited.has(display) || pending.has(display)) return;
    if (visited.size + pending.size >= scan.limits.maxPages) return;
    pending.add(display);
    queue.push({ url: rawUrl, depth });
  };
  enqueue(input.url, 0);
  const browser = await chromium.launch({ headless: true });  const context = await browser.newContext({ acceptDownloads: false, serviceWorkers: 'block', ignoreHTTPSErrors: false });
  const pages: PageEvidence[] = [];
  let interactionsUsed = 0;
  let interactionMsUsed = 0;
  let screenshotsTaken = 0;
  let exclusionsTotal = 0;

  try {
    while (queue.length && visited.size < scan.limits.maxPages && Date.now() - startedAt < scan.limits.totalTimeoutMs) {
      const next = queue.shift()!;
      let normalized: URL;
      try {
        normalized = await assertSafeUrl(next.url, { allowLocalSample: Boolean(input.sample), sampleOrigin });
      } catch (error) {
        const pageUrl = safeDisplayUrl(next.url);
        if (visited.has(pageUrl)) continue;
        visited.add(pageUrl);
        pending.delete(pageUrl);
        pages.push({ id: stableId('page', pageUrl), url: pageUrl, status: 'skipped', depth: next.depth, controls: [], errors: [errorEvidence('page', error instanceof Error ? error.message : 'URL was blocked.', pageUrl)], findings: [], outgoingLinks: [], interactions: [], errorMessage: 'Destination was blocked by the URL safety policy.' });
        scan.pages = pages;
        scan.progress = { completedPages: pages.length, totalPageLimit: scan.limits.maxPages, message: 'A destination was blocked by the URL safety policy.' };
        scan.updatedAt = new Date().toISOString(); input.onUpdate(scan);
        continue;
      }
      const displayUrl = safeDisplayUrl(normalized.toString());
      if (visited.has(displayUrl)) continue;
      visited.add(displayUrl);
      pending.delete(displayUrl);
      scan.progress = { completedPages: pages.length, totalPageLimit: scan.limits.maxPages, currentUrl: displayUrl, message: `Inspecting page ${pages.length + 1}.`, remainingMs: Math.max(0, startedAt + scan.limits.totalTimeoutMs - Date.now()) };
      scan.updatedAt = new Date().toISOString(); input.onUpdate(scan);
      const page = await context.newPage();
      // Install the check source before any script on the page runs, so a
      // strict Content Security Policy cannot stop the checks.
      await page.addInitScript({ content: axeSource }).catch(() => undefined);
      let pageId = stableId('page', displayUrl);
      const errors: RuntimeErrorEvidence[] = [];
      let requestCount = 0;
      let requestLimitRecorded = false;
      let documentStatus = 0;
      const recordError = (error: RuntimeErrorEvidence) => { if (errors.length < 120) errors.push(error); };
      page.on('pageerror', (error) => recordError(errorEvidence('page', error.message, page.url())));
      page.on('console', (message) => { if (message.type() === 'error') recordError(errorEvidence('console', message.text(), page.url())); });
      page.on('requestfailed', (request) => recordError(errorEvidence('request', request.failure()?.errorText || 'Network request failed.', request.url())));
      page.on('response', (response) => {
        try { if (response.request().isNavigationRequest() && response.frame() === page.mainFrame()) documentStatus = response.status(); } catch { /* The frame may be gone already. */ }
        if (response.status() >= 400) recordError(errorEvidence('http', `HTTP ${response.status()} response.`, response.url(), response.status()));
      });
      await page.route('**/*', async (route) => {
        requestCount += 1;
        if (requestCount > (scan.limits.maxRequestsPerPage ?? 300)) {
          if (!requestLimitRecorded) { recordError(errorEvidence('request', 'Per-page request limit reached.', route.request().url())); requestLimitRecorded = true; }
          return route.abort('blockedbyclient').catch(() => undefined);
        }
        try {
          const requestUrl = route.request().url();
          if (!requestUrl.startsWith('http://') && !requestUrl.startsWith('https://')) return await route.abort('blockedbyclient');
          await assertSafeUrl(requestUrl, { allowLocalSample: Boolean(input.sample), sampleOrigin });
          await route.continue();
        } catch {
          errors.push(errorEvidence('request', 'Request blocked by URL safety policy.', route.request().url()));
          await route.abort('blockedbyclient').catch(() => undefined);
        }
      });

      let entry: PageEvidence;
      try {
        await page.goto(next.url, { waitUntil: 'domcontentloaded', timeout: scan.limits.navigationTimeoutMs });
        const finalUrl = new URL(page.url());
        if (finalUrl.origin !== origin) throw new Error('This page redirected outside the original website and was not scanned.');
        await page.waitForTimeout(150);
        const finalDisplayUrl = safeDisplayUrl(finalUrl.toString());
        if (finalDisplayUrl !== displayUrl) {
          if (visited.has(finalDisplayUrl)) {
            visited.delete(displayUrl);
            continue;
          }
          visited.add(finalDisplayUrl);
          pending.delete(finalDisplayUrl);
          pageId = stableId('page', finalDisplayUrl);
        }
        const title = (await page.title()).slice(0, 180) || undefined;
        const { controls, links } = await inspectControls(page, finalUrl.toString(), scan.limits.maxControlsPerPage);
        const findings = await runAxe(page, pageId, scan.limits.maxFindingsPerPage);
        // Resolve both selector formats against the rendered DOM rather than comparing selector text.
        const affected = await page.evaluate(`(() => {
          const controls = ${JSON.stringify(controls.map(c => ({id:c.id,selector:c.selector})))};
          const findings = ${JSON.stringify(findings.map(f => ({id:f.id,targets:f.targets})))};
          const select = selector => { try { return Array.from(document.querySelectorAll(selector)); } catch { return []; } };
          const renderedControls=controls.map(c=>({...c,elements:c.selector?select(c.selector):[]})).filter(c=>c.elements.length===1);
          return findings.map(f => { const targets=f.targets.flatMap(select); return { id:f.id, controlIds:renderedControls.filter(c =>
            targets.some(target => c.elements[0] === target || c.elements[0].contains(target))).map(c => c.id) }; });
        })()`) as {id:string;controlIds:string[]}[];
        for (const finding of findings) finding.affectedControlIds = affected.find(a => a.id === finding.id)?.controlIds ?? [];
        // Keep a small picture of every page that was inspected, so a repair
        // can be seen and not only counted. A page that no longer has a
        // finding is exactly the one worth showing after the repair.
        const shot = screenshotsTaken < (scan.limits.maxScreenshots ?? 5) ? await captureScreenshot(page) : undefined;
        if (shot) screenshotsTaken += 1;
        if (looksLikeRefusal(title ?? "", controls.length, documentStatus)) {
          entry = {
            id: pageId, url: finalDisplayUrl, title, status: 'skipped', depth: next.depth, controls: [], errors: [errorEvidence('page', `The site refused the automated browser (HTTP ${documentStatus || 403}). Nothing on this site could be inspected.`, finalDisplayUrl)],
            findings: [], outgoingLinks: [], interactions: [], screenshot: shot, errorMessage: 'The site refused the automated browser. Some sites answer automated browsers with a challenge page instead of the site.',
          };
        } else {
          entry = { id: pageId, url: finalDisplayUrl, title, status: 'complete', depth: next.depth, controls, errors: errors.slice(0, 120), findings, outgoingLinks: links.map(safeDisplayUrl), interactions: [], screenshot: shot };
        }
        if (next.depth < scan.limits.maxDepth) {
          for (const href of links) {
            if (shouldCrawlLink(href, origin, Boolean(input.sample))) enqueue(href, next.depth + 1);
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Page could not be inspected.';
        entry = { id: pageId, url: displayUrl, status: 'failed', depth: next.depth, controls: [], errors: [...errors.slice(0, 30), errorEvidence('page', message, displayUrl)], findings: [], outgoingLinks: [], interactions: [], errorMessage: message.slice(0, 200) };
      } finally {
        await page.close().catch(() => undefined);
      }

      // Interaction testing: activate a bounded set of recorded controls in disposable pages
      // and record what actually happened. Data-changing requests are always blocked.
      // Interactions get a fixed slice of the budget so a slow site cannot spend
      // the whole scan on them and leave the map with a single page.
      if (entry.status === 'complete') {
        const remaining = scan.limits.maxInteractionsPerScan - interactionsUsed;
        const interactionBudget = scan.limits.totalTimeoutMs * 0.35;
        if (remaining > 0 && interactionMsUsed < interactionBudget && Date.now() - startedAt < scan.limits.totalTimeoutMs * 0.62) {
          const interactionStarted = Date.now();
          const batch = await runInteractions(context, entry, {
            mode: input.interactionMode ?? 'safe',
            isSample: Boolean(input.sample),
            origin,
            maxPerPage: scan.limits.maxInteractionsPerPage,
            maxPerScanRemaining: remaining,
            deadline: Math.min(startedAt + scan.limits.totalTimeoutMs * 0.9, interactionStarted + (interactionBudget - interactionMsUsed)),
            settleMs: 750,
            clickTimeoutMs: 2500,
            reopenTimeoutMs: Math.min(10_000, scan.limits.navigationTimeoutMs),
            onProgress: (message) => {
              scan.progress = { completedPages: pages.length, totalPageLimit: scan.limits.maxPages, currentUrl: entry.url, message, remainingMs: Math.max(0, startedAt + scan.limits.totalTimeoutMs - Date.now()) };
              scan.updatedAt = new Date().toISOString(); input.onUpdate(scan);
            },
          });
          interactionsUsed += batch.interactions.length;
          interactionMsUsed += Date.now() - interactionStarted;
          exclusionsTotal += batch.exclusions.length;
          entry.interactions = batch.interactions;
          if (batch.exclusions.length) entry.interactionExclusions = batch.exclusions;
          for (const error of batch.errors) {
            if (entry.errors.length >= 120) break;
            if (!entry.errors.some((existing) => existing.id === error.id)) entry.errors.push(error);
          }
          if (next.depth < scan.limits.maxDepth) {
            for (const href of batch.revealedLinks) {
              if (shouldCrawlLink(href, origin, Boolean(input.sample))) enqueue(href, next.depth + 1);
            }
          }
        }
      }
      pages.push(entry);
      scan.pages = pages;
      scan.progress = { completedPages: pages.length, totalPageLimit: scan.limits.maxPages, message: `${pages.length} page${pages.length === 1 ? '' : 's'} inspected.`, remainingMs: Math.max(0, startedAt + scan.limits.totalTimeoutMs - Date.now()) };
      scan.updatedAt = new Date().toISOString(); input.onUpdate(scan);
    }

    if (pages.length === 0) throw new Error('No pages could be inspected within the scan limits.');
    scan.pages = pages;
    scan.status = pages.some((page) => page.status !== 'complete') ? 'partial' : 'complete';
    if (Date.now() - startedAt >= scan.limits.totalTimeoutMs && queue.length) scan.status = 'partial';
    scan.interactionPolicy = { mode: input.interactionMode ?? 'safe', tested: interactionsUsed, skipped: exclusionsTotal };
    scan.coverage = summarizeCoverage(pages, queue.length, visited.size, scan.limits, startedAt, { tested: interactionsUsed, skipped: exclusionsTotal });
    scan.graph = buildGraph(scan);
    scan.progress = { completedPages: pages.length, totalPageLimit: scan.limits.maxPages, message: scan.status === 'complete' ? 'Scan complete.' : 'Scan completed with pages or destinations that could not be inspected.' };
  } catch (error) {
    scan.status = 'failed';
    scan.error = { code: 'SCAN_FAILED', message: error instanceof Error ? error.message.slice(0, 240) : 'The scan could not complete.', retryable: true };
    scan.interactionPolicy = { mode: input.interactionMode ?? 'safe', tested: interactionsUsed, skipped: exclusionsTotal };
    if (pages.length) {
      scan.pages = pages;
      scan.coverage = summarizeCoverage(pages, queue.length, visited.size, scan.limits, startedAt, { tested: interactionsUsed, skipped: exclusionsTotal });
      scan.graph = buildGraph(scan);
    }
  } finally {
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
    scan.updatedAt = new Date().toISOString();
    input.onUpdate(scan);
  }
  return scan;
}

export { DEFAULT_LIMITS };
