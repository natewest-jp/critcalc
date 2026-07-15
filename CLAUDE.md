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
- `normalize-talent-levels.mjs` — enforces the talent-level-10 value convention
- Probes: `probe-team-builder.mjs` (21 checks), `probe-traveler-avatars.mjs`

**The full recipe for adding/curating characters is the `ingest-character` skill** (`.claude/skills/ingest-character/`). Frame extraction: the `gcsim-frames` skill. **A local gcsim checkout at `~/Code/gcsim` is the primary verification source** (tick cadences, scalings, targeting — `internal/characters/{id}/`).

### Key Types

- **`Ability`** / **`AbilityVariant`** — flat structure, `FrameMap` timing per hit; `ConstellationAbility.constellationLevel` is the canonical gate
- **`Effect`** — discriminated union (buff/damage/heal/shield/resShred/energy/infuse/…); heal/damage/**shield** carry optional `flat`; `Condition` trees gate effects (strict `condition-shape` lint)
- **`AbilityTag`** — `heal | shield | summon | taunt | coordinatedAttack | cleanse | grouping` (lint-enforced vocabulary)

### Data Conventions

- **Values at TALENT LEVEL 10** (sidecar rows' 10th column) — enforced by the normalize script
- `atk%` buff values are **whole numbers** (store `22.5` not `0.225`); `BuffValue` scaling ratios likewise percentage points
- **Never fake timing** — tick intervals/durations only from gcsim/kit text; `~?s` for unknowns; `_todo` for unmodelable effects
- `caveat` = user-facing (plain language); `_curatorNotes` = curator-only (technical)
- Frameless characters live in `FRAMELESS_EXEMPT` (characterLint.test.ts) and render honestly ("not yet curated" bucket in the Team Builder; generic cast-time fallbacks in the planner). **Frames flip `isCurated` — never land frames on an effect-empty kit**
- Terminology aligns with **KQM (Keqing Mains)** standards throughout

### Roster/Loadout Stores (`src/lib/stores.ts`)

localStorage-backed, shared across tools: `constellations` (characterId → 0–6; feeds Team Builder "My roster" mode), `loadout`, `siteSettings` (incl. `useNewOutfits`, `travelerVariant` — Aether/Lumine avatar choice), `savedNotations`.

---

## Rotation Planner — Key Internals

- **`RotationTimeline.svelte`** — Gantt timeline: E/Q/active/buff rows, cast markers, swap connectors, zoom/scroll; CodeMirror notation editor (lazy-loaded — **never statically import notationEditor from planner-reachable code**)
- **`notationParser.ts`** — pure; E-charge queues, Q cooldowns, condition pipeline (`evalCondition`), `N5` = 5-normal loop, bracket expansion, stance windows; `DEFAULT_ASCENSION = 4`
- **`src/lib/timeline/`** — pure derivation modules (team buff rows, summon subrows w/ tick markers, moonsign rows) + tests
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
