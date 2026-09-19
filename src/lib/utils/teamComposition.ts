/**
 * src/lib/utils/teamComposition.ts
 *
 * Derives gameplay-relevant team composition facts from the four character slots.
 * Pure function — no side effects, no stores.
 */

import type { CharacterData } from '$lib/types/character';
import type { Element } from '$lib/types/ability';

export type TeamComposition = {
	/** Number of Natlan characters in the team (triggers NB lane). */
	natlanCount: number;
	/** Number of Moonsign characters in the team. */
	moonsignCount: number;
	/** Number of Hexerei characters in the team. */
	hexereiCount: number;
	/** Slot indices (0–3) of non-blank, non-Moonsign characters (used for Moonsign lane rows). */
	nonMoonsignSlots: number[];
	/** True when ≥2 Moonsign characters are in the team (Ascendant Gleam is active). */
	hasAscendantGleam: boolean;
	/** True when ≥2 Hexerei characters are in the team (Secret Rite is active). */
	hasSecretRite: boolean;
};

/** The fields composition actually reads — index entries qualify too, so
 *  consumers with only the eager index (Team Builder) skip payload loads. */
export type CompositionFields = Pick<
	CharacterData,
	'region' | 'factions' | 'factionContributions' | 'enablesReactions'
>;

/**
 * Reactions the party's members ENABLE (the Stellar model — one enabler
 * converts the base reaction party-wide; see `CharacterData.enablesReactions`).
 * Feeds `teamEnablesReaction` condition evaluation and the parser's
 * superConduct → stellarConduct emission conversion. Pure.
 */
export function computeTeamEnabledReactions(
	chars: (CompositionFields | null | undefined)[]
): Set<string> {
	const enabled = new Set<string>();
	for (const c of chars) {
		if (!c) continue;
		for (const r of c.enablesReactions ?? []) enabled.add(r);
	}
	return enabled;
}

/**
 * Party faction *level* per faction key = Σ members (each faction membership is
 * +1) + Σ `factionContributions`. This is what `teamFaction {faction, min}`
 * conditions gate against, so a benediction that raises a party level beyond the
 * holder's own presence (via `factionContributions`) counts. Pure — feeds the
 * planner's `teamFactionCounts` context.
 */
export function computeTeamFactionCounts(
	chars: (CompositionFields | null | undefined)[]
): Map<string, number> {
	const counts = new Map<string, number>();
	for (const c of chars) {
		if (!c) continue;
		for (const f of c.factions ?? []) {
			counts.set(f, (counts.get(f) ?? 0) + 1);
		}
		for (const [faction, amount] of Object.entries(c.factionContributions ?? {})) {
			counts.set(faction, (counts.get(faction) ?? 0) + amount);
		}
	}
	return counts;
}

/**
 * Per-element member count for ONE holder's `teamElementCount` conditions —
 * the HOLDER EXCLUDED, which is the convention every such condition in the
 * corpus is written against ("2 Anemo characters" on an Anemo holder is
 * `anemo >= 1`). ⚓ The one loop (2026-09-19): the parser keys it per holder
 * over the roster, and the always-on chip evaluates a passive's party gates
 * against the slotted team through the same function.
 */
export function computeHolderElementCounts(
	chars: (Pick<CharacterData, 'id' | 'element'> | null | undefined)[],
	holderId: string
): Map<Element, number> {
	const counts = new Map<Element, number>();
	for (const other of chars) {
		if (!other || other.id === holderId || !other.element) continue;
		counts.set(other.element, (counts.get(other.element) ?? 0) + 1);
	}
	return counts;
}

/**
 * Derives team composition state from an array of up to 4 character data objects.
 * Slots with no character (undefined) are skipped.
 */
export function deriveTeamComposition(
	// readonly: a pure derivation has no business demanding a mutable array,
	// and its sibling deriveCoverage already takes one.
	chars: readonly (CompositionFields | null | undefined)[]
): TeamComposition {
	let natlanCount = 0;
	let moonsignCount = 0;
	let hexereiCount = 0;
	const nonMoonsignSlots: number[] = [];

	for (let i = 0; i < chars.length; i++) {
		const c = chars[i];
		if (!c) continue;

		const factions = c.factions ?? [];

		// TODO: data gap — region field used as proxy for Natlan detection until
		// factions are populated by the curation pass.
		if (c.region === 'Natlan') natlanCount++;

		if (factions.includes('moonsign')) {
			moonsignCount++;
		} else {
			nonMoonsignSlots.push(i);
		}

		if (factions.includes('hexerei')) hexereiCount++;
	}

	return {
		natlanCount,
		moonsignCount,
		hexereiCount,
		nonMoonsignSlots,
		hasAscendantGleam: moonsignCount >= 2,
		hasSecretRite: hexereiCount >= 2
	};
}
