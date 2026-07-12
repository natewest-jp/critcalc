import { chromium } from 'playwright';
const SHARE =
	'1~bY4xawJBEIX_yjKVwjUiWGwhxOSKEBDFSkI4xr0Xb3Gdhd25Kzzuv2fVJoFUwzePb-aNNJBdVCRRWX0UsvSSApzrvEQzq_dzU5u1OSKwmHpvtotCG4hA9c5r88G3vuN70NW7wr_0V7P63C7fvqgiBV_JSh9CRS5KVoTweJjJjnR6HiS7mioKkdvY65_9SJzUf7PTA_S9LS0lngJyRlOmP4OKeGG06Dhxc3l0-k8bfPItsoNoM0CQkGiaph8';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({
	viewport: { width: 1720, height: 1050 },
	deviceScaleFactor: 3
});
await page.goto(`http://localhost:4998/rotation-planner?r=${SHARE}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2200);
// Yelan → Bennett junction (from earlier rects: x≈400-430, y≈500-560)
await page.screenshot({
	path: '/Users/producer/.claude/jobs/cd9dcc54/tmp/junction.png',
	clip: { x: 380, y: 495, width: 90, height: 70 }
});
// Kazuha → Arlecchino upward junction bottom edge
await page.screenshot({
	path: '/Users/producer/.claude/jobs/cd9dcc54/tmp/junction2.png',
	clip: { x: 600, y: 830, width: 90, height: 60 }
});
await browser.close();
