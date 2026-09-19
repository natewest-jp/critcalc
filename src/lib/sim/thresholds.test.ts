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
 * ↻ EXACT MODEL (same day, ⚓ Nate): the grant is an ACCRUAL — 10 per second
 * in 0.05 s polls while a 2 s status any matching reaction opens or refreshes
 * is live, into the last reaction's key, 13.4 at C2 — and the fire is
 * predicted and scheduled on the clock at the exact poll the sum crosses 60.
 * A Lunar-Charged tick refreshes it (gcsim hooks any Lunar-tagged damage).
 *
 * Seeded negatives, verified by hand (2026-09-18, exact model): SEE THE
 * RECORD's §5.5 for the list and what each fails.
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
import fischlJson from '$lib/data/characters/fischl.json';

const XIANGLING = xianglingJson as unknown as CharacterData;
const KAEYA = kaeyaJson as unknown as CharacterData;
const FISCHL = fischlJson as unknown as CharacterData;

const KEYS = ['gA', 'gB'];
const FIRE = { type: 'onStack', keys: KEYS, count: 60, label: 'Test Fire' };
/** Gravity's shape: 10 per second in 0.05 s polls while a 2 s status any
 *  matching reaction opens or refreshes is live, into the LAST reaction's
 *  key; 13.4 per second at C2. */
const grant = (reaction: string | string[], key: string) => ({
	type: 'gainStacks',
	target: 'self',
	trigger: { type: 'onReaction', reaction, source: 'team' },
	key,
	amount: 10,
	constellationScaling: { conditions: { type: 'constellation', level: 2 }, amount: 13.4 },
	max: 60,
	accrual: { group: 'test', window: 2 },
	conditions: { type: 'state', state: 'duringSummon' }
});
/** The poll on which a status opened at `t0` and kept live reaches `count`
 *  from `prior`, at `perPoll` per 3 frames — gcsim's grid, ours. */
const pollAt = (t0: number, prior: number, count = 60, perPoll = 0.5) =>
	t0 + 3 * (Math.ceil((count - prior) / perPoll - 1e-9) - 1);

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
		enablesReactions: ['lunarCharged'],
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
					grant(['vaporize', 'lunarCharged'], 'gA'),
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
		n === 'Tester'
			? stub
			: n === 'Xiangling'
				? XIANGLING
				: n === 'Kaeya'
					? KAEYA
					: n === 'Fischl'
						? FISCHL
						: null;
	const r = parseNotation(notation, lookup, 8, cons, undefined, [stub, XIANGLING, KAEYA, FISCHL]);
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

// One Guoba: four Vaporizes 1.67 s apart keep one status live from the first
// (each refresh lands inside the previous 2 s), so 60 is reached on poll 119 —
// 5.95 s after the first — while the fourth tick is still 1.7 s away from the
// status lapsing. The count model this replaced saw two grants and no fire.
const VAPORIZE = 'Tester E > Xiangling E ~20s';
// Three Frozens 6.5 s apart are three SEPARATE 2 s statuses of 40 polls each:
// 20 + 20 + 20, the fire on the third status's 40th poll, 117 frames after
// the third reaction — not at the reaction.
const FROZEN = 'Tester E > Kaeya E ~6.5s E ~6.5s E';
// Oz under a Lunar-Charged enabler: the reactions are sparse (Oz applies every
// third strike) but every Lunar-Charged TICK refreshes the status, so it stays
// live from the first reaction and 60 lands on poll 119.
const LUNAR = 'Tester E > Fischl E ~20s';

