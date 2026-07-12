import { chromium } from 'playwright';
const SHARE =
	'1~bY4xawJBEIX_yjKVwjUiWGwhxOSKEBDFSkI4xr0Xb3Gdhd25Kzzuv2fVJoFUwzePb-aNNJBdVCRRWX0UsvSSApzrvEQzq_dzU5u1OSKwmHpvtotCG4hA9c5r88G3vuN70NW7wr_0V7P63C7fvqgiBV_JSh9CRS5KVoTweJjJjnR6HiS7mioKkdvY65_9SJzUf7PTA_S9LS0lngJyRlOmP4OKeGG06Dhxc3l0-k8bfPItsoNoM0CQkGiaph8';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1720, height: 1050 } });
await page.goto(`http://localhost:4998/rotation-planner?r=${SHARE}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2200);
const res = await page.evaluate(() => {
	const fmt = (r) => ({
		t: +r.top.toFixed(1),
		b: +r.bottom.toFixed(1),
		l: +r.left.toFixed(1),
		r: +r.right.toFixed(1)
	});
	return {
		paths: [...document.querySelectorAll('.rp-svg--connectors path')].map((p) =>
			fmt(p.getBoundingClientRect())
		),
		bgs: [...document.querySelectorAll('.rp-active-bg')].map((b) => fmt(b.getBoundingClientRect())),
		blocks: [...document.querySelectorAll('.rp-input-block')]
			.slice(0, 3)
			.map((b) => fmt(b.getBoundingClientRect()))
	};
});
console.log(JSON.stringify(res, null, 1));
await browser.close();
