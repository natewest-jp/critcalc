/**
 * src/lib/types/ability.ts
 *
 * Ability/effect model types. `Ability` is a discriminated union over
 * `abilityType`; skill/burst additionally discriminate over `behavior`
 * (instant vs persistent vs stance) so duration-bearing fields are required
 * on the variants where they apply.
 */

// ---------------------------------------------------------------------------
// Elements & reactions
// ---------------------------------------------------------------------------

/** Element keys used by the transformer output (lowercase).
 *
 * Note: "physical" is valid for damage instances and RES debuffs (Rosaria C6
 * Physical RES, Razor's Physical N hits, etc.) but is not a valid character
 * element — no character has Physical as their assigned element. The
 * `CharacterData.element` field and `NormalAbility.infusion`/`infuse` Effect
 * `element` fields should never be set to "physical"; the lint enforces this
 * via separate vocabulary sets. */
export type Element =
	| 'anemo'
	| 'cryo'
	| 'dendro'
	| 'electro'
	| 'geo'
	| 'hydro'
	| 'pyro'
	| 'physical';

/** Elements that can leave a persistent aura on enemies. Cryo, Dendro, Electro,
 *  Hydro, and Pyro all leave gauges that linger on the enemy until reacted with
 *  or decayed. Anemo, Geo, and Physical never apply a lasting aura — Anemo
 *  swirls existing auras into the surrounding area and dissipates; Geo
 *  crystallizes existing auras and shatters; Physical never applies any aura.
 *
 *  Used by `Condition.enemyAffectedBy` to constrain authoring. */
export type AuraElement = 'cryo' | 'dendro' | 'electro' | 'hydro' | 'pyro';

/** Elemental reactions used by triggers and effects. */
export type Reaction =
	| 'vaporize'
	| 'overloaded'
	| 'melt'
	| 'burning'
	/** Element-specific swirl reactions. Anemo casts against a hydro/pyro/
	 *  cryo/electro aura emit the matching variant. The broad `'swirl'` key
	 *  was retired 2026-05-14 (Shape A decision) so the schema matches
	 *  in-game React() ontology — each swirl variant is its own reaction
	 *  with its own potential element-specific bonuses (cryoSwirl-tagged
	 *  buffs are a leaked-future case that motivates the structure). */
	| 'pyroSwirl'
	| 'hydroSwirl'
	| 'cryoSwirl'
	| 'electroSwirl'
	/** Element-specific crystallize reactions. Geo casts against an
	 *  aura emit the matching variant. Per the swirl rationale above. */
	| 'pyroCrystallize'
	| 'hydroCrystallize'
	| 'cryoCrystallize'
	| 'electroCrystallize'
	| 'lunarCrystallize'
	| 'electroCharged'
	| 'lunarCharged'
	| 'frozen'
	| 'shatter'
	| 'bloom'
	| 'lunarBloom'
	| 'burgeon'
	| 'hyperbloom'
	| 'superConduct'
	/** Stellar reactions (7.x generation). Enabled per-reaction by specific
	 *  characters (`CharacterData.enablesReactions`) — ONE enabler in the party
	 *  converts ALL of the base reaction: superConduct → stellarConduct (the
	 *  Ineffa EC→LC model, but per-character, not faction-count-gated).
	 *  stellarSwirl's enablers arrive in 7.0 — union entry reserved, no
	 *  synthetic emission until its mechanics are confirmed.
	 *  See docs/library/game/stellar-reactions.md. */
	| 'stellarConduct'
	| 'stellarSwirl'
	| 'quicken'
	| 'spread'
	| 'aggravate';

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

/** Canonical stat keys used by the gold-standard effect model. */
export type Stat =
	| 'atk'
	| 'baseAtk'
	| 'em'
	| 'hp'
	/** Energy Recharge, as a percentage (100 = no bonus). ⚓ Added 2026-08-31 as a
	 *  SCALING SOURCE first: Raiden's A4 ("+0.4% per 1% ER above 100%") and
	 *  Alyosha's A2 ("+0.35% E/Q DMG per 1% ER, cap 70%") both scale off it, and
	 *  neither could be authored at all until it existed. ⚠️ Pairs with
	 *  `BuffValue.scaling.offset` — both of those kits state a threshold. */
	| 'energyRecharge'
	| 'def'
	| 'critRate'
	| 'critDmg'
	| 'atk%'
	| 'hp%'
	| 'def%'
	| 'allDmgBonus'
	| 'anemoDmgBonus'
	| 'cryoDmgBonus'
	| 'dendroDmgBonus'
	| 'electroDmgBonus'
	| 'geoDmgBonus'
	| 'hydroDmgBonus'
	| 'pyroDmgBonus'
	| 'lunarDmgBonus'
	| 'skillDmgBonus'
	| 'burstDmgBonus'
	// Per-attack-class DMG bonus modifiers — apply only to damage of the named
	// attack class. Distinct from generic `allDmgBonus` (all of the recipient's
	// attacks) and from `${element}DmgBonus` (only attacks of one element).
	// Reference: Ayato C1 (+40% Shunsuiken / Normal DMG vs ≤50% HP), Yun Jin C2
	// (+15% Normal DMG team after burst), Kazuha C6 (+0.2% N/CA/P DMG per EM
	// post-cast), Kokomi A4 (scaling N + CA DMG by Healing Bonus).
	| 'normalDmgBonus'
	| 'chargeDmgBonus'
	| 'plungeDmgBonus'
	// Reaction-specific DMG bonus modifiers — apply only to damage that triggers
	// the named reaction (Moonsign characters: Flins/Ineffa, Aino/Nefer, Linnea
	// moonsign-init/C6, Jahoda C6).
	| 'lunarChargedDmgBonus'
	| 'lunarBloomDmgBonus'
	| 'lunarCrystallizeDmgBonus'
	// Stellar Reaction Base DMG Bonus — the Stellar bucket-3 analogue of the
	// lunar*DmgBonus family (its own multiplicative bracket in the Stellar
	// formula, provided by specific passives).
	// See docs/library/game/stellar-reactions.md.
	| 'stellarConductDmgBonus'
	| 'stellarSwirlDmgBonus'
	// ⚓ "Stellar Glimmer" is 7.0's UMBRELLA term for the Stellar reaction
	// family, not a twelfth reaction — Sandrone's reworked burst reads "is
	// considered THE CORRESPONDING Stellar Glimmer reaction DMG", and
	// "Radiance: Stellar Glimmer" replaced the per-reaction Radiance states.
	// So this is the family-wide key (the `lunarDmgBonus` precedent): it buffs
	// Stellar-Conduct AND Stellar Swirl at once. ⛔ Do NOT add a `stellarGlimmer`
	// member to `Reaction` — the union stays per-reaction, and a curator who
	// wants "both" reaches for this stat, never a new reaction.
	// Authors: Odette C4/C6, Sandrone + Odette + Cryo Traveler A4 ("the Base DMG
	// of said reaction", where "said reaction" is either one).
	| 'stellarGlimmerDmgBonus'
	// Reaction Bonus (formula "bucket 5") — additive WITH the EM bonus inside
	// the EM bracket: `(1 + EM Bonus + Reaction Bonus)`. A DIFFERENT bracket
	// than the *DmgBonus family above (which multiplies on its own), hence its
	// own stat family so provenance cards never conflate the two. gcsim
	// AddReactBonusMod; wiki category "<Reaction> DMG Bonus". Sources:
	// Columbina burst (all three lunar), Sandrone C1 / Qiqi WR / Cyno C2 /
	// Wriothesley WR / Diona C6 (stellarConduct; Qiqi's also superConduct).
	// Nate's ruling 2026-07-29: authorable — we visualize, we don't compute.
	| 'superConductReactionBonus'
	// Family-wide over the FOUR Swirl flavours, on the stellarGlimmer precedent
	// above — the game's own talent row is "Elemental Mastery-Based Swirl DMG
	// Increase", one number covering Pyro/Hydro/Cryo/Electro Swirl, and gcsim
	// returns it from a single `AttackTagSwirl*` switch arm (Mizuki
	// `skill.go:149-154`). ⛔ Not a replacement for the per-flavour members
	// beside it: Diona's C6 names Cryo Swirl alone and must keep saying so.
	| 'swirlReactionBonus'
	| 'cryoSwirlReactionBonus'
	| 'electroChargedReactionBonus'
	| 'bloomReactionBonus'
	| 'stellarConductReactionBonus'
	| 'stellarSwirlReactionBonus'
	// Family-wide, per the stellarGlimmerDmgBonus note above.
	| 'stellarGlimmerReactionBonus'
	| 'lunarChargedReactionBonus'
	| 'lunarBloomReactionBonus'
	| 'lunarCrystallizeReactionBonus'
	// Attacker-side DEF ignore — the recipient's attacks ignore this % of the
	// enemy's DEF (Nicole C6: 40% for Guidance holders; Durin C6 Burst: 30%,
	// 70% in Dark form). Distinct from the enemy-side `resShred` shredStat:'def'
	// debuff, which lowers DEF for the whole team. Percentage stat.
	| 'defIgnore'
	| 'cdReduction'
	| 'healingBonus'
	| 'incomingHealingBonus'
	// Resistance to interruption/stagger while attacking (Xingqiu rain swords,
	// Yun Jin/Layla adjacent effects). Unitless "poise" buff — renderers treat
	// it as a presence window, not a number. Added 2026-07-12 (A4 vocabulary).
	| 'interruptionRes'
	// Element-self RES — defensive resistance buffs (Hu Tao C6, Arlecchino A4 +
	// C2 + C6, Wanderer C6). `allElementalRes` is the all-7-elements shorthand;
	// `physicalRes` is its physical counterpart. Pair them when a buff covers
	// both ("all-element + Physical RES").
	| 'anemoRes'
	| 'cryoRes'
	| 'dendroRes'
	| 'electroRes'
	| 'geoRes'
	| 'hydroRes'
	| 'pyroRes'
	| 'physicalRes'
	| 'allElementalRes'
	// Element-specific CRIT DMG modifiers — buff CRIT DMG only on attacks of the
	// named element (Escoffier C1 Cryo CRIT DMG, Shenhe C6 Cryo CRIT DMG inside
	// burst field, Columbina C6 per-reaction-element CRIT DMG). Distinct from
	// generic `critDmg` which applies to all of the recipient's attacks.
	| 'anemoCritDmg'
	| 'cryoCritDmg'
	| 'dendroCritDmg'
	| 'electroCritDmg'
	| 'geoCritDmg'
	| 'hydroCritDmg'
	| 'pyroCritDmg'
	// Flat DMG bonuses added to damage output (not % multipliers); commonly HP-scaled.
	| 'normalFlatDmg'
	| 'chargeFlatDmg'
	| 'plungeFlatDmg'
	| 'skillFlatDmg'
	| 'burstFlatDmg'
	// Per-reaction-instance flat-DMG add-on. Currently only the lunar-crystallize
	// flavor is authored (Linnea C1: +75% × DEF FlatDmg per consumed Field Catalog
	// stack on team Lunar-Crystallize hits). The other lunar / classical-reaction
	// flavors will be added on demand.
	| 'lunarCrystallizeFlatDmg';

// ---------------------------------------------------------------------------
// Ability sections & inputs
// ---------------------------------------------------------------------------

/** High-level grouping for ability description sections. */
export type AbilitySectionType =
	| 'normal'
	| 'charged'
	| 'plunging'
	| 'skill'
	| 'burst'
	| 'passive'
	| 'other';

/** A display section used to organize ability descriptions. */
export type AbilitySection = {
	type: AbilitySectionType;
	title: string;
	description: string;
};

/** Rotation input tokens used by the notation parser. */
export type Input =
	| 'N'
	| 'N1'
	| 'N2'
	| 'N3'
	| 'N4'
	| 'N5'
	| 'N6'
	| 'C'
	| 'C1'
	| 'C2'
	| 'P'
	| 'E'
	| 'Q'
	| 'tE'
	| 'pE'
	| 'hE'
	| 'h1E'
	| 'h2E'
	| 'D'
	| 'J';

// ---------------------------------------------------------------------------
// Ability tags
// ---------------------------------------------------------------------------

/** Canonical tag keys for ability classification (singular).
 *
 *  - `cleanse` — the ability removes elemental auras from party members
 *    (Barbara E wet-pulse, Jean Q field). Tag-level only: which element
 *    classes and self-vs-team are description territory until a tool needs
 *    the distinction.
 *  - `grouping` — the ability pulls/gathers enemies (Venti Q, Kazuha E,
 *    Sucrose E/Q). Crowd-control facet for the Team Builder.
 *  (Both added 2026-07-12, Nate-approved A4 vocabulary pass.) */
export type AbilityTag =
	| 'coordinatedAttack'
	| 'heal'
	| 'shield'
	| 'summon'
	| 'taunt'
	| 'cleanse'
	| 'grouping';

// ---------------------------------------------------------------------------
// Scaling helpers
// ---------------------------------------------------------------------------

/** Refinement-scaled values for weapons or effects. */
export type ScaledValue = {
	refinementValues: [number, number, number, number, number];
};

/** Stats that a value can scale from. */
export type ScalingStat = 'atk' | 'baseAtk' | 'em' | 'hp' | 'def' | 'healingBonus';

// ---------------------------------------------------------------------------
// Damage tags & trigger filters (G primitive — sub-ability filtering)
// ---------------------------------------------------------------------------

/**
 * Canonical tag carried by a damage instance, mirroring gcsim's `AttackTag`.
 *
 * Most damage maps cleanly from its source ability:
 *   - normal-attack hits → `normal`
 *   - charged-attack hits → `charged`
 *   - plunge hits → `plunge`
 *   - skill cast/hits → `skill`
 *   - skill cast via Hold variant → `skillHold` (Diluc Hold-E, Wriothesley
 *     in-stance distinction)
 *   - burst cast/hits → `burst`
 *
 * The `getDefaultDamageTag` helper resolves the implicit tag from the host
 * ability + variant. Authors only set `damageTag` explicitly when the default
 * doesn't match (the rare "stance-N-still-tagged-Normal" cases handle
 * themselves; specific overrides like Mavuika's bike-N tagging differently
 * would set it explicitly).
 *
 * Stance-converted N attacks RETAIN their `normal` tag in the in-game system
 * — Hu Tao's Paramita N1-N6, Cyno's Pactsworn N1-N4, Itto's Saichi sequence
 * are all still tagged Normal, just with element infusion changing.
 */
export type DamageTag = 'normal' | 'charged' | 'plunge' | 'skill' | 'skillHold' | 'burst';

/**
 * Fine-grained filter on `onHit` triggers. All specified fields must match
 * for the trigger to fire (intersection). Absent fields don't constrain.
 *
 * - `damageTag` — exact match against the hit's resolved damage tag. Used
 *   when `abilityType` is too coarse (Hold-only filtering needs `skillHold`,
 *   plunge-extra-only would need a more specific tag, etc.).
 * - `element` — element of the hit. For normals, this is the active infusion
 *   (or `physical` if uninfused). For skill/burst, the source ability's
 *   element (typically the character's element).
 * - `abilityName` — substring match (case-sensitive) against the parent
 *   ability's `name`. Used for sub-ability gates like "Wreath Arrow only"
 *   (Tighnari A1/A4/C1/C6), "Saichi exclusion" (Itto A4 — match all
 *   Kesagiri variants by negation in a future revision), "Pressurized Floe"
 *   (Aloy A4, Freminet A1), "Shadowpiercing Shot" (Sethos).
 * - `hitIndex` — 0-based index into a normal-attack combo (or charged-hit
 *   list). Used for "only N4 fires this" (Chongyun C1: NormalCounter==3) /
 *   "only N3 final hit triggers" (Kokomi A4) / "C2 fires on the final
 *   Wreath Arrow hit" patterns. Has no meaning for skill/burst hits.
 * - `isCrit` — when `true`, the trigger only fires on critical hits. Used
 *   for Yoimiya C2 (Pyro crit), Rosaria C1 (any crit), Gaming C2 (crit-on-
 *   plunge), etc. The planner doesn't simulate crit outcomes; the renderer
 *   treats this as "fire optimistically — assume crit when applicable".
 */
export type TriggerFilter = {
	damageTag?: DamageTag;
	/** The hit's element. ⚓ The array form matches ANY listed element under ONE
	 *  effect — and so ONE `procCooldown` clock, which is the point: Mizuki's A4
	 *  names Pyro, Hydro, Cryo and Electro behind a single shared 0.3s cooldown,
	 *  and four effects would have run four (cross-character onHit round,
	 *  2026-09-21). Same convention as `abilityType`'s array form. */
	element?: Element | Element[];
	abilityName?: string;
	hitIndex?: number;
	isCrit?: boolean;
};

// ---------------------------------------------------------------------------
// Conditions & triggers
// ---------------------------------------------------------------------------

