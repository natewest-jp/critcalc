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

async function setNudge(frac) {
	await page.evaluate((f) => {
		let el = document.getElementById('nudge-style');
		if (!el) {
			el = document.createElement('style');
			el.id = 'nudge-style';
			document.head.appendChild(el);
		}
		el.textContent = `.rp-frame { margin-top: ${f}px !important; }`;
	}, frac);
	await page.waitForTimeout(200);
}
async function measure() {
	// find junction fresh each time (layout shifts with nudge)
	const geo = await page.evaluate(() => {
		const bg = [...document.querySelectorAll('.rp-active-bg')][2]; // Yelan
		const r = bg.getBoundingClientRect();
		return { yTop: r.top, xBlock: r.right - 8, xConn: r.right + 4 };
	});
	const clipY = Math.floor(geo.yTop) - 6;
	const clipX = Math.floor(geo.xBlock) - 4;
	const shot = await page.screenshot({ clip: { x: clipX, y: clipY, width: 40, height: 24 } });
	const b64 = shot.toString('base64');
	return await page.evaluate(
		async ({ b64, clipX, clipY, geo }) => {
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
			const lum = ([r, gg, b]) => r + gg + b;
			// half-coverage threshold crossing: find first y where luminance > halfway
			const edgeY = (xCss) => {
				const x = Math.round((xCss - clipX) * 2);
				for (let y = 0; y < 46; y++)
					if (lum(px(x, y)) > 160) return y + (lum(px(x, y)) > 280 ? 0 : 0.5);
				return -1;
			};
			return { block: edgeY(geo.xBlock), conn: edgeY(geo.xConn) };
		},
		{ b64, clipX, clipY, geo }
	);
}
for (const f of [0, 0.2, 0.4, 0.5, 0.6, 0.8]) {
	await setNudge(f);
	const m = await measure();
	console.log(
		`nudge ${f}px: blockEdge=${m.block} connEdge=${m.conn} Δ=${m.conn - m.block} device px`
	);
}
await browser.close();
