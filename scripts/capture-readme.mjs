#!/usr/bin/env node
/**
 * Captures the screenshots the README shows, from the running studio.
 *
 * Start the app first with `npm run dev`, then run `npm run capture:readme`.
 * The pictures land in docs/images/ and are taken at 1440 × 900, the frame
 * the demo video is recorded in. The proof picture needs a before/after pair
 * on this computer; `npm run check:studio` or `npm run prepare:demo` makes one.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const out = new URL('../docs/images/', import.meta.url);
await mkdir(out, { recursive: true });
const file = (name) => new URL(name, out).pathname;
const shot = { type: 'jpeg', quality: 88 };

for (const [path, body] of [['/api/sample/reset', '{}'], ['/api/sample/state', JSON.stringify({ variant: 'before' })]]) {
  const response = await fetch(`http://127.0.0.1:4317${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body });
  if (!response.ok) throw new Error(`could not reset the demo shop: ${path}. Is \`npm run dev\` running?`);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: 'dark' });

// 1. The landing page, once the hero has settled.
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.evaluate(() => { sessionStorage.clear(); localStorage.setItem('accessripple-theme', 'dark'); });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await page.screenshot({ ...shot, path: file('landing.jpg') });
console.log('landing.jpg');

// 2. The map of the demo shop, framed the way a finished scan scrolls itself.
await page.goto('http://127.0.0.1:5173/#demo', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.result-summary', { timeout: 90000 });
await page.waitForTimeout(2500);
await page.evaluate(() => document.querySelector('.result-summary')?.scrollIntoView({ block: 'start' }));
await page.waitForTimeout(1200);
await page.screenshot({ ...shot, path: file('map.jpg') });
console.log('map.jpg');

// 3. The ripple of the first barrier.
await page.click('button:has-text("See its ripple on the map")');
await page.waitForTimeout(1800);
await page.locator('.workspace').screenshot({ ...shot, path: file('ripple.jpg') });
console.log('ripple.jpg');
await page.click('button:has-text("Back to the whole map")');
await page.waitForTimeout(600);

// 4. A recorded journey: one control traced across the pages the browser reached.
await page.click('#journey-control');
await page.waitForTimeout(300);
const option = page.locator('[role="option"]', { hasText: 'Proceed to checkout' }).first();
if (await option.count()) await option.click(); else await page.locator('[role="option"]').first().click();
await page.waitForTimeout(2200);
await page.evaluate(() => document.querySelector('.workspace')?.scrollIntoView({ block: 'start' }));
await page.waitForTimeout(400);
await page.locator('.workspace').screenshot({ ...shot, path: file('journey.jpg') });
console.log('journey.jpg');

// 5. The proof: the same page before and after one change, with the model's predictions checked.
const proof = await (await fetch('http://127.0.0.1:4317/api/proof')).json().catch(() => null);
if (proof && !proof.error) {
  await page.click('button:has-text("Show the proof")');
  await page.waitForSelector('dialog.proof-dialog[open]', { timeout: 15000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ ...shot, path: file('proof.jpg') });
  console.log('proof.jpg');
} else {
  console.log('SKIP proof.jpg (no before/after pair yet: run `npm run check:studio` first)');
}

await browser.close();
