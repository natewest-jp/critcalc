import { describe, it, expect } from 'vitest';
import { toReactions, type GaugeReaction, type ReactionTeamContext } from './reactionBridge';
import type { ReactionKind, AuraKey } from '$lib/utils/gauge';

const PLAIN: ReactionTeamContext = { hasMoonsignTeam: false, teamEnabledReactions: new Set() };
const MOONSIGN: ReactionTeamContext = { hasMoonsignTeam: true, teamEnabledReactions: new Set() };
const STELLAR: ReactionTeamContext = {
	hasMoonsignTeam: false,
	teamEnabledReactions: new Set(['stellarConduct'])
};

const rx = (reaction: ReactionKind, of?: AuraKey): GaugeReaction => ({
	kind: 'reaction',
	time: 0,
	appIndex: 0,
	reaction,
	trigger: 'anemo',
	of,
	consumed: [],
	spent: 0
});

describe('reactionBridge', () => {
	it('names a swirl and a crystallize after the aura they acted on', () => {
		expect(toReactions(rx('swirl', 'pyro'), PLAIN)).toEqual(['pyroSwirl']);
		expect(toReactions(rx('swirl', 'electro'), PLAIN)).toEqual(['electroSwirl']);
		expect(toReactions(rx('crystallize', 'hydro'), PLAIN)).toEqual(['hydroCrystallize']);
	});

	it('treats a frozen aura as cryo', () => {
		expect(toReactions(rx('swirl', 'frozen'), PLAIN)).toEqual(['cryoSwirl']);
		expect(toReactions(rx('crystallize', 'frozen'), PLAIN)).toEqual(['cryoCrystallize']);
	});

	it('emits NOTHING for a crystallize the 1s GCD refused', () => {
		// ⚓ The coarse model had no GCD, so every Geo cast crystallized.
		expect(toReactions(rx('crystallizeBlocked', 'cryo'), PLAIN)).toEqual([]);
	});

	it('adds lunarCrystallize on a Moonsign team, and never on its own', () => {
		expect(toReactions(rx('crystallize', 'cryo'), MOONSIGN)).toEqual([
			'cryoCrystallize',
			'lunarCrystallize'
		]);
		expect(toReactions(rx('swirl', 'cryo'), MOONSIGN)).toEqual(['cryoSwirl']);
	});

	it('REPLACES superConduct with stellarConduct when an enabler is on the team', () => {
		expect(toReactions(rx('superconduct'), PLAIN)).toEqual(['superConduct']);
		expect(toReactions(rx('superconduct'), STELLAR)).toEqual(['stellarConduct']);
	});

	it('folds the reverse variants onto the reaction a curator authors', () => {
		expect(toReactions(rx('reverseVaporize'), PLAIN)).toEqual(['vaporize']);
		expect(toReactions(rx('reverseMelt'), PLAIN)).toEqual(['melt']);
		expect(toReactions(rx('quickenBloom'), PLAIN)).toEqual(['bloom']);
	});

	it('maps every gauge reaction kind — ⛔ never silently drops one', () => {
		// The union is exhaustive by construction (the switch has no default), so
		// this guards the OTHER half: that no kind maps to an empty list except the
		// two that mean "this reaction did not happen".
		const KINDS: ReactionKind[] = [
			'vaporize',
			'reverseVaporize',
			'melt',
			'reverseMelt',
			'overload',
			'superconduct',
			'electroCharged',
			'freeze',
			'swirl',
			'crystallize',
			'crystallizeBlocked',
			'quicken',
			'aggravate',
			'spread',
			'bloom',
			'quickenBloom',
			'burning',
			'hyperbloom',
			'burgeon'
		];
		const empty = KINDS.filter((k) => toReactions(rx(k, 'pyro'), PLAIN).length === 0);
		expect(empty).toEqual(['crystallizeBlocked']);
	});
});
