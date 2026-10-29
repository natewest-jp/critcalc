# The MOTION round — ✅ SHIPPED, merged `9ec6c10` (⚠ cite the MERGE, not the branch tip)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

**Four commits:** `2b9345f` the vocabulary + five surfaces · `4117738` the
scroll-fade fix (see the bug section) · `1a6463a` the chrome fold + `--t-move`'s
first resident · `646a43b` **the recut onto SIZE** (read that section first).

⚓ **Nate's brief:** _"an inventory of every interaction that currently snaps, a
single shared duration/easing pair, and `prefers-reduced-motion` honoured
throughout — so it lands as one vocabulary rather than fifteen scattered
transitions."_

**Status 2026-08-12:** ✅ merged to main, **not pushed**. All gates green
(vitest 1329 · check 0 · lint · build · `test:e2e` **68+68 both engines**).
⚓ **Nate confirmed the split** — _"the new split on transitions is the right
one… modals read better at --t-quick. This is definitely the split to keep"_ —
and ✅ **cleared real Safari**, including `@starting-style` +
`transition-behavior: allow-discrete` on the planner Source overlay.

🐛 **`test:e2e` chains its two legs with `;`** — the Chrome tally scrolls past a
`| tail`, and only WebKit's exit code survives. **Grep for `passed` and confirm
BOTH `68 passed` lines**, or a half-green run looks whole. (Separate from the
known playwright#39753 worker force-kills, which are what stretch Chrome's leg
to ~5.7m.)

## ⚠⚠ THE VOCABULARY — THE AXIS IS **SIZE**, NEVER CAUSE

In `app.css` § MOTION. **The first cut of this round got the axis WRONG and had
to be recut** (`646a43b`) — that failure is the most useful thing here, so do
not re-derive it.

**v1 banded by CAUSE** ("is this on the click path?"). It predicted buttons —
hover states — wanted the _slower_ band and modals — summoned — wanted the
_faster_ one. ⚓ Nate came back with **both backwards**: _"buttons need
--t-snap… the edge border at the quick speed does read a bit like that latency
you described"_, and modals read nicely slower.

**v2 bands by SIZE — how much screen the change occupies.** This is also the
field's rule, reached from the other direction: Material _("larger elements take
longer")_, IBM Carbon _("the larger the change in distance or size, the longer
the duration")_, Apple HIG. **Nobody in the industry bands by causality.**

🔑 **WHY, physically — the sentence to keep:** a control's change is a HAIRLINE
on an object you could cover with a fingertip, and the eye resolves a 1px edge
instantly, so a ramp on it is perceived as **SMEAR** — the border looks like it
is catching up with you. A panel's change is a broad area of low-contrast alpha;
the eye integrates it and it needs real time to read as _arriving_ rather than
popping. **Same milliseconds, opposite verdicts.**

