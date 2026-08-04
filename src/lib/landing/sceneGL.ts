/**
 * The GL scene world — plates + gradient rendered into ONE fixed canvas with
 * the camera as a uniform (branch experiment/ascend-pan; ascend revival
 * 2026-08-02, structure only — coloring untouched pending Nate's palette
 * session).
 *
 * Why: the DOM scene pan is dead on Firefox/WebRender (re-verified 2026-08-02
 * — a slow eased translate of full-viewport surfaces trundles no matter how
 * light the layers are), while a camera-uniform pan of a static-size canvas is
 * smooth in all three engines (stage-2 probe verdict). So the world stops
 * being DOM elements that move and becomes a renderer with a camera.
 *
 * What this module renders, back to front, in world space (CSS px, origin at
 * the viewport's top-left at rest, y down):
 *   1. the .sky-bg vertical gradient (vertex colors; pans vertically only)
 *   2. the sky plate  (texture + in-shader grain, pans + cranes)
 *   3. the floor plate (texture + in-shader grain, pans + cranes)
 * (Cursor parallax retired with the ascend rebuild, Nate 2026-08-02 — the
 * "feels alive" job it did is superseded by the camera itself.)
 *
 * Still DOM for now (converts in the follow-up chunk): the twinkle starfield
 * and shooting stars (small surfaces, static at rest; they must join this
 * canvas before the real ascend choreography ships — a DOM-translating star
 * canvas would reintroduce the exact Firefox failure this exists to fix), and
 * the composition/dim layers (deliberately DOM).
 *
 * Knobs (read from computed style on .scene-stack, dire-border pattern):
 * --sky-top/--sky-bottom (gradient), --sky-grain/--floor-grain (grain
 * opacity). After devtools edits call window.__scene.retune(). Colors are
 * resolved via a 1×1 canvas fill, never string-parsed (engine lesson: Chrome
 * serializes relative colors as color(srgb …)).
 *
 * Known interim diffs vs the DOM scene (accepted for the structure round):
 * the near-white noise haze on the gradient region is omitted (visible only
 * in ultrawide gutters; the gradient may band there until the color session).
 * Grain rides the WORLD (uGrainOff) as of 2026-08-04 — screen-fixed grain
 * read as a static noise curtain during the pan.
 */

import {
	SCENE_SKY,
	SCENE_FLOOR,
	SCENE_GRAIN,
	SCENE_GRAIN_SIGMA,
	SCENE_TIERS
} from '$lib/data/sceneAssets.generated';

// --- Geometry constants -----------------------------------------------------
// Mirror the --*-src vars on .scene-stack in (scene)/+layout.svelte AND the
// REGIONS in scripts/optimize-bg.js — the three move together when a new
// master lands.
//
// The 6400×4000 ascend master (Nate's Blender re-export, plate v3
// 2026-08-04): 5120 frame + 640px bleed per side; horizon at row 2675; the
// ~1740 rows above the rest frame are the ascend sky the camera tilts up into.

const FRAME_W_SRC = 5120;
const PLATE_W_SRC = 6400;
const SKY_H_SRC = 2675;
const FLOOR_H_SRC = 1325;
const BLEED_V_SRC = 66;
const MASTER_H_SRC = SKY_H_SRC + FLOOR_H_SRC;
const SKY_OVERLAP_SRC = 4;
const VIEWPORT_ASPECT = 21 / 9;

/** Viewport height in source rows — the frame maps to vh × 21/9 wide, so one
 *  viewport is FRAME_W/(21/9) ≈ 2194 src rows regardless of aspect. */
const VIEWPORT_H_SRC = FRAME_W_SRC / VIEWPORT_ASPECT;

/** Backing-store DPR cap (dire-border precedent — crest softness vs memory). */
const MAX_BACKING_DPR = 2;

/** Grain tile edge in DEVICE px — one texel per device pixel at every scale
 *  (the layout's old per-dppx background-size ladder, now free via
 *  gl_FragCoord, which is already device-space). */
const GRAIN_TILE_PX = 128;

