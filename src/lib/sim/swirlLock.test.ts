/**
 * src/lib/sim/swirlLock.test.ts
 *
 * ⚓ A lock taken from a SWIRL rather than an aura poll (`SkillAbility.locksSwirl`),
 * and the follow-up that reads it (`absorbedFrom: {state}`), over Prune's shipped
 * data. The answers are gcsim's (`internal/characters/prune/skill.go` at a284a499b):
 * the chime's own hit Swirling opens a 364f recast window, and a second E inside it
 * is "Clang Clang! Witch-tribution Comes!", which lands 30f after its press in the
 * swirled element (1U, ICDTagNone) and closes the window.
 */
import { describe, expect, it } from 'vitest';
import { parseNotation } from '$lib/utils/notationParser';
import type { CharacterData } from '$lib/types/character';
import type { CastEvent } from '$lib/utils/rotationEvents';

const all = Object.values(import.meta.glob('../data/characters/*.json', { eager: true })).map(
	(m) => (m as { default: CharacterData }).default
);
const byName = new Map(all.map((c) => [c.displayName, c]));
const lookup = (n: string) => byName.get(n) ?? null;

const parse = (notation: string, team: string[]) =>
	parseNotation(notation, lookup, 8, {}, {}, team.map(lookup));

const pruneCasts = (r: ReturnType<typeof parse>) =>
	r.events.filter(
		(e): e is CastEvent => e.kind === 'cast' && e.characterId === 'prune' && e.ability === 'skill'
	);

const RECAST = 'prune__skill__clang_clang_witchtribution_comes';

describe("Prune's recast (a lock taken from her own Swirl)", () => {
	it('a second E after the chime swirls Pyro is Clang Clang, landing Pyro 30f after its press', () => {
		const r = parse('Bennett E > Prune E E', ['Bennett', 'Prune']);
		const [chime, recast] = pruneCasts(r);
		expect(chime.abilityId).not.toBe(RECAST);
		expect(recast.abilityId).toBe(RECAST);
		// gcsim: the chime's E cancel is 28f while the recast window is open.
		expect(recast.time - chime.time).toBe(28);
		const pyro = r.applications.filter((a) => a.characterId === 'prune' && a.element === 'pyro');
		expect(pyro.map((a) => [a.time - recast.time, a.units])).toEqual([[30, 1]]);
		// The hammer is the swirled element, so the cast is too.
		expect(recast.element).toBe('pyro');
	});

	it('Stellar Swirl counts as Cryo', () => {
		// Kaeya's Cryo on the target, no enabler: a plain Cryo Swirl → Cryo hammer.
		const r = parse('Kaeya E > Prune E E', ['Kaeya', 'Prune']);
		const [, recast] = pruneCasts(r);
		expect(recast.abilityId).toBe(RECAST);
		expect(recast.element).toBe('cryo');
	});

	it('with nothing to swirl there is no recast: the second E waits out the cooldown', () => {
		const r = parse('Prune E E', ['Prune']);
		const [chime, second] = pruneCasts(r);
		expect(second.abilityId).toBe(chime.abilityId);
		expect(second.time - chime.time).toBeGreaterThanOrEqual(15 * 60);
		expect(r.applications.some((a) => a.characterId === 'prune' && a.element !== 'anemo')).toBe(
			false
		);
	});

	it('the window lasts 364f from the Swirl', () => {
		// The chime swirls at its 26f hit; a press 7s later is past the window.
		const r = parse('Bennett E > Prune E ~7s E', ['Bennett', 'Prune']);
		expect(pruneCasts(r).map((c) => c.abilityId)).not.toContain(RECAST);
	});

	it('the recast closes the window: a third E is the chime again, after its cooldown', () => {
		const r = parse('Bennett E > Prune E E E', ['Bennett', 'Prune']);
		const [chime, recast, third] = pruneCasts(r);
		expect(recast.abilityId).toBe(RECAST);
		expect(third.abilityId).toBe(chime.abilityId);
		expect(third.time - chime.time).toBeGreaterThanOrEqual(15 * 60);
	});

	it('Tolling Rally comes from the converted hammer only, not from the chime', () => {
		const rally = (r: ReturnType<typeof parse>) =>
			r.windows.filter(
				(w) =>
					w.kind === 'buff' &&
					w.characterId === 'prune' &&
					w.effects.some((e) => e.attribution === 'A4: Tolling Synchronicity')
			);
		expect(rally(parse('Bennett E > Prune E', ['Bennett', 'Prune']))).toHaveLength(0);
		const r = parse('Bennett E > Prune E E', ['Bennett', 'Prune']);
		const [, recast] = pruneCasts(r);
		const starts = new Set(rally(r).map((w) => w.start));
		expect([...starts]).toEqual([recast.time + 30]);
	});
});
