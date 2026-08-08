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
//
// ↻ BREATHING-ROOM ROUND 2026-08-08: every geometry assertion re-anchors from
// `.rp-frame`/`.tb-frame` onto `.tool-SURFACE`. The invariant was never about
// the frames — the note above says so: what ToolStack guarantees is where the
// SURFACE begins, and the frame merely happened to be the surface's only
// child. It isn't any more (the TB's surface leads with a panel row), so a
// frame-anchored check would silently start measuring a different distance.
// `.tool-surface` is the element the construction actually owns.
//
// The stack-top→surface check is also STRONGER now: with both sides anchored
// on ToolStack's own elements it reduces to `surface.y - bands.bottom ===
// BAND_STACK_GAP` per tool, asserted against the constant itself rather than
// against the other tool. The zero tolerance is earned rather than inherited.
import { chromium } from 'playwright';
import { BAND_STACK_GAP } from '../src/lib/toolBands.ts';
import { RIBBON_GAP } from '../src/lib/toolGutter.ts';

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
const rpSurface = await box('.tool-surface');
// Abutting round: the bench IS the ribbon, standing beside the frame rather
// than over a reserved column inside it. Both tools are measured the same way.
const rpBench = await box('.bench-band-mount .bb');
// The cards live in the layout-level bench band now (bench-band round),
// docked over the label column — same geometry, different owner.
const rpCard = await box('.bench-band-mount .sp-card');
console.log('RP bands       ', rpBands);
console.log('RP surface     ', rpSurface);
console.log('RP ribbon      ', rpBench);
console.log('RP first card  ', rpCard);

// ── Team Builder ─────────────────────────────────────────────────────────
await page.goto(`${BASE}/team-builder`, { waitUntil: 'networkidle' });
const tbBands = await box('.bands');
const tbBandA = await box('.band-a');
const tbBandB = await box('.band-b');
const tbSurface = await box('.tool-surface');
const tbBench = await box('.bench-band-mount .bb');
const tbCard = await box('.bench-band-mount .sp-card');
console.log('\nTB bands       ', tbBands);
console.log('TB surface     ', tbSurface);
console.log('TB ribbon      ', tbBench);
console.log('TB first card  ', tbCard);

console.log('');
// The headline: both tools' surfaces start at the same y, so the pan reads as
// one surface sliding past another rather than two panels at different heights.
check(
	'surface tops align across the RP↔TB seam',
	rpSurface && tbSurface && Math.abs(rpSurface.y - tbSurface.y) <= 1,
	`rp=${rpSurface?.y} tb=${tbSurface?.y}`
);
// ABUTTING (⚓ NATE 2026-08-07): the ribbon ends exactly where the frame
// begins — RIBBON_GAP apart, 0 by default. They must TILE, never overlap: on a
// Visualizers leg the two fade in lockstep, and any overlap composites the
// tool's ground twice (that is the bug this arrangement fixes). The tab bar
// carries the same inset, so it starts on the frame's edge too.
// ↻ 2026-08-08: they no longer TOUCH. RIBBON_GAP shipped at 0 in the abutting
// round because the job there was to stop the two surfaces overlapping, and
// tiling was the conservative proof; it joins the tool's own rhythm now. So
// assert the gap against the constant rather than asserting adjacency — which
// is strictly stronger, since it still catches an overlap (negative gap) AND
// catches the seam drifting off the rhythm in either direction.
for (const [tool, bench, surface] of [
	['RP', rpBench, rpSurface],
	['TB', tbBench, tbSurface]
]) {
	check(
		`${tool}: surface begins exactly RIBBON_GAP right of the ribbon`,
		bench && surface && surface.x - bench.right === RIBBON_GAP,
		`gap=${bench && surface ? surface.x - bench.right : '?'} expected=${RIBBON_GAP} ` +
			`(ribbon.right=${bench?.right} surface.x=${surface?.x})`
	);
}
// The bands carry the same inset as the frame they head — one padding-left on
// the shared stack, so this guards the stack rather than reconciling two
// declarations.
check(
	'RP band stack starts on its surface’s left edge',
	rpSurface && rpBands && Math.abs(rpBands.x - rpSurface.x) <= 1,
	`bands.x=${rpBands?.x} surface.x=${rpSurface?.x}`
);
check(
	'TB band stack starts on its surface’s left edge',
	tbSurface && tbBands && Math.abs(tbBands.x - tbSurface.x) <= 1,
	`bands.x=${tbBands?.x} surface.x=${tbSurface?.x}`
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
// Asserted against the CONSTANT rather than against the other tool: with both
// sides anchored on ToolStack's own elements, "the same distance" reduces to
// "exactly BAND_STACK_GAP", and checking the source of truth catches the case
// where both tools drift together.
for (const [tool, bands, surface] of [
	['RP', rpBands, rpSurface],
	['TB', tbBands, tbSurface]
]) {
	check(
		`${tool}: surface begins exactly BAND_STACK_GAP below the band stack`,
		bands && surface && surface.y - bands.bottom === BAND_STACK_GAP,
		`gap=${bands && surface ? surface.y - bands.bottom : '?'} expected=${BAND_STACK_GAP}`
	);
}
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

// ⚠ THE FILL CHAIN, ASSERTED DIRECTLY (breathing-room round 2026-08-08).
//
// The viewport-fit check above is NECESSARY BUT NOT SUFFICIENT, and we know
// that the hard way: on 2026-08-08 `.tool-stack--fill` was `height: 100%`,
// which silently never resolved (a percentage height needs a definite parent,
// and `.tool-main` is min-height). The Roster rendered all ~122 cards at full
// height (~5.8k px), `.cg-scroll` never engaged, and the SHELL scrolled
// instead — which reads almost the same until you notice the filter column
// scrolling away with the tiles. The check above passed throughout, because
// the PAGE genuinely does not scroll in that state. See ToolStack.svelte's
// --fill comment for the full post-mortem.
//
// So assert the chain's OUTCOME instead of its symptom. With 122 characters a
// RESOLVED bounded scroller MUST overflow its own box and MUST end inside the
// viewport; an unresolved one grows to fit its content and does neither. Every
// link from `.tool-stack--fill` down to `.cg-scroll` is covered by this one
// check, which is why it is worth more than any assertion about a single
// element's computed height. Any round that inserts a level into that chain
// (this one inserts `.tb-stack`) is exactly what it exists to catch.
await page.goto(`${BASE}/team-builder`, { waitUntil: 'networkidle' });
await page.click('.band-b .tab:has-text("Roster")');
await page.waitForSelector('.cg-scroll');
await page.waitForTimeout(400);
check(
	'TB roster scroller is BOUNDED (the whole fill chain resolved)',
	await page.evaluate(() => {
		const s = document.querySelector('.cg-scroll');
		if (!s) return false;
		return (
			s.scrollHeight > s.clientHeight + 1 &&
			s.getBoundingClientRect().bottom <= window.innerHeight + 1
		);
	}),
	'the roster grew instead of scrolling — a min-height:0 / flex:1 link is missing ' +
		'somewhere between .tool-stack--fill and .cg-scroll'
);

await page.screenshot({ path: `${SHOTS}/bench-align-tb.png` });
await page.goto(`${BASE}/rotation-planner`, { waitUntil: 'networkidle' });
await page.screenshot({ path: `${SHOTS}/bench-align-rp.png` });

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
