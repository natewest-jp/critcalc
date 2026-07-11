/**
 * WebGL Dire border — the ANIMATED layers of the tool-edge treatment as three
 * band canvases (docs/webgl-dire-border-handoff.md).
 *
 * Replaces the six 2-tile SVG wave strips + the scrolling noise veil (7 live
 * CSS animations, each strip a compositor texture ~2.6× viewport width — the
 * Safari eviction-flash class). In a fragment shader the infinite scroll is
 * `fract(x/tileW ± phase)` over a small REPEAT-wrapped tile: no oversized
 * texture exists, so there is nothing to evict. Static layers (gradient glows,
 * tint base, halftone dot screen) stay CSS in DireBorder.svelte.
 *
 * THREE canvases, not the handoff's two: today's paint order is
 * tint-base → noise → halftone → grad-bottom → waves, and the halftone plate
 * measures 85–99% opaque black across its full height — folding noise + waves
 * into one bottom canvas would either hide the waves' over-plate wash (visible
 * parity break) or lift the noise above the dot screen. A canvas per animated
 * stratum keeps the CSS layers sandwiched exactly where they are.
 *
 * WebGL2, not 1: both tiles need REPEAT wrapping at non-power-of-two sizes
 * (wave 2048×256 is POT, but the noise asset is 1200×600 and resampling it to
 * POT would rescale the ember grain). WebGL2 allows NPOT+REPEAT natively and
 * is older than other hard requirements of this site (the shipped border's
 * `hsl(from …)` needs Safari 16.4; WebGL2 shipped in 15). No WebGL2 → one
 * static 2D-canvas frame of the same composite; there is deliberately no
 * CSS-strip fallback (two implementations is how parity rots).
 *
 * Contracts (the starfield module's proven set, `$lib/landing/starfield.ts`):
 *  - Every tuned value comes from the SHIPPED CSS: per-layer params are copied
 *    verbatim below; `--dire-*` knobs are read from computed style at init
 *    (lengths via a probe element so the browser resolves vw/calc; tints via a
 *    probe `color` so the browser does the `hsl(from …)` rotation — parity
 *    with the CSS by construction, and `--dire-tint` keeps working).
 *  - Phases are ABSOLUTE-time based (`fract((t − delay) / dur)`), so stopping
 *    the loop and restarting resumes pop-free.
 *  - The rAF loop is provably dead behind hidden tabs and reduced motion; the
 *    component unmounts off tool routes, which is the route gate.
 *  - Reduced motion renders ONE static frame at phase 0 — exactly the old
 *    `animation: none` freeze (delays ignored, strips at translate 0).
 *  - GL helpers are duplicated from starfield.ts rather than extracted: that
 *    module has real-Safari sign-off and zero-touch is worth ~25 lines. A
 *    third GL surface is the time to extract.
 *
 * Dev hooks:
 *  - `handle.retune()` re-reads every knob + repaints (DireBorder.svelte wires
 *    the handle to `window.__dire`) — edit `--dire-*` in devtools,
 *    `__dire.retune()`, see it.
 *  - `?dire-freeze=T` renders one frame at t=T seconds and never loops. With
 *    the CSS version frozen via `anim.currentTime = T*1000`, the two composites
 *    are phase-matched — the screenshot-overlay parity recipe.
 */

// --- Tuning knobs -----------------------------------------------------------

/** Backing-store resolution cap, device px per CSS px. The waves are soft
 *  low-alpha gradients and the noise sits under the halftone plate, so 1× reads
 *  fine (the crisp elements — halftone, gradients — stay CSS); this is the
 *  memory lever, per the handoff. Revisit 1.5 only if crests look soft on
 *  retina. */
const MAX_BACKING_DPR = 1;

/** Trailing debounce for backing-store resizes (viewport resize / zoom). */
const RESIZE_DEBOUNCE_MS = 150;

/** Wave tile raster size. The authored silhouette is a 2400×200 viewBox; 2048
 *  wide ≈ 1:1 at the shipped 130vw tile on a 1600px viewport, 256 tall keeps
 *  the vertical alpha ramp smooth. (POT by accident of round numbers — WebGL2
 *  doesn't need it.) */
const TILE_W = 2048;
const TILE_H = 256;

// --- Authored wave data (verbatim from the shipped CSS/SVG) ------------------

