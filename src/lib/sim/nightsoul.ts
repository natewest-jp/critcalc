/**
 * src/lib/sim/nightsoul.ts
 *
 * ⚓ A SIMULATED NIGHTSOUL POOL (Nightsoul round, 2026-10-16 — ⚓ Nate: Mavuika is
 * simulated for real, not drawn at fixed lengths). One per character that
 * authors `CharacterData.nightsoulPool`: Mavuika, and Ifa since the memory-triage
 * round (2026-10-30).
 *
 * gcsim's model, which all four of Nate's in-game runs matched
 * (`docs/rounds/mavuika-nightsoul-round-2026-10-16.md`):
 *
 *   - Points drain every 6 frames from the ENTRY frame (the phase survives a
 *     refill), by `drainPerTick` plus the current form's `extraDrainPerTick`.
 *   - A cast enters with `points` outside the Blessing, or adds them (capped)
 *     inside it — `enterNightsoulOrRegenerate`.
 *   - Spends (a Ring hit, a bike swing, a bike dash) come off at their instant.
 *   - A pause (her Crucible) multiplies every cost by 0 until it ends or she
 *     swaps out.
 *   - Below 0.001 the Blessing ENDS — there is no timer. A cast can also end it
 *     outright (`exitsAt`, gcsim `exitNightsoul`), and a skill stance still open
 *     ends with it (Ifa's hover, which has no form).
 *
 * ⚓⚓ THE POOL OWNS ITS STATE WINDOWS, AND THEIR ENDS ARE ITS PREDICTION. The
 * Blessing's window (and the current form's) ends where the points would run
 * out if nothing else happened; every change re-predicts and rewrites that end,
 * EARLIER or LATER. So a query mid-parse already sees the right answer, a
 * rotation that stops mid-Blessing still shows where it would end, and nothing
 * here has to "clamp only". ⛔ Don't route these windows through
 * `closeStateWindows`-style clamps from elsewhere — the swap loop in `run.ts`
 * skips them on purpose (`ownsState`).
 *
 * ⚠️ Not modelled: the recast E that switches form inside the Blessing
 * (⚓ Nate: later). ↻ The bike Charged Attack's +0.2 per tick IS, since the
 * bike Charged Attack round (`nightsoulCharging`).
 */

import type { NightsoulCastSpec, NightsoulPoolSpec, State } from '$lib/types/ability';
import type { CharacterData } from '$lib/types/character';
import { Band, type Clock } from './clock';
import type { SimContext, StateWindowRec } from './context';
import type { CharState } from './charState';
import { applyModifiers, DEFAULT_ASCENSION } from './conditions';
import { clampStance } from './states';

/** gcsim's drain task period: 0.1s. */
const TICK_F = 6;
/** gcsim exits below this, not at zero. */
const EMPTY = 0.001;
/** A Blessing cannot outlast its points; this only bounds a broken spec. */
const MAX_TICKS = 20000;

type Form = {
	state: State;
	rec: StateWindowRec;
	/** The cast that put her in this form — owner of a swap-out spawn. */
	ownerCastId: number;
	/** Schedules the owner cast's `spawnsAtSwapOutFrom` summons at a swap-out. */
	spawnAtSwap?: (at: number) => void;
};

export type NightsoulPool = {
	charId: string;
	spec: NightsoulPoolSpec;
	max: number;
	open: boolean;
	points: number;
	/** Entry frame — ticks land at `phase + 6k`, k ≥ 1. */
	phase: number;
	/** The last tick index already applied. */
	tick: number;
	blessing: StateWindowRec | null;
	form: Form | null;
	/** A form a cast entered before the Blessing opened (her burst outside it). */
	pendingForm: Omit<Form, 'rec'> | null;
	pause: { from: number; to: number } | null;
	/** A spinning Charged Attack is under way — the form's `chargingExtraPerTick`. */
	charging: boolean;
	/** Bumped at every re-prediction; a stale exit task does nothing. */
	gen: number;
};

