import { stars, type JitterVariant, type StarAnimation, type StarColor } from '$lib/stars';

/**
 * The twinkle starfield as a STAR PASS inside the scene renderer's canvas
 * (sceneGL.ts) — drawn between the sky and floor plates so the floor
 * occludes stars at the horizon, and transformed by the same camera uniform
 * so the field rides pans and cranes (the ascend rebuild's starfield-merge
 * chunk; a separate DOM-translating star canvas would reintroduce the
 * Firefox/WebRender pan failure the GL world exists to fix).
 *
 * History: this pipeline previously lived in starfield.ts as a standalone
 * canvas controller (one WebGL canvas replacing 1,400 animated DOM spans).
 * The controller, its backing-store budget and its 2D no-GL fallback retired
 * with the merge — the scene canvas owns sizing and the loop, and no-GL
 * already means no scene at all (deliberately no parallel implementation).
 *
 * Contracts this module keeps:
 *  - Star data comes from `$lib/stars` untouched — positions, sizes, tints,
 *    timings and animation families all feed vertex attributes directly.
 *  - Star positions are % of the SKY REGION (the old .twinkle geometry:
 *    plate-wide, horizon-bottomed, --sky-h tall); the caller passes that
 *    region's world rect each draw, so the mapping lives in ONE place
 *    (sceneGL's buildQuads).
 *  - Phases are ABSOLUTE-time based, so stopping the loop and resuming later
 *    is pop-free — the scene's occlusion gating relies on this.
 *  - Hero ✦ stars render as LIGHT (crossed gaussian arms + core + glow), not
 *    as a silhouette SDF — see the constants below; the superellipse version
 *    produced pixel-phase-dependent arm asymmetry and was retired.
 */

// --- Tuning knobs --------------------------------------------------------

/** Halo sprite size vs the core disc. The old CSS halo was a pseudo-element
 *  at `inset: -120%` — 1.2 core-widths beyond each side, so 3.4× overall. */
const HALO_SCALE = 3.4;

/** Peak halo intensity at the sprite center — (1 − t)² falloff, exact
 *  samples of the old CSS mask's stops. */
const HALO_INTENSITY = 0.5;

/** Jitter flicker depth — the single dial for how visible the flicker is. */
const FLICKER = 0.4;

/** Frozen-field opacity for the reduced-motion static frame (the old CSS
 *  froze spans at opacity 0.8). */
export const STAR_STATIC_ALPHA = 0.8;

/** Hero-star ✦ tuning. The spark is rendered as LIGHT — two crossed soft
 *  arms + a gaussian core — not as a filled silhouette. (A superellipse SDF
 *  was tried first and RETIRED: its gradient diverges along the arm axes for
 *  n < 1, and the regularized AA produced sub-pixel axis smears whose length
 *  depended on pixel-grid phase — heroes rendered with visibly unequal arms,
 *  Chrome and Safari alike. The intensity model has no singular axes and is
 *  symmetric by construction.) Star.size is the spark's ARM-SPAN in CSS px.
 *
 *  HERO_ARM_W: arm gaussian half-width across, as a fraction of arm length
 *  (floored at ~1 device px in-shader so arms never sub-pixel).
 *  HERO_CORE: core gaussian radius as a fraction of arm length.
 *  HERO_ARM_REACH: how far the needles run past the nominal arm length —
 *  the visual arm-span is size × HERO_ARM_REACH (the sprite has 3.4× of
 *  room). Lengthens the needles without growing the core. */
const HERO_ARM_W = 0.14;
const HERO_CORE = 0.22;
const HERO_ARM_REACH = 1.5;

/** Peak intensity of the soft additive glow beneath a hero spark — dimmer
 *  than the disc halo so the needle arms stay the star of the show. */
const HERO_GLOW_INTENSITY = 0.32;

/** Hero flicker depth relative to the field's FLICKER — heroes peak at full
 *  brightness (base = 1 from the generator) and dip only subtly. */
const HERO_FLICKER_SCALE = 0.5;

