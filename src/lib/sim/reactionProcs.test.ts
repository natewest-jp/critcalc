/**
 * reactionProcs.test.ts — the selection half of the FOURTH application source.
 *
 * ⚓ TWO HALVES, AND THE SPLIT IS DELIBERATE. `takeReactionProcs` decides WHICH
 * armed listeners a reaction fires; `aura.ts` then schedules their hits. The
 * first describe blocks cover the decision, which is pure and hand-buildable and
 * where every rule of the mechanism lives. The last one drives the REAL CORPUS
 * end to end through `parseNotation` — ⛔ never a fabricated character, which
 * would test the fixture rather than the data.
 *
 * ⚠️ `source: 'active'` is the rule worth the most attention: it is NOT
 * "`'team'` narrowed by id", and getting that wrong is what gcsim does. Every
 * Thundering Retribution in the oracle fires 4 frames after an OZ application,
 * because gcsim compares Oz's `ActorIndex` — Fischl's — against the active
 * character. The `viaEntity` cases below are that defect, pinned.
 */

import { describe, it, expect } from 'vitest';
import type { Effect } from '$lib/types/ability';
import type { CharacterData } from '$lib/types/character';
import { parseNotation } from '$lib/utils/notationParser';
import type { SimContext } from './context';
import {
	reactionProcEffects,
	takeReactionProcs,
	type ReactionProcEffect,
	type ReactionProcListener
} from './reactionProcs';

/** A `damage` + `onReaction` + `application[]` effect — the accepted shape. */
const procEffect = (over: Partial<ReactionProcEffect> = {}): Effect =>
	({
		type: 'damage',
		trigger: { type: 'onReaction', reaction: 'any', armedFor: 25 },
		target: 'enemy',
		scaling: 100,
		stat: 'atk',
		element: 'dendro',
		application: [{ frame: 3, element: 'dendro', units: 1.5 }],
		...over
	}) as Effect;

const listener = (
	effect: Effect,
	over: Partial<ReactionProcListener> = {}
): ReactionProcListener => ({
	holderId: 'holder',
	effect: effect as ReactionProcEffect,
	start: 0,
	endNow: () => 1500,
	isCurrent: () => true,
	lastFire: -Infinity,
	preStates: new Set<string>(),
	constellation: 0,
	chainIdx: new Map(),
	castKind: 'skill',
	...over
});

const ctxWith = (listeners: ReactionProcListener[], activeCharId?: string): SimContext =>
	({
		reactionProcs: new Map(listeners.map((l) => [l.effect as Effect, l])),
		activeCharId
	}) as unknown as SimContext;

describe('reactionProcEffects — the one acceptance rule', () => {
	it('takes a damage + onReaction effect that carries an application[]', () => {
		expect(reactionProcEffects([procEffect()], 0, new Set())).toHaveLength(1);
	});

	it('refuses one with no application[] — that is how every other damage effect stays inert', () => {
		const bare = procEffect();
		delete (bare as { application?: unknown }).application;
		expect(reactionProcEffects([bare], 0, new Set())).toHaveLength(0);
		expect(reactionProcEffects([procEffect({ application: [] })], 0, new Set())).toHaveLength(0);
	});

	it('refuses a non-damage effect and a non-onReaction trigger', () => {
		const buff = { ...(procEffect() as object), type: 'buff' } as Effect;
		expect(reactionProcEffects([buff], 0, new Set())).toHaveLength(0);
		const onCast = procEffect({
			trigger: { type: 'onCast' } as unknown as ReactionProcEffect['trigger']
		});
		expect(reactionProcEffects([onCast], 0, new Set())).toHaveLength(0);
	});

	it('drops a definitively-false condition but arms an unresolvable one', () => {
		const gated = procEffect({ conditions: { type: 'constellation', level: 6 } });
		expect(reactionProcEffects([gated], 0, new Set())).toHaveLength(0);
		expect(reactionProcEffects([gated], 6, new Set())).toHaveLength(1);
		// `enemyHpBelow` resolves to null — optimistic, like every other gate.
		const unresolvable = procEffect({ conditions: { type: 'enemyHpBelow', threshold: 50 } });
		expect(reactionProcEffects([unresolvable], 0, new Set())).toHaveLength(1);
	});
});

