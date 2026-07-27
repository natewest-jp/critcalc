import { stars, type JitterVariant, type StarAnimation, type StarColor } from '$lib/stars';

/**
 * WebGL starfield — the twinkle layer as ONE canvas of point sprites.
 *
 * Replaces the former per-star `<span>` field (1,400 elements, 1,400 live CSS
 * animations, ~1,415 compositor layers on `/`). The canvas is a single texture
 * inside the `.twinkle` scene layer, so the WAAPI pan and cursor parallax that
 * translate the parent move the whole field for free; per-frame work is one
 * `drawArrays(gl.POINTS)` call over a static VBO with all animation evaluated
 * in the vertex shader from a time uniform.
 *
 * Contracts this module keeps:
 *  - Star data comes from `$lib/stars` untouched — positions, sizes, tints,
 *    timings and animation families all feed vertex attributes directly.
 *  - Phases are ABSOLUTE-time based (`(time + delay) / duration mod 1`), so
 *    stopping the loop and restarting it later resumes every star exactly
 *    where it would have been — no pop on tool-route suspend/resume.
 *  - The rAF loop must be provably dead behind tools and hidden tabs (the
 *    scene-occlusion constraint): `stop()` + the internal visibility gate
 *    guarantee zero rAF work while the scene is occluded. The last presented
 *    frame simply stays visible in the canvas.
 *  - Reduced motion renders exactly one static frame with every star at
 *    STATIC_ALPHA (the old CSS froze spans at opacity 0.8) — no loop.
 *  - No WebGL at all → one static 2D-canvas frame of the same field. There is
 *    deliberately NO span fallback: two implementations of the twinkle is how
 *    parity rots.
 */

// --- Tuning knobs --------------------------------------------------------

/** Halo sprite size vs the core disc. The old CSS halo was a pseudo-element
 *  at `inset: -120%` — 1.2 core-widths beyond each side, so 3.4× overall. */
const HALO_SCALE = 3.4;

/** Peak halo intensity at the sprite center. The CSS pseudo had opacity 0.5
 *  over an alpha mask; the mask's stops were exact samples of (1 − t)², which
 *  the fragment shader reproduces analytically. */
const HALO_INTENSITY = 0.5;

/** Jitter flicker depth — the single dial for how visible the flicker is.
 *  Each stop dips a star's opacity by (FLICKER × stop depth × its base), the
 *  deepest stop using the full FLICKER. Matches the old CSS `--flicker`. */
const FLICKER = 0.4;

/** Frozen-field opacity for the non-animating renders (reduced motion, no-GL
 *  2D fallback). Matches the old reduced-motion CSS (`opacity: 0.8`). */
const STATIC_ALPHA = 0.8;

/** Backing-store resolution cap, in device px per CSS px. 1 is the memory
 *  lever: the twinkle layer is ~2434×661 CSS px at a 1000px-tall viewport,
 *  ≈6.4MB of texture at 1× — 4× that at retina 2×. The stars are glowy
 *  points, so 1× reads fine; revisit 1.5 only if dots look soft on retina. */
const MAX_BACKING_DPR = 1;

/** Trailing debounce for backing-store resizes (viewport resize / zoom). */
const RESIZE_DEBOUNCE_MS = 150;

// --- Star tints -----------------------------------------------------------

/** Resolve `color-mix(in srgb, white N%, <tint>)` to literal RGB (0–1). The
 *  five tints are constants in the old CSS; computing the mixes here keeps
 *  the recipe readable instead of hardcoding opaque channel values. */
function mixWhite(whitePct: number, hex: string): [number, number, number] {
	const n = parseInt(hex.slice(1), 16);
	const w = whitePct / 100;
	const mix = (ch: number) => (w * 255 + (1 - w) * ch) / 255;
	return [mix((n >> 16) & 255), mix((n >> 8) & 255), mix(n & 255)];
}

/** White-biased per Nate; chromas kept low so tints read as subtle hue
 *  suggestions rather than colored dots (same values the CSS classes held). */
const TINTS: Record<StarColor, [number, number, number]> = {
	white: mixWhite(100, '#ffffff'),
	warm: mixWhite(92, '#ffd8a8'),
	cool: mixWhite(92, '#c0d8ff'),
	yellow: mixWhite(85, '#ffd070'),
	amber: mixWhite(82, '#ffaa50')
};

// --- Jitter stop tables ----------------------------------------------------

