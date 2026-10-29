# Landing hero cards — ✅ the design is FINAL (2026-09-21)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

⚓ **Nate, 2026-08-14:** _"The current design was just thrown together to make the landing look a little less dull during development — there's nothing about how they work now that we need to preserve."_ Aspect ratio, top-lighting, inset: **all disposable.**

⚠️ **Highest-stakes surface at launch.** It is what a shared link resolves to, what the OG card advertises, and — per the mobile call — the thing that must _sell on a phone_ even though the tools don't run there. See `docs/rounds/launch-roadmap.md`.

**Status (2026-09-21): ✅ NATE'S FINAL ARTWORK IS IN — MERGED `46688278` + PUSHED** (branch `polish/landing-card-artwork`, 4 commits, `--no-ff`; e2e 73 + 73 green). The plate is no longer a placeholder. Everything below is the shipped state.

### ⚓⚓ ONE PLATE, THREE ARTS — and the artwork owns placement

Source is `assets-src/landing/` (gitignored): `hero-card.svg` = the card shape + its inner line, identical on all three cards, so it lives once. `{astrolabe,ephemeris,observatory}.svg` = each figure + its decorative rings, **drawn on a copy of the same 511 × 919 artboard**. Copied verbatim into **`$lib/landing/heroArt.ts`** (⛔ `silhouettes.ts` is GONE).

