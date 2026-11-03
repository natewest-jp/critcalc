# The stage, round 4: Enemy RES & DEF (2026-11-03)

**Status:** built on `feat/viz-defres-stage`, not merged. Waiting on Nate's look, the copy (§4)
and Help (§5).

## 1. The headline

⚓ Nate, at the start of the round (design §6): **what your shred adds**, the gain from the shred
and DEF ignore picked over the same hit with none. Offered with what gets through (the old
Readout's lead) and the two on one line; the gain answers the instrument's real question (is
this shred worth bringing?), and what gets through moves to the dots and the fine print. The
defaults pick Viridescent Venerer, so the first view is an answer: "+27.8% damage from your
shred" for Pyro at 10% RES, level 90 against 100 (by hand: 10% − 40% = −30% RES, so ×1.15 for
×0.90, and 1.15 / 0.90 = 1.278).

⚓ Nate, the same question: the design's unit square (§8) waits until after this round, and is
tried in a demo only if the two plots leave him wanting it.

## 2. What changed

The rail (two stacked charts, three glass panels, the paper Readout) is one stage box, as Wish
odds, Artifact odds and Reaction curves are.

- **The toolbar:** the hit's element as the view tabs (the seven icons and Physical), then the
  setup bar: Shred (what is on, the first two by name and "+N"; the three lists and their Other
  sources in its popover), Enemy level, Your level, and DEF ("Applies" or "Ignored", each with
  what it covers, in place of the checkbox).
- **Two plots on one multiplier scale**, side by side, RES the wider (🎛️ `RES_SHARE` 0.62,
  `PANEL_GAP` 40). Below 🎛️ `SIDE_MIN` (620px of chart) they stack, DEF on top, so the RES
  plot's axis still sits on the handle. A shared scale is honest: both are multipliers on the
  same hit, so ×0.487 DEF reads beside ×1.150 RES.
- **DEF removed** (design §8): the DEF plot's x axis is shred and ignore as one figure,
  1 − (1 − shred)(1 − ignore), where the curve climbs to ×1. Against enemy level it was nearly
  flat. `defRemoved` in `defres.ts`, tested against the two-argument form.
