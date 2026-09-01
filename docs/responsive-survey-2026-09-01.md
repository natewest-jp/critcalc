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