// Cinematic tilt-up, used by the dev probe toggle (choreography proper lands
// with the transition rebuild). The crest MIRRORS the rest pose: rest leaves
// 66 src rows of bleed below the viewport, the crest leaves 66 above it, so
// the pan is everything between — (master − 2·bleed − viewport) src rows,
// ≈76.3dvh on the 6400×4000 master. The plate was composed to this crest
// (Nate's destination guide frame); tune the ART, derive the pan.
const PAN_DVH = ((MASTER_H_SRC - 2 * BLEED_V_SRC - VIEWPORT_H_SRC) / VIEWPORT_H_SRC) * 100;
const PAN_MS = 2400;
const SIDE_LEAN_DEG = 16;
const TILT_BEZ = [0.58, 0, 0.42, 1] as const;

// --- Small helpers ----------------------------------------------------------

function bezierEase(t: number): number {
	if (t <= 0) return 0;
	if (t >= 1) return 1;
	const cx = 3 * TILT_BEZ[0];
	const bx = 3 * (TILT_BEZ[2] - TILT_BEZ[0]) - cx;
	const ax = 1 - cx - bx;
	const cy = 3 * TILT_BEZ[1];
	const by = 3 * (TILT_BEZ[3] - TILT_BEZ[1]) - cy;
	const ay = 1 - cy - by;
	let u = t;
	for (let i = 0; i < 8; i++) {
		const x = ((ax * u + bx) * u + cx) * u - t;
		const dx = (3 * ax * u + 2 * bx) * u + cx;
		if (Math.abs(x) < 1e-6 || dx === 0) break;
		u -= x / dx;
	}
	return ((ay * u + by) * u + cy) * u;
}

/** Resolve any CSS color to [r,g,b] 0..1 via a 1×1 canvas fill. */
function resolveColor(css: string): [number, number, number] {
	const c = document.createElement('canvas');
	c.width = c.height = 1;
	const ctx = c.getContext('2d')!;
	ctx.fillStyle = '#000';
	ctx.fillStyle = css;
	ctx.fillRect(0, 0, 1, 1);
	const d = ctx.getImageData(0, 0, 1, 1).data;
	return [d[0] / 255, d[1] / 255, d[2] / 255];
}

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
	const sh = gl.createShader(type)!;
	gl.shaderSource(sh, src);
	gl.compileShader(sh);
	if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
		throw new Error(`scene shader: ${gl.getShaderInfoLog(sh)}`);
	}
	return sh;
}

function link(gl: WebGLRenderingContext, vs: string, fs: string): WebGLProgram {
	const p = gl.createProgram()!;
	gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
	gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
	gl.linkProgram(p);
	if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
		throw new Error(`scene link: ${gl.getProgramInfoLog(p)}`);
	}
	return p;
}

const VS = `
attribute vec2 aPos;
attribute vec3 aAux;
uniform vec2 uView;
uniform vec2 uCam;
varying vec3 vAux;
void main() {
	vec2 p = aPos + uCam;
	gl_Position = vec4(p.x / uView.x * 2.0 - 1.0, 1.0 - p.y / uView.y * 2.0, 0.0, 1.0);
	vAux = aAux;
}`;

const FS_COLOR = `
precision mediump float;
varying vec3 vAux;
void main() { gl_FragColor = vec4(vAux, 1.0); }`;

