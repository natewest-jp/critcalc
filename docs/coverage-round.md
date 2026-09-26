# The Coverage page — `/coverage`

_Status: ✅ SHIPPED 2026-09-23 — §11 is the record and wins over everything above it. (Was: IN PROGRESS on `feat/coverage-page`.) ✅ Phase 1 (derivation, index stamp, the
three statements + lints E.29–E.31) and a first cut of Phase 3 (the page) are built. ⏳ Phase 2's
proposals are in `docs/curation/coverage-classification.md`, awaiting Nate — nothing is written to
the data yet. ⚠️ Deviations from this spec so far: a tenth column, `extra` (a third passive or a
faction bonus — 16 characters carry one); an absent charged attack is a STAND-IN
(`GENERIC_CHARGE_FRAMES`), not missing; a stance or window a cast opens counts as its grant. When the
round ships, its §11 record wins over everything above it._

## 0. What it is, in one paragraph

One long list of every character, searchable and filterable, with a **coverage
strip** beside each name that says how much of the kit the Rotation Planner
represents — and, on hover or click, exactly what is missing, approximate or
deliberately not modelled, in the words of the caveat corpus. It is the page
the BETA tag points at: the first question a Genshin player asks about any
tool is "does it know my character?", and today only the announcement banner
answers it, at patch granularity, by hand. It doubles as our curation backlog,
regenerated for free.

## 1. The three laws

1. **DERIVED, never hand-maintained.** The strip is computed at build from the
   character JSON by a runtime-import-free module (`deriveCoverage.ts`, the
   `deriveCapabilities.ts` pattern), stamped into the eager index by
   `generate-character-index.mjs`, and guarded by the index-drift test. Nobody
   edits a coverage value. Where the data cannot say something the strip needs,
   **the data learns to say it** (a positive statement — the `application: []`
   lesson), never the page.
2. **A STRIP, never a percentage.** A single weighted number hides its weights
   and tells a user nothing actionable; "completeness" implies 100% is
   reachable when some things are unmodelled by ruling. The weighting Nate
   asked for lives in **visible geometry** — fixed segment widths, one table,
   tuned once as named constants (memory `feedback_expose_tuning_knobs`). A
   sort key may be a count ("12 of 15 measured"); ⛔ no printed percentage.
3. **IDENTICAL PLACES.** Every character's strip has the same columns in the
   same order at the same widths (⚓ Nate 2026-09-22), so the column headers
   label everything ONCE and the eye compares characters by reading down a
   column. ⛔ No conditional geometry per character — not even a plunge break
   for "plunge characters" (that is a role verdict, and it would put `P` at a
   different x per row).

## 2. The columns

Nine columns, by KIT ANATOMY — the vocabulary players already own:

```
Normals ──────────── E ────────── Q ────────── A1 ── A4 ── C1 ─ C2 ─ C4 ─ C6
[ N      | C  | P  ] [t | app | g] [t | app | g] [ g ] [ g ] [g] [g] [g] [g]
```

Two kinds of column, and the strip says which by shape:

- **Action columns (Normals, E, Q)** carry a fixed internal ladder,
  **timing | application | grants**, widths DESCENDING. Timing is widest
  because frames shift everything after them; a missing buff is narrowest.
  That is the weighting, drawn. ⚓ Normals is ALWAYS `N | C | P`, N widest —
  typing `P` for Diluc reaches the same generic stand-in as for Xiao, and
  whether anyone plunges with Diluc is the user's knowledge, not our data.
  Each of N / C / P carries only **timing | application** (a swing grants
  nothing of its own; a normal ability's `effects` are the rare exception —
  two in the corpus — and fold into E's-style grants on the N sub-segment
  ONLY if a holder ever needs it; ⛔ not drawn until then).
- **Effect columns (A1, A4, C1, C2, C4, C6)** are ONE segment each: a passive
  or a constellation only GRANTS.

Omitted, and why: **C3 / C5** are talent-level bumps and our values are
already at talent level 10 (there is nothing to cover — the census finds ONE
authored effect on each, both Sara-class variants that belong to the ability
they modify); the **utility passive** models nothing; **`D` / `J` / swap** are
timed by the same FrameMap as the swing and have no coverage of their own.

**Stances and sibling forms** (Skirk's in-stance Q, Lauma's two `C` forms,
Varka's `sE`/`sC`, Raiden's stance normals) ARE derivable — variants and
state-gated siblings exist in the data — so a seam inside E/Q is legitimate.
⏭ First cut draws NONE: the sub-segment takes the WORST state across forms
and the tooltip lists each form. ⚓ Nate judges on screen whether a hairline
seam per form earns its place (test rows: Skirk, Lauma, Varka).

