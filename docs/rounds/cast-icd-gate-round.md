# The cast-ICD-gate round — record (2026-09-17, branch `engine/cast-icd-gate`)

_Round 3 of the post-tranche engine queue (order ⚓ Nate-approved 2026-09-17;
rounds 1–2: `docs/rounds/buff-pool-round.md`, `docs/rounds/small-fix-bundle-round.md`). The
remaining half of the essential-characters backlog's §1.A: a cast's
`application[]` always ran on the STANDARD ICD. `noICD` (the "every hit" half)
had landed at L4d; this round adds the WINDOW half and the per-hit exception._

## 1. The primitive

- **`CastAbility.icdGate: IcdWindow`** — the cast-side twin of
  `NormalAbility.chargedIcdWindow` and `summonTick.icdGate`, translated by the
  same `icdParamsFor`, so the three authored shapes cannot drift.
  `resolveActionIcd` honours an authored window for `skill`/`burst`; a normal
  swing still cannot carry one. `noICD` wins when both are set (lint refuses
  the pair).
- **`ElementalApplication.noICD: true`** — ONE hit on NO counter: gcsim's
  `ICDTagNone` on a hit inside a cast whose other hits share a group. It
  applies and never reaches the clock, so the rest count as if it were not
  there. ⚠️ Also the one-hit approximation of a hit on its OWN group (the Hydro
  Traveler's finale on the default group): one hit on a counter of its own
  applies once, which is what "always" says for one hit.
- **Lint D.27c**: `timer` in FRAMES (≥ 6; the neighbour `application[].frame`
  is in frames, so the trap is a copied `interval` of 1.5); ⛔ `noICD` beside
  `icdGate`; ⛔ a gate on a list under two entries; ⛔ an entry flag beside the
  ability's `noICD` or on a one-entry list.

## 2. The evidence, and where it is read

⚓ **A gate is read off gcsim's group tables, ⛔ never inferred from an applied
count** (icd-group-round §9: an applied count says only THAT the default is
wrong). The frames audit now prints a CAST stream's cadence: §4 carries a
`gcsim cadence` column (the same `streamIcd` / `icdGateFor` the summon
cross-check uses, over the cast hits, off the dumper's `OnEnemyDamage`
probe) and **§4b** lists the casts whose rule the default does not reproduce,
with the authored gate beside it — the cast-side twin of §5b. ⚠️ A row
marked **mixed** is two groups under one ability; that is what the per-entry
`noICD` is for, and it wants the gcsim source read, not the table copied.

## 3. Authored (six), each verified hit for hit at its site

| cast                                   | gcsim group                                                       | gate                                 | before → after (applications)                                                               |
| -------------------------------------- | ----------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------- |
| Arlecchino, All Is Ash                 | `ArlecchinoElementalArt` 600f every 3; the Cleave `ICDTagNone`    | `{600, every 3}` + entry +38 `noICD` | 17 · 638 (Cleave lost) → 17 · 38 · 638, +338 suppressed — §1.A's "we do the reverse" closed |
| Dori, Alcazarzaray's Exactitude        | `DoriBurst` 180f first only                                       | `{180}`                              | every third of 32 (11) → +28 · +220 · +412 · +604                                           |
| Sigewinne, Super Saturated Syringing   | `SigewinneBurst` 114f first only                                  | `{114}`                              | +99 · +174 → +99 · +224                                                                     |
| Hydro Traveler, Aquacrest Saber (hold) | `TravelerDewdrop` 90f first only; the finale on the default group | `{90}` + entry +372 `noICD`          | every third of 24 → +61 · +151 · +241 · +331 · +372                                         |
| Diluc, Dawn                            | `Diluc` 300f every 5                                              | `{300, every 5}`                     | byte-identical on three entries (the rule, for a fourth)                                    |
| Odette, Coda at Dawn's Tolling         | `OdetteDanceDuo` 180f first only                                  | `{180}`                              | byte-identical on three entries                                                             |

Corpus digest: **2 of 252** move (dori@C0/C6) — the others reach one E and
one Q where the digest cannot tell. §4b reads ✅ authored on all six after
regeneration. ⛔ The backlog's other §1.A names are not this round's:
Mizuki's cloud and Chevreuse's mines are SUMMONS (`summonTick.icdGate`,
already authorable), Varka's Q is `noICD` (done at T0.5), Cyno's bolts did
not surface in §4b (their stream measures standard or none).

## 4. Not done, on purpose

- **The Durability-0 lint** §1.A proposed ("refuse an entry with no `units`
  and no durability source"): the phantom pills were removed by hand across
  the tranches, and a lint on absent `units` would fire on the 300+ honest
  unmeasured entries. If it returns it needs a source column, not a rule.
- **A per-entry `icdGate`** (an entry on a DIFFERENT group, not merely off
  the counter): three "mixed" rows were all expressible with the boolean; the
  next one that is not decides the shape.

## 5. Commits

`cdca6e0d` the primitive + lint · `bd6d9de2` the audit's §4 column + §4b ·
`8d3c0a3a` the six casts. Gates: vitest 1870/1870, check, lint, build; e2e
before the merge.

## 6. Queued from here (round 4 →)

`onStack` reader (Columbina) → cooldown-reduction round → `Summon.conditions`
→ `terminatesOn` a different cast → `onSwapIn` / `onCast` ability binding.
Still needing Nate's words: the stance-cancel token, the Radiance window.
