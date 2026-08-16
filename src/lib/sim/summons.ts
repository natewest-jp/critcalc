/**
 * src/lib/sim/summons.ts
 *
 * Summon resolution and tick walking (gauge-round L3c — lifted verbatim out of
 * `notationParser.ts`).
 *
 * ⚓ THE ONE RESOLVER. `summonSubrows.ts` used to carry a character-for-character
 * copy of `findSummonsForBar` called `findCastSummons`, and both copies wore a
 * "MUST STAY IDENTICAL" warning — coupling #1 on the gauge round's risk list. It
 * imports this one now, the same direction `computeSummonTicks` already went.
 * ⚠️ That does cost `notationParser.ir.test.ts` some of its claim to an
 * INDEPENDENT oracle, and the trade is deliberate: that test's value is
 * reconstructing summon GEOMETRY independently (spawn offset, swap/recast
 * truncation), and sharing the resolution primitive is honest where keeping two
 * copies that must agree is how they drift.
 */

import type { CastAbility, Effect, Element, Summon } from '$lib/types/ability';
import type { CharacterData } from '$lib/types/character';
import { framesOf } from '$lib/utils/frames';
import { evalCondition } from './conditions';

// ---------------------------------------------------------------------------
// Summon resolution (for the P4 summon-window pass)
// ---------------------------------------------------------------------------

/**
 * Resolves ALL summons owned by a given E/Q cast bar (variant-aware). Mirrors
 * `findCastSummons` in `summonSubrows.ts` exactly — the parser now authors the
 * summon `TimelineWindow`s the renderer used to reconstruct, so the spawn/end
 * resolution must agree. Prefers the exact RESOLVED ability (`abilityId` from
 * the cast/bar — a state-gated sibling can carry its own summon, e.g. Durin's
 * Dark burst); falls back to the unconditioned base ability (stance-conditioned
 * variants represent caster state and don't carry summons). Kept parser-side
 * (not imported from summonSubrows) to preserve the parser's runtime-import-free
 * purity — summonSubrows imports back from here.
 *
 * ↻ 2026-08-14 — RETURNS THE WHOLE ARRAY, not `summons[0]`. Three abilities own
 * two summons and the second was silently unreachable: Ineffa's E (a shield
 * barrier with no effects held the lane while BIRGITTA, the thing that ticks
 * every 2s, was never drawn — ⚓ Nate's report), Citlali's E (Opal Shield) and
 * Furina's E (Singer of Many Waters). ⚠ A variant's `summons` OVERRIDES the
 * base wholesale rather than merging, and since 2026-08-14 an EMPTY variant
 * array means NONE rather than falling through — see the note at the return.
 */
export function findSummonsForBar(
	// ⚠️ `| null` because the renderer's copy accepted it and the parser's did
	// not — the one measurable way the two "MUST STAY IDENTICAL" resolvers had
	// ALREADY drifted by the time they were merged (2026-08-16). Behaviourally
	// they agreed: `if (!char)` catches both. The signatures did not.
	char: CharacterData | null | undefined,
	kind: 'skill' | 'burst',
	label: string,
	abilityId?: string
): Summon[] {
	if (!char) return [];
	const candidates = char.abilities.filter((a): a is CastAbility => a.abilityType === kind);
	const ability =
		(abilityId !== undefined ? candidates.find((a) => a.id === abilityId) : undefined) ??
		candidates.find((a) => a.conditions === undefined) ??
		candidates[0];
	if (!ability) return [];
	const variant = ability.variants?.find((v) => (v.input as string[] | undefined)?.includes(label));
	// ⚠ AN EMPTY `summons: []` ON A VARIANT MEANS "NONE", not "fall through".
	// The `?.[0] ?? ability.summons?.[0]` chain this replaced could not express
	// that — an empty array read as undefined and inherited the base's list —
	// but the schema has always called this field an OVERRIDE, and a curator who
	// writes `[]` is overriding to nothing. Zhongli's hold-E is the case that
	// needs it: it raises a Jade Shield (now an Effect) while the base press-E
	// leaves a 30s Stone Stele, and without an explicit "none" the hold would
	// inherit the stele and draw it at the hold's own 20s window — a stele that
	// lasts 30s, rendered 20s, on a cast that the curation notes have always
	// said does not model the co-spawned stele.
	return variant?.summons ?? ability.summons ?? [];
}

