/**
 * src/lib/sim/gadgets.ts
 *
 * ⚓⚓ THE OTHER THINGS A REACTION LEAVES IN THE WORLD — the Thundercloud a
 * Lunar-Charged sustains, and the Moondrifts a Lunar-Crystallize drops
 * (2026-09-01, the Polestar-Field round's follow-on).
 *
 * ⚓ NEITHER NEEDED A SINGLE LINE OF GAUGE WORK, which is the whole reason they
 * were affordable: `lunarCharged` and `lunarCrystallize` have been IR reaction
 * events since the 7.0 reaction-conversion round, so both entities are a walk
 * over a stream that already exists — exactly as the Prism is. ⛔ Don't reach
 * for new gauge state for a gadget whose spawn condition is a reaction.
 *
 * ⚠️ WHY THIS IS NOT IN `fields.ts`. That file owns the Polestar FIELD: a Prism
 * plus the buff ledger it pays out, which is most of its weight. These two grant
 * nothing — they are pure entities, and several kits read them as a CONDITION
 * ("if there are thunderclouds nearby…", Ineffa A1, Flins's burst) that we still
 * do not model. Keeping them apart keeps each file's subject sayable in a line.
 *
 * ⚠️ POSITION IS DROPPED, as everywhere else. gcsim gates both on distance from
 * the player (`playerPos.Distance(…) < 20`); the house rule since 2026-08-31 is
 * that a field is assumed entered, and these are the same claim in a smaller
 * package.
 *
 * ⛔ WHAT WE DELIBERATELY DO NOT MODEL: the Thundercloud's own lightning ticks
 * and the Moondrifts' Harmony ATTACK. Both deal damage, both would have to reach
 * the gauge, and neither is authored anywhere in the corpus — a tick we invent
 * is `⛔ never fake timing` twice over. The ENTITY's life is what the strip
 * draws, and it is stated exactly.
 *
 * Source: gcsim `pkg/reactable/lunarcharged.go` and `lunarcrystallize.go`
 * (+ `lunarcrystallize_construct.go`), read 2026-09-01.
 */

import { framesOf } from '$lib/utils/frames';
import type { Reaction } from '$lib/types/ability';
import type { ReactionEvent, TimelineWindow } from '$lib/utils/rotationEvents';

type GadgetWindow = Extract<TimelineWindow, { kind: 'gadget' }>;

/** One continuous presence of a single-instance entity, plus every trigger that
 *  refreshed it — the Polestar Field's ledger needs the triggers, so the shape
 *  is shared rather than the Prism keeping a private copy. */
export type Presence = {
	start: number;
	end: number;
	characterId: string;
	triggers: ReactionEvent[];
};

/**
 * ⚓ REFRESH REPLACES, IT DOES NOT EXTEND — for every entity in this family. A
 * repeat trigger resets the lifetime to its full length, so overlapping
 * lifetimes collapse into ONE presence ending at the last trigger's + lifetime.
 *
 * ⛔ `durationExtensions` cannot express this: they ADD a delta, they reach only
 * the reacting character's own `summons[0]`, and they cap at `maxExtensions`.
 */
export function mergePresences(events: readonly ReactionEvent[], lifetimeF: number): Presence[] {
	const out: Presence[] = [];
	for (const ev of [...events].sort((a, b) => a.time - b.time)) {
		const open = out[out.length - 1];
		if (open && ev.time <= open.end) {
			open.end = ev.time + lifetimeF;
			open.triggers.push(ev);
			continue;
		}
		out.push({
			start: ev.time,
			end: ev.time + lifetimeF,
			characterId: ev.characterId,
			triggers: [ev]
		});
	}
	return out;
}

const reactionsOf = (events: readonly ReactionEvent[], reaction: Reaction) =>
	events.filter((e) => e.reaction === reaction);

// ── The Thundercloud ────────────────────────────────────────────────────────

/**
 * ⚠️ 5.5 SECONDS, and there is only ever ONE. gcsim: `r.core.Status.Add(LcKey,
 * 5.5*60)`, with its own comment — "the LC cloud lasts 5.5s, or lifetime is
 * extended to last another 5.5s". `Status.Add` SETS a duration, so a second
 * Lunar-Charged restarts the clock rather than stacking a second cloud.
 */
const THUNDERCLOUD_LIFETIME_F = framesOf(5.5);

// ── Moondrifts ──────────────────────────────────────────────────────────────

