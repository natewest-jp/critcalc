import { webkit } from 'playwright';
const REAL =
	'1~bY4xawJBEIX_yjKVwjUiWGwhxOSKEBDFSkI4xr0Xb3Gdhd25Kzzuv2fVJoFUwzePb-aNNJBdVCRRWX0UsvSSApzrvEQzq_dzU5u1OSKwmHpvtotCG4hA9c5r88G3vuN70NW7wr_0V7P63C7fvqgiBV_JSh9CRS5KVoTweJjJjnR6HiS7mioKkdvY65_9SJzUf7PTA_S9LS0lngJyRlOmP4OKeGG06Dhxc3l0-k8bfPItsoNoM0CQkGiaph8';
const browser = await webkit.launch({ headless: true });
const page = await browser.newPage({
	viewport: { width: 1720, height: 1050 },
	deviceScaleFactor: 2
});
await page.goto(`http://localhost:4998/rotation-planner?r=${REAL}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

async function measure(tag) {
	const shot = await page.screenshot({ clip: { x: 380, y: 495, width: 120, height: 260 } });
	const b64 = shot.toString('base64');
	const r = await page.evaluate(async (b64) => {
		const img = new Image();
		img.src = 'data:image/png;base64,' + b64;
		await img.decode();
		const c = document.createElement('canvas');
		c.width = img.width;
		c.height = img.height;
		const g = c.getContext('2d');
		g.drawImage(img, 0, 0);
		const d = g.getImageData(0, 0, c.width, c.height).data;
		const px = (x, y) => {
			const i = (y * c.width + x) * 4;
			return [d[i], d[i + 1], d[i + 2]];
		};
		const isActive = ([r, gg, b]) =>
			Math.abs(r - 90) < 30 && Math.abs(gg - 97) < 30 && Math.abs(b - 128) < 30;
		// first "active"-colored device row scanning down from device y=14 (below ghost)
		const firstActive = (xCss) => {
			for (let y = 14; y < 80; y++) if (isActive(px((xCss - 380) * 2, y))) return y;
			return -1;
		};
		return { blockTop: firstActive(405), connTop: firstActive(416) };
	}, b64);
	console.log(tag, JSON.stringify(r), 'Δdevice=', r.connTop - r.blockTop);
}

await measure('baseline   ');
// Fix candidate 1: promote the svg layers to composited layers
await page.addStyleTag({ content: '.rp-svg { transform: translateZ(0); }' });
await page.waitForTimeout(300);
await measure('translateZ ');
// Fix candidate 2: will-change
await page.addStyleTag({ content: '.rp-svg { will-change: transform; }' });
await page.waitForTimeout(300);
await measure('will-change');
await browser.close();
