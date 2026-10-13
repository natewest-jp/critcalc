/**
 * A team's reactions as a player reads them — ONE entry per element PAIR,
 * named by family ("Vaporize", "Quicken"), with a converted reaction keeping
 * its own name ("Stellar Swirl" beside a plain Swirl must not read as two
 * Swirls). Three-element reactions (Burgeon, Hyperbloom) are implied by their
 * Bloom pair and get no entry.
 *
 * Shared by `CompositionChips` (the chips) and the Team Builder's swap mode
 * (what a swap adds and loses), so the two can never name a reaction apart.
 */
import {
	REACTION_INGREDIENTS,
	teamReactions,
	type TeamMember
} from '$lib/capabilities/deriveCapabilities';
import { REACTION_FAMILY, REACTION_LABEL } from '$lib/utils/auraDisplay';
import type { Reaction } from '$lib/types/ability';

export type ReactionPair = {
	/** The pair's two elements, in the reaction table's order. */
	a: string;
	b: string;
	label: string;
	/** Every reaction the pair makes, for a hover. */
	title: string;
};

export function reactionPairs(members: readonly TeamMember[]): ReactionPair[] {
	// A plain object, not a Map: a pure fold, nothing here is state.
	const byPair: Record<string, Reaction[]> = {};
	for (const r of teamReactions(members)) {
		const groups = REACTION_INGREDIENTS[r].elements;
		if (groups.length !== 2) continue;
		const key = `${groups[0][0]}|${groups[1][0]}`;
		(byPair[key] ??= []).push(r);
	}
	return Object.entries(byPair).map(([key, rs]) => {
		const [a, b] = key.split('|');
		const lead = rs[0];
		return {
			a,
			b,
			label: REACTION_INGREDIENTS[lead].enabler ? REACTION_LABEL[lead] : REACTION_FAMILY[lead],
			title: rs.map((r) => REACTION_LABEL[r]).join(' · ')
		};
	});
}
