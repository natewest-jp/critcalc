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
		reactionProcs: new Map(listeners.map((l, i) => [`listener:${i}`, l])),
		activeCharId
	}) as unknown as SimContext;

describe('reactionProcEffects — the one acceptance rule', () => {
	it('takes a damage + onReaction effect that carries an application[]', () => {
		expect(reactionProcEffects([procEffect()], 0, new Set())).toHaveLength(1);
		expect(reactionProcEffects([procEffect(), procEffect()], 0, new Set())[1].index).toBe(1);
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

	it('holds the 2.5 s interval across an aggravate stream, and now tracks gcsim', () => {
		// The oracle's quicken fixture. gcsim puts Tri-Karma at 3.22 / 8.47 / 13.38
		// off its own reaction stream.
		//
		// ↻ **This read [3.2, 7.3, 10.25, 13.2] until 2026-08-17** and its comment
		// named exactly why: Oz's ICD group was unmodelled, so our Oz applied more
		// often and drove more aggravates. Sub-landing b authored it
		// (ICDGroupFischl, 300f / every 4th), and the first two procs now agree with
		// gcsim's first two — the third does not arrive, which is ⚓ the
		// counter-SHARING half of the same fault and is held: gcsim keys ICD by
		// `(character, tag)` and gives BOTH Ozes `ICDTagElementalArt` from one
		// function, so its counter spans the recast while ours restarts per series
		// (docs/icd-group-round.md §4).
		const procs = appsOf('Nahida E Q > Fischl E Q > Fischl N3', 'nahida')
			.filter(([, u]) => u === 1.5)
			.map(([t]) => t);
		expect(procs).toEqual([3.2, 8.28]);
		for (let i = 1; i < procs.length; i++)
			expect(procs[i] - procs[i - 1]).toBeGreaterThanOrEqual(2.5);
	});
});

describe('Fischl — A4 Thundering Retribution, end to end', () => {
	/** Every electro application Fischl put on the target, in seconds. */
	const fischlApps = (notation: string) => appsOf(notation, 'fischl').map(([t]) => t);

	it("⚓ does NOT fire off Oz's own reaction, which is the whole point", () => {
		// ⚠️⚠️ THE CASE. In `Nahida E Q > Fischl E Q > Fischl N3` Fischl is on field
		// throughout and Oz aggravates the Quicken aura on every tick that applies —
		// 4.30, 8.23, 10.20. gcsim fires A4 four frames after each of them, because
		// Oz's AttackEvent carries Fischl's ActorIndex and its check is
		// `ActorIndex != Player.Active()`. In game Oz is not the active character.
		//
		// So the only A4 here is at 3.22 — four frames after 3.15, which is
		// FISCHL'S OWN E hit (`application[]` frame 38), not a tick. Every later
		// entry is a bare Oz tick with no proc behind it.
		//
		// ↻ The tick times moved 2026-08-17 (ICD-group round b authored
		// ICDGroupFischl, 300f / every 4th): 7.25 and 13.15 are gone and 8.23 is
		// new. ⚓ WHAT THE TEST IS FOR DID NOT MOVE — one A4, at Fischl's own hit.
		expect(fischlApps('Nahida E Q > Fischl E Q > Fischl N3')).toEqual([
			3.15, 3.22, 3.53, 4.3, 8.23, 10.2
		]);
	});

	it('fires off the reaction a DIFFERENT active character caused', () => {
		// Barbara's Hydro electro-charges Oz's Electro while she is on field: the
		// active character triggered it, Oz is up, so A4 procs 4 frames later —
		// 1.65→1.72, 2.52→2.58, 3.05→3.12, 9.05→9.12. This is `source: 'active'`
		// doing the thing `source: 'self'` could not.
		//
		// ↻ Retimed 2026-08-17 with ICDGroupFischl (b): the Oz ticks that apply are
		// now 2.80 / 6.73 / 8.70 rather than 2.80 / 5.75 / 11.65, and ⚓ Barbara's
		// ring tick at 6.05 consequently procs NOTHING — the Electro from 2.80 has
		// decayed by then and there is no aura left to electro-charge. A proc is a
		// consequence of a reaction, so a rule that changes applications changes
		// this list twice over.
		expect(fischlApps('Barbara E > Fischl E Q > Barbara N3')).toEqual([
			1.65, 1.72, 2.03, 2.58, 2.8, 3.12, 6.73, 8.7, 9.12
		]);
	});

	it('⚓ keeps ONE 0.5 s cooldown across both authored Ozes', () => {
		// A4 is authored on the skill's Oz and on the burst's Oz, because either
		// cast can be the one that put Oz on the field — but there is only ever one
		// Oz. Keyed by the authored object instead of the entity, the burst's copy
		// took a fresh clock the moment it replaced the skill's and fired again
		// 0.38 s after 1.72. The gaps between consecutive procs hold the ICD.
		//
		// ↻ 6.12 dropped 2026-08-17 (b): its reaction no longer happens, per the
		// test above. ⚓ The three surviving gaps still bracket the 0.5 s and the
		// 2.1 s exclusion is untouched, which is the whole assertion.
		const procs = [1.72, 2.58, 3.12, 9.12];
		for (let i = 1; i < procs.length; i++)
			expect(procs[i] - procs[i - 1]).toBeGreaterThanOrEqual(0.5);
		expect(fischlApps('Barbara E > Fischl E Q > Barbara N3')).toEqual(
			expect.arrayContaining(procs)
		);
		expect(fischlApps('Barbara E > Fischl E Q > Barbara N3')).not.toContain(2.1);
	});
});
