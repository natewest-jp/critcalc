# KQM Combat Notation Standard

> Moved from Claude's working memory on 2026-10-29, where it was kept as a living reference. Check the code before relying on a detail.

Official KQM (Keqing Mains) combat notation standard. The rotation planner aims to emulate this as closely as possible.

## Action Tokens

| Token | Meaning                                                                                                                                                                                                                                                                                                                                     |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N     | Normal Attack                                                                                                                                                                                                                                                                                                                               |
| C     | Charged Attack                                                                                                                                                                                                                                                                                                                              |
| A     | Aimed Shot                                                                                                                                                                                                                                                                                                                                  |
| P     | Plunging Attack                                                                                                                                                                                                                                                                                                                             |
| hP    | High Plunge                                                                                                                                                                                                                                                                                                                                 |
| lP    | Low Plunge                                                                                                                                                                                                                                                                                                                                  |
| E     | Elemental Skill                                                                                                                                                                                                                                                                                                                             |
| tE    | Tap Skill                                                                                                                                                                                                                                                                                                                                   |
| pE    | Press Skill (used interchangeably with tE in some KQM notations)                                                                                                                                                                                                                                                                            |
| h1E   | Level 1 Hold Skill                                                                                                                                                                                                                                                                                                                          |
| h2E   | Level 2 Hold Skill                                                                                                                                                                                                                                                                                                                          |
| Q     | Elemental Burst                                                                                                                                                                                                                                                                                                                             |
| sE    | Special Elemental Skill — the one a stance SUBSTITUTES for the ordinary E (Varka's Four Winds' Ascension). **Supported since 2026-09-16** (kind E; which ability it lands on is `resolveActiveAbility` reading state + party, never the token). ⚠️ It had to join `CAST_TOKEN_RE` too, or the editor lints the token we tell people to type |
| sC    | Special Charged Attack — a stance's substitute CA (Varka's Azure Devour). **Supported since 2026-09-16**; reads `NormalAbility.specialChargeFrames` and ⚠️ falls back to `chargeFrames` where an ability authors none, the out-of-window `sQ` rule. ⛔ Deliberately NOT in `CAST_TOKEN_RE` — a charged attack is not a cast entry           |
| sQ    | Short Burst — the cheap replacement burst some kits gain inside a transient window (Flins Thunderous Symphony, Varesa Volcano Kablam). **Supported by our tokenizer/parser since 2026-07-17** (kind Q; resolves a condition-gated burst variant)                                                                                            |
| D     | Dash (cancel)                                                                                                                                                                                                                                                                                                                               |
| J     | Jump (cancel)                                                                                                                                                                                                                                                                                                                               |
| W     | Walk (cancel)                                                                                                                                                                                                                                                                                                                               |

## Structural Syntax

| Syntax | Meaning                                      |
| ------ | -------------------------------------------- |
| `>`    | Switch character                             |
| `( )`  | Optional actions (refer to notes)            |
| `[ ]`  | Repeat actions the specified number of times |

## Key Notes

- Tokens are **concatenated**, not space-separated: e.g. `Xingqiu EQ`, `Fischl EN1N2`, `Kazuha Q hEP`
- Character name is separated from their action string by a space
- Normal attacks are numbered: N1, N2, N3, etc.

## Export codec (our notation → canonical KQM)

`src/lib/utils/kqmExport.ts` — pure `toKqmNotation(notation): string` (built 2026-07-14, wired to a `⎘ KQM` clipboard button beside `⤴ Share` in the planner header). Reuses `tokenizeNotation`; blocks joined `>` with **space-separated tokens kept** (Nate's pick over strict concatenation), original grouping preserved via source-adjacency (`N2C` stays fused, `N2C N2C` stays spaced). **Drops** tool-only tokens (`~Xs`/`~?s`, `{key:N}` stack asserts, `/alt` side of `E/Q`); passes standard tokens + `(...)` + `[...]xN` + unknowns through verbatim. Import direction needs no codec — the tokenizer already accepts concatenated tokens + `>`. See `kqmExport.test.ts` (18 tests).

**Character-detection division of labor** (verified 2026-07-14): the tokenizer tags only the _first_ token and any _post-`>`_ token as `character`; mid-stream names come back `unknown`. The **parser** (`parseNotation`) splits segments strictly on `>` and roster-matches `seg[0]` via `lookupChar`. So valid multi-character planner notation is genuinely `>`-separated (matches the editor placeholder `Bennett E Q > Xiangling E Q N3 > …`); the no-`>` string in `rotationUrl.test.ts` is just loose codec test-data, not a parseable rotation.

## Divergences in Our Tool

- We add `~Xs` for explicit on-field time (pure time advance, **no label** — the old `~Xs(label)` form is retired) — not in KQM standard but necessary since we don't model per-action frame data. Dropped on KQM export.
- We add `hEP` (hold E, press variant) — extension of KQM's hE family
- We plan to support concatenated tokens (EQ) to match KQM; currently space-separated (E Q)
- We use `C1`/`C2` to distinguish bow charge levels (index into `chargeHits[]`). KQM is inconsistent here — some guides use `C`, others use `CA` (Charged Attack) or `CS` (Charged Shot). **Deferred:** tokenizer/parser should eventually accept `CA` and `CS` as aliases for `C`, and `CA1`/`CA2` or `CS1`/`CS2` as aliases for `C1`/`C2`.
