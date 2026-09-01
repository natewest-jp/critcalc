# The responsive survey — both ends, measured (2026-09-01)

Roadmap §5 (mobile: REACHABLE, not CONVERTED) and §12 (wide-screen pass) are one
audit taken from opposite ends, and [[mobile-conversion-plan]] says the round
opens as a **survey**, not a conversion: sweep every surface, classify
**workable / fixable / genuinely-needs-space**, and let that scoped list — not an
open-ended "make it mobile" — be what gets decided on.

This is that survey. Everything below is **measured against the production
build** (`npm run build` + preview on 4998, headless Chrome), never dev and never
inspection. 14 routes × 10 widths for the sweep, plus three focused probes.

⚠️ **The expectation on record was "everything but the planner is workable."**
That is roughly right at the narrow end and _very_ right at the wide end — but
the two real defects it predicts are not the ones it names, and the planner's
number is better than feared.

---

## 0. The headline

|                                                          |                                           |
| -------------------------------------------------------- | ----------------------------------------- |
| Horizontal document overflow, any route, any width       | **0px**                                   |
| Vertical page scroll, any route, any width               | **0px**                                   |
| Routes where prose grows without bound                   | **1** (`/visualizers`)                    |
| Interactive targets under 24px on landing + static pages | **0**                                     |
| Interactive targets under 24px inside the tools          | **10–17 per tool, at every width**        |
| Responsive rules in the entire codebase                  | **11**, at 7 distinct thresholds, 0 named |
| `pointer: coarse` / `hover: none` handling               | **none**                                  |

⚓ **The architecture is already doing most of the work.** Every surface is
viewport-fit with its own scroll containers, so nothing overflows the document
and nothing page-scrolls at 320px. That is why the narrow-end failure mode here
is **clipping**, not overflow — and clipping is silent, which is why it needed
measuring rather than looking.

---

## 1. The narrow end — what actually breaks, and where

### The numbers that decide everything

Each tool's `.tool-shell` was measured for horizontal clipping down a 14-step
width ladder, with a real four-character team seeded (Kazuha / Xiangling /
Bennett / Xingqiu + a rotation), because an empty tool measures nothing.

| Tool                 | Shell stops clipping at      | Content-complete at     | Verdict            |
| -------------------- | ---------------------------- | ----------------------- | ------------------ |
| **Visualizers**      | **never clips — 0px at 360** | 360                     | ✅ **workable**    |
| **Team Builder**     | **~562px**                   | ~800px (`.rolecard-id`) | 🔶 **fixable**     |
| **Rotation Planner** | **~852px**                   | ~852px                  | ⛔ **needs space** |

Read that top row twice: **the Visualizers already reflow correctly to 360px.**
The N-slot workspace drops to one slot and the instrument inside it stays whole
(16 live controls at 390px, 51 at 1600, 77 at 2560+). Nothing was designed for
this and it works anyway, because the workspace is a slot count rather than a
fixed grid.

The planner's ~852px is **better than "the planner is a stretch" implied** — it
is a laptop number, not a desktop-only one. It does not make the planner a phone
tool, but it means the honest cut is around a tablet in portrait, not around
1200px.

### ⛔ Finding N1 — the tool chrome is over-subscribed below ~480px, and the logo is what silently vanishes

**The strongest narrow-end defect, and it is on every tool route.**

`.chrome-brand`'s logo collapses to **0px at 320–360, 6px at 390, 46px at 430**,
reaching its intended 63px only at 480+. At 320 the site's home link is a
zero-width box. Static pages and the landing are **unaffected** (63px at every
width) — this is tool-routes-only.

⚠️ **It is NOT the deliberate wordmark hide.** `SiteChrome` drops
`.chrome-wordmark` at `max-width: 40rem` on purpose; that works. What collapses
is the _logo image beside it_.

