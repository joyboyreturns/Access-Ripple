import { describe, expect, it } from 'vitest';
import { buildGraph } from '../../src/graph/build-graph.js';
import { compareScans } from '../../src/graph/compare.js';
import type { InteractionEvidence, ScanResult } from '../../src/graph/schema.js';

function sample(id: string, hasError: boolean): ScanResult {
  return {
    id, createdAt: '2026-10-19T00:00:00.000Z', updatedAt: '2026-10-19T00:00:00.000Z', status: 'complete', inputUrl: 'https://shop.example/', canonicalOrigin: 'https://shop.example',
    limits: { maxPages: 5, maxDepth: 2, navigationTimeoutMs: 20_000, totalTimeoutMs: 60_000, maxControlsPerPage: 200, maxRequestsPerPage: 300, maxFindingsPerPage: 100, maxInteractionsPerPage: 4, maxInteractionsPerScan: 10 },
    progress: { completedPages: 1, totalPageLimit: 5, message: 'done' }, previousScanId: undefined,
    pages: [{ id: 'p1', url: 'https://shop.example/', title: 'Shop', status: 'complete', depth: 0,
      controls: [{ id: 'c1', role: 'link', accessibleName: 'Checkout', href: 'https://shop.example/checkout', evidenceLabel: 'observed' }],
      errors: hasError ? [{ id: 'e1', kind: 'console', message: 'timeout', evidenceLabel: 'observed' }] : [], findings: [], outgoingLinks: ['https://shop.example/checkout'], interactions: [] }],
  };
}

const observedInteraction = (outcome: InteractionEvidence['steps'][number]['outcome'] = 'navigated'): InteractionEvidence => ({
  id: 'i1', rootControlId: 'c1', mode: 'safe', evidenceLabel: 'observed',
  steps: [{ controlId: 'c1', label: 'Checkout', action: 'click', outcome, summary: 'Recorded outcome.', destinationUrl: 'https://shop.example/checkout', errorIds: ['e1'] }],
});

describe('evidence graph', () => {
  it('connects controls to inferred destinations and keeps page errors observed', () => {
    const scan = sample('scan-1', true);
    scan.graph = buildGraph(scan);
    expect(scan.graph.nodes.map((node) => node.kind)).toContain('control');
    expect(scan.graph.nodes.find((node) => node.kind === 'flow')?.evidenceLabel).toBe('inferred');
    expect(scan.graph.nodes.find((node) => node.kind === 'runtime-error')?.evidenceLabel).toBe('observed');
    expect(scan.graph.edges.map((edge) => edge.kind)).toContain('has-error');
  });

  it('records an observed outcome instead of inferring the same control', () => {
    const scan = sample('observed', true);
    scan.pages[0]!.interactions = [observedInteraction()];
    scan.graph = buildGraph(scan);
    const flows = scan.graph.nodes.filter((node) => node.kind === 'flow');
    expect(flows).toHaveLength(1);
    expect(flows[0]!.evidenceLabel).toBe('observed');
    expect(flows[0]!.data.outcome).toBe('navigated');
    expect(flows[0]!.data.tested).toBe(true);
    expect(scan.graph.edges.some((edge) => edge.source === 'c1' && edge.target === flows[0]!.id && edge.evidenceLabel === 'observed')).toBe(true);
    expect(scan.graph.edges.some((edge) => edge.kind === 'failed-at' && edge.evidenceLabel === 'observed' && edge.source === flows[0]!.id && edge.target === 'e1')).toBe(true);
    const control = scan.graph.nodes.find((node) => node.id === 'c1');
    expect((control?.data.interaction as { tested?: boolean })?.tested).toBe(true);
  });

  it('keeps untested controls connected to errors only as inferred context', () => {
    const scan = sample('inferred-context', false);
    scan.pages.push({ id: 'p2', url: 'https://shop.example/checkout', title: 'Checkout', status: 'complete', depth: 1, controls: [], errors: [{ id: 'e2', kind: 'console', message: 'destination warning', evidenceLabel: 'observed' }], findings: [], outgoingLinks: [], interactions: [] });
    scan.graph = buildGraph(scan);
    const flow = scan.graph.nodes.find((node) => node.kind === 'flow')!;
    expect(flow.evidenceLabel).toBe('inferred');
    const inferred = scan.graph.edges.find((edge) => edge.kind === 'failed-at' && edge.source === flow.id && edge.target === 'e2');
    expect(inferred?.evidenceLabel).toBe('inferred');
    expect(scan.graph.edges.some((edge) => edge.kind === 'failed-at' && edge.evidenceLabel === 'observed')).toBe(false);
  });

  it('explains controls that were excluded by the interaction policy', () => {
    const scan = sample('exclusions', false);
    scan.pages[0]!.controls.push(
      { id: 'c2', role: 'submit', accessibleName: 'Place order', formAction: 'https://shop.example/pay', evidenceLabel: 'observed' },
      { id: 'c3', role: 'button', accessibleName: 'Delete account', evidenceLabel: 'observed' },
    );
    scan.pages[0]!.interactionExclusions = [{ controlId: 'c2', reason: 'requires-authorization' }, { controlId: 'c3', reason: 'consequential-action' }];
    const graph = buildGraph(scan);
    const c2 = graph.nodes.find((node) => node.kind === 'flow' && node.data.sourceControlId === 'c2');
    expect(c2?.data.reason).toBe('requires-authorization');
    expect(c2?.evidenceLabel).toBe('untested');
    const c3 = graph.nodes.find((node) => node.kind === 'flow' && node.data.sourceControlId === 'c3');
    expect(c3?.data.reason).toBe('consequential-action');
    expect(graph.nodes.find((node) => node.id === 'c2')?.status).toBe('clear');
  });

  it('describes script and email links in plain language instead of raw addresses', () => {
    const scan = sample('script-link', false);
    scan.pages[0]!.controls.push(
      { id: 'c2', role: 'link', accessibleName: 'Cart', href: 'javascript:void(0)', evidenceLabel: 'observed' },
      { id: 'c3', role: 'link', accessibleName: 'Email us', href: 'mailto:hello@shop.example', evidenceLabel: 'observed' },
    );
    const graph = buildGraph(scan);
    const script = graph.nodes.find((node) => node.kind === 'flow' && node.data.sourceControlId === 'c2');
    expect(script?.label).toBe('May run a script on this page');
    expect(script?.label).not.toContain('void');
    expect(script?.data.destinationUrl).toBe('javascript:void(0)');
    const email = graph.nodes.find((node) => node.kind === 'flow' && node.data.sourceControlId === 'c3');
    expect(email?.label).toBe('May open an email draft');
  });

  it('connects a finding only to controls matched on its page', () => {
    const scan=sample('matched',false);
    scan.pages[0]!.findings=[{id:'f1',ruleId:'button-name',impact:'serious',status:'detected',help:'Name the button',helpUrl:'https://example.com/check',targets:['#pay'],affectedControlIds:['c1','missing-control'],evidenceLabel:'observed'}];
    const graph=buildGraph(scan);
    expect(graph.edges.some(e=>e.source==='c1'&&e.kind==='has-finding')).toBe(true);
    expect(graph.edges.some(e=>e.source==='missing-control')).toBe(false);
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
