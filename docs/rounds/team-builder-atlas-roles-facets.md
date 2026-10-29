# Team Builder Atlas: roles and facets (July 2026)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

## Increment 1 — ✅ MERGED + PUSHED to `main` 2026-07-22 (`--no-ff` merge `dd00723`, feature `bc292aa`)

Built this session (Nate + Opus), refined per Nate's default-state feedback (below), Interruption-Res flipped to Support (Nate's call), then merged + pushed. All gates green (`npm run check` 0 errors, lint clean, 1230 vitest). Driven in headless Chrome each round; zero console errors. 24 files (7 mod + 7 new code + 10 icon SVGs).

**Refinement round (Nate feedback on the default state) — DONE + verified:**

- **Atlas is now self-contained** (Nate: "Atlas and Roster are separate tools on the same interface"). Clicking a front-door card drills to **inline character-tile rows** (the RP-alternatives row pattern: `tb-slotrow` header + `tb-grid` of `charTile`), NOT a pivot to the Roster tab. Support/Survivability → facet rows; DPS → element rows. Drill + slots both render in +page (tile handlers live there); `AtlasView.svelte` is now **cards-only**.
- **Cards = 2×2 grid, ~2-3× larger** (`repeat(2,1fr)`, min-height 210, 42px glyphs, fs-xl label). Monotone backdrop bumped to **0.2 opacity** (function-icon monotone per card).
- **"Other" card ELIMINATED.** The final two cards are **function-only** `Support` / `Survivability` (no position) — every character has ≥1 function so all are covered; Ifa (on-field non-DPS) lands in Support + Survivability. `RoleCategory.position` is now optional; `isCategorized`/`countUncategorized`/`showUncategorized`/`selectOther`/`selectDrillRow` + `RoleFilter.uncategorized` all removed. `ROLE_CATEGORIES` = onField-dps, offField-dps, support, survivability. `buildDrillRows` now returns `entries: CharacterIndexEntry[]` per row (no counts). Roster-rail Position/Function role chips retained (manual Roster-tool filter; Atlas no longer sets them).
- Verified: 2×2 cards (On-Field DPS 48 / Off-Field DPS 35 / Support 38 / Survivability 38), Support drill inline rows incl. Ifa, On-Field DPS element rows, RP slots intact.

---

### First-pass state (pre-refinement, for reference)