// Plate fragment: texture + the grain dither, ported from the DOM's
// .sky::after/.floor::after — mid-grey tile, overlay blend, opacity knob.
// gl_FragCoord is device px, so uv = fragcoord/128 maps one texel to one
// device pixel exactly as the old per-dppx background-size ladder did.
//
// uDither is a separate ADDITIVE dither term (same tile, luminance-
// independent). It exists because overlay's dark branch is 2·b·g — the grain's
// perturbation scales with base brightness and all but vanishes in the darkest
// sky rows, which is exactly where a smooth 16-bit gradient quantised to 8-bit
// bands hardest (measured 95.9% plateau on the v2 sky's top half, 2026-08-04).
// An additive ±few-levels term breaks those contours at any brightness; the
// tile is grayscale so this is pure luminance dither, no chroma noise.
// uGrainOff pins the tile to the WORLD rather than the viewport: it is the
// camera pose in device px (x negated, y as-is — gl_FragCoord is y-up), so
// during a pan the grain translates with the plate instead of reading as a
// static noise curtain the art slides beneath (Nate caught this on the v2
// pan, 2026-08-04). Still exactly one texel per device pixel at rest and in
// motion — only the tile's phase moves.
const FS_PLATE = `
precision mediump float;
uniform sampler2D uTex;
uniform sampler2D uGrain;
uniform float uGrainAmt;
uniform float uDither;
uniform vec2 uGrainOff;
varying vec3 vAux;
vec3 overlay(vec3 b, vec3 g) {
	vec3 lo = 2.0 * b * g;
	vec3 hi = 1.0 - 2.0 * (1.0 - b) * (1.0 - g);
	return mix(lo, hi, step(0.5, b));
}
void main() {
	vec3 base = texture2D(uTex, vAux.xy).rgb;
	vec3 g = texture2D(uGrain, (gl_FragCoord.xy + uGrainOff) / ${GRAIN_TILE_PX}.0).rgb;
	vec3 col = mix(base, overlay(base, g), uGrainAmt);
	col += (g - 128.0 / 255.0) * uDither;
	gl_FragColor = vec4(col, 1.0);
}`;

type Quad = { buf: WebGLBuffer; count: number };

function makeQuad(gl: WebGLRenderingContext, verts: number[]): Quad {
	const buf = gl.createBuffer()!;
	gl.bindBuffer(gl.ARRAY_BUFFER, buf);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
	return { buf, count: verts.length / 5 };
}

function texQuad(gl: WebGLRenderingContext, x: number, y: number, w: number, h: number): Quad {
	const [x2, y2] = [x + w, y + h];
	// prettier-ignore
	return makeQuad(gl, [
		x, y, 0, 0, 0,   x2, y, 1, 0, 0,   x, y2, 0, 1, 0,
		x2, y, 1, 0, 0,  x2, y2, 1, 1, 0,  x, y2, 0, 1, 0
	]);
}

function gradQuad(
	gl: WebGLRenderingContext,
	x: number,
	y: number,
	w: number,
	h: number,
	top: readonly number[],
	bot: readonly number[]
): Quad {
	const [x2, y2] = [x + w, y + h];
	// prettier-ignore
	return makeQuad(gl, [
		x, y, ...top,   x2, y, ...top,   x, y2, ...bot,
		x2, y, ...top,  x2, y2, ...bot,  x, y2, ...bot
	]);
}

// --- Renderer ---------------------------------------------------------------

export interface SceneGLHandle {
	/** Animate the camera to a pose; resolves at settle. Interruptible. */
	animateCamera(to: { x: number; y: number }, durationMs?: number): Promise<void>;
	/** Jump the camera (reduced motion / cold-load poses). */
	snapCamera(to: { x: number; y: number }): void;
	/** Current camera pose (sans parallax). */
	camera(): { x: number; y: number };
	/** True while a camera animation is in flight. */
	animating(): boolean;
	/** Re-read the CSS knobs (gradient stops, grain opacities) and redraw. */
	retune(): void;
	destroy(): void;
}

let current: SceneGLHandle | null = null;

/** The mounted renderer, for choreography and the dev probe. */
export function getSceneGL(): SceneGLHandle | null {
	return current;
}

function pickTier(neededPx: number, maxTex: number): number {
	const fitting = SCENE_TIERS.filter((w) => w <= maxTex);
	for (const w of fitting) if (w >= neededPx) return w;
	return fitting[fitting.length - 1] ?? SCENE_TIERS[0];
}

async function decodeImage(url: string): Promise<HTMLImageElement> {
	const img = new Image();
	img.src = url;
	await img.decode();
	return img;
}

/** Decode a plate at `base` (no extension): AVIF first — the shipped format,
 *  better gradient fidelity per byte — falling back to WebP where the browser
 *  can't decode AVIF (pre-16.4 Safari). `img.decode()` rejects on an
 *  unsupported format, so the fallback costs nothing when AVIF works. The GL
 *  texture upload takes the DECODED bitmap, so the renderer is format-
 *  agnostic; this choice is purely about what travels the wire. */