/** The three desync flicker variants — [phase, depth] pairs copied VERBATIM
 *  from the old `t-jitter-a/b/c` CSS keyframes (13 stops each, linear timing;
 *  depth is the fraction of FLICKER the stop dips by). 0% and 100% match so
 *  the loop is seamless. */
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
 * Vertex shader: evaluates the star's animation family at `u_time` and emits
 * point size + per-fragment shading params.
 *
 *  - gentle:   opacity 0.2·base → 1 → 0.2·base. A raised cosine stands in for
 *              the CSS ease-in-out segments (visually close; if Nate can tell
 *              the difference on-device, evaluate the real cubic bezier here).
 *  - jitter:   13-stop piecewise-LINEAR flicker (variants a/b/c) — exact.
 *  - dramatic: opacity 0.15·base → 1 with scale(1 → 1.15) at peak — the scale
 *              multiplies the point size, halo and all, like the CSS transform.
 *
 * Dynamic uniform-array indexing is legal in GLSL ES 1.0 VERTEX shaders (it is
 * the fragment stage that's restricted), so the jitter tables live in two
 * uniform float arrays indexed by variant.
 */
const VERTEX_SRC = `
precision highp float;

attribute vec2 a_pos;      // star position, % of the sky region (box top-left, like the old left/top)
attribute vec2 a_sizeBase; // x: core diameter (CSS px)   y: resting opacity floor
attribute vec2 a_timing;   // x: cycle duration (s)       y: phase offset (s, the old negative delay)
attribute vec3 a_kind;     // x: anim family 0|1|2   y: jitter variant 0|1|2   z: halo 0|1
attribute vec3 a_color;    // resolved tint, 0-1

uniform vec2 u_res;     // canvas CSS size (px)
uniform float u_dpr;    // backing-store device px per CSS px
uniform float u_time;   // seconds
uniform float u_static; // >= 0: static frame at this uniform opacity; < 0: animate
uniform float u_jPos[${3 * STOPS_PER_VARIANT}]; // jitter stop phases, 13 per variant
uniform float u_jK[${3 * STOPS_PER_VARIANT}];   // matching flicker depths

varying vec3 v_color;
varying float v_alpha;
varying float v_core; // core disc radius as a fraction of the sprite radius
varying float v_halo;
varying float v_aa;   // one device px in point-coord r units (AA edge width)

const float TAU = 6.28318530718;
const float FLICKER = ${FLICKER};
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
		alpha = a_sizeBase.y * (1.0 - FLICKER * jitterK(phase, int(a_kind.y + 0.5)));
	} else {                     // dramatic
		float pulse = 0.5 - 0.5 * cos(TAU * phase);
		alpha = mix(a_sizeBase.y * 0.15, 1.0, pulse);
		scale = 1.0 + 0.15 * pulse;
	}

	float haloMul = mix(1.0, HALO_SCALE, a_kind.z);
	float spritePx = a_sizeBase.x * haloMul * scale * u_dpr;
	gl_PointSize = max(spritePx, 1.0);

	// The old spans were positioned by their top-left corner (left/top = x/y %),
	// so the disc center sits half a core-size beyond that.
	vec2 clip = (a_pos * 0.01 * u_res + a_sizeBase.x * 0.5) / u_res * 2.0 - 1.0;
	gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);

	v_color = a_color;
	v_alpha = alpha;
	v_core = 1.0 / haloMul;
	v_halo = a_kind.z;
	v_aa = 2.0 / max(spritePx, 1.0);
}
`;

/**
 * Fragment shader: core disc + eased halo in one sprite, no textures.
 *
 * The core is a crisp disc with a ~1px coverage edge CENTERED on the boundary
 * (so a 1px star still hits full alpha at its center instead of being halved
 * by a one-sided smoothstep). The halo is (1 − r)² × HALO_INTENSITY from the
 * sprite center to its edge — the old CSS mask's stops (0.72 @15%, 0.49 @30%,
 * 0.3 @45%, …) are exact samples of that curve, so this IS the halo, not an
 * approximation. Both ride the star's animated opacity, composited
 * source-over like the span + pseudo-element did.
 *
 * Output is PREMULTIPLIED: (color·a, a) with a (ONE, ONE_MINUS_SRC_ALPHA)
 * blend. Writing straight alpha with (SRC_ALPHA, …) into a transparent canvas
 * double-attenuates — the blend stores color·a WITH alpha a², so each star
 * composites over the page at ~a² and the dim half of the field vanishes
 * (caught on the first verification pass).
 */
const FRAGMENT_SRC = `
precision mediump float;

varying vec3 v_color;
varying float v_alpha;
varying float v_core;
varying float v_halo;
varying float v_aa;

const float HALO_INTENSITY = ${HALO_INTENSITY};

void main() {
	float r = length(gl_PointCoord * 2.0 - 1.0);
	float core = clamp((v_core - r) / v_aa + 0.5, 0.0, 1.0);
	float fall = max(1.0 - r, 0.0); // clamp: r > 1 in sprite corners, (1-r)² would re-brighten
	float halo = v_halo * HALO_INTENSITY * fall * fall;
	float a = (core + halo * (1.0 - core)) * v_alpha;
	gl_FragColor = vec4(v_color * a, a);
}
`;

// --- GL pipeline -------------------------------------------------------------

const FLOATS_PER_STAR = 12;

interface Pipeline {
	uTime: WebGLUniformLocation;
	uRes: WebGLUniformLocation;
	uDpr: WebGLUniformLocation;
	uStatic: WebGLUniformLocation;
}

function compileShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
	const shader = gl.createShader(type)!;
	gl.shaderSource(shader, src);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		throw new Error(`starfield shader: ${gl.getShaderInfoLog(shader) ?? 'compile failed'}`);
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
		data[o++] = s.halo ? 1 : 0;
		data[o++] = r;
		data[o++] = g;
		data[o++] = b;
	}
	return data;
}

