/**
 * src/lib/utils/exportScene.ts
 *
 * THE SCENE BEHIND THE PNG EXPORT (2026-10-16, ⚓ Nate: "use of our scene as
 * the backdrop"). The live tools stand on the WebGL world, dimmed by the
 * renderer's final pass; a canvas export cannot read that framebuffer, so it
 * rebuilds the same picture from the same inputs:
 *
 *   1. the sky plate, cropped to the CREST — the rows the camera rests on at
 *      a tool (66 source rows below the master's top, the frame's 5120 wide,
 *      `sceneGL.ts`), cover-fitted to the export;
 *   2. the starfield, from `$lib/stars` at its static rest (no twinkle), laid
 *      INTO the plate before the dim — ⚓ the stars are locked to the plate on
 *      screen too (`sceneDim.ts`: dimming them separately reads as dirt);
 *   3. the tool dim over every pixel, `dimImageData`, with its dither.
 *
 * ↻ 2026-10-18 (⚓ Nate): the keep-out became the STAR VEIL — the stars sit at
 * a low floor under the content instead of vanishing, and rise past their old
 * edge strength over a long feather outside it. The formula and its knobs are
 * `$lib/landing/starVeil.ts`, shared with the live star pass.
 *
 * ⚠ The geometry numbers mirror `sceneGL.ts`'s private constants. They are the
 * plate's own (the master's size and horizon), so they move only when the
 * plate is re-exported — and then `scripts/optimize-bg.js` and this file move
 * together.
 */

import { SCENE_SKY } from '$lib/data/sceneAssets.generated';
import { stars } from '$lib/stars';
import { STAR_TINTS, STAR_STATIC_ALPHA } from '$lib/landing/starPass';
import { dimImageData } from '$lib/landing/sceneDim';
import { starVeil, type VeilBox } from '$lib/landing/starVeil';

/** The master's width and horizon row, and the crest's top (sceneGL.ts). */
const PLATE_W_SRC = 6400;
const SKY_H_SRC = 3026;
const FRAME_W_SRC = 5120;
const CREST_TOP_SRC = 66;

/** The plate tier the export samples — wide enough for a 2× export of a long
 *  rotation without upscaling the sky much, small enough to decode quickly. */
const PLATE_TIER = 3200;

/** A content box the stars sit low behind, in CSS px — measured from each
 *  star's CENTRE, so a star fades whole rather than being cut (the screen's
 *  rule). The veil's own box type. */
export type KeepOutRect = VeilBox;

/**
 * ⚓ Nate, 2026-10-18: on the PNG a hero ✦ star is drawn as the LARGEST
 * ORDINARY halo star — its place in the sky kept, its crossed arms and its
 * glow dropped. Heroes are ~3× a halo star's size at full brightness, so
 * their glow covered ~9× the area and stood out on a still image (on screen
 * the shader draws them as light and they twinkle, which is a different
 * picture). The cap is read off the field itself, so it follows the data.
 */
const HALO_CAP = stars.reduce(
	(m, s) =>
		s.halo && !s.hero ? { size: Math.max(m.size, s.size), base: Math.max(m.base, s.base) } : m,
	{ size: 0, base: 0 }
);

/** 🎛️ How large a star is drawn, relative to its screen size in CSS px. The
 *  export sits at roughly the scale of the tool on screen, so 1. */
const STAR_SCALE = 1;

function loadImage(src: string): Promise<HTMLImageElement | null> {
	return new Promise((resolve) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => resolve(null);
		img.src = src;
	});
}

/**
 * Paint the dimmed scene into a canvas of `w × h` CSS px at `dpr`, and return
 * it — the caller draws it as the export's first layer. ⚠ Built in DEVICE
 * pixels on its own canvas: `getImageData` ignores the context transform.
 */
export async function paintSceneBackdrop(
	w: number,
	h: number,
	dpr: number,
	keepOut: KeepOutRect[] = []
): Promise<HTMLCanvasElement> {
	const W = Math.round(w * dpr);
	const H = Math.round(h * dpr);
	const canvas = document.createElement('canvas');
	canvas.width = W;
	canvas.height = H;
	const ctx = canvas.getContext('2d', { willReadFrequently: true });
	if (!ctx) return canvas;

	// The crest crop, cover-fitted: the frame's full width when the export is
	// wide, a centred narrower slice when it is tall enough to run out of sky.
	let srcW = FRAME_W_SRC;
	let srcH = (srcW * H) / W;
	const skyBelowCrest = SKY_H_SRC - CREST_TOP_SRC;
	if (srcH > skyBelowCrest) {
		srcH = skyBelowCrest;
		srcW = (srcH * W) / H;
	}
	const srcX = (PLATE_W_SRC - srcW) / 2;
	const srcY = CREST_TOP_SRC;
	const toX = (sx: number) => ((sx - srcX) / srcW) * W;
	const toY = (sy: number) => ((sy - srcY) / srcH) * H;

	// Under the plate, the night itself, in case the plate fails to load.
	ctx.fillStyle = '#0b0f1c';
	ctx.fillRect(0, 0, W, H);

	const plate = await loadImage(`${SCENE_SKY}-${PLATE_TIER}w.webp`);
	if (plate) {
		const k = plate.naturalWidth / PLATE_W_SRC;
		ctx.imageSmoothingQuality = 'high';
		ctx.drawImage(plate, srcX * k, srcY * k, srcW * k, srcH * k, 0, 0, W, H);
	}

	// The stars at rest, as soft discs (a hero as the largest halo star — HALO_CAP).
	ctx.globalCompositeOperation = 'lighter';
	for (const s of stars) {
		const x = toX((s.x / 100) * PLATE_W_SRC);
		const y = toY((s.y / 100) * SKY_H_SRC);
		const size = s.hero ? HALO_CAP.size : s.size;
		const r = Math.max(0.6, (size / 2) * STAR_SCALE * dpr);
		if (x < -r * 4 || y < -r * 4 || x > W + r * 4 || y > H + r * 4) continue;
		// The PNG is not a phone screen, so its sides always feather.
		const keep = starVeil(x / dpr, y / dpr, keepOut, {
			sides: true,
			view: { w: W / dpr, h: H / dpr }
		});
		if (keep <= 0) continue;
		const [cr, cg, cb] = STAR_TINTS[s.color].map((c) => Math.round(c * 255));
		const base = s.hero ? HALO_CAP.base : s.base;
		const a = STAR_STATIC_ALPHA * Math.max(base, 0.5) * keep;
		const glowR = s.halo || s.hero ? r * 3.4 : r * 1.6;
		const g = ctx.createRadialGradient(x, y, 0, x, y, glowR);
		g.addColorStop(0, `rgba(${cr},${cg},${cb},${a})`);
		g.addColorStop(r / glowR, `rgba(${cr},${cg},${cb},${a * 0.6})`);
		g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
		ctx.fillStyle = g;
		ctx.beginPath();
		ctx.arc(x, y, glowR, 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.globalCompositeOperation = 'source-over';

	const img = ctx.getImageData(0, 0, W, H);
	dimImageData(img.data);
	ctx.putImageData(img, 0, 0);
	return canvas;
}
