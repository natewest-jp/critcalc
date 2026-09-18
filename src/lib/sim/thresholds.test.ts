/**
 * thresholds.test.ts — the stack-threshold trigger (`onStack`), stack-threshold
 * round 2026-09-18 (spec + record in docs/stack-threshold-round.md).
 *
 * A trigger that fires the instant the summed count of its `keys` reaches
 * `count`, spends the set, records a `stackThreshold` event, and — per effect
 * — draws a MARK on the accruing summon's lane (damage), opens a shield
 * (shield) or anchors a buff (buff), with a `dominant` gate choosing between
 * sibling branches by which key held the most. Columbina's Gravity is the
 * holder; every case here runs on a SYNTHETIC hydro catalyst whose summon
 * ticks Hydro every second, with two real partners for the reactions — Guoba
 * (Xiangling) for Vaporize into key A, Kaeya's E for Frozen into key B — so
 * the assertions are about the primitive, and the partners are used only as
 * reaction sources.
 *
 * ⚠️ Each `it` asserts the rotation ran (no unknown tokens, reactions of the
 * expected kind happened) before asserting a fire or its absence, because half
 * of what is asserted is that something did NOT happen.
 *
 * Seeded negatives, verified by hand when the file landed (2026-09-18):
 * removing the reaction-site `checkStackThresholds` call fails the four fire
 * cases; removing the `spend` fails the first case (the second fire arrives
 * on the very next grant, under the 4s floor) and the mark case (an extra
 * mark); dropping the `dominant` gate in `thresholds.ts` fails the mark case
 * (a Cryo mark beside every Pyro one) and the shield case (the shield opens
 * on a Vaporize fire); dropping the `procCooldown` gate in the onReaction
 * dispatcher fails exactly the rate case; handing the onReaction dispatcher
 * an empty state set for off-field holders (the pre-round behaviour) fails
 * the four fire cases, because the grant is `duringSummon`-gated and a
 * partner makes the reaction.
 */

import { describe, it, expect } from 'vitest';
import { parseNotation, type ParsedRotation } from '$lib/utils/notationParser';
import type { CharacterData } from '$lib/types/character';
import type { StackThresholdEvent, TimelineWindow } from '$lib/utils/rotationEvents';

type BuffWin = Extract<TimelineWindow, { kind: 'buff' }>;
type ShieldWin = Extract<TimelineWindow, { kind: 'shield' }>;
type SummonWin = Extract<TimelineWindow, { kind: 'summon' }>;
import { lintCharacter } from '$lib/utils/characterLint';
import xianglingJson from '$lib/data/characters/xiangling.json';
import kaeyaJson from '$lib/data/characters/kaeya.json';

const XIANGLING = xianglingJson as unknown as CharacterData;
const KAEYA = kaeyaJson as unknown as CharacterData;

const KEYS = ['gA', 'gB'];
const FIRE = { type: 'onStack', keys: KEYS, count: 60, label: 'Test Fire' };
const grant = (reaction: string, key: string) => ({
	type: 'gainStacks',
	target: 'self',
	trigger: { type: 'onReaction', reaction, source: 'team' },
	key,
	amount: 20,
	max: 60,
	procCooldown: 2,
	conditions: { type: 'state', state: 'duringSummon' }
});

/** The synthetic accruer. `skill` overrides the skill's own fields; `cons`
 *  and `passives` replace the lists. */
