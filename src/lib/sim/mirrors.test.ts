/**
 * Alhaitham's Chisel-Light Mirrors, simulated (Mirrors round, 2026-10-30).
 *
 * Every expected frame is derived from gcsim `internal/characters/alhaitham/`:
 * the E's gain lands 15f after a tap and 23f after a hold (`skill.go`), one
 * Mirror leaves every 233f on a clock that starts from empty and restarts on an
 * overflow (`mirrorInterval`, `lastInfusionSrc`), A1 adds one on a Charged or
 * Plunging hit (`asc.go`), the burst consumes them all and refills `3 −
 * consumed` 184f later if he is still on field (`burst.go`; 3 at C6), and a
 * Projection Attack fires one hit per Mirror off a Normal, Charged or Plunging
 * hit, 96f apart, on a group that applies every other hit (`projectionAttack`,
 * `ICDGroupAlhaithamProjectionAttack`).
 *
 * What is read: a swing's element (the infusion is the pool's witness), the
 * aura applications the Projection Attacks feed (`castKind: 'skill'` after the
 * E's own hit), and C6's crit window.
 */
import { describe, it, expect } from 'vitest';
import { parseNotation } from '$lib/utils/notationParser';
import type { CharacterData } from '$lib/types/character';
import type { ParsedRotation } from './types';

const modules = import.meta.glob<{ default: CharacterData }>('$lib/data/characters/*.json', {
	eager: true
});
const byName = new Map(Object.values(modules).map((m) => [m.default.name, m.default]));
const lookup = (n: string) => byName.get(n) ?? null;
const parse = (notation: string, cons = 0): ParsedRotation =>
	parseNotation(notation, lookup, 8, { alhaitham: cons });

/** [start, element] of every Alhaitham swing. */
const swings = (r: ParsedRotation) =>
	r.events.flatMap((e) =>
		e.kind === 'action' && e.characterId === 'alhaitham' ? [[e.time, e.element] as const] : []
	);

/** The last swing start that is Dendro, and the first after it that is physical. */
const infusionEdge = (r: ParsedRotation) => {
	const s = swings(r);
	const lastDendro = s.findLastIndex(([, el]) => el === 'dendro');
	return { lastDendro: s[lastDendro]?.[0], firstPhysical: s[lastDendro + 1]?.[0] };
};

/** Projection Attack applications: Alhaitham's `skill` applications after the E's own. */
const projections = (r: ParsedRotation, after: number) =>
	r.applications
		.filter((a) => a.characterId === 'alhaitham' && a.castKind === 'skill' && a.time > after)
		.map((a) => a.time);

const burstAt = (r: ParsedRotation) =>
	r.events.find((e) => e.kind === 'cast' && e.ability === 'burst')!.time;

describe("Alhaitham's Mirrors", () => {
	it('infuse his attacks until the last one leaves, one every 233f', () => {
		// E → 2 Mirrors at 15; they leave at 248 and 481.
		const s = swings(parse('Alhaitham E N5 N5 N5'));
		expect(s.filter(([t]) => t < 481).every(([, el]) => el === 'dendro')).toBe(true);
		expect(s.filter(([t]) => t > 481).every(([, el]) => el === undefined)).toBe(true);
		expect(s.some(([t]) => t > 481)).toBe(true);
	});

	it('leave his first swing physical when none are up yet', () => {
		expect(swings(parse('Alhaitham N1 E N1')).map(([, el]) => el)).toEqual([undefined, 'dendro']);
	});

	it('fire one Projection Attack per Mirror, 96f apart, every other one applying', () => {
		// N1 lands at 38 with 2 Mirrors → 66 (+28) applies, 75 does not. The next
		// hit past 134 is N5's at 173 → 201. By N3's second hit at 271 one Mirror
		// has left (248) → a single attack at +39 = 310.
		expect(projections(parse('Alhaitham E N5 N5 N5'), 19)).toEqual([66, 201, 310]);
	});

	it("count A1's Mirror on the hit that made it", () => {
		// Hold E → 2 Mirrors at 23; the low plunge lands at 133, A1 makes the third,
		// and that hit's Projection is the three-Mirror one: 165, (174), 184.
		expect(projections(parse('Alhaitham hE lP'), 28)).toEqual([165, 184]);
	});

	it('join the back of the queue when one is added to a live pool', () => {
		// E → [248, 481]; the Charged Attack's A1 at 63 adds the third at 481 + 233.
		const { lastDendro, firstPhysical } = infusionEdge(parse('Alhaitham E C N5 N5 N5 N5 N5'));
		expect(lastDendro).toBeLessThan(714);
		expect(firstPhysical).toBeGreaterThan(714);
	});

	it('are consumed by the burst and refilled 184f later, 3 − consumed', () => {
		// E → 2 at 15; Q at 28 consumes both and refills 1 at 212.
		const s = swings(parse('Alhaitham E Q N3 ~2s N3'));
		expect(s.filter(([t]) => t < 212).every(([, el]) => el === undefined)).toBe(true);
		expect(s.filter(([t]) => t > 212).every(([, el]) => el === 'dendro')).toBe(true);
		// Three consumed (E's two, A1's third) refill none.
		const full = parse('Alhaitham N1 E N3 C Q N3 ~3s N2');
		const after = swings(full).filter(([t]) => t > burstAt(full));
		expect(after.length).toBeGreaterThan(0);
		expect(after.every(([, el]) => el === undefined)).toBe(true);
	});

	it('refill 3 at C6 whatever the burst consumed', () => {
		const r = parse('Alhaitham N1 E N3 C Q N3 ~3s N2', 6);
		const after = swings(r).filter(([t]) => t > burstAt(r) + 184);
		expect(after.length).toBeGreaterThan(0);
		expect(after.every(([, el]) => el === 'dendro')).toBe(true);
	});

	it('restart their clock when a grant overflows the cap', () => {
		// Q → 3 at 184: [417, 650, 883]. Unprovoked, the last leaves at 883.
		const plain = infusionEdge(parse('Alhaitham Q ~1s N5 N5 N5 N5 N5 N5'));
		expect(plain.lastDendro).toBeLessThan(883);
		expect(plain.firstPhysical).toBeGreaterThan(883);
		// The Charged Attack's A1 lands at 226 on a full pool: [459, 692, 925].
		const restarted = infusionEdge(parse('Alhaitham Q ~2s C N5 N5 N5 N5 N5 N5 N5'));
		expect(restarted.lastDendro).toBeGreaterThan(883);
		expect(restarted.lastDendro).toBeLessThan(925);
		expect(restarted.firstPhysical).toBeGreaterThan(925);
	});

	it('are lost on a swap, and a refill due after it never lands', () => {
		expect(swings(parse('Alhaitham E N1 > Nahida E > Alhaitham N1')).map(([, el]) => el)).toEqual([
			'dendro',
			undefined
		]);
		expect(swings(parse('Alhaitham Q > Nahida E ~3s > Alhaitham N1')).map(([, el]) => el)).toEqual([
			undefined
		]);
	});

	it("gate C6's crit on an E cast at three Mirrors, with nothing asserted", () => {
		const crit = (r: ParsedRotation) =>
			r.windows.filter(
				(w) =>
					w.kind === 'buff' &&
					w.characterId === 'alhaitham' &&
					w.effects.some((fx) => fx.type === 'buff' && fx.stat === 'critRate')
			);
		// A fresh E generates 2 from none: no overflow.
		expect(crit(parse('Alhaitham E', 6))).toHaveLength(0);
		// The refill fills him at 184; an E after it overflows.
		expect(crit(parse('Alhaitham Q ~2s E', 6))).toHaveLength(1);
	});
});

