// Is a glyph actually centered in its round control? Layout says yes long
// before the eye agrees: a control centers its text's ADVANCE box, but what you
// see is the INK, and the two differ by the glyphs' side bearings (plus any
// letter-spacing, which lands after the last glyph too). The bench card's
// constellation value was off by ~1px in Safari this way (2026-08-06).
//
// Measuring it has two traps, both of which produced confidently wrong numbers
// before this script existed:
//
//  1. FONT METRICS CAN'T SEE IT. canvas measureText's actualBoundingBox modelled
//     the C-value's offset as +0.06px where the rendered pixels were +0.81px.
//     Rasterization — hinting, subpixel glyph positioning, antialiasing — is the
//     effect being measured, so it has to be measured in rendered pixels.
//  2. A NAIVE SCREENSHOT IS NOT A REFERENCE. Playwright rounds a clip rect to
//     whole device pixels, and anything transform-placed at measured coordinates
//     (the bench ribbon) sits at fractional ones — so the capture itself
//     contributes up to ±0.5px, differently per engine. Two independent
//     references defeat this, and they cross-check each other:
//       ANALYTIC — the clip origin is aligned to a device pixel, so the mapping
//         from page to image coordinates is exact and the element's true center
//         is known arithmetically. Works for any control.
//       STROKE — the ink is measured against the control's own round stroke in
//         the same image, so a shared capture offset cancels. Only valid when
//         that stroke is entirely inside the clip: for a zone sitting inside a
//         wider pill it is not, and the pill's clipped bbox reads ~1.5px off.
//         The script detects that and says so rather than reporting it.
//
// ⚠ HOW TO READ THE TWO ENGINES — they are not measuring the same thing.
// Chrome positions glyphs at sub-pixel precision, so its offset is a stable
// property of the font and the CSS: nudge against Chrome. WebKit SNAPS text to
// whole pixels on both axes while boxes are placed at sub-pixel precision, so
// its offset is a function of where the control happens to land. Measured by
// sweeping a control 0→0.875px sub-pixel (2026-08-06): Chrome held dx −0.313
// and dy −0.484 at every offset, while WebKit's marched linearly with it —
// dx +0.063→+0.813, dy −0.234→+0.641, a full pixel of range. Consequences:
//   · No CSS constant can center text in Safari for every layout position. A
//     WebKit reading is only valid for the position it was taken at.
//   · The durable fix is to place the container on whole pixels (the bench
//     ribbon is transform-placed from a MEASURED, fractional rect — rounding
//     that dock would make Safari deterministic and let the nudge be tuned to
//     Chrome's constant alone). Not done: it lives in the tool-transition
//     machinery, whose probes assert sub-pixel dock equalities.
//   · text-box-trim / text-box-edge do NOT help. Both engines support them and
//     they demonstrably shrink a text box (10px → 6.98px at our size), but
//     Plex Sans's metrics already seat cap-height ink on center under ordinary
//     centering (ascent − cap ≈ descent), so trimming moves the box and not
//     the ink. Verified as a no-op here, ON vs OFF, in Chrome and WebKit.
//
// Reports the ink bbox center and the mass CENTROID (per-row background
// subtracted, so a vertical gradient ground can't bias the horizontal reading);
// bbox predicts perceived centering for short labels, mass catches a string
// whose weight is lopsided (an open "C" beside a solid digit). SWEEP=a,b,c
// trials text-indent values — the knob for an optical correction — and
// SHOTS_DIR gets annotated renders with the true center and the ink center
// drawn, which is the artifact to look at when a number and an eye disagree.
//
//   node scripts/probe-ink-centering.mjs                       # default targets
//   SEL='.sp-cons-chip' SWEEP=0,-0.5,-1 node scripts/probe-ink-centering.mjs
//   BASE=http://localhost:5199 SHOTS_DIR=/tmp/shots node scripts/probe-ink-centering.mjs
//   PAGE='/visualizers?i=artifact.1~…' SEL='.ao-badge' INK=dark node scripts/probe-ink-centering.mjs
import { chromium, webkit } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:4998';
/** DARK ink on a light control (a gold pip's digit) instead of light on dark */
const INK_DARK = process.env.INK === 'dark';
/** The page to open (path + query) — the planner's bench by default */
const PAGE = process.env.PAGE ?? '/planner';
const SHOTS = process.env.SHOTS_DIR ?? null;
const SCALE = Number(process.env.SCALE ?? 8); // deviceScaleFactor: subpixel resolution
const SWEEP = process.env.SWEEP ? process.env.SWEEP.split(',').map(Number) : [null];
// Default targets: the bench card's typeset values, on the planner.
// ↻ 2026-08-12: the CONSTELLATION CHIP left this list — its C0–C6 are vector
// glyphs now (ConMark), and a path has no advance box for its ink to sit off
// the middle of. That is the fix this probe's whole method exists to justify,
// so it is worth being explicit: the chip did not get better at centering text,
// it stopped centering text. Everything still typeset is fair game, and the
// method (analytic clip ref + the control's own stroke, judged by ink bbox) is
// unchanged — see reference_subpixel_rendering_laws.
const TARGETS = process.env.SEL
	? [{ sel: process.env.SEL, label: process.env.SEL }]
	: [{ sel: '.sp-card .sp-lo-ref', label: 'refinement digit' }];
