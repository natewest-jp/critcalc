/**
 * src/lib/sim/heldCast.test.ts
 *
 * ⚓ A hold the player sets the length of (`HeldCast`, 2026-10-17): Sayu's
 * Fuufuu Windwheel as gcsim's `skillHold(duration)` runs it
 * (`internal/characters/sayu/skill.go`, 4eda9fc5f). Roll ticks at 18 + 30k for
 * every 30k ≤ D, the kick at 67 + D, the cooldown 6s + D/2 from 50 + D, the swap
 * at 106 + D; D is a `~Xs` written right after `hE`, else the full 600f.
 */
import { describe, expect, it } from 'vitest';
import { parseNotation } from '$lib/utils/notationParser';
import type { CharacterData } from '$lib/types/character';
import sayuJson from '$lib/data/characters/sayu.json';
import bennettJson from '$lib/data/characters/bennett.json';

const sayu = sayuJson as unknown as CharacterData;
const bennett = bennettJson as unknown as CharacterData;
const lookup = (n: string): CharacterData | null =>
	n === 'Sayu' ? sayu : n === 'Bennett' ? bennett : null;

const run = (notation: string) => {
	const r = parseNotation(notation, lookup, 8, {}, {}, [sayu, bennett]);
	const hold = r.events.find(
		(e): e is Extract<typeof e, { kind: 'cast' }> =>
			e.kind === 'cast' && e.characterId === 'sayu' && e.variantLabel === 'Hold'
	)!;
	const apps = r.applications.filter((a) => a.characterId === 'sayu');
	const sayuTrack = r.tracks.find((t) => t.characterId === 'sayu')!;
	return { r, hold, apps, sayuTrack };
};

describe("Sayu's held Windwheel", () => {
	it('with no time written she rolls the full 10s: kick at 667, an 11s cooldown from 650', () => {
		const { hold } = run('Sayu hE > Bennett E');
		expect(hold.castTime).toBe(106 + 600);
		expect(hold.hitsAt).toHaveLength(21 + 1);
		expect(hold.hitsAt!.at(-2)).toBe(hold.time + 618);
		expect(hold.hitsAt!.at(-1)).toBe(hold.time + 667);
		expect(hold.cooldown).toBe(660);
		expect(hold.readyAt).toBe(hold.time + 650 + 660);
	});

	it('a `~Xs` after it is the roll: `~2s` rolls 120f, kicks at 187, 7s cooldown', () => {
		const { hold, r } = run('Sayu hE ~2s > Bennett E');
		expect(hold.castTime).toBe(106 + 120);
		expect(hold.hitsAt!.map((t) => t - hold.time)).toEqual([18, 48, 78, 108, 138, 187]);
		expect(hold.cooldown).toBe(420);
		expect(hold.readyAt).toBe(hold.time + 170 + 420);
		// The wait was the roll — the swap follows the kick's recovery, not 2s more.
		const ben = r.events.find((e) => e.kind === 'cast' && e.characterId === 'bennett')!;
		expect(ben.time).toBe(hold.time + 226 + 8);
	});

	it('a wait past the longest hold keeps its excess as a wait', () => {
		const { hold, r } = run('Sayu hE ~12s > Bennett E');
		expect(hold.castTime).toBe(706);
		const ben = r.events.find((e) => e.kind === 'cast' && e.characterId === 'bennett')!;
		expect(ben.time).toBe(hold.time + 706 + 120 + 8);
	});

	it('absorbs while she rolls: a Pyro twin on each roll tick after the lock, and on the kick', () => {
		const { apps } = run('Bennett E > Sayu hE ~3s');
		const pyro = apps.filter((a) => a.element === 'pyro');
		// Roll ticks at 18…198 (7); the lock is at the first poll (30), so the 48f
		// tick is the first twin. Standard ICD on the Pyro tag: the 1st (48) and
		// 4th (138) of the six twins apply, the timer's reset lets 198 through, and
		// the kick (no ICD) always applies.
		expect(pyro.map((a) => a.time)).toEqual([48, 138, 198, 248].map((f) => f + pyro[0].time - 48));
		expect(apps.some((a) => a.element === 'anemo')).toBe(true);
	});

	it('with nothing to absorb she applies only Anemo, and the tap is untouched', () => {
		const { apps } = run('Sayu hE ~3s');
		expect(apps.every((a) => a.element === 'anemo')).toBe(true);
		const tap = parseNotation('Sayu E', lookup, 8, {}).events.find((e) => e.kind === 'cast')!;
		expect(tap.kind === 'cast' && tap.castTime).toBe(42);
	});
});
