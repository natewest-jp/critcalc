---
name: ingest-character
description: End-to-end recipe for ingesting and curating a new Genshin character (or upgrading a stub) — genshin-db stub, web research, effect authoring, gates, frames follow-up. Use when a new character releases, when asked to "ingest"/"curate" a character, or for batch curation waves.
---

# Ingest & Curate a Character

The pipeline that takes a character from "patch dropped" to "tool-ready,
verified, honestly labeled" with human involvement compressed to one diff
review plus image assets. Agentic-first (judgment calls need an intelligent
worker); scripts handle the deterministic rims; **gates make autonomy safe**.

⚓ **This is an INGEST _and UPDATE_ recipe.** A game patch does two things, and
for years this file described only one of them: it adds characters, **and it
revises existing ones**. Run **Stage 0a first, always** — it turns a patch into
a work list, and the new characters are only one column of it.

Decisions behind this design: `docs/curation/data-quality-plan.md`.
Conventions authority: `docs/curation/tier-c-guide.md` + the JSDoc in
`src/lib/types/ability.ts`. Read both before authoring anything.

> ⏱️ **Schema currency: 2026-08-31.** This recipe is only as good as its last
> sync — it sat at 2026-08-16 while five rounds of schema landed, and the gap
> was invisible because every gate stayed green (the gates check what IS
> authored, never what SHOULD have been). **Before a wave, diff this file's
> date against `CLAUDE.md`'s Key Types + Roadmap sections** and pull forward
> anything newer.

## Stage 0a — the patch sweep (run FIRST, once per genshin-db bump)

```bash
npm install genshin-db@latest
node scripts/audit-genshin-db-text.mjs --write   # → docs/curation/genshin-db-text-diff.md
```

⚠️⚠️ **A genshin-db bump is NOT additive-only, and NOTHING ELSE WILL TELL YOU.**
`audit-genshin-db-diff.mjs` covers _scalars_ (energyCost/cooldown/identity), so a
reworked passive whose numbers didn't move passes it silently; `characterLint`
checks shape, not prose. **Every gate stays green while authored effects go
stale.** Measured on 5.2.12 → 5.2.13 (game 7.0): **2 characters added, 11
existing characters' talent text revised, 2 removed** — a whole mechanic (Stellar
Swirl) rolling out across the Anemo roster, visible to no existing check.

The report sorts the patch into three work streams. **Do them in this order** — a
mechanic that landed corpus-wide usually needs its schema before any single
character can be authored against it:

1. **↻ Revised entries** — re-read the kit and re-author deliberately.
   ⚠️ Read the _mechanic delta_ column: a uniform keyword delta across many
   characters (`Stellar Swirl 0→2` on eight of them) is usually **one mechanical
   edit repeated**, not eight authoring jobs. Confirm by reading two before
   assuming the shape of the rest.
2. **🆕 New characters** — the full pipeline below, Stages 0→4.
3. **⚠️ Removals** — a character leaving genshin-db is a scope signal, not a
   deletion order. ⛔ Never drop corpus data on a removal alone.

⛔ **Re-authoring revised characters is its own scoped round** — never a silent
side effect of ingesting the new character. Land the sweep as a report first,
then take the rounds one at a time.

⛔ **Travelers are OUT OF SCOPE for this recipe** (⚓ Nate, 2026-08-31). Element
splits are hand-built, the generator refuses them outright
(`ingest-character.mjs:203`), and Cryo Traveler is expected to be the last
variant — so a Traveler is its own pass, never a wave member. The sweep will
still list `traveler<element>` when its text moves; route it out.

## Stage 0 — stub + sidecar (script, deterministic)

```bash
node scripts/ingest-character.mjs "Character Name"   # genshin-db already bumped in 0a
npm run generate-character-index
```

Produces `src/lib/data/characters/{id}.json` (corpus-shape stub: identity,
sectioned kit text, CD/duration/energy parsed from talent labels) and
`docs/curation/talents/{id}.json` (per-level scaling tables; also carries
`extraPassives` — passives excluded from the character JSON; review them for
combat relevance).

