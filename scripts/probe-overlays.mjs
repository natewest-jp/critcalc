import { chromium } from 'playwright';
const SHARE =
	'1~bY4xawJBEIX_yjKVwjUiWGwhxOSKEBDFSkI4xr0Xb3Gdhd25Kzzuv2fVJoFUwzePb-aNNJBdVCRRWX0UsvSSApzrvEQzq_dzU5u1OSKwmHpvtotCG4hA9c5r88G3vuN70NW7wr_0V7P63C7fvqgiBV_JSh9CRS5KVoTweJjJjnR6HiS7mioKkdvY65_9SJzUf7PTA_S9LS0lngJyRlOmP4OKeGG06Dhxc3l0-k8bfPItsoNoM0CQkGiaph8';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1720, height: 1050 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`http://localhost:4998/rotation-planner?r=${SHARE}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2200);
// Character selector (click first portrait chip)
await page.click('.rp-avatar-chip');
await page.waitForTimeout(800);
await page.screenshot({ path: '/Users/producer/.claude/jobs/cd9dcc54/tmp/ov-selector.png' });
// select an element filter chip to see active state
await page.click('.cs-chip--element');
await page.waitForTimeout(300);
const panel = await page.$('.cs-panel');
await panel.screenshot({ path: '/Users/producer/.claude/jobs/cd9dcc54/tmp/ov-selector2.png' });
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
// Save it first so the bank has an entry, then open Load overlay
await page.click('button[title="Save rotation to bank"]');
await page.waitForTimeout(300);
await page.click('button[title="Load a saved rotation"]');
await page.waitForTimeout(500);
const sv = await page.$('.panel');
await sv.screenshot({ path: '/Users/producer/.claude/jobs/cd9dcc54/tmp/ov-savebank.png' });
console.log('errors:', errs.length ? errs : 'none');
await browser.close();
