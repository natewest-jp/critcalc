# The bench portrait round (2026-10-13)

The Planner's bench after the Team Builder's lineups round. Branch
`polish/rp-bench-after-lineups`. Every visual ruling below was made by Nate on a
`/lab` board built from the real `SlotPortrait`; the board was removed when the
form landed.

## 1. Why

The Builder left the bench on 2026-10-08 (lineups design §2.1), and swap mode
retired the audition the bench used to hand off to (§11.6 item 20). Three
rulings had not reached the bench (§10.3: ✕ goes, ⇄ is "Swap"; §9.5/§9.5a: the
side portrait and the ownership mark), and an empty slot was a dead end: its
portrait sent `?swap=N`, the Builder returned early ("no one to replace") and a
pick there filled a BOARD team.

## 2. What shipped

**Behaviour (`7860583a`)**

- ✕ is gone (⚓ Nate: removing a character is deleting their actions, which the
  notation already does). Not moved into swap mode either.
- ⚓ An EMPTY slot or a typed Blank opens swap mode ADDING:
  `swapping.incumbent: null` on the errand row only, the grid sectioned by what
  each candidate brings (`swapSections` already handled an empty slot), the
  destination strip "Adding to the Planner's team", the pick through the same
  `rt.setSlot` (append, or rename the Blank). A board still fills its empty
  slots by picks, the game's way.
- The two-tool bench machinery's comments were rewritten. ⚠️ The docked→docked
  branch of `benchNavTransition` STAYS: it is no longer a tool-to-tool leg but
  still the interrupt path (leave the planner and come back before the exit
  leg hides the ribbon).
- `rotationTabs`' dead team writers (`addToTeam` / `removeFromTeam` /
  `clearTeam`) and the Builder's unread `?alts=1` went.

**The card (form C, landed after six `/lab` passes)**

- ⚓ **The Builder card's grammar.** The PORTRAIT acts — Swap on the desk,
  filled or empty — and a MAGNIFIER at the disc's top right, shown on
  hover/focus (always, with no hover), reads (details). ⚓ The portrait,
  the constellation and the magnifier are SIBLING buttons (the first cut
  nested the constellation inside a `role=button` portrait).
- The portrait is `SidePortrait` (60px). The ring is `--line-soft`, gentle
  gold (`--sel-ring`) on hover — the ring is BEHIND the art, so hair still
  crosses it. ⚓ `SidePortrait.fadeRight`: the art fades out sideways (8px),
  gone 6px past the disc on the desk, 2px on the phone, so a ponytail
  (Nahida's) eases into the ground; and the column paints OVER the art (z 2
  over 1) so what still reaches slips under the loadout well.
