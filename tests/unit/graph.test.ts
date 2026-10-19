import { describe, expect, it } from 'vitest';
import { buildGraph } from '../../src/graph/build-graph.js';
import { compareScans } from '../../src/graph/compare.js';
import type { ScanResult } from '../../src/graph/schema.js';

function sample(id: string, hasError: boolean): ScanResult {
  return {
    id, createdAt: '2026-10-19T00:00:00.000Z', updatedAt: '2026-10-19T00:00:00.000Z', status: 'complete', inputUrl: 'https://shop.example/', canonicalOrigin: 'https://shop.example',
    limits: { maxPages: 5, maxDepth: 2, navigationTimeoutMs: 20_000, totalTimeoutMs: 60_000, maxControlsPerPage: 200, maxRequestsPerPage: 300, maxFindingsPerPage: 100 },
    progress: { completedPages: 1, totalPageLimit: 5, message: 'done' }, previousScanId: undefined,
    pages: [{ id: 'p1', url: 'https://shop.example/', title: 'Shop', status: 'complete', depth: 0,
      controls: [{ id: 'c1', role: 'link', accessibleName: 'Checkout', href: 'https://shop.example/checkout', evidenceLabel: 'observed' }],
      errors: hasError ? [{ id: 'e1', kind: 'console', message: 'timeout', evidenceLabel: 'observed' }] : [], findings: [], outgoingLinks: ['https://shop.example/checkout'] }],
  };
}

describe('evidence graph', () => {
  it('connects controls to inferred destinations and keeps page errors observed', () => {
    const scan = sample('scan-1', true);
    scan.graph = buildGraph(scan);
    expect(scan.graph.nodes.map((node) => node.kind)).toContain('control');
    expect(scan.graph.nodes.find((node) => node.kind === 'flow')?.evidenceLabel).toBe('inferred');
    expect(scan.graph.nodes.find((node) => node.kind === 'runtime-error')?.evidenceLabel).toBe('observed');
    expect(scan.graph.edges.map((edge) => edge.kind)).toContain('has-error');
  });

  it('detects a resolved error between two scans', () => {
    const before = sample('before', true);
    const after = sample('after', false);
    before.graph = buildGraph(before);
    after.graph = buildGraph(after);
    const comparison = compareScans(before, after);
    expect(comparison.resolved.some((node) => node.kind === 'runtime-error')).toBe(true);
  });
});
