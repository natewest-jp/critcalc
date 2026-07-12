# Team Builder — Design Brief

*Concept approved by Nate 2026-07-12. This is the design reference for the tool's build-out.*

## One-line pitch

**The Rotation Planner answers "when"; the Team Builder answers "who."**

## Core thesis: index by question, not by character

Every wiki is character-indexed ("tell me everything about Kokomi"). Every tier list is
verdict-indexed ("who's best"). Nothing in the ecosystem is **question-indexed**:
*"who can heal my team while off-field, at the constellations I actually own?"*

critcalc is uniquely positioned to build this because it's the only site sitting on
machine-readable, curated effect data. Wikis store prose; we store structure.
Capabilities are **derived from effects, with provenance** — never hand-maintained labels:

- **"Heal — Q, team-wide, C0"** vs **"Heal — C6 only"**
- Clicking a capability badge shows the ability + condition that grants it (receipts)

This derivation-with-provenance is the anti-tier-list. Tier lists say "healer (kinda)";
we show *why*, and at which gate.

### What the data already supports (verified 2026-07-12)

- `tags: AbilityTag[]` (`heal`/`shield`/`summon`/`taunt`/`coordinatedAttack`) authored on 119/121 character files
- Structured effect types: `heal`, `shield`, `resShred`, `buff` (with stat keys), `energy`
- Effect targets: `self`/`team`/`teamExcludingSelf`/`active`/`next`
- Condition trees with constellation gating → "from which C" is derivable
- Identity facets complete from genshin-db: `element`, `weapon`, `rarity`, `region`, `factions`

## Three layers, each independently shippable

### Layer 1 — Find (roster + capability filter) · **MVP**

Full-roster grid with two facet kinds:

- **Identity facets:** element, weapon type, rarity, region/faction (top-level `CharacterData` fields)
- **Capability facets (derived):** heals, shields, res shred, buffs-stat-X (ATK/EM/CD/…),
  off-field damage (summons/coordinated attacks), taunt, Natlan/NB, Moonsign

**Killer personalization:** the site-wide `constellations` store already exists. Filter gets a
three-way mode — **"at C0" / "at my constellations" / "at max C"**. "Who heals *for me*"
becomes answerable. No wiki knows your roster.

Click-through → detail card: fresh component, inspired by (not copied from)
`RotationCharacterPanel.svelte`. Mechanical reference only — windows, costs, triggers, gates.

**First-class deliverable: coverage audit script.** Characters whose `tags` claim a capability
but expose no derivable effect (and vice versa). A filter that silently omits a real healer is
worse than no filter. The audit's output is the curation backlog.

### Layer 2 — Compare (aligned cards + uptime glyphs)

Select 2–4 characters; cards align **by row**, not just side-by-side: E cooldowns on one line,
Q energy costs on one line, buff windows on one line. Juxtaposed cards make you saccade;
aligned rows make differences pop.

**Uptime glyphs:** render each buff/uptime as a tiny static bar reusing the planner's
three-phase bar language (solid uptime / dim continuation / ghost CD), all at the same time
scale. "This buffer's uptime is worse" becomes something you *see*, not a percentage verdict.
Reuses a visual vocabulary users already learned in the planner.

### Layer 3 — Assemble (team slots + cross-injection)

Four slots across the top. Filling them derives team-level **facts**:

- Elemental resonance, faction bonuses (`TeamBonusesBlock` logic exists), NB eligibility, Moonsign
- **Coverage checklist:** healing ✓, shield ✗, off-field damage ✓, res shred ✗
  — a checklist of present/absent capabilities is *exposing facts*; a synergy score would be
  a *verdict*. Stay on the checklist side.

**Cross-injection** via URL state (`?team=a,b,c,d`):

- Team Builder → Planner: "Open in Rotation Planner," characters pre-populated
- Planner → Team Builder (the sneaky-good direction): **"replace this slot"** opens the
  Team Builder with filters *pre-seeded from the outgoing character's capabilities*.
  Swapping Bennett out → arrive at a grid already filtered to healers-who-also-buff-ATK.

## Constitution boundaries (settled — see tool constitutions)

Never: team suggestions, synergy scores, rankings, tier lists, damage anything.
Also never: **full kit text dumps** — the moment the card reproduces wiki prose it becomes
the carbon copy we're trying not to build. Scaling tables are decorative reference only;
never aggregated.

## Honest constraints

- The capability index is only as complete as curation. Some heal/shield facts live in
  `_todo` stubs or `manual` effects and won't derive. The coverage audit keeps the filter honest.
- Effect-derived facets need the audit; identity facets (genshin-db) are complete.
- 9 pre-release characters unauthored (see curation plan).

## Sequencing (decided 2026-07-12: build-first)

1. This brief (done).
2. **Build Layer 1** on a fresh branch off `main` (NOT off `redesign/rotation-planner`),
   with the coverage audit script as a first-class deliverable. Record JSON-shape pain
   as it's hit — this build is the shape evaluation.
3. **Targeted curation pass** driven by the audit's output (replaces a broad pre-emptive sweep).
4. Layers 2 and 3 as follow-on slices.

Rationale: curation value is defined by what a tool consumes ("visualize decision-relevant
mechanics, stub the rest"). The Team Builder is the first consumer of `tags`, heal/shield
targets, scaling-as-display, energy-as-reference, and constellation gates as filterable facts.
Building it *is* the audit. The new-character-ingress recipe stays decoupled, but the audit
script effectively defines "complete character" — the spec that recipe needs.

## Open design questions (for build time)

- Roster grid density: portrait tiles vs compact rows? (Selector overlay in the planner is
  precedent for tile grids.)
- Where capability badges live on the tile vs only in detail card
- Buff-stat facet granularity: one "buffs allies" facet with stat drill-down, or top-level
  facets per stat?
- Detail card scope: how much of the planner panel's variant/effects chip language carries over
- URL param shape shared with planner (`?team=` — coordinate with planner's share-URL format)
