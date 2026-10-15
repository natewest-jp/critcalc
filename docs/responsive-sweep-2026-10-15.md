# The responsive sweep (2026-10-15)

The mobile and wide-screen sweep before launch: five parallel surveys (the
Planner from 320 to 1137, the Planner from 1135 to 3440, the Team Builder, the
Visualizers, and the landing + static pages + overlays), each followed by an
independent verify pass and then a fixer. Branch `sweep/responsive` (worktree
`/Users/producer/Code/critcalc-responsive`), 18 commits on `main` at `abde521d`,
from `fd509049` to `3c1ee8ce`. ⚠️ **Nothing is pushed or merged.**

Every screenshot is local, in `scratch/responsive-shots/` (gitignored).
`scratch/responsive-shots/index.html` is the contact sheet: one section per
surface, each finding's before/after pair, then the baselines in a row per
width. Open it in a browser. Screenshot paths below are relative to the
worktree.

This record follows the survey (`docs/responsive-survey-2026-09-01.md`) and the
narrow round (its Part IV). The pre-ruled forms were not reported again: the
bench row, the word-to-mark folds, the layer plates, the drawer, the dock, the
lane names painted under bars, and the bench row's spread at 641–863.

## 1. Headline

- **Found:** 51 findings across five surfaces (Planner narrow 9, Planner wide 6,
  Team Builder 16, Visualizers 9, pages 11). 8 were rated high, and 7 of those
  are fixed. The eighth, `builder-3`, is a design question (§3 item 5).
- **Confirmed:** 47. **Uncertain:** 1 (`planner-narrow-4`, the dock with a
  keyboard up, which headless can't raise). **Refuted:** 3 (`builder-15`,
  `builder-16`, `viz-3`; all three describe documented intent, see §4).
- **Fixed:** 20 findings in 18 commits. `52c0d50f` fixed `planner-narrow-7` and
  `viz-5` together (one shared EventLog), and `4642c444` fixed `pages-2` and
  `pages-3`.
- **Skipped:** 1 confirmed finding (`pages-11`, not worth it before launch).
- **For Nate:** 27 findings, gathered into 31 items (§3). Items 26–31 are fixes
  that changed something you will see.
- **No document-level horizontal overflow anywhere**, at any width or state, on
  any surface. Every defect lived inside a scroll container or a clip box, as
  the survey predicted. The docs' known Visualizers item (the `.instrument`
  auto-column phone overflow, instrument passes §4) is **resolved**: 0px on all
  eight instruments at every width from 320 to 3440.

**Gates on `3c1ee8ce`:**

