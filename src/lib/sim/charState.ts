/**
 * src/lib/sim/charState.ts
 *
 * Per-character mutable parser state (gauge-round L3c — lifted verbatim out of
 * `notationParser.ts`, where it was declared inline above `parseNotation`).
 *
 * `parseNotation` formerly threaded ~18 parallel `Map<charId, …>`s; the
 * 2026-07-05 bug sweep showed order-of-operations across them was the parser's
 * top bug class. `CharState` groups all of a character's mutable parser state
 * behind one lookup (`getCharState`). Everything here persists across segments
 * (cross-segment cooldown / stance / drain tracking). NB: E-charge queues stay
 * keyed by ABILITY id — not folded in here — because stance characters keep
 * independent charge queues per skill variant (see the eChargeQueues decl).
 *
 * ⚠️⚠️ TWO OF THESE RECORDS ARE ALIASED INTO THE IR COLLECTORS AND THE ALIASING
 * IS LOAD-BEARING (L3 plan §1). `stanceWindowRecs.push(cs.stance)` and
 * `summonExtRecs.push(cs.summonExt)` retain the SAME OBJECT, which extension
 * dispatch, the swap clamp and the finalize uptime stamp then mutate in place —
 * and `castRef` is likewise the live `CastEvent` that finalize writes back to.
 * ⛔ Never copy a record into a collector "to be safe": a copy typechecks, the
 * differ goes red on a window end that stopped growing, and the reason is
 * invisible at the site.
 */

import type { CastAbility, DurationExtension } from '$lib/types/ability';
import type { CastEvent } from '$lib/utils/rotationEvents';

/** Active stance window for a character. Present iff a stance E/Q has ever been
 *  cast (never cleared — swap-close only clamps `end`, mirroring the old
 *  never-deleted `stanceWindows` entry). */
export type StanceRecord = {
	/** Absolute window end (FRAMES). Extended by durationExtensions, clamped to
	 *  the swap-out time when the owner terminatesOnSwap. */
	end: number;
	/** Whether the window terminates on swap-out. Recorded at open time so
	 *  variant-driven stances close correctly. Set false after swap-close so a
	 *  later swap in a segment that never re-opened doesn't re-clamp (mirrors the
	 *  old `stanceTerminatesOnSwap.delete`). */
	terminatesOnSwap: boolean;
	/** Ability that opened the window; read for its durationExtensions[]. */
	ownerAbility: CastAbility;
	/** The cast event that opened the window (post-P4 #3: bars are projections
	 *  of cast events, so the finalize uptime stamp lands on the EVENT — the
	 *  projected bar inherits it). Not mutated during parsing: extension
	 *  dispatchers accumulate `ownerUptime`; the finalize pass stamps it back. */
	castRef: CastEvent;
	/** Character that owns the stance (for the `stance` TimelineWindow). */
	characterId: string;
	/** Absolute window start = cast start, FRAMES (for the `stance` TimelineWindow). */
	start: number;
	/** Which cast opened the window (skill/burst) — the window's `source`. */
	source: 'skill' | 'burst';
	/** Event id of the `cast` that opened the window (IR provenance). */
	sourceCastId: number;
	/** Accumulated owner-bar uptime: initial duration + fired extension deltas.
	 *  The finalize pass stamps `barRef.uptime = ownerUptime`. Distinct from
	 *  `end`, which is the (swap-clamped) gating end — a swap-terminated stance
	 *  keeps its full owner-bar width while `end` clamps to the swap-out time. */
	ownerUptime: number;
	/** Per-durationExtensions[]-index fire counts (reset each window open). */
	extCounts: Map<number, number>;
	/** Per-durationExtensions[]-index last-fire cursor (reset each window open). */
	extLastFire: Map<number, number>;
};

/** Active summon-bound durationExtensions[] owner (E3 v1.5). Registered when a
 *  cast spawns a summon carrying extensions (Collei A4). Replaced per matching
 *  cast; skipped once `endTime` is in the past. */
export type SummonExtRecord = {
	endTime: number;
	extensions: DurationExtension[];
	/** The cast event that spawned the extension-bearing summon; the finalize
	 *  pass stamps `castRef.uptime = ownerUptime` before bars are projected. */
	castRef: CastEvent;
	/** Accumulated owner uptime (initial duration + fired extension deltas);
	 *  stamped onto the cast event at finalize (P4 — replaces the old live
	 *  `bar.uptime += delta` back-channel). */
	ownerUptime: number;
	counts: Map<number, number>;
	lastFires: Map<number, number>;
};

