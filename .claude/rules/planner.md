---
paths:
  - 'src/routes/(scene)/(tools)/planner/**'
  - 'src/lib/components/RotationTimeline.svelte'
  - 'src/lib/components/PlannerInspector.svelte'
  - 'src/lib/components/BenchBand.svelte'
  - 'src/lib/components/SlotPortrait.svelte'
  - 'src/lib/benchBand.svelte.ts'
  - 'src/lib/rotationTabs.svelte.ts'
  - 'src/lib/plannerView.svelte.ts'
  - 'src/lib/utils/notationEdit.ts'
  - 'src/lib/utils/notationFlags.ts'
  - 'src/lib/utils/notationSeats.ts'
  - 'src/lib/utils/notationEditor.ts'
  - 'src/lib/utils/rotationUrl.ts'
---

# Rotation Planner

Budget: about 10,000 characters. Records: `docs/rounds/planner-slots-round.md`, `docs/rounds/bench-portrait-round-2026-10-13.md`, `docs/rounds/planner-mobile-round-2026-10-14.md`, `docs/rounds/playback-round-plan.md`. The timeline's drawing rules are in `.claude/rules/timeline.md`.

## The team and the notation

- The team is four stored seats that the notation fills (`notationSeats.ts`, a CodeMirror state field, so text and seats share one undo history). A placed seat the notation doesn't name rests; a typed one empties (`seatTeam` in `notationEdit.ts`).
- Swapping a character renames their segments; ✕ (`takeOff`) deletes them, with an Undo toast. Adding into an empty slot writes the seat only and leaves the text alone. Slot order is the slot's key (`setSlot` honours its index).
- ⇄ hands a slot to the Builder's swap mode (`?swap=N`); a commit there returns to the planner.
- `?r=` links are built by `rotationUrl.ts` at format 3 (with `slots` and `placed`). Format 2 still decodes; format 1 does not. Layers, zoom and human timing are never in the codec.
- The editor lints (`notationFlags.ts`, fed by the eager index's `casts`) under one rule: `--ui-warning` means "we cannot take this" (an unresolvable name, a token we don't simulate), and `--ui-provisional` means "we took it, and this is a stand-in" (an approximated cast, a named character who isn't seated, the other twin).
- `A` is a bow's aimed shot, an alias for its charged attack. `W` walks: it resets the attack string and ends the action before it at that action's walk point (`peekActionKey` → `'W'`, which `frameAt` resolves to `anim`), lasts gcsim's bare 1 frame, and draws nothing. FrameMaps carry gcsim's per-character walk overrides as a `W` key (written by `migrate-frames-shape.mjs --walk`), and the audit reads an absent `W` as a claim (`WALK_KEY`).
- ⚠️ The notation editor is lazy-loaded. Never statically import `notationEditor` from code the planner can reach (`conventions.test.ts` checks).

## The toolbar

- Rewind, Play, speed and Laps; Zoom (one plate and a popover, whose Reset resets only the scale); the Total with the Human timing toggle beside it; the layers; Log; Inspector; Share.
- Words fold below `wide`. Below `compact`, a ⋯ holds Rewind, Speed, Laps, Log, Inspector and Share, and the Total drops its key.

## Layers (Buffs, Auras)

- A bar that says when an ability _is_ stays; a bar that says what it _grants_ belongs to a layer. Summons and shields stay. Nate: "a shield is a mechanic." Received-buff rows, weapon procs, the team-buff lane, NB and Ascendant Gleam go.
- The layers are two plates, never a menu, so a stripped chart announces itself. The plates are never disabled.
- ⚠️ Gate the Buffs layer in the projection, never with an `{#if}` in the markup: row heights, the bench's metrics and the PNG export all read the projected arrays. The aura lane is gated in its height term as well as its markup.
- Layer state lives in `siteSettings` (`timelineLayers`), not `plannerView`: zoom belongs to a single look, a layer to the player's taste. Both layers are on outside the narrow form and off inside it, decided at load; only a toggled layer persists. Nothing else resets them.

## The aside

- `plannerView.aside` is `'notes' | 'log' | 'inspector' | null`. The exclusivity lives in that state, never in button handlers.
- In the live layout the occupants are the aura Log and the Inspector (Notes is old-layout only). Log disables when there is no aura log; the Inspector is never disabled and is wider (`--rp-inspector-w`).

## The bench

- The bench is the planner's slot cards, placed from the planner's `[data-bench-anchor]` dock. Only the planner has one.
- On the desk it is a column ribbon beside the timeline that ends in a tapered point. The portrait opens the character's details; ⇄ and ✕ sit in the rail beside it.
- ⚠️ Anything above the first track row moves the bench, whose cards label the track groups. `headerH` (`RULER_H` + the aura lane) is published through `benchBand.trackTop`, and `ribbonHead()` reads it along with the measured toolbar height. Never hand-mirror `RULER_H`.
- In the narrow form the bench is a row between the toolbar and the surface (`BENCH_ROW_H`, reserved in pure CSS by `ToolStack`; the dock is custom properties because an inline style can't be overridden by a media query). It holds upright cards (side portrait plus the loadout pill as one button, no name, no Swap) at a constant 56px, with the portrait solved from the strip (`rowPortrait`, 38–56px). 320px holds four. Above the row, a rail one control high carries the fold chevron, Save as team or Compare, and the folded faces.
- ⚠️ Never use a container query on the bench: containment traps the cards' fixed popovers.
- `--sp-rail-underlap` resolves where it is declared (`SlotPortrait.svelte`).

## The timeline's ground

- The timeline renders straight on the night scene, with no frame: edge fades, a condensed row ladder, and bars made of a material (`--glass-bar`) rather than a colour. Read `docs/rounds/rp-scene-round.md` before changing that ground.
- The PNG export mirrors the screen. After any timeline polish, compare a live view with its PNG.