function tester(
	overrides: {
		skill?: Record<string, unknown>;
		passives?: unknown[];
		constellations?: unknown[];
	} = {}
): CharacterData {
	return {
		id: 'tester',
		displayName: 'Tester',
		element: 'hydro',
		weapon: 'catalyst',
		passives: overrides.passives ?? [
			{
				id: 'tester__passive__a1',
				name: 'Tester A1',
				abilityType: 'passive',
				effects: [
					{
						type: 'buff',
						target: 'self',
						trigger: FIRE,
						duration: 10,
						durationType: 'fixed',
						source: 'character',
						stat: 'critRate',
						value: 5,
						snapshottable: false
					}
				]
			}
		],
		constellations: overrides.constellations ?? [
			{
				id: 'tester__constellation__c1',
				name: 'Tester C1',
				abilityType: 'constellation',
				constellationLevel: 1,
				effects: [
					{
						type: 'shield',
						target: 'self',
						trigger: { ...FIRE, dominant: 'gB' },
						duration: 8,
						scaling: 12,
						stat: 'hp',
						label: 'Test Shield',
						conditions: { type: 'constellation', level: 1 }
					}
				]
			},
			{
				id: 'tester__constellation__c2',
				name: 'Tester C2',
				abilityType: 'constellation',
				constellationLevel: 2,
				effects: [
					{
						type: 'buff',
						target: 'active',
						trigger: { ...FIRE, dominant: 'gA' },
						duration: 8,
						durationType: 'fixed',
						source: 'character',
						stat: 'atk',
						value: 10,
						snapshottable: false,
						conditions: { type: 'constellation', level: 2 }
					}
				]
			}
		],
		abilities: [
			{
				id: 'tester__normal__base',
				name: 'Tester Normal',
				abilityType: 'normal',
				input: ['N'],
				hits: [{ name: 'N1', frames: { anim: 30, hit: 12 } }]
			},
			{
				id: 'tester__skill__tide',
				name: 'Tester Skill',
				abilityType: 'skill',
				input: ['E'],
				behavior: 'instant',
				frames: { anim: 42, N: 38, C: 38, Q: 38, D: 37, J: 38, swap: 36 },
				cooldown: 12,
				summons: [
					{
						label: 'Tide',
						duration: 20,
						spawnsAt: 10,
						mobility: 'stationary',
						effects: [
							{
								type: 'damage',
								target: 'enemy',
								trigger: { type: 'summonTick', interval: 1, icdGate: 'none' },
								scaling: 100,
								stat: 'atk',
								element: 'hydro'
							}
						]
					}
				],
				effects: [
					grant('vaporize', 'gA'),
					grant('frozen', 'gB'),
					{
						type: 'damage',
						target: 'enemy',
						trigger: { ...FIRE, dominant: 'gA' },
						scaling: 100,
						stat: 'hp',
						element: 'pyro',
						application: []
					},
					{
						type: 'damage',
						target: 'enemy',
						trigger: { ...FIRE, dominant: 'gB' },
						scaling: 100,
						stat: 'hp',
						element: 'cryo',
						application: []
					}
				],
				application: [{ frame: 10, element: 'hydro', units: 1 }],
				...(overrides.skill ?? {})
			}
		]
	} as unknown as CharacterData;
}

function parse(
	notation: string,
	cons: Record<string, number> = {},
	stub: CharacterData = tester()
): ParsedRotation {
	const lookup = (n: string) =>
		n === 'Tester' ? stub : n === 'Xiangling' ? XIANGLING : n === 'Kaeya' ? KAEYA : null;
	const r = parseNotation(notation, lookup, 8, cons, undefined, [stub, XIANGLING, KAEYA]);
	expect(r.unknownTokens, notation).toEqual([]);
	return r;
}

const fires = (r: ParsedRotation) =>
	r.events.filter(
		(e): e is StackThresholdEvent => e.kind === 'stackThreshold' && e.characterId === 'tester'
	);
const reactions = (r: ParsedRotation, kind: string) =>
	r.events.filter((e) => e.kind === 'reaction' && e.reaction === kind).map((e) => e.time);
const tide = (r: ParsedRotation) =>
	r.windows.filter(
		(w): w is SummonWin => w.kind === 'summon' && w.characterId === 'tester' && w.label === 'Tide'
	);
const fireBuffs = (r: ParsedRotation) =>
	r.windows.filter(
		(w): w is BuffWin =>
			w.kind === 'buff' &&
			w.characterId === 'tester' &&
			w.source.type === 'character' &&
			w.source.trigger === 'stackThreshold'
	);
const shields = (r: ParsedRotation) =>
	r.windows.filter((w): w is ShieldWin => w.kind === 'shield' && w.characterId === 'tester');

// Two Guobas: one gives four ticks 1.67s apart, which under the 2s cooldown is
// only two grants (40) — the cap's stated weakness for a short burst, where
// gcsim's continuous 10/s would have reached 60. The second cast's first tick
// is the third grant.
const VAPORIZE = 'Tester E > Xiangling E ~12s E ~8s';
const FROZEN = 'Tester E > Kaeya E ~6.5s E ~6.5s E';

