// Measure vertical geometry of the RP frame/portraits vs the TB bench, so the
// bench's resting offset can be tuned to mirror the planner across the shared
// edge (chunk-3 slide continuity).
import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:4999';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

const box = async (sel) => {
	const b = await page.locator(sel).first().boundingBox();
	return b ? { y: Math.round(b.y), x: Math.round(b.x), h: Math.round(b.height) } : null;
};

await page.goto(`${BASE}/rotation-planner`, { waitUntil: 'networkidle' });
console.log('RP frame       ', await box('.rp-frame'));
console.log('RP first card  ', await box('.rp-frame .sp-card'));
console.log('RP tab bar     ', await box('.rp-tab-bar'));

await page.goto(`${BASE}/team-builder`, { waitUntil: 'networkidle' });
console.log('TB bench       ', await box('.bn'));
console.log('TB first card  ', await box('.bn .sp-card'));
console.log('TB source      ', await box('.tb-source'));

await page.screenshot({
	path: `${process.env.SHOTS_DIR ?? '.'}/bench-restyle.png`
});
await browser.close();
