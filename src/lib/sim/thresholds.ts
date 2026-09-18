/**
 * src/lib/sim/thresholds.ts
 *
 * ⚓ THE ONE READER OF `onStack` (stack-threshold round, 2026-09-18 —
 * `docs/stack-threshold-round.md`). A trigger that fires the instant the summed
 * count of its `keys` reaches `count`, spends the set, and records a
 * `stackThreshold` IR event that the buff projection anchors on.
 *
 * Columbina's Gravity is the holder and the reason: while the Gravity Ripple is
 * out, every party Lunar reaction accrues Gravity (three keys, one per Lunar
 * kind), at 60 the Interference fires in the dominant kind's element, A1/C1/C2
 * hang off the fire, and the pool empties (gcsim `skill.go` `gravityTick` →
 * `clearGravity`). A flat cadence was refused as an invented number.
 *
 * ⚓ CHECKED AT THE FOUR SETTLE POINTS WHERE A COUNT CAN MOVE — the reaction
 * dispatch (`aura.ts` `emitReaction`), a cast (`run.ts`, beside the cast's own
 * consume), a hit (`run.ts` `dispatchHit`) and a summon tick (`aura.ts`
 * `dispatchEntityHitStacks`) — and nowhere else, so a fire is always an
 * ordinary future-free instant on the one clock. ⚠️ The team's thresholds are
 * PRECOMPUTED once per parse (`collectStackThresholds`) and the check is a
 * no-op for a team that authors none, which is every team but one today.
 *
 * ⚓ A KEY'S COUNT IS READ FROM ITS HOME, never summed across homes. A key has
 * exactly one container (`stacks.ts`' file header: `scope` picks rotation vs
 * segment; a `'team'`/`'others'` onReaction or onHit grant accrues on the
 * holder's `CharState`), and the home is resolved from the grants that name the
 * key, constellation-UNGATED — a key's home cannot depend on the reader's
 * C-level (`stackScopesOf`'s rule). ⚠️ A segment-home key is readable only at a
 * site that has the on-field pool in hand (cast, hit); at the reaction and tick
 * sites it reads 0, so a threshold over a segment key fires at the next cast or
 * hit — stated, not hidden.
 *
 * ⚓ THE FIRE'S OWN EFFECTS SPLIT BY WHEN THEY ACT. A `damage` effect draws a
 * MARK on the lane of the summon that hosts the accrual (recorded here,
 * stamped onto the summon window by `finalize`) and ⛔ applies NOTHING — the one
 * holder is Durability 0 in gcsim, and a mark in the aura lane would claim a
 * gauge change that did not happen (⚓ Nate, 2026-09-18). A `shield` opens at
 * the fire under the host ability's source. A `buff` is the projection's
 * (`buffWindows` reads the event), so this module never touches one.
 *
 * ⚠️ `dominant` — the key holding the MOST at the fire, ties in `keys` order —
 * is gcsim's strict `>` over its index loop (`gravityTick`), so a tie between
 * Lunar-Charged and Lunar-Bloom is Lunar-Charged there and here.
 */

import type { CharacterData } from '$lib/types/character';
import type { Effect, Trigger } from '$lib/types/ability';
import type { StackThresholdEvent } from '$lib/utils/rotationEvents';
import { framesOf } from '$lib/utils/frames';
import { effectSourcesAtConstellation } from '$lib/utils/effectCollection';
import type { SimContext } from './context';
import type { CharState } from './charState';
import { DEFAULT_ASCENSION, evalCondition, type ConditionContext } from './conditions';
import { holderStatesAt } from './states';
import { stackScopeOf, type StackPools } from './stacks';
import { pushShieldAt } from './shields';
import { Band, type Clock } from './clock';
import { predictFire, settleAccruals } from './accrual';

type OnStackTrigger = Extract<Trigger, { type: 'onStack' }>;
export type OnStackEffect = Effect & { trigger: OnStackTrigger };