/** Logical condition tree for effect gating. */
export type Condition =
	| {
			type: 'state';
			state: State;
			/**
			 * ⚓ QUALIFY `duringSummon` TO THE CAST KIND THAT SPAWNED THE SUMMON
			 * (summon-bound buffs round, 2026-09-21). Absent means "either" — the
			 * unqualified state every existing author has, and ⛔ the default must
			 * stay that, because a holder with one summon gains nothing from
			 * naming it and thirty-odd authors would have to.
			 *
			 * Columbina is the reason it exists: she has TWO summons, and her C6
			 * is wrapped in gcsim's `ReactBonusModIsActive(burstBuffKey)` —
			 * the Lunar DOMAIN, her burst. Her Gravity Ripple is the skill and
			 * lives five seconds longer, so an unqualified gate kept the +80%
			 * CRIT DMG firing after the Domain closed, and fired it in a rotation
			 * with no burst at all.
			 *
			 * ⚠️ Only meaningful on `duringSummon` (lint C.20): every other state
			 * has ONE opener vocabulary of its own, and a `source` on one would
			 * read as a gate and resolve as nothing.
			 */
			source?: 'skill' | 'burst';
	  }
	| { type: 'not'; condition: Condition }
	| { type: 'all'; conditions: Condition[] }
	| { type: 'any'; conditions: Condition[] }
	| { type: 'ascension'; min: number }
	| { type: 'constellation'; level: number }
	| { type: 'teamFaction'; faction: string; min: number }
	/** True when the party contains at least one character whose
	 *  `enablesReactions` includes `reaction` — the Stellar enablement gate.
	 *  Deliberately NOT `teamFaction`: there is no member count; a single
	 *  enabler (e.g. Sandrone for stellarConduct) converts the base reaction
	 *  party-wide and lights up every teammate's Stellar-conditional buffs.
	 *  Resolves when the eval context carries `teamEnabledReactions`
	 *  (renderer/planner-side); null otherwise, so effects aren't dropped
	 *  before team scope exists. See docs/library/game/stellar-reactions.md. */
	| { type: 'teamEnablesReaction'; reaction: Reaction }
	/** True while a POLESTAR FIELD stands — the 7s a Starlight Prism lives
	 *  after a Stellar-Conduct, refresh REPLACES (Radiance-window round,
	 *  2026-09-19). It is "Radiance: Stellar-Conduct" as a WINDOW: gcsim defines
	 *  that state as exactly `StatusIsActive(PolestarFieldKey)`.
	 *
	 *  ⚓ Resolved at an INSTANT the caller names, off the parse's own
	 *  Stellar-Conduct stream (`polestarFieldOpenAt` in `sim/fields.ts`, the ONE
	 *  reader) — the caller asks and hands the answer over as
	 *  `ConditionContext.inPolestarField`. Absent → null, so the Team Builder
	 *  (no timeline) lists the effect with a `needsField:polestar` caveat and
	 *  ⛔ never tries to resolve a window.
	 *
	 *  ⚠️ Keep the STANDING gate beside it (`all` of `teamEnablesReaction` + the
	 *  element count): the TB still narrows by enabler and element; this leaf
	 *  only narrows the planner further. */
	| { type: 'inPolestarField' }
	/** True when the count of NON-HOLDER team members whose `character.element`
	 *  is in `elements` satisfies `comparison` against `value`. Resolves
	 *  definitively at planner time since team composition is fully known.
	 *
	 *  The exclude-self semantic is implicit — the holder is never counted in
	 *  the total, regardless of whether the holder's own element is in
	 *  `elements`. This mirrors Skirk A4 Death's Crossing ("count non-Skirk
	 *  Cryo/Hydro teammates"). A future include-self variant can be added if
	 *  a real case appears.
	 *
	 *  Reference: Skirk A4 (drop-in replacement for the v0.8 live `gainStacks` +
	 *  `sourceLifetime` dispatch — canonical comps always reach max tier, so
	 *  the team-composition-derived count produces a cleaner story than per-cast
	 *  accumulation that lags behind the canonical state). */
	| {
			type: 'teamElementCount';
			elements: Element[];
			comparison: '>=' | '=' | '<=';
			value: number;
	  }
	/** True when the currently-active character (the receiver, in per-segment
	 *  evaluation) belongs to the named faction. Used for buff routing that
	 *  depends on the active char's identity rather than team-wide composition.
	 *
	 *  Resolves only inside per-segment renderer evaluation (where the receiver's
	 *  factions are known); returns null on parser-side and team-buff-row calls.
	 *
	 *  Reference: Linnea A4 — 5% DEF → EM, routed to the active char if Moonsign,
	 *  else to Linnea herself. Author as two effects: target=active gated on
	 *  `activeCharFaction: moonsign`, target=self gated on the negation. */
	| { type: 'activeCharFaction'; faction: string }
	| { type: 'weaponType'; weapons: ('sword' | 'claymore' | 'polearm' | 'bow' | 'catalyst')[] }
	/** Multi-stage skill or burst chain. Each stage in the chain has an entry
	 *  with this condition; the parser tracks per-character chain position and
	 *  picks the matching ability on each press.
	 *
	 *  - `index` is 0-based; index 0 is the cold-open (the press that starts the chain).
	 *  - `window` is the seconds within which the *next* stage must fire after this
	 *    one. Omit on the terminal (last) stage; absence signals "after firing me,
	 *    reset the chain to index 0."
	 *
	 *  Reference: Diluc Searing Onslaught E1 → E2 → E3, each within 4s of the prior. */
	| { type: 'chainStage'; ability: 'skill' | 'burst'; index: number; window?: number }
	/** Gates on user-asserted stack count for a named resource (Heizou
	 *  Declension, Yanfei Scarlet Seals, Mualani Wave Momentum, etc.).
	 *
	 *  The planner does NOT auto-track stack accumulation. Stacks are
	 *  asserted by the user via the `{key:N}` notation token: typing
	 *  `Heizou {declension:4} E` sets declension=4 immediately before the
	 *  E cast, and the parser uses that state to resolve the active ability
	 *  variant and gate stack-conditioned effects.
	 *
	 *  - `key` — resource name (must match the assertion token key)
	 *  - `min` — minimum stack count for the condition to hold
	 *  - `max` — optional upper bound (rarely needed; useful for per-tier
	 *    buff effects where exactly-N stacks gives a specific bonus)
	 *
	 *  Stack state resets to 0 on character swap; assertions persist across
	 *  multiple actions within a single on-field segment until the next
	 *  assertion of the same key changes the value. */
	| { type: 'stacks'; key: string; min: number; max?: number }
	/** True when the damage target's HP percentage is strictly below `threshold`
	 *  (0–100). The planner cannot simulate enemy HP, so this resolves to `null`
	 *  at evaluation time — meaning effects gated on it render with a caveat
	 *  ("active when enemy HP is below N% — assumed to hold").
	 *
	 *  Reference: Razor C2 (10% CR vs <30% HP), Yanfei C1 (20% CR vs <50% HP on
	 *  CA), Eula C4 (25% burst DMG vs <50% HP), Kamisato Ayato C1 (40% Shunsuiken
	 *  DMG vs ≤50% HP). Threshold is stored as a percentage (0–100), not a ratio. */
	| { type: 'enemyHpBelow'; threshold: number }
	/** Mirror of `enemyHpBelow`: true when the damage target's HP percentage is
	 *  strictly above `threshold` (0–100). Also resolves to `null` (planner
	 *  cannot sim enemy HP); gated effects render optimistically with caveat.
	 *
	 *  Reference: Diluc C1 (+15% DMG vs >50% HP). Threshold is stored as a
	 *  percentage (0–100), not a ratio. */
	| { type: 'enemyHpAbove'; threshold: number }
	/** True when the EFFECT RECIPIENT's HP percentage is strictly below
	 *  `threshold` (0–100). Distinct from `selfHpBelow` (gates on the effect's
	 *  holder) and `enemyHpBelow` (gates on the damage target). Recipient is
	 *  the active character for `target: 'active'` effects, the holder for
	 *  `target: 'self'`, etc. Resolves to `null` at evaluation time (planner
	 *  cannot simulate teammate HP); gated effects render optimistically with
	 *  the standard "assumed to hold" caveat.
	 *
	 *  Reference: Noelle A4 Devotion (shield active char at <30% HP),
	 *  Sangonomiya Kokomi C2 (Healing Bonus to characters at ≤50% HP).
	 *  Threshold stored as percentage (0–100), not a ratio. */
	| { type: 'recipientHpBelow'; threshold: number }
	/** True when the damage target carries an active aura of the named element.
	 *  Like `enemyHpBelow`, the planner cannot simulate aura state, so this
	 *  resolves to `null` and gated effects render optimistically.
	 *
	 *  Reference: Kaeya C1 Excellent Blood (+15% CR vs Cryo-aura / Frozen),
	 *  Chongyun C4 Frozen Skies (+1 energy on hit vs Cryo-affected, 2s ICD),
	 *  Keqing C2 Keen Extraction (Electro-aura particle gen).
	 *
	 *  The element is restricted to the 5 aura-leaving elements
	 *  ({@link AuraElement}). Anemo/Geo never persist as enemy aura (they
	 *  swirl/crystallize existing ones and dissipate); Physical never applies
	 *  an aura at all. Frozen-tagged enemies carry Cryo aura in-game, so
	 *  authoring with `cryo` covers both "Cryo aura" and "Frozen" description
	 *  branches at planner level. */
	| { type: 'enemyAffectedBy'; element: AuraElement }
	/** True when the wielder's own HP percentage is strictly below `threshold`
	 *  (0–100). The planner cannot simulate self HP, so this resolves to `null`
	 *  at evaluation time and gated effects render with the standard caveat
	 *  ("active when self HP is below N% — assumed to hold").
	 *
	 *  Reference: Hu Tao A4 Sanguine Rouge (+33% pyroDmgBonus at <50% HP),
	 *  Xiao A4 Transcension (+100% plungeDmgBonus at <50% HP), Kaeya C4
	 *  Frozen Kiss (30% shield at <20% HP), Wriothesley A4 (30% heal at
	 *  <60% HP). Subsumes the fixed-threshold `state: hpBelow50` /
	 *  `state: hpBelow70` enum values; threshold is stored as a percentage
	 *  (0–100), not a ratio. */
	| { type: 'selfHpBelow'; threshold: number }
	/** Mirror of `selfHpBelow` — true when self HP percentage is strictly
	 *  above `threshold`. Resolves to `null` at planner time.
	 *
	 *  Reference: Bennett A4 (Q heal+atk-buff caps grow when caster ≥70% HP).
	 *  Subsumes the fixed-threshold `state: hpAbove50` / `state: hpAbove70`
	 *  enum values. */
	| { type: 'selfHpAbove'; threshold: number };

/** A specific chain-stage condition extracted from a Condition tree. */
export type ChainStageCondition = Extract<Condition, { type: 'chainStage' }>;

/** Event trigger definition for when an effect applies. */
export type Trigger =
	| {
			type: 'onCast';
			/** Which ability type's cast fires the trigger. Omit to match any cast. */
			ability?: 'skill' | 'burst';
			/** Optional cast-input filter: when set, the trigger only fires for
			 *  casts whose token text matches one of the listed inputs (e.g.
			 *  `['hE']` to gate on the hold-skill variant only, `['E']` to gate
			 *  on the base tap-skill variant). When absent, fires on any cast of
			 *  the matching `ability` type. Used by Skirk where Tap-E grants 45
			 *  Serpent's Subtlety but Hold-E grants only 18 — two `gainStacks`
			 *  effects with mutually-exclusive `input` filters express the
			 *  variant gating without touching the AbilityVariant shape. */
			input?: string[];
	  }
	| {
			type: 'onHit';
			/** Coarse filter — preferred for simple cases. The fine-grained
			 *  `filter.damageTag` is preferred when distinguishing skillHold from
			 *  skill, charged-attack-extra from regular Extra, etc.
			 *
			 *  An ARRAY matches any listed class under ONE effect — one shared
			 *  `procCooldown` ICD clock (Escoffier C6: NA/CA/PL hits share a
			 *  0.5s ICD; three single-class effects would each get their own
			 *  clock and triple-fire). */
			abilityType?:
				| 'skill'
				| 'burst'
				| 'normal'
				| 'charged'
				| 'plunge'
				| ('skill' | 'burst' | 'normal' | 'charged' | 'plunge')[];
			damageType?: 'elemental' | 'physical';
			/** Fine-grained filter (G primitive). Lets effects gate triggers on
			 *  damageTag, element of the hit, sub-ability name, hit index, or
			 *  crit state. See {@link TriggerFilter}. When present, ALL specified
			 *  fields must match for the trigger to fire (intersection). */
			filter?: TriggerFilter;
			/** Whose hits fire this trigger. `'self'` (default) — only the
			 *  effect's holder counts. `'team'` — any team member including
			 *  the holder. `'others'` — any team member EXCEPT the holder.
			 *
			 *  Mirrors `onReaction.source` with the addition of `'others'` for
			 *  Skirk A4 Death's Crossing ("apart from Skirk"). Renderer scoping:
			 *  dispatch walks the rotation-wide `hit` IR events and filters by this
			 *  field at dispatch time.
			 *
			 *  ⚓ `'active'` (summon-tick round, 2026-08-31) — the hit must have been
			 *  landed by the character the player is CONTROLLING, with their own cast
			 *  or swing. Nicole's A4 Philokalia is the case and the reason it exists:
			 *  "when Elemental DMG from nearby ACTIVE party members hits an opponent".
			 *
			 *  ⚠️⚠️ It is strictly narrower than `'team'`, and the difference is a
			 *  summon. Once summon damage ticks reach this gate, a tick carries its
			 *  OWNER's `characterId` while its owner may be standing off field — so
			 *  `'team'` would have Nicole's upgrade riding Oz for the whole rotation.
			 *  The tick is flagged `viaEntity` at synthesis and this source refuses
			 *  it. ⛔ Never reach for an id comparison instead: that is exactly the
			 *  distinction an id cannot make (see `HitEvent.viaEntity`).
			 *
			 *  ⚠️ Every cast/normal/charged/plunge hit is by construction the active
			 *  character's — the parser emits them only for the segment character —
			 *  so `'active'` differs from `'team'` in precisely one respect today. */
			source?: 'self' | 'team' | 'others' | 'active';
			/**
			 * ⚓ Elemental-application gating for THIS proc's own hits — the same
			 * key, the same vocabulary and the same default as `summonTick.icdGate`
			 * (coordinated-attack round, 2026-08-18). Absent = the standard ICD;
			 * `'none'` = every fire applies (gcsim's `ICDTagNone`); an `IcdWindow` =
			 * a measured (timer, every) pair.
			 *
			 * ⚠️⚠️ `procCooldown` IS NOT THIS. The cooldown says how often the proc
			 * FIRES; this says how often a fire APPLIES. Raiden's Eye fires every
			 * 0.9 s and applies Electro every third one; Dehya's Sanctum fires every
			 * 2.5 s and applies every time. Confusing the two is how a proc comes to
			 * paint a pip per fire.
			 *
			 * ⚠️⚠️ Pair it with the stream OUR effect MODELS, never with the
			 * character (the Emilie rule). A coordinated wave is ONE hit here and two
			 * to five swords in gcsim, so gcsim reaching "one application per wave"
			 * through `ICDGroupDefault` is `'none'` in our stream.
			 */
			icdGate?: 'none' | IcdWindow;
			/**
			 * Seconds after the HOST CAST during which this trigger is armed —
			 * read ONLY by the damage-proc path (`sim/procs.ts`), i.e. by a
			 * `damage` effect that carries an `application[]` (coordinated-attack
			 * round, 2026-08-18).
			 *
			 * ⚓ A BUFF's `onHit` needs no window and must not carry one: it is
			 * armed for as long as its holder is in the team, and `buffWindows`
			 * derives its span from the hit it fires on. A damage proc is the
			 * opposite — Beidou's Stormbreaker listens for 15 s and then stops,
			 * and without a window it would listen for the rest of the rotation.
			 *
			 * ⚠️ Same contract as `onReaction.armedFor`: an effect hosted on
			 * `summons[].effects[]` needs none, because the summon's own liveness
			 * IS the window and it is answered by the one `summonEndAt`.
			 * characterLint B.13b enforces both halves.
			 */
			armedFor?: number;
	  }
	| {
			type: 'onReaction';
			reaction: Reaction | Reaction[] | 'any';
			/** Whose reactions fire this trigger. `'self'` (default) — only the
			 *  effect's holder counts as the source (Kazuha A4: only Kazuha's
			 *  swirls fire it). `'team'` — any team member's matching reaction
			 *  fires it (Linnea C1: any party member's Lunar-Crystallize hit
			 *  consumes a Field Catalog stack).
			 *
			 *  Renderer scoping: with `source: 'self'`, the dispatcher filters
			 *  `reaction` IR events to those originating from the holder. With
			 *  `source: 'team'`, all `reaction` events are walked.
			 *
			 *  ⚓ `'active'` (mark-triggered round, 2026-08-17) — the reaction must
			 *  have been caused by the character the player is CONTROLLING, with
			 *  their own cast or swing. Fischl's A4 is the case: "if your current
			 *  active character triggers an Electro-related Elemental Reaction".
			 *
			 *  ⚠️⚠️ It is strictly narrower than "`'team'` filtered to the active
			 *  character", and the difference is the whole point. A summon tick and
			 *  a reaction proc carry their OWNER's id, so an id comparison alone
			 *  counts Oz's reactions as Fischl's whenever Fischl is on field —
			 *  which is exactly gcsim's `ActorIndex` defect (`fischl/asc.go`), and
			 *  it is why every Thundering Retribution in the oracle fires 4 frames
			 *  after an Oz application. The sim tags an entity-delivered
			 *  application so this source can refuse it. See
			 *  docs/mark-triggered-damage-round.md §1. */
			source?: 'self' | 'team' | 'active';
			/**
			 * ⚓ Elemental-application gating for THIS proc's own hits — the same
			 * key, the same vocabulary and the same default as `summonTick.icdGate`
			 * (coordinated-attack round, 2026-08-18). Absent = the standard ICD;
			 * `'none'` = every fire applies (gcsim's `ICDTagNone`); an `IcdWindow` =
			 * a measured (timer, every) pair.
			 *
			 * ⚠️⚠️ `procCooldown` IS NOT THIS. The cooldown says how often the proc
			 * FIRES; this says how often a fire APPLIES. Raiden's Eye fires every
			 * 0.9 s and applies Electro every third one; Dehya's Sanctum fires every
			 * 2.5 s and applies every time. Confusing the two is how a proc comes to
			 * paint a pip per fire.
			 *
			 * ⚠️⚠️ Pair it with the stream OUR effect MODELS, never with the
			 * character (the Emilie rule). A coordinated wave is ONE hit here and two
			 * to five swords in gcsim, so gcsim reaching "one application per wave"
			 * through `ICDGroupDefault` is `'none'` in our stream.
			 */
			icdGate?: 'none' | IcdWindow;
			/**
			 * Seconds after the HOST CAST during which this trigger is armed — the
			 * lifetime of the MARK a cast leaves on the target, not of the ability.
			 *
			 * ⚓ Nahida's Seed of Skandha (25 s) is the case and the reason the
			 * field exists. The Seed is a state on the ENEMY, so it is not a
			 * `summons[]` entry (which means a thing left in the WORLD — see
			 * `Summon`), and it is not `activeDuration` either: that would claim
			 * Nahida's E is ACTIVE for 25 s and grow its bar, when what persists is
			 * a debuff on the target.
			 *
			 * ⚠️ Required on an ability-hosted `onReaction` effect that carries an
			 * `application[]` — without it the trigger would listen forever
			 * (characterLint B.12c). An effect hosted on `summons[].effects[]` needs
			 * no `armedFor`: the summon's own liveness IS the window, and it is
			 * answered by the one `summonEndAt`.
			 *
			 * ⚠️ The window opens at the CAST, not at the hit that applies the mark
			 * — in game Nahida's Seed lands with her skill's hitmark 13 frames later,
			 * so ours is 13 frames early at both ends. Stated rather than modelled:
			 * naming which of a cast's `application[]` entries does the marking is a
			 * second schema field for a fifth of a second, and the mark is never the
			 * limiting factor at the START (nothing has reacted yet).
			 */
			armedFor?: number;
	  }
	| { type: 'onEnergy'; threshold: number }
	| { type: 'onHPChange' }
	| { type: 'onHPDecrease' }
	| { type: 'onHPIncrease' }
	| { type: 'onHeal' }
	| { type: 'onState'; state: State }
	/* ⛔⛔ `manual` WAS HERE and is RETIRED (2026-09-21,
	   docs/manual-trigger-retirement-round.md). It meant "the player toggles it"
	   and there was never a toggle: its only occurrence in `src` was this
	   declaration, so 167 effects across 69 characters drew no bar, no marker and
	   no chip, while `deriveCapabilities` claimed every one of them in the Team
	   Builder. ⚓ The rule that replaces it: an effect states WHEN IT FIRES, and
	   when a kit clause names several sources that is one effect PER SOURCE. If
	   our vocabulary cannot say when, the effect does not exist — its kit text
	   lives in the host `description` and its numbers in `_curatorNotes`.
	   characterLint B.18 refuses it. */
	/** Fires when the holder leaves the field; buff targets the incoming character (e.g. TTDS). */
	| { type: 'onSwapOut' }
	/** Fires when the holder enters the field; buff targets themselves (e.g. The Widsith). */
	| { type: 'onSwapIn' }
	/**
	 * ⚓ A STACK THRESHOLD — fires the instant the SUM of `keys` reaches `count`
	 * (stack-threshold round, 2026-09-18; `docs/stack-threshold-round.md`).
	 *
	 * Columbina's Gravity is the case and the reason it has a reader: while the
	 * Gravity Ripple is out, every party Lunar reaction accrues Gravity, at 60 the
	 * Interference fires and the pool empties. A flat cadence ("every ~6s") was
	 * refused as an invented number; a stack resource is the mechanic's own shape.
	 *
	 * ⚓⚓ THE FIRE SPENDS THE SET. Every key in `keys` goes to zero at the fire —
	 * that is the only semantics under which "fires at N" can fire twice, and an
	 * explicit `consumeStacks` beside it would be ceremony (gcsim: `clearGravity()`).
	 * ⚠️ A GATE is not a threshold: "while ≥ N stacks" is a `stacks` Condition
	 * (Nahida's Seeds), and this is not that.
	 *
	 * `keys` names ONE resource or SEVERAL sibling resources counted together —
	 * Columbina's three Lunar kinds are three keys so the fire can tell which
	 * accrued the most. `dominant` is that question asked by ONE effect: it fires
	 * only when the named key holds the largest count at the fire (ties resolve in
	 * `keys` order — gcsim's strict `>` over its index loop, the same rule), so
	 * three mutually-exclusive branches are three effects with three `dominant`s.
	 * An effect with no `dominant` fires on every threshold.
	 *
	 * Checked at the four settle points where a count can move — the reaction
	 * dispatch, a cast, a hit, a summon tick — by `sim/thresholds.ts`, which is
	 * the ONE reader; a `stackThreshold` IR event is the record. What an effect
	 * on it then does: a `buff` anchors on the event (`buffWindows`, cast-like:
	 * start = the fire, end = + duration; `active` follows the field), a `shield`
	 * opens at the fire, a `damage` draws a MARK on the lane of the summon that
	 * hosts the accrual and ⛔ applies NOTHING (the one holder is Durability 0 in
	 * gcsim; lint refuses a non-empty `application[]` here until a fire feeds the
	 * gauge). `energy` reaches no surface, as everywhere.
	 *
	 * `label` is the fire's in-game name for the buff rows ("Gravity
	 * Interference"); effects sharing one (keys, count) must agree on it.
	 *
	 * Lint (B.16): non-empty `keys`, each with a `gainStacks` author on the same
	 * character; positive integer `count` no larger than the keys' summed `max`;
	 * `dominant` ∈ `keys`.
	 */
	| { type: 'onStack'; keys: string[]; count: number; dominant?: string; label?: string }
	/**
	 * ⚓ THE BUFF EXISTS WHILE ITS HOLDER HOLDS STACKS OF `key` (stepped stacks
	 * round, 2026-09-27) — anchored on no cast, so the bar is exactly the spans
	 * where the count is above zero, and a `perStack` value on the same key is
	 * drawn as a STEPPED bar whose density follows the count.
	 *
	 * ⚓ Odette's Marvelous Splendor is the case: her count steps DOWN while she
	 * is off field and her party's steps UP by the same amount, across an E, a Q
	 * that refreshes the Double and back — no cast-anchored window can say "one
	 * bar from the summon until the Double leaves" without splitting at the Q or
	 * ending early. Add `whileState` to bound it by something other than the
	 * count (her Double: `soloDanceDouble`).
	 *
	 * ⚠️ The key must be ROTATION-scoped (only those counts are recorded in time
	 * order — `SimContext.stackHistory`) and granted without a `lifetime` (a
	 * lifetime drop is swept late and would draw a late step). Target `self`,
	 * `team` or `teamExcludingSelf`; the row is named after the hosting entry.
	 * Lint B.20. Conditions are evaluated WITHOUT an instant (constellation,
	 * team facts) — a `stacks` gate would be redundant, the count IS the window.
	 */
	| { type: 'whileStacks'; key: string }
	/** Always-on passive — not rendered in the team buffs row. */
	| { type: 'passive' }
	/** Fires when the host ability's duration expires; buff starts at bar.end.
	 *  When the effect lives on a passive/constellation (not on the host ability itself),
	 *  `ability` must be set to disambiguate which ability's duration binds the trigger.
	 *  Example: Raiden C4 Pledge of Propriety — ATK% buff after Musou Isshin ends. */
	| { type: 'afterDuration'; ability?: 'skill' | 'burst' }
	// ⛔ `onStanceEnd` was RETIRED 2026-08-15 — it described the same instant as
	// `afterDuration` and had exactly one author (Hu Tao A1), matched by no
	// consumer, so her post-Paramita CRIT share silently never drew. A stance's
	// window IS the host ability's duration, and `afterDurationStart` reads the
	// window's FINAL end, so the early-close case the old doc-comment called out
	// ("naturally or via Q cast") was already covered. Two trigger names for one
	// instant is how the orphan happened; re-authored as
	// `afterDuration + ability:'skill'`. See docs/curation/orphaned-schema-audit.md.
	/** Fires when a shield's scheduled duration expires. Shield windows are
	 *  derived deterministically from cast-time-spawned shields (tags `['shield']`
	 *  abilities + their summon duration, or `Effect.type: 'shield'` with onCast
	 *  trigger and an explicit `duration`). Shatter-by-damage is not simulable
	 *  (no enemy state in planner) — the trigger fires at scheduled expiry only,
	 *  following the same null-resolving convention as `enemyHpBelow` /
	 *  `recipientHpBelow` (rotation assumes the shield holds to expiry).
	 *
	 *  - `source: 'self'` (default) — fires only when the trigger holder's own
	 *    shields end (Noelle C4: only Breastplate expiry, not a teammate's).
	 *  - `source: 'team'` — fires for any team member's shield ending,
	 *    including the holder's own (Kachina C6: "active character's Shield is
	 *    replaced or destroyed for any reason").
	 *  - `ability` — narrow by which-ability-spawned-the-shield. Omit to match
	 *    any of the source's shield-spawning abilities. */
	| {
			type: 'onShieldEnd';
			source?: 'self' | 'team';
			ability?: 'skill' | 'burst';
	  }
	/** Fires on every team Nightsoul Burst event — the same rolling-cooldown
	 *  events the NB lane renders (E/Q cast or catalyst entering field; cooldown
	 *  18s/12s/9s for 1/2/3+ Natlan units). Global team event: not gated on
	 *  the trigger-owner being on-field, since the in-game OnNightsoulBurst
	 *  event is team-scoped. Used for "+ATK when teammate triggers NB"-shape
	 *  passives (Mavuika A1, Varesa A4, Xilonen A2, Ifa A1, Chasca A2,
	 *  Iansan A2). Does not fire when no NB events occur (no Natlan units in
	 *  team — `nbBars` is empty). */
	| { type: 'onTeamNightsoulBurst' }
	/**
	 * ⚓⚓ FIRES PERIODICALLY WHILE THE ACTIVE CHARACTER IS NORMAL-ATTACKING —
	 * the coordinated-attack WAVE (2026-08-18). Xingqiu's Rain Swords, Yelan's
	 * Exquisite Throw, Thoma's Fiery Collapse and Fischl's C6 Evernight Raven.
	 *
	 * ⚓⚓ IT IS NOT PER-HIT, AND THAT IS THE WHOLE REASON IT IS ITS OWN TRIGGER.
	 * gcsim runs all four off `internal/template/minazuki`, a watcher on
	 * `action.NormalAttackState`: while the ACTIVE character is inside the
	 * normal-attack animation it fires every `interval`, and swing COUNT is
	 * irrelevant — a slow two-hit string and a fast five-hit string produce the
	 * same one wave per second. ⛔ An `onHit`-per-swing model is wrong in both
	 * directions, which is the survey's headline finding.
	 *
	 * ⚠️ ONLY VALID ON `Summon.effects[]`. All four are hosted on a summon that
	 * was already authored (Rainbow Bladework, Exquisite Throw, Scorching
	 * Ooyoroi, Oz), so the summon's own liveness IS the window and there is one
	 * `summonEndAt` answering it — the same arrangement `onReaction` uses.
	 * characterLint B.13c enforces it.
	 *
	 * ⚠️ The effect must carry an `application[]`: unlike a summon tick, whose
	 * element comes off the `damage` effect and lands at the tick instant, a wave
	 * TRAVELS (Xingqiu 20 f, Yelan 20 f, Thoma 11 f, Fischl 10 f), and the frame
	 * offset is what `application[]` exists to say.
	 *
	 * ⛔ THE MARKERS ARE NOT DERIVED BY THE PROJECTION. `collectSummonTicks`
	 * cannot walk this series — its fire times depend on when somebody swung —
	 * so `summonTickSeries` refuses it by type and the parse publishes the
	 * instants it measured onto the summon window (`TimelineWindow.ticks`).
	 *
	 * - `interval` — seconds between waves while the state holds. 1 for all four.
	 * - `icdGate` — the shared proc gate; see its doc on `onReaction` above.
	 *   ⚠️⚠️ Xingqiu and Yelan carry `'none'` — the positive claim their kit text
	 *   makes ("each wave of Hydro Swords can apply one source of Hydro") — while
	 *   Thoma, whose wave IS one hit, is bare and gates on the standard.
	 */
	| {
			type: 'whileNormalAttacking';
			interval: number;
			/**
			 * ⚓ Elemental-application gating for THIS proc's own hits — the same
			 * key, the same vocabulary and the same default as `summonTick.icdGate`
			 * (coordinated-attack round, 2026-08-18). Absent = the standard ICD;
			 * `'none'` = every fire applies (gcsim's `ICDTagNone`); an `IcdWindow` =
			 * a measured (timer, every) pair.
			 *
			 * ⚠️⚠️ `procCooldown` IS NOT THIS. The cooldown says how often the proc
			 * FIRES; this says how often a fire APPLIES. Raiden's Eye fires every
			 * 0.9 s and applies Electro every third one; Dehya's Sanctum fires every
			 * 2.5 s and applies every time. Confusing the two is how a proc comes to
			 * paint a pip per fire.
			 *
			 * ⚠️⚠️ Pair it with the stream OUR effect MODELS, never with the
			 * character (the Emilie rule). A coordinated wave is ONE hit here and two
			 * to five swords in gcsim, so gcsim reaching "one application per wave"
			 * through `ICDGroupDefault` is `'none'` in our stream.
			 */
			icdGate?: 'none' | IcdWindow;
	  }
	/** Fires periodically while the parent summon is active. Only valid on
	 *  effects within `Summon.effects[]`. The timeline renders one marker per
	 *  tick on the summon bar.
	 *
	 *  - `interval` — seconds between ticks.
	 *  - `firstTickDelay` — seconds from summon spawn to first tick. Defaults
	 *    to `interval` (mirrors gcsim's "first tick after one interval"
	 *    convention for most summons).
	 *
	 *  Reference: Fischl Oz, Zhongli Stone Stele, Albedo Solar Isotoma blossom,
	 *  Ororon Supersonic Oculus, Mavuika Ring of Searing Radiance. */
	| {
			type: 'summonTick';
			interval: number;
			firstTickDelay?: number;
			/**
			 * ⚓ Elemental-application gating for THIS tick series (gauge round
			 * L5e-a¾). Absent means **standard ICD** — `icd.ts` at
			 * `STANDARD_ICD_FRAMES`, on a clock of the series' own. `'none'` means
			 * every tick applies, gcsim's `ICDTagNone`.
			 *
			 * ↻ **AND SINCE 2026-08-17 IT CAN ALSO CARRY A MEASURED WINDOW**
			 * (ICD-group round, sub-landing b). An `IcdWindow` is gcsim's own group
			 * reduced to its two load-bearing numbers, the same shape
			 * `chargedIcdWindow` already carries and the same shape `IcdParams`
			 * always had — so consuming one needed no new ICD mechanism, only a
			 * resolver willing to return something other than the standard.
			 *
			 * ⚓ THE KEY WAS REUSED RATHER THAN A SECOND ONE MINTED, deliberately:
			 * this name is already unique and already has a consumer, and a fresh
			 * key would have had to earn both again (see the naming note below —
			 * that trap has been paid for once).
			 *
			 * ⚠️ Absent is STILL the measured majority and icd.md's rule against
			 * mass-annotating a default is untouched: 13 of the 35 oracled series
			 * carry a window, and ⛔ a series standard already reproduces stays
			 * bare. Author one only from `gcsim-frames-diff.md` §5b, which measures
			 * the group directly rather than inferring it from the applied count.
			 *
			 * ⚠️ One thing a window cannot say: four of gcsim's groups apply two or
			 * three times at a regular period and then STOP for the rest of the
			 * window. `(timer, every)` has no room for that cap, so authoring the
			 * pair gets the cadence and drops it. §5b's `N max` marks those.
			 *
			 * ⚠️⚠️ IT LIVES ON THE TRIGGER, NOT THE SUMMON, and Furina is why:
			 * Salon Solitaire is ONE authored summon carrying THREE tick series,
			 * and they measure differently — Chevalmarin is standard, Gentilhomme
			 * is neither, Crabaletta cannot be told apart. A per-summon flag
			 * could not express that.
			 *
			 * ⚓ Absent is the MEASURED majority, not a fallback: 15 of the 35
			 * series gcsim exposes are reproduced exactly by standard ICD and
			 * only 5 require `'none'`. ⛔ So do not annotate a series that
			 * standard already gets right — including the two where standard and
			 * `'none'` agree because the interval exceeds the 2.5 s timer (Yae's
			 * Sesshou Sakura, Furina's Crabaletta). Annotating those would assert
			 * a measurement nobody made.
			 *
			 * ⛔ STILL NOT a free-form gcsim ICD-group name. gcsim has 58 of them,
			 * that is a taxonomy we would have to maintain, and its entire content
			 * is the two numbers `IcdWindow` carries.
			 *
			 * ⚠️⚠️ THE NAME IS LOAD-BEARING — this key is deliberately not called
			 * `icd`. `orphanedSchema.test.ts` matches property ACCESS by key
			 * name, and the Visualizers' ICD instrument already fills the
			 * codebase with `.icd-chart`, `handles.icd` and the instrument id
			 * `'icd'` — so a key of that name satisfies the guard no matter
			 * what, and would be permanently unverifiable. ⛔ Never name an
			 * authored key after an existing module, instrument or CSS prefix:
			 * the guard is only as strong as the name is unique. Confirmed by
			 * deleting every access and watching the test stay GREEN under the
			 * old name and go RED under this one.
			 *
			 * ⚠️ Second-order, and found the same way: the guard also counts a
			 * BACKTICKED MENTION followed by punctuation, so prose naming this
			 * key in a comma'd list would stand in for a real consumer. Keep
			 * discussion of it phrased so no such mention appears.
			 */
			icdGate?: 'none' | IcdWindow;
			/**
			 * ⚓ HOW MANY TICKS THE SERIES FIRES, when the count is not
			 * `duration ÷ interval` (tick-cap round, 2026-08-18).
			 *
			 * Absent means the count is DERIVED from the summon's lifetime, which
			 * is right for **26 of the 37** series the oracle can compare — ⛔ so
			 * this is not a field to fill in by default, and icd.md's rule against
			 * annotating a measured majority applies here too.
			 *
			 * ⚓⚓ IT IS A COUNT AND NOT A TIME BOUND, and Mona is the proof: gcsim's
			 * loop caps her Mirror Reflection at `i < 300` FRAMES while the summon's
			 * measured lifetime is ~4.05 s, so the two bounds genuinely disagree and
			 * only a count reads unambiguously off the Go. ⛔ Never re-express one as
			 * a shortened `duration` — that contradicts a lifetime the kit text
			 * states, which is the fix `_curatorNotes` on Mona and Collei both
			 * explicitly refuse.
			 *
			 * ⚠️ The divergence runs BOTH ways — six series tick one short of gcsim
			 * and four one long — so ⛔ do not assume a cap only ever truncates.
			 *
			 * ⚠️⚠️ THE WINDOW IS STILL A BOUND. A cap never EXTENDS a series past the
			 * summon's end; it only ever stops one earlier. The one exception the
			 * corpus needs is the boundary tick — a tick landing exactly on
			 * `spawn + duration`, which our half-open walk drops and gcsim's
			 * status-gated chains land (Kaeya's `Status.Add(key, duration + hitmark
			 * + 1)`, where the `+ 1` is deliberate). A cap of `n + 1` is how that is
			 * said, and `collectSummonTicks` widens its bound by exactly one tick to
			 * honour it. ⛔ It cannot buy more than that.
			 *
			 * Read `docs/gauge-round-L5e.md` §4 for the measured worklist.
			 */
			tickCap?: number;
			/**
			 * ⚓ A constellation-gated override of `tickCap` — Sigewinne's
			 * `bubbleHitLimit` goes 5 → 8 at C1, and a flat count cannot say that.
			 *
			 * Same shape as `BuffEffect.constellationScaling` and
			 * `gainStacks.constellationScaling`: when `conditions` evaluates
			 * definitively true, `ticks` REPLACES the base `tickCap` outright — ⛔ it
			 * is not an addend, so author the total.
			 *
			 * ⚠️⚠️ THE KEY IS DELIBERATELY NOT `constellationScaling`, and the reason
			 * is the same one recorded on `icdGate`: `orphanedSchema.test.ts` matches
			 * property ACCESS by key NAME, and two other schema branches already read
			 * a key of that name — so reusing it here would be satisfied by THEIR
			 * consumers no matter what, and this branch would be permanently
			 * unverifiable. ⛔ Never name an authored key after one the codebase
			 * already reads.
			 */
			tickCapScaling?: { conditions: Condition; ticks: number };
	  };