/** Wave silhouette authored in assets-src/tools/waves.svg (2400×200, crest up,
 *  body filling to the bottom edge) — x-repeating: starts and ends at y=68 so
 *  REPEAT wrap is seamless. */
const WAVE_PATH =
	'M0,68C0,68 141.418,52.596 212.39,53C300.205,53.5 421.915,73.549 526.888,71C643.555,68.167 783.377,34.059 912.392,36C1045.319,38 1191.684,81 1324.447,83C1453.135,84.939 1580.264,48.328 1708.966,48C1839.608,47.667 1993.127,77.667 2108.299,81C2205.589,83.816 2400,68 2400,68L2400,200L0,200L0,68Z';

/** The SVG gradient's vertical alpha ramp (userSpaceOnUse, y 23.68 → 400 in
 *  tile units over the 200-tall viewBox — the visible tile spans only the top
 *  ~47% of the ramp). Stop opacities are the authored ramp ×3 so the slot-level
 *  `--dire-wave-alpha` can push above 1×. */
const RAMP_Y1 = 23.68;
const RAMP_Y2 = 400;
const RAMP_STOPS: [offset: number, alpha: number][] = [
	[0, 0.3],
	[0.2, 0.18],
	[0.42, 0.06],
	[1, 0]
];

/** Per-layer params, copied VERBATIM from the shipped `.bot-*` / `.top-*` CSS.
 *  `hDiv`: `--wave-h = --tile-w / N` (y-squash). `marginPx`: the authored
 *  overlap nudges (margin-bottom / margin-top). `reverse` = the `.rev` class
 *  (`animation-direction: reverse` — phase runs backwards). Array order is
 *  PAINT order (DOM order: layer 1 painted first, 3 on top). */
interface WaveLayer {
	flowDur: number; // s, before the --dire-speed divide
	hDiv: number;
	hueShift: number; // deg, applied to --dire-tint
	alphaMul: number; // × --dire-wave-alpha
	marginPx: number;
	delayS: number; // the CSS animation-delay (negative = started that long ago)
	reverse: boolean;
}

const BOTTOM_LAYERS: WaveLayer[] = [
	{ flowDur: 30, hDiv: 15, hueShift: -1, alphaMul: 1, marginPx: 0, delayS: 0, reverse: false },
	{ flowDur: 38, hDiv: 15, hueShift: -2, alphaMul: 0.8, marginPx: -64, delayS: -7, reverse: false },
	{ flowDur: 46, hDiv: 15, hueShift: 5, alphaMul: 0.65, marginPx: -36, delayS: -13, reverse: true }
];

const TOP_LAYERS: WaveLayer[] = [
	{ flowDur: 34, hDiv: 17, hueShift: -5, alphaMul: 1, marginPx: 0, delayS: 0, reverse: true },
	{ flowDur: 42, hDiv: 17, hueShift: 7, alphaMul: 0.8, marginPx: -42, delayS: -5, reverse: true },
	{
		flowDur: 50,
		hDiv: 17,
		hueShift: -8,
		alphaMul: 0.65,
		marginPx: -21,
		delayS: -17,
		reverse: false
	}
];

/** The noise veil scrolls up by one 600px tile per `--dire-noise-dur`. */
const NOISE_TILE_W = 1200;
const NOISE_TILE_H = 600;
const NOISE_SRC = ['/assets/tools/dire-noise.avif', '/assets/tools/dire-noise.webp'];

// --- Shaders ------------------------------------------------------------------

/** Shared vertex shader: one fullscreen triangle; hands the fragment stage CSS
 *  coordinates (y down from the canvas top, like the layout math). */
const VERTEX_SRC = `
precision highp float;
attribute vec2 a_pos;
uniform vec2 u_size; // canvas CSS size (px)
varying vec2 v_css;
void main() {
	gl_Position = vec4(a_pos, 0.0, 1.0);
	v_css = vec2(a_pos.x + 1.0, 1.0 - a_pos.y) * 0.5 * u_size;
}
`;

