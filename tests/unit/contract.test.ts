import { describe as suite, it, expect } from 'vitest';
import { checkPredictions, parseContract, type RepairContract } from '../../src/ai/contract.js';
import type { ScanResult } from '../../src/graph/schema.js';

const page = (id: string, status: 'complete' | 'failed') => ({ id, url: `https://example.com/${id}`, title: id, status, depth: 0, controls: [], errors: [], findings: [], outgoingLinks: [], interactions: [] });
const finding = (id: string, pageId: string) => ({ id, kind: 'accessibility-finding' as const, label: 'Images must have alternative text', status: 'detected' as const, pageId, evidenceLabel: 'observed' as const, data: { ruleId: 'image-alt', impact: 'critical', targets: ['img'] } });
const signal = (id: string, pageId: string) => ({ id, kind: 'runtime-error' as const, label: 'HTTP 404 response.', status: 'detected' as const, pageId, evidenceLabel: 'observed' as const, data: { type: 'http' } });

const scan = (pages: ScanResult['pages'], nodes: ScanResult['graph'] extends undefined ? never : NonNullable<ScanResult['graph']>['nodes']): ScanResult => ({
  id: 's', createdAt: '2026-10-21T00:00:00.000Z', updatedAt: '2026-10-21T00:00:00.000Z', status: 'complete',
  inputUrl: 'https://example.com/', canonicalOrigin: 'https://example.com',
  limits: { maxPages: 5, maxDepth: 2, navigationTimeoutMs: 20000, totalTimeoutMs: 100000, maxControlsPerPage: 200, maxRequestsPerPage: 300, maxFindingsPerPage: 100, maxInteractionsPerPage: 4, maxInteractionsPerScan: 10 },
  progress: { completedPages: pages.length, totalPageLimit: 5, message: 'done' },
  pages, graph: { schemaVersion: '1.0', nodes, edges: [] },
});

suite('reading the model’s commitment', () => {
  it('accepts a contract that covers the targeted finding', () => {
    const predictions = parseContract(JSON.stringify({ predictions: [{ issueId: 'f1', expected: 'absent', reason: 'the description is added' }] }), ['f1', 'e1'], 'f1');
    expect(predictions).toHaveLength(1);
    expect(predictions[0]).toMatchObject({ issueId: 'f1', expected: 'absent' });
  });

  it('reads a contract that arrives wrapped in prose', () => {
    const predictions = parseContract('Sure!\n{"predictions":[{"issueId":"f1","expected":"present","reason":"the file is still missing"}]}\nHope that helps.', ['f1'], 'f1');
    expect(predictions).toHaveLength(1);
    expect(predictions[0]?.expected).toBe('present');
  });

  it('rejects a contract that does not cover the targeted finding', () => {
    expect(parseContract(JSON.stringify({ predictions: [{ issueId: 'e1', expected: 'absent', reason: '' }] }), ['f1', 'e1'], 'f1')).toEqual([]);
  });

  it('rejects a prediction about something it was never given', () => {
    const predictions = parseContract(JSON.stringify({ predictions: [{ issueId: 'invented', expected: 'absent', reason: '' }, { issueId: 'f1', expected: 'absent', reason: '' }] }), ['f1'], 'f1');
    expect(predictions.map((p) => p.issueId)).toEqual(['f1']);
  });

  it('rejects a third answer', () => {
    expect(parseContract(JSON.stringify({ predictions: [{ issueId: 'f1', expected: 'maybe', reason: '' }] }), ['f1'], 'f1')).toEqual([]);
  });

  it('rejects the same id twice', () => {
    const predictions = parseContract(JSON.stringify({ predictions: [{ issueId: 'f1', expected: 'absent', reason: '' }, { issueId: 'f1', expected: 'present', reason: '' }] }), ['f1'], 'f1');
    expect(predictions).toHaveLength(1);
    expect(predictions[0]?.expected).toBe('absent');
  });

  it('rejects an answer that is not readable', () => {
    expect(parseContract('I could not make a prediction.', ['f1'], 'f1')).toEqual([]);
    expect(parseContract('{not json', ['f1'], 'f1')).toEqual([]);
    expect(parseContract('{"predictions":"none"}', ['f1'], 'f1')).toEqual([]);
  });

  it('keeps at most three predictions', () => {
    const many = JSON.stringify({ predictions: ['f1', 'e1', 'e2', 'e3', 'e4'].map((id) => ({ issueId: id, expected: 'absent', reason: '' })) });
    expect(parseContract(many, ['f1', 'e1', 'e2', 'e3', 'e4'], 'f1')).toHaveLength(3);
  });

  it('retains the required target when the model lists it fourth', () => {
    const many = JSON.stringify({ predictions: ['e1', 'e2', 'e3', 'f1'].map((id) => ({ issueId: id, expected: 'absent', reason: '' })) });
    expect(parseContract(many, ['f1', 'e1', 'e2', 'e3'], 'f1').map((prediction) => prediction.issueId)).toContain('f1');
  });
});

suite('checking the commitment against the browser', () => {
  const contract: RepairContract = {
    model: 'test-model',
    predictions: [
      { issueId: 'f1', expected: 'absent', reason: 'the description is added' },
      { issueId: 'e1', expected: 'present', reason: 'the file is still missing' },
    ],
  };

  it('says a prediction held when the browser agrees', () => {
    const before = scan([page('p1', 'complete')], [finding('f1', 'p1'), signal('e1', 'p1')]);
    const after = scan([page('p1', 'complete')], [signal('e1', 'p1')]);
    const checked = checkPredictions(contract, before, after);
    expect(checked[0]).toMatchObject({ outcome: 'supported', observed: 'absent' });
    expect(checked[1]).toMatchObject({ outcome: 'supported', observed: 'present' });
  });

  it('says a prediction failed when the browser disagrees', () => {
    const before = scan([page('p1', 'complete')], [finding('f1', 'p1'), signal('e1', 'p1')]);
    // The finding is still there, although the model said it would be gone.
    const after = scan([page('p1', 'complete')], [finding('f1', 'p1'), signal('e1', 'p1')]);
    const checked = checkPredictions(contract, before, after);
    expect(checked[0]).toMatchObject({ outcome: 'contradicted', observed: 'present' });
  });

  it('says a prediction is unknown when its page was not checked again', () => {
    const before = scan([page('p1', 'complete')], [finding('f1', 'p1'), signal('e1', 'p1')]);
    const after = scan([page('p1', 'failed')], []);
    const checked = checkPredictions(contract, before, after);
    expect(checked[0]).toMatchObject({ outcome: 'not rechecked' });
    expect(checked[1]).toMatchObject({ outcome: 'not rechecked' });
  });

  it('says a prediction is unknown when the accessibility checks did not run', () => {
    const incomplete = { ...finding('f1', 'p1'), data: { ruleId: 'accessibility-check-incomplete' } };
    const before = scan([page('p1', 'complete')], [finding('f1', 'p1'), incomplete]);
    const after = scan([page('p1', 'complete')], []);
    const checked = checkPredictions(contract, before, after);
    expect(checked[0]?.outcome).toBe('not rechecked');
  });

  it('names the finding in the tool’s words', () => {
    const before = scan([page('p1', 'complete')], [finding('f1', 'p1')]);
    const after = scan([page('p1', 'complete')], []);
    expect(checkPredictions(contract, before, after)[0]?.label).toBe('Images must have alternative text');
  });

  it('does not validate a prediction whose baseline evidence is missing', () => {
    expect(checkPredictions(contract, scan([], []), scan([], [])).every((prediction) => prediction.outcome === 'not rechecked')).toBe(true);
  });
});