- `npx vitest run`: `Test Files 83 passed (83)`, `Tests 2365 passed (2365)`.
- `npm run check`: `722 FILES 0 ERRORS 0 WARNINGS 0 FILES_WITH_PROBLEMS`.
- `npm run lint`: prettier and eslint clean.
- `npm run build`: exit 0.
- **e2e, Chrome:** `75 passed (5.8m)`. Exit 1, but the only errors are the
  upstream worker-teardown hang ("worker-3 process did not exit within 300000ms
  after stop, force-killed it"), with every test green.
- **e2e, WebKit:** `74 passed (2.0m)`, `1 flaky`, exit 0. The flaky test was
  `e2e/star-freeze.spec.ts:55`: its first attempt ran before the scene renderer
  had mounted (`rest0` null), and the retry passed. No sweep commit touches the
  scene. Run alone with `--repeat-each=3` it gave `3 passed (26.3s)`.
- ⚠️ Real Safari and real phones were not checked. The CLAUDE.md rule applies:
  nothing visual counts as verified until Nate has looked.

⚠️ **The shared preview kept going stale, and that is the lesson worth keeping.**
`vite preview` (sirv) fixes its file list when it starts. After an
`npm run build` every newly hashed chunk returns 404, so the page renders
without its new CSS, and a measurement there reads clean when it isn't. One
fixer's first pass read 0 overflow everywhere for exactly this reason. The
:4321 server also crashed twice when a sibling's rebuild removed the chunks it
was serving. The fixers measured on private previews, restarted after each
build. ⛔ Never measure on a preview that started before the last build.

## 2. Fixed

One line each, with the widths it was measured at after the change.

### Rotation Planner

- The bench's loadout and constellation pickers measure their own width and
  clamp to the screen. Before, the second card's loadout opened 98px off the
  left edge at 320 and the first card's 5px off the right (`planner-narrow-1`).
  Inside [8, w−8] at 320/360/390/430/600/768, and the desk ribbon still opens
  to the right of the chip. `d166e950`
- The details card is portalled above the site chrome and the dock
  (`planner-narrow-2` / `builder-2`, below). Its timing value now wraps between
  facts below compact, so the panel's 9px sideways scroll at 320 is gone. Probed
  at 320×844, 390×844, 430×932, 844×390, 600×1024 and 768×1024. `bbf2ae80`,
  `9bc55215`
- An always-on buff chip wraps inside its column. Before, it ran 26px past the
  screen at 320 (`planner-narrow-3`). 0 at 320/360/390, 1200 unchanged.
  `54e8c40c`
- The aura log's row bleed lands inside its scroller, so it no longer scrolls
  4px sideways (`planner-narrow-7` / `viz-5`). 0 at 320/390/768/1137/1440, in
  the drawer, in the column and in the Gauge Explorer. `52c0d50f`
- The tab strip's hidden measuring copy no longer widens the shell. With five
  tabs that was up to 371px of invisible scroll range (`planner-narrow-8`).
  0 at 320/390/865/1024/1440, and the strip still collapses at the same widths.
  `bbec655c`
- The Zoom popover hangs from its trigger's start edge, so it no longer covers
  the bench ribbon at 864–1136 (`planner-wide-6`). Measured at 880/1000/1135;
  from 1137 it starts at x≈450 instead of ≈300. `fd509049`

### Team Builder

- The details card is portalled (`use:portal` + `closeOnLeave`, the
  BossDetail/AbyssOpponents house form). Before, its name and ✕ sat under the
  chrome on any screen under ~908px tall, and the chrome's buttons stayed live
  over the panel (`builder-2`). Checked in Chromium and WebKit at 320×640,
  844×390, 1280×720/800 and 1366×768. Two consequences were fixed in the same
  commit: "See coverage" binds `onclickcapture` (a delegated click reached
  `document` after the router had taken it), and it closes the card once the
  About overlay opens. `bbf2ae80`
- Band B's lineup cell folds the pane switch's and Add team's words below
  compact, so "No repeats" stays on screen on a Custom board (`builder-1`).
  0 overflow at 320/340/360/390/430; the words return at 700. `4b5ef69e`
- The stubs bucket's tiles read the roster's tile knobs, so "Not yet curated" is
  the same width as its neighbours (`builder-7`). Equal at 390/768/1440/1600.
  `b7a8f598`
- The More filters popover stops short of the screen's foot (`builder-6`).
  17px inside at 844×390 and 320×568, where it used to run 19px past; 1280×800
  unchanged. `b0f5b710`
- A lone opponent spans the Opponents dialog's row, so long boss names fit on
  one line (`builder-10`). 595px at 1440 (was ≈295), 390 unchanged. `6f6c57b1`

### Visualizers

- Reaction Curves' family names break between reactions, never inside one, so
  the Transformative and Lunar & Stellar tables stay inside the paper card
  (`viz-2`). Checked in Chromium and WebKit at 320/360/375/641/680/720 (before:
  36–42px over at 320, 47–52px at 641). `f0b9207d`
- Band B's Defaults and Share fold to marks below compact, so the picker shows
  every instrument's full name (`viz-1`). Unclipped at 320/360/390 (Damage
  Breakdown used to lose 104px at 320); a failed share keeps its words.
  `56f17c6f`
