/**
 * WebGL Dire border — the ANIMATED layers of the tool-edge treatment as three
 * band canvases (docs/archive/webgl-dire-border-handoff.md).
 *
 * Replaces the six 2-tile SVG wave strips + the scrolling noise veil (7 live
 * CSS animations, each strip a compositor texture ~2.6× viewport width — the
 * Safari eviction-flash class). In a fragment shader the infinite scroll is
 * `fract(x/tileW ± phase)` over a small REPEAT-wrapped tile: no oversized
 * texture exists, so there is nothing to evict.
 *
 * SCROLL-UNDER layering (2026-07-24): the border is split into two fixed
 * strata around the tool content (DireBorder.svelte). Only the TOP edge
 * occludes: its wave canvas lives in the OVER stratum (z2) — the near-opaque
 * bodies back the fixed chrome, which is what lets it stay pinned. The
 * bottom waves + ember canvas live in the UNDER stratum (z0) with the static
 * gradient glows: content draws over them, as the border always worked —
 * bottom occlusion contributed nothing (Nate's final call). The old
 * tint-base + halftone-plate CSS layers are RETIRED: the ember field is the
 * noise shader itself (procedural dot screen × the scrolling veil, emitted
 * as glowing dots on transparent), painted ABOVE the bottom waves.
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
 *    with the CSS by construction, and `--dire` keeps working).
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

/** Backing-store resolution caps, device px per CSS px — the memory lever,
 *  per the handoff. Both run 2× since the scroll-under rework: the ember
 *  band renders the dot screen the retired CSS plate used to keep crisp
 *  (~2px dots smear at 1×), and the near-opaque wave crests are now the
 *  treatment's hard visual boundary — at 1× their antialiasing transition
 *  is a single fragment, which upscales to a visible saw-tooth on retina
 *  (fine back when the waves were faint washes). Three band canvases at 2×
 *  are still far below the old CSS-strip footprint that caused evictions. */
const MAX_WAVE_BACKING_DPR = 2;
const MAX_EMBER_BACKING_DPR = 2;

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
 *  REPEAT wrap is seamless. 2026-07-24 export: eased peaks and troughs (Nate's
 *  vector-editor compositing session). */
const WAVE_PATH =
	'M0,68C0,68 141.418,54.596 212.39,55C300.205,55.5 421.915,78.549 526.888,76C643.555,73.167 783.377,41.059 912.392,43C1045.319,45 1191.684,76 1324.447,78C1453.135,79.939 1580.264,53.328 1708.966,53C1839.608,52.667 1993.127,76.667 2108.299,80C2205.589,82.816 2400,68 2400,68L2400,200L0,200L0,68Z';

/** The fill gradient's span in tile units, read from the 2026-07-24 SVG export
 *  (userSpaceOnUse; gradientTransform maps offset 0 → y=200, offset 1 →
 *  y≈35.9): darkest at the crest side, brightening toward the viewport edge.
 *  The per-layer stop COLORS live in the layer defs (crestL/edgeL — lightness
 *  against the tint's hue/sat); the shader mixes them analytically over this
 *  span, so no ramp texture exists anymore. */
const GRAD_Y_CREST = 35.92;
const GRAD_Y_EDGE = 200;

/** Per-layer params. Motion (flowDur/delayS/reverse/marginPx/hDiv) is verbatim
 *  from the shipped CSS strips. ↻ 2026-08-01 twilight ramp: the fills are no
 *  longer lightness pairs against one tint — each layer points at a RAMP
 *  STATION knob (--dire-wave-far/-mid/-near), and its two gradient stops are
 *  derived from that one color (edge stop = the station; crest-side stop =
 *  the station shaded by WAVE_DEPTH_SHADE, the depth cue). Array order is
 *  PAINT order: TALLEST layer (margin 0, crests highest) painted deepest and
 *  wears the FAR station (violet); SHORTEST painted last, on top, wears the
 *  NEAR station (dire) — the Stygian hue journey, violet in the distance
 *  arriving at dire up front. */
interface WaveLayer {
	flowDur: number; // s, before the --dire-speed divide
	hDiv: number;
	station: 0 | 1 | 2; // index into the resolved far/mid/near station colors
	marginPx: number;
	delayS: number; // the CSS animation-delay (negative = started that long ago)
	reverse: boolean;
}

/** Crest-side shade factor: each wave's gradient darkens toward its crest by
 *  this multiple of the station color — ONE depth constant where six pinned
 *  lightnesses used to live. */