async function decodePlate(base: string): Promise<HTMLImageElement> {
	try {
		return await decodeImage(`${base}.avif`);
	} catch {
		return await decodeImage(`${base}.webp`);
	}
}

function uploadTexture(
	gl: WebGLRenderingContext,
	img: HTMLImageElement | HTMLCanvasElement,
	opts: { repeat?: boolean; nearest?: boolean } = {}
): WebGLTexture {
	const tex = gl.createTexture()!;
	gl.bindTexture(gl.TEXTURE_2D, tex);
	const wrap = opts.repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
	const filter = opts.nearest ? gl.NEAREST : gl.LINEAR;
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
	return tex;
}

/**
 * Mount the scene renderer on a canvas. Resolves once the first full frame
 * (textures included) has been submitted — the veil-release moment.
 */
export async function mountSceneGL(canvas: HTMLCanvasElement): Promise<SceneGLHandle> {
	const glMaybe = canvas.getContext('webgl', { alpha: false, antialias: false });
	if (!glMaybe) throw new Error('scene: WebGL unavailable');
	const gl: WebGLRenderingContext = glMaybe;

	const dpr = Math.min(window.devicePixelRatio || 1, MAX_BACKING_DPR);

	// Knobs off .scene-stack (the canvas's parent chain).
	const knobs = () => {
		const cs = getComputedStyle(canvas);
		const dither = parseFloat(cs.getPropertyValue('--scene-dither'));
		return {
			skyTop: resolveColor(cs.getPropertyValue('--sky-top') || '#0a0e1a'),
			skyBottom: resolveColor(cs.getPropertyValue('--sky-bottom') || '#1f2a48'),
			bg: resolveColor(cs.getPropertyValue('--bg') || '#060914'),
			skyGrain: parseFloat(cs.getPropertyValue('--sky-grain')) || 0,
			floorGrain: parseFloat(cs.getPropertyValue('--floor-grain')) || 0,
			// Additive dither σ in 8-bit levels (see FS_PLATE). Defaults on: the
			// darkest sky rows band without it even at high encode quality.
			dither: Number.isFinite(dither) ? dither : 1
		};
	};
	let k = knobs();

	const progColor = link(gl, VS, FS_COLOR);
	const progPlate = link(gl, VS, FS_PLATE);

	const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
	const plateCssW = () => window.innerHeight * VIEWPORT_ASPECT * (PLATE_W_SRC / FRAME_W_SRC);
	const tier = pickTier(plateCssW() * dpr, maxTex);
	// Keep the decoded images for context-restore re-uploads.
	const [skyImg, floorImg, grainImg] = await Promise.all([
		decodePlate(`${SCENE_SKY}-${tier}w`),
		decodePlate(`${SCENE_FLOOR}-${tier}w`),
		decodeImage(SCENE_GRAIN)
	]);
	let skyTex = uploadTexture(gl, skyImg);
	let floorTex = uploadTexture(gl, floorImg);
	let grainTex = uploadTexture(gl, grainImg, { repeat: true, nearest: true });

	let quads: { skyBg: Quad; sky: Quad; floor: Quad } | null = null;

	const cam = { x: 0, y: 0 };
	let raf = 0;
	let animPending = false;
	let animTag = 0;
	let destroyed = false;
	let lost = false;

	function size() {
		canvas.width = Math.round(window.innerWidth * dpr);
		canvas.height = Math.round(window.innerHeight * dpr);
	}

	function buildQuads() {
		const vw = window.innerWidth;
		const vh = window.innerHeight;
		const px = (vh * VIEWPORT_ASPECT) / FRAME_W_SRC;
		const sceneH = MASTER_H_SRC * px;
		const plateW = PLATE_W_SRC * px;
		const plateX = (vw - plateW) / 2;
		const horizonY = (FLOOR_H_SRC - BLEED_V_SRC) * px;
		const skyH = (SKY_H_SRC + SKY_OVERLAP_SRC) * px;
		const skyTop = vh - horizonY + SKY_OVERLAP_SRC * px - skyH;
		const floorH = FLOOR_H_SRC * px;
		const floorTop = vh + BLEED_V_SRC * px - floorH;
		if (quads) for (const q of Object.values(quads)) gl.deleteBuffer(q.buf);
		quads = {
			skyBg: gradQuad(gl, 0, vh - sceneH, vw, sceneH, k.skyTop, k.skyBottom),
			sky: texQuad(gl, plateX, skyTop, plateW, skyH),
			floor: texQuad(gl, plateX, floorTop, plateW, floorH)
		};
	}

	function drawNow() {
		if (destroyed || lost || !quads) return;
		const vw = window.innerWidth;
		const vh = window.innerHeight;
		gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
		gl.clearColor(k.bg[0], k.bg[1], k.bg[2], 1);
		gl.clear(gl.COLOR_BUFFER_BIT);

		const bind = (prog: WebGLProgram, q: Quad, camX: number, grainAmt: number) => {
			gl.useProgram(prog);
			gl.bindBuffer(gl.ARRAY_BUFFER, q.buf);
			const aPos = gl.getAttribLocation(prog, 'aPos');
			const aAux = gl.getAttribLocation(prog, 'aAux');
			gl.enableVertexAttribArray(aPos);
			gl.enableVertexAttribArray(aAux);
			gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 20, 0);
			gl.vertexAttribPointer(aAux, 3, gl.FLOAT, false, 20, 8);
			gl.uniform2f(gl.getUniformLocation(prog, 'uView'), vw, vh);
			gl.uniform2f(gl.getUniformLocation(prog, 'uCam'), camX, cam.y);
			const uTex = gl.getUniformLocation(prog, 'uTex');
			if (uTex) {
				gl.uniform1i(uTex, 0);
				gl.uniform1i(gl.getUniformLocation(prog, 'uGrain'), 1);
				gl.uniform1f(gl.getUniformLocation(prog, 'uGrainAmt'), grainAmt);
				// (grain − mid) has σ = SCENE_GRAIN_SIGMA levels; scale so the
				// additive term's σ is the knob's value in levels.
				gl.uniform1f(gl.getUniformLocation(prog, 'uDither'), k.dither / SCENE_GRAIN_SIGMA);
				// World-pinned grain: this quad's camera offset in device px
				// (see the FS_PLATE note on signs).
				gl.uniform2f(gl.getUniformLocation(prog, 'uGrainOff'), -camX * dpr, cam.y * dpr);
			}
			gl.drawArrays(gl.TRIANGLES, 0, q.count);
		};

		// sky-bg: vertical pan only, never cranes — it's the fixed full-viewport
		// backdrop any camera-revealed edge falls back to.
		bind(progColor, quads.skyBg, 0, 0);
		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_2D, grainTex);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, skyTex);
		bind(progPlate, quads.sky, cam.x, k.skyGrain);
		gl.bindTexture(gl.TEXTURE_2D, floorTex);
		bind(progPlate, quads.floor, cam.x, k.floorGrain);
	}

	/** rAF-coalesced draw for on-demand updates (parallax, resize, retune). */
	function requestDraw() {
		if (raf || animPending) return;
		raf = requestAnimationFrame(() => {
			raf = 0;
			drawNow();
		});
	}

	function onResize() {
		size();
		buildQuads();
		requestDraw();
	}
	window.addEventListener('resize', onResize);

	function onContextLost(e: Event) {
		e.preventDefault();
		lost = true;
	}
	function onContextRestored() {
		lost = false;
		skyTex = uploadTexture(gl, skyImg);
		floorTex = uploadTexture(gl, floorImg);
		grainTex = uploadTexture(gl, grainImg, { repeat: true, nearest: true });
		buildQuads();
		requestDraw();
	}
	canvas.addEventListener('webglcontextlost', onContextLost);
	canvas.addEventListener('webglcontextrestored', onContextRestored);

	const handle: SceneGLHandle = {
		animateCamera(to, durationMs = PAN_MS) {
			const tag = ++animTag;
			const from = { x: cam.x, y: cam.y };
			const start = performance.now();
			animPending = true;
			if (raf) {
				cancelAnimationFrame(raf);
				raf = 0;
			}
			return new Promise((resolve) => {
				const step = (now: number) => {
					if (destroyed || tag !== animTag) return resolve();
					const t = Math.min(1, (now - start) / durationMs);
					const e = bezierEase(t);
					cam.x = from.x + (to.x - from.x) * e;
					cam.y = from.y + (to.y - from.y) * e;
					drawNow();
					if (t < 1) {
						requestAnimationFrame(step);
					} else {
						animPending = false;
						resolve();
					}
				};
				requestAnimationFrame(step);
			});
		},
		snapCamera(to) {
			animTag++;
			animPending = false;
			cam.x = to.x;
			cam.y = to.y;
			requestDraw();
		},
		camera: () => ({ ...cam }),
		animating: () => animPending,
		retune() {
			k = knobs();
			buildQuads();
			requestDraw();
		},
		destroy() {
			destroyed = true;
			animTag++;
			if (raf) cancelAnimationFrame(raf);
			window.removeEventListener('resize', onResize);
			canvas.removeEventListener('webglcontextlost', onContextLost);
			canvas.removeEventListener('webglcontextrestored', onContextRestored);
			gl.getExtension('WEBGL_lose_context')?.loseContext();
			if (current === handle) current = null;
		}
	};

	size();
	buildQuads();
	drawNow();
	current = handle;
	(window as unknown as Record<string, unknown>).__scene = { retune: handle.retune };
	return handle;
}

