import { chromium } from 'playwright';
const API = 'http://127.0.0.1:4317';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const problems = [];
page.on('pageerror', (e) => problems.push(e.message));
const wait = async (id) => { for (let i=0;i<200;i+=1){ const s=await (await fetch(`${API}/api/scans/${id}`)).json(); if(['complete','partial','failed'].includes(s.status)) return s; await new Promise(r=>setTimeout(r,1000)); } };

// Reset everything
await fetch(`${API}/api/sample/reset`, { method:'POST', headers:{'content-type':'application/json'}, body:'{}' });
await fetch(`${API}/api/sample/state`, { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({variant:'before'}) });

await page.goto('http://127.0.0.1:5173/#demo', { waitUntil: 'domcontentloaded' });
await page.evaluate(() => sessionStorage.clear());
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('.scan-story', { timeout: 90000 });
console.log('1. before-scan story:', (await page.evaluate(() => document.querySelector('.scan-story .story-headline')?.textContent))?.slice(0, 105));

// Propose a change
await page.click('.category-button:has-text("Findings")');
await page.waitForTimeout(400);
await page.click('.segmented button:has-text("List")');
await page.waitForTimeout(400);
await page.evaluate(() => { const rows=[...document.querySelectorAll('.inventory-row')]; (rows.find(r=>/image|alternative/i.test(r.textContent??''))??rows[0])?.click(); });
await page.waitForTimeout(500);
await page.click('.fix-propose .button-glass');
await page.waitForSelector('.fix-card', { timeout: 90000 });
const before = await page.evaluate(() => document.querySelector('.fix-line.before code')?.textContent);
const after = await page.evaluate(() => document.querySelector('.fix-line.after code')?.textContent);
const place = await page.evaluate(() => document.querySelector('.fix-location')?.textContent);
console.log('2. proposal:', before, '\n            ->', after, '\n            at', place);

// Apply the accepted proposal
await page.click('.fix-actions .button-solid');
await page.waitForTimeout(1500);
console.log('3. notice:', (await page.evaluate(() => document.querySelector('.alert')?.innerText.replace(/\n/g,' | '))));
const patches = await (await fetch(`${API}/api/sample/patches`)).json();
console.log('   applied patches:', JSON.stringify(patches.patches.map((p) => ({ file: p.file, summary: p.summary }))));

// The served page now carries the change
const html = await (await fetch(`${API}/sample/checkout`)).text();
console.log('4. served page carries the change:', /alt=/.test(html), '|', (html.match(/<img class="product-art"[^>]*>/) ?? ['(no img)'])[0].slice(0, 90));

// Rescan and compare
await page.click('.repair-actions .button-solid');
await page.waitForSelector('.comparison', { timeout: 90000 });
await page.waitForTimeout(800);
const comparison = (await page.evaluate(() => document.querySelector('.comparison')?.innerText.replace(/\n/g,' | ')));
console.log('5. comparison:', comparison);
console.log('   story now:', (await page.evaluate(() => document.querySelector('.scan-story .story-headline')?.textContent))?.slice(0, 105));

// The proof
await page.click('button:has-text("See the page before and after")');
await page.waitForSelector('.proof-view', { timeout: 15000 });
console.log('6. proof:', await page.evaluate(() => document.querySelector('.proof-head h2')?.textContent), '|', await page.evaluate(() => document.querySelector('.proof-head .eyebrow')?.textContent));

await browser.close();
console.log('problems:', problems.length ? problems : 'none');
