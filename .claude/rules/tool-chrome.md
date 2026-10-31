---
paths:
  - 'src/lib/components/TopBar.svelte'
  - 'src/lib/components/ToolStack.svelte'
  - 'src/lib/components/ToolColumns.svelte'
  - 'src/lib/components/BandMenu.svelte'
  - 'src/lib/components/MenuState.svelte'
  - 'src/lib/toolBands.ts'
  - 'src/lib/toolColumns.ts'
  - 'src/lib/tools.ts'
  - 'src/routes/(scene)/+layout.svelte'
  - 'src/routes/(scene)/(tools)/+layout.svelte'
---

# Site and tool chrome

Budget: about 8,000 characters. The design is `docs/design/profiles-and-surfaces-design.md`; the records are `docs/rounds/title-bar-round.md`, `docs/rounds/toolbar-refine-round.md`, `docs/rounds/edges-round.md` and `docs/rounds/builder-toolbar-round.md`.

## What is left of the old layout

Its switch, band A, chrome and overlays are deleted. Its multi-tab document model (`documentBar`, `boardBar`, `rotationTabs`' tabs, Recently closed, the saved banks) is still wired in and listed for removal in `docs/todo.md`; build nothing new on it. `data-next` on `<html>` is set on mount, and the rules scoped to it wait for hydration.

## The top bar (`TopBar.svelte`)

- One bar on every surface, with a priority order: brand and actions are incompressible (`minmax(max-content, 1fr)` flanks), and the centre is the only part that collapses.
- ⚠️ Each child names its own `grid-column`. Never rely on auto-placement: hiding one child moves the next into its track, and nothing overflows to warn you.
- Below 47.5rem (`roomy`), the tool links, Help and the invitation fold into ☰, which opens the menu state's `index` section. The settings cog stays. The wordmark hides below 75rem, and below 22.5rem the phone document's Library mark goes too.
- The current tool's button names its document and opens that tool's Library place. Saving is automatic, and the button shows "Saving… → ✓ Saved".
- Glyphs are sized by ink (`--disc` / `--ink`), never by height.
- `TOOLS` is defined in `$lib/tools.ts`, because the menu state renders outside the tools layout.

## Each tool's toolbar (`ToolStack.svelte`)

- Every tool renders a `ToolStack`: one `ctx-glass` toolbar row under the top bar, then the tool's surface. Control and row height are `var(--ui-ctl-h)`, which follows the interface size.
- Share lives in each tool's toolbar.
- `ToolStack` publishes `--room-*` gaps. A scroller reaches into that gap, so its fade ends at the neighbour. ⚠️ Nested scrollers must reach equally, and `clientHeight` includes the pad-back.
- `--tool-pad-bottom` (1.5rem) is subtracted by every viewport-fit surface. Don't make it viewport-derived.
- ⚠️ A percentage height inside a tool page never resolves: `.tool-main` is `min-height: 100%`, deliberately not definite, so `height: 100%` falls back to `auto`. A fitted surface uses the viewport calc `ToolStack` uses.
- Deep-link query parameters are consumed through `src/routes/(scene)/(tools)/lib/deepLinkUrl.ts`: `$app/navigation`'s `replaceState` throws before the router starts and would abort a cold-loaded link.
- A registration slot shared by the tools is keyed by tool (`benchBand`'s `#hosts`): with a single last-writer-wins slot, the other tool's late teardown nulls it after an A→B→A switch.
- A full-screen section with its own inner scroller must be listed in `MenuState.svelte`'s `fills`, or the content area scrolls as one block and the inner scroller does nothing.
- Switching tools is a 150ms linear crossfade. ⚠️ A tool page you leave is paused, not destroyed, so don't rely on `onMount` to reset state when it is shown again.

## Tool columns (`ToolColumns.svelte`)

- A tool surface is a main box and an optional aside, with bare scene between them (`ASIDE_W` and `COLUMN_GAP` in `toolColumns.ts`). Only the planner uses it.
- The aside is always `ctx-dark` and holds one occupant.
- Below `toolMin` the aside becomes a drawer (`sheet`: portalled, with a scrim, ✕ and Escape). This keys off width only, not the short-screen form.
