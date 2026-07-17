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

import type { Element, Reaction } from '$lib/types/ability';

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

/** One resolved non-cast input action (post-P4 #2). Per-SWING granularity
 *  for normals: an `N5` token emits 5 action events sharing one `blockId`;
 *  the track's input block is a finalize-time projection of the group.
 *  Charged/plunge/dash/jump/unset tokens emit exactly one event each. A
 *  plunge token whose frames cannot resolve emits NO event (and thus no
 *  block), matching the legacy emission. */
export type ActionEvent = {
	kind: 'action';
	/** Stable per-parse event id (emission order, unique across kinds). */
	id: number;
	characterId: string;
	action: 'normal' | 'charged' | 'plunge' | 'dash' | 'jump' | 'unset';
	/** Token text as typed — "N5" on EVERY swing of that token, "C"/"C1",
	 *  "P"/"hP"/"lP", "D", "J", "~?". The per-swing display name is derivable
	 *  as `N${comboIndex + 1}`. Drives the projected block's parts label. */
	label: string;
	/** Group anchor: the id of the FIRST event emitted for this input token
	 *  (anchor events satisfy `blockId === id`). One projected InputBlock per
	 *  group; the contiguity key for per-token-granularity consumers. */
	blockId: number;
	/** Absolute start of this swing/action (seconds). Frameless swings of one
	 *  token share their block's start time. */
	time: number;
	/** Animation seconds this swing advances the cursor; 0 when frame data
	 *  is absent (frameless kits keep today's zero-width block). */
	duration: number;
	/** Resolved normal-ability id (N/C/P only, when one resolved) — the
	 *  action-side analog of `CastEvent.abilityId`. Absent for D/J/unset. */
	abilityId?: string;
	/** 0-based position in the combo cycle (`normalCounter % hits.length` at
	 *  emission; the raw counter when `hits` are absent). Normals only. */
	comboIndex?: number;
	/** Hit element when the action is elemental (catalyst → infusion ?? the
	 *  character element; infused stance normals → infusion). ABSENT means
	 *  physical (incl. bow C1 partial shots). The projection key for the
	 *  block kind (`elemental-normal` vs `normal`) and the substrate fact
	 *  future onHit consumers (Flins C2, Escoffier C6) need. */
	element?: Element;
};

/** One team Nightsoul-Burst fire (post-P4 #5 arc, phase 3 — derivation moved
 *  parser-side). Greedy cooldown-gated: any E/Q cast or a catalyst
 *  character's input-token anchor triggers a fire when the team NB clock is
 *  ready. The NB lane's rendered span is `[time, time + cooldown]`;
 *  `nbRows.computeNBBars` is a pure projection of these events. Emitted only
 *  when the team has ≥1 Natlan unit. */
export type NightsoulBurstEvent = {
	kind: 'nightsoulBurst';
	/** Stable per-parse event id (emission order, unique across kinds). */
	id: number;
	/** The character whose cast/action triggered this fire. */
	characterId: string;
	time: number;
	/** Team-size-derived NB cooldown: 18s (1 Natlan unit) / 12s (2) / 9s (3+). */
	cooldown: number;
};

/** The public event stream. NB: the parser's hit records are parser-private
 *  (post-P4 #1 decision) — they exist solely for the internal onHit dispatch
 *  and the buff-window derivation and are NOT part of the IR. Action-level
 *  events (post-P4 #2) are the public per-action surface; they carry no
 *  hit-level records either. */
export type TimelineEvent =
	| CastEvent
	| ActionEvent
	| ReactionEvent
	| ShieldEndEvent
	| NightsoulBurstEvent;

/** Provenance shared by all window kinds. `sourceCastId` is the id of the
 *  `cast` event that opened the window; `sourceActionId` (post-P4 #2) is the
 *  id of the `action` event that did (a plunge-opened transient state —
 *  Varesa Apex Drive — or a normal-opened one — Durin's dark commit). At
 *  most one of the two is set; every cast- or action-opened window carries
 *  its opener's id. */
type WindowProvenance = {
	sourceCastId?: number;
	sourceActionId?: number;
};

/** Span records. `end` is final — extensions and truncations applied. */
export type TimelineWindow =
	/** A named state window. Covers three openers under ONE vocabulary
	 *  (post-P4 #4 — the former `stance` kind merged in):
	 *  - a stance cast (behavior: "stance") → `name: "inStance"`, with
	 *    `source` set to the opening cast kind; extension-adjusted,
	 *    swap-clamped when the stance terminatesOnSwap;
	 *  - a stance's `opensState` companion (e.g. nightsoulBlessing);
	 *  - the transient-state primitive (`opensTransientState` /
	 *    `actionOpensState.{normal,plunge}` — symphonyWindow, apexDrive).
	 *  `source` is present only on stance-opened (`inStance`) windows. */
	| ({
			kind: 'state';
			characterId: string;
			name: string;
			start: number;
			end: number;
			source?: 'skill' | 'burst';
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