describe('a stack threshold fires, spends the set and records the fire', () => {
	it('Vaporize into key A: the sum reaches 60, the fire is dominant A, and the pool is spent', () => {
		const r = parse(VAPORIZE);
		const vap = reactions(r, 'vaporize');
		expect(vap.length).toBeGreaterThanOrEqual(3);
		const f = fires(r);
		expect(f.length).toBe(1);
		const ev = f[0];
		expect(ev.dominant).toBe('gA');
		expect(ev.keys).toEqual(KEYS);
		expect(ev.count).toBe(60);
		expect(ev.label).toBe('Test Fire');
		expect(ev.abilityClass).toBe('skill');
		// The fire lands on the GRID, between reactions — poll 119 of the status
		// the first Vaporize opened.
		expect(ev.time).toBe(pollAt(vap[0], 0));
		expect(vap).not.toContain(ev.time);
		// Spent: the status is still live after the fire (the last refresh + 2 s)
		// and keeps polling into the emptied pool; it lapses before a second 60.
		expect(vap[3] + 120).toBeGreaterThan(ev.time);
		expect(pollAt(ev.time + 3, 0)).toBeGreaterThanOrEqual(vap[3] + 120);
	});

	it("the rate scales with the holder's constellation: 13.4 per second at C2 is poll 90", () => {
		const r = parse(VAPORIZE, { tester: 2 });
		const vap = reactions(r, 'vaporize');
		expect(fires(r).map((e) => e.time)).toEqual([pollAt(vap[0], 0, 60, 13.4 * 0.05)]);
	});

	it('a Lunar-Charged tick refreshes the status the sparse reactions would let lapse', () => {
		const r = parse(LUNAR);
		const lc = reactions(r, 'lunarCharged');
		expect(lc.length).toBeGreaterThanOrEqual(2);
		// Sparse: at least one gap between reactions is longer than the 2 s window.
		const gaps = lc.slice(1).map((t, i) => t - lc[i]);
		expect(Math.max(...gaps)).toBeGreaterThan(120);
		// What the REACTIONS ALONE would give: statuses opened and refreshed by
		// reactions only, polled on each status's own grid.
		let start = -Infinity;
		let liveUntil = -Infinity;
		let polled = 0;
		let sum = 0;
		let reactionsOnly = -1;
		for (const t of lc) {
			if (t >= liveUntil) {
				if (Number.isFinite(start)) {
					const due = Math.floor((liveUntil - 1 - start) / 3) + 1;
					sum += (due - polled) * 0.5;
				}
				start = t;
				polled = 0;
			}
			liveUntil = t + 120;
			const n = Math.ceil((60 - sum) / 0.5 - 1e-9);
			const fireAt = start + 3 * (polled + n - 1);
			if (fireAt < liveUntil) {
				reactionsOnly = fireAt;
				break;
			}
		}
		expect(reactionsOnly).toBeGreaterThan(0);
		const f = fires(r).map((e) => e.time);
		expect(f.length).toBe(1);
		// The ticks kept the status alive past the last reaction's window while
		// the auras coexisted, so the fire is EARLIER than reactions alone give —
		// and later than one continuous status from the first, because the
		// Electro-Charged aura itself lapsed once (no aura, no tick).
		expect(f[0]).toBeLessThan(reactionsOnly);
		expect(f[0]).toBeGreaterThan(pollAt(lc[0], 0));
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
		// Three separate statuses of 20 each: the fire is the third's 40th poll.
		const fz = reactions(fro, 'frozen');
		expect(f[0].time).toBe(pollAt(fz[2], 40));
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

// ── a stack per fire (stack-count display round, 2026-09-19) ──
//
// Columbina's Lunacy: +5% CRIT Rate per Gravity Interference, up to three, on
// ONE 10 s status every Interference refreshes. The fire grants a rotation-
// scoped stack BEFORE its record is taken, the record carries the post-grant
// snapshot, and a `perStack` buff anchored on the fire prints that count.
describe('a gainStacks on the fire: the count steps, and the lifetime model decides how it falls', () => {
	// A threshold of 20 under a 10/s accrual fires every 2 s while the status
	// the Vaporizes keep live is up — three fires, 120 frames apart.
	const QUICK = { type: 'onStack', keys: KEYS, count: 20, label: 'Test Fire' };
	const stepper = (grantExtra: Record<string, unknown>): CharacterData =>
		tester({
			constellations: [],
			skill: { effects: [grant(['vaporize', 'lunarCharged'], 'gA'), grant('frozen', 'gB')] },
			passives: [
				{
					id: 'tester__passive__a1',
					name: 'Tester A1',
					abilityType: 'passive',
					effects: [
						{
							type: 'gainStacks',
							target: 'self',
							trigger: QUICK,
							key: 'lure',
							amount: 1,
							max: 3,
							scope: 'rotation',
							...grantExtra
						},
						{
							type: 'buff',
							target: 'self',
							trigger: QUICK,
							duration: 10,
							durationType: 'fixed',
							source: 'character',
							stat: 'critRate',
							value: { type: 'perStack', key: 'lure', per: 5, maxStacks: 3 },
							snapshottable: false
						}
					]
				}
			]
		});
	const lure = (r: ParsedRotation) => fires(r).map((e) => e.stackContext?.get('lure'));

	it('the fire records the post-grant count, capped at max, and the buff window carries it', () => {
		const r = parse(VAPORIZE, {}, stepper({}));
		const f = fires(r);
		expect(f.length).toBeGreaterThanOrEqual(3);
		expect(f[1].time - f[0].time).toBe(120);
		expect(lure(r).slice(0, 3)).toEqual([1, 2, 3]);
		expect(lure(r).every((n) => n !== undefined && n <= 3)).toBe(true);
		expect(
			fireBuffs(r)
				.slice(0, 3)
				.map((w) => w.stackContext?.get('lure'))
		).toEqual([1, 2, 3]);
	});

	it('lifetimeRefresh is the SHARED model — each fire carries every live stack forward', () => {
		// Fires 2 s apart, 3 s lifetime. Per instance, the first stack has died by
		// the third fire (4 s on): 1, 2, 2. Shared, the second fire moved it to
		// 5 s: 1, 2, 3.
		expect(lure(parse(VAPORIZE, {}, stepper({ lifetime: 3 }))).slice(0, 3)).toEqual([1, 2, 2]);
		expect(
			lure(parse(VAPORIZE, {}, stepper({ lifetime: 3, lifetimeRefresh: true }))).slice(0, 3)
		).toEqual([1, 2, 3]);
	});

	it('⚠️ a refresh never resurrects a stack that already ran out', () => {
		// 1 s lifetime against 2 s between fires: every stack is dead before the
		// next fire, refresh or no refresh.
		expect(
			lure(parse(VAPORIZE, {}, stepper({ lifetime: 1, lifetimeRefresh: true }))).slice(0, 3)
		).toEqual([1, 1, 1]);
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
	it('a gainStacks on the fire: rotation scope, not one of its own keys, refresh only beside a lifetime', () => {
		const withGrant = (g: Record<string, unknown>) =>
			tester({
				passives: [
					{
						id: 'tester__passive__a1',
						name: 'P',
						abilityType: 'passive',
						effects: [
							{ type: 'gainStacks', target: 'self', trigger: FIRE, amount: 1, max: 3, ...g }
						]
					}
				]
			});
		expect(
			strict(withGrant({ key: 'lure', scope: 'rotation', lifetime: 10, lifetimeRefresh: true }))
		).toEqual([]);
		expect(strict(withGrant({ key: 'lure' })).join('\n')).toMatch(/onstack-gainstacks-scope/);
		expect(strict(withGrant({ key: 'gA', scope: 'rotation' })).join('\n')).toMatch(
			/onstack-gainstacks-own-key/
		);
		expect(
			strict(withGrant({ key: 'lure', scope: 'rotation', lifetimeRefresh: true })).join('\n')
		).toMatch(/gainstacks-lifetime-refresh-invalid/);
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
