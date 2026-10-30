/**
 * A Hold variant's cooldown clock starts at its own frame, not the tap's
 * (memory-triage round, 2026-10-30).
 *
 * Every figure is gcsim's `SetCDWithDelay` for that branch of the skill, at
 * the minimum hold where the hold is parametric (Charlotte, Lynette, Nahida,
 * Navia); the citation sits in each variant's `_curatorNotes`. Before the
 * variant field existed these all inherited the tap's delay, so a ghost tail
 * ended early by the difference.
 */
import { describe, it, expect } from 'vitest';
import { parseNotation } from '$lib/utils/notationParser';
import type { CharacterData } from '$lib/types/character';

const modules = import.meta.glob<{ default: CharacterData }>('$lib/data/characters/*.json', {
	eager: true
});
const byId = new Map(Object.values(modules).map((m) => [m.default.id, m.default]));

/** [character id, notation after the name, variant label, frames to the clock's start] */
const FIXTURES: [string, string, string, number][] = [
	['alhaitham', 'hE', 'Hold', 23],
	['candace', 'hE', 'Hold', 89],
	['charlotte', 'hE', 'Focused Impression (Hold)', 110],
	['dahlia', 'hE', 'Hold', 21],
	['diona', 'hE', 'Hold', 29],
	['furina', 'C E', 'Pneuma', 10],
	['lynette', 'hE', 'Hold', 49],
	['nahida', 'hE', 'Hold', 30],
	['navia', 'hE', 'Hold', 41],
	['razor', 'hE', 'Hold', 52],
	['shenhe', 'hE', 'Hold', 32],
	['sigewinne', 'h1E', 'Short Hold', 40],
	['sigewinne', 'h2E', 'Hold', 66],
	['venti', 'hE', 'Hold', 34],
	['yun_jin', 'hE', 'Hold Lv.1', 48]
];

describe('a Hold variant starts its cooldown at its own frame', () => {
	it.each(FIXTURES)('%s %s (%s) → %i frames', (id, actions, label, delay) => {
		const c = byId.get(id)!;
		const r = parseNotation(`${c.name} ${actions}`, (n) => (n === c.name ? c : null), 8);
		const bar = r.tracks.find((t) => t.characterId === id)!.eBars[0];
		expect(bar.variantLabel).toBe(label);
		expect(bar.readyAt! - bar.start - bar.cooldown).toBe(delay);
	});
});
