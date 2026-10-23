import { createServer, type Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { performScan } from '../../src/scan/worker.js';
import { compareScans } from '../../src/graph/compare.js';
import { checkPredictions } from '../../src/ai/contract.js';

const page = '<!doctype html><html lang="en"><head><title>Shop</title></head><body><main><h1>Shop</h1><img class="hero" src="/hero.svg"></main></body></html>';
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>';

describe('a change simulated in the scanner\'s browser', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    server = createServer((request, response) => {
      if (request.url === '/hero.svg') { response.writeHead(200, { 'content-type': 'image/svg+xml' }); response.end(svg); return; }
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end(page);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No address.');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const scan = (id: string, simulatedPatches?: Parameters<typeof performScan>[0]['simulatedPatches']) =>
    performScan({ id, url: `${baseUrl}/`, allowPrivateNetwork: true, interactionMode: 'safe', simulatedPatches, onUpdate: () => {} });

  it('applies a grounded change before the checks run, records the element box, and labels the page as simulated', async () => {
    const before = await scan('sim-before');
    const finding = before.pages[0]!.findings.find((item) => item.ruleId === 'image-alt')!;
    expect(finding).toBeDefined();
    expect(finding.tags).toContain('wcag111');
    expect(finding.boundingBox?.width).toBeGreaterThan(0);
    const node = before.graph!.nodes.find((item) => item.kind === 'accessibility-finding' && item.data.ruleId === 'image-alt')!;
    const patch = { id: 'simulated:1', scanId: before.id, pageUrl: before.pages[0]!.url, ruleId: 'image-alt', nodeId: node.id, selector: finding.targets[0]!, before: finding.snippet!, after: finding.snippet!.replace('<img', '<img alt="Spring collection"'), summary: 'Add alternative text.', appliedAt: '' };

    const after = await scan('sim-after', [patch]);
    expect(after.pages[0]!.simulatedPatches).toEqual([expect.objectContaining({ applied: true })]);
    expect(after.pages[0]!.findings.some((item) => item.ruleId === 'image-alt')).toBe(false);
    expect(after.graph!.nodes.find((item) => item.kind === 'page')?.data.simulated).toBe(true);

    const comparison = compareScans(before, after);
    expect(comparison.resolved.map((item) => item.id)).toContain(node.id);
    expect(comparison.simulatedPages).toEqual([{ url: before.pages[0]!.url, applied: 1, notApplied: 0 }]);
    const [checked] = checkPredictions({ model: 'm', predictions: [{ issueId: node.id, expected: 'absent', reason: '' }] }, before, after);
    expect(checked).toMatchObject({ outcome: 'supported', simulated: true });
  }, 60_000);

  it('does not apply a change whose markup is no longer on the page, and says so', async () => {
    const result = await scan('sim-stale', [{ id: 'simulated:2', scanId: 'x', pageUrl: `${baseUrl}/`, ruleId: 'image-alt', nodeId: 'n', selector: 'img.hero', before: '<img class="hero" src="/old.png">', after: '<img class="hero" src="/old.png" alt="x">', summary: 'Stale.', appliedAt: '' }]);
    expect(result.pages[0]!.simulatedPatches).toEqual([expect.objectContaining({ applied: false, reason: 'The element no longer has the recorded markup.' })]);
    expect(result.pages[0]!.findings.some((item) => item.ruleId === 'image-alt')).toBe(true);
    expect(result.graph!.nodes.find((item) => item.kind === 'page')?.data.simulated).toBeUndefined();
  }, 60_000);
});
