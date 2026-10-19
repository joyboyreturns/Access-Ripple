import { createServer } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/api/app.js';
import { traceJourney } from '../../web/src/presentation.js';
import { scanStore } from '../../src/store/memory.js';

describe('sample browser scan', () => {
  let app: FastifyInstance;
  let baseUrl: string;

  beforeAll(async () => {
    const reservation = createServer();
    await new Promise<void>((resolve, reject) => reservation.listen(0, '127.0.0.1', resolve).once('error', reject));
    const address = reservation.address();
    if (!address || typeof address === 'string') throw new Error('Could not reserve a local test port.');
    const port = address.port;
    await new Promise<void>((resolve, reject) => reservation.close((error) => error ? reject(error) : resolve()));
    baseUrl = `http://127.0.0.1:${port}`;
    app = await buildApp({ baseUrl });
    await app.listen({ host: '127.0.0.1', port });
  }, 15_000);

  afterAll(async () => { await app?.close(); scanStore.clear(); });

  it('scans checkout and payment preview into a graph, then exports a vault', async () => {
    const start = await fetch(`${baseUrl}/api/scans`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sample: 'checkout' }) });
    expect(start.status).toBe(202);
    const { scanId } = await start.json() as { scanId: string };
    let scan: any;
    for (let attempt = 0; attempt < 100; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      scan = await (await fetch(`${baseUrl}/api/scans/${scanId}`)).json();
      if (['complete', 'partial', 'failed'].includes(scan.status)) break;
    }
    expect(scan.status).not.toBe('failed');
    expect(scan.pages.some((page: any) => page.url.endsWith('/sample/checkout'))).toBe(true);
    expect(scan.pages.some((page: any) => page.url.endsWith('/sample/payment'))).toBe(true);
    expect(scan.graph.nodes.some((node: any) => node.kind === 'control' && node.label.includes('Continue to payment'))).toBe(true);
    expect(scan.graph.nodes.some((node: any) => node.kind === 'flow' && node.evidenceLabel === 'inferred')).toBe(true);
    expect(scan.graph.nodes.some((node: any) => node.kind === 'runtime-error' && node.label.includes('simulated payment gateway timeout'))).toBe(true);
    expect(scan.graph.edges.some((edge: any) => edge.kind === 'failed-at' && edge.evidenceLabel === 'inferred')).toBe(true);
    expect(scan.graph.nodes.some((node: any) => node.kind === 'accessibility-finding')).toBe(true);
    const control=scan.graph.nodes.find((node:any)=>node.kind==='control'&&node.label==='Continue to payment');
    const journey=traceJourney(scan.graph,control.id)!;
    expect(journey.steps.map(step=>step.node.kind)).toEqual(['page','control','flow','page']);
    expect(journey.findings.some(node=>node.kind==='runtime-error'&&node.label.includes('simulated payment gateway timeout'))).toBe(true);
    expect(journey.summary).toContain('do not prove the click fails');
    expect(scan.pages.flatMap((page:any)=>page.controls).filter((node:any)=>node.role==='email'||node.role==='text').every((node:any)=>!node.formAction)).toBe(true);
    const archive = await fetch(`${baseUrl}/api/scans/${scanId}/export/obsidian`);
    expect(archive.status).toBe(200);
    expect(archive.headers.get('content-type')).toContain('application/zip');

    const rescanStart = await fetch(`${baseUrl}/api/scans/${scanId}/rescan`, { method: 'POST' });
    expect(rescanStart.status).toBe(202);
    const { scanId: rescanId } = await rescanStart.json() as { scanId: string };
    let rescan: any;
    for (let attempt = 0; attempt < 100; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      rescan = await (await fetch(`${baseUrl}/api/scans/${rescanId}`)).json();
      if (['complete', 'partial', 'failed'].includes(rescan.status)) break;
    }
    expect(rescan.status).not.toBe('failed');
    const comparison = await fetch(`${baseUrl}/api/scans/${rescanId}/compare/${scanId}`);
    expect(comparison.status).toBe(200);
    const diff = await comparison.json() as { remaining: unknown[] };
    expect(diff.remaining.length).toBeGreaterThan(0);
  }, 90_000);
});