/** gcsim `lcrDur` — 9s per construct. */
const MOONDRIFT_LIFETIME_F = framesOf(9);
/** gcsim tops the field up to three on every Lunar-Crystallize. */
const MOONDRIFT_MAX = 3;
/** `lcrCountKey`, capped at 6 — the counter Moondrift Harmony spends. */
const MOONDRIFT_COUNT_CAP = 6;
/** Harmony's own ICD: `lcrHitmarks[last]`, i.e. 13 + 12 + 12 frames. */
const HARMONY_ICD_F = 37;

/**
 * ⚓⚓ A LUNAR-CRYSTALLIZE TOPS THE FIELD UP; IT DOES NOT ADD ONE. gcsim spawns
 * `3 − nearby` constructs, so the first reaction drops three at once and a
 * reaction while three still stand spawns NOTHING.
 *
 * ⚓ AND ON A FULL FIELD IT REFRESHES INSTEAD, via Moondrift Harmony: with three
 * standing, a counter at 3+ and its ICD clear, every live drift is reset to a
 * full 9s (`extendNearbyLunarCrystallizeConstructDur` sets `expiry = now +
 * lcrDur`). ⚠️ Without that branch a stocked field would quietly expire under a
 * player who is still reacting, which is the opposite of what happens.
 *
 * ⚠️ A REFRESHED DRIFT IS ONE WINDOW WITH A LATER END, not a second window —
 * gcsim moves the construct's `expiry` rather than replacing the construct.
 */
function deriveMoondrifts(events: readonly ReactionEvent[]): GadgetWindow[] {
	return moondriftLives(
		reactionsOf(events, 'lunarCrystallize')
			.map((e) => e.time)
			.sort((a, b) => a - b)
	).map(
		(l): GadgetWindow => ({
			kind: 'gadget',
			gadget: 'moondrift',
			label: 'Moondrift',
			start: l.start,
			end: l.end
		})
	);
}

/** The construct lives a field of Moondrifts went through, over Lunar-Crystallize
 *  instants in ASCENDING order — the rule `deriveMoondrifts` draws and
 *  `moondriftStandsAt` asks, ⛔ never a second copy of it. */
function moondriftLives(times: readonly number[]): { start: number; end: number }[] {
	const out: { start: number; end: number }[] = [];
	let live: { start: number; end: number }[] = [];
	let count = 0;
	let harmonyReadyAt = -Infinity;

	for (const t of times) {
		live = live.filter((w) => w.end > t);
		// ⚠️ The counter increments BEFORE the top-up test, as in gcsim — so the
		// first reaction is already counted when the spawn branch runs.
		count = Math.min(count + 1, MOONDRIFT_COUNT_CAP);

		if (live.length < MOONDRIFT_MAX) {
			for (let i = live.length; i < MOONDRIFT_MAX; i++) {
				const w = { start: t, end: t + MOONDRIFT_LIFETIME_F };
				out.push(w);
				live.push(w);
			}
		} else if (count >= MOONDRIFT_MAX && t >= harmonyReadyAt) {
			count -= MOONDRIFT_MAX;
			harmonyReadyAt = t + HARMONY_ICD_F;
			for (const w of live) w.end = t + MOONDRIFT_LIFETIME_F;
		}
	}
	return out;
}

/**
 * ⚓ DOES A MOONDRIFT STAND AT `time`? — asked mid-parse by Lumi's strike
 * sequence (Lumi round, 2026-10-17), over `ctx.lunarCrystallizeTimes` as the
 * reactions have fired so far.
 *
 * ⚓ INCLUSIVE of a reaction AT `time`, and that is the mechanic, not a
 * tolerance: Lumi's opening Pound crystallizes, its own Moondrifts stand by the
 * time she picks her next strike, and the Heavy follows (the live game's
 * Geo-first rule). ⚓ The answer at `time` can never be changed by a LATER
 * reaction — a refresh only moves the end of a drift live at the later
 * instant — so the live chain and the finished stream agree by construction.
 */
export function moondriftStandsAt(lcrTimes: readonly number[], time: number): boolean {
	const upTo = lcrTimes.filter((t) => t <= time);
	return moondriftLives(upTo).some((l) => l.start <= time && time < l.end);
}

/**
 * Every Thundercloud and Moondrift this rotation left standing.
 *
 * ⛔ The Prism is NOT here — it comes from `fields.ts`, which owns it together
 * with the buffs it pays out.
 */
export function deriveGadgetWindows(events: readonly ReactionEvent[]): GadgetWindow[] {
	const clouds = mergePresences(reactionsOf(events, 'lunarCharged'), THUNDERCLOUD_LIFETIME_F).map(
		(p): GadgetWindow => ({
			kind: 'gadget',
			gadget: 'thundercloud',
			label: 'Thundercloud',
			start: p.start,
			end: p.end
		})
	);
	return [...clouds, ...deriveMoondrifts(events)];
}
