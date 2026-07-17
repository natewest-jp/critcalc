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
 * Design call (P4, 2026-07-17): windows are records, not open/close event
 * pairs. Stance/summon extensions retroactively move window ends during
 * parsing, so a close-event's time isn't knowable at open time — and every
 * consumer wants spans anyway ("windows not numbers" constitution).
 *
 * Types only — no runtime imports, safe for both the parser and the pure
 * timeline modules.
 */

import type { Element, Reaction } from '$lib/types/ability';

/** One resolved E/Q cast. Carries everything the timeline modules currently
 *  re-derive per-bar: the resolved ability variant, the token text, the
 *  cast animation span, the summon-adjusted field start, and the per-cast
 *  stack snapshot for stack-gated effect filtering. */
export type CastEvent = {
	kind: 'cast';
	characterId: string;
	ability: 'skill' | 'burst';
	/** id of the resolved ability variant actually cast (matches the
	 *  E-charge-queue key for skills). */
	abilityId: string;
	/** Token text as typed, e.g. "E", "hE", "Q" — drives variant-sensitive
	 *  consumers (plunge selection, trigger filters). */
	label: string;
	/** Absolute cast start (seconds). */
	time: number;
	/** Cast animation duration (seconds). */
	castTime: number;
	/** Cast start plus the summon spawn offset (seconds). Equals `time`
	 *  when the ability spawns nothing. */
	fieldStart: number;
	/** Snapshot of the caster's stack state at cast time. Absent when no
	 *  stacks were asserted/accrued in the current segment. */
	stackContext?: ReadonlyMap<string, number>;
};

/** Synthetic reaction emitted at a cast site (cast-only aura model). */
export type ReactionTimelineEvent = {
	kind: 'reaction';
	characterId: string;
	reaction: Reaction;
	time: number;
	castKind: 'skill' | 'burst';
};

/** Raw hit surfaced at a cast site (per-cast granularity). */
export type HitTimelineEvent = {
	kind: 'hit';
	characterId: string;
	element: Element;
	time: number;
	castKind: 'skill' | 'burst';
};

/** Scheduled expiry of a tracked shield window (not shatter-by-damage). */
export type ShieldEndTimelineEvent = {
	kind: 'shieldEnd';
	characterId: string;
	ability: 'skill' | 'burst';
	time: number;
};

export type TimelineEvent =
	| CastEvent
	| ReactionTimelineEvent
	| HitTimelineEvent
	| ShieldEndTimelineEvent;

/** Span records. `end` is final — extensions and truncations applied. */
export type TimelineWindow =
	/** A stance window (behavior: "stance" E/Q), extension-adjusted. */
	| { kind: 'stance'; characterId: string; start: number; end: number; source: 'skill' | 'burst' }
	/** A named state window (opensState — e.g. nightsoulBlessing). */
	| { kind: 'state'; characterId: string; name: string; start: number; end: number }
	/** A summon's active span: spawn (cast + spawnsAt offset) → expiry,
	 *  with swap/recast truncation applied. */
	| {
			kind: 'summon';
			characterId: string;
			label: string;
			start: number;
			end: number;
			source: 'skill' | 'burst';
	  }
	/** A tracked shield's span (cast → scheduled expiry). */
	| { kind: 'shield'; characterId: string; source: 'skill' | 'burst'; start: number; end: number }
	/** A weapon-proc ICD span (e.g. Sacrificial reset on cooldown). */
	| { kind: 'weaponProc'; characterId: string; start: number; end: number };
