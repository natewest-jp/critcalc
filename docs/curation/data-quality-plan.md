# Data Quality & Ingestion Pipeline — Working Plan

_Branch `data/curation-pipeline`, started 2026-07-12. Approved by Nate: schema
vocabulary additions, agentic-first recipe (workflows greenlit, compute is not
the constraint), gcsim-primary frame data, maximum automation with
flag-and-ask for judgment calls. Nate provides image assets; everything else
should run without his eyes except specific flagged questions._

## Decisions (settled 2026-07-12)

- **Frame data: gcsim is the single systematic source.** No routine KQM
  cross-checks (Google-Sheets reading costs the exact resource we're
  optimizing — Nate's time). Safety comes from (1) automated sanity lints on
  every FrameMap (hitmark ≤ animation length, plausible cast-length ranges,
  cooldown/energy agreement with kit text) and (2) flag-and-ask: anything
  suspicious gets a `_curatorNotes` entry plus a specific question to Nate,
  who can pull KQM for that one case.
- **Frames are a separate pass from ingestion.** gcsim lags new releases by
  days–weeks; a new character ingests immediately with `~?s` placeholder
  timing and frames land in a follow-up pass. Ingestion never blocks on gcsim.
- **Agentic-first recipe.** The previous attempt was script-heavy; the
  judgment calls (what to model, what to stub with `_curatorNotes`, KQM
  terminology, condition shapes) need an intelligent worker. Scripts handle the deterministic rims
  (fetch, tables, lint, audit); agents do the middle; gates make it safe.
- **genshin-db lives in-repo** as a devDependency (5.2.x); the external
  generator is retired. `npm update genshin-db` per game patch brings new
  characters.
- **Talent scaling tables ship as sidecars** (`docs/curation/talents/{id}.json`),
  NOT in the character JSONs — the character files are client-shipped,
  code-split chunks; sidecars are curation-time reference only.

## Workstream A — clear the audit backlog (94 findings)

Batches ordered mechanical → judgment; `node scripts/audit-capabilities.mjs`
count is the progress metric. Every batch passes: characterLint (strict),
roster parse smoke test, capability audit, full vitest.

| Batch | Content                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Risk                          |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| A1    | `coordinatedAttack` tags (xingqiu, beidou, xiangling, yae_miko, furina, nahida, albedo, kuki_shinobu, …) + missing heal/shield tags                                                                                                                                                                                                                                                                                                                      | none — one-liners             |
| A2    | heal/shield **effects** (target + scaling from talent sidecars) on the ~20 headline healers/shielders: jean, diona, kuki, dori, charlotte, thoma, …                                                                                                                                                                                                                                                                                                      | low — web-verify mechanics    |
| A3    | iconic buffer effects: gorou (geo-count banner tiers), kujou_sara, faruzan, yun_jin C0 — also fixes planner team-buff rows                                                                                                                                                                                                                                                                                                                               | medium — conditional modeling |
| A4    | schema vocabulary (APPROVED): `cleanse` + `grouping` AbilityTags, `interruptionRes` Stat; wire into derivation/facets/lint; author on known holders                                                                                                                                                                                                                                                                                                      | low                           |
| A5    | resolve fixture `confidence:'check'` entries (aino, lauma, traveler_hydro, sigewinne gate, hu_tao target) via web research during each character's curation                                                                                                                                                                                                                                                                                              | low                           |
| A6    | **rigor pass (PLANNED)**: systematic verification of non-talent-scaled values — fixed kit constants (constellation/passive buff numbers, durations, proc CDs) checked against kit text + gcsim source. The talent sweep only covers talent-scaled values; fixed constants have never been verified corpus-wide. Batch by character, agent-driven, cite evidence per value                                                                                | low — verification only       |
| A7    | **caveat writing-quality pass — ✅ DONE 2026-07-20**: all 151 caveats (66 chars) audited and rewritten to the player-facing contract in `docs/curation/caveat-style-guide.md` (avg ~300ch → ~170ch; curator-speak zeroed; 8 deletes of working-behavior notes; every rewrite adversarially verified). Enforced permanently by characterLint E.26 + `scripts/caveat-lint.mjs`. Audit record: `docs/curation/caveat-pass/` (ledger, proposals, follow-ups) | none — prose only             |

## Workstream B — ingestion pipeline

**B1 (first): `scripts/ingest-character.mjs`** — genshin-db → stub JSON
matching the corpus shape exactly (identity, sectioned kit text, ability
skeletons with cooldown/energy parsed from attribute labels, passives,
constellations with `constellationLevel`, `meta`), plus the talent sidecar.
Refuses to overwrite without `--force`. Validated by regenerating existing
characters and diffing.

**B2: `.claude/skills/ingest-character/SKILL.md`** — the recipe an agent
follows end-to-end:

1. `ingest-character.mjs <name>` → stub + sidecar (+ index regen).
2. Web research pass (wiki/KQM guides readable as pages) → mechanics facts:
   what heals/shields/buffs whom, gates, conditions, ICD notes.
3. Effects curation per conventions (KQM terminology, whole-number `atk%`,
   `_curatorNotes` for unmodelable, condition shapes per ability.ts JSDoc) with the
   talent sidecar supplying scaling values (convention: talent level 10 for
   tabulated values — confirm against tier-c-guide during B2).
4. Capability fixture entry (expected heal/shield/offField/buffs) written
   BEFORE running the audit — expectations from research, not from the data.
5. Gates: lint → parse smoke → audit → vitest → probe if UI-adjacent.
6. Frames + application follow-up (when gcsim ships the character). ⚓ **No
   longer a hand-read of Go** (gauge round L4, 2026-08-16): run
   `audit-gcsim-frames.mjs --char <id>` to see what gcsim says, then
   `migrate-frames-shape.mjs` and `migrate-application-schema.mjs` to write
   `anim`/`hit` and `application[]`. The **gcsim-frames** skill is the fallback,
   for the ~12 characters with no gcsim source and for reading an unmerged PR.
   ⚠️ `characterLint` requires `anim`; nothing requires `application[]`, and a
   character without one silently falls back to applying its element at the
   cast — the defect the gauge round exists to remove. Sanity lints and
   flag-and-ask on anomalies as before; ⛔ read `_curatorNotes` before
   overruling the corpus, they have repeatedly known more than the extractor.
7. Image assets: ask Nate (the one human-only step).

Batch mode: multiple characters fan out as parallel agents (workflows
greenlit); each produces an isolated reviewable diff.

## Sequencing

B1 → A1 (cheap win, proves the audit loop) → A4 (unblocks vocabulary for A2/A3)
→ A2 → A3 (each also a dry run of recipe conventions) → B2 skill authoring
(encoding what the A-batches taught) → frames pass across the backlog
(Track O: emilie + kamisato_ayaka first) → 9 pre-release/stub characters
through the full recipe.

_Status 2026-07-12 end of day: B1/B2/A1–A5 ✅ done; Emilie frames ✅ (stage-4
validated); shield `flat` shipped; manekins retired; talent-10 normalized.
Remaining, all Opus-delegable: tag-without-effect batch (33) → A6 rigor pass
→ A7 caveat readability pass → ayaka + backlog frames → 12 stubs through the
full recipe._

## Open questions for Nate (flag-and-ask queue)

_(none currently — resolved: schema vocab ✅, frames source ✅, recipe shape ✅)_
