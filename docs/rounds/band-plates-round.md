# The bands become a run of plates (2026-08-09 → 08-10)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

✅ **MERGED to `main` 2026-08-10 as `e692de3`** (`--no-ff`, branch
`feat/band-a-glass-nav`, four commits `8ba216b` · `ea32b96` · `ee8014c` ·
`ebc8a97`) and ✅ **PUSHED** (`0d1bcf3..e692de3`). Branch cut off `0d1bcf3`, the
Genshin Night merge. Gates on merged `main`: vitest 1329 · svelte-check 0 · lint
clean · build clean · e2e **68 WebKit + 68 Chrome**.
⚠️ **NOT Safari-verified by eye** — Playwright WebKit catches thrown errors, not
rendering, and this round multiplied `backdrop-filter` surfaces (every band
control carries its own) and overflows a nav plate out of a blurred rail.

🐛 **A gate lesson that cost a bogus 19-failure run:** `npm run test:e2e`
**builds and serves its own preview out of `build/`**. Running `npm run build`
(or anything that rewrites `build/`) concurrently — e.g. "the fast gates" in
another shell while e2e runs in the background — rips the served tree out from
under the browsers, and the failures scatter across unrelated specs so they look
like a real cross-engine regression. **Never run another gate beside e2e.**

This is the round `docs/rounds/genshin-night-palette.md` left an IOU for: _"Nate has
a purpose for the two bands he'll share later."_ This is the purpose.

---

## The one-line summary

> **What is left of "a band" is a HEIGHT and a GAP.**

Both rows are runs of **glass PLATES standing on the scene**. Band A paints
nothing at all; band B paints only where a tool has not split it. All plates are
`BAND_CTRL_H` (36px) on **one** glass stop — band B's darker `--glass-well`
retired with the tier it was marking, because _two glass stops in one header
only read as one of them being dirty._

```
████ ██  ███                        ██ ███ ██ ▪    ← band A: no ground
                                                     BAND_GAP = 8 (½ gutter)
████ ███████████████████████████████████ ████      ← band B, 3-up split
```

---

## ⚠️ Traps this round paid for

- **A `backdrop-filter` on a box with no background still blurs its whole
  rectangle** — it would have drawn a ghost of the band we had just removed. The
  band keeps `.ctx-glass` (it is what re-points `--surface`/`--fill-rest`/the
  lines at the translucent stops, which the CONTROLS now need) and explicitly
  sets `backdrop-filter: none`. **Class stays, filter goes.**