/**
 * Wave fragment shader: all three layers of one edge composited in a single
 * pass — premultiplied source-over folded in (no GL blending), painted in
 * layer order so layer 3 lands on top, exactly like the DOM stack it replaces.
 *
 * Per layer i, u_geom[i] = (slotTopY, waveH, signedPhase, flip):
 *  - v: fragment height inside the slot; flip mirrors it for the top edge
 *    (the old `scaleY(-1)` — tile body hangs DOWN from the viewport top).
 *  - u: `fract(x/tileW + signedPhase)` — the infinite scroll. The sign folds
 *    `animation-direction: reverse` in JS.
 *  - The tile texture holds the authored silhouette × alpha ramp as its alpha
 *    channel; tint (JS-resolved, hue-rotated per layer) × slot alpha applies
 *    here, so one tile serves all six layers and every hue.
 *
 * highp: v_css spans the viewport width — mediump (fp16 floor) would quantize
 * the scroll to visible ~2px steps on mobile GPUs.
 */
const WAVE_FRAGMENT_SRC = `
precision highp float;
varying vec2 v_css;
uniform sampler2D u_tile;
uniform float u_tileW;
uniform vec4 u_geom[3];  // slotTopY, waveH, signedPhase, flip
uniform vec3 u_color[3]; // per-layer tint, 0-1
uniform float u_alpha[3]; // waveAlpha × alphaMul
void main() {
	vec4 acc = vec4(0.0);
	for (int i = 0; i < 3; i++) {
		float v = (v_css.y - u_geom[i].x) / u_geom[i].y;
		v = mix(v, 1.0 - v, u_geom[i].w);
		float a = 0.0;
		if (v > 0.0 && v < 1.0) {
			float u = fract(v_css.x / u_tileW + u_geom[i].z);
			a = texture2D(u_tile, vec2(u, v)).a * u_alpha[i];
		}
		acc = vec4(u_color[i] * a, a) + acc * (1.0 - a);
	}
	gl_FragColor = acc;
}
`;

/** Noise fragment shader: the upward-scrolling veil. The texture is the
 *  black-with-alpha noise tile at its NATIVE 1200×600 CSS-px scale (REPEAT
 *  both axes — the reason this module is WebGL2), premultiplied on upload, so
 *  the texel is already the final source-over color. Screen y + scroll maps
 *  straight to layer space: the old strip translated UP by 600px per cycle,
 *  i.e. a fixed screen point reads ever-further DOWN the tile. */
const NOISE_FRAGMENT_SRC = `
precision highp float;
varying vec2 v_css;
uniform sampler2D u_noise;
uniform vec2 u_tileSize; // native tile size, CSS px
uniform float u_scroll;  // px scrolled this cycle (0..tileH)
void main() {
	gl_FragColor = texture2D(u_noise, (v_css + vec2(0.0, u_scroll)) / u_tileSize);
}
`;

// --- GL plumbing (duplicated from starfield.ts — see module doc) --------------

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
	const shader = gl.createShader(type)!;
	gl.shaderSource(shader, src);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		throw new Error(`dire border shader: ${gl.getShaderInfoLog(shader) ?? 'compile failed'}`);
	}
	return shader;
}

function buildProgram(gl: WebGL2RenderingContext, fragmentSrc: string): WebGLProgram {
	const program = gl.createProgram()!;
	gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, VERTEX_SRC));
	gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, fragmentSrc));
	gl.linkProgram(program);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		throw new Error(`dire border link: ${gl.getProgramInfoLog(program) ?? 'link failed'}`);
	}
	gl.useProgram(program);

	// Fullscreen triangle. One program + one buffer per context, bound once —
	// state persists across frames (rebuilt on context restore).
	gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
	const loc = gl.getAttribLocation(program, 'a_pos');
	gl.enableVertexAttribArray(loc);
	gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

	// Compositing is folded into the shaders (premultiplied source-over), so a
	// single opaque-pass draw with blending OFF is correct; the browser then
	// composites the canvas premultiplied (context default).
	gl.disable(gl.BLEND);
	gl.clearColor(0, 0, 0, 0);
	return program;
}

function uploadTexture(
	gl: WebGL2RenderingContext,
	source: TexImageSource,
	wrapT: number
): WebGLTexture {
	const tex = gl.createTexture()!;
	gl.bindTexture(gl.TEXTURE_2D, tex);
	gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapT);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	return tex;
}

// --- Wave tile raster ----------------------------------------------------------

