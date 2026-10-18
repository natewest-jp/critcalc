/**
 * src/lib/sim/timedBlessing.test.ts
 *
 * ⚓ Varesa's Fiery Passion as gcsim runs it (`internal/characters/varesa/`,
 * 2026-10-17): points build outside the Blessing (E +20 at 5f, a plunge +25 at
 * its landing), a plunge that tops 40 enters it with one free E, the two Rushes
 * spend ONE 2-charge pool, and a plunge inside it ends it at her next action
 * unless that is a burst. In FRAMES, over the shipped data.
 */
import { describe, expect, it } from 'vitest';
import { parseNotation } from '$lib/utils/notationParser';
import type { CharacterData } from '$lib/types/character';
import varesaJson from '$lib/data/characters/varesa.json';

const varesa = varesaJson as unknown as CharacterData;
const lookup = (n: string): CharacterData | null => (n === 'Varesa' ? varesa : null);

const run = (notation: string) => {
	const r = parseNotation(notation, lookup, 8, {});
	const casts = r.events.filter(
		(e): e is Extract<typeof e, { kind: 'cast' }> => e.kind === 'cast' && e.characterId === 'varesa'
	);
	const plunges = r.events.filter((e) => e.kind === 'action' && e.action === 'plunge');
	const fp = r.windows.filter(
		(w) => w.kind === 'state' && (w as { name?: string }).name === 'nightsoulBlessing'
	);
	return { casts, plunges, fp };
};

describe("Varesa's Fiery Passion (timed Blessing)", () => {
	it('a plunge that tops 40 points enters at its landing, and the next E is free', () => {
		// E +20, then the plunge's +25 tops the pool: entry at the plunge's
		// landing (38f into By the Horns' high plunge).
		const { casts, plunges, fp } = run('Varesa E C P E');
		expect(fp).toHaveLength(1);
		expect(fp[0].start).toBe(plunges[0].time + 38);
		const [, free] = casts;
		expect(free.abilityId).toBe('varesa__skill__fiery_passion_rush');
		// No charge spent, no cooldown started.
		expect(free.cooldown).toBe(0);
		expect(free.readyAt).toBe(free.time);
	});

	it('a plunge inside it ends it at the next action — but Kablam rides through', () => {
		const { casts, fp } = run('Varesa E C P E C P sQ E');
		const kablam = casts.find((c) => c.variantLabel === 'Volcano Kablam');
		expect(kablam).toBeDefined();
		const last = casts[casts.length - 1];
		// Ended by the E after the Kablam, not by the Kablam itself.
		expect(fp[0].end).toBe(last.time);
		expect(last.abilityId).toBe('varesa__skill__riding_the_nightrainbow');
		// …which spends the SECOND charge of the one pool: the first returns at 9s
		// and the second recharges after it (one at a time), so 18s.
		expect(last.readyAt).toBe(18 * 60);
	});

	it('the burst fills the pool and enters at +3f; inside, it does not restart the timer', () => {
		const { casts, fp } = run('Varesa Q E C P E');
		expect(fp[0].start).toBe(casts[0].time + 3);
		// The E inside is free, and the in-Blessing plunge ends it at the last E.
		expect(casts[1].cooldown).toBe(0);
		expect(fp[0].end).toBe(casts[casts.length - 1].time);
	});
});
