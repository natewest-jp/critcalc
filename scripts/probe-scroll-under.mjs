// Scroll-under prototype probe: screenshot the planner at scroll extremes +
// mid-scroll, and the Team Builder sticky columns, under the raised dire border.
import { chromium } from 'playwright';

const OUT =
	'/private/tmp/claude-501/-Users-producer-Code-critcalc/28011385-68cc-461f-b2a7-1f521f59a67c/scratchpad';
const BASE = 'http://localhost:4999';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => console.log('pageerror:', e.message));

// ── Rotation planner ──────────────────────────────────────────────────────
await page.goto(`${BASE}/rotation-planner`, { waitUntil: 'networkidle' });
await page.click('.cm-content');
await page.keyboard.type('Furina E Q 3N2 > Bennett E Q > Xingqiu E Q > Kazuha E Q P', {
	delay: 25
});
await page.keyboard.press('Escape'); // dismiss any autocomplete
await page.waitForTimeout(2500); // character payloads + timeline build + waves running

const scrollTo = async (y) => {
	await page.evaluate((y) => {
		const s = document.querySelector('.tool-shell');
		s.scrollTop = y === -1 ? s.scrollHeight : y;
	}, y);
	await page.waitForTimeout(400);
};

const dims = await page.evaluate(() => {
	const s = document.querySelector('.tool-shell');
	return { scrollHeight: s.scrollHeight, clientHeight: s.clientHeight };
});
console.log('planner scroll dims:', JSON.stringify(dims));

await scrollTo(0);
await page.screenshot({ path: `${OUT}/rp-top.png` });
await scrollTo(Math.max(0, (dims.scrollHeight - dims.clientHeight) / 2));
await page.screenshot({ path: `${OUT}/rp-mid.png` });
await scrollTo(-1);
await page.screenshot({ path: `${OUT}/rp-bottom.png` });

// ── Team builder (sticky bench under fixed chrome) ────────────────────────
await page.goto(`${BASE}/team-builder`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await scrollTo(0);
await page.screenshot({ path: `${OUT}/tb-top.png` });
await scrollTo(600);
await page.screenshot({ path: `${OUT}/tb-scrolled.png` });

await browser.close();
console.log('done');
