# critcalc.app — Project Context

## What This Is

A **Genshin Impact tooling site** built with **SvelteKit + TypeScript**. Three tools:

- **Crit Visualizer** — complete
- **Rotation Planner** — in active development (primary focus)
- **Team Builder** — planned (side-by-side character comparison)

---

## Tech Stack

- **Framework:** SvelteKit
- **Language:** TypeScript (strict)
- **Styling:** CSS custom properties, no UI framework

---

## Data Architecture

### Character Data

140+ character JSONs in `src/lib/data/characters/`, generated externally from **genshin-db** (generator not in this repo). Loaded via `import.meta.glob` in `characterLookup.ts`. Canonical type is `CharacterData` — old types (`Character`, `SkillData`, `RawCharacter`, etc.) were removed. All new components consume `CharacterData` from `getCharacterById()`.

### Key Types

- **`Ability`** / **`AbilityVariant`** — flat structure (no nested variants), holds `FrameMap` timing data per hit
- **`Buff`** / **`BuffValue`** — discriminated union with `"scaling"` branch; ICD is `boolean` only
- **`Weapon`** / **`ArtifactSet`** — in `src/lib/data/weapons/` and `src/lib/data/artifacts/`; weapon JSONs not yet authored

### Data Conventions

- `atk%` buff values are **whole numbers** (store `22.5` not `0.225`) — stat key carries the unit
- `_todo` marks effects too situational to model reliably (e.g. aura-dependent procs)
- Terminology aligns with **KQM (Keqing Mains)** standards throughout

### Roster/Loadout Stores (`src/lib/stores.ts`)

localStorage-backed, shared across tools:

- `constellations` — `characterId → 0–6`
- `loadout` — `characterId → { weaponId?, artifactSetId?, weaponRefinement? }` (two-layer: character defaults + per-tab overrides)

---

## Rotation Planner — Current State (as of 2026-04-18)

### Implemented

- **`RotationTimeline.svelte`** — full Gantt timeline: E/Q/active/buff rows, cast-time markers, swap connectors, zoom/scroll, ruler. CodeMirror notation editor (syntax highlight, autocomplete, paste normalization, undo history).
- **`RotationCharacterPanel.svelte`** — collapsible ability reference panel per character (E/Q timing, variants, effects chips).
- **`LoadoutDropdown.svelte`** — weapon/artifact picker with two-layer loadout (character defaults + tab overrides). Artifact `onCast` buffs (Noblesse Oblige, Maiden Beloved) already wired in team buffs row.
- **Team Buffs row** — `computeTeamBuffRows()` derives buff windows from character E/Q effects + artifact `onCast` triggers. One sub-row per `(characterId, stat)`.
- **NB (Nightsoul Burst) lane** — amber (#f0a030), visible when ≥1 Natlan character, triggers on E/Q + catalyst input blocks.
- **Moonsign lane** — visible when `hasAscendantGleam` (≥2 Moonsign units); rolling 20s windows per non-Moonsign character.
- **`TeamBonusesBlock.svelte`** — faction badges + permanentBonuses grid, shown between timeline and panels when relevant.
- **Multi-tab save system** — up to 6 localStorage-persisted tabs, inline rename, save bank modal (`SavedNotation` store).

### Notation Parser (`src/lib/utils/notationParser.ts`)

Pure function; no side effects. Key mechanics:

- **E charges:** `eChargeQueues: Map<string, number[]>` — per-charge independent cooldowns; charge count from `resolveEffectiveCharges()` (constellation-aware)
- **Q cooldown:** `qReadyAt: Map<string, number>` — single timestamp
- **Condition pipeline:** `evalCondition` → `applyModifiers` → `resolveAbilityTiming`. Constellation conditions resolve definitively; `duringSummon`/`inStance` resolve from runtime state
- **`N5`** = "5 normals in a row" (not "5th hit"); expands to a per-hit frame loop
- **Bracket expansion:** `2[N5C]`, `[N5C]x3`, `2-4[N5C]` forms
- **Stance mechanics:** `stanceWindows` map for in-stance ability switching (Cyno, Hu Tao, etc.)
- `DEFAULT_ASCENSION = 4` assumed for all characters

### In Progress (Pass 2 of loadout/buffs feature)

- **Weapon JSONs** — `src/lib/data/weapons/*.json` — none exist yet; next implementation target
- `onSwap` / `onHit` / `onReaction` / `onStack` trigger computation for buff row
- `resShred` effects (Viridescent Venerer) — separate rendering treatment
- `procCooldown` enforcement between procs

---

## UI & Visual Design

### Element Color Palette (3 fields per element)

| Field    | Purpose                                     |
| -------- | ------------------------------------------- |
| `main`   | Solid element color                         |
| `border` | `main` at 0.5 opacity; cast-time markers    |
| `hi`     | `main` mixed 50/50 white; inset border glow |

Key colors: pyro `#e05a4a`, hydro `#1472f0`, anemo `#4ecbb4`, electro `#c070f0`, cryo `#88c8f0`, geo `#d4a040`, dendro `#80c840`

### Timeline E/Q Bar System

Three-phase bar rendering per E/Q ability:

- **Phase 1** (solid, uptime): `p.main` fill + inset `--bar-hi` box-shadow. z:2
- **Phase 2** (dim continuation, when CD < duration): `p.main` at 0.65 opacity. z:2
- **Phase 3** (ghost CD remainder): `color-mix(in srgb, {p.main} 23%, bg)` — fully opaque tint. z:0
- Swap connectors at z:1 (above ghost, below solid)

### CSS Conventions

- `rem` for typography; flexbox/grid for layout; `aspect-ratio`-based scaling
- `color-mix(in srgb, ...)` for Phase 3 fill simulation
- Tools layout: `100dvw × 100dvh` fixed position

---

## Coding Conventions

- **No speculative abstractions** — build exactly what the current task needs
- **Flag data gaps** with `// TODO: data gap — [field]` rather than adding fallback hacks
- **KQM terminology** throughout (ICD, snapshotting, ER, elemental gauge theory)
- **Don't fake timing data** — use `~?s` for unknown durations, never silently assign plausible values
- `C` cancel frames included in `hits[]` for sword/claymore/polearm; bow uses `chargeHits[]` instead

---

## Planned (Not Yet Implemented)

- Weapon JSONs + `onSwap`/`onHit`/`onReaction` proc computation
- Constellation-aware ability panel display
- URL-encoded rotation state (bookmarking/sharing)
- Sample rotations on load-in
- Export as PNG / KQM-formatted text
- Controls row / slider relocation (ping slider → site settings)
