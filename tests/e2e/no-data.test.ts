import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer } from 'node:net';
import { buildApp } from '../../src/api/app.js';
import { applyPatch, clearPatches } from '../../src/sample/sandbox.js';
import { scanStore } from '../../src/store/memory.js';

/**
 * The scanner promises that it never sends data. A page that tries to post
 * something of its own accord must not be able to.
 *
 * The built-in demo shop is used because it is the one origin the scanner is
 * allowed to visit, and the page is patched in memory to post on load.
 */
describe('the scanner never sends data', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let baseUrl: string;
  let received: string[] = [];

  beforeAll(async () => {
    received = [];
    // The scanner visits the scanner's own address, so that address has to be
    // known before the app is built.
    const reservation = createServer();
    await new Promise<void>((resolve, reject) => reservation.listen(0, '127.0.0.1', resolve).once('error', reject));
    const reserved = reservation.address();
    const port = typeof reserved === 'object' && reserved ? reserved.port : 0;
    await new Promise<void>((resolve, reject) => reservation.close((error) => error ? reject(error) : resolve()));
    baseUrl = `http://127.0.0.1:${port}`;
    app = await buildApp({ baseUrl });
    // A route that counts anything that reaches it.
    app.post('/sample/collect', async (_request, reply) => {
      received.push('/sample/collect');
      return reply.code(200).type('text/html').send('<p>collected</p>');
    });
    await app.listen({ host: '127.0.0.1', port });
    // The page posts to itself as soon as it loads.
    applyPatch(
      'src/sample/site/checkout.html',
      '<img class="product-art" src="/sample/missing-product.webp">',
      '<img class="product-art" src="/sample/missing-product.webp"><script>fetch("/sample/collect",{method:"POST",body:"x"}).catch(function(){});</script>',
      'A page that posts on load.',
    );
  }, 30_000);

  afterAll(async () => {
    clearPatches();
    await app?.close();
    scanStore.clear();
  });

  it('blocks the data-changing requests a page tries to send', async () => {
    const created = await app.inject({ method: 'POST', url: '/api/scans', payload: { sample: 'checkout' } });
    expect(created.statusCode).toBe(202);
    const scanId = created.json().scanId as string;
    for (let attempt = 0; attempt < 160; attempt += 1) {
      const state = await app.inject({ method: 'GET', url: `/api/scans/${scanId}` });
      if (['complete', 'partial', 'failed'].includes(state.json().status)) break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    const scan = await app.inject({ method: 'GET', url: `/api/scans/${scanId}` });
    expect(scan.json().status).toBe('complete');
    // The page was read, but nothing was sent on its behalf.
    expect(received).toEqual([]);
    // And the block is recorded rather than hidden.
    const pages = scan.json().pages as Array<{ errors: Array<{ message: string }> }>;
    const messages = pages.flatMap((entry) => entry.errors.map((error) => error.message));
    expect(messages.some((message) => /Blocked a POST request/.test(message))).toBe(true);
  }, 180_000);
});
