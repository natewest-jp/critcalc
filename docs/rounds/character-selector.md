# Character Selector — design and architecture

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

## What it is

Full-screen overlay component for selecting the 4 team slots, triggered by clicking a timeline portrait avatar. Modeled closely on Genshin's in-game Spiral Abyss / Stygian Onslaught character selector.

## Trigger

Clicking the avatar circle in the timeline label column (left side of RotationTimeline). Hover glow on avatars to signal interactivity.

## Layout

- **Left panel (~260px):** 4 vertical team slots (same aesthetic as timeline label column) + filter controls + Confirm button
- **Right panel (flex 1):** search bar + character grid (full-size avatars)
- This is _inverted_ from the in-game layout (game has grid left, team right) — user preferred left=slots, right=grid

## Selection model (mirrors in-game Abyss selector)

- Opens pre-populated with current slots
- Click unselected character → assigns to lowest-numbered empty slot (slot 1 first, then 2, 3, 4)
- Click already-selected character → deselects, frees that slot number
- Slot number badge (1–4) shown in corner of selected character avatars in the grid
- User can Confirm with some slots blank (blank character fills empty slots)
- Always shows all 4 slots; no pre-targeting of a specific slot when opening

## Dual-mode slot architecture (in +page.svelte)

```
let manualSlots: string[] | null = $state(null);
let slots = $derived(manualSlots ?? autoSlotsFromNotation(notation));
```

- `null` = notation-driven (current behavior, auto-populates from notation order)
- non-null = manual mode (selector has been confirmed; slots locked to user's choice)
- Notation always drives timeline bars regardless of mode
- manualSlots persists until selector is re-confirmed
- Phase 2: reset option + warning when manual slot character not in notation

## Filters (phase 1 — basic only)

Element, rarity (4★/5★), weapon type, region. No ability-based filters until JSON data is finalized.

## What it does NOT do

- Does NOT pre-target the slot that was clicked to open it (too complex, unnecessary)
- Does NOT modify the notation text — only sets characterSlots
- Does NOT reset manualSlots when notation changes

**Why:** Notation-driven and manual slot modes are independent. Power users use notation; visual users use the selector to explicitly set slot order.
