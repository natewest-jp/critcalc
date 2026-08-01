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
 *  from the shipped CSS strips. ↻ 2026-08-01 line-layer redesign (Nate): two
 *  BODY waves + one LINE wave, replacing three bodies —
 *    · body layers ('far' behind, 'near' in front) fill with a HORIZONTAL
 *      screen-space gradient (--dire-wave-*-l → -r): a crest travels through
 *      the hues as it crosses the viewport (the Stygian strip's measured
 *      H292→H329 drift). Bodies carry NO edge line.
 *    · the 'line' layer (the old mid slot, its motion kept) is a stroke-only
 *      silhouette: no fill, just the thin --dire-crest edge line, breathing
 *      in and out of transparency via a drifting opacity modulation.
 *  Array order is PAINT order: far body deepest, line between, near body on
 *  top. */
interface WaveLayer {
	flowDur: number; // s, before the --dire-speed divide
	hDiv: number;
	role: 'far' | 'line' | 'near';
	marginPx: number;
	delayS: number; // the CSS animation-delay (negative = started that long ago)
	reverse: boolean;
}

/** Crest-side shade factor: each body's fill darkens toward its crest by this
 *  multiple — ONE depth constant where six pinned lightnesses used to live.
 *  Applied in-shader (vertical), composing with the horizontal hue gradient. */
const WAVE_DEPTH_SHADE = 0.62;

/* ↻ 2026-08-01 (Nate's alignment pass): the two BODIES counter-flow (near
 * reversed against far on both edges) and both crest out at the edge mark —
 * far exactly at --dire-top-h/--dire-bottom-h (margin 0), near shallower by
 * the --dire-near-drop knob (applied in geometry, not here). The line weaves
 * between them at a small fixed offset. */
const BOTTOM_LAYERS: WaveLayer[] = [
	// deepest body (violet→crimson sweep), crest at the mark
	{ flowDur: 30, hDiv: 15, role: 'far', marginPx: 0, delayS: 0, reverse: false },
	// the breathing edge line, weaving between the bodies
	{ flowDur: 46, hDiv: 15, role: 'line', marginPx: -8, delayS: -13, reverse: true },
	// front body — counter-flows the far body, --dire-near-drop shallower
	{ flowDur: 38, hDiv: 15, role: 'near', marginPx: 0, delayS: -7, reverse: true }
];

