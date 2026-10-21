import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/api/app.js';
import { scanStore } from '../../src/store/memory.js';

/**
 * The scan path the studio runs, exercised through the API: the demo shop
 * scan, the shape of the graph, the refusal of a private address, the repair
 * loop, and the vault download.
 *
 * The studio's own interface is checked separately by `npm run check:studio`,
 * which drives a real browser.
 */
describe('the studio in a browser', () => {
  let app: FastifyInstance;
  let baseUrl: string;
  let dataDir: string;

  beforeAll(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'accessripple-studio-'));
    process.env.ACCESSRIPPLE_DATA_DIR = dataDir;
    const reservation = createServer();
    await new Promise<void>((resolve, reject) => reservation.listen(0, '127.0.0.1', resolve).once('error', reject));
    const address = reservation.address();
    if (!address || typeof address === 'string') throw new Error('Could not reserve a local test port.');
    const port = address.port;
    await new Promise<void>((resolve, reject) => reservation.close((error) => error ? reject(error) : resolve()));
    baseUrl = `http://127.0.0.1:${port}`;
    app = await buildApp({ baseUrl });
    await app.listen({ host: '127.0.0.1', port });
  }, 30_000);

  afterAll(async () => { await app?.close(); scanStore.clear(); delete process.env.ACCESSRIPPLE_DATA_DIR; await rm(dataDir, { recursive: true, force: true }); });

  it('runs the whole demo path and explains both error cases', async () => {
    const failures: string[] = [];

    // A scan of the built-in fixture is what the studio asks for.
    const created = await app.inject({ method: 'POST', url: '/api/scans', payload: { sample: 'checkout' } });
    expect(created.statusCode).toBe(202);
    const scanId = created.json().scanId as string;
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const state = await app.inject({ method: 'GET', url: `/api/scans/${scanId}` });
      if (['complete', 'partial', 'failed'].includes(state.json().status)) break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    const finished = await app.inject({ method: 'GET', url: `/api/scans/${scanId}` });
    expect(finished.json().status).toBe('complete');
    expect(finished.json().graph).toBeTruthy();
    const graph = finished.json().graph;
    const kinds = new Set(graph.nodes.map((node: { kind: string }) => node.kind));
    expect(kinds.has('page')).toBe(true);
    expect(kinds.has('control')).toBe(true);
    expect(kinds.has('accessibility-finding')).toBe(true);
    expect(kinds.has('runtime-error')).toBe(true);
    // The fixture is the Northstar demo shop, not a loopback address.
    const site = graph.nodes.find((node: { kind: string }) => node.kind === 'site');
    expect(site.label).toBe('Northstar demo shop');

    // Every graph edge points at a node that exists.
    const ids = new Set(graph.nodes.map((node: { id: string }) => node.id));
    for (const edge of graph.edges) {
      expect(ids.has(edge.source), `edge source ${edge.source} is missing`).toBe(true);
      expect(ids.has(edge.target), `edge target ${edge.target} is missing`).toBe(true);
    }

    // A private address is refused with an explanation rather than a crash.
    const blocked = await app.inject({ method: 'POST', url: '/api/scans', payload: { url: 'http://127.0.0.1:9000/admin' } });
    expect(blocked.statusCode).toBe(422);
    expect(blocked.json().error.code).toBe('UNSAFE_URL');
    expect(blocked.json().error.message).toBeTruthy();

    // A malformed body is refused before any work starts.
    const malformed = await app.inject({ method: 'POST', url: '/api/scans', payload: { url: 'not a URL' } });
    expect(malformed.statusCode).toBe(422);

    // The repair loop: switching the fixture state and rescanning resolves
    // the missing image and its two failed requests, and adds nothing.
    await app.inject({ method: 'POST', url: '/api/sample/state', payload: { variant: 'after' } });
    const rescan = await app.inject({ method: 'POST', url: `/api/scans/${scanId}/rescan`, payload: {} });
    expect(rescan.statusCode).toBe(202);
    const nextId = rescan.json().scanId as string;
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const state = await app.inject({ method: 'GET', url: `/api/scans/${nextId}` });
      if (['complete', 'partial', 'failed'].includes(state.json().status)) break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    const comparison = await app.inject({ method: 'GET', url: `/api/scans/${nextId}/compare/${scanId}` });
    expect(comparison.statusCode).toBe(200);
    expect(comparison.json().resolved.length).toBe(3);
    expect(comparison.json().new.length).toBe(0);
    expect(comparison.json().changed.length).toBe(0);

    // The vault is produced and is a real archive.
    const archive = await app.inject({ method: 'GET', url: `/api/scans/${nextId}/export/obsidian` });
    expect(archive.statusCode).toBe(200);
    expect(archive.rawPayload.length).toBeGreaterThan(1000);
    expect(archive.headers['content-type']).toContain('application/zip');

    expect(failures).toEqual([]);
  }, 180_000);
});
