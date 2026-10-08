import { describe, it, expect } from 'vitest';
import type { CharacterData } from '$lib/types/character';
import type { Condition } from '$lib/types/ability';
import {
	conditionTeamNeed,
	evalTeamNeed,
	summaryInTeam,
	type TeamMember
} from './deriveCapabilities';
import { evalCondition } from '$lib/sim/conditions';
import {
	computeHolderElementCounts,
	computeTeamFactionCounts,
	computeTeamEnabledReactions
} from '$lib/utils/teamComposition';
import { getCharacterIndexEntry } from '$lib/data/characterLookup';

/**
 * Team-aware conditions (lineups design §5, rulings §9.2).
 *
 * ⚓ PARITY: `deriveCapabilities` must stay types-only, so it cannot call the
 * parser's `evalCondition` and carries its own evaluator. This pins the two
 * together for every corpus condition whose leaves are all TEAM facts
 * (faction, element count, enabler) or constellations — the leaves both
 * sides answer definitively — over a spread of real teams. A drift in either
 * evaluator fails here.
 */
const modules = import.meta.glob<{ default: CharacterData }>('$lib/data/characters/*.json', {
	eager: true
});
const corpus = Object.values(modules).map((m) => m.default);

const TEAM_LEAVES = new Set(['teamFaction', 'teamElementCount', 'teamEnablesReaction']);
function onlyTeamLeaves(c: Condition): boolean {
	switch (c.type) {
		case 'all':
		case 'any':
			return c.conditions.every(onlyTeamLeaves);
		case 'not':
			return onlyTeamLeaves(c.condition);
		case 'constellation':
		case 'ascension':
			return true;
		default:
			return TEAM_LEAVES.has(c.type);
	}
}
function hasTeamLeaf(c: Condition): boolean {
	if (c.type === 'all' || c.type === 'any') return c.conditions.some(hasTeamLeaf);
	if (c.type === 'not') return hasTeamLeaf(c.condition);
	return TEAM_LEAVES.has(c.type);
}

/** Every condition object anywhere in a character's data. */
function conditionsOf(node: unknown, out: Condition[] = []): Condition[] {
	if (Array.isArray(node)) node.forEach((n) => conditionsOf(n, out));
	else if (node && typeof node === 'object') {
		for (const [k, v] of Object.entries(node)) {
			if (k === 'conditions' && v && typeof v === 'object' && !Array.isArray(v)) {
				out.push(v as Condition);
			}
			conditionsOf(v, out);
		}
	}
	return out;
}

// A spread of parties: Moonsign, Hexerei, Stellar/Lunar enablers, mono- and
// mixed-element, so faction counts, element counts and enablers all vary.
const TEAMS = [
	['chevreuse', 'raiden_shogun', 'xiangling', 'bennett'],
	['chevreuse', 'xingqiu', 'kaedehara_kazuha', 'bennett'],
	['ineffa', 'flins', 'aino', 'columbina'],
	['fischl', 'albedo', 'lohen', 'durin'],
	['nahida', 'raiden_shogun', 'xingqiu', 'kuki_shinobu'],
	['ganyu', 'mona', 'shenhe', 'kaedehara_kazuha'],
	['navia', 'zhongli', 'chiori', 'gorou'],
	['skirk', 'escoffier', 'furina', 'citlali']
]
	.map((ids) => ids.map((id) => getCharacterIndexEntry(id)).filter((e) => e != null))
	.filter((t) => t.length === 4);

describe('team needs agree with the parser’s evalCondition', () => {
	const cases: { char: CharacterData; cond: Condition }[] = [];
	for (const char of corpus) {
		for (const cond of conditionsOf(char)) {
			if (hasTeamLeaf(cond) && onlyTeamLeaves(cond)) cases.push({ char, cond });
		}
	}

	it('finds a real population of team-gated conditions to compare', () => {
		expect(TEAMS.length).toBe(8);
		expect(cases.length).toBeGreaterThan(40);
	});

	it('every one answers the same in every team, at C0 and C6', () => {
		const mismatches: string[] = [];
		for (const { char, cond } of cases) {
			for (const team of TEAMS) {
				const members = team.some((m) => m.id === char.id)
					? team
					: [...team.slice(0, 3), getCharacterIndexEntry(char.id)!];
				const context = {
					teamFactionCounts: computeTeamFactionCounts(members),
					teamEnabledReactions: computeTeamEnabledReactions(members),
					teamElementCounts: computeHolderElementCounts(members, char.id)
				};
				for (const con of [0, 6]) {
					const parser = evalCondition(cond, 4, new Set(), con, new Map(), undefined, context);
					const need = conditionTeamNeed(cond, char.element);
					const ours =
						typeof need === 'object' ? evalTeamNeed(need, members, char.id, con) : need !== false;
					if (parser !== ours) {
						mismatches.push(
							`${char.id} C${con} [${members.map((m) => m.id)}] ${JSON.stringify(cond)}`
						);
					}
				}
			}
		}
		expect(mismatches).toEqual([]);
	});
});

