/**
 * The cooldown-reduction round (2026-09-18) — `cooldownReduce` has a reader,
 * charges recharge one at a time, a sibling can `startsOnCooldown`, and a
 * `procCap` counts fires per stance. Synthetic characters throughout, so the
 * assertions survive corpus re-authoring; the Varka/Raiden shapes are measured
 * in `docs/cooldown-reduction-round.md` §5.
 */
import { describe, it, expect } from 'vitest';
import { parseNotation, type ParsedRotation } from '$lib/utils/notationParser';
import type { CharacterData } from '$lib/types/character';
import type { CastEvent } from '$lib/utils/rotationEvents';
import { lintCharacter } from '$lib/utils/characterLint';
import xianglingJson from '$lib/data/characters/xiangling.json';
import kaeyaJson from '$lib/data/characters/kaeya.json';

const XIANGLING = xianglingJson as unknown as CharacterData;
const KAEYA = kaeyaJson as unknown as CharacterData;

const SKILL_FRAMES = { anim: 42, N: 38, C: 38, Q: 38, D: 37, J: 38, swap: 36 };
const NORMAL = {
	id: 'tester__normal__base',
	name: 'Tester Normal',
	abilityType: 'normal',
	input: ['N'],
	hits: [{ name: 'N1', frames: { anim: 30, hit: 12 } }]
};
const BURST = {
	id: 'tester__burst__q',
	name: 'Tester Burst',
	abilityType: 'burst',
	input: ['Q'],
	behavior: 'instant',
	frames: { anim: 60, swap: 50 },
	cooldown: 15,
	energyCost: 60
};

/** A stance skill (10s window, 12s cd), a sibling skill available in it, and
 *  whatever effects the case authors on the C1 entry. */
function tester(opts: {
	c1?: unknown[];
	sibling?: Record<string, unknown>;
	stanceCharges?: number;
	burst?: Record<string, unknown>;
}): CharacterData {
	return {
		id: 'tester',
		displayName: 'Tester',
		element: 'anemo',
		weapon: 'claymore',
		passives: [],
		constellations: [
			{
				id: 'tester__constellation__c1',
				name: 'Tester C1',
				abilityType: 'constellation',
				constellationLevel: 1,
				effects: opts.c1 ?? []
			}
		],
		abilities: [
			NORMAL,
			{
				id: 'tester__skill__stance',
				name: 'Tester Stance',
				abilityType: 'skill',
				input: ['E'],
				behavior: 'stance',
				duration: 10,
				frames: SKILL_FRAMES,
				cooldown: 12,
				cooldownStartDelay: 6,
				terminatesOnSwap: false,
				charges: opts.stanceCharges,
				effects: []
			},
			// The sibling is OPT-IN: while it exists, an in-stance E resolves to
			// it, which is the Four Winds shape and not the one most cases want.
			...(opts.sibling
				? [
						{
							id: 'tester__skill__sibling',
							name: 'Tester Sibling',
							abilityType: 'skill',
							input: ['sE', 'E'],
							behavior: 'instant',
							frames: SKILL_FRAMES,
							cooldown: 5,
							conditions: { type: 'state', state: 'inStance' },
							effects: [],
							...opts.sibling
						}
					]
				: []),
			{ ...BURST, ...(opts.burst ?? {}) }
		]
	} as unknown as CharacterData;
}

function parse(
	notation: string,
	stub: CharacterData,
	cons: Record<string, number> = {}
): ParsedRotation {
	const lookup = (n: string) =>
		n === 'Tester' ? stub : n === 'Xiangling' ? XIANGLING : n === 'Kaeya' ? KAEYA : null;
	return parseNotation(notation, lookup, 8, cons, undefined, [stub, XIANGLING, KAEYA]);
}
const casts = (r: ParsedRotation, id: string): CastEvent[] =>
	r.events.filter((e): e is CastEvent => e.kind === 'cast' && e.abilityId === id);
const strict = (c: CharacterData) => lintCharacter(c).filter((i) => i.severity === 'strict');

