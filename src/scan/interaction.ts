import type { BrowserContext, Locator, Page } from 'playwright';
import { abortReasonFor, assertSafeUrl, safeDisplayUrl } from './url-safety.js';
import { errorEvidence, redactMessage, stableId } from './evidence.js';
import type {
  AccessibilityEvidence, ControlEvidence, InteractionEvidence, InteractionExclusion, InteractionMode, InteractionOutcome,
  InteractionStep, PageEvidence, RevealedControlEvidence, RuntimeErrorEvidence,
} from '../graph/schema.js';

/** Paths that are not crawled or activated on external websites. */
export const BLOCKED_PATH = /(?:^|\/)(?:pay|payment|checkout|purchase|buy|delete|remove|logout|signout|send|transfer|submit|order|confirm|unsubscribe|cancel)(?:\/|$|-)/i;
const CONSEQUENTIAL = /(?:^|[^a-z])(delete|remove|destroy|erase|log ?out|sign ?out|unsubscribe|transfer|deactivate|revoke|purchase|buy now|place order|pay now|donate|send|close account|reset password|cancel account)(?:[^a-z]|$)/i;
const IGNORED_ROLES = new Set(['text', 'email', 'password', 'search', 'tel', 'url', 'number', 'date', 'datetime-local', 'month', 'time', 'week', 'color', 'radio', 'checkbox', 'select', 'select-one', 'select-multiple', 'textarea', 'file', 'range', 'hidden', 'option']);
const NAMED_ROLES = new Set(['link', 'button', 'tab', 'menuitem', 'switch']);
const CONTINUATION_NAME = /cart|basket|checkout|continue|proceed|next|view|open|details|payment|review|start|begin/i;
const MAX_STEPS = 2;
const MAX_REVEALED = 4;
const MAX_EXCLUSIONS_PER_PAGE = 12;
const MAX_ERRORS_PER_INTERACTION = 30;

export type ActionClass = 'safe' | 'requires-authorization' | 'consequential' | 'ignored';

/**
 * Decide whether a recorded control may be activated.
 * Consequential actions are never activated; form submits need explicit authorization.
 */
export function classifyAction(control: ControlEvidence, options: { isSample: boolean }): ActionClass {
  const role = (control.role || '').toLowerCase();
  if (IGNORED_ROLES.has(role)) return 'ignored';
  const name = (control.accessibleName ?? '').toLowerCase();
  const destination = control.formAction ?? control.href;
  const submits = Boolean(control.formAction) || role === 'submit' || role === 'image';
  if (CONSEQUENTIAL.test(name)) return 'consequential';
  if (!options.isSample && destination) {
    try {
      if (BLOCKED_PATH.test(new URL(destination).pathname)) return 'consequential';
    } catch { /* Unparseable destinations are treated as ordinary controls. */ }
  }
  if (submits) return 'requires-authorization';
  return 'safe';
}

export interface InteractionRunOptions {
  mode: InteractionMode;
  isSample: boolean;
  origin: string;
  /** Set when the person scanning asked to reach an address on their own computer. */
  allowPrivateNetwork?: boolean;
  maxPerPage: number;
  maxPerScanRemaining: number;
  deadline: number;
  settleMs?: number;
  clickTimeoutMs?: number;
  /** How long a disposable interaction page may take to reopen the tested page. Slow sites deserve a fair retry. */
  reopenTimeoutMs?: number;
  onProgress?: (message: string) => void;
}

export interface InteractionBatch {
  interactions: InteractionEvidence[];
  exclusions: InteractionExclusion[];
  errors: RuntimeErrorEvidence[];
  revealedLinks: string[];
}

interface ObservationEvent {
  kind: 'dialog' | 'popup' | 'navigation' | 'blocked';
  detail: string;
  status?: number;
  blockKind?: 'data-request' | 'external-navigation' | 'unsafe-url';
}

interface InteractionTarget {
  id: string;
  role: string;
  accessibleName?: string;
  selector?: string;
  href?: string;
  formAction?: string;
}

interface SnapshotItem {
  role: string;
  name: string;
  href?: string;
  expanded: string | null;
  disabled: boolean;
  busy: boolean;
}

interface PageSnapshot {
  items: SnapshotItem[];
  dialogOpen: boolean;
  mutations: number;
  textLength: number;
  scrollY: number;
}