**Cause, arithmetic:** `.site-chrome` is `grid-template-columns: 1fr auto 1fr`.
On a tool route the center `auto` track holds `.chrome-nav` (229px even after
its own 40rem shrink), the right flank holds three 34px chrome buttons that
carry `flex: none`, and padding + gaps take ~53px. At a 320px viewport the bar
needs **~460px**. The `auto` center is sized first and the action cluster cannot
give, so the entire deficit lands on the one occupant that _can_ shrink — and
because the logo is a replaced element with `height` set and `width: auto`, its
min-content contribution resolves to 0. It does not shrink gracefully; it
disappears.

⛔ **Do not "fix" this with `flex: none` on the image — measured, it changes
nothing.** The flex layout inside `.chrome-brand` is not what is shrinking; the
grid _track_ is collapsing. `min-width: max-content` on `.chrome-brand` does
restore the logo to 63px at every width with no document overflow — **but it
pushes the action cluster past the right edge** (its right edge lands at 435px
in a 320px viewport). Measured both ways:

| viewport | today                         | with `min-width: max-content`           |
| -------- | ----------------------------- | --------------------------------------- |
| 320      | logo **0px**, actions visible | logo 63px, actions **clipped by 115px** |
| 390      | logo **6px**, actions visible | logo 63px, actions clipped by 45px      |
| 430      | logo 46px, actions visible    | logo 63px, actions clipped by 5px       |
| 480+     | correct                       | identical to today                      |

⚓ **So this is a design decision, not a fix, and it is deliberately not taken
here: below ~480px the bar has three occupants and room for two — what gives
first, the logo, the tool nav, or the action cluster?** It also interacts
directly with §5's small-screen notice: if the tools show a designed notice
below some width, the tool nav may not belong in the center of that bar at all,
and the question answers itself. **Recommend deciding N1 and the notice
together.**

### 🔶 Finding N2 — `.doc-tabs` clips below ~700px

The document tab strip (shared by both tools, band A) clips its label by 41–46px
below ~700px. Inside the "tools don't run here" band, so it only matters if the
small-screen notice sits lower than 700px.

### 🔶 Finding N3 — Team Builder role-card IDs clip up to ~800px

`.rolecard-id` in the Atlas clips by 148px at 360, 74px at 480, 24px at 720, 0 at 800. Unlike N2 this is **inside the TB's own working range** — the shell fits at
562px but the Atlas is not content-complete until ~800px. If the TB's cut is set
at its shell minimum, the Atlas is broken in the 562–800 band.

### ✅ Landing and static pages are workable at 320px

Zero overflow, zero clipping, zero targets under 24px, prose at 42 CPL. The
landing's three tool cards are 190px wide at 390px and its only controls are the
brand and three 34px chrome buttons. ⚓ **This matters more than the tool
numbers**: §5's whole argument is that a Genshin link shared to Discord is opened
on a phone, so the landing has to sell there even though the tools don't run.
**It already does.** The remaining landing work is composition (§11 /
[[project_landing_card_round]]), not repair.

---

## 2. The wide end — nearly clean, one real defect

Landmark widths measured at 1600 / 2560 / 3440:

|                    | 1600 | 3440     |                                          |
| ------------------ | ---- | -------- | ---------------------------------------- |
| `article.prose`    | 531  | **531**  | ✅ bounded                               |
| `.area-body`       | 537  | **537**  | ✅ bounded                               |
| `.area-shell`      | 781  | **781**  | ✅ bounded                               |
| `.ftr__legal`      | 992  | **992**  | ✅ bounded (authored `max-width: 62rem`) |
| `.rp-frame`        | 1296 | 3136     | ✅ **correct** — a Gantt uses width      |
| `.ws-tile`         | 752  | 1104     | ✅ correct — tiles gain a column         |
| `.ar-chart p.note` | —    | **1104** | ⛔ **defect**                            |

⚓ **§12's candidate list mostly resolves as "already fine", and that is a
finding.** Measured text columns are capped, the tool bands span deliberately,
`ToolColumns` proportions hold, and the instrument tiles gain _columns_ rather
than stretched content. The wide-screen pass is one fix, not a round.