- **Hover on glass must LAYER, not mix.** `--accent-hover-fill` / `--fill-hover`
  are already `color-mix`, so mixing them again is the WebKit renderer crash
  (`docs/rounds/genshin-night-palette.md`'s nesting law). A **one-stop
  `linear-gradient` is a background LAYER** — two panes composite at paint time
  with no colour arithmetic. This is the general answer for "wash over glass".
- **`.inset--plain`'s stroke IS an `::after`.** DocumentTabs' drag-drop
  indicator used `::before` (left) and `::after` (right); adding the inset
  silently collided. Both moved to `::before` — the states are mutually
  exclusive. The inset came back off the same day but the pseudo stays free.
- ⚠️ **Alpha stacks.** A glass control on a glass rail is 0.68 over 0.68 ≈ 0.90.
  So glass is for plates standing on the SCENE; a control still sitting on a
  rail (the planner's and the Visualizers' band B) keeps `--btn-face`.

## ⚓ Nate's decisions

- **BAND A LOSES ITS BAND.** Its horizontal padding went with its ground — that
  padding existed to hold controls off a rail's ends, and with no rail it was
  only the tabs failing to line up with the tool surface below.
- **BAND B SPLITS THREE WAYS** wherever a tool fills `bandBCenter`: control ·
  **rail** · control, split by `BAND_ITEM_GAP`. The ground moves off the band
  onto the centre zone. ⚠️ **The rail is NOT centred on the band** and cannot be
  while the flanks have their own widths (the con lens reads "C0" or "My
  roster"); what is centred is the navigation INSIDE the rail, which is the
  object the eye measures.
- **`BAND_GAP` = ½ TOOL_GUTTER (8px).** A full gutter read as two unrelated
  rows once both were loose plates. `BAND_STACK_GAP` stays full, so the header
  still separates from the content more than from itself.
- **`BAND_ITEM_GAP` = 4px**, unifying the tab strip's .35rem and the actions'
  .25rem — two values that meant the same thing and had drifted.
- **The selected DOCUMENT TAB selects by DENSITY, not brightness** — opaque
  `--frame-bg` (which in `.ctx-glass` **IS** slate-800, so it is _literally_ the
  bench ribbon's shade, not a match for it) among panes of glass. It briefly
  wore a `--plain` line; ⚓ Nate took it back off — "band A does not need a
  second decorated object" while the nav plate one row down has one.
- ⛔ **`.btn--danger` IS A GHOST ON PURPOSE** and that is why Clear team is a
  plain `.btn`: Nate asked for a solid `████`, and a ghost must not sit on
  screen looking pressable. Destructive reading moved to the **hover**.

## THE TYPE RULE CHANGED — headings are Bitter again

> **A MAIN HEADER — the thing that names a whole surface — is Bitter.**
> **A SECTION HEADING — small, tracked, uppercase, with a RULE RUNNING OUT OF
> ITS SIDE — stays IBM Plex Sans. The rule out of the side is the tell.**

Reverses the 2026-07-22 sans-everywhere call. The split is no longer
branding-vs-content. ⚠️ **`.kicker` had to start DECLARING the body face** — it
is often an `<h2>`, and removing that line silently flips every section label on
the site to serif. Prompted by preparing for **large headings set directly on
the scene**, where a header carries no box to lend it presence.

## The Team Builder pieces

- **The nav plate** (band B's rail): three Bitter/bold 14px items, `flex: 1 1 0`
  so "Atlas" and "Compare" get the SAME plate, group at `--nav-fill` 76% of the
  rail so rail stays visible at both ends, selected plate `--nav-plate-h` 40px =
  **2px proud** of the 36px rail. It **CLAIMS `.ctx-light`** rather than naming
  a light token — that is what flips the ACCENT RUNG so its border can be gold
  (gold-400 measures 1.48:1 on the beige; `.ctx-light` resolves `--accent` to
  gold-700). ⚓ Nate: **"borders like this are some kind of gold mix usually"** —
  `--frame-line` is a neutral divider for a paper panel; an ornamental edge on a
  beige plate is jewelry. ⛔ Star ornaments tried and REMOVED (the `sparkle`
  mark went with them — an unused name is dead weight in `generate-marks.mjs`).
- **The `--sel-surface` beige pilot MOVED, it did not grow** — off the document
  tabs, onto this nav plate. Better fit for what the idiom is for: Genshin
  lights the selected row of a **navigation**, not of a document list. Two
  consumers now, both navigations (this + the Help chapter nav).
- **COMPARE IS UNREACHABLE UNTIL IT HOLDS A PICK.** Its "nothing to compare yet"
  view is DELETED; the sentence is the disabled plate's title. Emptying it
  bounces to the Roster via an `$effect`, and the render branch tests
  `compareReady` too — otherwise the old empty state flashes for one frame on
  its way out.
- **Team Covers is BARE ON THE SCENE** — the first surface to try an on-scene
  header, and the reason the heading face moved. Pills at `--r-round`;
  resonance + faction facts joined the run as a left-hand cluster, laid out
  **two-to-a-column** (`grid-auto-flow: column` over 2 rows) so it never grows a
  third row. ⚠️ **The ceiling is FIVE, not four** — a four-Natlan party can hold
  two resonances, Ascendant Gleam, Secret Rite AND the Nightsoul count.
  `TeamFacts.svelte` is DELETED into `CoveragePanel`.
- **`--cover-measure` 1000px** (⚓ Nate measured it). The ONE place on this
  surface a cap is right: everything else fills the column, but fifteen chips
  given 1600px stop being a block and become a rule across the top of the tool.
- **`--tb-section-gap` 2rem**, a second knob beside TOOL_GUTTER. **The gutter is
  the rhythm BETWEEN BOXES; a box carries its own edge and can sit close. A run
  of BARE content has nothing but the space around it to say where it ends.**
- **Atlas role cards went `ctx-light` → `ctx-glass`** (⚓ Nate: the parchment
  "is distracting me too much to judge other things"). ⚠️ **Their monotone role
  glyph is DRAWN, not masked** — it was briefly re-published as a mask over a
  painted fill on the reasoning that navy ink would vanish on dark; ⚓ Nate:
  those assets were **drawn to be a slightly transparent overlay on dark slate**,
  where the near-black reads as a deeper pool IN the card. Wrong end of the
  problem.

## Open / owed

- ⚠️ **The Atlas citation is GONE and took two things with it**: the only
  user-facing statement that the roles come from Genshin's Imaginarium Theater,
  and the only place the surface said **"a presence classification, not a
  ranking"** — a constitution line (no tier lists) that now lives nowhere a
  reader can see it. Flagged in the markup; the Team Builder's Help chapter is
  the suggested home. **Nate's call, unmade.**
- **`.banner` / `.banner-end` are DEAD CSS** — CoveragePanel was their only
  consumer. Left in place deliberately: ⚓ Nate anchored the idiom 2026-08-08 as
  ON TRIAL, and retiring it is a design decision, not cleanup. Same for
  `.tab--lg`, whose one consumer became the nav plate.
- **The planner and the Visualizers still have an undivided band B.** Splitting
  them is the same `bandBCenter` mechanism if Nate wants the shape everywhere.

Related: `docs/rounds/genshin-night-palette.md` · `docs/rounds/toolbar-round-2026-08-07.md` ·
`docs/rounds/style-reference.md` · `docs/design/icon-set.md` ·
`docs/rounds/breathing-room-round.md` · memory `feedback_gate_cadence`
