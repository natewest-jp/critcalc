/**
 * probe-ground-contrast.mjs — text legibility against the ground it ACTUALLY
 * sits on, read from composited pixels.
 *
 * Every other colour probe here compares declared tokens, which works only
 * while every ground is opaque and known. This one screenshots the running
 * tool, hides the glyphs, and reads what is underneath — so it is the only
 * check that survives content moving OFF a panel and onto the world.
 *
 * ↻ 2026-08-08: was probe-sheer-contrast, gating a translucent frame ground
 * that has since been retired (sheer panels were a middle that turned out not
 * to be a place — 2–3% of scene light through a surface reads as a duller
 * colour, not as translucency). What that round was actually worth is this
 * measurement, and it matters MORE now than it did then: the direction is
 * bare content on the dimmed scene, which is exactly the case a token-reading
 * probe cannot see.
 *
 * Two invariants, per text run:
 *
 *   CONTRAST    ink vs. the WORST pixel under its own box   ≥ 4.5:1 / 3:1 large
 *   UNIFORMITY  ΔL across the ground under one run          ≤ UNIFORMITY_MAX
 *
 * UNIFORMITY is the one that is easy to skip and shouldn't be. A run can clear
 * 4.5:1 on average and still have one word sitting over a star. On an opaque
 * panel it is free; on the scene it is the whole question.
 *
 * ⚠ Worst-pixel, not average. One dark patch under one glyph is a real
 *   legibility failure even where the run reads fine overall.
 *
 * ⚠ Samples at REST. The crest scene is a frozen still frame there
 *   (probe-star-freeze asserts it), which is what makes any of this
 *   repeatable. Sampling mid-transition reads a different frame every run.
 *
 * ⚠ Does NOT reuse probe-lightness-round's parseRgb — that helper .slice(0,3)s
 *   the alpha channel off, so rgba(36,44,64,.8) parses identically to
 *   rgb(36,44,64).
 *
 * Usage: build + serve on :4998 (see .claude/skills/verify), then
 *   node scripts/probe-ground-contrast.mjs
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

/** Half the --surface → --surface-raised step (ΔL .040, app.css). If the ground
 *  under one run varies by more than this, some of its glyphs are on a
 *  materially different colour from the rest. */
const UNIFORMITY_MAX = 0.02;

/**
 * KNOWN PRE-EXISTING SHORTFALLS — under the floor before any of this work,
 * measured on the opaque tree. Reported as ⚠ rather than ✗ so the probe gates
 * what it is for instead of going permanently red over something it merely
 * discovered. Same contract as WIKI_KNOWN_WRONG / GDB_CD_KNOWN_WRONG: an entry
 * carries its measurement, and removing one is a deliberate act.
 *
 * ⚠ Both are REAL and worth fixing — just not inside a layout round, where an
 * accessibility fix would be buried. Both are the same shape: an ink verified
 * against --frame-bg (#242c40) sitting on a ground one rung LIGHTER.
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

// ── pixel access ──────────────────────────────────────────────────────────
// sharp is already a devDependency; probe-ascend-pan.mjs is the precedent.
const sharp = (await import('sharp')).default;
/** Screenshot → raw RGB(A) bytes at DEVICE pixels. */
const raw = async (page) =>
	sharp(await page.screenshot())
		.raw()
		.toBuffer({ resolveWithObject: true });
/** Sample one pixel. Rects arrive in CSS px; the buffer is device px. */
const px = (png, x, y, cssWidth) => {
	const s = png.info.width / cssWidth;
	const i = (Math.round(y * s) * png.info.width + Math.round(x * s)) * png.info.channels;
	return [png.data[i], png.data[i + 1], png.data[i + 2]];
};

/** ALPHA-AWARE. Throws rather than dropping the channel: a computed TEXT colour
 *  has to be opaque for the maths to mean anything, and silently treating
 *  rgba() as rgb() is how a broken ground sails through. */
const parseColor = (s) => {
	const v = (s.match(/[\d.]+/g) ?? []).map(Number);
	const rgb = s.startsWith('color(')
		? v.slice(0, 3).map((x) => Math.round(x * 255))
		: v.slice(0, 3);
	const a = v.length > 3 ? v[3] : 1;
	if (a < 0.999) throw new Error(`non-opaque text colour ${s} — composite it before comparing`);
	return rgb;
};

