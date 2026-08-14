import { browser } from '$app/environment';
import { get, writable } from 'svelte/store';
import { getSceneGL, crestPose, PAN_MS } from '$lib/landing/sceneGL';

/**
 * The ascend choreography (revival 2026-08-02, choreography chunk 2026-08-05).
 *
 * The landing scene is the WORLD the whole site lives in. Picking a tool is
 * the moment you ascend: the GL camera tilts up ~76dvh into the sky (craning
 * toward a side tool's hero), the landing composition fades out early, and
 * the tool fades in near camera settle over the crest sky. Returning descends
 * the same path in reverse. All world motion is the camera uniform inside the
 * scene canvas (sceneGL.ts) — the one mechanism smooth in all three engines
 * (the DOM pan is unfixable on Firefox/WebRender; the portal workaround it
 * forced is retired and archived, see docs/archive/portal-handoff.md).
 *
 * What still moves in the DOM: the landing composition (hero cards — a small
 * surface that fades out within the pan's gentle first leg, riding a WAAPI
 * transform world-locked to the camera so its exit reads as planted in the
 * scene) and the dim overlay (dormant at 0 everywhere pending the color
 * session's tool-over-scene design). Chrome/footer/pages fade on the shared
 * clock via revealDelayMs().
 */

/** Duration of the ascend/descend transition window, ms (landing ↔ tool).
 *  Re-exported from the scene renderer so the camera's clock and every fade
 *  share one number. */
export const TRANSITION_MS = PAN_MS;

/**
 * Duration of a TOOL ↔ TOOL transition, ms (⚓ NATE 2026-08-05: slightly
 * brisker than the full ascend). This clock drives BOTH the camera's
 * crest-to-crest crane and the tools layout's world-locked drift/underline —
 * they are one motion at two depths, so the number lives here, once.
 */
export const TOOL_NAV_MS = 2000;

/** Fade speed multiplier vs. the transition itself. >1 means fades are
 *  faster than the pan. With strong ease-in-out the velocity peaks sharply
 *  in the middle; pushing fades to ~4× means UI chrome clears during the
 *  slow ease-in and only the scene is on screen through the fast frames.
 *  ⚓ NATE 2026-08-05: fades stay RATIO-derived from their clocks (this /4
 *  for the ascend, TOOL_NAV_MS/3 for tool legs in the tools layout) so
 *  retuning a transition duration keeps its fades locked in step. */
export const FADE_SPEED_MULTIPLIER = 4;

/** Fade-IN duration for landing + tool elements (the "pleasing" landing fade). */
export const FADE_DURATION_MS = Math.round(TRANSITION_MS / FADE_SPEED_MULTIPLIER);

/** Fade-OUT duration — the outgoing surface's exit, quick enough to clear the
 *  screen during the pan's slow ease-in. */
export const FADE_OUT_MS = FADE_DURATION_MS;

/**
 * Fade/camera overlap. The incoming fade-in is shifted to END this many ms
 * AFTER the camera settles (and so begins that much later too) — it "bleeds"
 * past the end of the camera move instead of finishing exactly at settle.
 *
 * Side effect worth knowing: a larger value pushes the tool's reveal (its
 * visibility flip + one-time raster) LATER — toward, or past, settle — where
 * the camera is slower or stopped, so it costs fewer dropped frames. So this
 * also doubles as the dial for trading "fade overlaps the camera" against
 * "reveal lands on a calm scene".
 */
export const FADE_OVERLAP_MS = 300;

/**
 * Transition window for navigations with NO camera motion (landing ↔ content
 * pages — both rest poses). The incoming surface still sequences after the
 * outgoing one via revealDelayMs(), so this is just a brisker clock for a
 * plain content crossfade with nothing cinematic to pace against.
 */
export const XFADE_TRANSITION_MS = 700;