/** Where a key's count lives — see the file header. */
type Home = 'rotation' | 'onReaction' | 'onHit' | 'sourceLifetime' | 'segment';

export type StackThreshold = {
	holder: CharacterData;
	keys: string[];
	count: number;
	label?: string;
	homes: Map<string, Home>;
	/** The E/Q whose primary summon hosts the accrual — the ability that
	 *  authors a grant of `keys[0]` and spawns a summon. The fire's mark rides
	 *  that lane and a fire-opened shield takes that source. Absent when no
	 *  such ability exists (the mark then has no lane and is not drawn). */
	host?: { kind: 'skill' | 'burst'; summonLabel: string };
	effects: OnStackEffect[];
};

/** The home of `key` on `holder`, resolved from every grant that names it —
 *  constellation-ungated on purpose (see the header). First grant wins; every
 *  grant of a key agrees on scope by lint D.39, and on trigger family by the
 *  key naming one resource. */
function homeOf(holder: CharacterData, key: string): Home {
	if (stackScopeOf(holder, key) === 'rotation') return 'rotation';
	for (const src of [
		...holder.abilities,
		...(holder.passives ?? []),
		...(holder.constellations ?? [])
	]) {
		for (const fx of src.effects ?? []) {
			if (fx.type !== 'gainStacks' || fx.key !== key) continue;
			const t = fx.trigger;
			if (t.type === 'onReaction' && t.source === 'team') return 'onReaction';
			if (t.type === 'onHit') {
				if (fx.sourceLifetime !== undefined) return 'sourceLifetime';
				if (t.source === 'team' || t.source === 'others') return 'onHit';
			}
			return 'segment';
		}
	}
	return 'segment';
}

/** The E/Q hosting the accrual of `key`, if one does. */
function hostOf(
	holder: CharacterData,
	key: string
): { kind: 'skill' | 'burst'; summonLabel: string } | undefined {
	for (const ab of holder.abilities) {
		if (ab.abilityType !== 'skill' && ab.abilityType !== 'burst') continue;
		const label = ab.summons?.[0]?.label;
		if (label === undefined) continue;
		if ((ab.effects ?? []).some((fx) => fx.type === 'gainStacks' && fx.key === key))
			return { kind: ab.abilityType, summonLabel: label };
	}
	return undefined;
}

/**
 * Every `onStack` trigger the team authors at its constellations, grouped by
 * (holder, keys, count) — one group is one fire however many effects hang off
 * it. Computed once per parse into `TeamContext.stackThresholds`.
 */
export function collectStackThresholds(
	teamChars: CharacterData[],
	constellationByHolder: ReadonlyMap<string, number>
): Map<string, StackThreshold[]> {
	const out = new Map<string, StackThreshold[]>();
	for (const holder of teamChars) {
		const groups = new Map<string, StackThreshold>();
		const cons = constellationByHolder.get(holder.id) ?? 0;
		for (const src of effectSourcesAtConstellation(holder, cons)) {
			for (const fx of src.effects ?? []) {
				if (fx.trigger.type !== 'onStack') continue;
				const trig = fx.trigger;
				const gk = `${trig.keys.join('|')}#${trig.count}`;
				let g = groups.get(gk);
				if (!g) {
					const homes = new Map<string, Home>();
					for (const k of trig.keys) homes.set(k, homeOf(holder, k));
					g = {
						holder,
						keys: [...trig.keys],
						count: trig.count,
						homes,
						host: hostOf(holder, trig.keys[0]),
						effects: []
					};
					groups.set(gk, g);
				}
				if (g.label === undefined && trig.label !== undefined) g.label = trig.label;
				g.effects.push(fx as OnStackEffect);
			}
		}
		if (groups.size > 0) out.set(holder.id, [...groups.values()]);
	}
	return out;
}

