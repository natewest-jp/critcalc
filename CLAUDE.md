# critcalc.app — Project Context

## What This Is

A **Genshin Impact tooling site** built with **SvelteKit + TypeScript**. Three tools, unified by one philosophy: **visualize mechanics, never calculate verdicts** (no damage numbers, no tier lists, no synergy scores — see the tool constitutions in project memory).

- **Crit Visualizer** ("Visualizers") — complete: five graph instruments (crit heatmap, ICD timeline, artifact rolls, gauge explorer, reaction curves)
- **Rotation Planner** — the flagship: KQM-notation → frame-accurate Gantt timeline. The visual redesign (SVG overlay, cN rows, controls relocation, PNG export) merged to main 2026-07-13 (`80da4f5`); remaining is a Nate-directed cleanup round + real-Safari pass
- **Team Builder** — feature-complete 2026-07-13 (`3742300`): capability-faceted roster ("who can heal/shield/buff, at which constellation") with provenance detail cards, aligned comparison + uptime glyphs, and team slots. Design thesis: `docs/archive/team-builder-brief.md`. Since the bench-band round (2026-08-05): team composition is ONE working team — the planner's active tab (`src/lib/rotationTabs.svelte.ts`), edited by both tools; the slot cards are the layout-level **bench band** (`BenchBand.svelte`, placed from per-tool `[data-bench-anchor]` docks, gliding across the tool pan; since the abutting round 2026-08-07 each tool BEGINS at the strip's right edge rather than tucking under it — two surfaces that fade together must not overlap), which always writes Layer 2; the `?team=` cross-injection retired (inbound deep link only)

---

## Tech Stack

- **Framework:** SvelteKit (Svelte 5 runes), `adapter-static`, deployed via Cloudflare Pages
- **Language:** TypeScript (strict); **Node ≥22.18** (`.nvmrc` pins 22) — scripts import TS modules via native type stripping
- **Styling:** CSS custom properties, no UI framework. Design language (Genshin-UI archetype, 2026-08-05): **two CONTEXTS** — `.ctx-dark` (chart panels, parchment-on-navy) / `.ctx-light` (most panels + character cards, paper with slate labels) — floating over the live GL scene (transparent tool shell + ink dim); `--chrome` white for site chrome/branding; `--accent` is context-borne (interim). The dire and gilt families are retired; `--debuff` carries the enemy-facing semantic. `/styleguide` is the reference (its full context rewrite is queued)
- **Tool chrome (toolbar round, 2026-08-07):** every tool renders a `ToolStack` — two ABUTTING bands over its surface, with the bench ribbon proud of the whole stack. **Band A (`ctx-dark`) is the DOCUMENT** (the shared rotation tabs + Save/Load/Share, identical in the planner and the Team Builder — they edit one working team); **band B (`ctx-light`, on `--ribbon`) is the VIEW** (planner zoom/notes, TB Atlas/Roster/Compare + con lens, Viz per-tile pickers). Geometry knobs in `src/lib/toolBands.ts`; document flows in `src/lib/documentBar.svelte.ts`.
- **Tool columns (aside-column round, 2026-08-08):** a tool SURFACE is a main box and an optional aside box with bare scene between them — `ToolColumns` (`src/lib/toolColumns.ts` holds `ASIDE_W`/`COLUMN_GAP`), with the bands spanning both. The aside is always **`ctx-dark`** and takes ONE occupant, each tool deciding in one expression: the planner's notes (`RotationNotes`) or its Source's filters covering them; the TB's filters on the Roster only. `CharacterGrid` (tiles) and `CharacterFilterRail` (the filter column) are siblings that meet on the consumer's `filters` object (`GridFilters`, in `characterFilters.ts`); the planner picker's two halves broker through `src/lib/pickerFilters.svelte.ts`. Control symbols are inline geometry (`<Mark name="…">`), never unicode — sourced from **Lucide as a devDependency + generator** (`scripts/generate-marks.mjs` → `src/lib/marks.generated.ts`), never a runtime import; see memory `reference_icon_set`

---

## Data Architecture

### Character Data

123 character JSONs in `src/lib/data/characters/`, generated **in-repo** by `scripts/ingest-character.mjs` from the `genshin-db` devDependency (the old external generator is retired). Canonical type is `CharacterData`. Full payloads are code-split and lazy-loaded (`characterData.ts`); the eager index (`characterIndex.generated.ts`, regenerated on predev/prebuild) carries identity fields **plus derived capability summaries**.

### The Capabilities Layer (`src/lib/capabilities/deriveCapabilities.ts`)

Capabilities (heal/shield/off-field DMG/res shred/buffs/cleanse/grouping/…) are **derived from effects and tags, never hand-maintained**, each with provenance (source ability, constellation gate, runtime-condition caveats). Consumed by the Team Builder facets, the build-time index, and the audit. Runtime-import-free so Node scripts execute it directly.