/** Known gameplay state keys used in conditions and triggers. */
export type State =
	| 'afterNormalAttack'
	| 'afterSkill'
	| 'afterBurst'
	| 'afterDurationEnds'
	| 'shielded'
	| 'onField'
	| 'offField'
	| 'duringSummon'
	| 'nightsoulBlessing'
	| 'inStance'
	/** Flins: 6s post-Northland-Spearstorm window during which `sQ` resolves
	 *  to Thunderous Symphony (gcsim `thunderous-symphony` status). */
	| 'symphonyWindow'
	/** Varesa: 140f post-plunge Apex Drive window during which `sQ` resolves
	 *  to Volcano Kablam (gcsim `apex-drive` status). */
	| 'apexDrive'
	/** Durin: 6s Essential Transmutation commit window opened by the tap E
	 *  (gcsim `durin-essential-transformation`). Recast E commits White,
	 *  a Normal Attack commits Dark; either commit consumes this window. */
	| 'transmuting'
	/** Durin: 30s Confirmation of Purity form (gcsim `confirmation-of-purity`).
	 *  Opened by the White commit; displaced by the Dark commit. */
	| 'whiteForm'
	/** Durin: 30s Denial of Darkness form (gcsim `denial-of-darkness`) —
	 *  gates the Principle of Darkness burst. Opened by the Dark commit
	 *  (a Normal Attack during `transmuting`); displaced by the White commit. */
	| 'darkForm'
	/** Odette: the 6s window opened by BOTH her skill and her burst, during
	 *  which her Elemental Skill is replaced by the special skill Adagio: Coda
	 *  at Dawn's Tolling. Two openers is the whole reason it is a transient
	 *  state rather than a chain stage — a chain has one entry point.
	 *
	 *  ⚠️ Her kit states the gate twice and not identically: the talent text
	 *  says "for 6s after unleashing" (both abilities), while the Solo Dance
	 *  Double tooltip says "when there is a Dance Double summoned by Odette
	 *  nearby", which would be 20s. The 6s is authored because it is the number
	 *  the talent states and it is the tighter of the two; ⛔ don't switch to
	 *  the summon's lifetime without an in-game check. */
	| 'codaWindow'
	/** Odette: her Solo Dance Double is on the field — opened by the summon
	 *  itself (`Summon.opensState`), so it spans the Double's life exactly. */
	| 'soloDanceDouble'
	/** Furina: her Arkhe alignment is PNEUMA. ⚓ THE ONLY TOGGLE STATE IN THE
	 *  CORPUS, and the only one whose absence is itself a meaning — Furina
	 *  starts in Ousia (gcsim `furina.go:61`) and her Charged Attack flips
	 *  between the two forever, so `pneuma` names the non-default half and
	 *  Ousia is "not pneuma". ⛔ Never mint an `ousia` beside it: two states for
	 *  one bit is a pair that can disagree, and the default would then have to
	 *  be asserted at the start of every rotation.
	 *
	 *  It gates the Pneuma VARIANT of Salon Solitaire, which is the whole point:
	 *  the alignment at the instant of the cast decides whether the E summons
	 *  the three Salon Members or the Singer of Many Waters. */
	| 'pneuma'
	/** Lauma: Spirit Envoy Metamorphosis — the DEER (charged-forms round,
	 *  2026-09-16). Opened by a Charged Attack with the Envoy ready; 10s, ended
	 *  by her next attack or cast (`terminatesOnAction`) or a swap
	 *  (`terminatesOnSwap`); ⚓ NOT by a dash or a jump — she moves in deer form
	 *  (Nate). The one non-hitting action in the corpus. gcsim
	 *  `lauma-spirit-envoy`. */
	| 'spiritEnvoy'
	/** Lauma: Spirit Envoy Metamorphosis is on COOLDOWN — 4s from the deer's
	 *  end (`onEnd` of `spiritEnvoy`; gcsim `endDeerState`), during which her
	 *  Charged Attack is Spiritcall Prayer, the sibling normal ability gated on
	 *  this state. ⚠️ A4 shortens the 4s by up to 20% with Elemental Mastery;
	 *  not simulated (⚓ Nate: a caveat), so the last 0.8s of the window can be
	 *  Prayer here and the deer in game. */
	| 'envoyCooldown'
	/** Varesa: Follow-Up Strike — 5s from either Elemental Skill (gcsim
	 *  `skillStatus` = "follow-up", `AddStatus(…, 5*60)`). ⚓ Opened for its
	 *  `consumes`: the skill ends Apex Drive ("Varesa will exit Apex Drive after
	 *  using her Elemental Skill"), and an instant cast can close a state only by
	 *  opening one (T1 tranche, 2026-09-17). ⚠️ Nothing reads it yet — gcsim turns
	 *  a Normal Attack inside it into a Charged Attack, which is unmodelled. */
	| 'followUpStrike'
	/** Illuga's Haunted Night's Oriole-Song (event-ended buffs round,
	 *  2026-09-21) — the burst's 20s effect, which ALSO ends the moment her
	 *  Nightingale's Song pool is spent (`consumeStacks.closesStateWhenEmpty`). */
	| 'orioleSong';

/**
 * Post-action transient state — a short named gating window opened by an
 * action that is NOT a stance (the sQ primitive, post-P4 2026-07-17;
 * generalized to per-action openers with post-P4 #2). Two opener shapes:
 *
 *   - `opensTransientState` on an instant skill/burst: the cast opens the
 *     window at cast start (Flins Northland Spearstorm → `symphonyWindow`).
 *   - `actionOpensState` on a normal ability, keyed by action class: the
 *     action's END opens the window — a plunge landing (Varesa plunge →
 *     `apexDrive`), a normal attack's first-swing recovery (Durin's dark
 *     commit → `darkForm`), or a charged attack (Furina's Arkhe toggle).
 *
 * The window gates ability/variant `conditions` (e.g. a burst variant with
 * `conditions: { type: "state", state: "symphonyWindow" }`); a variant can
 * close it early via `consumesState`. Re-opening before expiry refreshes the
 * window (a new span record is emitted).
 *
 * ⚓ TWO SHAPES, AND THE AXIS IS WHAT ENDS THE STATE (Arkhe round, 2026-09-04).
 * A WINDOW ends by itself, after `duration` seconds — that is every author but
 * one. A TOGGLE ends only when the same action fires again: `toggle: true`, no
 * duration, because there is no length to state. Furina's Charged Attack flips
 * her Arkhe alignment and nothing else ever puts it back (gcsim `charge.go:59`
 * writes a plain `c.arkhe` field with no timer).
 *
 * ⚓ NAME THE NON-DEFAULT HALF. A toggle is one state, not two: Furina's is
 * `pneuma`, and its ABSENCE is Ousia. That is what makes the default free —
 * no rotation has to declare the alignment it starts in.
 *
 * ⚠️ A toggle's live end is `Infinity` (it is true until something flips it),
 * and finalize clamps the IR window to the rotation's end. ⛔ Never let the
 * `Infinity` reach a `TimelineWindow` — `notationParser.ir.test.ts` requires a
 * finite `end` on every window, which is the invariant that caught this.
 *
 * ⚠️ `terminatesOnSwap` is as meaningful on a toggle as on a window, and for
 * Furina it must stay ABSENT: gcsim's `c.arkhe` is a plain character field that
 * survives swap-out, so the alignment you left in is the one you come back to.
 * Ours is had by omission (the clamp is opt-in) — ⛔ don't add the flag to
 * "tidy up" a state that looks like it should end when she leaves.
 */
type TransientStateCommon = {
	state: State;
	/** Close the window when the owner swaps off-field (Flins: gcsim's
	 *  exit-field hook deletes the symphony status). */
	terminatesOnSwap?: boolean;
	/** Gate on runtime state/constellation — e.g. Varesa's base-form plunge
	 *  opens Apex Drive only at C2 (`{ type: "constellation", level: 2 }`). */
	conditions?: Condition;
	/**
	 * Open at the cast's FIRST LANDING (`CastEvent.firstHitAt`) instead of its
	 * start — gcsim's `AddStatus` inside the hitmark task. Illuga's Oriole-Song
	 * is the case (merged gcsim #2677/#3092 moved it to hitmark 48): the start is
	 * unobservable, but a 20s window measured from the press ENDS 0.8s early.
	 *
	 * ⚠️ `opensTransientState` only (lint): an action-class opener fires at the
	 * action's END by contract (see `actionOpensState`). A cast that states no
	 * landing opens at its start, as before.
	 */
	atFirstHit?: true;
	/** Named states to CLOSE when this window opens (gcsim DeleteStatus on
	 *  the opening action) — a mode commit consumes its entry window and
	 *  displaces the opposite mode (Durin: darkForm consumes transmuting +
	 *  whiteForm). Clamps any open window records at the open instant.
	 *
	 *  ⚠️ On a toggle this fires on the ON edge only — the OFF edge closes the
	 *  state's own window and nothing else. A toggle that had to displace
	 *  something in both directions would be two states, not one. */
	consumes?: State[];
	/**
	 * Close the window at the START of the owner's next simulated ATTACK or CAST
	 * (N, C, P, E, Q) — Lauma's Spirit Envoy form, which "any action but walk or
	 * jump" ends (gcsim `chargeInit`'s `OnActionExec` hook).
	 *
	 * ⚓ Not D and not J (Nate, 2026-09-16): she dashes and jumps IN deer form, so
	 * movement is not an exit. Not a wait, an unset, or a token we skip (`W`)
	 * either — none of those is an input the game could react to. A swap is a
	 * different edge and is `terminatesOnSwap`, authored beside this.
	 *
	 * ⚠️ The close is settled BEFORE the closing action resolves its own ability
	 * (`settleOwnerStates` runs ahead of the state snapshot at every attack and
	 * cast site), so the action that ends the window already sees the world
	 * without it — which is what makes `Lauma C C` read as deer, then Prayer.
	 */
	terminatesOnAction?: true;
	/**
	 * When this window ENDS — by expiry, by `terminatesOnAction`, by a swap, or
	 * by a later opener's `consumes` — open THIS window at that instant, once,
	 * with the same provenance. A cooldown that starts when a form ends, said as
	 * a window that opens when another closes (Lauma: `spiritEnvoy` →
	 * `envoyCooldown`, the 4s during which her `C` is Spiritcall Prayer).
	 *
	 * ⚓ A NAMED state rather than a `cooldown` number, because the thing that
	 * consumes it is a sibling ability's `conditions`, and a condition needs a
	 * name to read. Not nestable: the chained window is `{state, duration}` and
	 * carries no `onEnd` of its own.
	 *
	 * ⚠️ A silent expiry fires nothing, so an expired window's chain is
	 * materialised LAZILY — at the owner's next settle point (attack, cast,
	 * swap-out) or at finalize — with the start it always had (`rec.end`). Every
	 * reader gets the same window; only the instant it was written differs.
	 * ⛔ Refused on a toggle (lint): a toggle has no end.
	 */
	onEnd?: { state: State; duration: number };
};

