# Schema Gaps — Design Proposal (faction-forward, 7.x-ready)

_Drafted 2026-07-14 after the Nod-Krai / Moonsign curation wave (columbina,
durin, nicole, ifa, illuga, sandrone, zibai). Those kits surfaced a cluster of
mechanics the curation agents flagged as unmodelable. Genshin 7.x is expected
to keep adding factions + faction-gated effects, so the priority is a **general,
extensible faction / party-state framework**, not one-off stats._

## Framing (the constitution still governs)

critcalc **visualizes mechanics; it never computes damage.** A primitive earns
its place when it lets a mechanic _show_ correctly — a Team Builder capability
facet, a planner buff/debuff row, or a conditional gate — **not** to make
numbers add up. That rule keeps this list short: several "gaps" need only a
_renderer/derivation_ extension, not a new data primitive.

## What already exists (build on it — don't reinvent)

The 2026-07-14 agents flagged several things as "no primitive" when one already
existed. **First, cheapest fix: teach the ingest-character skill to reach for
these**, so future waves author them instead of stubbing:

| Mechanic | Existing primitive |
| --- | --- |
| Faction membership + gating | `CharacterData.factions?: string[]` (`moonsign`, `hexerei`), `Condition.teamFaction {faction, min}`, `activeCharFaction {faction}`, parser `teamFactionCounts` map |
| Reaction DMG bonus (Lunar, Swirl, EC, …) | **`elevate` Effect** with a `reactions: Reaction[]` filter — the general reaction-DMG primitive (already used for Flins/Lauma/Linnea/Nefer) |
| Per-reaction stats | `lunar{Charged,Bloom,Crystallize}DmgBonus`, `lunarCrystallizeFlatDmg`, element `*CritDmg` |
| Moonsign lane render | `computeMoonsignRows` (timeline) |
| Threshold-offset / capped scaling | `perStack` has `threshold`; `scaling` has `cap` |

The `Reaction` union already carries `pyroSwirl…electroSwirl`, all crystallize
variants, `electroCharged`, and all three `lunar*`. So **ifa's Swirl /
Electro-Charged buffs and columbina's Lunar buffs were authorable as `elevate`
today** — the agents used ad-hoc `lunar*DmgBonus` stats because the _renderer_
(below, G3) doesn't yet surface multi-reaction / non-lunar elevate.

---

## The gaps, tiered by strategic value

### Tier 1 — Faction / party-state (the 7.x core)

**G1. Moonsign _level_ vs member count.** `teamFaction {faction:'moonsign', min:2}`
gates on **member count**. Real Moonsign is a party **level** = contributing
members **+ benediction bonuses** (columbina/illuga/zibai each raise party
Moonsign +1). A 1-Moonsign-member team + a benediction can hit Ascendant Gleam;
the member-count proxy under-reports it.

> **Proposed shape — unify membership and level under one contribution model.**
> Add an optional per-character contribution map; make `teamFaction.min` resolve
> against the **sum of contributions**, not the raw member count:
>
> ```ts
> // CharacterData
> factions?: string[];                        // membership; each = +1 by default
> factionContributions?: Record<string, number>; // extra/benediction contributions
> //   columbina: { moonsign: 1 }  → +1 on top of her own membership
> ```
>
> `teamFactionCounts[faction] = Σ(members' 1) + Σ(factionContributions[faction])`.
> Backward-compatible: pure-membership factions (hexerei/Hexenzirkel) are
> unaffected (no contributions → count == members). Moonsign "Ascendant Gleam"
> stays `teamFaction {faction:'moonsign', min:2}` but now counts benedictions.
> **7.x-ready:** any future "party-level derived value" faction slots in with zero
> new condition types.
>
> _Alternative:_ a dedicated `{type:'moonsign', min}` condition. Rejected — it
> doesn't generalize, and the contribution model handles Moonsign _and_ the next
> faction-resource mechanic with the same machinery.

**G2. Per-count buff _scaling_.** zibai A4 (+15% DEF per Geo member, cap +45),
durin/varka (per-Hexenzirkel-member), most "per member" buffs are authored at
the single-member amount because no BuffValue scales by a team count.

> **Proposed shape — a `perTeamCount` BuffValue** (mirrors `perStack`):
>
> ```ts
> | { type: 'perTeamCount';
>     count:                                  // what to count
>       | { faction: string }                 // per Hexenzirkel member / Moonsign level
>       | { elements: Element[] };            // per Geo teammate (excl-self semantics
>                                             //   already defined for teamElementCount)
>     per: number | ScaledValue;              // value per unit
>     cap?: number; }                         // final-contribution cap
> ```
>
> zibai A4 → `{type:'perTeamCount', count:{elements:['geo']}, per:15, cap:45}`.
> Resolves definitively in the planner (team known); TB detail card shows the
> "+15%/member (max +45%)" formula. Reuses the `teamElementCount` exclude-self
> rule.

### Tier 2 — Reaction DMG (mostly renderer work) — ⛔ ON HOLD (2026-07-14)

> **Frozen pending Nate's review.** Do NOT author `elevate` / reaction-DMG-bonus
> effects, touch the elevate renderer, add reactions to the union, or re-author
> ifa/columbina until Nate has studied the reaction/elevation model and cleared
> it. The analysis below is the standing proposal for when that happens.

**G3. `elevate` renderer/derivation only handles single-reaction _lunar_.**
Per the `elevate` JSDoc, multi-reaction arrays (columbina "all lunar") and
non-lunar reactions (Swirl, EC) aren't rendered as buff rows or mapped to
capability facets. This is the **highest-value, lowest-risk** fix: the data
primitive already exists, so fixing the renderer + `deriveCapabilities` unlocks
reaction-DMG visualization across the whole reaction space at once.