// --- Star tints -----------------------------------------------------------

/** Resolve `color-mix(in srgb, white N%, <tint>)` to literal RGB (0–1). */
function mixWhite(whitePct: number, hex: string): [number, number, number] {
	const n = parseInt(hex.slice(1), 16);
	const w = whitePct / 100;
	const mix = (ch: number) => (w * 255 + (1 - w) * ch) / 255;
	return [mix((n >> 16) & 255), mix((n >> 8) & 255), mix(n & 255)];
}

/** White-biased per Nate; chromas kept low so tints read as subtle hue
 *  suggestions rather than colored dots. */
const TINTS: Record<StarColor, [number, number, number]> = {
	white: mixWhite(100, '#ffffff'),
	warm: mixWhite(92, '#ffd8a8'),
	cool: mixWhite(92, '#c0d8ff'),
	yellow: mixWhite(85, '#ffd070'),
	amber: mixWhite(82, '#ffaa50')
};

// --- Jitter stop tables ----------------------------------------------------

/** The three desync flicker variants — [phase, depth] pairs copied VERBATIM
 *  from the old `t-jitter-a/b/c` CSS keyframes (13 stops each, linear
 *  timing). 0% and 100% match so the loop is seamless. */
const JITTER_STOPS: Record<JitterVariant, [number, number][]> = {
	a: [
		[0, 0.625],
		[0.08, 0.25],
		[0.17, 0.875],
		[0.25, 0],
		[0.33, 0.75],
		[0.42, 0.125],
		[0.5, 1],
		[0.58, 0.125],
		[0.67, 0.75],
		[0.75, 0.25],
		[0.83, 0.875],
		[0.92, 0.375],
		[1, 0.625]
	],
	b: [
		[0, 0.625],
		[0.11, 0.125],
		[0.18, 0.75],
		[0.28, 0.5],
		[0.36, 0],
		[0.44, 0.875],
		[0.53, 0.125],
		[0.61, 1],
		[0.7, 0.25],
		[0.78, 0.75],
		[0.86, 0],
		[0.94, 0.75],
		[1, 0.625]
	],
	c: [
		[0, 0.625],
		[0.07, 0.75],
		[0.14, 0],
		[0.22, 0.875],
		[0.29, 0.25],
		[0.37, 0.75],
		[0.46, 0.125],
		[0.54, 1],
		[0.63, 0.25],
		[0.71, 0.75],
		[0.8, 0.125],
		[0.89, 0.875],
		[1, 0.625]
	]
};

const STOPS_PER_VARIANT = 13;
const VARIANT_ORDER: readonly JitterVariant[] = ['a', 'b', 'c'];
const ANIM_INDEX: Record<StarAnimation, number> = { gentle: 0, jitter: 1, dramatic: 2 };

// --- Shaders ----------------------------------------------------------------

/**
 * Vertex shader: places the star in WORLD space (the sky region rect + the
 * camera, exactly like the plate quads) and evaluates its animation family
 * at u_time.
 *
 *  - gentle:   opacity 0.2·base → 1 → 0.2·base (raised cosine).
 *  - jitter:   13-stop piecewise-LINEAR flicker (variants a/b/c) — exact.
 *              Heroes (shape 2) flicker at half depth.
 *  - dramatic: opacity 0.15·base → 1 with scale(1 → 1.15) at peak (retired
 *              from generation, kept for decoder compatibility).
 */