export type TransientStateSpec =
	| (TransientStateCommon & {
			/** Window length in seconds from the opening action. */
			duration: number;
			toggle?: never;
	  })
	| (TransientStateCommon & {
			/** ⚓ The state flips instead of opening: ON if it is off, OFF if it is
			 *  on. No `duration` — a toggle has no length, only an other edge. */
			toggle: true;
			duration?: never;
	  });

// ---------------------------------------------------------------------------
// Modifiers
// ---------------------------------------------------------------------------

/** Base modifier data shared by cooldown/duration modifiers. */
export type ModifierBase = {
	source: string;
	type: 'percent' | 'flat';
	value: number;
	conditions?: Condition;
	priority?: number;
};

/** Cooldown-specific modifier payload. */
export type CooldownModifier = ModifierBase;

/** Duration-specific modifier payload. */
export type DurationModifier = ModifierBase;

/** Charge-count modifier payload. */
export type ChargeModifier = ModifierBase;

// ---------------------------------------------------------------------------
// Summons
// ---------------------------------------------------------------------------

/**
 * An entity (summon, field, deployable) spawned by an ability with its own
 * lifetime, decoupled from the cast/cancel window.
 *
 * Examples: Fischl Oz, Mona Bubble + Omen, Zhongli stele, Bennett field,
 * Sucrose burst gust, Ganyu lotus. One ability may own multiple summons.
 *
 * When `summons[]` is populated on an ability, the timeline's active-window
 * rendering derives from the summons (one lane per entry). When absent,
 * rendering falls back to the ability's own `duration` (legacy persistent shape).
 *
 * An ability can be `behavior: "instant"` and still own summons — that's the
 * canonical case for "the cast is short but spawns something that persists."
 */
export type Summon = {
	/** Display label (e.g. "Oz", "Stone Stele", "Illusory Bubble"). */
	label: string;
	/** Lifetime in seconds, measured from spawn. Required. */
	duration: number;
	/** Frames (60fps) from cast start until the summon spawns. Defaults to 0. */
	spawnsAt?: number;
	durationModifiers?: DurationModifier[];
	/** Whether the summon stays in place or follows the caster. */
	mobility?: 'stationary' | 'follows';
	/** Conditions that end the summon before its natural duration.
	 *  "swap" — ends when the caster swaps off-field.
	 *  "recast" — ends when the source ability is cast again.
	 *  "skill" / "burst" — ends the instant its owner casts their OTHER ability
	 *  (summon-ends-on-cast round, 2026-09-19): Mavuika's Ring is gone the
	 *  moment she presses Q (gcsim `Burst()` → `enterBike()`, and
	 *  `skillRingTask` returns once the armament is not the ring), Gorou's War
	 *  Banner is destroyed by his burst. ⚠️ At the CAST START, not at a spawn —
	 *  nothing of the terminating cast has to exist yet. Naming the host
	 *  ability's OWN kind is `recast` and lint says so (D.22b). */
	terminatesOn?: 'swap' | 'recast' | 'skill' | 'burst';
	/** Effects emitted by the summon while active. Damage effects with
	 *  `trigger: { type: "summonTick", interval: N }` fire at fixed intervals
	 *  during the summon's lifetime; the timeline renders one marker per tick
	 *  on the summon bar. Other trigger types (onHit, onReaction, etc.) are
	 *  reserved for future P3 extensions and currently unused. */
	effects?: Effect[];
	/** Dynamic event-triggered duration extensions for this summon. Each entry
	 *  describes an event that adds `delta` seconds to the summon's lifetime
	 *  while it's active (e.g. Collei's Cuilein-Anbar zone +1s per dendro
	 *  reaction). Parser dispatch is currently `onCast`-only; other triggers
	 *  are schema-accepted but not yet wired. */
	durationExtensions?: DurationExtension[];
	/**
	 * ⚓ A NAMED STATE THAT LIVES EXACTLY AS LONG AS THIS SUMMON (gcsim sync,
	 * 2026-09-27) — open from its spawn to its end, and closed and reopened by a
	 * recast. Odette is the case: a burst cast onto a standing Dance Double
	 * re-summons it WITHOUT re-granting Marvelous Splendor (gcsim #3020), so her
	 * burst's grants are gated `not` this state.
	 *
	 * ⚓ Why not `duringSummon`: the live stack dispatchers can never NEGATE it
	 * (`liveNegatedStates` — the summon resolvers see stationary summons only and
	 * read a pre-extension uptime), so a `not duringSummon` gate is `null` forever
	 * and the grant never fires. A named state is closed-world like every other.
	 *
	 * ⚠️ Lint refuses it beside an END the opener cannot know at the spawn: a
	 * `terminatesOn` other than `recast`, a `durationExtensions`, or a host with
	 * `summonsFollowState`.
	 */
	opensState?: State;
	/** ⚓ The positive statement that this summon deals and applies NOTHING of
	 *  its own (coverage round, docs/coverage-round.md §5.2) — a taunt, a
	 *  shield gadget, a heal-only field. Read by the coverage page only: a
	 *  summon with no `effects` and no `dealsNothing` reads as a stand-in there
	 *  (its window draws, its ticks may not). ⛔ Not `effects: []`, which means
	 *  "none authored" everywhere else. ⛔ Never beside a `damage` effect
	 *  (lint E.30). */
	dealsNothing?: true;
};

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------

/** Who an effect applies to. Array form expresses compound targets (e.g. ["self", "active"]). */
export type EffectTarget = 'self' | 'team' | 'teamExcludingSelf' | 'active' | 'next' | 'enemy';

/** Base effect payload shared by all effect kinds. */
export type EffectBase = {
	type:
		| 'buff'
		| 'damage'
		| 'heal'
		| 'shield'
		| 'resShred'
		| 'energy'
		| 'cdReset'
		| 'cooldownReduce'
		| 'infuse'
		| 'elevate'
		| 'gainStacks'
		| 'consumeStacks';
	trigger: Trigger;
	conditions?: Condition;
	duration?: number;
	/** How a re-application inside the window behaves. ⚠️ NEVER BRANCHED ON
	 *  (orphaned-schema audit finding #2; ruled 2026-09-22): the engine has ONE
	 *  behaviour — a refresh-merge at the projection (`mergeRefreshedBars`) —
	 *  and `fixed` would need a reader that refuses to extend a live window.
	 *  394 authorings stand as a claim about the game, not the tool; a `fixed`
	 *  reader is a future round, ⛔ not a reason to stop authoring the truth. */
	durationType?: 'refresh' | 'fixed';
	/**
	 * Minimum seconds between procs of this effect. 0 or absent = no cooldown
	 * (procs on every qualifying trigger). Governs re-proc frequency — distinct
	 * from duration, which is how long each proc's buff window lasts. Example:
	 * TTDS — procCooldown: 20, duration: 10. ScaledValue form when it scales by
	 * weapon refinement (e.g. Sacrificial series). NB: this is effect-proc cadence,
	 * NOT elemental-application ICD — see `noICD` / docs/library/game/icd.md.
	 */
	procCooldown?: number | ScaledValue;
	/**
	 * How many times this effect may fire per WINDOW — "up to 15 times per
	 * stance" (Varka's Secret Rite), "a total of 5 times during Musou Isshin"
	 * (Raiden C6). A different axis from `procCooldown`: that says how OFTEN, this
	 * says how MANY, and the count resets when the window it names re-opens.
	 *
	 * ⚓ Designed against the corpus census (cooldown-reduction round, 2026-09-18:
	 * 21 characters, 27 curator notes), which shows FOUR scopes — per stance, per
	 * summon instance, per cast, and a rolling time window (Charlotte A1's "4
	 * times every 12s"). ⛔ `per` admits a member only once a consumer reads it,
	 * so a field never comes to mean four things at once. Today: `'stance'`,
	 * read by the `cooldownReduce` dispatchers — the count lives on the holder's
	 * live stance record and is zeroed when a stance opens (the `extCounts`
	 * precedent). Lint requires `per: 'stance'` to sit under an `inStance`
	 * condition, so there is always a window to count in.
	 */
	procCap?: ProcCap;
	/**
	 * ⚓⚓ THE BUFF EXISTS ONLY WHILE ITS HOLDER IS IN THIS STATE (event-ended
	 * buffs round, 2026-09-21). The drawn window is the INTERSECTION of the
	 * window the trigger and `duration` produce with the holder's `state` windows
	 * of this name — so it can lose its end (a stance cut by a swap), its start
	 * (a status gained before the stance opened), both, or all of itself, and one
	 * window can come back as several pieces.
	 *
	 * ⚓ A DIFFERENT CLAIM FROM A `state` CONDITION, which is an ENTRY TEST: that
	 * asks "was the state up when the trigger fired" and then lets `duration`
	 * run. Three holders needed the other thing. Varka's A1 multiplier is applied
	 * by gcsim at four in-stance sites only, and drew 12s over a 1.22s swap-cut
	 * stance. Skirk's Death's Crossing is a 20s status any teammate's hit grants,
	 * stance or no stance, that only MATTERS in Seven-Phase Flash — the bar is
	 * status ∩ stance, which no entry test can say (the status usually predates
	 * the stance). Illuga's C4 lasts "while Oriole-Song is active", and that
	 * effect ends early when her stack pool is spent.
	 *
	 * ⚠️ The HOLDER's state, never the receiver's. ⚠️ `duration` stays the
	 * effect's own length — it feeds the tooltip, and a clipped end is not a
	 * natural one (no seam is drawn there). ⚠️ Applied as ONE pass at the end of
	 * `deriveBuffWindows`, after every in-place refresh has settled.
	 *
	 * Lint D.45: a buff-like effect with a `duration`, and a state the holder's
	 * own data can OPEN as a `state` window — ⛔ not `duringSummon`, `onField`,
	 * `offField` or the `after*` states, which have no such window.
	 */
	whileState?: State;
	target: EffectTarget | EffectTarget[];
	/** Attribution label for effects collapsed from passives/constellations, e.g. "P2: Harmony Between Heaven and Earth" */
	attribution?: string;
};

/** See `EffectBase.procCap`. */
export type ProcCap = {
	count: number;
	per: 'stance';
};

/** Value payload for buffs, including scaling or capped scaling. */
export type BuffValue =
	| number
	| ScaledValue
	| {
			/** Buff value scales linearly with a stat on the holder. The
			 *  effective contribution at runtime is `(ratio / 100) × stat`,
			 *  optionally clamped to `cap` (in the host stat's units).
			 *
			 *  **Convention: ratio is in PERCENTAGE POINTS, not a decimal
			 *  multiplier.** A 27% ATK buff is authored as `ratio: 27`, not
			 *  `0.27`. A 595.7% HP-to-flat-ATK conversion is `ratio: 595.7`,
			 *  not `5.957`. The renderer displays `~{ratio}% {stat}` directly
			 *  without further scaling, so percentage-form authoring matches
			 *  what users see in tooltips. (Historically the renderer applied
			 *  a `* 100` multiplier assuming decimal-form authoring, but most
			 *  of the corpus authored in percentage form anyway, so the
			 *  formatter was corrected and the lone decimal-form holdout —
			 *  Bennett's burst attackBuff — was migrated to match.) */
			type: 'scaling';
			stat: Stat;
			ratio: number | ScaledValue;
			cap?: number;
			/** ⚓ THE THRESHOLD the stat must EXCEED before the buff scales at all
			 *  — "+1% per 100 ATK **above 1,000**", "+0.6% per 1% HP **above 30%**
			 *  Max HP", "+0.4% per 1% ER **above 100%**". In the host stat's own
			 *  units, so the contribution is `(ratio / 100) × max(0, stat − offset)`.
			 *
			 *  ⚠️ Omitting it on a kit that states one is a real OVER-CLAIM, not a
			 *  rounding error: Arlecchino at exactly 1,000 ATK would read +10% where
			 *  the true value is 0. That is why the seven corpus holders below were
			 *  left UNAUTHORED rather than authored without it.
			 *
			 *  Known holders (2026-08-31 census): Arlecchino (ATK > 1000),
			 *  Neuvillette (HP% > 30), Prune (ATK > 2000), Raiden (ER > 100%),
			 *  Nahida (EM > 200), Nefer (EM > 500), Zibai (pts > 70),
			 *  Odette (ATK > 1000). ⛔ Not speculative — added with eight consumers.
			 *  ⚓ Baizhu's "each 1,000 Max HP that does NOT exceed 50,000" looks like
			 *  the mirror shape (a ceiling on the INPUT) but needs nothing new: the
			 *  scaling is linear through the origin, so capping the OUTPUT at
			 *  `(50000 / 1000) × ratio` is arithmetically identical. `cap` already
			 *  expresses him, and he is the corpus's only instance of that phrasing.
			 *  ⛔ Don't mint an input-ceiling field for it. */
			offset?: number;
	  }
	| {
			/** Value exists but depends on runtime inputs (e.g. a character's ER or energy cost) that the planner cannot resolve. The description is shown verbatim in tooltips. */
			type: 'unknown';
			description: string;
	  }
	| {
			/** Buff value ramps up over time from startValue by stepValue every stepInterval seconds, capping at cap. */
			type: 'ramping';
			startValue: number;
			stepValue: number;
			stepInterval: number;
			cap?: number;
	  }
	| {
			/** Buff value decays linearly from `startValue` to `endValue` (default 0)
			 *  over the host effect's `duration`. Inverse of `ramping`.
			 *
			 *  Use this for post-cast buffs that ramp DOWN to nothing within their
			 *  buff window (Mavuika A4 Kiongozi: per-FS-point allDmgBonus decaying
			 *  linearly to 0 over 20s post-burst).
			 *
			 *  The renderer shows a gradient bar — full opacity at decay start,
			 *  dim at decay end — mirroring the existing `ramping` gradient in
			 *  reverse. Active-target segmentation picks up the gradient at the
			 *  correct decay progress for each on-field window.
			 *
			 *  v1 supports a plain-numeric `startValue`. Composing decaying with
			 *  perStack (per-FS-point peak that then decays — Mavuika A4 actually
			 *  scales 0.2% allDmgBonus per FS consumed, max 40%) is not yet
			 *  expressible; author at the max-stack peak with caveat. Future v2
			 *  would either nest a `BuffValue` as the start, or extend `perStack`
			 *  with a `decayingTo` field. */
			type: 'decaying';
			startValue: number;
			endValue?: number;
	  }
	| {
			/** Buff value scales linearly with user-asserted stack count for a named
			 *  resource. Resolved at render time against the cast's `stackContext`
			 *  snapshot (TimelineBar.stackContext, populated by the parser when the
			 *  user asserts stacks via the `{key:N}` notation token).
			 *
			 *  Effective stacks = min(max(stacks - (threshold ?? 0), 0), maxStacks ?? Infinity).
			 *  Effective value = effectiveStacks * per.
			 *
			 *  Pair with `conditions: { type: "stacks", key, min: (threshold ?? 0) + 1 }`
			 *  so the buff bar only renders on casts that have at least one
			 *  contributing stack above the threshold.
			 *
			 *  Two `per` forms:
			 *  - **Plain number** — percentage points or flat numbers in the unit
			 *    of the host `stat` (Heizou Declension +4% CR/stack, Yanfei Seal
			 *    +5% pyroDmgBonus/stack).
			 *  - **Scaling object** `{ stat, ratio }` — per-stack stat scaling
			 *    (Kinich A4 Hunter's Experience: 320% ATK FlatDmg/stack on
			 *    Scalespiker Cannon; Mavuika Sunfell Slice: per-FS-point ATK
			 *    FlatDmg). Renders like the standard `scaling` BuffValue but
			 *    multiplied by stack count.
			 *
			 *  Optional `threshold` (E3 v2.x): an offset subtracted from the
			 *  stack count before clamping. Used for "bonus per resource over N"
			 *  shapes — Skirk Havoc: Ruin gains +1% burst DMG per Serpent's
			 *  Subtlety above 50 (max +12 at C0, +22 at C2). When the resource
			 *  is at-or-below the threshold, effective stacks are 0 and the
			 *  buff contributes nothing; pair with a `stacks` condition so the
			 *  bar suppresses entirely instead of rendering a +0% line.
			 *
			 *  Optional `cap` (E3 v2.x): caps the FINAL contribution (after
			 *  per×stacks). For plain-number `per`, the cap is in the same
			 *  unit as the host `stat` (percent for `atk%`, points for `critRate`,
			 *  etc.) and the renderer clamps the displayed value. For scaling
			 *  `per: { stat, ratio }`, the cap is in the host stat's unit
			 *  (typically flat ATK / HP / etc.) and the renderer can't clamp
			 *  without the recipient's stat values, so it appends a `(cap N)`
			 *  suffix to the display label. Mirrors `scaling.cap` semantics. */
			type: 'perStack';
			key: string;
			per: number | { stat: ScalingStat; ratio: number };
			maxStacks?: number;
			threshold?: number;
			cap?: number;
	  }
	| {
			/** Buff value scales with the party's count of a faction or element —
			 *  effective value = min(count × per, cap ?? Infinity). Resolves against
			 *  the same team-composition context as `teamFaction` / `teamElementCount`
			 *  conditions (team is fully known at planner time).
			 *
			 *  - `count.faction` — party faction *level* (members + factionContributions,
			 *    per computeTeamFactionCounts): e.g. per Hexenzirkel member.
			 *  - `count.elements` — NON-HOLDER teammates whose element is in the list
			 *    (exclude-self, mirroring `teamElementCount`): Zibai A4 +15% DEF per
			 *    Geo ally (cap +45%).
			 *
			 *  Display renders the per-member formula ("+15%/Geo ally, cap +45%");
			 *  live × count resolution against the loadout is a renderer follow-up. */
			type: 'perTeamCount';
			count: { faction: string } | { elements: Element[] };
			per: number;
			cap?: number;
	  };

