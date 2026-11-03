# The stage, round 6: Crit heatmap (2026-11-03)

**Status:** built on `feat/viz-crit-stage`; Nate's first look (§3a) reworked the layout and his
second (§3b) stripped it down; his third (§3c) gave the field the tile's height, and §3d has his last tweaks. Waiting for his eye, the copy (§5) and Help (§6). Not merged.

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

As first built; §3a and §3b changed the strip's side, the marks and the width.

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

## 3b. Nate's second look: strip it down

Nate, with a screenshot: "serious overcomplication". The marker had four lines through it (your
contour, the CV line, both crosshairs) and eight behind it (seven contours and the 1:2 ray); the
field still stretched and sat lopsided; the strip's words were too much.

1. **The field keeps the contours** (⚓ Nate) and **loses your contour** (⚓ Nate). Claude's pick of
   the rest: keep the CV line and its ring, the instrument's one answer to "is my split right?";
   drop the 1:2 ray (the ring already sits on it wherever it can, so the ray only repeated it),
   both crosshairs (the handles' thumbs sit on the marker's lines already) and the CD:CR words at
   the marker. Your average stays on the right axis as a notch and a bold value, so the headline
   still reads on the scale the contours are read by. The CV line is the one solid line (1.5px at
   85%).
2. **A capped, centred plot** (Nate's lean). The whole stage is capped, not the plot alone, so
   the headline and the toolbar come in with the chart and the box keeps one left edge. A cap on
   the stage's own aspect (1.45) was tried first and set aside: the head, toolbar, handle and
   fine print take a share of the height that varies, so the field came out 1.6 to 2.1. Now the
   stage is capped at the width that gives the field 🎛️ `FIELD_MAX_ASPECT` 1.5 × its height
   (`--cv-stage-max`, from 1024px), and the shared rule centres it. Measured 1.50 at 1024×768,
   1366×768, 1440×900, 1600×1000, 1920×1080 and 2560×1440; two up and narrow are uncapped.
3. **The strip is narrow again and wordless**: 🎛️ `STRIP_PER_H` 0.15 of the plot's height, 56 to
   110px (by height, so the stage's width can follow the field without chasing itself).
   `splitChartWidth` and `formatRatio` go.
4. **Fixed on the way:** the chart's natural-height floor (a near square of its width) applied
   from 1024px too, so at 1366×768 the chart ran taller than the tile. It is the floor below
   1024px only; above, the least plot.

## 3c. Nate's third look: vertical room

Nate: "much better". He asked for Claude's ideas 1 and 2, a phone pass, and his own ideas for
giving the field more height:

1. **The ring is a button** (Claude's idea 1): a press, or Enter on it focused, moves your build
   to the best split of its budget. ⚠ It reads both stats before writing either: setting CRIT
   Rate first moved the CV and the split with it (a first build landed 60.6% / 145% for 121.2%).
2. **The contours are solid and thin** (idea 2), 🎛️ `CONTOUR_INK` 0.32, `CONTOUR_W` 1.
3. **The phone:** below 🎛️ `STRIP_SIDE_MIN` (560px of chart) the strip leaves the field's side and
   lies under the CRIT DMG handle on its own axis, a column per crit count, 0 to the hits
   (`STRIP_BELOW_H` 56). Nate's point: the strip shares CRIT Rate's axis by meaning, but it reads
   without it. And the upright track painted a 24px slab under a coarse pointer: its padding was
   `padding-inline`, which in a vertical writing mode runs top and bottom (`app.css`, now
   physical).
4. **The side form** (Nate's ideas): from a 60rem tile the headline and the fine print are a
   column at the stage's left edge (🎛️ `--cv-side-w` 17rem), and the chart stands beside them at
   the tile's full height, centred in the rest. Nate offered the fine print on the right;
   Claude's pick was under the headline, so the text is one column at the edge every instrument
   starts from and the right stays the average's axis.
5. **Every control on the chart's top edge**, nothing behind a popover: CRIT Rate's name and field
   lead (its track still hangs down the field's left, from a containing block on the chart's
   column), then the hits as a short inline slider with its risk ramp, then the chart tools as
   one group at the far end: No-crit shading as a toggle, Pin and Roll each a mark and a word.
   The words drop by the toolbar's own width (🎛️ 52rem, the row measured about 836px with them),
   since the chart's column is narrower than the tile in the side form. The svg's top margin
   falls from 34 to 🎛️ 18 (`TOP`), with the CRIT Rate field gone from it.
6. Measured, the field: 1007×760 (1.32) at 1600×1000, was 885×590; 1260×840 (1.5, the cap) at
   1920×1080; 792×528 at 1366×768; 491×495 at 1024×768 (the side form at its narrowest); two up
   at 1600, 553×611 in the stacked form with the toolbar on one row.

## 3d. Nate's tweaks before the close

Nate: "so much better … just about there."

1. **CRIT Rate's name and field end at the field's left edge**, over the y axis's numbers, on any
   chart with the strip beside it (the CR block is as wide as the margin and right aligned).
2. **On a phone, CRIT Rate's and CRIT DMG's names sit side by side under the chart**: the CRIT
   DMG track, then the two names on one row across the stage's full width (the track alone keeps
   the inset). Fits at 375 wide.
3. **The strip's bars are wider where they have the gap**: 🎛️ `ROW_MAX` 22, was 10. Claude's
   judgment: not the whole gap, since a solid block of bars reads as one shape, not a count. At
   8 hits on 1600×1000 the rows are 22px in a 95px pitch; at 60 they keep 72% of theirs.
4. **Hits go to 60** (`HITS_MAX`, was 40; a streamer's ask). Tested: the distribution sums to 1
   and leads with the no-crit risk at 60.
5. **The contours are dotted**, after dashed and solid: round dots, 🎛️ `CONTOUR_W` 2,
   `CONTOUR_GAP` 5, `CONTOUR_INK` 0.6. They read as a guide over the colour and stay clear of the
   one solid line; `CONTOUR_DASH` 'none' brings solid back.

## 4. For Nate's eye

1. The side form: the head and fine print at the left edge, the chart beside them; at 1024×768
   the field is near square.
2. The toolbar on the chart's top edge, and where it wraps (1024 one up: CRIT Rate and the hits,
   then the three tools right aligned).
3. No-crit shading as a lit plate when on.
4. The solid contours, and the ring as a button (no change at rest; a pointer cursor over it).
5. On the phone: the strip under the CRIT DMG handle, and the thin CRIT Rate track.
6. Your average as a notch and a bold value on the right axis.
7. The 0–5% veil and its words.

## 5. Copy (written in, for approval)

1. The headline: "{×1.98} average damage per hit".
2. The toolbar on the chart's top edge: "CRIT Rate" and "Hits per rotation" (the sliders' labels),
   "No-crit shading" (a toggle; its tooltip "Darkens each CRIT Rate by its chance of a whole
   rotation without a single crit"). The setup bar's "Shading", "No-crit risk" and "None" are
   retired with it.
3. The hits popover's note is retired: the fine print says the same (Nate: it did double duty).
4. The shading popover's note became the toggle's tooltip (item 2).
5. The chart tools: "Pin this build" / "Clear pin" and "Roll {8} hits" (kept), each after its
   mark, the words dropping where the toolbar is narrow (the names stay for screen readers).
   The ring's name: "Move to the best split of this budget" (new, its tooltip and its label).
6. On the chart: "{280} CV" (kept), "best split of this budget" (kept), "{+3.3%} vs pinned" (was
   "+3.3% average DMG vs pinned" in the card), "crits in {8} hits" (new, the strip's name), "below
   the base 5% CRIT Rate" (new, the veil), "average damage" (the right axis's name, was the title
   "Average DMG").
7. The fine print at rest: "A hit that doesn’t crit is ×1. On average {5.6} of {8} hits crit,
   and {<0.1%} of rotations land none." The card's gloss ("Average DMG per hit. A hit that
   doesn't crit is ×1.") lent the first sentence.
8. A row read: "{6} of {8} hits crit: {×2.05}, in {29.6%} of rotations." After a roll: "{3} of
   {8} hits crit: {×1.52} this time." Both were an em dash before the figure; a colon now.
9. The standing line: "Each curve joins the builds with one average, read on the right edge. The
   straight line is every build with your {280} total crit value (CV), 2 × CRIT Rate + CRIT DMG
   with base crit stats included, and its ring is that budget’s best split: press it to move
   there. Hover or tap a bar to read one rotation." ⚓ It keeps the card's TOTAL (Nate
   2026-10-02): a bare "280 CV" reads as artifact CV.
10. The handles' labels: "CRIT Rate", "CRIT DMG" (kept, now the axes' only names).

Retired: "Current build", "Average DMG per hit. …", "Ratio (CD:CR)" (and its trial at the marker), "CD = 2×CR" (with its ray), "Total crit value (CV)"
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
   the builds with one average, read off the right edge."
2. Second paragraph: "The solid line through your build is every build with your total crit
   value (CV), counted as 2 × CRIT Rate + CRIT DMG with base crit stats included. A ring marks
   that budget’s best split, which sits on the 1:2 ratio until CRIT Rate would pass
   100% and then leaves it; press it to move your build there. **Pin this build** holds a second marker, and the line from it to
   yours shows how much the move changes your average."
3. Third paragraph: "The average hides how uneven a rotation can be. The bars beside the map (under it, on a phone)
   share its CRIT Rate axis: one for each number of crits in a rotation, set at that number’s
   share of the hits, as long as its chance. Set the hits over the map. The
   **no-crit risk** shading darkens builds by their chance of a whole rotation without a single
   crit, and **Roll** plays one rotation and lights the bar it lands on."

The credit paragraph is unchanged.

Tests: `crit.test.ts` § the field's axes (3, replacing the fixed-box transforms). Gates: see the
commits.
