import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { safeDisplayUrl, assertSafeUrl } from './url-safety.js';
import type { AccessibilityEvidence, ControlEvidence, PageEvidence, RuntimeErrorEvidence, ScanLimits, ScanResult } from '../graph/schema.js';
import { buildGraph } from '../graph/build-graph.js';

const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const DEFAULT_LIMITS: ScanLimits = {
  maxPages: 5,
  maxDepth: 2,
  navigationTimeoutMs: 20_000,
  totalTimeoutMs: 60_000,
  maxControlsPerPage: 200,
  maxRequestsPerPage: 300,
  maxFindingsPerPage: 100,
};
const BLOCKED_PATH = /(?:^|\/)(?:pay|payment|checkout|purchase|buy|delete|remove|logout|signout|send|transfer|submit|order|confirm|unsubscribe|cancel)(?:\/|$|-)/i;

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
  onUpdate: (scan: ScanResult) => void;
}

function stableId(prefix: string, text: string): string {
  return `${prefix}:${createHash('sha1').update(text).digest('hex').slice(0, 14)}`;
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
  };
}

function redactMessage(message: string): string {
  return message
    .replace(/https?:\/\/[^\s\"'<>]+/gi, (value) => safeDisplayUrl(value).replace(/[),.;]+$/, ''))
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted email]')
    .slice(0, 240);
}

function errorEvidence(kind: RuntimeErrorEvidence['kind'], message: string, url?: string, statusCode?: number): RuntimeErrorEvidence {
  return {
    id: stableId('runtime-error', `${kind}|${url ? safeDisplayUrl(url) : ''}|${redactMessage(message)}`), kind, message: redactMessage(message),
    url: url ? safeDisplayUrl(url) : undefined,
    statusCode, evidenceLabel: 'observed',
  };
}

async function inspectControls(page: import('playwright').Page, pageUrl: string, limit: number): Promise<{ controls: ControlEvidence[]; links: string[] }> {
  const extracted = await page.evaluate(`(() => { const maxControls = ${limit};
    const elements = Array.from(document.querySelectorAll('a[href],button,input,select,textarea,[role=button],[role=link]')).slice(0, maxControls);
    return elements.map((element) => {
      const anchor = element.matches('a[href]') ? element : null;
      const input = element.matches('input') ? element : null;
      const labelledBy = element.getAttribute('aria-labelledby')?.split(/\\s+/).map((id) => document.getElementById(id)?.textContent?.trim()).filter(Boolean).join(' ');
      const label = input?.labels ? Array.from(input.labels).map((item) => item.textContent?.trim()).filter(Boolean).join(' ') : '';
      const name = element.getAttribute('aria-label') || labelledBy || element.getAttribute('title') || label || element.textContent?.trim() || input?.placeholder || input?.name || '';
      const form = element.closest('form');
      let selector = '';
      if (element.id) selector = '#' + CSS.escape(element.id);
      else {
        const parts = [];
        let current = element;
        while (current && current !== document.body && parts.length < 4) {
          const tag = current.tagName.toLowerCase();
          const siblings = current.parentElement ? Array.from(current.parentElement.children).filter((child) => child.tagName === current.tagName) : [];
          const nth = siblings.length > 1 ? ':nth-of-type(' + (siblings.indexOf(current) + 1) + ')' : '';
          parts.unshift(tag + nth);
          current = current.parentElement;
        }
        selector = parts.join(' > ');
      }
      return {
        role: element.getAttribute('role') || (anchor ? 'link' : input?.type || element.tagName.toLowerCase()),
        accessibleName: String(name).replace(/\\s+/g, ' ').slice(0, 120) || undefined,
        selector: selector.slice(0, 240),
        href: anchor?.href || undefined,
        formAction: form?.action || undefined,
        method: form?.method?.toUpperCase() || undefined,
      };
    });
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
    await page.addScriptTag({ content: axeSource });
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
      help: `Automated checks could not finish: ${error instanceof Error ? error.message.slice(0, 160) : 'unknown error'}`,
      helpUrl: 'https://github.com/dequelabs/axe-core',
      targets: [],
      evidenceLabel: 'observed',
    }];
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

export async function performScan(input: ScanInput): Promise<ScanResult> {
  const { chromium } = await import('playwright');
  const scan = initialResult(input);
  scan.status = 'running';
  scan.progress.message = 'Opening a controlled browser.';
  input.onUpdate(scan);

  const startedAt = Date.now();
  const origin = new URL(input.url).origin;
  const sampleOrigin = input.sample ? origin : undefined;
  const queue: Array<{ url: string; depth: number }> = [{ url: input.url, depth: 0 }];
  const visited = new Set<string>();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: false, serviceWorkers: 'block', ignoreHTTPSErrors: false });
  const pages: PageEvidence[] = [];

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
        pages.push({ id: stableId('page', pageUrl), url: pageUrl, status: 'skipped', depth: next.depth, controls: [], errors: [errorEvidence('page', error instanceof Error ? error.message : 'URL was blocked.', pageUrl)], findings: [], outgoingLinks: [], errorMessage: 'Destination was blocked by the URL safety policy.' });
        scan.pages = pages;
        scan.progress = { completedPages: pages.length, totalPageLimit: scan.limits.maxPages, message: 'A destination was blocked by the URL safety policy.' };
        scan.updatedAt = new Date().toISOString(); input.onUpdate(scan);
        continue;
      }
      const displayUrl = safeDisplayUrl(normalized.toString());
      if (visited.has(displayUrl)) continue;
      visited.add(displayUrl);
      scan.progress = { completedPages: pages.length, totalPageLimit: scan.limits.maxPages, currentUrl: displayUrl, message: `Inspecting page ${pages.length + 1}.` };
      scan.updatedAt = new Date().toISOString(); input.onUpdate(scan);
      const page = await context.newPage();
      const pageId = stableId('page', displayUrl);
      const errors: RuntimeErrorEvidence[] = [];
      let requestCount = 0;
      let requestLimitRecorded = false;
      const recordError = (error: RuntimeErrorEvidence) => { if (errors.length < 120) errors.push(error); };
      page.on('pageerror', (error) => recordError(errorEvidence('page', error.message, page.url())));
      page.on('console', (message) => { if (message.type() === 'error') recordError(errorEvidence('console', message.text(), page.url())); });
      page.on('requestfailed', (request) => recordError(errorEvidence('request', request.failure()?.errorText || 'Network request failed.', request.url())));
      page.on('response', (response) => { if (response.status() >= 400) recordError(errorEvidence('http', `HTTP ${response.status()} response.`, response.url(), response.status())); });
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
        const title = (await page.title()).slice(0, 180) || undefined;
        const { controls, links } = await inspectControls(page, finalUrl.toString(), scan.limits.maxControlsPerPage);
        const findings = await runAxe(page, pageId, scan.limits.maxFindingsPerPage);
        entry = { id: pageId, url: finalDisplayUrl, title, status: 'complete', depth: next.depth, controls, errors: errors.slice(0, 120), findings, outgoingLinks: links.map(safeDisplayUrl) };
        if (next.depth < scan.limits.maxDepth) {
          for (const href of links) {
            if (queue.length + visited.size >= scan.limits.maxPages) break;
            if (shouldCrawlLink(href, origin, Boolean(input.sample))) queue.push({ url: href, depth: next.depth + 1 });
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Page could not be inspected.';
        entry = { id: pageId, url: displayUrl, status: 'failed', depth: next.depth, controls: [], errors: [...errors.slice(0, 30), errorEvidence('page', message, displayUrl)], findings: [], outgoingLinks: [], errorMessage: message.slice(0, 200) };
      } finally {
        await page.close().catch(() => undefined);
      }
      pages.push(entry);
      scan.pages = pages;
      scan.progress = { completedPages: pages.length, totalPageLimit: scan.limits.maxPages, message: `${pages.length} page${pages.length === 1 ? '' : 's'} inspected.` };
      scan.updatedAt = new Date().toISOString(); input.onUpdate(scan);
    }

    if (pages.length === 0) throw new Error('No pages could be inspected within the scan limits.');
    scan.pages = pages;
    scan.status = pages.some((page) => page.status !== 'complete') ? 'partial' : 'complete';
    if (Date.now() - startedAt >= scan.limits.totalTimeoutMs && queue.length) scan.status = 'partial';
    scan.graph = buildGraph(scan);
    scan.progress = { completedPages: pages.length, totalPageLimit: scan.limits.maxPages, message: scan.status === 'complete' ? 'Scan complete.' : 'Scan completed with pages or destinations that could not be inspected.' };
  } catch (error) {
    scan.status = 'failed';
    scan.error = { code: 'SCAN_FAILED', message: error instanceof Error ? error.message.slice(0, 240) : 'The scan could not complete.', retryable: true };
    if (pages.length) {
      scan.pages = pages;
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