/** Compile, link, upload the static VBO and bind everything. One program, one
 *  buffer, bound once — state persists across frames (rebuilt on context
 *  restore). Throws on compile/link failure. */
function buildPipeline(gl: WebGLRenderingContext): Pipeline {
	const program = gl.createProgram()!;
	gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, VERTEX_SRC));
	gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SRC));
	gl.linkProgram(program);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		throw new Error(`starfield link: ${gl.getProgramInfoLog(program) ?? 'link failed'}`);
	}
	gl.useProgram(program);

	gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
	gl.bufferData(gl.ARRAY_BUFFER, buildVertexData(), gl.STATIC_DRAW);

	const stride = FLOATS_PER_STAR * 4;
	const attribs: [name: string, size: number, offset: number][] = [
		['a_pos', 2, 0],
		['a_sizeBase', 2, 8],
		['a_timing', 2, 16],
		['a_kind', 3, 24],
		['a_color', 3, 36]
	];
	for (const [name, size, offset] of attribs) {
		const loc = gl.getAttribLocation(program, name);
		gl.enableVertexAttribArray(loc);
		gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset);
	}

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

	// Premultiplied-alpha pipeline (see FRAGMENT_SRC doc): the shader emits
	// (color·a, a), so source-over is (ONE, ONE_MINUS_SRC_ALPHA) and the
	// browser composites the canvas premultiplied (context default).
	gl.enable(gl.BLEND);
	gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
	gl.clearColor(0, 0, 0, 0);

	const u = (name: string) => gl.getUniformLocation(program, name)!;
	return { uTime: u('u_time'), uRes: u('u_res'), uDpr: u('u_dpr'), uStatic: u('u_static') };
}

// --- Controller ----------------------------------------------------------------

export interface StarfieldHandle {
	/** Allow the animation loop. Actual looping still gates on document
	 *  visibility, reduced motion and GL health — reduced motion under
	 *  start() paints one static frame instead. */
	start(): void;
	/** Stop the loop. The last presented frame stays visible in the canvas;
	 *  a later start() resumes pop-free (phases derive from absolute time). */
	stop(): void;
	/** True while a rAF frame is scheduled (verification probe). */
	readonly running: boolean;
	destroy(): void;
}