/** Full effect union used by the gold-standard model. */
export type Effect =
	| (EffectBase & {
			type: 'buff';
			source: 'character' | 'weapon' | 'artifact';
			stat: Stat;
			value: BuffValue;
			snapshottable: boolean;
			stacks?: {
				maxStacks: number;
				durationModel: 'shared' | 'separate';
			};
			constellationScaling?: {
				conditions: Condition;
				value: BuffValue;
			};
			/**
			 * ⚓ HOW LONG THE RECEIVER MUST HAVE BEEN ON FIELD before this buff
			 * lands (Nicole, 2026-08-18) — "after the observed character has
			 * remained on the field for 3s, their Grace of Kenosis is upgraded".
			 *
			 * ⚠️ ONLY MEANINGFUL ON `target: 'active'`, because a per-receiver
			 * slice is the one scope where "how long have YOU been on field" is a
			 * question with an answer — the same structural claim `activeCharFaction`
			 * and `weaponType` make. The delay shifts each on-field segment's START
			 * and leaves the buff's own end alone, so a receiver who swaps in with
			 * less than `seconds` of the window left gets nothing at all, which is
			 * the mechanic. characterLint B.14 enforces the target.
			 *
			 * ⚓⚓ THE WAIVER IS PART OF THE FIELD, NOT A SECOND EFFECT, and that is
			 * forced rather than chosen: the active-target pass dedupes by `stat`
			 * before it ever reaches per-segment evaluation, so a Hexerei copy and a
			 * non-Hexerei copy of the same +300 ATK would collapse to whichever was
			 * authored first. ⛔ Don't re-try the two-effect pattern
			 * `activeCharFaction` recommends for a pair that shares a stat.
			 *
			 * ⚠️ It is a DELAY, not a ramp: the value is full the moment it lands.
			 */
			onFieldDelay?: {
				/** Seconds on field before the buff applies. */
				seconds: number;
				/**
				 * When the wait does not apply at all.
				 *
				 * ⚓ A `Condition`, not a bespoke key, because the two waivers this
				 * mechanic has are already in that vocabulary and COMPOSE: Nicole's
				 * Methexis upgrades a Hexerei character straight away
				 * (`activeCharFaction`) and upgrades everybody straight away at C6
				 * (`constellation`), which is one `any` of the two.
				 *
				 * ⚠️ Evaluated in the PER-SEGMENT scope, so `activeCharFaction` names
				 * the RECEIVER — the same scope note `weaponType` carries. An
				 * unresolvable condition does NOT waive (the wait stands), because a
				 * delay that vanishes when we cannot answer would over-claim uptime.
				 * ⚠️ It is a property of the receiver, not a team count: gcsim checks
				 * a bare `char.IsHexerei` with no `GetHexereiCount()` gate, so a lone
				 * Hexerei teammate still skips the wait. ⛔ Not `teamFaction`.
				 */
				waivedWhen?: Condition;
			};
			// canonicalAssumption was retired 2026-07-20 (cA-fold): it was used
			// by 2 characters, its headlineValue always duplicated `value`, and
			// its caveat never gained a render surface. Canonical-rotation
			// assumptions are now stated in the ability-level `caveat`
			// ("Assumes X." per docs/curation/caveat-style-guide.md), matching
			// the Mavuika-A4 authoring pattern the rest of the corpus uses.
	  })
	| (EffectBase & {
			type: 'damage';
			scaling: number | ScaledValue;
			stat: ScalingStat;
			element?: Element;
			/** Optional literal flat addend co-located with the scaling source. The
			 *  effective per-hit damage is `scaling% × stat + flat` (gcsim's
			 *  AttackInfo.FlatDmg). Use for talent-table flat damage that's tabulated
			 *  alongside the % scaling — Jahoda burst-tick base, etc. For stat-scaled
			 *  flat addends (Aino A4: +50% of Aino's EM as flat DMG) use
			 *  `flatScaling`; when both are present they sum. */
			flat?: number;
			/** Optional stat-scaled flat addend co-located with the scaling source.
			 *  The effective per-hit damage becomes
			 *  `scaling% × stat + flat + flatScaling.ratio% × flatScaling.stat`
			 *  (gcsim's `FlatDmg = c.Stat(flatScaling.stat) * flatScaling.ratio/100`
			 *  shape). Use for EM-scaling flat addends like Aino A4
			 *  (+50% of Aino's EM as Hydro flat DMG on every burst tick). `ratio`
			 *  is expressed as a percent of the source stat (50 = +50% of EM),
			 *  matching the `scaling` field's percent convention. */
			flatScaling?: { stat: ScalingStat; ratio: number };
			/**
			 * ⚓⚓ WHEN THIS EFFECT'S HITS LAND AND WHAT THEY APPLY — the FOURTH
			 * source of elemental applications (mark-triggered round, 2026-08-17).
			 * `frame` is relative to the TRIGGER, not to a cast.
			 *
			 * The gauge is fed from a cast's own `application[]`, an N/C/P swing, a
			 * summon tick series — and, since this round, a `damage` effect on an
			 * `onReaction` trigger: damage emitted by an OFF-FIELD character because
			 * somebody else caused a reaction. Nahida's Tri-Karma Purification
			 * (Dendro, **1.5U**, +3 frames) and Fischl's A4 Thundering Retribution
			 * (Electro, 1U, +4 frames) are the two.
			 *
			 * ↻ **TWO MORE TRIGGERS READ IT SINCE 2026-08-18** (the coordinated-attack
			 * round), and they are the same idea reached from two other directions:
			 * `whileNormalAttacking` (a wave fired because the ACTIVE character is
			 * swinging — Xingqiu, Yelan, Thoma, Fischl C6) and `onHit` (a proc fired
			 * because the opponent TOOK damage — Albedo, Beidou, Dehya, Raiden,
			 * Nicole). ⚓ In every case the sentence is the same: this effect's own
			 * hits land `frame` frames after the thing that triggered it. All four
			 * readers are `sim/procs.ts`.
			 *
			 * ⚠️⚠️ THE ABSENT CASE IS NOT THE ABILITY'S. On an ability, an absent
			 * `application[]` means UNMEASURED and falls back to the character's
			 * element at the cast (see {@link SkillCommonFields.application}). Here
			 * it means this effect does not reach the aura, which is the status quo
			 * for every other `damage` effect in the corpus — a summon's ticks reach
			 * it through the summon-tick path, not through this field.
			 *
			 * ⚓ The word and the type are shared with the ability-level field on
			 * purpose: one vocabulary for "what lands and when". ⚠️ The cost is that
			 * `orphanedSchema.test.ts` matches by KEY NAME and so cannot see this
			 * field independently (the L5e-a¾ lesson) — the wiring is pinned by
			 * `reactionProcs.test.ts` instead.
			 */
			application?: ElementalApplication[];
	  })
	| (EffectBase & {
			type: 'heal';
			scaling: number | ScaledValue;
			stat: ScalingStat;
			/** Optional literal flat addend co-located with the scaling source. The
			 *  effective per-tick heal is `scaling% × stat + flat`. Use for talent-
			 *  table flat heal that's tabulated alongside the scaling — Jahoda Robot
			 *  heal-tick base (~1102 at lvl=10), Linnea Q heal flat portions. For
			 *  stat-scaled flat addends use `flatScaling`; when both are present
			 *  they sum. */
			flat?: number;
			/** Optional stat-scaled flat addend co-located with the scaling source.
			 *  Same shape as DamageEffect.flatScaling — sums with `flat`. `ratio`
			 *  is a percent of the source stat (50 = +50% of EM). */
			flatScaling?: { stat: ScalingStat; ratio: number };
	  })
	| (EffectBase & {
			type: 'shield';
			scaling: number | ScaledValue;
			stat: ScalingStat;
			/** Optional literal flat addend co-located with the scaling source —
			 *  same semantics as heal's `flat` (`scaling% × stat + flat`). Added
			 *  2026-07-12 after three curation agents independently had to drop
			 *  talent-table flat absorption (Diona +1524, Thoma +1525, Yun Jin
			 *  +2542 at talent level 10). */
			flat?: number;
			/** The shield's in-game NAME — "Curtain of Slumber", "Jade Shield",
			 *  "Stone Armor". Rendered as the shield lane's row label; absent
			 *  falls back to a plain "Shield", which is right for the kits whose
			 *  shield genuinely has no name (Xinyan, Diona, Baizhu).
			 *
			 *  ⚓ 2026-08-14. Before this, the name lived on the stand-in
			 *  `summons[]` entry — so the nine shields authored that way were
			 *  named and the six authored as a plain Effect all read "Shield".
			 *  ⛔ Do not invent one: a wrong name reads as fact, and the fallback
			 *  is honest. Take it from the talent text or leave it off. */
			label?: string;
	  })
	| (EffectBase & {
			type: 'resShred';
			/** Which enemy stat this debuff reduces. Default `'res'` (elemental
			 *  resistance — the historical meaning; omit to keep it). `'def'` is a
			 *  flat DEF reduction (Durin White-form −30% enemy DEF, Nightsoul kits'
			 *  DEF shred): element-agnostic, so `element` MUST be omitted when
			 *  `shredStat: 'def'`. Distinct from attacker-side DEF *ignore* (the
			 *  `defIgnore` Stat), which reduces DEF only for its recipients. */
			shredStat?: 'res' | 'def';
			element?: Element;
			value: number;
	  })
	| (EffectBase & {
			type: 'energy';
			amount: number;
	  })
	| (EffectBase & {
			type: 'infuse';
			element: Element;
	  })
	| (EffectBase & {
			type: 'cdReset';
			source: 'weapon' | 'character';
			// The trigger encodes WHICH cast fires the reset (`trigger.type ===
			// "onCast"` only). The optional `resets` field encodes WHICH ability's
			// CD is reset; when omitted, defaults to `trigger.ability` (the
			// Sacrificial-weapon convention where the firing ability is also the
			// reset target). For character resets where firing ≠ reset target
			// (Kazuha C1: Q resets E), set `resets` explicitly.
			//
			// `source: "weapon"` is used by the Sacrificial weapon series (proc on
			// skill hit, refunds the skill charge). `source: "character"` is used
			// by character-intrinsic resets — Kazuha C1 (Q resets E), etc. The
			// parser handles both: weapon procs use the weapon's procCooldown;
			// character cdReset fires unconditionally on every matching cast (no
			// procCooldown).
			resets?: 'skill' | 'burst';
			/** ONE named ability's queue, instead of every queue of `resets`'s
			 *  kind. ⚓ Needed the moment a character has TWO skill queues and a
			 *  reset that reaches only one: Varka's C1 hands back a Four Winds'
			 *  Ascension use at stance entry (gcsim `c1OnSkill`:
			 *  `ResetActionCooldown(ActionSpecialSkill)`) while Windbound
			 *  Execution's own 16s clock, written by the same cast, stays put.
			 *  ⚠️ A skill-fired reset of `resets: "skill"` MUST name this (lint
			 *  B.10b) — an unnamed one would refund the very cast that fired it.
			 *  A skill-fired reset lands at the firing cast's COOLDOWN CLOCK
			 *  start (`cooldownStartDelay`), which is where gcsim's stance-entry
			 *  block runs; a burst-fired one keeps its cast-end instant. */
			resetsAbility?: string;
	  })
	| (EffectBase & {
			/** A fixed number of seconds off a cooldown that is RUNNING — gcsim's
			 *  `ReduceActionCooldown`. Distinct from `cdReset`, which refunds the
			 *  charge outright.
			 *
			 *  ⚓ READ SINCE THE COOLDOWN-REDUCTION ROUND (2026-09-18,
			 *  `sim/cooldownReduce.ts`) — it was declared 2026-07 with no consumer,
			 *  and `orphanedSchema.test.ts` could not see that because the key is a
			 *  `type` VALUE, not a property. Three triggers dispatch it: `onHit`
			 *  (Varka's Secret Rite, Raiden C6, Kujou Sara C1), `onCast` (Itto C2)
			 *  and `onReaction` (Dori A1). `target` says WHOSE cooldown moves —
			 *  `self`, `team` or `teamExcludingSelf` (Raiden C6 reaches everyone
			 *  but her). `procCooldown` and `procCap` gate the fires.
			 *
			 *  ⚓⚓ THE SKILL IT MOVES IS THE ONE ACTIVE AT THE FIRE. A `reduces:
			 *  'skill'` resolves the receiver's skill through `resolveActiveAbility`
			 *  at the trigger's instant, so a state-gated sibling is reached without
			 *  naming it: Varka's in-stance hits land on Four Winds' Ascension
			 *  because in Sturm und Drang the skill IS Four Winds — the same
			 *  redirection gcsim writes as a `ReduceActionCooldown` override on
			 *  Varka, Odette and Cyno. ⛔ Never an ability id here. ⚠️ An effect
			 *  HOSTED on a skill ability reduces that skill and nothing else, so
			 *  a reduction that belongs to one sibling (Secret Rite → Four Winds)
			 *  is authored on it and cannot drift to the base skill in a party
			 *  where the sibling never resolves.
			 *
			 *  ⚠️ What moves: the earliest charge still recharging, and every
			 *  charge chained behind it by the same amount (charges recharge one at
			 *  a time, so they are one chain) — and the cast's ghost tail with it,
			 *  or the chart and the parser disagree about when the ability is
			 *  castable. A reduction larger than what remains is a reset; a
			 *  cooldown that is not running is left alone (gcsim's early return).
			 *
			 *  ⛔ Not this: a per-stack amount (Navia C1, Beidou A4 — no shape yet),
			 *  a coin flip (Ayaka C1's 50% — a chance modelled as certain is a fake),
			 *  "every Nth hit" (Noelle A4, Sucrose C4), and a defeat (Charlotte A1). */
			type: 'cooldownReduce';
			source: 'character';
			/** Seconds to subtract from the remaining cooldown. */
			amount: number;
			/** Whose cooldown, on each receiver named by `target`. Required unless
			 *  the trigger is an `onCast` with its own `ability`, which then names
			 *  it (the `cdReset` convention). */
			reduces?: 'skill' | 'burst';
	  })
	| (EffectBase & {
			/** Multiplicative per-attack DMG bonus tier, distinct from reaction-bonus
			 *  stat keys. Maps to gcsim's `atk.Info.Elevation += value/100` — the
			 *  damage formula applies it as `damage *= (1 + elevation)` after the
			 *  EM/reaction bracket. The `reactions` filter scopes the elevation to
			 *  damage instances tagged with one of the named reactions; each entry
			 *  covers both the direct hit (AttackTagDirect*) and the reaction-trigger
			 *  (AttackTagReaction*) sub-tags in gcsim's taxonomy.
			 *
			 *  Use cases: Flins C6 (+35% Lunar-Charged self, +10% team Moonsign),
			 *  Lauma C6 (+25% Lunar-Bloom team Moonsign), Linnea C6 (+25% Lunar-
			 *  Crystallize team Moonsign), Nefer C6 (+15% Lunar-Bloom self Moonsign).
			 *
			 *  Renderer treatment: rendered as a buff bar via display-stat mapping
			 *  (single-reaction → matching `lunar*DmgBonus` synthetic stat for
			 *  formatting/de-dup). Multi-reaction arrays are reserved for future
			 *  cases (Columbina "all lunar reactions") and not yet rendered. */
			type: 'elevate';
			source: 'character' | 'weapon' | 'artifact';
			reactions: Reaction[];
			value: BuffValue;
			snapshottable: boolean;
	  })
	| (EffectBase & {
			/** Grants stacks of a named resource when the trigger fires. The parser
			 *  walks the rotation and accumulates per-character stack state, feeding
			 *  the existing `stacks` Condition + `perStack` BuffValue plumbing.
			 *
			 *  Distinct from the user-asserted `{key:N}` notation token: gainStacks
			 *  declares "the rotation generates these stacks automatically" (Linnea
			 *  E grants 6 Field Catalog stacks per cast). The notation token remains
			 *  for stacks the planner can't infer (Heizou Declension, Yanfei Seals —
			 *  counts that depend on action history beyond what the parser models).
			 *
			 *  Stack state is per-character and, by default, per-SEGMENT — it
			 *  resets when the holder swaps out, matching the assertion-form reset
			 *  semantics. ↻ A key can now say otherwise: see `scope` below. Cap is
			 *  saturating: gainStacks beyond `max` clamps the count.
			 *
			 *  `onCast`, `onReaction`, and `onHit` triggers all dispatch
			 *  parser-side. onHit fires per E/Q cast AND per action hit (normal
			 *  swing / charged / plunge) since the onHit wiring (2026-07-17);
			 *  `source: 'self'` grants are per-segment (a swap clears them —
			 *  Yanfei's Scarlet Seals), team/others grants accrue rotation-wide
			 *  and require a decay shape (lint `gainstacks-onhit-unbounded`).
			 *
			 *  v2 adds the optional `drain` field for continuous-rate decay while
			 *  a named state is active (Iansan Nightsoul: 6/sec while
			 *  `nightsoulBlessing`; Skirk Serpent's Subtlety: 7/sec in Seven-Phase
			 *  Flash stance — Skirk authoring deferred pending variant gating).
			 *  Convention: declare `drain` on the FIRST gainStacks effect that
			 *  introduces the key. Follow-up grants on the same key (Iansan's Q
			 *  +15) omit the field — the parser looks up the drain spec by key,
			 *  so duplicating it would create a contradiction risk.
			 *
			 *  Reference: Linnea C1 Field Catalog (E cast → +6 stacks, max 18);
			 *  Iansan E Nightsoul (cast → +54 stacks, drain 6/sec while NS). */
			type: 'gainStacks';
			/** Resource key — must match the consumer `stacks` Condition `key`
			 *  and `perStack` BuffValue `key`. */
			key: string;
			/** Stacks added per trigger fire. Whole numbers expected; can be > 1
			 *  for batch grants (Linnea +6 per E, enhanced +18 at C6). */
			amount: number;
			/** Saturating cap on total stack count. Stacks beyond this clamp at
			 *  `max`. Optional — when absent, the resource grows unbounded. */
			max?: number;
			/** Where the resource LIVES (summon-tick stacks round, 2026-08-31).
			 *
			 *  ⚓⚓ A STACK KEY NAMES A RESOURCE, AND A RESOURCE EITHER SURVIVES A
			 *  SWAP OR IT DOES NOT. `'segment'` (the default, and every corpus key
			 *  but one) is a pool the holder carries while on field: it resets when
			 *  they swap out, which is the modelled behaviour for Yanfei's Scarlet
			 *  Seals and Heizou's Declension. `'rotation'` is a resource that keeps
			 *  its own clock regardless of who is on field — Alyosha's Hunter's
			 *  Mark is a state on the OPPONENT, so `N4 > Fischl E > E` must find the
			 *  mark still there, and so must a maul from Tugarin landing while
			 *  Alyosha is benched.
			 *
			 *  ⚠️ Declared on EVERY gainStacks effect for the key, and they must
			 *  AGREE (lint D.39). ⛔ NOT the `drain` convention of declaring once on
			 *  the first grant: `drain` is a spec with values that could drift, this
			 *  is one enum whose disagreement a lint can catch outright — while its
			 *  OMISSION on a grant is invisible, and would silently revert the key to
			 *  `'segment'` the day the declaring effect is edited away.
			 *  `consumeStacks` never declares it: a key has ONE home, and the
			 *  consume side resolves it from the grants that named it.
			 *
			 *  ⚠️⚠️ It is NOT `trigger.source`. That field says who may FIRE the
			 *  effect (`'team'`/`'others'` grants already accrue rotation-wide
			 *  because the holder may be off field when the trigger lands); this one
			 *  says where the stacks THEMSELVES live, and the two are independent —
			 *  Hunter's Mark is `source: 'self'` and rotation-scoped.
			 *
			 *  ⚓ A rotation-scoped key is stored on the holder's `CharState` and
			 *  MIRRORED into the live segment pool at every settle point, so every
			 *  existing read (`cast.stackContext`, `hit.stacks`, a `stacks`
			 *  Condition) is unchanged — the scope decides the container, never the
			 *  reader. It is also the one scope a SUMMON TICK can dispatch into: a
			 *  tick fires while its owner may be off field, i.e. inside another
			 *  character's segment, where a segment-scoped pool does not exist.
			 *
			 *  Reference: Alyosha `huntersMark` (the only corpus author). */
			scope?: 'segment' | 'rotation';
			/** Continuous-rate decay applied to the named resource while `state`
			 *  is active for the holder. Drains apply lazily at every cast event
			 *  (decay = ratePerSecond × elapsed-since-last-update); when a cast
			 *  occurs after the state has ended, drain settles up to the state's
			 *  end time so post-state snapshots reflect the final value.
			 *
			 *  Declare on a single gainStacks effect per key — the parser looks
			 *  up the drain spec by key when computing decay. Follow-up grants
			 *  on the same key (e.g. Iansan Q +15) leave this absent. */
			drain?: {
				/** Stacks lost per second while `state` is active. Must be > 0. */
				ratePerSecond: number;
				/** Holder state that gates the drain (e.g. `nightsoulBlessing`,
				 *  `inStance`). Drain pauses when the state is inactive. */
				state: State;
			};
			/** Per-stack lifetime in seconds (E3 v2.x). When set, each granted
			 *  instance lives independently for `lifetime` seconds before
			 *  expiring. The parser maintains a parallel per-stack-instance
			 *  expiry list and updates `stackState[key]` to the count of
			 *  unexpired instances at every cast event (lazy expiry, no
			 *  continuous simulation).
			 *
			 *  Distinct from `drain` (continuous-rate decay, e.g. 6/sec): with
			 *  lifetime, each individual stack disappears at a fixed time after
			 *  it was granted, so a +6 grant followed by a +6 grant 5s later
			 *  produces 12 stacks at t=5, 6 stacks at t=11 (the first batch
			 *  expired), and 0 at t=16. Reference: Linnea C1 Field Catalog
			 *  (each stack lasts 10s; max 18; 6 granted per E cast).
			 *
			 *  Saturation: when adding `amount` instances would push the
			 *  total over `max`, the OLDEST instances are dropped first
			 *  (matching the in-game "refresh the pool" behavior — the new
			 *  grant always lands).
			 *
			 *  Mutual exclusion with `drain`: a single key cannot have both —
			 *  the two decay shapes are incompatible. Lint enforces. */
			lifetime?: number;
			/** The SHARED duration model (stack-count display round, 2026-09-19):
			 *  a grant resets EVERY live instance's expiry to `now + lifetime`,
			 *  so the stacks rise one at a time and fall together. Columbina's
			 *  Lunacy is the holder — gcsim's `a1OGravityTick` is `CR = 0.05 ×
			 *  min(stacks, 3)` on ONE 10s status every Interference refreshes.
			 *  Absent is the per-instance model (`lifetime`'s own doc: Linnea's
			 *  stacks each die 10s after THEIR grant). Only meaningful beside
			 *  `lifetime` (lint B.13f2). */
			lifetimeRefresh?: true;
			/** Conditional override of `amount` (E3 v2.x). Mirrors
			 *  `BuffEffect.constellationScaling`: when `conditions` evaluates
			 *  definitively true (typically `{ type: 'constellation', level: N }`),
			 *  the override `amount` replaces the base `amount` for the dispatch.
			 *  All other fields (`max`, `lifetime`, `drain`) carry through
			 *  unchanged — only the per-fire grant count changes.
			 *
			 *  Reference: Linnea C6 enhances the C1 Field Catalog grant from
			 *  +6 per E to +18 (max-out) per E. */
			constellationScaling?: {
				conditions: Condition;
				amount: number;
			};
			/** Per-source slot expiry in seconds (E3 v2.x). Distinct from
			 *  `lifetime` (per-grant) and `drain` (continuous rate). When set,
			 *  the parser maintains `Map<key, Map<sourceCharId, expiryTime>>`
			 *  rotation-wide for this character: each contributing source
			 *  occupies one slot until their timer expires; same-source
			 *  re-trigger refreshes their slot rather than adding a new stack.
			 *  Stack count = number of unexpired entries.
			 *
			 *  Mutually exclusive with both `lifetime` and `drain` — the three
			 *  decay shapes describe non-overlapping mechanics:
			 *    - drain: continuous decay rate on the holder's resource
			 *    - lifetime: per-grant discrete expiry (Linnea fieldCatalog)
			 *    - sourceLifetime: per-source-slot expiry with refresh-on-same-
			 *      source (Skirk A4 Death's Crossing — each non-Skirk teammate
			 *      occupies one slot for 20s after dealing Cryo/Hydro damage).
			 *
			 *  Cross-segment: sourceLifetime state is rotation-global, not per-
			 *  segment. The holder's per-segment `stackState[key]` is synced at
			 *  the start of each cast handler to reflect the current unexpired
			 *  slot count, so downstream `stacks` Conditions evaluate uniformly
			 *  whether the resource was granted by gainStacks or sourceLifetime.
			 *
			 *  Pairs with `trigger.source: 'others'` on the gainStacks effect
			 *  to filter for non-self contributions (Skirk's own Cryo doesn't
			 *  count toward Death's Crossing). */
			sourceLifetime?: number;
			/**
			 * ⚓ CONTINUOUS ACCRUAL (stack-threshold round, exact model, 2026-09-18).
			 * When present, `amount` is a RATE — stacks per second — and a trigger
			 * fire does not add it: it opens, or refreshes, a `window`-second
			 * status shared per holder across every key of the same `group`, and
			 * while the status is live the key the LAST fire named gains `amount`
			 * per second in 0.05 s polls (gcsim's `QueueCharTask(..., 0.05*60)`).
			 * Columbina's Gravity: any party Lunar reaction opens/refreshes a 2 s
			 * status; 10 per second into the last reaction's kind; +34% at C2 via
			 * `constellationScaling` (which scales the RATE here, since it replaces
			 * `amount`).
			 *
			 * ⚓ A Lunar-Charged TICK refreshes it too — gcsim's hook is on any
			 * Lunar-tagged damage — so the sim feeds the gauge's `ecTick` events
			 * to accrual grants whose reaction matches the party's converted EC.
			 *
			 * ⛔ Not with `procCooldown`, `lifetime`, `drain` or `sourceLifetime`,
			 * and only on an `onReaction` grant with `source: 'team'` (a tick has
			 * no trigger character) — lint B.13k. See `sim/accrual.ts`.
			 */
			accrual?: {
				/** Keys sharing one status on the holder. */
				group: string;
				/** Seconds the status lives after each fire. */
				window: number;
			};
	  })
	| (EffectBase & {
			/** Removes stacks of a named resource when the trigger fires. The
			 *  parser walks the cast event, decrements `stackState[key]` by
			 *  `amount` (or zeroes it for `'all'`), and clamps at 0. Called AFTER
			 *  the cast's stackContext snapshot is taken so the bar reflects the
			 *  pre-consumption value the consumer (`perStack` BuffValue) needs
			 *  to compute its bonus.
			 *
			 *  v1 dispatch supports `onCast` triggers only — symmetric with
			 *  `gainStacks`. Reference: Skirk Havoc: Ruin (out-of-stance Q
			 *  consumes ALL Serpent's Subtlety after the burst-DMG bonus is
			 *  computed from the pre-consume count).
			 *
			 *  Authoring convention: place the `consumeStacks` effect on the
			 *  same ability whose cast does the consuming (gating via the
			 *  ability's own `conditions` field handles in-stance vs
			 *  out-of-stance variants — Skirk's Havoc: Extinction is a
			 *  separate Q ability gated on `inStance`, so its absence of a
			 *  `consumeStacks` effect models the "in-stance burst doesn't
			 *  consume SS" rule cleanly). */
			type: 'consumeStacks';
			/** Resource key — must match a `gainStacks.key` somewhere in the
			 *  character's effects. */
			key: string;
			/** Stacks removed per trigger fire. Use `'all'` to zero the resource
			 *  regardless of count (Skirk's Q out-of-stance shape). Numeric
			 *  amounts subtract and saturate at 0. */
			amount: number | 'all';
			/**
			 * ⚓ CLOSE THIS STATE OF THE HOLDER'S WHEN THE SPEND LEAVES THE KEY AT
			 * ZERO (event-ended buffs round, 2026-09-21) — "when all stacks of
			 * Nightingale's Song have been consumed … the Haunted Night's
			 * Oriole-Song effect will end" (gcsim: `if c.nightingalesSong < 1 {
			 * c.DeleteStatus(burstKey) }`). The state's window is clamped at the
			 * hit's instant, and whatever is bound to it (`whileState`) ends there.
			 *
			 * ⚠️ `onHit` consumes only (lint D.46): the cast-side consume
			 * dispatcher has no holder asking for it, and ⛔ a field admits a reader
			 * only with its consumer.
			 */
			closesStateWhenEmpty?: State;
	  });

