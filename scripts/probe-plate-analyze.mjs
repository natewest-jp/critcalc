// Measurement recipe for the RETIRED dire-halftone.png plate (removed from
// static/ 2026-07-25 — the dot screen is procedural in direBorderGL.ts now,
// EMBER_* constants). To re-run, restore the asset from a pre-retirement
// commit; kept because the glyph-map readout is how those constants were
// derived (5×6px rectangular grid, ~4px dots, luminance fade).
import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
await page.goto('http://localhost:4999/');
const res = await page.evaluate(async () => {
	const image = new Image();
	image.src = '/assets/tools/dire-halftone.png';
	await image.decode();
	const c = document.createElement('canvas');
	c.width = image.width;
	c.height = image.height;
	const ctx = c.getContext('2d');
	ctx.drawImage(image, 0, 0);
	const d = ctx.getImageData(0, 0, image.width, image.height).data;
	const a = (x, y) => d[(y * image.width + x) * 4 + 3];
	// Render the alpha map as glyphs: ' '<32, '.'<96, 'o'<160, 'O'<224, '#'>=224
	const rows = [];
	for (let y = 0; y < image.height; y++) {
		let row = '';
		for (let x = 0; x < image.width; x++) {
			const v = a(x, y);
			row += v < 32 ? ' ' : v < 96 ? '.' : v < 160 ? 'o' : v < 224 ? 'O' : '#';
		}
		rows.push(row);
	}
	return { w: image.width, h: image.height, rows };
});
console.log(`plate: ${res.w}x${res.h}`);
console.log(res.rows.map((r, y) => String(y).padStart(3) + '|' + r).join('\n'));
await browser.close();