/** All element fades (landing + tool + pages, in + out) are LINEAR — opacity
 *  ramps uniformly, so the visible fade time equals its duration. An ease-out
 *  fade-in looked ~40% shorter than its duration (the slow 0.94→1.0 tail is
 *  imperceptible), which mismatched the linear fade-out at equal durations;
 *  keeping everything linear makes in/out and landing/tool all read
 *  identically. The tool reveal is a CSS transition, the others are Svelte
 *  fades — both must match if a curve is ever introduced. */

/**
 * Easing for the tilt-up. The WAAPI composition ride uses the CSS string; the
 * GL camera uses the same bezier natively (TILT_BEZ in sceneGL.ts) — one
 * curve, two engines, so the world-locked composition never drifts off the
 * camera during the shared window.
 */
export const TILT_EASING_CSS = 'cubic-bezier(0.58, 0, 0.42, 1)';

/**
 * Side-tool crane direction per path: +1 shifts the world right (the LEFT
 * hero — Team Builder leads the card order), −1 left (the right hero,
 * Visualizers), 0 = no lean (center tool, landing, anything else). The
 * magnitude/clamp math lives in sceneGL's crestPose.
 */
function sideSign(path: string): -1 | 0 | 1 {
	if (path === '/team-builder') return 1;
	if (path === '/visualizers') return -1;
	return 0;
}

export const isLandingPath = (path: string) => path === '/';

/**
 * ⚠ /lab IS IN THIS LIST ON PURPOSE (2026-08-10). It is the dev-only specimen
 * board, and the ONE thing it exists to provide is the real crest under the
 * real wash — a specimen judged against a simulated backdrop is the reason the
 * styleguide could not do this job. sideSign returns 0 for it, so it gets the
 * centre crest rather than either tool's side; nothing sets sceneOccluded for
 * it (that is the tools layout's doing and /lab is not in that group), so the
 * world keeps rendering behind it, which is the entire point.
 */
const TOOL_PATHS = ['/visualizers', '/rotation-planner', '/team-builder', '/lab'];
/**
 * True for the three tool routes — the ONLY routes whose opaque shell covers
 * the viewport and occludes the scene. The landing and the static content pages
 * (/about, /faq, /privacy, /settings) all render OVER a visible scene, so they
 * are deliberately excluded: the scene must stay painted behind them.
 */
export const isToolPath = (path: string) =>
	TOOL_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

/** Camera pose for a path: tools sit at the crest (with their crane), the
 *  landing and content pages at rest. Point-in-time px — never cache. */
function poseForPath(path: string): { x: number; y: number } {
	if (!isToolPath(path)) return { x: 0, y: 0 };
	return crestPose(sideSign(path), window.innerWidth, window.innerHeight);
}

/**
 * Screen-space drift a WORLD-LOCKED tool surface undergoes when the camera
 * moves between two paths' poses (the tools layout's fade transition): a
 * surface anchored at `fromPath`'s pose ends displaced by exactly this many
 * px, and one anchored at `toPath` starts displaced by its negation. Sign
 * follows the composition's world-lock convention (screen offset = camera.x −
 * anchor pose.x). 0 when either pose is unknown, off-browser, or the crane is
 * clamped away (ultrawide) — the transition degrades to a plain crossfade.
 */
export function toolPoseShift(fromPath: string, toPath: string): number {
	if (!browser) return 0;
	return poseForPath(toPath).x - poseForPath(fromPath).x;
}

/**
 * The in-flight scene transition's WAAPI-comparable start timestamp
 * (performance.now() clock), or null when nothing is in flight. The tools
 * layout pins its world-locked drift animations to this so tool surfaces
 * stay glued to the terrain no matter when each animation is created.
 */
export function sceneTransitionStart(): number | null {
	return browser && active ? active.startTime : null;
}