// ---------------------------------------------------------------------------
// Frame timing
// ---------------------------------------------------------------------------

/**
 * Keys representing the action that follows a cast — used to look up the
 * correct cancel window. "swap" is the fallback (full animation, no cancel).
 * Hitlag and attack speed are not modelled at this level.
 */
export type ActionKey = 'N' | 'C' | 'E' | 'Q' | 'D' | 'J' | 'P' | 'swap';

/**
 * Per-next-action frame durations (60fps integers) — gcsim's two slice
 * constructors, transcribed.
 *
 * ⚓⚓ THE FALLBACK IS `anim`, NOT `swap` (gauge-round L4b, 2026-08-16). gcsim
 * builds an action's cancel table by filling EVERY slot with the animation
 * length and then applying overrides, of which `ActionSwap` is merely one — and
 * frequently one of the shortest. Our schema kept the override and threw away the
 * default, so every absent key resolved to the swap window: measured, a charged
 * attack after a normal was timed **22 frames early in 266 of 297 maps**.
 *
 * Resolution order, and `frameAt()` in `$lib/utils/frames.ts` is the ONLY place
 * that implements it:
 *
 *     explicit key  →  `hit` (for E, Q, D, J, swap)  →  `anim`
 *
 * ⚓ `hit` is `InitNormalCancelSlice`'s hitmark, and it exists because a normal
 * swing is fully described by two numbers: everything cancels at the hitmark
 * except another normal, a charge and a plunge, which wait out the animation.
 * `{ "anim": 35, "hit": 24 }` is the whole of Yoimiya's N1. ⛔ An E/Q slice has no
 * such tier — `InitAbilSlice` takes one number — so `hit` there is a lint error.
 *
 * ⚠️ `P` sits in the `anim` tier, not the `hit` tier: `InitNormalCancelSlice`
 * does not override `ActionHighPlunge`.
 *
 * Curation convention: for multi-hit attacks where the cancel window only opens
 * after the final hitmark (e.g. a double-hit N4), all keys must reflect the
 * frame of the *last* hitmark — not an earlier sub-hit. Cancelling before the
 * final hit lands loses damage and is not a valid rotation decision.
 */
export type FrameMap = Partial<Record<ActionKey, number>> & {
	/** Full animation length — the fallback for every key not otherwise set. */
	anim: number;
	/** Hitmark; fills E/Q/D/J/swap. Normal and charged slices only. */
	hit?: number;
	/**
	 * The frame the swing's FIRST hit lands, where `hit` cannot say it (§1.K stage
	 * 2, 2026-09-20). Read through `landsAt()` — ⛔ never directly.
	 *
	 * ⚓⚓ **`hit` IS A CANCEL TIER AS WELL AS A HITMARK**, and that is why this
	 * field exists. `hit` is gcsim's `InitNormalCancelSlice(hitmark, anim)`: the
	 * hitmark AND the fill for E/Q/D/J/swap. gcsim builds every charged attack,
	 * every plunge and most catalyst normals with explicit cancels instead and
	 * keeps the hitmark in a separate constant, so those maps state no `hit` —
	 * and the number cannot be authored into it, because it would become their
	 * E and Q cancel. `lands` is a landing frame and nothing else.
	 *
	 * ⚠️ The FIRST hit of a multi-hit swing (⚓ Nate): it is what applies the
	 * element and fires an `onHit`. `hit` is gcsim's LAST hitmark, so the 82
	 * multi-hit normals that state only `hit` still land a median 12f late — a follow-up
	 * with its own measurement, ⛔ not something to infer from this field.
	 *
	 * ⚠️ A RELEASE frame for a projectile, never a travel-inclusive one: gcsim's
	 * `travel` default (10f) is a simulation policy and the dumper pins it to 0.
	 * Authored from the dumper by `scripts/migrate-swing-landings.mjs`; absent
	 * where `hit` already says it (lint A.5c).
	 *
	 * ↻ **A LIST when the swing lands more than one hit** (every-landing round,
	 * 2026-09-21): the frames its hits land, first to last — read through
	 * `landingsOf()`. ⛔ Not a separate hit COUNT: a count cannot place the second
	 * application, and the frames imply it. ⚠️ Two hits on ONE frame are two hits
	 * (Kaeya's charged attack is `[20, 20]`), ⛔ never a duplicate to dedupe. A map
	 * that states `hit` states the list BESIDE it — `hit` stays the cancel tier.
	 */
	lands?: number | number[];
};

/**
 * Timing data for a single hit in a normal-attack combo.
 * Array index = hit number (0-based). Parser indexes by normalCounter.
 * For multi-hit entries see the FrameMap curation convention above.
 *
 * `damageTag` is rarely set explicitly — `getDefaultDamageTag` infers it
 * from the parent context (`normal` for entries in `hits[]`, `charged` for
 * `chargeHits[]`). Override only when the canonical tag diverges (none in
 * the curated corpus today).
 */
export type NormalHit = { name?: string; frames: FrameMap; damageTag?: DamageTag };

/**
 * Dynamic event-triggered extension of an active duration window. Authored on
 * the ability that *opens* the window — for stance abilities, that's the
 * stance variant of the skill/burst that owns the stance window; for summons,
 * the `Summon` itself.
 *
 * Each entry adds `delta` seconds to the active window's end time when its
 * `trigger` fires (and `conditions` hold), up to `maxExtensions` per window
 * (omit for unlimited), with at least `procCooldown` seconds between
 * consecutive extensions from the same entry.
 *
 * Reference: Cyno's burst stance is extended +4s by each in-stance Mortuary
 * Rite cast (max 2 extensions). Authored on the burst as
 * `{ trigger: { type: "onCast", ability: "skill" },
 *    conditions: { type: "state", state: "inStance" },
 *    delta: 4, maxExtensions: 2 }`.
 *
 * Parser dispatch is currently wired only for `onCast` triggers. Other trigger
 * types (`onReaction`, `onHit`, etc.) are accepted in schema but don't yet
 * fire extensions at runtime — those characters' curator notes flag the gap.
 */
export type DurationExtension = {
	trigger: Trigger;
	/** Seconds added to the window end time per extension. Fractional allowed. */
	delta: number;
	/** Cap on total extensions per window (resets when the window re-opens).
	 *  Omit for unlimited. */
	maxExtensions?: number;
	/** Minimum seconds between consecutive extensions from this entry. */
	procCooldown?: number;
	/** Additional gating beyond the trigger (e.g. a `state` condition). */
	conditions?: Condition;
};

// ---------------------------------------------------------------------------
// Ability — discriminated union over abilityType (and behavior on skill/burst)
// ---------------------------------------------------------------------------

/** Fields shared by every ability variant. */
export type AbilityCommon = {
	id: string;
	name: string;
	shortName?: string;
	/** In-game description text from the game source (genshin-db / wiki).
	 *  Canonical only — do NOT place implementation notes, planner caveats,
	 *  or curator observations here. */
	description?: string;
	/** User-facing caveat about how the planner represents this ability —
	 *  limitations, unmodelled mechanics, things a user should know when
	 *  reading the timeline. Rendered in the timeline caveats panel. */
	caveat?: string;
	/** Curator-only scratch notes. Never rendered to end users.
	 *  Use for: skipped effects with reasons, design questions,
	 *  future-wiring ideas, frame-source confidence notes. */
	_curatorNotes?: string[];
	sections?: AbilitySection[];
	/** Availability gate — if present and evaluates false, ability is not resolvable. */
	conditions?: Condition;
	effects?: Effect[];
	/** ⚓ A RULING as data (coverage round, docs/coverage-round.md §5.1): this
	 *  host describes something we decided not to model — co-op shields,
	 *  distance-based mechanics, a low-probability proc. `reason` is
	 *  USER-FACING (the coverage page renders it; caveat style guide: name the
	 *  thing, ≤2 sentences). ⛔ Never beside `effects` (lint E.29); a `caveat`
	 *  may still sit beside it. */
	notModeled?: { reason: string };
	/** ⚓ n/a as data (coverage round §6): the host describes nothing the planner
	 *  would ever draw — stamina, movement, a crafting refund. Absent both this
	 *  and `effects`, the coverage page reads the host as MISSING, the honest
	 *  default for anything not yet looked at. ⛔ Never beside `effects` or
	 *  `notModeled` (lint E.29). */
	nothingToModel?: true;
	/** ⚓ "Drawn through ANOTHER host" as data (coverage round, ⚓ Nate
	 *  2026-09-23): the id of the ability/passive/constellation whose data carries
	 *  this host's mechanic, when nothing in that data names this host — a
	 *  summon's `durationExtensions` (Collei A4), a tick's `flatScaling` (Aino A4),
	 *  a buff hosted on a passive (Illuga's skill). A gated condition or a
	 *  `source`/`attribution` string is found by the derivation on its own and
	 *  needs no pointer. ⛔ Never beside `effects`, `notModeled` or
	 *  `nothingToModel`; the target must be another host of the same character
	 *  (lint E.29b). */
	modeledBy?: string;
};

/** Normal-attack ability. Holds normals + charged + plunge frames in one record. */
export type NormalAbility = AbilityCommon & {
	abilityType: 'normal';
	input: Input[];
	/** Per-hit timing for the normal-attack combo. Required. */
	hits: NormalHit[];
	/** Charged-attack frames for sword/claymore/polearm. Mutually exclusive with chargeHits. */
	chargeFrames?: FrameMap;
	/** Per-level charged hits for bow characters. Mutually exclusive with chargeFrames.
	 *  Index 0 = C1 (partial); index 1 = C2 (full / Frostflake). */
	chargeHits?: NormalHit[];
	/**
	 * Frames for KQM's **`sC`** token — a SPECIAL Charged Attack, the one a
	 * stance substitutes for the ordinary one (Varka's Azure Devour, 2026-09-16).
	 * The sibling of `sQ`, and of `sE` on the cast side.
	 *
	 * ⚓ FRAMES ONLY, and that is the whole point of the shape: Azure Devour
	 * differs from the in-stance charged attack in its animation and nothing
	 * else this tool models. Its element comes from the same `infusion` /
	 * `coInfusion` pair the swings use, so a special charge lands both claymores
	 * exactly as an ordinary in-stance one does.
	 *
	 * ⚠️ `sC` on an ability that does not author this falls back to
	 * `chargeFrames`, the same rule an out-of-window `sQ` follows — a token the
	 * data cannot honour takes the ordinary form rather than vanishing.
	 *
	 * ↻ The cost is `specialChargeSpends` beside this (2026-09-18) — until then
	 * the token drew the attack without spending the use.
	 */
	specialChargeFrames?: FrameMap;
	/**
	 * The sibling SKILL ability whose charge an `sC` SPENDS — Azure Devour
	 * "expends uses of the special Elemental Skill Four Winds' Ascension"
	 * (2026-09-18; gcsim `charge.go` `skillAzureDevour`: `SetCD(ActionSpecialSkill,
	 * 11*60)` at the attack's start, no delay).
	 *
	 * ⚓ The special form is taken ONLY when the named skill is the one ACTIVE at
	 * the swing (gcsim `useSpecialSkill()` — in Varka's case, in Sturm und Drang
	 * with a Pyro/Hydro/Electro/Cryo teammate); anywhere else the token is the
	 * ordinary charged attack on `chargeFrames`, because the attack it names
	 * cannot be performed there. ⚓ And a charge must be READY: the token WAITS
	 * for one exactly as an `E` on cooldown does (the charge-queue scan), rather
	 * than silently taking the ordinary form — the notation named Azure Devour,
	 * and a gap that says "no use yet" is honest where a same-tinted ordinary
	 * charge would be a quiet substitution. The spent charge's clock is appended
	 * to the END of the queue's chain (charges recharge one at a time).
	 *
	 * ⚠️ The action event records the spend (`ActionEvent.spentCharge`); nothing
	 * is DRAWN for it beyond the block itself — the next `sE` simply lands where
	 * the queue allows. ⛔ Requires `specialChargeFrames` (lint A.4d).
	 */
	specialChargeSpends?: string;
	/** HIGH-plunge frames, and the default. Covers the standalone `P` token, the
	 *  explicit `hP`, and the `E P` path where no plungeVariant matches the
	 *  preceding E token.
	 *
	 *  ⚠️⚠️ THE MEANING OF THIS FIELD CHANGED AT L4b (2026-08-16). It used to hold
	 *  ONE undifferentiated plunge, and measured against gcsim 36 of its 41
	 *  authors were carrying LOW-plunge numbers — so a note or a value predating
	 *  that round is describing a different thing. ⚓ Nate's ruling: the high
	 *  plunge is what players actually perform, so it gets the plain name and the
	 *  bare `P` token; the low plunge is the exception. */
	plungeFrames?: FrameMap;
	/** LOW-plunge frames — the `lP` token only. Falls back to `plungeFrames` when
	 *  absent, so a character gcsim models with one plunge is not left with none. */
	lowPlungeFrames?: FrameMap;
	/** Plunge variants keyed by the preceding E token — e.g. Kazuha's
	 *  Midare Ranzan has distinct frames for `E P` (press) vs `hE P` (hold).
	 *  Selection is "first entry whose input[] contains the preceding E text". */
	plungeVariants?: PlungeVariant[];
	/** Per-action-class transient-state openers (post-P4 #2 generalization of
	 *  the former `plungeOpensState`). The window opens at the action's END:
	 *  `plunge` at the plunge landing (Varesa Apex Drive), `normal` at the
	 *  first swing's recovery — fired once per N token (Durin's dark commit),
	 *  `charged` at the charged attack's end (Furina's Arkhe toggle).
	 *  See {@link TransientStateSpec}.
	 *
	 *  ⚠️ THE ACTION'S END, not its hitmark, and `charged` inherits that rather
	 *  than arguing with it. gcsim flips Furina's Arkhe at
	 *  `chargeHitmark − windup + 1` (33f, or 22f chained off a normal) where we
	 *  fire a few frames later — unobservable, because the state gates her E and
	 *  the frame maps put 53f between an E and a following CA and 47f the other
	 *  way, so no cast can land inside the discrepancy. ⛔ Don't mint a
	 *  hitmark-anchored opener for it. */
	actionOpensState?: {
		normal?: TransientStateSpec;
		plunge?: TransientStateSpec;
		charged?: TransientStateSpec;
	};
	/**
	 * ⚓ A NON-HITTING ACTION CLASS (Lauma charged-forms round, 2026-09-16): this
	 * ability's action of that class LANDS NO HIT — no element on the block, no
	 * offer to the gauge, no hit record for any `onHit` consumer. The input still
	 * takes its frames, still pads, still opens a transient state. First holder:
	 * Lauma's Spirit Envoy Metamorphosis, a charged attack that turns her into a
	 * deer.
	 *
	 * The POSITIVE claim — absent means the weapon rule applies (a catalyst
	 * swing is elemental, a bow's aimed shot is elemental, a claymore swing is
	 * physical). ⛔ Not folded into `resolveActionElement`: that rule is shared
	 * with the editor's highlighter, which has no state machine and cannot know
	 * which FORM a `C` resolved to, so a form-taker's `C` is tinted in the
	 * editor and untinted on the chart — the same gap every timed infusion
	 * already has there. `normal` is per-ABILITY, like `infusion`: a non-hitting
	 * normal string is a sibling ability's, not a swing's. No holder yet.
	 *
	 * ⚠️ "Applies nothing" is NOT this. A cast's `application: []` says the hit
	 * carries no gauge; it still lands (Emilie's E at Durability 0 fires her C2).
	 * The cast-side twin of this flag — a cast whose animation queues no attack
	 * at all — is a separate, gcsim-censused landing (the round's §7).
	 */
	nonHitting?: { normal?: true; charged?: true; plunge?: true };
	/**
	 * Whether a swing of this class is a PROJECTILE — released at its `hit` /
	 * `lands` frame and landing `PROJECTILE_TRAVEL_F` later (projectile-travel
	 * round, 2026-09-21). Read through `projectileTravelOf()`.
	 *
	 * ⚓ States the EXCEPTIONS to a rule, both ways: a bow's normals and aimed
	 * shots are projectiles without saying so, and everything else is melee. So
	 * `true` is the nine catalysts gcsim gives a `travel` parameter — per CLASS,
	 * because only four of them take it on the charged attack — and `false` is a
	 * bow in a melee stance (Tartaglia's Foul Legacy).
	 * ⛔ The other 19 catalysts fold their flight into the hitmark, where it
	 * cannot be separated: flagging one counts its travel twice.
	 */
	projectile?: { normal?: boolean; charged?: boolean };
	/** Elemental infusion applied to N/C/P while this ability is active.
	 *  Used on stance normals (e.g. Cyno's Pactsworn Pathclearer).
	 *
	 *  ⚓ An `ElementRef` object is an element the TEAM names (2026-09-16) —
	 *  Varka's right-hand claymore, which is Pyro/Hydro/Electro/Cryo by party
	 *  priority and PHYSICAL when the party has none of the four. */
	infusion?: ElementRef;
	/**
	 * A SECOND element every swing of this ability lands, on its own ICD counter
	 * (Varka's two claymores round, 2026-09-16).
	 *
	 * ⚓⚓ Varka is the only holder and a gcsim census says he is the only
	 * candidate — the `ele := []attributes.Element{…}` idiom returns his four
	 * files and nothing else. He dual-wields: the right-hand claymore carries
	 * `infusion` and the LEFT hand carries this, so every in-stance swing lands
	 * two elements on two dedicated counters (`ICDTagVarkaNormalAttackElem` /
	 * `…Wind`, both on `ICDGroupDefault`).
	 *
	 * ⚠️⚠️ THE ORDER IS A CONTRACT, NOT A DETAIL. `infusion` is offered FIRST and
	 * this second, at the same instant — and measured against the gauge, Pyro
	 * then Anemo at one instant SWIRLS while Anemo then Pyro produces NOTHING
	 * (the Anemo hits an empty target and dissipates). Varka self-enables his own
	 * Swirl, which is what his three Swirl-keyed passives are built on, so
	 * reversing the two fields would silently delete the mechanic.
	 *
	 * ⚠️ It applies even when `infusion` resolves to nothing — with no
	 * Pyro/Hydro/Electro/Cryo teammate Varka's right hand is Physical and his
	 * left is still Anemo.
	 *
	 * ⛔ It lands NO second hit record and NO second action event. One swing is
	 * one hit is the documented per-swing approximation, and a second record
	 * would double every `onHit` proc the swing feeds. What it adds is an
	 * elemental application, which is the half the gauge reads.
	 *
	 * ⚠️ Both counters are keyed off the same swing and share the standard
	 * cadence, so they stay in phase — both halves apply on the same 1-in-3
	 * swings, which is what makes the self-swirl land rather than alternate.
	 */
	coInfusion?: ElementRef;
	/** Element-application ICD bypass — the ability applies its element on EVERY
	 *  hit (gcsim's `ICDTagNone`); omit for the standard 3-hit / 2.5s default.
	 *  Read by the parser's ICD clocks: at every normal/charged/plunge swing on
	 *  a normal ability, and by the per-cast counter on a skill/burst (L4d).
	 *  See docs/library/game/icd.md. */
	noICD?: boolean;
	/**
	 * ⚓ A MEASURED non-standard element-application window for this character's
	 * CHARGED attack. Absent means the standard 2.5 s / every-third-hit default.
	 *
	 * ⚠️⚠️ **It is per-CHARACTER data and deliberately not a weapon-type rule**,
	 * which is what a census of gcsim's `charge.go` files showed after the
	 * opposite was assumed. 16 of the 19 oracled polearm users carry gcsim's
	 * `ICDGroupPoleExtraAttack` (a 0.5 s window in which only the first hit
	 * applies, so in practice every charged attack applies) — but **Xiao,
	 * Raiden and Emilie are on the default**, and **Ayato, a sword user, is
	 * not**. ⛔ So this may never move into `resolveActionIcd` as a
	 * `weapon === 'polearm'` branch beside the plunge and catalyst rules: those
	 * two are near-universal censuses (165/166 and all of them) and this is 84%
	 * with named counter-examples.
	 *
	 * ⚠️ Raiden is a counter-example twice over and shows why the field is
	 * scoped to the charged attack alone: inside Musou Isshin her charged attack
	 * is tagged as a NORMAL attack in gcsim, so it shares the normal counter
	 * rather than carrying a window of its own. That is unmodelled.
	 *
	 * ⚓ Shape is gcsim's own group data reduced to its two load-bearing numbers
	 * (`pkg/core/attacks/icd_groups.dm.go`): the reset `timer` in FRAMES, and
	 * `every` — how many hits apart an application falls inside that window,
	 * absent meaning ONLY THE FIRST does. All 58 of gcsim's groups reduce to
	 * this pair; ⛔ never carry gcsim's group NAMES, which is a 58-entry
	 * taxonomy we would have to maintain and whose whole content is these two
	 * numbers.
	 *
	 * ⚠️ Reachable only when the swing is elemental: a bare polearm charged
	 * attack is Physical and applies nothing, so this is spent by a stance
	 * infusion (Hu Tao, Cyno, Flins) or one granted by a teammate — which is
	 * why it is authored on every character gcsim measures rather than only on
	 * the self-infusers. See docs/icd-group-round.md.
	 */
	chargedIcdWindow?: IcdWindow;
	/**
	 * ⚓ The positive claim that this character CANNOT BUFFER an input after a
	 * Charged Attack (2026-09-17) — Human timing pads the next N/C instead of
	 * treating it as a stored input. Absent = the default rule in
	 * `sim/humanTiming.ts`, which lets a swing's next swing through.
	 *
	 * ⚠️ PER CHARACTER, NOT A RULE, and that is measured in sources rather than
	 * assumed: KQM's frames page states buffering only AFTER NORMAL attacks, the
	 * Raiden guide calls her N3C / N1C combos "input buffered or button-mashed",
	 * and the Lohen quick guide says "you cannot buffer inputs after a Charged
	 * Attack, so the cancel timing is quite precise". ⛔ Author it only from a
	 * source that says so for THAT character. Read off any normal ability of
	 * the character (it describes the character's input handling, not a form).
	 */
	noBufferAfterCharged?: true;
	tags?: AbilityTag[];
};

