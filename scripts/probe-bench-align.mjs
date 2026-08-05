// Mirrored tool surfaces: the Rotation Planner and the Team Builder are one
// full-screen frame each, mirror images across the tool-slide seam (RP bench
// LEFT / TB bench RIGHT, filter columns on the two outer edges). This measures
// and ASSERTS the geometry that has to agree between them — above all the two
// frame TOPS, which the eye reads as continuity when the slide pans one into
// the other. The old --bn-drop faked that alignment by pushing an unframed
// bench down a page; --tb-tabrow-gap is the real knob now.
import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:4998';
const SHOTS = process.env.SHOTS_DIR ?? '.';
let pass = 0,
	fail = 0;
const check = (name, ok, detail = '') => {
	console.log(`${ok ? '  ✓' : '  ✗ FAIL'} ${name}${ok || !detail ? '' : ` — ${detail}`}`);
	if (ok) pass++;
	else fail++;
};

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.on('pageerror', (e) => console.log('  pageerror:', e.message));

const box = async (sel) => {
	const b = await page
		.locator(sel)
		.first()
		.boundingBox()
		.catch(() => null);
	return b
		? {
				x: Math.round(b.x),
				y: Math.round(b.y),
				w: Math.round(b.width),
				h: Math.round(b.height),
				right: Math.round(b.x + b.width),
				bottom: Math.round(b.y + b.height)
			}
		: null;
};

// ── Rotation Planner ─────────────────────────────────────────────────────
await page.goto(`${BASE}/rotation-planner`, { waitUntil: 'networkidle' });
const rpTabs = await box('.rp-tab-bar');
const rpFrame = await box('.rp-frame');
const rpBench = await box('.rp-label-col');
// The cards live in the layout-level bench band now (bench-band round),
// docked over the label column — same geometry, different owner.
const rpCard = await box('.bench-band-mount .sp-card');
console.log('RP tab bar     ', rpTabs);
console.log('RP frame       ', rpFrame);
console.log('RP portrait col', rpBench);
console.log('RP first card  ', rpCard);

// ── Team Builder ─────────────────────────────────────────────────────────
await page.goto(`${BASE}/team-builder`, { waitUntil: 'networkidle' });
const tbTabs = await box('.tb-tabs');
const tbFrame = await box('.tb-frame');
const tbBench = await box('.bn');
const tbCard = await box('.bench-band-mount .sp-card');
console.log('\nTB tab row     ', tbTabs);
console.log('TB frame       ', tbFrame);
console.log('TB bench       ', tbBench);
console.log('TB first card  ', tbCard);

console.log('');
// The headline: the two frames start at the same y, so the pan reads as one
// surface sliding past another rather than two panels at different heights.
check(
	'frame tops align across the RP↔TB seam',
	rpFrame && tbFrame && Math.abs(rpFrame.y - tbFrame.y) <= 1,
	`rp=${rpFrame?.y} tb=${tbFrame?.y} (tune --tb-tabrow-gap)`
);
// Benches meet AT the seam: the planner's holds the left edge of its frame,
// the Team Builder's the right edge of its own.
check(
	'RP bench holds its frame’s LEFT edge',
	rpFrame && rpBench && rpBench.x - rpFrame.x < 20,
	`bench.x=${rpBench?.x} frame.x=${rpFrame?.x}`
);
check(
	'TB bench holds its frame’s RIGHT edge',
	tbFrame && tbBench && tbFrame.right - tbBench.right < 20,
	`bench.right=${tbBench?.right} frame.right=${tbFrame?.right}`
);
// The bench is a zone of the frame, not a framed island of its own — the
// tell is that it has no border/radius while the frame has both.
// The SHARED card must render at the SAME width in both tools. The bench token
// means "card width" in the planner but "card + zone chrome" in the TB (whose
// .bn adds 12px per side + a 1px border-left), so the two drifted 185 vs 160
// and names wrapped at different points. .char-label's inset is what closes it.
check(
	'shared slot card is the same width in both tools',
	rpCard && tbCard && rpCard.w === tbCard.w,
	`rp=${rpCard?.w} tb=${tbCard?.w} (tune .char-label's padding in RotationTimeline)`
);
check(
	'TB bench wears no frame shell of its own',
	await page.locator('.bn').evaluate((el) => {
		const cs = getComputedStyle(el);
		return cs.borderTopWidth === '0px' && cs.borderTopLeftRadius === '0px';
	}),
	'the bench should be a zone, not an island'
);
// Viewport-fit: the TB frame ends inside the viewport and the page never
// scrolls (its zones scroll instead).
check(
	'TB frame is viewport-fit (page does not scroll)',
	await page.evaluate(() => {
		const shell = document.querySelector('.tool-shell');
		return shell.scrollHeight <= shell.clientHeight + 1;
	}),
	'the TB page should not scroll'
);

// The slot card must FIT its zone. `.bn` is a grid, so `.bn-slots` carries
// min-width:auto and cannot shrink below min-content — if the card's widest
// band (the base row: action · loadout pill · action) outgrows the content
// box, the card silently OVERFLOWS its track instead of clipping. The bench
// keeps its width, so the only visible symptom is the portrait drifting right
// the moment a slot is filled. Measure empty vs filled and require both to
// match the zone.
const cardBox = async () =>
	await page.evaluate(() => {
		const bn = document.querySelector('.bn');
		const card = document.querySelector('.bench-band-mount .sp-card');
		const cs = getComputedStyle(bn);
		const inner = bn.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
		return { card: Math.round(card.getBoundingClientRect().width), inner: Math.round(inner) };
	});
const emptyCard = await cardBox();
await page.goto(`${BASE}/team-builder?team=bennett`, { waitUntil: 'networkidle' });
await page.waitForFunction(() =>
	[...document.querySelectorAll('.bench-band-mount .sp-char-name')].some((n) =>
		n.textContent?.includes('Bennett')
	)
);
const filledCard = await cardBox();
console.log('TB card empty  ', emptyCard);
console.log('TB card filled ', filledCard);
check(
	'TB slot card fits its zone — no overflow when slot actions appear',
	filledCard.card <= filledCard.inner && emptyCard.card === filledCard.card,
	`empty=${emptyCard.card} filled=${filledCard.card} zone=${filledCard.inner} ` +
		`(widen --tb-bench-w / LABEL_W, or shrink the base row)`
);

await page.screenshot({ path: `${SHOTS}/bench-align-tb.png` });
await page.goto(`${BASE}/rotation-planner`, { waitUntil: 'networkidle' });
await page.screenshot({ path: `${SHOTS}/bench-align-rp.png` });

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
