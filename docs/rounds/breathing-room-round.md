# Breathing room → banner-and-bare (2026-08-08)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

✅ **MERGED to `main` 2026-08-09 as `e47d7dd`** (`--no-ff`, the project's merge
convention) — 14 commits `c87aaf9`…`14501d7`: the 11 design commits plus the
verification-policy/e2e-harness round that landed alongside them. ✅ **PUSHED** later the
same day, as part of the 25-commit backlog the Genshin Night round cleared. The branch is closed;
Nate's mockup work starts on a FRESH branch off `main`, because the next round
moves beyond breathing room. Gates verified on merged `main`: vitest 1326,
svelte-check 0, lint clean, e2e 68×2. See memory `feedback_verification_policy`.
⏭️ **RESOLVED: that next round happened** — it was the palette work, not a mockup. See
`docs/rounds/genshin-night-palette.md` (merged `0d1bcf3`), which supersedes several of the numbers
below: **`TOOL_DIM` is .65 now, not .85**, and the tools' furniture is translucent
(`.ctx-glass`). ⚠️ The DIRECTION below still stands and is still the authority — banner-and-bare,
opaque-or-obviously-translucent, bare-on-the-scene as the default for CONTENT. Glass is for
FURNITURE only and did not put content back in boxes.

The round started as "the RP and TB feel claustrophobic" and ended up rewriting the design
grammar. Read the direction first; the mechanics after.

---

## ⚠️ THE DIRECTION (this is the part that matters)

Genshin's own screens, read closely: **structure comes from narrow BANNERS that name content,
not from boxes that contain it.** A panel wraps content in a ground; a banner labels content that
has none. On the reference screens the banner is often the only surface present.

↻ **AMENDED 2026-08-10** (`docs/rounds/band-plates-round.md`): the banner's JOB survives, but its FORM
has a rival. Team Covers dropped its filled strip for a **large Bitter header set directly on the
scene** — same job (name a bare run), no surface at all — and it is the reason main headings went
back to Bitter. ⚠️ **`.banner` / `.banner-end` now have NO consumer.** They are left in app.css
deliberately: ⚓ Nate anchored the idiom as ON TRIAL and retiring it is a design call, not cleanup.
**Decide between the two forms before writing a third naming idiom.**

Six rules, each paid for in this round:

1. **Opaque, or OBVIOUSLY translucent. The middle is not a place.** A ground that is slightly
   see-through just reads as a duller colour. (This killed the sheer experiment — see below.)
2. **Default is BARE on the dimmed scene.** Reach for an opaque panel only when something needs
   one. Removing a box beat every other move in the round.
