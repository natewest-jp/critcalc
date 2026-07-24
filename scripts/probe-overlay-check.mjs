import { chromium } from 'playwright';
const OUT =
	'/private/tmp/claude-501/-Users-producer-Code-critcalc/28011385-68cc-461f-b2a7-1f521f59a67c/scratchpad';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:4999/rotation-planner', { waitUntil: 'networkidle' });
await page.click('.cm-content');
await page.keyboard.type('Furina E Q > Bennett E Q > Xingqiu E Q > Kazuha E Q', { delay: 25 });
await page.keyboard.press('Escape');
await page.waitForTimeout(1500);
// scroll to the end so the composer is at its rest position, then open autocomplete
await page.evaluate(() => {
	const s = document.querySelector('.tool-shell');
	s.scrollTop = s.scrollHeight;
});
await page.click('.cm-content');
await page.keyboard.press('End');
await page.keyboard.type(' > Fur', { delay: 40 });
await page
	.waitForSelector('.cm-tooltip-autocomplete', { timeout: 4000 })
	.catch(() => console.log('no autocomplete popup'));
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/rp-autocomplete.png` });
await browser.close();
console.log('done');