⚠️⚠️ **THE `extraPassives` SPLIT IS POSITIONAL, NOT SEMANTIC** — `passive1/2` go
into the JSON, `passive3/4` go to the sidecar, and nothing looks at what they
say. That convention held while `passive3` was utility, and **7.0 broke it**: the
"Stellar Jubilee: …" converter passive occupies the `passive3` slot, so the
generator silently filed Odette's and Alyosha's most load-bearing passive — the
one that makes them Stellar ENABLERS — out of the character entirely. ⛔ **Always
read `extraPassives` before authoring**; a `passive4` is usually genuine minimap
utility, but a `passive3` no longer is. Heed any `_curatorNotes` the generator emitted (multi-valued CD
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
- **`caveat` strings — ⚓⚓ the test is NAME THE PIXEL** (caveat refresh round,
  2026-08-19; the corpus went **261 → 107** on this rule, so the surviving
  examples are the calibration). A caveat exists ONLY to repair confusion **on
  screen**: if you cannot point at a bar, marker, tick or printed value that is
  wrong, approximate or conspicuously missing, **it does not exist**.
  - ⛔ A general fact about the GAME is never a caveat.
  - ⚠️ An under-claim is an omission, not a divergence.
  - ⚠️ "No window" means "no row" means **NO BLANK** — nothing to repair.
  - ⛔⛔ **Only on an ABILITY-shaped host** (ability / passive / constellation
    entry) — **lint E.28**, strict. ⚠️⚠️ The defect is POSITIONAL (`caveat` is
    legal on `AbilityCommon` and illegal on an effect), so `orphanedSchema`
    cannot see it: 20 effect-level caveats once rendered to nobody.
  - ⛔ Never "add it manually" — `manual` triggers reach no surface.
  - Voice contract still holds (≤2 sentences, ~180ch, no curator-speak;
    characterLint E.26 + `scripts/caveat-lint.mjs`); technical reasoning goes
    to `_curatorNotes`. Style: `docs/curation/caveat-style-guide.md`.
  - ⚠️ **Re-derive `docs/curation/engine-capability-rubric.md` at the start of
    the pass** — it is a SNAPSHOT of what the engine can show, and the previous
    edition went stale in 14 places in four weeks. Open items:
    `docs/curation/caveat-open-items.md`.
- Conditions per the `Condition` JSDoc. Trap: `teamElementCount` counts
  NON-HOLDER members only (Gorou is geo → his 1-geo tier is unconditional).
- `constellationLevel` on constellation entries is the gate; effects hosted
  there need no redundant constellation condition unless the gate differs.
  ⚓ Since 2026-08-18 the gate is applied at COLLECTION
  (`effectSourcesAtConstellation`), so this is now load-bearing rather than a
  convention — an ungated constellation effect really does leak at C0.

### ⚠️ Schema that landed AFTER this recipe's previous revision (2026-08-16)

⛔ **Do not author from memory of the old shape.** Each of these is a field a
new kit plausibly needs, and none of them existed when the stages above were
written. Authority is the JSDoc in `src/lib/types/ability.ts`; the round docs
carry the reasoning.

- **A shield is an `Effect`, never a summon** (2026-08-14). `summons[]` means a
  thing left in the world. An instant cast's active window is
  **`activeDuration`** — ⛔ **never `duration`** (twelve abilities carry a stray
  `duration` no accessor reads). A `shield` effect carries `label`, its in-game
  name — ⛔ never invent one; the lane's generic `"Shield"` is the honest
  fallback. Memory `shield_summon_split`.
  - ⚠️ A `shield` on a passive/constellation entry fired on `onCast` MUST bind
    `trigger.ability` (**lint B.8a**), or it fires on both casts.
- **A variant's `effects` and `summons` REPLACE the base ability's, never
  merge** — a variant restating one effect DROPS the rest, and `summons: []`
  means NONE. Tap/hold kits are where this bites.
- **Both `summons[0]` and `summons[1]` resolve** (since 2026-08-14). An ability
  with two summons is real (Ineffa, Citlali, Furina); a window on an
  unresolved index lands in no lane, silently.
- **`summonTick.icdGate`** (`'none' | IcdWindow`, lint D.27b) — how often a tick
  APPLIES, distinct from how often it fires. Absent = standard.
  ⚠️ Declared on the TRIGGER, not the summon.
- **`summonTick.tickCap` / `tickCapScaling`** (lint D.27d) — a COUNT, ⛔ never a
  time bound, and only when the count is _not_ `duration ÷ interval` (absent is
  correct for 26 of 37 measured series). ⚠️⚠️ **A sibling HEAL series on the same
  cadence must be capped too** — one gcsim task emits both, and the oracle
  cannot see a heal. ⛔ A cap and `durationExtensions` do not compose.
- **A tick series can CHANGE CADENCE** — authored as the same series TWICE with
  mutually exclusive `conditions`, ⛔ never an interval override (the ICD group
  and the count move with the rate). ⚠️⚠️ An UNRESOLVABLE condition does not
  abstain — it fires BOTH.
- **Coordinated attacks are an authored shape now**, superseding the one-line
  tag guidance above: a `damage` effect carrying its own `application[]` on a
  trigger that listens to somebody else's output — `onHit`, `onReaction`, or
  **`whileNormalAttacking`** (⚠️ summon-hosted ONLY, lint B.13c), armed by
  `armedFor` or the summon's liveness. ⚠️⚠️ A proc's `icdGate` is NOT
  `procCooldown`. `docs/coordinated-attacks-round.md`.
- **`BuffEffect.onFieldDelay`** (lint B.14) — how long the receiver must have
  been on field. Only meaningful on `target: 'active'`; its waiver is a
  `Condition`, ⛔ not a bespoke key.
- **`NormalAbility.chargedIcdWindow`** — a measured `(frames, every)` pair, and
  it is **DATA, ⛔ never a `weapon === 'polearm'` branch** (16 of 19, with three
  polearm users on the default and a sword user carrying the group).
  ⚠️ Unit trap (lint A.4b): FRAMES here, SECONDS in `summonTick.interval`.
- **`cooldownStartsAtStanceEnd`** (lint D.21/D.22) — a cooldown clock can start
  at the stance end. ⛔ Not the same as `cooldownStartDelay` (animation frames).
- **`endsStance`** (2026-10-04, lint D.47) — a cast that ENDS its caster's stance
  (gcsim `DeleteStatus` of the stance key inside another cast): `at` frames from the
  cast start or `'castEnd'`, optional `conditions` read AFTER the cast's own
  `gainStacks`. On a skill, burst or variant. Zibai / Nilou / Wanderer.
- **`CharacterData.enablesReactions`** — the Stellar enabler model. ONE enabler
  in the party converts the base reaction party-wide. ⚠️ Per-reaction: a Swirl
  enabler does nothing for Conduct. `docs/library/game/stellar-reactions.md`.
- **`manual` triggers reach NO surface** (one code occurrence, its own type
  declaration). Authoring one is authoring an inert effect — legitimate as a
  record, but ⛔ never write a caveat that says "add it manually", and don't
  count it as modelled. `node scripts/audit-manual-triggers.mjs` lists them.

⚠️ **A field with no consumer FAILS the gate** (`orphanedSchema.test.ts`) — the
project's most productive bug class. On failure: wire it, retire it, or add it
to `INERT` **with a reason**. ⚠️⚠️ It cannot see PARTIALLY-wired data, so green
is not proof.

## Stage 3 — fixture + gates (what makes this safe to run unattended)

1. **Write the capability fixture entry BEFORE running the audit** — add the
   character's expected heal/shield/offFieldDamage/buff facts to
   `scripts/capability-expectations.mjs` **from your research, not from the
   data you just authored** (an expectation copied from the data can't catch
   the data's gaps).
2. Run the gates — all must pass:

```bash
npx vitest run          # characterLint (62 rules), parse smoke, derivation, index drift,
                        # orphanedSchema, constellationGating, the roster parser-invariant gate
npm run check && npm run lint
npm run build           # ⚠️ the REAL gate — characterLint must stay runtime-import-free,
                        # and only the production build sees that break
```

Then the audits — **review-candidate generators, ⛔ never auto-fixers**:

```bash
node scripts/audit-capabilities.mjs --write     # vs the game-knowledge fixture; yours should resolve
node scripts/audit-data-outliers.mjs --write    # decimal-form leaks, resShred sign, placeholder zeros
node scripts/audit-capability-sweep.mjs --write # vs wiki categories + IT roles
node scripts/audit-genshin-db-diff.mjs          # ⚠️ SCALARS ONLY — see the Stage 0 warning
```

3. Regenerate the index (`npm run generate-character-index`) and commit the
   refreshed `docs/curation/capability-audit.md` with the work.
   ⚠️ A char-JSON edit that changes identity or derived capabilities needs the
   index regen or the drift test fails.

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
   ⚓ Better (2026-09-15): check the PR head out in the clone and run the
   WRITERS against it — `git -C ~/Code/gcsim fetch origin pull/<PR#>/head:pr-<PR#>
&& git -C ~/Code/gcsim checkout pr-<PR#>`, then the three commands above,
   then `git -C ~/Code/gcsim checkout main`. The shim builds against whatever
   is checked out (a July-based PR still compiled against the Go 1.27 shim), so
   nothing is hand-read. ⚠️ Read the PR's review thread first: a
   `InitAbilSlice(733)` can be a summon's lifetime standing in as an animation
   (Kachina), and a "Placeholder using DMC frames" comment means NO frames at
   all (Cryo Traveler's draft). Note in `_curatorNotes` that frames came from
   an unmerged PR (#N) — they may shift before merge.
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
node scripts/audit-gcsim-frames.mjs --char <id>                  # what gcsim says vs what we ship
node scripts/migrate-frames-shape.mjs --seed --write --char <id>  # FrameMaps (⚠️ --seed for a FRAMELESS char)
node scripts/migrate-application-schema.mjs --write --char <id>   # application[]
```

⚠️⚠️ **`--seed` is what makes this true for a frameless character (2026-09-15).**
The migration only ever REWROTE maps that existed, so a stub with `hits: []`
and no `frames` got nothing from it — the recipe claimed otherwise and was
wrong for exactly the character it was written for. `--seed` creates an empty
slot wherever the dumper has a covered reading (N1…Nk, C, P, lP, E, Q, and a
conditioned sibling via its `drivers.json` row) and deletes any seed the pass
could not fill. ⛔ It does not create VARIANTS — a hold form (`hE`) is a
hand-read entry with an `input` and `label` (Illuga, 2026-09-15). Nor does it
write `cooldownStartDelay` — read `SetCDWithDelay`'s third argument yourself.

⚠️ **A new character needs `anim`, `hit` AND `application[]`, and the last is
the one nothing else will notice is missing.** `characterLint` requires `anim`;
nothing requires an application list, and a character without one silently
falls back to "applies its element at the cast", which is the defect the gauge
round exists to remove. ⚠️ Read the written application[] against the source
before committing it: a capture that needs a PREREQUISITE (a sibling behind a
state) also sees the prerequisite's own summon ticking through the horizon —
the Furina stale-application class — and a hit gcsim authors with no
`Durability` (a direct Stellar-Conduct hit) is listed nominal but applies
nothing (Odette's Coda, 2026-09-15).

**Shape reminders the migration assumes you know (L4b/L4c, and later):**

- ⚓⚓ **`anim` IS the fallback, not `swap`.** gcsim fills every slot with the
  animation length and applies overrides, of which `ActionSwap` is merely one
  and frequently the shortest. ⛔ Never re-inline `fm[k] ?? fm.swap` —
  **`frameAt()` in `$lib/utils/frames.ts` is the ONLY resolver.**
- `hit` fills E/Q/D/J/swap from `InitNormalCancelSlice`'s hitmark, so a normal
  swing is two numbers (`{anim:35, hit:24}`); ⛔ it is a lint error on an E/Q
  slice, which has no such tier.
- ⚠️⚠️ **`plungeFrames` is the HIGH plunge** (`P`/`hP`) and the default;
  `lowPlungeFrames` is `lP`. **The field CHANGED MEANING at L4b** — 36 of its
  41 authors previously held LOW-plunge numbers. Don't carry over an old
  reading.
- ⛔ gcsim's `ActionCharge = 500` is an "this action is illegal" SENTINEL, not
  data. Drop it.
- **`application[].units`** is authored (corpus: 1U ×327, 2U ×58, 4U ×2).
  ⚠️ Absent means UNMEASURED and defaults to 1U **flagged provisional** — which
  is a visible `--ui-provisional` foot on the aura lane's tick, so it is worth
  measuring rather than omitting.
- ⚓ **An EMPTY `application[]` is the POSITIVE statement that a cast applies
  nothing** (39 abilities). An ABSENT field means unmeasured. They are different
  claims — ⛔ don't collapse them.
- ⛔ Normals carry no `application[]` (their hitmark is `frames.hit`), nor do
  summons (`interval`/`firstTickDelay` already say it).
- ⚠️ **A `× 1` row in `gcsim-frames-diff.md` §5 is NOT a cadence** — the report
  files a stream under the summon whenever the ability declares one, so it can
  be the CAST's own single hit, which belongs in `application[]`.

⚠️ **What the oracle CANNOT adjudicate, so ⛔ don't read a green diff as
proof:** `chargedIcdWindow` (no fixture spams a polearm CA — the baseline is
byte-identical either way; measure with a probe); any condition the dumper
can't reach (it runs ONE character at C0 in an empty core, so team-faction and
constellation branches are invisible); and a HEAL series (a heal leaves no
`damage` event). ⚓ **Re-measure a suspect series in the ISOLATED core before
attributing it** — a second character in the fixture can make one character's
cadence look wrong.

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

Ask Nate for image assets — **all three of**
`static/assets/characters/{full,circle,side}/{id}.webp`.
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
