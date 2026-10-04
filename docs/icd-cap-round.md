# The ICD cap round — record (2026-10-04, branch `fix/icd-cap-round`)

_Queued by the ICD Timeline pass (`docs/icd-timeline-pass-2026-10-04.md`), which found
the frames audit misreading Chevreuse's Burst. ⚓ Nate: make the Planner's ICD solid
before the remaining instrument passes. gcsim pinned at `488e22309` for the whole round
(⚓ Nate: 63 commits behind origin; sync as its own step)._

## 1. The audit was wrong in three ways, all tooling

| defect                                    | where                                  | effect                                                                                                                                                                                                                                                    |
| ----------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hits married by `(frame, abil)`           | dumper: `applied` map + ICD probe      | two hits in one frame under one ability string shared ONE reading — Chevreuse's two frame-101 shells both read applied (gcsim applied one). Report-wide: **10 cast applications and 6 Fiery Rain ticks gcsim never made** (Amber's Q read 13/18, is 7/18) |
| A cast reduced to its first hit's cadence | audit: `streamIcd` over the whole cast | Chevreuse's Burst opens on an `ICDTagNone` grenade, so it read `none` and was missing from §4b                                                                                                                                                            |
| `mixed` dropped on `none`                 | audit: `fmtIcd` early return           | the one flag that would have shown it                                                                                                                                                                                                                     |

Plus a labelling one: `[icd]` meant "not applied", so a hit with **no gauge at all**
(gcsim `Durability: 0` — Surging Blade) read as blocked. 12 such labels.

**Fixes** (`31ba7433`):

- The probe records every hit in landing order and pairs by **ordinal** inside a
  `(frame, abil)` bucket; "applied" is read off the live attack (gcsim's own
  `applyDamage` condition, or a reaction). ⚠️ The `application` log line cannot be
  paired that way — a plain attach is logged from a deferred task, a reacted one
  synchronously.
