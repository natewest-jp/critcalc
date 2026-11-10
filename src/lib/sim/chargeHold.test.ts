import { describe, expect, it } from 'vitest';
import { parseNotation } from '$lib/utils/notationParser';
import type { CharacterData } from '$lib/types/character';
import type { ChargeHold, NormalAbility } from '$lib/types/ability';
import sandroneJson from '$lib/data/characters/sandrone.json';
import bennettJson from '$lib/data/characters/bennett.json';
import fischlJson from '$lib/data/characters/fischl.json';
import kaeyaJson from '$lib/data/characters/kaeya.json';
import sucroseJson from '$lib/data/characters/sucrose.json';
import { advanceHeat, createHeat, planHold, ventHeat } from './chargeHold';

/**
 * Every expected number is from gcsim v2.50.0's debug log (Sandrone with no
 * hitlag on the hold), with its first action on frame 1 as gcsim starts them.
 */
const sandrone = sandroneJson as unknown as CharacterData;
const h = (sandrone.abilities.find((a) => a.abilityType === 'normal') as NormalAbility)
	.chargeHold as ChargeHold;
const onField = () => true;
const press = (over = {}) => ({
	at: 1,
	rolled: false,
	hold: null,
	constellation: 0,
	onField,
	...over
});

describe('Sandrone’s held Charged Attack, against gcsim', () => {
	it('a bare C from cold fires three beams and stops at the last', () => {
		const heat = createHeat();
		const p = planHold(heat, h, press());
		expect(p.sweeps).toEqual([44, 68, 86, 111, 126, 144, 168, 186, 204]);
		expect(p.beams).toEqual([104, 164, 224]);
		expect(p.exit).toBe(224);
		expect(p.bare).toBe(true);
		expect(heat.value).toBe(1000);
	});

	it('C1 halves the gain and fires six beams', () => {
		const p = planHold(createHeat(), h, press({ constellation: 1 }));
		expect(p.beams).toEqual([104, 164, 224, 284, 344, 404]);
		expect(p.exit).toBe(404);
	});

	it('a set hold stops where it was told', () => {
		const p = planHold(createHeat(), h, press({ hold: 90 }));
		expect(p.sweeps).toEqual([44, 68, 86, 111, 126]);
		expect(p.beams).toEqual([104]);
		expect(p.exit).toBe(134);
		expect(p.bare).toBe(false);
	});

	it('held past the cap, it overheats and fires Power Overdrive', () => {
		const p = planHold(createHeat(), h, press({ hold: 300 }));
		expect(p.beams).toEqual([104, 164, 224]);
		expect(p.sweeps.at(-1)).toBe(226);
		expect(p.overdrive).toEqual([274, 298, 322, 346]);
		expect(p.exit).toBe(344);
	});

	it('the quick E vents before the overheat lands', () => {
		const heat = createHeat();
		planHold(heat, h, press());
		ventHeat(heat, h, 225, 46, onField);
		expect(heat.value).toBe(0);
		advanceHeat(heat, h, 300, onField);
		expect(heat.overheated).toBe(false);
	});

	it('with no E, a capped gauge overheats 19 frames later', () => {
		const heat = createHeat();
		planHold(heat, h, press());
		advanceHeat(heat, h, 242, onField);
		expect(heat.overheated).toBe(false);
		advanceHeat(heat, h, 243, onField);
		expect(heat.overheated).toBe(true);
	});

	it('cools three times as fast off-field', () => {
		const heat = createHeat();
		planHold(heat, h, press());
		advanceHeat(heat, h, 537, () => false);
		expect(heat.value).toBe(250);
	});

	it('a warm gauge fires only the beams that fit', () => {
		const heat = createHeat();
		planHold(heat, h, press({ hold: 120 }));
		// gcsim: 69.2 at the second press fits one beam.
		heat.value = 692;
		const p = planHold(heat, h, press({ at: 165, rolled: true }));
		expect(p.beams).toEqual([243]);
		expect(p.exit).toBe(243);
	});

	it('an overheated gauge gives a bare C its shortest press', () => {
		const heat = { ...createHeat(), value: 1000, overheated: true };
		const p = planHold(heat, h, press());
		expect(p.beams).toEqual([]);
		expect(p.overdrive).toEqual([1 + 25 + 21 + 10]);
		expect(p.exit).toBe(44);
	});
});

describe('the notation', () => {
	const others: Record<string, unknown> = {
		Bennett: bennettJson,
		Fischl: fischlJson,
		Kaeya: kaeyaJson,
		Sucrose: sucroseJson
	};
	const lookup = (name: string) =>
		name === 'Sandrone' ? sandrone : ((others[name] as CharacterData | undefined) ?? null);
	const charged = (notation: string) =>
		parseNotation(notation, lookup, 8, {}, {}, undefined).events.filter(
			(e): e is Extract<typeof e, { kind: 'action' }> =>
				e.kind === 'action' && e.action === 'charged'
		);

	// gcsim `toStellar`: in Radiance a beam's Durability is 0.
	describe('Fagio’s beams in Radiance', () => {
		const beamsOf = (notation: string) => {
			const r = parseNotation(notation, lookup, 8, {}, {}, undefined);
			const c = r.events.find((e) => e.kind === 'action' && e.action === 'charged')!;
			const beamAt = [c.time + 103, c.time + 163, c.time + 223];
			const cryo = r.applications.filter((a) => a.characterId === 'sandrone').map((a) => a.time);
			return { beamAt, cryo };
		};
		it('out of Radiance the first beam applies Cryo', () => {
			const { beamAt, cryo } = beamsOf('Sandrone C');
			expect(cryo).toContain(beamAt[0]);
		});
		it('inside a Polestar Field the beams apply nothing', () => {
			const { beamAt, cryo } = beamsOf('Fischl E > Sandrone C');
			expect(beamAt.filter((t) => cryo.includes(t))).toEqual([]);
		});
		it('after a Stellar Swirl the beams apply nothing', () => {
			const { beamAt, cryo } = beamsOf('Kaeya E > Sucrose E > Sandrone C');
			expect(beamAt.filter((t) => cryo.includes(t))).toEqual([]);
		});
	});

	it('a bare C ends at its last beam', () => {
		expect(charged('Sandrone C')[0].duration).toBe(224);
	});

	it('~Xs sets the hold and adds gcsim’s end lag', () => {
		expect(charged('Sandrone C ~1.5s D')[0].duration).toBe(134);
	});
});
