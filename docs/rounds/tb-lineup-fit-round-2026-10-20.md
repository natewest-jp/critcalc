# The lineup-fit round (2026-10-20)

The Team Builder's Lineup side, re-cut with Nate live over one long session,
phone first and then upward. Branch `polish/tb-lineup-fit`. It began as the
post-launch to-do "a Clear button per lineup" and grew into the Builder's phone
pass (lineups design §11.6 item 20's open point). Every visual ruling below was
made by Nate on the running page. There was no `/lab` board: each pass was
built, measured and judged live.

## 1. Why

A survey at 390 / 600 / 900 / 1280 / 1440 / 1600 found nothing overflowing,
but a lot of space bought for nothing:

- Band B's lineup rail was an empty plate.
- A phone team was 339px, so the three-team board was 1,166px on a 671px pane.
- Three of a team's lines held one small thing each: Planner →, the pin and
  the chips.
- The boss had a line of its own.
- At 1280×800, Battlefield 3 sat under the fold.
- 431–640 stretched the phone form.
- The dock waited until 1136px.

## 2. ⚓ The rulings

**The team row: one arrangement at every width.** The lineup, with the team's
way into the Planner at its RIGHT; the composition chips (resonances and
factions) under it; the fingerprint under them. Only two things change with
width:

- **The boss.** On a phone it sits IN the banner, beside a one-line name cut
  at its colon (no "Battlefield N"), with the checks under it on the
  banner's glass. There they lose their pill ground (glass on glass stacks
  alpha) and drop "characters" / "reactions have an advantage"
  (`CheckChip` `terse`). Where the wide row fits, the boss sits at the left
  with its checks over the lineup — the game's own selection screen.
- **The Planner control.** Where the width is short: a slim vertical plate
  (Nate's idea: "PLANNER" bottom to top, a chevron, 28px wide), hugging the
  screen's edge, with the pin beside the chips. Elsewhere: Planner → over
  the pin, a third and two thirds, as tall as the lineup's frame. The pin's
  name runs to two lines in the player's own mixed case, and its column grows
  into spare width (96–168, roomy 112–200). Planner → keeps its third with
  no pin.

**Measured forms, not breakpoints.** BoardView's `phone`, `phoneStack`,
`tight` and `isRoomy` follow the board's measured width (`WIDE_ROW_MIN`,
`ROOMY_ROW_MIN`). The page's `compact` / `broad` flags are only the SSR first
paint. That retired L3 (431–640) and makes the full-width Lineup tab roomy.

**The fingerprint is locked to the lineup's FRAME**: from its 8px before the
first disc to the end of its hue. Its gaps are fixed and narrow (5 / 8) and
its GLYPHS size to fill: ~14.9px on a phone, ~15.3 on the board, ~18.3
roomy. On the smallest screens (`tight`) it fills its whole row instead.
Checks, chips and fingerprint share the frame's left edge.

**Band B.**

- **Clear** (one press, Undo; Lucide Eraser, ⛔ not Trash2 — closing the tab
  deletes).
- **The season** moved into the lineup rail as its own plate (L1). The
  "Stygian Onslaught" title row went; the tab names the mode.
- **No repeats** is a plate whose MARK is its state (repeat / repeat-off),
  replacing the toggle switch.

With No repeats a mark below `compact`, "Characters" fits at 320 on every
board, so **BP.paneWord retired**.

**The dock from `toolMin`.** The board's width is ONE fluid expression,
`clamp(460px, 100% − 630px, 580px) + clamp(0px, 100% − 1439px, 220px)`. The
Characters column holds while the board grows (460 → 580, then → 800), so
it never narrows as the window widens. Swept 866–1920.

**The Abyss banner sizes to the room the teams leave.**

- The art is its ground at every height, faded hard under the words (to ~20%).
- With room, it grows to its 2:1 shape (≤ 320).
- When even the words don't fit, the blessing clamps to the lines the room
  allows (two at least) with + / −.
- "Spiral Abyss · " folds where the title won't fit one line.
- The halves' blessing runs under the Opponents button.
- ⚠️⚠️ **Every input is independent of the banner**: the teams are measured in
  their own wrapper; the board's gap and padding are read off its style; the
  words' height is the title + padding + the blessing's full `scrollHeight`.
  The first cut measured "the board less the banner" from two observers a
  frame apart, and near the fit it cycled 144 → 121 → 163 → 142px every
  frame (Nate saw it ghost). A 1px sweep of 1,505 sizes is clean now.

**Notices stand where their action happened.**

- Grid actions (a pick that took someone off another team, a swap) report
  in the grid's destination banner.
- Clear reports in the lineup rail.
- Document notices (Saved, a bad link) report in band A.
- Where the right home is not on screen, the notice falls back to the rail,
  then band A.

A notice with Undo in band A had overflowed a 320 phone by 53px. On a phone
the banner's notice takes the count's place for its few seconds. The count is
right-aligned again (↻ sweep item 15).

**The character grid.**

- At most SIX cards a row (`--cg-max-cols`).
- A name never wraps. It SHRINKS to fit from 12px to a 10px floor, measured
  once per name (↻ sweep item 23's second line).
- The name strip's side padding is 3px, so "Dendro Traveler" (89px at 12px)
  holds the floor on the 108px card.

**Rhythm.**

| Form  | Between teams | A row's lines |
| ----- | ------------- | ------------- |
| Phone | 1.25rem       | 0.65rem       |
| Board | 1.5rem        | 0.65rem       |
| Roomy | 1.75rem       | 0.8rem        |

Below `toolMin` the surface sits under band B at the band gap (ToolStack,
the `fill` tool only).

**Copy, approved:**

1. "Repeats allowed" / "No repeats"
2. "A character can join more than one team."
3. "Lineup cleared."
4. Clear's aria "Clear every team in this lineup"
5. More / Less (now + / − marks; their aria-labels)

## 3. Measured

- **A three-team Stygian board fits:** 390×844 (670 in 671), 1440×900 (712 in
  727), 1600×1000 (809 in 827).
- **A phone team:** 339 → 187–231px.
- **No sideways overflow** at 320–430 under touch emulation, nor at any desktop
  width swept. Two hit areas used to reach past the edge, which Chrome's
  device mode scrolled sideways by ~4px: the vertical plate's coarse-pointer
  area and the fingerprint's outermost glyphs.

## 4. Still open

- ⏭ Real Safari and iPhone: Nate's eye (vertical text, the fluid track sizes,
  `line-clamp`, the shrinking names).
- ⏭ The Builder's Help chapter and copy step 6: the static-pages rewrite.
- The character cards' 150 / 168 tile minimums at `broad` / `vast` are still
  viewport steps (live-tuned, untouched).
