import { cleanLabel, describe, matches, nodeColor, severity, type GraphFilter, type ViewNode } from './presentation.js';
import type { EvidenceLabel, GraphEdge, GraphNode, SiteGraph } from './types.js';

export interface ExplorerOptions {
  kind?: GraphFilter;
  severity?: string;
  pageId?: string;
  /** A rule id, or an exact tag recorded by the accessibility checker. */
  category?: string;
  query?: string;
  focusId?: string;
  selectedId?: string;
  expandedGroupIds?: readonly string[];
  limit?: number;
}

export interface ExplorerScene {
  nodes: ViewNode[];
  edges: GraphEdge[];
  /** Original evidence points matching the filters, before grouping. */
  matchedCount: number;
  /** Group representatives omitted by the display limit, not by grouping. */
  hiddenCount: number;
  /** Matching evidence points represented by another point in a collapsed group. */
  groupedCount: number;
}

const constrained = (value: string | undefined) => Boolean(value && value !== 'all');
const text = (value: unknown) => typeof value === 'string' || typeof value === 'number' ? String(value) : '';
const strings = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
const incompleteCheck = (node: GraphNode) => node.kind === 'accessibility-finding' && node.data.ruleId === 'accessibility-check-incomplete';

/**
 * Build a bounded, searchable scene without changing the scan evidence.
 * Context edges are retained only when the scan actually contains them. A
 * neighborhood is an exploration filter, never a claim about task completion.
 */
