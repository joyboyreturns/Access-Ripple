import { afterEach, describe, expect, it } from 'vitest';
import { createServer } from 'node:http';
import { buildApp } from '../../src/api/app.js';
import { scanStore } from '../../src/store/memory.js';

describe('local scan API', () => {
  const apps: Array<Awaited<ReturnType<typeof buildApp>>> = [];
  afterEach(async () => { for (const app of apps.splice(0)) await app.close(); scanStore.clear(); });

  it('reports local health and serves the checkout fixture', async () => {
    const app = await buildApp(); apps.push(app);
    const health = await app.inject({ method: 'GET', url: '/api/health' });
    expect(health.statusCode).toBe(200);
    expect(health.json().localOnly).toBe(true);
    const sample = await app.inject({ method: 'GET', url: '/sample/checkout' });
    expect(sample.statusCode).toBe(200);
    expect(sample.body).toContain('Complete your order');
  });

  it('answers only to this computer\'s own names, so a rebound web page cannot read scan history', async () => {
    const app = await buildApp(); apps.push(app);
    const rebound = await app.inject({ method: 'GET', url: '/api/scans', headers: { host: 'evil.example.com:4317' } });
    expect(rebound.statusCode).toBe(403);
    expect(rebound.json().error.code).toBe('HOST_BLOCKED');
    for (const host of ['127.0.0.1:4317', 'localhost:5173', '[::1]:4317']) {
      expect((await app.inject({ method: 'GET', url: '/api/health', headers: { host } })).statusCode).toBe(200);
    }
  });

  it('rejects private URLs and malformed bodies before starting a scan', async () => {
    const app = await buildApp(); apps.push(app);
    const privateTarget = await app.inject({ method: 'POST', url: '/api/scans', payload: { url: 'http://127.0.0.1:9000/admin' } });
    expect(privateTarget.statusCode).toBe(422);
    const malformed = await app.inject({ method: 'POST', url: '/api/scans', payload: { url: 'not a URL' } });
    expect(malformed.statusCode).toBe(422);
    expect(scanStore.list()).toHaveLength(0);
  });

  it('reaches an address on this computer only when the scan asks permission', async () => {
    const app = await buildApp(); apps.push(app);
    const permitted = await app.inject({ method: 'POST', url: '/api/scans', payload: { url: 'http://127.0.0.1:9000/admin', allowPrivateNetwork: true } });
    expect(permitted.statusCode).toBe(202);
    const scan = await app.inject({ method: 'GET', url: `/api/scans/${permitted.json().scanId}` });
    expect(scan.json().addressScope).toBe('private');
  });

  it('never scans a cloud credentials address, even with permission', async () => {
    const app = await buildApp(); apps.push(app);
    const before = scanStore.list().length;
    const metadata = await app.inject({ method: 'POST', url: '/api/scans', payload: { url: 'http://169.254.169.254/latest/meta-data/', allowPrivateNetwork: true } });
    expect(metadata.statusCode).toBe(422);
    expect(metadata.json().error.code).toBe('NEVER_SCANNED');
    expect(scanStore.list()).toHaveLength(before);
  });

  it('never queues an encoded cloud metadata address', async () => {
    const app = await buildApp(); apps.push(app);
    const metadata = await app.inject({ method: 'POST', url: '/api/scans', payload: { url: 'http://[::ffff:a9fe:a9fe]/latest/meta-data/', allowPrivateNetwork: true } });
    expect(metadata.statusCode).toBe(422);
    expect(metadata.json().error.code).toBe('NEVER_SCANNED');
    expect(scanStore.list()).toHaveLength(0);
  });

  it('serves an accepted repair on every supported demo page and restores it on reset', async () => {
    const app = await buildApp(); apps.push(app);
    const before = await app.inject({ method: 'GET', url: '/sample/cart' });
    const title = before.body.match(/<title>[^<]+<\/title>/)?.[0];
    expect(title).toBeTruthy();
    const repairedTitle = '<title>Repaired cart example</title>';
    try {
      const applied = await app.inject({ method: 'POST', url: '/api/sample/apply', payload: { file: 'src/sample/site/cart.html', before: title, after: repairedTitle } });
      expect(applied.statusCode).toBe(200);
      expect((await app.inject({ method: 'GET', url: '/sample/cart' })).body).toContain(repairedTitle);
    } finally {
      await app.inject({ method: 'POST', url: '/api/sample/reset', payload: {} });
    }
    expect((await app.inject({ method: 'GET', url: '/sample/cart' })).body).toContain(title);
  });

  it('exports accepted changes as a patch and as a pull request summary', async () => {
    const app = await buildApp(); apps.push(app);
    await app.inject({ method: 'POST', url: '/api/sample/reset' });
    const empty = await app.inject({ method: 'GET', url: '/api/applied-fixes/patch?format=markdown' });
    expect(empty.statusCode).toBe(200);
    expect(empty.headers['content-type']).toContain('text/markdown');
    expect(empty.body).toContain('No change has been accepted yet.');
    const applied = await app.inject({ method: 'POST', url: '/api/sample/apply', payload: { file: 'src/sample/site/checkout.html', before: '<img class="product-art" src="/sample/missing-product.webp">', after: '<img class="product-art" src="/sample/missing-product.webp" alt="Product">', summary: 'Add alternative text.' } });
    expect(applied.statusCode).toBe(200);
    const patch = await app.inject({ method: 'GET', url: '/api/applied-fixes/patch' });
    expect(patch.headers['content-type']).toContain('text/x-patch');
    expect(patch.body).toContain('+<img class="product-art" src="/sample/missing-product.webp" alt="Product">');
    await app.inject({ method: 'POST', url: '/api/sample/reset' });
  });

  it('refuses to simulate a change without a proposal, and sends the demo shop to its real apply', async () => {
    const app = await buildApp(); apps.push(app);
    const page = { id: 'p1', url: 'https://shop.example/', status: 'complete' as const, depth: 0, controls: [], errors: [], findings: [], outgoingLinks: [], interactions: [] };
    const graph = { schemaVersion: '1.0' as const, edges: [], nodes: [{ id: 'f1', kind: 'accessibility-finding' as const, label: 'Images must have alternative text', status: 'detected' as const, pageId: 'p1', evidenceLabel: 'observed' as const, data: { ruleId: 'image-alt', targets: ['img'], snippet: '<img src="a.png">' } }] };
    const base = { createdAt: '', updatedAt: '', status: 'complete' as const, inputUrl: 'https://shop.example/', limits: {} as never, progress: { completedPages: 1, totalPageLimit: 5, message: '' }, pages: [page], graph };
    scanStore.set({ ...base, id: 'live' });
    scanStore.set({ ...base, id: 'demo', sample: 'checkout' });
    const noProposal = await app.inject({ method: 'POST', url: '/api/scans/live/simulate', payload: { nodeId: 'f1' } });
    expect(noProposal.statusCode).toBe(409);
    expect(noProposal.json().error.code).toBe('NO_PROPOSAL');
    const demo = await app.inject({ method: 'POST', url: '/api/scans/demo/simulate', payload: { nodeId: 'f1' } });
    expect(demo.json().error.code).toBe('USE_DEMO_SHOP_APPLY');
  });

  it('blocks cross-origin browser requests', async () => {
    const app = await buildApp(); apps.push(app);
    const result = await app.inject({ method: 'GET', url: '/api/health', headers: { origin: 'https://attacker.example' } });
    expect(result.statusCode).toBe(403);
  });

  it('allows the studio served from the same address as the scanner', async () => {
    // Once the studio is built, the scanner serves it itself, and the browser
    // then sends that address as the origin of every asset request.
    const app = await buildApp({ baseUrl: 'http://127.0.0.1:4321' }); apps.push(app);
    const same = await app.inject({ method: 'GET', url: '/api/health', headers: { origin: 'http://127.0.0.1:4321' } });
    expect(same.statusCode).toBe(200);
    const development = await app.inject({ method: 'GET', url: '/api/health', headers: { origin: 'http://127.0.0.1:5173' } });
    expect(development.statusCode).toBe(200);
  });

  it('describes the built-in demo shop so the studio can offer it without a network address', async () => {
    const app = await buildApp(); apps.push(app);
    const info = await app.inject({ method: 'GET', url: '/api/sample/info' });
    expect(info.statusCode).toBe(200);
    expect(info.json()).toMatchObject({ id: 'checkout', name: 'Northstar demo shop', variant: 'before' });
    expect(info.json().brokenNote).toMatch(/no text alternative/);
    expect(info.json().url).toContain('/sample/checkout');
  });

  it('either reports no proof yet, or returns a well formed comparison', async () => {
    const app = await buildApp(); apps.push(app);
    const proof = await app.inject({ method: 'GET', url: '/api/proof' });
    if (proof.statusCode === 404) {
      expect(proof.json().error.code).toBe('NO_PROOF_YET');
      return;
    }
    expect(proof.statusCode).toBe(200);
    const body = proof.json();
    expect(body.comparison).toBeTruthy();
    expect(Array.isArray(body.comparison.resolved)).toBe(true);
    expect(typeof body.currentScanId).toBe('string');
    expect(typeof body.previousScanId).toBe('string');
    // A proof that shows a repair is preferred over one that shows nothing.
    if (body.comparison.resolved.length) {
      const page = body.comparison.pages.find((item: { before?: string; after?: string }) => item.before && item.after);
      expect(page).toBeTruthy();
    }
  });

  it('limits how often websites are scanned, but never the demo shop a rehearsal depends on', async () => {
    const app = await buildApp(); apps.push(app);
    for (let attempt = 0; attempt < 5; attempt++) {
      expect((await app.inject({ method: 'POST', url: '/api/scans', payload: { url: 'http://127.0.0.1:9000/admin' } })).statusCode).toBe(422);
    }
    const limited = await app.inject({ method: 'POST', url: '/api/scans', payload: { url: 'http://127.0.0.1:9000/admin' } });
    expect(limited.statusCode).toBe(429);
    const demo = await app.inject({ method: 'POST', url: '/api/scans', payload: { sample: 'checkout' } });
    expect(demo.statusCode).toBe(202);
  });

  it('accepts a demo shop scan without passing the private-address safety check', async () => {
    const app = await buildApp(); apps.push(app);
    const created = await app.inject({ method: 'POST', url: '/api/scans', payload: { sample: 'checkout' } });
    expect(created.statusCode).toBe(202);
    expect(created.json().scanId).toBeTypeOf('string');
    const scan = await app.inject({ method: 'GET', url: `/api/scans/${created.json().scanId}` });
    expect(scan.json().sample).toBe('checkout');
  });

  it('writes a grounded AI briefing and drops claims the model invented', async () => {
    let answer = '';
    const provider = createServer((request, response) => {
      request.on('data', () => {});
      request.on('end', () => {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ choices: [{ message: { content: answer } }] }));
      });
    });
    await new Promise<void>((resolve, reject) => provider.listen(0, '127.0.0.1', resolve).once('error', reject));
    const address = provider.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const previous = { key: process.env.ACCESSRIPPLE_AI_KEY, base: process.env.ACCESSRIPPLE_AI_BASE_URL, model: process.env.ACCESSRIPPLE_AI_MODEL };
    process.env.ACCESSRIPPLE_AI_KEY = 'test-key';
    process.env.ACCESSRIPPLE_AI_BASE_URL = `http://127.0.0.1:${port}/v1`;
    process.env.ACCESSRIPPLE_AI_MODEL = 'test/model';
    try {
      const app = await buildApp(); apps.push(app);
      const scanId = 'scan-briefing-test';
      scanStore.set({
        id: scanId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), status: 'complete',
        inputUrl: 'http://127.0.0.1:4317/sample/checkout', canonicalOrigin: 'http://127.0.0.1:4317',
        limits: { maxPages: 5, maxDepth: 2, maxInteractions: 10 } as never,
        progress: { completedPages: 1, totalPageLimit: 5, message: 'done' },
        pages: [], interactionPolicy: { mode: 'safe', tested: 9, skipped: 1 },
        graph: {
          schemaVersion: '1.0',
          nodes: [
            { id: 'site:1', kind: 'site', label: 'Northstar demo shop', evidenceLabel: 'observed', data: {} },
            { id: 'finding:1', kind: 'accessibility-finding', label: 'Images must have alternative text', status: 'detected', pageId: 'page:1', evidenceLabel: 'observed', data: { ruleId: 'image-alt', impact: 'critical', targets: ['img'] } },
          ],
          edges: [],
        },
      });
      const status = await app.inject({ method: 'GET', url: '/api/ai/status' });
      expect(status.json().configured).toBe(true);

      answer = 'The checkout image has no text alternative [finding:1]. Look at that image first [finding:1].';
      const grounded = await app.inject({ method: 'POST', url: `/api/scans/${scanId}/briefing`, payload: {} });
      expect(grounded.statusCode).toBe(200);
      expect(grounded.json().source).toBe('ai');
      expect(grounded.json().text).toContain('no text alternative');
      expect(grounded.json().text).not.toContain('[');
      expect(grounded.json().citations).toEqual([{ id: 'finding:1', label: 'Images must have alternative text', gap: false }]);

      answer = 'The checkout image has no text alternative [finding:made-up]. The site is unusable for everyone [finding:also-made-up].';
      const invented = await app.inject({ method: 'POST', url: `/api/scans/${scanId}/briefing`, payload: {} });
      // Every sentence the model wrote cited evidence that does not exist, so none of it survives.
      expect(invented.statusCode).toBe(502);
      expect(invented.json().error.code).toBe('BRIEFING_FAILED');
    } finally {
      if (previous.key === undefined) delete process.env.ACCESSRIPPLE_AI_KEY; else process.env.ACCESSRIPPLE_AI_KEY = previous.key;
      if (previous.base === undefined) delete process.env.ACCESSRIPPLE_AI_BASE_URL; else process.env.ACCESSRIPPLE_AI_BASE_URL = previous.base;
      if (previous.model === undefined) delete process.env.ACCESSRIPPLE_AI_MODEL; else process.env.ACCESSRIPPLE_AI_MODEL = previous.model;
      await new Promise<void>((resolve) => provider.close(() => resolve()));
    }
  });
});