/**
 * A measured non-standard element-application ICD, in gcsim's terms reduced to
 * the two numbers that carry all of it: a reset window and how often a hit
 * applies inside it.
 *
 * ⚓ This is the same shape `IcdParams` in `$lib/utils/icd` already had —
 * `{ timer, hits }` IS `(window, period)` — so consuming one needs no new
 * mechanism, only a resolver willing to return something other than the
 * standard. `every` absent maps to an unreachable counter, i.e. only the first
 * hit of each window applies.
 */
export type IcdWindow = {
	/** Reset window in FRAMES (60fps). gcsim's `ICDGroupResetTimer`. */
	timer: number;
	/** Every `every`-th hit applies inside the window. Absent = only the first. */
	every?: number;
	/**
	 * At most this many applications per window — a COUNT, unit-free. Absent = no
	 * limit.
	 *
	 * ⚓ The group's list is FINITE (ICD cap round, 2026-10-04): gcsim's
	 * `ICDGroupEleApplicationSequence` reads past its end as its last entry, a 0 in
	 * every group but the two reaction groups, so a window applies on hits 1,
	 * 1 + every … and then STOPS until the timer resets. Chevreuse's Burst shells
	 * are `{180, every 3, cap 2}` — the 7th hit of a window applies nothing.
	 * Read off the frames audit's measured `N max`, ⛔ never inferred from an
	 * applied count. Only meaningful beside `every` (lint D.27f).
	 */
	cap?: number;
};

/** Plunge-variant override selected by the preceding E token text. */
export type PlungeVariant = {
	label: string;
	input: Input[];
	frames: FrameMap;
};

/**
 * One hit of an ability, at the frame it LANDS.
 *
 * ⚓⚓ THE THING THE CORPUS COULD NOT SAY. Until L4c an ability recorded when it could
 * be CANCELLED (the FrameMap) and never when it landed, so the parser applied
 * `char.element` at every E/Q cast, unconditionally — including Xiangling's E, which in
 * game applies zero Pyro because it only puts Guoba on the field. See
 * `docs/gauge-round.md` §1 and contract C3.
 *
 * ⛔ **AN ABSENT LIST IS NOT "1U AT CAST".** Absent means we never drove this ability and
 * do not know; it applies nothing and is counted in the provisional register. An EMPTY
 * ARRAY is the positive statement that the cast applies nothing — 19 abilities in the
 * corpus are like that, and it is the most valuable thing this field records.
 *
 * ⚠️ This is the NOMINAL hit schedule, not the applied one (contract C4). It is derived
 * from gcsim's `damage` stream, which fires even when ICD zeroes the application, and
 * `icd.ts` remains the only thing that decides whether a hit lands. ⛔ Never pre-apply
 * ICD here.
 *
 * ⛔ Normals carry no list: their hitmark is `frames.hit` and their element already has
 * one owner in `resolveActionElement`. Summons carry none either — `interval` /
 * `firstTickDelay` already say when a summon applies.
 */
/**
 * An element a data field NAMES — either a literal, or one the TEAM's
 * composition resolves (Varka's two claymores round, 2026-09-16).
 *
 * ⚓⚓ THE ONE MECHANIC IT EXISTS FOR: Varka's right-hand claymore deals "the
 * corresponding Elemental DMG based on the Elemental Types of the characters in
 * the party, following the aforementioned priority order" — Pyro > Hydro >
 * Electro > Cryo. The element is therefore not a property of the ability, it is
 * a property of who you brought, and it is the SAME element at four sites (the
 * in-stance normal's infusion, Four Winds' Ascension, the burst, Azure Devour).
 *
 * ⚠️ Resolution is PARSE-TIME and definitive: it reads the same
 * `teamElementCounts` map `teamElementCount` Conditions read, so it answers
 * once for a rotation and never changes under it. With no context (the editor's
 * highlighter, a renderer-side call with no team scope) it answers `undefined`,
 * which every reader already treats as "physical / no infusion" — the same
 * optimistic silence a timed infusion gets there.
 *
 * ⚠️ The count map is HOLDER-EXCLUDED, matching `teamElementCount`. gcsim's
 * `getConversionElem` scans every party member including the holder; for the one
 * holder that is the same answer, because Varka is Anemo and Anemo is not in any
 * authored `order`. ⛔ Check that before giving this a second holder.
 */
export type ElementRef =
	| Element
	| {
			type: 'teamElementPriority';
			/** Elements in priority order — the FIRST one a non-holder party
			 *  member carries wins. */
			order: Element[];
			/** The element when no member carries any of `order`. Omit for "the
			 *  hit is physical / the ability is uninfused", which is Varka's
			 *  in-stance right hand; his BURST instead falls back to Anemo, and
			 *  that asymmetry is gcsim's, not a slip. */
			fallback?: Element;
	  };

export type ElementalApplication = {
	/** Frames (60fps) from cast start to the hitmark. */
	frame: number;
	/** ⛔ ABSENT MEANS PHYSICAL — the hit applies nothing. Never a default element.
	 *
	 *  ⚓ An `ElementRef` object here is an element the TEAM names (2026-09-16) —
	 *  Varka's right-hand claymore. It resolves at parse time and an
	 *  unresolvable one is treated exactly like an absent element: the hit
	 *  applies nothing. */
	element?: ElementRef;
	/**
	 * Gauge units, pre-tax — measured as gcsim's applied durability ÷ 25.
	 * Authored since L5d, once the gauge that reads it existed (contract C3 split
	 * the three fields by consumer for exactly this reason).
	 *
	 * ⚠️ ABSENT MEANS UNMEASURED, not 1U. gcsim logs no durability for a hit its
	 * own ICD suppressed, and the sim falls back to 1U marked provisional. ⛔ Do
	 * not "tidy" a measured `units: 1` away — the corpus measured 1U 327 times,
	 * and collapsing that into silence is the same conflation L4d had to undo on
	 * the list itself.
	 */
	units?: number;
	/**
	 * ⚓ THIS HIT IS ON NO COUNTER (cast-icd-gate round, 2026-09-17): gcsim's
	 * `ICDTagNone` on ONE hit of a cast whose other hits share a group. It applies
	 * always and spends no slot of the cast's counter — Arlecchino's All Is Ash is
	 * the case: the Spike and the Blood-Debt ticks run on a 600f group while the
	 * Cleave between them is untagged, so no single `icdGate` can say both.
	 * ⚠️ Also the approximation for a lone hit on its OWN group inside a cast
	 * (the Hydro Traveler's hold finale on the default group): one hit on a
	 * counter of its own applies once, which is what "always" says for one hit.
	 * ⛔ Redundant beside the ability's own `noICD` (lint D.27c).
	 */
	noICD?: true;
};

/** Fields shared by all skill behavior variants. */
type SkillCommonFields = AbilityCommon & {
	abilityType: 'skill';
	input: Input[];
	/** Frame-accurate cast timing (60fps). Required for E/Q. */
	frames: FrameMap;
	/** Cooldown in seconds. Required. */
	cooldown: number;
	/** Frames (60fps) from cast start until the cooldown timer begins ticking.
	 *  Sourced from gcsim's `SetCDWithDelay` second argument. Only needed when non-zero. */
	cooldownStartDelay?: number;
	cooldownModifiers?: CooldownModifier[];
	charges?: number;
	chargeModifiers?: ChargeModifier[];
	/** Every charge begins RECHARGING the moment the ability becomes available,
	 *  rather than starting ready — "Starts on cooldown and has 2 maximum uses"
	 *  (Varka's Four Winds' Ascension). ⚓ Only meaningful on a state-gated
	 *  SIBLING skill (lint requires an `inStance` condition): the opening it
	 *  rides is the stance's start, where the charge queue is written as one
	 *  chain (`start + cd`, `start + 2cd`, …) from the base skill's cooldown
	 *  clock, and re-written on every re-entry (gcsim discards the in-progress
	 *  queue and starts a fresh one). ⛔⛔ Never authored without the
	 *  reduction that closes the loop — see docs/cooldown-reduction-round.md §0:
	 *  alone it says "ready 11s into a 12s stance", further from play than
	 *  the ready-at-zero it replaces. */
	startsOnCooldown?: boolean;
	/** Whether this ability's own damage snapshots the caster's stats at cast
	 *  (KQM "snapshotting talents" — DoTs/summons like Pyronado, Oz), vs. recomputing
	 *  dynamically. Forward-looking (keep + document, 2026-07-14): authored on a few
	 *  characters but not yet consumed — the tools model buff windows, not damage — to
	 *  be wired when a damage-aware feature lands. See docs/library/game/snapshotting.md. */
	snapshots?: boolean;
	/** Element-application ICD bypass — the ability applies its element on EVERY
	 *  hit (gcsim's `ICDTagNone`); omit for the standard 3-hit / 2.5s default.
	 *  Read by the parser's ICD clocks: at every normal/charged/plunge swing on
	 *  a normal ability, and by the per-cast counter on a skill/burst (L4d).
	 *  See docs/library/game/icd.md. */
	noICD?: boolean;
	/**
	 * ⚓ A MEASURED non-standard element-application window for this cast's
	 * `application[]` (the cast-side twin of `NormalAbility.chargedIcdWindow` and
	 * `summonTick.icdGate`; cast-icd-gate round, 2026-09-17). Absent = the
	 * standard 2.5 s / every-third-hit default; `noICD` is the "every hit
	 * applies" half and wins when both are set. Read by `resolveCastApplications`
	 * through the same `icdParamsFor` translation the other two use, so the
	 * three shapes cannot drift.
	 *
	 * ⚠️ `timer` is in FRAMES — lint D.27c holds the unit. ⚠️⚠️ Pair the gate
	 * with the stream OUR `application[]` models, never with the character (the
	 * Emilie rule): a cast's list is the NOMINAL schedule and one entry may be
	 * several gcsim hits. ⛔ Never inferred from an applied COUNT — an applied
	 * count says only THAT the default is wrong, never what is right; author
	 * from the audit's `gcsim cadence` column (`ICDGroupResetTimer` /
	 * `ICDGroupEleApplicationSequence`, read off the live `AttackInfo`).
	 */
	icdGate?: IcdWindow;
	tags?: AbilityTag[];
	/** When this cast's own hits LAND, and what they apply. ⚓ An empty array is the
	 *  positive statement that the cast applies nothing; an absent field means we have
	 *  no reading. See {@link ElementalApplication}. */
	application?: ElementalApplication[];
	/**
	 * ⚓ THE CAST LANDS NO HIT (non-hitting casts round, 2026-09-16 — the twin of
	 * `NormalAbility.nonHitting`): its own animation queues no attack. No hit
	 * record (so no `onHit` stack, artifact or proc consumer hears it), and the
	 * buff derivation does not anchor an `onHit skill|burst` effect on the cast.
	 * `onCast` effects, summons and their tick series are untouched — a
	 * summon's ticks are the SERIES' hits, not the cast's, which is why Guoba's
	 * cast is non-hitting while Guoba is not.
	 *
	 * ⚠️ NOT the same claim as `application: []`, which says the cast applies no
	 * gauge — Emilie's E lands a Durability-0 hit and stays hitting. Lint demands
	 * an explicit `application: []` beside this flag so both claims are stated.
	 * A variant may override it with a boolean (Kujou Sara's C2 Ambush is a real
	 * cast-time hit on a press that lands nothing at C0).
	 */
	nonHitting?: true;
	/** Entities spawned by this cast with their own lifetimes. When present,
	 *  these supersede the ability's own `duration` for active-window rendering. */
	summons?: Summon[];
	/**
	 * ⚓⚓ THE CAST OPENS ONE WINDOW AND ITS SUMMONS ARE ALTERNATIVE OCCUPANTS OF
	 * IT (Arkhe round, 2026-09-04). Normally a cast spawns what its resolved
	 * variant says and that is settled for the life of the window. With this
	 * flag, a change in the state gating those variants mid-window REPLACES the
	 * occupant: the old summon ends at the flip, the new one spawns there and
	 * inherits the remaining duration. Furina's kit says it in those words —
	 * "The Salon Members and Singer of Many Waters share a duration, and when
	 * Furina uses her Charged Attack to change the guest type, the new guests
	 * will inherit the remaining duration" — and gcsim implements it as
	 * `if c.StatusIsActive(skillKey) { c.summonSinger(0) }` (`charge.go:61`).
	 *
	 * ⛔⛔ IT MUST BE OPT-IN AND THE GENERAL RULE WOULD BE WRONG. "Re-resolve a
	 * cast's summons whenever a gating state changes" sounds like the honest
	 * default and is not: a burst variant gated on `inStance` whose stance ends
	 * mid-window must keep the summon it spawned. A cast spawning a thing is the
	 * norm; a cast holding a slot something else can move into is the exception,
	 * and only a kit that says so may claim it.
	 *
	 * ⚠️⚠️ IT RE-RESOLVES AT STATE EDGES THE PARSE CAN SEE — a toggle or an
	 * opener — ⛔ NOT at a timed window's silent expiry, which fires no event.
	 * That is sound only because the gating state is itself a TOGGLE, which never
	 * expires; **lint enforces exactly that** (a `summonsFollowState` ability's
	 * variants must gate on a state some `toggle: true` spec on the same
	 * character opens). ⛔ Don't relax the lint without teaching the parse to
	 * schedule expiries.
	 *
	 * ⚠️ A replacement spawns with NO delay — gcsim passes 0, not the summon's
	 * own `spawnsAt` — and its tick cadence restarts from the flip. The bubble
	 * delay is the cast animation's, and there is no second cast.
	 */
	summonsFollowState?: true;
	variants?: AbilityVariant[];
};

/** Skill ability — discriminated by behavior. Persistent/stance variants require duration. */
export type SkillAbility =
	| (SkillCommonFields & {
			behavior: 'instant';
			/** Post-action transient state opened at cast start (Flins Northland
			 *  Spearstorm → `symphonyWindow`). See {@link TransientStateSpec}. */
			opensTransientState?: TransientStateSpec;
			/** How long this instant cast's ACTIVE WINDOW runs, in seconds — the
			 *  span the E/Q bar draws. Optional; absent = a pure instant pill.
			 *
			 *  ⚓ 2026-08-14. It exists because `summons[]` was previously the only
			 *  way to say this, and nine shield abilities authored a zero-effect
			 *  summon purely to get a 12s bar (Layla's "Curtain of Slumber",
			 *  Noelle's "Stone Armor"…). That stretched `summons[]` to cover
			 *  things nobody would call a summon; this field is what lets those
			 *  entries retire and leaves `summons[]` meaning what its name says —
			 *  a thing left in the WORLD.
			 *
			 *  ⚠ DELIBERATELY NOT `duration`. Twelve instant abilities already
			 *  carry a stray `duration` that is dead data (it is not declared on
			 *  this behavior variant and no accessor reads it) — Kachina's burst,
			 *  Kaveh's, Zhongli's Planet Befall. Teaching the accessor to read
			 *  `duration` on instant would have resurrected all twelve as active
			 *  bars nobody authored. A distinct name is what keeps them inert. */
			activeDuration?: number;
	  })
	| (SkillCommonFields & {
			behavior: 'persistent';
			/** Persistent-summon active-window duration in seconds. Required on persistent. */
			duration: number;
			durationModifiers?: DurationModifier[];
			persistentBehavior?: 'stationary' | 'follows';
			/** Frame (60fps) at which the persistent summon becomes active, relative to cast start.
			 *  Sourced from gcsim's per-character activation constant. Defaults to 0. */
			summonActivatesAt?: number;
	  })
	| (SkillCommonFields & {
			behavior: 'stance';
			/** Stance window duration in seconds. Required on stance. */
			duration: number;
			durationModifiers?: DurationModifier[];
			/** Dynamic event-triggered extensions of this stance window. See
			 *  {@link DurationExtension}. Authored on the ability that opens
			 *  the stance — extensions fire while the window is active. */
			durationExtensions?: DurationExtension[];
			/** Stance window closes when this character swaps off-field. */
			terminatesOnSwap?: boolean;
			/** The cooldown CLOCK starts when the stance window ENDS, not at the
			 *  cast — so the ability comes back at `stanceEnd + cooldown` and an
			 *  early exit brings it back sooner. Natlan Nightsoul skills whose CD
			 *  gcsim sets inside `exitNightsoul()`; the Fandom wiki states it in
			 *  words for Xilonen ("The 7s cooldown starts once Xilonen's
			 *  Nightsoul's Blessing state ends and not upon the Elemental Skill
			 *  cast").
			 *
			 *  ⛔ Mutually exclusive with `cooldownStartDelay`, which means
			 *  ANIMATION FRAMES before the clock starts — an unrelated, much
			 *  smaller offset. Both were once encoded the same way (a delay equal
			 *  to the duration), which computed the right first cast and could not
			 *  express an early exit. characterLint D.21/D.22 enforce the split.
			 *
			 *  ⚠️ Read off the BASE ability only, and not modelled together with
			 *  `durationExtensions` — the recast time is placed mid-parse, so a
			 *  stance end that moves LATER after the fact would leave a stale
			 *  placement (lint D.22). Early exit moves it EARLIER and is handled. */
			cooldownStartsAtStanceEnd?: boolean;
			/** Additional named state opened when this stance is active, alongside the
			 *  default "inStance". Closes with the stance window. Used for Natlan
			 *  Nightsoul characters where the stance is semantically a Nightsoul Blessing
			 *  window (opensState: "nightsoulBlessing"). Conditions can gate on either
			 *  inStance (for backwards compat) or the named state. */
			opensState?: State;
	  });

