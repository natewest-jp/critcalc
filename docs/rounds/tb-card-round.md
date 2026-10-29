# TB card round — 2026-08-11

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

✅ **MERGED `5066c1a` + PUSHED** (branch `polish/tb-cards`, 8 commits, deleted).
Gates on the merge commit: vitest 1329 / check 0 / lint / build · \*\*e2e 68 CHROME

- 68 WEBKIT green on the tip.**
  ✅ **Real Safari was checked DURING the round\*\* (⚓ Nate, on the opacity question)
  — see the state-ladder section. Nothing else here is Safari-verified.

The chore fixes were folded in at ⚓ Nate's call: "I'll consider them all TB
improvements."

⚓ Nate's brief: "There's a lot wrong with them… can you do a full round of
restyling. We'll make it a first draft, and tweak from there."

---

## 🖼️ The portrait — element wash, and the brightness argument that shaped it

Full recipe in **`docs/design/element-wash-recipe.md`**. What's specific here:

⚓ Nate asked directly: **a lighter Genshin-style gradient, or copy the bench?**
He supplied the reference (Genshin's own cards: a mid-tone rarity gradient under
a cream name plate). **It copies the bench, and the deciding argument is
arithmetic, not taste:**

> The palette round measured Genshin's screens at **10–14%** of pixels above
> L.35 and **our TB Roster at 20.8%**. This grid is ALREADY the brightest
> surface we own. 122 mid-tone gradients would push it further past the
> reference it is imitating — Genshin can afford bright cards because its party
> screen shows a dozen; ours shows the whole roster.

⚠ **If Nate wants the light version anyway, it is one line**: the portrait's
`.ctx-dark` is what makes `--surface-well` resolve to slate-900. Drop the class
and the same recipe resolves to **parchment-200** and goes Genshin-light — but
the white weapon art stops reading and would need a plate back.

↻ **⚓ Nate flipped the STOPS on review — element at the BOTTOM, matching the
bench.** The reasoning that survives is "the colour belongs behind the character,
not around their head"; ⛔ do not re-derive the direction from _where the ground
is widest_, which is what produced the wrong answer. Full note in
`docs/design/element-wash-recipe.md`.

## 🔘 Corner marks — ONE question sorts all four

⚓ Nate: "the constellation pip and the element-type pip are really outdated —
reference the bench's, and **I'm not sure if round is the right call**."

**It is, for half of them. The question is: does the mark carry a VALUE, or is
it a PICTURE?**

- **VALUE (C4, slot 2) → a circle**, `--r-round`, `--surface` (one rung UP from
  the well it sits on). This is the bench's own idiom — `.sp-cons-chip` is a
  round well holding a C-number — and two families of character card disagreeing
  about the shape of a constellation reading is exactly the drift to avoid.
  ⚠ The rung direction FLIPS vs the bench (up, not down) because there the
  surrounding ground is the card and here it is the well.
- **PICTURE (the weapon glyph) → NO CHIP AT ALL.** The chip was scaffolding for
  a legibility problem that stopped existing: the art is white line-work that
  used to sit on the old gradient's near-black end. On a known slate rung it
  simply reads, with a drop-shadow for where it crosses hair. Genshin draws its
  element pip the same way.
- `--r-round` circles carry the bench's **`text-indent: -0.06em`** — tracking
  lands after the last glyph too, so the advance box the grid centres is a unit
  wider than the ink.
