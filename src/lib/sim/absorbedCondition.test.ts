/**
 * src/lib/sim/absorbedCondition.test.ts
 *
 * ⚓ Buffs a cast's absorption lock chooses between (the `absorbed` Condition),
 * over the shipped data. The answers are gcsim's (at 41bfe4915):
 *
 * - Wanderer's Jade-Claimed Flower (`wanderer/asc.go` `absorbCheckA1`, called at
 *   the skill's press): up to TWO draws of Pyro > Hydro > Electro > Cryo, the
 *   first match deleted between; Pyro gives +30% ATK and Cryo +20% CRIT Rate,
 *   each 1200f, deleted when Windfavored ends (`skillEndRoutine`).
 * - Sucrose's Chaotic Entropy (`sucrose/burst.go` `absorbCheck`, `cons.go` `c6`):
 *   once, when the wind spirit's poll locks, every party member gains 20% DMG
 *   Bonus of that element for 600f.
 * - Kazuha's Soumon Swordsmanship (`kazuha/skill.go`, `asc.go`, `plunge.go`): the
 *   skill polls from 1f every 6f, hitmark/6 times; the Midare Ranzan plunge after
 *   it lands at 36f (press) or 41f (hold), and 1f before that one more hit in
 *   the locked element, Durability 25.
 */
import { describe, expect, it } from 'vitest';
import { parseNotation } from '$lib/utils/notationParser';
import type { CharacterData } from '$lib/types/character';
import type { CastEvent, TimelineWindow } from '$lib/utils/rotationEvents';
import { projectTeamBuffRows } from '$lib/timeline/teamBuffRows';

const all = Object.values(import.meta.glob('../data/characters/*.json', { eager: true })).map(
	(m) => (m as { default: CharacterData }).default
);
const byName = new Map(all.map((c) => [c.displayName, c]));
const lookup = (n: string) => byName.get(n) ?? null;

const parse = (notation: string, team: string[], cons: Record<string, number> = {}) =>
	parseNotation(notation, lookup, 8, cons, {}, team.map(lookup));

type Parsed = ReturnType<typeof parse>;
type BuffWin = Extract<TimelineWindow, { kind: 'buff' }>;

const castOf = (r: Parsed, id: string, kind: 'skill' | 'burst') =>
	r.events.find(
		(e): e is CastEvent => e.kind === 'cast' && e.characterId === id && e.ability === kind
	)!;

const buffsWith = (r: Parsed, id: string, stat: string): BuffWin[] =>
	r.windows.filter(
		(w): w is BuffWin =>
			w.kind === 'buff' &&
			w.characterId === id &&
			w.effects.some((e) => e.type === 'buff' && e.stat === stat)
	);

describe("Wanderer's Jade-Claimed Flower", () => {
	it('a Pyro aura at the press gives +30% ATK from the cast, and no CRIT Rate', () => {
		const r = parse('Bennett E > Wanderer E', ['Bennett', 'Wanderer']);
		const cast = castOf(r, 'wanderer', 'skill');
		expect(cast.absorbed?.map((a) => a.element)).toEqual(['pyro']);
		const atk = buffsWith(r, 'wanderer', 'atk%');
		expect(atk.map((w) => w.start)).toEqual([cast.time]);
		expect(buffsWith(r, 'wanderer', 'critRate')).toHaveLength(0);
	});

	it('the draw takes two elements in priority order', () => {
		// Electro and Hydro coexist on the target: the draw takes Hydro, then Electro.
		const r = parse('Fischl E > Xingqiu E > Wanderer E', ['Fischl', 'Xingqiu', 'Wanderer']);
		expect(castOf(r, 'wanderer', 'skill').absorbed?.map((a) => a.element)).toEqual([
			'hydro',
			'electro'
		]);
	});

	it('the buff ends with Windfavored', () => {
		const r = parse('Bennett E > Wanderer E N2 > Bennett E', ['Bennett', 'Wanderer']);
		const stance = r.windows.find(
			(w) => w.kind === 'state' && w.characterId === 'wanderer' && w.name === 'inStance'
		)!;
		const [atk] = buffsWith(r, 'wanderer', 'atk%');
		expect(atk.end).toBe(stance.end);
	});

	it('with nothing to absorb there is no buff', () => {
		const r = parse('Wanderer E', ['Wanderer']);
		expect(castOf(r, 'wanderer', 'skill').absorbed).toBeUndefined();
		expect(buffsWith(r, 'wanderer', 'atk%')).toHaveLength(0);
		expect(buffsWith(r, 'wanderer', 'critRate')).toHaveLength(0);
	});
});