const SNAPSHOT_SCRIPT = `(() => {
  const maxItems = 80;
  const isVisible = (element) => {
    if (element.matches('input[type="hidden"],[hidden],[inert]') || element.closest('[hidden],[aria-hidden="true"],[inert]')) return false;
    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
  };
  const items = Array.from(document.querySelectorAll('a[href],button,input,select,textarea,[role=button],[role=link],[role=tab],[role=menuitem]')).filter(isVisible).slice(0, maxItems).map((element) => ({
    role: element.getAttribute('role') || (element.tagName === 'A' ? 'link' : element.tagName === 'BUTTON' ? 'button' : element.tagName.toLowerCase()),
    name: String(element.getAttribute('aria-label') || element.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 90),
    href: element.tagName === 'A' ? element.href : undefined,
    expanded: element.getAttribute('aria-expanded'),
    disabled: element.matches(':disabled') || element.getAttribute('aria-disabled') === 'true',
    busy: element.getAttribute('aria-busy') === 'true',
  }));
  return {
    items,
    dialogOpen: Boolean(document.querySelector('dialog[open],[role="dialog"]:not([aria-hidden="true"])')),
    mutations: Number(window.__accessRippleMutations || 0),
    textLength: document.body ? document.body.innerText.replace(/\\s+/g, ' ').length : 0,
    scrollY: Math.round(window.scrollY || 0),
  };
})()`;

const INSTALL_MUTATION_COUNTER = `(() => {
  window.__accessRippleMutations = 0;
  try {
    new MutationObserver((records) => {
      let count = 0;
      for (const record of records) count += record.addedNodes.length;
      window.__accessRippleMutations = Number(window.__accessRippleMutations || 0) + count;
    }).observe(document.documentElement, { childList: true, subtree: true });
  } catch { /* The counter is only an observation aid. */ }
})()`;

function itemKey(item: SnapshotItem): string {
  return `${item.role}|${item.name}|${item.href ?? ''}`;
}

function withoutHash(href: string): string {
  return href.split('#')[0] ?? href;
}

function displayPath(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname === '/' ? parsed.hostname : parsed.pathname;
  } catch { return url; }
}

function pushExclusion(batch: InteractionBatch, control: ControlEvidence, reason: InteractionExclusion['reason']): void {
  if (batch.exclusions.length >= MAX_EXCLUSIONS_PER_PAGE) return;
  if (batch.exclusions.some((item) => item.controlId === control.id)) return;
  batch.exclusions.push({ controlId: control.id, reason });
}

function firstBlockKind(blocked: ObservationEvent[]): NonNullable<InteractionStep['blockKind']> {
  for (const event of blocked) if (event.blockKind) return event.blockKind;
  return 'data-request';
}

function priority(item: { control: ControlEvidence; actionClass: ActionClass }): number {
  if (item.actionClass === 'ignored') return 4;
  if (item.actionClass === 'safe' && !item.control.href && !item.control.formAction) return 0;
  if (item.actionClass === 'safe') return 1;
  return 2;
}

/**
 * Activate a bounded set of recorded controls in disposable pages and record what actually happened.
 * Only GET/HEAD requests leave the browser; form submits run only with explicit authorization,
 * and requests that would change data are always blocked and recorded.
 */
