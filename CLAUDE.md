# critcalc.app — Project Context

## What This Is

A **Genshin Impact tooling site** built with **SvelteKit + TypeScript**. Three tools, unified by one philosophy: **visualize mechanics, never calculate verdicts** (no damage numbers, no tier lists, no synergy scores — see the tool constitutions in project memory).

- **Crit Visualizer** ("Visualizers") — complete: five graph instruments (crit heatmap, ICD timeline, artifact rolls, gauge explorer, reaction curves)
- **Rotation Planner** — the flagship: KQM-notation → frame-accurate Gantt timeline. The visual redesign (SVG overlay, cN rows, controls relocation, PNG export) merged to main 2026-07-13 (`80da4f5`); remaining is a Nate-directed cleanup round + real-Safari pass
- **Team Builder** — feature-complete 2026-07-13 (`3742300`): capability-faceted roster ("who can heal/shield/buff, at which constellation") with provenance detail cards, aligned comparison + uptime glyphs, team slots, and `?team=`/`?replace=` cross-injection. Design thesis: `docs/archive/team-builder-brief.md`

---

## Tech Stack

- **Framework:** SvelteKit (Svelte 5 runes), `adapter-static`, deployed via Cloudflare Pages
- **Language:** TypeScript (strict); **Node ≥22.18** (`.nvmrc` pins 22) — scripts import TS modules via native type stripping
- **Styling:** CSS custom properties, no UI framework. Design language: Commit Mono + Bitter, `vz-panel`/`vz-kicker` shells, `--accent` (dire tint), odd radii

---

## Data Architecture

### Character Data

123 character JSONs in `src/lib/data/characters/`, generated **in-repo** by `scripts/ingest-character.mjs` from the `genshin-db` devDependency (the old external generator is retired). Canonical type is `CharacterData`. Full payloads are code-split and lazy-loaded (`characterData.ts`); the eager index (`characterIndex.generated.ts`, regenerated on predev/prebuild) carries identity fields **plus derived capability summaries**.

### The Capabilities Layer (`src/lib/capabilities/deriveCapabilities.ts`)

Capabilities (heal/shield/off-field DMG/res shred/buffs/cleanse/grouping/…) are **derived from effects and tags, never hand-maintained**, each with provenance (source ability, constellation gate, runtime-condition caveats). Consumed by the Team Builder facets, the build-time index, and the audit. Runtime-import-free so Node scripts execute it directly.

### Data Quality Machinery (all in `scripts/`)

- `ingest-character.mjs` — new-character stub + talent sidecar (`docs/curation/talents/{id}.json`, per-level scaling tables)
- `audit-capabilities.mjs --write` — diffs derived capabilities against the game-knowledge fixture (`capability-expectations.mjs`) → `docs/curation/capability-audit.md`, **the curation backlog**
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
- Avatars: `getAvatar(id, preferNewfit, size, traveler)` — availability manifest (`hasAvatar`) prevents SSR'd 404 imgs (prerender fails on them); regenerate via `npm run generate-newfit`
- Gates before any commit: `npx vitest run` (lint/parse/derivation/index-drift), `npm run check`, `npm run lint`

---

## Roadmap Snapshot (2026-07-15)

All three tools are built and merged to `main`; launch is a **readiness decision** (connect the domain), not a build gate. Prioritization SoT is the **Launch Roadmap** in project memory — remaining work grouped by model-fit (🟣 Opus-friendly / 🔵 Fable-led).

- **At the launch boundary:** simplification/legibility pass across the three tools (🔵, tandem with Nate) → localization (`docs/i18n-plan.md`) → connect domain.
- **Data pipeline** (`docs/curation/data-quality-plan.md`): curation backlog effectively exhausted (audit at 11 findings — mostly upstream-blocked stubs + documented gaps). Open: A7 caveat readability pass (⏸ paused for Nate). ⛔ Tier-2 schema work (reactions/elevation) frozen by Nate.
- **Nate-only:** real-Safari verification backlog; connect-domain (the launch action).
