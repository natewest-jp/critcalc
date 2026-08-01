/**
 * src/lib/timeline/barMix.ts — the bar-phase mix knobs.
 *
 * ONE source for the ratios that derive the planner's non-full-strength bar
 * fills from an element main + the chart ground. Imported by BOTH
 * RotationTimeline.svelte (DOM color-mix strings) and timelineExport.ts (the
 * canvas painter) — ratio drift between screen and PNG is impossible by
 * construction. Lightness-structure round 2026-08-01.
 *
 * The contract these knobs serve (styleguide § Laws · Color): content-bearing
 * fills earn ΔL over the chart ground; recessive fills recede by dropping
 * CHROMA, not just lightness, so in grayscale they read as structure rather
 * than competing with content.
 */

/** % of the element main mixed into the chart ground for the dim
 *  continuation tones (sac-proc duration, past-CD overflow) — content the
 *  eye should still find, just demoted. */
export const UPTIME_DIM_MIX = 65;

/** Ghost CD-track fill: % main into chart ground. Recessive structure. */
export const GHOST_FILL_MIX = 20;

/** Ghost CD-track outline: % main into chart ground. */
export const GHOST_EDGE_MIX = 25;

/** % of the element's saturation the ghost track keeps before mixing (100 =
 *  the pre-round behavior). The "reads as structure" knob: a ghost is a
 *  cooldown clock, not content — dropping its chroma stops hue from
 *  pretending to carry information the lightness doesn't. */
export const GHOST_CHROMA_KEEP = 40;
