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

import type { IcdWindow } from '$lib/types/ability';
import type { WeaponType } from '$lib/types/weapon';
import type { NormalActionKind } from '$lib/utils/actionElement';
import { FPS } from '$lib/utils/frames';

export type IcdParams = {
	/** Timer length. ⚠️ UNIT IS THE CALLER'S — see the note on `icdApplies`. */
	timer: number;
	/** Counter length: every `hits`-th hit applies (1 = every hit applies) */
	hits: number;
	/**
	 * At most this many applications per timer window; absent = no limit.
	 *
	 * ⚓ WHY A THIRD NUMBER (ICD Timeline pass, 2026-10-04). The game does not
	 * store "every 3rd hit": each ICD group is a reset timer plus a FINITE list
	 * of which hits apply (gcsim `icd_groups.dm.go`, generated from game data),
	 * and past the list's end gcsim reads its last entry — a 0 in every group
	 * that has one. All 64 groups are evenly spaced from hit 1 and then stop, so
	 * `(timer, hits, cap)` states every one of them exactly: Default is
	 * (2.5s, 3, 8) — 24 entries, applying on hits 1, 4 … 22 — Chevreuse's
	 * Burst mines (3s, 3, 2), Layla's Shooting Stars (3s, 7, 2).
	 * ⚠️ No authored `IcdWindow` carries one yet, so a cap reaches the planner
	 * only through the standard below.
	 */
	cap?: number;
};

/**
 * Standard ICD in FRAMES — the primary statement of the rule.
 *
 * ⚓ Frames rather than seconds because that is what the game and gcsim actually
 * carry: 150 frames, not 2.5 seconds. The seconds form below is derived from it
 * so the two can never disagree (gauge-round.md C1).
 */
export const STANDARD_ICD_FRAMES: IcdParams = { timer: 150, hits: 3, cap: 8 };

/** Standard ICD in SECONDS — the Visualizers' ICD instrument, whose axis, its
 *  presets and its readouts are all seconds because that is what a reader
 *  thinks in. **Derived**, never restated. */
export const STANDARD_ICD: IcdParams = {
	...STANDARD_ICD_FRAMES,
	timer: STANDARD_ICD_FRAMES.timer / FPS
};

/** gcsim's `ICDTagNone` as instrument params: every hit applies. Unit-free — a
 *  zero timer is zero in any unit. The parser spells the same case as a `null`
 *  cadence instead — see `resolveActionIcd`. */
export const NO_ICD: IcdParams = { timer: 0, hits: 1 };

/**
 * An authored `IcdWindow` as clock params.
 *
 * ⚓ ONE TRANSLATION, and it has two callers on purpose — `resolveActionIcd` for
 * a charged attack's window and the summon-tick series for its own. The pair IS
 * `IcdParams`, so this is a rename rather than a conversion; keeping it in one
 * place is the same law `simulateIcd`-over-`icdApplies` follows.
 *
 * ⚓ `every` absent means only the first hit of the window applies, which the
 * counter expresses as one it can never reach — the branch in `icdApplies` is
 * `count > hits`, so Infinity simply never fires and the timer alone drives
 * applications. ⛔ Don't spell it as a large finite number; that invites a
 * reader to wonder what happens at hit 999.
 */
export const icdParamsFor = (w: IcdWindow): IcdParams => ({
	timer: w.timer,
	hits: w.every ?? Infinity
});

export type IcdHit = {
	time: number;
	applies: boolean;
	/** Applied because the timer expired (also true for the first hit) */
	viaTimer: boolean;
	/** Hit-counter value after this hit (1 … hits) */
	count: number;
	/** Blocked because this window's `cap` applications are spent — the group's
	 *  list has no application left before its timer runs out. */
	capped: boolean;
};

// Float-noise guard for interval multiples landing exactly on the timer edge
const EPS = 1e-9;

/** The mutable state of one ICD counter — one per (character, ICD tag). */
export type IcdClock = {
	/** Time of the last timer-driven application. */
	timerStart: number;
	/** Hits taken since the counter last reset. */
	count: number;
	/** Applications since the timer last started — what `cap` is checked against. */
	applied: number;
};

export const createIcdClock = (): IcdClock => ({ timerStart: -Infinity, count: 0, applied: 0 });

/** Advance `clock` by one hit at `time` and report whether it applies its
 *  element. Mutates the clock — a hit that is offered to the clock is a hit
 *  that happened, whether or not it applied.
 *
 *  ⚓ UNIT-AGNOSTIC. The only time arithmetic here is `time - timerStart >= timer`,
 *  so this is correct in whatever unit the caller is consistent in: the parser
 *  feeds it FRAMES with `STANDARD_ICD_FRAMES`, the instrument feeds it SECONDS
 *  with `STANDARD_ICD`. ⛔ Don't "fix" it to one unit — serving both from one
 *  implementation is the point (gauge-round.md C1/C5). */