/**
 * Where one summon spawns within its cast.
 *
 * ⚠ THE PRIMARY IS NOT COMPUTED THE SAME WAY AS THE REST, and that asymmetry is
 * load-bearing: `summons[0]` is what the ability's geometry accessors already
 * resolved into the cast, so its spawn comes from `summonActivatesAt` (which a
 * persistent-summon override or a variant may have retargeted). A secondary
 * summon went through neither, so it reads its OWN authored `spawnsAt`.
 *
 * ⚠ The two fields carry DIFFERENT UNITS and both are handled right here:
 * `summonActivatesAt` is already frames, `Summon.spawnsAt` is authored in
 * frames (see its declaration), and `Summon.duration` — read by `summonEndAt`
 * below — is authored in SECONDS. ⛔ Don't "harmonise" them.
 */
export function summonSpawnAt(
	barStart: number,
	barSummonActivatesAt: number | undefined,
	summon: Summon,
	index: number
): number {
	return barStart + (index === 0 ? (barSummonActivatesAt ?? 0) : (summon.spawnsAt ?? 0));
}

/**
 * When one summon ends — ⚓ THE ONE ANSWER, so that a live path and finalize
 * cannot hold two (gauge round L5e-a).
 *
 * ⚓⚓ THIS EXISTS TO BE RECOMPUTED, not called once. L5e schedules summon ticks
 * on the clock and each tick re-asks "am I still alive?" at its own instant;
 * finalize asks once, at the end. Both get the same answer because they supply
 * the same facts observed at different times — ⛔ which is the whole point, and
 * the alternative (a parallel live registry recomputing the geometry beside
 * this one) is the `findCastSummons`/`findSummonsForBar` trap this round has
 * already paid for once.
 *
 * ⚠ So pass `barUptime` FRESH on every call. `durationExtensions` grow it
 * mid-parse (Collei's Cuilein-Anbar), so a value snapshotted at the cast is a
 * different — and wrong — question.
 *
 * ⚠ The primary/secondary split again: `summons[0]` takes its lifetime from the
 * BAR's uptime, a secondary from its own authored `duration`. Today all three
 * multi-summon abilities pair equal durations at different spawn frames, so
 * this only shifts starts — but a secondary with its own duration will be right
 * rather than inheriting the primary's.
 *
 * ⛔ RECAST TRUNCATION IS DELIBERATELY NOT HERE, and folding it in would be a
 * mistake rather than a convenience. It is not a property of one summon's end:
 * finalize expresses it by shortening the PRIOR window on the same key, and a
 * live tick chain expresses it by stopping. One function pretending to cover
 * both would have to take the other window as an argument, which is how a
 * shared helper turns back into two implementations wearing one name.
 *
 * ⚠ `terminatesOn` is read off the SUMMON, so a stationary turret can outlive
 * the swap that ends the field it spawned beside.
 */
export function summonEndAt(args: {
	spawnAt: number;
	/** ⚠ The bar's CURRENT uptime — see the note above. */
	barUptime: number;
	summon: Summon;
	index: number;
	/** The owner's next swap-out, or `Infinity` when they never leave. */
	swapOutAt?: number;
}): number {
	const { spawnAt, barUptime, summon, index, swapOutAt = Infinity } = args;
	const natural = spawnAt + (index === 0 ? barUptime : framesOf(summon.duration));
	return summon.terminatesOn === 'swap' && swapOutAt < natural ? swapOutAt : natural;
}

