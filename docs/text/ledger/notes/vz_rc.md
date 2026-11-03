# Notes — `vz_rc` (Reaction curves)

Hand-written half of the ledger for `../inventory/vz_rc.md`. Written at the close of Reaction
curves' stage round (2026-11-03, `docs/rounds/viz-stage-reactions-2026-11-03.md`), where Nate
chose the headline and approved the copy; worksheet 04 and the conventions sheet are superseded
for this surface.

## The surface

One stage box: a headline, the families as view tabs, a setup bar (the curve read, Reaction
Bonus, Level), a chart of every curve against EM with a strip under it, the EM handle, and fine
print. No Readout card.

- ⚓ **The headline is what the next 100 EM adds** (Nate), on the curve being read: "+2,745 /
  Hyperbloom, Burgeon, or Shatter damage from the next 100 EM". Its sentence is "{noun} from the
  next 100 EM", and each curve carries its own noun in code (`noun:`), so a locale words the
  whole phrase per curve rather than gluing a translated noun into a fixed frame.
- **The nouns name what grows:** "Swirl damage", "forward Vaporize or Melt multiplier",
  "damage per Burning tick", "shield HP", and on All families "Transformative boost" and its
  siblings. A label that joins reactions with " · " ("Hyperbloom · Burgeon · Shatter") becomes
  a list in prose ("Hyperbloom, Burgeon, or Shatter damage"), Oxford comma included.
- **Dot labels** are the curve's label and its value ("Swirl 3,617"); their tooltips are the
  old Readout's readings ("A Swirl hit would deal 3,617 damage before enemy RES."), which keep
  "would" for the hypothetical (style guide §1.8).
- **The chart's two words:** "next 100 EM" on the step and "what the next 100 EM adds" over the
  strip. Lowercase, as chart furniture.
- **The Reaction Bonus popover** says what the bonus is worth in EM on the curve read: "At 400
  EM, +50% Reaction Bonus is worth 94 more EM on Swirl." At 0%: "A Reaction Bonus adds to the
  boost from EM, so it's worth less EM where the curve is steep and more where it has
  flattened." On a Crystallize shield: "A Reaction Bonus doesn't apply to a Crystallize
  shield."
- **The setup bar's names:** "Family" (All families), "Reaction", "Reaction Bonus", "Level".
- 🔒 **Frozen:** reaction names (the game's), `EM` and "Elemental Mastery", "Moondrift".
  🏷 **Amplifying, Transformative, Additive** and "Lunar & Stellar" are the community's
  taxonomy, not the game's: a translator needs a context note, not a dictionary word.
- **The fine print** is the family's note, then "EM bonus 16·EM/(2000+EM)." and the caveat. A
  formula is never translated (conventions §I).