function readCount(hcs: CharState, home: Home, key: string, seg: StackPools | null): number {
	switch (home) {
		case 'rotation':
			return hcs.rotationStacks.get(key) ?? 0;
		case 'onReaction':
			return hcs.onReactionStacks.get(key) ?? 0;
		case 'onHit':
			return hcs.onHitStacks.get(key) ?? 0;
		case 'sourceLifetime':
			return hcs.sourceLifetime.get(key)?.size ?? 0;
		case 'segment':
			return seg?.state.get(key) ?? 0;
	}
}

/** Spend one key: its home to zero, its instance list emptied, and the segment
 *  mirror of a rotation key kept in step (the `mirrorKey` contract). */
function spend(hcs: CharState, home: Home, key: string, seg: StackPools | null): void {
	switch (home) {
		case 'rotation':
			hcs.rotationStacks.set(key, 0);
			hcs.rotationStackInstances.set(key, []);
			if (seg) {
				seg.state.set(key, 0);
				seg.instances.set(key, []);
			}
			return;
		case 'onReaction':
			hcs.onReactionStacks.set(key, 0);
			hcs.onReactionStackInstances.set(key, []);
			return;
		case 'onHit':
			hcs.onHitStacks.set(key, 0);
			hcs.onHitStackInstances.set(key, []);
			return;
		case 'sourceLifetime':
			hcs.sourceLifetime.get(key)?.clear();
			return;
		case 'segment':
			if (seg) {
				seg.state.set(key, 0);
				seg.instances.set(key, []);
			}
			return;
	}
}

/**
 * Fire every threshold whose sum has been reached. `seg` is the ON-FIELD
 * character's segment pool when the caller has it (cast, hit) and `null`
 * where nobody's is in hand (a reaction, a summon tick) — the same rule the
 * tick dispatchers follow, for the same reason.
 */
export function checkStackThresholds(
	ctx: SimContext,
	clock: Clock,
	time: number,
	seg: { charId: string; pools: StackPools } | null
): void {
	const all = ctx.team.stackThresholds;
	if (all.size === 0) return;
	for (const [holderId, thresholds] of all) {
		const hcs = ctx.getCharState(holderId);
		// ⚓ An accruing key is counted up to THIS frame before it is read.
		settleAccruals(hcs, time);
		const segPools = seg && seg.charId === holderId ? seg.pools : null;
		for (const th of thresholds) {
			const counts = th.keys.map((k) => readCount(hcs, th.homes.get(k)!, k, segPools));
			let sum = 0;
			for (const c of counts) sum += c;
			if (sum < th.count - 1e-9) continue;
			// The dominant key: the largest count, ties to the EARLIER key.
			let dominant = th.keys[0];
			let best = -Infinity;
			counts.forEach((c, i) => {
				if (c > best) {
					best = c;
					dominant = th.keys[i];
				}
			});
			for (const k of th.keys) spend(hcs, th.homes.get(k)!, k, segPools);
			// A live accrual keeps polling into the emptied pool (gcsim's task
			// outlives `clearGravity`), so the NEXT fire is re-predicted from zero.
			scheduleAccrualFire(ctx, clock, hcs, th, time);
			const ev: StackThresholdEvent = {
				kind: 'stackThreshold',
				id: ctx.nextId(),
				characterId: holderId,
				time,
				keys: [...th.keys],
				count: th.count,
				dominant,
				...(th.label !== undefined ? { label: th.label } : {}),
				...(th.host ? { abilityClass: th.host.kind } : {})
			};
			ctx.events.push(ev);
			// What acts NOW: the mark and a shield. Buffs are the projection's.
			// ⚠️ Optimistic on an unresolvable condition (`=== false` drops), the
			// rule `pushShield` and every buff site share, so the three surfaces of
			// one fire cannot disagree about whether it drew.
			const states = holderStatesAt(ctx, th.holder, time);
			const cons = ctx.team.constellationByHolder.get(holderId) ?? 0;
			const condCtx: ConditionContext = {
				teamFactionCounts: ctx.team.teamFactionCounts,
				teamEnabledReactions: ctx.team.teamEnabledReactions,
				teamElementCounts: ctx.team.teamElementCountsByHolder.get(holderId)
			};
			for (const fx of th.effects) {
				if (fx.trigger.dominant !== undefined && fx.trigger.dominant !== dominant) continue;
				if (fx.type !== 'damage' && fx.type !== 'shield') continue;
				const verdict = evalCondition(
					fx.conditions,
					DEFAULT_ASCENSION,
					states,
					cons,
					new Map(),
					undefined,
					condCtx
				);
				if (verdict === false) continue;
				if (!th.host) continue;
				if (fx.type === 'damage') {
					if (fx.element === undefined) continue;
					ctx.stackFireMarks.push({
						characterId: holderId,
						summonLabel: th.host.summonLabel,
						time,
						element: fx.element
					});
				} else {
					if (fx.duration === undefined || fx.duration <= 0) continue;
					// The shield's provenance is the host cast that put the summon
					// out — the latest one at or before the fire.
					const casts = ctx.castsByChar.get(holderId) ?? [];
					let hostCast: (typeof casts)[number] | undefined;
					for (const c of casts) {
						if (c.ability !== th.host.kind || c.time > time) continue;
						if (!hostCast || c.time >= hostCast.time) hostCast = c;
					}
					if (!hostCast) continue;
					pushShieldAt(
						ctx,
						holderId,
						th.host.kind,
						time,
						time + framesOf(fx.duration),
						hostCast.id,
						fx.label
					);
				}
			}
		}
	}
}

