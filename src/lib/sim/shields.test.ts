/**
 * shields.test.ts — a constellation-hosted shield reaches the lane (2026-08-18).
 *
 * ⚓ `registerShieldOnCast` read the CAST ABILITY'S own effects only, so a
 * `shield` Effect authored on a constellation entry drew nothing at any level.
 * ⚠️ NOT a leak and NOT the constellation gate's doing — nothing drew at C0 or
 * at C6 — it is the [[orphaned_schema]] blind spot: `shield` effects ARE read,
 * just not from that source, so a green guard said nothing.
 * Record: docs/constellation-shield-gap.md.
 *
 * ⚠️⚠️ THE CORPUS DIFFERENTIAL IN `constellationGating.test.ts` COULD NOT SEE
 * THIS AND STILL CANNOT. It runs at C0, where these shields drew nothing before
 * the wire and draw nothing after it. It must keep passing UNCHANGED — if
 * wiring the pool ever makes it fail, the constellation gate has been bypassed.
 * The assertions here are the other half: they run AT the entry's level.
 *
 * ⚠️ The gcsim oracles say nothing about any of this — a shield leaves no
 * damage event, exactly as the tick-cap round found for sibling heal series.
 */

import { describe, it, expect } from 'vitest';
import { parseNotation, type ParsedRotation, type TimelineWindow } from '$lib/utils/notationParser';
import type { CharacterData } from '$lib/types/character';

const modules = import.meta.glob('../data/characters/*.json', { eager: true });
const all: CharacterData[] = Object.values(modules).map(
	(m) => (m as { default: CharacterData }).default
);
const byId = new Map(all.map((c) => [c.id, c]));
const byName = new Map(all.map((c) => [c.displayName, c]));

type ShieldWindow = Extract<TimelineWindow, { kind: 'shield' }>;

/** ⚠️ EVERY ASSERTION BELOW IS AN ABSENCE, so a notation the parser could not
 *  read would pass all of them. A mistyped `displayName` did exactly that on
 *  the first cut of this file (Traveler Hydro's is "Hydro Traveler"), which is
 *  why the harness itself asserts the rotation actually ran. */
function parseAt(id: string, notation: string, cLevel: number): ParsedRotation {
	const c = byId.get(id);
	if (!c) throw new Error(`no character ${id}`);
	const r = parseNotation(notation, (n) => byName.get(n) ?? null, 8, { [id]: cLevel }, undefined, [
		c
	]);
	expect(r.unknownTokens, `${id} @C${cLevel}`).toEqual([]);
	expect(
		r.events.filter((e) => e.kind === 'cast' && e.characterId === id).length,
		`${id} @C${cLevel} cast events`
	).toBeGreaterThan(0);
	return r;
}

function shieldsOf(r: ParsedRotation): ShieldWindow[] {
	return r.windows.filter((w): w is ShieldWindow => w.kind === 'shield');
}

