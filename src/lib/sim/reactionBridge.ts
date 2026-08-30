/**
 * src/lib/sim/reactionBridge.ts
 *
 * gcsim's reaction ontology → ours (gauge round L5b).
 *
 * ⚓ THE ONE PLACE THAT KNOWS BOTH VOCABULARIES. `gauge.ts` speaks
 * `pkg/reactable`'s language — a `swirl` carrying WHICH aura it swirled, a
 * `reverseVaporize` distinct from a `vaporize` because the multiplier differs.
 * The corpus speaks ours — `pyroSwirl` is its own `Reaction` key, and a curator
 * authoring `trigger.reaction` never sees a multiplier. Every other module gets
 * to know exactly one of the two.
 *
 * ⚓⚓ THE CONVERSION MODEL (⚓ Nate, 2026-08-31 — one rule, four instances).
 * Newer-generation reactions (Lunar 6.x, Stellar 7.x) are NOT extra reactions
 * layered on the old ones. Each one REPLACES exactly one base reaction, and:
 *
 *   1. It requires an ENABLER in the party. No enabler → the base reaction, as
 *      before. ⚠️ ONE enabler suffices and enablement is PER-REACTION.
 *   2. Any party member can then trigger it — an enabler need not be involved in
 *      the reaction itself, and a character's kit text need not mention it.
 *   3. The replacement is CLEAN: with an enabler present the base reaction does
 *      not happen at all. ⚠️ But only for its OWN base — a Lunar-Crystallize
 *      enabler replaces HYDRO crystallize only; pyro/cryo/electro crystallize
 *      still occur normally alongside it.
 *
 * ⛔⛔ A BUFF ON THE BASE IS NOT A BUFF ON THE CONVERTED REACTION (⚓ Nate).
 * Diona's C6 Superconduct bonus does NOT fire in a Sandrone party — no
 * Superconduct is happening. Newer reactions are buffed by explicitly naming
 * them, and usually at a different scaling (they crit, among other things).
 * ⛔ So do NOT make a converted reaction "satisfy" a listener for its base, and
 * ⛔ do NOT pair up OR-arrays whose kit text was not itself updated: an effect
 * going dark in an enabler party is CORRECT, not a defect to repair.
 *
 * ⚓⚓ `lunarBloom` IS in the table, as the ONE `mode: 'add'` row. With an enabler
 * present a Bloom is also a Lunar-Bloom — but ⛔ it does not REPLACE, because the
 * Bloom fully happens: the core left on the field is an ordinary Bloom core.
 * Lunar-Bloom leaves nothing of its own and deals no damage by itself (only a
 * talent that names it deals direct LB damage); it stacks Verdant Dew and arms
 * Lunar-Bloom buffs, which is exactly why the event must still be emitted.
 * ⛔ `shatter` stays unemitted, as before the gauge.
 */

import type { Reaction } from '$lib/types/ability';
import type { AuraKey, SimEvent } from '$lib/utils/gauge';

export type GaugeReaction = Extract<SimEvent, { kind: 'reaction' }>;

/** Team facts the two ours-only reactions are gated on. */
export type ReactionTeamContext = {
	teamEnabledReactions: ReadonlySet<string>;
};

/** ⚓ A FROZEN aura swirls and crystallizes as CRYO — it is a Cryo aura in a
 *  different state, and gcsim reports it under its own key only because its
 *  decay is different. The other four map to themselves. */
const SWIRL_OF: Partial<Record<AuraKey, Reaction>> = {
	pyro: 'pyroSwirl',
	hydro: 'hydroSwirl',
	cryo: 'cryoSwirl',
	electro: 'electroSwirl',
	frozen: 'cryoSwirl'
};

/** ⚓ base → converted, gated on `teamEnabledReactions.has(converted)`.
 *  Enabler rosters live in the library docs, not here:
 *  lunarCharged = Ineffa/Flins/Columbina · lunarCrystallize = Zibai/Columbina/
 *  Linnea · stellarConduct + stellarSwirl = Sandrone/Odette/Cryo Traveler.
 *  ⛔ Adding a row here is inert until some character DECLARES the reaction in
 *  `enablesReactions` — that declaration is the arming switch. */
const CONVERSIONS: ReadonlyArray<{
	base: Reaction;
	converted: Reaction;
	mode: 'replace' | 'add';
}> = [
	{ base: 'superConduct', converted: 'stellarConduct', mode: 'replace' },
	{ base: 'cryoSwirl', converted: 'stellarSwirl', mode: 'replace' },
	{ base: 'electroCharged', converted: 'lunarCharged', mode: 'replace' },
	// ⚠️ HYDRO crystallize only — the other three variants are untouched and
	// still occur alongside a lunar one.
	{ base: 'hydroCrystallize', converted: 'lunarCrystallize', mode: 'replace' },
	// ⚓⚓ THE ONE ADDITION (⚓ Nate, 2026-08-31). With an enabler present a Bloom
	// IS also a Lunar-Bloom — but the Bloom still fully happens: the core on the
	// field is an ORDINARY Bloom core. Lunar-Bloom leaves nothing of its own and
	// deals no damage by itself; it stacks Verdant Dew and arms Lunar-Bloom
	// buffs. ⛔ So it must NOT replace, and the base must keep being emitted.
	{ base: 'bloom', converted: 'lunarBloom', mode: 'add' }
];