// A rotation with a filled slot, so the cards render values.
const SEED = {
	tabs: [
		{
			id: 'probe',
			label: 'Probe',
			notation: 'Bennett E Q',
			manualSlots: null,
			tabLoadout: {},
			tabCon: {}
		}
	],
	activeTabId: 'probe'
};

// Runs in the page: threshold ink, find the control's own stroke, difference the
// centers. Returns CSS-px offsets (+x = ink right of true center).
const ANALYZE = ([b64, scale, annotate, refCx, refCy, inkDark]) => {
	const img = new Image();
	img.src = 'data:image/png;base64,' + b64;
	return img.decode().then(() => {
		const c = document.createElement('canvas');
		c.width = img.width;
		c.height = img.height;
		const x = c.getContext('2d');
		x.drawImage(img, 0, 0);
		const d = x.getImageData(0, 0, c.width, c.height).data;
		const at = (px, y) => {
			const i = (y * c.width + px) * 4;
			return [d[i], d[i + 1], d[i + 2]];
		};
		const lum = (p) => 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2];
		// The margin the clip added is outside the control: that pixel is ground.
		const ground = at(1, 1);
		const differs = (p) => Math.max(...p.map((v, k) => Math.abs(v - ground[k]))) > 8;

		// The control's own shape — a closed round stroke, so its bbox center is
		// the true center regardless of where the capture landed.
		let sx0 = 1e9,
			sx1 = -1,
			sy0 = 1e9,
			sy1 = -1;
		for (let y = 0; y < c.height; y++)
			for (let px = 0; px < c.width; px++)
				if (differs(at(px, y))) {
					if (px < sx0) sx0 = px;
					if (px > sx1) sx1 = px;
					if (y < sy0) sy0 = y;
					if (y > sy1) sy1 = y;
				}
		// The stroke reference only means anything if the whole shape is in frame.
		// Touching an edge = something wider than the clip (a zone inside a pill),
		// whose clipped bbox center is NOT the control's center.
		const shapeOk = sx1 >= 0 && sx0 > 0 && sy0 > 0 && sx1 < c.width - 1 && sy1 < c.height - 1;
		const shapeCx = (sx0 + sx1 + 1) / 2;

		// Ink, sampled only well inside the shape so its stroke can't contribute.
		const ix0 = Math.round(c.width * 0.25),
			ix1 = Math.round(c.width * 0.75);
		const iy0 = Math.round(c.height * 0.25),
			iy1 = Math.round(c.height * 0.75);
		let tx0 = 1e9,
			tx1 = -1,
			ty0 = 1e9,
			ty1 = -1,
			wsum = 0,
			wx = 0;
		for (let y = iy0; y < iy1; y++) {
			const row = [];
			for (let px = ix0; px < ix1; px++) row.push(lum(at(px, y)));
			// This row's own ground, so a vertical gradient drops out.
			const sorted = [...row].sort((a, b) => a - b);
			// light ink: the ground is the darker majority; dark ink: the lighter
			const bg = sorted[Math.floor(sorted.length * (inkDark ? 0.6 : 0.4))];
			row.forEach((L, k) => {
				const px = ix0 + k;
				if (inkDark ? L < bg - 60 : L > 90) {
					if (px < tx0) tx0 = px;
					if (px > tx1) tx1 = px;
					if (y < ty0) ty0 = y;
					if (y > ty1) ty1 = y;
				}
				const w = Math.max(0, inkDark ? bg - L - 6 : L - bg - 6);
				wsum += w;
				wx += w * (px + 0.5);
			});
		}
		if (tx1 < 0) return { error: 'no ink found' };

		const inkBoxCx = (tx0 + tx1 + 1) / 2,
			inkMassCx = wx / wsum,
			inkBoxCy = (ty0 + ty1 + 1) / 2;
		const out = {
			ink: [+((tx1 - tx0 + 1) / scale).toFixed(2), +((ty1 - ty0 + 1) / scale).toFixed(2)],
			// ANALYTIC reference — always valid.
			dxBox: +((inkBoxCx - refCx) / scale).toFixed(3),
			dxMass: +((inkMassCx - refCx) / scale).toFixed(3),
			dyBox: +((inkBoxCy - refCy) / scale).toFixed(3),
			// STROKE reference — cross-check; null when the shape isn't fully in frame.
			shape: shapeOk
				? [+((sx1 - sx0 + 1) / scale).toFixed(2), +((sy1 - sy0 + 1) / scale).toFixed(2)]
				: null,
			dxBoxStroke: shapeOk ? +((inkBoxCx - shapeCx) / scale).toFixed(3) : null,
			// Ink touching the sample window means the reading is a crop edge, not
			// a glyph — the silent failure this flag exists to catch.
			CLAMPED: tx0 <= ix0 || tx1 >= ix1 - 1 || ty0 <= iy0 || ty1 >= iy1 - 1
		};
		if (annotate) {
			x.fillStyle = 'rgba(255,60,60,0.9)'; // true center (analytic)
			x.fillRect(refCx - 0.5, 0, 1, c.height);
			x.fillStyle = 'rgba(60,200,255,0.9)'; // ink mass center
			x.fillRect(inkMassCx - 0.5, 0, 1, c.height);
			out.png = c.toDataURL('image/png').split(',')[1];
		}
		return out;
	});
};

