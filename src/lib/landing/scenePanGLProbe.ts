/**
 * Scene-in-WebGL pan probe (branch experiment/ascend-pan — NEVER MERGE AS-IS).
 *
 * Stage 2 of the ascend experiment. Stage 1 (bare `p`, DOM/WAAPI pan) re-ran
 * the 2026-06 verdict on today's scene: Chrome/Safari buttery, Firefox still
 * jerky — WebRender cannot pan full-viewport DOM surfaces on a slow eased
 * move. This module tests the prescribed fix: render the scene INTO one WebGL
 * canvas and move the CAMERA (a uniform), so the browser composites a single
 * static-size canvas and per-frame work is three quads on the GPU.
 *
 * Bare `g` on the landing toggles it: first press builds the renderer, hides
 * the DOM scene (+ the composition, so the comparison is pure scene motion),
 * and pans up; the next press pans back, and at rest the DOM scene is
 * restored so `p` (DOM) vs `g` (GL) can be compared back to back. Up-legs
 * cycle the same crane variants as the DOM probe.
 *
 * Probe honesty notes:
 *  - Geometry replicates the scene layout's horizon coordinate system
 *    (frame 5120 / plate 5340 / sky 1451 / floor 875 / bleed 66 source px).
 *  - The .sky-bg vertical gradient is drawn as a vertex-color quad; its
 *    noise overlay and the plate grain are OMITTED (banding is not under
 *    test). Stars are OMITTED — the real build must merge the starfield into
 *    this canvas (a separate DOM-translating twinkle canvas would reintroduce
 *    the exact Firefox failure under test).
 *  - The camera is rAF-driven on the main thread. A quiet landing gives rAF
 *    a clear run — that is the go/no-go question. Surviving a real tool
 *    mount flood mid-pan is the NEXT question (OffscreenCanvas worker is the
 *    escalation if needed).
 */

// --- Geometry constants (mirror .scene-stack in (scene)/+layout.svelte) -----

const FRAME_W_SRC = 5120;
const PLATE_W_SRC = 5340;
const SKY_H_SRC = 1451;
const FLOOR_H_SRC = 875;
const BLEED_V_SRC = 66;
const MASTER_H_SRC = SKY_H_SRC + FLOOR_H_SRC; // 2326
const SKY_OVERLAP_SRC = 4;
const VIEWPORT_ASPECT = 21 / 9;

const SKY_TOP = [0x0a / 255, 0x0e / 255, 0x1a / 255] as const;
const SKY_BOTTOM = [0x1f / 255, 0x2a / 255, 0x48 / 255] as const;
const CLEAR = [0x06 / 255, 0x09 / 255, 0x14 / 255] as const; // --bg

// Same move as the DOM probe: 75dvh over the historical cinematic duration,
// eased by the tilt bezier; up-legs cycle straight / left / right crane.
const PAN_DVH = 75;
const PAN_MS = 2400;
const SIDE_LEAN_DEG = 16;
const BEZ = [0.58, 0, 0.42, 1] as const; // TILT_EASING_CSS
const LEANS: Array<-1 | 0 | 1> = [0, 1, -1];
const MAX_DPR = 2;

import { SCENE_SKY, SCENE_FLOOR, SCENE_TIERS } from '$lib/data/sceneAssets.generated';

// --- Cubic-bezier easing (Newton, same curve WAAPI ran natively) ------------

function bezierEase(t: number): number {
	if (t <= 0) return 0;
	if (t >= 1) return 1;
	const [x1, , x2] = [BEZ[0], BEZ[1], BEZ[2]];
	const cx = 3 * x1;
	const bx = 3 * (x2 - x1) - cx;
	const ax = 1 - cx - bx;
	const cy = 3 * BEZ[1];
	const by = 3 * (BEZ[3] - BEZ[1]) - cy;
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

// --- Tiny GL helpers --------------------------------------------------------

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
	const sh = gl.createShader(type)!;
	gl.shaderSource(sh, src);
	gl.compileShader(sh);
	if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
		throw new Error(`shader: ${gl.getShaderInfoLog(sh)}`);
	}
	return sh;
}

function program(gl: WebGLRenderingContext, vs: string, fs: string): WebGLProgram {
	const p = gl.createProgram()!;
	gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
	gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
	gl.linkProgram(p);
	if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
		throw new Error(`link: ${gl.getProgramInfoLog(p)}`);
	}
	return p;
}

// World space = CSS px, origin at the viewport's top-left AT REST, y down.
// The vertex shader adds the camera offset and maps to clip space.
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
const FS_TEX = `
precision mediump float;
uniform sampler2D uTex;
varying vec3 vAux;
void main() { gl_FragColor = texture2D(uTex, vAux.xy); }`;

// Interleaved quads: per-vertex [x, y, aux0, aux1, aux2] as two triangles.
// aux = rgb for the gradient program, (u, v, unused) for the texture program.
type Quad = { buf: WebGLBuffer; count: number };

