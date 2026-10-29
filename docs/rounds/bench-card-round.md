# The BENCH CARD round — ✅ SHIPPED 2026-08-12 (`35b8085`)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

**8 commits, MERGED `--no-ff` into main and PUSHED; live on the noindexed site.**
⚓ **Nate cleared real Safari** before the merge. Gates green throughout; the full
cross-engine e2e ran at the end (197 passed, after the one re-pin below).
⚠ **Cite `35b8085`, the MERGE commit** — not the branch tip `045c73d`.
Supersedes the card half of `docs/rounds/unified-bench-card.md`.

## The one idea

**A name BESIDE a portrait is free; a name BELOW one costs its own line box plus
a gap.** That is why every centred variant lost by ~20px, and it is the whole
argument for the row. The old card stacked three bands (identity / portrait /
loadout) whose outer two were FIXED at 86px, so the portrait was the only thing
that could absorb a change in slot height — and after two condensing rounds it
was rendering at 40px, the smallest object on a card it is supposed to lead.

Result: **200 × 78–82 with a full 60px disc**, where it was 160 × 126 with a
40px one. Both axes improved at once and the card stopped being the timeline's
binding constraint (that watch item in `docs/rounds/rp-scene-round.md` is CLOSED).

## The card's geometry, and why it is derived rather than tuned

- **ONE BAND, THREE COLUMNS**: rail · portrait · column, top-aligned so a tall
  slot's slack falls below, where the timeline puts its own.
- **`CARD_PORTRAIT` (60) IS THE ONLY VERTICAL KNOB.** Everything beside the disc
  derives FROM the band: the rail splits it into two tiles, the column splits it
  into the SAME two tracks, each row centring on its tile. ⚓ Nate found by
  inspector that the name wanted −7px and the controls +2px; that rule reproduces
  both to the pixel, and stayed true when the band moved 68 → 60 in the same
  message, which two nudges would not have.
