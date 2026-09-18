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
 * ⚓ EVERY TIME FIELD BELOW IS AN INTEGER COUNT OF 60fps FRAMES (gauge-round.md
 * contract C1) — event `time`s, window `start`/`end`s, durations, cooldowns and
 * spawn offsets alike. Authored seconds are converted once, at the parser's read
 * sites, by `framesOf`. A consumer that wants seconds divides by 60 where it
 * draws or prints; ⛔ nothing converts on the way in.
 *
 * Types only — no runtime imports, safe for both the parser and the pure
 * timeline modules.
 */

import type { Effect, Element, Reaction } from '$lib/types/ability';

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
	/** `label` of the `matchVariant`-resolved AbilityVariant, when one matched.
	 *
	 *  ⚓⚓ THE ONLY THING THAT SURVIVES A VARIANT PAST THE PARSE (Arkhe round,
	 *  2026-09-04). `abilityId` names the ABILITY and a variant has no id of its
	 *  own, so summon resolution downstream re-finds the variant by INPUT TOKEN —
	 *  which cannot separate two variants that share one. Furina's E is exactly
	 *  that: `input: ["E"]` on both lineups, the choice made by her Arkhe
	 *  alignment at the instant of the cast, and finalize has no state to ask.
	 *
	 *  ⚠️ It is the variant's `label`, not an index, because `summons.ts` runs
	 *  renderer-side too and an index is meaningless once a variants array is
	 *  reordered. `label` is REQUIRED on AbilityVariant, so there is always one. */
	variantLabel?: string;
	/** Token text as typed, e.g. "E", "hE", "Q" — drives variant-sensitive
	 *  consumers (plunge selection, trigger filters) and the bar label. */
	label: string;
	/** Absolute cast start (FRAMES). */
	time: number;
	/** Cast animation duration (FRAMES). */
	castTime: number;
	/** Active-window duration in FRAMES (0 = instant). Final value: stance/
	 *  summon extension deltas are stamped here by the parser's finalize pass
	 *  before the bars are projected. */
	uptime: number;
	/** Cooldown in FRAMES (variant/modifier-resolved). Drives the ghost-CD tail:
	 *  the rendered CD track spans up to `time + cooldown`. */
	cooldown: number;
	/** Absolute time the consumed charge/burst clock is mechanically ready
	 *  again — `time + cooldownStartDelay + cooldown`, or the hitmark time
	 *  when a Sacrificial-series proc reset the CD. Can differ from
	 *  `time + cooldown` (the visual ghost tail) when cooldownStartDelay > 0. */
	readyAt: number;
	/** Frames a `cdReset` or `cooldownReduce` took off THIS cast's cooldown
	 *  after it was written (cooldown-reduction round, 2026-09-18) — the reason
	 *  `readyAt` may sit before `time + cooldown`. Absent when nothing moved it. */
	cdReduced?: number;
	/** The element this cast's FIRST landed hit applies, when it is NOT the
	 *  caster's own — resolved at parse from `application[0].element`
	 *  (2026-09-18). Absent means the character's element, which is every cast
	 *  in the corpus but Varka's: Four Winds' Ascension and Northwind Avatar
	 *  open with the RIGHT-hand claymore's party-resolved element (a
	 *  `teamElementPriority` ref) and land Anemo second. ⚓ Nate: the pill and
	 *  its cast block tint THIS, because a Pyro-team Varka is built for his
	 *  Pyro damage — and it leaves Windbound Execution, whose only hit is
	 *  Anemo, visibly Anemo beside them. Rendered by the pill, its ghost tail
	 *  and the input block; the PNG export mirrors it. */
	element?: Element;
	/** For a STANCE opener: the element its stance's normal attacks land (the
	 *  in-stance normal's resolved `infusion`), when it is not the caster's own.
	 *  ⚓ Nate (2026-09-18): Windbound Execution's PILL tints the PHEC hand —
	 *  its body IS the stance window, in which he is a PHEC DPS, and an Anemo
	 *  pill beside a PHEC burst pill "looks a little off" — while its input
	 *  BLOCK stays Anemo, because the cast's own hit is. So the pill reads
	 *  `stanceElement ?? element` and the block reads `element` alone. Only
	 *  Varka's stance infuses an element other than his own (census
	 *  2026-09-18), so nothing else moves. */
	stanceElement?: Element;
	/** Frames (60fps) from cast start until the spawned summon becomes active.
	 *  0 when the ability spawns nothing (then `fieldStart === time`). */
	summonActivatesAt: number;
	/** Cast start plus the summon spawn offset (FRAMES). Equals `time`
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
	/** What applied the element. `skill`/`burst` are cast sites; the three
	 *  action classes arrived with the ICD round (2026-08-15) — a catalyst's
	 *  normals, a catalyst/bow charged shot and an infused plunge all react. */
	castKind: 'skill' | 'burst' | 'normal' | 'charged' | 'plunge';
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
	/** Absolute start of this swing/action (FRAMES). Frameless swings of one
	 *  token share their block's start time. */
	time: number;
	/** Animation FRAMES this swing advances the cursor; 0 when frame data
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
	/** A special charged attack (`sC`) that SPENT a sibling skill's charge —
	 *  Varka's Azure Devour expends a Four Winds' Ascension use
	 *  (`NormalAbility.specialChargeSpends`, 2026-09-18). `readyAt` is where the
	 *  spent charge's clock ends, appended to the queue's chain. ⚠️ Recorded,
	 *  not drawn: the E lane has no pill for a charge spent from the input
	 *  strip, so the cost shows only as where the next `sE` can land. A tail or
	 *  tooltip built on this is a display call, not a parse one. */
	spentCharge?: { abilityId: string; readyAt: number };
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
	/** Team-size-derived NB cooldown in FRAMES: 18s (1 Natlan unit) / 12s (2) /
	 *  9s (3+) — i.e. 1080 / 720 / 540. */
	cooldown: number;
};