export function createStarfield(canvas: HTMLCanvasElement): StarfieldHandle {
	let wantRun = false;
	let contextLost = false;
	let destroyed = false;
	let raf = 0;
	let resizeTimer: ReturnType<typeof setTimeout> | undefined;

	// Canvas CSS size and the backing-store scale actually in effect.
	let cssW = 0;
	let cssH = 0;
	let dpr = 1;

	const reducedMq = window.matchMedia('(prefers-reduced-motion: reduce)');

	const gl = canvas.getContext('webgl', {
		alpha: true,
		antialias: false,
		depth: false,
		stencil: false,
		premultipliedAlpha: true, // matches the shader's premultiplied output
		powerPreference: 'low-power'
	});
	let pipeline: Pipeline | null = null;
	if (gl) {
		try {
			pipeline = buildPipeline(gl);
		} catch (err) {
			// Context exists but the pipeline won't build (driver quirk). The
			// canvas can no longer yield a 2D context, so leave it blank — the
			// sky image's baked anchor stars cover visually.
			console.error('starfield: WebGL pipeline failed, field disabled', err);
		}
	}
	// No WebGL at all → the canvas is still free for a 2D context; render the
	// same field as a one-time static frame (arc cores + radial-gradient halos).
	const ctx2d = gl ? null : canvas.getContext('2d');

	/** Sync the backing store to the canvas's CSS box. True if it changed. */
	function sizeBacking(): boolean {
		const w = canvas.clientWidth;
		const h = canvas.clientHeight;
		if (w === 0 || h === 0) return false;
		const scale = Math.min(MAX_BACKING_DPR, window.devicePixelRatio || 1);
		const bw = Math.max(1, Math.round(w * scale));
		const bh = Math.max(1, Math.round(h * scale));
		if (w === cssW && h === cssH && bw === canvas.width && bh === canvas.height) return false;
		cssW = w;
		cssH = h;
		dpr = bw / w;
		canvas.width = bw;
		canvas.height = bh;
		return true;
	}

	function renderGL(timeMs: number): void {
		if (!gl || !pipeline) return;
		gl.viewport(0, 0, canvas.width, canvas.height);
		gl.clear(gl.COLOR_BUFFER_BIT);
		gl.uniform1f(pipeline.uTime, timeMs / 1000);
		gl.uniform2f(pipeline.uRes, cssW, cssH);
		gl.uniform1f(pipeline.uDpr, dpr);
		gl.uniform1f(pipeline.uStatic, reducedMq.matches ? STATIC_ALPHA : -1);
		gl.drawArrays(gl.POINTS, 0, stars.length);
	}

	function render2d(ctx: CanvasRenderingContext2D): void {
		const rgba = (t: [number, number, number], a: number) =>
			`rgba(${Math.round(t[0] * 255)}, ${Math.round(t[1] * 255)}, ${Math.round(t[2] * 255)}, ${a})`;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, cssW, cssH);
		for (const s of stars) {
			const tint = TINTS[s.color];
			const cx = (s.x / 100) * cssW + s.size / 2;
			const cy = (s.y / 100) * cssH + s.size / 2;
			if (s.halo) {
				const hr = (s.size * HALO_SCALE) / 2;
				const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, hr);
				// Same (1 − t)² falloff as the shader; RGB constant across stops so
				// the fade never runs through gray.
				for (const t of [0, 0.25, 0.5, 0.75, 1]) {
					grad.addColorStop(t, rgba(tint, (1 - t) * (1 - t) * HALO_INTENSITY * STATIC_ALPHA));
				}
				ctx.fillStyle = grad;
				ctx.fillRect(cx - hr, cy - hr, hr * 2, hr * 2);
			}
			ctx.fillStyle = rgba(tint, STATIC_ALPHA);
			ctx.beginPath();
			ctx.arc(cx, cy, s.size / 2, 0, Math.PI * 2);
			ctx.fill();
		}
	}

	function render(timeMs: number): void {
		if (contextLost) return;
		if (pipeline) renderGL(timeMs);
		else if (ctx2d) render2d(ctx2d);
	}

	const shouldLoop = () =>
		wantRun &&
		!destroyed &&
		!contextLost &&
		pipeline !== null &&
		!document.hidden &&
		!reducedMq.matches;

	function frame(now: number): void {
		raf = 0;
		if (!shouldLoop()) return;
		render(now);
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
		// Visible non-looping states still need SOMETHING in the canvas: reduced
		// motion shows the frozen field, and the 2D fallback is paint-once.
		if (!loop && wantRun && !destroyed && !document.hidden && (reducedMq.matches || !pipeline)) {
			render(performance.now());
		}
	}

	const ro = new ResizeObserver(() => {
		clearTimeout(resizeTimer);
		resizeTimer = setTimeout(() => {
			if (!sizeBacking()) return;
			// Repaint once even while suspended/static so the layer isn't left
			// stretched or blank at the new size.
			if (!raf) render(performance.now());
		}, RESIZE_DEBOUNCE_MS);
	});

	const onContextLost = (e: Event) => {
		e.preventDefault(); // signal intent to restore
		contextLost = true;
		sync();
	};
	const onContextRestored = () => {
		contextLost = false;
		if (gl) {
			try {
				pipeline = buildPipeline(gl);
			} catch (err) {
				pipeline = null;
				console.error('starfield: WebGL pipeline failed after restore, field disabled', err);
			}
		}
		sizeBacking();
		sync();
	};

	sizeBacking();
	ro.observe(canvas);
	canvas.addEventListener('webglcontextlost', onContextLost);
	canvas.addEventListener('webglcontextrestored', onContextRestored);
	document.addEventListener('visibilitychange', sync);
	reducedMq.addEventListener('change', sync);

	return {
		start() {
			wantRun = true;
			sync();
		},
		stop() {
			wantRun = false;
			sync();
		},
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
			canvas.removeEventListener('webglcontextlost', onContextLost);
			canvas.removeEventListener('webglcontextrestored', onContextRestored);
			document.removeEventListener('visibilitychange', sync);
			reducedMq.removeEventListener('change', sync);
			gl?.getExtension('WEBGL_lose_context')?.loseContext();
		}
	};
}
