# The stage, round 2: Artifact odds (2026-11-03)

**Status:** 🔨 built on `feat/viz-artifact-stage`, stacked on `feat/viz-wish-stage` (not merged:
Wish odds' §11 arrangement and its copy are still waiting on Nate). For Nate to look at in the
local build. ⏭ The copy in §6 is written in for the demo and is proposed, not approved; the
visual calls in §5 are Nate's; real Safari and iPhone.

## 1. Why, and Nate's three asks

The second instrument on the stage (design `docs/design/visualizers-design.md` §6–§8). Nate chose
to shape Artifact odds before finishing Wish odds, since it may inform Wish's last tweaks. From
watching the streamer use it:

1. **Your piece's card is the most important thing on that view**: front and center, and it keeps
   its shape, because it mirrors the game's reshape screen (a control bar only if the card's UI
   survives behind it, and only if that really helps).
2. **The stat fields** opened a scrolling reel of allowed values. The streamer's mouse wheel moved
   in steps, which made the reel jump several values a notch, so he couldn't reach some values. Can
   the fields take typing too, and how is an invalid typed stat refused?
3. **The ambiguous-count mark** (Nate's notification mark on a pip that could be two upgrade
   counts): the streamer clicked it, didn't see the number flip, and took it for an "invalid value"
   flag.

## 2. What changed

### The stage (`app.css` § THE STAGE)

The stage's CSS moved out of `WishInstrument.svelte` into `app.css`, now that a second instrument
wears it: `.stage-root`, `.stage`, `.stage-head`, `.stage-toolbar`, `.stage-tabs`, `.setup-bar`
(`.setup-bar-name`, `.setup-key`, `.setup-val`, `.setup-pop`), `.stage-graph` and `.stage-word`,
`.stage-handle` and `.stage-fine`. The knobs are renamed with it: `--stage-aspect` (1.9),
`--stage-head-scale` (1.5), `--stage-head-gap` (0.5rem), `--stage-toolbar-gap` (0.25rem), declared
once in that section's `:root`. Wish odds renders as before (screenshot at 1600).

### Artifact odds on the stage (`ArtifactInstrument.svelte`)

- **The headline** per view, chosen as the most important answer (⚓ design §6), each in
  `formatChance`'s precision (the to-do's "Artifact Odds moves to Wish Odds' precise chances"):
  - Drop: the chance of the piece within the days you'll farm ("46.0% chance of the piece within 7
    days"). The old head said it as "N in 100 players".
  - Level up: the chance it ends above the value to beat ("48.9% chance it ends above 29.6 CV").
  - Your piece below +20: the same, at +20. At +20: "Better than 87% of +20 flowers with these four
    substats", as before. With no piece: a dash and what to do.
- **The toolbar**: the view tabs, then one setup bar. Drop: Piece, Your stats (with how many of
  them it needs: "2 of CR, CD, ER"), Set. Level up: Piece, Your stats, Has, Dropped with, Made.
  Your piece: Your stats, Made, and at +20 Reshape. Each popover holds the old panel's chips and
  the note that explains them.