async function capture(browserType, opts) {
	const browser = await browserType.launch(opts);
	const page = await browser.newPage({
		viewport: { width: 1600, height: 1000 },
		deviceScaleFactor: SCALE
	});
	await page.addInitScript(
		(seed) => localStorage.setItem('critcalc:rotationTabs', JSON.stringify(seed)),
		SEED
	);
	await page.goto(`${BASE}${PAGE}`, { waitUntil: 'networkidle' });
	await page.waitForTimeout(3000); // veil + tool fade
	const shots = {};
	for (const { sel, label } of TARGETS) {
		const loc = page.locator(sel).first();
		if (!(await loc.count())) {
			shots[label] = { error: `no element matches ${sel}` };
			continue;
		}
		shots[label] = {};
		for (const indent of SWEEP) {
			const h =
				indent === null
					? null
					: await page.addStyleTag({ content: `${sel}{text-indent:${indent}px!important}` });
			await page.waitForTimeout(120);
			const r = await loc.boundingBox();
			// Margin so the whole stroke is in frame — and a clip origin snapped to
			// a DEVICE pixel, which is what makes the page→image mapping exact and
			// the analytic center trustworthy. (Rounding of the clip's size can't
			// move the origin, so only the origin has to be aligned.)
			const pad = 4;
			const clip = {
				x: Math.floor((r.x - pad) * SCALE) / SCALE,
				y: Math.floor((r.y - pad) * SCALE) / SCALE,
				width: Math.ceil((r.width + 2 * pad) * SCALE) / SCALE,
				height: Math.ceil((r.height + 2 * pad) * SCALE) / SCALE
			};
			shots[label][indent] = {
				b64: (await page.screenshot({ clip })).toString('base64'),
				// The control's true center, in image (device) pixels.
				refCx: (r.x + r.width / 2 - clip.x) * SCALE,
				refCy: (r.y + r.height / 2 - clip.y) * SCALE
			};
			if (h) await h.evaluate((el) => el.remove());
		}
	}
	await browser.close();
	return shots;
}

