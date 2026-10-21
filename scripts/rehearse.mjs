#!/usr/bin/env node
/**
 * Rehearses the exact three-minute recording route in a real browser and
 * reports how long each beat takes, so the recording fits 180 seconds and
 * nothing is broken on the day.
 *
 * Start the app first with `npm run dev`, then run `npm run rehearse`.
 * The route is the one in `devpost/demo-script.md`.
 */
import { chromium } from 'playwright';

const STUDIO = process.env.ACCESSRIPPLE_STUDIO ?? 'http://127.0.0.1:5173';
const beat = [];
let mark = 0;

function record(name) {
  const now = Date.now();
  if (beat.length) beat.at(-1).ms = now - mark;
  beat.push({ name, ms: 0 });
  mark = now;
}
const seconds = (ms) => (ms / 1000).toFixed(1);

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const problems = [];
page.on('console', (m) => { if (m.type() === 'error' && !/422/.test(m.text())) problems.push('CONSOLE: ' + m.text()); });
page.on('pageerror', (e) => problems.push('PAGEERROR: ' + e.message));
page.on('requestfailed', (r) => { if (!/ripple-hero\.mp4/.test(r.url())) problems.push('REQFAIL: ' + r.url()); });

const check = (name, pass, detail = '') => console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' :: ' + detail : ''}`);
const text = (selector) => page.evaluate((s) => document.querySelector(s)?.textContent?.trim() ?? null, selector);

try {
  // --- 0:00 the landing page ---
  record('Landing page');
  await page.goto(STUDIO + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.hero-copy h1', { timeout: 20000 });
  check('the landing page loads', Boolean(await text('.hero-copy h1')));
  check('it states the argument', (await text('.hero-position'))?.includes('how someone reaches it') ?? false);
  check('it offers the one-click demo', Boolean(await page.$('button:has-text("See it in 60 seconds")')));

  // --- 0:12 type a URL, then cut ---
  record('Type a URL');
  await page.click('button:has-text("Explore your website")');
  await page.waitForSelector('#website-url', { timeout: 10000 });
  await page.evaluate(() => {
    const input = document.querySelector('#website-url');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, 'developer.mozilla.org');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  check('a bare domain is accepted', (await page.evaluate(() => document.querySelector('#website-url')?.value)) === 'developer.mozilla.org');
  await page.click('button:has-text("Map this website")');
  await page.waitForSelector('.scan-progress', { timeout: 10000 });
  check('the scan shows a bounded wait', (await text('.scan-progress'))?.includes('left') ?? false, (await text('.scan-progress'))?.replace(/\n/g, ' | '));

  // --- 0:30 cut to a prepared result ---
  record('Cut to the result');
  await page.goto(STUDIO + '/#studio', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  await page.click('button:has-text("Recent scans")');
  await page.waitForSelector('.history-list button', { timeout: 10000 });
  const saved = await page.evaluate(() => [...document.querySelectorAll('.history-list button')].map((b) => b.innerText.replace(/\n/g, ' | ')));
  check('prepared scans are in the history', saved.length > 0, `${saved.length} sites`);
  const mdn = await page.evaluate(() => {
    const row = [...document.querySelectorAll('.history-list button')].find((b) => /mozilla/i.test(b.textContent ?? ''));
    if (row) { row.click(); return true; }
    return false;
  });
  if (mdn) {
    await page.waitForSelector('.result-summary', { timeout: 60000 });
    await page.waitForTimeout(1200);
    check('a public-site scan opens', (await text('.result-site h2'))?.includes('mozilla') ?? false, await text('.result-site h2'));
    check('it is labelled as a public site', (await text('.result-site .eyebrow'))?.includes('PUBLIC SITE') ?? false, await text('.result-site .eyebrow'));
    check('the story is one paragraph', (await text('.scan-story .story-headline'))?.length > 40 ?? false);
  } else {
    check('a public-site scan is available', false, 'no Mozilla scan in the history');
  }

  // --- 0:58 the map and a journey ---
  record('The map and a journey');
  await page.click('.category-button:has-text("Controls")');
  await page.waitForTimeout(500);
  await page.click('#journey-control');
  await page.waitForTimeout(400);
  await page.keyboard.type('a');
  await page.waitForTimeout(600);
  const option = await page.evaluate(() => { const o = document.querySelector('[role="option"]'); if (o) { o.click(); return o.textContent?.slice(0, 30); } return null; });
  await page.waitForTimeout(1500);
  check('a journey can be followed', Boolean(option), option ?? '');
  check('the route is drawn', (await text('.map-coverage'))?.includes('travelling pulse') ?? false);

  // --- 1:18 a proposed change ---
  record('A proposed change');
  await page.click('.category-button:has-text("Findings")');
  await page.waitForTimeout(400);
  await page.click('.segmented button:has-text("List")');
  await page.waitForTimeout(400);
  await page.evaluate(() => { const rows = [...document.querySelectorAll('.inventory-row')]; (rows.find((r) => /Accessibility/i.test(r.textContent ?? '')) ?? rows.find((r) => /image|alternative|contrast/i.test(r.textContent ?? '')) ?? rows[0])?.click(); });
  await page.waitForTimeout(500);
  const hasNext = await page.evaluate(() => Boolean(document.querySelector('.what-next')));
  check('the finding says what to do next', hasNext);
  const canPropose = await page.evaluate(() => Boolean(document.querySelector('.fix-propose .button-glass')));
  if (canPropose) {
    await page.click('.fix-propose .button-glass');
    await page.waitForSelector('.fix-card', { timeout: 60000 });
    const before = await text('.fix-line.before code');
    const after = await text('.fix-line.after code');
    check('a change is proposed', Boolean(before && after), `${(before ?? '').slice(0, 34)} -> ${(after ?? '').slice(0, 34)}`);
    check('it says it is a suggestion, not a fix', (await text('.fix-honest'))?.includes('not a verified fix') ?? false);
  } else {
    console.log('SKIP  a proposed change (no model configured)');
  }

  // --- 1:36 the proof ---
  record('The proof');
  await page.click('button:has-text("Show the proof")');
  await page.waitForSelector('.proof-view', { timeout: 20000 });
  await page.waitForTimeout(600);
  check('the proof leads with the counts', (await text('.proof-head h2'))?.includes('no longer observed') ?? false, await text('.proof-head h2'));
  check('it is labelled as the controlled demo shop', (await text('.proof-head .eyebrow'))?.includes('DEMO SHOP') ?? false, await text('.proof-head .eyebrow'));
  const shots = await page.evaluate(() => [...document.querySelectorAll('.proof-shots img')].map((i) => i.naturalWidth));
  check('the page before and after is shown', shots.length === 2 && shots.every((w) => w > 0), shots.join('x'));
  await page.click('.proof-head .icon-btn');
  await page.waitForTimeout(300);

  // --- 1:48 the coverage ---
  record('The coverage');
  await page.click('.coverage-details summary');
  await page.waitForTimeout(300);
  const coverage = await text('.coverage-details');
  check('coverage says what was left out', (coverage?.includes('not activated') ?? false) || (coverage?.includes('not tested') ?? false));

  // --- 2:14 the export ---
  record('The export');
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('button:has-text("Export vault")')]);
  check('the vault downloads', Boolean(download.suggestedFilename()), download.suggestedFilename());
} catch (error) {
  console.log('FAIL  the rehearsal stopped ::', error instanceof Error ? error.message.slice(0, 160) : String(error));
} finally {
  const total = Date.now() - mark;
  if (beat.length) beat.at(-1).ms = total;
  console.log('\n=== BEAT TIMINGS ===');
  for (const b of beat) console.log(`  ${seconds(b.ms).padStart(5)}s  ${b.name}`);
  const sum = beat.reduce((a, b) => a + b.ms, 0);
  console.log(`  ${seconds(sum).padStart(5)}s  total on screen (the rest is narration and the cut)`);
  console.log('\nproblems:', problems.length ? problems : 'none');
  await browser.close();
}
