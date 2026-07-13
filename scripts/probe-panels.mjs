import { chromium } from 'playwright';
const SHARE =
	'1~bY4xawJBEIX_yjKVwjUiWGwhxOSKEBDFSkI4xr0Xb3Gdhd25Kzzuv2fVJoFUwzePb-aNNJBdVCRRWX0UsvSSApzrvEQzq_dzU5u1OSKwmHpvtotCG4hA9c5r88G3vuN70NW7wr_0V7P63C7fvqgiBV_JSh9CRS5KVoTweJjJjnR6HiS7mioKkdvY65_9SJzUf7PTA_S9LS0lngJyRlOmP4OKeGG06Dhxc3l0-k8bfPItsoNoM0CQkGiaph8';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({
	viewport: { width: 1720, height: 1050 },
	deviceScaleFactor: 2
});
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`http://localhost:4998/rotation-planner?r=${SHARE}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2200);
// expand a panel (Bennett C6 — should show cons rows)
const headers = await page.$$('.rcp-header');
await headers[2].click();
await page.waitForTimeout(400);
await page.evaluate(() => document.querySelector('.tool-shell').scrollTo(0, 99999));
await page.waitForTimeout(300);
const row = await page.$('.panel-row');
await row.screenshot({ path: '/Users/producer/.claude/jobs/cd9dcc54/tmp/panels.png' });
const consRows = await page.$$eval('.rcp-key--cons', (els) => els.map((e) => e.textContent));
console.log('cons key badges:', consRows, '| errors:', errs.length ? errs : 'none');
await browser.close();
