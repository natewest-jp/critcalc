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
import { FPS, framesOf } from '$lib/utils/frames';
import {
	applyModifiers,
	DEFAULT_ASCENSION,
	evalCondition,
	mentionsPolestarField,
	type ConditionContext
} from './conditions';

// ---------------------------------------------------------------------------
// Summon resolution (for the P4 summon-window pass)
// ---------------------------------------------------------------------------

/**
 * Resolves ALL summons owned by a given E/Q cast bar (variant-aware). THE one
 * resolver — `summonSubrows.ts` re-exports it as `findCastSummons`, so the
 * parser's windows and the renderer's lanes cannot disagree. Prefers the exact RESOLVED ability (`abilityId` from
 * the cast/bar — a state-gated sibling can carry its own summon, e.g. Durin's
 * Dark burst); falls back to the unconditioned base ability (stance-conditioned
 * variants represent caster state and don't carry summons). It lives
 * parser-side to keep the parser runtime-import-free; summonSubrows imports
 * it from here.
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
	abilityId?: string,
	/** What the PARSE resolved, as a THREE-STATE (Arkhe round, 2026-09-04):
	 *
	 *    string    — `matchVariant` chose that variant; use it by `label`.
	 *    null      — `matchVariant` chose NONE; use the BASE ability's summons.
	 *    undefined — the caller has no cast in hand; match by input token.
	 *
	 *  ⚠️⚠️ THE `null` ARM IS THE WHOLE POINT AND IT IS NOT DEFENSIVE PADDING.
	 *  Collapsing it into `undefined` reads "no variant resolved" as "match by
	 *  input", and the input match cannot separate two variants that share a
	 *  token — it takes the FIRST. Furina's Ousia and Pneuma lineups are both
	 *  `input: ["E"]`, so an OUSIA cast fell straight through to the Pneuma
	 *  summon; measured on the staged data before this arm existed, every one of
	 *  `E`, `C C E` and the Ousia half of `C E C E` drew the Singer.
	 *
	 *  ⚓ `null` also puts summons on the SAME rule the parser already applies to
	 *  timing: `matchVariant` requires input match AND conditions, and an
	 *  unsatisfied variant falls back to the base ability's cooldown and frames
	 *  (see its doc). Before this, its summons did not follow. */
	variantLabel?: string | null
): Summon[] {
	if (!char) return [];
	const candidates = char.abilities.filter((a): a is CastAbility => a.abilityType === kind);
	const ability =
		(abilityId !== undefined ? candidates.find((a) => a.id === abilityId) : undefined) ??
		candidates.find((a) => a.conditions === undefined) ??
		candidates[0];
	if (!ability) return [];
	// ⛔ `undefined` is NOT `null` here — see the parameter's doc. The input match
	// is the arm for a caller with no cast in hand (the renderer's `hasSummon`
	// presence tests, and the unit tests' bare 3-arg form), never a fallback for
	// a cast that resolved nothing.
	const variant =
		variantLabel === undefined
			? ability.variants?.find((v) => (v.input as string[] | undefined)?.includes(label))
			: variantLabel === null
				? undefined
				: ability.variants?.find((v) => v.label === variantLabel);
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
 * Whether the cast that owns a summon is a STANCE — the one fact `summonEndAt`
 * needs beyond the summon itself. Resolves the ability the same way
 * `findSummonsForBar` does (the resolved id first, then the unconditioned
 * base), so the two cannot disagree about which cast is being asked about.
 */
export function summonOwnerIsStance(
	char: CharacterData | null | undefined,
	kind: 'skill' | 'burst',
	abilityId?: string
): boolean {
	if (!char) return false;
	const candidates = char.abilities.filter((a): a is CastAbility => a.abilityType === kind);
	const ability =
		(abilityId !== undefined ? candidates.find((a) => a.id === abilityId) : undefined) ??
		candidates.find((a) => a.conditions === undefined) ??
		candidates[0];
	return ability?.behavior === 'stance';
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
 * ⚓ EXCEPT WHEN THE OWNER IS A STANCE (2026-09-22): then the bar's uptime is
 * the STANCE, and the summon is a thing left in the world with a lifetime of
 * its own — so the primary reads its authored `duration` + `durationModifiers`
 * exactly as a secondary does. Nilou is the one holder: Pirouette is 10s, the
 * Tranquility Aura it leaves runs 12s (18 at C1). Before this, `getActiveDuration`
 * handed the stance the AURA's length; once it stopped, the aura was cut to the
 * stance's — the coupling had been hiding in both directions.
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
 *
 * ⚓ A SECONDARY READS ITS OWN `durationModifiers` (2026-09-19). The field is on
 * every `Summon`, and until this date only `summons[0]`'s were ever applied —
 * through the cast's geometry accessors, which resolve the primary and nothing
 * else — so a modifier authored on a second summon was silently inert. Alyosha's
 * C2 lengthens his whole burst by 6s and the Fulgurite Hunting Field, his
 * burst's second summon, kept ending at 14s. `cLevel` is REQUIRED so that no
 * caller can ask this question without it, and every caller passes the SAME
 * context its tick walk takes — ⛔ the live chain and finalize must not resolve
 * a modifier's gate differently. ⚠️ No resolved states: a secondary has no cast
 * of its own to snapshot them at, so a STATE-gated modifier on one is
 * unresolvable and is skipped (`applyModifiers` applies only a definitive true).
 */
export function summonEndAt(args: {
	spawnAt: number;
	/** ⚠ The bar's CURRENT uptime — see the note above. */
	barUptime: number;
	summon: Summon;
	index: number;
	/** The owner's constellation level — gates a secondary's modifiers. */
	cLevel: number;
	/** Team scope for a secondary's modifier gate; the tick walk's own. */
	context?: ConditionContext;
	/** The owner's next swap-out, or `Infinity` when they never leave. */
	swapOutAt?: number;
	/** The owning cast is a stance (`summonOwnerIsStance`), so even the primary
	 *  lives its own authored lifetime — see the ⚓ note above. */
	ownerIsStance?: boolean;
}): number {
	const {
		spawnAt,
		barUptime,
		summon,
		index,
		cLevel,
		context,
		swapOutAt = Infinity,
		ownerIsStance = false
	} = args;
	// ⚓ A swap-out spawn (`spawnsAtSwapOutFrom`) has nothing to do with the
	// cast's bar — it starts after the bar ended — so it lives its own life.
	const ownLifetime = index !== 0 || ownerIsStance || summon.spawnsAtSwapOutFrom !== undefined;
	const natural = spawnAt + (ownLifetime ? secondaryLifetime(summon, cLevel, context) : barUptime);
	return summon.terminatesOn === 'swap' && swapOutAt < natural ? swapOutAt : natural;
}

/** A secondary summon's lifetime in FRAMES: its authored `duration` with its own
 *  `durationModifiers` applied. See `summonEndAt`. */
function secondaryLifetime(summon: Summon, cLevel: number, context?: ConditionContext): number {
	return applyModifiers(
		framesOf(summon.duration),
		summon.durationModifiers,
		DEFAULT_ASCENSION,
		new Set(),
		cLevel,
		undefined,
		undefined,
		FPS, // a `flat` duration modifier is authored in seconds
		context
	);
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
	accept: (effect: Effect) => boolean,
	context?: ConditionContext,
	/** The summon's UNTRUNCATED end (`TimelineWindow.naturalEnd`). Absent =
	 *  treat `endAt` as natural, the pre-2026-09-17 behaviour. */
	naturalEnd?: number,
	/** Whether a Polestar Field stands at an instant — finalize's view of the
	 *  finished Stellar-Conduct stream. Absent (the Team Builder, the renderer's
	 *  context-free callers) leaves a field-gated series unresolved, so every
	 *  tick draws. */
	fieldOpenAt?: (time: number) => boolean
): { time: number; effect: Effect }[] {
	const ticks: { time: number; effect: Effect }[] = [];
	// ⚓ A CUT WINDOW HAS NO BOUNDARY TICK (small-fix bundle, 2026-09-17). The
	// widening below exists because gcsim's status-gated chains land the tick
	// on a NATURAL expiry; a window a recast, a swap or an Arkhe flip ended
	// early stops where it was cut. ⚠️ `aura.ts`'s live chain applies the same
	// test — ⛔ the two must agree, or a marker draws that applies nothing.
	const endIsNatural = naturalEnd === undefined || endAt >= naturalEnd;
	for (const s of summonTickSeries(summon, cLevel, accept, context)) {
		// ⚓ THE CAP IS A BOUND ON TOP OF THE WINDOW, never instead of it — a series
		// stops at whichever comes first. ⚠️ The single exception is the BOUNDARY
		// TICK: our walk is half-open, so a tick landing exactly on `endAt` is
		// dropped, and gcsim's status-gated chains land it (Kaeya's status is
		// `duration + hitmark + 1`, and that `+ 1` is deliberate). An authored cap
		// widens the window by exactly ONE tick to say so, and ⛔ by no more.
		const cap = tickCapOf(s.effect, cLevel, context);
		const limit = cap === null || !endIsNatural ? endAt : endAt + s.interval;
		// ⚓ A field-gated series is asked PER TICK — the live chain's own rule
		// (`aura.ts`), word for word: a refused tick is skipped and the cadence
		// runs on underneath it.
		const asksField = fieldOpenAt !== undefined && mentionsPolestarField(s.effect.conditions);
		let n = 0;
		for (let t = spawnAt + s.firstDelay; t < limit; t += s.interval) {
			if (cap !== null && n >= cap) break;
			if (
				asksField &&
				evalCondition(s.effect.conditions, 4, new Set(), cLevel, undefined, undefined, {
					...context,
					inPolestarField: fieldOpenAt!(t)
				}) === false
			)
				continue;
			n += 1;
			ticks.push({ time: t, effect: s.effect });
		}
	}
	ticks.sort((a, b) => a.time - b.time);
	return ticks;
}

/**
 * The authored tick COUNT for one series, constellation applied, or `null` when
 * the count is derived from the summon's lifetime (the measured majority).
 *
 * ⚓ Exported so the audit can read back exactly what the sim will do — an
 * authored cap is a CLAIM about gcsim, and `audit-gcsim-frames.mjs` §5 is what
 * re-measures it. ⛔ Never re-derive this rule there.
 */
export function tickCapOf(
	effect: Effect,
	cLevel: number,
	context?: ConditionContext
): number | null {
	if (effect.trigger.type !== 'summonTick') return null;
	const t = effect.trigger;
	// ⚠️ The constellation override REPLACES the base outright rather than adding
	// to it — same contract as `BuffEffect.constellationScaling`. It is read even
	// when no base cap is authored, so a series that is derived at C0 and capped
	// at C6 can say exactly that.
	const scaled = t.tickCapScaling;
	if (
		scaled &&
		evalCondition(scaled.conditions, 4, new Set(), cLevel, undefined, undefined, context) === true
	)
		return scaled.ticks;
	return t.tickCap ?? null;
}

/** One accepted `summonTick` series: which effect, and its cadence in FRAMES. */
export type SummonTickSeries = {
	effect: Effect;
	/** Index into `summon.effects` — stable per authored summon, and the thing
	 *  that keeps two series on ONE summon (Furina's three Salon Members) from
	 *  sharing an ICD counter. */
	index: number;
	interval: number;
	firstDelay: number;
};

/**
 * ⚓ THE ONE ACCEPTANCE RULE for a summon's tick series — which effects tick,
 * and on what cadence — with the walk above and L5e-b's live tick chain as its
 * two readers. ⛔ Neither may re-derive any line of this; a chain that accepted
 * a different set from the one the lane DRAWS would fire buffs off markers
 * nobody can see, or draw markers that buff nothing.
 *
 * ⚓ Authored seconds → frames HERE, once, never inside a walk. An integer
 * interval added repeatedly is exact; the float seconds this replaced drifted a
 * little further with every tick across a 20 s summon.
 *
 * ⚓ The ascension/state arguments to `evalCondition` are the RENDERER's
 * (`4`, no states) rather than the parse's live state, and that is load-bearing
 * for the same reason — it makes the ticks a viewer SEES exactly the ticks that
 * fire. ⚠️ An unresolvable runtime condition abstains (no ticks), matching the
 * summon lane.
 */
export function summonTickSeries(
	summon: Summon,
	cLevel: number,
	accept: (effect: Effect) => boolean,
	context?: ConditionContext
): SummonTickSeries[] {
	const out: SummonTickSeries[] = [];
	(summon.effects ?? []).forEach((eff, index) => {
		if (eff.trigger.type !== 'summonTick') return;
		if (!accept(eff)) return;
		if (
			evalCondition(eff.conditions, 4, new Set(), cLevel, undefined, undefined, context) === false
		)
			return;
		const interval = framesOf(eff.trigger.interval);
		if (!(interval > 0)) return;
		const firstDelay =
			eff.trigger.firstTickDelay !== undefined ? framesOf(eff.trigger.firstTickDelay) : interval;
		out.push({ effect: eff, index, interval, firstDelay });
	});
	return out;
}

/** ⚓ A tick the summon lane MARKS: one that hits or heals. A tick that only
 *  moves a stack count (stepped stacks round, 2026-09-27 — Odette's A1 ticker)
 *  is a clock, not an event on the target, and a marker every second would
 *  bury the dance moves the lane exists to show. */
export function isMarkedTickEffect(effect: Effect): boolean {
	return effect.type === 'damage' || effect.type === 'heal';
}

/** Tick timestamps for every MARKED `summonTick` effect — the summon lane's markers.
 *  Re-exported by `summonSubrows.ts`, which is where it used to live. */
export function computeSummonTicks(
	summon: Summon,
	spawnAt: number,
	endAt: number,
	cLevel: number,
	context?: ConditionContext
): number[] {
	return collectSummonTicks(summon, spawnAt, endAt, cLevel, isMarkedTickEffect, context).map(
		(t) => t.time
	);
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
	cLevel: number,
	context?: ConditionContext,
	fieldOpenAt?: (time: number) => boolean
): { time: number; element?: Element }[] {
	return collectSummonTicks(
		summon,
		spawnAt,
		endAt,
		cLevel,
		(eff) => eff.type === 'damage',
		context,
		undefined,
		fieldOpenAt
	).map((t) => ({
		time: t.time,
		element: (t.effect as Extract<Effect, { type: 'damage' }>).element
	}));
}