const VERTEX_SRC = `
precision highp float;

attribute vec2 a_pos;      // star position, % of the sky region
attribute vec2 a_sizeBase; // x: core diameter (CSS px)   y: resting opacity floor
attribute vec2 a_timing;   // x: cycle duration (s)       y: phase offset (s)
attribute vec3 a_kind;     // x: anim family 0|1|2   y: jitter variant 0|1|2   z: shape 0 bare | 1 halo | 2 hero ✦
attribute vec3 a_color;    // resolved tint, 0-1

uniform vec2 u_view;    // viewport CSS size (px)
uniform vec2 u_cam;     // camera pose, CSS px (same convention as the plates)
uniform vec4 u_region;  // sky region world rect: x, y, w, h (CSS px)
uniform float u_dpr;    // backing-store device px per CSS px
uniform float u_time;   // seconds
uniform float u_static; // >= 0: static frame at this uniform opacity; < 0: animate
uniform float u_jPos[${3 * STOPS_PER_VARIANT}];
uniform float u_jK[${3 * STOPS_PER_VARIANT}];

varying vec3 v_color;
varying float v_alpha;
varying float v_core; // core disc (or hero arm) radius as a fraction of the sprite radius
varying float v_halo; // shape code: 0 bare disc, 1 disc + halo, 2 hero ✦
varying float v_aa;   // one device px in point-coord r units

const float TAU = 6.28318530718;
const float FLICKER = ${FLICKER};
const float HERO_FLICKER = ${HERO_FLICKER_SCALE};
const float HALO_SCALE = ${HALO_SCALE};

float jitterK(float phase, int variant) {
	float k = 0.0;
	for (int i = 0; i < ${STOPS_PER_VARIANT - 1}; i++) {
		int j = variant * ${STOPS_PER_VARIANT} + i;
		float p0 = u_jPos[j];
		float p1 = u_jPos[j + 1];
		if (phase >= p0 && phase <= p1) {
			k = mix(u_jK[j], u_jK[j + 1], (phase - p0) / max(p1 - p0, 1e-4));
		}
	}
	return k;
}

void main() {
	float phase = fract((u_time + a_timing.y) / a_timing.x);
	float alpha;
	float scale = 1.0;
	if (u_static >= 0.0) {
		alpha = u_static;
	} else if (a_kind.x < 0.5) { // gentle
		float pulse = 0.5 - 0.5 * cos(TAU * phase);
		alpha = mix(a_sizeBase.y * 0.2, 1.0, pulse);
	} else if (a_kind.x < 1.5) { // jitter
		// Heroes (shape 2) flicker at half depth — they peak at base = 1 and
		// should only shimmer, not strobe.
		float flick = FLICKER * mix(1.0, HERO_FLICKER, step(1.5, a_kind.z));
		alpha = a_sizeBase.y * (1.0 - flick * jitterK(phase, int(a_kind.y + 0.5)));
	} else {                     // dramatic
		float pulse = 0.5 - 0.5 * cos(TAU * phase);
		alpha = mix(a_sizeBase.y * 0.15, 1.0, pulse);
		scale = 1.0 + 0.15 * pulse;
	}

	// Halo stars AND heroes get the enlarged sprite; step() because
	// a_kind.z = 2.0 must not extrapolate the mix.
	float haloMul = mix(1.0, HALO_SCALE, step(0.5, a_kind.z));
	float spritePx = a_sizeBase.x * haloMul * scale * u_dpr;
	// Heroes: round to the nearest ODD device-pixel size — a pixel-centered
	// square with an even (or driver-rounded) size shifts half a pixel to one
	// side and biases the ✦ arms.
	spritePx = mix(spritePx, floor(spritePx * 0.5) * 2.0 + 1.0, step(1.5, a_kind.z));
	gl_PointSize = max(spritePx, 1.0);

	// World position: the old spans were positioned by their top-left corner,
	// so the center sits half a core-size beyond the region-relative point.
	// The camera is ADDED like the plate quads' vertex shader.
	vec2 world = u_region.xy + a_pos * 0.01 * u_region.zw + a_sizeBase.x * 0.5 + u_cam;
	// Heroes snap to DEVICE-PIXEL CENTERS: a fractional center splits a
	// sub-pixel arm across two columns/rows and the arms render unequal.
	vec2 dev = world * u_dpr;
	world = mix(world, (floor(dev) + 0.5) / u_dpr, step(1.5, a_kind.z));
	vec2 clip = world / u_view * 2.0 - 1.0;
	gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);

	v_color = a_color;
	v_alpha = alpha;
	v_core = 1.0 / haloMul;
	v_halo = a_kind.z;
	v_aa = 2.0 / max(spritePx, 1.0);
}
`;

