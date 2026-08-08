/**
 * probe-sheer-contrast.mjs — the sheer-ground round's pixel gate.
 *
 * The first probe in this repo that reads COMPOSITED pixels on a tool route.
 * Every other color probe gets away with getComputedStyle because every ground
 * it checks is opaque; a sheer frame's real ground is a stack, and CSS will not
 * tell you what it composited to.
 *
 * Three invariants, in increasing order of what they actually protect:
 *
 *   CONTRAST    text vs. its real composited ground   ≥ 4.5:1 body / 3:1 large
 *   UNIFORMITY  ΔL within ONE panel's own ground      ≤ UNIFORMITY_MAX
 *   SEPARATION  ΔL panel ground ↔ the gap beside it   ≥ SEPARATION_MIN
 *
 * ⚠ CONTRAST IS NOT THE GATE, and believing otherwise is the trap this file
 *   exists to avoid. The dimmed backdrop is DARKER than --frame-bg over most of
 *   the frame, so a dark sheer panel measures ~8:1 against parchment text even
 *   at alpha 0 — a contrast-only probe stays green while the round ships a
 *   visibly blotchy ground.
 *
 *   UNIFORMITY is what fails first. The composited backdrop spans roughly 9× in
 *   luminance across one viewport (deep sky vs. a lit plate), and a sheer panel
 *   inherits (1−alpha) of that spread. At alpha 0.80 over TOOL_DIM 0.75 the
 *   spread inside one panel measures ΔL ≈ 0.040 — exactly the step app.css uses
 *   to separate --surface from --surface-raised, i.e. a panel whose own ground
 *   varies by a full rung of the palette. That is "Nate spotted the zones"
 *   (SlotPortrait.svelte's note on the same idea at portrait scale) reproduced
 *   at tool scale. UNIFORMITY_MAX is set to half that step, and TOOL_DIM is the
 *   knob you turn when it fails.
 *
 * ⚠ Does NOT reuse probe-lightness-round's parseRgb — that helper .slice(0,3)s
 *   the alpha channel off, so rgba(36,44,64,0.8) parses identically to
 *   rgb(36,44,64). Latent everywhere else; directly in this round's path.
 *
 * ⚠ Samples at REST. The whole premise is that the crest scene is a frozen
 *   still frame (probe-star-freeze asserts it), which is what makes a
 *   translucent ground measurable at all. Sampling mid-transition reads a
 *   different frame every run.
 *
 * Usage: build + serve on :4998 (see .claude/skills/verify), then
 *   node scripts/probe-sheer-contrast.mjs
 */
import { chromium } from 'playwright';
import { hexToOklch } from './oklch.mjs';

const BASE = process.env.BASE ?? 'http://localhost:4998';
let pass = 0,
	fail = 0;
const check = (name, ok, detail = '') => {
	console.log(`${ok ? '  ✓' : '  ✗ FAIL'} ${name}${ok || !detail ? '' : ` — ${detail}`}`);
	if (ok) pass++;
	else fail++;
};

/** Half the --surface → --surface-raised step (ΔL .040, app.css). A panel whose
 *  own ground varies by more than this has visible zones in it. */
const UNIFORMITY_MAX = 0.02;
/** Below this the panel stops reading as an object against the bare scene
 *  beside it. The opaque baseline measures ≈ 0.09 (app.css's --scene-dim note
 *  records the same figure as a ΔE). */
const SEPARATION_MIN = 0.03;

/**
 * KNOWN PRE-EXISTING SHORTFALLS — text that was already under the floor before
 * the sheer round, measured on the OPAQUE tree. Reported as ⚠, not ✗, so this
 * probe gates what it is for (the sheer ground) instead of going permanently
 * red over something it merely discovered. Same contract as WIKI_KNOWN_WRONG /
 * GDB_CD_KNOWN_WRONG in the data scripts: an entry needs its measurement, and
 * removing one has to be a deliberate act.
 *
 * ⚠ These are REAL and worth fixing — they are simply not this round's job, and
 * folding an accessibility fix into a layout round would bury it.
 *
 * Both are the same shape: --muted and the neutral lane ink were verified
 * against --frame-bg (#242c40) in the archetype pass, but these two runs sit on
 * grounds one rung LIGHTER, where the same ink measures lower. Going sheer
 * moves both in the RIGHT direction (the composited backdrop is darker than
 * either ground over most of the frame), so re-measure after tuning and delete
 * whichever entry has cleared.
 */
const KNOWN_SHORTFALL = {
	'.rp-tick-label': '4.16:1 — --muted #a2968a on --surface-raised #2e364b (the ruler strip)',
	'.rp-lane-name': '3.38:1 — the neutral lane ink on --rp-chart-bg #242c40'
};

