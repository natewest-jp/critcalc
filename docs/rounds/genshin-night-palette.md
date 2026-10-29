# Genshin Night — the palette gets a primitive layer (2026-08-09)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

✅ **MERGED to `main` 2026-08-09 as `0d1bcf3`** (`--no-ff`) — 8 commits
`ff72d3c`…`1744dbe`, including Nate's two feedback rounds. ✅ **PUSHED** the same day
(`4b2a4bf..0d1bcf3`), clearing a 25-commit backlog that had been accumulating since
before this branch — Nate: "a big enough milestone that, even though the design overhaul
isn't done yet, it's worth backing up online." **So the mid-overhaul design is LIVE on
the noindexed site.** Gates re-run on merged `main`: vitest 1329 · svelte-check 0 · lint
clean · build clean · e2e 68 WebKit + 68 Chrome.
✅ **SAFARI VERIFIED BY NATE** — "we're green… Safari's displaying well." Glass,
`backdrop-filter` and the split bands all checked. Full gates green at merge: vitest
1329, svelte-check 0, lint clean, build clean, e2e 68 WebKit + 68 Chrome.
⏭️ **Further design work starts in a FRESH session on a NEW branch off `main`** (Nate's
call — keep style-shape work separate from this palette definition/cleanup).
➡️ **That branch happened: `docs/rounds/band-plates-round.md` (`e692de3`), which is where
"Nate has a purpose for the two bands he'll share later" gets answered.** Read it
alongside this one — several notes below are amended there (the bands' grounds, the
glass-stop count, the beige selection pilot's home, and the heading face).

Source: **Fable reverse-engineered Genshin's UI palette from screenshots** →
`assets-src/genshin-night.css` (gitignored, Nate's local reference; app.css cites it by
path). Its finding is the whole round: **Genshin's shades are a small palette LAYERED
WITH TRANSPARENCY**, not hand-picked hexes.

---

## ⚠️ THE LAW THAT COST THE MOST — nested `color-mix` CRASHES WEBKIT

> A `color-mix` may take LITERALS and PRIMITIVE ALIASES as inputs.
> **A `color-mix` result may NEVER feed another `color-mix`.**

Not "renders wrong" — **`page crashed`, renderer gone, 12 e2e failures across six
specs.** Trigger is nesting × ELEMENT COUNT: one nested mix at `:root` survives; the
same construct inherited by a timeline's thousands of nodes does not.

**Why it was easy to walk into:** the pre-round system never nested _by accident_.
`--border` was a literal, so `--frame-line` / `--rp-grid` / `--chart-*` mixing it were
all exactly ONE level. **Deriving `--border` silently pushed every downstream consumer to
two.** Same for `--muted` → `--chart-dim`.

**The fix:** the five derived values (4 line stops + `--muted`) ship as **resolved
literals per context**, and the derivation moved to TEST TIME —
`timelineExport.mirror.test.ts` recomputes each from its recipe. That is _stronger_ than
a runtime mix: a runtime derivation can silently re-resolve to something nobody looked
at. A second test greps the law itself (following alias chains), self-tested against a
seeded violation.

⚠️ **Bisect method that worked**: `git worktree add <scratch> main`, symlink
`node_modules`, run the one spec per candidate commit. Baseline main 18/18 vs `ff72d3c`
15/18 located it in two runs. Same shape as `docs/rounds/transition-hardening-queue.md`'s
meta-lesson: the reasoning said "colour arithmetic can't crash anything". Trust the engine.

---

## The architecture — four layers, one navigable law

> **A NUMBER means a PRIMITIVE and no component may name one. No number means a ROLE,
> and a role is the only thing a component may name.**

Enforced by `timelineExport.mirror.test.ts`, which greps the whole tree (app.css and
`styleguide` exempt — they define/render the ramps).

- **L0 primitives** — `--slate-300…950` `--parchment-50…300` `--gold-300…700`
  `--ink-500…950` `--night-975/950` `--red-500/400`; `--el-*` / `--rx-*` unchanged
- **L1 compositing** — `--glass-*` (translucent); line stops resolve opaque per context
- **L2 roles** — names **UNCHANGED**, so ~1660 consumer refs never moved
- **L3 contexts** — `.ctx-dark` · `.ctx-light` · **`.ctx-glass`** (new)

**This is why the migration was cheap: it was a VALUE change, not a refactor.**

---

## Decisions ⚓ NATE made, and what closed

- ✅ **THE ACCENT IS GOLD** — closed the longest-open item. ⚠ **One hue at TWO RUNGS:**
  `gold-400` measures **1.48:1 on parchment**, so `.ctx-light` takes **`--gold-700`**
  (ours; Fable's ramp stops at 600 and 600 is 3.31:1). **Branding + top-level chrome stay
  `--chrome` white** — `.site-chrome` re-declares accent _and its 4 derived tokens_
  (it sits inside `.tool-shell` on tool routes). Gold is ΔH 0.5° from geo — fine,
  chroma separates them; **don't rotate off geo, that rotates off parchment.**
- ✅ **`.ctx-light` ink = the NAVY RAMP** (`--text` ink-700 / `--muted` ink-900). Nate's
  "labels anchor, prose recedes" **survived** — the rule was never about hue, only which
  rung. Warm brown `#765f4d` is GONE. Both rungs measure better (6.18/8.00 vs 5.32/6.9).
- ✅ **`--debuff` NO LONGER INTERIM, value unchanged.** Fable landed ~ΔE 3 away
  independently; measured, Nate's sits _further_ off pyro (ΔH 4.6° vs 2.1°). Now `--red-500`.
- ⛔ **REJECTED `--ui-value`** (Genshin's numeric blue `#7CCFF0`): **WE HAVE NO FREE
  BLUE.** It is ΔH 6.8°/ΔC .019 from cryo — it _is_ cryo; `--calm` is ΔH 2.2° from hydro.
- ⛔ `--ui-keyword` held (real semantic, no consumer). ⛔ Smoke family held.
- **`--ink` → `--bright-ink`** (Nate: it "confuses with the other ink values").
- **`--surface-well` is NEW** — the role the planner had been faking with `--rp-chart-bg`,
  which is exactly why the well idiom silently inverted in 2026-08-05.
- `--control-face` `#586071` → `--slate-500`; `--sel-surface` → `--gold-300`;
  `.ctx-light --surface-raised` now **LIFTS** (was darker than its own surface).

---

## The scrim ↔ glass coupling (the other real finding)

**The wash's job is suppressing STARS, not darkening sky.** Sky average is fine at any
alpha (15.4:1 at .85 → 13.2:1 at .35); a **star** behind the same text goes **11.6:1 →
2.4:1**. Worst-pixel is the cost, so a uniform drop breaks bare prose unpredictably.

**Glass and the wash MULTIPLY**: scene light through a .70 ribbon is `(1−.70)(1−dim)` —
**4.5% at dim .85** (= the 2–3% that killed `sheer`), 15% at .50. Genshin's alphas assume
the panel IS the dimming with no scrim under it.

They stop competing because they're in different PLACES: **bare content = centre column,
glass furniture = rim.** So `TOOL_DIM` .85 → **.70 (centre, floor ~.60)** + **`SCRIM_EDGE`
.5** (rim .35), shaped with a **mask** so element opacity still rides the ascend clock.
`--scene-dim` warm `#0b0902` → neutral `#15161a` (⚓ Nate: "backdrop was getting too black").

**`.ctx-glass`** — a MATERIAL, not a palette: ink/accent/rungs come from `.ctx-dark`, only
GROUNDS and LINES differ. Worn by bands, bench ribbon, band menus. ⚓ Nate: **bare stays
the default for CONTENT.** Modals deliberately left opaque (they float over the _undimmed_
landing too). **NO backdrop blur** (⚓ Nate) — perf was fine (star freeze holds one frame)
but it buys little over a near-uniform backdrop and mints a stacking context.

Three rules it added:

- ⚠️ **PAINT `--surface`, MIX AGAINST `--frame-bg`.** They're identical in the opaque
  contexts and diverge here; the ribbon painted `--frame-bg` and would have stayed opaque.
- ⚠️ **THERE IS NO LIGHT GLASS** — band B had to stop being `ctx-light` (the surviving
  finding from the reverted toolbar-translucency trial).
- ⚠️ **Lines carry ALPHA on glass only** — the compositing law refines: mix opaque against
  a KNOWN ground; where the ground is unknown, carry alpha.

---

## ⚓ Nate's SECOND feedback round (`daeb98e`) — settled

- ⛔ **THE SHAPED SCRIM IS SCRAPPED.** Built twice (ellipse, then rounded box), driven by
  Nate, verdict: _"doesn't really buy us anything meaningful compared to a plain dim."_
  **Don't rebuild it.** ⚠️ The lesson: its premise — that glass and bare text want
  opposite things from ONE wash — was **false**. They're governed independently (glass
  text by the glass STOP, bare text by TOOL*DIM). \_Two constraints, two knobs.* I reached
  for geometry before checking the coupling was real.
- **TOOL_DIM .85 → .65.** ⚠️ **The floor is .60 and STARS set it, not sky.** Sky is fine
  anywhere (13.4:1 at .65); a star goes 5.33:1 at .65 → 4.56 at .60 → 3.97 at .55.
- **Glass thinner: .68 / .55** (was .85/.72). `--glass-ribbon` DELETED (bench went slate).
- ⛔ **`--glass-blur` RETIRED 2026-08-11** (`docs/rounds/tb-atlas-round.md`) — struck, not zeroed; the probation below ran its course and nothing depended on it. ⚠️ **NATE'S FINDING, which OUTLIVES the token because it decides any proposal to bring it back bigger:
  A BIGGER BLUR BANDS** — blurring a backdrop is how you _manufacture_ a smooth gradient,
  and a gradient over near-black in 8-bit sRGB is the textbook banding case; small radii
  escape it because the starfield + GL dither act as noise, and **noise is what breaks a
  band**. Same family as the hero-card gradient veto and why `--scene-dither` exists.
  ⚠️ **Its ROLE changed on the way down**: at 4–8px blur SOLVES the star problem (spreads
  the point, backdrop → local average) and would allow far thinner stops; **at 1–2px it
  is AESTHETIC** and the alphas carry legibility alone — chosen so they do, measured
  UNBLURRED: panel 4.92:1, well 5.37:1. **Nothing depends on it, deliberately.**
- **BANDS NO LONGER ABUT** — split by `BAND_GAP` (= TOOL_GUTTER). ⚠️ **This unblocks a
  screen-locked band A**: the old "bands must travel together" rule was structural (a
  seam between differently-locked tiers would tear) and **there is no seam now.** Nate
  has a purpose for the two bands he'll share later.
- ⚠️ `BandMenu`'s portal changed REASON: was the stack's clip, is now `backdrop-filter`
  minting a **containing block**. Anything escaping a band must portal.
- ↻ **SUPERSEDED 2026-08-10** (`docs/rounds/band-plates-round.md`): band A has no ground at
  all now and band B has one only when undivided; there is ONE glass stop across both
  rows (`--glass-well`'s band-B role retired), and `BAND_GAP` is HALF the gutter. The
  glass stops themselves (.68 / .55) and the blur are unchanged.

## ⚓ Nate's FIRST feedback round (`69a5344`) — settled, don't relitigate

- **THE INSET FAMILY IS `--plain` + `--double`, AND IT IS CLOSED.** corners/notched/
  capped DELETED. "If I feel the need for more I'll come up with a concept and propose
  it" — ⛔ **don't propose additions.** Strokes are **2px**.
- ⚠️ **`--double` IS OPAQUE-ONLY, NEVER ON GLASS.** Its two strokes CROSS, and glass
  lines carry alpha, so every crossing double-composites into a dark smudge. Correct CSS
  doing what it was asked — **only an eye catches it.**
- **THE BENCH IS OPAQUE SLATE** and Nate is most sure about this one. It was glass for a
  few hours and reverted. The aside/filter column was already `ctx-dark`.
- **THE SCRIM IS A SOFT ROUNDED BOX**, not an ellipse. CSS has no rounded-rect gradient
  — you get one by **INTERSECTING two 1-D falloffs**, since `intersect` MULTIPLIES mask
  alphas and the iso-contours of that product are rounded rects. Follows the viewport by
  construction. ⚠️ **Multiplying means an edge MIDPOINT gets SCRIM_EDGE but a CORNER gets
  SCRIM_EDGE².** Know this before tuning.

## Open — carry into the next round

- **Where the accent gets SPENT.** The colour is decided; the RATION is not. Every
  accent-derived ring, wash and link went gold _at once_, which is more gold than Genshin
  spends on a screen. This is the biggest live design question.
- ~~`--glass-blur` probation~~ — CLOSED 2026-08-11, retired (`docs/rounds/tb-atlas-round.md`).
- **Frozen stars through the glass** — texture or dirt? Not measurable, Nate's eyes.
- **Modals are still opaque** — they float over the _undimmed_ landing too, where glass
  would be near-transparent. They may want a material of their own.
- **`--r-xs` (1px) still on trial**, now with twice the evidence (both bands round their
  own four corners since the split).
- **Nate has a purpose for the two bands he'll share later** — the split landed early as
  its structural half.

⚠️ **Two styleguide-parser bugs this round created and fixed** — worth remembering as a
shape: a primitive layer breaks anything that assumed **one** alias hop. `parseRootTokens`
followed exactly one (fine while every role held a literal), and `parseContextTokens`
resolved **nothing at all** — invisible until the contexts started pointing at rungs, then
it blanked 33 swatches. Same class as the `color-mix` nesting crash: _deriving a value
silently changes what every consumer of it is doing._

Related: `docs/rounds/breathing-room-round.md` · `docs/rounds/archetype-consistency-pass.md` ·
`docs/rounds/style-reference.md` · memory `feedback_verification_policy` · `docs/rounds/scene-star-freeze.md`
