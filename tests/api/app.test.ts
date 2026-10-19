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
});
