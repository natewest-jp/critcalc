# The stage, round 5: Damage breakdown (2026-11-03)

**Status:** ✅ merged into `main` on 2026-11-03 (`feat/viz-breakdown-stage`). Nate: "really
cool"; the copy (§4) and Help (§5) approved, Help landed; his tweaks (§3a) landed, the sums'
gradient approved ("looks great"); real Safari checked ("Safari green").

## 1. The headline

⚓ Nate, at the start of the round (design §6): **the best next roll**, "+2.3% damage from one more
CRIT Rate or CRIT DMG roll". Offered against the hit's total multiplier; the next roll gives the
player somewhere to go, where the total is accurate but leaves them where they are. ⚓ Nate also
chose to build straight into the instrument rather than demo the upright columns first.

Where two rolls add the same at the figure shown, the headline names both. The defaults sit on
the 1:2 crit ratio (70% and 140%), where a CRIT Rate roll and a CRIT DMG roll each add +2.3%
(by hand: 1 + 0.733 × 1.4 = 2.026 and 1 + 0.7 × 1.466 = 2.026, over 1.98), so picking the first
would have named CRIT Rate alone and hidden the tie. An additive reaction's gain is measured on
the damage it adds, so its headline says so: "+3.5% Spread damage from one more Elemental
Mastery roll".

## 2. What changed

The rail (the waterfall with its family tabs and reaction chips, the Build and Enemy panels, the
paper "What the next roll buys" table) is one stage box, as the four before it are.

- **The toolbar:** the four families as view tabs, then the setup bar: Reaction (the old chips as
  a list), Stats (the sheet at a glance in the artifact card's short names, "ATK 2,440 · DMG 61.6%
  · CR 70% · CD 140%", opening the full sheet two sliders to a line), Your level, and Enemy
  ("Lv 100 · RES 10%", with "· DEF −20%" once a shred or an ignore is set). The DEF shred switch
  goes: in a popover the two sliders simply sit at 0.
- **Upright** where the stage is 🎛️ `UPRIGHT_MIN` 900px or wider, the width the widest family's
  nine columns need. A column per bracket on the log axis whose gridlines double, up is more
  damage, each bar starting where the last ended. By the width alone, never by the family, so a
  tab never turns the chart. 🎛️ `BAR_SHARE` 0.66, `BAR_MAX` 132, `CAP_ROOM` 30, `PADL` 44.
- **The materials carry over:** glass for a stat bracket, the trigger element's colour for the
  reaction, the ink at 40% for a subtotal and 85% for the result, Nate's chevron stripes (in SVG,
  each stripe's point keeping the rows' angle, 🎛️ `CHEV_SLOPE` 0.45), and the leading line
  across each gap at a bar's head. A sum's column starts past a rule.
- **The caps:** every roll that feeds a column sits on it, a slice of the bar's width each, as
  tall as its gain on the log axis. Every bracket multiplies the rest, so a roll lifts its
  column by the same ratio it lifts the result (`rollColumn`, tested), and caps on different
  columns compare directly. The best (and any tie) is gold, the rest a dashed ghost; each is
  labelled with its short name and gain. They are thin, because a roll is 1% to 5%.
- **The feet:** each column's name, the sheet's numbers, and its multiplier with its change, as
  the rows had them; a sum's second line is its old formula ("vs base ATK alone").
- **Dragging:** a column one stat sets (Scaling ATK → ATK%, DMG Bonus, a reaction's EM, Base DMG
  Bonus, Elevation) has a grip, two short lines inside its head (over it when the bar is too
  short), and its whole slot takes the press. The axis may grow while you drag but never
  shrinks, and the dragged top is solved so it stays under the pointer while the others shrink
  (`dragTo`); it re-fits on release. A focused column is a slider: arrows step it, Page keys
  ten steps, Home and End its range; its ring is drawn, since Safari's outline on SVG is
  unreliable. A touch on it drags rather than scrolls.
- **Rows** below 900px (two up, a tablet, a phone): the old waterfall's rows, its formula
  column gone to the reading, each row's rolls as caps at its bar's head and as figures under its
  value.
- **The fine print** is the old reading cell: the family's caption at rest, or the column read
  (by hover, focus or a tap) with its share of the boost, its rolls, and its formula. All share
  one cell, so reading never moves the stage.
- **Tried and set aside:** a frozen axis with the plot's top as the drag's ceiling. From the
  defaults it stopped DMG Bonus at 74.5%, so every drag needed a release to go further.
- `defModsOpen` goes; the share state is unchanged (v2), so every saved state and link reads.
- New in `breakdown.ts`, tested: `emBracket` (the reaction families' EM column), `rollColumn`,
  `bestRoll`, `solveStat` (bisection, so the EM curves invert as well as the straight lines),
  and `LabStat.short`.

Driven on the dev server at 1600, 1000, 700 and 390, all four families, Vaporize, a drag on DMG
Bonus (the top tracked the pointer to the pixel until 200%), a keyboard step, the Stats and Enemy
popovers; no page errors.

## 3. For Nate's eye

1. ✅ (§3a) The two solid columns: the reaction's element colour (Hyperbloom's green, Lunar-Charged's
   violet, Vaporize's blue) and the result at 85% ink were thin rows and are now large blocks,
   the loudest things on the stage.
2. The caps: 2–6px tall, their labels carrying the figure. Flat ATK's short name is the card's
   "ATK", beside the column named "Scaling ATK".
3. The grip, and whether it says "drag me" enough.
4. Crit isn't draggable (two stats set it), nor are DEF and RES (the enemy's, in its popover).
   Claude's recommendation: leave crit to the popover; a drag that moves CRIT DMG alone would
   be a guess at what the player meant.
