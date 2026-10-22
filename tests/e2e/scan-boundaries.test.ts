import { createServer, type Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { performScan } from '../../src/scan/worker.js';

const document = (body = '<h1>Example page</h1>') => `<!doctype html><html lang="en"><head><title>Example page</title><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><main>${body}</main></body></html>`;

async function listen(server: Server): Promise<string> {
  await new Promise<void>((resolve, reject) => server.listen(0, '127.0.0.1', resolve).once('error', reject));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test fixture address.');
  return `http://127.0.0.1:${address.port}`;
}

describe('real browser scan boundaries', () => {
  let source: Server;
  let destination: Server;
  let baseUrl: string;
  let outsideUrl: string;
  let outsideRequests = 0;

  beforeAll(async () => {
    destination = createServer((_request, response) => { outsideRequests += 1; response.end(document()); });
    outsideUrl = await listen(destination);
    source = createServer((request, response) => {
      if (request.url === '/redirect') { response.writeHead(302, { location: '/clear' }); response.end(); return; }
      if (request.url === '/outside') { response.writeHead(302, { location: `${outsideUrl}/private` }); response.end(); return; }
      if (request.url === '/timeout') return;
      if (request.url === '/refused') { response.writeHead(403, { 'content-type': 'text/html' }); response.end(document('<h1>Access denied</h1>')); return; }
      response.writeHead(200, { 'content-type': 'text/html', ...(request.url === '/csp' ? { 'content-security-policy': "default-src 'self'; script-src 'none'" } : {}) });
      if (request.url === '/unchecked') response.end(document('<h1>Example page</h1><script>window.axe.run=async()=>null</script>'));
      else if (request.url === '/javascript') response.end(document('<h1>Example page</h1><script>setTimeout(()=>{const img=document.createElement("img");img.src="/missing.svg";document.querySelector("main").append(img)},30)</script>'));
      else response.end(document());
    });
    baseUrl = await listen(source);
  });

  afterAll(async () => {
    for (const server of [source, destination]) {
      server?.closeAllConnections();
      if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  const scan = (path: string) => performScan({ id: `boundary-${path}`, url: `${baseUrl}${path}`, allowPrivateNetwork: true, onUpdate: () => {} });

  it('inspects a clear page without seeding findings', async () => {
    const result = await scan('/clear');
    expect(result.status).toBe('complete');
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0]?.findings.filter((finding) => finding.status === 'detected')).toEqual([]);
  }, 30_000);

  it('follows a same-origin redirect and records the actual destination', async () => {
    const result = await scan('/redirect');
    expect(result.status).toBe('complete');
    expect(result.pages[0]?.url).toBe(`${baseUrl}/clear`);
  }, 30_000);

  it('stops an outside-origin redirect before the destination receives it', async () => {
    const result = await scan('/outside');
    expect(result.pages[0]?.status).toBe('failed');
    expect(outsideRequests).toBe(0);
    expect(result.pages[0]?.findings).toEqual([]);
    expect(result.pages[0]?.errors.some((error) => error.message.includes('blocked before it was sent'))).toBe(true);
  }, 30_000);

  it('reports refusal without treating a challenge page as an inspected page', async () => {
    const result = await scan('/refused');
    expect(result.status).toBe('partial');
    expect(result.coverage?.pagesInspected).toBe(0);
    expect(result.pages[0]?.status).toBe('skipped');
    expect(result.graph?.nodes.find((node) => node.kind === 'page')?.status).toBe('untested');
  }, 30_000);

  it('runs checks under a strict content security policy', async () => {
    const result = await scan('/csp');
    expect(result.pages[0]?.status).toBe('complete');
    expect(result.pages[0]?.findings.some((finding) => finding.ruleId === 'accessibility-check-incomplete')).toBe(false);
  }, 30_000);

  it('finds a barrier inserted by JavaScript', async () => {
    const result = await scan('/javascript');
    expect(result.pages[0]?.findings.some((finding) => finding.ruleId === 'image-alt')).toBe(true);
  }, 30_000);

  it('records an unavailable checker as unknown instead of clear', async () => {
    const result = await scan('/unchecked');
    expect(result.pages[0]?.findings.some((finding) => finding.ruleId === 'accessibility-check-incomplete')).toBe(true);
    expect(result.graph?.nodes.find((node) => node.kind === 'page')?.status).toBe('needs-review');
  }, 30_000);

  it('returns a bounded failure when the page never responds', async () => {
    const result = await scan('/timeout');
    expect(result.status).toBe('partial');
    expect(result.coverage?.pagesFailed).toBe(1);
    expect(result.pages[0]?.findings).toEqual([]);
  }, 35_000);
});