- Damage Breakdown's reading line takes a 96ch measure, the `.ao-probe`
  precedent (`viz-8`). 3 lines at 1280, 1920 and 3440, one shared height.
  `75d23164`

### Landing, static pages and overlays

- The chapter tab row scrolls on its own on a phone, so the pages panel no
  longer pans sideways (`pages-1`). 0 at 320/360/390/430 on About, Contribute,
  Privacy, Coverage, Help and its chapters (it was up to 206px). `59a3e8a3`
- Settings: rows with a segment or slider stack under their label below compact,
  segments share the row in equal columns, and the overlay body can't be
  widened by a child (`pages-2`, `pages-3`). "What it adjusts" went from 0px
  to 230px of label at 320; panel and overlay overflow 0 at 320/360/390; 1280
  unchanged. `4642c444`
- Coverage's sort segment shares its row in thirds on a phone, so "Least covered
  first" wraps inside its own third (`pages-4`). 0 at 320/360/390/430, 800
  unchanged. `7428b8e0`
- Static-page prose gets the 56ch measure the 2026-09-23 ruling assumed it had
  (`pages-5`). 1152 → 605px at 1280/1920, on the route and in the overlay.
  `3c1ee8ce`

## 3. For Nate

Answer by number ("1 ok, 2: …"). Each item has the question, my proposal, and
the screenshot. The contact sheet has all of them with their before/after.

### Touch

1. **Run the `pointer: coarse` hit-box pass now?** It is the survey's open
   item 1, and all four surfaces found it: under coarse, only the slider grows.
   The smallest targets are the Planner's constellation chip (20×14), the tab
   menu's ✕ (16×16) and the dock's Undo/Redo (30×19); the Builder's
   fingerprint find glyphs (13×18) and tab ✕ (15×15); RES & DEF's shred rows
   (18px tall); and the chrome's Navigate/Settings (34×34), the overlay ✕
   (30×30) and the Coverage search (25px tall).
   → One `@media (pointer: coarse)` block that grows hit boxes with an inset
   `::before` and leaves the paint and the shared numbers alone, smallest first.
   You set the target (44px?) and the exceptions.
   `planner-narrow-6`, `builder-13`, `viz-7`, `pages-10`.
   `scratch/responsive-shots/planner/planner-narrow-6.png`,
   `scratch/responsive-shots/builder/builder-13.png`,
   `scratch/responsive-shots/visualizers/viz-7.png`,
   `scratch/responsive-shots/settings/pages-10.png`
2. **The Gauge Explorer's pills overlap on phones** (`viz-6`). Their 30px hit
   boxes overlap by up to 17px at 320 and 13px at 390, so a tap on the shared
   strip goes to the later pill. The panel's ←/→ nudge still reaches every
   pill.
   → Hit-test the marker band to the nearest pill centre, as part of item 1.
   `scratch/responsive-shots/visualizers/viz-6.png`

### Short screens (a height axis)

3. **May short viewports get their own axis?** Items 4–7 all need one: a
   height condition kept out of the width table, the way `pointer: coarse` is.
   → Yes: one named condition, `(max-height: 30rem)`, documented in
   `$lib/breakpoints.ts` as its own axis with its content fact (landscape
   phones, 320–430 tall). If no, items 4–7 become "accept".
4. **Landscape phones see almost no chart at rest** (`planner-narrow-5`). At
   568×320 about 27px of chart is visible above the collapsed dock. At 932×430
   the desk form applies (it is wider than toolMin), with about 1.2 slot rows in
   view.
   → Under item 3's condition, apply the narrow defaults (layers off, zoom 30)
   and the bench row.
   `scratch/responsive-shots/planner/planner-narrow-5.png` (also
   `planner-narrow-5-932x430.png`)
5. **On short screens the Builder's filter strip leaves the grid less than one
   row** (`builder-3`, rated high). The strip stays pinned, so the grid
   scroller is 83px tall at 844×390 (a card is 125) and 119px at 320×568. At
   320 the strip is 182px tall.
   → Under item 3's condition, the strip and the destination banner scroll
   inside `.cg-scroll` with the cards. This also takes in the strip half of
   `builder-15` (one glyph wrapping to a fifth row at 320).
   `scratch/responsive-shots/builder/builder-3.png`
