import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

const errors = [];
page.on('console', (msg) => {
	if (msg.type() === 'error') errors.push(msg.text());
});
page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));

await page.goto('http://localhost:4998/rotation-planner', { waitUntil: 'networkidle' });

// Type the Flins sQ rotation into the CodeMirror editor.
await page.click('.cm-content');
// Clear any restored notation first.
await page.keyboard.press('Meta+a');
await page.keyboard.press('Backspace');
await page.keyboard.type(process.argv[2] ?? 'Flins Q E E sQ', { delay: 40 });
await page.waitForTimeout(2500); // lazy character payload + re-render

// Collect Q-row bar labels from the rendered timeline.
const probe = await page.evaluate(() => {
	const text = (sel) =>
		[...document.querySelectorAll(sel)].map((el) => el.textContent?.trim()).filter(Boolean);
	// Bar badges/labels — grab anything that looks like a bar label node.
	const barLabels = text('.rp-bar-label, .rp-bar-badge, [class*="bar-label"], [class*="badge"]');
	const panelNames = text('.rcp-name');
	const bodyHasSQ = document.body.textContent?.includes('sQ') ?? false;
	return { barLabels: barLabels.slice(0, 60), panelNames, bodyHasSQ };
});

await page.screenshot({
	path:
		process.argv[3] ??
		'/private/tmp/claude-501/-Users-producer-Code-critcalc/a42b3142-c0fa-49f0-bcd3-42c88cd18504/scratchpad/sq-planner.png',
	fullPage: false
});

console.log(JSON.stringify({ probe, errors }, null, 2));
await browser.close();