/**
 * Fragment shader: core disc + eased halo — or the hero ✦ light model — in
 * one sprite, no textures. Per-sprite-coherent branch; with a couple dozen
 * heroes a second draw call would be structure without benefit.
 *
 * Output is PREMULTIPLIED: (color·a, a) with a (ONE, ONE_MINUS_SRC_ALPHA)
 * blend — straight alpha into a transparent target double-attenuates.
 */
const FRAGMENT_SRC = `
precision mediump float;

varying vec3 v_color;
varying float v_alpha;
varying float v_core;
varying float v_halo;
varying float v_aa;

const float HALO_INTENSITY = ${HALO_INTENSITY};
const float HERO_ARM_W = ${HERO_ARM_W};
const float HERO_CORE = ${HERO_CORE};
const float HERO_REACH = ${HERO_ARM_REACH};
const float HERO_GLOW = ${HERO_GLOW_INTENSITY};

void main() {
	vec2 p = gl_PointCoord * 2.0 - 1.0;
	float r = length(p);
	float fall = max(1.0 - r, 0.0); // clamp: r > 1 in sprite corners
	float a;
	if (v_halo > 1.5) {
		// Hero ✦ as LIGHT: gaussian-across × t^1.5-tapered arms + gaussian
		// core knot + the soft radial glow. Smooth analytic falloffs — no AA
		// machinery, no singular axes, x/y symmetric by construction.
		vec2 q = abs(p);
		float w = max(HERO_ARM_W * v_core, v_aa);
		float armLen = v_core * HERO_REACH;
		float tY = max(1.0 - q.y / armLen, 0.0);
		float tX = max(1.0 - q.x / armLen, 0.0);
		float arms = exp(-(q.x * q.x) / (w * w)) * tY * sqrt(tY)
		           + exp(-(q.y * q.y) / (w * w)) * tX * sqrt(tX);
		float c = HERO_CORE * v_core;
		float core = exp(-dot(p, p) / (c * c));
		float i = clamp(core + arms, 0.0, 1.0);
		float glow = HERO_GLOW * fall * fall;
		a = (i + glow * (1.0 - i)) * v_alpha;
	} else {
		float core = clamp((v_core - r) / v_aa + 0.5, 0.0, 1.0);
		float halo = v_halo * HALO_INTENSITY * fall * fall;
		a = (core + halo * (1.0 - core)) * v_alpha;
	}
	gl_FragColor = vec4(v_color * a, a);
}
`;

// --- The pass ----------------------------------------------------------------

const FLOATS_PER_STAR = 12;

export interface StarPassDrawOpts {
	/** Time in ms (performance.now() clock — phases are absolute). */
	timeMs: number;
	/** Viewport CSS size. */
	view: { w: number; h: number };
	/** Camera pose in CSS px (the plates' uCam convention). */
	cam: { x: number; y: number };
	/** Sky region world rect in CSS px (from the scene's buildQuads). */
	region: { x: number; y: number; w: number; h: number };
	/** Backing-store device px per CSS px. */
	dpr: number;
	/** >= 0 renders a static frame at that opacity (reduced motion). */
	staticAlpha: number;
}

export interface StarPass {
	/** Draw the field. Leaves blend state disabled and attrib arrays 0/1
	 *  enabled (the scene's plate convention). */
	draw(opts: StarPassDrawOpts): void;
	destroy(): void;
}

function compileShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
	const shader = gl.createShader(type)!;
	gl.shaderSource(shader, src);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		throw new Error(`starPass shader: ${gl.getShaderInfoLog(shader) ?? 'compile failed'}`);
	}
	return shader;
}

