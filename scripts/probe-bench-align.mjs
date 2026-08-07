// Tool-stack geometry: the Rotation Planner and the Team Builder are one
// full-screen frame each, headed by the two-tier BAND stack, with the bench
// ribbon standing proud of the whole object. This measures and ASSERTS the
// geometry that has to agree between them — above all the two frame TOPS and
// the shared ribbon dock spot (the ribbon persists motionless across the
// world-locked fade; both tools must dock it identically).
//
// ↻ TOOLBAR ROUND 2026-08-07: the frame top is no longer a hand-tuned knob.
// Both tools render the same <ToolStack>, so their frame tops are
// BAND_STACK_TO_SURFACE below the stack top BY CONSTRUCTION — this probe now
// guards that the construction holds rather than that two numbers were tuned
// to match. The old --tb-tabrow-gap is gone.
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
const rpBands = await box('.bands');
const rpBandA = await box('.band-a');
const rpBandB = await box('.band-b');
const rpFrame = await box('.rp-frame');
// Abutting round: the bench IS the ribbon, standing beside the frame rather
// than over a reserved column inside it. Both tools are measured the same way.
const rpBench = await box('.bench-band-mount .bb');
// The cards live in the layout-level bench band now (bench-band round),
// docked over the label column — same geometry, different owner.
const rpCard = await box('.bench-band-mount .sp-card');
console.log('RP bands       ', rpBands);
console.log('RP frame       ', rpFrame);
console.log('RP ribbon      ', rpBench);
console.log('RP first card  ', rpCard);

// ── Team Builder ─────────────────────────────────────────────────────────
await page.goto(`${BASE}/team-builder`, { waitUntil: 'networkidle' });
const tbBands = await box('.bands');
const tbBandA = await box('.band-a');
const tbBandB = await box('.band-b');
const tbFrame = await box('.tb-frame');
const tbBench = await box('.bench-band-mount .bb');
const tbCard = await box('.bench-band-mount .sp-card');
console.log('\nTB bands       ', tbBands);
console.log('TB frame       ', tbFrame);
console.log('TB ribbon      ', tbBench);
console.log('TB first card  ', tbCard);

console.log('');
// The headline: the two frames start at the same y, so the pan reads as one
// surface sliding past another rather than two panels at different heights.
check(
	'frame tops align across the RP↔TB seam',
	rpFrame && tbFrame && Math.abs(rpFrame.y - tbFrame.y) <= 1,
	`rp=${rpFrame?.y} tb=${tbFrame?.y}`
);
// ABUTTING (⚓ NATE 2026-08-07): the ribbon ends exactly where the frame
// begins — RIBBON_GAP apart, 0 by default. They must TILE, never overlap: on a
// Visualizers leg the two fade in lockstep, and any overlap composites the
// tool's ground twice (that is the bug this arrangement fixes). The tab bar
// carries the same inset, so it starts on the frame's edge too.
check(
	'RP: ribbon’s right edge meets its frame’s left edge',
	rpFrame && rpBench && Math.abs(rpBench.right - rpFrame.x) <= 1,
	`ribbon.right=${rpBench?.right} frame.x=${rpFrame?.x}`
);
check(
	'TB: ribbon’s right edge meets its frame’s left edge',
	tbFrame && tbBench && Math.abs(tbBench.right - tbFrame.x) <= 1,
	`ribbon.right=${tbBench?.right} frame.x=${tbFrame?.x}`
);
// The bands carry the same inset as the frame they head — one padding-left on
// the shared stack, so this guards the stack rather than reconciling two
// declarations.
check(
	'RP band stack starts on its frame’s left edge',
	rpFrame && rpBands && Math.abs(rpBands.x - rpFrame.x) <= 1,
	`bands.x=${rpBands?.x} frame.x=${rpFrame?.x}`
);
check(
	'TB band stack starts on its frame’s left edge',
	tbFrame && tbBands && Math.abs(tbBands.x - tbFrame.x) <= 1,
	`bands.x=${tbBands?.x} frame.x=${tbFrame?.x}`
);
// ABUTTING TIERS: band B begins exactly where band A ends. They are ONE object
// — the outer radius is clipped on the stack, and any gap between them would
// show the scene through the middle of it.
for (const [tool, a, b] of [
	['RP', rpBandA, rpBandB],
	['TB', tbBandA, tbBandB]
]) {
	check(
		`${tool}: band B abuts band A (no seam)`,
		a && b && a.bottom === b.y,
		`bandA.bottom=${a?.bottom} bandB.y=${b?.y}`
	);
}
// THE ROUND'S HEADLINE: the ribbon stands proud of the BAND STACK, not of the
// frame. It used to hang off the frame alone, which left the toolbar floating
// unattached in a strip of bare scene beside the strip's shoulder.
for (const [tool, bands, bench] of [
	['RP', rpBands, rpBench],
	['TB', tbBands, tbBench]
]) {
	check(
		`${tool}: ribbon stands proud ABOVE the band stack`,
		bands && bench && bench.y < bands.y && bands.y - bench.y <= 24,
		`ribbon.y=${bench?.y} bands.y=${bands?.y} (RIBBON_OVERHANG_Y)`
	);
}
// Both tools' stacks must be identical in height above the surface, or the
// ribbon's head (RIBBON_HEAD) is right for one tool and wrong for the other.
check(
	'both tools put the same distance between the stack top and the surface',
	rpBands && tbBands && rpFrame && tbFrame && rpFrame.y - rpBands.y === tbFrame.y - tbBands.y,
	`rp=${rpFrame && rpBands ? rpFrame.y - rpBands.y : '?'} tb=${tbFrame && tbBands ? tbFrame.y - tbBands.y : '?'}`
);
// The SHARED card must render at the SAME width in both tools — one component
// in one strip now, so this is a regression guard rather than a reconciliation.
check(
	'shared slot card is the same width in both tools',
	rpCard && tbCard && rpCard.w === tbCard.w,
	`rp=${rpCard?.w} tb=${tbCard?.w} (tune .char-label's padding in RotationTimeline)`
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
// The card's container is the RIBBON now (ribbon round) — its content box is
// what the card must fit, not the TB zone (which is just the tucked-under
// region beneath the ribbon).
const cardBox = async () =>
	await page.evaluate(() => {
		const ribbon = document.querySelector('.bench-band-mount .bb');
		const card = document.querySelector('.bench-band-mount .sp-card');
		const cs = getComputedStyle(ribbon);
		const inner = ribbon.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
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
		`(widen LABEL_W / RIBBON_PAD, or shrink the base row)`
);

await page.screenshot({ path: `${SHOTS}/bench-align-tb.png` });
await page.goto(`${BASE}/rotation-planner`, { waitUntil: 'networkidle' });
await page.screenshot({ path: `${SHOTS}/bench-align-rp.png` });

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