3. **On a dark world, LIGHT is for narrow banners, buttons and cards — never for fields.** A
   full-width light panel is the strongest possible frame edge. Light marks _the thing you act
   on_ or _the thing that names a section_. Character cards stay light (Genshin's are).
4. **A banner spans its column, or it isn't a banner.** A label bar starting a third of the way
   in with dead scene beside it is just a box.
5. **On the scene, prose takes the BRIGHT ink.** `--muted` is a PANEL affordance — it means
   "secondary within this flat surface", and open ground has neither the flatness nor the
   hierarchy. Measured: `--muted` 4.70:1 vs `--text` 9.72:1 on the same run.
6. **`--frame-bg` is the REFERENCE ground even where nothing paints it.** Canvas fills, the PNG
   export and every `color-mix` still need a real colour to mix against.

**⚠ A CONTEXT FLIP INVERTS THE INK LADDER.** `.ctx-light` has `--text` recessive and `--muted`
anchoring; `.ctx-dark` is the other way up. Any state pairing built on one _silently reverses_ on
the other. It hit the coverage chips (covered shouted, clickable gaps sank) and it will hit
anything else moved between contexts. Check every `--text`/`--muted` pairing when a surface flips.

## ⛔ SHEER IS RETIRED — do not re-propose it

A translucent frame ground (`--sheer-*`, `fb2489d`) was built, measured, shipped and **reverted
in `aa67752`**. Why it failed: at the alpha that survived the uniformity check, the scene
contributed **2–3% of the light** behind a panel. Dark panels got slightly darker, paper got
slightly greyer, nothing gained depth.

⚠️ **The probe was rigorous about the wrong question.** It asked whether the ground was uniform,
legible and separable — all yes — and never whether anyone _perceived_ it as translucent. Watch
for this shape of error generally.

**Two things survived the retirement**, re-landed on their own footing:

- **`TOOL_DIM` 0.75 → 0.85**, because its JOB changed: it used to recede a backdrop the panels
  hid; it is the PAGE GROUND now, the surface content sits on directly. ⚠ Uniform for now —
  Genshin vignettes hard (darkest exactly where the text is), and **shaping the scrim is the open
  question, not a higher number**.
- The probe, re-aimed (below).

## What shipped structurally

- **`TOOL_GUTTER`** (`src/lib/toolGutter.ts`) = **16**. `BAND_STACK_GAP`, `COLUMN_GAP` and
  `RIBBON_GAP` all derive from it. ⚠ **Below ~12px a gap is a SEAM, not a channel** — it adds a
  line instead of air. Both benched tools ran at 8; the Visualizers always ran at 20.
- **The Team Builder came out of its box** (`e1323a9`) — `.tb-frame` DELETED, not restyled.
  Content on the dimmed scene, cards light, `.banner` naming each run. This is the pilot the
  whole direction rests on.
- **`.banner`** in app.css (ON TRIAL): narrow, opaque, `--surface`, `--fs-lg`. Opaque _because_
  our scene is near-uniform near-black — Genshin's read translucent because theirs sit over
  varied art.
- Planner composer split into its own panel; filter-rail groups became individual objects; the
  Atlas stops filling; the TB coverage chips promoted 9px → 11px.

**Measured, same method throughout** (interior bare scene inside a tool's own bounding box;
⚠ measure the Visualizers as a CONTROL — if it moves, the measurement is wrong):
RP 2.1 → 5.5% · TB Atlas 6.7 → 29.4% · Viz 11.5 → 12.0% ✓

## `scripts/probe-ground-contrast.mjs` — and its FOUR sampling traps

The only probe here that reads **composited pixels**, so the only one that can follow content off
a panel onto the world. Two invariants per text run: **CONTRAST** (worst-PIXEL, ≥4.5:1/3:1) and
**UNIFORMITY** — which is a **GATE on a panel** (a manufactured surface should be flat) and a
**READING on the scene** (terrain has stars; every scene run measures ΔL .10–.15, and gating that
fails forever).

⚠️ **All four traps produced confident, plausible, WRONG numbers.** The pattern is always _the
thing I measured wasn't the thing I meant_:

1. Hiding `panel > *` to expose "the ground" also hides **nested opaque surfaces** — tick labels
   got compared against the frame two rungs behind what they sit on (a phantom 4.16:1).
2. `color: transparent` on a container doesn't reach **CodeMirror's own token spans** — measured
   ink against itself at 1.00:1.
3. A text box often sits flush inside a **bordered ancestor** (`.cm-content` is 1px inside
   `.cm-editor`'s border), so outer pixels read the border's antialiasing as ground — ΔL 0.154
   for a perfectly flat well. Sample insets 3px now.
4. **Controls TRANSITION `color`**, so the hide rule doesn't apply instantly — screenshot
   mid-flight and the glyphs are still painted at `rgba(…,0.98)`. Gave a tab a "worst ground" of
   its own baseline: 1.27:1 for a run that measures 12.78:1. The hide rule kills
   `transition`/`animation` now.

## Open / next

- ⏭️ **Nate's mockup**, then the planner (last, because the timeline is the one place a box is
  genuinely load-bearing — gridlines, a coordinate system, bar fills needing a known ground).
- **The toolbar-translucency trial is REVERTED, pending the mockup.** Two findings survive: a
  **near-black scrim** reads as translucent where navy-on-navy does not; and **band B being paper
  is the constraint** — translucent paper over near-black is the muddy middle by another route,
  so any translucent stack needs band B to stop being light. ⚠ Whether a dark band B has a
  contrast problem is **UNKNOWN** — the 1.69:1 I first reported was trap #4, not a real finding.
- **`.rp-lane-name` at 3.38:1** — a real pre-existing shortfall, in the probe's `KNOWN_SHORTFALL`
  with its measurement. Deliberately not fixed inside a layout round.
- ⚠️ **`probe-lightness-round` fails 5 checks on `main`** and is NOT fixed — stale composer-button
  and active-tab selectors from the toolbar round. `probe-planner-empty` and `probe-png-dl` were
  the same and ARE repaired here. **Probes aren't in `package.json` and nothing runs them on a
  schedule, so they rot silently — check a probe RUNS before trusting a green.**
- **TB card sizing/gaps deferred** by Nate — the cards grew when the frame's padding went.
- ⚠️ `benchBand.svelte.ts` is a **runes module**; Node dies on `$state`, so **no probe can import
  anything from it**, transitively. That is why `RIBBON_GAP` moved to `toolGutter.ts`. Geometry
  constants belong in plain `.ts`, imported **with the `.ts` extension** (Node does no extension
  inference; Vite resolves bare specifiers happily, so only the probe breaks).

Related: `docs/rounds/aside-column-round.md` · `docs/rounds/toolbar-round-2026-08-07.md` · `docs/rounds/bench-band-round.md`
· `docs/rounds/archetype-consistency-pass.md` · `docs/design/subpixel-rendering-laws.md`
· `docs/rounds/style-reference.md` · memory `project_design_constitution`
