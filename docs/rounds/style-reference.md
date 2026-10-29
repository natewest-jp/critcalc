# `/styleguide` — the style authority

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

Dev-only route at `src/routes/styleguide/`. `npm run dev`, then `/styleguide`.
It lives OUTSIDE the `(scene)` group so it renders on the bare root layout — no
chrome, no starfield, no veil.

**Read it before building or restyling ANY UI.** The pages themselves can't be
the reference: the same idiom once had ~11 parallel implementations, so "copy
the nearest neighbour" is exactly how the drift happened.

`src/app.css` is the ONLY place a button, chip, tab, toggle, note or field is
defined. Components keep locals only for geometry/semantics a global can't know.
**Never "fix" a pattern by editing a component.**

## The three labels on the page are load-bearing

- **LIVE** — parsed from `app.css` at build time (`?raw`). Cannot drift; a new
  `:root` token auto-appears, and anything ungrouped surfaces under "Ungrouped".
- **SHIPPED** — a real global class in `app.css`. Every specimen IS that class.
- **⚓ ON TRIAL** _(added 2026-08-07)_ — shipped and real, but a value Nate is
  testing rather than a decision that has landed. Expect it to move.

## Sections

Families (the two contexts) · Tokens · Typography · Buttons · Chips & tabs ·
Toggles · Surfaces · **Marks** · **Tool bands** · Exceptions · **Laws**.

**§ Laws is the part worth protecting** — the rules no swatch can show, each
paid for in a real bug or a real rejection: Color · Type · Chrome & controls ·
Safari/WebKit · Motion & perf · Structure · Writing · Open.

## ⚠️ Gotcha, hit once already