> **Proposed work (no schema change):** extend the elevate→display-stat mapping
> to (a) handle `reactions.length > 1` (render one row labelled by the reaction
> set, or one row per reaction), and (b) synthesize a display stat for non-lunar
> reactions (`swirlDmgBonus`, `electroChargedDmgBonus`, …) for formatting only.
> Then **re-author ifa/columbina** from ad-hoc lunar stats to `elevate` (a
> follow-up curation touch, not a re-curation).

**G4. `stellarConduct` missing from the `Reaction` union** (sandrone's Polestar
Field). Also durin's vaporize/melt reaction-DMG amps have no `*DmgBonus` stat.

> **Proposed shape:** add `stellarConduct` (and any confirmed 7.x reactions) to
> `Reaction`. Then Stellar-Conduct DMG bonuses are just `elevate {reactions:
> ['stellarConduct']}` — no new stat needed once G3 lands. Same for durin's
> vaporize/melt via `elevate {reactions:['vaporize','melt']}`.

**G5. Reaction-_multiplier_ bonus vs DMG bonus.** columbina's +40% "Lunar
Reaction DMG Bonus" is gcsim `AddReactBonusMod` (raises the reaction's base
multiplier), mechanically distinct from `elevate` (post-bracket `damage *= 1+e`).

> **Recommendation: do NOT add a separate primitive.** For a
> visualize-don't-calculate tool, both read to the player as "+X% to [reaction]
> damage." Author as `elevate` with a `_curatorNotes` line noting the gcsim
> mechanic. Revisit only if we ever surface damage math.

### Tier 3 — DEF interaction

**G6. DEF shred** (enemy DEF reduction debuff — durin White-form −30% enemy DEF).
`resShred` covers elemental RES only.

> **Proposed shape — generalize `resShred` rather than add a twin.** Today
> `resShred` implies "enemy elemental RES." Add a discriminator so the same
> Effect covers DEF:
>
> ```ts
> // resShred effect gains:
> shredStat?: 'res' | 'def';   // default 'res' (back-compat); 'def' = DEF shred
> ```
>
> TB shows it as an enemy-debuff capability; planner shows a debuff row. Keeps
> one code path for "enemy stat reduction." _Alternative:_ a parallel `defShred`
> Effect type — rejected as duplicative (identical target/trigger/stacking).

**G7. DEF ignore** (attacker ignores % of enemy DEF — nicole C6, durin burst).
This is an **attacker-side** property, not an enemy debuff.

> **Proposed shape — a new `defIgnore` Stat** (a `buff` effect target self/team/
> active). Renders as a buff row / TB "DEF ignore" facet. Distinct from G6 (which
> reduces the enemy's DEF for everyone); DEF-ignore benefits only its recipients.

### Tier 4 — on-demand (author when the next case lands)

- **G8. Element-scoped flat DMG** (`geoFlatDmg` for illuga's Nightingale's Song
  base Geo portion). Extends the existing FlatDmg family; `lunarCrystallizeFlatDmg`
  is the precedent. Add the specific key when authored.
- **G9. `scaling` threshold offset** (prune A4: +0.025%/ATK **above 2000**). Add
  optional `threshold` to the `scaling` BuffValue, mirroring `perStack.threshold`.
- **G10. Per-N-stacks-consumed trigger** (illuga C2 "per 7 Nightingale's Song
  consumed"). Lower priority — needs frames anyway; revisit at frame-curation.

---

## Recommended sequencing

1. **Docs-only (today):** add an "existing faction/reaction primitives" box to the
   ingest-character skill so future waves author `elevate` + `factions` + `teamFaction`
   instead of stubbing. Prevents the recurring false-"no primitive" flags.
2. **G3 (renderer/derivation):** unlock multi-reaction / non-lunar `elevate`. Highest
   value per unit effort; no schema change; unblocks re-authoring ifa/columbina.
3. **G4 + G1 + G2 (faction/reaction data model):** `stellarConduct`; the
   `factionContributions` + summed-`teamFaction` Moonsign-level model; `perTeamCount`
   BuffValue. This is the 7.x-facing investment.
4. **G6 + G7 (DEF):** `resShred.shredStat` + `defIgnore` stat.
5. **G8–G10:** on demand.

Each step is independently shippable behind the standard gates (vitest lint/parse/
derivation, `condition-shape`, capability audit). Re-authoring touches (ifa/columbina
→ elevate; durin/nicole DEF) are small per-character follow-ups, not re-curations.

## Decisions (Nate, 2026-07-14)

1. **Moonsign level model** — ✅ **Unified `factionContributions` + summed-`teamFaction`**
   (generalizes to 7.x; no new condition types). Implement G1.
2. **DEF shred** — ✅ **Generalize `resShred` with `shredStat: 'res'|'def'`** (default
   `'res'`, back-compat). Implement G6. Companion `defIgnore` stat (G7) approved as the
   attacker-side counterpart.
3. **Reaction DMG / elevation** — ⛔ **ON HOLD.** Nate is studying the reaction/elevation
   model first. Do not author `elevate`, touch its renderer, add reactions, or re-author
   ifa/columbina until cleared. (All of Tier 2 + G4/G5 frozen.)

## Implementation order (approved, unblocked scope)

G6 + G7 (DEF: contained, clear test cases — durin −30% enemy DEF, nicole/durin DEF
ignore) → G1 (faction contribution model: character field + parser `teamFactionCounts`
sum + moonsign-benediction data on columbina/illuga/zibai) → G2 (`perTeamCount`
BuffValue) → G8–G10 on demand. Each lands independently behind the standard gates,
paired with authoring the flagged effect that motivated it as its test case.
