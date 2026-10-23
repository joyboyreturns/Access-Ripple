#!/usr/bin/env node
/**
 * Records the demo as separate, trimmed 1080p clips, driven by a real browser,
 * so a video can be assembled from them without anyone recording the screen.
 *
 * Start the app first with `npm run dev` (put a Vercel AI Gateway key in `.env`
 * to record the model beats), then run `npm run record`. Clips land in
 * `recordings/`. Pass clip names to record only those: `npm run record -- 06 07`.
 *
 * Every clip is a real run: the scan, the model's proposal and prediction, the
 * rescan and the proof are not staged. A clip that needs the model is recorded
 * again when the model is busy, and a run that fell back to the demo shop's
 * prepared fix is not kept as the "model" clip.
 *
 * MP4 conversion needs ffmpeg (set FFMPEG, or have it on the PATH). Without it
 * the raw .webm files are kept.
 */
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const STUDIO = process.env.ACCESSRIPPLE_STUDIO ?? 'http://127.0.0.1:5173';
const API = process.env.ACCESSRIPPLE_API ?? 'http://127.0.0.1:4317';
const OUT = resolve('recordings');
const RAW = join(OUT, '.raw');
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const VIEWPORT = { width: 1440, height: 810 };

mkdirSync(RAW, { recursive: true });
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
const only = process.argv.slice(2).filter((arg) => /^\d+$/.test(arg));

let haveFfmpeg = true;
try { execFileSync(FFMPEG, ['-version'], { stdio: 'ignore' }); } catch { haveFfmpeg = false; }

