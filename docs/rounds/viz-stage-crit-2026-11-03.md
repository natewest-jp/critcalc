# The stage, round 6: Crit heatmap (2026-11-03)

**Status:** built on `feat/viz-crit-stage`; Nate's first look (§3a) reworked the layout, and the
rework waits for his eye, along with the copy (§5) and Help (§6). Not merged.

## 1. The round's three openings

⚓ Nate, at the start of the round:

1. **The headline is the average damage per hit**, "×1.98 average damage per hit". Offered with
   the gain from rebalancing to the best split of your crit value (CV), and with the two on one
   line. The average is what the field's colour encodes. Since it leads, the defaults stay at
   70% / 140%, where a rebalancing gain would have read +0.0%.
2. **The ramp is compared on `/lab` first** (§3), then the pick goes in this round.
3. **The companion strip sits right of the field, on the CRIT Rate axis.** Design §7 gives the
   heatmap the crit-count histogram on a shared axis. A crit count doesn't sit on CRIT DMG, but
   it does sit on CRIT Rate (3 of 8 hits is 37.5%). So the axis reaches down to 0%, where a
   rotation without a crit sits, with 0–5% veiled because no build can be there. Offered against
   a strip under the chart on its own axis, which breaks the shared-axis rule.

## 2. What changed

The bespoke stage of 2026-10-02 (the heatmap over a control strip, the paper "Current build"
card beside it at the wide tier) is one stage box, as the five before it are.

- **The toolbar:** the setup bar has Hits per rotation (its slider with the risk-ramp track in
  the popover, and the no-crit chance in its risk colour) and Shading ("No-crit risk" or "None",
  in place of the checkbox). Pin this build and Roll hold the far end, as Artifact odds' Try a
  reshape does.
- **The field fills the stage** at any aspect: the two axes are normalised separately, so no
  aspect distorts it. At 1600×1000 one up it is about 2.3:1.
- **Its marks, drawn always** (design §7): the 1:2 ray, and the CV line through your build with
  its best split. The Equal-budget line toggle goes. The CV line stops at the base 5%. The ring
  stays when you sit on the best split; only its words go.
- **The contours' values** sit inside the field's right edge, over where each one leaves. The
  right-edge "Average DMG" title and the ×4 corner went with the axis titles. The headline names
  the quantity, and the handles name the axes.
- **A handle on each axis:** CRIT DMG under the x axis, as on every stage; CRIT Rate standing
  upright down the chart's left edge from 100% to 5%, its name and field over its top.
  `InstrumentSlider` takes `vertical`: a range input in a vertical writing mode, so arrow keys,
  dragging and the screen reader's orientation follow it natively. The coarse-pointer hit box
  turns with it (`app.css`, `.slider--vertical`). The marker still drags anywhere on the field.
- **The strip:** a row per crit count at its share of the hits, as long as its chance against the
  tallest row. Your crosshair runs on through it at your CRIT Rate, which is exactly the rows'
  average (n × CRIT Rate crits). Hover or tap a row to read it; Roll lights the row it landed on.
  🎛️ `STRIP_SHARE` 0.1 of the chart (56–120px), `STRIP_GAP` 14, rows `ROW_SHARE` 0.72 of their
  spacing (1.5–10px).
- **The card's contents moved to the chart:** the CV on its line, the CD:CR ratio beside the
  marker, the pin's change on its connector ("+3.3% vs pinned", shown when the two dots are
  40px apart), the one-rotation chart as the strip. The rest went to the fine print: the strip
  read (hover, tap or roll) over a ghost of its longest form, the average crits and no-crit risk
  at rest, the roll's dots after its sentence, and a standing line that says what the CV
  counts (§5).