const WAVE_DEPTH_SHADE = 0.62;

const BOTTOM_LAYERS: WaveLayer[] = [
	// tallest — deepest — violet (far station)
	{ flowDur: 30, hDiv: 15, station: 0, marginPx: 0, delayS: 0, reverse: false },
	// mid — purple (mid station)
	{ flowDur: 46, hDiv: 15, station: 1, marginPx: -36, delayS: -13, reverse: true },
	// shortest — on top — dire (near station)
	{ flowDur: 38, hDiv: 15, station: 2, marginPx: -64, delayS: -7, reverse: false }
];

const TOP_LAYERS: WaveLayer[] = [
	// tallest — deepest — violet (far station)
	{ flowDur: 34, hDiv: 17, station: 0, marginPx: 0, delayS: 0, reverse: true },
	// mid — purple (mid station)
	{ flowDur: 50, hDiv: 17, station: 1, marginPx: -21, delayS: -17, reverse: false },
	// shortest — on top — dire (near station)
	{ flowDur: 42, hDiv: 17, station: 2, marginPx: -42, delayS: -5, reverse: true }
];

/** Native size of the noise asset, CSS px. */
const NOISE_TILE_W = 1200;
const NOISE_TILE_H = 600;
/** Per-axis render-scale of the grain relative to its native texels, as a
 *  fraction of the ORIGINAL asset size — a pure sampling remap (a bigger
 *  divisor in the shader = a coarser grain on screen), so it costs nothing
 *  extra and the texture is untouched. The veil sits under the ~90%-opaque
 *  halftone plate, so a coarser, vertically-stretched grain reads only as a
 *  softer texture. `NOISE_RENDER_H` is also the vertical scroll wrap distance
 *  below, which is what keeps the loop seamless: the shader divides by exactly
 *  the height the scroll advances per cycle, so with REPEAT wrapping the phase
 *  always lands back on itself.
 *    - HSCALE: horizontal grain size (150% of original)
 *    - VSCALE: vertical grain size (400% of original — a deliberate elongation
 *      that reads as wispy, fire-like vertical streaks rather than blobs) */
const NOISE_HSCALE = 1.5;
const NOISE_VSCALE = 4.0;
const NOISE_RENDER_W = NOISE_TILE_W * NOISE_HSCALE; // 1800
const NOISE_RENDER_H = NOISE_TILE_H * NOISE_VSCALE; // 2400
const NOISE_SRC = ['/assets/tools/dire-noise.avif', '/assets/tools/dire-noise.webp'];

/** Ember dot screen (procedural port of the retired dire-halftone.png plate,
 *  geometry MEASURED from its alpha channel — scripts/probe-plate-analyze.mjs).
 *  NOT a halftone: a plain rectangular grid, dots aligned in columns and rows
 *  on 5×6px cells (slightly closer on x than y — Nate), ~4px dots at full
 *  strength, and the field fades out by DOT LUMINANCE toward its top, never by
 *  dot size or spacing. Values feed the shader source via template
 *  interpolation, so keep them decimal-formatted (GLSL float literals).
 *    - PITCH_X/Y: dot grid pitch, CSS px (plate: centers x=2.5/7.5, rows @6px)
 *    - RADIUS: dot radius, constant across the field (plate holes ≈ 4px wide)
 *    - FADE_EXP: luminance falloff exponent over the field height (the plate's
 *      hole-openness taper: full at the edge, gone at the field top)
 *    - GAIN: ember luminance boost over the raw (1 − veil) signal
 *    - OVERSHOOT: how far the field's top rises above the bottom wave crest
 *      line (Nate: ~15px, the Genshin Dire-screen look) */
