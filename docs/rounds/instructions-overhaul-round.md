# The instructions overhaul: a repo set up for the engineer who lives in it

Status: **all five steps shipped 2026-10-29** on `docs/instructions-overhaul`. §12–§13 are steps 1–2 and their ledger; §14 is the to-do candidates for Nate's triage; §15 is steps 3–5; §16 is the memory ledger. §1–§11 are the proposal as Nate approved it, kept as written. Written by Claude at Nate's request: "think about how you would like to have the repo set up … to facilitate yourself first and foremost."

The roles this is built around: Nate directs and designs (requests, instructions, art, rulings, and the final eye on anything visual). Claude engineers and architects, and is the one who reads these files every session. So the files are written for that reader first, while staying readable for Nate.

---

## 1. What it is like now, from my side

**Every session opens with a wall.** The root `CLAUDE.md` is 47,000 characters in 142 lines (7 lines run past 1,500 characters). `MEMORY.md` adds 12,000. And `src/lib/CLAUDE.md`, which loads whenever I touch anything under `src/lib/` (nearly every session), adds 58,000 more in 51 lines, or about 1,150 characters per bullet. That is roughly 30,000 tokens of instructions before I open a file.

**I can't tell what is current.** Rules, a map of the code, project status and history are interleaved. A rule often sits beside its own reversals ("↻ the order flipped later the same day"), its commit hash, the date it changed, and the measurement that justified it. The root file carries 64 dates, 10 commit hashes and 171 ⚠️/⛔/⚓/↻ markers. When 171 things are marked as warnings, none of them stands out.

