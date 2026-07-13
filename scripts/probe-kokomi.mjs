import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({
	viewport: { width: 1720, height: 1050 },
	deviceScaleFactor: 2
});
await page.goto('http://localhost:4998/rotation-planner', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.click('.cm-content');
await page.keyboard.type('Sangonomiya Kokomi E Q > Yumemizuki Mizuki E', { delay: 15 });
await page.waitForTimeout(1500);
const col = await page.$('.rp-label-col');
await col.screenshot({ path: '/Users/producer/.claude/jobs/cd9dcc54/tmp/kokomi-col.png' });
await browser.close();
