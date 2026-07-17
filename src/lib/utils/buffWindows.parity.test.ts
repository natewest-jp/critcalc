/**
 * buffWindows.parity.test.ts — TEMPORARY corpus equivalence proof (post-P4
 * #5, phases 4–5). Asserts the parser-side buff-window projections
 * (`projectTeamBuffRows` / `projectCharReceivedBuffRows`) reproduce the
 * legacy renderer-side derivations (`computeTeamBuffRows` /
 * `computeCharReceivedBuffRows`) byte-for-byte — rows, bars, display
 * strings, row order, and row keys — across the full roster plus
 * multi-character / loadout / constellation scenarios.
 *
 * Deleted in phase 6 once the flip has landed and the legacy
 * implementations are removed (the house byte-parity-before-flip pattern:
 * the inputBlocks projection and NB parity oracle followed the same arc).
 */

import { describe, it, expect } from 'vitest';
import { parseNotation } from './notationParser';
import type { CastEvent, ReactionEvent } from './notationParser';
import { computeTeamBuffRows, projectTeamBuffRows } from '$lib/timeline/teamBuffRows';
import {
	computeCharReceivedBuffRows,
	projectCharReceivedBuffRows
} from '$lib/timeline/charReceivedBuffRows';
import { computeNBBars } from '$lib/timeline/nbRows';
import { computeTeamFactionCounts } from '$lib/utils/teamComposition';
import type { CharacterData } from '$lib/types/character';
import type { Element } from '$lib/types/ability';
import type { LoadoutEntry } from '$lib/stores';

const modules = import.meta.glob('../data/characters/*.json', { eager: true });
const all: CharacterData[] = Object.values(modules).map(
	(m) => (m as { default: CharacterData }).default
);
const byDisplayName = new Map(all.map((c) => [c.displayName, c]));
const byId = new Map(all.map((c) => [c.id, c]));

/** Same richer-notation builder as the roster sweep (declared skill tokens +
 *  normals/charged/plunge/burst + re-cast + declared short-burst tokens). */
const SKILL_TOKENS = ['E', 'tE', 'pE', 'hE', 'h1E', 'h2E'] as const;
function declaredSkillTokens(c: CharacterData): string[] {
	const toks = new Set<string>();
	for (const a of c.abilities) {
		if (a.abilityType !== 'skill') continue;
		for (const t of a.input ?? []) toks.add(t);
		for (const v of a.variants ?? []) for (const t of v.input ?? []) toks.add(t);
	}
	const ordered = SKILL_TOKENS.filter((t) => toks.has(t));
	return ordered.length ? ordered : ['E'];
}
function declaredExtraBurstTokens(c: CharacterData): string[] {
	const toks = new Set<string>();
	for (const a of c.abilities) {
		if (a.abilityType !== 'burst') continue;
		for (const v of a.variants ?? []) for (const t of v.input ?? []) toks.add(t);
	}
	toks.delete('Q');
	return [...toks].sort();
}
function rosterNotation(c: CharacterData): string {
	const skills = declaredSkillTokens(c);
	return [
		c.displayName,
		...skills,
		'N1',
		'N2',
		'N3',
		'C',
		'P',
		'Q',
		skills[0],
		...declaredExtraBurstTokens(c)
	].join(' ');
}

/** Parses with the slot roster wired through, rebuilds the renderer-side
 *  context exactly as RotationTimeline does, and asserts both surfaces'
 *  projections deep-equal the legacy computations (including row order +
 *  team-row keys). */
function assertParity(
	notation: string,
	team: CharacterData[],
	constellations: Record<string, number> = {},
	loadout: Record<string, LoadoutEntry> = {}
): void {
	const lookup = (name: string): CharacterData | null => byDisplayName.get(name) ?? null;
	const rotation = parseNotation(notation, lookup, 8, constellations, loadout, team);

	// Renderer-context reconstruction (mirrors RotationTimeline.svelte).
	const teamFactionCounts = new Map(computeTeamFactionCounts(team));
	const teamElementCountsByHolder = new Map<string, Map<Element, number>>();
	for (const holder of team) {
		const counts = new Map<Element, number>();
		for (const other of team) {
			if (other.id === holder.id) continue;
			if (!other.element) continue;
			counts.set(other.element, (counts.get(other.element) ?? 0) + 1);
		}
		teamElementCountsByHolder.set(holder.id, counts);
	}
	const nbBars = computeNBBars(rotation.events);
	const castEvents = rotation.events.filter((e): e is CastEvent => e.kind === 'cast');
	const reactionEvents = rotation.events.filter((e): e is ReactionEvent => e.kind === 'reaction');
	const getCharacter = (id: string): CharacterData | null => byId.get(id) ?? null;

	const legacyTeam = computeTeamBuffRows(
		rotation.tracks,
		constellations,
		loadout,
		teamFactionCounts,
		teamElementCountsByHolder,
		nbBars,
		castEvents,
		reactionEvents,
		rotation.windows,
		getCharacter
	);
	const projectedTeam = projectTeamBuffRows(rotation.windows, getCharacter);
	expect(
		projectedTeam.map((r) => r.key),
		`team row keys+order (${notation})`
	).toEqual(legacyTeam.map((r) => r.key));
	expect(projectedTeam, `team rows (${notation})`).toEqual(legacyTeam);

	const legacyReceived = computeCharReceivedBuffRows(
		rotation.tracks,
		constellations,
		loadout,
		teamFactionCounts,
		teamElementCountsByHolder,
		nbBars,
		castEvents,
		getCharacter
	);
	const projectedReceived = projectCharReceivedBuffRows(rotation.windows, getCharacter);
	expect(
		projectedReceived.map((r) => `${r.characterId}::${r.sourceLabel}`),
		`received row keys+order (${notation})`
	).toEqual(legacyReceived.map((r) => `${r.characterId}::${r.sourceLabel}`));
	expect(projectedReceived, `received rows (${notation})`).toEqual(legacyReceived);
}