const reduceOnHit = (extra: Record<string, unknown> = {}) => ({
	type: 'cooldownReduce',
	source: 'character',
	target: 'self',
	trigger: { type: 'onHit', abilityType: 'normal' },
	conditions: { type: 'state', state: 'inStance' },
	amount: 1,
	reduces: 'skill',
	...extra
});

describe('charges recharge one at a time', () => {
	it('a charge spent while another recharges starts its clock when that one ends', () => {
		const stub = tester({ stanceCharges: 2 });
		const r = parse('Tester E E E', stub);
		const [a, b, c] = casts(r, 'tester__skill__stance');
		// first charge: cast + delay + cd
		expect(a.readyAt).toBe(a.time + 6 + 12 * 60);
		// second charge: chained behind the first, not started at its own delay
		expect(b.readyAt).toBe(a.readyAt + 12 * 60);
		// the third E waits for the first charge, not for a ready-at-zero slot
		expect(c.time).toBe(a.readyAt);
	});
});

describe('cooldownReduce on a hit', () => {
	it('shortens the running cooldown AND the cast tail, and records how much', () => {
		const stub = tester({ c1: [reduceOnHit()] });
		const r = parse('Tester E N1 N1 N1', stub, { tester: 1 });
		const [e] = casts(r, 'tester__skill__stance');
		// three in-stance swings, 1s each
		expect(e.cdReduced).toBe(180);
		expect(e.readyAt).toBe(e.time + 6 + 12 * 60 - 180);
	});
	it('is a no-op while the cooldown is not running', () => {
		const stub = tester({ c1: [reduceOnHit({ conditions: undefined })] });
		const r = parse('Tester N1 N1 E', stub, { tester: 1 });
		const [e] = casts(r, 'tester__skill__stance');
		expect(e.cdReduced).toBeUndefined();
	});
	it('does nothing below the constellation that unlocks it', () => {
		const stub = tester({ c1: [reduceOnHit()] });
		const r = parse('Tester E N1 N1 N1', stub, { tester: 0 });
		expect(casts(r, 'tester__skill__stance')[0].cdReduced).toBeUndefined();
	});
	it('procCooldown says how often, procCap says how many per stance', () => {
		const stub = tester({
			c1: [reduceOnHit({ procCooldown: 1, procCap: { count: 2, per: 'stance' } })]
		});
		// N1 swings are 30f apart: the 1s procCooldown admits the first and the
		// third-ish swing; the cap of 2 per stance stops there in the first stance.
		const r = parse(
			'Tester E N1 N1 N1 N1 N1 N1 N1 N1 N1 N1 N1 N1 N1 N1 N1 N1 N1 N1 N1 N1 N1 N1 N1 N1 N1 N1 N1 N1 N1 N1 N1 N1 N1 N1 N1 N1 N1 N1 N1 N1 N1 N1 N1 N1 N1 N1 N1 N1',
			stub,
			{
				tester: 1
			}
		);
		const [e1] = casts(r, 'tester__skill__stance');
		expect(e1.cdReduced).toBe(120);
	});
	it('the count resets when a new stance opens', () => {
		const stub = tester({ c1: [reduceOnHit({ procCap: { count: 1, per: 'stance' } })] });
		const r = parse('Tester E N1 N1 > Xiangling E > Tester E N1 N1', stub, { tester: 1 });
		const [e1, e2] = casts(r, 'tester__skill__stance');
		expect(e1.cdReduced).toBe(60);
		expect(e2.cdReduced).toBe(60);
	});
	it("reaches a teammate's burst with target teamExcludingSelf", () => {
		const stub = tester({
			c1: [reduceOnHit({ target: 'teamExcludingSelf', reduces: 'burst', amount: 2 })]
		});
		const r = parse('Kaeya Q > Tester E N1 N1', stub, { tester: 1 });
		const [kq] = r.events.filter(
			(e): e is CastEvent => e.kind === 'cast' && e.characterId === 'kaeya' && e.ability === 'burst'
		);
		expect(kq.cdReduced).toBe(240);
		// and not its own
		expect(casts(r, 'tester__skill__stance')[0].cdReduced).toBeUndefined();
	});
	it('the skill it moves is the one ACTIVE at the fire — the in-stance sibling', () => {
		const stub = tester({
			c1: [reduceOnHit()],
			sibling: { startsOnCooldown: true, cooldown: 5 }
		});
		const r = parse('Tester E N1 N1 N1 sE', stub, { tester: 1 });
		const [stance] = casts(r, 'tester__skill__stance');
		const [sib] = casts(r, 'tester__skill__sibling');
		// the stance skill's own clock is untouched: the active skill in
		// Sturm-und-Drang-shaped windows is the sibling
		expect(stance.cdReduced).toBeUndefined();
		// sibling starts on cooldown at stance start + the base's delay, 5s;
		// three swings cut 3s off it, so it lands at start + 6 + 120
		expect(sib.time).toBe(stance.time + 6 + 300 - 180);
	});
});