6. **The landing on short viewports** (`pages-7`). The cards keep their 17rem
   floor, so at 844×390 the notice band overlaps the legal footer by 55px, and
   the first card climbs 7–20px above the bottom of the wordmark.
   → Let the card floor give way to height,
   `clamp(min(17rem, <svh budget>), 46vh, 30rem)`, under item 3's condition.
   `scratch/responsive-shots/landing/pages-7.png`
7. **Landscape phones get about 230px of reading height on pages and
   overlays** (`pages-8`). Usable panel height is 225px at 667×375 and 240px at
   844×390, because the fixed chrome and footer take 148px.
   → Under item 3's condition, the legal footer scrolls at the end of the
   panel instead of reserving 64px.
   `scratch/responsive-shots/about/pages-8.png` (compass:
   `ov-compass/pages-8.png`)
8. **The open dock with a keyboard up** (`planner-narrow-4`, uncertain).
   The docked editor is capped at 35svh, and svh ignores the keyboard. Without
   a keyboard the open dock is already 42% of the screen at 390×844 (long
   rotation) and 51% at 568×320. With a real keyboard it could fill the visual
   viewport. Headless can't raise a keyboard, so this is inferred.
   → On your iPhone, open a long rotation's dock with the keyboard up. If it
   leaves too little chart, cap the editor at a fraction of the visual viewport
   (`--dock-vvh`, beside `--rp-kb-inset`). You pick the fraction on the device.
   `scratch/responsive-shots/planner/planner-narrow-4.png`
9. **The legal footer is cut off on narrow phones** (`pages-9`). Its text is
   86px tall at 320 and 69px at 360–430, in a 64px footer, so "HoYoverse." is
   cut in half at 320. Tightening the padding alone still leaves it 9px over.
   → Below compact, step `.ftr__legal` from `--fs-md` to `--fs-sm` and tighten
   the rule's margin. (You stepped it down from `--fs-lg` on 2026-09-16; the
   other option is a taller footer, which costs about 24px of reading height.)
   `scratch/responsive-shots/landing/pages-9.png`

### Laptop heights

10. **At laptop heights the Planner's composer starts below the fold, even for
    a 4-character rotation** (`planner-wide-1`). The composer always starts at
    y=997, so it needs 294px of scroll at 1366×768, 262px at 1280×800 and 162px
    at 1440×900. Scrolling down to type takes band B, the ruler and the top
    bench cards off screen.
    → Above toolMin, pin the composer and its Undo/Redo to the shell's foot
    (`position: sticky; bottom: 0`), the way the phone dock pins it. It costs
    nothing at 1080p and above, and the ruled vertical budget is untouched.
    `scratch/responsive-shots/planner-wide/planner-wide-1.png` (also
    `planner-wide-1-scrolled.png`)
11. **The aura log's column runs past the bottom of the screen**
    (`planner-wide-5`). With a long rotation at 1137×900 the log's scroller
    ends 377px below the fold, so reading it takes two scrolls. The aside box
    matches the main column's height by design (the aside-column round).
    → In the column form only, make the aside box sticky with its height
    bounded to the visible tool height, so the log stays beside the chart. The
    aside's ground would then end at the viewport's foot while the main column
    continues. The drawer is unchanged.
    `scratch/responsive-shots/planner-wide/planner-wide-5.png`

### Surplus width

12. **At 2560/3440 a short rotation sits in the left half of the chart**
    (`planner-wide-2`). At 3440 the 4-character rotation uses 58% of a 3122px
    track, with 1300px of bare scene to the right.
    → Above `vast`, the resting zoom fits the content:
    `clamp(ZOOM_DEFAULT, trackW / contentSpan, ZOOM_MAX)`, decided at load like
    `restingZoom` and never in `?r=`. I'd check first that the PNG export
    doesn't read `pv.scale`. The alternative is to accept it as honest empty
    time.
    `scratch/responsive-shots/planner-wide/planner-wide-2.png`