- **The veil:** 0–5% under the night at 🎛️ `VEIL` 0.62, named in its band ("below the base 5%
  CRIT Rate").
- 🎛️ The geometry: `PADL` (the CRIT Rate track 15, a gap of 8, the y numbers 26, a gap of 6),
  `TOP` 34 (the CRIT Rate handle's name and the strip's), `BOTTOM` 22, `PLOT_MIN` 240; below
  1024px the plot is 0.8 × the chart's width, up to `PLOT_NATURAL_MAX` 560.
- `crit.ts`: the fixed 720px box goes, along with its measured axis-title ink (`AXIS_INK`, `PAD`,
  `SIZE`, the aspect clamp) and the titles themselves. The field maps through a `FieldRect`,
  with `CR_AXIS_MIN` 0. New and tested: `countAtRate` (a CRIT Rate's nearest row) and
  `formatRatio`.
- The share state stays v1. `cvLine` is no longer written, and an older one is ignored.

Driven on the dev server at 1600, 1000, 700 and 390, and two up at 1600: a field drag, the
upright handle by keyboard (↑ steps up) and by click, a strip hover, Roll, Pin with a typed
build, and the Hits popover. No page errors.

## 3. The ramp (⚓ Nate: the rainbow stays)

The design record flagged the rainbow's yellow ridge. Measured: its OKLab lightness climbs to
0.79 at ×2.8 and falls to 0.46 by ×4, so the lightest band reads as a crest in a field that has
none. The lab draws the same field five times (CRIT Rate 0–100%, the stage's new axis), with the
contours, the 1:2 ray, the CV line and a build at 70% / 140%, plus the no-crit shading at any
hit count. Under each field is its ramp, with the lightness curve drawn over it. Every rival
goes through the same B-spline and chroma gain as the current ramp (`critRamp.ts`, Nate's
2026-09-30 pick), so only the stops differ. All four rivals only rise in lightness:

- **A, the rainbow unfolded:** the same blues, teal, green and yellow; past the yellow it goes
  pale instead of orange, red and purple. The smallest change; most builds (×1.5 to ×2.6) look
  as they do today.
- **B, viridis:** the standard even ramp in scientific plotting.
- **C, night to gold:** navy through violet and rose to gold and cream (magma-like), the site's
  own palette.
- **D, ice:** one family, navy to pale cyan; the quietest.

Claude recommended **A**: it removes the ridge and leaves the part of the field players
actually sit in unchanged. ⚓ Nate kept the rainbow, and the lab page is retired.

## 3a. Nate's first look, and the rework

Nate: "not reading quite right". Three points:

1. **The curves are the chart's essential fact, and they hid further.** The streamer couldn't tell
   what the curving lines were, though the headline is one of them, and the strip had taken the
   right edge where their values used to sit. The rework:
   - **The strip moves to the left, outside the CRIT Rate handle** (Nate's idea). Its rows grow
     away from the field, and your crosshair runs from the field out through the handle's thumb
     and the strip.
   - **The right edge is the average's axis again**, with "average damage" at its head and ×1 to
     ×4. Along CRIT DMG 300% the average is 1 + 3 × CRIT Rate, a straight line, so the edge is an
     exact linear scale and every contour meets it at its own value.
   - **Your contour is drawn**: every build with your average, solid at 2.5px over a night
     casing (the boldest line on the field), labelled "your average" inside the edge and valued
     on the axis in the ink, bold, "×1.98". The CV line steps down to 1.25px at 70%, so the two
     lines through your marker differ. At the best split the CV line touches your contour, which
     is the best split's geometry, now visible.
   - The fine print names them (§5 item 9).
2. **The rainbow stays** (§3).
3. **The field stretched to 2.3:1 one up.** Offered by Nate: more length for the strip, or this
   instrument alone with a control on the side. Claude's pick is the first: a side column would
   hold only the fine print, and the stage's one box is what the five before it settled on.
   🎛️ `FIELD_MAX_ASPECT` 1.6: the field takes up to 1.6 × its height, the strip the rest between
   `STRIP_MIN` 56 and `STRIP_MAX` 480, and any past that goes back to the field
   (`splitChartWidth`, tested). Measured: 1.60 at 1366×768 and 1600×1000, 1.85 at 1920×1080 and
   2560×1440 (the strip at its most). The length lets each row carry its reading where its rows
   have room (🎛️ `ROW_LABEL_W` 118 from a 178px strip, rows 13px apart, a chance of 0.5%):
   "6 crits · ×2.05 · 29.6%".

## 4. For Nate's eye

1. The field's aspect after the rework (§3a): 1.6 up to 1600 wide, 1.85 past it. Raising
   `STRIP_MAX` holds 1.6 further, with a longer strip.
2. The upright CRIT Rate handle between the strip and the y axis's numbers, its name and field
   over its top; the CRIT DMG handle under the axis as everywhere else.
3. The strip: grey rows, the read one in the ink, each with its reading where there is room; its
   name "crits in 8 hits" under it. Two up and on a phone it is 56px of bars with no words.
4. Your contour and its "×1.98" on the axis; the CV line now the lighter of the two.
5. The 0–5% veil and its words.
6. The marks drawn always (the Equal-budget toggle is gone): the CV line, the 1:2 ray and the
   ring. The ray's name now sits at its dark lower-left end; at the top corner it smudged on the
   yellow.
7. The marker's "CD:CR 2.00 : 1", small, below and right of the dot.
8. Pin and Roll at the toolbar's far end; on a phone they wrap under the setup bar, right
   aligned.
9. Rows in the strip are always on: there is no setting to hide them.

## 5. Copy (written in, for approval)

1. The headline: "{×1.98} average damage per hit".
2. The setup bar: "Hits per rotation" {n}; "Shading" "No-crit risk" | "None".
3. The Hits popover: "The hits in one rotation that can crit. The bars beside the map count how
   many of them do, and the track is coloured by the chance that none do: at {70}% CRIT Rate,
   {<0.1%} over {8} hits."
4. The Shading popover: "Darkens each CRIT Rate by its chance of a whole rotation of {8} hits
   without a single crit."
5. The chart tools: "Pin this build" / "Clear pin" (kept); "Roll {8} hits" (kept).
6. On the chart: "{280} CV" (kept), "best split of this budget" (kept), "CD = 2×CR" (kept),
   "CD:CR {2.00 : 1}" (new, at the marker), "{+3.3%} vs pinned" (was "+3.3% average DMG vs
   pinned" in the card), "crits in {8} hits" (new, the strip's name), "below the base 5% CRIT
   Rate" (new, the veil), "average damage" (the right axis's name, was the title "Average
   DMG"), "your average" (new, on your contour), a strip row "{6} crits · {×2.05} · {29.6%}"
   (new; "1 crit" in the singular).
7. The fine print at rest: "A hit that doesn’t crit is ×1. On average {5.6} of {8} hits crit,
   and {<0.1%} of rotations land none." The card's gloss ("Average DMG per hit. A hit that
   doesn't crit is ×1.") lent the first sentence.
8. A row read: "{6} of {8} hits crit: {×2.05}, in {29.6%} of rotations." After a roll: "{3} of
   {8} hits crit: {×1.52} this time." Both were an em dash before the figure; a colon now.
9. The standing lines: "Each curve joins the builds with one average, its value where it meets
   the right edge; the bold one is yours. The straight line is every build with your {280} total
   crit value (CV): 2 × CRIT Rate + CRIT DMG, base crit stats included." Then: "Drag anywhere on
   the map, or a handle, to move your build; hover or tap the bars to read one rotation." ⚓ It
   keeps the card's TOTAL (Nate 2026-10-02): a bare "280 CV" reads as artifact CV.

Retired: "Current build", "Average DMG per hit. …", "Ratio (CD:CR)", "Total crit value (CV)"
with its gloss (now item 9), "No-crit risk ({n} hits)", "Pinned" with its value, "Crits in one
rotation of {n} hits", "Equal-budget line (CV)", "No-crit risk overlay" with "chance a whole
rotation lands zero crits", the axis titles "CRIT Rate" and "CRIT DMG", and
the marker tooltip's lines.

## 6. Help (proposed, not landed)

`src/lib/help/chapters/Visualizers.svelte` § Crit heatmap still describes the sliders, the
Equal-budget toggle and "the chart under the map". Proposed:

1. First paragraph: "Your average damage per hit, 1 + CRIT Rate × CRIT DMG, across every split
   of CRIT Rate (up the side) and CRIT DMG (along the bottom). Press anywhere on the map to move
   your build there, or drag a handle on either axis, or type a value beside it. Each curve joins
   the builds with one average, read off the right edge, and the bold one is yours."
2. Second paragraph: "The solid line through your build is every build with your total crit
   value (CV), counted as 2 × CRIT Rate + CRIT DMG with base crit stats included. A ring marks
   that budget’s best split, which sits on the dashed 1:2 diagonal until CRIT Rate would pass
   100% and then leaves it. **Pin this build** holds a second marker, and the line from it to
   yours shows how much the move changes your average."
3. Third paragraph: "The average hides how uneven a rotation can be. The bars left of the map
   share its CRIT Rate axis: one for each number of crits in a rotation, set at that number’s
   share of the hits, as long as its chance. Set the hits in the bar over the map. The
   **no-crit risk** shading darkens builds by their chance of a whole rotation without a single
   crit, and **Roll** plays one rotation and lights the bar it lands on."

The credit paragraph is unchanged.

Tests: `crit.test.ts` § the field's axes (4, replacing the fixed-box transforms) and
§ splitChartWidth (3). Gates: see the
commits.
