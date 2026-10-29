/**
 * src/lib/timeline/slotCaveats.ts
 *
 * THE NOTES COLUMN'S CONTENT — every player-facing `caveat` carried by the kits
 * currently in the four slots, grouped by character.
 *
 * A pure ROSTER projection (the other modules in here project the parser IR;
 * this one needs no rotation at all — a caveat is true of a kit, not of a run).
 * It lives outside the components because two of them need the same answer at
 * different times: the aside column renders these entries, and band B's Notes
 * button has to know whether there are any BEFORE the column exists to say so.
 * Computed once by the planner page, published to plannerView, handed down.
 */

import type { CharacterData } from '$lib/types/character';
import type { Element } from '$lib/types/ability';
import { effectSourcesAtConstellation } from '$lib/utils/effectCollection';

export type SlotCaveat = {
	/** "Skill" · "Burst" · "Passive" · "C4" — the ability's short kind label. */
	kind: string;
	name: string;
	caveat: string;
};

export type SlotCaveatEntry = {
	id: string;
	displayName: string;
	element: Element | undefined;
	caveats: SlotCaveat[];
};

/**
 * Collect the caveats of the given (possibly not-yet-loaded, possibly repeated)
 * slot characters. Duplicate slots are listed once — the same kit twice is one
 * set of notes — and characters with nothing to annotate are dropped entirely,
 * so an empty result means the Notes button has nothing to open.
 *
 * `constellationLevels` is the EFFECTIVE map (the tab's Layer-2 override over
 * the roster's Layer-1 default), so a locked constellation's caveat is not
 * shown. Defaults to C0 for every character when omitted.
 */
export function collectSlotCaveats(
	slotCharacters: readonly (CharacterData | null)[],
	constellationLevels: Readonly<Record<string, number>> = {}
): SlotCaveatEntry[] {
	const seen = new Set<string>();
	const entries: SlotCaveatEntry[] = [];

	for (const char of slotCharacters) {
		if (!char || seen.has(char.id)) continue;
		seen.add(char.id);

		// ⚓ A CONSTELLATION'S CAVEAT IS GATED BY ITS ENTRY (2026-08-18). This is
		// the non-buff half of the same defect — a C6's note used to sit in the
		// Notes panel of a C0 rotation, describing a kit the reader does not
		// have. See docs/rounds/constellation-gating-plan.md.
		const caveats = effectSourcesAtConstellation(char, constellationLevels[char.id] ?? 0)
			.filter((a) => a.caveat)
			.map((a) => ({
				name: a.name,
				caveat: a.caveat!,
				kind:
					a.abilityType === 'constellation'
						? `C${a.constellationLevel}`
						: a.abilityType.charAt(0).toUpperCase() + a.abilityType.slice(1)
			}));

		if (caveats.length > 0) {
			entries.push({
				id: char.id,
				displayName: char.displayName,
				element: char.element,
				caveats
			});
		}
	}

	return entries;
}