### ⛔ Finding W1 — an instrument caption reflows to 160 characters per line

`.note` is a **global class with 205 uses and no width bound**. Its own comment
in `app.css` says "every instrument note lives in a `.panel` whose gap already
spaces it" — and that is exactly why it has survived: the panel bounds it. The
notes that sit _directly on a chart_ have no panel, so they inherit the tile.

Measured across all 19 rendered `.note` instances:

| CPL      | count                                             |
| -------- | ------------------------------------------------- |
| <50      | 12                                                |
| 50–64    | 5                                                 |
| **100+** | **2** — both `.ar-chart p.note`, at 2560 and 3440 |

The widest legitimate note is **43ch**. The outlier reaches **131ch / 160 CPL**.
Every instance is `text-align: start`, so a `max-width` cannot shift any of them.

**The bound is derived from the site's own typography, not a style guide:**
`.prose p` measures **49.2ch / 60 CPL** and `.prose li` **53.3ch / 65 CPL**. A
bound of **56ch** sits just above the site's established measure and 13ch above
the widest legitimate note — inert on 17 of 19, and it takes the outlier from
160 CPL to ~68. **This one is landed** (§4).

---

## 3. Touch targets — the axis that has no handling at all

`<meta name="viewport">` is present and correct. `pointer: coarse` /
`hover: none` appear **zero times** in `src/`.

Measured with disabled controls excluded (⚠️ **this correction mattered**: an
unseeded tool reports 16px `Swap (empty slot)` buttons that are `:disabled` with
`pointer-events: none` — not targets at all. Seeding a real team is what makes
the same 16px reading _true_), and with inline prose links excluded (WCAG 2.5.8
exempts them):

| Surface              | smallest live target         | under 24px |
| -------------------- | ---------------------------- | ---------- |
| Landing              | 33×33                        | **0**      |
| Static pages         | 25×25 (`Aether` / `Export…`) | **0**      |
| Help chapter nav     | 29px                         | **0**      |
| **Rotation Planner** | **16×28** (`.bb-act`)        | **10**     |
| **Team Builder**     | **16×28** (`.bb-act`)        | **10**     |
| **Visualizers**      | **22×22** (`Move later`)     | **15**     |

⚠️⚠️ **These are not mobile findings.** `.bb-act` measures 16×28 at **1280,
1600, 2560 and 3440** — identical at every width. Eight live controls per tool
(4 swap + 4 remove, one pair per bench card), sitting adjacent to each other so
WCAG 2.5.8's spacing exception does not apply. **This is a desktop-mouse target
size question that the mobile survey happened to find.**

Also under the line, at every width:

- `.btn--icon` and `.band-menu-trigger` — **26×22** (height fails)
- `.slider` — **88×4**. A 4px-tall pointer target; the RP zoom slider and three
  Visualizer sliders. `appearance: none; height: 4px` in `app.css`, so the box
  _is_ the painted track.
- `.sp-lo-zone` — 24×26, exactly on the line
- `.sp-cons-chip` — 26×26

⛔ **None of these are landed.** They are all inside geometry Nate tuned by hand
(`MARK_SIZE`, the bench card round, the bench tail round, `BAND_A_H` measured at
29px with no slack), and [[feedback_expose_tuning_knobs]] is explicit that his
values are measurements, not derivations. Resizing them is a design pass, not a
repair. **The standard move is `@media (pointer: coarse)` growing hit areas
without touching the desk rendering** — orthogonal to width, since a tablet at
1024px is coarse and a laptop at 1024px is not. Recommended as its own small
round; `.slider` is the one that can grow its hit box invisibly
(`padding-block` + `background-clip: content-box`) and is the natural first.

---

## 4. What was landed

Exactly one, per the "objectively wrong rather than a design call" bar:

**W1 — `.note` bound to 56ch.** Derivation above. Inert on 17 of the 19
instances measured; takes the one defect from 160 CPL to ~68.

Everything else in this document is a finding with a recommendation, because
every other candidate either trades one breakage for another (N1) or moves
hand-tuned geometry (§3).

---

## 5. The breakpoint proposal

### What is there now

**11 responsive rules, 7 thresholds, no system:**

| Threshold         | Uses | Where                                                                                   |
| ----------------- | ---- | --------------------------------------------------------------------------------------- |
| `40rem` (640px)   | 3    | SiteChrome, ChromeOverlay, tools layout — **coordinated, cross-referenced in comments** |
| `620px`           | 1    | AtlasView (narrow)                                                                      |
| `47.5rem` (760px) | 1    | HelpAreaShell                                                                           |
| `1260px`          | 1    | AtlasView (wide)                                                                        |
| `min 1024px`      | 1    | Visualizers                                                                             |
| `min 1500px`      | 2    | Team Builder                                                                            |
| `min 1900px`      | 2    | Team Builder                                                                            |

⚠️ **`620px` vs `40rem` is the argument for a system, in one line.** AtlasView
goes narrow 20px _below_ where the chrome does, so there is a 20px band where
the chrome has dropped its wordmark and the Atlas has not. Nothing is wrong
enough to see; it is simply two numbers that were meant to be one.

⚓ 40rem is already a real breakpoint — three files, deliberately coordinated,
with comments pointing at each other. The system does not need inventing so much
as **naming what already exists and absorbing the strays into it.**

### ⚠️ The constraint that shapes the answer

**CSS custom properties do not work in media queries.** `@media (max-width: var(--bp-compact))`
is invalid. So the layer law's usual mechanism — a token nobody may bypass —
is not available here, and `@custom-media` is not shipped in browsers.

⛔ **This is why the proposal is not "add breakpoint tokens".** It cannot be.

### The proposal: a named table + a grep guard

This project already enforces the layer law by **grep, in a vitest file**
(`timelineExport.mirror.test.ts` asserts no component names a primitive). The
same mechanism fits exactly:

1. **One documented table**, in `app.css` beside the palette census, giving each
   threshold a name and — critically — **the measured content fact that put it
   there**, so the next person changing one knows what they are changing.
2. **A vitest guard** that greps `src/` for `@media` width conditions and fails
   on any value not in the table.

Proposed set, each derived from a measurement in this document:

| Name       | Value               | The content fact that sets it                                                                                                          |
| ---------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `compact`  | **40rem / 640px**   | Already coordinated across 3 files: where the chrome drops its wordmark. **Absorbs AtlasView's 620px.**                                |
| `roomy`    | **47.5rem / 760px** | HelpAreaShell's existing stop; also where `.doc-tabs` stops clipping (~700)                                                            |
| `tool-min` | **54rem / 864px**   | ⚓ **The planner's measured minimum** (shell clips at 800, fits at 900; true fit ~852). **Absorbs `min 1024px`?** — see open question. |
| `broad`    | **1500px**          | TB tile density (existing, 2 uses)                                                                                                     |
| `vast`     | **1900px**          | TB tile density (existing, 2 uses)                                                                                                     |

**Retired by absorption:** `620px` → `compact`. **Needs a decision:** `1260px`
(AtlasView wide) and `min 1024px` (Visualizers second column) do not map onto
anything measured here — they are each one rule, and each may be a genuine
instrument-specific stop rather than a site breakpoint. ⚠️ **A system that
forces a real content stop onto a wrong shared number is worse than the strays
it replaces** — so the honest proposal keeps them until someone can say what
content fact sets them.

### The other axis

`pointer: coarse` is **not a width** and must not be folded into the table. §3's
findings want one `@media (pointer: coarse)` block, and a tablet at 1024px is
the case that proves the axes are independent.

---

## 6. The classification, as [[mobile-conversion-plan]] asked for it

