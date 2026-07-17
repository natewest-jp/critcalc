/**
 * src/lib/utils/rotationEvents.ts
 *
 * The P4 timeline IR: the parser's first-class event/window output surface.
 * Point events (`TimelineEvent`) mark instants; window records
 * (`TimelineWindow`) mark spans whose end times are FINAL — all duration
 * extensions, swap-truncations, and recast-truncations are already applied
 * by the time the parser returns. Consumers never re-derive window ends
 * from bar geometry.
 *
 * Identity + provenance (post-P4 #1, 2026-07-17): every event carries a
 * stable `id` (unique within a parse, assigned in emission order and
 * deterministic for a given notation), and windows carry `sourceCastId` —
 * the id of the `cast` event that opened them. Consumers that pair windows
 * to casts (afterDuration buff anchoring) join on ids, not on timestamp
 * coincidence.
 *
 * Design call (P4, 2026-07-17): windows are records, not open/close event
 * pairs. Stance/summon extensions retroactively move window ends during
 * parsing, so a close-event's time isn't knowable at open time — and every
 * consumer wants spans anyway ("windows not numbers" constitution).
 *
 * Types only — no runtime imports, safe for both the parser and the pure
 * timeline modules.
 */

import type { Reaction } from '$lib/types/ability';

/** One resolved E/Q cast. The single source of the per-cast record (post-P4
 *  #3): the timeline bars (`eBars`/`qBars`) are projections of these events —
 *  every geometric field the renderer needs lives here, so the bar ↔ cast
 *  bijection holds by construction. */
export type CastEvent = {
	kind: 'cast';
	/** Stable per-parse event id (emission order, unique across kinds). */
	id: number;
	characterId: string;
	ability: 'skill' | 'burst';
	/** id of the resolved ability variant actually cast (matches the
	 *  E-charge-queue key for skills). */
	abilityId: string;
	/** Token text as typed, e.g. "E", "hE", "Q" — drives variant-sensitive
	 *  consumers (plunge selection, trigger filters) and the bar label. */
	label: string;
	/** Absolute cast start (seconds). */
	time: number;
	/** Cast animation duration (seconds). */
	castTime: number;
	/** Active-window duration in seconds (0 = instant). Final value: stance/
	 *  summon extension deltas are stamped here by the parser's finalize pass
	 *  before the bars are projected. */
	uptime: number;
	/** Cooldown seconds (variant/modifier-resolved). Drives the ghost-CD tail:
	 *  the rendered CD track spans up to `time + cooldown`. */
	cooldown: number;
	/** Absolute time the consumed charge/burst clock is mechanically ready
	 *  again — `time + cooldownStartDelay/60 + cooldown`, or the hitmark time
	 *  when a Sacrificial-series proc reset the CD. Can differ from
	 *  `time + cooldown` (the visual ghost tail) when cooldownStartDelay > 0. */
	readyAt: number;
	/** Frames (60fps) from cast start until the spawned summon becomes active.
	 *  0 when the ability spawns nothing (then `fieldStart === time`). */
	summonActivatesAt: number;
	/** Cast start plus the summon spawn offset (seconds). Equals `time`
	 *  when the ability spawns nothing. */
	fieldStart: number;
	/** True when a Sacrificial-series proc fired on this cast (CD reset to 0);
	 *  the bar renders as a dim continuation instead of uptime + ghost CD. */
	sacProcFired?: boolean;
	/** Snapshot of the caster's stack state at cast time. Absent when no
	 *  stacks were asserted/accrued in the current segment. */
	stackContext?: ReadonlyMap<string, number>;
};

/** Synthetic reaction emitted at a cast site (cast-only aura model). */
export type ReactionEvent = {
	kind: 'reaction';
	/** Stable per-parse event id (emission order, unique across kinds). */
	id: number;
	characterId: string;
	reaction: Reaction;
	time: number;
	castKind: 'skill' | 'burst';
};

/** Scheduled expiry of a tracked shield window (not shatter-by-damage). */
export type ShieldEndEvent = {
	kind: 'shieldEnd';
	/** Stable per-parse event id (emission order, unique across kinds). */
	id: number;
	characterId: string;
	ability: 'skill' | 'burst';
	time: number;
};

/** The public event stream. NB: the parser's per-cast `hit` records are
 *  parser-private (post-P4 #1 decision) — they exist at per-cast granularity
 *  solely for the internal onHit gainStacks dispatch and are NOT part of the
 *  IR. Action-level events (backlog #2) will introduce the real public
 *  per-action surface when they land. */
export type TimelineEvent = CastEvent | ReactionEvent | ShieldEndEvent;

/** Provenance shared by all window kinds. `sourceCastId` is the id of the
 *  `cast` event that opened the window. Absent only for windows not opened
 *  by an E/Q cast (e.g. a plunge-opened transient state — Varesa Apex
 *  Drive); every cast-opened window carries it. */
type WindowProvenance = {
	sourceCastId?: number;
};

/** Span records. `end` is final — extensions and truncations applied. */
export type TimelineWindow =
	/** A stance window (behavior: "stance" E/Q), extension-adjusted. */
	| ({
			kind: 'stance';
			characterId: string;
			start: number;
			end: number;
			source: 'skill' | 'burst';
	  } & WindowProvenance)
	/** A named state window (opensState — e.g. nightsoulBlessing). */
	| ({
			kind: 'state';
			characterId: string;
			name: string;
			start: number;
			end: number;
	  } & WindowProvenance)
	/** A summon's active span: spawn (cast + spawnsAt offset) → expiry,
	 *  with swap/recast truncation applied. */
	| ({
			kind: 'summon';
			characterId: string;
			label: string;
			start: number;
			end: number;
			source: 'skill' | 'burst';
	  } & WindowProvenance)
	/** A tracked shield's span (cast → scheduled expiry). */
	| ({
			kind: 'shield';
			characterId: string;
			source: 'skill' | 'burst';
			start: number;
			end: number;
	  } & WindowProvenance)
	/** A weapon-proc ICD span (e.g. Sacrificial reset on cooldown). */
	| ({ kind: 'weaponProc'; characterId: string; start: number; end: number } & WindowProvenance);
