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

  async function waitForScan(scanId: string): Promise<any> {
    let scan: any;
    for (let attempt = 0; attempt < 200; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      scan = await (await fetch(`${baseUrl}/api/scans/${scanId}`)).json();
      if (['complete', 'partial', 'failed'].includes(scan.status)) return scan;
    }
    return scan;
  }

  it('tests safe actions in safe mode, records real outcomes, and exports a vault', async () => {
    const start = await fetch(`${baseUrl}/api/scans`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sample: 'checkout' }) });
    expect(start.status).toBe(202);
    const { scanId } = await start.json() as { scanId: string };
    const scan = await waitForScan(scanId);
    expect(scan.status).not.toBe('failed');
    expect(scan.pages.some((page: any) => page.url.endsWith('/sample/checkout'))).toBe(true);
    expect(scan.pages.some((page: any) => page.url.endsWith('/sample/payment'))).toBe(true);
    // The cart is only reachable through the script-driven reveal and its observed follow-up click.
    expect(scan.pages.some((page: any) => page.url.endsWith('/sample/cart'))).toBe(true);
    expect(scan.interactionPolicy.mode).toBe('safe');
    expect(scan.interactionPolicy.tested).toBeGreaterThan(0);
    expect(scan.interactionPolicy.skipped).toBeGreaterThan(0);

    // Observed outcomes replace inference for activated controls.
    expect(scan.graph.nodes.some((node: any) => node.kind === 'flow' && node.evidenceLabel === 'observed' && node.data.outcome === 'navigated')).toBe(true);
    const promo = scan.graph.nodes.find((node: any) => node.kind === 'control' && node.label === 'Apply promo code');
    expect(promo.data.interaction).toMatchObject({ tested: true, outcome: 'content-changed' });

    // JavaScript-driven flow: "Add to cart" reveals the cart link, then a follow-up click navigates to it.
    const addToCart = scan.graph.nodes.find((node: any) => node.kind === 'control' && node.label === 'Add to cart');
    expect(addToCart.data.interaction).toMatchObject({ tested: true, outcome: 'navigated' });
    const addFlow = scan.graph.nodes.find((node: any) => node.kind === 'flow' && node.data.sourceControlId === addToCart.id && node.data.tested === true);
    expect(addFlow.data.steps).toHaveLength(2);
    expect(addFlow.data.steps[0].outcome).toBe('content-changed');
    expect(addFlow.data.steps[1].outcome).toBe('navigated');

    // Submit controls wait for permission; consequential controls are never activated.
    const check = scan.graph.nodes.find((node: any) => node.kind === 'control' && node.label === 'Check details');
    expect(check.data.interaction).toMatchObject({ tested: false, reason: 'requires-authorization' });
    const remove = scan.graph.nodes.find((node: any) => node.kind === 'control' && node.label === 'Remove item');
    expect(remove.data.interaction).toMatchObject({ tested: false, reason: 'consequential-action' });
    expect(scan.pages.flatMap((page: any) => page.controls).filter((node: any) => node.role === 'email' || node.role === 'text').every((node: any) => !node.formAction)).toBe(true);

    // Error attribution: the simulated gateway timeout is tied to the action that navigated there.
    const gateway = scan.graph.nodes.find((node: any) => node.kind === 'runtime-error' && node.label.includes('simulated payment gateway timeout'));
    expect(gateway).toBeDefined();
    expect(scan.graph.edges.some((edge: any) => edge.kind === 'failed-at' && edge.evidenceLabel === 'observed' && edge.target === gateway.id)).toBe(true);
    expect(scan.graph.nodes.some((node: any) => node.kind === 'accessibility-finding')).toBe(true);

    // Journeys keep observed and untested steps apart.
    const continueControl = scan.graph.nodes.find((node: any) => node.kind === 'control' && node.label === 'Continue to payment');
    const journey = traceJourney(scan.graph, continueControl.id)!;
    expect(journey.observed).toBe(true);
    expect(journey.steps.slice(0, 4).map((step) => step.node.kind)).toEqual(['page', 'control', 'flow', 'page']);
    expect(journey.findings.some((item) => item.node.id === gateway.id && item.caption.includes('while this action ran'))).toBe(true);
    expect(journey.summary).toContain('activated once');
    const cartJourney = traceJourney(scan.graph, addToCart.id)!;
    expect(cartJourney.observed).toBe(true);
    expect(cartJourney.steps.some((step) => step.node.kind === 'page' && String(step.node.data.url ?? '').endsWith('/sample/cart'))).toBe(true);

    const archive = await fetch(`${baseUrl}/api/scans/${scanId}/export/obsidian`);
    expect(archive.status).toBe(200);
    expect(archive.headers.get('content-type')).toContain('application/zip');
  }, 120_000);

  it('activates submit controls only after explicit authorization and records validation', async () => {
    const start = await fetch(`${baseUrl}/api/scans`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sample: 'checkout', authorizeSubmit: true }) });
    expect(start.status).toBe(202);
    const { scanId } = await start.json() as { scanId: string };
    const scan = await waitForScan(scanId);
    expect(scan.status).not.toBe('failed');
    expect(scan.interactionPolicy.mode).toBe('include-submits');
    const check = scan.graph.nodes.find((node: any) => node.kind === 'control' && node.label === 'Check details');
    const checkFlow = scan.graph.nodes.find((node: any) => node.kind === 'flow' && node.data.tested === true && node.data.sourceControlId === check.id);
    expect(checkFlow).toBeDefined();
    expect(checkFlow.data.outcome).toBe('validation-shown');
    expect(checkFlow.data.summary).toContain('stopped at form validation');

    // Rescanning in safe mode keeps the safe policy and still compares both graphs.
    const safeRescan = await fetch(`${baseUrl}/api/scans/${scanId}/rescan`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ authorizeSubmit: false }) });
    expect(safeRescan.status).toBe(202);
    const { scanId: safeId } = await safeRescan.json() as { scanId: string };
    const safeScan = await waitForScan(safeId);
    expect(safeScan.interactionPolicy.mode).toBe('safe');
    const comparison = await fetch(`${baseUrl}/api/scans/${safeId}/compare/${scanId}`);
    expect(comparison.status).toBe(200);
    const diff = await comparison.json() as { remaining: unknown[] };
    expect(diff.remaining.length).toBeGreaterThan(0);
  }, 120_000);
});