### Data Quality Machinery (all in `scripts/`)

- `ingest-character.mjs` — new-character stub + talent sidecar (`docs/curation/talents/{id}.json`, per-level scaling tables)
- `audit-capabilities.mjs --write` — diffs derived capabilities against the game-knowledge fixture (`capability-expectations.mjs`) → `docs/curation/capability-audit.md`, **the curation backlog**
- `audit-capability-sweep.mjs --write` — the **external-axes sweep**: diffs derived capabilities against Fandom wiki capability categories (committed snapshot `docs/library/wiki/capability-categories.json`; refresh via `fetch-wiki-capabilities.mjs`, the only script that touches the network — MediaWiki API, WebFetch is blocked) and Genshin's IT roles → `docs/curation/capability-sweep.md`. Verified-wrong wiki rows suppressed via `WIKI_KNOWN_WRONG` in `wiki-capability-config.mjs` (evidence-noted, GDB_CD_KNOWN_WRONG contract). `--mutate id:kind` = seeded-negative self-test
- `audit-genshin-db-diff.mjs` — diffs shipped JSON scalars (energyCost/cooldown/identity) against a freshly-regenerated genshin-db stub → `docs/curation/genshin-db-diff.md`. **Review-candidate generator, never an auto-fixer** — genshin-db CD data can be wrong for newer chars (verify mismatches against gcsim; `GDB_CD_KNOWN_WRONG` suppresses verified rows)
- `audit-data-outliers.mjs` — self-consistency sweep (no oracle): decimal-form leaks, resShred sign (stored **negative**), placeholder zeros, median+MAD magnitude outliers → `docs/curation/data-outliers.md`
- `normalize-talent-levels.mjs` — enforces the talent-level-10 value convention
- Probes: `probe-team-builder.mjs` (21 checks), `probe-traveler-avatars.mjs`
- **Parser-invariant gate** (`src/lib/utils/notationParser.roster.test.ts`, vitest): drives a per-character notation from each char's declared input tokens (incl. Hold/tap/press variants the plain smoke test misses) and asserts no-throw / all-finite / empty `unknownTokens` / hold-≠-tap timing — catches silent parser fallbacks corpus-wide

**The full recipe for adding/curating characters is the `ingest-character` skill** (`.claude/skills/ingest-character/`). Frame extraction: the `gcsim-frames` skill. **A local gcsim checkout at `~/Code/gcsim` is the primary verification source** (tick cadences, scalings, targeting — `internal/characters/{id}/`).

### Key Types