// --- Dev probe toggle (branch artifact — bare `g` on the landing) -----------

let probeUp = false;
let probeLeanIdx = 0;
const PROBE_LEANS: Array<-1 | 0 | 1> = [0, 1, -1];

function setDomHidden(hidden: boolean): void {
	// Interim: the DOM starfield/meteors and the composition can't ride the GL
	// camera yet (they convert with the choreography chunk), so the probe pans
	// a pure scene. Restored at rest.
	for (const sel of ['.twinkle', '.meteors', '.composition']) {
		const el = document.querySelector<HTMLElement>(sel);
		if (el) el.style.visibility = hidden ? 'hidden' : '';
	}
}

/** Toggle the historical 75dvh move on the live renderer, cycling crane
 *  variants — Nate's cross-browser smoothness instrument. */
export function scenePanProbeToggle(): void {
	const s = getSceneGL();
	if (!s) {
		console.warn('[ascend-pan probe GL] no scene renderer mounted');
		return;
	}
	const goingUp = !probeUp;
	probeUp = goingUp;
	const lean = PROBE_LEANS[probeLeanIdx];
	if (!goingUp) probeLeanIdx = (probeLeanIdx + 1) % PROBE_LEANS.length;

	const vh = window.innerHeight;
	const vw = window.innerWidth;
	const expose = () => {
		(window as unknown as Record<string, unknown>).__ascendGL = {
			up: probeUp,
			settled: !s.animating(),
			cam: s.camera()
		};
	};
	let target = { x: 0, y: 0 };
	if (goingUp) {
		setDomHidden(true);
		const frameW = vh * VIEWPORT_ASPECT;
		const overflow = Math.max(0, (frameW - vw) / 2) * 0.9;
		const mag = Math.min(
			Math.tan((SIDE_LEAN_DEG * Math.PI) / 180) * (PAN_DVH / 100) * vh,
			overflow
		);
		target = { x: lean === 0 ? 0 : lean * mag, y: (PAN_DVH / 100) * vh };
	}
	expose();
	const tick = setInterval(expose, 100);
	void s.animateCamera(target).then(() => {
		clearInterval(tick);
		expose();
		if (!probeUp) setDomHidden(false);
	});
	const label = !goingUp
		? 'return to rest'
		: lean === 0
			? 'up — straight tilt-up'
			: lean === 1
				? 'up — left-tool crane (world shifts right)'
				: 'up — right-tool crane (world shifts left)';
	console.log(`[ascend-pan probe GL] ${label}, ${PAN_MS}ms`);
}
