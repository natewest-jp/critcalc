/**
 * src/lib/sim/types.ts
 *
 * The parser's own output types — the per-track projections (`TimelineBar`,
 * `InputBlock`, `CharacterTrack`) and the `ParsedRotation` envelope
 * (gauge-round L3c, lifted out of `notationParser.ts`).
 *
 * ⚓ Types only, no runtime. It exists so `SimContext` can name the containers it
 * holds without importing back from the parser — the same reason `conditions.ts`
 * exists. `notationParser.ts` re-exports every name below, so the eleven
 * consumers that import them do not move.
 *
 * ⚠️ EVERY TIME FIELD HERE IS AN INTEGER COUNT OF 60fps FRAMES (gauge-round.md
 * contract C1), as on the IR proper. See `rotationEvents.ts`.
 */

import type { Element } from '$lib/types/ability';
import type { TimelineEvent, TimelineWindow } from '$lib/utils/rotationEvents';
import type { AuraApplication } from './aura';
import type { SeriesInterval } from '$lib/utils/gauge';

/** Per-track E/Q bar. Post-P4 #3: a pure PROJECTION of a `cast` event —
 *  built at finalize from the event's geometric fields (1:1, field-equal).
 *  Kept as the renderer's per-track iteration surface; the cast event is
 *  the source of truth. */
export type TimelineBar = {
	start: number; // frames
	uptime: number; // frames (0 = instant)
	cooldown: number; // frames
	label: string; // notation token displayed on the bar (e.g. "Q", "hE")
	castTime: number; // frames — duration of the cast animation (used for active-bar overlay)
	/** Absolute time this cast's clock is mechanically ready again (mirrors
	 *  `CastEvent.readyAt`). The ghost-CD tail ENDS here.
	 *
	 *  ⚠️ CARRIED ON THE BAR BECAUSE THE PILL GEOMETRY NEEDS IT, and carried as
	 *  `readyAt` rather than the raw `cooldownStartDelay` deliberately: readyAt
	 *  is the authoritative "when can this be cast again", so a future dynamic
	 *  cooldown start (a stance whose exit is what starts the clock) moves the
	 *  tail for free instead of needing the geometry taught a second rule.
	 *
	 *  ↻ 2026-08-15: `barPhases` read `cooldown` alone before this and drew the
	 *  tail ending at `start + cooldown`. That divergence WAS documented as
	 *  intentional on `CastEvent.readyAt` ("the visual ghost tail"), and it is
	 *  invisible at the 1–35 frame delays 122 of the 124 delayed abilities
	 *  carry — but on the two that encode "the CD starts when the STANCE ends"
	 *  (Xilonen 540f, Ifa 600f) it is a 9–10 second lie that also flips the pill
	 *  into case B, whose meaning is the exact opposite: "cooldown finished,
	 *  stance still running". ⚓ Nate read it that way and asked why the recast
	 *  was so late — which is the whole argument against the old choice. */
	readyAt?: number;
	/** id of the RESOLVED ability actually cast (mirrors CastEvent.abilityId).
	 *  Disambiguates summon resolution when a state-gated sibling ability
	 *  shares the input token (Durin's dual-form bursts, post-P4 #2). */
	abilityId?: string;
	/** `label` of the resolved AbilityVariant (mirrors CastEvent.variantLabel).
	 *  Disambiguates summon resolution when two VARIANTS of one ability share an
	 *  input token — the sibling-ability case above, one rung down. Furina's
	 *  Ousia/Pneuma lineups are the corpus's only pair (Arkhe round). */
	variantLabel?: string;
	/** Frames (60fps) from cast start until the summon becomes active. 0 when absent.
	 *  Mirrors persistent-behavior summonActivatesAt; carried on the bar so the
	 *  renderer and duringSummon detection don't need to re-query the ability. */
	summonActivatesAt?: number;
	/** True when a Sacrificial-series proc fired on this cast, resetting the CD to 0.
	 *  The renderer uses this to draw the entire bar as a dim+bordered "available" style
	 *  instead of the usual opaque uptime + ghost CD split. */
	sacProcFired?: boolean;
	/** Snapshot of the per-character stack state at this cast's moment. Lets the
	 *  timeline filter stack-gated effects per-cast instead of unconditionally.
	 *  Absent when no stacks have been asserted in the current segment. */
	stackContext?: ReadonlyMap<string, number>;
};