export async function runInteractions(context: BrowserContext, entry: PageEvidence, options: InteractionRunOptions): Promise<InteractionBatch> {
  const batch: InteractionBatch = { interactions: [], exclusions: [], errors: [], revealedLinks: [] };
  const ranked = entry.controls
    .map((control) => ({ control, actionClass: classifyAction(control, { isSample: options.isSample }) }))
    .sort((a, b) => priority(a) - priority(b));
  const seen = new Set<string>();
  for (const { control, actionClass } of ranked) {
    if (actionClass === 'ignored') continue;
    const key = `${control.role}|${control.accessibleName ?? ''}|${control.href ?? ''}|${control.formAction ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (actionClass === 'consequential') { pushExclusion(batch, control, 'consequential-action'); continue; }
    if (actionClass === 'requires-authorization' && options.mode !== 'include-submits') { pushExclusion(batch, control, 'requires-authorization'); continue; }
    // Exemptions above are always reported with their real reason; only activatable
    // controls can run out of interaction budget.
    if (batch.interactions.length >= options.maxPerPage || batch.interactions.length >= options.maxPerScanRemaining) { pushExclusion(batch, control, 'budget'); continue; }
    if (Date.now() > options.deadline) { pushExclusion(batch, control, 'budget'); continue; }
    const result = await runSingleInteraction(context, entry, control, options);
    if (!result) continue;
    batch.interactions.push(result.evidence);
    batch.errors.push(...result.errors);
    batch.revealedLinks.push(...result.links);
    options.onProgress?.(summarizeInteraction(result.evidence.steps));
  }
  return batch;
}

async function locate(page: Page, target: InteractionTarget, entry: PageEvidence): Promise<Locator | null> {
  if (target.selector) {
    try {
      const bySelector = page.locator(target.selector);
      if (await bySelector.count() === 1 && await bySelector.first().isVisible()) return bySelector.first();
    } catch { /* Fall through to role and text lookup. */ }
  }
  const role = target.role === 'submit' || target.role === 'image' ? 'button' : target.role;
  if (NAMED_ROLES.has(role) && target.accessibleName) {
    try {
      const byName = page.getByRole(role as 'link' | 'button' | 'tab' | 'menuitem' | 'switch', { name: target.accessibleName, exact: true }).first();
      if (await byName.count() > 0 && await byName.isVisible()) return byName;
    } catch { /* Fall through to href lookup. */ }
  }
  const href = target.href ?? target.formAction;
  if (href) {
    try {
      const tagged = await page.evaluate(`(() => { const target = ${JSON.stringify(href)}; const element = Array.from(document.querySelectorAll('a[href]')).find((candidate) => candidate.href === target); if (!element) return false; element.setAttribute('data-ar-locate', '1'); return true; })()`);
      if (tagged) {
        const locator = page.locator('[data-ar-locate="1"]').first();
        if (await locator.count() > 0 && await locator.isVisible()) return locator;
      }
    } catch { /* The control could not be located. */ }
    return null;
  }
  if (target.accessibleName && entry.url) {
    try {
      const byText = page.getByText(target.accessibleName, { exact: true }).first();
      if (await byText.count() > 0 && await byText.isVisible()) return byText;
    } catch { /* The control could not be located. */ }
  }
  return null;
}

async function snapshot(page: Page): Promise<PageSnapshot> {
  const value = await page.evaluate(SNAPSHOT_SCRIPT).catch(() => null);
  if (!value || typeof value !== 'object') return { items: [], dialogOpen: false, mutations: 0, textLength: 0, scrollY: 0 };
  return value as PageSnapshot;
}

async function validationIssue(page: Page, selector?: string): Promise<number> {
  if (!selector) return 0;
  const result = await page.evaluate(`(() => { const element = document.querySelector(${JSON.stringify(selector)}); if (!element || !element.form) return 0; return element.form.querySelectorAll(':invalid').length; })()`).catch(() => 0);
  return typeof result === 'number' ? result : 0;
}

async function runSingleInteraction(
  context: BrowserContext,
  entry: PageEvidence,
  control: ControlEvidence,
  options: InteractionRunOptions,
): Promise<{ evidence: InteractionEvidence; errors: RuntimeErrorEvidence[]; links: string[] } | null> {
  const page = await context.newPage();
  const errors: RuntimeErrorEvidence[] = [];
  const events: ObservationEvent[] = [];
  const settleMs = options.settleMs ?? 750;
  const clickTimeoutMs = options.clickTimeoutMs ?? 2500;
  // Request failures caused by our own safety policy are not site signals; track them so they can be excluded.
  const policyBlocked = new Set<string>();
  const policyKey = (url: string) => safeDisplayUrl(url).toLowerCase();
  const recordError = (error: RuntimeErrorEvidence) => { if (errors.length < MAX_ERRORS_PER_INTERACTION) errors.push(error); };
  page.on('dialog', (dialog) => {
    events.push({ kind: 'dialog', detail: `${dialog.type()} dialog: ${dialog.message().slice(0, 160) || 'no message'}` });
    void dialog.dismiss().catch(() => undefined);
  });
  page.on('popup', (popup) => {
    events.push({ kind: 'popup', detail: safeDisplayUrl(popup.url()) });
    void popup.close().catch(() => undefined);
  });
  page.on('pageerror', (error) => recordError(errorEvidence('page', error.message, page.url())));
  page.on('console', (message) => { if (message.type() === 'error') recordError(errorEvidence('console', message.text(), page.url())); });
  page.on('requestfailed', (request) => { if (!policyBlocked.has(policyKey(request.url()))) recordError(errorEvidence('request', request.failure()?.errorText || 'Network request failed.', request.url())); });
  page.on('response', (response) => {
    if (response.request().isNavigationRequest() && response.frame() === page.mainFrame()) events.push({ kind: 'navigation', detail: response.url(), status: response.status() });
    if (response.status() >= 400) recordError(errorEvidence('http', `HTTP ${response.status()} response.`, response.url(), response.status()));
  });
  await page.route('**/*', async (route) => {
    const request = route.request();
    const requestUrl = request.url();
    const block = (detail: string, blockKind: NonNullable<ObservationEvent['blockKind']>) => {
      policyBlocked.add(policyKey(requestUrl));
      events.push({ kind: 'blocked', detail, blockKind });
      return route.abort('blockedbyclient').catch(() => undefined);
    };
    if (!requestUrl.startsWith('http://') && !requestUrl.startsWith('https://')) return route.abort('blockedbyclient').catch(() => undefined);
    if (!['GET', 'HEAD'].includes(request.method().toUpperCase())) return block(`${request.method().toUpperCase()} ${safeDisplayUrl(requestUrl)}`, 'data-request');
    try {
      await assertSafeUrl(requestUrl, { allowLocalSample: options.isSample, sampleOrigin: options.isSample ? options.origin : undefined, allowPrivateNetwork: options.allowPrivateNetwork });
    } catch {
      return block(`unsafe request ${safeDisplayUrl(requestUrl)}`, 'unsafe-url');
    }
    if (request.isNavigationRequest() && new URL(requestUrl).origin !== options.origin) {
      return block(`navigation outside the tested website to ${safeDisplayUrl(requestUrl)}`, 'external-navigation');
    }
    // The browser follows a redirect without asking the route again, so the
    // redirect target of a page is checked here before the browser may go.
    if (request.isNavigationRequest()) {
      const response = await route.fetch({ maxRedirects: 0, timeout: options.reopenTimeoutMs ?? 12_000 }).catch((error: unknown) => error instanceof Error ? error : new Error(String(error)));
      // A page that cannot be fetched fails as it would in the browser.
      if (response instanceof Error) return route.abort(abortReasonFor(response)).catch(() => undefined);
      const location = response.status() >= 300 && response.status() < 400 ? response.headers()['location'] : undefined;
      if (location) {
        const target = new URL(location, requestUrl);
        if (target.origin !== options.origin) return block(`navigation outside the tested website to ${safeDisplayUrl(target.toString())}`, 'external-navigation');
        try {
          await assertSafeUrl(target.toString(), { allowLocalSample: options.isSample, sampleOrigin: options.isSample ? options.origin : undefined, allowPrivateNetwork: options.allowPrivateNetwork });
        } catch {
          return block(`unsafe request ${safeDisplayUrl(target.toString())}`, 'unsafe-url');
        }
      }
      return route.fulfill({ response }).catch(() => undefined);
    }
    return route.continue();
  });

  try {
    try {
      await page.goto(entry.url, { waitUntil: 'domcontentloaded', timeout: options.reopenTimeoutMs ?? 12_000 });
      // Let the starting page finish its own loading before observing the click, so errors
      // that belong to the page load are never attributed to an interaction that follows.
      await page.waitForLoadState('load', { timeout: Math.max(3000, clickTimeoutMs) }).catch(() => undefined);
    } catch (error) {
      return {
        evidence: {
          id: stableId('interaction', `${entry.id}|${control.id}|reopen`), rootControlId: control.id, mode: options.mode, evidenceLabel: 'observed',
          steps: [{ controlId: control.id, label: control.accessibleName || control.href || control.role, action: 'click', outcome: 'failed', summary: `The page could not be reopened for testing: ${redactMessage(error instanceof Error ? error.message : 'unknown error')}`, errorIds: [] }],
        },
        errors,
        links: [],
      };
    }
    const steps: InteractionStep[] = [];
    let target: InteractionTarget = { id: control.id, role: control.role, accessibleName: control.accessibleName, selector: control.selector, href: control.href, formAction: control.formAction };
    for (let index = 0; index < MAX_STEPS; index++) {
      const step = await activate(page, entry, target, events, errors, clickTimeoutMs, settleMs, index === 0 && Boolean(control.formAction));
      steps.push(step);
      if (step.outcome !== 'content-changed' || !step.revealed?.length) break;
      const follow = chooseFollowUp(step.revealed, page.url(), options);
      if (!follow) break;
      target = { id: stableId('control', `${entry.id}|${follow.role}|${follow.name}`), role: follow.role, accessibleName: follow.name, href: follow.href };
    }
    const links = new Set<string>();
    for (const step of steps) {
      for (const revealed of step.revealed ?? []) if (revealed.href) links.add(revealed.href);
      if (step.destinationUrl) links.add(step.destinationUrl);
    }
    return {
      evidence: { id: stableId('interaction', `${entry.id}|${control.id}|${steps.map((step) => step.outcome).join('>')}`), rootControlId: control.id, mode: options.mode, steps, evidenceLabel: 'observed' },
      errors: errors.slice(0, MAX_ERRORS_PER_INTERACTION),
      links: [...links].map(safeDisplayUrl),
    };
  } finally {
    await page.close().catch(() => undefined);
  }
}

async function activate(page: Page, entry: PageEvidence, target: InteractionTarget, events: ObservationEvent[], errors: RuntimeErrorEvidence[], clickTimeoutMs: number, settleMs: number, expectsForm: boolean): Promise<InteractionStep> {
  const label = target.accessibleName || target.role;
  const base = { controlId: target.id, label, action: 'click' as const };
  const locator = await locate(page, target, entry);
  if (!locator) {
    return { ...base, outcome: 'failed', summary: 'The control could not be located on a fresh page load, so its behavior is unknown.', errorIds: [] };
  }
  await locator.scrollIntoViewIfNeeded({ timeout: 1500 }).catch(() => undefined);
  const before = await snapshot(page);
  await page.evaluate(INSTALL_MUTATION_COUNTER).catch(() => undefined);
  const wasDisabled = await locator.isDisabled().catch(() => false);
  const sourceHref = page.url();
  const eventMark = events.length;
  const errorMark = errors.length;
  let clickError: string | null = null;
  // Off-screen skip links and focus-revealed controls may reject pointer clicks; keyboard activation is how visitors reach them.
  try {
    await locator.click({ timeout: clickTimeoutMs });
  } catch (error) {
    try {
      await locator.focus({ timeout: 1000 });
      await page.keyboard.press('Enter');
    } catch {
      clickError = error instanceof Error ? error.message : 'The control could not be activated.';
    }
  }
  await page.waitForTimeout(settleMs);
  await page.waitForLoadState('domcontentloaded', { timeout: 1500 }).catch(() => undefined);
  const after = await snapshot(page);
  const stepEvents = events.slice(eventMark);
  const errorIds = errors.slice(errorMark).map((error) => error.id);
  const dialog = stepEvents.find((event) => event.kind === 'dialog');
  const popup = stepEvents.find((event) => event.kind === 'popup');
  const blocked = stepEvents.filter((event) => event.kind === 'blocked');
  const blockedNavigation = blocked.find((event) => event.blockKind === 'external-navigation');
  const navigation = [...stepEvents].reverse().find((event) => event.kind === 'navigation');
  const revealed = after.items.filter((item) => !before.items.some((previous) => itemKey(previous) === itemKey(item)))
    .slice(0, MAX_REVEALED).map((item): RevealedControlEvidence => ({ name: item.name, role: item.role, href: item.href }));
  const scrolled = Math.abs(after.scrollY - before.scrollY) >= 24;
  const changed = revealed.length > 0 || after.mutations - before.mutations >= 5 || Math.abs(after.textLength - before.textLength) >= 24 || scrolled;
  const completed = { ...base, controlId: target.id };
  try {
    if (dialog) return { ...completed, outcome: 'dialog-opened', summary: `A ${dialog.detail} appeared; it was dismissed without any input.`, errorIds };
    if (popup) return { ...completed, outcome: 'navigated', summary: `Opened a new window at ${displayPath(popup.detail)}; it was closed without interacting.`, destinationUrl: popup.detail, windowOpened: popup.detail, errorIds };
    const currentHref = page.url();
    // A blocked external navigation can surface as Chromium's error page; report the policy action, not a fake destination.
    if (blockedNavigation && (currentHref.startsWith('chrome-error://') || withoutHash(currentHref) === withoutHash(sourceHref))) {
      let externalHost = '';
      try { externalHost = new URL(target.href ?? '').hostname; } catch { /* The exact host is unknown; the summary stays generic. */ }
      return { ...completed, outcome: 'blocked', blockKind: 'external-navigation', summary: `This action leaves the tested website${externalHost ? ` (${externalHost})` : ''}, so the navigation was blocked before it was sent.`, errorIds };
    }
    if (currentHref.startsWith('chrome-error://')) return { ...completed, outcome: 'failed', summary: 'The navigation failed before a page could load.', errorIds };
    if (withoutHash(currentHref) !== withoutHash(sourceHref)) {
      const destination = safeDisplayUrl(currentHref);
      if (navigation?.status && navigation.status >= 400) return { ...completed, outcome: 'failed', summary: `Navigated to ${displayPath(destination)}, which returned HTTP ${navigation.status}.`, destinationUrl: destination, errorIds };
      return { ...completed, outcome: 'navigated', summary: `Navigated to ${displayPath(destination)}.`, destinationUrl: destination, revealed: revealed.length ? revealed : undefined, errorIds };
    }
    if (after.dialogOpen && !before.dialogOpen) return { ...completed, outcome: 'dialog-opened', summary: 'A dialog opened on the page and covers the recorded state.', errorIds };
    if (expectsForm && target.selector) {
      const invalid = await validationIssue(page, target.selector);
      if (invalid > 0) return { ...completed, outcome: 'validation-shown', summary: `The form stopped submission and marked ${invalid} field${invalid === 1 ? '' : 's'} for attention.`, errorIds };
    }
    const nowDisabled = await locator.isDisabled().catch(() => false);
    const busy = await locator.getAttribute('aria-busy').catch(() => null);
    if ((nowDisabled && !wasDisabled) || busy === 'true') return { ...completed, outcome: 'loading', summary: 'The control entered a loading or disabled state while the page responded.', errorIds };
    if (changed) return { ...completed, outcome: 'content-changed', summary: revealed.length ? `The page changed and revealed ${revealed.map((item) => `“${item.name}”`).slice(0, 2).join(' and ')}.` : scrolled ? 'The viewport moved after activation — an anchor or skip link changed the reading position.' : 'The page content changed after activation.', revealed, errorIds };
    if (blocked.length) {
      const kinds = new Set(blocked.map((event) => event.blockKind ?? 'data-request'));
      const summary = kinds.has('unsafe-url') && kinds.size === 1
        ? `The action requested a URL the safety policy does not allow (${blocked.map((event) => event.detail).join(', ')}) and AccessRipple blocked it.`
        : `The action tried a data-changing request (${blocked.map((event) => event.detail).join(', ')}) and AccessRipple blocked it before anything was sent.`;
      return { ...completed, outcome: 'blocked', blockKind: firstBlockKind(blocked), summary, errorIds };
    }
    if (clickError) return { ...completed, outcome: 'failed', summary: `The control could not be activated: ${redactMessage(clickError)}`, errorIds };
    return { ...completed, outcome: 'no-visible-change', summary: 'No visible change was recorded within the observation window.', errorIds };
  } finally {
    await page.evaluate(`(() => { const element = document.querySelector('[data-ar-locate]'); if (element) element.removeAttribute('data-ar-locate'); })()`).catch(() => undefined);
  }
}

function chooseFollowUp(revealed: RevealedControlEvidence[], currentUrl: string, options: InteractionRunOptions): RevealedControlEvidence | null {
  const candidates = revealed.filter((item) => item.role === 'link' && item.href).map((item) => {
    let score = 0;
    try {
      const url = new URL(item.href!);
      if (url.origin !== options.origin) score -= 50;
      if (!options.isSample && BLOCKED_PATH.test(url.pathname)) score -= 200;
      if (withoutHash(url.toString()) === withoutHash(currentUrl)) score -= 100;
    } catch { score -= 200; }
    if (CONTINUATION_NAME.test(item.name)) score += 5;
    return { item, score };
  }).filter((candidate) => candidate.score > -50).sort((a, b) => b.score - a.score);
  return candidates[0]?.item ?? null;
}

export function summarizeInteraction(steps: InteractionStep[]): string {
  const parts = steps.map((step) => {
    const label = step.label ? `“${step.label}”` : 'The control';
    switch (step.outcome) {
      case 'navigated': return step.windowOpened ? `${label} opened ${displayPath(step.windowOpened)} in a new window` : `${label} navigated to ${displayPath(step.destinationUrl ?? '')}`;
      case 'content-changed': return `${label} changed the page${step.revealed?.length ? ` and revealed ${step.revealed.slice(0, 2).map((item) => `“${item.name}”`).join(' and ')}` : ''}`;
      case 'dialog-opened': return `${label} opened a dialog`;
      case 'validation-shown': return `${label} stopped at form validation`;
      case 'loading': return `${label} showed a loading state`;
      case 'no-visible-change': return `${label} showed no visible change`;
      case 'blocked': return step.blockKind === 'external-navigation' ? `${label} leaves this website, so the navigation was blocked` : step.blockKind === 'unsafe-url' ? `${label} requested a blocked URL` : `${label} tried a data-changing request that AccessRipple blocked`;
      default: return `${label} could not be activated`;
    }
  });
  return `Activated ${parts.join('; then ')}`.slice(0, 300);
}

export function outcomeLabel(step: InteractionStep): string {
  switch (step.outcome) {
    case 'navigated': return step.windowOpened ? 'Opens a new window' : `Leads to ${displayPath(step.destinationUrl ?? '')}`;
    case 'content-changed': return step.revealed?.length ? `Reveals ${step.revealed.slice(0, 2).map((item) => `“${item.name}”`).join(' and ')}`.slice(0, 120) : 'Reveals new content';
    case 'dialog-opened': return 'Opens a dialog';
    case 'validation-shown': return 'Stops at validation';
    case 'loading': return 'Shows a loading state';
    case 'no-visible-change': return 'No visible change';
    case 'blocked': return step.blockKind === 'external-navigation' ? 'Leaves this website · not followed' : step.blockKind === 'unsafe-url' ? 'Blocked by the safety policy' : 'Data request blocked';
    case 'failed': return 'Interaction failed';
  }
}

/** One stop of the keyboard's Tab ring. */
export interface FocusStop {
  selector: string;
  name?: string;
  snippet: string;
  /** Whether anything about the element looked different while it had focus. */
  visibleFocus: boolean;
  box?: { x: number; y: number; width: number; height: number };
}

export interface KeyboardProbe {
  stops: FocusStop[];
  /** How many elements on the page can be reached with Tab. */
  tabbable: number;
  /** For the last six presses, focus went round two or fewer elements on a page that has more. */
  trapped: boolean;
}

/**
 * Press Tab a bounded number of times and record where focus goes. Tab moves
 * focus and activates nothing, so this is as safe as reading the page. It
 * reports two things a person using a keyboard meets and a static check
 * misses: focus that cannot get out of a small group of elements, and a
 * focused element that looks no different from an unfocused one.
 */
export async function probeKeyboard(page: Page, presses = 12): Promise<KeyboardProbe> {
  const tabbable = await page.evaluate(() => {
    document.querySelectorAll('[data-accessripple-focus]').forEach((element) => element.removeAttribute('data-accessripple-focus'));
    (document.activeElement as HTMLElement | null)?.blur?.();
    const candidates = document.querySelectorAll('a[href], button, input:not([type="hidden"]), select, textarea, [tabindex], [contenteditable="true"], summary');
    return Array.from(candidates).filter((element) => {
      const tabIndex = (element as HTMLElement).tabIndex;
      if (tabIndex < 0 || (element as HTMLButtonElement).disabled) return false;
      const style = getComputedStyle(element);
      return style.visibility !== 'hidden' && style.display !== 'none' && element.getClientRects().length > 0;
    }).length;
  });
  const stops: FocusStop[] = [];
  for (let press = 0; press < presses; press += 1) {
    await page.keyboard.press('Tab');
    const stop = await page.evaluate(() => {
      const element = document.activeElement;
      if (!element || element === document.body || element === document.documentElement) return null;
      const path = (node: Element): string => {
        if (node.id) return '#' + CSS.escape(node.id);
        const parts: string[] = [];
        let current: Element | null = node;
        while (current && current !== document.body) {
          const tag = current.tagName.toLowerCase();
          const siblings = current.parentElement ? Array.from(current.parentElement.children).filter((child) => child.tagName === current!.tagName) : [];
          parts.unshift(tag + (siblings.length > 1 ? `:nth-of-type(${siblings.indexOf(current) + 1})` : ''));
          if (document.querySelectorAll(parts.join(' > ')).length === 1) break;
          current = current.parentElement;
        }
        return parts.join(' > ');
      };
      const look = () => {
        const style = getComputedStyle(element);
        return [style.outlineStyle, style.outlineWidth, style.outlineColor, style.boxShadow, style.borderColor, style.backgroundColor, style.color, style.textDecorationLine].join('|');
      };
      const focused = look();
      const outlined = (() => { const style = getComputedStyle(element); return style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0; })();
      (element as HTMLElement).blur();
      const unfocused = look();
      (element as HTMLElement).focus({ preventScroll: true });
      const rect = element.getBoundingClientRect();
      const html = element.outerHTML;
      const open = html.slice(0, html.indexOf('>') + 1);
      return {
        selector: path(element),
        name: (element.getAttribute('aria-label') || (element as HTMLElement).innerText || element.getAttribute('title') || '').replace(/\s+/g, ' ').trim().slice(0, 80) || undefined,
        // A short element is kept whole, so a proposed change can be applied to it.
        snippet: (html.length <= 300 ? html : open).replace(/\s+/g, ' ').trim(),
        visibleFocus: outlined || focused !== unfocused,
        box: rect.width > 0 && rect.height > 0 ? { x: Math.round(rect.left + window.scrollX), y: Math.round(rect.top + window.scrollY), width: Math.round(rect.width), height: Math.round(rect.height) } : undefined,
      };
    }).catch(() => null);
    if (stop) stops.push(stop);
  }
  // The last six presses never left two elements, on a page with more to reach.
  const recent = stops.slice(-6).map((stop) => stop.selector);
  const trapped = tabbable > 2 && recent.length === 6 && new Set(recent).size <= 2;
  return { stops, tabbable, trapped };
}

/** What the keyboard probe found, as findings the rest of the tool already knows how to show. */
export function keyboardFindings(pageId: string, probe: KeyboardProbe, controls: ControlEvidence[]): AccessibilityEvidence[] {
  const findings: AccessibilityEvidence[] = [];
  const controlFor = (selector: string) => controls.filter((control) => control.selector === selector).map((control) => control.id);
  if (probe.trapped) {
    const ring = [...new Set(probe.stops.slice(-6).map((stop) => stop.selector))];
    const first = probe.stops.find((stop) => stop.selector === ring[0])!;
    findings.push({
      id: stableId('finding', `${pageId}|keyboard-trap|${ring.join(',')}`), ruleId: 'keyboard-trap', impact: 'critical', status: 'needs-review',
      help: `Keyboard focus went round ${ring.length === 1 ? 'one element' : 'two elements'} and could not move on`,
      helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/no-keyboard-trap.html', targets: [first.selector], tags: ['wcag212'],
      snippet: first.snippet, affectedControlIds: ring.flatMap(controlFor), ...(first.box ? { boundingBox: first.box } : {}), evidenceLabel: 'observed',
    });
  }
  const seen = new Set<string>();
  for (const stop of probe.stops) {
    if (stop.visibleFocus || seen.has(stop.selector)) continue;
    seen.add(stop.selector);
    findings.push({
      id: stableId('finding', `${pageId}|focus-not-visible|${stop.selector}`), ruleId: 'focus-not-visible', impact: 'serious', status: 'needs-review',
      help: 'Nothing visible changed when this element received keyboard focus',
      helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html', targets: [stop.selector], tags: ['wcag247'],
      snippet: stop.snippet, affectedControlIds: controlFor(stop.selector), ...(stop.box ? { boundingBox: stop.box } : {}), evidenceLabel: 'observed',
    });
  }
  return findings;
}
