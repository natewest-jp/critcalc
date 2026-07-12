import { chromium } from 'playwright';
const SHARE =
	'1~bY4xawJBEIX_yjKVwjUiWGwhxOSKEBDFSkI4xr0Xb3Gdhd25Kzzuv2fVJoFUwzePb-aNNJBdVCRRWX0UsvSSApzrvEQzq_dzU5u1OSKwmHpvtotCG4hA9c5r88G3vuN70NW7wr_0V7P63C7fvqgiBV_JSh9CRS5KVoTweJjJjnR6HiS7mioKkdvY65_9SJzUf7PTA_S9LS0lngJyRlOmP4OKeGG06Dhxc3l0-k8bfPItsoNoM0CQkGiaph8';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1720, height: 1050 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`http://localhost:4998/rotation-planner?r=${SHARE}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2200);
const section = await page.$('.timeline-section');
await section.screenshot({ path: '/Users/producer/.claude/jobs/cd9dcc54/tmp/controls.png' });
// total readout + zoom position
const state = await page.evaluate(() => ({
	total: document.querySelector('.rp-controls-total')?.textContent,
	zoomInRuler: !!document.querySelector('.rp-zoom-inline'),
	pingGoneFromRow: ![...document.querySelectorAll('.rp-controls-label')].some(
		(e) => e.textContent === 'Ping'
	)
}));
// settings overlay: open, drag ping, check bars shift (reparse)
await page.click('button[aria-label="Settings"]');
await page.waitForTimeout(400);
await page.screenshot({ path: '/Users/producer/.claude/jobs/cd9dcc54/tmp/settings.png' });
const before = await page.evaluate(
	() => document.querySelectorAll('.rp-bar-uptime')[2]?.style.left
);
await page.evaluate(() => {
	const s = document.querySelector('.settings-slider');
	s.value = '20';
	s.dispatchEvent(new Event('input', { bubbles: true }));
});
await page.waitForTimeout(600);
const after = await page.evaluate(() => document.querySelectorAll('.rp-bar-uptime')[2]?.style.left);
console.log(
	JSON.stringify({ ...state, pingReparse: { before, after, changed: before !== after } }),
	'| errors:',
	errs.length ? errs : 'none'
);
await browser.close();
