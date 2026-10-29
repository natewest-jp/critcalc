# Archetype consistency pass — ✅ MERGED TO MAIN `4b0b865` + PUSHED 2026-08-06, live on the noindexed site

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

Follows `docs/rounds/dire-retirement-round.md`, which landed the two contexts but left every
consumer half-converted. This pass was **cleanup, not redesign** (Nate's brief:
"clean things up so it can get me in the mindset of the design"). No question
was put to him; every call is recorded below with its measurement so he can
overrule any of them by editing one value.

## The evaluation of Nate's Genshin-pulled values

Measured (sRGB contrast + OKLCH) — the verdict is that the ANCHORS are good and
the failures were all in rungs nobody had measured:

- **`#e5d9c3` on `#242c40` = 9.97:1.** The hinge works. `--ink #0d0d0f` on
  `--sel-surface #e5d9c3` = 13.91:1. Both excellent.
- **`--control-face` was Genshin's own sample all along.** The 2026-08-01 note
  records their button face landing on our hue constant "unprompted" (#586071,
  L.488 C.029 H265); the whisper re-anchor then moved it to H285 (#5e5e70) to
  match a family that has since been retired. The archetype sits at H267 — i.e.
  back where Genshin's slate was — so it was reverted to the literal sample.
- **`#857971` fails as a TEXT color on both sides.** 3.29:1 as the dark
  context's `--muted`, 3.76:1 (3.36 on the raised rung) as the light context's
  `--text`. It is Genshin's _secondary/disabled_ voice on light panels, not
  their prose. It keeps its structural job (`--border`) in the dark context.
- **The light context's inversion is real but was overloaded.** Nate's "labels
  anchor, prose recedes" made `--muted` DARKER than `--text` — correct for
  section labels, but `--muted` is also the resting-control voice, so every
  selected chip came out lighter than the unselected ones beside it.
- **`--debuff` C.154 is the loudest thing in the system** against structure at
  C.038. Legal (identity chroma belongs to content) but still interim.

## What changed (all with ↻ 2026-08-05 comments at the call site)

1. **The orphan third palette retired.** `:root` still carried the
   pre-archetype navy family (`#2f2f3b`/`#ede8de`/`#3a3a4a`/`#23232d` H285 +
   blue-white text) — so EVERY modal and overlay, which never got a `.ctx-*`
   class, painted a palette belonging to no context. Root's four surface roles
   now point at `.ctx-dark`'s values as an explicit **safety net**; root text
   went neutral (C.004) at the same lightness. Three palettes → two.
2. **`.ctx-dark --surface-raised` #212121 → `#2e364b`.** It was a pure NEUTRAL
   near-black (C.000, 177° off its own ground, ΔL.047) left behind when Nate
   re-cut the surface to navy. Re-cut on the surface's axis one rung ABOVE it,
   which also **restores the planner's well idiom** — it had inverted, the
   "deeper" well being the lighter of the two.
3. **`.ctx-dark --muted` → `#a2968a`** = `mix(--text 30%, #857971)`, a blend of
   the two hinges (4.81:1). **`.ctx-light --text` → `#765f4d`**, already in the
   palette as `--ribbon-ink` (5.32:1) — the double-duty pattern kept, re-pointed
   at a value that can carry it. Nate's inversion survives intact.
4. **`--ink-active` (new).** The promoted control ink, per context: `--text` on
   dark, `--ink` on light. Chips/tabs/buttons promote to THIS, not `--text`.
   **`--control-ink` (new)** = `#e5d9c3`, ink on the ground-agnostic
   `--control-face` (was `--text`, which put 1.06:1 brown-on-slate on every
   `.btn--primary` in the light context).
5. **`--chart-*` (new, 4 rungs).** Promotes the planner's private
   `--rp-grid`/`--rp-line` idiom to the shared layer. **~95
   `rgba(255,255,255,α)` literals converted** across the 8 instruments + 12 tool
   surfaces + the CodeMirror composer theme. RotationTimeline's whites were
   deliberately LEFT — they are ink ON element bars, where white is right.
6. **⚠ THE BUG WORTH REMEMBERING — `SlotPortrait` declared `ctx-light` and
   painted no ground.** A context class re-points every role token including
   `--text`, so the light context's warm brown rendered onto the bench ribbon's
   navy at **2.33:1** (worst in the app) while `--frame-bg` resolved to paper
   and blew the inset pills + avatar disc to near-white — the three brightest
   objects in the planner were the ⇄/loadout/✕ chips. It is used ONLY inside the
   always-dark ribbon, so the class was removed. `timelineExport`'s
   `PORTRAIT_BG` followed (#f2f2ec → #242c40) + the mirror test.
7. **Artifact piece glyphs** are white line-art .webp on the LIGHT panel — they
   were invisible. Given `--control-face` (the one deliberately ground-agnostic
   surface). Same fix pattern applies to any other white-art asset on paper.
8. **`probe-lightness-round`'s `SEL_SURFACE`** was a stale literal (`#ede8de`,
   the retired gilt-soft) — 3 checks failing for a value correct for one day.
   Reads the token now.

## The styleguide, re-cut

`/styleguide` now leads with **the two contexts side by side, LIVE** (a new
`parseContextTokens()` reads the `.ctx-*` blocks the same way the mirror test
does — reading `:root` would show the net, not what components resolve). The
debuff/calm swatches became "the content registers — what a context does NOT
own". Gilt's retired card, the 27-row migration table, and its dead `--gilt`
CSS references are gone (the "what deliberately did NOT migrate" list survives —
still load-bearing). Four **new laws** in § Laws, each paid for by a bug in this
pass: _a context class comes with its ground_ · _re-declaring `--accent` is
never enough_ (the substituted-at-declaration law) · _the promoted control ink
is per-context_ · _white is not a member of either context_.

## Gates (re-run on the committed state before the merge)

`npx vitest run` 1312 ✓ · `npm run check` 0 errors · `npm run lint` clean ·
probes lightness-round / site-chrome / bench-band / viz-workspace /
team-builder / frame-rework / ascend-pan all pass. **probe-panels,
probe-overlays and probe-controls fail — verified PRE-EXISTING on a stashed
baseline** (stale selectors, e.g. `.rp-avatar-chip` vs `.sp-avatar-chip`).

## Still open (now the § Laws "Open" block on /styleguide too)

- **The accent story** — both contexts still borrow one of their own inks;
  the world borrows `--chrome`. Placeholder, not a decision.
- **`--debuff` destination color** — interim.
- **Element icons read pale on `.ctx-light`** — build artifact of `--el-*`,
  never hand-recolored, so they need their own answer (the artifact-glyph fix
  above is the precedent: give the chip a ground-agnostic face).
- **Meta overlays read the WORLD's voice**, inherited rather than chosen.
  Genshin's own menus are light; flipping them is one class.
- **The bench's coverage block is housed by neither** ribbon nor tool — a
  layout question. The `docs/rounds/bench-band-round.md`'s queued card-interior restyle to
  Nate's mockup is untouched by this pass, by design.

## Commits (4, on `chore/archetype-consistency`, merged `4b0b865`)

`57bbc0b` the root net + the context re-cuts + the three new token families ·
`37c999f` the ~95-literal sweep · `f84d1a7` the SlotPortrait context bug +
exporter mirror + the un-staled probe · `f8c8c17` the styleguide re-cut.

Related: `docs/rounds/dire-retirement-round.md` · `docs/rounds/style-reference.md` ·
`docs/rounds/bench-band-round.md` · `docs/rounds/lightness-structure-2026-08-01.md`