describe('takeReactionProcs — the arming window', () => {
	it('fires inside [start, end) and never at or after the end', () => {
		const l = listener(procEffect(), { start: 60, endNow: () => 1560 });
		const ctx = ctxWith([l]);
		const at = (t: number) =>
			takeReactionProcs(ctx, { characterId: 'holder', viaEntity: false }, 'bloom', t).length;
		expect(at(59)).toBe(0);
		expect(at(60)).toBe(1);
		l.lastFire = -Infinity;
		expect(at(1559)).toBe(1);
		l.lastFire = -Infinity;
		// ⚓ Half-open, matching the summon chain's own liveness test.
		expect(at(1560)).toBe(0);
	});

	it('stops when the host summon has been superseded by a recast', () => {
		let current = true;
		const ctx = ctxWith([listener(procEffect(), { isCurrent: () => current })]);
		const at = (t: number) =>
			takeReactionProcs(ctx, { characterId: 'holder', viaEntity: false }, 'bloom', t).length;
		expect(at(10)).toBe(1);
		current = false;
		expect(at(400)).toBe(0);
	});
});

describe('takeReactionProcs — the source filter', () => {
	const fire = (ctx: SimContext, characterId: string, viaEntity: boolean, time = 10): number =>
		takeReactionProcs(ctx, { characterId, viaEntity }, 'aggravate', time).length;

	it("'self' (the default) takes only the holder's own reactions", () => {
		const ctx = ctxWith([listener(procEffect())]);
		expect(fire(ctx, 'someone-else', false)).toBe(0);
		expect(fire(ctx, 'holder', false)).toBe(1);
	});

	it("'team' takes anyone's — Tri-Karma fires on a reaction nobody on the team owns", () => {
		const eff = procEffect({
			trigger: { type: 'onReaction', reaction: 'any', source: 'team', armedFor: 25 }
		});
		const ctx = ctxWith([listener(eff)]);
		expect(fire(ctx, 'someone-else', false)).toBe(1);
	});

	it("'active' takes the on-field character's OWN hit", () => {
		const eff = procEffect({
			trigger: { type: 'onReaction', reaction: 'any', source: 'active' }
		});
		const ctx = ctxWith([listener(eff)], 'fischl');
		expect(fire(ctx, 'fischl', false)).toBe(1);
	});

	it("⚓ 'active' REFUSES an entity-delivered application, even from the active character", () => {
		// ⚠️⚠️ THE CASE THE MECHANISM EXISTS FOR. Oz's ticks carry Fischl's
		// characterId, so an id comparison alone says "the active character
		// triggered this" — which is gcsim's defect and not the game's rule.
		const eff = procEffect({
			trigger: { type: 'onReaction', reaction: 'any', source: 'active' }
		});
		const ctx = ctxWith([listener(eff)], 'fischl');
		expect(fire(ctx, 'fischl', true)).toBe(0);
	});

	it("'active' refuses the holder's own hit while somebody else is on field", () => {
		const eff = procEffect({
			trigger: { type: 'onReaction', reaction: 'any', source: 'active' }
		});
		const ctx = ctxWith([listener(eff)], 'barbara');
		expect(fire(ctx, 'fischl', false)).toBe(0);
	});
});

describe('takeReactionProcs — the reaction filter and the cooldown', () => {
	it('matches a list, and refuses a reaction outside it', () => {
		const eff = procEffect({
			trigger: {
				type: 'onReaction',
				reaction: ['overloaded', 'aggravate'],
				source: 'team',
				armedFor: 25
			}
		});
		const ctx = ctxWith([listener(eff)]);
		const at = (r: Parameters<typeof takeReactionProcs>[2], t: number) =>
			takeReactionProcs(ctx, { characterId: 'x', viaEntity: false }, r, t).length;
		expect(at('vaporize', 10)).toBe(0);
		expect(at('aggravate', 10)).toBe(1);
	});

	it('spends procCooldown at the TRIGGER instant, in frames', () => {
		const eff = procEffect({
			trigger: { type: 'onReaction', reaction: 'any', source: 'team', armedFor: 25 },
			procCooldown: 2.5
		});
		const ctx = ctxWith([listener(eff)]);
		const at = (t: number) =>
			takeReactionProcs(ctx, { characterId: 'x', viaEntity: false }, 'bloom', t).length;
		expect(at(0)).toBe(1);
		expect(at(149)).toBe(0);
		expect(at(150)).toBe(1);
	});

	it('⚓ falls back to a one-frame floor so an uncooled proc cannot loop on itself', () => {
		// A proc's own application can cause the reaction that re-fires it. Every
		// authored proc states a cooldown; this is the backstop if one does not.
		const ctx = ctxWith([
			listener(procEffect({ trigger: { type: 'onReaction', reaction: 'any' } }))
		]);
		const at = (t: number) =>
			takeReactionProcs(ctx, { characterId: 'holder', viaEntity: false }, 'bloom', t).length;
		expect(at(30)).toBe(1);
		expect(at(30)).toBe(0);
		expect(at(31)).toBe(1);
	});
});