The page's own chrome CSS must use **direct-child selectors** (`.sg > section >
h2`). A loose `.sg h2`/`.sg h3` out-specifies specimen classes like
`.panel-title` (0,1,1 vs 0,1,0) and silently restyles the very thing being
documented.

## Round: the retirement round — ✅ MERGED to `main` 2026-08-07, `b937263` (pushed 2026-08-08)

⚓ Nate's three directions, all landed in the pattern layer and then documented.
**All three are ON TRIAL** — he said explicitly they are tested values to see
how they read, not law.

1. **Edge borders retire to NOTHING.** The ground does the separating.
   **The modal is the one deliberate survivor** — it floats with no ground to
   belong to, which is also why it keeps the softer corner.

   ⚠️ **The INSET border is the bench ribbon's alone.** "Inset border" does NOT
   mean `box-shadow: inset` and does NOT mean a recessed/sunken well — both were
   offered and rejected. It means **Genshin's idiom: a decorative border set
   INSIDE the element**, inset ~5px (the ribbon's two-stroke frame). I promoted
   it to a global `.inset-frame` and put it on both tool frames; ⚓ **Nate pulled
   it back the same day** — the direction is real, but _which_ surfaces earn it
   is undecided and it may not be the same frame the ribbon carries. The global
   and its tokens are DELETED; the geometry stays in `benchBand.svelte.ts`
   (`RIBBON_EDGE` / `RIBBON_FRAME_*`). **Don't re-promote it speculatively** —
   wait for a second surface that actually wants one, and let it shape the form.

   ↻ **RESOLVED 2026-08-09/10.** The family came back as `.inset` +
   `--plain`/`--double` (a CLOSED set, ⚓ Nate — see
   `docs/rounds/genshin-night-palette.md`), and the second surface arrived: the Team
   Builder's **selected navigation plate**, which wears `--plain` with a **GOLD**
   `--frame-line` (⚓ Nate: "borders like this are some kind of gold mix
   usually"). ⚠️ It was ALSO tried on the selected document tab and ⚓ Nate took
   it back off within hours — _"band A does not need a second decorated object"_
   when the navigation one row down has one. **The extent is still the open
   question; the form is not.** See `docs/rounds/band-plates-round.md`.

2. **Buttons go OPAQUE.** New per-context `--btn-face`/`--btn-face-hover`;
   `--primary` keeps the ground-agnostic `--control-face` slate. Two ghosts
   survive on purpose: `.btn--danger` (never look pressable) and
   `.segment > .btn` (the track IS the affordance).
3. **Radii collapse.** `--r-lg` 9px RETIRED. `--r-sm` 3px = everything;
   `--r-md` 6px = MODALS ONLY (incl. portalled popovers — InstrumentPicker, the
   ValueWheel); new **`--r-xs` 1px = the tool bands only** (`BAND_RADIUS`).
   ⚠️ The literal `9px` on all **eight Visualizer chart frames** was invisible to
   the token grep — when re-cutting the scale, sweep literals too, not just
   `var(--r-*)` call sites.

Also landed: **band B's ground moved from `--ribbon` beige to the light
context's paper** (⚓ Nate mid-round) — the ribbon token is meant to be a
slightly darker stripe laid ON a light fill, not a whole toolbar; it has no
consumer again. And two illegal literal 9px radii on the tool frames were
snapped to the scale.

### Laws this round added or overruled

- **"An edge border retires to NOTHING."** Test before reaching for one:
  _would this surface disappear without it?_ If yes, the ground is wrong — fix
  that instead.
- ⚠️ **Don't promote a technique to a global on its first consumer.** The
  `.inset-frame` round-trip is the lesson in miniature: a technique with one
  consumer and an undecided scope is not a pattern yet, and shipping it as one
  presents a decision Nate hasn't made. Same failure mode as the rejected
  `.btn--outline`, one step earlier.
- ❌ **RETIRED: "a quiet ghost button needs a CLUSTER to read as a control, so a
  lone action takes `--primary`."** That was a workaround for the ghost and went
  with it. `--primary` now means _promoted_, not _lonely_.
- `.is-active` on a button mixes `--sel-fill` INTO the face rather than
  replacing it — swapping an opaque plate for a translucent accent made the
  selected button quieter than its neighbours.
- `.inset-frame` needs `isolation: isolate` for its `z-index: -1` pseudos.
  `position: relative` with `z-index: auto` does NOT make a stacking context, so
  a bare `-1` sinks past an ancestor's background and vanishes.

### Open / unfinished

- **~70 bespoke edge borders remain in components** — `RotationTimeline` (28),
  `SavedNotationsOverlay` (8), `CharacterCard` (6). Most should simply go;
  several are structural hairlines, which are a different thing and stay.
  Deliberately not swept this round.
- Is 1px a real rung, or should the bands go back to 3? `--r-xs` exists to
  answer that on one surface; don't let it drift onto a second before it does.
- `--ribbon`/`--ribbon-ink` have no consumer.
- ⚠️ **`--btn-face` is mixed against the context's `--surface`, but a button
  inside a `.panel` stands on `--surface-raised`** — so its plate is blended
  against a ground one rung off from the one it actually sits on. Not visible in
  anything checked, and fixing it means either a `.panel`-scoped re-declaration
  or a third mix; left as a known simplification.
- **Real Safari unverified.** Everything this round was judged in headless
  Chrome; it joins Nate's standing real-Safari backlog.

## Earlier rounds — what still matters

**The unified system, `f625bc4` 2026-07-27.** Six-chunk migration; 27 per-tool
families collapsed; `vz-*` retired. The narrative is in git — these survived:

- **Voice: "verbs shout, nouns don't."** Buttons + instrument controls
  (`.chip--control`) are UPPERCASE + ls-wide; content chips are sentence case.
- **Booleans split by MEANING**: `.toggle` (switch) = persistent preference, on
  = `--ui-positive`; `.check` = view option, on = `--sel-fill`/`--sel-ring`.
  Rationale: **selection is accent everywhere**; a switch reports a state of the
  world.
- ⚠️ **Global `.chip` carries `text-transform: capitalize` ON PURPOSE** — chip
  labels are frequently raw data ids (`{el}`, `{w}`). Don't "clean it up".
- ⚠️ **Spacing belongs to the CONTAINER, not the text** (`.note` is
  margin-free); **width belongs to the caller** (`.field` has no max-width).
  A global written against a styleguide SPECIMEN encodes the specimen's context
  — check it against real callers before promoting.
- ⚠️ **When promoting a class that reads a custom property, check every call
  site sets that exact name** (element pickers set `--el`, the global read
  `--chip-color` → the `color-mix` went invalid and selection died silently).
- ❌ `.btn--outline` was built and REJECTED. "Hand-rolled 7 times" is evidence of
  ACCRETION, not necessity — ratifying what old code happened to do is what the
  styleguide exists to overrule.
- ⚠️ **A CSS-selector scan under-counts.** Audit `<button>` elements directly.
  Two false-positive traps: `<button>` inside HTML comments, and regexes that
  stop at the `>` in an `=>` arrow.
- ⚠️ **Pixel-diffing a tool surface is useless** — the WebGL scene makes it
  nondeterministic. Dump computed styles instead.

**Chrome & control laws (`d7da763` + `fd81e13`):** NO hover glows anywhere (the
one surviving `0 0 7px` is `.cv-roll-crit`, which marks crit rolls — data, not
chrome) · slider knobs are FLAT · rules are 2px, section dividers 1px ·
`.prose` body copy is `--fs-lg`.

**§ Laws · Structure gained the mirrored-surface grammar 2026-07-30**
(`docs/rounds/mirrored-tool-surfaces.md`) and was re-cut around CONTEXT 2026-08-05
(`docs/rounds/archetype-consistency-pass.md`).

Related: `docs/rounds/archetype-consistency-pass.md` (the contexts — read first for
color) · `docs/design/subpixel-rendering-laws.md` · `docs/design/icon-set.md` ·
`docs/rounds/toolbar-round-2026-08-07.md` · `docs/rounds/bench-band-round.md` · `docs/rounds/ui-design.md`
· `docs/rounds/design-decisions.md` · memory `feedback_expose_tuning_knobs`.
