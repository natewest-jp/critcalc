# Element palette round (2026-08-11)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

**✅ MERGED `771910e` + PUSHED, 2026-08-11** (branch `polish/element-palette`; `82d91ae` palette · `f7e89ee` the `/lab` board · `69ec4cc` the stale Atlas note). ⚠ **Cite the MERGE hash, not the branch tip.** The detail is in the CODE and on the board; this is the map and the ⚠ list.

## Where the reasoning is written

- **the `--el-*` block in `app.css`** — the whole argument, including why there is no third rung. Read first.
- **`/lab` section 9** — the specimen board it was decided on, with the rejected candidates still rendered.
- **`--rx-*` block in `app.css`** — the two aura states the swap moved, and why.

## The laws this round produced

- ⚠⚠ **THE PALETTE IS TRANSCRIBED, NOT TUNED. Do not re-tune it as a set.** `main` = Genshin's icon palette (measured off the flat-colour art), `hi` = their in-text `<color=#rrggbbff>` palette (counted out of genshin-db). Every prior version was ours-adjusted-by-eye and each adjustment was defensible — that is exactly how it drifted 23° off cryo with a rationale measurement did not support.
- **`hi` is NOT "main mixed with white" any more.** Genshin derives their in-text set by carrying each hue up to a **lightness floor (oklch L ≈ .79)** and leaving it if already above. Two tiers, one hue, both drawn by them — so `hi` is _given_, not derived.
- ⛔ **NO LIGHT-CONTEXT RUNG. Designed, measured, deliberately not built.** Every `main` is under 3:1 on parchment-100 (cryo 1.14) and so is every other official set. **Genshin has no light UI.**
- ⚓ **THE RULE: element marks go on DARK contexts.** If one is genuinely needed on parchment, run it in **ONE INK (`--ink-900`, 8.00:1)** and let the SILHOUETTE carry the element — Genshin's own answer (their `gilded` set is element-blind).
- ⚠ **A per-element exception beats a global transform.** If one element misbehaves in situ, fix that element with a comment that survives being asked why.

## Two beliefs this round falsified — both were mine or inherited

- 🐛 **The hydro/cryo rotation never did what its comment claimed.** "So they don't collide in a dense timeline" — but our pair sat **33° apart in oklch where Genshin's sit 36°**. We rotated the pair, never spread it. **LIGHTNESS was doing the separating** (ΔL .255 vs their .134), a dimension the rotation never touched. ⚠ **Re-measure, never re-reason.**
- 🐛 **The cryo-vs-anemo complaint was mostly OUR ANEMO.** Theirs is 14° greener — a spring green against an exact cyan.

## ⚠ Watch items

