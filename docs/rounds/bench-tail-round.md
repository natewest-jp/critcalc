# The BENCH TAIL round — ✅ SHIPPED, merged `07933ca` (⚠ cite the MERGE)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

✅ **Real Safari CLEARED** (⚓ Nate 2026-08-12: _"it's rendering beautifully on
both Chrome and Safari"_) — including the generated `clip-path` and the SVG
frame, which were the constructs with no precedent in this repo.

Gates green: vitest 1329 · check 0 · lint · build · `test:e2e` **68+68**.

⚓ **Nate:** _"I think it's time to drop the tail of the bench. It animates to
extend down to different heights with no content at all. Its only purpose has
been to try to line up with edges of tools — but I think we need to adopt the
kind of tail Genshin uses: the tapered point."_

## ⚠⚠ THE SHAPE IS THE SMALL HALF — a POINT has nothing to line up

That one sentence is the round. The ribbon used to be
`max(measured dock height, content)`, padding itself out below the last card
with empty strip so its bottom edge met the tool frame's. **A point terminates
rather than negotiates**, so everything that existed to do that negotiating
went with it:

- the dock **height measurement** (`benchHeight`, `snapBench`'s `a.h`)
- four props: `height` · `traveling` · `travelMs` · `travelEase`
- `RIBBON_RESTING_H`'s `max()` (the constant survives as a reference)
- **every height transition** (`--bb-height-transition`, on `.bb` and `.bb-slot`)

Box is now `RIBBON_CHROME + RIBBON_HEAD + Σ slot heights + RIBBON_TAIL_H`.
`RIBBON_OVERHANG_Y` governs the **TOP only** now.

### Why the animation could not have stayed even if wanted

Two reasons, and the second is the structural one:

1. It was gated on `traveling`, so it **only ever played during the 2s camera
   crane while both tool surfaces were cross-fading over it** — it animated
   exclusively where it could not be seen.
2. The tail is pinned below the last card, so a box that eased while the cards
   snapped (or the reverse) would **drag the point around behind them**. Both
   or neither; ⚓ Nate chose neither.

### ⚠ CONTENT-SIZED IS NOT RESPONSIVE — the distinction is load-bearing

⚓ Nate asked whether the height could just be fixed. Nearly: `BENCH_SLOT_H` is
a **FLOOR** (`CARD_PORTRAIT 60 + CARD_PAD_Y 18 = 78`) that every typical
rotation already sits at, because the timeline asks for less than a card needs.
So it _is_ fixed in practice.

⛔ **But do not freeze it.** In the extreme many-bars case the slots grow, and
they must: **each card is exactly as tall as the timeline track group it
labels** — that coupling is what makes the bench read as that group's label.
A frozen box clips the bottom cards and breaks the alignment.

## THE TECHNIQUE — two generated shapes, no seam anywhere

Artwork is ⚓ Nate's: `assets-src/tools/bench-clip-path.svg` (silhouette) +
`bench-inset-point.svg` (frame ring), drawn at **2×**, transcribed at ÷2 into
`benchBand.svelte.ts`. ⛔ **Do not re-tune the numbers by eye** — redraw the
assets and re-transcribe, the same rule `--el-*` carries.

- **Ground** → `clip-path: path()`, generated per height (`ribbonClipPath`).
- **Frame** → ONE inline SVG, TWO paths (`ribbonFramePath(h, r)`), still
  differing only in corner radius so the wide arc crosses the tight one exactly
  as the two CSS boxes did. Drawn as a filled **ring** (evenodd), not a stroked
  centreline — SVG strokes straddle their path, so a stroked version would need
  every coordinate shifted by half a width. The artwork gives both edges.

### 🔑 Why a "cap" for just the tail was rejected

⚓ Nate's first instinct, and his mitigation was right in principle (_"make sure
it reaches the fully straight part before the seam"_ — vertical meeting vertical
is the benign case, and his 23px straight lead-in was drawn for it). Rejected
anyway because of what is actually at that seam: **the frame is TWO strokes**,
so a cap meets **four** of them, across **two rasterisers this repo has already
measured disagreeing** — Chrome floors `border-width` to whole CSS px, WebKit
does not (`docs/rounds/bench-card-round.md`). One renderer has no seam to align.

### ⛔ Two things that look simpler and are WRONG

- **Clipping the old CSS-bordered spans.** A clipped border **stops at the cut
  instead of following it**. That asymmetry is the whole reason `clip-path` is
  right for the GROUND (which carries no stroke of its own — a lucky fact here)
  and useless for a LINE.
- **`clipPathUnits="objectBoundingBox"`.** Normalises to 0–1 and would STRETCH
  the taper with the box, flattening the point on a tall rotation. `path()`
  takes USER UNITS — no percentages, no `calc()` — which is why it is generated
  per height rather than written once in CSS.

⚠ A non-`none` `clip-path` **makes the element a containing block for fixed
descendants**. Harmless here only because SlotPortrait's popovers portal to
`<body>`; it would bite anything relying on fixed positioning inside `.bb`.

## 🔬 Verifying artwork against knobs — worth repeating

Measured BEFORE writing any code, and it is the check that would have caught a
bad asset: 448/2 = `RIBBON_W`, 428/2 = `RIBBON_W − 2·RIBBON_EDGE`, 4/2 =
`RIBBON_FRAME_BORDER`, and — **the easy thing to get wrong** — the
**perpendicular** gap at the TIP = exactly `RIBBON_EDGE`.

⚠ **A naive "put the inner tip 5px higher" CONVERGES.** At this edge's 20.96°
the tip must lift ~14px _along the axis_ to stay 5px away perpendicular. Nate
drew a true parallel offset. Check the perpendicular distance, never the
vertical one, whenever a line follows a taper.

Also confirmed: `--frame-line-quiet` is `#414752`, **opaque** (pre-composited),
which is what makes two overlapping ring fills safe. ⚠ If it ever becomes
translucent, the two paths would double its density along every straight run —
the alpha-stacking law.

Related: `docs/rounds/bench-card-round.md` · `docs/rounds/tall-bench-round.md` ·
`docs/rounds/bench-band-round.md` · `docs/rounds/motion-round-handoff.md` ·
`docs/design/subpixel-rendering-laws.md`
