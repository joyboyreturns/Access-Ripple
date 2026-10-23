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

  it('never counts an unavailable-check marker as a fixed or new issue', () => {
    const marker = { ...finding('unchecked', 'p1'), data: { ruleId: 'accessibility-check-incomplete' } };
    const unavailable = scan([page('p1', 'complete')], [marker]);
    const clear = scan([page('p1', 'complete')], []);
    expect(compareScans(unavailable, clear).resolved).toEqual([]);
    expect(compareScans(clear, unavailable).new).toEqual([]);
  });

  it('keeps findings unknown when the second scan could not run its checks', () => {
    const marker = { ...finding('unchecked', 'p1'), data: { ruleId: 'accessibility-check-incomplete' } };
    const before = scan([page('p1', 'complete')], [finding('f1', 'p1')]);
    const after = scan([page('p1', 'complete')], [marker]);
    expect(compareScans(before, after).resolved).toEqual([]);
    expect(compareScans(before, after).notRechecked.map((node) => node.id)).toEqual(['f1']);
  });

  it('keeps a finding whose element path moved as the same finding', () => {
    const moved = (id: string, target: string) => ({ ...finding(id, 'p1'), data: { ruleId: 'image-alt', impact: 'critical', targets: [target], snippet: '<img src="logo.png">' } });
    const before = scan([page('p1', 'complete')], [moved('f-old', 'main > img')]);
    const after = scan([page('p1', 'complete')], [moved('f-new', 'main > div > img')]);
    const comparison = compareScans(before, after);
    expect(comparison.resolved).toEqual([]);
    expect(comparison.new).toEqual([]);
    expect(comparison.remaining.map((node) => node.id)).toEqual(['f-new']);
  });

  it('still calls a finding resolved when its markup changed with the repair', () => {
    const withMarkup = (id: string, snippet: string) => ({ ...finding(id, 'p1'), data: { ruleId: 'image-alt', impact: 'critical', targets: ['img'], snippet } });
    const before = scan([page('p1', 'complete')], [withMarkup('f1', '<img src="a.png">'), withMarkup('f2', '<img src="b.png">')]);
    const after = scan([page('p1', 'complete')], [withMarkup('f2-moved', '<img src="b.png">')]);
    const comparison = compareScans(before, after);
    expect(comparison.resolved.map((node) => node.id)).toEqual(['f1']);
    expect(comparison.remaining.map((node) => node.id)).toEqual(['f2-moved']);
  });

  it('pairs each later finding once, preferring the closest element path', () => {
    const twin = (id: string, target: string) => ({ ...finding(id, 'p1'), data: { ruleId: 'image-alt', impact: 'critical', targets: [target], snippet: '<img src="x.png">' } });
    const before = scan([page('p1', 'complete')], [twin('a', 'li:nth-of-type(1) > img'), twin('b', 'li:nth-of-type(2) > img')]);
    const after = scan([page('p1', 'complete')], [twin('b2', 'ul > li:nth-of-type(2) > img')]);
    const comparison = compareScans(before, after);
    expect(comparison.remaining.map((node) => node.id)).toEqual(['b2']);
    expect(comparison.resolved.map((node) => node.id)).toEqual(['a']);
  });

  it('says what separated two demo-shop scans: a prepared fix, an applied change, or nothing', () => {
    const shop = (fixtureState: ScanResult['fixtureState']): ScanResult => ({ ...scan([page('p1', 'complete')], [finding('f1', 'p1')]), sample: 'checkout', fixtureState });
    expect(compareScans(shop({ variant: 'before', appliedChanges: 0 }), shop({ variant: 'after', appliedChanges: 0 })).repair).toBe('prepared-fix');
    expect(compareScans(shop({ variant: 'before', appliedChanges: 0 }), shop({ variant: 'before', appliedChanges: 1 })).repair).toBe('applied-change');
    expect(compareScans(shop({ variant: 'before', appliedChanges: 0 }), shop({ variant: 'before', appliedChanges: 0 })).repair).toBe('no-change');
    // A scan that did not record the fixture's state, or a public site, claims nothing about a repair.
    expect(compareScans(shop(undefined), shop({ variant: 'after', appliedChanges: 0 })).repair).toBeUndefined();
    expect(compareScans(scan([page('p1', 'complete')], []), scan([page('p1', 'complete')], [])).repair).toBeUndefined();
  });
});