const post = (path, body = {}) => fetch(API + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const resetShop = async () => { await post('/api/sample/reset'); await post('/api/sample/state', { variant: 'before' }); };
const aiConfigured = async () => (await (await fetch(API + '/api/ai/status')).json()).configured;

// Playwright videos have no mouse pointer, so one is drawn into the page.
const POINTER = `(() => {
  const make = () => {
    if (document.getElementById('__pointer')) return;
    const dot = document.createElement('div');
    dot.id = '__pointer';
    dot.style.cssText = 'position:fixed;left:0;top:0;width:22px;height:22px;margin:-3px 0 0 -3px;border-radius:50%;background:rgba(255,255,255,.92);border:2px solid #0b0d10;box-shadow:0 2px 10px rgba(0,0,0,.45);pointer-events:none;z-index:2147483647;transition:transform .04s linear,scale .12s ease;';
    document.documentElement.appendChild(dot);
    document.addEventListener('mousemove', (event) => { dot.style.transform = 'translate(' + event.clientX + 'px,' + event.clientY + 'px)'; }, true);
    document.addEventListener('mousedown', () => { dot.style.scale = '.7'; }, true);
    document.addEventListener('mouseup', () => { dot.style.scale = '1'; }, true);
  };
  if (document.documentElement) make(); else document.addEventListener('DOMContentLoaded', make);
  new MutationObserver(make).observe(document, { childList: true });
})();`;

/** Move the pointer to the middle of an element, the way a person would. */
async function glide(page, locator, steps = 28) {
  await locator.first().scrollIntoViewIfNeeded({ timeout: 8000 }).catch(() => undefined);
  const box = await locator.first().boundingBox();
  if (!box) throw new Error('nothing to point at');
  await page.mouse.move(box.x + box.width / 2, box.y + Math.min(box.height / 2, 40), { steps });
}
async function press(page, locator) {
  await glide(page, locator);
  await wait(350);
  await page.mouse.down();
  await wait(90);
  await page.mouse.up();
}

/** Record one clip. `body` calls mark() at the moment the clip should begin. */
async function record(id, name, body, { pointer = true } = {}) {
  if (only.length && !only.includes(id)) return null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const browser = await chromium.launch();
    const context = await browser.newContext({ viewport: VIEWPORT, recordVideo: { dir: RAW, size: VIEWPORT } });
    if (pointer) await context.addInitScript(POINTER);
    const page = await context.newPage();
    const began = Date.now();
    let start = 0;
    const mark = () => { start = (Date.now() - began) / 1000; };
    let failure = null;
    try { await body(page, mark); } catch (error) { failure = error; }
    const length = (Date.now() - began) / 1000;
    const raw = await page.video().path();
    await context.close();
    await browser.close();
    if (failure) {
      console.log(`  attempt ${attempt} of "${name}" did not work: ${String(failure.message).split('\n')[0]}`);
      rmSync(raw, { force: true });
      await resetShop();
      continue;
    }
    const target = join(OUT, `${id}-${name}.${haveFfmpeg ? 'mp4' : 'webm'}`);
    const from = Math.max(0, start - 0.15);
    if (haveFfmpeg) {
      execFileSync(FFMPEG, ['-y', '-v', 'error', '-ss', String(from), '-i', raw, '-t', String(length - from), '-vf', 'scale=1920:1080:flags=lanczos,fps=30', '-c:v', 'libx264', '-crf', '16', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', target]);
      rmSync(raw, { force: true });
    } else renameSync(raw, target);
    const seconds = Math.round((length - from) * 10) / 10;
    console.log(`  saved ${target.replace(process.cwd() + '/', '')}  (${seconds} s)`);
    return { id, name, seconds };
  }
  console.log(`  GAVE UP on "${name}" after 3 attempts`);
  return null;
}

const ready = (page, hash) => page.goto(`${STUDIO}/${hash}`, { waitUntil: 'domcontentloaded' });
const scanButton = (page) => page.locator('button:has-text("Scan the demo shop")');
async function demoResult(page) {
  await ready(page, '#demo');
  await page.waitForSelector('.result-summary', { timeout: 90000 });
  await wait(2800);
}

const made = [];
const add = (entry) => { if (entry) made.push(entry); };

console.log('Recording clips into recordings/ ...');
const model = await aiConfigured();
if (!model) console.log('  (no model key: clips 06 and 07 will show the demo shop\'s prepared fix and say so)');

await resetShop();

add(await record('01', 'landing', async (page, mark) => {
  await ready(page, '');
  await page.waitForSelector('.hero-copy h1', { timeout: 20000 });
  await wait(900);
  mark();
  await wait(2200);
  await glide(page, page.locator('.hero-copy h1'));
  await wait(2200);
  await glide(page, page.locator('button:has-text("See it in 60 seconds")'));
  await wait(2600);
}));

await resetShop();
add(await record('02', 'scan-the-demo-shop', async (page, mark) => {
  await ready(page, '#studio');
  await scanButton(page).waitFor({ timeout: 20000 });
  await wait(1200);
  mark();
  await wait(800);
  await press(page, scanButton(page));
  await page.waitForSelector('.result-summary', { timeout: 90000 });
  await wait(6000);
}));

await resetShop();
add(await record('03', 'what-was-found', async (page, mark) => {
  await demoResult(page);
  mark();
  await wait(1000);
  await glide(page, page.locator('.first-look'));
  await wait(3200);
  await glide(page, page.locator('.inspector h2, .inspector h3').first());
  await wait(3000);
  await glide(page, page.locator('.inspector img').first());
  await wait(3600);
}));

await resetShop();
add(await record('04', 'the-ripple', async (page, mark) => {
  await demoResult(page);
  await page.locator('.first-look .story-link').click();
  await wait(1200);
  mark();
  await press(page, page.locator('button:has-text("See its ripple on the map")'));
  await wait(2500);
  await glide(page, page.locator('.ripple-card').first());
  await wait(5000);
}));

await resetShop();
add(await record('05', 'follow-a-journey', async (page, mark) => {
  await demoResult(page);
  await page.click('.category-button:has-text("Controls")');
  await wait(900);
  mark();
  await press(page, page.locator('#journey-control'));
  await wait(900);
  await page.keyboard.type('Continue to payment', { delay: 70 });
  await wait(900);
  await press(page, page.locator('[role="option"]').first());
  await wait(7000);
}));

await resetShop();
add(await record('06', 'model-proposes-predicts-rescan', async (page, mark) => {
  if (!model) throw new Error('no model configured');
  await demoResult(page);
  await page.locator('.first-look .story-link').click();
  await wait(1000);
  mark();
  await wait(900);
  await press(page, page.locator('.fix-propose .button-glass'));
  await page.waitForSelector('.fix-card, .fix-propose .ai-error', { timeout: 60000 });
  if (!(await page.$('.fix-card'))) throw new Error('the model did not answer');
  await wait(4500);
  await press(page, page.locator('button:has-text("Ask what this will fix")'));
  await page.waitForSelector('.fix-contract, .fix-card .ai-error', { timeout: 60000 });
  if (!(await page.$('.fix-contract'))) throw new Error('the model did not predict');
  await wait(5000);
  await press(page, page.locator('.fix-actions .button-solid'));
  await wait(1800);
  await press(page, page.locator('.repair-actions .button-solid'));
  await page.waitForSelector('.comparison', { timeout: 120000 });
  await wait(2500);
  await press(page, page.locator('button:has-text("See the page before and after")'));
  await page.waitForSelector('dialog.proof-dialog[open]', { timeout: 15000 });
  await wait(7000);
}));

await resetShop();
add(await record('07', 'one-press-walkthrough', async (page, mark) => {
  await ready(page, '#walkthrough');
  mark();
  await page.waitForSelector('dialog.proof-dialog[open]', { timeout: 240000 });
  const banner = (await page.textContent('.repair-banner').catch(() => '')) ?? '';
  if (model && !banner.includes('PROPOSED CHANGE')) throw new Error('the model step fell back to the prepared fix');
  await wait(8000);
}));

await resetShop();
add(await record('08', 'a-public-website', async (page, mark) => {
  // A live scan of a public page that is deliberately inaccessible (W3C's own
  // demonstration site), so the result is real and the site expects visitors.
  await ready(page, '#studio');
  await page.waitForSelector('#website-url', { timeout: 20000 });
  await wait(900);
  await press(page, page.locator('#website-url'));
  await page.keyboard.type('www.w3.org/WAI/demos/bad/before/home.html', { delay: 55 });
  await wait(600);
  await press(page, page.locator('button:has-text("Map this website")'));
  await page.waitForSelector('.result-summary', { timeout: 120000 });
  await wait(2800);
  mark();
  await wait(1200);
  await glide(page, page.locator('.first-look'));
  await wait(3500);
  await glide(page, page.locator('.inspector img').first());
  await wait(3500);
}));

// Animated diagrams, drawn from scripts/video/diagrams.html. They explain the
// idea between the real clips, and none of them shows a result.
const DIAGRAMS = pathToFileURL(resolve('scripts/video/diagrams.html')).href;
for (const [id, name, scene, seconds] of [
  ['09', 'title-card', 'title', 5],
  ['10', 'diagram-the-problem', 'problem', 11],
  ['11', 'diagram-how-it-works', 'pipeline', 14],
  ['12', 'diagram-three-kinds-of-repair', 'repairs', 11],
  ['13', 'diagram-what-it-never-claims', 'honesty', 11],
  ['14', 'end-card', 'end', 6],
]) {
  add(await record(id, name, async (page, mark) => {
    await page.goto(`${DIAGRAMS}?scene=${scene}`);
    await wait(200);
    mark();
    await wait(seconds * 1000);
  }, { pointer: false }));
}

await resetShop();
rmSync(RAW, { recursive: true, force: true });
if (!only.length) writeFileSync(join(OUT, 'shot-list.txt'), made.map((clip) => `${clip.id}-${clip.name}  ${clip.seconds} s`).join('\n') + '\n');
console.log(made.length ? `\nDone. ${made.length} clip${made.length === 1 ? '' : 's'} in recordings/` : '\nNo clip was recorded.');
if (!readdirSync(OUT).length) process.exitCode = 1;
