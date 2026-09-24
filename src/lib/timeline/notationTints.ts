/**
 * The notation box's colours, read off the parse — so a token wears what the
 * CHART resolved for it (⚓ Nate 2026-09-24, notation-follows-chart).
 *
 * The editor used to guess from the text alone (the caster's element plus the
 * weapon rule in `resolveActionElement`), which cannot see anything the parse
 * decides: a stance or granted infusion, a party-resolved element (Varka), a
 * swing that lands no hit (Lauma's deer). Every IR cast/action event now
 * carries the source range of the token that produced it (`src`), so the
 * answer is a projection of what the chart already draws.
 *
 * ⚓ ONE TOKEN, ONE COLOUR: THE FIRST EVENT'S (⚓ Nate). `N5` is five swings and
 * `3[N1 C]` repeats its inner tokens; when the element changes mid-token (a
 * granted infusion lapsing) the chart splits the block but a token has one
 * colour, and the first swing is where the block starts on the chart.
 * ⚓ E/Q FOLLOW THE PILL EXACTLY — the stance's landed element for a stance
 * opener, else the first hit's, else the caster's (`finalize` step 1b is the
 * rule being mirrored; keep the two in step).
 *
 * `element: null` is a positive answer — the token landed physical or no hit —
 * and must CLEAR the editor's guess, not fall back to it.
 */

import type { Element } from '$lib/types/ability';
import type { ParsedRotation } from '$lib/sim/types';

export type NotationTint = { from: number; to: number; element: Element | null };

export function notationTints(rotation: ParsedRotation): NotationTint[] {
	const casterElement = new Map<string, Element>();
	for (const t of rotation.tracks) casterElement.set(t.characterId, t.element as Element);

	// Events are time-sorted, so the first event seen for a range is its first
	// swing / first repeat.
	const seen = new Set<string>();
	const out: NotationTint[] = [];
	for (const ev of rotation.events) {
		if (ev.kind !== 'cast' && ev.kind !== 'action') continue;
		if (!ev.src) continue;
		const key = `${ev.src.from}:${ev.src.to}`;
		if (seen.has(key)) continue;
		seen.add(key);
		const element =
			ev.kind === 'cast'
				? (ev.stanceElement ?? ev.element ?? casterElement.get(ev.characterId) ?? null)
				: (ev.element ?? null);
		out.push({ from: ev.src.from, to: ev.src.to, element });
	}
	return out;
}
