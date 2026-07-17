import { describe, it, expect } from 'vitest';
import { computeNBBars, type NBBar } from './nbRows';
import { parseNotation } from '$lib/utils/notationParser';
import type { TimelineEvent } from '$lib/utils/notationParser';
import type { CharacterData } from '$lib/types/character';
import type { Ability } from '$lib/types/ability';

// NB derivation moved PARSER-side (post-P4 #5 arc, phase 3): parseNotation
// emits `nightsoulBurst` events; computeNBBars is a pure projection. These
// tests drive the real parser with Natlan/catalyst fixtures and assert the
// projected lane; a test-local copy of the LEGACY renderer-side derivation
// proves the port is behavior-identical over the same event streams.

const mkChar = (
	id: string,
	name: string,
	opts: { region?: string; weapon?: string } = {}
): CharacterData =>
	({
		id,
		name,
		displayName: name,
		element: 'pyro',
		weapon: opts.weapon ?? 'sword',
		gender: 'Female',
		affiliation: 'Test',
		region: opts.region ?? 'Test',
		rarity: 5,
		abilities: [
			{
				id: `${id}__normal__attack`,
				name: 'Attack',
				input: ['N'],
				abilityType: 'normal',
				hits: [
					{ frames: { swap: 20, N: 20, E: 20 } },
					{ frames: { swap: 20, N: 20, E: 20 } },
					{ frames: { swap: 20, N: 20, E: 20 } }
				]
			} as unknown as Ability,
			{
				id: `${id}__skill__cast`,
				name: 'Skill',
				input: ['E'],
				abilityType: 'skill',
				behavior: 'instant',
				frames: { swap: 30 },
				cooldown: 6
			} as unknown as Ability,
			{
				id: `${id}__burst__cast`,
				name: 'Burst',
				input: ['Q'],
				abilityType: 'burst',
				behavior: 'instant',
				frames: { swap: 30 },
				cooldown: 15,
				energyCost: 60
			} as unknown as Ability
		],
		passives: [],
		constellations: []
	}) as unknown as CharacterData;

const natSword = mkChar('natsword', 'NatSword', { region: 'Natlan' });
const natCat = mkChar('natcat', 'NatCat', { region: 'Natlan', weapon: 'catalyst' });
const natThird = mkChar('natthird', 'NatThird', { region: 'Natlan' });
const plain = mkChar('plain', 'Plain');

const lookup = (n: string): CharacterData | null =>
	({ NatSword: natSword, NatCat: natCat, NatThird: natThird, Plain: plain })[n] ?? null;

/** The pre-phase-3 renderer-side derivation, verbatim — the parity oracle. */
function legacyComputeNBBars(
	events: TimelineEvent[],
	catalystIds: Set<string>,
	natlanCount: number
): NBBar[] {
	if (natlanCount === 0) return [];
	const cd = natlanCount >= 3 ? 9 : natlanCount === 2 ? 12 : 18;
	const triggers: number[] = [];
	for (const ev of events) {
		if (ev.kind === 'cast') {
			triggers.push(ev.time);
		} else if (
			ev.kind === 'action' &&
			ev.id === ev.blockId &&
			ev.action !== 'dash' &&
			ev.action !== 'jump' &&
			ev.action !== 'unset' &&
			catalystIds.has(ev.characterId)
		) {
			triggers.push(ev.time);
		}
	}
	triggers.sort((a, b) => a - b);
	const result: NBBar[] = [];
	let nextAllowed = -Infinity;
	for (const t of triggers) {
		if (t >= nextAllowed) {
			result.push({ start: t, cooldown: cd });
			nextAllowed = t + cd;
		}
	}
	return result;
}

/** Runs a notation through the parser and checks projection ≡ legacy oracle. */
function parseAndCompare(notation: string, team?: (CharacterData | null)[]): NBBar[] {
	const rotation = parseNotation(notation, lookup, 8, undefined, undefined, team);
	const effectiveTeam = team
		? team.filter((c): c is CharacterData => c != null)
		: // Notation-derived fallback: unique typed characters.
			[
				...new Map(
					rotation.tracks.map((t) => [t.characterId, lookup(t.displayName)!] as const)
				).values()
			];
	const natlanCount = effectiveTeam.filter((c) => c.region === 'Natlan').length;
	const catalystIds = new Set(
		effectiveTeam.filter((c) => c.weapon === 'catalyst').map((c) => c.id)
	);
	const projected = computeNBBars(rotation.events);
	expect(projected).toEqual(legacyComputeNBBars(rotation.events, catalystIds, natlanCount));
	return projected;
}

describe('computeNBBars (projection of parser NB events)', () => {
	it('emits nothing for a Natlan-free team', () => {
		const bars = parseAndCompare('Plain E Q');
		expect(bars).toEqual([]);
	});

	it('casts fire the NB clock; in-cooldown casts are suppressed (18s @ 1 Natlan)', () => {
		const bars = parseAndCompare('NatSword E Q');
		expect(bars.length).toBe(1);
		expect(bars[0]).toEqual({ start: 0, cooldown: 18 });
	});

	it('catalyst input-token anchors trigger; movement does not; per-block cadence holds', () => {
		// N3 anchor at t=0 fires; the follow-up swings and the D are not
		// triggers; the E lands inside the 18s window and is suppressed.
		const bars = parseAndCompare('NatCat N3 D E');
		expect(bars).toEqual([{ start: 0, cooldown: 18 }]);
	});

	it('non-catalyst normals never trigger', () => {
		// Sword normals are not NB triggers: only the E cast (after the N3
		// swing time) fires the clock.
		const bars = parseAndCompare('NatSword N3 E');
		expect(bars.length).toBe(1);
		expect(bars[0].start).toBeGreaterThan(0);
	});

	it('cooldown scales 18/12/9 with the Natlan count from the slot roster', () => {
		const one = parseAndCompare('NatSword E', [natSword]);
		const two = parseAndCompare('NatSword E', [natSword, natCat]);
		const three = parseAndCompare('NatSword E', [natSword, natCat, natThird, null]);
		expect(one[0].cooldown).toBe(18);
		expect(two[0].cooldown).toBe(12);
		expect(three[0].cooldown).toBe(9);
	});

	it('slot roster supplies Natlan membership even when never typed in the notation', () => {
		// A non-Natlan character's casts still fire the team NB clock as long
		// as a slot holds a Natlan unit.
		const bars = parseAndCompare('Plain E', [plain, natSword]);
		expect(bars).toEqual([{ start: 0, cooldown: 18 }]);
	});

	it('without a slot roster, team context falls back to the notation-derived team', () => {
		const bars = parseAndCompare('Plain E > NatSword E');
		expect(bars.length).toBe(1);
		expect(bars[0]).toEqual({ start: 0, cooldown: 18 });
	});
});
