/**
 * src/lib/sim/absorb.ts
 *
 * ⚓⚓ ELEMENTAL ABSORPTION — THE LOCK (absorption round, 2026-10-17;
 * `docs/elemental-absorption-survey.md`, ⚓ Nate's answers in §8). An Anemo
 * summon or cast polls the enemy's aura from a first-check frame at a fixed
 * interval, stops at the first element of its priority order the target holds,
 * and keeps that element for the rest of its life. What the lock FEEDS is the
 * consumer's business: a twin tick series, an own stream started at the lock,
 * or a cast's `application[]` entry (`ElementRef {type: 'absorbed'}`).
 *
 * ⚓ ASKED LIVE, on the clock — the answer depends on every application before
 * the poll, and the absorbed stream's own applications change every later
 * answer (the feed-order law). The gauge is caught up to the poll's frame and
 * read there.
 *
 * ⚓ A COMPOUND COUNTS AS ITS PARENT exactly as gcsim's `AuraContains`: Frozen
 * is Cryo (✅ Nate's combat logs, 2026-10-14 — never Hydro), Burning is Pyro.
 * Quicken and Dendro are not absorbable.
 */

import type { AbsorbSpec, Element } from '$lib/types/ability';
import { Band, type Clock } from './clock';
import type { SimContext } from './context';

export type AbsorbLock = {
	element?: Element;
	at?: number;
	/** Called once, at the lock — an own stream starts here. */
	onLock: ((element: Element, at: number) => void)[];
};

/** Does the target hold `el` (or a compound counted as it) at `at`? */
function holds(ctx: SimContext, el: Element, at: number): boolean {
	const { gauge } = ctx.aura;
	gauge.advanceTo(at);
	const g = gauge.gauges();
	switch (el) {
		case 'pyro':
			return g.pyro > 0 || g.burning > 0;
		case 'cryo':
			return g.cryo > 0 || g.frozen > 0;
		case 'hydro':
			return g.hydro > 0;
		case 'electro':
			return g.electro > 0;
		default:
			return false;
	}
}

/** The lock record for `key`, created on first use. */
export function lockOf(ctx: SimContext, key: string): AbsorbLock {
	let lock = ctx.absorbLocks.get(key);
	if (!lock) {
		lock = { onLock: [] };
		ctx.absorbLocks.set(key, lock);
	}
	return lock;
}

/** The element `key` had locked by `at` (inclusive), or undefined. */
export function lockedAt(ctx: SimContext, key: string, at: number): Element | undefined {
	const lock = ctx.absorbLocks.get(key);
	return lock?.element !== undefined && lock.at !== undefined && lock.at <= at
		? lock.element
		: undefined;
}

/**
 * Schedule the polls for one absorber. `castStart` anchors `spec.from`; `alive`
 * says whether the absorber still exists at a poll's instant (a summon's
 * window; a cast always is) — a dead absorber stops polling.
 *
 * ⚠️ Polls run in `Band.LAND`, after the frame's own hits, so a poll on the
 * frame an aura lands sees it (insertion order within the band).
 */
export function schedulePolls(
	ctx: SimContext,
	clock: Clock,
	key: string,
	spec: AbsorbSpec,
	castStart: number,
	alive: (at: number) => boolean
): void {
	const lock = lockOf(ctx, key);
	const maxPolls = spec.every === undefined ? 1 : (spec.polls ?? Infinity);
	const poll = (at: number, n: number): void => {
		if (lock.element !== undefined || !alive(at)) return;
		for (const el of spec.order) {
			if (holds(ctx, el, at)) {
				lock.element = el;
				lock.at = at;
				for (const cb of lock.onLock) cb(el, at);
				return;
			}
		}
		if (spec.every === undefined || n + 1 >= maxPolls) return;
		const next = at + spec.every;
		clock.schedule(next, Band.LAND, () => poll(next, n + 1));
	};
	const first = castStart + spec.from;
	clock.schedule(first, Band.LAND, () => poll(first, 0));
}