describe('constellation-hosted shields', () => {
	// Beidou C1 and Yanfei C4 are the two CLEAN wires: an `onCast burst` shield
	// on a constellation entry, on a burst that authors no shield of its own.
	// ⚠ Both are authored with NO `label` — the shield lane's generic "Shield"
	// fallback is the established rendering for an unnamed shield (Xinyan,
	// Diona, Candace and Lan Yan already use it) and ⛔ inventing a name to
	// avoid it is forbidden.
	const CLEAN: { id: string; level: number; notation: string; duration: number }[] = [
		{ id: 'beidou', level: 1, notation: 'Beidou E Q', duration: 15 },
		{ id: 'yanfei', level: 4, notation: 'Yanfei E Q', duration: 15 }
	];

	for (const c of CLEAN) {
		it(`${c.id}: no shield below C${c.level}, exactly one at C${c.level}`, () => {
			expect(shieldsOf(parseAt(c.id, c.notation, c.level - 1))).toEqual([]);
			const at = shieldsOf(parseAt(c.id, c.notation, c.level));
			expect(at).toHaveLength(1);
			expect(at[0].source).toBe('burst');
			expect(at[0].end - at[0].start).toBe(c.duration * 60);
			// No stand-in summon to reconcile against — a constellation shield
			// has no summon twin, and matching one by duration coincidence is
			// exactly what the ability-half-only guard refuses.
			expect(at[0].coveredBySummon).toBeUndefined();
		});

		it(`${c.id}: still nothing at C0`, () => {
			// The half the corpus differential covers, restated locally so a
			// failure here reads as "the gate broke" rather than as 123 red rows.
			expect(shieldsOf(parseAt(c.id, c.notation, 0))).toEqual([]);
		});
	}

	// ⛔ NICOLE'S C2 SHIELD IS CO-OP ONLY and is deliberately unmodelled — the
	// house form is Kirara C2. "Nearby active party members" is plural only in
	// co-op, where each player has an on-field character of their own; in a
	// single-player party there is exactly one, and her skill's own Shield of
	// Blazing Light (gcsim `Target: -1`, player-wide) already covers them.
	// gcsim implements no C2 shield at all. ⛔ It was briefly authored as a
	// `target: 'team'` shield, which made the Team Builder claim she shields
	// the whole party.
	it('nicole: C2 adds no shield window at any level', () => {
		for (const level of [0, 2, 6]) {
			const r = parseAt('nicole', 'Nicole E', level);
			const sh = shieldsOf(r);
			expect(sh, `C${level}`).toHaveLength(1);
			expect(sh[0].label, `C${level}`).toBe('Shield of Blazing Light');
			expect(sh[0].end - sh[0].start, `C${level}`).toBe(20 * 60);
			expect(
				r.events.filter((e) => e.kind === 'shieldEnd'),
				`C${level}`
			).toHaveLength(1);
		}
	});

	// ⚓ ONE SPAN, ONE BAR — the collapse in `registerShieldOnCast`, exercised
	// on a SYNTHETIC re-add of exactly the shape that was retired above.
	//
	// ⏸️ The guard is dormant in the corpus and kept anyway: the half-A/half-B
	// pool is what makes a same-span pair reachable at all, and the failure
	// mode is silent — two identical bars per cast, the second unnamed, plus a
	// second `shieldEnd`. That is the 2026-08-14 double-window class.
	//
	// ⚠ A different LENGTH is a different shield and must still draw its own
	// bar; the second case is what pins that this collapses IDENTITY rather
	// than merely deduplicating whatever overlaps.
	describe('one span, one bar', () => {
		/** Nicole with a `shield` Effect grafted onto her C2 entry. ⚠ A SHALLOW
		 *  clone down to the entry being changed — never a mutation of the
		 *  eagerly-imported module object every other test in this worker
		 *  shares. */
		function nicoleWithC2Shield(duration: number): CharacterData {
			const base = byId.get('nicole')!;
			const shield = {
				type: 'shield',
				target: 'team',
				trigger: { type: 'onCast', ability: 'skill' },
				duration,
				durationType: 'refresh',
				scaling: 398.1,
				stat: 'atk',
				flat: 3051
			};
			return {
				...base,
				constellations: base.constellations!.map((con) =>
					(con as { constellationLevel?: number }).constellationLevel === 2
						? { ...con, effects: [...(con.effects ?? []), shield] }
						: con
				)
			} as CharacterData;
		}

		function shieldsFor(c: CharacterData, cLevel: number): ShieldWindow[] {
			const r = parseNotation('Nicole E', () => c, 8, { nicole: cLevel }, undefined, [c]);
			expect(r.unknownTokens).toEqual([]);
			return r.windows.filter((w): w is ShieldWindow => w.kind === 'shield');
		}

		it('a same-span constellation shield collapses into the ability’s', () => {
			const c = nicoleWithC2Shield(20);
			expect(shieldsFor(c, 0)).toHaveLength(1);
			const at2 = shieldsFor(c, 2);
			expect(at2).toHaveLength(1);
			// ⚓ The survivor keeps the KIT'S wording — the ability half is
			// pushed first and the graft carries no `label`.
			expect(at2[0].label).toBe('Shield of Blazing Light');
		});

		it('a different-length constellation shield still draws its own bar', () => {
			const at2 = shieldsFor(nicoleWithC2Shield(25), 2);
			expect(at2).toHaveLength(2);
			expect(at2.map((w) => w.end - w.start).sort((a, b) => a - b)).toEqual([20 * 60, 25 * 60]);
		});
	});

	// ⛔ NOT WORK, and each for its own stated reason. Left as assertions rather
	// than as a comment so a future author who wires one of them has to come
	// here and say why.
	//   · Columbina C1 / Sigewinne C2 — `manual` trigger, dispatched nowhere.
	//   · Kaeya C4 — `passive` trigger gated on `selfHpBelow`, which the planner
	//     has no HP state to answer.
	//   · Traveler Hydro C4 — `onCast skill` with NO `duration`, deliberately:
	//     the Aquacrest Aegis is channel-bound ("persists until the Traveler
	//     finishes using the skill") and his skill is `instant` with no active
	//     window to bind it to. ⛔ Authoring a duration would be faking timing.
	const INERT: { id: string; level: number; notation: string }[] = [
		{ id: 'columbina', level: 1, notation: 'Columbina E Q' },
		{ id: 'sigewinne', level: 2, notation: 'Sigewinne E Q' },
		{ id: 'kaeya', level: 4, notation: 'Kaeya E Q' },
		{ id: 'traveler_hydro', level: 4, notation: 'Hydro Traveler E Q' }
	];

	for (const c of INERT) {
		it(`${c.id}: C${c.level} shield stays inert at C6`, () => {
			expect(shieldsOf(parseAt(c.id, c.notation, 6))).toEqual([]);
		});
	}
});