/**
 * Walks a summon's `summonTick` effects over `[spawnAt, endAt)` and emits one
 * entry per interval, paired with the effect that produced it. An effect whose
 * conditions evaluate definitively false is skipped; unresolvable runtime
 * conditions abstain (no ticks), matching the summon lane's behaviour.
 *
 * ⚠ THIS LIVES PARSER-SIDE ON PURPOSE. The renderer had the only copy until
 * 2026-08-15, when the finalize pass started needing tick times to synthesize
 * off-field hits — and the parser stays runtime-import-free, so `summonSubrows`
 * imports back from here (the same direction as `evalCondition`) rather than
 * the parser reaching into `$lib/timeline`. ⛔ Do not fork a second copy the
 * way `findSummonsForBar`/`findCastSummons` were forked; that pair needs a
 * "MUST STAY IDENTICAL" warning precisely because it is duplicated.
 *
 * ⚓ The ascension/state arguments to `evalCondition` are the renderer's
 * (`4`, no states) rather than the parse's live state, and that is load-bearing:
 * it makes the ticks a viewer SEES on the summon bar exactly the hits that fire.
 * A divergence here would show a marker that buffs nothing, or buff off a marker
 * that isn't drawn.
 */
export function collectSummonTicks(
	summon: Summon,
	spawnAt: number,
	endAt: number,
	cLevel: number,
	accept: (effect: Effect) => boolean
): { time: number; effect: Effect }[] {
	const ticks: { time: number; effect: Effect }[] = [];
	for (const eff of summon.effects ?? []) {
		if (eff.trigger.type !== 'summonTick') continue;
		if (!accept(eff)) continue;
		if (evalCondition(eff.conditions, 4, new Set(), cLevel) === false) continue;
		// ⚓ Authored seconds → frames BEFORE the walk, not inside it. An integer
		// interval added repeatedly is exact; the float seconds this replaced
		// drifted a little further with every tick across a 20s summon.
		const interval = framesOf(eff.trigger.interval);
		if (!(interval > 0)) continue;
		const firstDelay =
			eff.trigger.firstTickDelay !== undefined ? framesOf(eff.trigger.firstTickDelay) : interval;
		for (let t = spawnAt + firstDelay; t < endAt; t += interval) {
			ticks.push({ time: t, effect: eff });
		}
	}
	ticks.sort((a, b) => a.time - b.time);
	return ticks;
}

/** Tick timestamps for EVERY `summonTick` effect — the summon lane's markers.
 *  Re-exported by `summonSubrows.ts`, which is where it used to live. */
export function computeSummonTicks(
	summon: Summon,
	spawnAt: number,
	endAt: number,
	cLevel: number
): number[] {
	return collectSummonTicks(summon, spawnAt, endAt, cLevel, () => true).map((t) => t.time);
}

/**
 * Tick timestamps for a summon's DAMAGE effects only, with each tick's element.
 *
 * ⚓ A heal tick is not a hit. Four summons pair a heal and a damage effect on
 * the identical interval and first-delay (Diona's Drunken Mist, Kuki's Grass
 * Ring, Kokomi's Bake-Kurage, Mizuki's Mini Baku), so taking every tick would
 * fire each of those summons' onHit consumers TWICE per instant. Filtering to
 * damage is what makes the count right — no dedup pass is needed on top of it,
 * because the only summon carrying multiple damage series is Furina's Salon
 * Solitaire, whose three series are three distinct Salon Members landing three
 * distinct hits (and whose intervals — 3.369/1.626/5.231 — essentially never
 * coincide anyway).
 */
export function computeSummonDamageTicks(
	summon: Summon,
	spawnAt: number,
	endAt: number,
	cLevel: number
): { time: number; element?: Element }[] {
	return collectSummonTicks(summon, spawnAt, endAt, cLevel, (eff) => eff.type === 'damage').map(
		(t) => ({ time: t.time, element: (t.effect as Extract<Effect, { type: 'damage' }>).element })
	);
}
