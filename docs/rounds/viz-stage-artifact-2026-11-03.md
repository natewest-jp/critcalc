# The stage, round 2: Artifact odds (2026-11-03)

**Status:** ✅ finished for now (Nate, 2026-11-03), eight passes (§2–§6, §7–§13) built on `feat/viz-artifact-stage`, stacked on `feat/viz-wish-stage` (not merged:
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

## 7. Second pass: two jobs, two steps, 100 dots

Nate on the first pass: the curves are "more useful than the histograms", and the steps in them
are real (CV lands on a grid of about 0.78, one roll's smallest tier, and the game's rounding to
0.1 splits each grid point into a little step). Then: the card does too many jobs at once (entering
a piece, and choosing what to reshape), and the card beside the chart is two boxes again. His idea,
refined together: split entry from reshaping, put the card behind a segment, and give reshaping
its own step with all three kinds on the chart. Built as agreed:

- **Reshape is a fourth view tab** (Drop, Level up, Your piece, Reshape: the piece's life). Its
  head is the chance the chosen kind beats your piece ("13.3% chance a Standard reshape beats your
  piece"); its chart draws **all three kinds**, the chosen one bold, the others thin and named at
  the marker ("Advanced 32.5%", "Decreed 99.78%"); its Reshape segment ("CR and CD · Standard")
  opens **the game's reshape screen**: each line with its badge, value and radial, two at most,
  then the kind. Your piece at +20 has a "Reshape this piece" button under its handle.
- **Your piece is entry and rating only.** The card loses its radials. A defined (Elixir) piece's
  two substats are picked in the Made popover, as the game's Define Minor Affixes picks them. The
  two selections are separate state now (`defSel` and `selected` in the share state; an older
  state's single selection becomes both, as it meant both).
- **The card is behind the piece's segment**, the setup bar's first, which shows the piece at a
  glance in Nate's format: level, the main stat at its shortest (none on a flower or plume) and the
  slot as one name, then each substat ("+20 Pyro Goblet · CR 6.6 · CD 21.0 · ATK% 9.9 · ER 5.2"),
  your stats in gold, a grayed 4th line dim. With no piece, the chart's empty state has an "Enter
  your piece" button that opens it (`BandMenu` gained `show()`). The stage is one box again.
- **A goblet's element.** The main stat field lists each element ("Pyro DMG Bonus", typed "pyro"),
  so the summary can say "Pyro Goblet". The odds don't change with the element (each is 5%), so
  it is only the piece's name (`el` in the share state).
- **The unactivated 4th line** (Nate: since about a year ago the game shows every piece's four
  substats, a 3-line piece's 4th grayed out as "(unactivated)"). The card always takes four lines;
  at +0–3 a check marks the 4th as grayed out. The engine reads that as a 3-line piece whose 4th
  line is known: one value roll fewer to come, and the line adds nothing now
  (`PieceQuery.unactivated`, `resolvePiece(…, unactivated)`). Tests, written failing first in
  `appraise.test.ts`: such a piece's future equals a 3-line piece's at +4, and it resolves as a
  3-line start. The engine's mix over an unknown 4th line stays for a 3-line piece without one,
  which the card no longer offers.
- **Straight drops**: a survival curve is drawn from its own points, flat between values and
  straight down at each (it was sampled every 2px, so each drop leaned).
- **The 100-dot strip** replaces the histogram: the bold curve's outcomes as 100 dots, one per
  hundredth, stacked where they land; the dots past the marker are lit and counted in the strip's
  label ("100 pieces, one dot each: 49 end above 29.6"). A stack taller than the strip spills into
  columns beside its value, rather than every dot shrinking (a Standard reshape piles twenty dots
  on a few values, and at the first try they shrank to 3px specks). The shading by upgrades into
  your stats went with the histogram.
- **Escape in a field inside a popover** closes the field's list, not the popover (`BandMenu`
  leaves an Escape a field already used).

Considered and not taken: the card's controls over an empty corner of the plot (design §6's "no
panel inside the plot": a Decreed reshape's curve stays high far to the right, through the top
right corner); a one-off "Explore reshaping" button instead of a tab (a tab is how an instrument
changes what its chart answers, and it can be returned to).

Next, agreed: "Try a reshape", rolling one result and showing it original and result side by side,
as the game's Select a Result to Keep does.

Gates: Vitest 2748 (new: the unactivated line, 2), svelte-check, lint and build clean; Chrome e2e
72 passed. Driven on the production build: all four views, the card from the segment and from the
empty state, a whole +0 Pyro goblet with a grayed 4th line by keyboard, a list row clicked inside
the popover, Escape twice (list, then card), Clear; no page errors. Looked at headless at 1600,
1440 two up and 390.

### For Nate's eye (second pass)

1. The piece's summary segment, its gold for your stats and the dim grayed line.
2. ⏭ The summary's level is the card's range ("+16–19 Flower"), since the card asks for a range,
   not a level (the odds only need the upgrades); your example read "+16 Flower".
3. ⏭ The slot is "Plume" there, as everywhere on the site (your example said "Feather").
4. The Reshape view: three curves, the chosen one bold, the others named at the marker; the
   game-like popover.
5. The 100 dots: size (4–9px), the dim and lit dots, the spill into columns.
6. "Reshape this piece" under Your piece's handle at +20.
7. The grayed-out check under the level chips, shown only at +0–3.

### Copy for Nate (second pass; written in, proposed)

1. Reshape's head: "13.3% / chance a Standard reshape beats your piece"; with no piece at +20:
   "— / Reshaping needs a +20 piece"; with fewer than two picked: "— / Pick two substats to
   reshape".
2. The Reshape segment: "Reshape CR and CD · Standard" ("Pick 2" before two are picked).
3. The Reshape popover: "Pick 2 substats. After the reshape, they get at least 2 of the piece's
   upgrades between them." and "Every 6 Dust of Enlightenment you spend makes your next reshape
   Advanced, and the third Advanced in a row is Decreed. The chart shows all three."
4. Reshape's fine print: "Reshaping keeps each substat's starting roll and rerolls all its
   upgrades. You keep whichever result you prefer, so the piece can't come out worse: a reshape
   costs 1 Dust of Enlightenment for a flower or plume, and 2 for other pieces."
5. Reshape's y axis: "chance a reshape ends above". Its empty states: "This piece is +16–19.
   Level it to +20 to reshape it." [Edit your piece] and "Pick the two substats to reshape, as the
   game's reshape screen asks." [Pick two substats].
6. Dot labels: "Advanced 32.5%", "Decreed 99.78%".
7. The strip: "100 pieces, one dot each: 49 end above 29.6"; at +20 "100 +20 flowers like yours,
   one dot each: 12 beat it"; in Reshape "100 Standard reshapes, one dot each: 13 beat your piece".
8. The button: "Reshape this piece".
9. The Made popover on Your piece: "Defined substats", then "Pick the two substats you chose when
   making it. Together they're guaranteed at least 2 upgrades by +20." (the second sentence as
   before). In Level up: "A piece made with Sanctifying Elixir guarantees at least 2 of its
   upgrades go to the two substats you chose for it."
10. The card: the check "The 4th substat is grayed out (unactivated)"; the note loses "Use the
    circles on the right to choose two substats to reshape."; the clearing row is "None" for every
    line (no "Not yet").
11. The empty states: "Enter a piece to see how it measures up." [Enter your piece]; "Enter all four
    of its substats, a grayed-out one too." [Finish your piece]; [Edit your piece] after the
    impossible-value and misfit messages.
12. The summary with no piece: "Enter your piece".
13. Help, replacing §6 item 19 (Your piece). Now: "Each value wheel offers only values the game
    can produce, and a badge shows how many upgrades a substat has taken. A red pip means the
    current values fit two possible counts and lets you pick which it is. A finished piece is
    ranked against every +20 piece with the same four substats. Select two substats to see what a
    reshape would do. A reshape keeps …" → "Open the piece in the toolbar and type each substat and
    its value, or pick them from the list: a field takes only values the game can produce. A badge
    shows how many upgrades a substat has taken, and when the values fit more than one count, the
    card asks which one the game shows. A finished piece is ranked against every +20 piece with the
    same four substats." plus a new paragraph: "**Reshape** picks two substats as the game's reshape
    screen does and draws all three kinds of reshape against your piece. A reshape keeps …" (the
    rest of the current paragraph unchanged).

## 8. Third pass: you are this dot, and Try a reshape

Nate asked whether the strip could hold a dot for every possible artifact. Counted for the demo
flower: about 60,000 distinct finished pieces (140,000 from a 4-line start), from 17 million
ordered roll sequences, collapsing to 109 crit values. Computable, but they are not equally
likely (the rarest value is about 1 in a million, the commonest 1 in 18), so a dot each would give
a once-in-a-million roll the same dot as an everyday one, and "13 dots beat yours" would stop
meaning 13%. Agreed instead: keep the 100 equal-chance dots, ring yours, and light where a tried
reshape lands. Built:

- **You are this dot.** At +20 and in Reshape the strip rings the dot your piece's rank falls in
  ("yours"): among 100 pieces like it, or among 100 reshapes.
- **Try a reshape**, a chart tool at the toolbar's far end (design §6), in Reshape. It rolls one
  reshape (`rollReshape` in `appraise.ts`) and plays it as the game does, from Nate's recording:
  the piece on its starting rolls, every badge a dot; an upgrade every 520ms, the value and badge
  changing as a light sweeps the row (white settling to gold on a selected line, with a ring
  bursting from its badge; flat gray on another); a pause; then the game's "Select a result to
  keep", the original and the result side by side, with a line on what it means ("Your piece is
  still better: 24.0 CV against your 34.2. Luckier than 3% of Standard reshapes."). Skip jumps to
  the choice; under reduced motion it starts there. Try again rolls the next in the same dialog.
- **The trail.** Each try lights its dot (the latest ringed in gold, "this roll"; earlier ones
  fainter) and the strip counts them ("· your tries: 3, 1 beat it"). The trail is the session's,
  for this piece, pick and kind.
- **Keep the reshaped result** makes it your piece (its reading known, so no question), with an
  Undo toast that checks the profile is still the one it was pressed in.
- **The roll is the chart's.** Tests (`appraise.test.ts`): 20,000 seeded rolls for each floor land
  only on values `pieceReshape` gives, with its mean and its chance to beat the piece; a Decreed
  roll puts all four upgrades on the two lines; a start is a one-roll value the line can begin
  with; a line's last step shows what it ends on.

Gates: Vitest 2752 (new: 4), svelte-check, lint and build clean; Chrome e2e 72 passed. Driven on
the production build: a roll frame by frame at 90ms (the sweeps, the ring, the gray rows, the
choice), Try again and Skip, the trail after three tries, keeping a result and its Undo, the
yours ring at +20; no page errors.

### For Nate's eye (third pass)

1. The sweep against your recording: 🎛️ `STEP_MS` 520, `INTRO_MS` 600, `OUTRO_MS` 800; the white
   over 380ms and the tone over 900ms (`--rr-white-ms`, `--rr-tone-ms`); the ring's 520ms.
2. The piece over the card while it rolls: the generic slot icon with a gold glow (we have no
   set art).
3. The choice screen: the two cards, the lit choice, the verdict line, Try again and Confirm.
4. The rings and their labels on the strip ("yours", "this roll"); where a full stack is tall, the
   label runs close to the strip's own label.
5. Try a reshape as a plate at the toolbar's far end.

### Copy for Nate (third pass; written in, proposed)

1. The tool: "Try a reshape". The dialog's titles: "Standard reshape" while it rolls, "Select a
   result to keep" after (the game's words, sentence case); "Skip", "Try again", "Confirm",
   "Keep the original", "Keep the reshaped result".
2. The verdict: "This one beats your piece: 36.4 CV against your 34.2." / "Your piece is still
   better: …" / "The same as your piece: …", then "Luckier than 73% of Standard reshapes."
3. The strip: "yours", "this roll", and "· your tries: 3, 1 beat it" after its label.
4. The toast: "Your piece is now the reshaped result" [Undo].

## 9. Fourth pass: the roll's pace, one layout, no dim

Nate on §8: "you nailed the look and animations". Four asks, built:

- **More pause** before the first upgrade and after the last: 🎛️ `INTRO_MS` 600 → 1100 (to find
  where to look) and `OUTRO_MS` 800 → 1500 (to take in what happened).
- **The cards line up** (⚓ Nate: the move to the choice is horizontal only). The rolling card is
  the result card, in the choice's own grid: centred by `left` while it rolls, sliding into its
  place at the choice (`--t-move`) as the original fades in beside it. The original, the totals,
  the radios and the verdict are laid out during the roll and hidden, so nothing changes height.
  Measured at 1600: the card moves 176px across and 0 down. On a phone the original appears under
  the result, and the card doesn't move at all. `left`, not a transform: a box snaps to whole
  pixels, where a transform-placed card's fading sweeps could shimmer in WebKit.
- **No piece icon** over the rolling card: the generic slot icon doesn't hold up at that size
  (⏭ Nate may trace the slot icons as SVGs later).
- **The readout**: each card's value under it ("34.2 CV", "28.0 CV"), and one line under both:
  "Your piece is still better." (or "This one beats your piece.", "The same as your piece.") with
  the luck sentence (proposed below).
- **No dim** (⚓ Nate, unusual for the site's dialogs): the backdrop is transparent but still holds
  the page, the panel stands off on a deep shadow, seated at 🎛️ `--rr-top` (12vh) so the dot
  strip shows under it. A roll's dot now lights **as its result shows** (behind the dialog), not
  on Confirm.

Gates: Vitest 2752, svelte-check, lint and build clean; Chrome e2e 72 passed.

### The luck sentence (proposed; Nate asked for options)

Now: "Luckier than 3% of Standard reshapes." Options, with my pick first:

1. "Better than 3 of 100 Standard reshapes." ✅ written in. It counts the same 100 dots the strip
   draws (the roll's dot is lit there), and has the shape of Your piece's headline ("Better than
   87% of +20 flowers…").
2. "97 of 100 Standard reshapes do better." The other side of the same count: plainer about a bad
   roll, harsher about it too.
3. "A typical Standard reshape gives 28.0 CV." The middle, not a rank: easy to read, but it says
   nothing about how rare this roll was.
4. A word, then the count: "An unlucky roll: better than 3 of 100 Standard reshapes." (bands:
   very unlucky, unlucky, typical, lucky, very lucky). The quickest read, but the bands' edges
   are ours to choose, and it reads closer to a verdict.

## 10. Fifth pass: a reveal you can see, and each rank under its card

- **The slide and fade never ran.** `.rr-choice`'s own `transition` (its background) came later
  in the sheet at the same specificity and replaced the slide's and the fade's, so the move to the
  choice snapped. Each transition is now set by a selector that outranks it, on the state being
  entered, and Try again snaps back. Slower than the site's bands on purpose (Nate: at 240ms and
  150ms it couldn't be seen; this is a reveal to watch): 🎛️ `--rr-slide-ms` 600 (eased out), the
  original over `--rr-reveal-ms` 450 from `--rr-reveal-delay` 200, the totals, ranks, radios and
  verdict a beat later. Sampled per frame: the card glides 176px over about 600ms; the original
  fades in from 200 to 650ms, the rest from about 425 to 875ms. Reduced motion: no transitions.
- **The luck line** (Nate: after "Your piece is still better.", a rank line read as your piece's).
  Each card now says its own place among this kind's reshapes, under its value: "34.2 CV / Better
  than 83 of 100 Standard reshapes" under yours, "24.9 CV / Better than 11 of 100 Standard
  reshapes" under the result. One line under both says which is better: "Your piece is still
  better." / "The reshaped result is better." / "They come out the same." (proposed; "This one
  beats your piece" had the same which-piece problem).

Gates: Vitest 2752, svelte-check, lint and build clean; Chrome e2e 72 passed.

## 11. Sixth pass: percentages, a centred verdict, and the choice on a phone

- **The rank lines in percent** (⚓ Nate's wording): "Better than 83% of Standard reshapes", no
  period.
- **The verdict centred.** It is a `.note`, whose 56ch measure left it a narrow box at the
  panel's left with its text centred inside; it is centred as a box now (measured: 0px off the
  panel's middle).
- **The choice on a phone** (Nate: it barely fit an iPhone 16 and scrolled on anything smaller).
  The two cards stay side by side below 40rem, compact (short names, tighter rows), rather than
  stacked: the panel is about 423px tall at every phone size and scrolls at none (checked at 393,
  375 and 320 wide), and the move to the choice stays horizontal there too. The narrowest panel
  (304px on a 320 phone) takes its rows one size down by a container query on the panel (the
  breakpoint table has no rung that small, and `breakpoints.test.ts` keeps `@media` to the
  table); 40 rolls at 320 left at least 5.9px between every name and its value.
- ⏭ The other instruments' phone usability waits for its own session (agreed with Nate).

Gates: Vitest 2752, svelte-check, lint and build clean; Chrome e2e 72 passed.

## 12. Seventh pass: closing it out

Nate: the copy in §6–§11 is approved as written in, except Reshape's fine print ("Reshaping keeps
each substat's starting roll…"), which goes: players know how reshaping works. Real Safari checked
by Nate: good.

- **Help** (`src/lib/help/chapters/Visualizers.svelte` § Artifact odds) rewritten for the tool as
  it is: four views, Valued stats, the curve and its 100 dots, the card behind the toolbar and its
  typed fields, the question for a value that fits two counts, and Reshape with Try a reshape. The
  top-up paragraph is unchanged.
- **Your stats is Valued stats** (⚓ Nate), with the strings that name the set: "Your valued stats
  are highlighted", "None of your valued stats are on this piece", "Your only valued stat is this
  piece's main stat", "useful rolls in your valued stats at +20", and the useful-rolls note.
- **The notification mark back to `--ui-danger` with a white "!"** (⚓ Nate: it emulates Genshin's
  own notification mark; §2's change to `--ui-provisional` reverted). The open question's box
  goes neutral (a shade denser than answered) rather than a red tint.
- **The setup bar's keys fainter**, Wish odds too: 🎛️ `--setup-key-mix` 78% of the muted ink over
  the ground (`app.css` § THE STAGE; was `--chart-ink`, 100%; `--chart-dim` is 62%).

Gates: Vitest 2752, svelte-check, lint and build clean; e2e on both engines 144 passed.

## 13. Eighth pass: Valued stats on a piece, and the reshape's default

Nate asked whether Reshape should lose Valued stats (curves from the picks alone) or take a copy
of it in its popover. Kept as one control shared by all four views: Valued stats says what
"better" means (CV or useful rolls, and which stats count), the picks say which two lines you
gamble on, and they differ often enough (valuing CR, CD and ATK% while reshaping CR and CD; a
support valuing ER). Curves from the picks alone would change the measure between Your piece and
Reshape; a second copy could drift from the first. Two changes instead (⚓ Nate):

- **On Your piece and Reshape, Valued stats offers only the piece's four lines** ("Pick the
  substats you want, from this piece's four."). A valued stat the piece hasn't makes way for a new
  one rather than blocking the fourth.
- **The reshape's two default to your valued stats**: the first two on the piece, in the order you
  valued them (⚓ Nate asked how; agreed). Not the pair with the best odds, which would make the call
  for the player. A pick of your own ends the default; Clear restores it. The popover says so while
  it holds: "Your first two valued stats on this piece, until you pick your own." (proposed).
  `rsAuto` in the share state; an older state's selection is treated as its own.

Gates: Vitest 2752, svelte-check, lint and build clean; Chrome e2e 72 passed. Driven: the default
follows Valued stats (CR and CD, still after ATK% joins), the popover offers the piece's four,
an own pick ends the default and survives a reload.
