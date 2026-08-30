import { describe, it, expect } from 'vitest';
import { toReactions, type GaugeReaction, type ReactionTeamContext } from './reactionBridge';
import type { ReactionKind, AuraKey } from '$lib/utils/gauge';

const PLAIN: ReactionTeamContext = { teamEnabledReactions: new Set() };
const STELLAR: ReactionTeamContext = {
	teamEnabledReactions: new Set(['stellarConduct'])
};
const LUNAR_CRYS: ReactionTeamContext = {
	teamEnabledReactions: new Set(['lunarCrystallize'])
};
const LUNAR_EC: ReactionTeamContext = { teamEnabledReactions: new Set(['lunarCharged']) };
const LUNAR_BLOOM: ReactionTeamContext = { teamEnabledReactions: new Set(['lunarBloom']) };
/** ⛔ Even with every conversion enabled, bloom must not convert. */
const EVERYTHING: ReactionTeamContext = {
	teamEnabledReactions: new Set([
		'stellarConduct',
		'stellarSwirl',
		'lunarCharged',
		'lunarCrystallize',
		'lunarBloom'
	])
};
/** A 7.0 enabler (Sandrone / Odette / Cryo Traveler) enables BOTH. */
const STELLAR_BOTH: ReactionTeamContext = {
	teamEnabledReactions: new Set(['stellarConduct', 'stellarSwirl'])
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

	// ↻ REWRITTEN 2026-08-31. The previous version asserted the OLD model —
	// lunarCrystallize pushed ALONGSIDE any crystallize on a 2+ Moonsign team.
	// ⚓ Nate: both halves were wrong. It is an ordinary enabler-gated CLEAN
	// replacement, and it replaces HYDRO crystallize ONLY.
	it('REPLACES hydroCrystallize with lunarCrystallize — and only hydro', () => {
		expect(toReactions(rx('crystallize', 'hydro'), PLAIN)).toEqual(['hydroCrystallize']);
		expect(toReactions(rx('crystallize', 'hydro'), LUNAR_CRYS)).toEqual(['lunarCrystallize']);
		// ⛔ Never alongside — the base crystallize does not also happen.
		expect(toReactions(rx('crystallize', 'hydro'), LUNAR_CRYS)).not.toContain('hydroCrystallize');
		// ⚠️ The other three variants still occur normally in an enabler party.
		for (const of of ['pyro', 'cryo', 'electro'] as AuraKey[]) {
			expect(toReactions(rx('crystallize', of), LUNAR_CRYS)).toEqual([`${of}Crystallize`]);
		}
	});

	it('REPLACES electroCharged with lunarCharged when an enabler is on the team', () => {
		expect(toReactions(rx('electroCharged'), PLAIN)).toEqual(['electroCharged']);
		expect(toReactions(rx('electroCharged'), LUNAR_EC)).toEqual(['lunarCharged']);
	});

	// ↻ REWRITTEN 2026-08-31 (second time today). It first asserted that bloom
	// never converts — my misreading of "Lunar-Bloom is different". ⚓ Nate: a
	// Bloom in an enabler party IS also a Lunar-Bloom; what makes it different is
	// that it ADDS rather than REPLACES, because the core left on the field is an
	// ordinary Bloom core and LB deals no damage of its own.
	it('ADDS lunarBloom to a bloom — ⛔ never replaces it', () => {
		expect(toReactions(rx('bloom'), PLAIN)).toEqual(['bloom']);
		expect(toReactions(rx('bloom'), LUNAR_BLOOM)).toEqual(['bloom', 'lunarBloom']);
		// ⛔ The base must survive — the Bloom core is still an ordinary one.
		expect(toReactions(rx('bloom'), LUNAR_BLOOM)).toContain('bloom');
		// ⚠️ A quicken-bloom is a bloom and takes the addition too.
		expect(toReactions(rx('quickenBloom'), LUNAR_BLOOM)).toEqual(['bloom', 'lunarBloom']);
		// ⛔ Another generation's enabler must not produce it.
		expect(toReactions(rx('bloom'), LUNAR_CRYS)).toEqual(['bloom']);
		expect(toReactions(rx('bloom'), LUNAR_EC)).toEqual(['bloom']);
	});

	it('⛔ add-mode is the ONLY mode that emits two — replacements never do', () => {
		// The corpus relies on this: 10 of the 13 effects listing a base AND its
		// converted counterpart are safe purely because replacement emits one.
		for (const e of [rx('superconduct'), rx('electroCharged'), rx('crystallize', 'hydro')]) {
			expect(toReactions(e, EVERYTHING)).toHaveLength(1);
		}
		expect(toReactions(rx('swirl', 'cryo'), EVERYTHING)).toHaveLength(1);
		expect(toReactions(rx('bloom'), EVERYTHING)).toHaveLength(2);
	});

	it('REPLACES superConduct with stellarConduct when an enabler is on the team', () => {
		expect(toReactions(rx('superconduct'), PLAIN)).toEqual(['superConduct']);
		expect(toReactions(rx('superconduct'), STELLAR)).toEqual(['stellarConduct']);
	});

	it('REPLACES cryoSwirl with stellarSwirl when an enabler is on the team', () => {
		// ⚓ CRYO ONLY (⚓ Nate, 2026-08-31) — the other three swirls are untouched
		// even with an enabler present, and cryoSwirl is untouched without one.
		expect(toReactions(rx('swirl', 'cryo'), PLAIN)).toEqual(['cryoSwirl']);
		expect(toReactions(rx('swirl', 'cryo'), STELLAR_BOTH)).toEqual(['stellarSwirl']);
		for (const of of ['pyro', 'hydro', 'electro'] as AuraKey[]) {
			expect(toReactions(rx('swirl', of), STELLAR_BOTH)).toEqual([`${of}Swirl`]);
		}
		// A Conduct-only enabler must NOT convert swirls — enablement is
		// per-reaction, so the two gates are independent.
		expect(toReactions(rx('swirl', 'cryo'), STELLAR)).toEqual(['cryoSwirl']);
		// ⚠️ A swirl off a FROZEN aura is still a cryo swirl, so it converts too.
		expect(toReactions(rx('swirl', 'frozen'), STELLAR_BOTH)).toEqual(['stellarSwirl']);
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
