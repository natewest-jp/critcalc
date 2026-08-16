// Elemental-application internal cooldown (ICD).
//
// KQM (combat-mechanics/internal-cooldown): standard ICD is a 2.5s timer AND a
// 3-hit counter running concurrently. The rules are asymmetric:
//   - the first hit applies its element (timer starts, count = 1)
//   - a hit applies when the timer has expired — this resets BOTH timer & count
//   - a hit also applies every `hits`-th hit by counter — this resets the count
//     but does NOT reset the timer
// Under fast standard-ICD attacks, applications land on hits 1, 4, 6, …
//
// ONE model, two shapes. The visualizers' ICD instrument feeds it a whole hit
// list at once (`simulateIcd`); the rotation parser feeds it one swing at a
// time as it walks the notation (`createIcdClock` + `icdApplies`). The batch
// form is written in terms of the streaming one so the instrument and the
// planner can never drift — the parser borrowed the instrument's model rather
// than growing a second one (ICD round, 2026-08-15).
//
// Reference: docs/library/game/icd.md.

import type { WeaponType } from '$lib/types/weapon';
import type { NormalActionKind } from '$lib/utils/actionElement';
import { FPS } from '$lib/utils/frames';

export type IcdParams = {
	/** Timer length. ⚠️ UNIT IS THE CALLER'S — see the note on `icdApplies`. */
	timer: number;
	/** Counter length: every `hits`-th hit applies (1 = every hit applies) */
	hits: number;
};

/**
 * Standard ICD in FRAMES — the primary statement of the rule.
 *
 * ⚓ Frames rather than seconds because that is what the game and gcsim actually
 * carry: 150 frames, not 2.5 seconds. The seconds form below is derived from it
 * so the two can never disagree (gauge-round.md C1).
 */
export const STANDARD_ICD_FRAMES: IcdParams = { timer: 150, hits: 3 };

/** Standard ICD in SECONDS — the Visualizers' ICD instrument, whose axis, its
 *  presets and its readouts are all seconds because that is what a reader
 *  thinks in. **Derived**, never restated. */
export const STANDARD_ICD: IcdParams = {
	timer: STANDARD_ICD_FRAMES.timer / FPS,
	hits: STANDARD_ICD_FRAMES.hits
};

/** gcsim's `ICDTagNone` as instrument params: every hit applies. Unit-free — a
 *  zero timer is zero in any unit. The parser spells the same case as a `null`
 *  cadence instead — see `resolveActionIcd`. */
export const NO_ICD: IcdParams = { timer: 0, hits: 1 };

export type IcdHit = {
	time: number;
	applies: boolean;
	/** Applied because the timer expired (also true for the first hit) */
	viaTimer: boolean;
	/** Hit-counter value after this hit (1 … hits) */
	count: number;
};

// Float-noise guard for interval multiples landing exactly on the timer edge
const EPS = 1e-9;

/** The mutable state of one ICD counter — one per (character, ICD tag). */
export type IcdClock = {
	/** Time of the last timer-driven application. */
	timerStart: number;
	/** Hits taken since the counter last reset. */
	count: number;
};

export const createIcdClock = (): IcdClock => ({ timerStart: -Infinity, count: 0 });

/** Advance `clock` by one hit at `time` and report whether it applies its
 *  element. Mutates the clock — a hit that is offered to the clock is a hit
 *  that happened, whether or not it applied.
 *
 *  ⚓ UNIT-AGNOSTIC. The only time arithmetic here is `time - timerStart >= timer`,
 *  so this is correct in whatever unit the caller is consistent in: the parser
 *  feeds it FRAMES with `STANDARD_ICD_FRAMES`, the instrument feeds it SECONDS
 *  with `STANDARD_ICD`. ⛔ Don't "fix" it to one unit — serving both from one
 *  implementation is the point (gauge-round.md C1/C5). */