describe('buff-window projection parity — full roster (single-character)', () => {
	for (const c of all) {
		it(`${c.id}`, () => {
			assertParity(rosterNotation(c), [c]);
		});
	}
});

describe('buff-window projection parity — constellation sweep (roster @ C6)', () => {
	for (const c of all) {
		it(`${c.id} @ C6`, () => {
			assertParity(rosterNotation(c), [c], { [c.id]: 6 });
		});
	}
});

describe('buff-window projection parity — multi-character scenarios', () => {
	const pick = (name: string): CharacterData => {
		const c = byDisplayName.get(name);
		if (!c) throw new Error(`fixture character missing: ${name}`);
		return c;
	};

	it('Bennett/Hu Tao — active-target slicing + stance + afterDuration', () => {
		const team = [pick('Bennett'), pick('Hu Tao')];
		assertParity('Bennett E Q > Hu Tao E N1 N2 C Q > Bennett E Q', team);
	});

	it('Furina/Kazuha — reactions + swirl onReaction buffs + plunge', () => {
		const team = [pick('Furina'), pick('Kazuha')];
		assertParity('Furina E Q > Kazuha hE P Q > Furina E', team);
	});

	it('Chevreuse/Fischl — dual-element resShred onReaction (each_key regression shape)', () => {
		const team = [pick('Chevreuse'), pick('Fischl')];
		assertParity('Fischl E > Chevreuse E Q > Fischl Q E', team);
	});

	it('Mavuika/Xilonen — Natlan NB team + self dispatches', () => {
		const team = [pick('Mavuika'), pick('Xilonen')];
		assertParity('Mavuika E Q > Xilonen E N1 N2 Q > Mavuika hE', team);
	});

	it('Yanfei — auto-tracked seals + A1 onHit charged (C0 and C6)', () => {
		const team = [pick('Yanfei')];
		assertParity('Yanfei N1 N2 N3 C E Q C N1 C', team);
		assertParity('Yanfei N1 N2 N3 C E Q C N1 C', team, { yanfei: 6 });
	});

	it('Flins/Linnea — Moonsign faction gating + stance normals + sQ', () => {
		const team = [pick('Flins'), pick('Linnea')];
		assertParity('Flins E N1 N2 Q E sQ > Linnea E Q', team, { flins: 2 });
	});

	it('Skirk — stacks/drain + in-stance routing', () => {
		const team = [pick('Skirk')];
		assertParity('Skirk hE N1 N2 N3 E Q N1 N2', team, { skirk: 6 });
	});

	it('Durin — dual-form state-gated abilities', () => {
		const team = [pick('Durin')];
		assertParity('Durin E N1 Q E E Q', team);
	});

	it('weapon swap procs + artifact sets (TTDS out, Widsith in, Noblesse/VV)', () => {
		const team = [pick('Bennett'), pick('Xiangling'), pick('Kazuha')];
		const loadout: Record<string, LoadoutEntry> = {
			bennett: {
				weaponId: 'thrilling_tales_of_dragon_slayers',
				weaponRefinement: 5,
				artifactSetId: 'noblesse_oblige'
			},
			xiangling: { weaponId: 'the_widsith', weaponRefinement: 1 },
			kaedehara_kazuha: { artifactSetId: 'viridescent_venerer' }
		};
		assertParity(
			'Bennett E Q > Xiangling E Q > Kazuha hE Q > Bennett E > Xiangling E',
			team,
			{},
			loadout
		);
	});

	it('repeated-segment character — char-scoped pools fire once (NB/onReaction guard)', () => {
		const team = [pick('Mavuika'), pick('Fischl')];
		assertParity('Mavuika E > Fischl E > Mavuika Q > Fischl Q > Mavuika E', team);
	});

	it('slot roster wider than the notation — team context from slots', () => {
		const team = [pick('Bennett'), pick('Mavuika'), pick('Xilonen')];
		// Only Bennett is typed; the Natlan slots still enable the NB clock.
		assertParity('Bennett E Q E', team);
	});
});