/** The character's pool, created on first use; `undefined` for everyone else. */
export function poolOf(ctx: SimContext, char: CharacterData): NightsoulPool | undefined {
	const spec = char.nightsoulPool;
	if (!spec) return undefined;
	let pool = ctx.nightsoulPools.get(char.id);
	if (!pool) {
		const cLevel = ctx.constellationLevels?.[char.id] ?? 0;
		pool = {
			charId: char.id,
			spec,
			max: applyModifiers(spec.max, spec.maxModifiers, DEFAULT_ASCENSION, new Set(), cLevel),
			open: false,
			points: 0,
			phase: 0,
			tick: 0,
			blessing: null,
			form: null,
			pendingForm: null,
			pause: null,
			charging: false,
			gen: 0
		};
		ctx.nightsoulPools.set(char.id, pool);
	}
	return pool;
}

/** Does this character's pool own the state `name`? (The swap clamp skips it.) */
export function ownsState(ctx: SimContext, charId: string, name: string): boolean {
	const pool = ctx.nightsoulPools.get(charId);
	if (!pool) return false;
	return pool.spec.state === name || pool.spec.forms.some((f) => f.state === name);
}

const paused = (pool: NightsoulPool, t: number): boolean =>
	pool.pause !== null && t >= pool.pause.from && t < pool.pause.to;

function rateAt(pool: NightsoulPool, t: number): number {
	if (paused(pool, t)) return 0;
	const form = pool.form ? pool.spec.forms.find((f) => f.state === pool.form!.state) : undefined;
	return (
		pool.spec.drainPerTick +
		(form?.extraDrainPerTick ?? 0) +
		(pool.charging ? (form?.chargingExtraPerTick ?? 0) : 0)
	);
}

function setEnd(ctx: SimContext, cs: CharState, rec: StateWindowRec, end: number): void {
	rec.end = end;
	cs.states.set(rec.name, end);
	void ctx;
}

/** Apply every drain tick at or before `t`. May end the Blessing. */
function settle(ctx: SimContext, cs: CharState, pool: NightsoulPool, t: number): void {
	while (pool.open) {
		const at = pool.phase + (pool.tick + 1) * TICK_F;
		if (at > t) return;
		pool.tick += 1;
		const cost = rateAt(pool, at);
		if (cost <= 0) continue;
		pool.points -= Math.min(cost, pool.points);
		if (pool.points < EMPTY) exit(ctx, cs, pool, at);
	}
}

/** Where the points run out if nothing else happens — the current form and
 *  pause carried forward. */
function predictEnd(pool: NightsoulPool): number {
	let points = pool.points;
	for (let k = pool.tick + 1; k <= pool.tick + MAX_TICKS; k++) {
		const at = pool.phase + k * TICK_F;
		points -= Math.min(rateAt(pool, at), points);
		if (points < EMPTY) return at;
	}
	return pool.phase + (pool.tick + MAX_TICKS) * TICK_F;
}

/** Re-predict and rewrite every owned window's end; re-arm the exit. */
function refresh(ctx: SimContext, clock: Clock, cs: CharState, pool: NightsoulPool): void {
	if (!pool.open || !pool.blessing) return;
	const end = predictEnd(pool);
	setEnd(ctx, cs, pool.blessing, end);
	if (pool.form) setEnd(ctx, cs, pool.form.rec, end);
	const gen = ++pool.gen;
	clock.schedule(end, Band.TICK, () => {
		if (pool.gen !== gen) return;
		settle(ctx, cs, pool, end);
	});
}

function exit(ctx: SimContext, cs: CharState, pool: NightsoulPool, at: number): void {
	pool.open = false;
	pool.points = 0;
	pool.gen += 1;
	if (pool.blessing) setEnd(ctx, cs, pool.blessing, at);
	closeForm(ctx, cs, pool, at);
	// A pool with no forms (Ifa) still owns the skill stance that entered it:
	// the hover IS the Blessing. With a form this already ran in `closeForm`.
	if (cs.stance && cs.stance.source === 'skill' && cs.stance.end > at)
		clampStance(ctx, cs, pool.charId, at);
	pool.pendingForm = null;
}