| Surface              | narrow                                | wide           |                                         |
| -------------------- | ------------------------------------- | -------------- | --------------------------------------- |
| Landing              | ✅ workable at 320                    | ✅ bounded     | composition work only (§11)             |
| Static + help pages  | ✅ workable at 320                    | ✅ bounded     | —                                       |
| **Visualizers**      | ✅ **workable at 360**                | 🔶 W1 (landed) | the surprise of the survey              |
| **Team Builder**     | 🔶 **fixable** — shell 562, Atlas 800 | ✅ bounded     | N3 decides where the cut sits           |
| **Rotation Planner** | ⛔ **needs space — ~852px**           | ✅ correct     | better than feared: a laptop number     |
| Tool chrome          | ⛔ **N1, below ~480**                 | ✅             | decide **with** the small-screen notice |

⚓ **The survey's actual conclusion, against the expectation on record:** it is
not "everything but the planner is workable". It is that **the landing and the
static pages — the surfaces §5 says have to carry a shared link on a phone — are
already there**, the Visualizers unexpectedly join them, the planner's cut is a
tablet rather than a desktop, and the two genuine defects (N1, W1) are both
small and neither is what anyone was watching for.

⏭ **What this unblocks:** the pre- vs post-launch-flip call on §5 now has a
number attached to it. The small-screen notice needs exactly one decision —
**where does it cut?** — and N1 and N3 both resolve as consequences of it rather
than as separate work.

---

# Part II — the workability analysis (2026-09-01, answering Nate's five questions)

⚓ **The five questions turned out to be one question with an arithmetic answer**,
so this part is measurement, not opinion. Every number below was taken by
simulating the proposed change as a CSS patch against the production build and
re-running the width ladder.

## 7. ⚓⚓ The finding that reframes the whole round

**The planner's 852px minimum is not the Gantt chart. It is furniture.**

Walking the min-content chain inside `.tool-shell` at 390px:

```
div.tool-main = 852
 └ div.tool-page = 836
    └ div.tool-stack = 836
       └ div.bands = 596
          └ div.band.band-b = 596
             └ div.band-zone--end = 564
```

Decomposed:

| Term                       | px       | What it is                                              |
| -------------------------- | -------- | ------------------------------------------------------- |
| Bench inset (`TOOL_INSET`) | **~240** | `RIBBON_W` (`BENCH_CARD_W` 200 + chrome) + `RIBBON_GAP` |
| **Band B's end zone**      | **~260** | zoom slider + Reset zoom + notes + log + layers         |
| The actual timeline        | **~360** | and it **scrolls**, so it has no real minimum           |

⚓ **The Gantt was never the problem.** The timeline is a horizontal scroller —
it is content-agnostic about width. What sets 852px is a 240px reserved column
and a 260px row of controls, and **both are things this round proposes to
move.**

### The simulation — each proposal applied and re-measured

|                              | Rotation Planner | Team Builder |
| ---------------------------- | ---------------- | ------------ |
| Today                        | **860px**        | **620px**    |
| + horizontal bench           | **620px**        | **360px** ✅ |
| + aside/rail as a modal      | 620px            | 360px        |
| + band B collapsed to a menu | **360px** ✅     | 360px ✅     |

⚠️ **360px is the floor of the ladder, not a measured limit** — both tools stop
clipping before the narrowest width tested, so the true minimum is lower.

⚓⚓ **Two changes, and both tools reach phone width.** The Team Builder needs
only ONE of them.

---

## 8. Question by question

### 8.1 Visualizers — "maximize the space available to the panels"

⚓ **Your instinct is right and the current split is the opposite of it.**
Measured with the workspace forced to one slot:

| viewport | slots    | tile     | chart    | panels     | dead space in the panel row |
| -------- | -------- | -------- | -------- | ---------- | --------------------------- |
| 1600     | auto (2) | 752      | 752      | 368 ×3     | — (they wrap)               |
| 3440     | auto (3) | 1104     | 1104     | 357 ×4     | ~1104 − 1428 → wraps        |
| **3440** | **1**    | **3376** | **3376** | **361 ×4** | **~1930px**                 |
| 2560     | 1        | 2496     | 2496     | 403 ×4     | ~880px                      |

