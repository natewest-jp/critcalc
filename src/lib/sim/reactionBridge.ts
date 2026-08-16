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
 * Two of our reactions have no gcsim counterpart at all and are applied HERE,
 * exactly as the coarse model applied them:
 *
 *   lunarCrystallize  pushed ALONGSIDE a crystallize when the team carries 2+
 *                     Moonsign (an addition — the crystallize still happened).
 *   stellarConduct    REPLACES superConduct when an enabler is on the team.
 *                     ⛔ Replacement, not addition: in game ONE enabler converts
 *                     ALL Superconduct, and patched kit texts read "Superconduct
 *                     or Stellar-Conduct", so consumers author OR-arrays.
 *                     See docs/library/game/stellar-reactions.md.
 *
 * ⛔ `shatter`, `lunarBloom`, `lunarCharged` and `stellarSwirl` stay unemitted,
 * as they were before the gauge. L5 changes the ENGINE, not the vocabulary.
 */

import type { Reaction } from '$lib/types/ability';
import type { AuraKey, SimEvent } from '$lib/utils/gauge';

export type GaugeReaction = Extract<SimEvent, { kind: 'reaction' }>;

/** Team facts the two ours-only reactions are gated on. */
export type ReactionTeamContext = {
	hasMoonsignTeam: boolean;
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
		case 'swirl':
			return e.of && SWIRL_OF[e.of] ? [SWIRL_OF[e.of]!] : [];
		case 'crystallize': {
			const key = e.of && CRYSTALLIZE_OF[e.of];
			if (!key) return [];
			return team.hasMoonsignTeam ? [key, 'lunarCrystallize'] : [key];
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
			return [team.teamEnabledReactions.has('stellarConduct') ? 'stellarConduct' : 'superConduct'];
		case 'freeze':
			return ['frozen'];
		case 'electroCharged':
			return ['electroCharged'];
		case 'burning':
			return ['burning'];
		// A quicken-bloom is a bloom that formed off the quicken aura rather than
		// a dendro one; nothing downstream distinguishes them.
		case 'bloom':
		case 'quickenBloom':
			return ['bloom'];
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