export function icdApplies(
	clock: IcdClock,
	time: number,
	{ timer, hits, cap = Infinity }: IcdParams
): IcdHit {
	if (time - clock.timerStart >= timer - EPS) {
		clock.timerStart = time;
		clock.count = 1;
		clock.applied = 1;
		return { time, applies: true, viaTimer: true, count: 1, capped: false };
	}

	clock.count += 1;
	// ⚓ Once the window's applications are spent, every later hit in it is
	// past the list's last 1 — capped, whatever the counter says.
	if (clock.applied >= cap) {
		if (clock.count > hits) clock.count = 1;
		return { time, applies: false, viaTimer: false, count: clock.count, capped: true };
	}
	if (clock.count > hits) {
		clock.count = 1;
		clock.applied += 1;
		return { time, applies: true, viaTimer: false, count: 1, capped: false };
	}

	return { time, applies: false, viaTimer: false, count: clock.count, capped: false };
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
/**
 * The counter an application draws on. ⚓ Four, not two, since gauge-round L4d:
 * gcsim keys ICD by `(tag, group)` and gives a skill and a burst their own tags
 * (`ICDTagElementalArt` / `ICDTagElementalBurst`) alongside `ICDTagNormalAttack`.
 * A plunge shares the normal counter's tag but is `ICDTagNone` in 165 of 166
 * kits, so it never reaches a clock.
 */
export type IcdTag = 'normal' | 'charged' | 'skill' | 'burst';

/** The action classes that draw on a counter. */
export type IcdActionKind = NormalActionKind | 'skill' | 'burst';

export const icdTagFor = (kind: IcdActionKind): IcdTag =>
	kind === 'skill' || kind === 'burst' ? kind : kind === 'normal' ? 'normal' : 'charged';

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
 * ⚓⚓ A SKILL OR BURST REACHES THIS ONLY FOR ITS OWN HITS (L4d), AND THE REASON
 * IS A CENSUS. The standing rule — "⛔ E/Q casts stay ungated: ICD counts HITS and
 * a cast is an ABILITY" — was justified by *we model a multi-hit skill as one
 * application*, a premise `application[]` retired. But gating ACROSS casts is
 * still wrong, and now measurably so:
 *
 *   - **112 of 166 gcsim skills are `ICDTagNone`** (and 70 of 132 bursts) — they
 *     apply on every hit and our schema has no way to say which.
 *   - Of the rest, the GROUP varies wildly. Xiao's Lemniscatic Wind Cycling is
 *     `ICDTagElementalArt` but sits in a group whose reset timer is **5 frames**,
 *     so gcsim applies both of his back-to-back E casts. A standard 2.5s counter
 *     would have deleted the second.
 *
 * ⚓ So the counter is scoped to ONE CAST: a multi-hit ability's hits genuinely
 * share a tag, while across casts our data cannot say whether they do — and the
 * census says usually not. That reproduces gcsim on both measured cases: Barbara's
 * twelve Melody Loop hits collapse to ~6 applications as gcsim gives, and Xiao's
 * two casts both land. ⚠️ Per-ability ICD tag + group is the schema gap; until it
 * exists this is the honest scope.
 *
 * ⚠️ This is where `noICD` on a SKILL or BURST finally has a reader — it was
 * declared and inert, with the schema comment saying so.
 *
 * ↻ **AND ONE OF THOSE BESPOKE GROUPS IS NOW AUTHORED RATHER THAN COLLAPSED**
 * (2026-08-17). `NormalAbility.chargedIcdWindow` carries a MEASURED window for a
 * charged attack, and it wins over the standard default. ⚠️⚠️ It arrives as DATA
 * and ⛔ must never become a `weapon === 'polearm'` branch alongside the two
 * rules above: those are near-universal censuses (plunges 165/166, catalyst
 * charged attacks all of them) while this one is **16 of 19 with named
 * counter-examples** — Xiao, Raiden and Emilie sit on the default, and Ayato,
 * who wields a sword, does not. A blanket rule here would be wrong four ways.
 *
 * ⚠️ Order is load-bearing: `noICD` and the plunge/catalyst rules still come
 * FIRST, because "applies always and touches no clock" is a stronger statement
 * than any window and an authored window must not resurrect a counter those
 * cases deliberately never touch.
 *
 * @param kind         normal / charged / plunge / skill / burst
 * @param weapon       the character's weapon type
 * @param abilityNoICD the resolved ability's `noICD`
 * @param authored     a measured non-standard window for this action, if any
 */
export function resolveActionIcd(
	kind: IcdActionKind,
	weapon: WeaponType | undefined,
	abilityNoICD: boolean | undefined,
	authored?: IcdWindow
): IcdParams | null {
	if (abilityNoICD) return null;
	if (kind === 'plunge') return null;
	if (kind === 'charged' && weapon === 'catalyst') return null;
	// ⚠️ Gated on the kind HERE rather than trusting the caller: the field names
	// the charged attack, three call sites share this signature, and a normal
	// swing handed a charged window would be gated by a number nobody measured
	// for it.
	if (kind === 'charged' && authored) return icdParamsFor(authored);
	// ⚓ The cast-side twin (cast-icd-gate round, 2026-09-17): `CastAbility.icdGate`
	// reaches here from `resolveCastApplications`, one translation for all three
	// authored shapes. A normal swing still cannot carry a window — no field
	// names one, and the gcsim censuses that set the two blanket rules above
	// are about swings.
	if ((kind === 'skill' || kind === 'burst') && authored) return icdParamsFor(authored);
	return STANDARD_ICD_FRAMES;
}
