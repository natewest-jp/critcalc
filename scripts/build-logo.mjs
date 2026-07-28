import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// Builds every shipped form of the critcalc mark from Nate's single export.
//
// Design tools write the artwork nested inside a chain of transforms, in a
// viewBox that is whatever the canvas happened to be. This flattens that chain
// into ONE path in absolute coordinates, crops the viewBox to the artwork's own
// ink, and rescales to a round 1000-unit width — so the file has no hidden
// coordinate system, the CSS box is exactly the mark, and two decimals of
// precision stay sub-pixel at any display size. (The 2026-07-28 export came in
// at 3645 bytes across three nested transforms; out at ~2.4KB, one path.)
//
// BAKED ROTATION. The mark is served pre-rotated rather than turned with a CSS
// transform, because the favicon has nowhere to put a CSS transform — and one
// source of truth beats the mark leaning 7° in the chrome and sitting straight
// in the tab.
//
// ⚠️ Baking is NOT equivalent to transform: rotate() at the same CSS height,
// and the difference is not intuitive. `transform` leaves the element box at
// the UNROTATED ink box and turns the art inside it; baking re-crops the box to
// the ROTATED ink. Those two boxes differ — for this mark the rotated box is
// slightly SMALLER, because 7° brings its diagonals closer to the axes — so the
// same `height` renders a different size, and the ink can also sit off-centre in
// the transform version's box. The run below measures both boxes and prints the
// exact height factor and margin correction to carry a value tuned in devtools
// (where transform is the only option) over to the baked file. SiteChrome's
// numbers come from that report.
//
// FAVICON POLICY — opaque plate, not transparency. The mark is near-white, and
// a transparent favicon inherits the browser's own tab-strip colour: on a
// light-themed Chrome or Firefox tab a white-on-nothing mark disappears. The
// plate also gives the thin swooshes a constant ground at 16px, and iOS
// composites apple-touch-icon onto white regardless, so an opaque icon is the
// only thing that reads everywhere.
//
// The favicon is the SAME path as the chrome mark, not separate art: a heavier
// hand-stroked variant was tried 2026-07-28 and dropped once the tile was
// cropped, because at that scale the plain mark reads better — the crop buys
// the stroke weight back, and the unthickened arms keep the negative space
// between them open instead of merging. Everything the favicon does differently
// (crop, optical shift, plate) is framing, applied below.
//
// Manual: npm run build-logo. Deliberately NOT on predev/prebuild — the source
// changes a few times a year and every output is committed.

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

const SRC = join(ROOT, 'assets-src/landing/new_critcalc-logo-white.svg');
const OUT_CHROME = join(ROOT, 'static/critcalc-logo-white.svg');
const OUT_FAVICON = join(ROOT, 'src/lib/assets/favicon.svg');
const OUT_APPLE = join(ROOT, 'static/apple-touch-icon.png');

/** Clockwise lean, degrees. Nate 2026-07-28. */
const ROTATE_DEG = 7;
/** Mark colour. (The favicon's plate colour lives in the hand-authored
 *  favicon.svg, which this script reads rather than writes.) */
const INK = '#eef4fd';

// ── matrices (a,b,c,d,e,f): x' = a·x + c·y + e ; y' = b·x + d·y + f ──────────

const mul = (m, n) => [
	m[0] * n[0] + m[2] * n[1],
	m[1] * n[0] + m[3] * n[1],
	m[0] * n[2] + m[2] * n[3],
	m[1] * n[2] + m[3] * n[3],
	m[0] * n[4] + m[2] * n[5] + m[4],
	m[1] * n[4] + m[3] * n[5] + m[5]
];
const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

/** Parse one transform= attribute value. Throws on anything not seen in an
 *  export yet, rather than silently dropping it and shifting the artwork. */
function parseTransform(t) {
	let m = /^matrix\(([^)]+)\)$/.exec(t);
	if (m) return m[1].split(',').map(Number);
	m = /^translate\(([^)]+)\)$/.exec(t);
	if (m) {
		const [x, y] = m[1].split(',').map(Number);
		return [1, 0, 0, 1, x, y ?? 0];
	}
	throw new Error(`unhandled transform: ${t}`);
}

// ── flatten ─────────────────────────────────────────────────────────────────

const src = readFileSync(SRC, 'utf8');