- **The arrow:** each source a segment along its plot's axis, labelled over its middle, a row
  higher where it would meet the label before it. RES runs left from the enemy's RES; DEF runs
  right from 0, and an ignore takes its share of what the shred left (Lisa 15% and Nahida 30%,
  then Raiden's 60% of the 55% left: 78% removed). The stretch of curve the arrow moves you
  along is gold.
- **The dots:** hollow at where you start, gold where the shred lands you, each with its
  multiplier, labelled in the room its curve leaves (RES falls to the right, DEF rises). Their
  tooltips read the point in words.
- **The handle** is the enemy's RES, under the RES plot, at the arrow's tail; the common values
  (10% to 200%, and Immune) ride its line at the right where the plot is 🎛️ 560px or wider,
  under it otherwise. A press on the RES plot sets it too. Its range now runs from −100% (was
  −50%), so the track spans the axis.
- **The guides** ("below 0%, shred counts half", "diminishing returns") show only where they
  fit, so a narrow tile drops them rather than piling them on the y axis's name.
- **The fine print:** the product ("RES ×1.150 and DEF ×0.487: ×0.560 of your hit's damage gets
  through."), the regime sentence, then the two formulas.
- **Tried and set aside:** the handle on the RES after shred (the old chart's marker). Typing a
  RES after shred would quietly rewrite the enemy's own RES, and the enemy's RES is what a
  player knows.
- `DefResChart.svelte` goes, and its crosshair readings with it. The rail's chart cap
  (`.instrument--capped`, `--instrument-main-aspect`) had no wearer left and went too.

Driven on the production build at 1600: the default headline, a press on the RES plot (60%:
+100.0%), Hydro, Xingqiu from the popover (+137.5%), Immune, and a six-source link (+168.5%); no
page errors. Looked at headless at 1600, 700 and 390.

## 3. For Nate's eye

1. Side by side on one scale, against the design's stack. The DEF plot's top third is empty
   (DEF can't pass ×1).
2. The arrow: the alternating segment tones (the second reads brownish), and the labels
   stacking on a narrow tile.
3. The rungs on the handle's line, at its right.
4. Immune and DEF Ignored: each plot dims to 35% with its message over it, and the message
   crosses the curve.
5. On a 700px tile with the final RES near −100%, its "×1.450" meets the y axis's name.
6. The phone (on hold): the plots stack and hold together, the guides drop.

## 4. Copy (written in, for approval)

New:

1. The headline: "{+X%} damage from your shred"; "… damage from your shred and DEF ignore" when
   an ignore is picked; "+0% damage from shred, with none picked"; "×0 the enemy is immune to
   {Element}".
2. The setup bar: "Shred" with "None" or "{name} {n}%, {name} {n}% +{N}" and "Other sources";
   "Enemy level"; "Your level"; "DEF", "Applies" or "Ignored".
3. The DEF popover: "Applies: Talents and attacks, with or without an Amplifying or Additive
   reaction"; "Ignored: Transformative, Lunar, and Stellar reactions".
4. The chart: "damage kept" (the shared y axis), "Enemy {Element} RES", "Enemy DEF removed"; the
   arrow's "{name} {n}%", "{name} {n}% ignored", "Other {n}%".
5. The dots' tooltips: "At 10% RES, before shred, ×0.900 of the hit gets through."; "At −30%
   RES, ×1.150 of the hit gets through."; "Level 90 against level 100, before shred, ×0.487 of
   the hit gets through."; "Level 90 against level 100, with 78% of its DEF removed, ×0.812 of
   the hit gets through."
6. The handle: "Enemy {Element} RES" (was "{Element} RES" under the Enemy kicker).
7. The fine print: "RES ×1.150 and DEF ×0.487: ×0.560 of your hit's damage gets through.", then
   the regime sentence as it was, then "RES: below 0%, 1−res/2; 0–75%, 1−res; from 75%,
   1/(4·res+1). DEF: (100+yours) / ((100+yours) + (100+enemy)·(1−shred)·(1−ignore))."

Kept: the guides, the regime sentences, "Immune: this element deals no damage", the popover's
lists and section heads. Proposed: the DEF message "Transformative, Lunar and Stellar reactions
ignore DEF" takes the style guide's Oxford comma ("Lunar, and Stellar").

Retired: both chart captions ("Most enemies resist 10%. …" and "Equal levels already cost you
half your damage. …"), "Your shred and DEF ignore add X% damage against this enemy", the
Readout's rows, the Your hit, Enemy and Shred kickers, and the checkbox's label. ⚠ The DEF
caption's fact led by ruling (`docs/text/ledger/notes/vz_defres.md`: "equal levels already cost
you half" surprises people); it now shows only as the hollow dot's figure. Claude's suggestion:
keep it in the fine print, after the product.

## 5. Help (proposed, not landed)

`src/lib/help/chapters/Visualizers.svelte` § Enemy RES & DEF, today written for the two
stacked charts.

1. First paragraph: "How much of a hit gets through the enemy's resistance and defense, and
   what your shred adds to it, which is the headline. The RES chart and the DEF chart share one
   scale: how much of the hit is kept. Drag across the RES chart or the handle under it to set
   the enemy's RES, or pick a common value beside the handle. Each source of shred you pick is
   a segment of the arrow along its chart's axis, and its dot shows where you land."
2. Second paragraph, its last two sentences: "Equal levels with the enemy already halve your
   damage through DEF, and DEF shred and DEF ignore win it back, multiplying together, so the
   DEF chart counts them as one figure: how much of the enemy's DEF is gone. Transformative,
   Lunar, and Stellar reactions ignore DEF entirely; set that with DEF in the bar over the
   chart."
3. Third paragraph, its opening: "The shred list holds" → "The Shred setting holds".

Tests: `defres.test.ts` § `defRemoved` (2 new). Gates: Vitest 2754, svelte-check, lint and
build clean.