function buildVertexData(): Float32Array {
	const data = new Float32Array(stars.length * FLOATS_PER_STAR);
	let o = 0;
	for (const s of stars) {
		const [r, g, b] = TINTS[s.color];
		data[o++] = s.x;
		data[o++] = s.y;
		data[o++] = s.size;
		data[o++] = s.base;
		data[o++] = s.duration;
		data[o++] = s.delay;
		data[o++] = ANIM_INDEX[s.animation];
		data[o++] = s.variant ? VARIANT_ORDER.indexOf(s.variant) : 0;
		data[o++] = s.hero ? 2 : s.halo ? 1 : 0;
		data[o++] = r;
		data[o++] = g;
		data[o++] = b;
	}
	return data;
}

/** Build the star pass on the scene's GL context. Called at mount and again
 *  after context restore (GL resources die with the context). Throws on
 *  compile/link failure — the scene treats that like any mount error. */
export function createStarPass(gl: WebGLRenderingContext): StarPass {
	const program = gl.createProgram()!;
	gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, VERTEX_SRC));
	gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SRC));
	gl.linkProgram(program);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		throw new Error(`starPass link: ${gl.getProgramInfoLog(program) ?? 'link failed'}`);
	}

	const buf = gl.createBuffer()!;
	gl.bindBuffer(gl.ARRAY_BUFFER, buf);
	gl.bufferData(gl.ARRAY_BUFFER, buildVertexData(), gl.STATIC_DRAW);
	gl.bindBuffer(gl.ARRAY_BUFFER, null);

	const stride = FLOATS_PER_STAR * 4;
	const attribs: [name: string, size: number, offset: number][] = [
		['a_pos', 2, 0],
		['a_sizeBase', 2, 8],
		['a_timing', 2, 16],
		['a_kind', 3, 24],
		['a_color', 3, 36]
	];
	const locs = attribs.map(([name]) => gl.getAttribLocation(program, name));

	// Static uniforms — set once (program state persists).
	gl.useProgram(program);
	const jPos = new Float32Array(3 * STOPS_PER_VARIANT);
	const jK = new Float32Array(3 * STOPS_PER_VARIANT);
	VARIANT_ORDER.forEach((v, vi) => {
		JITTER_STOPS[v].forEach(([p, k], si) => {
			jPos[vi * STOPS_PER_VARIANT + si] = p;
			jK[vi * STOPS_PER_VARIANT + si] = k;
		});
	});
	gl.uniform1fv(gl.getUniformLocation(program, 'u_jPos'), jPos);
	gl.uniform1fv(gl.getUniformLocation(program, 'u_jK'), jK);

	const u = (name: string) => gl.getUniformLocation(program, name)!;
	const uTime = u('u_time');
	const uView = u('u_view');
	const uCam = u('u_cam');
	const uRegion = u('u_region');
	const uDpr = u('u_dpr');
	const uStatic = u('u_static');

	return {
		draw({ timeMs, view, cam, region, dpr, staticAlpha }) {
			gl.useProgram(program);
			gl.bindBuffer(gl.ARRAY_BUFFER, buf);
			for (let i = 0; i < attribs.length; i++) {
				gl.enableVertexAttribArray(locs[i]);
				gl.vertexAttribPointer(locs[i], attribs[i][1], gl.FLOAT, false, stride, attribs[i][2]);
			}
			gl.uniform1f(uTime, timeMs / 1000);
			gl.uniform2f(uView, view.w, view.h);
			gl.uniform2f(uCam, cam.x, cam.y);
			gl.uniform4f(uRegion, region.x, region.y, region.w, region.h);
			gl.uniform1f(uDpr, dpr);
			gl.uniform1f(uStatic, staticAlpha);

			// Premultiplied source-over, scoped to this pass — the plates draw
			// opaque with blending off.
			gl.enable(gl.BLEND);
			gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
			gl.drawArrays(gl.POINTS, 0, stars.length);
			gl.disable(gl.BLEND);

			// Leave no star-only attrib arrays enabled behind us — an enabled
			// array pointing into a stale buffer trips draw validation on some
			// drivers when the plate passes run next.
			for (const loc of locs) if (loc > 1) gl.disableVertexAttribArray(loc);
		},
		destroy() {
			gl.deleteBuffer(buf);
			gl.deleteProgram(program);
		}
	};
}
