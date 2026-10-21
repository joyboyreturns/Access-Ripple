import { describe as suite, it, expect } from 'vitest';
import { compareScans } from '../../src/graph/compare.js';
import type { ScanResult } from '../../src/graph/schema.js';

const page = (id: string, status: 'complete' | 'failed' | 'skipped') => ({ id, url: `https://example.com/${id}`, title: id, status, depth: 0, controls: [], errors: [], findings: [], outgoingLinks: [], interactions: [] });
const finding = (id: string, pageId: string) => ({ id, kind: 'accessibility-finding' as const, label: 'Images must have alternative text', status: 'detected' as const, pageId, evidenceLabel: 'observed' as const, data: { ruleId: 'image-alt', impact: 'critical', targets: ['img'] } });

const scan = (pages: ScanResult['pages'], nodes: ScanResult['graph'] extends undefined ? never : NonNullable<ScanResult['graph']>['nodes']): ScanResult => ({
  id: 's', createdAt: '2026-10-21T00:00:00.000Z', updatedAt: '2026-10-21T00:00:00.000Z', status: 'complete',
  inputUrl: 'https://example.com/', canonicalOrigin: 'https://example.com',
  limits: { maxPages: 5, maxDepth: 2, navigationTimeoutMs: 20000, totalTimeoutMs: 100000, maxControlsPerPage: 200, maxRequestsPerPage: 300, maxFindingsPerPage: 100, maxInteractionsPerPage: 4, maxInteractionsPerScan: 10 },
  progress: { completedPages: pages.length, totalPageLimit: 5, message: 'done' },
  pages, graph: { schemaVersion: '1.0', nodes, edges: [] },
});

suite('comparing two scans', () => {
  it('calls a finding resolved only when its page was looked at again', () => {
    const before = scan([page('p1', 'complete')], [finding('f1', 'p1')]);
    const after = scan([page('p1', 'complete')], []);
    const comparison = compareScans(before, after);
    expect(comparison.resolved).toHaveLength(1);
    expect(comparison.notRechecked).toHaveLength(0);
  });

  it('does not call a finding resolved when its page failed the second time', () => {
    const before = scan([page('p1', 'complete')], [finding('f1', 'p1')]);
    const after = scan([page('p1', 'failed')], []);
    const comparison = compareScans(before, after);
    expect(comparison.resolved).toHaveLength(0);
    expect(comparison.notRechecked).toHaveLength(1);
    expect(comparison.notRechecked[0]?.id).toBe('f1');
  });

  it('does not call a finding resolved when its page was never revisited', () => {
    const before = scan([page('p1', 'complete')], [finding('f1', 'p1')]);
    const after = scan([], []);
    const comparison = compareScans(before, after);
    expect(comparison.resolved).toHaveLength(0);
    expect(comparison.notRechecked).toHaveLength(1);
  });

  it('still reports a finding that is present in both scans as remaining', () => {
    const node = finding('f1', 'p1');
    const before = scan([page('p1', 'complete')], [node]);
    const after = scan([page('p1', 'complete')], [node]);
    const comparison = compareScans(before, after);
    expect(comparison.remaining).toHaveLength(1);
    expect(comparison.resolved).toHaveLength(0);
    expect(comparison.notRechecked).toHaveLength(0);
  });

  it('knows when both scans ran against the demo shop', () => {
    const before = { ...scan([page('p1', 'complete')], [finding('f1', 'p1')]), sample: 'checkout' as const };
    const after = { ...scan([page('p1', 'complete')], []), sample: 'checkout' as const };
    expect(compareScans(before, after).demoShop).toBe(true);
    expect(compareScans(before, scan([page('p1', 'complete')], [])).demoShop).toBe(false);
  });
});
