// The site's HOME-SCREEN icons, from one square source image (2026-10-14).
//
//   assets-src/app-icon.png  →  static/apple-touch-icon.png   180 × 180  (iOS)
//                               static/icon-192.png           192 × 192  (manifest)
//                               static/icon-512.png           512 × 512  (manifest, any + maskable)
//
// ⚓ The art is Nate's starfield tile — the brand mark on the scene's own sky,
// the same picture he uses as the project's Discord avatar. The browser-tab
// favicon is NOT this art: it is the bare mark on a plate, built by
// build-logo.mjs, because a starfield at 16px is noise.
//
// FULL-BLEED AND OPAQUE, both on purpose. iOS cuts its own rounded corners and
// composites any transparency onto white; Android cuts circles and squircles.
// So the art fills the square and the platforms do the masking. ONE 512 serves
// as `any` AND `maskable`: Android only promises the centre 80% (a circle of
// radius 0.4 × side) survives a mask, and the mark sits well inside it — the
// stars outside it are free to be cropped.
//
// ⚠ The source should be AT LEAST 512 px: the manifest's largest icon is drawn
// from it, and an upscale is visibly soft on Android's splash screen. The run
// warns when it is smaller.
//
// Manual: npm run build-app-icons. Outputs are committed; the source lives in
// the gitignored assets-src/ beside the other masters.

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const ROOT = join(import.meta.dirname, '..');
const SOURCE = join(ROOT, 'assets-src/app-icon.png');
const OUT = [
	{ file: 'static/apple-touch-icon.png', size: 180 },
	{ file: 'static/icon-192.png', size: 192 },
	{ file: 'static/icon-512.png', size: 512 }
];

if (!existsSync(SOURCE)) {
	console.error(`No source at ${SOURCE.replace(ROOT + '/', '')} — drop the square icon art there.`);
	process.exit(1);
}

const meta = await sharp(SOURCE).metadata();
if (meta.width !== meta.height) {
	console.error(`The source must be square; it is ${meta.width} × ${meta.height}.`);
	process.exit(1);
}
if (meta.width < 512)
	console.warn(`⚠ The source is ${meta.width} px: the 512 icon is an UPSCALE and will be soft.`);

for (const { file, size } of OUT) {
	await sharp(SOURCE)
		.resize(size, size, { kernel: 'lanczos3' })
		// Opaque: a transparent pixel becomes white on iOS. The scene's ground.
		.flatten({ background: '#050b19' })
		.png({ compressionLevel: 9 })
		.toFile(join(ROOT, file));
	console.log(`  ${file}  ${size}×${size}`);
}
