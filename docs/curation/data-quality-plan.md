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
  judgment calls (what to model, what to `_todo`, KQM terminology, condition
  shapes) need an intelligent worker. Scripts handle the deterministic rims
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

| Batch | Content                                                                                                                                                     | Risk                          |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| A1    | `coordinatedAttack` tags (xingqiu, beidou, xiangling, yae_miko, furina, nahida, albedo, kuki_shinobu, …) + missing heal/shield tags                         | none — one-liners             |
| A2    | heal/shield **effects** (target + scaling from talent sidecars) on the ~20 headline healers/shielders: jean, diona, kuki, dori, charlotte, thoma, …         | low — web-verify mechanics    |
| A3    | iconic buffer effects: gorou (geo-count banner tiers), kujou_sara, faruzan, yun_jin C0 — also fixes planner team-buff rows                                  | medium — conditional modeling |
| A4    | schema vocabulary (APPROVED): `cleanse` + `grouping` AbilityTags, `interruptionRes` Stat; wire into derivation/facets/lint; author on known holders         | low                           |
| A5    | resolve fixture `confidence:'check'` entries (aino, lauma, traveler_hydro, sigewinne gate, hu_tao target) via web research during each character's curation | low                           |

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
   `_todo` for unmodelable, condition shapes per ability.ts JSDoc) with the
   talent sidecar supplying scaling values (convention: talent level 10 for
   tabulated values — confirm against tier-c-guide during B2).
4. Capability fixture entry (expected heal/shield/offField/buffs) written
   BEFORE running the audit — expectations from research, not from the data.
5. Gates: lint → parse smoke → audit → vitest → probe if UI-adjacent.
6. Frames follow-up pass (when gcsim ships the character): extraction per
   the gcsim-frames skill, sanity lints, flag-and-ask on anomalies.
7. Image assets: ask Nate (the one human-only step).

Batch mode: multiple characters fan out as parallel agents (workflows
greenlit); each produces an isolated reviewable diff.

## Sequencing

B1 → A1 (cheap win, proves the audit loop) → A4 (unblocks vocabulary for A2/A3)
→ A2 → A3 (each also a dry run of recipe conventions) → B2 skill authoring
(encoding what the A-batches taught) → frames pass across the backlog
(Track O: emilie + kamisato_ayaka first) → 9 pre-release/stub characters
through the full recipe.

## Open questions for Nate (flag-and-ask queue)

_(none currently — resolved: schema vocab ✅, frames source ✅, recipe shape ✅)_
