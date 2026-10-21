import type { GraphNode, ScanResult } from './schema.js';

export interface ScanComparison {
  previousScanId: string;
  currentScanId: string;
  resolved: GraphNode[];
  remaining: GraphNode[];
  new: GraphNode[];
  changed: Array<{ before: GraphNode; after: GraphNode }>;
  /** The same page before and after, so a repair can be shown rather than only counted. */
  pages: Array<{ url: string; title?: string; before?: string; after?: string }>;
}

export function compareScans(previous: ScanResult, current: ScanResult): ScanComparison {
  const before = new Map((previous.graph?.nodes ?? []).map((node) => [node.id, node]));
  const after = new Map((current.graph?.nodes ?? []).map((node) => [node.id, node]));
  const resolved: GraphNode[] = [];
  const remaining: GraphNode[] = [];
  const fresh: GraphNode[] = [];
  const changed: Array<{ before: GraphNode; after: GraphNode }> = [];
  const issueKinds = new Set(['runtime-error', 'accessibility-finding']);

  for (const [id, oldNode] of before) {
    if (!issueKinds.has(oldNode.kind)) continue;
    const newNode = after.get(id);
    if (!newNode) resolved.push(oldNode);
    else if (oldNode.status !== newNode.status || oldNode.label !== newNode.label) changed.push({ before: oldNode, after: newNode });
    else remaining.push(newNode);
  }
  for (const [id, newNode] of after) {
    if (!issueKinds.has(newNode.kind) || before.has(id)) continue;
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
  return { previousScanId: previous.id, currentScanId: current.id, resolved, remaining, new: fresh, changed, pages };
}