describe('what the Mirrors scale', () => {
	/** Alhaitham's buff windows carrying `stat`, as [start, value]. */
	const bars = (r: ParsedRotation, stat: string) =>
		r.windows.flatMap((w) =>
			w.kind === 'buff' && w.characterId === 'alhaitham'
				? w.effects.flatMap((fx) =>
						fx.type === 'buff' && fx.stat === stat ? [[w.start, fx.value] as const] : []
					)
				: []
		);
	const burstApps = (r: ParsedRotation) =>
		r.applications
			.filter((a) => a.characterId === 'alhaitham' && a.castKind === 'burst')
			.map((a) => a.time);

	it('add two burst instances per Mirror consumed, 21f apart', () => {
		// 4 instances from 94: the standard window applies the 1st and 4th.
		expect(burstApps(parse('Alhaitham Q'))).toEqual([94, 157]);
		// 2 consumed → 8: the 7th (220) applies too. Q at 28.
		expect(burstApps(parse('Alhaitham E Q'))).toEqual([122, 185, 248]);
		// 3 consumed → 10: the 10th window opens at 244, so 262 applies. Q at 137.
		expect(burstApps(parse('Alhaitham hE lP Q'))).toEqual([231, 294, 357, 399]);
	});

	it('C1: each Projection Attack fire takes 1.2s off the skill', () => {
		// Four fires (38, 173, 271, 394) before the second E.
		const eAt = (cons: number) =>
			parse('Alhaitham E N5 N5 N5 E', cons).events.filter(
				(e) => e.kind === 'cast' && e.ability === 'skill'
			)[1].time;
		expect(eAt(0)).toBe(1095);
		expect(eAt(1)).toBe(1095 - 4 * 72);
	});

	it('C2: each trigger grants the Mirrors it generates, when they land', () => {
		// A fresh E generates 2 (+100) at 15.
		expect(bars(parse('Alhaitham E', 2), 'em')).toEqual([[15, 100]]);
		// Q refills 3 at 184 (+150); the E at 207 overflows one (+50 at 222); the
		// Charged Attack's A1 adds one more at its first landing (270), not its second.
		expect(bars(parse('Alhaitham Q ~2s E C', 2), 'em')).toEqual([
			[184, 150],
			[222, 50],
			[270, 50]
		]);
		// A refill due after a swap generates nothing, and grants nothing.
		expect(bars(parse('Alhaitham Q > Nahida E', 2), 'em')).toEqual([]);
	});

	it('C4: the party EM counts the Mirrors consumed, his Dendro bonus the ones refilled', () => {
		// E → 2; Q at 28 consumes both (30 × 2 for the party) and refills 1 at 212.
		const r = parse('Alhaitham E Q', 4);
		const em = r.windows.find(
			(w) =>
				w.kind === 'buff' &&
				w.effects.some((fx) => fx.type === 'buff' && fx.stat === 'em' && fx.target !== 'self')
		)!;
		expect(em.start).toBe(28);
		expect(em.kind === 'buff' && em.stackContext?.get('mirrors')).toBe(2);
		expect(bars(r, 'dendroDmgBonus')).toEqual([[212, 10]]);
		// At C6 the refill is 3 whatever was consumed.
		expect(bars(parse('Alhaitham E Q', 6), 'dendroDmgBonus')).toEqual([[212, 30]]);
		// No Mirrors consumed: no party EM (gcsim's c4Loss returns at 0).
		expect(
			parse('Alhaitham Q', 4).windows.some(
				(w) =>
					w.kind === 'buff' &&
					w.effects.some((fx) => fx.type === 'buff' && fx.stat === 'em' && fx.target !== 'self')
			)
		).toBe(false);
	});
});
