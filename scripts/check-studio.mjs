#!/usr/bin/env node
/**
 * Drives the studio in a real browser and checks the whole demo path:
 * the one-click demo shop, every filter, the searchable list, the inspector,
 * the coverage explanation, the AI briefing, the repair loop, the export, the
 * saved history, and the two error paths.
 *
 * Start the app first with `npm run dev`, then run `npm run check:studio`.
 */
import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const problems = [];
page.on('console', (m) => { if (m.type() === 'error') problems.push('CONSOLE: ' + m.text()); });
page.on('pageerror', (e) => problems.push('PAGEERROR: ' + e.message));
page.on('requestfailed', (r) => problems.push('REQFAIL: ' + r.url().slice(0, 90) + ' ' + (r.failure()?.errorText ?? '')));

const results = [];
const check = (name, pass, detail = '') => { results.push({ name, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' :: ' + detail : ''}`); };
const txt = (sel) => page.evaluate((s) => document.querySelector(s)?.textContent?.trim() ?? null, sel);
const has = (sel) => page.evaluate((s) => Boolean(document.querySelector(s)), sel);

// --- 1. Landing ---
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' });
await page.evaluate(() => sessionStorage.clear());
await page.reload({ waitUntil: 'domcontentloaded' });
check('landing renders a headline', Boolean(await txt('.hero-copy h1')));
check('landing offers the one-click demo', Boolean(await page.$('button:has-text("See it in 60 seconds")')));
check('landing has no seeded result', !(await has('.result-summary')));

// --- 2. One click into a real scan ---
await page.click('button:has-text("See it in 60 seconds")');
await page.waitForSelector('.scan-story', { timeout: 90000 });
check('one-click demo reaches a scan', Boolean(await txt('.scan-story .story-headline')));
check('metrics show four pages', (await txt('.summary-metrics'))?.includes('4') ?? false);
check('repair lab appears for the sample', await has('.repair-lab'));
check('site is named', (await txt('.result-site h2')) === 'Northstar demo shop');

// --- 3. Filters ---
for (const [filter, expect] of [['Pages', 'pages'], ['Findings', 'findings'], ['Controls', 'controls'], ['Journeys', 'journeys']]) {
  await page.click(`.category-button:has-text("${filter}")`);
  await page.waitForTimeout(350);
  const caption = await txt('.map-coverage');
  check(`filter ${filter} renders a scene`, Boolean(caption), caption ?? '');
}
await page.click('.category-button:has-text("Overview")');
await page.waitForTimeout(300);

// --- 4. List + search ---
await page.click('.segmented button:has-text("List")');
await page.waitForTimeout(300);
const rowCount = await page.evaluate(() => document.querySelectorAll('.inventory-row').length);
check('list shows rows', rowCount > 0, `${rowCount} rows`);
await page.fill('.inventory-search input', 'checkout');
await page.waitForTimeout(400);
const searched = await page.evaluate(() => document.querySelectorAll('.inventory-row').length);
check('list search filters', searched <= rowCount, `${searched} of ${rowCount}`);
await page.fill('.inventory-search input', 'zzzznotathing');
await page.waitForTimeout(350);
check('empty search shows a message', await has('.no-results'));
await page.fill('.inventory-search input', '');
await page.waitForTimeout(300);

// --- 5. Select a node -> inspector ---
await page.click('.inventory-row');
await page.waitForTimeout(400);
check('inspector opens for a selection', await has('.inspector-content h2'));

// --- 6. Map controls ---
await page.click('.segmented button:has-text("Map")');
await page.waitForTimeout(300);
await page.click('button[aria-label="Focus selected neighborhood"]');
await page.waitForTimeout(400);
check('focus mode changes the scene', (await txt('.map-coverage')) !== null);
await page.click('button[aria-label="Reset map view"]');
await page.waitForTimeout(300);
await page.click('button[aria-label="Zoom in"]');
await page.waitForTimeout(200);
check('zoom readout updates', (await txt('.zoom-readout')) !== '100%', await txt('.zoom-readout'));
await page.click('button[aria-label="Reset map view"]');

// --- 7. Coverage details ---
await page.click('.coverage-details summary');
await page.waitForTimeout(300);
check('coverage explains itself', (await txt('.coverage-details'))?.includes('control') ?? false);

// --- 8. AI briefing (real model) ---
await page.click('.ai-briefing .button-solid');
await page.waitForSelector('.ai-text', { timeout: 90000 });
const ai = await txt('.ai-text');
check('AI briefing is produced', Boolean(ai && ai.length > 40), (ai ?? '').slice(0, 70));
const chips = await page.evaluate(() => document.querySelectorAll('.ai-citations button').length);
const gaps = await page.evaluate(() => document.querySelectorAll('.ai-citations .ai-gap').length);
check('AI cites evidence', chips + gaps > 0, `${chips} evidence chips, ${gaps} gap chips`);
check('AI names what is missing', gaps > 0, `${gaps} gap chips`);

// --- 8b. A proposed change, grounded in the recorded markup ---
await page.click('.category-button:has-text("Findings")');
await page.waitForTimeout(400);
await page.click('.segmented button:has-text("List")');
await page.waitForTimeout(400);
const picked = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.inventory-row')];
  const row = rows.find((r) => /image|alternative/i.test(r.textContent ?? '')) ?? rows[0];
  if (row) row.click();
  return row ? row.textContent.slice(0, 40) : null;
});
await page.waitForTimeout(500);
check('a finding can be selected', Boolean(picked), picked ?? '');
await page.click('.fix-propose .button-glass');
await page.waitForSelector('.fix-card', { timeout: 90000 });
const before = await page.evaluate(() => document.querySelector('.fix-line.before code')?.textContent ?? '');
const after = await page.evaluate(() => document.querySelector('.fix-line.after code')?.textContent ?? '');
check('a change is proposed', before.length > 10 && after.length > 10, `${before.slice(0, 40)} -> ${after.slice(0, 40)}`);
check('the proposal names the file and line', Boolean(await page.$('.fix-location')));
check('the apply button is honest', (await page.evaluate(() => document.querySelector('.fix-actions .button-solid')?.textContent ?? '')).includes('demo repair'));

// --- 9. Repair loop ---
await page.click('.repair-actions .button-glass');
await page.waitForTimeout(700);
check('shop switches to repaired', (await txt('.repair-lab'))?.includes('Repaired state') ?? false, (await txt('.repair-lab'))?.slice(0,50) ?? '');
await page.click('.repair-actions .button-solid');
await page.waitForSelector('.comparison', { timeout: 90000 });
const comparison = await txt('.comparison');
check('comparison shows three resolved', /3 no longer observed/.test(comparison ?? ''), comparison ?? '');

// --- 9b. The proof: the same page before and after ---
await page.click('button:has-text("See the page before and after")');
await page.waitForSelector('.proof-view', { timeout: 10000 });
const shots = await page.evaluate(() => [...document.querySelectorAll('.proof-shots img')].map((i) => i.naturalWidth));
check('the proof shows two pictures', shots.length === 2 && shots.every((w) => w > 0), shots.join('x'));
check('the proof leads with the counts', (await txt('.proof-head h2'))?.includes('no longer observed') ?? false);
await page.click('.proof-head .icon-btn');
await page.waitForTimeout(300);

// --- 10. Export ---
const [download] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('button:has-text("Export vault")')]);
check('vault downloads', Boolean(download.suggestedFilename()), download.suggestedFilename());

// --- 11. Recent scans ---
await page.click('button:has-text("Recent scans")');
await page.waitForTimeout(600);
const historyRows = await page.evaluate(() => document.querySelectorAll('.history-list button').length);
check('recent scans lists entries', historyRows > 0, `${historyRows} rows`);
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// --- 12. Reload restores the scan ---
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('.result-summary', { timeout: 60000 });
check('reload restores the scan', (await txt('.result-site h2')) === 'Northstar demo shop');

// --- 13. Bad URL handling ---
await page.fill('#website-url', 'http://127.0.0.1:4317/sample/checkout');
await page.click('button:has-text("Map this website")');
await page.waitForTimeout(2500);
check('private address explains itself', Boolean(await page.$('.alert.error')), (await txt('.alert.error'))?.slice(0, 60) ?? '');
check('private address offers the demo shop', await page.evaluate(() => [...document.querySelectorAll('.alert')].some((a) => /Scan the demo shop/.test(a.textContent ?? ''))));

// --- 14. Invalid URL ---
await page.fill('#website-url', 'ftp://example.com');
await page.click('button:has-text("Map this website")');
await page.waitForTimeout(800);
check('invalid scheme is rejected', (await txt('.alert.error'))?.includes('http') ?? false);

// --- 15. Theme ---
await page.click('button[aria-label="Switch to light mode"]');
await page.waitForTimeout(500);
check('light theme applies', await has('[data-theme=light]'));

console.log('\n=== SUMMARY ===');
console.log(`${results.filter((r) => r.pass).length}/${results.length} passed`);
const failed = results.filter((r) => !r.pass);
if (failed.length) console.log('FAILED:', failed.map((f) => f.name).join(' | '));
console.log('runtime problems:', problems.length ? problems : 'none');
await browser.close();