// ---------------------------------------------------------------------------
// End to end, over the shipped corpus
// ---------------------------------------------------------------------------

const modules = import.meta.glob('../data/characters/*.json', { eager: true });
const corpus: CharacterData[] = Object.values(modules).map(
	(m) => (m as { default: CharacterData }).default
);
const byName = new Map(corpus.map((c) => [c.displayName, c]));
const lookup = (name: string): CharacterData | null => byName.get(name) ?? null;

/** `[seconds, units]` per application a character put on the target. */
const appsOf = (notation: string, characterId: string): [number, number][] =>
	parseNotation(notation, lookup, 8, {}, {}, undefined)
		.applications.filter((a) => a.characterId === characterId)
		.map((a) => [+(a.time / 60).toFixed(2), a.units]);

describe('Nahida — Tri-Karma Purification, end to end', () => {
	it('applies nothing beyond her own cast when no reaction happens', () => {
		// ⚓ The negative case first: the trigger is armed for 25 s here and fires
		// zero times, so every number below is a REACTION doing it and not the cast.
		expect(appsOf('Nahida E Q', 'nahida')).toEqual([[0.22, 1]]);
	});

	it('fires 1.5U three frames after a bloom she did not cause', () => {
		// Collei's Dendro + Xingqiu's Hydro = a bloom on the marked enemy that
		// neither of Nahida's own hits produced — which is what `source: 'team'`
		// is for. 1.5U is `ICDGroupNahidaSkill`'s sequence entry, not a durability.
		const apps = appsOf('Nahida E > Collei E > Xingqiu E', 'nahida');
		expect(apps).toEqual([
			[0.22, 1],
			[2.03, 1.5]
		]);
		// The rain sword's SECOND bloom lands 0.32 s later and does not proc —
		// 2.5 s of trigger interval, spent at the reaction rather than at the hit.
		expect(apps.filter(([, u]) => u === 1.5)).toHaveLength(1);
	});

	it('⚓ stops when the Seed of Skandha expires, not when the rotation does', () => {
		// The identical rotation, moved either side of the mark's 25 s. This is the
		// whole reason `armedFor` exists: with no window the trigger would still be
		// listening at 26 s, and in game the Seed is long gone.
		const inside = appsOf('Nahida E ~20s > Collei E > Xingqiu E', 'nahida');
		expect(inside).toEqual([
			[0.22, 1],
			[22.03, 1.5]
		]);
		const outside = appsOf('Nahida E ~24s > Collei E > Xingqiu E', 'nahida');
		expect(outside).toEqual([[0.22, 1]]);
	});

	it('holds the 2.5 s interval across a dense aggravate stream', () => {
		// The oracle's quicken fixture. gcsim puts Tri-Karma at 3.22 / 8.47 / 13.38
		// off its own reaction stream; ours differs after the first because Oz's ICD
		// group is not modelled (docs/icd-group-round.md b) and our Oz applies more
		// often — ⚠️ so the CADENCE is what this pins, not agreement with gcsim.
		const procs = appsOf('Nahida E Q > Fischl E Q > Fischl N3', 'nahida')
			.filter(([, u]) => u === 1.5)
			.map(([t]) => t);
		expect(procs).toEqual([3.2, 7.3, 10.25, 13.2]);
		for (let i = 1; i < procs.length; i++)
			expect(procs[i] - procs[i - 1]).toBeGreaterThanOrEqual(2.5);
	});
});
