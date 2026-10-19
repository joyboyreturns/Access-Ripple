import type { GraphNode, SiteGraph } from './types.js';

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

export function describe(node: GraphNode): Copy {
  if (node.kind === 'accessibility-finding') return copies[str(node, 'ruleId')] ?? { title: node.label, short: node.label, meaning: 'This automated check found a possible barrier. Review the affected element in its page context.', fix: 'Inspect the evidence and the check’s guidance, update the site’s source, then run the scan again.' };
  if (node.kind === 'runtime-error') {
    const code = str(node, 'statusCode');
    const kind = str(node, 'kind');
    const isPolicy = /policy|blocked|ORB|CSP/i.test(node.label);
    return { title: isPolicy ? 'The browser blocked a resource' : code ? `A resource returned an error (${code})` : kind === 'console' || kind === 'page' ? 'The browser reported a script problem' : 'A request did not finish', short: isPolicy ? 'Blocked browser resource' : 'Browser warning', meaning: isPolicy ? 'A browser security policy stopped a request or script. This is a diagnostic signal; it does not by itself prove a visitor-facing failure.' : 'A browser event occurred while this page loaded. Check whether it affects a real visitor before treating it as a broken journey.', fix: 'Inspect the request or script in browser developer tools. Confirm the visible impact before changing server or security settings.' };
  }
  if (node.kind === 'flow') return { title: str(node, 'destinationUrl') || node.label, short: destinationLabel(str(node, 'destinationUrl')), meaning: 'This destination comes from a link or form on the page. AccessRipple did not activate the action.', fix: 'Follow this path manually in a safe environment to verify the full interaction.' };
  if (node.kind === 'control') return { title: node.label, short: node.label, meaning: `A ${str(node, 'role') || 'control'} found on the rendered page. Its presence does not mean its full behavior has been tested.`, fix: 'Review its name, keyboard behavior, and destination in context.' };
  return { title: node.label, short: node.label, meaning: node.kind === 'site' ? 'The starting point for this website’s scanned pages and connected findings.' : 'A page visited by the scanner. Connected points show the controls and findings recorded here.', fix: 'Explore a connected point or switch to the list for every recorded element.' };
}

function destinationLabel(value: string) { try {const u=new URL(value);return u.pathname==='/'?u.hostname:u.pathname;} catch {return 'Destination not exposed';} }

export function isIssue(node: GraphNode) { return node.kind === 'accessibility-finding' || node.kind === 'runtime-error'; }
export function severity(node: GraphNode) { return str(node, 'impact') || (node.kind === 'runtime-error' ? 'diagnostic' : 'info'); }
export function kindName(node: GraphNode) { return ({ site: 'Website', page: 'Page', control: 'Control', flow: 'Possible journey', 'runtime-error': 'Browser signal', 'accessibility-finding': 'Accessibility' })[node.kind]; }
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

export type Journey = {
  control: GraphNode;
  steps: { node: GraphNode; caption: string }[];
  findings: GraphNode[];
  edges: SiteGraph['edges'];
  summary: string;
};

/** Follow only recorded relationships. Page findings are context, never proof of a click failure. */
export function traceJourney(graph: SiteGraph, rootId: string): Journey | null {
  const root = graph.nodes.find(n => n.id === rootId);
  const control = root?.kind === 'control' ? root : root?.kind === 'flow'
    ? graph.nodes.find(n => n.kind === 'control' && (n.id === str(root, 'sourceControlId') || graph.edges.some(e => e.source === n.id && e.target === root.id))) : undefined;
  if (!control) return null;
  const source = pageFor(control, graph);
  const flows = graph.nodes.filter(n => n.kind === 'flow' && graph.edges.some(e => e.source === control.id && e.target === n.id));
  const flow = (root?.kind === 'flow' ? flows.find(n => n.id === root.id) : flows[0]);
  const destination = flow ? graph.nodes.find(n => n.kind === 'page' && graph.edges.some(e => e.source === flow.id && e.target === n.id && e.kind === 'links-to')) : undefined;
  const steps: Journey['steps'] = [];
  if (source) steps.push({ node: source, caption: 'Start · page inspected' });
  steps.push({ node: control, caption: 'Your action · control found, not activated' });
  if (flow) steps.push({ node: flow, caption: 'Possible destination · action not tested' });
  if (destination && destination.id !== source?.id) steps.push({ node: destination, caption: 'Destination · independently inspected' });
  const selectors = [str(control, 'selector')].filter(Boolean);
  const findings = graph.nodes.filter(n => isIssue(n) && (
    (destination && graph.edges.some(e => e.source === destination.id && e.target === n.id)) ||
    graph.edges.some(e => (e.source === control.id || e.source === flow?.id) && e.target === n.id) ||
    (source && graph.edges.some(e => e.source === source.id && e.target === n.id) &&
      Array.isArray(n.data.targets) && n.data.targets.some(t => selectors.includes(String(t))))
  )).sort((a,b)=>Number(a.kind==='runtime-error')-Number(b.kind==='runtime-error'));
  const ids = new Set([...steps.map(s => s.node.id), ...findings.map(n => n.id)]);
  const edges = graph.edges.filter(e => {
    if (!ids.has(e.source) || !ids.has(e.target)) return false;
    if (findings.some(n=>n.id===e.target)) {
      if (e.source===flow?.id && destination && graph.edges.some(other=>other.source===destination.id&&other.target===e.target)) return false;
      if (e.source===source?.id && graph.edges.some(other=>other.source===control.id&&other.target===e.target)) return false;
    }
    return true;
  });
  return { control, steps, findings, edges, summary: !flow
    ? 'This control has no exposed destination. Its script-driven behavior needs an interaction test.'
    : !destination ? 'A destination was found, but it was outside this scan. Its outcome is unknown.'
    : destination.status === 'error' ? 'The destination could not be loaded during this scan. Review its recorded browser evidence.'
    : findings.length ? `${findings.length} observations on this route need review. They do not prove the click fails.`
    : 'The destination was inspected. No findings were recorded there in this scan; the click itself is untested.' };
}