const EMBER_PITCH_X_PX = 6;
const EMBER_PITCH_Y_PX = 7;
const EMBER_RADIUS_PX = 1.5;
const EMBER_FADE_EXP = 1.5;
const EMBER_GAIN = 0.6;
const EMBER_OVERSHOOT_PX = 15;

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
 *    channel; one tile serves all six layers. ↻ 2026-08-01: each layer's fill
 *    is its RAMP STATION (deep = shaded station at the crest side, edge = the
 *    station), so per-wave hue variation is back — by station color, not a
 *    filter (the Stygian violet→dire journey).
 *  - THE CREST LINE: a second sample of the silhouette mask, offset toward
 *    the boundary by the layer's crest thickness (u_crestV, tile-v units) —
 *    fragments inside the body whose offset sample falls OUTSIDE it are
 *    within the crest band. Composited source-over ABOVE the body at its own
 *    u_crestA (independent of u_cover, so the thin bright line survives even
 *    when the bodies run as faint washes) — the "brightest thing on the edge
 *    is a LINE, not a band" move from the Arlecchino-wallpaper analysis.
 *
 * SCROLL-UNDER: each layer is an opaque analytic gradient masked by u_shape
 * (the silhouette rastered SOLID, so the boundary keeps its raster
 * antialiasing) and composited source-over at u_cover opacity. At cover ~0.9
 * the bodies occlude content scrolling behind the waves; at Nate's current
 * 0.1 they are luminous washes and the crest lines carry the edge.
 *
 * highp: v_css spans the viewport width — mediump (fp16 floor) would quantize
 * the scroll to visible ~2px steps on mobile GPUs.
 */
const WAVE_FRAGMENT_SRC = `
precision highp float;
varying vec2 v_css;
uniform sampler2D u_shape; // silhouette solid (alpha) — antialiased coverage mask
uniform float u_tileW;
uniform vec4 u_geom[3];      // slotTopY, waveH, signedPhase, flip
uniform vec3 u_colorDeep[3]; // fill stop at the crest / UI-facing side (shaded station)
uniform vec3 u_colorEdge[3]; // fill stop at the viewport edge (the station)
uniform float u_cover;       // per-layer body opacity
uniform vec3 u_crestCol;     // crest line color (--dire-crest)
uniform float u_crestA;      // crest line opacity (--dire-crest-a)
uniform vec3 u_crestV;       // per-layer crest thickness, tile-v units
void main() {
	vec4 acc = vec4(0.0);
	for (int i = 0; i < 3; i++) {
		float v = (v_css.y - u_geom[i].x) / u_geom[i].y;
		v = mix(v, 1.0 - v, u_geom[i].w);
		float body = 0.0;
		float crest = 0.0;
		vec3 col = vec3(0.0);
		if (v > 0.0 && v < 1.0) {
			float u = fract(v_css.x / u_tileW + u_geom[i].z);
			float shape = texture2D(u_shape, vec2(u, v)).a;
			float above = texture2D(u_shape, vec2(u, v - u_crestV[i])).a;
			body = shape * u_cover;
			crest = shape * (1.0 - above) * u_crestA;
			float g = clamp(
				(v * 200.0 - ${GRAD_Y_CREST.toFixed(2)}) / ${(GRAD_Y_EDGE - GRAD_Y_CREST).toFixed(2)},
				0.0, 1.0);
			col = mix(u_colorDeep[i], u_colorEdge[i], g);
		}
		acc = vec4(col, 1.0) * body + acc * (1.0 - body);
		acc = vec4(u_crestCol, 1.0) * crest + acc * (1.0 - crest);
	}
	gl_FragColor = acc;
}
`;

/** Ember fragment shader (formerly the noise veil): the halftone ember field
 *  rebuilt as EMITTED LIGHT so it can ride ON TOP of the near-opaque waves.
 *
 *  The old stack was tint-base → black noise veil → near-opaque black dot
 *  plate: visible embers were the tint shining through the plate's holes
 *  wherever the veil ran thin — i.e. ember luminance ≡ (1 − veil.a) inside a
 *  dot. This shader computes exactly that and outputs it as glowing dots on
 *  transparent (premultiplied), which source-over composites onto the waves
 *  like a screen blend — no CSS blend modes, no plate PNG, no tint-base.
 *
 *  The dot screen is procedural (geometry measured from the plate — see the
 *  EMBER_* constants): a static rectangular grid — the dots never move, and
 *  never resize; only their luminance changes (the scrolling veil texture ×
 *  the field's vertical falloff). The field top tracks the bottom wave
 *  height + a small overshoot (JS-side u_fieldH), so the topmost embers
 *  float just above the crests, Genshin Dire-screen style.
 *
 *  Scroll semantics unchanged: the old strip translated UP by one tile per
 *  cycle, i.e. a fixed screen point reads ever-further DOWN the tile. */
