import { chromium } from 'playwright';

const SHARE =
	'1~bY4xawJBEIX_yjKVwjUiWGwhxOSKEBDFSkI4xr0Xb3Gdhd25Kzzuv2fVJoFUwzePb-aNNJBdVCRRWX0UsvSSApzrvEQzq_dzU5u1OSKwmHpvtotCG4hA9c5r88G3vuN70NW7wr_0V7P63C7fvqgiBV_JSh9CRS5KVoTweJjJjnR6HiS7mioKkdvY65_9SJzUf7PTA_S9LS0lngJyRlOmP4OKeGG06Dhxc3l0-k8bfPItsoNoM0CQkGiaph8';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1720, height: 1050 } });

const consoleMsgs = [];
page.on('console', (m) => {
	if (m.type() === 'error' || m.type() === 'warning') consoleMsgs.push(`${m.type()}: ${m.text()}`);
});
page.on('pageerror', (e) => consoleMsgs.push(`pageerror: ${e.message}`));

await page.goto(`http://localhost:4998/rotation-planner?r=${SHARE}`, {
	waitUntil: 'networkidle'
});
// Let the share import + lazy character payloads + CodeMirror chunk settle
await page.waitForTimeout(2500);

// Sanity: notation imported, tracks rendered
const state = await page.evaluate(() => {
	const cm = document.querySelector('.cm-content');
	return {
		notation: cm ? cm.textContent : '(no editor)',
		charBlocks: document.querySelectorAll('.rp-char-block').length,
		uptimeBars: document.querySelectorAll('.rp-bar-uptime').length,
		teamBuffBars: document.querySelectorAll('.rp-team-buff-bar').length,
		debuffBars: document.querySelectorAll('.rp-team-debuff-bar').length,
		frame: !!document.querySelector('.rp-frame.vz-anim-frame'),
		tabs: [...document.querySelectorAll('.tab-label')].map((t) => t.textContent),
		notesBtn: (() => {
			const b = document.querySelector('.rp-notes-btn');
			return b ? { disabled: b.disabled, badge: !!b.querySelector('.rp-notes-badge') } : null;
		})(),
		panelNames: [...document.querySelectorAll('.rcp-name')].map((n) => n.textContent?.trim())
	};
});
console.log(JSON.stringify(state, null, 2));

await page.screenshot({
	path: '/Users/producer/.claude/jobs/cd9dcc54/tmp/slice-full.png',
	fullPage: true
});
// Timeline close-up
const frame = await page.$('.rp-frame');
if (frame)
	await frame.screenshot({ path: '/Users/producer/.claude/jobs/cd9dcc54/tmp/slice-frame.png' });
// Strip + editor close-up
const section = await page.$('.timeline-section');
if (section)
	await section.screenshot({ path: '/Users/producer/.claude/jobs/cd9dcc54/tmp/slice-section.png' });

console.log('console issues:', consoleMsgs.length ? consoleMsgs : 'none');
await browser.close();
