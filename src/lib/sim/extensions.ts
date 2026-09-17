/**
 * src/lib/sim/extensions.ts
 *
 * `durationExtensions[]` dispatch — the two paths by which an already-open
 * window GROWS (gauge-round L3c, lifted out of `notationParser.ts`).
 *
 * ⚓ This is feedback edge F2 (gauge-round.md §2), and it is the one that made
 * the round's "schedule then simulate" split impossible: an extension moves a
 * STANCE's end, and a stance's end is read back by ability resolution and by the
 * charge-queue wait. A consequence reaches back into a decision, so the aura and
 * the schedule cannot be computed in separate passes.
 *
 * ⚠️ Both dispatchers mutate `end`/`endTime` AND `ownerUptime`, and the two are
 * NOT the same number: `end` is the swap-clamped gating end, `ownerUptime` is
 * the owner bar's full width, which a swap does not shorten. The finalize pass
 * stamps the second onto the cast event.
 */

import type { DurationExtension, Reaction } from '$lib/types/ability';
import { getDurationExtensions } from '$lib/types/ability';
import { framesOf } from '$lib/utils/frames';
import type { SimContext } from './context';
import type { CharState, StanceRecord } from './charState';
import {
	DEFAULT_ASCENSION,
	evalCondition,
	reactionMatchesTrigger,
	type ChainIndex
} from './conditions';

/** Fires `onCast`-trigger duration extensions on the currently-active stance
 *  window for the given character, against the cast event described by
 *  `castType` at time `castTime`. Caller passes the pre-cast state snapshot
 *  + per-character resolution context for evalCondition. Other trigger types
 *  (onReaction, onHit, ...) are accepted in schema but not dispatched yet. */
export function dispatchOnCastExtensions(
	ctx: SimContext,
	charId: string,
	castType: 'skill' | 'burst',
	castTime: number,
	preStates: ReadonlySet<string>,
	constellation: number,
	chainIdx: ChainIndex,
	stacks: ReadonlyMap<string, number> | undefined
): void {
	// Gate on the window still being OPEN at cast time — cs.stance is
	// deliberately never cleared (swap-close only clamps `end`, for drain
	// settling), so presence alone would let a cast long after the stance
	// died retroactively extend the dead window. Mirrors the summon path's
	// `endTime > castTime` check.
	const st = ctx.getCharState(charId).stance;
	if (!st || st.end <= castTime) return;
	const exts = getDurationExtensions(st.ownerAbility);
	if (!exts || exts.length === 0) return;
	const counts = st.extCounts;
	const lastFires = st.extLastFire;
	for (let idx = 0; idx < exts.length; idx++) {
		const ext = exts[idx];
		if (ext.trigger.type !== 'onCast') continue;
		if (ext.trigger.ability !== undefined && ext.trigger.ability !== castType) continue;
		const condResult = evalCondition(
			ext.conditions,
			DEFAULT_ASCENSION,
			preStates,
			constellation,
			chainIdx,
			stacks
		);
		if (condResult !== true) continue;
		const used = counts.get(idx) ?? 0;
		if (ext.maxExtensions !== undefined && used >= ext.maxExtensions) continue;
		const lastFire = lastFires.get(idx) ?? -Infinity;
		if (ext.procCooldown !== undefined && castTime - lastFire < framesOf(ext.procCooldown))
			continue;
		const delta = framesOf(ext.delta);
		extendStance(ctx.getCharState(charId), st, delta);
		counts.set(idx, used + 1);
		lastFires.set(idx, castTime);
	}
}

/**
 * ⚓ THE ONE WAY A STANCE GROWS (small-fix bundle, 2026-09-17). Both dispatchers
 * — the onCast one above and the reaction one below — used to do `st.end +=
 * delta` inline, and neither moved the COMPANION state `opensState` opened
 * alongside `inStance`. So an extended stance ran on while
 * `nightsoulBlessing` expired at the original end, and every ability gated on
 * the companion (⛔ not on `inStance`) went dark for the extension. Measured:
 * Kinich's burst extends Canopy Hunter 600 → 702 with the Blessing still ending
 * at 600; Mizuki's swirls 346 → 646 likewise. Live gate and IR record move
 * together, so the chart and the parse agree.
 */
function extendStance(cs: CharState, st: StanceRecord, delta: number): void {
	st.end += delta;
	st.ownerUptime += delta;
	if (st.companion) {
		cs.states.set(st.companion.name, st.end);
		st.companion.rec.end = st.end;
	}
}

/** Fires `onReaction`-trigger duration extensions on the character's
 *  currently-active stance window AND any active summon-bound
 *  `durationExtensions[]`, against the synthetic reaction event. The
 *  summon-extension path is needed for Collei A4 (Cuilein-Anbar zone) where
 *  the extensions live on the burst's `summons[0].durationExtensions`
 *  rather than a stance owner. */
export function dispatchOnReactionExtensions(
	ctx: SimContext,
	charId: string,
	emittedReaction: Reaction,
	castTime: number,
	preStates: ReadonlySet<string>,
	constellation: number,
	chainIdx: ChainIndex,
	stacks: ReadonlyMap<string, number> | undefined
): void {
	const dispatch = (
		extensions: DurationExtension[] | undefined,
		counts: Map<number, number> | undefined,
		lastFires: Map<number, number> | undefined,
		extendWindow: (delta: number) => void
	): void => {
		if (!extensions || extensions.length === 0 || !counts || !lastFires) return;
		for (let idx = 0; idx < extensions.length; idx++) {
			const ext = extensions[idx];
			if (ext.trigger.type !== 'onReaction') continue;
			if (!reactionMatchesTrigger(emittedReaction, ext.trigger.reaction)) continue;
			const condResult = evalCondition(
				ext.conditions,
				DEFAULT_ASCENSION,
				preStates,
				constellation,
				chainIdx,
				stacks
			);
			if (condResult !== true) continue;
			const used = counts.get(idx) ?? 0;
			if (ext.maxExtensions !== undefined && used >= ext.maxExtensions) continue;
			const lastFire = lastFires.get(idx) ?? -Infinity;
			if (ext.procCooldown !== undefined && castTime - lastFire < framesOf(ext.procCooldown))
				continue;
			// extendWindow bumps both the gating end and the owner-bar uptime
			// accumulator (P4 — the owner bar is stamped at finalize, not here).
			extendWindow(framesOf(ext.delta));
			counts.set(idx, used + 1);
			lastFires.set(idx, castTime);
		}
	};

	const cs = ctx.getCharState(charId);

	// Stance window: walk owner ability's durationExtensions[] (Mizuki A1
	// shape — extensions on the stance ability itself). Only while the
	// window is still open at cast time (never cleared), same gate as the
	// summon path below.
	const st = cs.stance;
	if (st && st.end > castTime) {
		dispatch(getDurationExtensions(st.ownerAbility), st.extCounts, st.extLastFire, (delta) =>
			extendStance(cs, st, delta)
		);
	}

	// Summon window: walk summons[0].durationExtensions[] when active
	// (Collei A4 shape — extensions on the burst's spawned summon).
	const summonOwner = cs.summonExt;
	if (summonOwner && summonOwner.endTime > castTime) {
		dispatch(summonOwner.extensions, summonOwner.counts, summonOwner.lastFires, (delta) => {
			summonOwner.endTime += delta;
			summonOwner.ownerUptime += delta;
		});
	}
}
