import { chromium } from 'playwright';
const SHARE =
	'1~bY4xawJBEIX_yjKVwjUiWGwhxOSKEBDFSkI4xr0Xb3Gdhd25Kzzuv2fVJoFUwzePb-aNNJBdVCRRWX0UsvSSApzrvEQzq_dzU5u1OSKwmHpvtotCG4hA9c5r88G3vuN70NW7wr_0V7P63C7fvqgiBV_JSh9CRS5KVoTweJjJjnR6HiS7mioKkdvY65_9SJzUf7PTA_S9LS0lngJyRlOmP4OKeGG06Dhxc3l0-k8bfPItsoNoM0CQkGiaph8';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1720, height: 1050 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`http://localhost:4998/rotation-planner?r=${SHARE}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2200);

// 1. Alignment check at an odd zoom (55 px/s)
await page.evaluate(() => {
	const s = document.querySelector('.rp-zoom-inline input');
	s.value = '55';
	s.dispatchEvent(new Event('input', { bubbles: true }));
});
await page.waitForTimeout(500);
const misalign = await page.evaluate(() => {
	const paths = [...document.querySelectorAll('.rp-svg--connectors path')].map((p) =>
		p.getBoundingClientRect()
	);
	const bgs = [...document.querySelectorAll('.rp-active-bg')].map((b) => b.getBoundingClientRect());
	// each connector edge must touch SOME bg edge exactly
	let worst = 0;
	for (const p of paths) {
		const dl = Math.min(...bgs.map((b) => Math.abs(p.left - b.right)));
		const dr = Math.min(...bgs.map((b) => Math.abs(p.right - b.left)));
		worst = Math.max(worst, dl, dr);
	}
	return worst;
});
console.log('worst connector↔active gap @55px/s:', misalign, 'px');

// 2. PNG menu → Download flow (clipboard removed to force download visibility later)
await page.click('button[title="Export the timeline as an image"]');
await page.waitForTimeout(300);
await page.screenshot({
	path: '/Users/producer/.claude/jobs/cd9dcc54/tmp/png-menu.png',
	clip: { x: 1150, y: 0, width: 570, height: 140 }
});
const dl = page.waitForEvent('download', { timeout: 15000 });
await page.click('.tb-png-item:has-text("Download")');
const download = await dl;
await download.saveAs('/Users/producer/.claude/jobs/cd9dcc54/tmp/export2.png');
console.log('downloaded:', download.suggestedFilename(), '| errors:', errs.length ? errs : 'none');
await browser.close();
