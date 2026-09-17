/**
 * src/lib/data/genericProfile.ts
 *
 * The data-derived "generic character" timing profile — the fallback timings a
 * frameless / uncurated character (and the Blank placeholder slot) rides in the
 * Rotation Planner when it has no FrameMap of its own. It replaces the old
 * hand-picked cast constants (E 0.5s / Q 1.0s) and gives frameless normals real
 * per-swing timing instead of collapsing them to zero duration.
 *
 * Derived by `scripts/survey-generic-profile.mjs` from the curated corpus:
 * normal + charged medians over the SWORD / POLEARM / CATALYST users (the
 * on-field-DPS auto-attack archetype, charges MAD-trimmed); skill/burst cast
 * median and cooldown/energy mode over the same scope. Report of record:
 * `docs/curation/generic-profile-survey.md`. **Regenerate rather than
 * hand-edit** — rerun the survey and paste, so these stay traceable to data.
 *
 * All frame values are @60fps. Skills/bursts carry no `duration` on purpose:
 * ~85% of real skills/bursts are instant, so the generic kit is too.
 *
 * ⚠️ REGENERATED at gauge-round L4b (2026-08-16) against the reshaped corpus. The
 * numbers moved because the medians are now over `anim` — the full animation — where
 * they used to be over `swap`, which is only the cancel window. A frameless skill went
 * 37f → 44f and a frameless burst 93f → 95f for that reason and no other; the
 * cooldown/energy modes are unchanged.
 */

import type { FrameMap, NormalHit } from '$lib/types/ability';

/** Modal 5-hit combo; per-position, per-key medians (`anim` = the full animation and
 *  the fallback, `hit` = the hitmark the cancel keys resolve to, N = cancel-into-
 *  next-normal, C = cancel-into-charge). */
export const GENERIC_NORMAL_HITS: NormalHit[] = [
	{ frames: { anim: 28, hit: 13, N: 19, C: 22 } },
	{ frames: { anim: 28, hit: 13, N: 22, C: 25 } },
	{ frames: { anim: 43, hit: 21, N: 37, C: 39 } },
	{ frames: { anim: 51, hit: 27, N: 39 } },
	{ frames: { anim: 66, hit: 26 } }
];

/** Median full-charge FrameMap after MAD-trimming channeled/AoE outliers. */
export const GENERIC_CHARGE_FRAMES: FrameMap = {
	anim: 57,
	N: 51,
	E: 46,
	Q: 49,
	D: 25,
	J: 24,
	swap: 45
};

/** Skill: cast animation (frames) + cooldown (seconds). */
export const GENERIC_SKILL = { castAnim: 44, cooldown: 12 } as const;

/** Burst: cast animation (frames) + cooldown (seconds) + energy cost. */
export const GENERIC_BURST = { castAnim: 95, cooldown: 15, energy: 60 } as const;

/** Plunge (the HIGH plunge, `P`/`hP`): per-key medians over the 52 authored
 *  `plungeFrames` maps (2026-09-17). ⚓ A STAND-IN for the 74 characters with no
 *  measured plunge: a `P` on one of them used to emit NOTHING — zero time, no
 *  block, no application, and every later action shifted earlier — which was
 *  indistinguishable from a typo (essential-characters §1.D). ⚓ Nate: it is
 *  PROVISIONAL, not refused — the parser takes it and the editor squiggles it,
 *  the same register a frameless E or Q gets. ⛔ Never author these into a
 *  character; the notation lint keys on `plungeFrames` being ABSENT. */
export const GENERIC_PLUNGE_FRAMES: FrameMap = {
	anim: 77,
	N: 58,
	C: 52,
	E: 58,
	Q: 58,
	D: 46,
	J: 76,
	swap: 63
};
