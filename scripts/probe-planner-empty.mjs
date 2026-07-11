import { chromium } from 'playwright';
const SHARE = '1~bY4xawJBEIX_yjKVwjUiWGwhxOSKEBDFSkI4xr0Xb3Gdhd25Kzzuv2fVJoFUwzePb-aNNJBdVCRRWX0UsvSSApzrvEQzq_dzU5u1OSKwmHpvtotCG4hA9c5r88G3vuN70NW7wr_0V7P63C7fvqgiBV_JSh9CRS5KVoTweJjJjnR6HiS7mioKkdvY65_9SJzUf7PTA_S9LS0lngJyRlOmP4OKeGG06Dhxc3l0-k8bfPItsoNoM0CQkGiaph8';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1720, height: 1050 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`http://localhost:4998/rotation-planner?r=${SHARE}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2200);
const section = await page.$('.timeline-section');
await section.screenshot({ path: '/Users/producer/.claude/jobs/cd9dcc54/tmp/r2-loaded.png' });
// New empty tab: placeholder + blank slots
await page.click('.tab-add');
await page.waitForTimeout(600);
await section.screenshot({ path: '/Users/producer/.claude/jobs/cd9dcc54/tmp/r2-empty.png' });
console.log('errors:', errs.length ? errs : 'none');
await browser.close();
