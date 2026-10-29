# The element-wash recipe

> Moved from Claude's working memory on 2026-10-29, where it was kept as a living reference. Check the code before relying on a detail.

⚓ **Nate 2026-08-11, on the bench card: "that treatment looks gorgeous — remember
this recipe, as we may use it or something like it for `.cc-portrait`."** (It was
then adopted by `.cc-portrait` the same day.)

```css
--x-el: 26%; /* 🎛️ the one knob */
background: linear-gradient(
	180deg,
	var(--surface-well) 0%,
	color-mix(in srgb, var(--el, var(--neutral)) var(--x-el), var(--surface-well)) 100%
);
```

## The rule it encodes

**ONE ground, and the only thing that travels is the ELEMENT.** A two-ground
gradient spends its range on a depth change that says nothing, and then has no
range left for the element.

## What it replaced, and why that was wrong

Both live consumers ran `--frame-bg → color-mix(el 14%, --bg)`.

- ⛔ **`--bg` is the PAGE ground** (`#050b19`) — the deepest rung on the site and
  **not on the slate ramp at all**. A card reaching for it punches a hole
  through its own depth ladder to the page behind.
- ⛔ At that depth **14% of an element registers as nothing.** The percentage was
  picked against near-black; on a ground three rungs lighter the same fraction
  reads weaker still, which is why the knob went **up** (26% bench, 32% card).
- The old gradient therefore did three things badly at once: two grounds, a hue
  shift out of the ramp, and an invisible tint.

## Why `--surface-well` specifically

It is the role that already means _a ground cut into another ground_, so the
portrait lands **one rung under the surface it sits in** — the same step the
bench's flat controls (`--sp-pill-fill`) wear, which is what makes the portrait
read as part of the card rather than a hole in it.

⚠ **It resolves to a LITERAL in every context** (slate-900 / parchment-200 /
`--glass-well`), so the `color-mix` above is **not** a mix of a mix — see the
WebKit nesting law in `docs/rounds/genshin-night-palette.md`.

## ⚠ THE ELEMENT GOES AT THE BOTTOM — on both consumers

⚓ **Nate 2026-08-11 flipped the card's first draft to match the bench.**

The draft had put the card's element at the TOP, reasoning that a square the art
fills from the shoulders down leaves the two upper corners as the only visible
ground, and that Genshin's own cards run deep-at-top. **His eye overruled it, and
the surviving argument is the simpler one:**

> **The colour belongs BEHIND the character, not around their head.**

Tinting the top puts the strongest wash directly behind the face — the part of
the art that has to hold attention — and rings every head in its element.
Tinting the bottom lets it rise out of the shoulders, and it is still plainly
visible because the art tapers. Both card families now agree about which way the
light falls, which is worth more than a per-crop optimisation.

⛔ **Do not re-derive this from "where is the ground widest".** That is the
reasoning that produced the wrong answer.

## ⚓ A PORTRAIT BACKING IS AN OPAQUE OBJECT, NOT A LAYER OF ITS SURROUNDINGS

**Every consumer CLAIMS `.ctx-dark` on the disc itself**, rather than inheriting.
That is legal because the element **paints its own ground** (this wash), which is
all the context law asks — and it is not optional:

> `--surface-well` is a **ROLE**, so left alone it follows whatever context the
> element is dropped into. A portrait backing is one of the few things that must
> **not**.

🐛 **The bug that proved it (⚓ Nate, screenshots, 2026-08-11).** The Compare
tab's avatar stack was `background: var(--surface)` — itself a fix, replacing a
stray hex. Right instinct, wrong role, and it failed **twice from one token**:

| plate state | context                            | `--surface` resolves to | symptom                       |
| ----------- | ---------------------------------- | ----------------------- | ----------------------------- |
| unselected  | `.ctx-glass` (band B)              | `--glass-panel` @ .58   | **stars through the avatars** |
| selected    | `.ctx-light` (for `--sel-surface`) | parchment-100           | **the disc turns parchment**  |

The hex it replaced was accidentally righter than the role that replaced it.
⚠ The flip is also what makes any chips ON the portrait work: `--surface`,
`--muted` and `--fill-rest` inside then resolve against the picture rather than
against a paper card two levels up.

## Consumers (all six on this recipe)

`SlotPortrait` (bench disc) · `CharacterCard.cc-portrait` (roster/picker square) ·
`.tb-slotrow-avatar` (Atlas rows) · `.tb-cand-avatar` (audition strip) ·
`.cmp-chip-avatar` (Compare legend) · `.dc-avatar` (DetailCard) ·
`.tb-tabstack-circle` (the Compare tab's accumulator).
⚠ **Below ~40px use the wash's tinted end FLAT** — a two-stop ramp with ~17px to
travel reads as one muddy tone.

Related: `docs/rounds/tb-card-round.md` · `docs/rounds/palette-definition-round.md` ·
`docs/rounds/bench-band-round.md` · `docs/rounds/ui-design.md`