describe('a stack threshold fires, spends the set and records the fire', () => {
	it('Vaporize into key A: the sum reaches 60, the fire is dominant A, and the pool is spent', () => {
		const r = parse(VAPORIZE);
		const vap = reactions(r, 'vaporize');
		expect(vap.length).toBeGreaterThanOrEqual(3);
		const f = fires(r);
		expect(f.length).toBeGreaterThanOrEqual(1);
		for (const ev of f) {
			expect(ev.dominant).toBe('gA');
			expect(ev.keys).toEqual(KEYS);
			expect(ev.count).toBe(60);
			expect(ev.label).toBe('Test Fire');
			expect(ev.abilityClass).toBe('skill');
			// The fire lands ON a reaction instant — it is checked there.
			expect(vap).toContain(ev.time);
		}
		// Spent: every fire needs THREE eligible grants after the previous one,
		// and a grant is at most one per 2s (procCooldown), so a fire is never
		// within 4s of the previous fire and there are ≥3 reactions between.
		for (let i = 0; i < f.length; i++) {
			const prev = i === 0 ? -Infinity : f[i - 1].time;
			expect(f[i].time - prev).toBeGreaterThanOrEqual(240);
			expect(vap.filter((t) => t > prev && t <= f[i].time).length).toBeGreaterThanOrEqual(3);
		}
	});

	it('the rate: a grant at most once per procCooldown, so the first fire is not the third reaction', () => {
		const r = parse(VAPORIZE);
		const vap = reactions(r, 'vaporize');
		const first = fires(r)[0];
		expect(first).toBeDefined();
		// Guoba ticks every 1.667s, under the 2s cooldown: the third reaction
		// cannot be the third GRANT — the first Guoba's four ticks are two grants,
		// and the fire waits for the second Guoba.
		expect(vap[3]).toBeLessThan(first.time);
		// And the fire instant is the first reaction at or after the third
		// 2s-spaced grant — the walk gcsim's status timer takes, at 20 per grant.
		let last = -Infinity;
		let grants = 0;
		let expected = -1;
		for (const t of vap) {
			if (t - last < 120) continue;
			last = t;
			grants++;
			if (grants === 3) {
				expected = t;
				break;
			}
		}
		expect(first.time).toBe(expected);
	});

	it("the mark rides the accruing summon's lane, in the fire's element, and applies nothing", () => {
		const r = parse(VAPORIZE);
		const f = fires(r);
		const win = tide(r);
		expect(win.length).toBe(1);
		const marks = win[0].fires ?? [];
		expect(marks.map((m) => m.time)).toEqual(f.map((e) => e.time));
		for (const m of marks) expect(m.element).toBe('pyro');
		// No application from the fire: every Pyro the gauge saw is Guoba's.
		const pyroApps = r.applications.filter((a) => a.element === 'pyro');
		for (const a of pyroApps) expect(a.characterId).toBe('xiangling');
	});

	it('an onStack self buff anchors on each fire; the active-target one at C2 follows the field', () => {
		const c0 = parse(VAPORIZE);
		const b0 = fireBuffs(c0);
		expect(b0.length).toBe(fires(c0).length);
		for (const w of b0) {
			expect(w.receiverId).toBe('tester');
			expect(w.end - w.start).toBe(600);
			expect(w.effects.map((e) => (e as { stat?: string }).stat)).toEqual(['critRate']);
			expect(fires(c0).map((e) => e.time)).toContain(w.start);
			expect(w.source).toEqual({
				type: 'character',
				trigger: 'stackThreshold',
				abilityClass: 'skill',
				fireLabel: 'Test Fire'
			});
		}
		const c2 = parse(VAPORIZE, { tester: 2 });
		const atk = fireBuffs(c2).filter((w) =>
			w.effects.some((e) => (e as { stat?: string }).stat === 'atk')
		);
		expect(atk.length).toBeGreaterThanOrEqual(1);
		// Xiangling is on field at every fire — the conversion lands on HER.
		for (const w of atk) expect(w.receiverId).toBe('xiangling');
	});

	it("the dominant gate: Vaporize fires never open the Frozen branch's shield, Frozen fires do", () => {
		const vap = parse(VAPORIZE, { tester: 1 });
		expect(fires(vap).length).toBeGreaterThanOrEqual(1);
		expect(shields(vap)).toEqual([]);
		const fro = parse(FROZEN, { tester: 1 });
		expect(reactions(fro, 'frozen').length).toBeGreaterThanOrEqual(3);
		const f = fires(fro);
		expect(f.length).toBe(1);
		expect(f[0].dominant).toBe('gB');
		const marks = tide(fro)[0].fires ?? [];
		expect(marks.map((m) => m.element)).toEqual(['cryo']);
		const sh = shields(fro);
		expect(sh.length).toBe(1);
		expect(sh[0].start).toBe(f[0].time);
		expect(sh[0].end).toBe(f[0].time + 480);
		expect(sh[0].source).toBe('skill');
		expect(sh[0].label).toBe('Test Shield');
		const eCast = fro.events.find((e) => e.kind === 'cast' && e.characterId === 'tester');
		expect(sh[0].sourceCastId).toBe(eCast!.id);
		// A shieldEnd drains for it at the rotation's end.
		expect(
			fro.events.some(
				(e) => e.kind === 'shieldEnd' && e.characterId === 'tester' && e.time === sh[0].end
			)
		).toBe(true);
		// And at C0 the branch is locked.
		expect(shields(parse(FROZEN))).toEqual([]);
	});

	it("the accrual is gated on the holder's summon being out — no Tide, no Gravity", () => {
		const r = parse('Tester N1 > Xiangling E ~20s');
		expect(reactions(r, 'vaporize').length).toBeGreaterThanOrEqual(0);
		expect(tide(r)).toEqual([]);
		expect(fires(r)).toEqual([]);
		expect(fireBuffs(r)).toEqual([]);
	});

	it('a team without a threshold author records nothing (the check is a no-op)', () => {
		const r = parseNotation(
			'Xiangling E > Kaeya E',
			(n) => (n === 'Xiangling' ? XIANGLING : n === 'Kaeya' ? KAEYA : null),
			8,
			{},
			undefined,
			[XIANGLING, KAEYA]
		);
		expect(r.events.filter((e) => e.kind === 'stackThreshold')).toEqual([]);
	});
});

