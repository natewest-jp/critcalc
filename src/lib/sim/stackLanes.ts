/**
 * src/lib/sim/stackLanes.ts
 *
 * ⚓ A STACK COUNT DRAWN AS A ROW OF ITS OWN (Mirror row round, 2026-10-30) —
 * `Ability.drawsStacks`. Alhaitham's Chisel-Light Mirrors are the case: a thing
 * in the world whose count drives his infusion, his Projection Attacks and his
 * burst, drawn in the summon lane as one stepped bar (Odette's grammar, ⚓ Nate).
 *
 * ⚓ THE LEDGER IS THE TURN'S OWN INSTANCE POOL. A drawn key is a segment-scoped
 * `lifetime` key (lint D.57), so its whole future is in its expiry list the
 * moment it is written: recording every write (`LaneLedgerMap`) and the swap
 * that drops the pool (`closeStackLanes`) is enough to rebuild every step,
 * expiries included, exactly. ⛔ Not the stepped-stacks ledger
 * (`SimContext.stackHistory`), which records counts and so refuses lifetime keys:
 * a count written at a settle point would draw each loss at the next settle, late.
 */

import type { CharacterData } from '$lib/types/character';
import type { TimelineWindow } from '$lib/utils/rotationEvents';
import type { SimContext } from './context';

export type StackLane = { key: string; label: string; source: 'skill' | 'burst' };

type StackWindow = Extract<TimelineWindow, { kind: 'stacks' }>;

const lanesCache = new WeakMap<CharacterData, StackLane[]>();

/** Every drawn key this character declares. Constellation-ungated: the
 *  key-space rule — a row exists or not, whatever the C-level. */
export function stackLanesOf(char: CharacterData): StackLane[] {
	const cached = lanesCache.get(char);
	if (cached) return cached;
	const lanes: StackLane[] = [];
	for (const ab of char.abilities) {
		if (ab.abilityType !== 'skill' && ab.abilityType !== 'burst') continue;
		if (ab.drawsStacks) lanes.push({ ...ab.drawsStacks, source: ab.abilityType });
	}
	lanesCache.set(char, lanes);
	return lanes;
}

const historyId = (charId: string, key: string): string => `${charId}::${key}`;

/** One write of a drawn key's expiry list, collapsing same-frame writes into
 *  the LAST one (a grant then a sweep on one frame is the sweep's list). */
function record(ctx: SimContext, id: string, at: number, expiries: readonly number[]): void {
	let list = ctx.stackLaneHistory.get(id);
	if (!list) ctx.stackLaneHistory.set(id, (list = []));
	const last = list[list.length - 1];
	const entry = { at, expiries: [...expiries] };
	if (last && last.at === at) list[list.length - 1] = entry;
	else list.push(entry);
}

/**
 * A turn's instance pool that reports every write of a drawn key. ⚠️ Every
 * instance write in `stacks.ts` goes through `set` or `delete`, never an
 * in-place splice of a list already in the map — that is what keeps the ledger
 * whole.
 */
export class LaneLedgerMap extends Map<string, number[]> {
	#keys: ReadonlySet<string> | undefined;
	#report: ((key: string, expiries: readonly number[]) => void) | undefined;
	constructor(
		keys: ReadonlySet<string>,
		report: (key: string, expiries: readonly number[]) => void
	) {
		super();
		this.#keys = keys;
		this.#report = report;
	}
	override set(key: string, value: number[]): this {
		super.set(key, value);
		if (this.#keys?.has(key)) this.#report?.(key, value);
		return this;
	}
	override delete(key: string): boolean {
		const had = super.delete(key);
		if (had && this.#keys?.has(key)) this.#report?.(key, []);
		return had;
	}
}

/** A fresh turn's instance pool: the ledger when the character draws a key,
 *  else a plain map. */
export function newInstancePool(ctx: SimContext, char: CharacterData): Map<string, number[]> {
	const lanes = stackLanesOf(char);
	if (lanes.length === 0) return new Map();
	return new LaneLedgerMap(new Set(lanes.map((l) => l.key)), (key, expiries) =>
		record(ctx, historyId(char.id, key), ctx.stackClock(), expiries)
	);
}

/** The turn is over: the swap drops the pool (gcsim's `alhaitham-exit`). */
export function closeStackLanes(ctx: SimContext, char: CharacterData, at: number): void {
	for (const lane of stackLanesOf(char)) {
		const list = ctx.stackLaneHistory.get(historyId(char.id, lane.key));
		const last = list?.[list.length - 1];
		if (last && last.expiries.some((e) => e > at))
			record(ctx, historyId(char.id, lane.key), at, []);
	}
}

/** The count over time, from the recorded expiry lists: between two writes the
 *  count is the number of the earlier list's expiries still ahead. */
export function stepsOf(
	history: readonly { at: number; expiries: readonly number[] }[]
): { at: number; count: number }[] {
	const out: { at: number; count: number }[] = [];
	const push = (at: number, count: number): void => {
		const last = out[out.length - 1];
		if (last && last.at === at) {
			last.count = count;
			const prev = out[out.length - 2];
			if (prev && prev.count === count) out.pop();
			return;
		}
		if (last ? last.count !== count : count > 0) out.push({ at, count });
	};
	for (let i = 0; i < history.length; i++) {
		const { at, expiries } = history[i];
		const next = history[i + 1]?.at ?? Infinity;
		const live = expiries.filter((e) => e > at).sort((a, b) => a - b);
		push(at, live.length);
		live.forEach((e, j) => {
			if (e < next) push(e, live.length - 1 - j);
		});
	}
	return out;
}

/** Each span a drawn key was held above zero, as one `stacks` window. */
export function stackLaneWindows(
	ctx: SimContext,
	getCharacter: (id: string) => CharacterData | null | undefined
): StackWindow[] {
	const out: StackWindow[] = [];
	for (const [id, history] of ctx.stackLaneHistory) {
		const sep = id.lastIndexOf('::');
		const charId = id.slice(0, sep);
		const key = id.slice(sep + 2);
		const char = getCharacter(charId);
		const lane = char && stackLanesOf(char).find((l) => l.key === key);
		if (!char || !lane) continue;
		let max = 0;
		for (const src of [...char.abilities, ...(char.passives ?? []), ...(char.constellations ?? [])])
			for (const fx of src.effects ?? [])
				if (fx.type === 'gainStacks' && fx.key === key && fx.max !== undefined)
					max = Math.max(max, fx.max);
		let open: { at: number; count: number }[] | null = null;
		const flush = (end: number): void => {
			if (open && end > open[0].at)
				out.push({
					kind: 'stacks',
					characterId: charId,
					key,
					label: lane.label,
					source: lane.source,
					start: open[0].at,
					end,
					steps: open,
					...(max > 0 ? { max } : {})
				});
			open = null;
		};
		for (const step of stepsOf(history)) {
			if (step.count > 0) (open ??= []).push(step);
			else flush(step.at);
		}
	}
	return out;
}