/** Leave the current form at `at`. A skill-opened stance (her Hold E's bike)
 *  ends with the bike; the burst's stance is the Crucible and does not. */
function closeForm(ctx: SimContext, cs: CharState, pool: NightsoulPool, at: number): void {
	if (!pool.form) return;
	setEnd(ctx, cs, pool.form.rec, Math.max(pool.form.rec.start, at));
	// ⚓ A cast that opened the form WITHOUT a stance (Tap E's Ring) draws the
	// form as its pill, so a form cut short cuts the pill (Phase 3, 2026-10-17):
	// it drew the Ring's full 12.4s past a burst that ended the Ring. A stance
	// owner is clamped by `clampStance` below and stamped at finalize — ⛔ not
	// here. ⚠️ Recorded, and applied at the END of finalize (`pillCuts`): the
	// cast's `uptime` is also its primary summon's bar length, and cut now it
	// would erase the summon window's `naturalEnd` — the one fact that says the
	// window was CUT (no boundary tick).
	const opener = ctx.events.find((e) => e.kind === 'cast' && e.id === pool.form!.ownerCastId);
	if (opener && opener.kind === 'cast' && !ctx.stanceWindowRecs.some((r) => r.castRef === opener))
		ctx.pillCuts.set(opener.id, Math.min(ctx.pillCuts.get(opener.id) ?? Infinity, at));
	if (cs.stance && cs.stance.source === 'skill' && cs.stance.end > at)
		clampStance(ctx, cs, pool.charId, at);
	pool.form = null;
}

function openForm(
	ctx: SimContext,
	cs: CharState,
	pool: NightsoulPool,
	at: number,
	form: Omit<Form, 'rec'>
): void {
	closeForm(ctx, cs, pool, at);
	const rec: StateWindowRec = {
		characterId: pool.charId,
		name: form.state,
		start: at,
		end: at,
		sourceCastId: form.ownerCastId
	};
	ctx.stateWindowRecs.push(rec);
	cs.states.set(form.state, at);
	pool.form = { ...form, rec };
}

/** `enterNightsoulOrRegenerate(points)`. */
function enterOrRefill(
	ctx: SimContext,
	cs: CharState,
	pool: NightsoulPool,
	at: number,
	points: number | 'max',
	castId: number
): void {
	const amount = points === 'max' ? pool.max : points;
	settle(ctx, cs, pool, at);
	if (pool.open) {
		pool.points = Math.min(pool.max, pool.points + amount);
		return;
	}
	pool.open = true;
	pool.points = Math.min(pool.max, amount);
	// Ticks land at `phase + 6k`, k ≥ 1, so a first tick at `at + f` is phase `at + f − 6`.
	pool.phase = at + (pool.spec.firstTickAfter ?? TICK_F) - TICK_F;
	pool.tick = 0;
	pool.blessing = {
		characterId: pool.charId,
		name: pool.spec.state,
		start: at,
		end: at,
		sourceCastId: castId
	};
	ctx.stateWindowRecs.push(pool.blessing);
	if (pool.pendingForm) {
		openForm(ctx, cs, pool, at, pool.pendingForm);
		pool.pendingForm = null;
	}
}

/**
 * A cast's effect on the pool, at its start. Runs BEFORE the cast opens its own
 * stance (a Hold-E bike stance it replaces is clamped here) and before it
 * schedules its summons (a Tap's Ring reads the Ring form this opens).
 */