/** Rasterize the authored silhouette ONCE: white × the alpha ramp, in path
 *  space (2400×200) scaled onto the tile canvas — gradient coordinates ride the
 *  transform, same as the SVG's userSpaceOnUse. Both wave contexts upload from
 *  this one canvas; the 2D fallback tints it per layer. */
function rasterizeWaveTile(): HTMLCanvasElement {
	const canvas = document.createElement('canvas');
	canvas.width = TILE_W;
	canvas.height = TILE_H;
	const ctx = canvas.getContext('2d')!;
	const grad = ctx.createLinearGradient(0, RAMP_Y1, 0, RAMP_Y2);
	for (const [offset, alpha] of RAMP_STOPS) grad.addColorStop(offset, `rgba(255,255,255,${alpha})`);
	ctx.setTransform(TILE_W / 2400, 0, 0, TILE_H / 200, 0, 0);
	ctx.fillStyle = grad;
	ctx.fill(new Path2D(WAVE_PATH));
	return canvas;
}

// --- Knobs from computed style ---------------------------------------------------

interface Knobs {
	tileW: number; // px (resolved from the vw-typed knob)
	waveAlpha: number;
	speed: number;
	noiseDur: number; // s
	/** Per-layer resolved tints: [0..2] bottom, [3..5] top. Both the parsed
	 *  0–1 RGB (GL) and the browser's serialized string (2D fallback). */
	colors: { rgb: [number, number, number]; css: string }[];
}

/** Resolve ANY serialized color to sRGB bytes via a 1×1 canvas fill — engines
 *  serialize relative colors differently (Chrome: `color(srgb …)`), so string
 *  parsing is a trap; the canvas paints whatever the engine meant. Lazy: this
 *  module is imported during SSR, so no DOM work at module scope. */
let colorCtx: CanvasRenderingContext2D | null = null;
function resolveColor(css: string): [number, number, number] {
	if (!colorCtx) {
		const scratch = document.createElement('canvas');
		scratch.width = scratch.height = 1;
		colorCtx = scratch.getContext('2d', { willReadFrequently: true })!;
	}
	colorCtx.fillStyle = '#fff'; // sentinel: an unparseable color stays white (visibly wrong)
	colorCtx.fillStyle = css;
	colorCtx.fillRect(0, 0, 1, 1);
	const d = colorCtx.getImageData(0, 0, 1, 1).data;
	return [d[0] / 255, d[1] / 255, d[2] / 255];
}

/**
 * Read every knob from the live cascade. Lengths resolve through a probe
 * element (the browser handles vw/calc/clamp); tints resolve through the
 * probe's `color` so the browser performs the same `hsl(from --dire-tint …)`
 * rotation the old per-slot CSS did — parity by construction, and future
 * `--dire-tint` tweaks keep cascading in. Two forced layouts, init/resize/
 * retune only.
 */
function measureKnobs(host: HTMLElement, probe: HTMLElement): Knobs {
	probe.style.width = 'var(--dire-tile-w, 220vw)';
	const tileW = probe.getBoundingClientRect().width;

	const style = getComputedStyle(host);
	const num = (name: string, fallback: number) => {
		const v = parseFloat(style.getPropertyValue(name));
		return Number.isFinite(v) ? v : fallback;
	};
	// Durations are simple tokens in this codebase ('9s' / '450ms').
	const dur = (name: string, fallback: number) => {
		const raw = style.getPropertyValue(name).trim();
		const v = parseFloat(raw);
		if (!Number.isFinite(v)) return fallback;
		return raw.endsWith('ms') ? v / 1000 : v;
	};

	const colors = [...BOTTOM_LAYERS, ...TOP_LAYERS].map((layer) => {
		probe.style.color = `hsl(from var(--dire-tint, hsl(342 85% 46%)) calc(h + ${layer.hueShift}) s l)`;
		const css = getComputedStyle(probe).color;
		return { rgb: resolveColor(css), css };
	});

	return {
		tileW,
		waveAlpha: num('--dire-wave-alpha', 0.25),
		speed: num('--dire-speed', 1),
		noiseDur: dur('--dire-noise-dur', 8),
		colors
	};
}

// --- Layer geometry ---------------------------------------------------------------

