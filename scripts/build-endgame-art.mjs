/**
 * scripts/build-endgame-art.mjs
 *
 * The endgame presets' images (lineups design §2.6), from the gitignored
 * `assets-src/endgame/` into `static/assets/endgame/`. Offline — run after
 * `fetch-endgame.mjs`, which downloads the icons and sprites this converts.
 *
 *   node scripts/build-endgame-art.mjs
 *
 * Three kinds, each sized for 2× screens at its display size:
 *
 *   stygian/{Title}.png        → stygian/{slug}.webp       the boss's full art
 *     (Nate's, 1024² from lunaris.moe; the filename is the boss's English title
 *      with ':' written as '_', so it is also the join key to the data)
 *   stygian-icons/{slug}.png   → stygian/{slug}-icon.webp  the circle avatar
 *   sprites/{id}.png           → sprites/{id}.webp         a check's icon
 *
 * ⚠️ `/assets/*` is cached forever (immutable, add-only): a CHANGED image must
 * ship under a new name (`-v2`), never overwrite one already published.
 *
 * Ends with a coverage line: every boss in stygian.json needs its art and icon.
 */

import { mkdir, readdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve, parse } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { bossSlug } from './fetch-endgame.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'assets-src/endgame');
const OUT = join(ROOT, 'static/assets/endgame');
const DATA = join(ROOT, 'src/lib/data/endgame/stygian.json');

/** Long edge in px: the detail view shows the art at ≤ 320, the board's
 *  avatar at 64, a chip's icon at 18. 🎛️ The art is the weight (28 bosses):
 *  640 at q78 is 3.5 MB where 768 at q82 was 5.1 (measured 2026-10-09). */
const ART_PX = 640;
const ART_QUALITY = 78;
const ICON_PX = 128;
const SPRITE_PX = 48;

async function convert(from, to, px, quality = 82) {
	await sharp(from)
		.resize(px, px, { fit: 'inside', withoutEnlargement: true })
		.webp({ quality, alphaQuality: 80 })
		.toFile(to);
}

async function list(dir) {
	try {
		return (await readdir(dir)).filter((f) => f.endsWith('.png'));
	} catch {
		return [];
	}
}

async function main() {
	await mkdir(join(OUT, 'stygian'), { recursive: true });
	await mkdir(join(OUT, 'sprites'), { recursive: true });

	const art = new Set();
	for (const f of await list(join(SRC, 'stygian'))) {
		const slug = bossSlug(parse(f).name.replaceAll('_', ':'));
		await convert(
			join(SRC, 'stygian', f),
			join(OUT, 'stygian', `${slug}.webp`),
			ART_PX,
			ART_QUALITY
		);
		art.add(slug);
	}
	const icons = new Set();
	for (const f of await list(join(SRC, 'stygian-icons'))) {
		const slug = parse(f).name;
		await convert(
			join(SRC, 'stygian-icons', f),
			join(OUT, 'stygian', `${slug}-icon.webp`),
			ICON_PX
		);
		icons.add(slug);
	}
	const sprites = await list(join(SRC, 'sprites'));
	for (const f of sprites)
		await convert(
			join(SRC, 'sprites', f),
			join(OUT, 'sprites', `${parse(f).name}.webp`),
			SPRITE_PX
		);

	const bosses = Object.keys(JSON.parse(await readFile(DATA, 'utf8')).bosses);
	const noArt = bosses.filter((b) => !art.has(b));
	const noIcon = bosses.filter((b) => !icons.has(b));
	const stray = [...art].filter((a) => !bosses.includes(a));
	console.log(`art ${art.size} · icons ${icons.size} · sprites ${sprites.length}`);
	if (noArt.length) console.warn(`  ! bosses with no art: ${noArt.join(', ')}`);
	if (noIcon.length) console.warn(`  ! bosses with no icon: ${noIcon.join(', ')}`);
	if (stray.length) console.warn(`  ! art for no boss in the data: ${stray.join(', ')}`);
	if (noArt.length || noIcon.length) process.exitCode = 1;
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
