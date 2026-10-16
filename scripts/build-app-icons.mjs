// The site's HOME-SCREEN icons, drawn from the favicon's own parts (2026-10-16).
//
//   static/critcalc-logo-white.svg  (the mark)   →  static/apple-touch-icon-v2.png  180 × 180  (iOS)
//   src/lib/assets/favicon.svg      (its plate)  →  static/icon-192-v2.png          192 × 192  (manifest, any)
//                                                   static/icon-512-v2.png          512 × 512  (manifest, any)
//                                                   static/icon-maskable-512-v2.png 512 × 512  (manifest, maskable)
//
// ⚓ NATE 2026-10-16: the plain mark on the favicon's plate, like the favicon.
// ↻ It replaces the starfield tile (2026-10-14), which he lived with on his
// home screen for a few days: beside other apps' flat colours, outlines and
// fills it read as "artsy". Both inputs are build-logo.mjs outputs, so the
// plate colour and the path have ONE source and this cannot drift from the
// favicon — run build-logo first when the mark changes.
//
// ⚠ NOT the favicon's framing. The favicon crops the mark to 88% of the tile's
// HEIGHT, arms bleeding off both sides, to buy stroke weight at 16px. A
// home-screen icon has the pixels, so it draws the WHOLE mark, sized by its
// WIDTH.
//
// FULL-BLEED AND OPAQUE, both on purpose. iOS cuts its own rounded corners and
// composites any transparency onto white; Android cuts circles and squircles.
// So the plate fills the square and the platforms do the masking.
//
// TWO framings, because the platforms promise different things. iOS and a
// manifest `any` icon keep the whole square bar the corners: MARK_W. Android
// only promises the centre 80% (a circle of radius 0.4 × side) survives a
// `maskable` mask, so that icon gets MASKABLE_W, which keeps the arm tips
// inside it under any mask shape.
//
// Filenames are VERSIONED (-v2): platforms and caches hold an icon by URL, so
// a redraw ships under a new name, never over the old one. ⚠ An icon already
// on an iOS home screen is a copy taken when it was added — it never updates.
//
// Manual: npm run build-app-icons. Outputs are committed.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const ROOT = join(import.meta.dirname, '..');

/** The mark's width as a fraction of the tile. tune(nate) 2026-10-16: 0.92,
 *  picked from 0.80 / 0.86 / 0.92 / 1.00 / 1.10 rendered under both masks. */
const MARK_W = 0.92;
/** The maskable icon's mark width: inside Android's 0.8-diameter safe circle. */
const MASKABLE_W = 0.68;

const OUT = [
	{ file: 'static/apple-touch-icon-v2.png', size: 180, w: MARK_W },
	{ file: 'static/icon-192-v2.png', size: 192, w: MARK_W },
	{ file: 'static/icon-512-v2.png', size: 512, w: MARK_W },
	{ file: 'static/icon-maskable-512-v2.png', size: 512, w: MASKABLE_W }
];

const logo = readFileSync(join(ROOT, 'static/critcalc-logo-white.svg'), 'utf8');
const [VW, VH] = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(logo).slice(1).map(Number);
const path = / d="([^"]+)"/.exec(logo)[1];
const PLATE = /<rect [^>]*fill="(#[0-9a-f]{6})"/i.exec(
	readFileSync(join(ROOT, 'src/lib/assets/favicon.svg'), 'utf8')
)[1];

// OPTICAL CENTRING, as build-logo.mjs does for the favicon: the mark's weight
// sits below its box centre (heavy swooshes, a thin spike), so the tile
// centres the alpha-weighted centroid instead of the box.
const { data, info } = await sharp(Buffer.from(logo.replace(/fill="[^"]*"/, 'fill="#fff"')), {
	density: 300
})
	.ensureAlpha()
	.raw()
	.toBuffer({ resolveWithObject: true });
let mass = 0;
let massY = 0;
for (let y = 0; y < info.height; y++) {
	for (let x = 0; x < info.width; x++) {
		const a = data[(y * info.width + x) * info.channels + 3] / 255;
		mass += a;
		massY += a * y;
	}
}
const centroidDrop = massY / mass / info.height - 0.5;

const T = 1000;
const tile = (wFrac) => {
	const k = (T * wFrac) / VW;
	const w = VW * k;
	const h = VH * k;
	return (
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${T} ${T}" width="${T}" height="${T}">` +
		`<rect width="${T}" height="${T}" fill="${PLATE}"/>` +
		`<g transform="translate(${(T - w) / 2} ${(T - h) / 2 - centroidDrop * h}) scale(${k})">` +
		`<path d="${path}" fill="#fff" fill-rule="evenodd"/></g></svg>`
	);
};

console.log(`[build-app-icons] plate ${PLATE}, centroid ${(centroidDrop * 100).toFixed(2)}% low`);
for (const { file, size, w } of OUT) {
	await sharp(Buffer.from(tile(w)))
		.resize(size, size, { kernel: 'lanczos3' })
		.flatten({ background: PLATE })
		.png({ compressionLevel: 9 })
		.toFile(join(ROOT, file));
	console.log(`  ${file}  ${size}×${size}  mark ${Math.round(w * 100)}% wide`);
}