export function buildExplorerScene(graph: SiteGraph, options: ExplorerOptions = {}): ExplorerScene {
  const nodeById = new Map<string, GraphNode>();
  for (const node of graph.nodes) {
    if (!node || typeof node.id !== 'string' || !node.id || nodeById.has(node.id)) continue;
    nodeById.set(node.id, { ...node, data: node.data && typeof node.data === 'object' ? node.data : {} });
  }
  const nodes = [...nodeById.values()];
  const edges = new Map<string, GraphEdge>();
  for (const edge of graph.edges) {
    if (!edge || !nodeById.has(edge.source) || !nodeById.has(edge.target) || edge.source === edge.target) continue;
    // Preserve provenance when repeated relationships disagree. Neither an
    // inferred record nor a later duplicate can silently overwrite observation.
    const key = JSON.stringify([edge.source, edge.target, edge.kind, edge.evidenceLabel]);
    if (!edges.has(key)) edges.set(key, edge);
  }
  const pageByNode = new Map<string, string>();
  const pageByUrl = new Map<string, string>();
  for (const node of nodes) if (node.kind === 'page') {
    pageByNode.set(node.id, node.id);
    if (text(node.data.url)) pageByUrl.set(text(node.data.url), node.id);
  }
  for (const edge of edges.values()) {
    if (nodeById.get(edge.source)?.kind === 'page' && !pageByNode.has(edge.target)) pageByNode.set(edge.target, edge.source);
  }
  for (const node of nodes) {
    if (node.pageId && nodeById.get(node.pageId)?.kind === 'page') pageByNode.set(node.id, node.pageId);
    if (!pageByNode.has(node.id)) {
      const source = pageByUrl.get(text(node.data.sourceUrl));
      if (source) pageByNode.set(node.id, source);
    }
  }
  let neighborhood: Set<string> | undefined;
  if (options.focusId && nodeById.has(options.focusId)) {
    neighborhood = new Set([options.focusId]);
    for (const edge of edges.values()) if (edge.source === options.focusId || edge.target === options.focusId) {
      neighborhood.add(edge.source);
      neighborhood.add(edge.target);
    }
  }
  const query = options.query?.trim().toLocaleLowerCase() ?? '';
  const matched = nodes.filter(node => {
    // Focus exposes a point's actual neighbors, including kinds that the
    // overview normally omits. Other explicit filters still apply.
    // Searching the overview explores the complete recorded inventory. An
    // explicitly selected kind remains a constraint on that search.
    const searchAllKinds = Boolean(query) && (!options.kind || options.kind === 'overview');
    if (neighborhood ? !neighborhood.has(node.id) : !searchAllKinds && !matches(node, options.kind ?? 'overview')) return false;
    if (options.kind === 'issues' && incompleteCheck(node)) return false;
    if (constrained(options.pageId) && pageByNode.get(node.id) !== options.pageId) return false;
    if (constrained(options.severity) && (incompleteCheck(node) || (node.kind !== 'accessibility-finding' && node.kind !== 'runtime-error') || severity(node) !== options.severity)) return false;
    if (constrained(options.category) && text(node.data.ruleId) !== options.category && !strings(node.data.tags).includes(options.category!)) return false;
    if (query) {
      const haystack = [node.label, text(node.data.ruleId), text(node.data.selector), text(node.data.url), text(node.data.sourceUrl), text(node.data.destinationUrl), ...strings(node.data.targets), ...strings(node.data.tags)].join(' ').toLocaleLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
  const context = new Set(matched.map(node => node.id));
  for (const node of matched) {
    const owner = pageByNode.get(node.id);
    if (owner) context.add(owner);
  }
  for (const node of nodes) if (node.kind === 'site') context.add(node.id);
  const groups = new Map<string, GraphNode[]>();
  for (const node of nodes) {
    if (!context.has(node.id)) continue;
    const key = node.kind === 'accessibility-finding'
      ? JSON.stringify([pageByNode.get(node.id) ?? node.pageId ?? '', node.data.ruleId ?? node.label, severity(node), node.status, node.evidenceLabel])
      : node.id;
    const group = groups.get(key);
    if (group) group.push(node); else groups.set(key, [node]);
  }
  const expanded = new Set(options.expandedGroupIds ?? []);
  const grouped: ViewNode[] = [];
  let groupedCount = 0;
  for (const items of groups.values()) {
    const first = items[0]!;
    if (items.length === 1) { grouped.push(first); continue; }
    if (expanded.has(first.id)) {
      grouped.push(...items.map(node => ({ ...node, memberIds: [node.id], data: { ...node.data, groupCount: 1, expandedGroupId: first.id, expandedGroupCount: items.length } })));
    } else {
      groupedCount += items.length - 1;
      grouped.push({ ...first, memberIds: items.map(node => node.id), data: { ...first.data, groupCount: items.length, targets: [...new Set(items.flatMap(node => strings(node.data.targets)))] } });
    }
  }
  const limit = Number.isFinite(options.limit) ? Math.max(1, Math.floor(options.limit!)) : 60;
  let visible = grouped;
  if (grouped.length > limit) {
    const importance = (node: ViewNode) => {
      if (node.id === options.selectedId || node.memberIds?.includes(options.selectedId ?? '')) return -1;
      if (node.kind === 'site') return 0;
      if (node.kind === 'page') return 1;
      if (node.kind === 'accessibility-finding') return ({ critical: 2, serious: 3, moderate: 4, minor: 5 }[severity(node)] ?? 6);
      return node.kind === 'runtime-error' ? 7 : 8;
    };
    // Select by importance, then restore input order so selecting a point does
    // not rearrange all of the existing points on the map.
    const retained = new Set([...grouped].sort((a, b) => importance(a) - importance(b)).slice(0, limit).map(node => node.id));
    visible = grouped.filter(node => retained.has(node.id));
  }
  const representative = new Map<string, string>();
  for (const node of visible) for (const id of node.memberIds ?? [node.id]) representative.set(id, node.id);
  const sceneEdges = new Map<string, GraphEdge>();
  for (const edge of edges.values()) {
    const source = representative.get(edge.source), target = representative.get(edge.target);
    if (!source || !target || source === target) continue;
    const key = JSON.stringify([source, target, edge.kind, edge.evidenceLabel]);
    if (!sceneEdges.has(key)) sceneEdges.set(key, { ...edge, id: `scene:${key}`, source, target });
  }
  return { nodes: visible, edges: [...sceneEdges.values()], matchedCount: matched.length, hiddenCount: grouped.length - visible.length, groupedCount };
}

export interface EdgeExplanation {
  title: string;
  explanation: string;
  evidence: EvidenceLabel;
  source?: GraphNode;
  target?: GraphNode;
}

/** Explain exactly the relationship recorded, without inventing a causal path. */
export function explainEdge(edge: GraphEdge, graph: SiteGraph): EdgeExplanation {
  const source = graph.nodes.find(node => node.id === edge.source);
  const target = graph.nodes.find(node => node.id === edge.target);
  const labels: Record<string, string> = {
    contains: 'Website → page',
    'has-control': 'Page → control',
    'has-finding': target && incompleteCheck(target) ? 'Page → unchecked checks' : 'Element → accessibility finding',
    'has-error': 'Page → browser signal',
    'failed-at': 'Related browser signal',
    'may-lead-to': edge.evidenceLabel === 'observed' ? 'Control → recorded outcome' : 'Control → possible destination',
    'links-to': edge.via && edge.evidenceLabel === 'observed' ? 'Recorded action → page' : edge.evidenceLabel === 'observed' ? 'Recorded navigation → page' : 'Possible destination → page',
  };
  const name = (node: GraphNode | undefined) => node ? cleanLabel(describe(node).short) : 'an unavailable point';
  const from = name(source), to = name(target);
  let explanation: string;
  if (!source || !target) explanation = 'One endpoint is missing from this graph. The relationship cannot be inspected reliably.';
  else if (edge.evidenceLabel !== 'observed') explanation = `“${from}” is connected to “${to}” by a ${edge.evidenceLabel === 'inferred' ? 'possible relationship derived from page markup' : 'relationship that was not tested'}. The action was not verified. This does not show a completed user journey.`;
  else if (edge.kind === 'contains') explanation = `“${to}” was recorded as a page belonging to “${from}”. The page’s own status and coverage say which checks completed.`;
  else if (edge.kind === 'has-control') explanation = `The rendered page “${from}” contained “${to}”. Finding a control does not mean its behavior was tested.`;
  else if (edge.kind === 'has-finding' && target && incompleteCheck(target)) explanation = `Automated accessibility checks could not complete on “${from}”. This is a coverage gap, not a detected barrier. The scan cannot establish a pass or a failure for the missing checks.`;
  else if (edge.kind === 'has-finding') explanation = `The automated checker associated “${to}” with “${from}”. This records a detected barrier; its effect on task completion still needs a human check.`;
  else if (edge.kind === 'links-to' && edge.via) explanation = `The browser activated “${edge.via}” on “${from}” once, in a disposable browser, and recorded navigation to “${to}”. It is a route a visitor can take. It does not show that a visitor completed a task, or that a barrier stopped one.`;
  else if (edge.kind === 'links-to') explanation = `The browser recorded navigation from “${from}” to “${to}” while testing this action. Other controls and the complete visitor task were not tested by this relationship.`;
  else if (edge.kind === 'may-lead-to') explanation = `“${from}” was activated once in a disposable browser, and “${to}” is the outcome the browser recorded. It does not establish that a real user completed a task.`;
  else if (edge.kind === 'failed-at' && source.kind === 'flow') explanation = `“${to}” was recorded while the action “${from}” ran. Timing links the signal to this observation; it does not by itself prove that the action caused the signal or blocked a visitor.`;
  else if (edge.kind === 'failed-at' || edge.kind === 'has-error') explanation = `The browser recorded “${to}” while “${from}” loaded. A diagnostic signal alone does not prove a visitor-facing failure.`;
  else explanation = `The scan recorded a “${edge.kind}” relationship between “${from}” and “${to}”. Review both endpoints and the scan coverage before drawing conclusions about visitor impact.`;
  return { title: labels[edge.kind] ?? 'Recorded relationship', explanation, evidence: edge.evidenceLabel, source, target };
}

/** Stable, explicit ordering for filter menus; unknown values remain visible. */
export function explorerFacets(graph: SiteGraph) {
  const severities = new Set<string>();
  const categories = new Map<string, string>();
  for (const node of graph.nodes) {
    if (node.kind !== 'accessibility-finding' && node.kind !== 'runtime-error') continue;
    if (incompleteCheck(node)) continue;
    severities.add(severity(node));
    const rule = text(node.data.ruleId);
    if (rule) categories.set(rule, describe(node).short);
  }
  return {
    pages: graph.nodes.filter(node => node.kind === 'page').map(node => ({ id: node.id, label: cleanLabel(node.label) })),
    severities: [...severities].sort((a, b) => {
      const order = ['critical', 'serious', 'moderate', 'minor', 'diagnostic', 'info'];
      return (order.indexOf(a) < 0 ? 99 : order.indexOf(a)) - (order.indexOf(b) < 0 ? 99 : order.indexOf(b)) || a.localeCompare(b);
    }),
    categories: [...categories].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label)),
  };
}

/** Color encodes a recorded finding's severity, never an accessibility score. */
export function explorerNodeColor(node: GraphNode): string {
  if (node.evidenceLabel !== 'observed' || node.status === 'untested' || node.status === 'needs-review' || node.data.status === 'skipped' || node.data.status === 'failed' || node.data.ruleId === 'accessibility-check-incomplete') return '#98adbb';
  if (node.kind === 'accessibility-finding') return ({ critical: '#f07888', serious: '#ee9874', moderate: '#e8ae65', minor: '#d4c383' }[severity(node)] ?? '#98adbb');
  // A page is purple because it is a page, not green because all of its
  // behavior passed. Inspection alone cannot establish that a page is healthy.
  return nodeColor(node);
}
