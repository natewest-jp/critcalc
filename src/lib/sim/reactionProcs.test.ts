/**
 * reactionProcs.test.ts — the selection half of the FOURTH application source.
 *
 * ⚓ WHAT IS UNDER TEST HERE AND WHAT IS NOT. `takeReactionProcs` decides WHICH
 * armed listeners a reaction fires; `aura.ts` then schedules their hits. This
 * file covers the decision, which is pure, hand-buildable and where every rule
 * of the mechanism lives. The end-to-end behaviour is covered against the real
 * corpus in `notationParser.*` / the per-character cases the authoring landings
 * add — ⛔ deliberately not with a fabricated character here, which would test
 * the fixture rather than the data.
 *
 * ⚠️ `source: 'active'` is the rule worth the most attention: it is NOT
 * "`'team'` narrowed by id", and getting that wrong is what gcsim does. Every
 * Thundering Retribution in the oracle fires 4 frames after an OZ application,
 * because gcsim compares Oz's `ActorIndex` — Fischl's — against the active
 * character. The `viaEntity` cases below are that defect, pinned.
 */

import { describe, it, expect } from 'vitest';
import type { Effect } from '$lib/types/ability';
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
			trigger: { type: 'onCast' } as ReactionProcEffect['trigger']
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