13. **Band B leaves a 2,340px gap between the Total and the right-hand group at
    3440** (`planner-wide-3`). Nothing overlaps or clips; only mouse travel
    suffers.
    → Leave it before launch. If you want it closer later, move the Total into
    the end group.
    `scratch/responsive-shots/planner-wide/planner-wide-3.png`
14. **The composer runs to 196 characters per line at 1920 and 391 at 3440**
    (`planner-wide-4`).
    → Above `wide`, give `.rp-notation-wrap` a `max-width` of about 140ch,
    left-aligned with the tracks, with Undo/Redo beside the bounded field.
    `scratch/responsive-shots/planner-wide/planner-wide-4.png`
15. **On wide screens the Builder's search field and banner stretch without
    limit** (`builder-11`). The search field is 2078px wide at 3440, and the
    banner's message and count sit 2560px apart. Under the 800px board there is
    533px of empty area at 1440 tall.
    → Cap `.tb-search` at about 28rem with More and the lens following it, and
    keep the banner's count beside its message.
    `scratch/responsive-shots/builder/builder-11.png`
16. **One Visualizers slot on a wide display stretches its chart and sliders**
    (`viz-4`, the survey's §8.1). At 3440 with the lineup set to 1, Wish Odds'
    pity slider is 2722px wide and its chart 2960×896. The Crit Heatmap's stage
    is centred with about 720px between it and its Readout. The default lineups
    never reach this.
    → Cap the controls row's slider width, and cap the chart aspect on the four
    instruments that aren't time series (Wish, Curves, Artifact, RES & DEF).
    Butt Crit's Readout against its stage. Gauge and ICD keep the width.
    `scratch/responsive-shots/visualizers/viz-4.png` (Crit: `viz-4b.png`)
17. **At 1440×900 the default 2-up puts every instrument in the cramped middle
    tier** (`viz-9`). Tiles are 675×727 and scroll by 73–1079px, with the Crit
    Readout fully below the fold. At 1-up the same instruments scroll 0–48px.
    → Accept it, since the lineup control offers 1. The alternative is to
    raise the 2-up stop from 1360 to about 2000, which moves `workspace.ts`,
    band A's media query and `breakpoints.test.ts` together.
    `scratch/responsive-shots/visualizers/viz-9.png`

### Team Builder forms

18. **From 641 to 1136px the Lineup tab stretches the board and strands its
    right column** (`builder-4`). The team is 1089px wide at 1135 while its
    content ends at 440, so the Planner button, pin and chips sit about 520px
    from the lineup.
    → Cap `.bv` at the docked `--tb-board-w` (580/720) and start-align it in
    the tab. That also removes the worst Abyss-art upscale (item 22). Fix the
    stale BoardView comment ("the split pane never gets this narrow") at the
    same time.
    `scratch/responsive-shots/builder/builder-4.png`
19. **The Library goes two-column at toolMin and both columns are then too
    narrow** (`builder-5`). At 865 a notation shows about 70px of its text and
    "Stygian 7.1 clear" is cut by 12px. At 863, one column, it all reads well.
    → Keep one column until `wide` (71rem): move the switch in
    `LibraryOverlay.svelte` from `max-width: 54rem` to `71rem`.
    `scratch/responsive-shots/builder/builder-5.png`
20. **From 431 to 640px the board uses the phone form, which leaves the right
    side empty** (`builder-8`). At 639 about 320px beside the four portraits is
    empty in every team.
    → Leave it for the Builder's phone pass. If you'd rather now, the side
    column sits beside the slots in the phone form when there is room.
    `scratch/responsive-shots/builder/builder-8.png`
21. **"Pin a rotation" is cut to "PIN A RO…" on the 580px board**
    (`builder-9`, endgame boards only, 1137–1499). The side column gets about
    120px against the label's 153.
    → Tighten `.bv-slots`' gap on the 580 board to give the column about 35px
    back. That changes no wording; a shorter label would be the alternative.
    `scratch/responsive-shots/builder/builder-9.png`
22. **Abyss art and portraits are shown larger than their source files**
    (`builder-12`). The 640px blessing art is shown at up to 1089px in the
    tabbed range. The 128px side portraits are shown at 79–90 css px, so they
    upscale on a 2× display and look slightly soft.
    → Item 18 fixes the Abyss case. A @2x avatar set, under a new path since
    `/assets` is add-only, is a pipeline decision for after launch.
    `scratch/responsive-shots/builder/builder-12.png` (dpr 2 slots:
    `builder-17.png`)
23. **Roster card names are cut for six Travelers and Kuki Shinobu**
    (`builder-14`). By up to 19px at 390 ("Cryo Trave…"), still 7px at 1440 for
    Dendro Traveler; gone from 1501.
    → Let the name plate take two lines when the name doesn't fit. That covers
    all seven. "Traveler" alone would leave Kuki Shinobu cut, and it is a
    wording change.
    `scratch/responsive-shots/builder/builder-14.png`

### Smaller things

24. **At 320 the Planner's collapsed tab trigger shows four characters of the
    rotation name** ("Raid…", `planner-narrow-9`). It is 102px at 390 and its
    128px cap from about 430. The full name is in the menu.
    → Below compact, move + New rotation into the tabs menu, which gives the
    label about 30px.
    `scratch/responsive-shots/planner/planner-narrow-9.png`
25. **The Settings page on desktop** (`pages-6`). At 1920 a label and its
    toggle sit about 1000px apart (`space-between` across a 1073px row), and
    the ledes run about 200 characters per line. The overlay form (491px) reads
    well.
    → Cap the route's `.sp` at about 40rem, left-aligned in the 72rem panel,
    so the page reads like the overlay.
    `scratch/responsive-shots/settings/pages-6.png`

### Fixes that changed something you'll see

26. **The Builder's pane switch now drops its word below compact in the
    Characters cell as well** (`builder-1`, `4b5ef69e`). You ruled it as one
    plate naming the pane it opens (design doc §11.6 item 15). Folding only Add
    team still spilled 15px at 320.
    → OK as shipped.
    `scratch/responsive-shots/builder/builder-1-after.png`
27. **The Visualizers' Defaults and Share are 28×36 mark-only plates below
    compact** (`viz-1`, `56f17c6f`), the same as band A's mark-only buttons.
    28px is narrow for a thumb.
    → OK, with item 1 growing their hit boxes.
    `scratch/responsive-shots/visualizers/viz-1-after.png`
28. **In the aura log the left half of a lit row's fill now shows**
    (`planner-narrow-7` / `viz-5`, `52c0d50f`). The scroller used to clip it.
    → OK as shipped: it is the bleed the rows were built with.
    `scratch/responsive-shots/visualizers/viz-5-after.png`
29. **At 320 only, the Settings words Animations, Metronome, Vibraphone and
    Lantern touch their plate edges** (`pages-2`, `4642c444`). They are 74–85px
    of tracked uppercase in 55–74px cells, and padding can't fix that. Clean
    from 360.
    → Accept at 320.
    `scratch/responsive-shots/settings/pages-2-after.png`
30. **The More filters popover keeps its 32rem ceiling** (`builder-6`,
    `b0f5b710`). On a 390×844 phone that holds the list to 520px with 185px
    free below, so REGION scrolls.
    → Drop the ceiling below compact, so a phone shows the whole list.
    `scratch/responsive-shots/builder/builder-6-after.png` (the 844 case is in
    the baselines)
31. **Damage Breakdown's reading line is now three lines at every width**
    (`viz-8`, `75d23164`; it was one 266-character line at 3440). RES & DEF's
    one-line captions (97 and 113 characters) were left alone.
    → OK as shipped.
    `scratch/responsive-shots/visualizers/viz-8-after.png`

## 4. Refuted or skipped, worth knowing

- `viz-3` (refuted): the ICD Timeline's 196px graph floating in a tall row is
  your ruling (instrument layout round §1, `STALK_GROW` 2×). Where the spare
  height goes belongs to item 16.
- `builder-16` (refuted): the step from 7 to 4 roster columns at 1500 (and 6 to
  5 at 1900) is the documented "fewer-but-bigger" choice, tuned live. The
  baselines at 1499/1501/1899/1901 are on the contact sheet if you want to look
  again.
- `builder-15` (refuted): at 320 the fingerprint wraps its one-glyph Damage
  cluster whole, as `Fingerprint.svelte` says it should. The strip half went to
  item 5.
- `pages-11` (skipped): at 320 the Coverage column head "Burst" comes within
  2.3px of "A1". The only smaller type step is the reserve tier. If it is ever
  revisited, a compact-only `letter-spacing` trim on `.col-label` is the
  smallest change.
- `builder-2`'s 5px sideways scroll at 320 was left by its fixer, then very
  likely cleared by `9bc55215` (the same DetailCard's timing value). That was
  measured only from the Planner, not re-measured on the Builder.

## 5. Not covered

- ⚠️ **Real Safari, real iOS and real Android were not checked.** Playwright
  WebKit confirms layout numbers and thrown errors only. Not verified:
  rendering, `backdrop-filter`, sub-pixel snapping, the software keyboard and
  visual viewport (hence item 8), the iOS Chrome address pill, real touch
  hit-testing and inertia, the safe area and home indicator against the fixed
  footer, the installed standalone app, and `100lvh`/`svh` behaviour.
- DPR 2 at 2560/3440 (asset sharpness; a 3440@2 scene would ask for about 7640w
  against the 6400w top plate tier), and `pointer: coarse` at tablet and
  touch-laptop widths (600–1024, and above 1137).
- **Planner, narrow:** after the :4321 crashes, the detail-card ✕ probe in
  landscape (screenshots only), the loadout, constellation and detail checks in
  WebKit, and the constellation picker beyond 865. Also the autocomplete list
  under coarse, the Library and Save modals, and the PNG export (out of scope).
- **Planner, wide:** heights below 768, and 1080/1440-tall viewports at widths
  other than 1920/2560/3440. Five or more characters and the "no slot"
  provisional state. Laps, Human timing and both layers off at wide widths.
  Many saved tabs in band A.
- **Team Builder:** the drag and fling of the pane wipe; Custom boards with five
  or more teams (the limit is 12); the full Library at 3440 beyond the
  baselines. Ignore the light-grey strip above the Library in Chromium captures
  at 760px and below: it is a capture artefact (the WebGL buffer isn't read
  back), and live pixels and WebKit are correct.
- **Visualizers:** full-height tile screenshots at narrow widths (the shell
  scrolls, so those baselines show only the viewport); the ICD → Gauge handoff
  and long Gauge logs; Artifact's ValueWheel and selects; Wish targets other
  than the default; RES & DEF with many shred sources ticked; landscape tablets
  other than 1024×768; height-only sweeps (1920×1200, 2560×1080); and the
  Share "Copied"/"Share failed" labels at narrow widths. WebKit's second look
  covered three instruments (Crit, Reaction Curves, RES & DEF).
- **Pages:** animation and transition states (the loading veil), RTL and large
  root font sizes, landscape tablets above 1024×768. The Roster overlay was left
  to the Builder sweep. Copy wording was not reviewed.
- **Follow-up, unchecked:** RotationNotes' coverage link inside the portalled
  phone drawer probably has the same delegated-onclick problem `bbf2ae80` fixed
  in DetailCard (the router takes the click first).
- **Housekeeping:** the probe scripts in `scratch/rp-sweep/` and
  `scratch/verify-pages/` are still there, because the permission system denied
  their deletion. They are gitignored; delete them by hand.
