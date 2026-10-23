import { createServer, type Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { performScan } from '../../src/scan/worker.js';

const shell = (body: string) => `<!doctype html><html lang="en"><head><title>Keys</title><style>.bare:focus{outline:none}</style></head><body><main><h1>Keys</h1>${body}</main></body></html>`;
// Two buttons that send Tab back to each other, on a page with more to reach.
const trap = shell(`<a href="/a">First</a><div id="box"><button id="one">One</button><button id="two">Two</button></div><a href="/b">Last</a>
<script>for (const id of ['one','two']) document.getElementById(id).addEventListener('keydown', (event) => { if (event.key === 'Tab') { event.preventDefault(); document.getElementById(id === 'one' ? 'two' : 'one').focus(); } });
document.querySelector('a').addEventListener('keydown', (event) => { if (event.key === 'Tab' && !event.shiftKey) { event.preventDefault(); document.getElementById('one').focus(); } });</script>`);
const clear = shell('<a href="/a">First</a><a class="bare" href="/b">No ring</a><a href="/c">Third</a>');

describe('the keyboard probe', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    server = createServer((request, response) => { response.writeHead(200, { 'content-type': 'text/html' }); response.end(request.url === '/trap' ? trap : clear); });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No address.');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const scan = (path: string) => performScan({ id: `keys-${path}`, url: `${baseUrl}${path}`, allowPrivateNetwork: true, interactionMode: 'safe', onUpdate: () => {} });

  it('flags focus that cannot leave two elements, for a person to confirm', async () => {
    const result = await scan('/trap');
    const trapFinding = result.pages[0]!.findings.find((finding) => finding.ruleId === 'keyboard-trap');
    expect(trapFinding).toMatchObject({ status: 'needs-review', impact: 'critical', tags: ['wcag212'] });
    expect(trapFinding?.targets[0]).toMatch(/#one|#two/);
  }, 60_000);

  it('flags an element whose focus looks no different, and not the ones with a ring', async () => {
    const result = await scan('/clear');
    const invisible = result.pages[0]!.findings.filter((finding) => finding.ruleId === 'focus-not-visible');
    expect(invisible).toHaveLength(1);
    expect(invisible[0]!.snippet).toContain('No ring');
    expect(invisible[0]!.boundingBox?.width).toBeGreaterThan(0);
    expect(result.pages[0]!.findings.some((finding) => finding.ruleId === 'keyboard-trap')).toBe(false);
  }, 60_000);
});