- **Data:** `docs/library/game/genshin-character-roles.csv` (122 rows; Nate sourced it from the fandom Character_Role table — Claude could NOT fetch fandom, it's blanket Cloudflare-blocked from Claude's tools: WebFetch→402, curl→403 challenge) → `scripts/generate-character-roles.mjs` (name→id via each JSON's `name`/`displayName`, **122/122 clean, zero unmapped**) → `src/lib/data/characterRoles.generated.ts` (`Record<id,{position[],function[]}>`, prettier-ignored). Shared pure parser `src/lib/data/parseRolesCsv.ts`; drift test `characterRoles.test.ts`; wired into predev/prebuild. Types `RolePosition`/`RoleFunction`/`CharacterRoles` in `character.ts`. **Roles join the roster by id — NOT on the eager index, NOT in deriveCapabilities (editorial, not derived).**
- **Role model** `team-builder/lib/roles.ts`: `ROLE_CATEGORIES` (4: onField-dps, offField-dps/support/survivability), `FUNCTION_FACETS` (drill grouping), `inCategory`/`isCategorized`, `RoleFilter`+`matchesRoleFilter` (splitRoster gained a 7th `roleFilter` param). Icons `src/lib/utils/roleIcons.ts` (color glyph foreground + monotone backdrop; slugs `on-fielder`/`off-fielder`/`dps`/`support`/`survivability`, `static/assets/roles/{color,monotone}/*.svg`).
- **Atlas** (`AtlasView.svelte` + `atlas.ts` builders `buildRoleCards`/`buildDrillRows`/`buildSlotAlternativeRows`/`countUncategorized`): 3 modes — **cards** (4 role cards: color glyphs + monotone backdrop + flat-color element counts + provides/owned), **drill** (Support/Surv→facet rows, DPS→element rows; role-scoped + con-gated), **slots** (RP `?team=` arrival→per-slot alternatives: same Element + Position-overlap + any-Function-overlap, minus self). "Other" catch→uncategorized (Ifa + role-less). Roster rail gained Position/Function role chips; shared `charTile` snippet DRYs roster/uncurated/slot grids. Citation line present. Nav split: cards+drill in AtlasView, slots rendered in +page (owns tile handlers).
- **Facets:** `infuse` + `interruptionRes` added to FacetKey/FACETS/BADGE_LABELS; interruptionRes needs its OWN `capMatchesFacet` branch (buffFamilyOf('interruptionRes')→'other', catches no buff:\*). Both already derived — pure vocabulary surfacing.

**STILL OPEN (deferred, not blocking):** (1) `offFieldDamage` omitted from the DPS drill — deferred "Off-Field DPS supersedes off-field DMG" call (Nate). (2) Slots view is RP-arrival-only (no manual entry when building a team in-tab) — leave unless Nate wants a toggle. (RESOLVED this session: Other-card removed via function-only Support/Surv; backdrop→0.2; 2×2 grid; **Interruption Res moved to the Support drill** — its providers Columbina/Gorou are Support-classed, Nate's call.)

---

**Status: DESIGN-SETTLED; INCREMENT 1 BUILT (uncommitted) 2026-07-22.** Emerged from a 2026-07-21 design conversation (Nate + Opus) after Team Builder redesign Phase 6. Supersedes/expands the "Atlas team-split" remaining item in `docs/rounds/team-builder-redesign-2026-07-20.md`. Builds on the data machinery in `docs/rounds/data-pipeline.md` and the constitution in `docs/rounds/team-builder-tool.md`.

## The 3-axis model (settled)

Imaginarium Theater's "Roles" are really **three different kinds of classification**, and the TB should adopt all three as its coarse layer, sitting ON TOP of our existing derived capability facets (which stay as the granular refinement layer):

1. **Element** — already have it.
2. **Position — On-Field / Off-Field** — NEW editorial field. Near-binary in practice (Mavuika is the _only_ current dual-classed character), so it's effectively a roster partition → a clean primary axis. Store as a **set** for the Mavuika edge.
3. **Function — DPS / Support / Survivability** — NEW editorial field. Multi-valued (Furina = all three). Store as a **set**.

**DECISION: import ALL FOUR dimensions (Position + the 3 functions) editorially from Genshin's IT table** rather than deriving them. Rationale (this replaced an earlier "derive Support/Survivability, skip DPS" idea):

- Support ≈ has-any-buff, Survivability ≈ has-heal/shield — these DO derive from our facets (Genshin's rule _is_ the rollup: buffers=Support, heal/shield=Survivability; healing alone ≠ Support unless they also buff — Bennett=Support+Survivability). BUT **DPS (on-field carry) does NOT derive** — it's editorial — and **Ifa** (the sole On-Field non-DPS: on-field swirler who heals+buffs) proves On-Field is a leaky proxy for it.
- Importing all three is consistent (one authoritative table), matches the roster/icons users recognize, and future-proofs the next Ifa/Mavuika. Deriving 2 + importing 1 risks our derived tag disagreeing with Genshin's authority for marginal gain.

**Two complementary layers:** Genshin Roles (coarse / editorial / authoritative / cited / icon'd) OVER our derived capability facets (granular / provenance / con-gated). Coarse→fine. Where they disagree (Genshin says Support, we derive no buff) = **free audit signal** — the Role import becomes the cross-check oracle for the curation pass below.

**Constitution guardrails:** Roles are **presence tags, cited to Genshin ("Imaginarium Theater roles"), NEVER ranked or scored.** "DPS" = "Genshin classes this a DPS," full stop — no damage numbers, no "best." That keeps it constitution-safe (it's Genshin's published categorization, not our verdict).

**Facet→function grouping (for CARD ORGANIZATION only, NOT classification — Genshin's table classifies):**

- Support: resShred, grouping, all buffs (atk/em/crit/dmg/hpdef), energy
- Survivability: heal, shield, cleanse, **taunt** (moved here from Support — taunt reduces damage taken; interruption-res is the stat for "attack without being knocked around")
- DPS: the damage layer; the `offFieldDamage` facet sits under it as the damage-as-team-utility atom.
  Because roles are imported, this mapping only decides which header a facet CARD sits under, so edge cases (taunt) are low-stakes cosmetic.

**Atlas wiring:** Position × Element = the primary axes AND the planner-arrival default (arriving via `?team=` shows the team's actual element×position combos — "different Hydro off-fielder" in one tap). Function = coarse chips / section headers. **Unclassified fallback** for pre-release/never-featured characters (no IT role yet) — honest "not yet classified" state, dovetails the uncurated-capability bucket. Ongoing: new characters need a role pass as featured.

## Facet exposure/expansion (data-grounded, counts over 122 chars)

**Key finding: mostly an EXPOSURE gap, not schema.** Our buff facets cover 5 families (atk/em/crit/dmg/hpdef); `buffFamilyOf` dumps everything else into an **"other" bucket that maps to NO facet**, so several derived buff stats are filter-invisible (still shown on the detail card — provenance honest — just not filterable).

- **Surface (ALREADY derived, ~free — one FACETS entry each):**
  - **Infusion** (`infuse` kind, derived w/ element detail; **4 providers**: Bennett, Dori, Kazuha, Lohen). Precedent that low counts qualify: **Cleanse is a facet at n=2.**
  - **Interruption Resistance** (`buff:interruptionRes`; **2 providers derived / ~6 real per Nate**). NOT a schema gap — an exposure gap + a coverage gap (missing ~4 are shield-implied or uncurated). Surface + curate.
- **Net-new granular filters (schema/effect-model + curation):**
  - **PLANNED:** **DMG Reduction** (mitigation, unmodeled) + **ATK Speed** — combat-relevant (Nate corrected the earlier QoL read: real combos change depending on whether ATK-speed is available, e.g. Varka's signature weapon; the _lesson_ holds even though we don't model that specific weapon).
  - **SHELVED (may implement later, currently leaning NOT):** Movement Speed, Stamina Consumption Reduction — QoL/exploration-leaning, low combat payoff vs. added curation surface.
  - Batch whatever's greenlit into ONE effect-union extension + ONE curation sweep.
- **STUB (modeled-but-unsurfaced, ≤2 providers, no facet, visible on detail card):** `defIgnore`, `healingBonus`, `allElementalRes`, `physicalRes`, `baseAtk`. Explicitly **NOT** an "Other buffs" catch-all (recreates the meaningless-bucket problem).

## Curation pass (planned)

Survey each sub-category (facet) roster vs **Wiki tables**; strategically curate mismatches. Plugs into existing machinery: `audit-capabilities.mjs` + the `capability-expectations.mjs` fixture (extend with Wiki-sourced expectations per sub-category), with the newly-imported **Genshin Roles as the cross-check oracle**. First concrete target: Interruption Res 2→6.

## Sequencing (CONFIRMED by Nate 2026-07-22 — Increment 1 is the NEXT session)

**Partially loop, in order — do NOT chain the bounded UI work to the open-ended curation:**

- **Increment 1 (bounded — the next session):** import the Roles table + wire the 3-axis Atlas + add the **role icons (Nate has them PREPPED)** + surface Infusion & Interruption Res (both already derived → they're just new Atlas cards). Ship this WITHOUT waiting on curation. **This is a self-contained one-session job — icons + editorial role-assignment + Atlas wiring are one clean editorial-tag/UI increment; do NOT bundle it with curation work.**
- **Increment 2 (open-ended data wave, a LATER session):** net-new facets (DMG-Reduction/ATK-Speed/Move-Speed/Stamina — batched schema extension) + the Wiki-cross-check curation pass, using the imported Roles as the audit oracle. This is data-curation mode (gcsim/Wiki verification), a DIFFERENT work mode — bundle it with other curation, never with the Increment-1 UI work.

Rationale for Roles-first + keeping them separate: importing Genshin's functional roles GIVES the "Genshin says Support, we derive nothing" mismatch list that makes the LATER curation strategic (measure, then cut) instead of exhaustive; and the editorial-import is bounded (one authoritative table → tags + icons + Atlas), whereas curation is open-ended — chaining them would let the open-ended work drag out the shippable UI.

## Increment-1 prep (for the next session)

**Nate brings:** the role icons (prepped) + the Genshin **Imaginarium Theater Roles table** he's sourcing (per-character Position [On/Off-Field] + Function [DPS/Support/Survivability]). **Session opens plan-mode-first** with a scan of: `deriveCapabilities.ts` + the FACETS/facet config, the eager index (`characterIndex.generated.ts` — where editorial Position/Function likely ride, alongside the derived capability summaries), and the Team Builder **Atlas** builder component (`src/routes/(scene)/(tools)/team-builder/` — Phase-4 Atlas cards). Decide: where the editorial fields live (character JSON vs a sidecar table vs index-only), how icons load, the 3-axis Atlas layout (Element × Position primary + planner-arrival default via `?team=`; Function = chips/headers), and the **Unclassified** fallback for pre-release/never-featured chars. Constitution guardrail: roles are cited presence-tags ("Imaginarium Theater roles"), NEVER ranked.

## ⚠️ TODO (Opus owns) — `probe-team-builder.mjs` Atlas coverage regressed

During the CharacterCard unification (`055763a`, 2026-07-23) Claude found the probe's Atlas section was stale from the Increment-1 role redesign: it referenced the retired `.atlas-card` (now `.rolecard`, 4 cards). Claude fixed navigation (it now asserts 4 role cards + reaches the roster via the **Roster tab**) so the probe runs green — BUT Claude **removed the old "click an atlas card → filtered roster" PIVOT assertion** rather than invent role-model numbers on the spot. **Follow-up: add a proper role-drill assertion** — click a `.rolecard` → assert `atlasMode='drill'` → the `.tb-grid` shows a role-filtered subset (pick a stable role + a plausible count range, or assert a known character is present/absent). Small, self-contained; do it alongside any Atlas Increment-2 work or as a standalone probe pass. (Also fixed same-day: the probe's uncurated-bucket assertion — now empty post two-tool-split — and probe-traveler-avatars' Roster-tab nav + `.cc-img`/`.sp-segment-opt` selectors.)
