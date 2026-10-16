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
import type { StateWindowRec } from './context';
import type { AccrualRecord } from './accrual';

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
	/** The holder stays on field until the window ends (`holdsField`): the
	 *  turn-ending swap waits for it. Read where the turn ends. */
	holdsField: boolean;
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
	 *  keeps its full owner-bar width while `end` clamps to the swap-out time.
	 *  ⚓ A cast that `endsStance` clamps THIS too (2026-10-04): the stance ended
	 *  for real, so the bar ends with it. */
	ownerUptime: number;
	/** Per-durationExtensions[]-index fire counts (reset each window open). */
	extCounts: Map<number, number>;
	/** Per-durationExtensions[]-index last-fire cursor (reset each window open). */
	extLastFire: Map<number, number>;
	/** `procCap: { per: 'stance' }` fire counts, `${nodeId}#${effectIndex}` →
	 *  fires in THIS window (cooldown-reduction round, 2026-09-18). Zeroed by
	 *  construction when a stance opens, because the record is fresh — the
	 *  `extCounts` precedent. Varka's 15 Secret Rite hits, Raiden C6's five. */
	procCounts: Map<string, number>;
	/** The named state this stance opened alongside `inStance` (`opensState`,
	 *  e.g. `nightsoulBlessing`) — its live entry in `cs.states` and its IR
	 *  record, so an extension that moves the stance's end moves the companion
	 *  with it (small-fix bundle, 2026-09-17). ⚠️ Until then an extended stance
	 *  ran on while its companion expired at the original end, and every
	 *  ability gated on the companion went dark for the extension. */
	companion?: { name: string; rec: { end: number } };
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
	/** Transient states flagged `terminatesOnAction` — closed at the START of
	 *  this character's next attack or cast by `settleOwnerStates` (Lauma's deer;
	 *  charged-forms round, 2026-09-16). ⛔ Not by a dash or a jump. */
	statesTerminatingOnAction: Set<string>;
	/** Window records carrying an `onEnd` whose chained window has not been
	 *  written yet. ⚓ An INDEX, not a scan: `settleOwnerStates` runs at every
	 *  attack and cast, and walking `ctx.stateWindowRecs` there would restore the
	 *  quadratic `inferredStates` paid for (a run of 16,000 Cyno bursts opens
	 *  16,000 transient windows). A record leaves the list the moment it chains. */
	pendingChains: StateWindowRec[];
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
	/** The expiry a `gainStacks … onSwapIn` lifetime grant last wrote,
	 *  `${nodeId}#${effectIndex}` → expiry. Taking the field again REFRESHES
	 *  that one stack rather than adding a second — see
	 *  `dispatchGainStacksOnSwapIn`. */
	swapInGrantExpiry: Map<string, number>;
	/** The onReaction twin (stack-threshold round, 2026-09-18): a `procCooldown`
	 *  on an onReaction `gainStacks` is how Columbina's Gravity states its RATE
	 *  — one 2s status per reaction, 10/s while live — as "20 per reaction, at
	 *  most one grant per 2s", rather than as a count that a dense reaction
	 *  stream would run away with. `${nodeId}#${effectIndex}` → last fire. */
	onReactionProcLastFire: Map<string, number>;
	/** `cooldownReduce` fires, `${nodeId}#${effectIndex}` → last fire time
	 *  (cooldown-reduction round, 2026-09-18). One map for all three of its
	 *  triggers, since one effect has one trigger; keyed like the two above. */
	cooldownReduceLastFire: Map<string, number>;
	/** Live (and lapsed, kept for retroactive refresh) accrual statuses by
	 *  `accrual.group` (stack-threshold round, exact model). See `accrual.ts`. */
	accruals: Map<string, AccrualRecord>;
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
		statesTerminatingOnAction: new Set(),
		pendingChains: [],
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
		swapInGrantExpiry: new Map(),
		onReactionProcLastFire: new Map(),
		cooldownReduceLastFire: new Map(),
		accruals: new Map(),
		rotationStacks: new Map(),
		rotationStackInstances: new Map()
	};
}
