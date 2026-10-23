import type { GraphNode, ScanResult } from './schema.js';
import { normalizedSnippet } from './reach.js';

export interface ScanComparison {
  previousScanId: string;
  currentScanId: string;
  resolved: GraphNode[];
  remaining: GraphNode[];
  new: GraphNode[];
  changed: Array<{ before: GraphNode; after: GraphNode }>;
  /** The same page before and after, so a repair can be shown rather than only counted. */
  pages: Array<{ url: string; title?: string; before?: string; after?: string }>;
  /** True when both scans ran against the built-in demo shop rather than a public site. */
  demoShop: boolean;
  /** Findings whose page was not inspected again, so they are unknown rather than resolved. */
  notRechecked: GraphNode[];
  /**
   * Pages of the later scan where the scanner applied a change inside its own
   * browser. What it recorded there is a simulation of the change, not the site.
   */
  simulatedPages: Array<{ url: string; applied: number; notApplied: number }>;
  /**
   * What separates the two demo-shop scans: the fixture's own prepared fix, a
   * change applied to the fixture's in-memory copy (the model's, when it was
   * accepted), or nothing the tool recorded. Absent for any other site.
   */
  repair?: 'prepared-fix' | 'applied-change' | 'no-change';
}

/** Which kind of repair the demo shop went through between two scans, from the state each scan recorded. */
function repairBetween(previous: ScanResult, current: ScanResult): ScanComparison['repair'] {
  const before = previous.fixtureState;
  const after = current.fixtureState;
  if (previous.sample !== 'checkout' || current.sample !== 'checkout' || !before || !after) return undefined;
  if (before.variant !== after.variant) return after.variant === 'after' ? 'prepared-fix' : 'no-change';
  return after.appliedChanges > before.appliedChanges ? 'applied-change' : 'no-change';
}

const issueKinds = new Set(['runtime-error', 'accessibility-finding']);

/** The page address, the check, and the element's own markup: what stays the same when only the markup around it moves. */
function fingerprint(node: GraphNode, pageUrls: Map<string, string>): string | null {
  if (node.kind !== 'accessibility-finding') return null;
  const markup = normalizedSnippet(node.data.snippet);
  const url = pageUrls.get(node.pageId ?? '');
  if (!markup || !url) return null;
  return `${url}|${String(node.data.ruleId)}|${markup}`;
}

/** How many trailing selector characters two findings share; the closer pair wins a tie. */
function selectorAffinity(a: GraphNode, b: GraphNode): number {
  const x = String((a.data.targets as unknown[] | undefined)?.[0] ?? '');
  const y = String((b.data.targets as unknown[] | undefined)?.[0] ?? '');
  let shared = 0;
  while (shared < x.length && shared < y.length && x[x.length - 1 - shared] === y[y.length - 1 - shared]) shared += 1;
  return shared;
}

/**
 * Pair each issue from the earlier scan with the same issue in the later one.
 *
 * A finding's id includes the path to its element, so a repair that changes
 * the markup around an element changes the id of a finding that did not go
 * away. Ids are matched first; whatever is left is matched on the page, the
 * check, and the element's own markup. Each later issue is used once.
 */
export function matchIssues(previous: ScanResult, current: ScanResult): Map<string, GraphNode> {
  const isIssue = (node: GraphNode) => issueKinds.has(node.kind) && node.data.ruleId !== 'accessibility-check-incomplete';
  const before = (previous.graph?.nodes ?? []).filter(isIssue);
  const after = (current.graph?.nodes ?? []).filter(isIssue);
  const afterById = new Map(after.map((node) => [node.id, node]));
  const matched = new Map<string, GraphNode>();
  const used = new Set<string>();
  for (const node of before) {
    const same = afterById.get(node.id);
    if (same) { matched.set(node.id, same); used.add(same.id); }
  }
  const urls = (scan: ScanResult) => new Map(scan.pages.map((page) => [page.id, page.url]));
  const beforeUrls = urls(previous), afterUrls = urls(current);
  const candidates = new Map<string, GraphNode[]>();
  for (const node of after) {
    if (used.has(node.id)) continue;
    const key = fingerprint(node, afterUrls);
    if (key) candidates.set(key, [...(candidates.get(key) ?? []), node]);
  }
  // Every possible pair with the same fingerprint, closest paths first, so a
  // finding that went away cannot take the partner of one that only moved.
  const pairs: Array<{ old: GraphNode; next: GraphNode; affinity: number }> = [];
  for (const node of before) {
    if (matched.has(node.id)) continue;
    const key = fingerprint(node, beforeUrls);
    for (const next of key ? candidates.get(key) ?? [] : []) pairs.push({ old: node, next, affinity: selectorAffinity(node, next) });
  }
  pairs.sort((a, b) => b.affinity - a.affinity);
  for (const { old, next } of pairs) {
    if (matched.has(old.id) || used.has(next.id)) continue;
    matched.set(old.id, next);
    used.add(next.id);
  }
  return matched;
}