- ⚓⚓ **That shared artboard is why `tools[].art` carries NO geometry.** The card back in each art file is Nate's positioning reference and is stripped on the way in; the figure's own coordinates say where it sits. ⛔ **Never reintroduce per-card `x/y/w/h`** — the old by-eye panel rebalancing (80/86/82) is retired, and nudging a figure is an Affinity edit now.
- ⚓ **`INSET_TRANSFORM` is GONE.** The inner line is a drawn BAND, so the even hairline gap is drawn, not faked by a per-axis scale solved for one proportion.
- ⚠️ **`fill-rule: evenodd` is LOAD-BEARING** — rings and the inner line are two-contour bands, and nonzero can fill them solid. ⛔ The old note that the silhouettes measured identical either way does NOT transfer to this artwork.
- ⚠️ **The aspect is the ARTWORK's now**: `--plate-w: 511 / --plate-h: 919` (1:1.7984) drive `--card-w`, `--card-h` and `aspect-ratio`. Within a pixel of the derived 1:1.8, so every size in the mobile derivation below still holds. A redraw at a new artboard = update those two literals.
- ⚓ Exports arrive clean: no transforms, no groups, no strokes. ⚠️ Nate's Affinity layer opacities are the COMPOSITED values (a group at ~10% is already folded into each child), so the file is the truth, not the layer panel's percentages.
- ⚠️ The Observatory has only TWO rings ON PURPOSE (⚓ Nate: rings balance a figure's empty middle, and it is the largest drawing). ⛔ Not a missing layer.

### ⚓⚓ THE CARD IS PAINT-ONLY — zero element opacity

Every alpha lives in `fill` / `fill-opacity` / a `color-mix` stop. ⚠️ The label block used to be element opacity `.85` with the rule's `.6` NESTED inside it; both are now `--ink-*` stops on `.hero` (kicker, rule at `.85 × .6 = .51`, chrome name). ⚠️ Each mixes a var resolving to a **LITERAL** — ⛔ a color-mix fed by a color-mix crashes WebKit.

**Resting → hover:** silhouette `--accent` → `--hero-lit` (full both) · kicker `--accent` 85% → `--hero-lit` · rule `--accent` 51% → `--hero-lit` 60% · name chrome 85% → chrome · inner line `--inset-line-quiet` → `--inset-line`. ⚓ **The rings NEVER move** (the artwork's fixed ladder — they are the figure's WEIGHT, not the card's state).

⚓ **`--hero-lit` (app.css, `= --gold-300`) lights what is the card's own CONTENT; the card's FRAME stays on the accent rung** and answers in density, so the border never competes with what it borders. ⚠️ It is a ROLE because the L0 law forbids a component naming a ramp — **grep-enforced by `timelineExport.mirror.test.ts`**, whose failure message is "reach for a ROLE, or add one". `--glass-plate` is the precedent for a landing-specific role in app.css.

### ⚠️⚠️ THE SAFARI TRAP AND ITS FIX (2026-09-21)

⚓ Nate, in real Safari: **the whole card danced — only during the 1px hover lift, never with the cursor still.** WebKit was re-rasterizing all that fine vector detail at each new sub-pixel offset, so every gold stroke crawled independently.

- ✅ **Fix: `will-change: transform` on `.hero`.** Promoting the element that ACTUALLY transforms hands the translate to the compositor — the artwork rasterizes once and is then just moved.
- ⛔⛔ **Never promote `.hero__plate` instead.** A promoted CHILD of a transform-animated parent is positioned at ROUNDED coordinates — that is the same snapping, and it would move the artwork relative to the label besides.
- ⚠️⚠️ **This is a SECOND mechanism, distinct from the sub-pixel law's opacity-subtree case**, and the opacity fix did NOT cure it. Symptom tells them apart: opacity subtrees dance whenever the card moves (the parallax controller re-places it **every frame the pointer moves**, ⛔ not only on hover); fine-detail re-rasterization dances only while a transform is actually animating.
- 🗒️ **The fallback if it ever returns: drop the 1px lift.** Hover is three paint changes now and carries the gesture alone; with no transform there is nothing to re-rasterize. ⚓ The code's own comment already concedes "the lighting change is what reads".

### The rest, as shipped

- ⚓ Dark glass fill, `--glass-plate` = slate-900 @ .9 (Nate's Affinity number); body FLAT (WebKit banding). ⛔ No gradient in the plate interior, ⛔ no filter on hover, ⛔ no light glass.
- ⚓ **BETA and the card kickers are ONE VOICE**: `--font-body` + `--fw-semibold` + `--ls-wider`, uppercase (⚓ Nate 2026-09-21). ⚠️⚠️ **They were mono at `--fw-bold` and that 700 FOLDED to 600** — IBM Plex Mono is a static 400/600 cut. Moving to the variable Plex Sans is what makes 600 a real weight. ⛔ Don't "restore" mono. BETA's colour stays `--chrome-tag` (⚠️ `--accent` is WHITE inside `.site-chrome`); it links to `/contribute` and hides below `compact`. The kicker keeps its compact tracking step-down (`--ls-wider` → `--ls-wide`).
- ⚓ The **status band** sits UNDER the cards at the group's width, well glass masked to nothing at both ends. `$lib/landing/announcements.ts` entries carry `expires`; ⛔ nothing renders when none is live. ⚠️ Keep the detail line in step with **`FRAMELESS_EXEMPT`** (`characterLint.test.ts`) — it records who left and when, so ⛔ never write that copy from memory. As of 2026-09-21: Odette (left 09-15) and the Cryo Traveler (09-20) are curated in full; `alyosha` is the only released character still frameless (`blank`/`lohen`/`sandrone`/`zibai` are the placeholder and pre-release).
- ⛔ **The TAGLINE IS CUT.** Cards at **46%**, feet at 69%.
- ⚓ **ONE VERSION for desktop and mobile** (⚓ Nate 2026-09-21) — ⛔ the two-outline (ornate + simplified) requirement below is RESOLVED and does not apply to this artwork.
- ⏭ Still Nate's: the announcements box wants a redesign ("I'll tell you what other changes I'd like down the road"); the portrait composition; the BETA explainer page.
- ⚠️⚠️ **Process lesson (Nate, "your designs lack refinement")**: turning one knob per message and grading each screenshot "holds" is not a design pass. Judge the WHOLE page — axis, type ladder, tracking (⛔ never tracked-out sentence-case sans), equal air — before committing, and give a real opinion when asked for one.
- ⚠️ `docs/rounds/hero-cards.md` describes the OLD card (blue toplight, 481×1240 plate) and is superseded.

---

## ⚓ The naming is SETTLED

| Card            | Tool             | Why                                                                                                                    |
| --------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Astrolabe**   | Team Builder     | a handheld instrument for _identifying individual bodies_ — who is this character, what can they do                    |
| **Ephemeris**   | Rotation Planner | a _table of predicted positions over time_. Beats "orrery" because you read exact numbers off a table, not off a model |
| **Observatory** | Visualizers      | the _house of many instruments_ — almost literally the eight                                                           |

⚓ **Nate corrected Ephemeris→Rotation Planner himself** (it was on Team Builder). The other two were then confirmed as already correct.
Emergent logic, worth keeping: **instrument → table → building**, or **identify → predict → examine**, in increasing scope — which is also the existing card order and the chrome switcher order, so nothing moves.

✅ The rationale comment and the `tools[]` array in `src/routes/(scene)/+page.svelte` were corrected on the experiment branch 2026-09-16 (the array had Astrolabe/Ephemeris SWAPPED for a month).

---

## ⚓ Aspect ratio: **1:1.8** — DERIVED, not chosen

Mobile width is the binding constraint; everything else follows.

1. **Card width is not a choice.** At a 360px viewport (safe Android floor), 16px side padding, 10px gaps: `(360 − 32 − 20) ÷ 3 = ` **102px per card**.
2. **Measure what must fit in 102px:** top finial 14 · art panel 82 (square, at 10% flank inset) · gap 8 · label block 44 (kicker wraps to 2 lines ≈22, name ≈17, gap 5) · gap 8 · bottom finial 16 = **172px**.
   _Measured, not guessed: at 102px wide with 8% padding you get 86px of text. "ROTATION PLANNER" at 8px mono wraps to ~40px + ~35px; "Observatory" — the longest fantasy name — is ~77px at 13px Bitter semibold, fitting on one line with 9px spare._
3. `102 : 172 = 1 : 1.686 ≈ **3:5**` — the _tightest_ packing, zero slack.
4. **Add ~7% air → 1:1.8.** Build to this.

⚠️ **1:2 is the airier fallback** if 1:1.8 feels tight while drawing; it still fits everywhere. For calibration the Zhongli reference card measures ≈**1:2.33** — airier because it is a collectible with one subject and deliberate empty cream; ours carries two labels and is a navigation target, so it wants to be denser.

### Interior grid (width 100 × height 180) — ⚠️ HISTORICAL

⚠️ This is the PLACEHOLDER plate's space, kept because it is how the proportions were derived. The shipped artboard is **511 × 919** and its interior is Nate's drawing, ⛔ not this table.

| Zone          | y           | x                             |
| ------------- | ----------- | ----------------------------- |
| Top finial    | 0 – 16      | full                          |
| **Art panel** | **16 – 98** | **10 – 90** → 80 × 82, square |
| gap           | 98 – 108    |                               |
| Label block   | 108 – 152   | 8 – 92                        |
| gap           | 152 – 160   |                               |
| Bottom finial | 160 – 180   | full                          |

### Sizes, with `--card-h: clamp(17rem, 46vh, 30rem)`

| Context             | Card      | Art panel | 3-card group |
| ------------------- | --------- | --------- | ------------ |
| Mobile 360px        | 102 × 184 | 82px      | 308px        |
| Mobile 390px        | 112 × 202 | 90px      | 338px        |
| Laptop (900px tall) | 230 × 414 | 184px     | 770px        |
| Max clamp           | 267 × 480 | 214px     | 881px        |

⚠️ **Max clamp is 30rem, NOT the old 40rem** — 40rem pushed the group past 1230px, too dominant on a 1440 screen.
⚓ **The two outline test sizes are 82px and 184px art panels.** If a silhouette doesn't read at 82px, simplify it further.

---

## ⚓ Mobile: THREE ACROSS AT EVERY WIDTH — ⛔ never rotate-and-stack

Nate proposed rotating the card 90° and stacking vertically on mobile (the shape is Y-extendable only, since the decoration lives at the top/bottom ends and the flanks are near-straight — effectively a 9-slice). ⚓ **He then agreed against it**, and the reasons are worth keeping:

- ⛔ **Ornament has gravity.** Finials point _up_; scrollwork has a top and bottom. Rotated, it reads as "a vertical card lying on its side," not as a horizontal card.
- ⛔ **It is two designs, not one** — sideways, the label stack must become a row, so you maintain two card layouts and two ornament orientations forever.
- ⛔ **It costs the actual idea** — three plates _standing on the ground_ in a night scene is the strongest thing about the landing. Three stacked bands are a list of buttons.

**Instead: buy the room from the aspect ratio** (the old 481:1240 ≈ 1:2.58 is what made phones impossible), and:

- 🗒️ ↻ **RESOLVED 2026-09-21: ONE version serves both** (⚓ Nate). The reasoning below is kept because it is why the figures are drawn simply, ⛔ but there is no second outline to maintain. ~~**TWO outlines — ornate (desktop) + simplified (mobile).**~~ Not a compromise, a requirement: fine curls are sub-pixel mush at 82px and alias badly. Same shape family, fewer inflections. It is a path string, so swapping is trivial.
- **Breakpoint:** swap below ~150px card width → viewport ≈ **560–600px**.
- ⚓ **When space runs out, drop DECORATION, never MEANING** — keep the plain tool name, shed the poetic one; the kicker can shrink and lose its wide tracking (it is already allowed to wrap).

⚠️ **Separately, and not a card problem:** on a phone the viewport is portrait and the scene is not. Cards currently sit at 47% with the horizon at 63% so they stand _on the ground_; that relationship needs re-composing for portrait regardless of card shape. This is the "mobile landing = new composition" item.

---

## 🎨 Silhouette concepts — ⚠️ the ORIGINAL BRIEF, kept for its reasoning

⚠️ Nate has drawn all three and they shipped; ⛔ this section is not a description of the current artwork.

Reference style: **Genshin's Archive menu** — white line art on a starry ground, uniform stroke, objects with a little volume rather than flat pictograms. ⚓ Same visual language the site already speaks, so this extends rather than imports.

⚓ **Shared grammar so they read as a SET: a circle or arc in each, and stars in each doing a DIFFERENT job.**

- **Astrolabe → Team Builder.** Suspended disc: ring at top, tick marks on the rim, an alidade bar crossing on a diagonal (that bar is what stops it reading as "a circle with dots"). Payload: **four nodes joined into a small figure** — four is the team size, the figure is a constellation, and _constellation_ is already the Team Builder's own axis. Three meanings, one shape.
- **Ephemeris → Rotation Planner.** A page/tablet angled slightly for volume: **3–4 ruled rows, small round marks at staggered positions along each, one light arc sweeping across.** ⚓ **The strongest of the three** — the abstraction of an almanac table and the abstraction of a Gantt chart are literally the same picture.
- **Observatory → Visualizers.** A dome with a vertical slit on a low base, and **3–4 stars along a gentle curve** above/through the slit — so what the observatory watches is a plotted graph. ⚠️ Most at risk at 82px; try with and without the telescope, which reads instantly but costs many strokes.

---

## Material and hard constraints

⚓ **Nate's direction: flat GLASS with outlines and shapes on top, mostly dark-context material, maybe a parchment strip.** ⛔ **NOT** converting the cards to parchment (the reference is Genshin's _light_ UI; he is borrowing the outline only).

- A parchment strip must be **opaque** (`--surface`). ⛔ **No light glass** — a translucent cream strip over night is exactly what that rule forbids.
- ⛔ **No gradient in the plate interior** — WebKit bands a long ramp; grain was tried and Nate rejected it as reading like paper stock. The current flat fill exists for this reason.
- ⛔ **No filter on hover** — a drop-shadow bloom promotes the element and re-rasterizes the card every frame.
- ↻ **SUPERSEDED 2026-09-21.** A redraw is now a copy into `heroArt.ts`, and the aspect is DERIVED from the artboard (`--plate-w`/`--plate-h`), not hardcoded per-rule. The per-axis inlay scale it warned about is gone with `INSET_TRANSFORM` — Nate draws the inner line.

---

## Two other landing decisions from the same session

- ⚓ **Announcement section: YES**, with one condition. Rationale: _"is this updated for the current patch?"_ is the first question a Genshin player asks about any tool, and nothing on the site answers it — so it is a **trust** signal, not clutter. Also the honest home for "the 7.0 characters land when upstream data does."
  ⚠️ **It must render ONLY when there is something current, and each announcement must carry its own expiry date.** An empty slot is worse than none; a stale one ("New: 7.0 support!" in November) actively signals abandonment. Failure mode must be _nothing shows_, never _stale shows_. Pair it with the BETA tag — they are one "what's going on with this site" system.
- ❗ **There is NO positioning text anywhere on the landing.** A first-time visitor from Reddit sees three cards reading _Ephemeris / Astrolabe / Observatory_ and nothing saying what critcalc is. ⚓ **One quiet line** — not a marketing hero block, which would wreck the composition. The OG description should echo it. _(The landing description now in `$lib/seo.ts` is Claude's draft and is flagged for Nate's wording pass.)_

⚠️ **Wide screens are already fine here** — `--card-h` caps and `--gap` caps, so at 2560px the group settles ~824px with scene around it. The wide-screen pass should look at the **static pages' prose line length** instead.

**↻ 2026-09-30 (cleanup branch, merged `16022501`):** the label's rule is now `<HRule variant="center" />` painted `--hero-rule: #333b4b` (⚓ Nate's pick by eye — the outer ring's gold at 9% was too faint), OPAQUE because HRule's parts overlap at their joins, and it no longer answers hover (like the rings). The brand lockup has a STAR KEEP-OUT: the scene chrome publishes `.chrome-brand-group`'s box → `sceneGL.setStarKeepOut` → `starPass` fades stars by centre distance, strength `1 − dim`; 🎛️ `STAR_KEEPOUT_PAD_PX` 0 / `STAR_KEEPOUT_FEATHER_PX` 4 (⚓ Nate: only the stars BEHIND the mark broke its outline). ⚓ Remove stars, never paint a ground — the sky under the mark varies by viewport.