/** Fields shared by all burst behavior variants. */
type BurstCommonFields = AbilityCommon & {
	abilityType: 'burst';
	input: Input[];
	frames: FrameMap;
	cooldown: number;
	cooldownStartDelay?: number;
	cooldownModifiers?: CooldownModifier[];
	/** Energy cost of the burst. Required. */
	energyCost: number;
	/** Whether this ability's own damage snapshots the caster's stats at cast
	 *  (KQM "snapshotting talents" — DoTs/summons like Pyronado, Oz), vs. recomputing
	 *  dynamically. Forward-looking (keep + document, 2026-07-14): authored on a few
	 *  characters but not yet consumed — the tools model buff windows, not damage — to
	 *  be wired when a damage-aware feature lands. See docs/library/game/snapshotting.md. */
	snapshots?: boolean;
	/** Element-application ICD bypass — the ability applies its element on EVERY
	 *  hit (gcsim's `ICDTagNone`); omit for the standard 3-hit / 2.5s default.
	 *  Read by the parser's ICD clocks: at every normal/charged/plunge swing on
	 *  a normal ability, and by the per-cast counter on a skill/burst (L4d).
	 *  See docs/library/game/icd.md. */
	noICD?: boolean;
	/**
	 * ⚓ A MEASURED non-standard element-application window for this cast's
	 * `application[]` (the cast-side twin of `NormalAbility.chargedIcdWindow` and
	 * `summonTick.icdGate`; cast-icd-gate round, 2026-09-17). Absent = the
	 * standard 2.5 s / every-third-hit default; `noICD` is the "every hit
	 * applies" half and wins when both are set. Read by `resolveCastApplications`
	 * through the same `icdParamsFor` translation the other two use, so the
	 * three shapes cannot drift.
	 *
	 * ⚠️ `timer` is in FRAMES — lint D.27c holds the unit. ⚠️⚠️ Pair the gate
	 * with the stream OUR `application[]` models, never with the character (the
	 * Emilie rule): a cast's list is the NOMINAL schedule and one entry may be
	 * several gcsim hits. ⛔ Never inferred from an applied COUNT — an applied
	 * count says only THAT the default is wrong, never what is right; author
	 * from the audit's `gcsim cadence` column (`ICDGroupResetTimer` /
	 * `ICDGroupEleApplicationSequence`, read off the live `AttackInfo`).
	 */
	icdGate?: IcdWindow;
	tags?: AbilityTag[];
	/** When this cast's own hits LAND, and what they apply. ⚓ An empty array is the
	 *  positive statement that the cast applies nothing; an absent field means we have
	 *  no reading. See {@link ElementalApplication}. */
	application?: ElementalApplication[];
	/**
	 * ⚓ THE CAST LANDS NO HIT (non-hitting casts round, 2026-09-16 — the twin of
	 * `NormalAbility.nonHitting`): its own animation queues no attack. No hit
	 * record (so no `onHit` stack, artifact or proc consumer hears it), and the
	 * buff derivation does not anchor an `onHit skill|burst` effect on the cast.
	 * `onCast` effects, summons and their tick series are untouched — a
	 * summon's ticks are the SERIES' hits, not the cast's, which is why Guoba's
	 * cast is non-hitting while Guoba is not.
	 *
	 * ⚠️ NOT the same claim as `application: []`, which says the cast applies no
	 * gauge — Emilie's E lands a Durability-0 hit and stays hitting. Lint demands
	 * an explicit `application: []` beside this flag so both claims are stated.
	 * A variant may override it with a boolean (Kujou Sara's C2 Ambush is a real
	 * cast-time hit on a press that lands nothing at C0).
	 */
	nonHitting?: true;
	/** Entities spawned by this cast with their own lifetimes. When present,
	 *  these supersede the ability's own `duration` for active-window rendering. */
	summons?: Summon[];
	/**
	 * ⚓⚓ THE CAST OPENS ONE WINDOW AND ITS SUMMONS ARE ALTERNATIVE OCCUPANTS OF
	 * IT (Arkhe round, 2026-09-04). Normally a cast spawns what its resolved
	 * variant says and that is settled for the life of the window. With this
	 * flag, a change in the state gating those variants mid-window REPLACES the
	 * occupant: the old summon ends at the flip, the new one spawns there and
	 * inherits the remaining duration. Furina's kit says it in those words —
	 * "The Salon Members and Singer of Many Waters share a duration, and when
	 * Furina uses her Charged Attack to change the guest type, the new guests
	 * will inherit the remaining duration" — and gcsim implements it as
	 * `if c.StatusIsActive(skillKey) { c.summonSinger(0) }` (`charge.go:61`).
	 *
	 * ⛔⛔ IT MUST BE OPT-IN AND THE GENERAL RULE WOULD BE WRONG. "Re-resolve a
	 * cast's summons whenever a gating state changes" sounds like the honest
	 * default and is not: a burst variant gated on `inStance` whose stance ends
	 * mid-window must keep the summon it spawned. A cast spawning a thing is the
	 * norm; a cast holding a slot something else can move into is the exception,
	 * and only a kit that says so may claim it.
	 *
	 * ⚠️⚠️ IT RE-RESOLVES AT STATE EDGES THE PARSE CAN SEE — a toggle or an
	 * opener — ⛔ NOT at a timed window's silent expiry, which fires no event.
	 * That is sound only because the gating state is itself a TOGGLE, which never
	 * expires; **lint enforces exactly that** (a `summonsFollowState` ability's
	 * variants must gate on a state some `toggle: true` spec on the same
	 * character opens). ⛔ Don't relax the lint without teaching the parse to
	 * schedule expiries.
	 *
	 * ⚠️ A replacement spawns with NO delay — gcsim passes 0, not the summon's
	 * own `spawnsAt` — and its tick cadence restarts from the flip. The bubble
	 * delay is the cast animation's, and there is no second cast.
	 */
	summonsFollowState?: true;
	variants?: AbilityVariant[];
};

/** Burst ability — same behavior split as skill, plus required energyCost. */
export type BurstAbility =
	| (BurstCommonFields & {
			behavior: 'instant';
			/** Post-action transient state opened at cast start. See
			 *  {@link TransientStateSpec}. */
			opensTransientState?: TransientStateSpec;
			/** Active-window span in seconds — see the twin on SkillAbility for
			 *  the full note. Declared on both so the accessor stays behavior-
			 *  generic; no burst needs it today. */
			activeDuration?: number;
	  })
	| (BurstCommonFields & {
			behavior: 'persistent';
			duration: number;
			durationModifiers?: DurationModifier[];
			persistentBehavior?: 'stationary' | 'follows';
			summonActivatesAt?: number;
	  })
	| (BurstCommonFields & {
			behavior: 'stance';
			duration: number;
			durationModifiers?: DurationModifier[];
			/** Dynamic event-triggered extensions of this stance window. See
			 *  {@link DurationExtension}. */
			durationExtensions?: DurationExtension[];
			terminatesOnSwap?: boolean;
			/** See SkillAbility `cooldownStartsAtStanceEnd`. Declared here so the
			 *  accessor can read it off a narrowed `CastAbility`; no burst stance
			 *  authors it today (both holders — Xilonen, Ifa — are skills). */
			cooldownStartsAtStanceEnd?: boolean;
			/** Additional named state opened when this stance is active. See SkillAbility opensState. */
			opensState?: State;
	  });

/** Convenience union for code that needs cooldown/frames-bearing abilities. */
export type CastAbility = SkillAbility | BurstAbility;

/** Ascension/utility passive. Description + optional effects. */
export type PassiveAbility = AbilityCommon & {
	abilityType: 'passive';
};

/** Constellation node. Description + optional effects + level. */
export type ConstellationAbility = AbilityCommon & {
	abilityType: 'constellation';
	constellationLevel: number;
};

/** Top-level ability union. */
export type Ability =
	| NormalAbility
	| SkillAbility
	| BurstAbility
	| PassiveAbility
	| ConstellationAbility;

/**
 * Variant override on a SkillAbility or BurstAbility (e.g. Bennett "Hold Lv.2").
 * Listed fields **replace** (not compose with) the base ability's values.
 * If a variant omits a modifier array, the base's array applies; if the variant
 * has one, the base's is fully overridden.
 */
export type AbilityVariant = {
	label: string;
	input?: Input[];
	frames?: FrameMap;
	cooldown?: number;
	cooldownModifiers?: CooldownModifier[];
	/** Overrides the base ability's behavior (e.g. Zhongli hE: instant skill → persistent shield). */
	behavior?: 'instant' | 'persistent' | 'stance';
	duration?: number;
	/** Active-window span for an INSTANT variant — the twin of the field on
	 *  SkillAbility/BurstAbility, and the variant-level override for it. Yun
	 *  Jin's hold levels each shield for a different length; Zhongli's hold
	 *  raises a 20s Jade Shield off a base whose own summon runs 30s. Sits
	 *  above the base ability's summons[] in `resolveActiveDuration`, so a
	 *  variant can shorten a cast the base ability would have drawn long. */
	activeDuration?: number;
	durationModifiers?: DurationModifier[];
	persistentBehavior?: 'stationary' | 'follows';
	summonActivatesAt?: number;
	/** Overrides the base ability's summons[]. */
	summons?: Summon[];
	/** Overrides the base ability's `application[]`. ⚠️ REPLACES it, like every other
	 *  variant array — a hold that lands different hits states all of them. */
	application?: ElementalApplication[];
	/** Overrides the base ability's `nonHitting`. A BOOLEAN here where the base
	 *  takes a literal `true`, because a variant must be able to RE-ENABLE a hit
	 *  the base withholds: Kujou Sara's press E lands nothing at C0 and a real
	 *  Ambush at C2. Resolution is `variant.nonHitting ?? base.nonHitting`. */
	nonHitting?: boolean;
	/** Overrides the base ability's `durationExtensions[]`. */
	durationExtensions?: DurationExtension[];
	terminatesOnSwap?: boolean;
	/** Overrides the base ability's `opensState`. Used when a Tap/Hold pair
	 *  opens different named states (e.g. Mavuika Tap-E ring vs Hold-E
	 *  bike-NS). The parser reads this when behavior resolves to "stance"
	 *  via the variant. */
	opensState?: State;
	/** Overrides the inferred damage tag for hits emitted from this variant.
	 *  Most commonly used to mark Hold-skill variants as `skillHold` so that
	 *  `TriggerFilter.damageTag = "skillHold"` selectively gates them
	 *  (Diluc Hold-E, Wriothesley Icefang Rush). When absent, the inference
	 *  helper auto-derives `skillHold` from variant input/label heuristics. */
	damageTag?: DamageTag;
	charges?: number;
	chargeModifiers?: ChargeModifier[];
	energyCost?: number;
	tags?: AbilityTag[];
	/** Gate on runtime state — the parser only resolves this variant when the
	 *  conditions hold definitively at cast time (e.g. Flins Thunderous
	 *  Symphony: `{ type: "state", state: "symphonyWindow" }`; Varka Four
	 *  Winds' Ascension: inStance + an elemental teammate). Absent = always
	 *  eligible on input match. */
	conditions?: Condition;
	/** Casting this variant closes the named transient-state window early
	 *  (gcsim `DeleteStatus` on cast — Flins Thunderous Symphony consumes
	 *  `symphonyWindow`; Varesa Volcano Kablam consumes `apexDrive`). */
	consumesState?: State;
	/** Burst variants only: this variant neither gates on nor writes the
	 *  character's burst cooldown clock (Flins Thunderous Symphony — gcsim's
	 *  ActionReady skips the CD check entirely while the window is active).
	 *  Absent = the shared clock applies: the variant waits for it and writes
	 *  its own resolved cooldown back (Varesa Volcano Kablam, 1s). */
	bypassesCooldown?: boolean;
	/** Effects this variant grants INSTEAD OF the base ability's — the same
	 *  override convention `summons` uses above, not a merge. Diona's hold-E
	 *  shield is 12s in place of the tap's 4.8s; an additive reading would put
	 *  two shields on one cast.
	 *  ⚠ SO A VARIANT THAT RESTATES ONE EFFECT DROPS THE REST. List everything
	 *  the variant grants, not only the values that changed.
	 *  ⚠ Read by the parser only since 2026-08-14 — before that these were live
	 *  in the Team Builder (deriveCapabilities walks variants) and dead on the
	 *  timeline, which is how five characters shipped a hold-E the planner drew
	 *  as a tap. See `effectsForCast` in utils/effectCollection.ts. */
	effects?: Effect[];
};

// ---------------------------------------------------------------------------
// Behavior-aware accessors
// ---------------------------------------------------------------------------
//
// These read fields that only exist on certain behavior variants of
// SkillAbility/BurstAbility, returning a sensible default when the field is
// absent. Use these in consumers that don't otherwise narrow on `behavior`.
//
// Resolution order: prefer `summons[0]` when present (canonical post-2026-04-28
// shape), else fall back to the legacy `behavior: "persistent"` fields. New
// curation should populate `summons[]`; old curation continues to work.

/** First summon owned by this ability, if any. */
export function getPrimarySummon(a: CastAbility): Summon | undefined {
	return a.summons?.[0];
}

/** Active-window duration in seconds. Reads `summons[0].duration` when present,
 *  else the legacy persistent/stance `duration`. 0 when no active window exists.
 *  ⚠ A STANCE reads its OWN `duration`, never its summon's (2026-09-22): the
 *  stance is the character's window and the summon is a thing left in the
 *  world, and the two lifetimes are independent — Nilou's Pirouette is 10s
 *  while the Tranquility Aura it leaves runs 12s (18 at C1), and the stance
 *  drew the aura's length for as long as this rung came first. One holder in
 *  the corpus; the summon lane reads `summonEndAt` and is unaffected. */
export function getActiveDuration(a: CastAbility): number {
	if (a.behavior === 'stance') return a.duration;
	const s = a.summons?.[0];
	if (s) return s.duration;
	// ⚠ `activeDuration`, never `duration`, on the instant branch — twelve
	// instant abilities carry a stray undeclared `duration` that no accessor
	// has ever read, and reading it here would grow twelve bars nobody
	// authored. See the field's note on SkillAbility.
	return a.behavior === 'instant' ? (a.activeDuration ?? 0) : a.duration;
}

/** Duration modifiers for the active window. Reads `summons[0].durationModifiers`
 *  when summons[0] is present, else the legacy `durationModifiers`. */
export function getActiveDurationModifiers(a: CastAbility): DurationModifier[] | undefined {
	// Same split as `getActiveDuration`: a stance's modifiers are its own,
	// and its summon's (Nilou's C1 +6s on the Aura) stay on the summon lane.
	if (a.behavior === 'stance') return a.durationModifiers;
	const s = a.summons?.[0];
	if (s) return s.durationModifiers;
	return a.behavior === 'instant' ? undefined : a.durationModifiers;
}

/** Frames from cast start until the active window begins. Reads
 *  `summons[0].spawnsAt` when present, else the legacy `summonActivatesAt`. */
export function getSummonActivatesAt(a: CastAbility): number {
	const s = a.summons?.[0];
	if (s) return s.spawnsAt ?? 0;
	return a.behavior === 'persistent' ? (a.summonActivatesAt ?? 0) : 0;
}

/** Mobility of the active summon: "stationary" or "follows". Reads
 *  `summons[0].mobility` when present, else the legacy `persistentBehavior`. */
export function getPersistentBehavior(a: CastAbility): 'stationary' | 'follows' | undefined {
	const s = a.summons?.[0];
	if (s) return s.mobility;
	return a.behavior === 'persistent' ? a.persistentBehavior : undefined;
}

/**
 * ⚓⚓ THE ONE SPELLING OF A RESOLVED STATE (summon-bound buffs round,
 * 2026-09-21). A state condition may qualify `duringSummon` by the cast kind
 * that spawned the summon, and the resolvers carry that as an EXTRA member of
 * the same `Set<string>` rather than a second field — `duringSummon` and
 * `duringSummon:burst` are both published when a burst summon is out.
 *
 * ⚓ That is what keeps the change free for the unqualified authors: a
 * `source`-less gate asks for the bare name, which is added exactly as before.
 *
 * ⛔ Never hand-write the `${state}:${source}` string — four call sites across
 * three files have to agree on it, and a typo resolves as `null` forever.
 */
export function stateKey(state: string, source?: 'skill' | 'burst'): string {
	return source === undefined ? state : `${state}:${source}`;
}

/** Duration-extension entries declared on the ability (stance behavior only).
 *  Returns the array as-authored, or undefined when the ability isn't a stance
 *  or has no extensions. The parser dispatches matching entries when their
 *  trigger fires while the window is active. */
export function getDurationExtensions(a: CastAbility): DurationExtension[] | undefined {
	return a.behavior === 'stance' ? a.durationExtensions : undefined;
}

/** True when the ability's stance window closes on swap. */
export function getTerminatesOnSwap(a: CastAbility): boolean {
	return a.behavior === 'stance' ? a.terminatesOnSwap === true : false;
}

/** True when the ability's cooldown clock starts at the STANCE END rather than
 *  at the cast — so `readyAt` is `stanceEnd + cooldown`, and an early exit
 *  brings the recast forward. Base-ability only: no variant overrides it,
 *  because the two holders open their stance from the base cast. */
export function getCooldownStartsAtStanceEnd(a: CastAbility): boolean {
	return a.behavior === 'stance' ? a.cooldownStartsAtStanceEnd === true : false;
}

/** True when the given ability is a stance burst/skill. */
export function isStanceAbility(a: Ability | undefined): boolean {
	if (!a) return false;
	if (a.abilityType !== 'skill' && a.abilityType !== 'burst') return false;
	return a.behavior === 'stance';
}

// ---------------------------------------------------------------------------
// G primitive helpers — damageTag inference + TriggerFilter evaluation
// ---------------------------------------------------------------------------

/**
 * Resolves the implicit damage tag for a hit emitted by the given ability +
 * variant. Most curation doesn't author `damageTag` explicitly; this helper
 * gives the renderer/lint a default value that matches the in-game tagging.
 *
 * Resolution order:
 *   1. `variant.damageTag` if explicitly set
 *   2. Heuristic Hold-detection on the variant (input contains "hE"/"h1E"/
 *      "h2E"/"pE" or label matches /hold/i) → `skillHold` for skill, but
 *      bursts stay `burst` since burst Hold variants are exotic
 *   3. Default per abilityType: normal/charged/plunge/skill/burst
 *
 * `hit.damageTag` (per-hit override) is read by the caller separately —
 * this helper produces the *ability/variant-level* default that per-hit
 * tags can refine.
 */
/** Does this (ability, variant) cast land NO hit? The variant's boolean wins
 *  when present (non-hitting casts round, 2026-09-16). Only a skill or burst
 *  can be non-hitting at the cast level; a normal ability answers per action
 *  class through `NormalAbility.nonHitting` instead. */
export function castIsNonHitting(ability: Ability, variant?: AbilityVariant): boolean {
	if (ability.abilityType !== 'skill' && ability.abilityType !== 'burst') return false;
	return variant?.nonHitting ?? ability.nonHitting ?? false;
}

export function getDefaultDamageTag(ability: Ability, variant?: AbilityVariant): DamageTag {
	if (variant?.damageTag) return variant.damageTag;
	if (ability.abilityType === 'normal') return 'normal';
	if (ability.abilityType === 'skill') {
		if (variant) {
			const inputs = variant.input ?? [];
			const isHoldInput = inputs.some(
				(i) => i === 'hE' || i === 'h1E' || i === 'h2E' || i === 'pE'
			);
			const isHoldLabel = /hold/i.test(variant.label ?? '');
			if (isHoldInput || isHoldLabel) return 'skillHold';
		}
		return 'skill';
	}
	if (ability.abilityType === 'burst') return 'burst';
	// passive/constellation hosts have no canonical damage tag
	return 'skill';
}

/**
 * Per-hit damage tag resolver: prefers the hit's explicit override, else
 * the array-position default ("normal" for hits[]; "charged" for chargeHits[];
 * "plunge" for plungeFrames-derived hits).
 */
export function getNormalHitDamageTag(
	hit: NormalHit,
	defaultTag: 'normal' | 'charged' | 'plunge'
): DamageTag {
	return hit.damageTag ?? defaultTag;
}

/**
 * Context passed to {@link evalTriggerFilter}. The fields describe the
 * candidate hit/cast against which the filter is checked.
 */
export type TriggerFilterContext = {
	damageTag: DamageTag;
	element?: Element;
	abilityName?: string;
	/** 0-based hit index for normals; absent for skill/burst single-hit casts. */
	hitIndex?: number;
	/** True when the hit is presumed to crit; the planner doesn't simulate
	 *  crit outcomes, so the renderer treats `isCrit: true` filters as
	 *  "fire optimistically" — the ctx.isCrit defaults true when crits are
	 *  the typical case (skill/burst snapshots), false otherwise. */
	isCrit?: boolean;
};

/**
 * Returns true iff the filter accepts the candidate hit context. Absent
 * filter (or absent fields within it) accept anything. Use this in the
 * renderer's onHit pass to gate per-cast / per-hit firing.
 */
export function evalTriggerFilter(
	filter: TriggerFilter | undefined,
	ctx: TriggerFilterContext
): boolean {
	if (!filter) return true;
	if (filter.damageTag !== undefined && filter.damageTag !== ctx.damageTag) return false;
	if (filter.element !== undefined) {
		const elements = Array.isArray(filter.element) ? filter.element : [filter.element];
		if (!elements.includes(ctx.element as Element)) return false;
	}
	if (filter.abilityName !== undefined) {
		if (!ctx.abilityName || !ctx.abilityName.includes(filter.abilityName)) return false;
	}
	if (filter.hitIndex !== undefined && filter.hitIndex !== ctx.hitIndex) return false;
	if (filter.isCrit === true && ctx.isCrit !== true) return false;
	if (filter.isCrit === false && ctx.isCrit === true) return false;
	return true;
}
