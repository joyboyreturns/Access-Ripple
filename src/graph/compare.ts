import type { GraphNode, ScanResult } from './schema.js';

export interface ScanComparison {
  previousScanId: string;
  currentScanId: string;
  resolved: GraphNode[];
  remaining: GraphNode[];
  new: GraphNode[];
  changed: Array<{ before: GraphNode; after: GraphNode }>;
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
  return { previousScanId: previous.id, currentScanId: current.id, resolved, remaining, new: fresh, changed };
}