- ⚠ **`--rx-*` is DOWNSTREAM of `--el-*` and nothing propagates.** Two collided: **quicken** (its note assumed anemo was TEAL; against the new spring green it closed to ΔE .044 — fixed by spending LIGHTNESS, .785→.740, keeping the hue and the original intent) and **burning** (pyro moved toward it; banked down .708→.640 — an ember _is_ darker than its flame). Closest pair anywhere is now ΔE **.072**, wider than the worst before the swap (.051). **Re-measure the whole grid whenever an element moves.**
- ✅ **`--ui-positive`'s inverted anemo note is FIXED (2026-08-12).** The h157 nudge stopped buying separation once anemo became Genshin's spring green, and the `bar` rung closed it to ΔE **.026** — under the line. Fixed by LIGHTNESS, not hue: `#51c89a` → **`#5be0ac`**, ΔE .072. ⚠⚠ **THE RULE THIS LEAVES: when an element closes on a UI colour, spend LIGHTNESS — hue is what the element owns.** See `docs/rounds/ui-state-colors.md`.
- ✅ **e2e ran GREEN at the merge: 68 chrome + 68 webkit.** (Better than the previous round's 66/3 — those three were the bench-portrait experiment.) ✅ **REAL SAFARI CLEARED — ⚓ Nate 2026-08-12: "everything is green."** (Playwright WebKit catches throws, not colour rendering — this needed his eyes and got them.)
- ⚠ The rejected **divergence** (whole ladder remapped into a lower oklch band for white bar labels) lost because it improved white-on-fill 1.33→1.69 but cost fill-vs-star 2.95→2.49 — ⚓ Nate ranked **the fill first**. Don't re-propose it without that trade.

## ✅ CLOSED — THE NB AND MOONSIGN LANES STAY, AND THE PARKED PREMISE WAS WRONG

⚓ **Nate 2026-08-12, after looking with the bar rung shipped: "they fit in pretty well with the new bars. Let's keep them for now."** No palette change. They did get **the buff register's 2px left edge** (`rgb(255 255 255 / .3)`) — ⚓ his call, and the right one: the edge was the glass bars' alone on a _glass_ argument (translucent bars sharing a span stack with no seam), but it is also the ANNOTATION REGISTER'S TELL, and these are annotation lanes.

⚠ Keep the measurement, because it is why nobody should re-open this on the old reasoning. He parked them on 2026-08-11 saying _"they're just too bright… I should really be adjusting their colours. Let's hold off until after we adjust element colours."_ **The premise does not hold:**

|                                        | luminance | white-on-fill |
| -------------------------------------- | --------- | ------------- |
| brightest element bar (cryo `#50e1e2`) | **.610**  | 1.59          |
| NB (`#f85b21` → `#e1a566`)             | .275–.439 | 2.15–3.23     |
| moonsign (`#b0a9ff` → `#bea1ff`)       | .437–.448 | 2.11–2.16     |

🐛 **They are DARKER than every element bar and their labels read BETTER. "Too bright" is not a luminance fact, so darkening the palette — the fix his note assumed — is aimed at the wrong axis.**

🔎 **The likely real cause, checkable in the code: they are the LAST TWO LIT BARS on a chart that was deliberately flattened.** `castFill()` went flat 2026-08-11 (⚓ "flattening colors — taking away highlight gradients") because _a lit bar reads as a leftover from a surface that is no longer under it_. `.rp-nb-bar` (3 radial gradients + a 6-stop linear) and `.rp-moonsign-bar` (2 linears) are the **only** gradient bar fills left in `RotationTimeline`. Busy reads as bright. ⚠ **If it ever comes back, try FLATTENING before re-colouring.** The full note lives at `.rp-nb-bar` in the component.

⚠ These two carry hand-authored literals, not `--el-*`, so **nothing propagates to them** — the same trap as `--rx-*`.

⚠ **Their edge is NOT `BAR_EDGE` in the export.** That literal is white .3 composited against `BAR_FILL` (the glass bar's ground); these lanes' grounds are a phlogiston orange and a lavender, so the export paints **real `rgba(255,255,255,.3)` inside the clip, after the tiles**. Canvas composites it correctly on its own; the literal only exists for bars whose ground the exporter has to model rather than draw.

## ✅ THE TWO CALL SITES — SHIPPED, merged `1ec509e` + PUSHED 2026-08-12 (branch `polish/element-on-dark`, deleted)

⚓ Nate 2026-08-11 closing the round: _"Atlas cards AND character cards are displaying element colours on parchment."_ Both are fixed and **APPROVED** — ⚓ _"I like your implementations, both very good."_ `822f8e3` (Atlas) + `b023d55` (cards) + `1085bbe` (Nate's two tweaks). ⚠ Cite the MERGE hash `1ec509e`. Gates green; **e2e 68 chrome + 68 webkit.** ✅ **REAL SAFARI CLEARED — ⚓ Nate 2026-08-12: "everything is green."**

**Neither fix was a colour. Both were a MOVE, and the ink fallback was never reached** — which is the round's own rule working: _"we try to put the marks on dark contexts first. And if we ever need a mark on parchment, we make a note to run it in ink."_

- **Atlas** — the pip stack crossed to the glass half, **and took the RULE with it.** That is what answered the constraint that had blocked the move for a round (⚓ "the pips ARE the providers figure decomposed — only go for the optimal layout logically"): the breakdown didn't cross alone, so the card reads _what this is → what it's made of → how many_, and a sum written under its own terms is not a split fact. Shape followed the half — 7 full-width rows became one 7-across band (icons over counts), because the glass half's spare dimension is WIDTH where the parchment half's was height. Element NAMES dropped out of the DOM and survive as the img `alt`. Parchment keeps the two figures, **stacked**, watermark beside them.
- **Character cards — the answer came from the GAME, not from the file.** ⚓ Nate: _"I was playing Genshin, and I think the answer just dropped out from how they handle it: the element icon goes in the top left of the portrait."_ It takes the corner the **weapon glyph** held (gone, not moved — the in-game card shows element and never weapon; `showWeapon` deleted with it). The border-hue-as-STATE grammar in `docs/rounds/tb-card-round.md` was never actually in the way: that is the CARD EDGE, and this is a mark in the portrait. The name **centres** as a consequence.
- ⚠ **GLOW vs FLAT — asked and settled: FLAT, on a SYSTEM cost.** Genshin uses its `glow` set in exactly this position, but glow is artwork with a baked palette (32–76 colours a glyph) and **cannot be tinted**, so adopting it means that surface's marks stop tracking `--el-*` — the coupling `generate-element-icons.mjs` exists to guarantee. The halo also solves THEIR problem: their pip sits on a bright saturated portrait, ours on a dark slate well, and a coloured glow would make a cryo pip **worse** over blonde hair. Separation from hair is what our corner needs, and the drop-shadow already gives it. 🎛️ One-line swap if he wants it anyway (`/assets/elements/glow/`, in-repo at 64px); the note lives at `.cc-el`.

### Two things worth keeping from the build

- 🐛 **Centring a flex row needs a COUNTERWEIGHT.** The uncurated ∅ was held right by `margin-left: auto`, which absorbs all free space — it would have shoved the name hard left on exactly the annotated cards. An empty twin on the other side, with `--cc-mark` moved up to the row so the pair can't desync at the roomy band. Measured 0px offset either way.
- 📐 **`--atlas-max-h` is the RESTING height, not a ceiling** — it binds at every width down to the two-column breakpoint. 500 → **380**: at 420 the glass half got 96px of interior slack and the identity group floated. Two `margin-top: auto`s split the slack 28/28 instead of pooling it in one hole. `--atlas-card-min-h` 425 → **340** is the floor it starts scrolling at. Pip columns run 36px at 1600 → 24 at the breakpoint, so the 22px glyph **tapers via `min()`**.

## 🎚️ A FOURTH RUNG FOR BARS — ✅ SHIPPED `520e48d`, candidate D (e2e 68+68 green)

⚓ **Nate picked D off the board: `BAR_BALANCE 0.3`, `BAR_DENSITY 0.5`.** `--el-*-bar` in app.css + the `elementColors.ts` mirror; the board below is the reasoning, and `/lab` §10 is marked SHIPPED.

- **Where it goes:** planner E/Q cast pills and _every phase_ of them (uptime/dim/overflow/ghost), the summon lane, the active-row tint, **the label halo**, and the TB's Compare bars. ⛔ **Where it does NOT:** glyphs, pips, portrait washes, the avatar ring, the C-level readout. _The rung only works because the icon did not follow it down_ — the board's test is a bar beside an UNCHANGED icon.
- ⚠ **THE HALO MOVES WITH THE FILL** (`--label-halo` and the exporter's `elementHalo()` both take `bar`). Its job is to hold white ink off the bar it sits on, so it must be that bar's own shade; a halo from `main` under a `bar` fill is a different hue _and_ the wrong distance from it.
- 🔎 **The rename IS the safety.** `castFill(main)` → `castFill(bar)`, and `CompareBar`'s `color` prop → `bar`. That prop fed `main` into three fills while `CompareView` used the same value for header ink — one value, two jobs, invisible only because the second rung didn't exist. **A caller still passing `main` is a caller that hasn't been told about the rung.**
- ⚠ **`none` / `physical` / `BLANK_PAL` have NO bar rung**, and `elementPalette()` falls `bar` back to **the entry's OWN main**, not `none`'s — they're near-neutrals (the derivation spends freed gamut on CHROMA, which on a gray invents a hue), they already sit below the balanced luminance, and sending physical's bar to none's gray would merge two tones the chart draws side by side.
- ⚠ The mirror test's regex + floor moved with the slot (22 → **29** declarations). Styleguide prose was rewritten — it was **already stale on `hi`** ("main mixed 50/50 white" stopped being true in the palette round); its slot grid auto-enumerates.
- ⚠ **Moving `BAR_BALANCE`/`BAR_DENSITY` now makes `/lab` disagree with `app.css`** — the fix is to re-transcribe 7 hexes into both files. Noted at the knobs.

### The board that produced it — `54b11f2`

⚓ Nate: _"we rejected a deeper rung for icons, but I think we might need a deeper rung for things like BARS — very slightly deeper (colour density) and slightly more balanced between the darkness of the scene and the white of their text."_ `/lab` **section 10** is the board. Two knobs at the top of the page script: `BAR_BALANCE`, `BAR_DENSITY`.

- ⚠ **This does not break the transcription law.** `main`/`hi` are copied tables; a bar rung is **derived from `main`** the way the icon set is. 🔎 It is also ONE function — `castFill()` in `elementColors.ts`, shared by the planner's E/Q pills and the TB's Compare bars.
- **THE ANCHOR:** there is exactly one luminance where `contrast(white, fill) == contrast(fill, star)` — **2.93:1 both ways**. Today's worst pair is **1.33 / 2.95**: the fill is nearly as bright as the ink on it. The anchor is a REFERENCE, so "slightly more balanced" becomes a dial with meaning at both ends.
- 🔎🔎 **THE FINDING, AND IT REOPENS THE DIVERGENCE'S REJECTION.** Worst **fill-vs-star does not move**: 2.95 → 2.93 → 2.90 across the _entire_ dial, while white-on-fill climbs 1.33 → 2.93. ⚠ **This is NOT the divergence measured again.** That one cost 2.95 → 2.49 on this exact number and lost for it. The difference is mechanical: **the divergence remapped the whole ladder, so the DARKEST fills went down too — and the worst case is set by the darkest fill.** Pulling each element toward a _shared_ luminance squeezes **from the bright end only** (cryo/geo/dendro move; pyro goes `#ff6640 → #ff653e` at balance .3). ⚓ **The priority Nate ranked first is not on the table this time.**
- ⚠ **THE REAL COST IS LADDER ΔL**, a column the first draft of the board lacked. Genshin's span is **.193**; the anchor flattens it to **.041** — and a palette with no lightness ladder is unreadable in a dense stacked chart (the finding that killed "just cap it"). That, not the star, limits how far the dial can go.
- 🔎 **Density alone is FREE** — to within 0.01 on both ratios, because relative luminance is mostly a lightness fact. ⚠ But it is a **four**-element change: pyro, electro and hydro are already at the sRGB edge.
- The specimen is at the planner's own numbers (14px rows, `--fs-xs` bold white, the halo reproduced from `RotationTimeline` not imported), with **the icon beside each bar still on `main`** — that pairing is the test. ⚠ `/lab` is **dev-only, not in the production build** — drive it on `npm run dev`, a preview of `build/` 404s.

## ⚓ Also still open

White bar labels stay white with their halo (⚓ "dark ink on the element bars kills the chart's atmosphere, period") — the ratios are low by design and the halo carries them. The bench card is still the binding constraint on slot height; see `docs/rounds/rp-scene-round.md`.

Related: `docs/rounds/element-icon-generator.md` · `docs/rounds/palette-definition-round.md` · `docs/rounds/rp-scene-round.md` · `docs/rounds/tb-card-round.md`