- **The tile's FILL runs to the disc's CENTRE** (⚓ Nate: "so the buttons cleanly
  extend right under the avatar all the way"). Its right edge is never visible at
  any height, because the circle's left edge sweeps from disc.x+30 at the band's
  top to disc.x at its middle.
- ⚠ **BUT THE BUTTON'S BOX IS ONLY THE VISIBLE STRIP (16px), AND THIS IS THE
  ROUND'S BEST BUG.** Built the obvious way — one 46px tile with its right 30px
  under the disc — the button's CENTRE POINT, where every click lands by default,
  sits inside an opaque portrait that owns the pointer there. Playwright named it
  exactly ("the portrait subtree intercepts pointer events"). A human would not
  have seen a broken button; they would have found one that works at its left
  edge and not its middle. **The thing you can press must be the thing you can
  see**; the hidden remainder is a `pointer-events: none` pseudo.
  The strip's width is SOLVED from the mark clearing the circle's arc at its
  worst corner (the full derivation is in `.sp-card`'s comment) — re-solve it if
  the band, the gap or MARK_SIZE move.
- 🎛️ Knobs: `CARD_PORTRAIT`, `BENCH_CARD_W` (200) in `benchBand.svelte.ts`;
  `--sp-rail-w` / `--sp-rail-gap` / `--sp-rail-mark-inset` / `--sp-rail-underlap`
  / `--sp-col-inset` / `--sp-id-nudge` in `SlotPortrait`.
- ⚠ **`--sp-id-nudge` (2px) CANNOT BE SOLVED.** It aligns the element badge under
  the constellation chip; box-concentric would be 4. The element icons' glyph
  sizing is deliberately not normalised, so no single offset is optically right
  for all seven. A chosen value, not a derived one.

## ⚓ TWO REGISTERS OF CONTROL — the round's most portable idea

> **VALUE CONTROLS ARE WELLS; COMMAND BUTTONS ARE RAISED.**

A chip holding a number is a place data sits, cut into the card
(`--surface-well`); ⇄/✕ are things you press, standing on it
(`--surface-raised`), and squares where the values are capsules. This **inverts**
the 2026-08-11 ruling that all four share one flat fill "so they read as one
family" — which is exactly what went wrong: four identical objects in a row read
as ONE bar of chrome heavy enough to outweigh the portrait. The family was real;
it was the wrong family.

**Both tiles fill on hover, and only the destructive one goes red** — completing
the palette round's rule in its own words: _density separates resting from
engaged, hue separates the two engaged states_. ⚠ Two sanctioned exceptions to
"hover brightens content, never fills" now exist, both Nate's, both on this card.

## What else changed

- **The portrait opens the Detail card in BOTH tools** (⚓ Nate: "it teaches the
  user that it's the exact same set of actions regardless of the tool"). One host
  registration shape (`onOpenDetail` + `onSwap`); ⇄ has a job of its own for the
  first time. An EMPTY portrait falls through to swap — no details for nobody.
  `DetailCard` + `capabilityText` hoisted to `$lib`; the planner imports the card
  LAZILY where the TB imports it statically.
- ⏸ **The Detail card's constellation stepper is DISABLED on the planner, and the
  reason is PARKED, not solved** — it writes Layer 1 while the bench chip writes
  Layer 2, and the planner has never had an L1 editor. Two steppers one click
  apart writing different layers. The full note is on the `conEditable` prop.
- **Cards keep their height into the Team Builder.** Heights are a property of
  the TEAM, not of the timeline that computes them, so the last measurement now
  outlives its timeline (a destroy publishes null and is ignored). ⚠ What is left
  over is deliberately stale.
- **Refinement**: a corner digit on the weapon icon (in-game idiom), absent
  entirely with no weapon; the panel's pips go inert with "equip a weapon first".
- ⚠ **AN EMPTY SLOT KEEPS ITS FOUR STATIONS, all inert at the shared 0.35** —
  and this is a REVERT of my own call, worth recording because the reasoning was
  plausible and wrong. I hid them (four blank discs ARE the empty state; dead
  controls only say it louder). ⚓ Nate: no — **the controls are the slot's
  SHAPE.** A card that loses them stops reading as a slot waiting to be filled
  and starts reading as a smaller, different card, and the four stop being one
  column of the same thing, which is the strip's whole job. Only the NAME is
  empty. The 2026-08-06 four-station ruling was right the first time.
- **Planner band B is a 3-up split** — the controls were glass plates inside a
  glass band. The rail holds the Total readout. 🐛 Two Nate caught by eye: the
  global `.btn:disabled { opacity: .3 }` fades the GLASS on a plate that sits on
  bare scene (dim the ink instead — ⏭ candidate to generalise site-wide), and **an
  empty flex zone still takes its GAP**, which put the rail 4px right of the tab
  above it (both band-B zones now render only when filled).

## ⚓ C0–C6 ARE VECTOR GLYPHS NOW — and what that cost

Nate cut them from IBM Plex Sans mid-round (`static/assets/constellations/`,
generator → `constellationMarks.generated.ts`, rendered by `ConMark.svelte` at
`currentColor` so the existing four-state ink ladder drives them unchanged).
This **retires the chip's centring apparatus**: a no-letter-spacing override plus
a −0.07em nudge, both measured at 8× in two engines. A path has no advance box.
⚠ **The LESSON in `docs/design/subpixel-rendering-laws.md` outlives the fix** — this
one control stopped centring text; nothing else did.

🐛 **AND IT REMOVED THE VALUE FROM THE DOM AS A STRING**, which nine e2e failures
across three engines caught. Anything reading it as text breaks — tests, and
assistive tech had the aria-label not carried it. That is the failure mode to
expect from any future type→geometry swap.

## Measured (1600×1000, Chrome)

|                       | before            | after                                                                                                                                |
| --------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| card                  | 160 × 126         | **200 × 78–82**                                                                                                                      |
| portrait              | 40px (typical)    | **60px always**                                                                                                                      |
| slot heights (4-char) | 126 flat, floored | **96 / 94 / 94 / 94**, rows-driven                                                                                                   |
| ribbon                | 192               | **224**                                                                                                                              |
| Kuki Shinobu          | —                 | 89.3px, ONE line (⚓ Nate's stated bar; she IS the longest — the six longer roster names are Travelers, which `slotLabel` collapses) |

## Related

`docs/rounds/unified-bench-card.md` (card half superseded) · `docs/rounds/bench-band-round.md` ·
`docs/rounds/rp-scene-round.md` (its bench-card brief is discharged) ·
`docs/design/subpixel-rendering-laws.md` · `docs/rounds/ui-state-colors.md` ·
`docs/rounds/motion-round-handoff.md` (queued next)
