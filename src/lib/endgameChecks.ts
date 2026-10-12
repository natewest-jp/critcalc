/**
 * src/lib/endgameChecks.ts
 *
 * A battlefield's checks, checked against a TEAM (lineups design §2.6; Nate
 * 2026-10-09). The game words each check as alternatives ("{Hydro+Electro}
 * reactions | {Electro} characters"); this reads the ENGLISH wording and
 * answers what team data can decide:
 *
 *   met      — the team does it (a favoured check gets ✓; a disfavoured one ⚠)
 *   unmet    — it cannot
 *   unknown  — we have no rule we trust ("Multi Elemental DMG", "High-
 *              frequency DMG"…). ⚓ Shown, never marked — ⛔ never guessed.
 *
 * Alternatives: met if ANY is met; else unknown if any is unknown; else unmet.
 * "A reaction" means the team's elements can make it (§9.2's "can happen",
 * enablers and conversions applied — `teamReactions`); "an X character" means
 * a member of element X; "shield / healing characters" means the fingerprint
 * slot is LIT for someone.
 *
 * ⚓ Nate's rulings on the rest (2026-10-12):
 *   · Nightsoul — "Nightsoul's Blessing Characters" and "Nightsoul-aligned
 *     DMG" are met by any Nightsoul user: every Natlan character, and the
 *     Pyro Traveler.
 *   · Crowd control (two spellings) — a GROUPING provider is met; anything
 *     else stays unknown (knockback, freeze and launch have no data).
 *   · "Bond of Life Characters" — Arlecchino and Clorinde, a hand-kept list
 *     (Nate: new Bond of Life characters are unlikely).
 *   · Unknown on purpose: the frequency checks (how often a team hits),
 *     "Plunging-Attack Characters", and both "Single" and "Multi Elemental
 *     DMG" (↻ same day: a member's element is not the element they DEAL —
 *     an Anemo teammate infused into Pyro, a buffer who barely hits — so the
 *     members' elements answer neither).
 */

import { REACTION_INGREDIENTS, teamReactions } from '$lib/capabilities/deriveCapabilities';
import { getCharacterIndexEntry } from '$lib/data/characterLookup';
import type { CharacterIndexEntry } from '$lib/types/character';
import { deriveTeamComposition } from '$lib/utils/teamComposition';
import { checkAlternatives, SPRITES, type BattlefieldCheck } from './endgame';
import { memberState } from './fingerprint';
import type { FacetKey } from '$lib/capabilities/deriveCapabilities';

export type CheckVerdict = 'met' | 'unmet' | 'unknown';

type Facts = {
	ids: string[];
	/** Index entries (a TeamMember, plus the region the Nightsoul check reads). */
	members: CharacterIndexEntry[];
	reactions: string[];
	conOf: (id: string) => number;
};

const MELEE = ['sword', 'claymore', 'polearm'];
/** ⚓ Nate 2026-10-12: Arlecchino and Clorinde only. */
const BOND_OF_LIFE = ['arlecchino', 'clorinde'];
/** Nightsoul users outside Natlan's roster. */
const NIGHTSOUL_ELSEWHERE = ['traveler_pyro'];
const RANGED = ['bow', 'catalyst'];

function lit(f: Facts, facet: FacetKey): boolean {
	return f.ids.some((id) => memberState(id, facet, f.members, f.conOf(id)) === 'lit');
}

/** Can the team make a reaction between exactly these two elements? */
function reactsBetween(f: Facts, pair: string[]): boolean {
	return f.reactions.some((r) => {
		const groups = REACTION_INGREDIENTS[r as keyof typeof REACTION_INGREDIENTS]?.elements;
		return groups?.length === 2 && pair.every((el) => groups.some((g) => g.includes(el as never)));
	});
}

/** One alternative, from its parts. */
function alternative(f: Facts, parts: ReturnType<typeof checkAlternatives>[number]): CheckVerdict {
	const sprites = parts.flatMap((p) => ('sprite' in p ? [SPRITES[p.sprite]?.elements ?? []] : []));
	const text = parts
		.flatMap((p) => ('text' in p ? [p.text] : []))
		.join(' ')
		.toLowerCase();
	const yes = (b: boolean): CheckVerdict => (b ? 'met' : 'unmet');

	if (text.includes('reaction') && sprites.length) {
		// A pair icon names its two elements; a lone element icon, any reaction
		// it takes part in.
		return yes(
			sprites.some((els) =>
				els.length === 2
					? reactsBetween(f, els)
					: f.reactions.some((r) =>
							REACTION_INGREDIENTS[r as keyof typeof REACTION_INGREDIENTS]?.elements.some((g) =>
								g.includes(els[0] as never)
							)
						)
			)
		);
	}
	if (text.includes('character') && sprites.length) {
		const els = sprites.flat();
		return yes(f.members.some((m) => els.includes(m.element ?? '')));
	}
	if (text.startsWith('lunar reaction')) return yes(f.reactions.some((r) => r.startsWith('lunar')));
	if (text.startsWith('stellar glimmer'))
		return yes(f.members.some((m) => m.enablesReactions?.some((r) => r.startsWith('stellar'))));
	if (text.startsWith('moonsign: ascendant gleam'))
		return yes(
			deriveTeamComposition(f.ids.map((id) => getCharacterIndexEntry(id))).hasAscendantGleam
		);
	if (text === 'shields' || text.startsWith('shield character')) return yes(lit(f, 'shield'));
	if (text.startsWith('healing character')) return yes(lit(f, 'heal'));
	if (text.startsWith('melee character'))
		return yes(f.members.some((m) => MELEE.includes(m.weapon ?? '')));
	if (text.startsWith('ranged character'))
		return yes(f.members.some((m) => RANGED.includes(m.weapon ?? '')));
	if (text.startsWith('bow character')) return yes(f.members.some((m) => m.weapon === 'bow'));
	if (text.startsWith('nightsoul'))
		return yes(f.members.some((m) => m.region === 'Natlan' || NIGHTSOUL_ELSEWHERE.includes(m.id)));
	if (/^crowd[- ]control character/.test(text)) return lit(f, 'grouping') ? 'met' : 'unknown';
	if (text.startsWith('bond of life character'))
		return yes(f.members.some((m) => BOND_OF_LIFE.includes(m.id)));
	return 'unknown';
}

/** A check against a team. `ids`: its members; `conOf`: each one's level. */
export function evaluateCheck(
	check: BattlefieldCheck,
	ids: readonly string[],
	conOf: (id: string) => number
): { verdict: CheckVerdict; alternatives: CheckVerdict[] } {
	const members = ids.map((id) => getCharacterIndexEntry(id)).filter((e) => e !== null);
	const facts: Facts = { ids: [...ids], members, reactions: teamReactions(members), conOf };
	const alternatives = checkAlternatives(check.text.en).map((alt) => alternative(facts, alt));
	const verdict: CheckVerdict = alternatives.includes('met')
		? 'met'
		: alternatives.includes('unknown')
			? 'unknown'
			: 'unmet';
	return { verdict, alternatives };
}
