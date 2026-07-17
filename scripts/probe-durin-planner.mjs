/**
 * probe-durin-planner.mjs — browser verification of Durin's dual-form model
 * (post-P4 #2). Drives three notations through the real planner and checks
 * the rendered summon subrow labels — the visible discriminator between the
 * White and Dark burst forms (state windows don't render; the Q bar label is
 * identical either way).
 *
 * Usage: build + serve on :4998 first (see .claude/skills/verify), then
 *   node scripts/probe-durin-planner.mjs
 */
import { chromium } from 'playwright';

const CASES = [
	{ notation: 'Durin E E Q', expect: 'Dragon of White Flame', why: 'E E = White commit' },
	{ notation: 'Durin E N Q', expect: 'Dragon of Dark Decay', why: 'E N = Dark commit' },
	{
		notation: 'Durin E ~7s N Q',
		expect: 'Dragon of White Flame',
		why: 'window expired → plain N, White default'
	}
];

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

const errors = [];
page.on('console', (msg) => {
	if (msg.type() === 'error') errors.push(msg.text());
});
page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));

await page.goto('http://localhost:4998/rotation-planner', { waitUntil: 'networkidle' });

let failures = 0;
for (const c of CASES) {
	await page.click('.cm-content');
	await page.keyboard.press('Meta+a');
	await page.keyboard.press('Backspace');
	await page.keyboard.type(c.notation, { delay: 40 });
	await page.waitForTimeout(2500); // lazy character payload + re-render

	const labels = await page.evaluate(() =>
		[...document.querySelectorAll('.rp-summon-label')].map((el) => el.textContent?.trim())
	);
	const ok = labels.includes(c.expect);
	if (!ok) failures++;
	console.log(
		`${ok ? 'PASS' : 'FAIL'}  ${c.notation.padEnd(18)} → summons=${JSON.stringify(labels)} (${c.why})`
	);
}

if (errors.length) {
	console.log('console errors:', JSON.stringify(errors, null, 2));
	failures++;
}
await browser.close();
process.exit(failures === 0 ? 0 : 1);