/**
 * ⚓ A STACK THRESHOLD FIRED (stack-threshold round, 2026-09-18). The instant the
 * summed count of `keys` reached `count` on `characterId`'s pools — Columbina's
 * Gravity Interference — and the pools were spent. `dominant` is the key that
 * held the most at the fire (ties in `keys` order), which is what an `onStack`
 * effect carrying a `dominant` gate reads. `buffWindows` anchors `onStack` buffs
 * on these the way NB buffs anchor on `nightsoulBurst`; the fire's MARK on the
 * summon lane is stamped on the summon window (`fires`), not carried here.
 */
export type StackThresholdEvent = {
	kind: 'stackThreshold';
	id: number;
	characterId: string;
	time: number;
	keys: string[];
	count: number;
	dominant: string;
	/** The fire's in-game name, when the trigger states one. */
	label?: string;
	/** The E/Q whose primary summon hosts the accrual, when one does — the
	 *  shield lane's `source` and the buff rows' ability class. */
	abilityClass?: 'skill' | 'burst';
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
	| NightsoulBurstEvent
	| StackThresholdEvent;

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

/** Ramping BuffValue parameters lifted onto a buff window so the renderer's
 *  gradient painter needs no effect-shape knowledge. */
export type BuffRampParams = {
	startValue: number;
	stepValue: number;
	/** FRAMES between steps (authored as seconds; converted at derivation). */
	stepInterval: number;
	cap?: number;
};
/** Decaying BuffValue parameters (same purpose as {@link BuffRampParams}).
 *  `duration` is FRAMES. */
export type BuffDecayParams = { startValue: number; endValue: number; duration: number };

/** What produced a buff window — enough structure for the thin row
 *  projections to rebuild the legacy row identity (grouping key + source
 *  label) without re-deriving any meaning. */
export type BuffWindowSource =
	| {
			type: 'character';
			/** Dispatch family: 'cast' = the merged onCast+onHit E/Q pool;
			 *  'block' = the N/CA/P input-token pool; the rest are literal.
			 *  ⚠️ 'state' is the odd one — its window is not a duration measured
			 *  from a trigger instant, it IS the state's own span. */
			trigger:
				| 'cast'
				| 'afterDuration'
				| 'block'
				| 'reaction'
				| 'nightsoulBurst'
				| 'state'
				| 'stackThreshold';
			abilityClass?: 'skill' | 'burst' | 'normal' | 'charged' | 'plunge';
			/** `stackThreshold` only — the fire's in-game name for the row label
			 *  (stack-threshold round, 2026-09-18). */
			fireLabel?: string;
	  }
	| {
			type: 'artifact';
			setId: string;
			trigger: 'cast' | 'reaction' | 'hit';
			/** onCast trigger-ability grouping key ('any' fires on both E and Q). */
			triggerKey?: 'any' | 'skill' | 'burst';
			abilityClass?: 'skill' | 'burst';
	  }
	| {
			type: 'weapon';
			weaponId: string;
			trigger: 'onSwapOut' | 'onSwapIn';
	  }
	/** A `factionBonuses` effect — a Secret Rite, gated on the party carrying
	 *  enough of a faction (2026-08-15).
	 *
	 *  ⚓ Its own arm rather than a flag on `character`, for the same reason
	 *  `artifact` has one: the row it lands on must be named after the BONUS, not
	 *  after the cast that fired it. A Hexerei buff labelled "Sucrose E" is
	 *  indistinguishable from an unconditional one, and the condition is the most
	 *  important thing about it.
	 *
	 *  ⛔ Not routed through `EffectBase.attribution`, which would have been the
	 *  cheaper-looking path: 24 effects across 6 characters already carry that
	 *  field and it is read only in the `afterDuration` branch, so teaching the
	 *  general row branches to read it would re-key all 24 and re-shape bars on
	 *  characters with nothing to do with factions. See
	 *  docs/faction-bonuses-round.md. */
	/**
	 * ⚓⚓ A REACTION'S FIELD, WHICH BELONGS TO NOBODY (Polestar-Field round,
	 * 2026-09-01). Its own arm for the same reason `faction` has one: the row
	 * must be named after the FIELD, not after whoever happened to trigger it.
	 *
	 * A Polestar Field is created by ANY party member's Stellar-Conduct, so a
	 * team fielding two enablers used to draw two identical bars — one per
	 * enabler carrying a private mirror of the same three effects. Named after
	 * the field there is exactly one row however many enablers are present, and
	 * the bar says the true thing: this is what the field does, not what
	 * Sandrone does.
	 *
	 * ⚠️ The window still carries a `characterId` (whoever triggered the
	 * reaction that opened it) — real provenance, and it keeps every consumer
	 * that expects a source character working. Only the LABEL comes from here.
	 */
	| {
			type: 'field';
			/** Stable key for the row (`polestar`). */
			fieldId: string;
			/** The row's label — the field's in-game name. */
			fieldName: string;
	  }
	| {
			type: 'faction';
			faction: string;
			bonusName: string;
			/** Mirrors the `character` arm — the dispatch family that fired it. */
			trigger:
				| 'cast'
				| 'afterDuration'
				| 'block'
				| 'reaction'
				| 'nightsoulBurst'
				| 'state'
				| 'stackThreshold';
			abilityClass?: 'skill' | 'burst' | 'normal' | 'charged' | 'plunge';
	  };

/** Span records. `start`/`end` are FRAMES and `end` is final — extensions and
 *  truncations applied. */
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
			/** True when the window came from the post-action transient-state
			 *  primitive (opensTransientState / actionOpensState) rather than
			 *  stance behavior. A transient may open `inStance` (Cyno's
			 *  skill-opened 6s Pathclearer) — such windows carry `source` like
			 *  stance windows but are NOT geometry-locked to their owning bar
			 *  (the opener is an instant cast; the window outlives its bar). */
			transient?: true;
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
			/**
			 * ⚓⚓ TICK INSTANTS THE PARSE MEASURED, for series the PROJECTION
			 * cannot derive (coordinated-attack round, 2026-08-18). Frames.
			 *
			 * Every other summon lane draws its markers with `collectSummonTicks`,
			 * which walks a fixed cadence over `[start, end)` — that is what makes
			 * the ticks a viewer SEES exactly the hits that fire. A
			 * `whileNormalAttacking` wave has no fixed cadence: it fires only while
			 * somebody is normal-attacking, which is a fact of the parse and of
			 * nothing else. So the ONE producer publishes here and
			 * `computeSummonSubrows` merges these in.
			 *
			 * ⚓ Same law as `summonTick.tickCap`, reached from the other side:
			 * there the two readers must honour one rule, here there is only one
			 * reader BECAUSE there is only one producer. ⛔ Never teach the
			 * projection to guess a state-gated cadence.
			 *
			 * Absent on every summon that has no such series.
			 */
			ticks?: number[];
			/**
			 * ⚓ THRESHOLD FIRES ON THIS LANE (stack-threshold round, 2026-09-18) —
			 * a `damage` effect on an `onStack` trigger draws here, on the lane of
			 * the summon that hosts the accrual, in the hit's element. Frames.
			 * ⛔ NOT a tick: a tick is the series' own hit and feeds the gauge;
			 * a fire applies nothing (Columbina's Interference is Durability 0),
			 * so it is a different mark and a different field. Stamped by
			 * `finalize` off the `stackThreshold` events, like `ticks`.
			 */
			fires?: { time: number; element: Element }[];
			/**
			 * Where this summon WOULD have ended on its own — spawn + lifetime,
			 * extensions applied, no swap, recast or flip truncation (small-fix
			 * bundle, 2026-09-17). `end < naturalEnd` says the window was CUT.
			 *
			 * ⚓ The one reader is the tick cap's boundary widening: an authored
			 * `tickCap` lets the tick landing exactly on `end` through, because
			 * gcsim's status-gated chains land it — but that argument is about a
			 * NATURAL end. A window cut by a recast or a swap has no boundary tick
			 * to land; widening it drew one marker past the cut, and the live
			 * chain applied it.
			 */
			naturalEnd?: number;
	  } & WindowProvenance)
	/** A tracked shield's span (cast → scheduled expiry). */
	| ({
			kind: 'shield';
			characterId: string;
			source: 'skill' | 'burst';
			start: number;
			end: number;
			/** The shield's in-game name, from `ShieldEffect.label` — the shield
			 *  lane's row label. Absent renders a plain "Shield". */
			label?: string;
			/** This shield is ALREADY on the chart as a `summons[]` entry — the
			 *  pre-shield-window authoring convention, where a zero-effect summon
			 *  of the same duration stood in for the shield. The shield lane skips
			 *  these so the same span isn't drawn twice; every other consumer
			 *  ignores it. Set by `registerShieldOnCast`, which is where both are
			 *  in hand.
			 *  ⏸️ NO CORPUS CHARACTER SETS THIS as of 2026-08-14 — the nine
			 *  stand-ins were retired in favour of `activeDuration` + a labelled
			 *  shield Effect. It survives because the summon-derived fallback
			 *  survives, and a kit re-authored that way would need it again. */
			coveredBySummon?: true;
	  } & WindowProvenance)
	/**
	 * ⚓⚓ A THING A REACTION LEFT IN THE WORLD (Polestar-Field round,
	 * 2026-09-01) — a dendro core, a Starlight Prism.
	 *
	 * ⚓ IT HAS NO `characterId`, AND THAT IS THE WHOLE POINT. Every other span
	 * in this union belongs to somebody: a summon to its caster, a shield to the
	 * character wearing it, a buff to a giver and a receiver. A gadget belongs to
	 * the WORLD — any party member's Bloom leaves the same core, any party
	 * member's Stellar-Conduct leaves the same Prism — which is why it cannot
	 * ride the summon lane (`computeSummonSubrows` groups under the caster) and
	 * why the gadget strip sits in the team-scoped aura header instead.
	 *
	 * ⚠️ `end` is FINAL like every other window's, and for a gadget that means
	 * the earlier of its nominal life and the moment something took it —
	 * `endReason` says which. ⛔ Never re-derive the end from a spawn plus a
	 * lifetime: a core eaten by a Hyperbloom at 2s has a nominal end at 6s, and
	 * drawing the nominal one is drawing a core that is not there.
	 */
	| {
			kind: 'gadget';
			gadget: 'core' | 'prism' | 'thundercloud' | 'moondrift';
			/** The strip's label for this entity. */
			label: string;
			start: number;
			end: number;
			/** Present when the world took it back before its nominal end. */
			endReason?: 'consumed' | 'popped';
	  }
	/** A weapon-proc ICD span (e.g. Sacrificial reset on cooldown). */
	| ({ kind: 'weaponProc'; characterId: string; start: number; end: number } & WindowProvenance)
	/** One buff/debuff application span (post-P4 #5 — who-buffs-whom-when,
	 *  derived parser-side by `deriveBuffWindows`). Receivers are CONCRETE:
	 *  active-target buffs are pre-sliced into per-character windows at swap
	 *  boundaries. Display strings stay presentation-side — the window
	 *  carries the qualifying authored `effects` (post condition/filter/
	 *  dedup, legacy pool order) plus the trigger-time context the
	 *  formatters need (`stackContext`, `refinementIndex`). */
	| ({
			kind: 'buff';
			/** Emission-order id within the buff-derivation pass (unique among
			 *  buff windows; the row projections order rows by first-window id
			 *  to reproduce the legacy row order). */
			id: number;
			/** SOURCE character — the buff giver / debuff applier. */
			characterId: string;
			/** Concrete receiver. Present on received-surface windows (weapon
			 *  procs, active-target slices, self buffs, NB self-target); absent
			 *  on team-row windows. */
			receiverId?: string;
			start: number;
			end: number;
			/** resShred → red debuff treatment (targets the enemy). */
			debuff?: boolean;
			/** Qualifying authored effects for THIS window, post-filter. */
			effects: Effect[];
			/** Trigger-time stack snapshot (the anchoring cast's stackContext). */
			stackContext?: ReadonlyMap<string, number>;
			/** Weapon refinement index (refinementValues resolution). */
			refinementIndex?: number;
			/** The dedup POOL's first effect when a per-cast filter may have
			 *  dropped it from `effects` — the legacy row identity (primary
			 *  stat / attribution label) keys off the pool head, not the
			 *  window's own list. Set on resShred cast/block rows and
			 *  afterDuration rows. */
			poolFirstEffect?: Effect;
			/** Full logical buff duration in FRAMES (an active-target slice's span
			 *  may be shorter); received-surface windows only. */
			duration?: number;
			/** Window-open instant for ramp/decay gradient anchoring (FRAMES). */
			buffStart?: number;
			rampParams?: BuffRampParams;
			decayParams?: BuffDecayParams;
			procCooldown?: number;
			isMutuallyExclusive?: boolean;
			/**
			 * ⚓ THE LEDGER COUNT THAT SET THIS WINDOW'S VALUE (`field` source only,
			 * 2026-09-01) — the Cryo/Electro hits the Prism recorded in the 4s
			 * before this grant cycle opened.
			 *
			 * ⚠️⚠️ IT IS THE PREVIOUS WINDOW'S COUNT, NOT A LIVE ONE. "Every 4s the
			 * count is reset, and buffs lasting 4s are granted" — so the number that
			 * PAID FOR this bar was finished before the bar began. In game the
			 * on-screen counter is meanwhile accumulating toward the NEXT grant;
			 * they are two different clocks and this is the one the bar's value can
			 * be checked against.
			 *
			 * ⛔ Not `stackContext`, which is the trigger-time snapshot the
			 * `perStack` formatter reads — overloading it would put a number into a
			 * value formatter that has no business resolving it.
			 */
			fieldStacks?: number;
			source: BuffWindowSource;
	  } & WindowProvenance);
