import { afterEach, describe, expect, it } from 'vitest';
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

  it('describes the built-in demo shop so the studio can offer it without a network address', async () => {
    const app = await buildApp(); apps.push(app);
    const info = await app.inject({ method: 'GET', url: '/api/sample/info' });
    expect(info.statusCode).toBe(200);
    expect(info.json()).toMatchObject({ id: 'checkout', name: 'Northstar demo shop', variant: 'before' });
    expect(info.json().brokenNote).toMatch(/no text alternative/);
    expect(info.json().url).toContain('/sample/checkout');
  });

  it('accepts a demo shop scan without passing the private-address safety check', async () => {
    const app = await buildApp(); apps.push(app);
    const created = await app.inject({ method: 'POST', url: '/api/scans', payload: { sample: 'checkout' } });
    expect(created.statusCode).toBe(202);
    expect(created.json().scanId).toBeTypeOf('string');
    const scan = await app.inject({ method: 'GET', url: `/api/scans/${created.json().scanId}` });
    expect(scan.json().sample).toBe('checkout');
  });
});