- **`Ability`** / **`AbilityVariant`** — flat structure, `FrameMap` timing per hit; `ConstellationAbility.constellationLevel` is the canonical gate
- **`Effect`** — discriminated union (buff/damage/heal/shield/resShred/energy/infuse/…); heal/damage/**shield** carry optional `flat`; `Condition` trees gate effects (strict `condition-shape` lint)
- **`AbilityTag`** — `heal | shield | summon | taunt | coordinatedAttack | cleanse | grouping` (lint-enforced vocabulary)

### Data Conventions

- **Values at TALENT LEVEL 10** (sidecar rows' 10th column) — enforced by the normalize script
- `atk%` buff values are **whole numbers** (store `22.5` not `0.225`); `BuffValue` scaling ratios likewise percentage points
- **Never fake timing** — tick intervals/durations only from gcsim/kit text; `~?s` for unknowns; `_curatorNotes` for unmodelable effects
- **`caveat` strings follow `docs/curation/caveat-style-guide.md`** (player-facing voice, ≤2 sentences, no curator-speak; lint-enforced by characterLint E.26)
- `caveat` = user-facing (plain language); `_curatorNotes` = curator-only (technical)
- Frameless characters live in `FRAMELESS_EXEMPT` (characterLint.test.ts) and render honestly ("not yet curated" bucket in the Team Builder; generic cast-time fallbacks in the planner). **Frames flip `isCurated` — never land frames on an effect-empty kit**
- Terminology aligns with **KQM (Keqing Mains)** standards throughout

### Roster/Loadout Stores (`src/lib/stores.ts`)

localStorage-backed, shared across tools: `constellations` (characterId → 0–6; feeds Team Builder "My roster" mode), `loadout`, `siteSettings` (incl. `useNewOutfits`, `travelerVariant` — Aether/Lumine avatar choice), `savedNotations`.

---

## Rotation Planner — Key Internals

- **`RotationTimeline.svelte`** — Gantt timeline: E/Q/active/buff rows, cast markers, swap connectors, zoom/scroll; CodeMirror notation editor (lazy-loaded — **never statically import notationEditor from planner-reachable code**)
- **`notationParser.ts`** — pure; E-charge queues, Q cooldowns, condition pipeline (`evalCondition`), `N5` = 5-normal loop, bracket expansion, stance windows; `DEFAULT_ASCENSION = 4`. Variant matching is **condition-aware** (variant `conditions` must eval true; the parser builds team context for teamElementCount/teamFaction). **sQ** (KQM short-burst — Flins Thunderous Symphony, Varesa Volcano Kablam) rides the **post-action transient-state primitive**: `opensTransientState` on instant casts / `actionOpensState {normal?, plunge?}` on normals open short gating states at the action's end (plunge landing / first-swing recovery — Durin's dual-form dark commit); spec `consumes: State[]` closes named windows at open (mode displacement); variant `consumesState` closes them at cast; variant `bypassesCooldown` skips the burst clock.
- **Parser IR (P4 + post-P4 #2/#5)** — `parseNotation` emits a first-class IR: `events: TimelineEvent[]` (time-sorted `cast`/`action`/`reaction`/`shieldEnd`/`nightsoulBurst` points, each with a stable `id`) + `windows: TimelineWindow[]` (span records with FINAL ends — state/summon/shield/weaponProc/**buff**, all extensions/truncations pre-applied, `sourceCastId`/`sourceActionId` provenance; stance windows are `state` windows named `inStance` with a `source`). Types in `src/lib/utils/rotationEvents.ts` (re-exported from the parser). **Action events (post-P4 #2)** are per-SWING for normals (`N5` → 5 events sharing a `blockId` anchor, each with `comboIndex`/`element`), one each for charged/plunge/dash/jump/unset. **onHit dispatch (post-P4 #5)**: parser-private per-swing HIT records (swing-END time; element absent ⇒ physical; per-swing = one hit — multi-hit swings are a documented approximation) drive full symmetric gainStacks/consumeStacks dispatch (`source:'self'` per-segment — Yanfei seals; team/others rotation-wide, decay shape lint-required; `Effect.procCooldown` ICDs; `holderStatesAt` resolves any holder incl. following-summon `duringSummon` — Escoffier C6's gate). **Buff windows (post-P4 #5)**: `deriveBuffWindows` (`src/lib/utils/buffWindows.ts`, at finalize) computes ALL who-buffs-whom-when — character onCast/onHit/afterDuration/onReaction, N/CA/P per-swing with refresh-merge, NB, artifact 4pc, weapon swap-proc ICDs, active-target slices with CONCRETE receivers — as `buff` windows carrying effects + trigger-time context; `parseNotation` takes `teamCharacters` (the slot roster) for team context. **Bars, inputBlocks, nbRows, AND buff rows are projections** — `teamBuffRows`/`charReceivedBuffRows` shrank to group+format (display strings stay in `buffDisplay.ts`). Invariants guarded corpus-wide by `notationParser.ir.test.ts`; behavioral coverage in `buffWindows.test.ts`.
- **`src/lib/timeline/`** — pure projection modules (buff rows, summon subrows w/ tick markers, moonsign rows, weapon-proc rows, NB lane) consuming the parser IR + tests; `effectCollection.ts` lives in `src/lib/utils/` (parser-shared)
- Three-phase E/Q bar rendering + element palette: see memory `project_ui_design`

---

## Coding Conventions

- **No speculative abstractions**; flag data gaps with `// TODO: data gap — [field]`
- SSR/hydration safety: deterministic default first paint → onMount restore (pattern in memory `project_rotation_planner_ssr_fix`)
- **Sub-pixel rendering laws (2026-08-06 — /styleguide § Laws holds the full text):** alpha belongs in the **paint** (translucent `background-color`/`fill-opacity`), never element `opacity`, on anything transform-placed — WebKit rasterizes an opacity subtree at rounded coordinates and it visibly dances. Symbol marks are **inline geometry**, never unicode characters (engines pick different fallback faces at different sizes). Centering a label centers its **box**, not its **ink** — measure with `scripts/probe-ink-centering.mjs` and tune optical nudges against **Chrome**, since WebKit snaps glyphs to whole pixels and its offset moves with layout position
- Avatars: `getAvatar(id, preferNewfit, size, traveler)` — availability manifest (`hasAvatar`) prevents SSR'd 404 imgs (prerender fails on them); regenerate via `npm run generate-newfit`
- Gates before any commit: `npx vitest run` (lint/parse/derivation/index-drift), `npm run check`, `npm run lint`

---

## Verification Policy

**Prefer running existing checks over writing new verification code.**

- `npm run check` — svelte-check
- `npm run test` — Vitest (parser/IR, capability derivation, character lint, codec roundtrips, timeline projections)
- `npm run lint` — prettier + eslint (incl. the `condition-shape` and caveat-style rules)
- `npm run build` — the production build is the real gate; **never verify against dev only**
- `npm run test:e2e` — Playwright at the browser surface, Chrome + WebKit (`e2e/`, 68 tests per engine). Builds and serves its own preview every run, so it cannot measure a stale server. Variants: `test:e2e:chrome`, `test:e2e:webkit`, `test:e2e:ui`, `test:e2e:storm` (the slow cross-engine nav storm, `@storm`-tagged and excluded from the default run), `test:e2e:report`. 🐛 **Read the "N passed" line, not the exit code** — an UPSTREAM Chrome shutdown bug ([playwright#39753](https://github.com/microsoft/playwright/issues/39753), unfixed through 1.62.1) intermittently hangs worker teardown, so the process exits 1 with everything green. Don't bisect our specs for it (details in `playwright.config.ts`)
- Data validation lives in Vitest (`characterLint.test.ts`, `characterIndex.test.ts`) plus the `scripts/audit-*.mjs` reports — there is **no** `validate:data` script

Do not write a script to answer something readable in the source, documented in the SvelteKit/Vite docs, or already covered above.

If you need to observe runtime state, use an inline command (`node -e`, `curl | grep`, `npm run build && grep build/`) rather than creating a file. If a file is genuinely unavoidable, write it to `scratch/` (gitignored), run it, report the finding, and **delete it in the same turn. Never commit a one-off probe** — `scripts/probe-*.mjs` is a retired pattern, not a place to add to.

**Promote to a permanent check only when:**

- it caught a real, observed bug, AND
- the assertion survives unrelated refactors.

Propose the promotion and wait for approval; don't add spec or test files unprompted. When a promotion IS approved, it goes in `e2e/` (browser-level) or beside the module as a Vitest file — never back into `scripts/`.

**Writing an e2e spec** — three traps that have each cost real time, all documented at their site in `e2e/fixtures/critcalc.ts`:

- `addInitScript` re-runs on **every** navigation including `reload()`, so the `seed` fixture only fills keys that are absent. Seeding unconditionally makes a reload-then-assert test measure the seed instead of the app.
- `hasText` matches `textContent`, not rendered text: a button leading with a `<Mark>` SVG has whitespace first, so `/^Save/` never matches — and the uppercase you see is CSS `text-transform`, a separate trap.
- The nav-storm spec needs `--workers=1`. Concurrent headless browsers each driving the GL scene starve each other's rAF, which looks exactly like the transition bug it hunts.

**Calculation work:** when verifying a damage or buff figure, add it to the regression fixtures rather than checking it once and discarding the script.

**Visual and rendering work** (canvas instruments, the WebGL scene, gradients, SVG filters, typography): do not write verification scripts. Build it, describe what changed, and let Nate look at it.

**Safari: assume nothing is verified until Nate has checked it manually.** Playwright WebKit catches thrown errors, not rendering or performance differences.

---

## Roadmap Snapshot (2026-07-15)

All three tools are built and merged to `main`; launch is a **readiness decision** (connect the domain), not a build gate. Prioritization SoT is the **Launch Roadmap** in project memory — remaining work grouped by model-fit (🟣 Opus-friendly / 🔵 Fable-led).

- **At the launch boundary:** simplification/legibility pass across the three tools (🔵, tandem with Nate) → localization (`docs/i18n-plan.md`) → connect domain.
- **Data pipeline** (`docs/curation/data-quality-plan.md`): the external capability sweep (wiki categories + IT roles) finished 2026-07-28 at 0 actionable findings; internal audit at 10 (documented gaps + 6 frameless stubs). Roles CSV = Genshin's IT table + documented editorial amendments (Fischl/Rosaria +Support). **✅ Faction-buffs round SHIPPED 2026-07-29** — Hexerei Secret Rite across 12 characters (`factionBonuses`, two-layer gates); Stellar-Conduct across 7 (enabler model: `CharacterData.enablesReactions` + `teamEnablesReaction` conditions; the parser converts superConduct→stellarConduct when an enabler is in the slot roster); the bucket-5 `*ReactionBonus` Stat family (Reaction Bonus, additive-with-EM — distinct from the bucket-3 `*DmgBonus` bracket; rule: wiki category "<Reaction> DMG Bonus"→`*ReactionBonus`, "Base DMG Bonus"→`*DmgBonus`); TB Factions/Buffs filter (Moonsign/Hexerei/Stellar). Tier-2 (reactions/elevation) is UNFROZEN and largely cleared; `docs/library/game/stellar-reactions.md` is the mechanics reference. Remaining: the 7.0 watch-list in project memory `hexerei-stellar-todo` (Mizuki/Stellar Swirl, new enablers = data drops, wiki snapshot refresh).
- **Nate-only:** real-Safari verification backlog; connect-domain (the launch action).
