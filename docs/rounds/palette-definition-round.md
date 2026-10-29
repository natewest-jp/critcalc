# Palette Definition Round — 2026-08-10

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

✅ **MERGED `6607b78` + PUSHED** (branch `polish/band-plate-followups`, 8 commits).
e2e 68 CHROME + 68 WEBKIT green on the tip. ✅ **REAL SAFARI CLEARED — ⚓ Nate 2026-08-12: "everything is green."** It moved the scene
wash, every glass alpha and 208 type declarations, and all of it held.

**The palette existed; the DECISIONS did not.**
⚓ Nate: "We have this great palette that we worked to define, but we don't have
any settled decisions about how we use them." This round made them.

**Read this before any color / type / ground / border / state work.** It
supersedes numbers (not direction) in `docs/rounds/genshin-night-palette.md` and
`docs/rounds/band-plates-round.md`.

> ↻ **AND IT IS ITSELF PARTLY SUPERSEDED by `docs/rounds/tb-atlas-round.md`
> (2026-08-11).** Every RULE here still stands; three values moved.
> ⛔ **`--slate-950` is gone** — merged into slate-900 at `#1f2635` (⚓ Nate read
> the old 900 as desaturated; it was the one rung breaking the ramp's C/L
> trend). `--glass-well` and the export mirror's `CHART_BG` followed it.
> ⛔ **`--glass-blur` is retired** — struck rather than zeroed, because
> `backdrop-filter` at any value keeps the composited layer and the per-frame
> backdrop read-back. ✅ **Not one glass stop had to move**, which is this
> round's "measured unblurred" rule paying off exactly as designed — and glass
> no longer mints a containing block, so the portal constraint recorded here is
> retired too.
> ⚠ The **star figures** below are still the right METHOD; `--glass-well`'s is
> now 5.44:1 (the ground under it darkened).

---

## 🧪 `/lab` — THE SPECIMEN BOARD, and the reason the round moved fast

A dev-only route **inside `(scene)`, listed in `TOOL_PATHS`**, so it renders at
the real crest under the real wash with the real GL world behind it. Every
ground at real size, same content in each.

**Why it is not part of `/styleguide`, and don't merge them:** the two have
opposite virtues. Reference wants completeness and must never drift; judging
wants one screenful at true scale **on the real ground**. `/styleguide`
deliberately renders on the bare root layout — right for a swatch, useless for
"what does glass look like over a star".

⚓ Nate: "/lab was such a fast way to do it — it definitely has earned its keep."

**Two idioms it established, both reusable:**

- **States are rendered side by side and FORCED.** You cannot judge a hover by
  hovering — you never see rest and hover at once.
- **Candidates are drawn locally and labelled `proposal`; shipped patterns use
  their REAL global classes.** A board that paints its own copy of a button is
  showing you a button that does not exist.

⚠ `/lab` is EXEMPT from the L0 primitive law (alongside `/styleguide`) and
EXCLUDED from mechanical sweeps — its ladder is pinned by hand so it SHOWS the
scale rather than riding it. A board that rode the scale would always agree with
itself and could never reveal a missing rung.

`/styleguide` § **Palette census** is the companion: for every rung, computed
from `app.css`, WHO IS ALREADY SPEAKING FOR IT (`is` / `mix` / `rule` / `free`).

---

## 🐛 THE BUG THIS ROUND FOUND — read before quoting any contrast figure

**Every star figure written before 2026-08-10 was ~0.3–0.4 OPTIMISTIC.** They
modelled the worst pixel as `white × (1 − TOOL_DIM)` — the answer you get only
if the wash is pure black. `--scene-dim` is a near-black _colour_ laid over the
scene, so the true composite is `dim·wash + (1 − dim)·white`, which is lighter,
which means LESS contrast.

What it was hiding: a glass panel stop shipped earlier that day at **4.22:1, under
the floor**, published as 4.53. And the "floor of .60" recorded on `TOOL_DIM`
was 3.77:1 — never legal.

**The general lesson: an alpha over an unknown ground is only as good as the
model of the ground.** The census now composites the scrim properly and carries
the note on `STAR`.

---

## THE DECISIONS

### Grounds — three, plus a material

`ctx-night` (the world) · `.ctx-dark` (slate) · `.ctx-light` (parchment), with
`.ctx-glass` a MATERIAL worn over night, not a fourth palette.

- **Night has no rungs.** One ground; if you need a second tier you have left
  the context. Its lines must carry ALPHA (unknown ground, same as glass).
  ⛔ **`--muted` is illegal on the open scene** (4.16:1 even after the deeper
  wash). Night gets `--text` and nothing quieter; a second voice out there would
  have to be BRIGHTER.
- **Three things may paint on night**, all very transparent (⚓ Nate): a dark
  ribbon, a red ribbon (STATE — blocked/unavailable, never decoration), a
  gradient fade. The rule that keeps "no rungs" intact: **they condition the
  world, they do not become grounds** — none carries an ink ladder of its own.

### The two parchments — ⚠ the axis is SIZE, not depth

⚓ Nate sampled Genshin: `#F2F1EC` large panels, `#E8E5DD` character cards.
Nearest rungs `parchment-50` / `parchment-100`, both Δ6, and **adjacent** (his
constraint — the pair is a half-step, not a jump).

- `--surface-broad` = parchment-50 — large panel, heading ribbon, parchment
  carrying parchment
