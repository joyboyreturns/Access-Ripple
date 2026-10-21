import type { GraphNode, InteractionStepView, ScanResult, SiteGraph } from './types.js';

export type GraphFilter = 'overview' | 'pages' | 'controls' | 'issues' | 'flows';
export type ViewNode = GraphNode & { memberIds?: string[] };
type Copy = { title: string; short: string; meaning: string; fix: string };
const copies: Record<string, Copy> = {
  'link-in-text-block': { title: 'Some links are hard to spot', short: 'Links blend into text', meaning: 'Links may look like the text around them. People with low vision or color blindness could miss the next step.', fix: 'Add a persistent underline or another visible cue. Color should not be the only way to identify a link.' },
  'color-contrast': { title: 'Some text is hard to read', short: 'Low text contrast', meaning: 'Text and its background may be too similar, making words difficult to read.', fix: 'Use a darker foreground or a lighter background. Aim for at least 4.5:1 contrast for normal text and 3:1 for large text; verify the actual colors.' },
  'aria-valid-attr-value': { title: 'A control may announce the wrong value', short: 'Unclear control value', meaning: 'Assistive technology may receive an invalid value, so someone using a screen reader could misunderstand this control.', fix: 'Check the highlighted ARIA attribute against the control’s actual role and state. Use a supported value and a valid referenced element.' },
  'bypass': { title: 'There is no clear shortcut to main content', short: 'Missing content shortcut', meaning: 'Keyboard users may need to pass through repeated navigation before reaching the page’s main content.', fix: 'Add a visible-on-focus “Skip to main content” link and a main landmark with a unique target.' },
  'label': { title: 'A form field needs a name', short: 'Unlabeled form field', meaning: 'People using screen readers may not know what information this field asks for.', fix: 'Connect a visible label to the field with matching for and id attributes. A placeholder alone is not a reliable label.' },
  'image-alt': { title: 'An image needs a text alternative', short: 'Missing image description', meaning: 'A person who cannot see the image may miss information it communicates.', fix: 'Add concise alt text for meaningful images. Use an empty alt attribute for purely decorative images.' },
  'button-name': { title: 'A button needs a clear name', short: 'Unlabeled button', meaning: 'Assistive technology may not explain what happens when this button is activated.', fix: 'Use visible button text or a concise accessible name that describes the action.' },
  'link-name': { title: 'A link needs a clear name', short: 'Unlabeled link', meaning: 'People may not know where this link will take them.', fix: 'Provide meaningful link text or an accessible name that describes its destination.' },
  'document-title': { title: 'The page needs a descriptive title', short: 'Missing page title', meaning: 'Browser tabs and screen readers may not give people a useful name for this page.', fix: 'Add a unique, descriptive title element in the document head.' },
  'html-has-lang': { title: 'The page language is missing', short: 'Missing page language', meaning: 'A screen reader may pronounce the page using the wrong language.', fix: 'Set the document’s lang attribute to the language used by the page.' },
};

