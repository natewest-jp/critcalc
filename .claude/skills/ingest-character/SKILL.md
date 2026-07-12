---
name: ingest-character
description: End-to-end recipe for ingesting and curating a new Genshin character (or upgrading a stub) — genshin-db stub, web research, effect authoring, gates, frames follow-up. Use when a new character releases, when asked to "ingest"/"curate" a character, or for batch curation waves.
---

# Ingest & Curate a Character

The pipeline that takes a character from "patch dropped" to "tool-ready,
verified, honestly labeled" with human involvement compressed to one diff
review plus image assets. Agentic-first (judgment calls need an intelligent
worker); scripts handle the deterministic rims; **gates make autonomy safe**.

Decisions behind this design: `docs/curation/data-quality-plan.md`.
Conventions authority: `docs/curation/tier-c-guide.md` + the JSDoc in
`src/lib/types/ability.ts`. Read both before authoring anything.

## Stage 0 — stub + sidecar (script, deterministic)

```bash
npm update genshin-db            # per game patch — brings new characters
node scripts/ingest-character.mjs "Character Name"
npm run generate-character-index
```

Produces `src/lib/data/characters/{id}.json` (corpus-shape stub: identity,
sectioned kit text, CD/duration/energy parsed from talent labels) and
`docs/curation/talents/{id}.json` (per-level scaling tables; also carries
`extraPassives` — utility/Moonsign-benediction passives excluded from the
character JSON; review them for combat relevance, e.g. Moonsign/faction
modeling). Heed any `_curatorNotes` the generator emitted (multi-valued CD
labels etc.). The script refuses to overwrite existing files without
`--force` — never `--force` a curated character.

A stub is already shippable: tools report it honestly as "not yet curated"
(Team Builder buckets it; planner shows no frames). Add the character to
`FRAMELESS_EXEMPT` in `src/lib/utils/characterLint.test.ts` — the coverage
tracker fails the build otherwise, by design.

## Stage 1 — web research (facts before authoring)

Research the kit's **mechanics facts** before touching effects: who each
ability heals/shields/buffs (exact targets), constellation/ascension gates,
conditions (stance? field? HP thresholds? team composition?), durations, tick
cadences, snapshot behavior. Sources that read well as pages: the official
wiki, KQM character guides, Hakushin/Ambr. Cite what you verified.

**KQM Google-Sheets frame data is out of scope here** — frames are Stage 4.

## Stage 2 — effect authoring (judgment, gated)

Author `effects[]` and `tags[]` per the conventions:

- **Values at talent level 10** from the sidecar; percentages as percentage
  points (`"scaling": 309.66` = 309.66% of `stat`); flat portions in `flat`.
- **Buffs**: whole-number values; stat-scaled buffs via BuffValue scaling form
  (`{"type":"scaling","stat":"baseAtk","ratio":77.4}`); `source` +
  `snapshottable` required (research KQM; default `false` + a `_curatorNotes`
  line when genuinely unsure).
- **Tags** are the coarse capability signal (`heal`, `shield`, `summon`,
  `taunt`, `coordinatedAttack`, `cleanse`, `grouping`) — tag first, effects
  add the detail. `coordinatedAttack` only for strikes triggered by the team
  attacking; autonomous summon damage is `summons[].effects` summonTick.
- **Never fake timing.** Tick intervals/durations only when stated in kit
  text or web-verified; otherwise author the on-cast portion and flag the
  rest in `_curatorNotes`. `~?s` for unknown durations.
- **`_todo`** for effects too situational to model (aura-dependent procs,
  enemy-state dependencies). "Visualize decision-relevant mechanics, stub the
  rest."
- Conditions per the `Condition` JSDoc. Trap: `teamElementCount` counts
  NON-HOLDER members only (Gorou is geo → his 1-geo tier is unconditional).
- `constellationLevel` on constellation entries is the gate; effects hosted
  there need no redundant constellation condition unless the gate differs.

## Stage 3 — fixture + gates (what makes this safe to run unattended)

1. **Write the capability fixture entry BEFORE running the audit** — add the
   character's expected heal/shield/offFieldDamage/buff facts to
   `scripts/capability-expectations.mjs` **from your research, not from the
   data you just authored** (an expectation copied from the data can't catch
   the data's gaps).
2. Run the gates — all must pass:

```bash
npx vitest run                              # lint (strict), parse smoke, derivation, index drift
node scripts/audit-capabilities.mjs --write # your character's findings should resolve
npm run check && npm run lint
```

3. Regenerate the index (`npm run generate-character-index`) and commit the
   refreshed `docs/curation/capability-audit.md` with the work.

## Stage 4 — frames follow-up (separate pass; gcsim-primary)

When gcsim ships the character (days–weeks after release):

- Extract FrameMaps from gcsim's character Go source per the
  **gcsim-frames** skill (canonical key sets per ability type,
  `reference_framemap_conventions` memory).
- Remove the character from `FRAMELESS_EXEMPT` (the tracker's prune check
  enforces this).
- Sanity checks, not KQM cross-reads (decided 2026-07-12): hitmarks within
  animation length, cast lengths plausible for the weapon type,
  cooldown/energy agreement with kit text. **Anything suspicious → flag and
  ask Nate** with the specific number in question (he can pull KQM for that
  one case); never silently adjust.

## Stage 5 — human-only step

Ask Nate for image assets (`static/assets/characters/{full,circle,side}/`).
Until they land, `hasAvatar()` renders initials — nothing breaks. After they
land: `npm run generate-newfit` refreshes the availability manifest
(auto-runs on predev/prebuild).

## Batch mode

Multiple characters fan out cleanly as parallel agents (one character JSON
each — no file conflicts; don't let agents regenerate the shared index or
edit shared files; the orchestrator does fixture entries, index regen, and
the final gate run). Workflows are greenlit for this — see the
curation-wave pattern in `docs/curation/data-quality-plan.md`.

## Non-negotiables

- Honesty over coverage: a missing capability must read as "unknown", never
  "no". Stubs stay bucketed until frame-curated.
- The audit fixture is ground truth authored from game knowledge — extend it
  with every ingest, flag uncertain entries `confidence: 'check'`.
- Every commit leaves the full gate suite green.
