# The stage, round 3: Reaction curves (2026-11-03)

**Status:** on `feat/viz-reaction-stage`, not merged. Nate: "Beautiful!"; the copy (§4) approved as
written in, Help (§5) landed in his wording. ⏭ Real Safari.

## 1. The headline

⚓ Nate, at the start of the round (design §6: the headline is chosen per instrument): **what the
next 100 EM adds**, on one curve. Offered with the value at your EM and the two together; the
gain is the instrument's real question (is more EM still worth it here?), and the value moves to
the curve's dot. "+2,745 / Hyperbloom, Burgeon, or Shatter damage from the next 100 EM" at 200 EM
and level 90 (by hand: 3 × 1446.85 × (2.087 − 1.455)).

## 2. What changed

The rail (chart, EM slider, Build panel, paper Readout table) is one stage box, as Wish odds and
Artifact odds are.

- **The toolbar:** the six families as view tabs, then the setup bar. Its first segment names the
  curve the headline reads ("Reaction Swirl"; "Family" on All families; absent on Crystallize,
  which has one), opening a list of the family's curves with their reactions. Then Reaction Bonus
  and Level, each where its family takes it, each a slider in its popover.
- **The curve read** is new state, `pick`, in the share state (an older link reads the family's
  first curve, as it did). A click on a curve's label on the chart picks it too; the segment is
  the keyboard's way. Picking a family resets it.
- **On the chart:** every curve's dot at your EM carries its name and value ("Swirl 3,617"), the
  readings as their tooltips. The picked curve draws heavier, its dot gold and its label in the
  ink; the others at 70%. Labels sit left of the marker, above each rising curve, and go right
  only where the widest wouldn't fit.
- **The step**, design §7's tangent: from your dot, 100 EM across and then up to the curve, so its
  rise is exactly the headline's figure. A tangent would overstate the gain on a flattening
  curve. Its word, "next 100 EM", shows when the labels are on the left (right, they'd meet it);
  past 1100 EM there is no room for the step and it hides.
- **The companion strip:** what the next 100 EM adds at every EM, on the picked curve, scaled to
  its own peak, with a dot at your EM. Wish odds' neutral ink: the curve's own colour made a loud
  slab.
- **EM is the handle** on the x axis, typeable.
- **The Readout's other columns:** the value went to the dots, "Next 50 EM adds" became the
  headline, the step and the strip (100 EM, the design's step). "+X% bonus is worth" went to the
  Reaction Bonus popover, for the picked curve: "At 400 EM, +50% Reaction Bonus is worth 94 more
  EM on Swirl." The family's note, its formula and its caveat are the fine print.
- 🎛️ `PADL` 38 (the y axis's "12.5k"), `COMP_H` 64.

Driven on the production build at 1600 and 390: every family's headline, the marker at 60, 200,
400 and 1150, a label click, the bonus popover; no page errors.

## 3. For Nate's eye

1. The headline's length on the long curves (Hyperbloom, Burgeon, or Shatter; Lunar-Charged or
   Stellar Swirl blast).
2. The labels' crowding: on All families at low EM four labels stack; on a phone they go right
   and cross the curves (the phone pass is on hold).
3. The step: small on a flat curve (Swirl, Burning), dashed in the ink.
4. The strip: on these curves it falls slowly, so it reads as a slab more than a shape.
5. The other curves at 70%.

## 4. Copy (written in, approved)

1. Headlines: "{gain} {noun} from the next 100 EM", the nouns: "Transformative boost", "Additive
   boost", "Lunar and Stellar boost", "Crystallize shield boost", "Amplifying boost"; "forward
   Vaporize or Melt multiplier", "reverse Vaporize or Melt multiplier"; "Hyperbloom, Burgeon, or
   Shatter damage", "Overloaded damage", "Electro-Charged or Bloom damage", "Superconduct damage",
   "Swirl damage", "damage per Burning tick"; "Spread damage", "Aggravate damage"; "Lunar-Charged
   or Stellar Swirl blast damage", "Stellar Swirl blast damage after 1–2 swirls", "damage per
   Moondrift hit", "Stellar Swirl damage"; "shield HP".
2. The setup bar: "Family", "Reaction", "Reaction Bonus", "Level".
3. The Reaction Bonus popover: "At 400 EM, +50% Reaction Bonus is worth 94 more EM on Swirl."; at
   0%: "A Reaction Bonus adds to the boost from EM, so it's worth less EM where the curve is steep
   and more where it has flattened."; on Crystallize in All families: "A Reaction Bonus doesn't
   apply to a Crystallize shield."
4. The chart: "next 100 EM" (the step), "what the next 100 EM adds" (the strip).
5. The fine print: the family's note, then "EM bonus 16·EM/(2000+EM)." and the caveat.

## 5. Help (landed)

`src/lib/help/chapters/Visualizers.svelte` § Reaction curves, the first paragraph (the second
and third are unchanged, except the column):

1. "How each family of reactions scales with Elemental Mastery. The tabs over the chart are the
   families: Amplifying, Transformative, Additive, Lunar &amp; Stellar, and Crystallize, plus
   **All families**, which puts them on one scale as the bonus each gets from EM. Drag across
   the chart or the handle under it to set EM. Each curve's dot shows its value there, and the
   headline shows what the next 100 EM would add to one of them, drawn as a step on its curve
   and, for every EM, in the strip under the chart. Pick the curve in the bar over the chart, or
   click its label." ⚓ Nate split it: "…and the headline shows what the next 100 EM would add to
   one of them. The value of the next 100 EM is also visualized as a step on the active curve and
   in the strip under the chart." The pick sentence follows.
2. In the second paragraph, "On All families, a Reaction Bonus above zero adds a column for how
   much EM the bonus is worth, which varies a lot" → "The Reaction Bonus setting says how much EM
   the bonus is worth on the curve you're reading, which varies a lot" (its example still holds:
   87 EM and 517).

Gates: Vitest 2752, svelte-check, lint and build clean; Chrome e2e 72 passed.