const NOISE_FRAGMENT_SRC = `
precision highp float;
varying vec2 v_css;
uniform sampler2D u_noise;
uniform vec2 u_size;     // canvas CSS size (px) — .y anchors the bottom edge
uniform vec2 u_tileSize; // native tile size, CSS px
uniform float u_scroll;  // px scrolled this cycle (0..tileH)
uniform float u_fieldH;  // ember field height above the bottom edge, px
uniform vec3 u_tint;     // resolved --dire-ember, 0-1
void main() {
	float hUp = u_size.y - v_css.y;
	float t = clamp(hUp / u_fieldH, 0.0, 1.0);
	vec2 pitch = vec2(${EMBER_PITCH_X_PX}.0, ${EMBER_PITCH_Y_PX}.0);
	vec2 cell = (fract(v_css / pitch) - 0.5) * pitch;
	float d = length(cell);
	float dotMask = smoothstep(${EMBER_RADIUS_PX.toFixed(2)} + 0.6, ${EMBER_RADIUS_PX.toFixed(2)} - 0.6, d);
	float fade = pow(1.0 - t, ${EMBER_FADE_EXP.toFixed(2)});
	float veil = texture2D(u_noise, (v_css + vec2(0.0, u_scroll)) / u_tileSize).a;
	float ember = (1.0 - veil) * dotMask * fade * ${EMBER_GAIN.toFixed(2)};
	gl_FragColor = vec4(u_tint, 1.0) * min(ember, 1.0);
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

/** Rasterize the authored silhouette ONCE, filled solid, in path space
 *  (2400×200) scaled onto the tile canvas. Its alpha channel is the
 *  antialiased coverage mask: both wave contexts upload it, and the 2D
 *  fallback masks its per-layer gradient fills with it (the fill COLOR is
 *  analytic — the shader mixes the crest/edge stops itself). */
function rasterizeWaveShape(): HTMLCanvasElement {
	const canvas = document.createElement('canvas');
	canvas.width = TILE_W;
	canvas.height = TILE_H;
	const ctx = canvas.getContext('2d')!;
	ctx.setTransform(TILE_W / 2400, 0, 0, TILE_H / 200, 0, 0);
	ctx.fillStyle = '#000';
	ctx.fill(new Path2D(WAVE_PATH));
	return canvas;
}

// --- Knobs from computed style ---------------------------------------------------

interface Knobs {
	tileW: number; // px (resolved from the vw-typed knob)
	waveCover: number; // per-layer wave body opacity, --dire-wave-cover
	speed: number;
	noiseDur: number; // s
	crestW: number; // crest line thickness, CSS px (--dire-crest-w)
	crestA: number; // crest line opacity (--dire-crest-a)
	/** The three resolved wave stations (far/mid/near), each expanded to its
	 *  two gradient stops: edge = the station; deep = the station shaded by
	 *  WAVE_DEPTH_SHADE. Both the parsed 0–1 RGB (GL) and a css string (the
	 *  2D fallback's gradient stops). Shared by both edges. */
	stations: {
		deep: { rgb: [number, number, number]; css: string };
		edge: { rgb: [number, number, number]; css: string };
	}[];
	/** Crest line color (--dire-crest). */
	crest: { rgb: [number, number, number]; css: string };
	/** Ember glow color (--dire-ember). */
	ember: { rgb: [number, number, number]; css: string };
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
 * probe's `color` so the browser performs the same `hsl(from --dire …)`
 * rotation the old per-slot CSS did — parity by construction, and future
 * `--dire` tweaks keep cascading in. Two forced layouts, init/resize/
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

	// Ramp stations: each resolved through the probe's `color` (the browser
	// handles whatever color syntax the knob holds — hex, hsl, relative
	// color), then expanded to its two gradient stops in JS. Fallbacks match
	// the tools-layout defaults so a knob-less host stays on the ramp.
	const resolve = (cssVar: string) => {
		probe.style.color = cssVar;
		const css = getComputedStyle(probe).color;
		return { rgb: resolveColor(css), css };
	};
	const shade = (c: { rgb: [number, number, number] }) => {
		const rgb: [number, number, number] = [
			c.rgb[0] * WAVE_DEPTH_SHADE,
			c.rgb[1] * WAVE_DEPTH_SHADE,
			c.rgb[2] * WAVE_DEPTH_SHADE
		];
		const to255 = (v: number) => Math.round(v * 255);
		return { rgb, css: `rgb(${to255(rgb[0])}, ${to255(rgb[1])}, ${to255(rgb[2])})` };
	};
	const stations = [
		resolve('var(--dire-wave-far, #482f62)'),
		resolve('var(--dire-wave-mid, #703879)'),
		resolve('var(--dire-wave-near, #9c3774)')
	].map((edge) => ({ deep: shade(edge), edge }));

	const crest = resolve('var(--dire-crest, #e57db1)');
	const ember = resolve('var(--dire-ember, var(--dire, hsl(342 85% 46%)))');

	return {
		tileW,
		waveCover: num('--dire-wave-cover', 0.9),
		speed: num('--dire-speed', 1),
		noiseDur: dur('--dire-noise-dur', 8),
		crestW: num('--dire-crest-w', 2.5),
		crestA: num('--dire-crest-a', 0.85),
		stations,
		crest,
		ember
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
	uColorDeep: WebGLUniformLocation;
	uColorEdge: WebGLUniformLocation;
	uCover: WebGLUniformLocation;
	uCrestCol: WebGLUniformLocation;
	uCrestA: WebGLUniformLocation;
	uCrestV: WebGLUniformLocation;
}

interface NoisePipeline {
	kind: 'noise';
	program: WebGLProgram;
	uSize: WebGLUniformLocation;
	uTileSize: WebGLUniformLocation;
	uScroll: WebGLUniformLocation;
	uFieldH: WebGLUniformLocation;
	uTint: WebGLUniformLocation;
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

	const waveShape = rasterizeWaveShape();
	/** Per-layer gradient-filled tiles for the 2D fallback, keyed by the
	 *  resolved crest|edge stop pair. */
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
			uploadTexture(gl, waveShape, gl.CLAMP_TO_EDGE);
			gl.uniform1i(u(program, 'u_shape'), 0);
			return {
				kind: 'waves',
				program,
				uSize: u(program, 'u_size'),
				uTileW: u(program, 'u_tileW'),
				uGeom: u(program, 'u_geom'),
				uColorDeep: u(program, 'u_colorDeep'),
				uColorEdge: u(program, 'u_colorEdge'),
				uCover: u(program, 'u_cover'),
				uCrestCol: u(program, 'u_crestCol'),
				uCrestA: u(program, 'u_crestA'),
				uCrestV: u(program, 'u_crestV')
			};
		}
		const program = buildProgram(gl, NOISE_FRAGMENT_SRC);
		const pipeline: NoisePipeline = {
			kind: 'noise',
			program,
			uSize: u(program, 'u_size'),
			uTileSize: u(program, 'u_tileSize'),
			uScroll: u(program, 'u_scroll'),
			uFieldH: u(program, 'u_fieldH'),
			uTint: u(program, 'u_tint'),
			textureReady: false
		};
		gl.uniform2f(pipeline.uTileSize, NOISE_RENDER_W, NOISE_RENDER_H);
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
		// Pin the buffer's color space to sRGB — the spec default, asserted
		// explicitly because a compositor that treats the buffer as DEVICE
		// space on a P3 display reinterprets our sRGB numbers as P3
		// coordinates: waves render punchier + hue-rotated vs the identical
		// CSS gradient color, a gap no gradient alpha can close (it is
		// outside the sRGB gamut). Guarded: engines without the property
		// just gain an inert JS field.
		if (gl && 'drawingBufferColorSpace' in gl) gl.drawingBufferColorSpace = 'srgb';
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

	/** Gradient-filled copy of the silhouette for the 2D fallback: the shape
	 *  mask × the layer's deep→edge station fill (same span the shader mixes
	 *  over). The crest LINE is GL-only — a static fallback frame doesn't
	 *  earn the extra offset-mask pass. */
	function tintedTile(deepCss: string, edgeCss: string): HTMLCanvasElement {
		const key = `${deepCss}|${edgeCss}`;
		let tile = tintedTiles.get(key);
		if (!tile) {
			tile = document.createElement('canvas');
			tile.width = TILE_W;
			tile.height = TILE_H;
			const ctx = tile.getContext('2d')!;
			ctx.drawImage(waveShape, 0, 0);
			ctx.globalCompositeOperation = 'source-in';
			const scale = TILE_H / 200;
			const grad = ctx.createLinearGradient(0, GRAD_Y_CREST * scale, 0, GRAD_Y_EDGE * scale);
			grad.addColorStop(0, deepCss);
			grad.addColorStop(1, edgeCss);
			ctx.fillStyle = grad;
			ctx.fillRect(0, 0, TILE_W, TILE_H);
			tintedTiles.set(key, tile);
		}
		return tile;
	}

	/** Sync a band's backing store to its CSS box. True if it changed. */
	function sizeBacking(band: Band): boolean {
		const w = band.canvas.clientWidth;
		const h = band.canvas.clientHeight;
		if (w === 0 || h === 0) return false;
		const cap = band.layers ? MAX_WAVE_BACKING_DPR : MAX_EMBER_BACKING_DPR;
		const scale = Math.min(cap, window.devicePixelRatio || 1);
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
	const colorDeepArr = new Float32Array(9);
	const colorEdgeArr = new Float32Array(9);
	const crestVArr = new Float32Array(3);

	function renderWavesGL(band: Band, t: number, staticFrame: boolean): void {
		const gl = band.gl!;
		const p = band.pipeline as WavePipeline;
		for (let i = 0; i < 3; i++) {
			const layer = band.layers![i];
			const waveH = knobs.tileW / layer.hDiv;
			geom[i * 4] = slotTopY(layer, band.isTop, band.cssH, waveH);
			geom[i * 4 + 1] = waveH;
			geom[i * 4 + 2] = staticFrame ? 0 : wavePhase(layer, t, knobs.speed);
			geom[i * 4 + 3] = band.isTop ? 1 : 0;
			const station = knobs.stations[layer.station];
			colorDeepArr.set(station.deep.rgb, i * 3);
			colorEdgeArr.set(station.edge.rgb, i * 3);
			// Crest thickness in tile-v units: v spans waveH CSS px.
			crestVArr[i] = knobs.crestW / waveH;
		}
		gl.viewport(0, 0, band.canvas.width, band.canvas.height);
		gl.uniform2f(p.uSize, band.cssW, band.cssH);
		gl.uniform1f(p.uTileW, knobs.tileW);
		gl.uniform4fv(p.uGeom, geom);
		gl.uniform3fv(p.uColorDeep, colorDeepArr);
		gl.uniform3fv(p.uColorEdge, colorEdgeArr);
		gl.uniform1f(p.uCover, knobs.waveCover);
		gl.uniform3f(p.uCrestCol, knobs.crest.rgb[0], knobs.crest.rgb[1], knobs.crest.rgb[2]);
		gl.uniform1f(p.uCrestA, knobs.crestA);
		gl.uniform3fv(p.uCrestV, crestVArr);
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
		// Wrap distance = the effective tile height the shader divides by, so the
		// phase always returns to itself (seamless). One grain-cycle per noiseDur
		// still — the absolute px/s rises with the grain, so the perceived speed
		// (grain-widths per second) is unchanged.
		const scroll = staticFrame ? 0 : fract(t / knobs.noiseDur) * NOISE_RENDER_H;
		// Field top tracks the bottom waves' crest line (+ the authored overshoot)
		// so the topmost embers float just above the crests at any viewport width.
		const waveH = knobs.tileW / BOTTOM_LAYERS[0].hDiv;
		gl.uniform2f(p.uSize, band.cssW, band.cssH);
		gl.uniform1f(p.uScroll, scroll);
		gl.uniform1f(p.uFieldH, Math.min(waveH + EMBER_OVERSHOOT_PX, band.cssH));
		gl.uniform3f(p.uTint, knobs.ember.rgb[0], knobs.ember.rgb[1], knobs.ember.rgb[2]);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
	}

	/** 2D static fallback (no WebGL2): the same composite at phase 0, painted
	 *  once per size/knob change. */
	function render2d(band: Band): void {
		const ctx = band.ctx2d!;
		ctx.setTransform(band.dpr, 0, 0, band.dpr, 0, 0);
		ctx.clearRect(0, 0, band.cssW, band.cssH);
		if (!band.layers) {
			// Ember band: stays transparent in the fallback. The old CSS plate +
			// tint-base that made the static veil legible are retired; a still
			// frame of procedural glow-dots isn't worth a second implementation
			// for the WebGL2-less cohort — the near-opaque waves carry the edge.
			return;
		}
		band.layers.forEach((layer) => {
			const waveH = knobs.tileW / layer.hDiv;
			const top = slotTopY(layer, band.isTop, band.cssH, waveH);
			ctx.save();
			if (band.isTop) {
				// scaleY(-1) — tile body hangs down from the slot top
				ctx.translate(0, top + waveH);
				ctx.scale(1, -1);
			} else {
				ctx.translate(0, top);
			}
			// One draw per layer: the gradient-filled tile at the layer opacity —
			// exactly the GL composite (opaque fill × u_cover, source-over).
			ctx.globalAlpha = knobs.waveCover;
			const station = knobs.stations[layer.station];
			const tile = tintedTile(station.deep.css, station.edge.css);
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