export function str(node: GraphNode | undefined, key: string): string {
  const value = node?.data[key];
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

const keyToken = /^(?:shift|ctrl|control|alt|option|cmd|command|meta|fn|esc|escape|enter|return|tab|space|spacebar|delete|backspace|insert|home|end|pageup|pagedown|page up|page down|forward slash|backslash|backtick|back tick|left bracket|right bracket|left arrow|right arrow|up arrow|down arrow|question mark|exclamation mark|number sign|semicolon|apostrophe|underscore|hyphen|period|comma|slash|plus|minus|equals|f\d{1,2}|arrow(?:up|down|left|right)|[a-z0-9]|[⌘⇧⌥⌃⌖↵⌫])$/i;
const modifierToken = /^(?:shift|ctrl|control|alt|option|cmd|command|meta|fn|[⌘⇧⌥⌃])$/i;

/**
 * Some sites append their keyboard shortcut to the accessible name, for example
 * “Cart, shift, option, c” or “Search (Shift + K)”. Separate it so the interface
 * can show a readable name and keep the shortcut as its own, useful detail.
 */
export function labelParts(label: string): { name: string; keys: string[] } {
  const parenthetical = label.match(/^(.*\S)\s*\(([^()]+)\)\s*$/);
  if (parenthetical) {
    const keys = parenthetical[2]!.split(/\s*\+\s*/).map((key) => key.trim()).filter(Boolean);
    if (keys.length >= 2 && keys.every((key) => keyToken.test(key)) && keys.some((key) => modifierToken.test(key))) return { name: parenthetical[1]!.trim(), keys };
  }
  const segments = label.split(',').map((part) => part.trim()).filter(Boolean);
  const keys: string[] = [];
  while (segments.length > 1 && keyToken.test(segments[segments.length - 1]!)) keys.unshift(segments.pop()!);
  if (keys.length < 2 || !keys.some((key) => modifierToken.test(key))) return { name: label, keys: [] };
  return { name: segments.join(', ').trim() || label, keys };
}

export function cleanLabel(label: string): string { return labelParts(label).name.trim(); }

export function shortcutOf(label: string): string {
  const names: Record<string, string> = { shift: 'Shift', ctrl: 'Ctrl', control: 'Ctrl', alt: 'Alt', option: 'Option', cmd: 'Cmd', command: 'Command', meta: 'Meta', fn: 'Fn', esc: 'Esc', escape: 'Esc', enter: 'Enter', return: 'Enter', tab: 'Tab', space: 'Space', spacebar: 'Space', delete: 'Delete', backspace: 'Backspace', pageup: 'Page Up', pagedown: 'Page Down', 'page up': 'Page Up', 'page down': 'Page Down', 'forward slash': '/', slash: '/', backslash: '\\', backtick: '`', 'back tick': '`', 'left bracket': '[', 'right bracket': ']', 'left arrow': '←', 'right arrow': '→', 'up arrow': '↑', 'down arrow': '↓', 'question mark': '?', 'exclamation mark': '!', 'number sign': '#', semicolon: ';', apostrophe: "'", underscore: '_', hyphen: '-', period: '.', comma: ',', plus: '+', minus: '−', equals: '=' };
  return labelParts(label).keys.map((key) => names[key.toLowerCase()] ?? (key.length === 1 ? key.toUpperCase() : key.charAt(0).toUpperCase() + key.slice(1))).join(' + ');
}

/** Clean shortcut hints inside quoted names used by recorded summaries. */
function cleanQuoted(text: string): string {
  return text.replace(/“([^”]+)”/g, (_match, inner: string) => `“${cleanLabel(inner)}”`);
}

/** Turn common browser failures into a next step people can understand. */
export function friendlyScanError(message: string): string {
  const text = message.toLowerCase();
  if (/name_not_resolved|enotfound|getaddrinfo/.test(text)) return 'That address could not be found. Check the spelling and try again.';
  if (/err_connection_refused|econnrefused/.test(text)) return 'The site refused the connection. It may be offline or blocking automated browsers.';
  if (/err_cert|ssl|certificate/.test(text)) return 'The site’s security certificate could not be verified, so the scan stopped.';
  if (/timed out|timeout|etimedout/.test(text)) return 'The site took too long to respond. Try again, or start from a smaller page.';
  if (/err_http_response_code_failure|err_blocked_by_client|\b403\b|\b429\b/.test(text)) return 'The site refused the automated browser. Some sites block scanners; try another public page.';
  if (/err_internet_disconnected|err_network/.test(text)) return 'The network connection dropped during the scan. Check your connection and try again.';
  return message;
}

function stepsOf(node: GraphNode): InteractionStepView[] {
  return Array.isArray(node.data.steps) ? node.data.steps as InteractionStepView[] : [];
}

function lastStepOf(node: GraphNode): InteractionStepView | undefined {
  const steps = stepsOf(node);
  return steps[steps.length - 1];
}

function isTestedFlow(node: GraphNode): boolean {
  return node.kind === 'flow' && node.data.tested === true && Boolean(lastStepOf(node));
}

const outcomeShorts: Record<string, string> = {
  'navigated': 'Leads to destination',
  'content-changed': 'Reveals new content',
  'dialog-opened': 'Opens a dialog',
  'validation-shown': 'Stops at validation',
  'loading': 'Shows a loading state',
  'no-visible-change': 'No visible change',
  'blocked': 'Data request blocked',
  'failed': 'Interaction failed',
};

const outcomeCaptions: Record<string, string> = {
  'navigated': 'Observed navigation · action tested once',
  'content-changed': 'Observed content change · action tested once',
  'dialog-opened': 'Observed dialog · action tested once',
  'validation-shown': 'Observed validation · submission stopped',
  'loading': 'Observed loading state · action tested once',
  'no-visible-change': 'No visible change recorded',
  'blocked': 'Safety policy · request blocked and recorded',
  'failed': 'Interaction failed',
};

function destinationLabel(value: string) {
  try {
    const u = new URL(value);
    if (u.protocol === 'javascript:') return 'an in-page script';
    if (u.protocol === 'mailto:') return 'an email draft';
    if (u.protocol === 'tel:') return 'a phone call';
    return u.pathname === '/' ? u.hostname : u.pathname;
  } catch { return 'Destination not exposed'; }
}

function blockedShort(step: { blockKind?: string }): string {
  if (step.blockKind === 'external-navigation') return 'Leaves this website · not followed';
  if (step.blockKind === 'unsafe-url') return 'Blocked by the safety policy';
  return 'Data request blocked';
}

function outcomeCaptionOf(step: { outcome?: string; blockKind?: string }): string {
  if (step.outcome === 'blocked' && step.blockKind === 'external-navigation') return 'Safety policy · external navigation blocked';
  if (step.outcome === 'blocked' && step.blockKind === 'unsafe-url') return 'Safety policy · blocked URL';
  return outcomeCaptions[step.outcome ?? ''] ?? 'Recorded outcome';
}

function flowShort(node: GraphNode): string {
  const step = lastStepOf(node);
  if (!isTestedFlow(node) || !step) return '';
  if (step.outcome === 'navigated' && step.destinationUrl) return `Leads to ${destinationLabel(step.destinationUrl)}`;
  if (step.outcome === 'content-changed' && step.revealed?.length) return `Reveals ${step.revealed.slice(0, 2).map((item) => `“${item.name}”`).join(' and ')}`.slice(0, 60);
  if (step.outcome === 'blocked') return blockedShort(step);
  return outcomeShorts[step.outcome] ?? 'Recorded outcome';
}

export function describe(node: GraphNode): Copy {
  if (node.kind === 'accessibility-finding') return copies[str(node, 'ruleId')] ?? { title: node.label, short: node.label, meaning: 'This automated check found a possible barrier. Review the affected element in its page context.', fix: 'Inspect the evidence and the check’s guidance, update the site’s source, then run the scan again.' };
  if (node.kind === 'runtime-error') {
    const code = str(node, 'statusCode');
    const kind = str(node, 'kind');
    const isPolicy = /policy|blocked|ORB|CSP/i.test(node.label);
    return { title: isPolicy ? 'The browser blocked a resource' : code ? `A resource returned an error (${code})` : kind === 'console' || kind === 'page' ? 'The browser reported a script problem' : 'A request did not finish', short: isPolicy ? 'Blocked browser resource' : 'Browser warning', meaning: isPolicy ? 'A browser security policy stopped a request or script. This is a diagnostic signal; it does not by itself prove a visitor-facing failure. If it is connected to an observed action, it was recorded while that action ran.' : 'A browser event occurred while this page loaded. Check whether it affects a real visitor before treating it as a broken journey.', fix: 'Inspect the request or script in browser developer tools. Confirm the visible impact before changing server or security settings.' };
  }
  if (node.kind === 'flow') {
    const step = lastStepOf(node);
    if (isTestedFlow(node) && step) {
      const summary = cleanQuoted(str(node, 'summary'));
      if (step.outcome === 'navigated') return { title: step.destinationUrl ? `Leads to ${destinationLabel(step.destinationUrl)}` : 'Led to another page', short: flowShort(node), meaning: `The action was activated once in a controlled browser and it navigated. ${summary}`, fix: 'Review the destination in context. Actions beyond this recorded route were not tested.' };
      if (step.outcome === 'content-changed') return { title: 'The action changed the page', short: flowShort(node), meaning: `The action was activated once in a controlled browser. ${summary}`, fix: 'Check the revealed controls and content with keyboard and screen-reader testing, then review the route.' };
      if (step.outcome === 'dialog-opened') return { title: 'The action opened a dialog', short: 'Opens a dialog', meaning: `The action was activated once in a controlled browser and opened a dialog. ${summary}`, fix: 'Verify the dialog’s focus handling, Escape behavior, and accessible name manually.' };
      if (step.outcome === 'validation-shown') return { title: 'The form stopped at validation', short: 'Stops at validation', meaning: `The submit control was activated with empty test values. The browser stopped submission and marked fields that need attention. No data was sent.`, fix: 'Check the validation messages are announced and associated with their fields. Fill the form manually to test the full submission.' };
      if (step.outcome === 'loading') return { title: 'The action showed a loading state', short: 'Shows a loading state', meaning: `The action was activated once and entered a loading or disabled state while the page responded. The scan’s observation window may end before the result.`, fix: 'Confirm the loading state is announced to assistive technology and always resolves or times out.' };
      if (step.outcome === 'blocked') return step.blockKind === 'external-navigation'
        ? { title: 'The action leaves this website', short: blockedShort(step), meaning: `The action was activated once in a controlled browser but points to another website, so the navigation was blocked before it was sent.`, fix: 'Follow the link manually if it belongs in a visitor journey. The rest of the recorded route stays available.' }
        : { title: 'A data-changing request was blocked', short: blockedShort(step), meaning: `The action ran in a controlled browser but tried to send a data-changing request. AccessRipple blocked it, so nothing left this computer.`, fix: 'If you own the website, test this action manually in a safe environment. The blocked request shows what the control intended to do.' };
      if (step.outcome === 'no-visible-change') return { title: 'No visible change was recorded', short: 'No visible change', meaning: `The action was activated once in a controlled browser, but nothing visible changed within the observation window. It may depend on values, timing, or state the scan does not have.`, fix: 'Test the action manually with realistic input before deciding whether it is broken.' };
      return { title: 'The action could not be activated', short: 'Interaction failed', meaning: `The action was activated in a controlled browser but recorded a failure. ${summary}`, fix: 'Check the control’s behavior and any connected browser evidence manually.' };
    }
    const reason = str(node, 'reason');
    if (reason === 'requires-authorization') return { title: 'This form control was not activated', short: 'Needs your permission', meaning: 'Submit controls can send data, so AccessRipple only activates them when you explicitly allow form testing before the scan.', fix: 'Enable “Test form controls” in the scan options and rescan. Requests that change data are still blocked and recorded.' };
    if (reason === 'consequential-action') return { title: 'This action was not activated', short: 'Consequential action', meaning: 'The control’s name suggests it could delete, send, cancel, pay, or change something. AccessRipple never activates these actions.', fix: 'Test this action manually in a safe environment with realistic data.' };
    const destination = str(node, 'destinationUrl');
    if (/^javascript:/i.test(destination)) return { title: 'This link runs a script instead of opening a page', short: 'Runs a script on this page', meaning: 'The link points to an in-page script rather than a page address, so there is no destination to inspect. Its effect only appears when a person activates it.', fix: 'Test this control manually if it matters to a visitor journey. The scan did not click it.' };
    if (/^mailto:/i.test(destination)) return { title: 'This link opens an email draft', short: 'Opens an email draft', meaning: 'The link starts an email instead of opening a page, so the scan did not follow it.', fix: 'Confirm the address is correct and test the mail link manually.' };
    if (/^tel:/i.test(destination)) return { title: 'This link starts a phone call', short: 'Starts a phone call', meaning: 'The link opens a phone dialer instead of a page, so the scan did not follow it.', fix: 'Confirm the number is correct and test the link on a phone.' };
    return { title: destination ? `May lead to ${destinationLabel(destination)}` : cleanLabel(node.label), short: destination ? destinationLabel(destination) : cleanLabel(node.label), meaning: 'This destination comes from a link or form on the page. AccessRipple did not activate the action.', fix: 'Follow this path manually in a safe environment to verify the full interaction.' };
  }
  if (node.kind === 'control') {
    const name = cleanLabel(node.label);
    const interaction = node.data.interaction as { tested?: boolean; outcome?: string; summary?: string; reason?: string } | undefined;
    if (interaction?.tested) return { title: name, short: name, meaning: `This control was activated once in a controlled browser. ${cleanQuoted(interaction.summary ?? '')}`.trim(), fix: 'Open its journey to see the recorded outcome. Actions beyond that route remain untested.' };
    if (interaction && !interaction.tested) {
      const reason = interaction.reason;
      if (reason === 'requires-authorization') return { title: name, short: name, meaning: 'This submit control was not activated because it could send data. Enable “Test form controls” before a scan to record what it does.', fix: 'Allow form testing and rescan if you want its validation or client-side behavior observed. Data-changing requests stay blocked.' };
      if (reason === 'consequential-action') return { title: name, short: name, meaning: 'This control was not activated because its name suggests a consequential action such as deleting, sending, or paying.', fix: 'Test it manually in a safe environment.' };
      return { title: name, short: name, meaning: 'This control was left untested because the scan reached its interaction limit.', fix: 'Run a focused scan or test it manually to record its behavior.' };
    }
    return { title: name, short: name, meaning: `A ${str(node, 'role') || 'control'} found on the rendered page. Its presence does not mean its full behavior has been tested.`, fix: 'Review its name, keyboard behavior, and destination in context.' };
  }
  return { title: node.label, short: node.label, meaning: node.kind === 'site' ? 'The starting point for this website’s scanned pages and connected findings.' : 'A page visited by the scanner. Connected points show the controls and findings recorded here.', fix: 'Explore a connected point or switch to the list for every recorded element.' };
}

export function isIssue(node: GraphNode) { return node.kind === 'accessibility-finding' || node.kind === 'runtime-error'; }
export function severity(node: GraphNode) { return str(node, 'impact') || (node.kind === 'runtime-error' ? 'diagnostic' : 'info'); }
/** A short, honest summary of what is still observed, without repeating itself. */
export function remainingSummary(nodes: GraphNode[]): string {
  const counts = new Map<string, number>();
  for (const node of nodes) {
    const label = describe(node).short;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const parts = [...counts.entries()].map(([label, count]) => (count > 1 ? `${count}× ${label}` : label));
  const shown = parts.slice(0, 3).join(', ');
  return parts.length > 3 ? `${shown}, and ${parts.length - 3} more` : shown;
}

export function kindName(node: GraphNode) { return ({ site: 'Website', page: 'Page', control: 'Control', flow: node.evidenceLabel === 'observed' ? 'Observed journey' : 'Possible route', 'runtime-error': 'Browser signal', 'accessibility-finding': 'Accessibility' })[node.kind]; }
export function nodeColor(node: GraphNode) { return node.kind === 'accessibility-finding' ? '#e8ae65' : node.kind === 'runtime-error' ? '#e78995' : node.kind === 'page' ? '#b5a5f5' : node.kind === 'flow' ? '#83b9dd' : node.kind === 'control' ? '#98adbb' : '#a7dcc6'; }
export function pageFor(node: GraphNode, graph: SiteGraph) {
  if (node.kind === 'page') return node;
  return graph.nodes.find(n => n.kind === 'page' && n.id === node.pageId) ?? graph.nodes.find(n => n.kind === 'page' && graph.edges.some(e => e.source === n.id && e.target === node.id));
}
export function matches(node: GraphNode, filter: GraphFilter) {
  if (filter === 'overview') return node.kind === 'site' || node.kind === 'page' || isIssue(node);
  if (filter === 'issues') return isIssue(node);
  if (filter === 'pages') return node.kind === 'page';
  return node.kind === (filter === 'controls' ? 'control' : 'flow');
}

export function groupIssues(nodes: GraphNode[]): ViewNode[] {
  const groups = new Map<string, GraphNode[]>();
  for (const node of nodes) {
    const key = node.kind === 'accessibility-finding' ? `${node.pageId}|${str(node, 'ruleId') || node.label}` : node.id;
    groups.set(key, [...(groups.get(key) ?? []), node]);
  }
  return [...groups.values()].flatMap(items => {
    const first = items[0];
    if (!first) return [];
    return [{ ...first, memberIds: items.map(n => n.id), data: { ...first.data, groupCount: items.length, targets: [...new Set(items.flatMap(n => Array.isArray(n.data.targets) ? n.data.targets.map(String) : []))] } }];
  });
}

/**
 * Turns a finished scan into one plain paragraph a person can read in a second.
 * Every number here comes from evidence the browser actually recorded, so the
 * sentence never claims more than the scan observed.
 */
export function scanStory(scan: ScanResult, graph: SiteGraph): { headline: string; detail: string; tone: 'clear' | 'attention' | 'critical' } {
  // A page whose checks could not run is not a finding. Counting it as one
  // would tell a developer their site has a problem it may not have.
  const allFindings = graph.nodes.filter(n => n.kind === 'accessibility-finding');
  const incomplete = allFindings.filter(n => n.data.ruleId === 'accessibility-check-incomplete').length;
  const findings = groupIssues(allFindings.filter(n => n.data.ruleId !== 'accessibility-check-incomplete'));
  const rawCount = allFindings.length - incomplete;
  const signals = graph.nodes.filter(n => n.kind === 'runtime-error');
  const pages = scan.coverage?.pagesInspected ?? scan.pages.filter(p => p.status === 'inspected').length ?? 0;
  const blocked = scan.coverage?.pagesBlocked ?? scan.pages.filter(p => p.status === 'skipped').length;
  const tested = scan.interactionPolicy?.tested ?? 0;
  const site = graph.nodes.find(n => n.kind === 'site')?.label ?? 'this website';
  const order = ['critical', 'serious', 'moderate', 'minor'];
  const top = [...findings].sort((a, b) => order.indexOf(severity(a)) - order.indexOf(severity(b)))[0];
  const topPage = top ? pageFor(top, graph)?.label : undefined;

  const topCount = top ? Number(top.data.groupCount) || 1 : 1;
  const kinds = findings.length < rawCount ? `, in ${findings.length} kind${findings.length === 1 ? '' : 's'} of barrier` : '';
  // A site that refused the browser was not inspected, and saying so plainly
  // matters more than any number.
  if (!pages && blocked) {
    return {
      headline: `${site} refused the automated browser, so nothing on it could be inspected.`,
      detail: 'Some sites answer an automated browser with a challenge page instead of the site. This is a property of the site, not a fault in the scan.',
      tone: 'attention',
    };
  }

  const couldNotRun = incomplete ? ` The automated checks could not run on ${incomplete} page${incomplete === 1 ? '' : 's'} of this site, so that page is unchecked rather than clear.` : '';
  const headline = rawCount
    ? `We inspected ${pages} page${pages === 1 ? '' : 's'} of ${site} and found ${rawCount} accessibility finding${rawCount === 1 ? '' : 's'}${kinds}${tested ? `, after activating ${tested} control${tested === 1 ? '' : 's'} in a disposable browser` : ''}.${couldNotRun}`
    : `We inspected ${pages} page${pages === 1 ? '' : 's'} of ${site} and found no accessibility findings in the checks we ran${tested ? `, after activating ${tested} control${tested === 1 ? '' : 's'} in a disposable browser` : ''}.${couldNotRun}`;

  const detail = top
    ? `The first to look at is “${describe(top).title}”${topPage ? ` on ${topPage}` : ''}${topCount > 1 ? `, ${topCount} elements affected` : ''}. ${describe(top).fix}${signals.length ? ` The browser also reported ${signals.length} signal${signals.length === 1 ? '' : 's'} worth reading.` : ''}`
    : signals.length
      ? `The browser reported ${signals.length} signal${signals.length === 1 ? '' : 's'} worth reading. Automated checks cover a useful subset of barriers, so manual keyboard and screen-reader testing still matter.`
      : 'Automated checks cover a useful subset of barriers, so manual keyboard and screen-reader testing still matter.';

  const tone = findings.some(f => severity(f) === 'critical') ? 'critical' : rawCount || signals.length ? 'attention' : 'clear';
  return { headline, detail, tone };
}

export function sceneGraph(graph: SiteGraph, filter: GraphFilter, focusId?: string) {
  const basis = graph.nodes.filter(n => n.kind === 'site' || n.kind === 'page' || matches(n, filter));
  let nodes = groupIssues(basis);
  // A readable map is bounded; the List view always exposes the full result.
  if (nodes.length > 36) nodes = nodes.slice(0, 36);
  if (focusId) {
    const adjacent = new Set([focusId, ...graph.edges.filter(e => e.source === focusId || e.target === focusId).flatMap(e => [e.source, e.target])]);
    nodes = nodes.filter(n => adjacent.has(n.id) || n.memberIds?.some(id => adjacent.has(id)) || n.kind === 'site');
  }
  const representatives = new Map<string, string>();
  nodes.forEach(n => (n.memberIds ?? [n.id]).forEach(id => representatives.set(id, n.id)));
  const unique = new Map<string, SiteGraph['edges'][number]>();
  graph.edges.forEach(edge => {
    const source = representatives.get(edge.source), target = representatives.get(edge.target);
    if (source && target && source !== target) unique.set(`${source}|${target}|${edge.kind}`, { ...edge, source, target });
  });
  return { nodes, edges: [...unique.values()] };
}

export type JourneyFinding = { node: GraphNode; caption: string };
export type Journey = {
  control: GraphNode;
  steps: { node: GraphNode; caption: string }[];
  findings: JourneyFinding[];
  edges: SiteGraph['edges'];
  summary: string;
  observed: boolean;
};

function outcomeCaption(flow: GraphNode): string {
  const step = lastStepOf(flow);
  if (!isTestedFlow(flow) || !step) {
    const kind = nonPageDestination(flow);
    if (kind) return `${kind.caption} · action not tested`;
    return 'Possible destination · action not tested';
  }
  return outcomeCaptionOf(step);
}

/** Script, email, and phone links have no page destination to inspect. */
function nonPageDestination(flow: GraphNode): { caption: string; summary: string } | null {
  const value = str(flow, 'destinationUrl');
  if (/^javascript:/i.test(value)) return { caption: 'In-page script', summary: 'This link runs a script on the same page. There is no page destination to inspect, and the action itself was not activated.' };
  if (/^mailto:/i.test(value)) return { caption: 'Email link', summary: 'This link opens an email draft. There is no page destination to inspect, and the action itself was not activated.' };
  if (/^tel:/i.test(value)) return { caption: 'Phone link', summary: 'This link starts a phone call. There is no page destination to inspect, and the action itself was not activated.' };
  return null;
}

function testedFlowFor(graph: SiteGraph, controlId: string): GraphNode | undefined {
  return graph.nodes.find(n => n.kind === 'flow' && isTestedFlow(n) && graph.edges.some(e => e.source === controlId && e.target === n.id && e.evidenceLabel === 'observed'));
}

/** Follow only recorded relationships. Observed outcomes are chained; inference never pretends to be a test. */
export type RouteToFinding = {
  control: GraphNode;
  flow: GraphNode;
  page: GraphNode;
  observed: boolean;
  outcome: string;
};

/**
 * The routes that reach a barrier. A finding is on a page; this finds the
 * controls whose recorded journey leads to that page, so the answer to "how
 * does someone reach this problem?" is one click away.
 */
export function routesToFinding(graph: SiteGraph, findingId: string): RouteToFinding[] {
  const finding = graph.nodes.find((node) => node.id === findingId);
  const pageId = finding?.pageId;
  if (!pageId) return [];
  const routes: RouteToFinding[] = [];
  for (const flow of graph.nodes) {
    if (flow.kind !== 'flow') continue;
    const destination = graph.nodes.find((node) => node.kind === 'page' && graph.edges.some((edge) => edge.source === flow.id && edge.target === node.id && edge.kind === 'links-to'));
    if (!destination || destination.id !== pageId) continue;
    const control = graph.nodes.find((node) => node.kind === 'control' && graph.edges.some((edge) => edge.source === node.id && edge.target === flow.id));
    if (!control) continue;
    const observed = isTestedFlow(flow);
    routes.push({ control, flow, page: destination, observed, outcome: observed ? outcomeCaption(flow) : 'Possible destination · action not activated' });
  }
  return routes.sort((a, b) => Number(b.observed) - Number(a.observed));
}

export function traceJourney(graph: SiteGraph, rootId: string): Journey | null {
  const root = graph.nodes.find(n => n.id === rootId);
  const control = root?.kind === 'control' ? root : root?.kind === 'flow'
    ? graph.nodes.find(n => n.kind === 'control' && (n.id === str(root, 'sourceControlId') || graph.edges.some(e => e.source === n.id && e.target === root.id))) : undefined;
  if (!control) return null;
  const source = pageFor(control, graph);
  const flows = graph.nodes.filter(n => n.kind === 'flow' && graph.edges.some(e => e.source === control.id && e.target === n.id));
  const observedFlow = flows.find(n => isTestedFlow(n));
  const flow = (root?.kind === 'flow' ? flows.find(n => n.id === root.id) : observedFlow) ?? flows[0];
  const destination = flow ? graph.nodes.find(n => n.kind === 'page' && graph.edges.some(e => e.source === flow.id && e.target === n.id && e.kind === 'links-to')) : undefined;
  const steps: Journey['steps'] = [];
  if (source) steps.push({ node: source, caption: 'Start · page inspected' });
  steps.push({ node: control, caption: observedFlow ? 'Your action · activated in a controlled browser' : 'Your action · control found, not activated' });
  if (flow) steps.push({ node: flow, caption: outcomeCaption(flow) });
  if (destination && destination.id !== source?.id) steps.push({ node: destination, caption: 'Destination · independently inspected' });
  const observed = Boolean(flow && isTestedFlow(flow));
  const visited = new Set(steps.map(s => s.node.id));
  let page = destination && observed ? destination : undefined;
  let hops = 0;
  while (page && hops < 3) {
    const next = nextObservedHop(graph, page, visited);
    if (!next) break;
    steps.push({ node: next.control, caption: 'Continue · activated in a controlled browser' });
    steps.push({ node: next.flow, caption: outcomeCaption(next.flow) });
    visited.add(next.control.id); visited.add(next.flow.id);
    if (!next.destination) break;
    steps.push({ node: next.destination, caption: 'Destination · independently inspected' });
    visited.add(next.destination.id);
    page = next.destination;
    hops++;
  }
  const stepIds = new Set(steps.map(s => s.node.id));
  const flowErrorIds = new Set(flow ? (Array.isArray(flow.data.errorIds) ? flow.data.errorIds.map(String) : []) : []);
  const found = new Map<string, JourneyFinding>();
  for (const node of graph.nodes) {
    if (!isIssue(node)) continue;
    if (flowErrorIds.has(node.id)) { found.set(node.id, { node, caption: 'Recorded while this action ran' }); continue; }
    if (graph.edges.some(e => e.source === control.id && e.target === node.id)) { found.set(node.id, { node, caption: 'Recorded on this control' }); continue; }
    const owner = steps.find(s => s.node.kind === 'page' && graph.edges.some(e => e.source === s.node.id && e.target === node.id));
    if (owner && owner.node.id !== source?.id) found.set(node.id, { node, caption: 'Recorded on the destination page · context, not proof this action fails' });
  }
  const findings = [...found.values()].sort((a, b) => Number(a.node.kind === 'runtime-error') - Number(b.node.kind === 'runtime-error'));
  const edges = graph.edges.filter(e => {
    if (!stepIds.has(e.source) || !stepIds.has(e.target)) return false;
    if (findings.some(item => item.node.id === e.target)) {
      if (e.source === flow?.id && destination && graph.edges.some(other => other.source === destination.id && other.target === e.target)) return false;
      if (e.source === source?.id && graph.edges.some(other => other.source === control.id && other.target === e.target)) return false;
    }
    return true;
  });
  const lastStep = flow ? lastStepOf(flow) : undefined;
  const nonPage = flow ? nonPageDestination(flow) : null;
  const destinationLabelText = lastStep?.destinationUrl ? destinationLabel(lastStep.destinationUrl) : 'its destination';
  const summary = !flow
    ? 'This control has no exposed destination. Its script-driven behavior needs an interaction test.'
    : !observed
      ? (nonPage ? nonPage.summary
        : !destination ? 'A destination was found, but it was outside this scan. Its outcome is unknown.'
        : destination.status === 'error' ? 'The destination could not be loaded during this scan. Review its recorded browser evidence.'
          : findings.length ? `${findings.length} observations on this route need review. They do not prove the click fails.`
            : 'The destination was inspected. No findings were recorded there in this scan; the click itself is untested.')
      : lastStep?.outcome === 'navigated' ? `The action was activated once and navigated to ${destinationLabelText}.${hops > 0 ? ` The route continued through ${hops} more independently inspected page${hops === 1 ? '' : 's'}.` : destination ? ' That page was inspected independently.' : ' The destination is outside this scan.'} Actions beyond this recorded route remain untested.`
        : lastStep?.outcome === 'content-changed' ? 'The action was activated once and changed the page. Revealed controls stay untested unless a follow-up was recorded.'
          : `The action was activated once: ${lastStep?.summary ? cleanQuoted(lastStep.summary) : 'outcome recorded'}`;
  return { control, steps, findings, edges, summary, observed };
}

function nextObservedHop(graph: SiteGraph, page: GraphNode, visited: Set<string>): { control: GraphNode; flow: GraphNode; destination?: GraphNode } | null {
  const controls = graph.nodes.filter(n => n.kind === 'control' && graph.edges.some(e => e.source === page.id && e.target === n.id && e.kind === 'has-control'));
  const candidates = controls.flatMap((control) => {
    const flow = testedFlowFor(graph, control.id);
    if (!flow || visited.has(control.id) || visited.has(flow.id)) return [];
    const destination = graph.nodes.find(n => n.kind === 'page' && graph.edges.some(e => e.source === flow.id && e.target === n.id && e.kind === 'links-to'));
    if (destination && (destination.id === page.id || visited.has(destination.id))) return [];
    const name = control.label.toLowerCase();
    const score = (destination ? 3 : 0) + (/checkout|payment|cart|continue|proceed|next|view|start|begin/.test(name) ? 2 : 0);
    return [{ control, flow, destination, score }];
  }).sort((a, b) => b.score - a.score);
  const best = candidates[0];
  return best ? { control: best.control, flow: best.flow, destination: best.destination } : null;
}