export type InputBlockKind =
	| 'normal'
	| 'elemental-normal'
	| 'skill'
	| 'burst'
	| 'movement'
	| 'unset';

/** A discrete per-input building block in the active row. */
export type InputBlock = {
	start: number; // frames — absolute timeline position
	duration: number; // frames — block width
	parts: string[]; // display labels e.g. ["N5"], ["Q"], ["hE"]
	kind: InputBlockKind;
	/** The element this input LANDED with, when it landed with one — which is
	 *  not always the character's own. ⚠️ `kind: 'elemental-normal'` says only
	 *  THAT a swing was elemental; a renderer that tints from the track's
	 *  element paints a Bennett-infused Xingqiu N in hydro (2026-08-15). Absent
	 *  on physical inputs, on movement, and on E/Q blocks (a cast always carries
	 *  the caster's element, so the track answers for those). */
	element?: Element;
};

export type CharacterTrack = {
	characterId: string;
	displayName: string;
	element: string;
	activeStart: number; // frames
	activeEnd: number; // frames
	/** Per-input building blocks in the active row, chronological order. */
	inputBlocks: InputBlock[];
	hasUnsetDuration: boolean; // true when ~?s was encountered
	eBars: TimelineBar[];
	qBars: TimelineBar[];
};

export type WeaponProcBar = { start: number; end: number };

// ⚓ `HitEvent` and the shared onHit trigger gate MOVED to `$lib/sim/hits.ts`
// (L3c). Both are re-exported: `buffWindows.ts` imports them from here.
export { onHitTriggerMatches } from '$lib/sim/hits';
export type { HitEvent } from '$lib/sim/hits';

export type ParsedRotation = {
	tracks: CharacterTrack[];
	totalDuration: number;
	unknownTokens: string[]; // tokens not recognized as valid notation
	/** P4 IR — time-sorted point events (`cast` / `action` / `reaction` /
	 *  `shieldEnd` / `nightsoulBurst`). The sole event surface: cast markers
	 *  drive the timeline rows, `action` events carry the per-swing input
	 *  substrate (post-P4 #2), the reaction/shieldEnd kinds feed effect
	 *  dispatch, and NB events drive the Nightsoul-Burst lane + its
	 *  onTeamNightsoulBurst consumers (post-P4 #5 arc, phase 3). */
	events: TimelineEvent[];
	/** P4 IR — span records with FINAL end times (`stance` / `state` /
	 *  `summon` / `shield` / `weaponProc`). Extensions and swap/recast
	 *  truncations are already applied; consumers never re-derive window ends
	 *  from bar geometry (weapon-proc rows, summon subrows, stance/state
	 *  overlays all project these spans). */
	windows: TimelineWindow[];
	/**
	 * Every elemental application this rotation put on the target, in time order
	 * (gauge round L5c).
	 *
	 * ⚓ NOT part of the IR proper and deliberately outside `events`: an
	 * application is not a point the timeline draws, it is what the gauge was
	 * FED. It exists because an application that reacts with nothing leaves no
	 * trace anywhere else — which forced the L0 oracle to REPLAY the parser's own
	 * rules over the IR to reconstruct the stream it was diffing, and is how it
	 * came to measure a model we no longer had for one commit (L4d).
	 *
	 * ⚠️ Its consumers are `scripts/audit-gcsim-reactions.mjs` and, since L6, the
	 * aura lane's application ticks.
	 */
	applications: AuraApplication[];
	/**
	 * The target's aura over the rotation — one interval per continuous lifetime
	 * of one aura mod, sampled from the gauge the parse actually drove (gauge
	 * round L6). Seconds and taxed units, `gauge.ts`'s own shape.
	 *
	 * ⚓⚓ THIS IS THE LIVE GAUGE'S OWN OUTPUT, NOT A RE-RUN. ⛔ Never rebuild it
	 * by feeding `applications` to `simulateGauge`. ⚠️ The reason is no longer
	 * that the list is mis-ordered — the feed has been in true time order since
	 * 2026-08-17 — it is that a replay is a SECOND COPY of the truth and cannot
	 * see the gauge's internal chain (Burning fuel, EC ticks, core spawns), so it
	 * draws an aura the parse never had. Same rule that put `applications` here.
	 *
	 * ⚠️ Includes the decay tail past the last cast — the gauge is settled at
	 * finalize (`collectAuraSeries`), because "where you lost it" is mostly what
	 * happens after the last application.
	 */
	auraSeries: SeriesInterval[];
};