// Ancestor transforms, outermost first.
const BASE = [...src.matchAll(/transform="([^"]+)"/g)].map((m) => parseTransform(m[1])).reduce(mul);

const d = / d="([^"]+)"/.exec(src)[1];
const tokens = d.match(/[MLCZ]|-?\d*\.?\d+(?:e-?\d+)?/gi);

/**
 * Flatten the path under BASE plus a clockwise lean, returning the absolute
 * ops and the exact ink box. SVG's y axis points down, so a positive rotation
 * is already clockwise.
 */
function flatten(deg) {
	const rad = (deg * Math.PI) / 180;
	const M = mul([Math.cos(rad), Math.sin(rad), -Math.sin(rad), Math.cos(rad), 0, 0], BASE);

	let bx = [Infinity, -Infinity];
	let by = [Infinity, -Infinity];
	const seen = (x, y) => {
		bx = [Math.min(bx[0], x), Math.max(bx[1], x)];
		by = [Math.min(by[0], y), Math.max(by[1], y)];
	};

	/** Exact bbox contribution of a cubic: endpoints plus interior extrema.
	 *  Sampling the control points instead would over-report the box and leave
	 *  slack around the ink, which is the whole thing this script removes. */
	function cubicExtent(p0, p1, p2, p3) {
		seen(p0[0], p0[1]);
		seen(p3[0], p3[1]);
		for (const axis of [0, 1]) {
			const [a, b, c, dd] = [p0[axis], p1[axis], p2[axis], p3[axis]];
			const A = -a + 3 * b - 3 * c + dd;
			const B = 2 * (a - 2 * b + c);
			const C = -a + b;
			const roots = [];
			if (Math.abs(A) < 1e-12) {
				if (Math.abs(B) > 1e-12) roots.push(-C / B);
			} else {
				const disc = B * B - 4 * A * C;
				if (disc >= 0) {
					const s = Math.sqrt(disc);
					roots.push((-B + s) / (2 * A), (-B - s) / (2 * A));
				}
			}
			for (const t of roots) {
				if (t <= 0 || t >= 1) continue;
				const u = 1 - t;
				const v = u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * dd;
				if (axis === 0) bx = [Math.min(bx[0], v), Math.max(bx[1], v)];
				else by = [Math.min(by[0], v), Math.max(by[1], v)];
			}
		}
	}

	const ops = [];
	let i = 0;
	let cur = [0, 0];
	while (i < tokens.length) {
		const cmd = tokens[i++];
		if (cmd === 'Z') {
			ops.push(['Z']);
			continue;
		}
		const n = cmd === 'C' ? 6 : 2;
		const nums = tokens.slice(i, i + n).map(Number);
		i += n;
		const pts = [];
		for (let k = 0; k < n; k += 2) pts.push(apply(M, nums[k], nums[k + 1]));
		if (cmd === 'C') cubicExtent(cur, pts[0], pts[1], pts[2]);
		else seen(pts[0][0], pts[0][1]);
		cur = pts[pts.length - 1];
		ops.push([cmd, ...pts]);
	}
	return { ops, bx, by, w: bx[1] - bx[0], h: by[1] - by[0] };
}

const leaned = flatten(ROTATE_DEG);
const straight = flatten(0);
const { ops, bx, by } = leaned;
const inkW = leaned.w;
const inkH = leaned.h;

// Pass 2 — emit, origin-shifted to the ink box and scaled to a 1000-unit width.
const VW = 1000;
const S = VW / inkW;
const VH = Math.round(inkH * S * 100) / 100;
const num = (v) => String(Math.round(v * 100) / 100).replace(/^(-?)0\./, '$1.');
const path = ops
	.map(([cmd, ...pts]) =>
		cmd === 'Z'
			? 'Z'
			: cmd + pts.map(([x, y]) => `${num((x - bx[0]) * S)},${num((y - by[0]) * S)}`).join(' ')
	)
	.join('');

// ── the chrome mark ─────────────────────────────────────────────────────────

const chrome =
	`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VW} ${VH}" width="${VW}" ` +
	`height="${VH}" fill="${INK}" fill-rule="evenodd"><path d="${path}"/></svg>\n`;
writeFileSync(OUT_CHROME, chrome);

// ── the favicon: the same mark, cropped into a square plate ─────────────────