/** Slot top (canvas-local y) for one layer — the CSS positioning math verbatim.
 *  Canvas height IS the crest mark (--dire-top-h / --dire-bottom-h size the
 *  canvases), so the mark never needs reading separately.
 *  Bottom: `bottom: min(0px, mark − waveH)` + margin-bottom, measured up from
 *  the canvas bottom. Top: `top: min(0px, mark − waveH)` + margin-top. The
 *  min() clamp keeps shrinking waves pinned to the edge (crest rides lower
 *  instead of opening a gap). */
function slotTopY(layer: WaveLayer, isTop: boolean, canvasH: number, waveH: number): number {
	const clamp = Math.min(0, canvasH - waveH);
	return isTop ? clamp + layer.marginPx : canvasH - (clamp + layer.marginPx) - waveH;
}

const fract = (x: number) => ((x % 1) + 1) % 1;

/** Scroll phase for one layer at t seconds — CSS animation semantics: negative
 *  delay = started that long ago; `--dire-speed` divides into the duration;
 *  reverse runs the cycle backwards (the sign folds into the shader's `+`). */
function wavePhase(layer: WaveLayer, t: number, speed: number): number {
	const phase = fract((t - layer.delayS) / (layer.flowDur / speed));
	return layer.reverse ? -phase : phase;
}

// --- Controller --------------------------------------------------------------------

export interface DireBorderHandle {
	/** Allow the animation loop (gated internally on document visibility,
	 *  reduced motion and GL health — reduced motion paints one static frame). */
	start(): void;
	/** Stop the loop; the last frame stays visible, resume is pop-free. */
	stop(): void;
	/** Re-read every --dire-* knob from the live cascade and repaint — the
	 *  devtools re-tuning hook (window.__direRetune via DireBorder.svelte). */
	retune(): void;
	/** True while a rAF frame is scheduled (verification probe). */
	readonly running: boolean;
	destroy(): void;
}

interface WavePipeline {
	kind: 'waves';
	program: WebGLProgram;
	uSize: WebGLUniformLocation;
	uTileW: WebGLUniformLocation;
	uGeom: WebGLUniformLocation;
	uColor: WebGLUniformLocation;
	uAlpha: WebGLUniformLocation;
}

interface NoisePipeline {
	kind: 'noise';
	program: WebGLProgram;
	uSize: WebGLUniformLocation;
	uTileSize: WebGLUniformLocation;
	uScroll: WebGLUniformLocation;
	/** The noise image loads async; the band draws transparent until upload
	 *  (same as CSS pre-image-load). */
	textureReady: boolean;
}

/** One animated band: its canvas, GL state (or the 2D static fallback), and
 *  backing-store bookkeeping. */
interface Band {
	canvas: HTMLCanvasElement;
	layers: WaveLayer[] | null; // null = the noise band
	isTop: boolean;
	gl: WebGL2RenderingContext | null;
	pipeline: WavePipeline | NoisePipeline | null;
	ctx2d: CanvasRenderingContext2D | null;
	lost: boolean;
	cssW: number;
	cssH: number;
	dpr: number;
}

