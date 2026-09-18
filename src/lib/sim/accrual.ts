/**
 * src/lib/sim/accrual.ts
 *
 * ⚓ CONTINUOUS ACCRUAL INTO A STACK KEY (stack-threshold round, exact model —
 * 2026-09-18, ⚓ Nate: "this approximation verges on the territory where it is
 * no longer useful"). A `gainStacks` carrying `accrual` does not ADD its amount
 * when its trigger fires; the fire opens — or refreshes — a `window`-second
 * status shared per holder across every key of the same `group`, and while the
 * status is live the key the LAST fire named gains `amount` per second, in
 * 0.05 s polls. That is Columbina's Gravity as gcsim runs it (`skill.go`
 * `gravityAccum`: `AddStatus(gravityKey, 2*60)` on any Lunar reaction hook,
 * then `10 * 0.05 * (1 + c2rate)` into `gravity[lastReaction]` every 3 frames
 * while the status is active), and it replaced the count-shaped "+20 per
 * reaction, at most one grant per 2s" that under-counted a short burst and
 * over-counted a dense stream by up to two seconds.
 *
 * ⚓ THE ARITHMETIC IS A GRID, SETTLED LAZILY. Polls sit at `start + 3k` from
 * the fire that opened the status (gcsim's task is queued from the hook and
 * survives refreshes on its own cadence), and a record only says how many of
 * them have been counted (`polled`). `settleAccruals(hcs, upTo)` brings every
 * live record to a frame and is MONOTONE and IDEMPOTENT — which is what makes
 * a RETROACTIVE refresh legal: a Lunar-Charged tick is emitted by the gauge at
 * its own instant but surfaces at the next application, and extending
 * `liveUntil` after a settle simply lets the next settle count the polls the
 * previous one stopped at. ⚠️ A lapsed record is kept, not deleted, for the
 * same reason: a tick that lands in the gap re-opens it from the tick.
 *
 * ⚓ THE FIRE IS PREDICTED, NOT POLLED. With the grid fixed and the rate
 * constant, the poll on which the threshold group's sum reaches `count` is
 * arithmetic (`predictFire`), and `thresholds.ts` schedules it on the ONE
 * clock, generation-stamped so a refresh, a spend or a lapse re-predicts and
 * the stale task is a no-op. ⛔ Never a 3-frame wake-up task: that is the cost
 * the jumping clock exists to avoid (L3 §4.2).
 *
 * ⚠️ `max` caps what is COUNTED, as it does for every other grant; gcsim's
 * Gravity has no cap below the threshold, so Columbina's 60 is inert there.
 */

import { framesOf } from '$lib/utils/frames';
import type { CharState } from './charState';

/** gcsim's `QueueCharTask(c.gravityAccum, 0.05*60)`. */
export const ACCRUAL_POLL_F = 3;

export type AccrualRecord = {
	/** The key the polls go to — the LAST fire's key (gcsim `gravityLastReaction`). */
	key: string;
	/** Stacks per poll: `amount` per second × 0.05. */
	perPoll: number;
	max?: number;
	/** Frame of the fire that opened the status — the grid's origin. */
	start: number;
	/** Polls already counted into the key. */
	polled: number;
	/** The status expires when the clock REACHES this frame (gcsim: live while
	 *  `expiry > F`). Refreshes push it out; the grid does not move. */
	liveUntil: number;
	/** Generation of the scheduled fire task; a bump orphans the pending one. */
	gen: number;
};

/**
 * Open a status, or refresh a live one. Settles to `time` first so polls that
 * ran before a key switch are credited to the key that was live then.
 */
export function openOrRefreshAccrual(
	hcs: CharState,
	group: string,
	key: string,
	ratePerSecond: number,
	windowSec: number,
	time: number,
	max: number | undefined
): AccrualRecord {
	const perPoll = ratePerSecond * (ACCRUAL_POLL_F / 60);
	const rec = hcs.accruals.get(group);
	if (rec) settleOne(hcs, rec, time);
	if (!rec || time >= rec.liveUntil) {
		const fresh: AccrualRecord = {
			key,
			perPoll,
			max,
			start: time,
			polled: 0,
			liveUntil: time + framesOf(windowSec),
			gen: rec ? rec.gen + 1 : 0
		};
		hcs.accruals.set(group, fresh);
		return fresh;
	}
	rec.key = key;
	rec.perPoll = perPoll;
	rec.max = max;
	rec.liveUntil = Math.max(rec.liveUntil, time + framesOf(windowSec));
	return rec;
}

/** Count every poll at or before `upTo` (and before the status lapses) into
 *  the record's key. ⚓ The home is `onReactionStacks` — an accrual grant is a
 *  team-sourced onReaction grant by lint, so that is the one container. */
function settleOne(hcs: CharState, rec: AccrualRecord, upTo: number): void {
	const last = Math.min(upTo, rec.liveUntil - 1);
	if (last < rec.start) return;
	const due = Math.floor((last - rec.start) / ACCRUAL_POLL_F) + 1;
	const n = due - rec.polled;
	if (n <= 0) return;
	const current = hcs.onReactionStacks.get(rec.key) ?? 0;
	const next = current + n * rec.perPoll;
	hcs.onReactionStacks.set(rec.key, rec.max !== undefined ? Math.min(next, rec.max) : next);
	rec.polled = due;
}

export function settleAccruals(hcs: CharState, upTo: number): void {
	for (const rec of hcs.accruals.values()) settleOne(hcs, rec, upTo);
}

/**
 * The frame of the poll on which `remaining` more stacks will have landed, or
 * `null` when the status lapses first. Assumes the record is settled.
 */
export function predictFire(rec: AccrualRecord, remaining: number, now: number): number | null {
	if (now >= rec.liveUntil) return null;
	const n = Math.max(1, Math.ceil(remaining / rec.perPoll - 1e-9));
	const t = rec.start + ACCRUAL_POLL_F * (rec.polled + n - 1);
	return t < rec.liveUntil ? t : null;
}
