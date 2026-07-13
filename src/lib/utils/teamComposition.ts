/**
 * src/lib/utils/teamComposition.ts
 *
 * Derives gameplay-relevant team composition facts from the four character slots.
 * Pure function — no side effects, no stores.
 */

import type { CharacterData } from '$lib/types/character';

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
export type CompositionFields = Pick<CharacterData, 'region' | 'factions'>;

/**
 * Derives team composition state from an array of up to 4 character data objects.
 * Slots with no character (undefined) are skipped.
 */
export function deriveTeamComposition(
	chars: (CompositionFields | null | undefined)[]
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