- `--surface` = parchment-100 — card, button, a layer ON a broad panel

⚠ **The thing on the paper is DARKER than the paper.** This REVERSES the
2026-08-09 note that "Genshin's cream cards are the lighter thing on parchment"
— that was reasoning by symmetry from the dark ladder. **Sampled beats
symmetrical.**
⚠ **`ctx-light` has no raised rung** — paper doesn't express depth by lightness.
⚠ **A TOKEN, not a context modifier:** a `.ctx-light--broad` class would
re-point `--surface` for the whole subtree, so a card ON a broad panel would
inherit the panel's rung — the exact case the rule exists to distinguish.

### The pane-state ladder

```
rest      --surface        .58   translucent
hover     --surface-hover  .80   + an INK ring   — "here"
selected  --surface-hover  .80   + a GOLD ring   — "chosen"
```

**Density separates resting from engaged; HUE separates the two engaged states.**
(A version with selected at full opacity shipped for an hour and was corrected:
three densities made the eye measure solidity to know what it was looking at.)

⚠ **Only glass may take an edge border, and only on hover/selected.** An edge
says where a surface ENDS; on an opaque panel the ground already says it (which
is why edge borders retired). Glass is the one material whose extent is not
self-evident — at ~10% transmission the step against the sky is small and varies
across the pane's own width. `inset box-shadow`, never a real border.

**"A ring is a fill that had to shout."** Two legitimate reasons: an identity too
small to read as a fill (the resonance chips), or an extent that isn't
self-evident (glass).

### Borders vs the inset

**Borders stay INK. The inset frame went GOLD** — it is the one line in the
system that is ORNAMENT (inside the box, set in from the edge) rather than
structure, and structure in a warm hue reads as decoration on everything.
`--inset-line` / `--inset-line-quiet`, zoned like the accent: **gold-400 dark,
gold-700 light** (measured: gold-600/700 barely lift off slate, gold-300/400
vanish into parchment). On glass and at `:root` the stop carries alpha.
**Two weights: 1.5px default (controls), 2px large panels** (the bench carries
its own `RIBBON_FRAME_BORDER = 2` — if one moves, move the other).
⚠ Line ROLES dropped to the two most transparent stops; `--line-strong` /
`--line-edge` are declared but unclaimed.

### Gold in text

**GOLD NAMES A BLOCK; IT NEVER EMPHASISES A WORD.** Consistent across five
Genshin screens: section labels gold, titles NOT (white on dark, dark ink on
light), inline emphasis a hotter orange or the element's own hue.
⚠ **Gold sits BELOW the title in the hierarchy** — the counterintuitive half,
and why it is a rule rather than a feel. Title is loudest by SIZE; gold marks
the thing that NAMES a region.
Shipped: **`.kicker` and its trailing rule are gold.** ⚓ "Let's start with that,
and see what other gold accents develop from there."
⏸ **OPEN — inline emphasis.** Ours is gold today; one hue on two jobs is the
drift the census exists to catch. ⚓ Parked for the **`--el-*` round, right
before the planner restyle**; borrowing the element's own hue is the leading
candidate and is what Genshin does.

### The type size-up

**Every role climbed one rung; the RUNGS DID NOT MOVE.** 208 declarations across
40 files re-pointed, rather than the scale re-cut — those px values are quoted in
dozens of comments and in the export mirror.
Two ends pinned: **4xl · 24 is the section heading AND the brand**
(`--brand-size`), and **5xl · 32 held** (instrument readouts; page titles moved
up INTO it).
⚠ `BAND_A_H` had to be RE-MEASURED (27 → 29): controls went 11 → 12px and the
tab began overflowing a row that by design has no slack.

### Values that moved

`TOOL_DIM` .65 → **.75** · `--scene-dim` #15161a → **#101013** · glass
.68/.55 → **.58/.45** (+ `--glass-hover` .80) · `--sel-surface` gold-300 →
**parchment-100** (the same paper a character card is made of) · chrome glyphs
28 → **30px** (34px button — the cog's 42:40 box is 31.5px wide at 30 tall).

---

## ⏸ Open, carried forward

- **Inline emphasis colour** — with the `--el-*` round.
- **`--el-*` review** — ⚓ Nate: do it "just prior to transferring this styling
  over to the Rotation Planner". Element pips on a parchment half are the known
  risk; the icons are a BUILD ARTIFACT of the tokens (never hand-recolour).
- **The split Atlas card** — approved in principle; ⚓ Nate is mocking up the
  design. Identity on the dark half, content on the light half. ⚠ The role
  glyph is near-black art drawn for dark slate — it must be CLIPPED to the dark
  half or it inverts.
- **`.title`** (the workhorse panel header, 3 callers) landed on 3xl/20 by the
  uniform shift. If panel headers should meet section headings at 24, it is a
  one-line change — raised, not assumed.
- **Lowering the glass alpha further** if glass stops reading as glass:
  transmission is 10.5% and sheer is 5–7%.

## The measurement that started it

Genshin's UI vs ours, % of pixels above L.35: **theirs 10–14%, our Atlas 1.1%,
our populated planner 0.3%, our TB Roster 20.8%.** Our GROUNDS are already
lighter than theirs; our brights are rarer. **We are not too dark, we are too
NARROW** — and the fix is not lifting the ramp (there is no headroom) but
spending LIGHT: on a dark world light is for banners, buttons and cards, a
binary rather than a rung.
