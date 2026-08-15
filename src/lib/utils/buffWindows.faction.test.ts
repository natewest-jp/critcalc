/**
 * buffWindows.faction.test.ts — the invariants the faction-bonus wiring rests
 * on (2026-08-15, docs/faction-bonuses-round.md).
 *
 * `factionBonuses` effects reach the planner's candidate pools as of this
 * round. Two things must hold for that to be safe, and neither is visible from
 * reading a single window:
 *
 *   1. NO POOL MIXES SOURCES. A pool becomes one window — one span, one row,
 *      one label — so an ability effect and a Secret Rite effect sharing a pool
 *      means one of them is drawn under the other's name and, because the span
 *      comes from `effects[0].duration`, very likely with the other's duration
 *      too. That is exactly the bug the first cut of this round shipped
 *      (Sucrose's 8s A4 stretched to the Rite's 15s), so it is guarded here
 *      rather than left to review.
 *
 *   2. A FACTION WINDOW IS LABELLED AS ONE. If provenance survives collection
 *      but the window still carries `source.type === 'character'`, the bar
 *      renders correctly timed under the wrong name — the failure mode that is
 *      hardest to notice by eye.
 *
 * Corpus-wide rather than fixture-based: the point is to catch a NEW faction
 * bonus authored on a trigger no existing one uses.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseNotation } from './notationParser';
import { factionProvenanceOf } from './effectCollection';
import type { CharacterData } from '$lib/types/character';

const DIR = 'src/lib/data/characters';
const load = (file: string): CharacterData =>
	JSON.parse(readFileSync(join(DIR, file), 'utf8')) as CharacterData;

const ALL: CharacterData[] = readdirSync(DIR)
	.filter((f) => f.endsWith('.json'))
	.map(load);

/** Characters that author at least one faction effect — the only ones that can
 *  produce a faction window at all. */
const WITH_FACTION_EFFECTS = ALL.filter((c) =>
	(c.factionBonuses ?? []).some((fb) => (fb.effects ?? []).length > 0)
);

/** A party that satisfies every `teamFaction … min: 2` gate the corpus uses:
 *  the holder plus three teammates sharing its faction. Without this the
 *  conditions evaluate false and nothing is emitted — a green test that proves
 *  nothing. */
function partyFor(holder: CharacterData): CharacterData[] {
	const faction = (holder.factionBonuses ?? [])[0]?.faction;
	const mates = ALL.filter((c) => c.id !== holder.id && (c.factions ?? []).includes(faction)).slice(
		0,
		3
	);
	return [holder, ...mates];
}

function windowsFor(holder: CharacterData) {
	const party = partyFor(holder);
	const byName = new Map(party.map((c) => [c.displayName, c]));
	// Every trigger family a faction effect could ride: both casts, a normal
	// string (per-swing onHit), and a swirl-producing sequence for onReaction.
	const notation = party.map((c) => `${c.displayName} E N4 Q N4`).join(' > ');
	const rot = parseNotation(
		notation,
		(n: string) => byName.get(n) ?? null,
		8,
		Object.fromEntries(party.map((c) => [c.id, 6])),
		{},
		party
	);
	return rot.windows.filter((w) => w.kind === 'buff');
}

describe('faction bonuses reach the planner', () => {
	it('every character authoring faction effects is exercised by a valid party', () => {
		// Guards the guard: if the party builder stopped satisfying the count
		// gates, every assertion below would pass vacuously.
		expect(WITH_FACTION_EFFECTS.length).toBeGreaterThan(0);
		for (const holder of WITH_FACTION_EFFECTS) {
			expect(partyFor(holder).length, holder.id).toBeGreaterThanOrEqual(2);
		}
	});

	it('no buff window mixes faction and non-faction effects', () => {
		for (const holder of WITH_FACTION_EFFECTS) {
			for (const w of windowsFor(holder)) {
				const provs = new Set(
					w.effects.map((e) => {
						const p = factionProvenanceOf(e);
						return p ? `${p.faction}::${p.bonusName}` : '';
					})
				);
				expect(
					provs.size,
					`${holder.id} window ${w.id} pools ${provs.size} distinct sources: ${[...provs].join(' | ')}`
				).toBe(1);
			}
		}
	});

	it("a window built from faction effects declares source.type 'faction'", () => {
		for (const holder of WITH_FACTION_EFFECTS) {
			for (const w of windowsFor(holder)) {
				const prov = factionProvenanceOf(w.effects[0]);
				if (!prov) continue;
				expect(w.source.type, `${holder.id} window ${w.id}`).toBe('faction');
				if (w.source.type === 'faction') {
					expect(w.source.faction).toBe(prov.faction);
					expect(w.source.bonusName).toBe(prov.bonusName);
				}
			}
		}
	});

	it('a faction window spans its OWN effect duration, not a neighbouring pool’s', () => {
		// The regression that motivated moving the split out of `emit`.
		for (const holder of WITH_FACTION_EFFECTS) {
			for (const w of windowsFor(holder)) {
				if (w.source.type !== 'faction') continue;
				// Sliced windows (active-target segmentation) carry the full span
				// separately in `duration`; unsliced ones are start→end.
				const span = w.duration ?? w.end - w.start;
				const authored = w.effects[0].duration;
				if (authored == null) continue;
				expect(span, `${holder.id} window ${w.id}`).toBeCloseTo(authored, 5);
			}
		}
	});
});