const engines = {
	chrome: await capture(chromium, { channel: 'chrome', headless: true }),
	webkit: await capture(webkit, { headless: true })
};

// Pixel analysis needs a canvas; any engine will do.
const an = await chromium.launch({ channel: 'chrome', headless: true });
const apage = await an.newPage();
let worst = 0;
const lopsided = new Set();
for (const { label } of TARGETS) {
	console.log(`\n${label}`);
	if (engines.chrome[label]?.error) {
		console.log('  ', engines.chrome[label].error);
		continue;
	}
	for (const indent of SWEEP) {
		const row = [];
		for (const [engine, shots] of Object.entries(engines)) {
			const { b64, refCx, refCy } = shots[label][indent];
			const m = await apage.evaluate(ANALYZE, [b64, SCALE, !!SHOTS, refCx, refCy, INK_DARK]);
			if (m.error) {
				row.push(`${engine}: ${m.error}`);
				continue;
			}
			// The headline tracks the BBOX: for a short label the extents predict
			// perceived centering better than the mass, which a single heavy glyph
			// drags off ("R1" — the R outweighs the 1 by ~0.7px of centroid while
			// its extents are dead centered). A big box/mass split is reported for
			// the eye to settle, not treated as an error.
			worst = Math.max(worst, Math.abs(m.dxBox));
			if (Math.abs(m.dxMass - m.dxBox) > 0.5) lopsided.add(label);
			// Disagreement between the two references means one of them is lying —
			// worth seeing rather than averaging away.
			const drift =
				m.dxBoxStroke === null
					? ' (stroke ref n/a)'
					: Math.abs(m.dxBoxStroke - m.dxBox) > 0.3
						? ` ⚠refs differ: stroke says ${m.dxBoxStroke}`
						: '';
			row.push(
				`${engine} dx box ${String(m.dxBox).padStart(6)} mass ${String(m.dxMass).padStart(6)}` +
					` dy ${String(m.dyBox).padStart(6)}` +
					(m.CLAMPED ? ' ⚠CLAMPED' : '') +
					drift
			);
			if (SHOTS && m.png) {
				const name = `ink-${label.replace(/\W+/g, '-')}-${engine}${indent === null ? '' : `-i${indent}`}.png`;
				fs.mkdirSync(SHOTS, { recursive: true });
				fs.writeFileSync(`${SHOTS}/${name}`, Buffer.from(m.png, 'base64'));
			}
		}
		console.log(
			`  ${indent === null ? 'as shipped'.padEnd(11) : `indent ${indent}px`.padEnd(11)} ${row.join('  |  ')}`
		);
	}
}
await an.close();

// Judgment, not a hard gate: the eye starts noticing around half a pixel on a
// 26px control, and each engine rasterizes differently — aim for a value that
// straddles center in both rather than zeroing one.
console.log(
	`\nworst |ink-bbox offset| across engines: ${worst.toFixed(3)}px — ${
		worst <= 0.4 ? 'centered (below the visible threshold)' : 'VISIBLE: consider an optical nudge'
	}`
);
if (lopsided.size)
	console.log(
		`weight-lopsided (mass and extents disagree >0.5px, one glyph outweighs the other): ${[...lopsided].join(', ')}\n  ` +
			'centered by extents, which is the usual right answer — judge by eye before nudging.'
	);
if (SHOTS) console.log(`annotated renders in ${SHOTS} (red = true center, blue = ink center)`);
