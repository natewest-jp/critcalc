/**
 * The tool-route DIM — how the world recedes behind a tool.
 *
 * ↻ ⚓ NATE 2026-09-26: the dim moved from a DOM wash into the scene
 * renderer's final pass. It used to be one uniform layer, `--scene-dim` at
 * TOOL_DIM opacity (last .875 of #121216) over the finished scene, and a
 * straight alpha wash has one weakness: it adds the same grey to every pixel
 * and keeps only an eighth of the scene's own variation, so the galaxy dust's
 * brighter patches came out barely lighter and GREYER than the sky around
 * them — which reads as haze in front of the world, not light inside it — and
 * they crowded the stars. Settled in a side-by-side mockup of the crest view:
 *
 *   out = wash × WASH + GAIN × desaturate(scene^GAMMA, SATURATION)
 *
 * - GAMMA 2 (a square) crushes the dust far harder than the stars — a star is
 *   ~1.0 before the curve and stays there — so the stars separate from the
 *   dust (star ÷ sky luminance 3.49× → 3.53×) while the dust flattens
 *   (highlight ÷ sky 1.67× → 1.38×). Nate: "really crush that galaxy dust."
 * - SATURATION .5 takes colour OUT of the scene and the wash puts it back as a
 *   single tint on the plate's own hue — the sky's saturation lands where the
 *   old dim left it (.459 vs .463), but the dust is no longer greyer than its
 *   surroundings (.48 vs .47).
 * - GAIN is how much of the scene survives (the old wash's was 1 − .875 =
 *   .125). ⚠ Scene and stars are LOCKED together: the stars are composited
 *   into the scene BEFORE any of this, and dimming them harder than the plate
 *   was tried and reads as specks of dirt once the dust nears their
 *   brightness (Nate).
 * - The wash stays a straight alpha: a pure multiply goes too dark before the
 *   stars stop fighting the text.
 *
 * Measured at the crest (plate 05f2722f, source rows 66–2260), against the
 * old dim (computed by `dimPixel` below, with the 222° / 26% tint): typical
 * sky #131623 → #111520, galaxy highlight #1a202d → #151a27, white star
 * #303033 → #2a2d35, and --text over a star 11.19 → 11.61:1.
 *
 * ⚠ The output lives on very few 8-bit levels (the whole crest sky spans
 * R 16–21 / G 19–26 / B 30–42), so the renderer dithers AFTER this — the
 * plate's own dither is squashed by the curve and the gain. The old DOM wash
 * could never do that: the browser composited it over an already-dithered
 * 8-bit canvas.
 *
 * ONE formula, TWO readers: the shader (sceneGL.ts) takes these numbers as
 * uniforms, and `dimPixel` below is the CPU mirror the /styleguide census
 * judges every star against. ⛔ Never change one without the other.
 *
 * ⚓ These are Nate's values, landed verbatim — tune here, never re-derive.
 */
export const SCENE_DIM = {
	/** Opacity of the wash (SCENE_DIM_TINT) — how much of the ground is the tint. */
	wash: 0.965,
	/** How much of the (curved, desaturated) scene survives on top of it. */
	gain: 0.1,
	/** Scene saturation BEFORE the wash re-tints it (1 = untouched). */
	saturation: 0.5,
	/** Tone curve on the scene, in encoded (sRGB) values — 2 is a square. */
	gamma: 2
} as const;

/**
 * The wash's TINT, in HSL — the dim's hue lives here.
 * ↻ ⚓ NATE 2026-09-26: hue 226 → 224, "two degrees toward cyan", then
 * → 223, "another tiny touch", then → 222 with saturation 27 → 26: the
 * dimmed sky had come out a hair MORE saturated than the old dim's (.470 vs
 * .463) and Nate's eye caught it; at 26 it sits at .459.
 *
 * ⚠ HSL and FLOAT on purpose, never a hex: at 9% lightness an 8-bit colour
 * cannot take a 2° step — 226° and 224° both round to #11141d (whose true
 * hue is 225°) — and it does not have to, because the shader works in floats
 * and the final dither averages between output levels, so the exact tint is
 * what reaches the eye. The mockup Nate tuned in ran on this float value too.
 * `--scene-dim` in app.css is its nearest hex and paints ONLY the DOM
 * fallback layer (pre-mount frames, no-WebGL), where a degree cannot show.
 */
