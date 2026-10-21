#!/usr/bin/env node
/**
 * Prepares this computer for the recording.
 *
 * Clears the saved history, then scans the sites the demo uses and the demo
 * shop pair that proves a repair. The shop is left broken, so the recording
 * can show the repair happening rather than a shop that is already fixed.
 *
 * Run it the morning of the recording: `npm run prepare:demo`.
 */
import { readdirSync, rmSync, mkdirSync } from 'node:fs';

const API = process.env.ACCESSRIPPLE_API ?? 'http://127.0.0.1:4317';
const DATA = '.data/scans';

const SITES = [
  'https://developer.mozilla.org',
  'https://news.ycombinator.com',
  'https://www.w3.org',
  'https://www.google.com',
  'https://github.com',
];

const wait = async (scanId) => {
  for (let attempt = 0; attempt < 240; attempt += 1) {
    const scan = await (await fetch(`${API}/api/scans/${scanId}`)).json();
    if (['complete', 'partial', 'failed'].includes(scan.status)) return scan;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return { status: 'timeout' };
};
const start = async (body) => (await fetch(`${API}/api/scans`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json();
const setState = async (variant) => fetch(`${API}/api/sample/state`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ variant }) });

// A clean history, so the recorded Recent scans list shows only what matters.
try {
  mkdirSync(DATA, { recursive: true });
  for (const file of readdirSync(DATA)) rmSync(`${DATA}/${file}`, { force: true });
  console.log('cleared the saved history');
} catch { /* There is nothing to clear. */ }

// Reset the demo shop and drop any applied change.
await fetch(`${API}/api/sample/reset`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
await setState('before');

// The demo shop, broken, then repaired, so the proof has a pair to compare.
const broken = await start({ sample: 'checkout' });
await wait(broken.scanId);
console.log('demo shop scanned in its broken state');
await setState('after');
// A rescan, not a fresh scan, so the two are linked and the proof can compare them.
const repaired = await (await fetch(`${API}/api/scans/${broken.scanId}/rescan`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).json();
await wait(repaired.scanId);
console.log('demo shop scanned in its repaired state, which is the pair the proof needs');
await setState('before');
console.log('the demo shop is back in its broken state for the recording');

// The public sites.
for (const url of SITES) {
  const scan = await start({ url });
  const result = await wait(scan.scanId);
  const findings = (result.graph?.nodes ?? []).filter((node) => node.kind === 'accessibility-finding' && node.data.ruleId !== 'accessibility-check-incomplete').length;
  console.log(`${url.padEnd(34)} ${result.status} ${result.pages?.length ?? 0} pages, ${findings} findings`);
}

console.log('\nReady. Open Recent scans to see the prepared sites.');