- `icdVal` (the `ele icd check` line's sequence entry) tells **blocked** (`[icd]`, read a 0) from **no gauge** (`[0U]`, no check ran).
- Streams are per gcsim **counter** (`tag/group`, an opaque identity — ⛔ never a name).
  The ability string was the wrong unit both ways: Qiqi's three skill abilities share one
  counter; the Pyro Traveler's two hold hits sit on two with identical numbers.
- `IcdInfo.open` — the list's last entry is non-zero (only the reaction groups), which is
  what makes `applies` a CAP.

## 2. The schema: `IcdWindow.cap`

Applications per window, a count. Read by `icdParamsFor`, so all three window sites
(cast `icdGate`, `summonTick.icdGate`, `chargedIcdWindow`) get it. **Lint D.27f**: a cap
needs `every` (without it only the first hit applies), and `cap: 1` is "first only" the
long way. The standard-restatement check now includes the standard's own cap (8).

⚠️⚠️ **A list is not a cycle.** `{1, 0}` is first only, not every 2nd — past the end gcsim
reads the LAST entry. Three summon windows had been authored as cycles (§4).

## 3. The new measurement: §4c

Each authored `application[]` replayed through the planner's own
`resolveCastApplications` (one cast, its own counter), against the hits gcsim applied in
the same isolated cast. Three questions kept apart: does the LIST name gcsim's
gauge-carrying hits (±6f)? when it does, does the GATE agree (applications counted per
same-frame group, so Klee's pairs and Varka's 3f shift are not gate findings)? and is any
entry a hit gcsim gives NO gauge?

| §4c                         |          before |   after |
| --------------------------- | --------------: | ------: |
| authored casts replayed     |             294 |     294 |
| agree hit for hit           |             232 | **271** |
| ⛔ gate                     |              27 |   **1** |
| ⚠️ list                     |              35 |      22 |
| casts with a no-gauge entry | 13 (4 applying) |   **0** |

Reaction oracle (`audit-gcsim-reactions.mjs`, the ten fixtures): mean |Δ| **0.162U →
0.158U**, agree 173 → 174, drift 67 → 65, missing 47 → 46, **extra 1 → 2** — the new one
is Collei's first Kitty leap (2.27s), which gcsim blocks because her Burst explosion and
leaps share one counter. ⚠️ Not a regression: the oracle pairs by ORDINAL, and the old
"agree" on that row was the leap paired with gcsim's **Floral Brush return** (2.32s) —
the hit this round made the planner apply. gcsim's own count moved 270 → 269
(crystallize is non-deterministic).

## 4. Authored (every number off gcsim's tables or source)

| class                                                                    | sites                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| cast `noICD` — every hit `ICDTagNone`                                    | Bennett E (all forms), Chongyun Q, Collei E, Rosaria E + Q, Jean Q, Nilou Q                                                                                                                                            |
| entry `noICD` — one `ICDTagNone` hit, or one hit on a counter of its own | Aloy E +25 · Sayu E kick (+25 / hold +68) · Citlali Q +118 · Kirara Q +38 · Kujou Sara Q +51 · Pyro Traveler hold +62 · the opener of each window below                                                                |
| cast window                                                              | Chevreuse Q `{180, every 3, cap 2}` · Layla E `{180, every 7, cap 2}` · Chasca Q `{90, every 2, cap 3}` · Charlotte E `{720, every 2, cap 5}` (all four forms) · Charlotte Q `{240, every 4, cap 2}` · Mizuki E `{72}` |
| cap added                                                                | Arlecchino E 3 · Diluc Q 6 · Fischl Oz ×4, Amber, Venti, Navia, Yelan 8 · Furina 12 (⚓ Nate: every cap, bound or not)                                                                                                 |
| cycle → first only                                                       | Aino `{108}` · Citlali Itzpapa `{90}` · Escoffier `{90}` · Cryo Traveler Frostpierce Star `{150}` (new)                                                                                                                |
| no-gauge landing → `element` dropped (⚓ Nate)                           | Chevreuse E +59 / hold +55 · Lynette E +58 / hold +79 · Freminet E +62 · Hydro Traveler E +70 / hold +418 · Wriothesley Q +160 · **Lisa Q +56 · Sigewinne E (3 forms) · Xianyun Skyladder +3**                         |

- ⚓ **A no-gauge hit stays an entry.** `application[]` is the cast's landing list
  (`CastEvent.hitsAt`), so deleting one deletes a hit; an entry with no `element`
  applies nothing and, like gcsim's Durability 0, never reaches the counter. The damage
  element comes from the cast. Visible change: the **bold** three stop applying their
  element at that frame (they applied a provisional 1U gcsim never applies).
- ⚓ **Chevreuse, corrected.** Before: the planner applied at +59, +92, +110 against
  gcsim's +59, +83, +101 — the same COUNT, ~9f late (the grenade spent the per-cast
  counter's first slot). The ICD Timeline session called it "an extra Pyro"; that was
  wrong. Now exact.
- ⚠️ **The cycle → first-only fixes move nothing.** Measured through `icdApplies`: at
  their authored cadences (Citlali 59f, Aino 42f, Escoffier 59f) both rules apply the
  same ticks, because the window resets before the misread entry is reached; the caps
  above 3 are likewise unreachable. They make the data state gcsim's rule, which is what
  the audit compares. (An in-session claim that Citlali over-applied 2× was wrong.)

## 5. Not done, and why

- **Nilou's Whirling Steps** (§4c's last gate row) — a prerequisite artefact: the Dance's
  own hit spends the counter before the step lands. True in game too, but it is
  cross-CAST counter sharing.
- **Collei's Burst explosion + leaps** share one gcsim counter; ours put the explosion on
  the cast counter and the leaps on the series'. A specific mechanic, ⛔ not "counter
  sharing" as a programme (icd-group-round §10).
- **§4c's 22 list rows** are not ICD: summon-named hits the split files as ticks (Amber,
  Ganyu, Ningguang, Qiqi Q, Geo Traveler Q), the capture horizon (Barbara, Ganyu Q,
  Ayato, Kinich), deliberate models (Albedo's blossoms, Emilie, Odette's Coda), Nilou's
  steps 2/3 driver, Varka's ref, and Durin's dark burst capturing the WHITE dragon
  (a driver question).
- **Cryo Traveler's Frostpierce Star** measures 8 hits at 13f against our 4 ticks at
  176f — the gate is authored; the series shape is a separate question.
- **gcsim sync** (63 commits) — its own step.

## 6. Commits

`31ba7433` the audit, dumper and schema · the data + docs commit after it. Gates: vitest
2229/2229, check, lint, build.
