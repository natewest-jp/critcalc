import { chromium } from 'playwright';
const SHARE =
	'1~bY4xawJBEIX_yjKVwjUiWGwhxOSKEBDFSkI4xr0Xb3Gdhd25Kzzuv2fVJoFUwzePb-aNNJBdVCRRWX0UsvSSApzrvEQzq_dzU5u1OSKwmHpvtotCG4hA9c5r88G3vuN70NW7wr_0V7P63C7fvqgiBV_9SJzUf7PTA_S9LS0lngJyRlOmP4OKeGG06Dhxc3l0-k8bfPItsoNoM0CQkGiaph8';
const REAL =
	'1~bY4xawJBEIX_yjKVwjUiWGwhxOSKEBDFSkI4xr0Xb3Gdhd25Kzzuv2fVJoFUwzePb-aNNJBdVCRRWX0UsvSSApzrvEQzq_dzU5u1OSKwmHpvtotCG4hA9c5r88G3vuN70NW7wr_0V7P63C7fvqgiBV_JSh9CRS5KVoTweJjJjnR6HiS7mioKkdvY65_9SJzUf7PTA_S9LS0lngJyRlOmP4OKeGG06Dhxc3l0-k8bfPItsoNoM0CQkGiaph8';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({
	viewport: { width: 1720, height: 1050 },
	deviceScaleFactor: 2
});
await page.goto(`http://localhost:4998/rotation-planner?r=${REAL}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2200);
const shot = await page.screenshot({ clip: { x: 380, y: 495, width: 120, height: 260 } });
const b64 = shot.toString('base64');
const result = await page.evaluate(async (b64) => {
	const img = new Image();
	img.src = 'data:image/png;base64,' + b64;
	await img.decode();
	const c = document.createElement('canvas');
	c.width = img.width;
	c.height = img.height;
	const g = c.getContext('2d');
	g.drawImage(img, 0, 0);
	const data = g.getImageData(0, 0, c.width, c.height).data;
	const px = (x, y) => {
		const i = (y * c.width + x) * 4;
		return [data[i], data[i + 1], data[i + 2]];
	};
	// dpr 2, crop origin (380,495).
	// Top junction: column A = x405 (Yelan N1 block), column B = x416 (connector)
	const colDump = (xCss, y0, y1) => {
		const out = [];
		for (let y = y0; y <= y1; y++) out.push(`${y}:${px((xCss - 380) * 2, y).join(',')}`);
		return out;
	};
	return {
		topA_x405: colDump(405, 20, 28),
		topB_x416: colDump(416, 20, 28),
		// Bennett bar bottom = 718.6 CSS → (718.6-495)*2 = 447.2. Scan 442..452.
		botB_x416: colDump(416, 442, 452),
		botC_x425: colDump(425, 442, 452)
	};
}, b64);
for (const [k, v] of Object.entries(result)) console.log(k, v.join('  '));
await browser.close();