// The mark is 1.67:1 art and the tile is 1:1, so drawn to FIT it fills only
// ~53% of the tile's height and its strokes fall below one device pixel at tab
// sizes. It is therefore CROPPED: scaled until it is TILE_FILL of the tile
// tall, bleeding off the left and right edges. Measured, that roughly doubles
// the share of ink pixels reaching full strength at 16px.
//
// (0.88 is fit-to-width at a 7% inset, then Nate's 1.70x — kept as a direct
// fraction of the tile because that is the thing the composition is actually
// about.)
const TILE = 1000;
const TILE_FILL = 0.88;

// The plate was --bg (#060914), which is so near black that the tile read as
// black rather than as anything (Nate 2026-07-28). This is the landing sky's
// own blue — sampled from the plate art at ~30% height, the tone the scene
// actually shows behind the mark — so the favicon is a chip OF the artwork
// rather than a dark square with the mark on it.
//
// Deliberately NOT the dire red, which was the other candidate. Dire is
// enemy-facing and PAST THE PORTAL ONLY (see the color-families note: --accent
// is gilt at :root and dire only inside .tool-shell). A favicon is the most
// outside-the-portal surface there is — it is the site's identity in a tab
// strip, seen before anyone has arrived — so dire there would break the zoning
// the whole palette is built on. It measures worse too: the mark keeps
// 11.2:1 contrast on this blue against 8.3:1 on a comparably light dire, and
// 16px is where the mark can least afford to lose any.
const PLATE = '#12316f';
const PLATE_RADIUS = 0.18;

const k = (TILE * TILE_FILL) / VH;
const markW = VW * k;
const markH = VH * k;

// OPTICAL CENTRING, measured rather than eyeballed. The mark's visual mass is
// not at its bbox centre — its lower swooshes are heavy while the star's spike
// is a long thin tail — so geometric centring reads as sitting low. Rasterising
// the bare mark and taking the alpha-weighted centroid says where the weight
// actually is; the tile then centres THAT instead of the box. Nate's
// independently hand-tuned chrome nudge (-0.24em, 5.7% of the mark's height)
// corroborates the number this returns (4.6%), which is the reason to trust it.
//
// ⚠️ It is also very close to the ceiling: the mark is TILE_FILL tall, so there
// is only (1 - TILE_FILL)/2 of clearance above it, and shifting up by much more
// than the centroid asks would push the spike's tip off the top edge. The guard
// below fails loudly rather than silently cropping the star.
const probe =
	`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VW} ${VH}" width="1000" ` +
	`height="${Math.round((1000 * VH) / VW)}" fill-rule="evenodd"><path d="${path}" fill="#fff"/></svg>`;
const { data: pd, info: pi } = await sharp(Buffer.from(probe), { density: 300 })
	.ensureAlpha()
	.raw()
	.toBuffer({ resolveWithObject: true });
let mass = 0;
let massY = 0;
for (let y = 0; y < pi.height; y++) {
	for (let x = 0; x < pi.width; x++) {
		const a = pd[(y * pi.width + x) * pi.channels + 3] / 255;
		if (a > 0) {
			mass += a;
			massY += a * y;
		}
	}
}
/** How far below the box centre the ink's weight sits, as a fraction of height. */
const centroidDrop = massY / mass / pi.height - 0.5;
const shift = centroidDrop * markH;
const headroom = (TILE - markH) / 2;
if (shift > headroom) {
	throw new Error(
		`optical shift ${shift.toFixed(1)} exceeds ${headroom.toFixed(1)} of headroom — ` +
			`the star's spike would clip. Lower TILE_FILL or damp the shift.`
	);
}

const favicon =
	`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${TILE} ${TILE}" width="${TILE}" ` +
	`height="${TILE}" fill-rule="evenodd">` +
	// The clip has to be a SEPARATE group from the transform: clipPathUnits
	// defaults to userSpaceOnUse, which resolves in the space the element's own
	// transform establishes — sharing one <g> would scale the clip with the art
	// and it would stop clipping. The root viewBox alone would only clip square,
	// letting the bleed paint into the plate's rounded corners.
	`<defs><clipPath id="plate">` +
	`<rect width="${TILE}" height="${TILE}" rx="${Math.round(TILE * PLATE_RADIUS)}"/>` +
	`</clipPath></defs>` +
	`<rect width="${TILE}" height="${TILE}" rx="${Math.round(TILE * PLATE_RADIUS)}" fill="${PLATE}"/>` +
	`<g clip-path="url(#plate)"><g transform="translate(${num((TILE - markW) / 2)} ` +
	`${num((TILE - markH) / 2 - shift)}) scale(${k.toFixed(4)})">` +
	`<path d="${path}" fill="${INK}"/></g></g></svg>\n`;
