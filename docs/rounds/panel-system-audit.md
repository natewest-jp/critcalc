# Panel-system audit → the Visualizers lineup round — 2026-08-05

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

**Branch `feat/viz-lineup-size`, two commits (`1975cb5` feat, `836e747` fix), NOT yet merged at time of writing.**
Gates green (1312 vitest / check 0 / lint clean); probe-viz-slots 27/27, probe-viz-workspace 48/48,
probe-bench-align 7/7 unchanged. Chrome + headless WebKit both verified.

## ⛔ THE VERDICT — no universal panel system. Read this before re-opening it.

Nate's question (after the ribbon round made the Planner and Team Builder look alike — bench left, work
center, filters right): could all three tools adopt a **panel system** — a known one or our own — for
declaring where panels go, how much space they take, how they expand/collapse/stack? **Audited; the
answer is no.** Three reasons, in order of weight:

**1. The convergence was already harvested — at the component layer, not the CSS layer.**

- **`CharacterGrid` is the one real shared layout primitive** (rail + bounded-scroll auto-fill grid,
  `railSide`, `railStart`/`railEnd`/`aboveGrid`/`belowGrid`/`headerEnd`/`tile` snippets, `--cg-*` knobs).
- ⚠️ **The "filter column on the right" is NOT a frame zone in either tool** — it is that component's
  rail. The TB frame has exactly **two** zones (bench + source). This surprises everyone who eyeballs it.
- Plus `BenchBand`, `SlotPortrait`, `.frame`/`.panel`/`.panels`, the contexts, and the `--tool-pad-*`
  shell. The tool shell is deliberately thin: `.tool-main` is a single-cell grid for the cross-fade.

**2. The three layout models differ in load-bearing ways — they are not three takes on one idea.**

|              | Rotation Planner                                   | Team Builder                  | Visualizers                       |
| ------------ | -------------------------------------------------- | ----------------------------- | --------------------------------- |
| Frame owner  | `$lib/components/RotationTimeline.svelte`          | inline in `+page.svelte`      | inline in `+page.svelte`          |
| Frame layout | flex **column of rows**                            | flex **row of zones**         | **grid of N equal tiles**         |
| Scroll model | **the page scrolls**                               | `100svh` fit, zones scroll    | `100svh` fit ≥1024px              |
| "Bench"      | per-row `--rp-bench-w` spacers ×4 — **not a zone** | one `flex: none` zone         | none (no dock, by design)         |
| "Filters"    | absolute overlay, `z-index: 6`                     | `CharacterGrid` rail, in flow | none (controls flow in `.panels`) |

The planner's bench column is the sum of the Gantt's per-row label cells (`LABEL_W = 160`); the ribbon
floats over them. One vocabulary spanning "column of rows that page-scrolls", "row of zones that
viewport-fits" and "N-up grid with keep-alive" would be **longer and harder to read than the ~40 lines of
CSS each tool owns**, and there is no fourth tool coming.

