import { chromium } from 'playwright';
const SHARE =
	'1~bY4xawJBEIX_yjKVwjUiWGwhxOSKEBDFSkI4xr0Xb3Gdhd25Kzzuv2fVJoFUwzePb-aNNJBdVCRRWX0UsvSSApzrvEQzq_dzU5u1OSKwmHpvtotCG4hA9c5r88G3vuN70NW7wr_0V7P63C7fvqgiBV_JSh9CRS5KVoTweJjJjnR6HiS7mioKkdvY65_9SJzUf7PTA_S9LS0lngJyRlOmP4OKeGG06Dhxc3l0-k8bfPItsoNoM0CQkGiaph8';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
// Deny clipboard so the export falls back to a download we can capture.
const ctx = await browser.newContext({ viewport: { width: 1720, height: 1050 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => {
	if (m.type() === 'error') errs.push(m.text());
});
await page.goto(`http://localhost:4998/rotation-planner?r=${SHARE}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2200);
const dl = page.waitForEvent('download', { timeout: 15000 });
await page.click('button[aria-label="Copy timeline as PNG"]');
try {
	const download = await dl;
	await download.saveAs('/Users/producer/.claude/jobs/cd9dcc54/tmp/export.png');
	console.log('downloaded:', download.suggestedFilename());
} catch {
	// Clipboard path succeeded instead — read status text
	const label = await page.$eval('button[aria-label="Copy timeline as PNG"]', (b) => b.textContent);
	console.log('no download; button says:', label);
}
console.log('errors:', errs.length ? errs : 'none');
await browser.close();