**Some of it may never reach me.** Claude Code (we're on v2.1.312) loads an on-demand file like `src/lib/CLAUDE.md` only up to a per-file limit, which is 40,000 characters on a 200K context window. At 58,500 characters, if a session runs on that window, the last third of the file (the gauge, the aura lane, the aura log, the layers) is cut off without any notice.

**Knowledge lives in four places with overlapping jobs:**

| Place               | Size                                            | Versioned? | Nate can see it? | Subagents see it?            |
| ------------------- | ----------------------------------------------- | ---------- | ---------------- | ---------------------------- |
| Root `CLAUDE.md`    | 47K chars                                       | yes        | yes              | yes                          |
| `src/lib/CLAUDE.md` | 58K chars                                       | yes        | yes              | when they work in `src/lib/` |
| Memory (215 files)  | 2.3 MB, of which 182 project records are 2.1 MB | **no**     | **no**           | **no**                       |
| `docs/`             | 459 files, 118 entries at the top level         | yes        | yes              | if pointed at them           |

The same fact often lives in three of these, and the copies drift. Two examples from today alone: memory still described the e2e suite as "68 tests per engine, chained with `;`", which this morning's merge replaced, and the auto-mode settings still said the repo was private ten days after launch.

**Many traps are written twice.** The `scrollToSeconds` warning is in `plannerView.svelte.ts` and in `src/lib/CLAUDE.md`. The `minmax(0, 1fr)` warning is in `app.css` and in the root file. The "`collectApplications` no longer sorts" rule is in `sim/aura.ts` and in `src/lib/CLAUDE.md`. The code comment is the copy I actually see when I'm editing that spot. The instruction-file copy is the one that goes stale.

**Most project knowledge is invisible to everyone but me.** 182 of the memory files are round records and plans: 2.1 MB that is not in git, has no history, can't be reviewed in a diff, and (per the Claude Code docs) is **not loaded into subagents**. So every agent a workflow launches works without it.

---

## 2. What I would like: seven principles

1. **One home per fact.** Each kind of knowledge has exactly one place. Everywhere else links to it.
2. **Knowledge sits next to what it's about.** A trap about one spot in the code is a comment at that spot. A rule about one area lives in that area's folder and loads when I work there. Only rules that apply everywhere stay at the root.
3. **Rules load automatically; history is a link.** What I must follow loads on its own. Why it is that way is a link I follow when I need it.
4. **Instruction files speak in the present tense.** No dates, hashes, round names or "↻ reversed later" in a rule. Round records and git hold the history. When a rule changes, it is rewritten in place.
5. **Check rather than tell.** If a test, lint rule or hook can check a rule, it does, and the instruction shrinks to one line naming the check. The error message carries the why. (The new test policy, section 4, makes this possible.)
6. **Plain writing.** A rule is one sentence, a reason, and where to read more. One marker, ⚠️, for a genuine trap and nothing else. No capitals for emphasis: the text style guide's rule, applied to my own files.
7. **Budgets.** Each instruction file states its budget at the top. The Claude Code docs advise under 200 lines per file for adherence. I'd aim for the root file at about 12,000 characters and each area file under about 10,000, well inside every load limit.

---

## 3. The layout

| Kind of knowledge                                                                                                                      | Home                                                                  | When it loads                             |
| -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------- |
| What critcalc is, how we work, rules that apply everywhere, the gates, a map of where things are                                       | Root `CLAUDE.md`                                                      | every session, and again after compaction |
| Design-language rules for any component or stylesheet (roles not primitives, grounds and materials, motion tokens, the sub-pixel laws) | `.claude/rules/ui.md`, scoped to `**/*.svelte` and `src/app.css`      | when I read or edit a matching file       |
| An area's rules and traps                                                                                                              | A short `CLAUDE.md` in that area's folder (list below)                | when I read or edit a file in that folder |
| A trap about one spot                                                                                                                  | A comment at that spot                                                | when I read that code                     |
| Why things are the way they are                                                                                                        | `docs/rounds/`: the round records, moved out of the `docs/` top level | when I follow a link                      |
| The current design of a surface                                                                                                        | `docs/design/` (e.g. the lineups design, notices design)              | when I follow a link                      |
| Generated reports and curation                                                                                                         | `docs/curation/` (unchanged)                                          | when I follow a link                      |
| How to work with Nate; anything private                                                                                                | Memory (user, feedback and reference files only)                      | the index every session                   |

**Proposed area files.** Each one is what that folder is, its laws, its traps, and where its history lives:

- `src/lib/data/` holds the character schema and data conventions: `FrameMap`, `application[]`, effects, caveats, talent level 10, never fake timing, editing JSON with `jsonc-parser`.
- `src/lib/sim/` holds the parser and sim: one clock, the task queue, the gauge, procs, stacks, the reaction bridge.
- `src/lib/timeline/` holds the projections: refresh-merging, shields on the summon lane, the aura lane and log, layers gated at the projection.
- `src/routes/(scene)/(tools)/planner/`, `builder/` and `visualizers/` each hold their tool's rules (the bench, notation as the single source of truth, the lineups design, instruments).
- `e2e/` holds the three spec-writing traps, the cadence, and `--project=`.
- `scripts/` holds the audits and writers, the oracle artefacts never to migrate, and the gcsim checkout.

`src/lib/CLAUDE.md` would disappear, split into the first three files.

> ↻ **Changed in the build (§12):** the area files went to `.claude/rules/*.md` with `paths:` globs instead of nested `CLAUDE.md` files. A directory-based file can't follow the planner, whose code lives in `src/lib/components/`, `src/lib/utils/` and its route folder; a glob can. It also keeps every instruction file in one folder.

**The root file's outline:**

1. What critcalc is: a paragraph, plus one line per tool.
2. How we work: the two roles; what needs Nate's eye (anything visual, real Safari, user-facing copy, taste calls); what I decide on my own.
3. Standing rules that apply everywhere: about ten, one or two lines each.
4. Gates and verification, including the new test policy (section 4).
5. Commits, branches, merges.
6. A map: a "need → go to" table, plus a short glossary of house words (band A/B, bench, ribbon, lineup, profile, night/glass/paper, the oracle, the digest, a round).
7. Keeping these files tidy (section 8).

---

## 4. The new test policy (agreed 2026-10-29)

This replaces the "propose and wait for approval" clause. It is written as it would stand in the root file:

> **Tests.** A bug fix or a new mechanic in the engine or data layer (parser, sim, gauge, reactions, codecs, timing, notation edits, data conventions) ships with a Vitest test beside the module, named in the commit and in the report. No approval needed. The test checks behaviour, not internals, so it survives unrelated refactors. Where a right answer exists before the fix (gcsim, an in-game log, Nate's report), the failing test comes first.
>
> **Still proposed first:** a new e2e spec (each adds browser time to every round and merge), and anything that verifies visual or rendering work. That is built and shown to Nate, never scripted. Nothing Safari-facing is verified until Nate has looked at it in real Safari.
>
> **Never:** a committed one-off probe. Scratch work goes in `scratch/` and is deleted the same turn. No coverage targets.

---

## 5. Memory

Memory keeps only what it is good at: **who Nate is, how we work together, and anything that must not go in a public repo.** That is the 29 user, feedback and reference files (about 200K) today.

The 182 project files would each go one of three ways:

1. **Already covered by a `docs/` record** (63 of them cite one): retire the memory copy, after checking that nothing in it is missing from the record.
2. **A record with no `docs/` twin:** move it into `docs/rounds/`, after a check for private content (feedback sheet ID, personal details).
3. **Status** (the to-do list, open threads): see question 2.

What this changes: the knowledge becomes versioned, visible to you on GitHub, held in one copy, and available to every subagent. `MEMORY.md` shrinks to a short index.

---

## 6. Checks instead of prose

**Hooks** for command mistakes I have made more than once, each a small pattern match that refuses the command and says why:

- `playwright test` with no `--project=` (it runs Firefox and hangs).
- e2e output piped through `tail`.
- `git merge -F -` (it doesn't read stdin).
- `npm run build` or `prettier --write` while an e2e run is serving `build/`.
- A new `scripts/probe-*.mjs`.

**Tests and lint** for rules the instruction files currently state in prose. Each is a small grep-style test. Candidates, to be decided one at a time:

- A media query must write a breakpoint from `$lib/breakpoints.ts` (the root file calls this guard "still a PROPOSAL").
- No `<svelte:head>` title outside `SeoHead.svelte`.
- A new route needs entries in `seo.ts` and `static/sitemap.xml`.
- No static import of the notation editor from planner-reachable code.
- No `color-mix` fed by a `color-mix`.
- `.frame` and `var(--debuff)` are retired and must not reappear.

---

## 7. Tidying along the way

- **Repo root:** `docs/archive/PARSER_BUGFIX_HANDOFF.md` and `docs/archive/PARSER_BUGFIX_HANDOFF_ROUND2.md` are April handoffs, last touched in May. Move them to `docs/archive/` (or delete, your call).
- **`.claude/RESUME.md`:** an untracked checkpoint from 2026-08-18. Delete.
- **`docs/`:** the 118 top-level entries become `docs/rounds/`, `docs/design/` and `docs/surveys/`, with every link in code, docs and skills rewritten by script in the same commit.

---

## 8. How it stays tidy

This part matters most. Without it, the new files grow back into the old ones within a month.

**At the end of every round:**

1. The round's record goes in `docs/rounds/`. It's the only place history is written.
2. An instruction file changes only if a standing rule changed, and then by rewriting the rule in place, never by appending.
3. A trap found in code becomes a comment at its site.
4. Memory gets only lessons about working together.

**Weekly, as a step in the daily check-in:** instruction files against their budgets; dated or reversed claims that have crept into rule files; memory contradicting docs; rules stated in prose that could become a check. A short list, acted on only with Nate's go-ahead.

---

## 9. How the round would go

1. **The root file and the UI rules file.** These are the ones that need Nate's read: about ten minutes.
2. **The area files.** Every claim is **checked against the current code as it moves**, because moving stale text just moves the staleness. Each bullet of the old files splits three ways: the rule goes to its area file; a spot-specific trap goes to a code comment (if it isn't one already); the history is dropped when a round record holds it, or appended to that record.
3. **Memory migration** (section 5).
4. **`docs/` reorganisation** and the link rewrite.
5. **Hooks and checks** (section 6).

**Safeguards:**

- Nate's rulings survive word for word. Where a ruling is the rule, it is quoted, not paraphrased into something softer.
- Nothing is deleted until its new home exists.
- The round record keeps a **ledger**: every bullet of the old files and where it went, so either of us can audit that nothing was lost.
- One branch, merged with `--no-ff` as usual.

Nate's review is needed for step 1, the ledger, and the questions below. Steps 2–5 are engineering.

---

## 10. A sample: one rule, before and after

**Before** (the layers rule as the root `CLAUDE.md` states it today, one sentence of a 2,500-character bullet):

> ⚓ **The planner's LAYERS (2026-08-17) — `(Buffs)(Auras)`, two plates, ⛔ never a menu** (↻ the order flipped later the same day so Auras sits beside the aura LOG button): two toggles are not an abstraction's worth, and a stripped chart must ANNOUNCE itself (a lit plate says "buffs are hidden" at a glance; a closed menu makes "why is my timeline empty" a hunt). ⚓ The cut is **a bar that says when an ability IS stays; a bar that says what it GRANTS goes** — so summons and SHIELDS stay (⚓ Nate: a shield is a MECHANIC), and received-buff rows, weapon procs, the team-buff lane, NB and Ascendant Gleam go. ⚠️ Gated at the **PROJECTION**, never the markup: heights, the aux reserve, the bench's published metrics and the PNG all read those arrays, so ⛔ an `{#if}` around the rows leaves the layout paying for what it no longer draws. ⚠️ State lives in **`siteSettings`** (↻ both ON above `toolMin`, both OFF below it — decided at load; only a TOGGLED layer persists, as `timelineLayers`, 2026-10-14), not `plannerView` — zoom is per-LOOK, a layer is per-TASTE — and ⛔ never in the `?r=` codec. ⚠️ The toggles are NEVER disabled (whether a rotation makes an aura changes per keystroke). ⛔ **Nothing resets them** — band B's button narrowed to **Reset zoom** (⚓ Nate, same day) …

It is also stated a second time, differently, in `src/lib/CLAUDE.md`.

**After** (in `src/routes/(scene)/(tools)/planner/CLAUDE.md`, the only copy):

> ### Layers (Buffs, Auras)
>
> - A bar that says when an ability _is_ stays; a bar that says what it _grants_ belongs to a layer. Summons and shields stay. Nate: "a shield is a mechanic."
> - The layers are two plates in band B, not a menu, so a stripped chart announces itself.
> - ⚠️ Gate a layer in the projection, never with an `{#if}` in the markup. Row heights, the bench's metrics and the PNG export all read the projected arrays.
> - Layer state lives in `siteSettings` (`timelineLayers`): both on above `toolMin`, both off below it, and only a toggled layer persists. Never in the `?r=` codec.
> - The plates are never disabled, and nothing resets them. "Reset zoom" resets only zoom.
>
> Why: `docs/rounds/gauge-round-L6.md`.

The rule is the same and every ruling is kept, in about a third of the length, with no dates or history in the way.

---

## 11. Decisions (Nate, 2026-10-29)

1. **Project memory moves into the repo**, under the scrub rule below. Nate is fine with the development history being public as long as nothing private goes with it.
2. **The to-do list moves to `docs/todo.md`**, written as a working list, not a promise: no dates, no unreleased game content, no feedback attributed to a person.
3. **Nothing in the project is kept out of Claude's hands.**

### The scrub rule

Public git history is effectively permanent: forks, mirrors and caches keep a pushed commit even after it is rewritten. So anything moving from memory into the repo is scrubbed **before it is committed**, never after:

- **Out:** credentials and private IDs (the feedback sheet's ID), email addresses, absolute home-directory paths, personal circumstances (where Nate is, his time and his network), and any third party by name or handle. Users and streamers stay anonymous, as the existing docs already keep them.
- **Kept:** Nate's design rulings and his quoted reasoning about the project. Those are authorship, and `docs/` already carries them.
- **Checked twice:** Claude scrubs as each file moves. Then, before the commit, an independent pass reads the whole diff for nothing but private content. That pass also reads the existing public `docs/` once, since the repo went public on 2026-10-19 with no such check.
- What stays in memory: the user, feedback and reference files, plus any record whose substance is private.

---

## 12. What shipped (steps 1 and 2, 2026-10-29)

- **A new root `CLAUDE.md`** (about 12,100 characters, down from 47,200): what critcalc is, how we work, the standing rules, the gates with the new test policy, commits, a map, house words, and the upkeep rules.
- **Thirteen rule files in `.claude/rules/`**, each loaded only when a file its `paths:` glob matches is read or edited: `data`, `schema`, `sim`, `gauge`, `timeline`, `planner`, `builder`, `visualizers`, `ui`, `tool-chrome`, `scene`, `scripts`, `e2e`. The largest is `schema.md` at about 11,300 characters.
- **`src/lib/CLAUDE.md` is gone.** Its content went to `schema`, `data`, `sim`, `gauge` and `timeline`.
- A planner session that used to load about 105,000 characters of instructions (root plus `src/lib/CLAUDE.md`) now loads about 37,000 (root, `planner`, `ui`, `timeline`, `sim`).
- **One stale code comment fixed:** `rotationUrl.ts`'s header still described the wire format as `2~`; it is `3~`.

### Verified, not just moved

Every claim was checked against the current code as it moved, because moving stale text moves the staleness. Two agents checked the Planner, chrome, Builder, Visualizers and styling claims claim by claim with `path:line` evidence, and I re-checked their key corrections. A script checked that every file and identifier the new files cite exists. What the old files said that was no longer true:

1. **The team is no longer derived from the notation.** It is four stored seats that the notation fills (`notationSeats.ts`): adding to an empty slot doesn't touch the text, and slot order is the slot's key.
2. **The `?r=` codec is at format 3**, not 2.
3. **Band A, the tabs, `SiteChrome` and the `NavPanel` compass are old-layout only.** The live layout has the top bar and one toolbar per tool, Share in each toolbar, and automatic saving.
4. **The Team Builder's Compare/Audition, lanes and tiling are retired**, along with its bench and aside. It is boards and swap mode now.
5. **The planner's aside holds the Log and the Inspector**; Notes is old-layout only.
6. **The narrow form is below `toolMin` or a short screen**, and the bench row has a rail with its own fold chevron.
7. **The breakpoint grep guard exists** (`breakpoints.test.ts`); the old file called it a proposal.
8. **The inset frame is 1px by default**, not 1.5px. A lit toolbar plate is a dim gold fill, not a ring.
9. **The scene dim has three readers**, not two (`dimImageData` paints the PNG's backdrop), and `--frame-bg` is no longer what the PNG paints.
10. **`OG_IMAGE` is at `-v2`**, `--t-move` has more than one user, the ramps include `--blue-*`, and `--surface-hover` is now defined on slate.

### Found along the way (to-do, not fixed here)

- **Only the tools layout has a render boundary.** A throw while rendering a full-screen section under `(pages)` (Teams, Roster, Library, Profile, Settings, Trash, Help) is uncaught. The root `CLAUDE.md` now says so.
- `DerivedCapability.summon` is still emitted but has no reader since Compare retired. A candidate for `orphanedSchema.test.ts` to catch, or for removal.

## 13. Ledger: where everything went

### The old root `CLAUDE.md`

| Old section                                                                                                | New home                                                                                                                                                                           |
| ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Intro ("What this is", the retired "never calculate verdicts" wording)                                     | Root, "What this is" (the scope sentence and "never write never" kept; the retirement story is history)                                                                            |
| Visualizers bullet                                                                                         | `visualizers.md` (workspace, tile-is-the-viewport, Gauge Explorer); materials in `ui.md`                                                                                           |
| Rotation Planner bullet                                                                                    | `planner.md` (corrected: seats, format 3, lint registers, `A` and `W`); the timeline's ground in `planner.md`                                                                      |
| Team Builder bullet                                                                                        | `builder.md`, rewritten for boards and swap mode; the retired Compare/Audition material is history (`docs/rounds/compare-round.md`, `docs/rounds/tb-endgame-round-2026-10-09.md`)  |
| Tech Stack: framework, Node                                                                                | Root, "What this is" and "Standing rules"                                                                                                                                          |
| Styling (four layers, grounds, gold, inset, `--debuff`, `color-mix`, light glass, scrim, glass densities)  | `ui.md`; the tool dim in `scene.md`                                                                                                                                                |
| Motion                                                                                                     | `ui.md`                                                                                                                                                                            |
| Materials                                                                                                  | `ui.md`                                                                                                                                                                            |
| Tool chrome (bands, layers)                                                                                | `tool-chrome.md` (corrected for the live layout); layers in `planner.md`                                                                                                           |
| Site chrome (compass round)                                                                                | `tool-chrome.md`, "The top bar" (corrected: `TopBar.svelte`, ☰, wordmark below 75rem); the SVG `fill-opacity` and ink-area rules in `ui.md`                                       |
| The narrow round                                                                                           | Breakpoints in `ui.md`; the bench row in `planner.md`; the drawer in `tool-chrome.md`. "Where to resume" items stay in `docs/rounds/responsive-survey-2026-09-01.md` and the to-do |
| Tool columns                                                                                               | `tool-chrome.md` (corrected: planner only); the aside's occupants in `planner.md`; marks and Lucide in `ui.md`                                                                     |
| Data Architecture: character data, capabilities                                                            | `data.md`                                                                                                                                                                          |
| Data quality machinery (scripts, probes, parser gate)                                                      | `scripts.md`; the parser gate and `orphanedSchema` in `data.md`                                                                                                                    |
| Key types pointer, stores                                                                                  | Root map                                                                                                                                                                           |
| Coding conventions: no speculative abstractions, SSR, page meta, errors                                    | Root, "Standing rules" (page meta corrected: `/styleguide` and `/lab` are dev-only exceptions; the boundary gap added)                                                             |
| Coding conventions: sub-pixel laws, avatars, hidden input labels                                           | `ui.md`                                                                                                                                                                            |
| Coding conventions: `--tool-pad-bottom`                                                                    | `tool-chrome.md` (the "viewport − 300px" measurement was of the old chrome and is dropped); `auraPlotH` riding the PNG in `timeline.md`                                            |
| Coding conventions: notation length cap                                                                    | `sim.md`                                                                                                                                                                           |
| Commits                                                                                                    | Root                                                                                                                                                                               |
| Verification Policy                                                                                        | Root (with the new test policy), e2e detail in `e2e.md`                                                                                                                            |
| Roadmap: launch, to-do pointer, round log                                                                  | Root map                                                                                                                                                                           |
| Standing rulings: `manual` retired, honest buff lengths, editing character data, summon authoring, shields | `data.md`                                                                                                                                                                          |
| Standing rulings: reading the oracle, oracle artefacts, gcsim checkout, data pipeline                      | `scripts.md`                                                                                                                                                                       |
| Standing rulings: reaction conversion                                                                      | `gauge.md`                                                                                                                                                                         |
| Standing rulings: constellation gating, off-field damage, human timing                                     | `sim.md`                                                                                                                                                                           |
| Standing rulings: gadgets                                                                                  | `timeline.md`                                                                                                                                                                      |

### The old `src/lib/CLAUDE.md`

| Old entry                                                                                                                           | New home                                                                                                     |
| ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `FrameMap`, `application[]`, `Ability`/`AbilityVariant`, `Effect`, `AbilityTag`, `summons[]` and `activeDuration`                   | `schema.md`, "Timing and hits" and "Abilities and effects"                                                   |
| `summonTick.tickCap`, a series that changes cadence                                                                                 | `schema.md`, "Summon ticks"                                                                                  |
| `onFieldDelay`, `whileNormalAttacking` + `icdGate`, `gainStacks.scope`, `onStack`, accrual                                          | `schema.md`, "Buffs, procs and stacks"                                                                       |
| `terminatesOnAction`/`onEnd`/`nonHitting` (both halves), `summonsFollowState`/`toggle`, `cooldownStartsAtStanceEnd`                 | `schema.md`, "States and stances" and "Timing and hits"                                                      |
| `ElementRef`/`coInfusion`/`sE`/`sC`, `cooldownReduce`/`procCap`/`startsOnCooldown`                                                  | `schema.md`, "Elements and cooldowns"                                                                        |
| Data conventions (talent level 10, whole numbers, never fake timing, caveats, frameless characters, KQM, faction tiers, `twoPiece`) | `data.md`; KQM in the root                                                                                   |
| `RotationTimeline.svelte` and the lazy editor                                                                                       | `planner.md`                                                                                                 |
| `notationParser.ts` summary, variant matching, `sQ` and the transient-state primitive                                               | `sim.md`, "Shape"                                                                                            |
| Parser IR, per-swing action events, onHit dispatch, buff windows, off-field summon hits, the tick-chain snapshot, artifact `onHit`  | `sim.md`, "The IR" and "Hits, buffs and stacks"                                                              |
| Elemental-application ICD                                                                                                           | `gauge.md`, "ICD"                                                                                            |
| `infuse` effects                                                                                                                    | `sim.md`, "Infusion"                                                                                         |
| `src/lib/sim/` shape, one clock                                                                                                     | `sim.md`, "Shape"                                                                                            |
| `src/lib/timeline/`, shields on the summon lane, the one summon resolver, refresh-merge                                             | `timeline.md`, "Bars"                                                                                        |
| The parse publishes tick markers                                                                                                    | `sim.md`, "Hits, buffs and stacks"                                                                           |
| `barPhases.ts` and the ghost tail; stance-end cooldowns                                                                             | `timeline.md`, "Bars"; `schema.md`, "States and stances"                                                     |
| The gauge                                                                                                                           | `gauge.md`, "The gauge"                                                                                      |
| The aura lane                                                                                                                       | `timeline.md`, "The aura lane"; the bench coupling in `planner.md`                                           |
| The gauge charts' shared grammar                                                                                                    | `timeline.md`, "The application-marker grammar"                                                              |
| The aura log and the two-way link                                                                                                   | `timeline.md`, "The aura log"; the rAF trap in the root; the `scrollToSeconds` trap stays at its declaration |
| The planner's layers                                                                                                                | `planner.md`                                                                                                 |
| "Three-phase E/Q bar rendering: see `docs/rounds/ui-design.md`"                                                                     | Left to step 3 (memory migration)                                                                            |

### Deliberately dropped

Measurements, before-and-after counts, commit hashes, dates, branch names, and the stories of what was tried. Every one of these lives in the round record each rule now cites. A sample check confirmed the character-specific details survive there (Chongyun C2, Xingqiu's burst, Kinich, Ororon's 0.8s, Ifa, Mona, Kuki, Collei, Itto C2, Ayaka C1, Raiden, Emilie's pairing trap, Lauma's deer, Fischl's Oz, Xilonen).

## 14. Found in the memory migration: to-do candidates for Nate's triage

Open items the old memory files carried that `docs/todo.md` does not. They are not on the list: items change there only on Nate's rulings. "Unverified" means the agent couldn't confirm the item is still open.

**Engine and data**

- Alhaitham C4/C6 read a `mirrors` stack key that nothing grants, so their gates can never pass (`alhaitham.json`).
- Verdant Dew party pool, gcsim's `player/verdantdew.go` model with three spenders (`docs/rounds/verdant-dew.md`).
- Skirk's Serpent's Subtlety → `gainStacks.scope: 'rotation'`: deliberately not flipped yet (the drain interaction is unmeasured).
- Prune's Clang Clang recast (the converted second E) is unmodelled.
- Traveler (Hydro) C4 needs a channel window; a latent wrong-pool hazard in `registerInfusionsOnCast`.
- Elemental-absorption leftovers: Kazuha's plunge add-on, Lan Yan, Wanderer A1, Sucrose C6, Jahoda.
- ICD-cap leftover: Collei's 12th leap. Dumper panic on Mavuika's in-Nightsoul E re-press. Mavuika's form switch mid-Blessing.
- Frames-queue §4: Nilou's Sword Dance swing indexing; Zibai's Ascendant Gleam N4 extra hit.
- Swing-hitmark leftovers: 34 uncovered landing maps; Barbara's and Yae's charged attacks land no damage in gcsim's capture; `humanPad` runs before a charged or plunge landing on the synchronous path.
- Mizuki round F4–F7: Dehya's Sanctum return, a `drivers.json` row for the exit press, Chasca's `C`, Wanderer/Jahoda `holdsField`.
- State-gates §6.7: Varka A1 → `passive` + `scaling atk`; Skirk A4 → an `onHit` on a teammate's hit (unverified).
- Tri-Karma and Oz procs don't enter the finalize hit stream, so they trigger no artifact `onHit` set (unverified).
- 14 curator notes still say "no cooldownStartDelay field", but variants have one now.
- An `atkSpd` stat key (Mika), and DMG Reduction and ATK Speed facets (planned in the Atlas round).
- The reaction's direction on the aura lane ("Vaporize", not "×2"): a multiplier field on `ReactionEvent`.
- Radiance is a standing condition while the Prism is a window (Nate's call, not taken); Thundercloud lightning ticks and the Moondrift Harmony attack are unmodelled.
- Positional schema validation of the character JSON (a generated JSON Schema), deferred from the caveat refresh.
- An LLM semantic audit (one agent per character, kit text against JSON), proposed in the data pipeline, never built.
- Alyosha: once gcsim has his frames, check whether his two burst summons' tick series are offset.
- The frames audit has no column for `summonTick.icdCounter` (Tugarin's row reads "pair by eye").
- Parser-hardening leftovers: bound the `[^)]*` scans, memoize `inferredStates`, debounce the editor parse, and a `MAX_NOTATION_CHARS` test in `rotationUrl.test.ts`.
- The in-game test batch's open items (`docs/rounds/ingame-test-batch.md`).

**Planner**

- Human timing: are Flins's and Varka's held inputs paying a pad they shouldn't? Is a swap press during E/Q buffered?
- A swap-terminated stance still draws its full nominal bar (Raiden Q with a swap at 1s draws 7s); ruled its own round in August.
- Ifa needs stance-cancel mechanics (a token that ends a stance).
- Chongyun C2's cooldown reduction (Nate's wishlist).
- Playback: click the ruler to set the start point; the aura log has no lap column.

**Team Builder and Teams**

- Teams details: browser Back drops an unsaved draft without asking; reordering is drag-only (no keyboard, and HTML drag doesn't work on iOS).
- Should a fingerprint "find" narrow to who would be lit in that team? The 187 KB season data sits in the Builder chunk.
- No user-facing text says the Atlas's roles come from Imaginarium Theater and are a presence classification, not a ranking (Nate's call, unmade).

**Visualizers**

- At one tile, only Crit uses the extra width; the other seven stretch (the "surplus-width policy"). Side-by-side panels stretch to equal height.
- No whole-workspace share.

**Look, landing and site**

- Landing: the announcements box redesign, the phone landing composition, a BETA explainer page; at 844×390 the notices run off the bottom, and at 568×320 the cards touch the wordmark.
- Role SVGs are edited in place at unhashed, immutable `/assets/` paths ("revisit post-launch").
- `.banner` and `.banner-end` have no consumer outside `/styleguide` (an idiom on trial).
- The brand logo's hover uses element `opacity`, the WebKit jitter class (unverified).
- The `<img>` → `background-image` change on roster grids is a Safari 26 workaround; revisit after Safari 27.
- Inline emphasis colour: gold does two jobs, parked since the palette round (unverified).
- Help's Artifact Odds and Wish Odds sections were left as working text for Nate (unverified).
- The drawer's duplicate "Target aura" kicker; `--cg-tile-min` 118 → about 110.

**Housekeeping**

- The rendered-page check for banned unicode characters (once `probe-marks.mjs`) has no home since the probes retired; a convention test could hold it.
- Accept `CA`/`CS` as notation aliases; write the Resonance and Weapon Infusion library docs; unify the bucket numbering between `lunar-reactions.md` and `elevation.md`.

- Stale local branches in the gcsim clone (`pr-2677`, `pr-2697`, `pr-2596-latest`, `linnea`).
- `extract-strings.mjs --write` would rewrite 28 ledger files still carrying old `W` strings (unverified).

**Conflicts between records, for Nate**

- The BETA tag: one ruling says it "drops when Nate says so, don't propose an end condition", while `docs/todo.md` says "removal after the first feedback round".
- Elevate rendering: one record says it is "still frozen", another that the Tier-2 schema was unfrozen.

## 15. Steps 3–5 (2026-10-29)

**Step 4, `docs/` sorted** (`4faee1f5`): four living designs to `docs/design/`, 110 round records to `docs/rounds/`, the two April parser handoffs to `docs/archive/`, and `docs/README.md`. 616 references were rewritten by script (code comments, curator notes, scripts, skills, instruction files, memory).

**Step 5, checks instead of prose** (`c9dc8220`): the guard hook (`.claude/hooks/guard.mjs`) and `src/lib/conventions.test.ts`, each pipe-tested or seeded both ways.

**Step 3, memory into the repo:**

- 195 memory files sorted by six agents and one more for the reference files, against one brief (scratch, not kept): 121 moved into `docs/` as new records (the to-do list among them, now `docs/todo.md`), 52 appended to an existing record as "Notes carried over from Claude's working memory", 20 retired as already covered, and 2 kept private (the design constitution, which holds Nate's background, and the git-identity record, which holds an old personal email).
- About 900 cross-links (`[[name]]`, "memory `x`", links to memory file names) were resolved to their new paths, in the repo and in the memory files that stay.
- Privacy: every moved word was scrubbed as it moved, then three fresh reviewers read everything the round added (new files in full, the added lines of existing ones) and made six more fixes; a pattern sweep over the already-public `docs/` found two home-directory paths, now removed from the working tree (they remain in history from before this round). A public creator credited as the source of a mechanic keeps the credit; players and people who send feedback stay anonymous. Nate's other site is written as "the sister site".
- About 50 verified rules from the old memories joined the rule files, including a new `.claude/rules/svelte.md`. Two rule lines were found stale and corrected (multi-hit swings shipped; Zibai and Alyosha are in gcsim). Two moved records carry a correction note where the code has overtaken them.
- The old memory files went to a holding folder outside the memory directory, recoverable, and `MEMORY.md` was rewritten as a short index of what memory still holds.

## 16. Memory ledger: where each memory went

| Memory                                       | Verdict | Now                                                  |
| -------------------------------------------- | ------- | ---------------------------------------------------- |
| `archive_bug_lessons`                        | move    | `docs/rounds/bug-lessons.md`                         |
| `archive_completed_features`                 | move    | `docs/rounds/completed-features.md`                  |
| `project_abyssal_loading_screen`             | move    | `docs/rounds/abyssal-loading-screen.md`              |
| `project_archetype_consistency_pass`         | move    | `docs/rounds/archetype-consistency-pass.md`          |
| `project_architecture_overview`              | retire  | nothing durable left; superseded                     |
| `project_artifact_curation_plan`             | move    | `docs/rounds/artifact-curation-plan.md`              |
| `project_artifact_odds_pass`                 | twin    | `docs/rounds/artifact-odds-pass-2026-10-06.md`       |
| `project_ascend_revival_2026-08-02`          | move    | `docs/rounds/ascend-revival-2026-08-02.md`           |
| `project_aside_column_round`                 | move    | `docs/rounds/aside-column-round.md`                  |
| `project_band_plates_round`                  | move    | `docs/rounds/band-plates-round.md`                   |
| `project_bars_demo`                          | move    | `docs/rounds/bars-demo.md`                           |
| `project_bench_band_round`                   | move    | `docs/rounds/bench-band-round.md`                    |
| `project_bench_card_round`                   | move    | `docs/rounds/bench-card-round.md`                    |
| `project_bench_portrait_round`               | retire  | `docs/rounds/bench-portrait-round-2026-10-13.md`     |
| `project_bench_tail_round`                   | move    | `docs/rounds/bench-tail-round.md`                    |
| `project_brand_mark_pipeline`                | move    | `docs/rounds/brand-mark-pipeline.md`                 |
| `project_breathing_room_round`               | move    | `docs/rounds/breathing-room-round.md`                |
| `project_buff_bar_merge_round`               | move    | `docs/rounds/buff-bar-merge-round.md`                |
| `project_bug_sweep_2026-07-05`               | move    | `docs/rounds/bug-sweep-2026-07-05.md`                |
| `project_capability_sweep`                   | move    | `docs/rounds/capability-sweep.md`                    |
| `project_cast_hit_record`                    | twin    | `docs/rounds/cast-hit-record-round.md`               |
| `project_caveat_pass_a7`                     | twin    | `docs/curation/caveat-pass/followups.md`             |
| `project_caveat_refresh_round`               | twin    | `docs/curation/caveat-refresh-2026-08-18.md`         |
| `project_character_card_display_exploration` | move    | `docs/rounds/character-card-display-exploration.md`  |
| `project_character_selector`                 | move    | `docs/rounds/character-selector.md`                  |
| `project_cleanup_branch_2026-09-24`          | move    | `docs/rounds/cleanup-branch-2026-09-24.md`           |
| `project_cleanup_branch_2026-09-30`          | move    | `docs/rounds/cleanup-branch-2026-09-30.md`           |
| `project_color_families`                     | move    | `docs/rounds/color-families.md`                      |
| `project_constellation_gating`               | twin    | `docs/rounds/constellation-gating-plan.md`           |
| `project_constellation_shield_wire`          | twin    | `docs/rounds/constellation-shield-gap.md`            |
| `project_cooldown_reduction_round`           | twin    | `docs/rounds/cooldown-reduction-round.md`            |
| `project_coordinated_attacks`                | twin    | `docs/rounds/coordinated-attacks-round.md`           |
| `project_coverage_page`                      | twin    | `docs/rounds/coverage-round.md`                      |
| `project_crit_viz_redesign_status`           | move    | `docs/rounds/crit-viz-redesign-status.md`            |
| `project_cross_character_onhit`              | retire  | `docs/rounds/cross-character-onhit-round.md`         |
| `project_cryo_traveler`                      | move    | `docs/rounds/cryo-traveler.md`                       |
| `project_curation_plan`                      | move    | `docs/rounds/curation-plan.md`                       |
| `project_curator_notes_survey`               | move    | `docs/rounds/curator-notes-survey.md`                |
| `project_damage_anatomy_upgrade`             | twin    | `docs/rounds/instrument-passes-2026-10-01.md`        |
| `project_data_pipeline`                      | move    | `docs/rounds/data-pipeline.md`                       |
| `project_defres_pass`                        | twin    | `docs/rounds/defres-pass-2026-10-06.md`              |
| `project_deployment`                         | move    | `docs/rounds/deployment.md`                          |
| `project_design_constitution`                | keep    | stays in memory                                      |
| `project_design_decisions`                   | move    | `docs/rounds/design-decisions.md`                    |
| `project_design_principle_nonmodal_tools`    | move    | `docs/rounds/design-principle-nonmodal-tools.md`     |
| `project_design_roadmap`                     | retire  | nothing durable left; superseded                     |
| `project_dire_border`                        | twin    | `docs/archive/dire-border-handoff.md`                |
| `project_dire_retirement_round`              | move    | `docs/rounds/dire-retirement-round.md`               |
| `project_e3_handoff`                         | move    | `docs/rounds/e3-handoff.md`                          |
| `project_e3_v2_handoff`                      | move    | `docs/rounds/e3-v2-handoff.md`                       |
| `project_element_icon_generator`             | move    | `docs/rounds/element-icon-generator.md`              |
| `project_element_palette_round`              | move    | `docs/rounds/element-palette-round.md`               |
| `project_elemental_absorption_round`         | twin    | `docs/rounds/elemental-absorption-survey.md`         |
| `project_elevate_visualization`              | move    | `docs/rounds/elevate-visualization.md`               |
| `project_engine_queue_2026-09-17`            | move    | `docs/rounds/engine-queue-2026-09-17.md`             |
| `project_essential_characters`               | retire  | `docs/curation/essential-characters-2026-09-15.md`   |
| `project_event_ended_buffs`                  | twin    | `docs/rounds/event-ended-buffs-round.md`             |
| `project_event_log_round`                    | move    | `docs/rounds/event-log-round.md`                     |
| `project_f1_manual_trigger_cleanup`          | move    | `docs/rounds/f1-manual-trigger-cleanup.md`           |
| `project_f2_residuals`                       | move    | `docs/rounds/f2-residuals.md`                        |
| `project_faction_bonuses_round`              | twin    | `docs/rounds/faction-bonuses-round.md`               |
| `project_flip_notice_round`                  | retire  | `docs/rounds/flip-notice-round.md`                   |
| `project_frames_curation_queue`              | twin    | `docs/rounds/frames-queue-round-2026-10-04.md`       |
| `project_fullscreen_cleanups_round`          | twin    | `docs/rounds/fullscreen-cleanups-round.md`           |
| `project_fullscreen_refine_round`            | twin    | `docs/rounds/fullscreen-surface-round.md`            |
| `project_furina_arkhe`                       | retire  | `docs/rounds/furina-arkhe-round.md`                  |
| `project_gauge_marker_grammar`               | move    | `docs/rounds/gauge-marker-grammar.md`                |
| `project_gauge_round`                        | twin    | `docs/rounds/gauge-round.md`                         |
| `project_gauge_round_l4`                     | twin    | `docs/rounds/gauge-round-L4.md`                      |
| `project_gauge_round_l5`                     | twin    | `docs/rounds/gauge-round-L5.md`                      |
| `project_gauge_round_l5e`                    | twin    | `docs/rounds/gauge-round-L5e.md`                     |
| `project_gauge_round_l6`                     | twin    | `docs/rounds/gauge-round-L6.md`                      |
| `project_gcsim_checkout_state`               | move    | `docs/design/gcsim-checkout-state.md`                |
| `project_genshin_night_palette`              | move    | `docs/rounds/genshin-night-palette.md`               |
| `project_git_identity_rewrite`               | keep    | stays in memory                                      |
| `project_hero_cards`                         | move    | `docs/rounds/hero-cards.md`                          |
| `project_hexerei_stellar_todo`               | move    | `docs/rounds/hexerei-stellar-todo.md`                |
| `project_human_timing_round`                 | move    | `docs/rounds/human-timing-round.md`                  |
| `project_icd_cap_round`                      | retire  | `docs/rounds/icd-cap-round.md`                       |
| `project_icd_round`                          | twin    | `docs/rounds/icd-round-handoff.md`                   |
| `project_immersion_direction_handoff`        | move    | `docs/rounds/immersion-direction-handoff.md`         |
| `project_ingame_test_batch`                  | move    | `docs/rounds/ingame-test-batch.md`                   |
| `project_instrument_layout_round`            | twin    | `docs/rounds/instrument-layout-round-2026-10-06.md`  |
| `project_landing_card_round`                 | move    | `docs/rounds/landing-card-round.md`                  |
| `project_landing_scene_pipeline`             | move    | `docs/rounds/landing-scene-pipeline.md`              |
| `project_landing_status`                     | move    | `docs/rounds/landing-status.md`                      |
| `project_lauma_charged_forms`                | twin    | `docs/rounds/lauma-charged-forms-round.md`           |
| `project_launch_roadmap`                     | move    | `docs/rounds/launch-roadmap.md`                      |
| `project_lazy_character_loading_plan`        | move    | `docs/rounds/lazy-character-loading-plan.md`         |
| `project_legibility_point_fixes_2026-07-31`  | move    | `docs/rounds/legibility-point-fixes-2026-07-31.md`   |
| `project_lightness_structure_2026-08-01`     | move    | `docs/rounds/lightness-structure-2026-08-01.md`      |
| `project_loop_queue_2026-05-12`              | move    | `docs/rounds/loop-queue-2026-05-12.md`               |
| `project_loop_queue_2026-05-14`              | retire  | `docs/rounds/manual-trigger-retirement-round.md`     |
| `project_loop_queue_2026-05-14-cluster-c`    | move    | `docs/rounds/loop-queue-2026-05-14-cluster-c.md`     |
| `project_loop_queue_2026-05-17-wave-4`       | retire  | nothing durable left; superseded                     |
| `project_manual_trigger_retirement`          | twin    | `docs/rounds/manual-trigger-retirement-round.md`     |
| `project_mark_triggered_damage`              | twin    | `docs/rounds/mark-triggered-damage-round.md`         |
| `project_mavuika_nightsoul`                  | twin    | `docs/rounds/mavuika-nightsoul-round-2026-10-16.md`  |
| `project_mirrored_tool_surfaces`             | move    | `docs/rounds/mirrored-tool-surfaces.md`              |
| `project_mizuki_holds_field`                 | twin    | `docs/rounds/mizuki-holds-field-round-2026-10-16.md` |
| `project_mobile_conversion_plan`             | move    | `docs/rounds/mobile-conversion-plan.md`              |
| `project_motion_round_handoff`               | move    | `docs/rounds/motion-round-handoff.md`                |
| `project_notation_single_truth`              | move    | `docs/rounds/notation-single-truth.md`               |
| `project_notices_round`                      | twin    | `docs/design/notices-design.md`                      |
| `project_orphaned_schema`                    | retire  | `docs/curation/orphaned-schema-audit.md`             |
| `project_overview`                           | retire  | nothing durable left; superseded                     |
| `project_p4_event_stream`                    | twin    | `docs/rounds/p4-event-stream-plan.md`                |
| `project_palette_definition_round`           | move    | `docs/rounds/palette-definition-round.md`            |
| `project_panel_system_audit`                 | move    | `docs/rounds/panel-system-audit.md`                  |
| `project_parser_architecture`                | move    | `docs/rounds/parser-architecture.md`                 |
| `project_perf_audit_2026-07-10`              | twin    | `docs/archive/perf-audit-2026-07-10.md`              |
| `project_planner_cleanup_2026-07-18`         | move    | `docs/rounds/planner-cleanup-2026-07-18.md`          |
| `project_planner_color_tokens_2026-07-19`    | move    | `docs/rounds/planner-color-tokens-2026-07-19.md`     |
| `project_planner_frame_grammar_2026-07-19`   | move    | `docs/rounds/planner-frame-grammar-2026-07-19.md`    |
| `project_planner_mobile_round`               | twin    | `docs/rounds/planner-mobile-round-2026-10-14.md`     |
| `project_planner_perf`                       | move    | `docs/rounds/planner-perf.md`                        |
| `project_planner_redesign`                   | move    | `docs/rounds/planner-redesign.md`                    |
| `project_playback_round`                     | twin    | `docs/rounds/playback-round-plan.md`                 |
| `project_polestar_field`                     | twin    | `docs/curation/polestar-field-round.md`              |
| `project_portrait_loading_diagnosis`         | move    | `docs/rounds/portrait-loading-diagnosis.md`          |
| `project_post_launch_todo`                   | move    | `docs/todo.md`                                       |
| `project_preflip_cleanups_round`             | retire  | `docs/rounds/preflip-cleanups-round.md`              |
| `project_profile_surface_round`              | twin    | `docs/rounds/profile-surface-round.md`               |
| `project_reaction_conversion_model`          | move    | `docs/rounds/reaction-conversion-model.md`           |
| `project_reaction_curves_upgrade`            | twin    | `docs/rounds/instrument-passes-2026-10-01.md`        |
| `project_responsive_survey`                  | twin    | `docs/rounds/responsive-survey-2026-09-01.md`        |
| `project_roles_soft_editorial`               | retire  | `docs/curation/capability-sweep.md`                  |
| `project_roster_surface_round`               | twin    | `docs/rounds/roster-surface-round.md`                |
| `project_rotation_planner_roadmap`           | move    | `docs/rounds/rotation-planner-roadmap.md`            |
| `project_rotation_planner_ssr_fix`           | move    | `docs/rounds/rotation-planner-ssr-fix.md`            |
| `project_rp_scene_round`                     | move    | `docs/rounds/rp-scene-round.md`                      |
| `project_rp_source_retirement`               | move    | `docs/rounds/rp-source-retirement.md`                |
| `project_save_button_round`                  | move    | `docs/rounds/save-button-round.md`                   |
| `project_scene_dim_shader`                   | move    | `docs/rounds/scene-dim-shader.md`                    |
| `project_scene_occlusion_perf`               | move    | `docs/rounds/scene-occlusion-perf.md`                |
| `project_scene_star_freeze`                  | move    | `docs/rounds/scene-star-freeze.md`                   |
| `project_schema_model_mismatch`              | move    | `docs/rounds/schema-model-mismatch.md`               |
| `project_settings_help_consolidation`        | move    | `docs/rounds/settings-help-consolidation.md`         |
| `project_settings_surface_round`             | twin    | `docs/rounds/settings-surface-round.md`              |
| `project_shield_summon_split`                | move    | `docs/rounds/shield-summon-split.md`                 |
| `project_simplification_round_2026-07-24`    | move    | `docs/rounds/simplification-round-2026-07-24.md`     |
| `project_stage2_odette_alyosha`              | move    | `docs/rounds/stage2-odette-alyosha.md`               |
| `project_stance_chain_pilot`                 | retire  | nothing durable left; superseded                     |
| `project_stance_cooldown_round`              | twin    | `docs/rounds/stance-cooldown-round.md`               |
| `project_state_gates_round`                  | twin    | `docs/rounds/state-gates-round.md`                   |
| `project_static_pages_site_chrome`           | move    | `docs/rounds/static-pages-site-chrome.md`            |
| `project_stepped_stacks_round`               | twin    | `docs/rounds/stepped-stacks-round.md`                |
| `project_stores`                             | retire  | `docs/design/profiles-and-surfaces-design.md`        |
| `project_style_reference`                    | move    | `docs/rounds/style-reference.md`                     |
| `project_summon_bound_buffs`                 | retire  | `docs/rounds/summon-bound-buffs-round.md`            |
| `project_summon_tick_gaps_round`             | twin    | `docs/rounds/summon-tick-gaps-round.md`              |
| `project_summon_tick_onhit`                  | twin    | `docs/rounds/summon-tick-stacks-round.md`            |
| `project_swing_hitmark_round`                | twin    | `docs/rounds/swing-hitmark-round.md`                 |
| `project_tall_bench_round`                   | move    | `docs/rounds/tall-bench-round.md`                    |
| `project_tb_atlas_round`                     | move    | `docs/rounds/tb-atlas-round.md`                      |
| `project_tb_card_round`                      | move    | `docs/rounds/tb-card-round.md`                       |
| `project_tb_compare_round`                   | move    | `docs/rounds/tb-compare-round.md`                    |
| `project_tb_final_layout`                    | move    | `docs/rounds/tb-final-layout.md`                     |
| `project_tb_loadout_constellation_port`      | move    | `docs/rounds/tb-loadout-constellation-port.md`       |
| `project_tb_round_2026_10`                   | move    | `docs/rounds/tb-round-2026-10.md`                    |
| `project_team_builder_atlas_roles_facets`    | move    | `docs/rounds/team-builder-atlas-roles-facets.md`     |
| `project_team_builder_redesign_2026-07-20`   | move    | `docs/rounds/team-builder-redesign-2026-07-20.md`    |
| `project_team_builder_tool`                  | move    | `docs/rounds/team-builder-tool.md`                   |
| `project_teams_surface_round`                | twin    | `docs/rounds/teams-surface-round.md`                 |
| `project_text_round`                         | twin    | `docs/rounds/text-round.md`                          |
| `project_tier_c_architecture_plan`           | move    | `docs/rounds/tier-c-architecture-plan.md`            |
| `project_timeline_extraction_cleanup`        | move    | `docs/rounds/timeline-extraction-cleanup.md`         |
| `project_tool_constitutions`                 | move    | `docs/rounds/tool-constitutions.md`                  |
| `project_tool_page_revival`                  | move    | `docs/rounds/tool-page-revival.md`                   |
| `project_tool_scene_brightness_2026-07-31`   | move    | `docs/rounds/tool-scene-brightness-2026-07-31.md`    |
| `project_toolbar_refine_round`               | twin    | `docs/rounds/toolbar-refine-round.md`                |
| `project_toolbar_round`                      | move    | `docs/rounds/toolbar-round-2026-08-07.md`            |
| `project_transition_hardening_queue`         | move    | `docs/rounds/transition-hardening-queue.md`          |
| `project_twin_frames_round`                  | twin    | `docs/rounds/twin-frames-round.md`                   |
| `project_ui_design`                          | move    | `docs/rounds/ui-design.md`                           |
| `project_ui_state_colors`                    | move    | `docs/rounds/ui-state-colors.md`                     |
| `project_uncurated_two_tool_split`           | move    | `docs/rounds/uncurated-two-tool-split.md`            |
| `project_unified_bench_card`                 | move    | `docs/rounds/unified-bench-card.md`                  |
| `project_unified_chrome_areas`               | move    | `docs/rounds/unified-chrome-areas.md`                |
| `project_varka_two_elements`                 | retire  | `docs/curation/varka-two-elements-scope.md`          |
| `project_verdant_dew`                        | move    | `docs/rounds/verdant-dew.md`                         |
| `project_viz_dev_round_2026-07-24`           | move    | `docs/rounds/viz-dev-round-2026-07-24.md`            |
| `project_vz_on_the_scene`                    | move    | `docs/rounds/vz-on-the-scene.md`                     |
| `project_weapon_artifact_type_plan`          | move    | `docs/rounds/weapon-artifact-type-plan.md`           |
| `reference_data_schema`                      | move    | `docs/rounds/data-schema-reference-2026-04.md`       |
| `reference_element_wash_recipe`              | move    | `docs/design/element-wash-recipe.md`                 |
| `reference_elemental_reactions`              | retire  | `docs/library/game/elemental-reactions.md`           |
| `reference_font_weight_ladder`               | move    | `docs/design/font-weight-ladder.md`                  |
| `reference_framemap_conventions`             | move    | `docs/rounds/framemap-conventions.md`                |
| `reference_game_knowledge_library`           | twin    | `docs/library/README.md`                             |
| `reference_hrule`                            | move    | `docs/design/hrule.md`                               |
| `reference_icon_set`                         | move    | `docs/design/icon-set.md`                            |
| `reference_kqm_notation`                     | move    | `docs/library/kqm-notation.md`                       |
| `reference_subpixel_rendering_laws`          | move    | `docs/design/subpixel-rendering-laws.md`             |
| `reference_worktree_node_modules`            | retire  | `CLAUDE.md`                                          |