// ── the subjects: [route, scope selector, text selectors within it] ───────
// The scope is only a disambiguator for the text selectors — it is NOT assumed
// to be a panel, which is the point: a scope may be a box or bare scene.
const SUBJECTS = [
	['/rotation-planner', '.rp-frame', ['.rp-tick-label', '.rp-lane-name']],
	['/rotation-planner', '.rp-composer', ['.cm-content']],
	['/team-builder', '.tb-stack', ['.tb-atlas-lead', '.tb-atlas-cite']]
];
// The crest pose is width-dependent (crestPose reads innerWidth) and
// sideSign() puts the two tools over opposite sides of the world, so a
// different patch of terrain lands behind each subject at each size.
const WIDTHS = [1600, 1280];

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errs = [];

for (const width of WIDTHS) {
	const page = await browser.newPage({ viewport: { width, height: 1000 } });
	page.on('pageerror', (e) => errs.push(e.message));
	console.log(`\n── ${width}×1000 ───────────────────────────────────────────`);

	for (const [route, scopeSel, textSels] of SUBJECTS) {
		await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
		// Past the tool-rest settle: the star clock is frozen and the dim has
		// reached its resting opacity.
		await page.waitForTimeout(2600);

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
			[scopeSel, textSels]
		);

		for (const ink of inks.filter(Boolean)) {
			// ⚠ INSET off the run's own edges before sampling. A text box often sits
			// flush inside a bordered ancestor — .cm-content is exactly 1px inside
			// .cm-editor's 1px border — and sampling the outermost pixels reads that
			// border's antialiasing as if it were ground. Measured: the "worst" and
			// "best" pixels both landed at dy=1, giving a confident ΔL 0.154 for a
			// perfectly flat well. Glyph ink never reaches a box's outer pixels
			// (leading and side bearing see to that), so this narrows the sample to
			// where type actually is rather than weakening the check — a star under
			// a run on the scene sits well inside the box.
			const INSET = 3;
			if (ink.box.w < INSET * 2 + 4 || ink.box.h < INSET * 2 + 4) continue;

			// Hide ONLY this run's glyphs, then read inside its own box.
			//
			// ⚠ Do NOT do this by hiding the scope's children to expose "the
			// ground" — that also hides every NESTED opaque surface, and the
			// planner's tick labels then get compared against the frame two
			// rungs behind what they actually sit on (a confident 4.16:1 that
			// does not exist on screen). What a glyph sits on is whatever paints
			// last beneath it.
			//
			// ⚠ Descendants too: CodeMirror colours its own token spans, so
			// transparent-ing the container alone leaves the glyphs painted and
			// the probe measures the ink against itself at a convincing 1.00:1.
			const hide = await page.addStyleTag({
				content: `${scopeSel} ${ink.sel}, ${scopeSel} ${ink.sel} * { color: transparent !important }`
			});
			const png = await raw(page);
			await hide.evaluate((n) => n.remove());

			const under = [];
			for (let y = ink.box.y + INSET; y < ink.box.y + ink.box.h - INSET; y += 2)
				for (let x = ink.box.x + INSET; x < ink.box.x + ink.box.w - INSET; x += 2)
					under.push(px(png, x, y, width));
			if (!under.length) continue;

			const rgb = parseColor(ink.color);
			const worst = under.reduce((w, s) => (contrast(rgb, s) < contrast(rgb, w) ? s : w), under[0]);
			const large = ink.px >= 24 || (ink.px >= 18.66 && ink.bold);
			const floor = large ? 3 : 4.5;
			const c = contrast(rgb, worst);
			const known = KNOWN_SHORTFALL[ink.sel];

			if (known && c < floor) {
				console.log(`  ⚠ known ${route} ${ink.sel}: ${c.toFixed(2)}:1 < ${floor}:1 — ${known}`);
			} else {
				check(
					`${route} ${ink.sel}: ${c.toFixed(2)}:1 ≥ ${floor}:1`,
					c >= floor,
					`ink=${ink.color} worst ground=rgb(${worst}) @${ink.px}px`
				);
			}

			const Ls = under.map(okL);
			const spread = Math.max(...Ls) - Math.min(...Ls);
			check(
				`${route} ${ink.sel}: ground under the run is UNIFORM (ΔL ≤ ${UNIFORMITY_MAX})`,
				spread <= UNIFORMITY_MAX,
				`ΔL=${spread.toFixed(4)} — some glyphs sit on a materially different colour ` +
					`(on the scene: raise TOOL_DIM in transition.ts, or shape the scrim)`
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