**3. Two prior rulings already decided it.** `.btn--outline` was retired (`2feca02`) on the reasoning
_"my case was 'hand-rolled 7 times', but that's evidence of ACCRETION, not necessity"_; and converging the
bench widths is explicitly vetoed (_"the benches are DIFFERENT widths on purpose … don't 'fix' that into a
single number"_). See `docs/rounds/unified-bench-card.md` and `docs/rounds/style-reference.md`.

**Out of scope by standing ruling:** converged bench widths · a unified cross-tool frame primitive · new
narrow-width breakpoints (side-locked at every width — narrow is the mobile pass's problem, see
`docs/rounds/mobile-conversion-plan.md`) · any change to `.panels { columns: 22rem }` (Nate-ratified, Viz dev round).

## ✅ What shipped instead

**The lineup-size control** (`crit-visualizer/+page.svelte`, `lib/workspace.ts`) — Nate's original
motivating idea: fewer, bigger instruments is a legitimate taste on a wide monitor. Slot count was
viewport width alone; it is now **capacity ∩ preference**, where the preference only ever **caps**
(`viewportCapacity` / `normalizeSlots` / `effectiveSlots`, all pure + unit-tested). A segmented
`Auto | 1 | 2 | 3` in `.ws-toolbar` on the **global `.segment`** — no new CSS. Options past what the
window fits **disable with a reason** rather than accepting a press and doing nothing. Persisted in the
existing v1 envelope (`critcalc:vizWorkspace`) with **no version bump** — an older record has no `slots`
key and normalizes to `'auto'`, which is the pre-control behavior exactly.

**The TILE owns `container-name: instrument`.** ⚠️ The find that made the feature worth doing: all eight
instruments declared `container-type: inline-size`, but **only Crit's name was ever queried — seven
container names were DEAD**, so seven instruments ignored tile width entirely. Harmless while the lineup
was fixed; not once the reader picks it. `.ws-tile` now owns the container and the instrument roots gave
it up (Crit's own root **shadowed** the tile and had to be stripped — a nearer container wins). Seven
byte-identical roots collapsed into **`.instrument` in app.css**, beside `.panels` — same
promote-the-duplicate move, same file, same tool. Crit keeps a bespoke root (it is the one instrument with
its own two-column layout, which `.instrument`'s stacking grid would fight).

**⚠️ Still open, Nate's call:** only Crit actually USES the extra width at 1-up (its
`@container instrument (min-width: 48rem/60rem)` rules). The other seven render honestly but merely
**stretch** — Gauge in particular gets a very wide flat chart with dead space below. Adding side-by-side
chart/controls treatments is **per-instrument design judgment, not a blanket sweep**.

**The styleguide Structure law was re-trued** (`/styleguide` § Laws → Structure — it IS the de-facto panel
spec). It had gone stale four ways: claimed the two tools mirror each other at a **tool-slide seam that
retired with the ribbon round**; called the filter column a frame zone; claimed **every** tool frame is
viewport-fit when **the planner page-scrolls**; and never mentioned the Visualizers. Now also flags that
**`.frame` means two different things** — the tool's outer frame in RP/TB, a _chart interior_ in every
Visualizers instrument. Two stale code comments fixed with it (`CharacterGrid`'s `railSide` JSDoc, an
orphaned TB bench comment).

## 🐞 Bug lesson — stale inline px + automatic minimums (reusable)

Going 1-up and back overlapped the neighbouring instrument by ~309px. **A grid item's automatic minimum
(`min-width`/`min-height: auto`) is its content's MIN-CONTENT — so when a child's size is written inline
in px by JS, that stale value becomes a floor the layout cannot shrink past.** The heatmap's `fitBox`
writes both axes inline. Fixed by zeroing at every level between the box and the tile: `.ws-body`,
`.cv-heatmap-panel`, `.cv-heatmap-shell`. **This is the same law the frames already follow for bounded
scrolling** (_"min-height: 0 at every flex level below it"_) — applied to the axis that was left implicit.

**The height axis was failing too, and SILENTLY** — worth remembering as a class of bug. A stale inline px
height outvoted the shell's `aspect-ratio: 1`, and because the row was auto-sized by that same box, both
765×765 and 765×875 were **self-consistent fixed points**. One trip through a wide lineup and the chart
kept the wide aspect forever, with nothing overlapping to give it away. Same one-line cause, no symptom.

**The invariant now guarded:** chart geometry depends on the **lineup size alone, never on the route taken
to it**. `probe-viz-slots` cycles the control both ways plus resizes the window (nothing leaves its tile,
no horizontal page scroll), then compares a cycled 3-up against a **cold-loaded** 3-up box-for-box.

## Decisions + residue

- **`critcalc:vizWorkspace` deliberately NOT added to the settings-backup allowlist** (Nate, 2026-08-05):
  workspace layout is per-device by nature — the right lineup on a 2400px monitor is the wrong one on a
  laptop, and importing it would fight the viewport. Don't "fix" this later without re-asking.
- **`probe-viz-workspace` was repaired** (48/48) — it had rotted against the styleguide migration
  (`.vz-chip` → `.chip`, the seven `*-note` copies → `.note`, `.wi-toggle` → `.check`).
- ⚠️ **`probe-panels.mjs` is STILL BROKEN** on the same kind of rot: it drives `.rcp-header` /
  `.panel-row`, pruned with the planner character panels 2026-07-19. Untouched — different area.
- **`ResizeObserver loop completed with undelivered notifications` in WebKit is PRE-EXISTING** — verified
  by building `main` and exercising the resize path there. Benign (geometry converges); inherent to the
  heatmap's observe→resize→observe pattern. The lineup control just makes it reachable by click too.
  Deferring `fitBox` to rAF would silence it at the cost of a visible one-frame lag — not worth it.
- The Visualizers' `min-width: 1024px` height-fit query vs the 1360/2200 JS slot thresholds was
  **checked and left alone** — a capped 1-up on a wide screen produces the same shape, so the rule is right.