| token       | value        | what it is                                                                                                                                                  |
| ----------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--t-snap`  | `120ms ease` | **A CONTROL** — every button, chip, tab, link, field, pip, tile, card, small mark. ~60 declarations / 17 files. Hairline edges: go fast or it reads as lag. |
| `--t-quick` | `150ms ease` | **A SURFACE** — modals + their scrims, popovers, menus, the Source takeover. Broad soft changes that want to be SEEN to move.                               |
| `--t-move`  | `240ms ease` | **TRAVEL** — crossing a distance because a STATE changed. ONE resident: the toggle thumb.                                                                   |

⚠ **THE SITE CHROME IS A REAL EXCEPTION, not an oversight** (⚓ Nate looked:
_"site chrome is good to stay at --t-quick"_). The brand marks are small, so
size says snap. What the rule misses is **AMPLITUDE** — they travel 0.85 → 1.0
alpha, slight enough that there is no edge to smear, so the ramp reads as
ambient brightening rather than as a control answering you. _Size is the rule;
amplitude is why this one files under surfaces._ (SiteChrome ×3 + CloseMark +
`.chrome-nav-link`.)

⚠ **Links are CONTROLS** — `.prose a` transitions a `border-color`, the hairline
case exactly.

### ⚠⚠ The `--t-move` test is NOT "does it animate a transform"

⚓ **Nate 2026-08-12**, after the census showed the band had zero consumers.
Measured that day, and the REJECTED candidate is the useful half:

- ✅ **`.toggle-thumb`** travels **1.05rem** across its track on a state flip →
  `--t-move`. Its **colour stays with the track on `--t-snap`** (both are
  controls) — colour is not travelling, it changes in place at the same moment
  the track's does, and the two must land together. _One colour event, one
  movement, two clocks._
- ⛔ **AtlasView `.rolecard`** was proposed as the other resident (I described
  it as "a card lift"); it is a **2px hover nudge**. 240ms there reads as the
  card LAGGING YOUR MOUSE — the perceived-latency cost this round's own model
  warns about. **A hover lift is an AFFORDANCE and must keep up with the
  pointer** — which makes the card a CONTROL, so post-recut it sits on
  `--t-snap`. Same for `.rp-explore-arrow`'s 2px nudge. The argument is written
  out at `.rolecard` so the rule doesn't look like an oversight.

⚓ **Nate ruled** on three-bands and on keeping `ease`. **A token is a duration
AND its easing, one value** — one easing exists in the product; a second axis
would double every call site for a distinction nobody asked for.

⚠ **Mirrored in `src/lib/motion.ts`** (`T_SNAP`/`T_QUICK`/`T_MOVE`) — a
hand-synced pair, because CSS cannot hand a number to Svelte's `transition:`
directive. Both files' comments name the other.

⛔ **Not for the scene.** `TOOL_NAV_MS`, the camera crane, the star clock, the
veil, the world-locked tool fade — Nate-tuned, own clocks. See
`docs/rounds/bench-band-round.md`, `docs/rounds/scene-star-freeze.md`.

## ⚠⚠ REDUCED MOTION IS A MECHANISM NOW — do not go back to enumerating

**Zero the TOKENS in one `:root` block.** That is the whole implementation, and
it covers rules that don't exist yet.

The old way was a _habit_, not a mechanism: ten files each listing the
selectors they happened to know about, honoured only if the next person
remembered to amend a block elsewhere. **Ten components had NO reduce path at
all** (SlotPortrait, DetailCard, BandMenu, InstrumentPicker, CharacterCard,
LoadoutPanel, RotationTimeline, AtlasView, CompareView, the TB page).

**Seven** now-duplicate blocks were retired. **Three things the token zeroing
cannot reach**, each keeping its own path — and these are now the ONLY things
in `src/` honouring the preference by hand:

- **keyframe `animation`s** — `pulse-confirm`, `cv-dot-in`. A duration token has
  nothing to say to `@keyframes`. This is why that one `app.css` block lives.
- **the scene/nav machinery** — has `prefersReducedMotion()` in
  `$lib/landing/transition.ts`.
- **Svelte's `transition:` directive** — JS, cannot read a custom property.
  Route every duration through `motion()` from `$lib/motion`.

## 🐛 THE OUTRO HAZARD — the bug this round found and fixed rather than spread

**A fading-out overlay is still in the DOM.** A full-screen dismiss backdrop
that outlives its own visibility **eats the next click** — the
press-what-you-can-see shape from `docs/rounds/bench-card-round.md`. At 120ms it is
rare enough never to be reported and often enough to feel like a dropped input.
**ChromeOverlay had shipped this since it was built.**

The fix is `inert` — one word that kills pointer events and focus together:

```svelte
<div transition:fade={{ duration: motion(T_QUICK) }}
     onintrostart={introLive} onoutrostart={outroInert}>
