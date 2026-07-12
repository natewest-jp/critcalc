# Team Builder — Data & Schema Notes

Observations collected while building the capability-derivation layer
(2026-07-12). Companion to the regenerated `capability-audit.md` (the
mechanical backlog); this file is the _judgment_ layer — what the gaps mean
and which are schema questions vs. plain authoring work. Feed into the
character-JSON evaluation pass.

## Schema is largely sufficient — the gaps are authoring gaps

The `Effect` union (heal/shield/resShred/buff/energy/infuse), `tags[]`,
`constellationLevel`, and the `Condition` tree together express everything
Layer 1 needs. Almost every audit finding is _unauthored data_, not an
inexpressible shape. The big buckets:

1. **Heal/shield tags without effects (36 abilities).** Tags answer the facet
   ("Barbara heals") but carry no target/scaling for the detail card. Fine for
   Layer 1; authoring `heal`/`shield` effects on the ~20 dedicated
   healers/shielders is the highest-value curation batch for Layer 2's
   comparison rows (heal scaling side by side).

2. **`coordinatedAttack` tags missing on the classic off-fielders** —
   Xingqiu Q, Beidou Q, Xiangling (Guoba + Pyronado), Yae E, Furina salon,
   Kuki ring, Nahida Tri-Karma, Albedo flower. Their summons are modeled
   without damage-tick effects (P4 event-stream territory), so the tag is the
   cheap honest signal. One-line fixes; audit lists them all.

3. **Dedicated healers whose kits predate effect curation** — Jean (burst
   heal missing; only A1 on-hit heal authored), Diona (burst heal missing
   entirely), Kuki (E ring heal missing), Dori (C0 burst heal missing),
   Charlotte (full stub). These made the tier-curation cut for _planner_
   value (buffs); their healing wasn't decision-relevant there. It is now.

## Actual schema questions (for the JSON evaluation)

- **No `cleanse` vocabulary.** "Who can cleanse Electro-Charged / Corrosion?"
  is a real team-building question (Barbara E, Kokomi Q, Sigewinne, Jean Q…)
  and nothing in `AbilityTag` or `Effect` can express it. Cheapest shape: add
  `'cleanse'` to `AbilityTag`. An effect form (which element classes, self vs
  team) is over-modeling until a tool needs it.
- **No grouping/CC vocabulary.** "Who groups enemies" (Venti Q, Kazuha E,
  Sucrose) is the other classic facet with no home. Same recommendation:
  tag-level first.
- **Interruption-resistance buffs aren't a `Stat`.** Xingqiu E, Yun Jin,
  Layla etc. grant interruption res; today it's droppable text. A
  `interruptionRes` stat key would make it a buff like any other — but check
  how many planner-side renderers assume the current stat vocabulary first.
- **Particle generation / battery-ness is not modeled** (constitution calls
  energy data reference-tier). A "battery" facet (Fischl, Raiden E,
  Favonius-style funneling) would need per-ability particle counts — real
  authoring cost, KQM data exists. Post-launch decision; noting demand.
- **`heal` target semantics ambiguity found:** Hu Tao Q authored
  `target: "team"`; in-game it heals only herself. One-line fix if confirmed —
  but worth a convention note: for on-hit self-heals, `self` is the honest
  target even when the description says "restores HP" generically.

## Derivation-layer conventions established (for future reference)

- Constellation gate = explicit `constellationLevel` (authored on all 708
  entries) with positional fallback; effect `conditions` compose on top
  (max of host gate and condition gate).
- 3-valued condition probe: runtime-dependent leaves (state, stacks, HP
  thresholds, team comp) become **caveats** on the capability, not blockers —
  mirrors `evalCondition` semantics for static leaves. Kept runtime-import-free
  so Node scripts execute it via native type stripping.
- Trust signal = `isCurated` (frame-level). Effect scraps on stubs
  (Charlotte C1) must NOT mark a character as capability-curated — the UI
  buckets uncurated characters separately rather than letting facets
  silently exclude them.
- `characterLint` now enforces condition-tree shape (`condition-shape`,
  strict) — a `{all: [...]}` node without `type` shipped on Skirk C2 and
  evaluated as nothing everywhere, silently.

## Fixture maintenance

`scripts/capability-expectations.mjs` is game-knowledge ground truth
(Fable-authored 2026-07-12, pending Nate review — `confidence: 'check'`
entries first: Aino heal, Lauma C0 heal, Hydro Traveler heal, Sigewinne
shield gate, Hu Tao heal target). Extend it when new characters land — the
audit's "derived but not in fixture" section lists candidates (most are
correct summon-tickers: Zhongli stele, Escoffier turret, Citlali itztli).
