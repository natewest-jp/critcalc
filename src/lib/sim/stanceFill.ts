/**
 * src/lib/sim/stanceFill.ts
 *
 * ⚓ A STANCE WHOSE END COMES FROM THE LIVE GAUGE (`StanceFill`, Jahoda's flask,
 * 2026-11-27; gcsim `jahoda/skill.go` `fillFlask`, `fillFlaskGauge`,
 * `drainFlask`). The flask polls the aura on the clock, so its answer sees every
 * application before the poll, a teammate's summon ticks included. A full flask
 * clamps the stance `endsAfter` frames later; the clamp moves the stance-end
 * cooldown with it, and `clampStance` calls back here to drain.
 *
 * ⚓ ONE DRAIN, AT WHICHEVER END COMES FIRST: the full flask's clamp, the
 * re-press's (`endsStance`, through the same `clampStance`), or the stance's
 * own `duration`. The flask's points at that instant decide which drain hit it
 * is, as gcsim's `drainFlask` reads `flaskGauge` at its call: a re-press in the
 * 4f between the fill and the drain drains full.
 *
 * What the drain does (its hit, the summons and the buff anchored at a full
 * flask) is the caller's: `onDrain` is handed the end, whether the flask was
 * full, and the element it locked.
 */

import type { ActionKey, Element, StanceFill } from '$lib/types/ability';
import { frameAt } from '$lib/utils/frames';
import { holds } from './absorb';
import type { CharState, StanceRecord } from './charState';
import { Band, type Clock } from './clock';
import type { SimContext } from './context';
import { clampStance } from './states';

export function startStanceFill(
	ctx: SimContext,
	clock: Clock,
	cs: CharState,
	characterId: string,
	spec: StanceFill,
	stance: StanceRecord,
	onDrain: (end: number, full: boolean, element: Element | undefined) => void
): void {
	const drain = (end: number): void => {
		const fill = stance.fill!;
		if (fill.drained) return;
		fill.drained = true;
		onDrain(end, fill.points >= spec.full, fill.locked);
	};
	stance.fill = {
		spec,
		points: 0,
		drained: false,
		released: false,
		onEarlyEnd: drain
	};
	const fill = stance.fill;

	const poll = (at: number): void => {
		// ⚓ gcsim's `fillFlask` returns once `drainFlask` has reset `skillSrc`:
		// a poll on the end's own frame or after it does nothing.
		if (fill.drained || fill.points >= spec.full || stance.end <= at) return;
		const order: Element[] = fill.locked
			? [fill.locked, ...spec.order.filter((el) => el !== fill.locked)]
			: [...spec.order];
		const held = order.find((el) => holds(ctx, el, at));
		if (held !== undefined) {
			if (fill.locked === undefined) fill.locked = held;
			fill.points = Math.min(
				spec.full,
				fill.points + (held === fill.locked ? spec.gain.locked : spec.gain.other)
			);
			if (fill.points >= spec.full) {
				// The clamp drains (through `onEarlyEnd`).
				clampStance(ctx, cs, characterId, at + spec.endsAfter);
				return;
			}
		}
		const next = at + spec.every;
		clock.schedule(next, Band.LAND, () => poll(next));
	};
	const first = stance.start + spec.from;
	clock.schedule(first, Band.LAND, () => poll(first));

	// ⚓ The stance's own end: gcsim schedules `drainFlask` at the windup plus
	// the longest Shadow Pursuit, and it does nothing if an earlier end ran.
	const natural = stance.end;
	clock.schedule(natural, Band.LAND, () => {
		if (stance.end === natural) drain(natural);
	});
}

/**
 * Run the clock to a flask stance's LIVE end. One task at a time, never one
 * advance to the end: a poll on the way can clamp the end earlier, and an
 * advance to the old end would carry the clock past the new one.
 */
export function runToStanceEnd(clock: Clock, stance: StanceRecord): void {
	while (stance.end > clock.now) {
		const next = clock.peek();
		clock.advance(next !== null && next < stance.end ? next : stance.end);
	}
}

/**
 * The instant the next action may start after a flask stance that has not yet
 * released its holder, once the clock is at its end (`runToStanceEnd`). `key`
 * is the next action's cancel slot.
 */
export function releaseAt(stance: StanceRecord, key: ActionKey, now: number): number {
	return Math.max(now, stance.end + frameAt(stance.fill!.spec.afterEnd, key));
}