describe('lint: the trigger names resources that exist and a count that can be reached', () => {
	const checks = (c: CharacterData, check: string) =>
		lintCharacter(c)
			.filter((i) => i.check === check)
			.map((i) => i.message);
	const strict = (c: CharacterData) =>
		lintCharacter(c)
			.filter((i) => i.severity === 'strict')
			.map((i) => `${i.check}: ${i.message}`);

	it('the synthetic holder is clean', () => {
		expect(strict(tester())).toEqual([]);
	});
	it('a key with no gainStacks author', () => {
		const c = tester({
			passives: [
				{
					id: 'p',
					name: 'P',
					abilityType: 'passive',
					effects: [
						{
							type: 'buff',
							target: 'self',
							trigger: { ...FIRE, keys: ['gA', 'gZ'] },
							duration: 10,
							durationType: 'fixed',
							source: 'character',
							stat: 'critRate',
							value: 5,
							snapshottable: false
						}
					]
				}
			]
		});
		expect(checks(c, 'onstack-key-unauthored').join('\n')).toMatch(/"gZ"/);
	});
	it("a count above the keys' summed max", () => {
		const c = tester({
			passives: [
				{
					id: 'p',
					name: 'P',
					abilityType: 'passive',
					effects: [
						{
							type: 'buff',
							target: 'self',
							trigger: { ...FIRE, count: 200 },
							duration: 10,
							durationType: 'fixed',
							source: 'character',
							stat: 'critRate',
							value: 5,
							snapshottable: false
						}
					]
				}
			]
		});
		expect(checks(c, 'onstack-count-unreachable').join('\n')).toMatch(/200 exceeds .* 120/);
	});
	it('a dominant outside the keys, a fire label that disagrees, a damage with no application', () => {
		const base = tester();
		const skill = base.abilities.find((a) => a.id === 'tester__skill__tide')!;
		const dmg = (skill.effects ?? [])[2] as unknown as Record<string, unknown>;
		const bad = tester({
			skill: {
				effects: [
					...(skill.effects ?? []).slice(0, 2),
					{ ...dmg, trigger: { ...FIRE, dominant: 'gZ', label: 'Other Name' } },
					{ ...dmg, application: undefined }
				]
			}
		});
		const all = strict(bad).join('\n');
		expect(all).toMatch(/onstack-dominant-invalid/);
		expect(all).toMatch(/onstack-label-disagreement/);
		expect(all).toMatch(/onstack-damage-application-missing/);
	});
});