describe('startsOnCooldown', () => {
	it('writes the sibling queue as one chain from the stance clock', () => {
		const stub = tester({ sibling: { startsOnCooldown: true, cooldown: 5, charges: 2 } });
		const r = parse('Tester E sE sE', stub);
		const [stance] = casts(r, 'tester__skill__stance');
		const [s1, s2] = casts(r, 'tester__skill__sibling');
		expect(s1.time).toBe(stance.time + 6 + 300);
		// the second charge is 5s behind the first, which is past the 10s stance:
		// the token falls out of the stance and resolves to the base skill wait
		expect(s2).toBeUndefined();
	});
	it('lint refuses it off a stance-gated sibling', () => {
		const stub = tester({ sibling: { startsOnCooldown: true, conditions: undefined } });
		expect(strict(stub).map((i) => i.check)).toContain('starts-on-cooldown-stance');
	});
});

describe('cooldownReduce on a cast and on a reaction', () => {
	it('an onCast on the own burst shortens the clock it just wrote', () => {
		const stub = tester({
			c1: [
				{
					type: 'cooldownReduce',
					source: 'character',
					target: 'self',
					trigger: { type: 'onCast', ability: 'burst' },
					amount: 4.5
				}
			]
		});
		const r = parse('Tester Q', stub, { tester: 1 });
		const [q] = casts(r, 'tester__burst__q');
		expect(q.readyAt).toBe(q.time + 15 * 60 - 270);
		expect(q.cdReduced).toBe(270);
	});
	it("an onReaction with source team hears a teammate's reaction", () => {
		const stub = tester({
			c1: [
				{
					type: 'cooldownReduce',
					source: 'character',
					target: 'self',
					trigger: { type: 'onReaction', reaction: 'melt', source: 'team' },
					amount: 1,
					reduces: 'skill',
					procCooldown: 3
				}
			]
		});
		// Xiangling's Guoba applies Pyro; Kaeya's E on it melts.
		const r = parse('Tester E > Xiangling E > Kaeya E', stub, { tester: 1 });
		const reactions = r.events.filter((e) => e.kind === 'reaction' && e.reaction === 'melt');
		expect(reactions.length).toBeGreaterThan(0);
		const [e] = casts(r, 'tester__skill__stance');
		expect(e.cdReduced).toBe(60);
	});
});

describe('lint', () => {
	it('refuses a cooldownReduce that does not say what it reduces', () => {
		const stub = tester({ c1: [reduceOnHit({ reduces: undefined })] });
		expect(strict(stub).map((i) => i.check)).toContain('cooldownreduce-reduces-missing');
	});
	it('refuses a per-stance cap with no stance to count in', () => {
		const stub = tester({
			c1: [reduceOnHit({ conditions: undefined, procCap: { count: 3, per: 'stance' } })]
		});
		expect(strict(stub).map((i) => i.check)).toContain('proccap-stance-condition');
	});
	it('accepts the authored shape', () => {
		const stub = tester({
			c1: [reduceOnHit({ procCooldown: 1, procCap: { count: 5, per: 'stance' } })],
			sibling: { startsOnCooldown: true }
		});
		expect(strict(stub).map((i) => `${i.check}: ${i.message}`)).toEqual([]);
	});
});