function makeQuad(gl: WebGLRenderingContext, verts: number[]): Quad {
	const buf = gl.createBuffer()!;
	gl.bindBuffer(gl.ARRAY_BUFFER, buf);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
	return { buf, count: verts.length / 5 };
}

/** Axis-aligned textured quad, v=0 at top. */
function texQuad(gl: WebGLRenderingContext, x: number, y: number, w: number, h: number): Quad {
	const [x2, y2] = [x + w, y + h];
	// prettier-ignore
	return makeQuad(gl, [
		x, y, 0, 0, 0,   x2, y, 1, 0, 0,   x, y2, 0, 1, 0,
		x2, y, 1, 0, 0,  x2, y2, 1, 1, 0,  x, y2, 0, 1, 0
	]);
}

/** Vertical-gradient quad, topColor at y, bottomColor at y+h. */
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

// --- The probe --------------------------------------------------------------

type ProbeState = {
	canvas: HTMLCanvasElement;
	gl: WebGLRenderingContext;
	progColor: WebGLProgram;
	progTex: WebGLProgram;
	skyTex: WebGLTexture;
	floorTex: WebGLTexture;
	quads: { skyBg: Quad; sky: Quad; floor: Quad } | null;
	cam: { x: number; y: number };
	raf: number;
	settled: boolean;
};

let state: ProbeState | null = null;
let loading = false;
let up = false;
let leanIdx = 0;

function pickTier(neededPx: number, maxTex: number): number {
	const fitting = SCENE_TIERS.filter((w) => w <= maxTex);
	for (const w of fitting) if (w >= neededPx) return w;
	return fitting[fitting.length - 1] ?? SCENE_TIERS[0];
}

async function loadTexture(gl: WebGLRenderingContext, url: string): Promise<WebGLTexture> {
	const img = new Image();
	img.src = url;
	await img.decode();
	const tex = gl.createTexture()!;
	gl.bindTexture(gl.TEXTURE_2D, tex);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
	return tex;
}

/** (Re)build the world-space quads for the current viewport size. */
function buildQuads(s: ProbeState): void {
	const vw = window.innerWidth;
	const vh = window.innerHeight;
	const px = (vh * VIEWPORT_ASPECT) / FRAME_W_SRC; // CSS px per source px
	const sceneH = MASTER_H_SRC * px;
	const plateW = PLATE_W_SRC * px;
	const plateX = (vw - plateW) / 2; // centered on the viewport, symmetric bleed
	const horizonY = (FLOOR_H_SRC - BLEED_V_SRC) * px; // up from viewport bottom
	const skyH = (SKY_H_SRC + SKY_OVERLAP_SRC) * px;
	const skyTop = vh - horizonY + SKY_OVERLAP_SRC * px - skyH;
	const floorH = FLOOR_H_SRC * px;
	const floorTop = vh + BLEED_V_SRC * px - floorH;

	const gl = s.gl;
	if (s.quads) for (const q of Object.values(s.quads)) gl.deleteBuffer(q.buf);
	s.quads = {
		// .sky-bg: full viewport width, scene height, bottom-anchored.
		skyBg: gradQuad(gl, 0, vh - sceneH, vw, sceneH, SKY_TOP, SKY_BOTTOM),
		sky: texQuad(gl, plateX, skyTop, plateW, skyH),
		floor: texQuad(gl, plateX, floorTop, plateW, floorH)
	};
}

function draw(s: ProbeState): void {
	const gl = s.gl;
	const vw = window.innerWidth;
	const vh = window.innerHeight;
	gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
	gl.clearColor(CLEAR[0], CLEAR[1], CLEAR[2], 1);
	gl.clear(gl.COLOR_BUFFER_BIT);
	if (!s.quads) return;

	const bind = (prog: WebGLProgram, q: Quad, camX: number) => {
		gl.useProgram(prog);
		gl.bindBuffer(gl.ARRAY_BUFFER, q.buf);
		const aPos = gl.getAttribLocation(prog, 'aPos');
		const aAux = gl.getAttribLocation(prog, 'aAux');
		gl.enableVertexAttribArray(aPos);
		gl.enableVertexAttribArray(aAux);
		gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 20, 0);
		gl.vertexAttribPointer(aAux, 3, gl.FLOAT, false, 20, 8);
		gl.uniform2f(gl.getUniformLocation(prog, 'uView'), vw, vh);
		gl.uniform2f(gl.getUniformLocation(prog, 'uCam'), camX, s.cam.y);
		const uTex = gl.getUniformLocation(prog, 'uTex');
		if (uTex) gl.uniform1i(uTex, 0);
		gl.drawArrays(gl.TRIANGLES, 0, q.count);
	};

	// sky-bg never cranes (matches restTransform: translateY only).
	bind(s.progColor, s.quads.skyBg, 0);
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, s.skyTex);
	bind(s.progTex, s.quads.sky, s.cam.x);
	gl.bindTexture(gl.TEXTURE_2D, s.floorTex);
	bind(s.progTex, s.quads.floor, s.cam.x);
}