/**
 * ⚓ THE FIRE OF AN ACCRUING THRESHOLD IS PREDICTED AND SCHEDULED, never
 * polled (exact-model round, 2026-09-18). With the poll grid fixed and the
 * rate constant, the poll on which the group's sum reaches `count` is
 * arithmetic; this schedules it on the one clock, generation-stamped on the
 * accrual record so a refresh, a spend or a lapse re-predicts and orphans the
 * pending task. A prediction at or before `now` — a Lunar-Charged tick
 * surfaced late by the gauge extended a status that had already crossed — is
 * fired IMMEDIATELY at its own instant: the settle is monotone, so settling to
 * that frame and checking there records the fire where it happened, and the
 * polls after it go to the emptied pool. `finalize` sorts events by time.
 */
function scheduleAccrualFire(
	ctx: SimContext,
	clock: Clock,
	hcs: CharState,
	th: StackThreshold,
	now: number
): void {
	for (const [, rec] of hcs.accruals) {
		if (!th.keys.includes(rec.key)) continue;
		// Any earlier prediction for this record is stale from here.
		rec.gen++;
		if (now >= rec.liveUntil) continue;
		let sum = 0;
		for (const k of th.keys) sum += readCount(hcs, th.homes.get(k)!, k, null);
		const remaining = th.count - sum;
		const at = predictFire(rec, remaining, now);
		if (at === null) continue;
		const gen = rec.gen;
		const fire = (): void => {
			if (rec.gen !== gen) return;
			checkStackThresholds(ctx, clock, at, null);
		};
		if (at <= clock.now) fire();
		else clock.schedule(at, Band.TICK, fire);
	}
}

/** Re-predict every accruing threshold on every holder — called after a
 *  reaction or a tick has opened or refreshed a status. */
export function scheduleAccrualFires(ctx: SimContext, clock: Clock, now: number): void {
	const all = ctx.team.stackThresholds;
	if (all.size === 0) return;
	for (const [holderId, thresholds] of all) {
		const hcs = ctx.getCharState(holderId);
		if (hcs.accruals.size === 0) continue;
		settleAccruals(hcs, now);
		for (const th of thresholds) scheduleAccrualFire(ctx, clock, hcs, th, now);
	}
}