writeFileSync(OUT_FAVICON, favicon);

// ── the apple-touch icon, rastered from the favicon ─────────────────────────

// FULL-BLEED SQUARE, per Apple's own guidance: iOS applies its rounded mask
// itself, at a LARGER radius (~22.4% of the side) than the plate is drawn with
// (18%). Shipping the SVG's transparent corners as-is would leave a ring of
// transparency between the plate's curve and iOS's, composited to whatever the
// OS felt like. Flattening onto the plate colour fills the corners with the same
// navy the plate already is, so the drawn curve becomes invisible and iOS's mask
// is the only rounding — which is exactly what it expects to be cutting.
await sharp(Buffer.from(favicon), { density: 400 })
	.resize(180, 180)
	.flatten({ background: PLATE })
	.png({ compressionLevel: 9 })
	.toFile(OUT_APPLE);

// ── report ─────────────────────────────────────────────────────────────────

// Carrying a devtools value (unrotated file + transform: rotate) over to the
// baked file. There, the element box stays the UNROTATED ink box and the art
// turns about its centre; here, the box IS the rotated ink. Two corrections:
//
//   height — the rendered ink is `straight.h` tall there and the full box tall
//            here, so scale by the ratio of the two boxes' heights.
//   margin — the turned art's box need not stay centred on the box it turned
//            inside; that residual offset (delta below) is what a margin has to
//            put back. As a flex item with align-items: center, a margin-top of
//            m moves the border box by m/2, hence the doubling.
const rad = (ROTATE_DEG * Math.PI) / 180;
const cU = [(straight.bx[0] + straight.bx[1]) / 2, (straight.by[0] + straight.by[1]) / 2];
const cL = [(bx[0] + bx[1]) / 2, (by[0] + by[1]) / 2];
const rcU = [
	Math.cos(rad) * cU[0] - Math.sin(rad) * cU[1],
	Math.sin(rad) * cU[0] + Math.cos(rad) * cU[1]
];
const deltaY = cL[1] - rcU[1]; // units the ink drifts inside the transform box
const hFactor = inkH / straight.h;

console.log('[build-logo]');
console.log(`  rotation      ${ROTATE_DEG}° clockwise, baked into the path`);
console.log(
	`  ink box       ${inkW.toFixed(2)} x ${inkH.toFixed(2)} (aspect ${(inkW / inkH).toFixed(4)})` +
		`   unrotated ${straight.w.toFixed(2)} x ${straight.h.toFixed(2)}`
);
console.log(`  viewBox       0 0 ${VW} ${VH}`);
console.log('  carrying a devtools transform: rotate() value to this file:');
console.log(`    height  x ${hFactor.toFixed(4)}`);
console.log(
	`    margin  + ${((2 * deltaY) / straight.h).toFixed(4)} x that devtools height ` +
		`(added to margin-top)`
);
for (const h of [2.2]) {
	const m = -0.24; // em, on a 1rem-em brand row
	console.log(
		`    e.g. height: ${h}rem, margin-top: ${m}em  ->  ` +
			`height: ${(h * hFactor).toFixed(3)}rem, margin-top: ${(m + (2 * deltaY * h) / straight.h).toFixed(3)}em`
	);
}
console.log(`  chrome  -> ${OUT_CHROME.replace(ROOT + '/', '')}  ${chrome.length} bytes`);
console.log(
	`  favicon       mark ${((markW / TILE) * 100).toFixed(0)}% wide (bleeds) x ` +
		`${(TILE_FILL * 100).toFixed(0)}% tall, shifted up ${shift.toFixed(1)} ` +
		`(${(centroidDrop * 100).toFixed(2)}% of its height, measured centroid; ` +
		`${headroom.toFixed(1)} of headroom)`
);
console.log(`  favicon -> ${OUT_FAVICON.replace(ROOT + '/', '')}  ${favicon.length} bytes`);
console.log(`  apple   -> ${OUT_APPLE.replace(ROOT + '/', '')}  180x180`);