- The constellation sits ON the disc (the Builder chip's place), still the
  editor: filled = covered, HOLLOW = the plan asks for more than you own (the
  Builder's `ownedConOf` rule), a ghost at C0 + covered. ⚠️ It claims
  `ctx-dark` itself, as `SidePortrait` does — on `/lab` the hollow well
  resolved to the glass rung of the host's context.
- No element badge (⚓ Nate: the planner's bars wear the element, as the
  Builder's cards do for its slots). Names 6px lower; the controls row sits on
  the band's BOTTOM (centred, it ended 1px short of the chip — measured).
- `BENCH_CARD_W` 200 → 165 (⚓ Nate) → **181**: ⚓ the RIBBON is as wide as the
  brand above it (mark + wordmark, ⛔ not the BETA tag, which will be dropped).
  Measured to the wordmark's ink: 203; tune(nate) by eye: **210** (card 186).
  ⚠️ Nate's tail artwork was drawn at a 224 ribbon — until it is redrawn at 210
  (2× = 420), `benchBand.svelte.ts` stretches each tail path linearly to the
  new width (the frame is then not an exact parallel offset along the taper).
- ⚠️ The magnifier fades on the ring's clock (`--t-snap`) in the PAINT, never
  element opacity (the ribbon is transform-placed); `visibility` rides the same
  transition so it stops taking clicks only once faded.

**The phone row — the UPRIGHT card (Nate's idea)**

- The loadout pill stands upright (flower over weapon) beside the portrait,
  as ONE button (the whole ~22 × 47 pill is the touch target; two ~22px
  squares would have overlapping 24px circles under WCAG 2.5.8). No name, no
  magnifier, ⚓ **no Swap**: swap mode needs the lineup beside the grid, which a
  phone cannot show, and the notation is the phone's control. The portrait
  READS on the phone; an empty one does nothing.
- One constant height, `BENCH_ROW_CARD_H` 56 (the portrait's cap), so
  `ToolStack` still reserves the strip in pure CSS: **`BENCH_ROW_H` 102 → 80**.
  The portrait is solved from the strip (`rowPortrait`): 38 at 320 (floor —
  four cards fit at 320 now, no scroll), 49 at 360, 56 from ~390.
- ⛔ The desk card no longer appears in the row at any width (the old
  `BENCH_ROW_CARD_FULL_MIN` form).
- ⚓ The row sits BETWEEN BAND B AND THE SURFACE (Nate: compact enough to belong
  beside the timeline it labels), where it used to sit above band A —
  `ToolStack` puts the dock in flow with `order`.

## 3. Rejected on the way (⛔ don't re-propose)

- **Swap at the controls row's end** — beside the timeline it read as belonging
  to the timeline; Swap belongs on the LEFT, the Builder's side.
- **A corner tile behind the portrait** (the old rail cut down to a corner) —
  crowded the left edge, which the side icons FACE.
- **Swap in the Detail card on phones** — no Swap on phones at all (above).
- **A stacked phone card** (portrait over a pill + ⇄ row, the first cut) —
  the upright card frees 22px of height.
- Forms A (today's disc) and B (side portrait, chip in the column).

## 4. Open (at the merge, 2026-10-13)

**This round's own leftovers**

- 👤 **Tail artwork** — Nate redraws it at the 210 ribbon: `bench-clip-path.svg`
  420 wide at 2×, `bench-inset-point.svg` ring 400 (= 210 − 2 × RIBBON_EDGE) at
  2×, stroke 4 at 2×. Then re-transcribe `TAIL` in `benchBand.svelte.ts` and
  delete the `X` stretch + `TAIL_ART_W`.
- ⏭ **Copy, proposed and unruled:** swap mode's first section when ADDING still
  reads "Keeps everything" (proposed: "Adds"); the destination strip's "Adding
  to the Planner's team" is kept from the board's existing pattern.
- ⏭ **Help #team** still describes the old bench ("one and the same team in both
  tools", ⇄ "to compare replacements", ✕, "the Team Builder's roster") — goes to
  the static-pages rewrite, as a numbered line-by-line proposal.
- ⏭ At 80px tall the phone strip's wide frame radius reads as a pill — judge on
  a real phone.
- 👤 **Safari** — the `:has()` hover ring, the magnifier's paint fade, the art's
  `fadeRight` mask and the ribbon at 210 are new visual work.
- ⏭ The lab's older "The bench, on the scene" specimen is a hand-drawn 200px
  card and is stale; the PNG export's label column also still draws the
  pre-bench portrait label (stale before this round).

**Before the static-pages rewrite (from the 2026-10-13 scan)**

- The Team Builder's **phone pass**: band A's swap notice doesn't fold at narrow
  widths; team hues are still `--team-hue-*` placeholders.
- **Step-6 copy** (tier names, "Loses nothing", "Replacing X · Battlefield 2",
  the notice sentences) — rule now or inside the rewrite.
- Decide whether CLAUDE.md's launch-boundary **simplification pass** comes before
  the help is written.
- The static pages themselves: the TB Help chapter is almost entirely stale; the
  retired "never verdicts" creed is still in About, the FAQ, the Planner chapter
  and `seo.ts`; undocumented — boards/battlefields/fingerprint/swap mode/Library,
  the aura log, team bonuses, Total, zoom popover, tabs, Share menu, the Viz
  "Instruments shown" control, `?c=`.
- **Pre-launch:** a site-wide animation sweep (roadmap memory).