export type CharState = {
	/** Per-character burst cooldown clock (absolute time). `-Infinity` = never
	 *  cast (treated as "no gate" via the isFinite check at the Q handler top). */
	qReadyAt: number;
	/** Weapon cdReset (Sacrificial series) proc-ready clock: when the proc ICD
	 *  expires and it can fire again. 0 = ready. */
	sacProcReadyAt: number;
	/** Open stance window, or undefined if none has ever opened. */
	stance?: StanceRecord;
	/** Named state windows opened by stance abilities with `opensState`
	 *  (e.g. nightsoulBlessing) or by the transient-state primitive
	 *  (symphonyWindow, apexDrive). state key → absolute end time. */
	states: Map<string, number>;
	/** Transient states flagged `terminatesOnSwap` — clamped to the swap-out
	 *  time at segment end, independently of any stance window (a stance's own
	 *  terminatesOnSwap clamp covers its opensState companion separately). */
	statesTerminatingOnSwap: Set<string>;
	/** Skill/burst chain-stage positions (Diluc E1→E2→E3). */
	chains: Map<'skill' | 'burst', { index: number; expiresAt: number }>;
	/** Active summon-extension owner, or undefined. */
	summonExt?: SummonExtRecord;
	/** Pending shield-end records, sorted by `endTime` ascending; drained at each
	 *  cast and at rotation end. */
	shields: { ability: 'skill' | 'burst'; endTime: number }[];
	/** Per-onShieldEnd-effect proc cooldown: `${nodeId}#${effectIndex}` → last
	 *  fire time (Kachina C6 "once every 5s"). */
	shieldEndProcCooldown: Map<string, number>;
	/** onReaction gainStacks accrual (rotation-wide, off-field-inclusive):
	 *  key → stack count. */
	onReactionStacks: Map<string, number>;
	/** Per-instance expiry stamps for lifetime-bearing onReaction grants:
	 *  key → expiry times. */
	onReactionStackInstances: Map<string, number[]>;
	/** onHit gainStacks per-source slot expiry (Skirk A4): key → sourceCharId →
	 *  expiry time. */
	sourceLifetime: Map<string, Map<string, number>>;
	/** Drain-anchor timestamps (E3 v2): drain-bearing gainStacks key → time decay
	 *  was last applied. */
	drainAnchors: Map<string, number>;
	/** onHit gainStacks accrual for `source: 'team' | 'others'` grants
	 *  (rotation-wide, off-field-inclusive — the onHit analog of
	 *  `onReactionStacks`). `source: 'self'` grants write the hitter's
	 *  per-segment `stackState` instead (per-segment scope — a swap clears
	 *  the pool, matching in-game Yanfei-seal semantics). key → count. */
	onHitStacks: Map<string, number>;
	/** Per-instance expiry stamps for lifetime-bearing team/others onHit
	 *  grants: key → expiry times. */
	onHitStackInstances: Map<string, number[]>;
	/** Per-onHit-effect proc cooldown (`Effect.procCooldown`):
	 *  `${nodeId}#${effectIndex}` → last fire time. Escoffier C6's 0.5s ICD
	 *  is the canonical consumer; mirrors `shieldEndProcCooldown`. */
	onHitProcLastFire: Map<string, number>;
	/** ⚓⚓ THE HOME OF A `scope: 'rotation'` STACK KEY (2026-08-31). Everything
	 *  above it in this record is rotation-wide because the HOLDER may be off
	 *  field when the trigger fires; this pair is rotation-wide because the
	 *  RESOURCE outlives a segment — Alyosha's Hunter's Mark is a state on the
	 *  opponent with its own 15s clock. The two reasons are independent and the
	 *  containers are kept apart so neither field's name lies about what is in
	 *  it (an `onCast` grant lives here too, which `onHitStacks` could not say).
	 *
	 *  ⚠️ AUTHORITATIVE, and the live segment pool is its MIRROR: writes land
	 *  here first and are copied into `stackState`/`stackInstances` whenever the
	 *  holder has one, so every existing reader keeps reading the segment map.
	 *  ⛔ Never read one without the other having been synced — that is what
	 *  `syncRotationStacksToStackState` is for. */
	rotationStacks: Map<string, number>;
	/** Per-instance expiry stamps for lifetime-bearing rotation-scoped grants.
	 *  Expired lazily by `applyRotationLifetimeExpiry`, which is the rotation
	 *  twin of `applyLifetimeExpiry` and runs at the same settle points PLUS at
	 *  every summon tick (the one dispatch site that has no segment pool). */
	rotationStackInstances: Map<string, number[]>;
};

/** A character's state at rotation start: no casts, no windows, every clock
 *  open. ⚠️ `qReadyAt: -Infinity` means "never cast" and is read through an
 *  `isFinite` check at the Q handler — ⛔ not 0, which would be a real gate
 *  that happens to have passed. */
export function createCharState(): CharState {
	return {
		qReadyAt: -Infinity,
		sacProcReadyAt: 0,
		states: new Map(),
		statesTerminatingOnSwap: new Set(),
		chains: new Map(),
		shields: [],
		shieldEndProcCooldown: new Map(),
		onReactionStacks: new Map(),
		onReactionStackInstances: new Map(),
		sourceLifetime: new Map(),
		drainAnchors: new Map(),
		onHitStacks: new Map(),
		onHitStackInstances: new Map(),
		onHitProcLastFire: new Map(),
		rotationStacks: new Map(),
		rotationStackInstances: new Map()
	};
}