export const SCENE_DIM_TINT = { hue: 222, saturation: 26, lightness: 9 } as const;

/** SCENE_DIM_TINT as float sRGB, 0–1 — what the shader takes as its wash. */
export const SCENE_DIM_TINT_RGB: readonly [number, number, number] = (() => {
	const { hue: h } = SCENE_DIM_TINT;
	const s = SCENE_DIM_TINT.saturation / 100;
	const l = SCENE_DIM_TINT.lightness / 100;
	const a = s * Math.min(l, 1 - l);
	const f = (n: number) => {
		const k = (n + h / 30) % 12;
		return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
	};
	return [f(0), f(8), f(4)] as const;
})();

/** Final-pass dither σ in 8-bit levels, applied after the dim (the mockup's
 *  uniform ±½-level dither has σ ≈ 0.29; that is what Nate judged). */
export const SCENE_DIM_DITHER = 0.29;

/** Rec. 709 luma weights on ENCODED values — what the shader uses too. */
const LUMA = [0.2126, 0.7152, 0.0722] as const;

/**
 * The dim applied to one pixel, CPU side. `rgb` is 0–255 sRGB and comes back
 * unrounded; `level` is 0 (no dim — the landing) to 1 (a tool at rest), and
 * blends the way the renderer does during the ascend. The wash is the exact
 * float tint, the same value the shader gets.
 */
export function dimPixel(
	rgb: readonly [number, number, number],
	level = 1
): [number, number, number] {
	const wash = SCENE_DIM_TINT_RGB;
	const s = rgb.map((v) => (v / 255) ** SCENE_DIM.gamma);
	const l = LUMA[0] * s[0] + LUMA[1] * s[1] + LUMA[2] * s[2];
	return rgb.map((v, i) => {
		const c = Math.max(0, Math.min(1, l + (s[i] - l) * SCENE_DIM.saturation));
		const dimmed = wash[i] * SCENE_DIM.wash + c * SCENE_DIM.gain;
		return 255 * ((v / 255) * (1 - level) + dimmed * level);
	}) as [number, number, number];
}

/**
 * The same dim over a whole RGBA buffer, in place, at a tool's rest (level
 * 1), with the renderer's final-pass dither (σ = SCENE_DIM_DITHER) added
 * before the 8-bit rounding, as the shader does. For the PNG export's scene
 * backdrop (2026-10-16), where calling `dimPixel` would allocate three arrays
 * for each of millions of pixels.
 *
 * ⚠ It is `dimPixel`'s formula at level 1 with the tone curve read from a
 * 256-entry table — nothing else differs. ⛔ Change one, change both (and the
 * shader).
 */
export function dimImageData(data: Uint8ClampedArray): void {
	const wash = SCENE_DIM_TINT_RGB;
	const curve = new Float32Array(256);
	for (let v = 0; v < 256; v++) curve[v] = (v / 255) ** SCENE_DIM.gamma;
	const b0 = wash[0] * SCENE_DIM.wash;
	const b1 = wash[1] * SCENE_DIM.wash;
	const b2 = wash[2] * SCENE_DIM.wash;
	const sat = SCENE_DIM.saturation;
	const gain = SCENE_DIM.gain;
	// A uniform ±½-level dither has σ ≈ 0.29; scale it to SCENE_DIM_DITHER.
	const amp = SCENE_DIM_DITHER / 0.29;
	const clamp = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
	for (let i = 0; i < data.length; i += 4) {
		const s0 = curve[data[i]];
		const s1 = curve[data[i + 1]];
		const s2 = curve[data[i + 2]];
		const l = LUMA[0] * s0 + LUMA[1] * s1 + LUMA[2] * s2;
		data[i] = 255 * (b0 + clamp(l + (s0 - l) * sat) * gain) + (Math.random() - 0.5) * amp;
		data[i + 1] = 255 * (b1 + clamp(l + (s1 - l) * sat) * gain) + (Math.random() - 0.5) * amp;
		data[i + 2] = 255 * (b2 + clamp(l + (s2 - l) * sat) * gain) + (Math.random() - 0.5) * amp;
	}
}