describe("Sucrose's Chaotic Entropy", () => {
	it('at C6, 20% DMG Bonus of the absorbed element from the lock for 10s', () => {
		const r = parse('Bennett E > Sucrose Q', ['Bennett', 'Sucrose'], { sucrose: 6 });
		const cast = castOf(r, 'sucrose', 'burst');
		const lock = cast.absorbed?.[0];
		expect(lock?.element).toBe('pyro');
		const pyro = buffsWith(r, 'sucrose', 'pyroDmgBonus');
		expect(pyro.map((w) => [w.start - cast.time, w.end - w.start])).toEqual([
			[lock!.at - cast.time, 600]
		]);
		// gcsim's first poll is 136f after the cast.
		expect(lock!.at - cast.time).toBe(136);
		for (const other of ['hydroDmgBonus', 'electroDmgBonus', 'cryoDmgBonus'])
			expect(buffsWith(r, 'sucrose', other)).toHaveLength(0);
	});

	it("draws on a row of its own, not under the burst's other bars", () => {
		// The EM share opens a frame after the lock and outlasts it; in one row it
		// painted over the bonus whole.
		const r = parse('Bennett E > Sucrose Q', ['Bennett', 'Sucrose'], { sucrose: 6 });
		const rows = projectTeamBuffRows(r.windows, (id) => all.find((c) => c.id === id) ?? null);
		const own = rows.filter((row) =>
			row.bars.some((b) => b.effects.some((e) => e.stat === 'pyroDmgBonus'))
		);
		expect(own).toHaveLength(1);
		expect(own[0].bars.every((b) => b.effects.every((e) => e.stat === 'pyroDmgBonus'))).toBe(true);
		expect(own[0].sourceLabel).toBe('Sucrose Chaotic Entropy');
	});

	it('below C6, or with nothing to absorb, there is no bonus', () => {
		const c0 = parse('Bennett E > Sucrose Q', ['Bennett', 'Sucrose']);
		expect(buffsWith(c0, 'sucrose', 'pyroDmgBonus')).toHaveLength(0);
		const bare = parse('Sucrose Q', ['Sucrose'], { sucrose: 6 });
		for (const s of ['pyroDmgBonus', 'hydroDmgBonus', 'electroDmgBonus', 'cryoDmgBonus'])
			expect(buffsWith(bare, 'sucrose', s)).toHaveLength(0);
	});
});

describe("Kazuha's Soumon Swordsmanship", () => {
	const kazuhaApps = (r: Parsed) =>
		r.applications.filter((a) => a.characterId === 'kaedehara_kazuha');
	const plungeOf = (r: Parsed) =>
		r.events.find(
			(e) => e.kind === 'action' && e.characterId === 'kaedehara_kazuha' && e.action === 'plunge'
		)!;

	it('after a press E that absorbed Pyro, the plunge lands Pyro 35f in, then its own Anemo at 36f', () => {
		const r = parse('Bennett E > Kazuha E P', ['Bennett', 'Kazuha']);
		const p = plungeOf(r);
		const after = kazuhaApps(r)
			.filter((a) => a.time >= p.time)
			.map((a) => [a.time - p.time, a.element, a.units]);
		expect(after).toEqual([
			[35, 'pyro', 1],
			[36, 'anemo', 1]
		]);
	});

	it('after a hold E, 40f and 41f', () => {
		const r = parse('Bennett E > Kazuha hE P', ['Bennett', 'Kazuha']);
		const p = plungeOf(r);
		const after = kazuhaApps(r)
			.filter((a) => a.time >= p.time)
			.map((a) => [a.time - p.time, a.element]);
		expect(after).toEqual([
			[40, 'pyro'],
			[41, 'anemo']
		]);
	});

	it('with nothing absorbed the plunge lands Anemo alone', () => {
		const r = parse('Kazuha E P', ['Kazuha']);
		expect(kazuhaApps(r).every((a) => a.element === 'anemo')).toBe(true);
	});
});