export function nightsoulOnCast(
	ctx: SimContext,
	clock: Clock,
	char: CharacterData,
	cs: CharState,
	spec: NightsoulCastSpec | undefined,
	castStart: number,
	castId: number,
	spawnAtSwap: ((at: number) => void) | undefined
): void {
	const pool = poolOf(ctx, char);
	if (!pool || !spec) return;
	settle(ctx, cs, pool, castStart);
	const enterNow = spec.points !== undefined && (spec.pointsAt ?? 0) === 0;
	if (enterNow) enterOrRefill(ctx, cs, pool, castStart, spec.points!, castId);
	if (spec.entersForm) {
		const form = { state: spec.entersForm, ownerCastId: castId, spawnAtSwap };
		if (pool.open) openForm(ctx, cs, pool, castStart, form);
		else pool.pendingForm = form;
	}
	if (spec.points !== undefined && !enterNow) {
		const at = castStart + spec.pointsAt!;
		const points = spec.points;
		clock.schedule(at, Band.TICK, () => {
			enterOrRefill(ctx, cs, pool, at, points, castId);
			refresh(ctx, clock, cs, pool);
		});
	}
	if (spec.pause) {
		const from = castStart + spec.pause.at;
		pool.pause = { from, to: from + spec.pause.frames };
	}
	if (spec.exitsAt !== undefined) {
		const at = castStart + spec.exitsAt;
		const end = () => {
			settle(ctx, cs, pool, at);
			if (pool.open) exit(ctx, cs, pool, at);
		};
		if (spec.exitsAt === 0) end();
		else clock.schedule(at, Band.TICK, end);
	}
	refresh(ctx, clock, cs, pool);
}

/** Spend `amount` at `at` (a Ring hit, a bike swing, a bike dash). Paused costs
 *  are multiplied by 0 and spend nothing. */
export function nightsoulSpend(
	ctx: SimContext,
	clock: Clock,
	char: CharacterData,
	at: number,
	amount: number
): void {
	const pool = ctx.nightsoulPools.get(char.id);
	if (!pool || !pool.open || amount <= 0) return;
	const cs = ctx.getCharState(char.id);
	settle(ctx, cs, pool, at);
	if (!pool.open || paused(pool, at)) return;
	pool.points -= Math.min(amount, pool.points);
	if (pool.points < EMPTY) exit(ctx, cs, pool, at);
	else refresh(ctx, clock, cs, pool);
}

/** Is the character in this pool form at `at`, by the live pool? */
export function nightsoulFormAt(ctx: SimContext, charId: string, state: State): boolean {
	const pool = ctx.nightsoulPools.get(charId);
	return !!pool?.open && pool.form?.state === state;
}

/**
 * Her swap-out: the Crucible ends (a swap deletes `burstKey`), and a form with
 * `swapTurnsInto` becomes that form — the Flamestrider turns into the Ring,
 * whose summon the owning cast spawns HERE. The Blessing carries on.
 */
export function nightsoulOnSwapOut(
	ctx: SimContext,
	clock: Clock,
	char: CharacterData,
	at: number
): void {
	const pool = ctx.nightsoulPools.get(char.id);
	if (!pool) return;
	const cs = ctx.getCharState(char.id);
	settle(ctx, cs, pool, at);
	if (pool.pause && pool.pause.to > at) pool.pause.to = Math.max(pool.pause.from, at);
	pool.pendingForm = null;
	if (!pool.open || !pool.form) return refresh(ctx, clock, cs, pool);
	const from = pool.form;
	const into = pool.spec.forms.find((f) => f.state === from.state)?.swapTurnsInto;
	if (!into) return refresh(ctx, clock, cs, pool);
	openForm(ctx, cs, pool, at, { state: into, ownerCastId: from.ownerCastId });
	refresh(ctx, clock, cs, pool);
	if (from.spawnAtSwap) {
		ctx.swapSpawns.set(from.ownerCastId, at);
		from.spawnAtSwap(at);
	}
}

/** A spinning Charged Attack starts or stops at `at` (gcsim's +0.2 per tick in
 *  `ChargeAttackState` on the bike). Settled first, so the ticks before `at`
 *  drain at the old rate. */
export function nightsoulCharging(
	ctx: SimContext,
	clock: Clock,
	char: CharacterData,
	at: number,
	on: boolean
): void {
	const pool = ctx.nightsoulPools.get(char.id);
	if (!pool || pool.charging === on) return;
	const cs = ctx.getCharState(char.id);
	settle(ctx, cs, pool, at);
	pool.charging = on;
	refresh(ctx, clock, cs, pool);
}
