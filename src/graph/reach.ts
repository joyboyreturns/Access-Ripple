import { createHash } from 'node:crypto';
import type { GraphNode, SiteGraph } from './schema.js';

/**
 * How far a point reaches along the journeys the browser actually took.
 *
 * Only observed movement counts: a page has a control, the control was
 * activated, and the activation led to another page. Inferred links are left
 * out, so every number here is something the browser did. These are counts,
 * not a score: they say how many pages and recorded journeys sit beyond a
 * point, never that a barrier stops anyone.
 */
export interface Reach {
  /** Pages the browser reached from here, one or more recorded actions away. */
  downstreamPagesReachable: number;
  /** Recorded journeys that start on, or arrive at, this point's page. */
  journeysThrough: number;
  /** The controls, journeys and pages beyond this point, for the map to light up. */
  blastRadiusNodeIds: string[];
}

const MOVEMENT = new Set(['has-control', 'may-lead-to', 'links-to']);
const MAX_RADIUS_IDS = 80;

interface Index {
  byId: Map<string, GraphNode>;
  /** Observed movement, from each point to the next. */
  next: Map<string, string[]>;
  /** The recorded journeys that leave or arrive at each page. */
  journeysByPage: Map<string, Set<string>>;
  /** The page node each control, finding and journey belongs to, read from the graph's own edges. */
  pageOf: Map<string, string>;
}

function indexGraph(graph: SiteGraph): Index {
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const next = new Map<string, string[]>();
  const journeysByPage = new Map<string, Set<string>>();
  const pageOf = new Map<string, string>();
  for (const edge of graph.edges) {
    if ((edge.kind === 'has-control' || edge.kind === 'has-finding') && byId.get(edge.source)?.kind === 'page') pageOf.set(edge.target, edge.source);
  }
  for (const edge of graph.edges) {
    if (edge.kind === 'may-lead-to' && pageOf.has(edge.source)) pageOf.set(edge.target, pageOf.get(edge.source)!);
  }
  const addJourney = (pageId: string | undefined, flowId: string) => {
    if (!pageId) return;
    journeysByPage.set(pageId, (journeysByPage.get(pageId) ?? new Set()).add(flowId));
  };
  for (const edge of graph.edges) {
    if (!MOVEMENT.has(edge.kind) || edge.evidenceLabel !== 'observed') continue;
    next.set(edge.source, [...(next.get(edge.source) ?? []), edge.target]);
    if (edge.kind === 'links-to') addJourney(edge.target, edge.source);
  }
  for (const node of graph.nodes) if (node.kind === 'flow' && node.evidenceLabel === 'observed') addJourney(pageOf.get(node.id), node.id);
  return { byId, next, journeysByPage, pageOf };
}

function walk(start: string[], next: Map<string, string[]>): Set<string> {
  const seen = new Set<string>(start);
  const queue = [...start];
  while (queue.length) {
    const current = queue.shift()!;
    for (const target of next.get(current) ?? []) {
      if (seen.has(target)) continue;
      seen.add(target);
      queue.push(target);
    }
  }
  for (const id of start) seen.delete(id);
  return seen;
}

/** The reach of one page, control or finding. Anything else has none. */
export function reachOf(graph: SiteGraph, node: GraphNode, index = indexGraph(graph)): Reach | null {
  const { byId, next, journeysByPage, pageOf } = index;
  let start: string[];
  if (node.kind === 'page') start = [node.id];
  else if (node.kind === 'control') start = [node.id];
  else if (node.kind === 'accessibility-finding') {
    // A finding sits on its page and on the controls it affects.
    const page = pageOf.get(node.id);
    const controls = graph.edges.filter((edge) => edge.kind === 'has-finding' && edge.target === node.id && byId.get(edge.source)?.kind === 'control').map((edge) => edge.source);
    start = [...(page ? [page] : []), ...controls];
  } else return null;
  if (!start.length) return { downstreamPagesReachable: 0, journeysThrough: 0, blastRadiusNodeIds: [] };

  const reached = walk(start, next);
  const ownPage = node.kind === 'page' ? node.id : pageOf.get(node.id);
  const pages = [...reached].filter((id) => byId.get(id)?.kind === 'page' && id !== ownPage);
  // A journey passes through a page when it was recorded leaving it or
  // arriving at it; through a control when the control started it.
  return {
    downstreamPagesReachable: pages.length,
    journeysThrough: node.kind === 'control'
      ? (next.get(node.id) ?? []).filter((id) => byId.get(id)?.kind === 'flow').length
      : journeysByPage.get(ownPage ?? '')?.size ?? 0,
    blastRadiusNodeIds: [...reached].slice(0, MAX_RADIUS_IDS),
  };
}

/** The markup of a finding with whitespace and the scanner's own marker removed, so copies on different pages compare equal. */
export function normalizedSnippet(snippet: unknown): string {
  return String(snippet ?? '').replace(/\sdata-accessripple-ref="[^"]*"/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Write each point's reach into its data, and mark findings that repeat on
 * two or more pages: the same check failing on the same markup is usually
 * one shared component, which is fixed once rather than page by page.
 */
export function annotateReach(graph: SiteGraph): SiteGraph {
  const index = indexGraph(graph);
  for (const node of graph.nodes) {
    const reach = reachOf(graph, node, index);
    if (reach) Object.assign(node.data, reach);
  }
  const groups = new Map<string, GraphNode[]>();
  for (const node of graph.nodes) {
    if (node.kind !== 'accessibility-finding' || node.data.ruleId === 'accessibility-check-incomplete') continue;
    const markup = normalizedSnippet(node.data.snippet);
    if (!markup) continue;
    const key = `${String(node.data.ruleId)}|${markup}`;
    groups.set(key, [...(groups.get(key) ?? []), node]);
  }
  for (const [key, members] of groups) {
    const pages = new Set(members.map((member) => member.pageId));
    if (pages.size < 2) continue;
    const sharedGroupId = `shared:${createHash('sha1').update(key).digest('hex').slice(0, 14)}`;
    for (const member of members) Object.assign(member.data, { sharedAcrossPages: pages.size, sharedGroupId });
  }
  return graph;
}
