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

  it('rejects private URLs and malformed bodies before starting a scan', async () => {
    const app = await buildApp(); apps.push(app);
    const privateTarget = await app.inject({ method: 'POST', url: '/api/scans', payload: { url: 'http://127.0.0.1:9000/admin' } });
    expect(privateTarget.statusCode).toBe(422);
    const malformed = await app.inject({ method: 'POST', url: '/api/scans', payload: { url: 'not a URL' } });
    expect(malformed.statusCode).toBe(422);
    expect(scanStore.list()).toHaveLength(0);
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
    await new Promise<void>((resolve) => provider.listen(0, resolve));
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
