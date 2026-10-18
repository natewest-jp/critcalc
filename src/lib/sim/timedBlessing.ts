/**
 * src/lib/sim/timedBlessing.ts
 *
 * ⚓ A NIGHTSOUL BLESSING ON A TIMER, FED BY POINTS THAT BUILD OUTSIDE IT —
 * Varesa's Fiery Passion (2026-10-17; gcsim `internal/characters/varesa/`). See
 * `TimedBlessingSpec` for the rules. One per character that authors
 * `CharacterData.timedBlessing`; Varesa is the only author.
 *
 * ⛔ NOT `nightsoul.ts`. That pool drains and holds points only INSIDE its
 * Blessing; here the points sit outside it, never drain, and the Blessing is a
 * timer. Bending one model to say both would make each harder to read.
 *
 * ⚓ The pool owns the Blessing's state window, as the draining pool does: opened
 * at the entry with its timer's end, cut earlier by an exit. `cs.states` and the
 * IR record are written together, so ability resolution mid-parse (her Fiery
 * Passion E and plunge) sees the answer the timeline draws.
 */

import type { BlessingPoints, PlungeBlessing } from '$lib/types/ability';
import type { CharacterData } from '$lib/types/character';
import { framesOf } from '$lib/utils/frames';
import { Band, type Clock } from './clock';
import type { SimContext, StateWindowRec } from './context';

export type TimedBlessing = {
	points: number;
	/** The open Blessing's window, or null. Past its end it is over. */
	window: StateWindowRec | null;
	freeSkill: boolean;
	/** A plunge inside the Blessing: it ends at the next action that is not a burst. */
	exitPending: boolean;
};

function blessingOf(ctx: SimContext, char: CharacterData): TimedBlessing | undefined {
	if (!char.timedBlessing) return undefined;
	let b = ctx.timedBlessings.get(char.id);
	if (!b) {
		b = { points: 0, window: null, freeSkill: false, exitPending: false };
		ctx.timedBlessings.set(char.id, b);
	}
	return b;
}

/** Is the Blessing open at `at`? A timer that has run out closes it lazily. */
function isOpen(b: TimedBlessing, at: number): boolean {
	if (b.window && b.window.end <= at) {
		b.window = null;
		b.freeSkill = false;
		b.exitPending = false;
	}
	return b.window !== null;
}

/**
 * ⚓ THE CAST THAT OPENED IT DRAWS IT. A Blessing a burst entered is that
 * burst's bar, for exactly as long as the Blessing runs — the 15s stance bar
 * it replaced, now also cut where an in-Blessing plunge ends it. One entered
 * by a plunge has no cast to draw it, as before. ⚠️ An instant cast's `uptime`
 * is written at the cast and never re-stamped, so this is its only writer.
 */
function drawOnOpener(ctx: SimContext, window: StateWindowRec): void {
	if (window.sourceCastId === undefined) return;
	const ev = ctx.events.find((e) => e.kind === 'cast' && e.id === window.sourceCastId);
	if (ev && ev.kind === 'cast') ev.uptime = window.end - ev.time;
}

function exit(ctx: SimContext, char: CharacterData, b: TimedBlessing, at: number): void {
	if (b.window && b.window.end > at) {
		b.window.end = Math.max(b.window.start, at);
		ctx.getCharState(char.id).states.set(b.window.name, b.window.end);
		drawOnOpener(ctx, b.window);
	}
	b.window = null;
	b.freeSkill = false;
	b.exitPending = false;
}

function gain(
	ctx: SimContext,
	char: CharacterData,
	b: TimedBlessing,
	at: number,
	points: number | 'max',
	enters: boolean,
	sourceCastId?: number
): void {
	const spec = char.timedBlessing!;
	b.points = points === 'max' ? spec.max : Math.min(spec.max, b.points + points);
	if (!enters || isOpen(b, at) || b.points < spec.max) return;
	const end = at + framesOf(spec.duration);
	b.window = {
		characterId: char.id,
		name: spec.state,
		start: at,
		end,
		...(sourceCastId !== undefined ? { sourceCastId } : {})
	};
	ctx.stateWindowRecs.push(b.window);
	ctx.getCharState(char.id).states.set(spec.state, end);
	drawOnOpener(ctx, b.window);
	b.freeSkill = spec.freeSkillOnEntry === true;
}

/** A cast's points, scheduled at their frame. `spec` is the RESOLVED form's —
 *  a variant's own, never the base's behind it. */
export function timedBlessingOnCast(
	ctx: SimContext,
	clock: Clock,
	char: CharacterData,
	spec: BlessingPoints | undefined,
	castStart: number,
	castId: number
): void {
	const b = blessingOf(ctx, char);
	if (!b || !spec) return;
	const at = castStart + spec.at;
	clock.schedule(at, Band.LAND, () =>
		gain(ctx, char, b, at, spec.points, spec.enters === true, castId)
	);
}

/** A plunge: inside the Blessing it spends every point and arms the exit;
 *  outside, its points land with its hit. */
export function timedBlessingOnPlunge(
	ctx: SimContext,
	clock: Clock,
	char: CharacterData,
	spec: PlungeBlessing | undefined,
	start: number,
	landsAt: number
): void {
	const b = blessingOf(ctx, char);
	if (!b || !spec) return;
	if (spec.spendsAll) {
		if (!isOpen(b, start)) return;
		b.points = 0;
		b.exitPending = true;
		return;
	}
	if (spec.points === undefined) return;
	const points = spec.points;
	clock.schedule(landsAt, Band.LAND, () =>
		gain(ctx, char, b, landsAt, points, spec.enters === true)
	);
}

/** The start of her next action (or her swap-out): a pending exit lands here,
 *  unless the action is a burst. */
export function timedBlessingOnAction(
	ctx: SimContext,
	char: CharacterData,
	at: number,
	isBurst: boolean
): void {
	const b = ctx.timedBlessings.get(char.id);
	if (!b || !isOpen(b, at) || !b.exitPending || isBurst) return;
	exit(ctx, char, b, at);
}

/** Take the free skill if one is waiting — true means this cast spends no
 *  charge and starts no cooldown. */
export function takeFreeSkill(ctx: SimContext, char: CharacterData, at: number): boolean {
	const b = ctx.timedBlessings.get(char.id);
	if (!b || !isOpen(b, at) || !b.freeSkill) return false;
	b.freeSkill = false;
	return true;
}

/** Is a free skill waiting at `at`? (The cooldown scan's question; no spend.) */
export function hasFreeSkill(ctx: SimContext, char: CharacterData, at: number): boolean {
	const b = ctx.timedBlessings.get(char.id);
	return !!b && isOpen(b, at) && b.freeSkill;
}
