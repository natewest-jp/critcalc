# Rotation Planner — Project Context

## What This Is

A **Genshin Impact rotation planner** web application built with **SvelteKit + TypeScript**. The tool lets players design and visualize team ability rotations on a timeline (Gantt-style), modelling buff application, ability sequencing, and team synergies.

The project lives under the name **critcalc.app**.

---

## Tech Stack

- **Framework:** SvelteKit
- **Language:** TypeScript (strict)
- **Styling:** CSS (custom properties, flexbox/grid layouts)

---

## Data Architecture

### Source

Character data is sourced from **genshin-db** and transformed into rotation-planner-formatted JSONs. The transform/generate scripts are **not** part of this project — only the pre-generated output JSONs are included (committed to the repo).

### Character Data Format

Each character has a JSON file conforming to a TypeScript schema with these core types:

- **`Ability`** — a character skill or burst, with optional hold variants
  - Flat variant structure (no nested variants)
  - Named skill/burst titles, cooldowns, durations, energy costs
- **`AbilityVariant`** — a variant of an ability (e.g. hold vs tap)
- **`Buff`** — a buff applied by an ability, with a `BuffValue` discriminated union
- **`AbilityTag`** — tags for categorizing ability types

### `BuffValue` Discriminated Union

The `BuffValue` type uses a discriminated union with (at minimum) a `"scaling"` branch, which handles character-stat-based scaling — e.g. Raiden-style `critRate` scaling off a specific stat. ICD is modelled as a boolean only.

### Roster Index

A roster index file aggregates all character entries, loaded via `import.meta.glob` in SvelteKit.

---

## Key Design Decisions & Conventions

- **Flat variant structure:** `AbilityVariant` is intentionally flat — no nested variants
- **Boolean ICD:** ICD is modelled as `boolean` only, no complex gauge tracking at the type level
- **Theorycrafting alignment:** Terminology and mechanics align with KQM (Keqing Mains) theorycrafting standards (ICD, snapshotting, elemental gauge theory, energy recharge)

---

## UI & Visual Design

### Element Color Palette

A custom element color system across four tones per element:

| Tone | Purpose |
|------|---------|
| `shadow` | Darkest, used for depth/backgrounds |
| `mid` | Mid tone |
| `main` | Primary element color |
| `hi` | Highlight/brightest tone |

Used throughout Gantt bars and character portrait gradients.

### Timeline / Gantt Component

The core UI is a **timeline/Gantt chart** for visualizing rotations. Two visual directions are in active development (referred to internally as **Version 1** and **Version 2**). Three initial mockup directions were explored: Waveform, Chip Stack, and Phase Clock — V1 and V2 emerged from this exploration.

**Next step:** Implement the Gantt timeline as a Svelte component.

### Buff Overlap Visualization

The team buffs lane uses one of three overlap strategies (explored via interactive HTML mockup):
- Halftone dot patterns
- Angle hatching
- Inset border stacking

### Ability Data Cards

Cards display per-ability info including hold variants, named skill/burst titles, cooldowns, durations, and energy costs.

### CritHeatmap Component

`CritHeatmap.svelte` — a crit rate/damage heatmap featuring:
- Cubehelix-inspired color ramp
- Draggable tooltip
- Isoline contours
- Variance overlay (zero-crit probability)

---

## CSS Conventions

- **Units:** `rem` for typography
- **Layout:** Flexbox and CSS Grid
- **Scaling:** `aspect-ratio`-based scaling where appropriate
- **Theming:** CSS custom properties throughout

---

## Project Status

Active development. Data layer (TypeScript schema, character JSONs, roster index) is substantially defined. UI work is underway — the Gantt timeline component is the primary next implementation target.