5. The axis growing under a drag: the other columns shrink as you lift one.
6. The space above the tallest bar (the caps' labels need it) and the y axis's name, "times a
   hit from base ATK alone".
7. Rows below 900px: every two-up tile takes them.

### 3a. Nate's rulings, and the tweaks

Nate: "really cool … good overall." ⚓ The grips, crit left undraggable, and the other points of
§3 stand as built. His tweaks, landed:

1. The chevrons run through the whole bar: the stripes start past the head, clipped there, so
   the corners beside the first point are filled (both forms).
2. A sum is the readout, not travel, so the result and the chunk wear no chevrons. First even
   stripes, the chevrons' width and fade with no point (Claude's pick of Nate's two). ⚓ Nate:
   "not so good after all", so the simple gradient, Claude's recommendation too: the stripes'
   bright ink from their 12% at the head to nothing at the tail, a fade with no direction. In
   rows it is its own element over the fill, so the bar keeps one background layer.
3. The reaction's bar is its element colour mixed with the stage's slate, in oklab (🎛️ `RX_MIX`
   70%), toned down without greying.
4. ↻ Reversing his 2026-10-02 call: the rows' bars are one height again (🎛️ `--bar-h` 1.5rem,
   was 55% of the row), so a two-line row's bar no longer stands taller than a one-line row's.

## 4. Copy (written in, approved)

1. The headline: "{+X%} {noun} from one more {stat} roll"; tied rolls "{A} or {B}" ("A, B, or
   C" for three). The nouns: "damage" (direct hit), "{Reaction} damage" (additive,
   transformative, Lunar & Stellar), "Stellar Swirl blast damage" (both blasts).
2. The setup bar: "Reaction" ("None", "{name} ×{n}"); "Stats" ("ATK 2,440 · DMG 61.6% · CR 70% ·
   CD 140%", "· EM 205" with a reaction; additive "EM 200 · CR 70% · CD 140% · DMG 61.6%"; Lunar
   & Stellar "EM 200 · CR 70% · CD 140%"; transformative "EM 200"); "Your level"; "Enemy" ("Lv
   100 · RES 10%", "· DEF −20%"; "RES 10%" where DEF doesn't apply).
3. The chart: the y axis, "times a hit from base ATK alone" or "damage"; the caps' labels, the
   short name over "+2.3%"; the feet as the rows had them.
4. The fine print at rest. Direct hit's first sentence, written for both forms: "Each bar
   multiplies the hit, and each gridline doubles it, so a ×2 is the same size wherever it sits
   and a cut runs the other way." (was "Each row … the same length … runs backward"). Then,
   after every family's caption: "The marks at the end of a bar are one more average 5★ roll of
   that substat, added to your sheet." and "Hover or tap a column to read it, and drag one with a
   grip to change its stat." (rows: "Hover or tap a row to read it.").
5. A column's reading, as the rows' were, then its rolls, "One more CRIT DMG roll (+6.6%) would
   raise the damage by 2.3%." (the Readout's row readings), then its formula.

Kept: the other captions, the rows' readings, the reaction names and multipliers, the sliders'
labels. Retired: "What the next roll buys", the table's "Substat", "One roll" and "Damage
gained", "Each row adds one average 5★ roll of that substat to your current sheet.", the Build
and Enemy kickers, "DEF shred and ignore" with its On and Off, and the reaction row's "picked
above".

## 5. Help (landed, as proposed)

`src/lib/help/chapters/Visualizers.svelte` § Damage breakdown, written for the rows and the
Readout table.

1. First paragraph: "One hit written out as its damage formula, one column per bracket in the
   formula's order, headed by the substat whose next roll would add the most. Each bar starts
   where the last one ended, on a scale where each gridline doubles the damage, so a ×2 is the
   same size wherever it falls and a cut like enemy DEF runs the other way. Hover or tap a
   column to read what share of the result it accounts for. Where the tile is narrow, the
   columns become rows."
2. Second paragraph: "The tabs choose the kind of hit: a direct hit, an additive one like
   Spread, a transformative reaction, or a Lunar or Stellar one. Set the reaction, your stats,
   your level, and the enemy in the bar over the chart; only the stats that feed that formula
   are offered. A column one stat sets, like DMG Bonus or EM, has a grip: drag it to change that
   stat. A direct hit ends as a ratio against a hit from your scaling stat alone, because the
   talent multiplier isn't an input. The reaction families end in a number. Enemy RES is
   entered after shred."
3. Third paragraph: "The marks at the end of a bar are one more average 5★ roll of each substat
   that feeds it, as long as what the roll would add, so marks on different bars compare
   directly; the best is gold. DMG Bonus has none, since it can't appear as an artifact
   substat. For an additive reaction the gain is measured on the added damage alone, not the
   whole hit."

Tests: `breakdown.test.ts` § the stage: caps and dragging (6 new). Gates: see the commit.

The copy ledger's note is `docs/text/ledger/notes/vz_breakdown.md`, new at the close.