export function compareScans(previous: ScanResult, current: ScanResult): ScanComparison {
  const before = new Map((previous.graph?.nodes ?? []).map((node) => [node.id, node]));
  const after = matchIssues(previous, current);
  const pairedAfter = new Set([...after.values()].map((node) => node.id));
  const resolved: GraphNode[] = [];
  const remaining: GraphNode[] = [];
  const fresh: GraphNode[] = [];
  const changed: Array<{ before: GraphNode; after: GraphNode }> = [];
  const isIssue = (node: GraphNode) => issueKinds.has(node.kind) && node.data.ruleId !== 'accessibility-check-incomplete';

  // A finding can only be said to have gone away if its page was looked at
  // again. If the page failed or was never revisited, the finding is unknown,
  // not fixed, and saying "resolved" would be a lie.
  const inspectedBefore = new Set(previous.pages.filter((page) => page.status === 'complete').map((page) => page.id));
  const inspectedAfter = new Set(current.pages.filter((page) => page.status === 'complete').map((page) => page.id));
  // A page whose accessibility checks could not run is not a clear page. It
  // stayed 'complete' because the page loaded, so the checks that failed on it
  // would otherwise look like findings that went away.
  const uncheckedPages = (nodes: GraphNode[]) => new Set(nodes.filter((node) => node.kind === 'accessibility-finding' && node.data.ruleId === 'accessibility-check-incomplete' && node.pageId).map((node) => node.pageId as string));
  const checksFailedBefore = uncheckedPages(previous.graph?.nodes ?? []);
  const checksFailedAfter = uncheckedPages(current.graph?.nodes ?? []);
  const notRechecked: GraphNode[] = [];
  for (const [id, oldNode] of before) {
    if (!isIssue(oldNode)) continue;
    const newNode = after.get(id);
    const pageId = oldNode.pageId;
    let rechecked = !pageId || (inspectedBefore.has(pageId) && inspectedAfter.has(pageId));
    if (rechecked && oldNode.kind === 'accessibility-finding' && pageId && (checksFailedBefore.has(pageId) || checksFailedAfter.has(pageId))) rechecked = false;
    if (!rechecked) { notRechecked.push(oldNode); continue; }
    if (!newNode) resolved.push(oldNode);
    else if (oldNode.status !== newNode.status || oldNode.label !== newNode.label) changed.push({ before: oldNode, after: newNode });
    else remaining.push(newNode);
  }
  for (const newNode of current.graph?.nodes ?? []) {
    if (!isIssue(newNode) || pairedAfter.has(newNode.id)) continue;
    fresh.push(newNode);
  }

  // Pair the pictures of the same page across the two scans.
  const pages: ScanComparison['pages'] = [];
  const urls = new Set([...previous.pages, ...current.pages].map((page) => page.url));
  for (const url of urls) {
    const oldPage = previous.pages.find((page) => page.url === url);
    const newPage = current.pages.find((page) => page.url === url);
    const oldShot = oldPage?.screenshot?.dataUrl;
    const newShot = newPage?.screenshot?.dataUrl;
    if (!oldShot && !newShot) continue;
    pages.push({ url, title: newPage?.title ?? oldPage?.title, before: oldShot, after: newShot });
  }
  // The page a repair actually touched comes first, because that is the one a
  // reviewer needs to see.
  const pageUrl = new Map<string, string>();
  for (const node of [...(previous.graph?.nodes ?? []), ...(current.graph?.nodes ?? [])]) {
    if (node.kind === 'page' && typeof node.data.url === 'string') pageUrl.set(node.id, node.data.url);
  }
  const touched = new Set([...resolved, ...fresh].map((node) => pageUrl.get(node.pageId ?? '')).filter(Boolean));
  pages.sort((a, b) => Number(touched.has(b.url)) - Number(touched.has(a.url)));
  const simulatedPages = current.pages.filter((page) => page.simulatedPatches?.length).map((page) => ({
    url: page.url,
    applied: page.simulatedPatches!.filter((patch) => patch.applied).length,
    notApplied: page.simulatedPatches!.filter((patch) => !patch.applied).length,
  }));
  return { previousScanId: previous.id, currentScanId: current.id, resolved, remaining, new: fresh, changed, pages, notRechecked, simulatedPages, demoShop: previous.sample === 'checkout' && current.sample === 'checkout', repair: repairBetween(previous, current) };
}