**The instrument gives 100% of surplus width to the chart and 0% to the
apparatus.** At one panel on a 3440 display the chart is **3376px wide** and the
four panels sit in a row with **~1930px of nothing beside them.**

⚠️ **Whether a 3376px chart is a gift or a defect depends on the instrument, and
that is the whole design question.** A time-series (ICD timeline, gauge
explorer) genuinely converts width into resolution. A 2D plot (crit heatmap,
wish odds, reaction curves) at 3376 × ~600 is a terrible aspect ratio — it is
not showing more, it is showing the same thing stretched.

**So the reevaluation has a shape:** surplus width needs a _destination policy_
per instrument, not one rule. Candidates the numbers support —

- **Cap the chart's aspect ratio** on the non-time-series instruments and give
  the surplus to the panel column (panels beside the chart rather than under it,
  or two panel columns).
- ⚓ **The `.note` fix landed in Part I is the first instance of this same
  principle** — prose was inheriting tile width and gaining nothing. Charts that
  are not time-series are the second instance.
- ⚠️ `--ws-slots` already lets a user pick 1..MAX_SLOTS manually, so the
  one-panel-wide case is **reachable today** and is the worst case for this. It
  is not hypothetical.

### 8.2 Site chrome — the compass, and keeping `critcalc.app` on a phone

**Yes, the wordmark can stay on mobile — comfortably.** The exact atoms at
≤40rem: padding 12 ×2, track gap 8 ×2, logo 63, brand gap 5.6, wordmark 136,
`.chrome-btn` 34, actions gap 6.4.