describe('lit means the team CAN make it happen (§9.2)', () => {
	const team = (...ids: string[]): TeamMember[] => ids.map((id) => getCharacterIndexEntry(id)!);

	// The measured case behind the whole design: Chevreuse's ATK buff turns off
	// in a team with a non-Pyro/Electro element, though she never moved.
	it('Chevreuse’s team ATK buff: on in overloaded, off beside Hydro or Anemo', () => {
		const atk = getCharacterIndexEntry('chevreuse')!.caps.find(
			(c) => c.kind === 'buff' && c.detail === 'atk%' && c.target === 'team'
		)!;
		expect(
			summaryInTeam(atk, team('chevreuse', 'raiden_shogun', 'xiangling', 'bennett'), 'chevreuse', 0)
		).toBe('yes');
		expect(
			summaryInTeam(
				atk,
				team('chevreuse', 'xingqiu', 'kaedehara_kazuha', 'bennett'),
				'chevreuse',
				0
			)
		).toBe('inactive');
	});

	it('a reaction-set effect needs both elements, and nothing about likelihood', () => {
		const swirl = { type: 'reaction', reaction: 'pyroSwirl' } as const;
		expect(evalTeamNeed(swirl, team('kaedehara_kazuha', 'bennett'), 'kaedehara_kazuha', 0)).toBe(
			true
		);
		expect(evalTeamNeed(swirl, team('kaedehara_kazuha', 'zhongli'), 'kaedehara_kazuha', 0)).toBe(
			false
		);
	});

	it('an enabler CONVERTS its base reaction away', () => {
		const ec = { type: 'reaction', reaction: 'electroCharged' } as const;
		expect(evalTeamNeed(ec, team('fischl', 'xingqiu'), 'fischl', 0)).toBe(true);
		expect(evalTeamNeed(ec, team('fischl', 'xingqiu', 'ineffa'), 'fischl', 0)).toBe(false);
	});

	it('runtime leaves (states, stacks, HP) are always possible — even negated', () => {
		const cond: Condition = {
			type: 'all',
			conditions: [
				{ type: 'state', state: 'nightsoulBlessing' },
				{ type: 'not', condition: { type: 'selfHpBelow', threshold: 50 } }
			]
		};
		expect(conditionTeamNeed(cond)).toBe(true);
	});

	it('an ingredient the holder supplies needs nobody else; a negated one needs nothing', () => {
		// 'free' — possible in every team, and it stays possible under `not`.
		expect(
			conditionTeamNeed({ type: 'enemyAffectedBy', element: 'cryo' } as Condition, 'cryo')
		).toBe('free');
		expect(
			conditionTeamNeed({
				type: 'not',
				condition: { type: 'enemyAffectedBy', element: 'pyro' }
			} as Condition)
		).toBe('free');
	});

	it('a receiver’s weapon holds when ANY teammate, the provider included, qualifies', () => {
		const need = conditionTeamNeed({ type: 'weaponType', weapons: ['bow'] });
		expect(typeof need).toBe('object');
		expect(evalTeamNeed(need as never, team('bennett', 'xiangling'), 'bennett', 0)).toBe(false);
		expect(evalTeamNeed(need as never, team('bennett', 'fischl'), 'bennett', 0)).toBe(true);
	});

	it('a source above the lens is LOCKED, not inactive', () => {
		const cap = {
			kind: 'buff' as const,
			minCon: 2,
			conditional: true,
			teamGated: [{ minCon: 2, need: { type: 'element' as const, element: 'hydro' as const } }]
		};
		expect(summaryInTeam(cap, team('bennett'), 'bennett', 0)).toBe('locked');
		expect(summaryInTeam(cap, team('bennett'), 'bennett', 2)).toBe('inactive');
		expect(summaryInTeam(cap, team('bennett', 'xingqiu'), 'bennett', 2)).toBe('yes');
	});
});
