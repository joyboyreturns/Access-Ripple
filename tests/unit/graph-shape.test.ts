import { describe as suite, it, expect } from 'vitest';
import { buildGraph } from '../../src/graph/build-graph.js';
import type { ScanResult } from '../../src/graph/schema.js';

const control = (id: string, pageId: string, name: string) => ({ id, role: 'link', accessibleName: name, selector: `a[data-x="${name}"]`, evidenceLabel: 'observed' as const });

const scan = (pages: ScanResult['pages']): ScanResult => ({
  id: 's1', createdAt: '2026-10-21T00:00:00.000Z', updatedAt: '2026-10-21T00:00:00.000Z', status: 'complete',
  inputUrl: 'https://example.com/', canonicalOrigin: 'https://example.com',
  limits: { maxPages: 5, maxDepth: 2, navigationTimeoutMs: 20000, totalTimeoutMs: 60000, maxControlsPerPage: 200, maxRequestsPerPage: 300, maxFindingsPerPage: 100, maxInteractionsPerPage: 4, maxInteractionsPerScan: 10 },
  progress: { completedPages: pages.length, totalPageLimit: 5, message: 'done' },
  pages,
});

suite('the graph is well formed', () => {
  it('never contains two nodes with the same id', () => {
    // Two pages that recorded the same control id must not produce two nodes.
    const graph = buildGraph(scan([
      { id: 'p1', url: 'https://example.com/a', title: 'A', status: 'complete', depth: 0, controls: [control('c1', 'p1', 'Same link')], errors: [], findings: [], outgoingLinks: [], interactions: [] },
      { id: 'p2', url: 'https://example.com/b', title: 'B', status: 'complete', depth: 0, controls: [control('c1', 'p2', 'Same link')], errors: [], findings: [], outgoingLinks: [], interactions: [] },
    ]));
    const ids = graph.nodes.map((node) => node.id);
    expect(ids.length).toBe(new Set(ids).size);
  });

  it('never has an edge that points at a node it does not contain', () => {
    const graph = buildGraph(scan([
      { id: 'p1', url: 'https://example.com/a', title: 'A', status: 'complete', depth: 0, controls: [control('c1', 'p1', 'Link')], errors: [], findings: [], outgoingLinks: [], interactions: [] },
      { id: 'p2', url: 'https://example.com/b', title: 'B', status: 'complete', depth: 0, controls: [control('c2', 'p2', 'Link')], errors: [], findings: [], outgoingLinks: [], interactions: [] },
    ]));
    const ids = new Set(graph.nodes.map((node) => node.id));
    for (const edge of graph.edges) {
      expect(ids.has(edge.source), `edge source ${edge.source}`).toBe(true);
      expect(ids.has(edge.target), `edge target ${edge.target}`).toBe(true);
    }
  });

  it('never has two edges with the same id', () => {
    const graph = buildGraph(scan([
      { id: 'p1', url: 'https://example.com/a', title: 'A', status: 'complete', depth: 0, controls: [control('c1', 'p1', 'Link')], errors: [], findings: [], outgoingLinks: [], interactions: [] },
    ]));
    const ids = graph.edges.map((edge) => edge.id);
    expect(ids.length).toBe(new Set(ids).size);
  });
});
