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
- **`_curatorNotes`** for effects too situational to model (aura-dependent
  procs, enemy-state dependencies). "Visualize decision-relevant mechanics,
  stub the rest." (There is no `_todo` field — the corpus never adopted one.)
- **`caveat` strings follow `docs/curation/caveat-style-guide.md`** — the
  player-facing voice contract (≤2 sentences, ~180ch target, no curator-speak;
  enforced by characterLint E.26 + `scripts/caveat-lint.mjs`). Say only what
  the timeline gets wrong or omits; technical reasoning goes to `_curatorNotes`.
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

**⚠️ Frames flip `isCurated` — the character exits the Team Builder's
"not yet curated" honesty bucket the moment frames land.** A frame-curated
kit with no team-facing effects reads as "provides nothing", which is a lie.
Never land frames on a kit whose Stage-2 effects aren't authored; do both in
the same pass (Emilie's first stage-4 run, 2026-07-12, included her Lumidouce
summonTick effects for exactly this reason).

**First, locate the source — frames often exist before the local checkout
shows them.** Check three places in order; the character is frameable if
_any_ hits (do NOT conclude "no gcsim" from a stale local `ls` alone — that
false negative is what left Ayaka/Qiqi/columbina/durin/nicole sitting
"uncurated" long after gcsim had them, 2026-07-14):

1. **Refresh the local checkout** — `git -C ~/Code/gcsim pull --ff-only origin
main` (the checkout drifts commits behind; a released char is often already
   merged). Then `ls internal/characters/<gcsim-name>/`.
2. **Search open PRs** — a contributor may have posted a full implementation
   gcsim hasn't merged (this recovers in-demand recent chars early):
   `gh pr list --repo genshinsim/gcsim --state open --limit 200 --json number,title,files`
   → find a PR whose files include `internal/characters/<name>/attack.go`
   (a bare fix touching only `asc.go`/`shield.go` means the char is already on
   main — see step 1). To read a PR's frame source without checking it out:
   `git -C ~/Code/gcsim fetch origin pull/<PR#>/head && git -C ~/Code/gcsim show FETCH_HEAD:internal/characters/<name>/attack.go`
   (likewise `skill.go`, `burst.go`, `*_gen.go` for the sidecar cross-check).
   Note in `_curatorNotes` that frames came from an unmerged PR (#N) — they may
   shift before merge.
3. **Neither hits** → genuinely no gcsim source yet. Author everything else
   (Stages 1–3: cooldowns, energy, durations, all effects, tags — FrameMaps,
   `application[]` and gcsim-only summon tick cadences are blocked) and leave
   the char in `FRAMELESS_EXEMPT`. ⚠️ With no `application[]` the character
   falls back to applying its element at the cast instant, marked provisional —
   honest, and enumerated in `docs/curation/gcsim-frames-diff.md`. Post-launch, in-demand chars here are the ones
   to point community contributors at gcsim for.

Once located:

⚓⚓ **DO NOT HAND-READ THE GO SOURCE ANY MORE (gauge round L4, 2026-08-16).**
`scripts/gcsim-dump/main.go` links gcsim as a LIBRARY and reads the resolved
values directly — the cancel slice is `action.Info.Frames(next)` and the
animation length is index 0 of it, so there is nothing to interpret. Run:

```
node scripts/audit-gcsim-frames.mjs --char <id>          # what gcsim says vs what we ship
node scripts/migrate-frames-shape.mjs --write --char <id>       # FrameMaps
node scripts/migrate-application-schema.mjs --write --char <id> # application[]
```

⚠️ **A new character needs `anim`, `hit` AND `application[]`, and the last is
the one nothing else will notice is missing.** `characterLint` requires `anim`;
nothing requires an application list, and a character without one silently
falls back to "applies its element at the cast", which is the defect the gauge
round exists to remove. The migration writes all three.

⚠️ If the character needs a MODE the default capture cannot reach — a stance,
a hold, a chained press — add a row to `scripts/gcsim-dump/drivers.json`. The
corpus's own `conditions` derive most of it: a `chainStage` at index N is N
repeats of that action, and only "what puts this character into that state"
needs a human. ⛔ Score the candidate before keeping it — a row that does not
beat no-prereq is a regression dressed as coverage.

⛔ Read `_curatorNotes` before overruling anything. The corpus's frame notes
have repeatedly turned out to know more than the extractor does: Albedo's N5
documents a gcsim typo, and Kaeya's plunge note named the low/high split years
before the schema could hold it.

- The **gcsim-frames** skill is now the FALLBACK, for the ~12 characters with
  no gcsim source and for reading a not-yet-merged PR. Its "always cross-check
  KQM sheets" section predates the 2026-07-12 gcsim-primary decision — the
  verification block below supersedes it.
- Remove the character from `FRAMELESS_EXEMPT` (the tracker's prune check
  enforces this).
- **Verification (2026-07-12 policy):**
  1. _Sidecar cross-check_ — every scaling/CD/energy/duration extracted from
     `*_gen.go` arrays must match `docs/curation/talents/{id}.json` (both
     derive from game data; a mismatch means a mis-index). Trap: hand-counting
     `[]float64` block lines is off-by-one-prone — talent level 10 = index 9 =
     the sidecar row's 10th column. The sidecar caught exactly this on the
     first stage-4 run (Emilie).
  2. _Sanity checks_: hitmarks within animation length, cast lengths
     plausible for the weapon type, cooldown/energy agreement with kit text.
  3. _Flag-and-ask_: anything suspicious → `_curatorNotes` + a specific
     question to Nate (he can pull KQM's sheet for that one case); never
     silently adjust. No routine KQM sheet reads.

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