- **The charts** (design §8): Drop keeps its two farming curves. Level up and Your piece are now
  **survival curves**, the chance to end above each value (`survival()` in `artifactOdds.ts`, read
  the same way as `compareTo`'s `above`, so the curve and the headline agree), with the histogram
  as the **companion strip**, still shaded by upgrades into your stats, each shade's count printed
  over its hump in place of the legend. At +20 the bold curve is every +20 piece with these
  substats (the headline's), and the gold one the chosen reshape; in Level up with Elixir, the thin
  curve is the same piece farmed.
- **The answer as geometry**: Drop's Domain curve has Half by and Unlucky tenth (the old table's
  columns); a value curve has Typical (50% end above) and Unlucky tenth (90% do). Each is a dot, a
  dotted drop line, and the figure at the line's foot, just above the axis (§3). The marker's dots
  carry the second curve's chance ("In an Outbreak 50.8%", "Farmed …", "Standard reshape 13.3%").
  An unfinished piece's current value is a dashed "now" line.
- **The handle** is the x axis's: Days of resin in Drop; To beat in Level up and on an unfinished
  piece; at +20 a disabled handle showing your piece's value, so the chart and the handle keep
  their places. Days typed past the axis (to 1,000) are kept: the head answers, the marker waits at
  the end.
- **No Readout card.** The odds bar, Likely and Typical lines, Now, the hover readout and the legend
  went: the curve read at the marker is the odds bar, the crossings are Typical and the spread, and
  the strip's numerals are the legend. The farming note and the 1-in-N line are the fine print.

### Ask 1: the card

The card keeps its shape and its contents (slots and Clear, the main stat, four lines with their
badges, values and radials, the level chips, the note), as a glass panel. It is the view's input,
so it comes first: **left of the chart from a 52rem tile** (🎛️ `--ao-card-w`, 22rem, the old rail's
width), **between the toolbar and the chart below that** (two up, a phone). The level chips are six
even columns, so +20 no longer wraps to a line of its own. Farmed / Made with Elixir moved to the
toolbar's Made segment, Reshape to its own segment: settings, where the card is the piece.

### Ask 2: the stat fields (`StatField.svelte`, `statEntry.ts`)

Every field on the card (the main stat, each substat's name and its value) is now **one field you
can type into, over a list**: a combobox.

- **Why the reel failed:** it was a five-row reel with `scroll-snap-type: y mandatory`. A stepped
  wheel sends about 100px a notch, three and a half rows, and the mandatory snap then settled on a
  row further on, so the reel skipped values; its faded outer rows made it worse.
- **The list** is a plain scroller (no snapping), eight rows of 28px, the current value in the
  middle when it opens, every row clickable, the row under the mouse lit. Measured: one 100px notch
  moves it 100px, and the row under the pointer can be clicked.
- **Typing is a search, never the value.** A value field lists every value the text starts ("6" →
  6.2, 6.6) and treats the same number as exact ("21" is 21.0, a comma is a point). A name field
  matches the name, any word of it, or a short form ("cd", "crit dmg", "dmg", "er", "em", "atk%").
- **Refusing an invalid value:** the field only ever sets an option from the list. Enter sets the
  highlighted row; Tab or leaving sets what the text names exactly; anything else puts the old value
  back. A value the game can't show highlights nothing, so Enter nudges (the shared `nudge`) and the
  list says "Not a value the game shows. Nearest:" with the value on each side. **Nothing is ever
  swapped for a near value without a click**, so a typo can't quietly become a different piece.
  Tested in `statEntry.test.ts`.
- **Keyboard flow:** a piece goes in without the mouse: name, Tab, value, Tab, radial, Tab, the next
  name. ⚠ The value field is rendered for a blank line too, and a pick is flushed (`flushSync`)
  before Tab moves focus on, or the Tab skipped the new value field and the typing went to the next
  line. ⚠ A press on an unfocused field focuses it with the whole value selected and the press's own
  caret placement prevented: Chrome's mouseup undid a `select()` after focus, so typing appended
  ("6.610.9").
- **Touch:** a value field raises the decimal keypad; a name field raises no keyboard
  (`inputmode="none"` on a coarse pointer), because ten rows are quicker tapped.

### Ask 3: the ambiguous count

What it means: the values add up to two (or more) different numbers of upgrades, and the model has
to take one of them; the game shows which on its reshape screen. What was wrong: the meaning hid
behind a tap-to-cycle on a red mark, and red says "error".

- **The question, in words, under the level chips**: "These values fit two different upgrade
  counts. Pick the one the game shows when you reshape the piece:" with **each reading as a chip
  that says what it sets** ("CR 2", "CR 3"; with two lines in play, "CD 2 · ATK% 1"). Below +20 the
  game doesn't show counts, so it asks for the one it got, if you know it.
- **The lines in question** wear an open pip (a ring, not the filled gold) with Nate's mark on its
  corner, and the same mark leads the question, so the two read as one thing. The pip is no longer a
  button: the chips are the one way to choose.
- **The mark is `--ui-provisional`, not `--ui-danger`.** That role's meaning is "we took it, and
  this is a stand-in", which is exactly this. Its "!" is the dark ground. The question's box wears
  the provisional's soft tint while it is open.
- **Once you pick**, the mark goes and the pips fill; the chips stay, your pick lit, to change it.
  The pick is remembered (`picked` in the share state, an added field) and starts over when a line
  or the level changes. Checked: a reload keeps the view, the piece and the pick.

## 3. Considered and not taken

- **The card behind a control bar or a popover.** It is what you work in on this view, every
  visit, and it already fits beside the chart.
- **The card right of the chart.** The tabs stay put either way, since the toolbar spans the stage
  above both; left is read first. **The card above the headline**, or spanning the stage's height
  with the headline beside it: the view tabs would move when you switch views.
- **Keeping the reel and fixing the snap** (`proximity`, or a wheel handler that steps one row a
  notch). That fixes the skipping, but a 50-to-60-value reel is still slow to scroll, a one-row step
  fights a trackpad's fine scrolling, and typing is quicker than either.
- **A native `<datalist>`.** It can't refuse a value, and its list looks and behaves differently in
  every browser (Safari's is a narrow strip).
- **Enter takes the nearest value.** Rejected: it would change what you typed without saying so.
- **The crossings' labels beside their dots** (Wish odds' placement): Drop's Unlucky tenth is always
  near the axis's right end (the axis runs to it), where above-left of its dot is the Outbreak's
  curve. At the drop line's foot, the space under any curve is empty. ⏭ A candidate for Wish odds
  too (§5).
- **The days slider's square-root track** (its first half was the first quarter of the axis). A
  handle on the axis has to be linear, or the thumb leaves the marker line. The early days are a
  drag on the chart or a typed number away.

## 4. Gates

Vitest 2746 (new: `statEntry.test.ts`, 11; `survival` in `artifactOdds.test.ts`, 2), svelte-check,
lint and build clean; Chrome e2e 72 passed. Driven on the production build: typing a value the game
can't show (refused, the old value back on Tab), short forms ("7" → 7.0, "cd" → CRIT DMG), a whole
piece by keyboard, a 100px wheel notch on the list, picking a reading, a reload, Clear, and days
typed past the axis; no page errors. Looked at headless at 2000, 1600, 1440 two up and 390.

## 5. For Nate's eye

1. The card beside the chart, 🎛️ `--ao-card-w` 22rem, from a 52rem tile; above the chart below it.
2. The fields: the typed field's look (the old select's), the list (eight 28px rows, the value list
   at least 144px wide), the nudge on a refused Enter.
3. The question box: its provisional tint, the chips, the open pip with the mark.
4. ⚓ Your mark's disc changed colour, from `--ui-danger` (your call) to `--ui-provisional`.
5. The survival curves' steps: the values are discrete, so the curve is an honest staircase.
6. The reshape curve in gold beside the population's white; Level up's farmed curve thin.
7. The strip's numerals over each hump in place of the legend.
8. The crossings' figures at the drop line's foot, and whether Wish odds should do the same.
9. The level chips as six even columns.
10. Drop's curve names, now above (Outbreak) and below (Domain) their curves at 🎛️
    `FARM_LABEL_AT` (0.55) of the axis.

## 6. Copy for Nate (written in for the demo, not final)

Headlines:

1. Drop. Was: "46 in 100 / players would have this piece after 7 days of farming the domain".
   → "46.0% / chance of the piece within 7 days"
2. Level up. Was: "49% / chance it would end above 29.6 CV". → "48.9% / chance it ends above
   29.6 CV"
3. Your piece below +20: as 2, with " at +20" at the end.
4. No piece. Was the Readout's "Enter your piece to see how it measures up." → "— / Enter your
   piece to see how it measures up". Level up with no substat: "— / Pick a substat".

The setup bar:

5. Segment names and values: "Piece Flower · HP" (Drop lists every main you'd take), "Your stats
   CR and CD" (Drop: "2 of CR, CD, ER" when it needs fewer than all), "Set One / Either", "Has
   Both / All 3 / 1", "Dropped with 4 substats / 3 substats", "Made Farmed / With Elixir",
   "Reshape Standard".
6. Made's note in Level up. Was (shown only with Elixir on): "A piece made with Sanctifying Elixir
   guarantees at least 2 of those upgrades go to the two substats you chose for it." → "A piece
   made with Sanctifying Elixir guarantees at least 2 of its upgrades go to the two substats you
   chose for it."
7. Reshape's popover. Was two lines in the Readout: "Reshaping keeps each substat's starting roll
   and rerolls all its upgrades. You can keep whichever result you prefer." → "Your two selected
   substats are guaranteed at least this many of the piece's upgrades between them. Reshaping keeps
   each substat's starting roll and rerolls all its upgrades, and you can keep whichever result you
   prefer." (the first sentence as before; the Dust paragraph unchanged).

The chart:

8. The y axis's name in Level up and Your piece: "chance it ends above".
9. Crossings: "Half by 7.9" and "Unlucky tenth 26" (Drop, days); "Typical 29.6" and "Unlucky
   tenth 19.4" (the value views). Tooltips: "Half of players have it within this many days.",
   "The unluckiest 10% of players need this many days or more.", "Half end above this, and half
   at or below it.", "The unluckiest 10% end at or below this."
10. Dot labels: "In an Outbreak 50.8%", "Farmed 31.0%", "Standard reshape 13.3%".
11. The strip: "chance of each value, by upgrades into your stats:" with 1, 2, 3… over the humps
    (was the legend "upgrades into your stats 0 1 2 …"), or "chance of each value" with one shade.
12. "now 12.3" on an unfinished piece (was the Readout's "Now: 12.3 CV").
13. Handle labels: "Days of resin", "To beat", "Your piece".
14. Drop's fine print, from its two notes. Was: "Drag the chart or use the slider to pick how many
    days of resin you'll spend (180 a day). During a Stygian Onslaught Disturbance Outbreak, every
    120 resin you spend also earns one extra 5★ from the domain." and "About 1 in every 109
    five-star drops from this domain is the piece you want." → "About 1 in every 109 five-star drops
    from this domain is the piece you want. 7 days is 1,260 resin, at 180 a day. During a Stygian
    Onslaught Disturbance Outbreak, every 120 resin you spend also earns one extra 5★ from the
    domain."

The card:

15. The question. Was the pip's tooltip: "These values fit two possible upgrade counts. Tap to
    match the number the game shows." → at +20: "These values fit two different upgrade counts.
    Pick the one the game shows when you reshape the piece:"; below +20: "… Pick the one it got, if
    you know it:"; the chips "CR 2" / "CR 3".
16. The open pip's tooltip: "These values fit more than one upgrade count. Pick the one that
    matches the game under the card."
17. The fields: the clearing row "None" ("Not yet" for a fourth line at +0–3); the list's notes
    "Not a value the game shows. Nearest:", "Not a value", "No substat by that name", "Pick the
    substat first"; a blank value field shows "—".

Help (`src/lib/help/chapters/Visualizers.svelte` § Artifact odds), now stale:

18. Level up. Now: "shows where a fresh piece would land at +20 as a histogram stacked by how many
    upgrades went into your stats. Drag the marker to set the value to beat." → "shows the chance a
    fresh piece ends above each value at +20, with the spread of values under it, shaded by how
    many upgrades went into your stats. Drag the chart, or type a value under it, to set the value
    to beat."
19. Your piece. Now: "Each value wheel offers only values the game can produce, and a badge shows
    how many upgrades a substat has taken. A red pip means the current values fit two possible
    counts and lets you pick which it is." → "Type each substat and its value, or pick them from
    the list: a field takes only values the game can produce. A badge shows how many upgrades a
    substat has taken, and when the values fit more than one count, the card asks which one the
    game shows."

Removed: the odds bar's keys (Below / Equal / Above, Worse / The same / Better), "Likely: …",
"Typical: …", "Now: …", the hover line ("…: x% chance of exactly this · y% chance of this or
more"), the legend, and "Drag the chart or use the slider…".