```

⚠ **The `introLive` half is load-bearing.** Svelte runs the intro when a reopen
INTERRUPTS an outro; without it a fast toggle leaves the surface permanently
dead.

## What gained motion (⚓ Nate's scope) — and the shape of every one

**Fade only.** Every one of these is viewport-fixed off a measured, fractional
coordinate, so a scale or slide would be a **second transform** over exactly
the geometry `docs/design/subpixel-rendering-laws.md` warns about. A fade ends at
opacity 1, so the transient rasterization is 120ms and the resting state clean.

1. `SlotPortrait` constellation + loadout popovers **and their backdrop**
2. `DetailCard` — and see below
3. `BandMenu` · 4. `InstrumentPicker` (deliberately identical: two copies of
   one shape should not arrive differently)
4. The planner **Source overlay** — special, see below

**`DetailCard` and `ChromeOverlay` are the same modal register** (scrim + raised
panel, three dismissals) and only one faded. That was never a decision, just
the modal that got missed. Both on the band now; ChromeOverlay's hand-written
`140` folded in.

### The Source overlay — fades IN, deliberately does NOT fade out

⚠ The frame under it carries `--picking`'s **26rem min-height**, which is the
**layout tier** and cannot be faded alongside. An out-fade leaves a ghost —
`inset: 0`, so it re-fits itself — shrinking onto a collapsing frame.

- `hidden` attribute → a **class**, so it can carry `@starting-style`.
- ⛔ The shut state **stays `display: none`**. `visibility` would leave 122
  cards in layout on every zoom of a timeline they are not on screen for.
- `transition-behavior: allow-discrete` on `display` is there for the **ENTRY**,
  not the exit — crossing out of `display:none` is what makes it a first
  render, and the pairing is the documented form of that crossing.
- ⚠ **`transition: none` on the `--shut` rule IS the instant exit.** A
  transition is driven by the AFTER-change style, so out reads `--shut` and
  back-in reads the base rule — one element, fade in, snap out, no second class.
  **Drop that line and `allow-discrete` defers `display:none` to the end of the
  fade**, leaving the picker fully opaque for 120ms after dismissal.

## ⏭ THREE EXPLORATIONS — costed 2026-08-12, NONE built

⚓ Nate asked for realistic assessments of these. Recommended order **3 → 1 → 2**.

**3. The rotation/team TAB SWITCH jump — ✅ DONE on `fix/tab-prewarm`
(`a06b785` + `eb531fd`), green on all gates incl. e2e 68+68, ⏸ unmerged.**
⛔ NOT a motion problem, and the fix confirmed it. ⚓ Nate diagnosed it himself: _"there's a loading
jump if you're clicking on a tab for the first time… should we preload/warm all
currently open tabs' characters?"_ **Yes.** A fade over a variable-length wait
is the classic mistake — it slows every fast switch and does not fix the slow
one. `prewarmPlannerCharacters` (`(tools)/lib/prewarmPlanner.ts`) already exists
and warms **only the ACTIVE tab** at navigation start, which is exactly why a
first-time switch stalls. `loadCharacter` is already idempotent + cached +
dedupes in-flight, so this is a small extension of working machinery.
**MEASURED result:** a cold switch to a never-opened tab issued **2** new chunk
requests before and **0** after; load+warm went 52 → 56 chunks, exactly the
background tabs' four characters moved off the click path. Payloads are ~13KB
median (133 chunks, mean 14.8KB, max 116KB).

🐛 **TWO TRAPS IT COST, both worth keeping:**

- ⚠⚠ **A CHILD's `onMount` RUNS BEFORE ITS PARENT'S.** The tabs are restored by
  the **(tools) LAYOUT's** onMount, so warming from the planner page's onMount
  read the DEFAULT single empty tab and warmed nothing — the bug it was meant
  to fix, still measurable. Use an `$effect` gated on `rt.restored`: robust
  whichever way the ordering falls, and it also covers landing on another tool
  first, where the layout mounted long ago.
- ⚠ **`requestIdleCallback`'s `timeout` is an instruction to run EVEN IF BUSY** —
  the opposite of "speculative". ⛔ Do not copy warmAvatars' `{ timeout: 400 }`
  for speculative work: warmAvatars needs it because those images are wanted by
  the very grid that is busy; a tab-switch payload is not. **Starving until the
  page settles is CORRECT**, and true idle was measured sufficient (still 0
  requests on a cold switch).

Also de-duplicated `slotsFromNotation()` — the notation→slots resolution had
TWO copies (`autoSlots` + a hand-rolled mirror in prewarmPlanner) and this
needed a third.

**1. TB view fades (Atlas / Roster / Compare) — yes, ~an hour.** ⚠ Do it as
fade-**IN only** on the incoming view, ⛔ NOT a cross-fade: the three views have
different heights and `sourceFills` differs per view, so overlapping them fades
a ghost onto a resizing box — the same trap that makes the Source overlay snap
out. The Roster is already `hidden`-toggled, so it needs the identical
`@starting-style` + `allow-discrete` treatment.

**2. The SLIDING nav plate — ⏭ STILL UNBUILT, the one thing left from this
list. More tractable than it sounds, because the pattern already exists.** ⚓ Nate: _"like the site navigation"_ — and that is literally
`.chrome-nav-underline` in `(tools)/+layout.svelte`: one measured bar gliding
between links on `transform` + `width`, with `SLIDE_MS`/`SLIDE_EASE`, a
pre-measure fallback and a reduced-motion guard. Port it.

- ✅ Animating `width` is fine here despite being layout tier — a single empty
  element with no content to relayout, same as the underline.
- ⚠ **The TEXT COLOUR is the real problem**, not the plate. Active is navy-on-
  parchment, inactive light-on-glass, so labels must invert as the plate
  passes. CHEAP: each label cross-fades its own colour on `--t-snap`,
  independent of the slide (both briefly mid-tone; invisible at this duration).
  EXPENSIVE: duplicate the nav row inside the plate and clip it, so ink inverts
  exactly at the plate's edge — elegant, and a rabbit hole.
- ⚠ **The Compare tab's WIDTH CHANGES** as picks accumulate
  (`width: 24 + (n-1)*16`), so the indicator must re-measure on stack length,
  not just on tab change.

## Deliberately NOT done — judge the five above first

- TB **Atlas/Roster/Compare** swap, the planner **aside occupant** swap, the
  **Viz tile** swap. All viable as CONTAINER cross-fades (⛔ never per-item —
  123 cards, see `docs/rounds/portrait-loading-diagnosis.md`). Deferred by ⚓ Nate's
  scope ruling, not by any obstacle.
- The **TB aside column appearing** (`ToolColumns`) — a real layout change
  (main box narrows). Expensive tier.
- ⚠ **`AnatomyInstrument` animates `flex-grow` (220ms) and `width` (180ms)** —
  the LAYOUT tier the Laws now ban outright. Real, pre-existing, found in the
  sweep. Visualizers work, not motion work.
- ✅ **RESOLVED** — `SiteChrome` + `CloseMark`'s private 200ms **folded into
  `--t-quick`** (⚓ Nate 2026-08-12), and they STAYED there through the recut as
  the documented amplitude exception. ⚠ The **chrome state contract is NOT
  weakened**: its anchored part is the **0.85 → 1 ALPHA pair**, untouched. The
  tell that the duration was never really part of it — the four marks did not
  even agree, `.chrome-nav-link` having been 150 all along.

## The cost model — settled, do not re-derive

- **Free** — `transform`, `opacity`. Composited.
- **Cheap** — `background-color`, `color`, `border-color`, `box-shadow`.
- ⛔ **Expensive — LAYOUT**: `width`, `height`, `top`/`left`, `margin`,
  `padding`, `font-size`, `grid-template-*`. Never on the planner timeline
  (hundreds of absolutely-positioned bars).

The real costs are **not** frame time: perceived latency (a fade on something
opened constantly makes the tool feel SLOWER), interruption correctness, and
compositing layer count at roster scale.

## 🎬 @starting-style — the entry pattern, and its ONE trap

The idiom for fading in something that mounts, or that crosses `display:none`:

```css
.thing {
	opacity: 1;
	transition: opacity var(--t-quick);
}
@starting-style {
	.thing {
		opacity: 0;
	}
}
```

- It reaches **both** cases: a newly INSERTED node and one merely crossing
  `display:none → displayed` both count as "first rendered". One rule covers a
  mounting view and a revealed one alike (the TB's three views prove it).
- For the display-crossing case, pair it with
  `transition: display var(--t-quick) allow-discrete` — the documented other
  half of that crossing.
- ⚠ **`transition: none` on the SHUT rule IS the instant exit.** A transition is
  driven by the AFTER-change style, so hiding reads the shut rule and revealing
  reads the base one — one element, fade in, snap out, no second class. Drop it
  and `allow-discrete` starts DEFERRING `display:none` to the end of the fade,
  leaving the thing sitting there opaque after you dismissed it.
- ⚠ It does NOT require a class. @starting-style matches the ELEMENT, not the
  toggled state, so a `[hidden]` attribute works fine (an earlier note in
  RotationTimeline claimed otherwise and was wrong).

### ⚠⚠ THE TRAP: @starting-style ties on SPECIFICITY, so SOURCE ORDER decides

It carries the **same specificity** as the equivalent normal rule. So a later
normal declaration of the same property **wins the STARTING style too**, the
transition runs 1 → 1, and nothing moves — silently, with no error anywhere.

Measured in WebKit on the TB roster: it needed its own rule (to add
`display … allow-discrete`), that rule sat after the @starting-style block, and
an `opacity: 1` restated in it flattened the fade. Atlas ramped 0.00 → 0.96 over
eight frames while the Roster sat at 1.00. 🔎 **Symptom to recognise: one
element fades and its sibling doesn't, with identical-looking CSS.**

## 🐛 A BUG FOUND THIS ROUND — an unclosed comment silently deletes the NEXT rule

⚓ Nate: _"the roster of character cards lost its gradient mask edges, while the
rotation planner still has its left/right fade edges."_ Fixed in `4117738`.

**`scrollFade` was working perfectly the whole time** — correctly setting
`--scroll-fade-bottom: 36.00px` on `.cg-scroll`. The rule that READS it was
never in the stylesheet. `a360fd3` (retire 1.5px borders) closed a comment at
the end of its new argument and never reopened for the paragraph after it,
emitting four lines of prose as literal CSS:

```
.frame{background:var(--frame-bg)}⚠ The bench ribbon does not read
--inset-stroke at all: … move the other. */ .scroll-fade{
```

That fuses into one unparseable selector and **takes the whole next rule down
with it**. `.scroll-fade-x`, three lines below, survived — the parser recovers
at the following rule. _That asymmetry was the entire shape of the report._

⚠⚠ **THE LESSON, and it generalises well beyond this fix:**

- **A malformed comment in `app.css` deletes the rule that follows it, silently.**
  Svelte parses component `<style>` blocks and would reject this on sight;
  `app.css` goes through Vite/PostCSS, which is lenient about garbage between
  rules. **No gate catches it** — vitest, check, lint and build were all green.
- **A dropped CSS rule is invisible, not loud** — the exact property
  `scrollFade`'s own header warns about ("a missing mask is invisible, not
  loud"). It shipped for a whole round before anyone saw it.
- 🔎 **How to find it fast:** strip comments programmatically and look for a
  `*/` left over. Swept every `.css` file and Svelte `<style>` block — this was
  the only instance. Worth re-running after any big comment edit in `app.css`.
- 🔎 **How to diagnose this class of bug:** ask the CSSOM which rules actually
  match (`document.styleSheets` → walk → `el.matches(rule.selectorText)`)
  rather than reading `getComputedStyle`. Computed style says "none" for both
  _overridden_ and _never-parsed_; the CSSOM distinguishes them. ⚠ When walking,
  test `rule.selectorText` BEFORE recursing into `rule.cssRules` — modern
  `CSSStyleRule` exposes an empty `cssRules`, so a `cssRules`-first walk skips
  every plain rule and reports nothing (cost me one probe).

## Traps still standing

1. **Element `opacity` on a transform-placed subtree DANCES in real Safari** —
   alpha in the PAINT. Fading IN is fine (ends at 1); a **resting** state below
   1 is not. `docs/design/subpixel-rendering-laws.md`
2. **Retargeting an in-flight CSS transition runs it on a SHORTENED clock.**
   Svelte's directive handles this; hand-rolled CSS toggles do not.
3. **Roster scale** — animate the CONTAINER, never the items.
4. **Pseudo-elements do NOT inherit their originator's transitions.** Animate
   ONE registered `@property` both re-resolve from (`--bb-act-fill`,
   `--sp-wash-a`).
5. **`backdrop-filter` mints a containing block** — anything escaping a band
   must portal.

Related: `docs/rounds/style-reference.md` (§ Laws now carries the bands, the layout
ban and the outro rule) · `docs/rounds/bench-card-round.md` ·
`docs/design/subpixel-rendering-laws.md` · memory `feedback_gate_cadence`