export function prefersReducedMotion(): boolean {
	if (typeof window === 'undefined') return false;
	return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Scene occlusion handshake (perf audit 2026-07-10, F4). While the opaque tool
// shell covers the viewport, the scene layout unpaints its layers
// (visibility:hidden on .scene/.dim) so their compositor textures are released
// instead of sitting resident behind every tool route — on low-RAM/integrated-
// GPU machines that residency is what drives texture-eviction churn. The
// twinkle loop keys off this too (zero rAF work behind tools).
//
//   true  ← the tools layout, two rAFs after its reveal fade completes (the
//           shell is then PAINTED opaque over the scene).
//   false ← the scene layout's beforeNavigate on any navigation to a
//           non-tool route — before the shell's fade-out starts, so the
//           one-time re-raster happens while the scene is still covered.
//
// The scene layout seeds the value from its cold-load path at init (server and
// client), so a direct hit on a tool URL prerenders the scene hidden and never
// rasters it at all.
export const sceneOccluded = writable(false);

export type SceneLayerKind = 'composition' | 'dim';

/** Dim overlay opacity — the tool-over-scene treatment (⚓ NATE 2026-08-05):
 *  the scene dims under the tools through a semi-transparent wash (the .dim
 *  layer's background is var(--scene-dim)); the world stays visible in the
 *  panel gaps, just receded. 0 on the landing and static pages — the open
 *  world stays undimmed. The WAAPI ride animates this during ascend/descend.
 *
 *  ↻ 2026-08-08 (⚓ NATE): 0.75 → 0.85, and the reason is a CHANGE OF JOB
 *  rather than a tuning. This wash used to recede a backdrop the panels hid.
 *  It is becoming the PAGE GROUND — the surface content sits directly on, with
 *  no box between (Genshin's own idiom: a section banner, then bare text on
 *  the world). 0.85 is where the crest reads as a ground rather than as
 *  scenery: quiet enough to carry text, still plainly the world.
 *
 *  ⚠ It arrived during the sheer-ground experiment, which is retired — sheer
 *  panels were a middle that turned out not to be a place (2–3% of scene light
 *  through a surface reads as a duller colour, not as translucency). The DIM
 *  survives that retirement on its own merit, which is why it is declared here
 *  with its own rationale instead of riding along with a token that is gone.
 *
 *  ⛔ THE SHAPED SCRIM IS SCRAPPED (⚓ NATE 2026-08-09, after driving it): "it
 *  doesn't really buy us anything meaningful compared to a plain dim." Built as
 *  a mask on the .dim layer (an ellipse first, then a soft rounded box made by
 *  intersecting two 1-D falloffs), measured, shipped, and taken back out the
 *  same day. The wash is ONE UNIFORM NUMBER again — don't rebuild it.
 *
 *  ⚠ And the problem it was built to solve turned out not to need solving. The
 *  premise was that glass and bare text want opposite things from one wash, so
 *  the wash had to vary by PLACE. What actually happened is that the two are
 *  governed independently: text on a GLASS band is limited by the glass stop
 *  (whose alphas are chosen to clear 4.5:1 against a star on their own — see
 *  --glass-panel), and text on the OPEN scene is limited by this number. Two
 *  constraints, two knobs, no geometry required. The shaped scrim was solving a
 *  coupling that a correctly-chosen glass alpha dissolves.
 *
 *  ↻ ⚓ NATE 2026-08-09: .85 → .65, with a floor of .60 claimed here on the
 *  strength of a star measurement.
 *
 *  ↻ ⚓ NATE 2026-08-10: .65 → .75, AND THE MEASUREMENT THAT SET THE OLD FLOOR
 *  WAS WRONG. Both are worth recording, because the second is why the first is
 *  not merely a taste change.
 *
 *    THE BUG IN THE OLD NUMBERS: every star figure in this system modelled the
 *    worst pixel as `white × (1 − TOOL_DIM)` — which is what you get if the
 *    wash is pure BLACK. It is not: --scene-dim is a near-black COLOUR laid
 *    over the scene, so the real composite is `dim·wash + (1−dim)·white`, and
 *    at .65 that is rgb(103,104,106), not rgb(89,89,89). Every published
 *    contrast figure was therefore ~0.3–0.4 optimistic, in the one direction
 *    that matters.
 *
 *    WHAT IT ACTUALLY MEANT: at .65, --text over a star measured 4.48:1, not
 *    the 5.33:1 recorded here — i.e. the OPEN SCENE WAS ALREADY UNDER THE
 *    FLOOR, and the claimed floor of .60 (3.77:1 in truth) was never legal at
 *    all. The glass panel stop was in the same position after the ramp moved a
 *    rung lighter that morning: 4.22:1, published as 4.53.
 *
 *    WHAT .75 BUYS, measured with the wash composited properly:
 *      --text on the open scene   4.48 → 6.87:1
 *      glass panel (slate-700)    4.22 → 4.85:1
 *      glass well  (slate-900)    4.52 → 5.48:1
 *    So this is a correction as much as a preference, and it restores real
 *    headroom rather than just clearing the bar.
 *    ⏱ Those three are a SNAPSHOT of what .75 bought on 2026-08-10, kept as
 *    the record of this decision — they are not live figures. Both glass
 *    alphas moved later that day (.68/.55 → .58/.45) and slate-900 itself
 *    moved on 2026-08-11 (merged with slate-950). /styleguide § Palette census
 *    computes all of it from the tokens and is the number to trust.
 *
 *  ⚠ --muted IS STILL NOT LEGAL ON THE OPEN SCENE: 2.71 → 4.16:1, better but
 *  under 4.5. Text directly on the world gets --text and nothing quieter. If
 *  the scene ever needs a second ink rung, it has to be a BRIGHTER one, not a
 *  dimmer one — that is a real structural constraint on treating the world as a
 *  context, not an oversight.
 *
 *  ⚠ THE COST IS ON THE OTHER AXIS: world surviving through glass is
 *  (1 − glass)(1 − TOOL_DIM), so the panel stop drops 11.2% → 8.0%. The "opaque
 *  or obviously translucent" rule puts sheer at 5–7%; 8% clears it but is the
 *  closest we have been. If glass stops reading as glass, this is the number
 *  that did it, and the fix is a lower glass alpha rather than a lower dim.
 *
 *  ⚓ NATE — the two knobs, and they are independent:
 *    TOOL_DIM               how much world survives.
 *    --scene-dim in app.css the wash COLOUR — how black the floor of the
 *                           composite is. A different axis entirely. Both moved
 *                           together on 2026-08-10 (#15161a → #101013). */
export const TOOL_DIM = 0.875;
export const dimTarget = (path: string) => (isToolPath(path) ? TOOL_DIM : 0);

// --- Transition clock --------------------------------------------------------

interface ActiveTransition {
	fromPath: string;
	toPath: string;
	startTime: number;
	duration: number;
}

let currentPath = '/';
let active: ActiveTransition | null = null;

/**
 * Initialize the current path tracker. Call once at scene-layout mount so
 * cold loads on a tool URL register the correct baseline.
 */
export function initScenePath(path: string): void {
	currentPath = path;
}

/**
 * Whether a scene transition is in flight right now. The tools layout uses
 * this at mount to decide between "arrived via the ascend → suppress and fade
 * in near settle" and "cold load / reduced motion → show immediately".
 * Always false on the server, so SSR renders the tool in its revealed state.
 */
export function hasActiveSceneTransition(): boolean {
	return browser && active !== null;
}

/**
 * Milliseconds until the in-flight transition settles (0 if none / settled).
 */
export function timeUntilSettle(): number {
	if (!browser || !active) return 0;
	return Math.max(0, active.duration - (performance.now() - active.startTime));
}

/**
 * Delay for an INCOMING surface's fade-in, so it starts after the outgoing
 * one has cleared and ends FADE_OVERLAP_MS past camera settle. The shared
 * timing for the landing composition, the pages panel, chrome/footer, and the
 * tool-shell reveal — evaluate at fade creation (mount), never earlier.
 */
export function revealDelayMs(): number {
	return Math.max(0, timeUntilSettle() - FADE_DURATION_MS + FADE_OVERLAP_MS);
}

/**
 * Snap the scene camera to the current path's pose — the scene layout calls
 * this right after the GL renderer mounts. Cold loads land on their rest/crest
 * pose without animation; the one soft edge is a return-to-landing that races
 * a deferred GL mount (tool cold load → back), which mounts already at rest
 * and simply skips the descend under the shell's fade-out.
 */
export function syncSceneCamera(): void {
	if (!browser) return;
	getSceneGL()?.snapCamera(poseForPath(currentPath));
}

/**
 * Kick off a scene transition toward `toPath`. Drives the GL camera to the
 * destination pose (ascend/descend/crane), starts the WAAPI ride on the
 * registered DOM layers, and stamps the shared clock every fade keys off.
 * Interruptible: a new call re-targets the camera from wherever it is.
 */
export function startSceneTransition(toPath: string): void {
	if (!browser) return;
	if (toPath === currentPath) return;

	const fromPath = currentPath;
	currentPath = toPath;

	const scene = getSceneGL();
	const pose = poseForPath(toPath);

	// Occluded scene (tool→tool slide): the world is invisible behind the
	// opaque shell — teleport the camera to the destination's crane so a later
	// descent starts from the right pose, and skip the choreography clock (the
	// tools layout's slide owns that motion).
	if (get(sceneOccluded)) {
		scene?.snapCamera(pose);
		active = null;
		return;
	}

	if (prefersReducedMotion() || !scene) {
		// Reduced motion (or GL never mounted): snap the world, no shared clock —
		// every fade then runs undelayed at its own duration.
		scene?.snapCamera(pose);
		for (const [el, kind] of layers) {
			cancelSceneAnimations(el);
			applyRestState(el, kind, toPath);
		}
		active = null;
		return;
	}

	const fromPose = poseForPath(fromPath);
	const cameraMoves = fromPose.x !== pose.x || fromPose.y !== pose.y || scene.animating();
	// Tool↔tool legs ride the brisker TOOL_NAV_MS; the full ascend/descend
	// (a landing endpoint) keeps TRANSITION_MS; no camera motion at all keeps
	// the plain content-crossfade clock.
	const toolLeg = isToolPath(fromPath) && isToolPath(toPath);
	const duration = cameraMoves ? (toolLeg ? TOOL_NAV_MS : TRANSITION_MS) : XFADE_TRANSITION_MS;
	const startTime = performance.now();
	active = { fromPath, toPath, startTime, duration };

	if (cameraMoves) void scene.animateCamera(pose, duration);

	for (const [el, kind] of layers) {
		cancelSceneAnimations(el);
		startFromCurrent(el, kind, toPath, duration, startTime);
	}

	// Clear `active` once this transition is finished so a layer that mounts
	// later doesn't try to catch up to a completed animation.
	setTimeout(() => {
		if (active && active.startTime === startTime) active = null;
	}, duration + 50);
}

// --- WAAPI layer ride --------------------------------------------------------
//
// The DOM surfaces that ride the ascend (the landing composition; the dormant
// dim overlay) animate via the Web Animations API on their own transform/
// opacity — composited properties, so the ride runs on the compositor thread
// where main-thread work (navigation, hydration) can't stutter it. The
// composition is a SMALL surface and fades out inside the pan's gentle first
// leg, so this is nothing like the retired full-viewport DOM plate pan that
// failed on Firefox.
//
// Layers register via the `sceneLayer` action on mount. A transition cancels
// any in-flight animation (baking current value via commitStyles) and starts
// fresh from current → target. A layer that mounts mid-transition (the
// composition remounting as the landing route returns) joins with a startTime
// synced to the original start, so WAAPI catches it up to lockstep.

const ANIM_ID = 'scene-transition';

const layers = new Map<HTMLElement, SceneLayerKind>();

/**
 * Rest transform for a layer at a path. The composition is world-locked: at a
 * tool path it sits one camera-pan below/beside its landing anchor, so
 * animating between the two states gives it the exact motion delta of the
 * world — it exits (and re-enters) as if planted in the scene. Px are
 * evaluated at call time; each transition re-derives them.
 */
export function restTransform(kind: SceneLayerKind, path: string): string | null {
	switch (kind) {
		case 'composition': {
			const pose = poseForPath(path);
			if (pose.x === 0 && pose.y === 0) return 'translate(-50%, 0px)';
			return `translate(calc(-50% + ${pose.x.toFixed(2)}px), ${pose.y.toFixed(2)}px)`;
		}
		case 'dim':
			return null;
	}
}

function restOpacity(kind: SceneLayerKind, path: string): number | null {
	return kind === 'dim' ? dimTarget(path) : null;
}

function applyRestState(el: HTMLElement, kind: SceneLayerKind, path: string): void {
	const t = restTransform(kind, path);
	const o = restOpacity(kind, path);
	if (t !== null) el.style.transform = t;
	if (o !== null) el.style.opacity = String(o);
}

function buildTargetKeyframe(kind: SceneLayerKind, toPath: string): Keyframe {
	if (kind === 'dim') return { opacity: restOpacity(kind, toPath)! };
	return { transform: restTransform(kind, toPath)! };
}

function buildFromToKeyframes(kind: SceneLayerKind, fromPath: string, toPath: string): Keyframe[] {
	if (kind === 'dim') {
		return [{ opacity: restOpacity(kind, fromPath)! }, { opacity: restOpacity(kind, toPath)! }];
	}
	return [
		{ transform: restTransform(kind, fromPath)! },
		{ transform: restTransform(kind, toPath)! }
	];
}

function cancelSceneAnimations(el: HTMLElement): void {
	for (const a of el.getAnimations()) {
		if (a.id !== ANIM_ID) continue;
		try {
			a.commitStyles();
		} catch {
			// Element detached or value non-interpolable — safe to skip.
		}
		a.cancel();
	}
}

function startFromCurrent(
	el: HTMLElement,
	kind: SceneLayerKind,
	toPath: string,
	duration: number,
	startTime: number | null
): void {
	// Single-keyframe form: WAAPI uses the current computed style as the from
	// keyframe. Combined with commitStyles before cancel, this gives clean
	// "interrupt from wherever you are" behavior.
	const anim = el.animate([buildTargetKeyframe(kind, toPath)], {
		duration,
		easing: TILT_EASING_CSS,
		fill: 'forwards',
		id: ANIM_ID
	});
	// Pin every layer in this transition to the same startTime so they share
	// one clock with the GL camera — animate() otherwise lands its own start
	// ~10–30ms late, visible as end-of-pan drift against the world.
	if (startTime !== null) anim.startTime = startTime;
}

function joinInFlight(el: HTMLElement, kind: SceneLayerKind, t: ActiveTransition): void {
	const anim = el.animate(buildFromToKeyframes(kind, t.fromPath, t.toPath), {
		duration: t.duration,
		easing: TILT_EASING_CSS,
		fill: 'forwards',
		id: ANIM_ID
	});
	// Pin startTime to the in-flight start so the WAAPI engine interpolates
	// this layer to "where it would be now" on the very first frame after
	// mount — no visible snap from the from-keyframe.
	anim.startTime = t.startTime;
}

/**
 * Svelte action: register a DOM element as a scene layer of the given kind.
 * Sets its initial transform/opacity for the current path. If a transition
 * is in flight when the element mounts, joins it via a synced startTime so
 * the WAAPI engine snaps it to the current interpolated position on the
 * next frame — no visible jump from the from-keyframe.
 */
export function sceneLayer(el: HTMLElement, kind: SceneLayerKind) {
	if (!browser) return;

	layers.set(el, kind);

	if (active) {
		applyRestState(el, kind, active.fromPath);
		joinInFlight(el, kind, active);
	} else {
		applyRestState(el, kind, currentPath);
	}

	return {
		destroy() {
			cancelSceneAnimations(el);
			layers.delete(el);
		}
	};
}