export function icdApplies(clock: IcdClock, time: number, { timer, hits }: IcdParams): IcdHit {
	if (time - clock.timerStart >= timer - EPS) {
		clock.timerStart = time;
		clock.count = 1;
		return { time, applies: true, viaTimer: true, count: 1 };
	}

	clock.count += 1;
	if (clock.count > hits) {
		clock.count = 1;
		return { time, applies: true, viaTimer: false, count: 1 };
	}

	return { time, applies: false, viaTimer: false, count: clock.count };
}

export function simulateIcd(hitTimes: number[], params: IcdParams): IcdHit[] {
	const clock = createIcdClock();
	return hitTimes.map((time) => icdApplies(clock, time, params));
}

/** Hit timestamps for a uniform attack string: 0, interval, 2·interval, … */
export const uniformHitTimes = (count: number, interval: number) =>
	Array.from({ length: Math.max(0, Math.round(count)) }, (_, i) => i * interval);

/** Which counter a swing draws on. gcsim splits `ICDTagNormalAttack` from
 *  `ICDTagExtraAttack`, so a catalyst's normals and its charged attacks keep
 *  independent 3-hit budgets. Plunges never reach a counter (see below). */
export type IcdTag = 'normal' | 'charged';

export const icdTagFor = (kind: NormalActionKind): IcdTag =>
	kind === 'normal' ? 'normal' : 'charged';

/**
 * The ICD cadence of one N/C/P swing, or `null` for gcsim's `ICDTagNone` —
 * "applies every hit, and draws on no counter at all". ⚠️ `null` is not the
 * same as `NO_ICD`: an untracked source must not RESET the counter its tag
 * shares with a tracked one (Mualani's `noICD` Sharky's Bite normals alongside
 * her ordinary ones is the reachable case).
 *
 * Our schema stores ICD binary — standard, or `noICD` — so this rule resolves
 * the two blanket cases the data deliberately does not annotate (icd.md's
 * curator signal is "leave the field off when standard"; mass-annotating the
 * default is exactly what it forbids):
 *
 * - **Plunges apply every time.** Census of gcsim's per-character `plunge.go`:
 *   165 of 166 attacks are `ICDTagNone` (the exception is Mavuika's
 *   Flamestrider, a bespoke group). That is a game rule, not a per-character
 *   fact, so it lives here rather than on 166 abilities.
 * - **Catalyst charged attacks apply every time.** Same census over
 *   `charge.go`: every catalyst in the roster is `ICDTagNone`. Klee's `N1C`
 *   loop applying pyro on each C is the observable difference.
 *
 * ⚠️ Two divergences from gcsim we knowingly accept, both bounded:
 * - A melee infused charged attack shares the NORMAL counter for 24 characters
 *   in gcsim (`ICDTagNormalAttack` on `charge.go` — Keqing, Kazuha, Xingqiu…);
 *   we give it its own. Worst case is one extra application per 2.5s window.
 * - Bespoke groups (Pole Extra Attack's 0.5s timer, Ayaka's and Yae's charged
 *   groups) collapse to standard. icd.md tracks this as the schema gap.
 *
 * ⚠️ RETURNS FRAMES. This is the PARSER's resolver — the rotation clock is
 * frames (gauge-round.md C1) — so the cadence it hands back must be too. The
 * instrument never calls this; it picks its own params in seconds.
 *
 * @param kind         normal / charged / plunge
 * @param weapon       the character's weapon type
 * @param abilityNoICD the resolved normal ability's `noICD` (Mualani's
 *                     Sharky's Bite is the only holder today)
 */
export function resolveActionIcd(
	kind: NormalActionKind,
	weapon: WeaponType | undefined,
	abilityNoICD: boolean | undefined
): IcdParams | null {
	if (abilityNoICD) return null;
	if (kind === 'plunge') return null;
	if (kind === 'charged' && weapon === 'catalyst') return null;
	return STANDARD_ICD_FRAMES;
}