export function createDireBorder(
	host: HTMLElement,
	canvases: { top: HTMLCanvasElement; noise: HTMLCanvasElement; bottom: HTMLCanvasElement }
): DireBorderHandle {
	let wantRun = false;
	let destroyed = false;
	let raf = 0;
	let resizeTimer: ReturnType<typeof setTimeout> | undefined;

	const reducedMq = window.matchMedia('(prefers-reduced-motion: reduce)');

	// Parity-probe freeze: render exactly one frame at t=T and never loop.
	const freezeParam = new URLSearchParams(location.search).get('dire-freeze');
	const freezeT = freezeParam === null ? null : parseFloat(freezeParam) || 0;

	// Hidden probe for length/color resolution — lives inside the border so the
	// full --dire-* cascade applies.
	const probe = document.createElement('div');
	probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;';
	host.appendChild(probe);
	let knobs = measureKnobs(host, probe);

	const waveTile = rasterizeWaveTile();
	/** Per-tint tinted tiles for the 2D fallback, keyed by resolved color. */
	const tintedTiles = new Map<string, HTMLCanvasElement>();

	// The noise image: loaded once (AVIF, WebP on decode failure), uploaded to
	// the noise context and/or drawn by the 2D fallback when it arrives.
	let noiseImg: HTMLImageElement | null = null;
	{
		const img = new Image();
		let srcIdx = 0;
		img.onload = () => {
			noiseImg = img;
			onNoiseReady();
		};
		img.onerror = () => {
			srcIdx += 1;
			if (srcIdx < NOISE_SRC.length) img.src = NOISE_SRC[srcIdx];
			else console.error('dire border: noise veil failed to load, band disabled');
		};
		img.src = NOISE_SRC[srcIdx];
	}

	function buildPipeline(band: Band): WavePipeline | NoisePipeline {
		const gl = band.gl!;
		const u = (program: WebGLProgram, name: string) => gl.getUniformLocation(program, name)!;
		if (band.layers) {
			const program = buildProgram(gl, WAVE_FRAGMENT_SRC);
			uploadTexture(gl, waveTile, gl.CLAMP_TO_EDGE);
			gl.uniform1i(u(program, 'u_tile'), 0);
			return {
				kind: 'waves',
				program,
				uSize: u(program, 'u_size'),
				uTileW: u(program, 'u_tileW'),
				uGeom: u(program, 'u_geom'),
				uColor: u(program, 'u_color'),
				uAlpha: u(program, 'u_alpha')
			};
		}
		const program = buildProgram(gl, NOISE_FRAGMENT_SRC);
		const pipeline: NoisePipeline = {
			kind: 'noise',
			program,
			uSize: u(program, 'u_size'),
			uTileSize: u(program, 'u_tileSize'),
			uScroll: u(program, 'u_scroll'),
			textureReady: false
		};
		gl.uniform2f(pipeline.uTileSize, NOISE_TILE_W, NOISE_TILE_H);
		if (noiseImg) {
			uploadTexture(gl, noiseImg, gl.REPEAT);
			gl.uniform1i(u(program, 'u_noise'), 0);
			pipeline.textureReady = true;
		}
		return pipeline;
	}

	function makeBand(canvas: HTMLCanvasElement, layers: WaveLayer[] | null, isTop: boolean): Band {
		const gl = canvas.getContext('webgl2', {
			alpha: true,
			antialias: false,
			depth: false,
			stencil: false,
			premultipliedAlpha: true, // matches the shaders' premultiplied output
			powerPreference: 'low-power'
		});
		const band: Band = {
			canvas,
			layers,
			isTop,
			gl,
			pipeline: null,
			ctx2d: null,
			lost: false,
			cssW: 0,
			cssH: 0,
			dpr: 1
		};
		if (gl) {
			try {
				band.pipeline = buildPipeline(band);
			} catch (err) {
				// Context exists but the pipeline won't build (driver quirk). The
				// canvas can no longer yield a 2D context — leave the band blank;
				// the CSS gradients/tint/halftone still carry the treatment.
				console.error('dire border: WebGL pipeline failed, band disabled', err);
			}
		} else {
			// No WebGL2 at all → the canvas is still free for a 2D context; render
			// the same band once as a static frame.
			band.ctx2d = canvas.getContext('2d');
		}
		return band;
	}

	const bands: Band[] = [
		makeBand(canvases.top, TOP_LAYERS, true),
		makeBand(canvases.noise, null, false),
		makeBand(canvases.bottom, BOTTOM_LAYERS, false)
	];

	function onNoiseReady(): void {
		const band = bands[1];
		if (destroyed || !noiseImg) return;
		if (band.pipeline?.kind === 'noise' && band.gl && !band.lost) {
			uploadTexture(band.gl, noiseImg, band.gl.REPEAT);
			band.gl.uniform1i(band.gl.getUniformLocation(band.pipeline.program, 'u_noise'), 0);
			band.pipeline.textureReady = true;
		}
		// New texture needs to reach the screen even while suspended/static.
		if (!raf) renderAll(now());
	}

	/** Tinted copy of the wave tile for the 2D fallback (alpha tile × color). */
	function tintedTile(css: string): HTMLCanvasElement {
		let tile = tintedTiles.get(css);
		if (!tile) {
			tile = document.createElement('canvas');
			tile.width = TILE_W;
			tile.height = TILE_H;
			const ctx = tile.getContext('2d')!;
			ctx.drawImage(waveTile, 0, 0);
			ctx.globalCompositeOperation = 'source-in';
			ctx.fillStyle = css;
			ctx.fillRect(0, 0, TILE_W, TILE_H);
			tintedTiles.set(css, tile);
		}
		return tile;
	}

	/** Sync a band's backing store to its CSS box. True if it changed. */
	function sizeBacking(band: Band): boolean {
		const w = band.canvas.clientWidth;
		const h = band.canvas.clientHeight;
		if (w === 0 || h === 0) return false;
		const scale = Math.min(MAX_BACKING_DPR, window.devicePixelRatio || 1);
		const bw = Math.max(1, Math.round(w * scale));
		const bh = Math.max(1, Math.round(h * scale));
		if (
			w === band.cssW &&
			h === band.cssH &&
			bw === band.canvas.width &&
			bh === band.canvas.height
		) {
			return false;
		}
		band.cssW = w;
		band.cssH = h;
		band.dpr = bw / w;
		band.canvas.width = bw;
		band.canvas.height = bh;
		return true;
	}

	const geom = new Float32Array(12);
	const colorArr = new Float32Array(9);
	const alphaArr = new Float32Array(3);

	function renderWavesGL(band: Band, t: number, staticFrame: boolean): void {
		const gl = band.gl!;
		const p = band.pipeline as WavePipeline;
		const colorBase = band.isTop ? 3 : 0; // knobs.colors: [0..2] bottom, [3..5] top
		for (let i = 0; i < 3; i++) {
			const layer = band.layers![i];
			const waveH = knobs.tileW / layer.hDiv;
			geom[i * 4] = slotTopY(layer, band.isTop, band.cssH, waveH);
			geom[i * 4 + 1] = waveH;
			geom[i * 4 + 2] = staticFrame ? 0 : wavePhase(layer, t, knobs.speed);
			geom[i * 4 + 3] = band.isTop ? 1 : 0;
			colorArr.set(knobs.colors[colorBase + i].rgb, i * 3);
			alphaArr[i] = knobs.waveAlpha * layer.alphaMul;
		}
		gl.viewport(0, 0, band.canvas.width, band.canvas.height);
		gl.uniform2f(p.uSize, band.cssW, band.cssH);
		gl.uniform1f(p.uTileW, knobs.tileW);
		gl.uniform4fv(p.uGeom, geom);
		gl.uniform3fv(p.uColor, colorArr);
		gl.uniform1fv(p.uAlpha, alphaArr);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
	}

	function renderNoiseGL(band: Band, t: number, staticFrame: boolean): void {
		const gl = band.gl!;
		const p = band.pipeline as NoisePipeline;
		gl.viewport(0, 0, band.canvas.width, band.canvas.height);
		if (!p.textureReady) {
			gl.clear(gl.COLOR_BUFFER_BIT);
			return;
		}
		const scroll = staticFrame ? 0 : fract(t / knobs.noiseDur) * NOISE_TILE_H;
		gl.uniform2f(p.uSize, band.cssW, band.cssH);
		gl.uniform1f(p.uScroll, scroll);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
	}

	/** 2D static fallback (no WebGL2): the same composite at phase 0, painted
	 *  once per size/knob change. */
	function render2d(band: Band): void {
		const ctx = band.ctx2d!;
		ctx.setTransform(band.dpr, 0, 0, band.dpr, 0, 0);
		ctx.clearRect(0, 0, band.cssW, band.cssH);
		if (!band.layers) {
			if (!noiseImg) return;
			const pattern = ctx.createPattern(noiseImg, 'repeat');
			if (!pattern) return;
			ctx.fillStyle = pattern;
			ctx.fillRect(0, 0, band.cssW, band.cssH);
			return;
		}
		const colorBase = band.isTop ? 3 : 0;
		band.layers.forEach((layer, i) => {
			const waveH = knobs.tileW / layer.hDiv;
			const top = slotTopY(layer, band.isTop, band.cssH, waveH);
			ctx.save();
			ctx.globalAlpha = knobs.waveAlpha * layer.alphaMul;
			if (band.isTop) {
				// scaleY(-1) — tile body hangs down from the slot top
				ctx.translate(0, top + waveH);
				ctx.scale(1, -1);
			} else {
				ctx.translate(0, top);
			}
			const tile = tintedTile(knobs.colors[colorBase + i].css);
			for (let x = 0; x < band.cssW; x += knobs.tileW) {
				ctx.drawImage(tile, x, 0, knobs.tileW, waveH);
			}
			ctx.restore();
		});
	}

	function renderBand(band: Band, t: number, staticFrame: boolean): void {
		if (band.lost || band.cssW === 0) return;
		if (band.pipeline?.kind === 'waves') renderWavesGL(band, t, staticFrame);
		else if (band.pipeline?.kind === 'noise') renderNoiseGL(band, t, staticFrame);
		else if (band.ctx2d) render2d(band);
	}

	// Absolute clock (see module doc): resume lands exactly where the border
	// would have been. Reduced motion forces the CSS `animation: none`
	// equivalent — every phase pinned to 0, delays ignored.
	const now = () => performance.now() / 1000;

	function renderAll(t: number): void {
		// Reduced motion pins every phase to 0; a freeze overrides it (the probe
		// needs real phases at its chosen t).
		const staticFrame = freezeT === null && reducedMq.matches;
		for (const band of bands) renderBand(band, freezeT ?? t, staticFrame);
	}

	const anyGL = () => bands.some((b) => b.pipeline && !b.lost);

	const shouldLoop = () =>
		wantRun && !destroyed && freezeT === null && anyGL() && !document.hidden && !reducedMq.matches;

	function frame(): void {
		raf = 0;
		if (!shouldLoop()) return;
		renderAll(now());
		raf = requestAnimationFrame(frame);
	}

	/** Reconcile the loop with the current gates; called on every state change
	 *  (start/stop, visibility, reduced-motion toggle, context loss/restore). */
	function sync(): void {
		const loop = shouldLoop();
		if (loop && !raf) raf = requestAnimationFrame(frame);
		if (!loop && raf) {
			cancelAnimationFrame(raf);
			raf = 0;
		}
		// Visible non-looping states still need SOMETHING in the canvases:
		// reduced motion shows the phase-0 frame, the 2D fallback is paint-once,
		// and a freeze renders its single probe frame.
		if (!loop && wantRun && !destroyed && !document.hidden) {
			renderAll(now());
		}
	}

	function remeasure(): void {
		knobs = measureKnobs(host, probe);
		tintedTiles.clear();
		for (const band of bands) sizeBacking(band);
		if (!raf) renderAll(now());
	}

	const ro = new ResizeObserver(() => {
		clearTimeout(resizeTimer);
		// Trailing debounce; re-measure knobs too — --dire-tile-w is vw-typed.
		resizeTimer = setTimeout(remeasure, RESIZE_DEBOUNCE_MS);
	});

	const onContextLost = (band: Band) => (e: Event) => {
		e.preventDefault(); // signal intent to restore
		band.lost = true;
		sync();
	};
	const onContextRestored = (band: Band) => () => {
		band.lost = false;
		if (band.gl) {
			try {
				band.pipeline = buildPipeline(band);
			} catch (err) {
				band.pipeline = null;
				console.error('dire border: WebGL pipeline failed after restore, band disabled', err);
			}
		}
		sizeBacking(band);
		sync();
	};

	const lostHandlers = bands.map((band) => {
		const handlers = [onContextLost(band), onContextRestored(band)] as const;
		band.canvas.addEventListener('webglcontextlost', handlers[0]);
		band.canvas.addEventListener('webglcontextrestored', handlers[1]);
		return handlers;
	});

	for (const band of bands) sizeBacking(band);
	ro.observe(host);
	document.addEventListener('visibilitychange', sync);
	reducedMq.addEventListener('change', sync);

	// A frozen probe frame paints immediately, mount state notwithstanding.
	if (freezeT !== null) renderAll(freezeT);

	return {
		start() {
			wantRun = true;
			sync();
		},
		stop() {
			wantRun = false;
			sync();
		},
		retune: remeasure,
		get running() {
			return raf !== 0;
		},
		destroy() {
			destroyed = true;
			wantRun = false;
			if (raf) cancelAnimationFrame(raf);
			raf = 0;
			clearTimeout(resizeTimer);
			ro.disconnect();
			document.removeEventListener('visibilitychange', sync);
			reducedMq.removeEventListener('change', sync);
			bands.forEach((band, i) => {
				band.canvas.removeEventListener('webglcontextlost', lostHandlers[i][0]);
				band.canvas.removeEventListener('webglcontextrestored', lostHandlers[i][1]);
				band.gl?.getExtension('WEBGL_lose_context')?.loseContext();
			});
			probe.remove();
		}
	};
}