| Config on a 320px viewport                                     | Width     | Fits 320? | Fits 390? |
| -------------------------------------------------------------- | --------- | --------- | --------- |
| wordmark + logo + **4** icons (compass added to today's three) | 399.8     | ✗ −80     | ✗ −10     |
| wordmark only (no logo) + 4 icons                              | 331.2     | ✗ −11     | ✓         |
| wordmark + logo + **3** icons                                  | 359.4     | ✗ −39     | ✓ +31     |
| wordmark + logo + **2** icons                                  | 319.0     | ✓ +1      | ✓         |
| ⭐ **wordmark + logo + 1 compass**                             | **278.6** | ✓ **+41** | ✓ +111    |

⚓ **The recommendation is the last row: on narrow, ALL navigation collapses into
the one compass** — tool switching _and_ About/Help/Settings. They are all
navigation; splitting them across a compass and three separate glyphs spends
120px to make a distinction the phone user does not need. You get the full
wordmark, 41px of slack at 320px, and the overlay can present the three tools
with descriptions instead of three cramped links — **better than the desktop
nav, not a degradation of it.**

#### The structural fix — why it is currently fragile

`grid-template-columns: 1fr auto 1fr`. ⚠️ **The two occupants that must never
disappear are on the flexible tracks, and the one that could safely collapse is
on the rigid one.** That is exactly backwards, and it is the whole of N1.

The `1fr` flanks are not an accident — the comment says they exist to keep the
nav centred **on the strip** regardless of flank widths, which is right. So the
fix must preserve centring while refusing to crush:

```css
grid-template-columns: minmax(max-content, 1fr) auto minmax(max-content, 1fr);
```

⚓ **`minmax(max-content, 1fr)` keeps the centring behaviour exactly** (both
flanks still resolve to equal `1fr` whenever there is room) **and makes the
flanks incompressible when there is not.** The centre then overflows instead of
the brand vanishing — and with the compass, the centre is _empty_ below the
compact breakpoint, so that overflow case never arises at all.

Three rules, in priority order, is the rock-solid statement:

1. **Brand never shrinks and never disappears.** It is the home link.
2. **The action cluster never shrinks.** Fixed-size hit targets.
3. **The centre is the only collapsible occupant**, and below `compact` it is
   empty because its content lives in the compass overlay.

⚓ **`ChromeOverlay.svelte` already is this component** — full-screen backdrop,
panel, an `is-wide` variant, and its own `max-width: 40rem` handling. The
compass reuses it; nothing new is invented.

### 8.3 The horizontal bench — how much it buys, and the height to aim for

**It is worth 240px on the planner and 260px on the Team Builder**, and it alone
takes the TB from 620 → 360.

⚓ **The architecture already supports it**: `ToolStack` sets
`--stack-inset = benched ? TOOL_INSET : 0`. The horizontal arrangement is a flag
plus a bench layout, not a rebuild.

**The height to aim for.** Measured vertical budget on a 390×844 phone:

|                                       | px                                            |
| ------------------------------------- | --------------------------------------------- |
| `--chrome-h`                          | 64                                            |
| bands (A 29 + gap 4 + B 36 + padding) | 93                                            |
| **→ tool starts at**                  | **157**                                       |
| `--tool-pad-bottom`                   | 24                                            |
| **available to the tool**             | **663** (confirmed: `.tc-main` measures 663h) |

The current bench card is **200×78** in the TB and Visualizers, 200×122 in the
planner. ⭐ **Aim for ≤88px including its gap** — that keeps chrome + bands +
bench under **250px, under 30% of the viewport**, leaving the tool ~577px. For
scale, the planner's ruler strip (ruler + aura lane) is 135px, so 577 leaves the
ruler plus roughly ten track rows.

⚓ **Keeping the existing 78px card height works** — it needs no new height, only
a new _width_: four cards across 366px of usable width is **~87px per card**
against today's 200px, so the card has to become genuinely compact horizontally.

⚠️⚠️ **The caveat that matters, and it argues against doing this on desktop.**
A horizontal bench trades the planner's _abundant_ axis for its _scarce_ one.
CLAUDE.md already records the planner's vertical as tight — `--tool-pad-bottom`
was cut to 1.5rem and the 24px it freed was immediately spent on `AURA_PLOT_H`,
with the note that "the next 24 come out of track rows", and that at 1080p a
heavy four-character rotation was already ~30px into a page scroll _before_ that
trade. **Adding 78–88px of permanent vertical furniture on desktop spends
exactly the budget that is already short**, and buys 240px of an axis where the
timeline already scrolls.

⭐ **So: orientation should be responsive.** Vertical ribbon on desk (where
horizontal is cheap and vertical is dear), horizontal bench below the tool
breakpoint (where the reverse holds). The `benched` flag is already the seam.

### 8.4 Filter column / Notes / Log as a band-B modal

⚠️ **This one buys 0px of minimum width — and that does not make it wrong.**

The simulation shows no change at narrow, for a simple reason: **the aside does
not render at narrow widths at all** (the TB's rail is bound to
`sourceTab === 'roster'`, and the planner's is opt-in). So there is nothing to
reclaim at 360px.

Its value is at **desk and tablet widths**, and there it is large. `ASIDE_W` is
**262px**, and on the Roster view:

| viewport | rail on (today)           | rail off + horizontal bench |
| -------- | ------------------------- | --------------------------- |
| 768      | **1 column**, 206px tiles | **5 columns**, 137px tiles  |
| 1024     | 3 columns                 | **7 columns**               |
| 1600     | 6 columns                 | **9 columns**               |

⚓ **At 768 the Roster is one card per row for a 123-character roster.** Your
framing — "never stays on-screen when using the Roster" — is exactly the right
one: this is not a width-minimum fix, it is a **browsing-density** fix, and it
roughly quintuples the roster you can see on a tablet.

🐛 **And it surfaced a live defect worth its own line: below ~768px you cannot
reach the Roster at all.** Band B's buttons are past the right edge, so the
Atlas/Roster/Compare switch is unclickable — the automated pass could not click
"Roster" at 320, 360, 390, 430 or 560. **The TB is not merely cramped below 768;
it is stuck on whichever view it opened with.** That is another consequence of
§8.2's missing priority rule, one band down.

### 8.5 Team Builder character cards — is a smaller variant needed?

⚓ **Almost certainly not.** `--cg-tile-min` is **118px** today, with `@media`
step-ups to 150 at 1500 and 168 at 1900. With the bench and rail gone, the grid
at a 390px phone has ~354px to work with and a 9.6px gap:

| columns | tile width needed |
| ------- | ----------------- |
| 2       | 172px             |
| **3**   | **111.6px**       |
| 4       | 81px              |

So at today's 118px floor a phone gets **2 across at 390px and 3 across at
430px** — it misses 3-across at 390 by **19px of grid width, or 6px of tile.**

⭐ **Dropping `--cg-tile-min` from 118 → ~110 buys 3-across at 390px**, and the
card renders at 131px in shipping configurations already (bench-off at 1024), so
110 is a 16% reduction from a size that exists rather than a new design.

⚠️ **But it goes below a floor you set** — [[project_tb_card_round]] records
7-across-at-150 as the calibration point and 118 as the declared minimum — so
whether the card survives at 110 is your eye, not my arithmetic. **The useful
framing: this is a token nudge to test, not a card variant to design.** Try 110;
if the card breaks, 2-across at 390 is still a working roster, and 3-across
arrives at 430 either way.

---

## 9. ⚓ The verdict on the real question

**Do not cut losses at tablet. The mobile cutoff is a choice here, not a
constraint — and it is cheaper than it looked.**

|                  | today  | after the two structural changes          |
| ---------------- | ------ | ----------------------------------------- |
| Visualizers      | 360 ✅ | 360 ✅                                    |
| Team Builder     | 620    | **360** (needs only the horizontal bench) |
| Rotation Planner | 860    | **360** (needs the bench _and_ band B)    |

⚓⚓ **The reason the earlier estimate was pessimistic is that it attributed the
planner's width to the Gantt.** It isn't the Gantt — the timeline scrolls. It is
a 240px reserved column and a 260px control row, and both are furniture this
round already wants to move for independent reasons.

**What that means for §5's "reachable, not converted" decision:** the trilemma
it named — overflow / shrink below touch size / remove elements and change what
the tool _is_ — **does not bind the way it was framed.** Nothing here removes a
capability. The bench still holds four characters, the layers still toggle, the
filters still filter; they change _arrangement and disclosure_, not function.
The one genuine loss is that a phone shows less timeline at once, which a
scrolling chart already handles.

⚠️ **The honest remaining cost is touch, not layout.** Part I §3 stands: 10–17
live controls per tool are under 24px **at every width**, and a phone build
makes that a usability floor rather than a comfort question. **That, not width,
is what would make a phone planner feel bad** — and it is a `pointer: coarse`
round plus a pass over hand-tuned geometry, which is Nate's eye and not
arithmetic.

⭐ **Recommended order, cheapest-first, each independently shippable:**

1. **Chrome priority + compass** (§8.2) — fixes N1, unblocks everything below it,
   and is the most urgent by your own read. Small.
2. **Band B collapse** (§8.4's defect) — the TB is _stuck on one view_ below
   768px today. This is a bug fix before it is a mobile feature.
3. **Horizontal bench, narrow-only** (§8.3) — the 240/260px unlock.
4. **Aside as a modal** (§8.4) — the tablet browsing-density win.
5. `pointer: coarse` pass (Part I §3) — the thing that decides whether a phone
   build feels good rather than merely fits.
6. Visualizers panel/chart policy (§8.1) — the wide-screen half, independent of
   all of the above.

⚠️ Items 1–4 are layout and measurable. Item 5 is taste and is the one that
actually gates "is this good on a phone".