### 2.1 Widths (the tuning table — named constants, Nate's to tune)

| column         | sub-segment                   | width (units)   |
| -------------- | ----------------------------- | --------------- |
| Normals        | N timing / N application      | 1.0 / 0.5       |
| Normals        | C timing / C application      | 0.5 / 0.25      |
| Normals        | P timing / P application      | 0.5 / 0.25      |
| E              | timing / application / grants | 1.0 / 0.6 / 0.4 |
| Q              | timing / application / grants | 1.0 / 0.6 / 0.4 |
| A1, A4         | grants                        | 0.6 each        |
| C1, C2, C4, C6 | grants                        | 0.5 each        |

Total 11.5 units; column gaps are the tile gap, sub-segments abut with a
hairline seam. ⚠️ These are a first cut for Nate's eye, not measurements.

## 3. The five states

| state            | meaning                                                                    | drawn as                                                                                                                |
| ---------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **lit**          | measured / authored                                                        | the register's lit fill                                                                                                 |
| **provisional**  | we took it and this is a STAND-IN                                          | `--ui-provisional` — the SAME colour the editor's squiggle uses, so a user who saw it in the planner recognises it here |
| **missing**      | nothing — frameless, an effect described but not authored                  | `--ui-warning`, same reason                                                                                             |
| **not modelled** | a RULING — co-op shields, distance-based regen, the `onHeal`/`onHP*` class | hatched; listed WITH its reason; ⛔ never counts against the character                                                  |
| **n/a**          | this ability has nothing of that kind (Xiangling's E grants no buff)       | empty / neutral ground — ⛔ NEVER drawn as missing                                                                      |

⚓ n/a vs missing is the whole honesty of the page (⚓ Nate: not-modeled is
SHOWN — it teaches users what the tool can do). Where the data cannot
distinguish them today, §5 says what the data must learn.

## 4. Derivation rules, per sub-segment

All read off `CharacterData`; the walk of the effect surface is
`effectSourcesAtConstellation` at C6 (⛔ never a re-inlined
`[...abilities, ...passives, ...constellations]`).

### 4.1 Timing

| sub-segment | lit                                                                    | provisional                                                                                           | missing                                              |
| ----------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| N           | every `hits[i].frames` present with `anim` (+ `hit` for a cancel tier) | `framesSource` names an unmerged PR / wiki (see §5.3)                                                 | no `hits` frames (the `FRAMELESS_EXEMPT` class)      |
| C           | `chargeFrames` or `chargeHits` present                                 | as N                                                                                                  | absent                                               |
| P           | `plungeFrames` present                                                 | absent → `GENERIC_PLUNGE_FRAMES` (⚓ already ruled a provisional stand-in; the index's `plunge` fact) | — (there is no missing: the generic always takes it) |
| E / Q       | `frames` on the resolved ability (base OR every variant)               | PR/wiki source                                                                                        | no frames anywhere → generic cast length             |

### 4.2 Application

| sub-segment | lit                                                                                                                        | provisional                                                                                                                                              | missing / n/a                                            |
| ----------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| N / C / P   | the swing's `lands` authored (hit lands at its hitmark)                                                                    | no `lands` (lands at swing end — ⛔ NOT flagged provisional in the planner by ruling, but the strip may say "timed at the swing's end", one rung softer) | physical swings with no infusion apply nothing — **n/a** |
| E / Q       | `application[]` present (empty = the POSITIVE "applies nothing" → **lit**, it is measured) and every entry carries `units` | `application[]` absent (falls back to the element at the cast, counted provisional in the aura lane) · present but some entry lacks `units`              | `nonHitting: true` → **n/a**                             |

### 4.3 Grants (E, Q, A1, A4, C-n)

The hard one. An entry with no `effects` is n/a OR missing and nothing in the
data says which today. Three sources, in precedence order:

1. `effects` (or a variant's, or `summons[]`, or `activeDuration`) authored →
   **lit**. A grant on a trigger that has NO reader (`onHeal`, `onEnergy`,
   `onHPChange`, `onHPDecrease`, `onHPIncrease` — memory
   `project_manual_trigger_retirement`) → **provisional** (we took it; the
   planner draws nothing). A `BuffValue {type:'unknown'}` → **provisional**.
2. `notModeled: { reason }` on the host (§5.1) → **not modelled**.
3. Neither: **missing** if the capability oracle expects something here
   (`capability-expectations.mjs` via the audit's expected-but-absent set —
   consumed, never re-derived), else **n/a**… ⚠️ but the oracle is
   per-character, not per-host, and it is game knowledge written for the TB's
   facets. So the day-one rule is simpler and honest: **neither → missing**,
   and §6's classification pass converts the n/a majority into positive
   statements BEFORE launch. The oracle is a cross-check on that pass, not
   the source.

A summon with no `damage` series and no positive "applies nothing / deals
nothing" (§5.2) is **provisional** on the grants sub-segment (the window
draws; its ticks may not).

### 4.4 Character-level facts (the row, not the strip)

`curated` (already in the index) · frames provenance (§5.3) · the count of
lit sub-segments for the sort key · `caveat` presence per host · the
`FRAMELESS_EXEMPT` reason when frameless (→ the tooltip: "waiting on gcsim").

## 5. What the data must learn (the positive statements)

Each is a schema addition WITH its consumer (this page), which is what the
orphaned-schema rule asks for. Each gets a lint.

### 5.1 `notModeled: { reason: string }` on an ability-shaped host

A RULING as data. Today rulings live in `_curatorNotes` prose, which the
page must not render. `reason` is USER-FACING and follows the caveat style
guide (name the thing, ≤2 sentences, no curator-speak) — it is rendered.
⚠️ Lint: a host may not carry both `notModeled` and `effects`; a host with
`notModeled` may carry a `caveat` (the ruling can still leave a pixel wrong).
Census to seed it from: `docs/curation/` rulings (co-op shields — Nicole C2,
Diona C2, Kirara C2 house form; Iansan distance; Hydro Traveler suffusion;
Skirk rifts; Ayaka C1 coin flip; Xiao's ICD case; Zibai C2), plus every
`_curatorNotes` entry that says "unmodellable" / "skipped" / "refused".

### 5.2 A summon that deals or applies nothing says so

35 of 97 summons carry no `damage` series. Some are gaps (six real ones —
`docs/summon-tick-gaps-round.md`), most deal nothing (a taunt, a shield
gadget, a heal-only field). The strip cannot tell them apart. Shape: TBD in
the round — the cheapest honest form is the existing `nonHitting`-style
positive boolean on `Summon` (`dealsNothing: true`), read by the strip only.
⛔ Not `effects: []` — an empty effects list already means "no effects
authored" everywhere else.

### 5.3 `framesSource` becomes a declared field

Orphaned-schema finding 6: Nicole carries `framesSource`, declared nowhere.
The strip is its consumer: `'gcsim' | 'gcsim-pr' | 'wiki' | 'hand'`, with
`gcsim-pr` → provisional timing (Illuga #2677, Kachina #2697 are the live
cases — memory `project_swing_hitmark_round`). ⏭ Authoring it corpus-wide is
a mechanical pass off the frames audit + each character's notes; day one may
ship with it on the PR-sourced characters only and everyone else defaulting
to `gcsim` — say so in the round record.

## 6. The classification pass (the one real cost of shipping with launch)

Census 2026-09-22 (125 characters): **C1/C2/C4/C6 = 500 entries, 198 with
effects, 302 without**; passives 265, 123 with effects, 142 without (of which
~31 carry neither effects nor a note). Most of the 302 are n/a (stamina,
movement, a numeric bump to something we do not draw); some are genuinely
missing; some are rulings. Shown raw on launch day, they would all read
"missing", which misrepresents us in the wrong direction.

The pass: an agent reads each effect-less host's `description` +
`_curatorNotes` and proposes ONE of `n/a` / `missing` / `notModeled(reason)`
into a review table (`docs/curation/coverage-classification.md`); ⚓ Nate
reviews; the accepted rows are written as data by a `jsonc-parser` writer
through `scripts/lib/json-edit.mjs` (`surgicalRewrite`). "n/a" is the
positive statement `models: 'none'`… ⚠️ naming TBD — it must not collide with
`notModeled`, and it must be distinguishable from "not yet looked at", which
is the state a 7.1 character's constellations arrive in. Proposed:

- `notModeled: { reason }` — a ruling (§5.1)
- `nothingToModel: true` — n/a; the host describes nothing the planner would
  ever draw (⚠️ a lint refuses it beside `effects`)
- absent both, no effects — **missing**, the honest default for anything not
  yet looked at

This pass is ALSO the moment `essential-characters-2026-09-15.md`'s backlog
becomes regenerated: sort the page by missing width and it is the list.

## 7. The page

- **Route** `/coverage` under `(scene)/(pages)` beside About/Help — it has no
  document and no band, so it is NOT a fourth tool; it lives in the chrome
  with About/Help (compass overlay below `roomy`). ⚠️ Two entries:
  `src/lib/seo.ts` + `static/sitemap.xml`.
- **Materials**: a readout, so probably paper (`ctx-light`) — ⚓ Nate's eye;
  ⛔ not pre-decided here. The strip's registers are `--ui-provisional` /
  `--ui-warning` / a lit fill / a hatch, ⛔ never element colours (coverage
  is not a mechanic).
- **Header**: sticky column headers (the ONLY labels — rows carry none).
- **Row**: avatar (`getAvatar`, manifest-gated) · name · element/weapon pips ·
  the strip · a lit-count ("12 of 15") as the sort key's visible face.
- **Search / filter / sort**: name search; element / weapon / rarity /
  faction chips (the TB's `GridFilters` vocabulary — reuse
  `characterFilters.ts`); "show only characters with a gap"; sort by name /
  by least covered. **"My roster"** mode reads the `constellations` store and
  DIMS the C-columns above what the user owns.
- **Hover** on a sub-segment → the tooltip: its derived line ("plunge uses a
  generic stand-in", "applications land the element at the cast, counted
  provisional") + the host's `caveat` + the `notModeled.reason`. A caveat's
  host IS its column (lint E.28 guarantees an ability-shaped host), so the
  mapping needs no metadata.
- **Click** a row → an IN-FLOW accordion (⛔ never a modal — memory
  `project_design_principle_nonmodal_tools`) with every facet's line, grouped
  by column, plus provenance and the frameless reason. On `pointer: coarse`
  there is no hover, so the accordion is the only tier — same axis the slider
  uses, nothing designed twice.
- **Links in**: the announcement banner (whose detail line then READS from the
  index — retire the hand-written one; keep the `FRAMELESS_EXEMPT` reminder in
  step by construction), the TB's "not yet curated" bucket, the planner's
  provisional squiggle tooltip ("see coverage"), `/contribute` (§13 pass 2
  copy: "here is the list; here is how to report"). Every row ends in the
  feedback link once §6 of the launch roadmap has its Form ID.

## 8. Tests and gates

- `deriveCoverage.test.ts` — one fixture per state per sub-segment, plus three
  seeded negatives (an `effects`+`notModeled` host; a `nothingToModel` beside
  effects; a `framesSource` value outside the union).
- `characterIndex.test.ts` — drift guard extends to the coverage block.
- `characterLint` — the three new lints (§5.1, §5.2, §6).
- `orphanedSchema.test.ts` — `framesSource` leaves the finding list; the new
  fields have a consumer by construction.
- e2e: one spec — `/coverage` renders 125 rows, search narrows, a row's
  accordion opens, at 1600 AND 390 (the suite's first narrow-width spec, a
  promotion the responsive survey already proposed — ⏭ Nate's OK).
- Per round: vitest / check / lint / build; e2e before the merge.

## 9. Phases

1. **Spec + derivation** — `deriveCoverage.ts`, its test, the index stamp,
   the drift guard. Ships with the three schema additions and their lints,
   authored on their known holders only (rulings census §5.1; `framesSource`
   on Illuga/Kachina/Nicole; `dealsNothing` on the summons the tick-gaps round
   already classified). Measure: a table of the corpus's state counts per
   sub-segment — that table is the first artefact Nate sees.
2. **The classification pass** (§6) — agent-proposed, Nate-reviewed, written
   surgically. Re-measure.
3. **The page** — route, list, strip, headers, search/filter/sort, tooltip,
   accordion, roster mode. Nate judges the strip (widths, the seam question,
   materials) on screen.
4. **Links in + the banner's detail line** reading from the index.
5. Record (§11), memory, merge.

⚠️ Phases 1 and 3 do not depend on each other past the index shape — the page
can be built against phase 1's stamp while phase 2 runs.

## 10. Open for Nate

- The widths in §2.1 and the seam-per-form question (§2), on screen.
- Materials (§7).
- The two field names in §6 (`nothingToModel` / `notModeled`).
- Whether "12 of 15" prints at all, or the sort is silent.
- The narrow-width e2e promotion (§8).

## 11. Record

_Shipped 2026-09-23 on `feat/coverage-page`, merged to `main` the same day. This section wins over §0–§10._

**What shipped**

- **Derivation** — `src/lib/coverage/deriveCoverage.ts` reads a character JSON into **nineteen segments in fixed places**: Normals `N|C|P` × timing|element, E and Q × timing|element|effects, A1, A4, **`extra`** (a tenth column the spec lacked — a third passive or a faction bonus; 16 characters carry one), C1/C2/C4/C6. Five states. It emits line CODES, never prose (`coverageText.ts` holds one whole sentence per code). The index carries one state character per segment (`coverage`), drift-guarded.
- **Four positive statements in the data**, each checked: `notModeled { reason }` (lint E.29), `nothingToModel` (E.29), 🆕 `modeledBy: '<host id>'` (E.29b — a mechanic drawn through a host whose data does not name it), a summon's `dealsNothing` (E.30); plus `meta.framesSource` declared (E.31; `gcsim-pr` on Illuga, Kachina, Linnea, Nefer). 🆕 `CharacterData.release` ("major.minor", genshin-db `version`, the Travelers by hand), required by `characterIndex.test.ts` — ⚠️ a corpus fact, deliberately NOT a `lintCharacter` rule (synthetic sim-test kits carry none).
- **The classification pass** — 499 effect-less hosts read missing on day one; four agents proposed, ⚓ Nate ruled nine CLASSES plus six follow-ups (`docs/curation/coverage-classification.md` is the record), and 251 statements were written surgically: **notModeled 184 · nothingToModel 57 · modeledBy 10**. What remains missing in the effect columns (~219) is the curation backlog, sorted for free by "Least covered first".
- **The page** — an About CHAPTER, rendered in the About/Help overlay over whatever surface you are on (`Chapter.bare` skips `.prose`), and at the `/coverage` route. Search, My roster, sort **Newest first (default) · By name · Least covered first**; hover a segment for a tooltip, select a row for its details in place; the legend is a content-sized row of five where its container allows (a container query on the legend's own wrapper).
- **Links in** — every link opens the overlay IN PLACE (`$lib/coverage/openCoverage`), keeping its `/coverage?c=…` href for new tabs: the planner's Notes panel (per character + "Coverage for this team"), the Team Builder's uncurated bucket and detail card, the landing banner (whose detail line now READS the frameless list from the index — `inTheWorks`), `/contribute`.
- **The planner's opt-in strips** (Settings → Coverage strips, OFF by default): each slotted character's strip under the notation box, the parts THIS rotation does not reach dimmed (`rotationUse.ts`).

**Rulings made along the way (⚓ Nate, 2026-09-23)**

- The test between the n/a-ish states: _would a player reading the timeline ever expect to see it?_ No → `nothingToModel`; yes but ruled out → `notModeled`. A host with ANY modelable-but-unauthored part stays missing.
- Every reason names **the Rotation Planner**, never "we" — "we" reads as a stance, the tool's name as a limit of this tool.
- The planner simulates no chance: two people planning one rotation must see the same bars.
- Absent a charged attack's frames, `C` takes `GENERIC_CHARGE_FRAMES` — a stand-in, not missing. A stance or window a cast opens IS its grant.
- Colours: modeled `--ui-positive`, not modeled hatched in `--ui-danger`, stand-in and missing the editor's own marks (`.cov-state` in app.css).
- The static pages are ONE place: **About | Help tabs** head the overlay and the routes; the overlay and every static route are **72rem**, the sidebar 12rem; prose keeps its 56ch measure.
- **Links**: a real `text-decoration` underline on every text link (`.prose a`, 🆕 `.link`, `.link--quiet`), 45% at rest and 90% on hover, the font's own thickness and offset. The resting underline is also the accessible one: gold on `--text` is 1.57:1.
- Element and weapon filters removed (the Team Builder's questions). The row prints no patch number.

**Deviations from §0–§10**: the tenth column; no seams per form (not drawn, not asked for again); the widths table is as §2.1 plus `extra` 0.5; the page is a chapter, not a fourth route beside About/Help.

**Not done**: the editor's stand-in hover still carries no coverage link — it is a plain `title`, which cannot hold one.

**Found on the way, for the engine queue** (memory `project_engine_queue_2026-09-17`): Alhaitham's C4/C6 read a `mirrors` key nothing grants; Eula's Hold variant keeps its 10s cooldown at C2 (variants have no `cooldownModifiers`); Dahlia C4 extends an unauthored Favonian Favor window. And `.gitignore`'s `coverage/` had swallowed `src/lib/coverage/` and the route — anchored to `/coverage/`.

**Verification**: vitest 2027/2027, check, lint; e2e **78 + 78** passed (chrome + webkit) with the new `e2e/coverage.spec.ts` (wide and 390).
