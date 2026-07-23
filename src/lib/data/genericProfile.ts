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
 */

import type { FrameMap, NormalHit } from '$lib/types/ability';

/** Modal 5-hit combo; per-position, per-key medians (swap = full-recovery
 *  fallback, N = cancel-into-next-normal, C = cancel-into-charge). */
export const GENERIC_NORMAL_HITS: NormalHit[] = [
	{ frames: { swap: 13, N: 19, C: 23 } },
	{ frames: { swap: 13, N: 22, C: 26 } },
	{ frames: { swap: 22, N: 36, C: 36 } },
	{ frames: { swap: 27, N: 40, C: 42 } },
	{ frames: { swap: 26, N: 66 } }
];

/** Median full-charge FrameMap after MAD-trimming channeled/AoE outliers. */
export const GENERIC_CHARGE_FRAMES: FrameMap = { swap: 46, N: 55, E: 48, Q: 49, D: 26, J: 26 };

/** Skill: cast animation (frames) + cooldown (seconds). */
export const GENERIC_SKILL = { castSwap: 37, cooldown: 12 } as const;

/** Burst: cast animation (frames) + cooldown (seconds) + energy cost. */
export const GENERIC_BURST = { castSwap: 93, cooldown: 15, energy: 60 } as const;