/* ⚠️⚠️ `mode: 'add'` HAS A HAZARD THAT `'replace'` DOES NOT, and it is the whole
 * reason the modes are named rather than implicit.
 *
 * Under `replace` only ONE of the pair is ever emitted, so an `onReaction`
 * trigger listing BOTH is harmless — it simply matches whichever occurred.
 * (13 effects across 11 characters do exactly that; all but three are safe for
 * this reason.)
 *
 * Under `add` BOTH are emitted for one in-game reaction, so an effect listing
 * both fires TWICE. ⛔ For an add pair, list ONE side, never both:
 *   · fires on every bloom          → list `bloom` alone (the base always occurs)
 *   · fires only when it is LUNAR   → list `lunarBloom` alone (Lauma's heal)
 * Corrected 2026-08-31 on the three that listed both — Collei (a summon
 * `durationExtensions`, which would have extended 2s per bloom against a
 * `maxExtensions: 3` cap), Tighnari (a team EM buff, double-pooled) and
 * Neuvillette (`gainStacks`, two stacks per bloom). ⛔ Don't re-add them. */

/** The base reaction, plus/or its newer-generation counterpart when the party
 *  enables one. ⚓ ONE function so the five cannot drift apart. */
function convert(base: Reaction, team: ReactionTeamContext): Reaction[] {
	for (const c of CONVERSIONS) {
		if (c.base !== base || !team.teamEnabledReactions.has(c.converted)) continue;
		return c.mode === 'replace' ? [c.converted] : [base, c.converted];
	}
	return [base];
}

const CRYSTALLIZE_OF: Partial<Record<AuraKey, Reaction>> = {
	pyro: 'pyroCrystallize',
	hydro: 'hydroCrystallize',
	cryo: 'cryoCrystallize',
	electro: 'electroCrystallize',
	frozen: 'cryoCrystallize'
};

/**
 * The `Reaction` keys one gauge reaction event means to our consumers — usually
 * one, occasionally two (crystallize on a Moonsign team), sometimes none.
 *
 * ⚓ NONE IS A REAL ANSWER AND IT IS THE FIX. `crystallizeBlocked` is the 1 s
 * crystallize GCD refusing a second shard, which the coarse model had no notion
 * of — every Geo cast crystallized, so a Zhongli rotation drew a crystallize
 * shield proc per cast.
 */
export function toReactions(e: GaugeReaction, team: ReactionTeamContext): Reaction[] {
	switch (e.reaction) {
		// ⛔ Stellar Swirl converts CRYO SWIRL ONLY — NOT "the swirl matching the
		// enabler's element". All three enablers are Cryo, so the data cannot tell
		// those two rules apart; the mechanic is stated about the REACTION.
		// ⚠️ `SWIRL_OF` maps BOTH `cryo` and `frozen` to cryoSwirl, so a swirl off
		// a frozen aura converts too — deliberate, it is the same reaction.
		case 'swirl': {
			const key = e.of && SWIRL_OF[e.of];
			return key ? convert(key, team) : [];
		}
		// ↻ 2026-08-31: was pushed ALONGSIDE the crystallize and gated on 2+
		// Moonsign. Both were wrong (⚓ Nate) — it is an ordinary enabler-gated
		// clean replacement, and it replaces HYDRO crystallize ONLY. A pyro
		// crystallize in a Zibai party is still a pyro crystallize.
		case 'crystallize': {
			const key = e.of && CRYSTALLIZE_OF[e.of];
			return key ? convert(key, team) : [];
		}
		case 'crystallizeBlocked':
			return [];
		// The multiplier is the only thing the two directions differ by, and a
		// curator authors "vaporize", never "the 1.5× one".
		case 'vaporize':
		case 'reverseVaporize':
			return ['vaporize'];
		case 'melt':
		case 'reverseMelt':
			return ['melt'];
		case 'overload':
			return ['overloaded'];
		case 'superconduct':
			return convert('superConduct', team);
		case 'freeze':
			return ['frozen'];
		// ↻ 2026-08-31: previously emitted unconverted, so `lunarCharged` was NEVER
		// emitted at all — Ineffa's and Flins's lunarCharged-only effects could
		// not fire, though `enablesReactions` already existed for the Stellar
		// conversion that was modelled ON this one.
		case 'electroCharged':
			return convert('electroCharged', team);
		case 'burning':
			return ['burning'];
		// A quicken-bloom is a bloom that formed off the quicken aura rather than
		// a dendro one; nothing downstream distinguishes them.
		// ⚠️ A quicken-bloom is a bloom; nothing downstream distinguishes them, so
		// both take the lunar addition.
		case 'bloom':
		case 'quickenBloom':
			return convert('bloom', team);
		case 'quicken':
			return ['quicken'];
		case 'aggravate':
			return ['aggravate'];
		case 'spread':
			return ['spread'];
		case 'hyperbloom':
			return ['hyperbloom'];
		case 'burgeon':
			return ['burgeon'];
	}
}