// ── colour helpers ────────────────────────────────────────────────────────
const srgbToLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const relLum = ([r, g, b]) =>
	0.2126 * srgbToLin(r / 255) + 0.7152 * srgbToLin(g / 255) + 0.0722 * srgbToLin(b / 255);
const contrast = (a, b) => {
	const [hi, lo] = [relLum(a), relLum(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
};
const okL = ([r, g, b]) =>
	hexToOklch(
		'#' +
			[r, g, b]
				.map((v) =>
					Math.max(0, Math.min(255, Math.round(v)))
						.toString(16)
						.padStart(2, '0')
				)
				.join('')
	).L;
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

// ── pixel access ──────────────────────────────────────────────────────────
// sharp is already a devDependency; probe-ascend-pan.mjs is the precedent for
// decoding a screenshot to raw bytes.
const sharp = (await import('sharp')).default;
/** Screenshot → { data, info } of raw RGB(A) bytes at DEVICE pixels. */
const raw = async (page) =>
	sharp(await page.screenshot())
		.raw()
		.toBuffer({ resolveWithObject: true });
/** Sample one pixel. Coordinates arrive in CSS px from getBoundingClientRect;
 *  the buffer is in device px, so scale by the screenshot's own width. */
const px = (png, x, y, cssWidth) => {
	const s = png.info.width / cssWidth;
	const ix = Math.round(x * s),
		iy = Math.round(y * s);
	const i = (iy * png.info.width + ix) * png.info.channels;
	return [png.data[i], png.data[i + 1], png.data[i + 2]];
};

// A four-character rotation, so the planner has real bars and lane names to
// measure text against rather than an empty grid.
const SEED =
	'1~bY4xawJBEIX_yjKVwjUiWGwhxOSKEBDFSkI4xr0Xb3Gdhd25Kzzuv2fVJoFUwzePb-aNNJBdVCRRWX0UsvSSApzrvEQzq_dzU5u1OSKwmHpvtotCG4hA9c5r88G3vuN70NW7wr_0V7P63C7fvqgiBV_JSh9CRS5KVoTweJjJjnR6HiS7mioKkdvY65_9SJzUf7PTA_S9LS0lngJyRlOmP4OKeGG06Dhxc3l0-k8bfPItsoNoM0CQkGiaph8';

/** ALPHA-AWARE, unlike probe-lightness-round's. Throws rather than dropping the
 *  channel: a computed TEXT colour has to be opaque for the contrast maths to
 *  mean anything, and silently treating rgba() as rgb() is exactly how a broken
 *  sheer token would sail through. */
const parseColor = (s) => {
	const v = (s.match(/[\d.]+/g) ?? []).map(Number);
	const rgb = s.startsWith('color(')
		? v.slice(0, 3).map((x) => Math.round(x * 255))
		: v.slice(0, 3);
	const a = v.length > 3 ? v[3] : 1;
	if (a < 0.999) throw new Error(`non-opaque text colour ${s} — composite it before comparing`);
	return rgb;
};

// ── the subjects ──────────────────────────────────────────────────────────
// [route, panel selector, text selectors inside it, seed]
const SUBJECTS = [
	['/rotation-planner', '.rp-frame', ['.rp-tick-label', '.rp-lane-name']],
	['/rotation-planner', '.rp-composer', ['.cm-content']],
	['/team-builder', '.tb-frame', ['.tb-atlas-lead']]
];
// The crest pose is width-dependent (crestPose reads innerWidth), and
// sideSign() puts the planner and the Team Builder over opposite sides of the
// world — so a different patch of terrain lands behind each panel at each size.
const WIDTHS = [1600, 1280];

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errs = [];

for (const width of WIDTHS) {
	const page = await browser.newPage({ viewport: { width, height: 1000 } });
	page.on('pageerror', (e) => errs.push(e.message));
	console.log(`\n── ${width}×1000 ───────────────────────────────────────────`);

	for (const [route, panelSel, textSels] of SUBJECTS) {
		await page.goto(`${BASE}${route}?r=${SEED}`, { waitUntil: 'networkidle' });
		// Past the tool-rest settle, so the star clock is frozen and the dim has
		// reached its resting opacity.
		await page.waitForTimeout(2600);

		const rect = await page
			.locator(panelSel)
			.first()
			.boundingBox()
			.catch(() => null);
		if (!rect) {
			check(`${panelSel} present on ${route}`, false);
			continue;
		}

		// Text colours and BOXES, before hiding anything.
		const inks = await page.evaluate(
			([p, sels]) =>
				sels.map((s) => {
					const el = document.querySelector(`${p} ${s}`);
					if (!el) return null;
					const cs = getComputedStyle(el);
					const b = el.getBoundingClientRect();
					return {
						sel: s,
						color: cs.color,
						px: parseFloat(cs.fontSize),
						bold: Number(cs.fontWeight) >= 700,
						box: { x: b.x, y: b.y, w: b.width, h: b.height }
					};
				}),
			[panelSel, textSels]
		);

		// Pass 1: the BARE GROUND. Hiding the panel's CONTENTS (never the panel)
		// leaves its ground compositing over the exact backdrop the text sits on.
		const hide = await page.addStyleTag({
			content: `${panelSel} > * { visibility: hidden !important }`
		});
		const png = await raw(page);
		await hide.evaluate((n) => n.remove());

		// Grid-sample the interior, inset off every edge to clear the radius and
		// its antialiasing.
		const samples = [];
		for (let y = rect.y + 6; y < rect.y + rect.height - 6; y += 7)
			for (let x = rect.x + 6; x < rect.x + rect.width - 6; x += 7)
				samples.push(px(png, x, y, width));
		if (samples.length < 16) {
			check(`${panelSel} big enough to sample`, false, `${samples.length} samples`);
			continue;
		}

		const Ls = samples.map(okL);
		const spread = Math.max(...Ls) - Math.min(...Ls);
		check(
			`${route} ${panelSel}: ground UNIFORM (ΔL ≤ ${UNIFORMITY_MAX})`,
			spread <= UNIFORMITY_MAX,
			`ΔL=${spread.toFixed(4)} — raise TOOL_DIM (transition.ts) or --sheer-a (app.css)`
		);

		// Pass 2: the ground under EACH TEXT RUN, measured inside that run's own
		// box with only the text itself hidden.
		//
		// ⚠ This is deliberately NOT sampled from the panel-ground pass above,
		// and getting that wrong is easy — I did, first time. Hiding
		// `panel > *` also hides every nested opaque surface, so the planner's
		// tick labels (which sit on the CHART WELL, --rp-chart-bg) got compared
		// against the FRAME two rungs behind it and reported a 4.16:1 failure
		// that does not exist on screen. What a glyph sits on is whatever paints
		// last beneath it, so hide the glyph and read exactly there.
		for (const ink of inks.filter(Boolean)) {
			if (ink.box.w < 4 || ink.box.h < 4) continue;
			// Descendants too: CodeMirror colours its own token spans, so
			// transparent-ing only the container leaves the glyphs painted and
			// the probe measures the ink against itself (1.00:1).
			const hideText = await page.addStyleTag({
				content: `${panelSel} ${ink.sel}, ${panelSel} ${ink.sel} * { color: transparent !important }`
			});
			const tpng = await raw(page);
			await hideText.evaluate((n) => n.remove());

			const under = [];
			for (let y = ink.box.y + 1; y < ink.box.y + ink.box.h - 1; y += 2)
				for (let x = ink.box.x + 1; x < ink.box.x + ink.box.w - 1; x += 2)
					under.push(px(tpng, x, y, width));
			if (!under.length) continue;

			const rgb = parseColor(ink.color);
			// Worst case, not average: one dark patch under one glyph is a real
			// legibility failure even if the run reads fine overall.
			const worst = under.reduce((w, s) => (contrast(rgb, s) < contrast(rgb, w) ? s : w), under[0]);
			const large = ink.px >= 24 || (ink.px >= 18.66 && ink.bold);
			const floor = large ? 3 : 4.5;
			const c = contrast(rgb, worst);
			const known = KNOWN_SHORTFALL[ink.sel];
			if (known && c < floor) {
				console.log(
					`  ⚠ known ${route} ${panelSel} ${ink.sel}: ${c.toFixed(2)}:1 < ${floor}:1 — ${known}`
				);
				continue;
			}
			check(
				`${route} ${panelSel} ${ink.sel}: ${c.toFixed(2)}:1 ≥ ${floor}:1`,
				c >= floor,
				`ink=${ink.color} worst ground=rgb(${worst}) @${ink.px}px`
			);
		}

		// SEPARATION: the gutter below the panel is bare scene. If the panel's
		// ground has dissolved into it, the composition has lost the object.
		const gapY = Math.round(rect.y + rect.height + 6);
		const gap = [];
		for (let x = rect.x + 12; x < rect.x + rect.width - 12; x += 14)
			gap.push(px(png, x, gapY, width));
		if (gap.length) {
			const dL = Math.abs(mean(Ls) - mean(gap.map(okL)));
			check(
				`${route} ${panelSel}: reads as an OBJECT against the gap (ΔL ≥ ${SEPARATION_MIN})`,
				dL >= SEPARATION_MIN,
				`ΔL=${dL.toFixed(4)} — the panel is dissolving into the backdrop`
			);
		}
	}
	await page.close();
}

await browser.close();
if (errs.length) {
	console.log('\npage errors:', errs);
	fail++;
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