const TOP_LAYERS: WaveLayer[] = [
	// deepest body (violet→crimson sweep), crest at the mark
	{ flowDur: 34, hDiv: 17, role: 'far', marginPx: 0, delayS: 0, reverse: true },
	// the breathing edge line, weaving between the bodies
	{ flowDur: 50, hDiv: 17, role: 'line', marginPx: -8, delayS: -17, reverse: false },
	// front body — counter-flows the far body, --dire-near-drop shallower
	{ flowDur: 42, hDiv: 17, role: 'near', marginPx: 0, delayS: -5, reverse: false }
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
 *    channel; one tile serves all six layers.
 *  - BODY layers (u_role 0): fill = the layer's horizontal screen-space
 *    gradient (u_colorL → u_colorR over the viewport width — a crest travels
 *    through the hues as it crosses), shaded toward the crest side by
 *    WAVE_DEPTH_SHADE (the vertical depth cue). No edge line.
 *  - The LINE layer (u_role 1): no fill — only the silhouette-edge stroke,
 *    found by a second mask sample offset toward the boundary (u_crestV,
 *    tile-v units): fragments inside the shape whose offset sample falls
 *    outside it are within the line. Its opacity BREATHES: a sinusoidal
 *    modulation over tile-u with its own clock (u_fade = cycles, phase,
 *    floor) drifts along the line, so segments dissolve to transparent and
 *    re-emerge — the fade Nate asked for, trivial in a shader where SVG
 *    strokes would fight it.
 *
 * SCROLL-UNDER: body fills are opaque analytic gradients masked by u_shape
 * (the silhouette rastered SOLID, so the boundary keeps its raster
 * antialiasing) and composited source-over at u_cover opacity — at ~0.9 they
 * occlude content scrolling behind the waves, at low cover they run as
 * luminous washes and the line carries the edge.
 *
 * highp: v_css spans the viewport width — mediump (fp16 floor) would quantize
 * the scroll to visible ~2px steps on mobile GPUs.
 */
const WAVE_FRAGMENT_SRC = `
precision highp float;
varying vec2 v_css;
uniform sampler2D u_shape; // silhouette solid (alpha) — antialiased coverage mask
uniform vec2 u_size;       // canvas CSS size (px) — .x spans the viewport
uniform float u_tileW;
uniform vec4 u_geom[3];   // slotTopY, waveH, signedPhase, flip
uniform vec3 u_colorL[3]; // body hue cycle, pole A
uniform vec3 u_colorR[3]; // body hue cycle, pole B
uniform vec3 u_role;      // 0 = body, 1 = line
uniform float u_cover;    // body opacity at the crest
uniform float u_baseA;    // body alpha multiplier at the viewport-edge side (--dire-wave-base-a)
uniform vec3 u_crestCol;  // line color (--dire-crest)
uniform float u_crestA;   // line peak opacity (--dire-crest-a)
uniform vec3 u_crestV;    // per-layer line thickness, tile-v units
uniform vec4 u_fade;      // line fade: cycles per tile, drift phase, floor, bias exponent
uniform float u_fade2;    // twin line's fade phase (opposite drift, JS-side)
uniform vec3 u_crest2V;   // twin line's vertical offset, tile-v units
void main() {
	vec4 acc = vec4(0.0);
	for (int i = 0; i < 3; i++) {
		float v = (v_css.y - u_geom[i].x) / u_geom[i].y;
		v = mix(v, 1.0 - v, u_geom[i].w);
		if (v > 0.0 && v < 1.0) {
			float u = fract(v_css.x / u_tileW + u_geom[i].z);
			float shape = texture2D(u_shape, vec2(u, v)).a;
			if (u_role[i] < 0.5) {
				// The hue gradient rides tile space (u carries the layer's own
				// scroll phase), so the colors TRAVEL WITH the wave — and the
				// counter-flowing bodies carry theirs in opposite directions.
				// Cosine cycle (pole A → pole B → pole A per tile) so the
				// tile seam wraps with no color jump.
				float w = 0.5 - 0.5 * cos(6.28318 * u);
				vec3 grad = mix(u_colorL[i], u_colorR[i], w);
				float g = clamp(
					(v * 200.0 - ${GRAD_Y_CREST.toFixed(2)}) / ${(GRAD_Y_EDGE - GRAD_Y_CREST).toFixed(2)},
					0.0, 1.0);
				// Body: fully opaque (× cover) at the CREST, easing toward the
				// viewport-edge side (u_baseA) — the crest is the hard line,
				// the base dissolves into the horizon glow behind it.
				float body = shape * u_cover * mix(1.0, u_baseA, g);
				vec3 col = grad * mix(${WAVE_DEPTH_SHADE.toFixed(2)}, 1.0, g);
				acc = vec4(col, 1.0) * body + acc * (1.0 - body);
			} else {
				// Twin breathing lines: same stroke, the second offset deeper
				// into the body (u_crest2V) with its fade drifting the OTHER
				// way — segments cross and pass each other. The bias exponent
				// narrows the bright segments (more of the line spends its
				// time transparent).
				float above1 = texture2D(u_shape, vec2(u, v - u_crestV[i])).a;
				float bright1 = pow(0.5 + 0.5 * sin(6.28318 * (u * u_fade.x + u_fade.y)), u_fade.w);
				float line1 = shape * (1.0 - above1) * u_crestA * mix(u_fade.z, 1.0, bright1);
				float s2 = texture2D(u_shape, vec2(u, v - u_crest2V[i])).a;
				float a2 = texture2D(u_shape, vec2(u, v - u_crest2V[i] - u_crestV[i])).a;
				float bright2 = pow(0.5 + 0.5 * sin(6.28318 * (u * u_fade.x + u_fade2)), u_fade.w);
				float line2 = s2 * (1.0 - a2) * u_crestA * mix(u_fade.z, 1.0, bright2);
				acc = vec4(u_crestCol, 1.0) * line1 + acc * (1.0 - line1);
				acc = vec4(u_crestCol, 1.0) * line2 + acc * (1.0 - line2);
			}
		}
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

interface ResolvedColor {
	rgb: [number, number, number];
	css: string;
}

interface Knobs {
	tileW: number; // px (resolved from the vw-typed knob)
	waveCover: number; // body opacity, --dire-wave-cover
	speed: number;
	noiseDur: number; // s
	crestW: number; // line thickness, CSS px (--dire-crest-w)
	crestA: number; // line peak opacity (--dire-crest-a)
	fadeN: number; // line fade cycles per tile (--dire-crest-fade-n)
	fadeDur: number; // s per fade drift cycle (--dire-crest-fade-dur)
	fadeMin: number; // fade trough floor 0–1 (--dire-crest-fade-min)
	fadeBias: number; // bright-segment narrowing exponent (--dire-crest-fade-bias)
	crest2Off: number; // twin line's vertical offset, CSS px (--dire-crest2-off)
	nearDrop: number; // near body's crest drop below the mark, CSS px (--dire-near-drop)
	bodyBaseA: number; // body alpha multiplier at the viewport-edge side (--dire-wave-base-a)
	/** The two body waves' horizontal gradient endpoints (viewport left →
	 *  right). Both the parsed 0–1 RGB (GL) and a css string (2D fallback).
	 *  Shared by both edges. */
	far: { l: ResolvedColor; r: ResolvedColor };
	near: { l: ResolvedColor; r: ResolvedColor };
	/** Line color (--dire-crest). */
	crest: ResolvedColor;
	/** Ember glow color (--dire-ember). */
	ember: ResolvedColor;
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

	// Ramp colors: each resolved through the probe's `color` (the browser
	// handles whatever color syntax the knob holds — hex, hsl, relative
	// color). Fallbacks match the tools-layout defaults so a knob-less host
	// stays on the ramp.
	const resolve = (cssVar: string): ResolvedColor => {
		probe.style.color = cssVar;
		const css = getComputedStyle(probe).color;
		return { rgb: resolveColor(css), css };
	};
	const far = {
		l: resolve('var(--dire-wave-far-l, #562974)'),
		r: resolve('var(--dire-wave-far-r, #86306f)')
	};
	const near = {
		l: resolve('var(--dire-wave-near-l, #86306f)'),
		r: resolve('var(--dire-wave-near-r, #9e2952)')
	};
	const crest = resolve('var(--dire-crest, #e57db1)');
	const ember = resolve('var(--dire-ember, var(--dire, hsl(342 85% 46%)))');

	return {
		tileW,
		waveCover: num('--dire-wave-cover', 0.9),
		speed: num('--dire-speed', 1),
		noiseDur: dur('--dire-noise-dur', 8),
		crestW: num('--dire-crest-w', 2.5),
		crestA: num('--dire-crest-a', 0.85),
		fadeN: num('--dire-crest-fade-n', 2),
		fadeDur: dur('--dire-crest-fade-dur', 8),
		fadeMin: num('--dire-crest-fade-min', 0),
		fadeBias: num('--dire-crest-fade-bias', 2.5),
		crest2Off: num('--dire-crest2-off', 6),
		nearDrop: num('--dire-near-drop', 15),
		bodyBaseA: num('--dire-wave-base-a', 0.8),
		far,
		near,
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
 *  instead of opening a gap). `marginPx` = the layer's def margin plus any
 *  dynamic drop (--dire-near-drop for the near body); negative = shallower. */
function slotTopY(marginPx: number, isTop: boolean, canvasH: number, waveH: number): number {
	const clamp = Math.min(0, canvasH - waveH);
	return isTop ? clamp + marginPx : canvasH - (clamp + marginPx) - waveH;
}

/** A layer's effective margin: the near body carries the --dire-near-drop
 *  knob on top of its def margin. */
function layerMargin(layer: WaveLayer, nearDrop: number): number {
	return layer.role === 'near' ? layer.marginPx - nearDrop : layer.marginPx;
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
	uColorL: WebGLUniformLocation;
	uColorR: WebGLUniformLocation;
	uRole: WebGLUniformLocation;
	uCover: WebGLUniformLocation;
	uBaseA: WebGLUniformLocation;
	uCrestCol: WebGLUniformLocation;
	uCrestA: WebGLUniformLocation;
	uCrestV: WebGLUniformLocation;
	uFade: WebGLUniformLocation;
	uFade2: WebGLUniformLocation;
	uCrest2V: WebGLUniformLocation;
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
				uColorL: u(program, 'u_colorL'),
				uColorR: u(program, 'u_colorR'),
				uRole: u(program, 'u_role'),
				uCover: u(program, 'u_cover'),
				uBaseA: u(program, 'u_baseA'),
				uCrestCol: u(program, 'u_crestCol'),
				uCrestA: u(program, 'u_crestA'),
				uCrestV: u(program, 'u_crestV'),
				uFade: u(program, 'u_fade'),
				uFade2: u(program, 'u_fade2'),
				uCrest2V: u(program, 'u_crest2V')
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

	/** 2D-fallback band painter: the silhouette tile × the body's CYCLIC hue
	 *  gradient (pole A → B → A per tile, linear stops standing in for the
	 *  shader's cosine — close enough for one static frame). Tile-space like
	 *  the shader, so the fallback matches the GL frame at phase 0. The line
	 *  layer and the vertical depth shade stay GL-only. */
	function paintBodyBand(
		ctx: CanvasRenderingContext2D,
		band: Band,
		layer: WaveLayer,
		waveH: number,
		top: number
	): void {
		const tile = document.createElement('canvas');
		tile.width = TILE_W;
		tile.height = TILE_H;
		const tctx = tile.getContext('2d')!;
		tctx.drawImage(waveShape, 0, 0);
		tctx.globalCompositeOperation = 'source-in';
		const body = layer.role === 'near' ? knobs.near : knobs.far;
		const grad = tctx.createLinearGradient(0, 0, TILE_W, 0);
		grad.addColorStop(0, body.l.css);
		grad.addColorStop(0.5, body.r.css);
		grad.addColorStop(1, body.l.css);
		tctx.fillStyle = grad;
		tctx.fillRect(0, 0, TILE_W, TILE_H);
		ctx.save();
		if (band.isTop) {
			// scaleY(-1) — tile body hangs down from the slot top
			ctx.translate(0, top + waveH);
			ctx.scale(1, -1);
		} else {
			ctx.translate(0, top);
		}
		ctx.globalAlpha = knobs.waveCover;
		for (let x = 0; x < band.cssW; x += knobs.tileW) {
			ctx.drawImage(tile, x, 0, knobs.tileW, waveH);
		}
		ctx.restore();
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
	const colorLArr = new Float32Array(9);
	const colorRArr = new Float32Array(9);
	const roleArr = new Float32Array(3);
	const crestVArr = new Float32Array(3);
	const crest2VArr = new Float32Array(3);

	function renderWavesGL(band: Band, t: number, staticFrame: boolean): void {
		const gl = band.gl!;
		const p = band.pipeline as WavePipeline;
		for (let i = 0; i < 3; i++) {
			const layer = band.layers![i];
			const waveH = knobs.tileW / layer.hDiv;
			geom[i * 4] = slotTopY(layerMargin(layer, knobs.nearDrop), band.isTop, band.cssH, waveH);
			geom[i * 4 + 1] = waveH;
			geom[i * 4 + 2] = staticFrame ? 0 : wavePhase(layer, t, knobs.speed);
			geom[i * 4 + 3] = band.isTop ? 1 : 0;
			roleArr[i] = layer.role === 'line' ? 1 : 0;
			const body = layer.role === 'near' ? knobs.near : knobs.far; // line entries unused
			colorLArr.set(body.l.rgb, i * 3);
			colorRArr.set(body.r.rgb, i * 3);
			// Line thickness / twin offset in tile-v units: v spans waveH CSS px.
			crestVArr[i] = knobs.crestW / waveH;
			crest2VArr[i] = knobs.crest2Off / waveH;
		}
		gl.viewport(0, 0, band.canvas.width, band.canvas.height);
		gl.uniform2f(p.uSize, band.cssW, band.cssH);
		gl.uniform1f(p.uTileW, knobs.tileW);
		gl.uniform4fv(p.uGeom, geom);
		gl.uniform3fv(p.uColorL, colorLArr);
		gl.uniform3fv(p.uColorR, colorRArr);
		gl.uniform3fv(p.uRole, roleArr);
		gl.uniform1f(p.uCover, knobs.waveCover);
		gl.uniform1f(p.uBaseA, knobs.bodyBaseA);
		gl.uniform3f(p.uCrestCol, knobs.crest.rgb[0], knobs.crest.rgb[1], knobs.crest.rgb[2]);
		gl.uniform1f(p.uCrestA, knobs.crestA);
		gl.uniform3fv(p.uCrestV, crestVArr);
		gl.uniform3fv(p.uCrest2V, crest2VArr);
		// Fade drift phases ride their own clock (fadeDur per cycle); the twin
		// drifts the OPPOSITE way, offset so the two never breathe in unison.
		// Static frames (reduced motion) pin both at bright alignments.
		const fadePhase = staticFrame ? 0.25 : fract(t / knobs.fadeDur);
		const fadePhase2 = staticFrame ? 0.6 : 0.35 - fract(t / knobs.fadeDur);
		gl.uniform4f(p.uFade, knobs.fadeN, fadePhase, knobs.fadeMin, knobs.fadeBias);
		gl.uniform1f(p.uFade2, fadePhase2);
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
			if (layer.role === 'line') return; // GL-only (see paintBodyBand)
			const waveH = knobs.tileW / layer.hDiv;
			const top = slotTopY(layerMargin(layer, knobs.nearDrop), band.isTop, band.cssH, waveH);
			paintBodyBand(ctx, band, layer, waveH, top);
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