- ⛔ `.cc-con--set` no longer FILLS. **Ink is the channel that changes on this
  family** (the bench's rule since it lost its strokes): a filled chip at 20px
  reads as a coloured dot before it reads as a number.
- 🐛 **`.cc-wish` was `--el-geo-hi`** — an element token borrowed for being
  gold-coloured, silently carrying an element into a decision the element has no
  part in. Now `--accent`.

## 🎨 Hue became a STATE on the card border

```
rest      ink       — structure, per the palette round's border rule
hover     element   — "this one"
compared  gold      — "chosen"  (wins over hover: standing fact beats passing one)
```

The resting element border was justified while the card had no other element
presence worth the name; the portrait carries it properly now, so a coloured
edge on all 122 at once was a second quieter copy of the same fact — and it left
hover and "compared" fighting over the edge, the only channel it has.

## 🎚️ The opacity ladder — tuned for the OPEN SCENE

⚓ Nate: "now that they're in an entirely different context (directly on-scene)."

`--cc-faded` **.46 → .62** · `-hover` .92 → **1** · `--cc-dimmed` .55 → **.7** ·
`--cc-disabled` .32 → **.42**.

These were picked when the card sat inside a framed paper SHEET and faded toward
a known static ground. The frame went 2026-08-08; a faded card now fades toward
the **live world** — at .46 it was a haze with stars moving through it, i.e. the
state the breathing-room round ruled out ("opaque or obviously translucent — the
middle is not a place"). **The floor: a faded card must still read as an OBJECT
with an edge.** Below ~.55 the scene shows through the name plate.

- ↻ **`CharacterSelector`'s `--cc-faded` override was DELETED** — it existed to
  rest the picker LIGHTER than the TB (.6 vs .46) and the base moved past it, so
  it had become a request for a _darker_ rest than default.
- ⚠ **KNOWN DEBT, recorded at the site:** this is still element `opacity` on a
  transform-placed element, which the sub-pixel laws forbid. Converting means
  moving alpha into every child's PAINT (paper, gradient, art, four chips, a tag
  row) — a round of its own. The transform is 1px and hover-only.
- ✅ **⚓ NATE CHECKED IT IN REAL SAFARI, 2026-08-11 — and the debt is PARKED, not
  paid.** "Almost no dancing, and it's funny, because it depends on where the
  card landed on scrolling. I'd say it's a non-issue — it occurred only rarely,
  and the dance was so small it was always almost unnoticeable."
  ⚠ **Read the finding precisely: the law was CONFIRMED, the severity was not.**
  _Depends on where the card landed_ is the sub-pixel law's exact signature —
  WebKit's offset moves with layout position. The mechanism is real; the
  magnitude at a 1px hover-only transform is below the threshold that would
  justify the conversion round. ⛔ **So don't re-open this as a bug**, and don't
  cite it as evidence the law is soft — if a bigger transform ever lands on a
  card, the finding does not transfer.

## 🔧 The hover buttons — one mistake made three times

⚓ Nate: "the hover buttons are all wrong — wrong colors."

Every `.tb-act` state mixed against **`--bg`**, the PAGE ground, on a **parchment**
card — so the control painted itself a dark translucent slab and the accent
mixes on top ("gold 18% of near-black") came out as mud. Now on the light
context's own control roles: `--fill-rest`/`--border`/`--muted` → hover
`--accent-hover-fill`/`--sel-ring`/`--ink-active` → on `--sel-fill`.

⚠ **This forced `.cc-actions` to go OPAQUE `--surface`.** It was
`color-mix(--surface-raised 90%, transparent)` — two bugs: `--surface-raised` has
no meaning on paper (ctx-light has no raised rung; it aliases to `--surface`, so
the name promised a lift it could never deliver), and those fills mix toward
transparent and need a real ground per the alpha-compositing law.

## ➡️ `compare` — a new mark, now on its SECOND candidate

⚓ Nate: "the compare arrow doesn't make sense anymore." It was `forward`, right
when Compare was a right-hand DOCK; it is a nav tab now, so the arrow pointed at
nothing.

**There are only two ideas available, and both are recorded in the generator so a
third pass doesn't re-tread them:**

|            | idea                                                         | verdict                                                                                                                                 |
| ---------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `Columns3` | name the **destination** — aligned columns sharing one ruler | ⛔ ⚓ Nate rejected. Also the closest mark to `layout` (LayoutGrid); at 14px a filled rect with two interior bars reads as a table cell |
| `Scale`    | name the **act** — weighing candidates against each other    | ✅ ⚓ **Nate: "I love both the compare mark and the fix on the no-frames mark."**                                                       |
| `ArrowUp`  | Nate's own first suggestion (toward the tab)                 | ⛔ a spatial claim that stops being true the moment you scroll                                                                          |

⚠ **`Scale` is 5 nodes, the busiest mark in the map** — the same risk that sent
`share` from Share2 to Share ("silts up at 14px"). Its pans are open arcs rather
than enclosed counters, which is what makes it survivable, and the hover bar
renders it at **16** rather than the default 14. **If it has to shrink, it
fails.** Its peer glyph moved to 16 with it — two marks side by side in one bar
have to be one size whatever each needs.
⚓ If Scale misses too, Nate browses Lucide himself. `SquareSplitHorizontal` (3
nodes, open sides + a divider) is the cleanest un-tried variant of idea 1.

## 👻 The ∅'s ghost — see memory `feedback_retired_glyph_ghosts`

⚓ Nate spotted it: "we had given it a little nudge up because the unicode
character sat low." Both cards were still carrying `font-size` / `font-weight` /
`line-height` / `translateY(-0.1em)` tuned for a `∅` that the icon set had
replaced with a geometric Mark — three doing nothing and the transform pushing an
already-centred mark **off** centre. The swap had also silently killed the mark's
band SCALING. Fixed on both, with one shared rule: **an annotation mark matches
the name it annotates 1:1 in px; an identity glyph runs 1.25×.**

## 📌 The pinned Atlas head (the chore that opened the round)

⚓ Nate: the back button "should stay accessible while the user browses."
The head was **lifted OUT of the scroller** into a new `.tb-sourcebox` wrapper —
⚠ **NOT `position: sticky`**, which would park it in exactly the pixels the
`scrollFade` **mask** erases; a mask cannot be told to spare one child. The
wrapper (not a `.tb-stack` child) so the pair keeps the Atlas's 0.8rem row rhythm
instead of the surface's 2rem section gap.
⚠ It adds a level to the documented fill chain and needs `min-height: 0` like
every other level.

## 🧹 The closing sweep — two bugs that were PATTERNS, not one-offs

⚓ Nate: "is there anything else we could be missing this round?" The answer came
from sweeping for the _pattern_ of each fix rather than re-examining the same
surfaces. **Do this at the end of any round that corrects a token.**

**⛔ Reaching for `--bg` — 3 instances, all now cleared.** The bench backing, the
card portrait, and the Atlas slot-row / audition discs (the last on a raw
`rgba(0,0,0,.5)`). The slot-row case was worse than off-ramp: those discs sit
**on a glass plate**, so a disc borrowing the world's colour painted a hole
through a pane. All three now take the element wash — **every character portrait
on the site is one recipe.** ⚠ At 34px use the wash's tinted end FLAT; a two-stop
ramp with ~17px to travel reads as one muddy tone.

**⛔ Borrowing an element token for its COLOUR — `.cc-wish`'s `--el-geo-hi` was
1 of 5.** The other four were `--el-geo-main` standing in for gold, and they were
**two different roles wearing one wrong token**:

| what it actually is        | correct role  | sites                                                                          |
| -------------------------- | ------------- | ------------------------------------------------------------------------------ |
| wishlist                   | `--accent`    | `.cc-wish`, DetailCard's own-button                                            |
| uncurated / stub / unknown | `--ui-danger` | DetailCard's stub note, CompareView's stub label, CoveragePanel's unknown chip |

The second group all report the **same fact as the ∅ marker**, which the
dire-retirement round settled as a data-quality state, not a domain colour.
🔎 Gold was _doubly_ wrong on the coverage chip: `--accent` already carries "a gap
you can click" two rules above, so the unknown state wore the actionable colour
while being the one chip you can't act on.

✅ Swept clean after: no `--bg` left in the TB or the shared components; every
remaining `--el-*-main` is a genuine element (the Visualizers' reaction curves).

## ⏭ Open / next

- ✅ ~~NEXT SESSION IS THE ROTATION PLANNER~~ — **DONE 2026-08-11**, see
  `docs/rounds/rp-scene-round.md`. The Compare view still waits behind it by design
  (below). ⚓ **The `--el-*` round is now the next session** and the planner
  round left it a queue: white-on-element labels measuring ~1.3:1, NB/moonsign
  "too bright", and the parked idea of giving buff bars their SOURCE
  character's hue.
- ⚓ **APPROVED by Nate, 2026-08-11** — draft, wash flip, `Scale`, and the mark
  fix all landed with no further changes. ⚓ His read on why it went fast: _"this
  is the payoff we finally get for ploughing through developing the new styling
  framework, establishing the SVG marks, etc."_
- ⚓ **COMPARE IS DEFERRED — after the Rotation Planner round, deliberately, so it
  INHERITS those changes.** (It supersedes the "next: Compare" note in
  `docs/rounds/tb-atlas-round.md`.) Only a token correction was made there this round.
- ⏸ The card's `border-radius: 6px` is off the retirement round's scale (3px
  default / 6px modals) — left alone, not endorsed.
- ⏸ **⚓ DEFERRED TO THE `--el-*` ROUND (Nate 2026-08-11): the portrait wash's
  LIGHTNESS VARIES BY ELEMENT.** `--cc-portrait-el` is one number, but cryo
  (`#9de2f7`), geo (`#fabd22`) and dendro (`#85d736`) are far lighter than hydro
  (`#1c88e8`) or electro, so the same 32% lands at different lightnesses across
  the roster. ⚠ It is **not** obviously a defect — the variation IS element
  identity — which is why it waits for the round that owns the tokens rather
  than being normalised here. It joins the Atlas pip table as that round's second
  concrete target.
- ⏸ **Band thresholds** — see the section below.

## 📐 The band-thresholds question, restated (⚓ Nate asked 2026-08-11)

**What was parked** (from `docs/rounds/character-card-display-exploration.md`, July):
"Phase-5 visual tuning of band thresholds (104/150px) + the 1500/1900px grid
bumps + the 0.6→0.55 picker-dim question."
✅ The picker-dim third **is closed** — this round deleted the override outright.

**The measured state today:**

| feeder                              | minimum | at ≥1500 | at ≥1900 |
| ----------------------------------- | ------- | -------- | -------- |
| `.tb-grid` (Atlas rows, stubs)      | 118px   | 150px    | 168px    |
| `.cg-grid` via `.tb-roster`         | 118px   | 150px    | 168px    |
| `.cg-grid` default (planner picker) | 128px   | —        | —        |

Card bands: base (**<104px**) · comfortable (**≥104**) · roomy (**≥150**).

**✅ ALL THREE APPROVED AND LANDED (⚓ Nate 2026-08-11).**

1. ⛔ **The compact band was UNREACHABLE — DELETED.** The lowest minimum
   anywhere is 118px, and `auto-fill` at a 320px viewport still yields one
   ~280px column. Its rules (centred name, no element glyph) are dead code that
   has to be mentally excluded on every read, and the "base" band is in practice
   just comfortable's fallback. ⛔ Don't keep it as a mobile safety net — the
   mobile round is survey-first by its own plan, and this is the speculative
   abstraction the conventions forbid. **Result: one query instead of two.**
2. 📌 **150 is COUPLED to the 1500px grid bump — kept, and now DOCUMENTED at the
   query.** With `auto-fill` + `1fr`, tracks sit just above the minimum (118 →
   ~118–133; 150 → ~150–168), so roomy fires at exactly the moment the media
   query raises the minimum. ⚠ If either moves, both move — a threshold in
   **134–149** would separate the two regimes with margin, at the cost of the
   picker (128px min, tracks up to ~146) sometimes crossing it.
3. ✅ **Bigger-vs-more resolves to BOTH, IN STEP — ⚓ Nate's answer, with a
   calibration point to hold it to.** "On my screen I get
   **seven cards across**, and it feels very nice, very comfortable. If it were a
   lot more than that, it would start to get too wide."
   That is the ≥1500 rung at its 150px minimum. So the ladder is right as built —
   it raises the minimum (bigger) while `auto-fill` adds columns (more).
   📌 **7-at-150 is the point the whole ladder is tuned through**; any change to
   the 1500/1900 bumps has to keep landing near it.
   (My recommendation had been _bigger_ alone — Nate's "in step" is the better
   answer and is what the existing ladder already does.)

Related: `docs/design/element-wash-recipe.md` · `docs/rounds/tb-atlas-round.md` ·
`docs/rounds/palette-definition-round.md` · `docs/rounds/character-card-display-exploration.md` ·
`docs/design/icon-set.md`