function setDomHidden(hidden: boolean): void {
	for (const sel of ['.scene', '.composition']) {
		const el = document.querySelector<HTMLElement>(sel);
		if (el) el.style.visibility = hidden ? 'hidden' : '';
	}
}

function animateTo(s: ProbeState, tx: number, ty: number, onDone?: () => void): void {
	cancelAnimationFrame(s.raf);
	const from = { x: s.cam.x, y: s.cam.y };
	const start = performance.now();
	s.settled = false;
	const step = (now: number) => {
		const t = Math.min(1, (now - start) / PAN_MS);
		const e = bezierEase(t);
		s.cam.x = from.x + (tx - from.x) * e;
		s.cam.y = from.y + (ty - from.y) * e;
		draw(s);
		exposeDebug(s);
		if (t < 1) {
			s.raf = requestAnimationFrame(step);
		} else {
			s.settled = true;
			exposeDebug(s);
			onDone?.();
		}
	};
	s.raf = requestAnimationFrame(step);
}

function exposeDebug(s: ProbeState): void {
	(window as unknown as Record<string, unknown>).__ascendGL = {
		up,
		settled: s.settled,
		cam: { ...s.cam }
	};
}

async function init(): Promise<ProbeState> {
	const canvas = document.createElement('canvas');
	canvas.style.cssText =
		'position:fixed;inset:0;width:100dvw;height:100dvh;z-index:0;pointer-events:none;';
	const scene = document.querySelector('.scene');
	if (!scene) throw new Error('no .scene element');
	scene.insertAdjacentElement('afterend', canvas);

	const gl = canvas.getContext('webgl', { alpha: false, antialias: false });
	if (!gl) throw new Error('WebGL unavailable');

	const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
	const size = () => {
		canvas.width = Math.round(window.innerWidth * dpr);
		canvas.height = Math.round(window.innerHeight * dpr);
	};
	size();

	const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
	const plateCssW = window.innerHeight * VIEWPORT_ASPECT * (PLATE_W_SRC / FRAME_W_SRC);
	const tier = pickTier(plateCssW * dpr, maxTex);
	const [skyTex, floorTex] = await Promise.all([
		loadTexture(gl, `${SCENE_SKY}-${tier}w.webp`),
		loadTexture(gl, `${SCENE_FLOOR}-${tier}w.webp`)
	]);

	const s: ProbeState = {
		canvas,
		gl,
		progColor: program(gl, VS, FS_COLOR),
		progTex: program(gl, VS, FS_TEX),
		skyTex,
		floorTex,
		quads: null,
		cam: { x: 0, y: 0 },
		raf: 0,
		settled: true
	};
	buildQuads(s);
	window.addEventListener('resize', () => {
		size();
		buildQuads(s);
		draw(s);
	});
	console.log(`[ascend-pan probe GL] renderer ready — ${tier}w plates, dpr ${dpr}`);
	return s;
}

/**
 * Toggle the GL pan, mirroring the DOM probe's state machine. First press
 * builds the renderer (async texture decode), then pans up; even presses
 * return to rest and hand the viewport back to the DOM scene.
 */
export async function runScenePanProbeGL(): Promise<void> {
	if (loading) return;
	if (!state) {
		loading = true;
		try {
			state = await init();
		} catch (err) {
			console.error('[ascend-pan probe GL] init failed', err);
			return;
		} finally {
			loading = false;
		}
	}
	const s = state;
	const goingUp = !up;
	up = goingUp;
	const lean = LEANS[leanIdx];
	if (!goingUp) leanIdx = (leanIdx + 1) % LEANS.length;

	const vh = window.innerHeight;
	const vw = window.innerWidth;
	if (goingUp) {
		s.canvas.style.display = '';
		setDomHidden(true);
		draw(s);
		// World translates DOWN to reveal the upper sky (positive y, same sign
		// convention as the DOM pan), and shifts toward the crane side.
		const frameW = vh * VIEWPORT_ASPECT;
		const overflow = Math.max(0, (frameW - vw) / 2) * 0.9;
		const mag = Math.min(
			Math.tan((SIDE_LEAN_DEG * Math.PI) / 180) * (PAN_DVH / 100) * vh,
			overflow
		);
		const camX = lean === 0 ? 0 : lean * mag;
		animateTo(s, camX, (PAN_DVH / 100) * vh);
	} else {
		animateTo(s, 0, 0, () => {
			s.canvas.style.display = 'none';
			setDomHidden(false);
		});
	}
	const label = !goingUp
		? 'return to rest (DOM scene restored at settle)'
		: lean === 0
			? 'up — straight tilt-up'
			: lean === 1
				? 'up — left-tool crane (world shifts right)'
				: 'up — right-tool crane (world shifts left)';
	console.log(`[ascend-pan probe GL] ${label}, ${PAN_MS}ms`);
}
