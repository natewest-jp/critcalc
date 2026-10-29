# Unified bench card (Nate's design, built by Opus 5, 2026-07-30)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

> **↻↻ THE CARD ITSELF IS SUPERSEDED by `docs/rounds/bench-card-round.md` (2026-08-12).**
> It is a ROW now — rail · portrait · column on one band — not the three stacked
> bands described below, and the numbers here (160px width, 68px disc, the
> three-zone loadout pill, the `display:contents` + `order` actions trick, the
> "hover brightens, never fills" absolute) are all retired. What still reads
> true: the two-hosts/one-card premise, the `--r-round` ruling, LoadoutPanel's
> shape, and the `blank`-never-wears-∅ rule.

> **↻ PARTLY SUPERSEDED by `docs/rounds/bench-band-round.md` (2026-08-05, branch `feat/bench-band`):** the "converged thing is the CARD, not the bench" ruling below is retired — there is ONE bench now (the layout-level RIBBON — screen-locked HUD docked at the same spot in both tools, persisting motionless across the world-locked fade transition). Still current from this file: the CARD itself (SlotPortrait's three bands, pill, fills, hover rules, the 160px card width and the width equation, `--frame-bg`/`--r-round`). No longer current: the TB bench hosting its own cards, Bench→Layer-1 write routing (the band writes Layer 2 everywhere), the per-host card ownership, and the `probe-loadout-con-layers` contract described here (re-pinned).

**✅ Status: COMPLETE — Nate-approved, MERGED to `main` by fast-forward and PUSHED 2026-07-30 (`d827e96`). LIVE on the noindexed critcalc.app.** Branch `feat/unified-bench-card` is fully merged and can be deleted. Closes the ⏭ NEXT item from `docs/rounds/mirrored-tool-surfaces.md` and § 2 of `docs/rounds/simplification-round-2026-07-24.md`.

Six review rounds with Nate in the loop; his own inspector tweaks are folded in throughout. Where a first attempt was wrong it is recorded below rather than deleted — those are the ones most likely to be retried.

Nate mocked three concepts (Ineffa / Sucrose / Flins). Agreed reframing: **concepts 2 and 3 are the same layout** — they differ only in the loadout interaction model, which is portable to concept 1's rail. So two orthogonal decisions, not three designs. Chosen: **concept 3's layout + the single-pill loadout + TB actions on the base band beside the pill** (they landed there after two moves — see round 2).

## Why concept 3 won (the argument, so it isn't relitigated)

The two hosts have **opposite scarce resources**: the planner column is width-scarce / height-free (`slotBlockH(i)` forces 90–200px+ and `.sp-portrait-area` absorbs the slack), the TB bench is height-scarce / width-free. Converging to ONE width means **narrow first, short second**.

Concept 1's rail looked shorter but isn't — its own chip stack (C + artifact + weapon+R ≈ 100px) is as tall as concept 3's whole card. What it actually buys is a _bigger portrait per unit height_, paid for in width. It also had nowhere to put audition/remove that didn't lengthen the card, and in the planner its chips would sit flush against the E/Q bars at the busiest seam.

## The card (`SlotPortrait.svelte`)

Three bands: **identity** (glyph + name · con chip) → **portrait** (alone) → **base** (host action · loadout pill · host action).

- **`actions` is a `Snippet` prop.** The Bench passes glyph-only `⇄`/`✕`; the planner passes nothing. A footer band would have cost ~30px × 4 slots in the tool with the least height — that's exactly what `.bn-slot-actions` used to cost and it's now deleted. **Where they sit took three attempts**: identity row (starved the name to 5 letters) → portrait margins → base band beside the pill (final).
- **The loadout pill is one shape with THREE hit zones** (artifact · weapon · refinement). Each opens the same `LoadoutPanel` _led by its own section_, so "change only the weapon" stays one click while the build presents as one decision. Re-clicking the same zone closes; clicking a different zone **re-leads the open panel** rather than dismissing.
- Pill **hugs its content**, centered by `.sp-loadout-row`. First build ran it full-width and it read as a third structural band competing with the portrait — Nate's concept has a compact capsule. Don't revert to full-width.
- **Refinement always renders** (weapons are R1–R5; there is no R0). Gray until a weapon is equipped, element-tinted after — the exact contract the con chip follows. This also fixes the old defect where `.sp-ref-badge` popped into existence on first weapon-set and shifted the row.
- Unset artifact = generic flower dimmed 0.4; unset weapon = the weapon-type silhouette dimmed. Both from `$lib/utils/loadoutIcons.ts` (shared with the panel's "none" tiles so they match). ⚠️ **`blank` has no weapon type**, so `weaponTypeIcon` returns null and callers render a neutral square — no silhouette would be honest when it may equip anything.

## Nate's round-2 revisions (reviewed + extended 2026-07-30)

- **No element tint in the card fill.** `--sp-pill-fill` fades `--bg` → the FRAME's ground, lighter stop at the BOTTOM (inset read; the roster cards' portrait gradient flipped). Element speaks through the glyph, the portrait ring and the set values only.
- **Sizes down**: `--sp-pill-h: 26px`, loadout zones 24px, con chip a 26px square, pill `padding: 0` / `gap: 1px`. This is what recovered the height regression the 32px chip caused.
- **`⇄`/`✕` moved AGAIN — identity row → portrait margins → beside the loadout pill** (Nate, and it fits: the base band measures 136px inside 147px of content). They now wear `--sp-pill-fill` / `--sp-pill-border` at `--sp-pill-h`.
  ⚠️ **One `actions` snippet fills BOTH sides via `display: contents` + `order`** — the wrapper dissolves so the host's buttons become flex items of `.sp-loadout-row`, then `:first-child { order: -1 }` / `:last-child { order: 1 }` seats them around the pill. Don't "fix" this into two snippet props.

## Two style-guideline violations found and fixed (Nate asked)

1. **`#081225` was a bare hex** in `.frame`, `--rp-chart-bg`, `SavedNotationsOverlay` and the new card fill. Promoted to **`--frame-bg` in `:root`** beside `--frame-line` — the identical precedent, for the identical reason (anything mixing against a frame's ground needs to name it). All four call sites now read the token.
2. **`border-radius: 999px` was off-scale.** app.css declares `--r-sm/md/lg/round` "the ONLY legal radii". Resolved by **redefining `--r-round` as `999px`** (Nate's call, and the right one — his intent for the token was always "round, never ellipse", which is precisely what 50% cannot guarantee):
   - **`50%` is PER-AXIS** → on a box wider than it is tall it draws an **ellipse**.
   - **A large absolute radius** is clamped by the browser to half the short side → **circle on squares, capsule on oblong boxes**. It expresses the intent in both cases, so there is no circle/capsule pair to keep straight.
   - On a square the two are identical, which is why the mix went unnoticed for a round. Audited **every** `--r-round` consumer before the swap — 15/15 slider thumbs, 24/24, 26/26, 28/28, 68/68, 13/13 — all square, so nothing relied on the ellipse and the change is visually inert.
   - A short-lived `--r-pill` (added, then retired the same session) is the discarded alternative; don't reintroduce it.
   - Every radius in SlotPortrait / LoadoutPanel / Bench is now a token; 5 pre-existing literal `3px` in Bench converted to `--r-sm` (same value, zero visual change).

## Round 3 (Nate 2026-07-30)

- **`.cc-namemark` mirrored** as `.sp-namemark`: dire `∅` at `--fs-2xl`, `margin-left: auto`, the `translateY(-0.1em)` em-lift, same title/aria. ⚠️ **`curated` lives on `CharacterIndexEntry`, NOT on `CharacterData`** — the planner hands the card a loaded payload, so SlotPortrait resolves it itself via `getCharacterIndexEntry(char.id)`. Threading a prop would have silently left the planner's mark permanently off. Uncurated today: `blank, illuga, kachina, lohen, prune, sandrone, zibai`.
- **TB drops the "Empty" label** — both tools now pass `emptyLabel=""`. Four blank portraits ARE the empty state.
- **`weaponTypeIcon` falls back to SWORD** instead of returning null (blank + empty slots). Real characters still show their own type's silhouette. Killed the `.sp-lo-blank` / `.lp-tile-blank` neutral-square paths in both components.

## ⚠️ The card-overflow trap (a real bug Nate caught by eye)

Filling a bench slot made the portrait drift ~7px right. **The bench width never changed** — the CARD did, 140 → 154, overflowing its own grid track:

`.bn` is a grid, so `.bn-slots` carries `min-width: auto` and cannot shrink below min-content. When slot actions appear the base row needs 136px but the card's content box only had 122px, so the card grew past its track instead of clipping. Silent, because only the portrait's centering betrays it.

**The width equation, now in `LABEL_W`'s doc comment:**
`bench = row + 18 (card padding) + 24 (bench padding) + 1 (border)`
Base row = action 26 + gap 4 + pill 76 + gap 4 + action 26 = **136** → minimum 179. **Converged width moved 165 → 185px** (~6px slack). The planner has no slot actions (row = the 76px pill alone), so it runs with slack at this width; trading it back down means shrinking Nate's hand-tuned pill/action sizes, which is his call.

**`probe-bench-align` now asserts it** (6 checks): measures the card empty vs filled and requires both to equal the zone's content width. This class of silent shift can't regress unnoticed again.

## ⚠️ THE CONVERGED THING IS THE CARD, NOT THE BENCH (rounds 4–5)

Nate spotted by eye that the same name wrapped differently in the two tools. Cause: one token meaning two things — `LABEL_W` / `--tb-bench-w` = 185 was the **card width** in the planner but **card + zone chrome** in the TB, whose `.bn` adds 12px padding per side plus a 1px `border-left`. RP card 185 vs TB card 160.

**First fix was BACKWARDS and is recorded so it isn't retried**: padding `.char-label` out to `0 13px 0 12px` equalized the cards at 160 — by spending 25px of timeline on chrome the planner has no use for, in a redesign whose whole point was reclaiming space (Nate caught this too).

**Final model:**

- **`LABEL_W = 160` IS the slot-card width.** The planner's column _is_ the card — `.char-label` has `padding: 0`.
- **`--tb-bench-w: 185px` = 160 + 12 + 12 + 1.** The TB reaches the same card through a wider bench, because `.bn` is also a scroll zone holding the team facts and footer links, which need their own inset.
- So the benches are DIFFERENT widths on purpose (185 vs 160) and the cards are identical. Don't "fix" that into a single number.

**`probe-bench-align` asserts cross-tool card parity** (now 7 checks) alongside the overflow check.

**📌 OPEN TODO (Nate, deferred by agreement 2026-07-30): the PNG export needs a full pass** once the card changes land. `timelineExport.ts` draws its own labels off `snap.labelW` and has drifted from the DOM card — no loadout pill, no ∅ mark, its own portrait/con-chip geometry.

## ⚠️ `blank` must never wear the ∅ mark

`blank` is genuinely `curated: false`, but the mark promises _"not curated YET — timing approximate for now"_, a claim about pending work. Blank is the generic placeholder: approximate timing is permanently the point of it. Excluded explicitly in `SlotPortrait` (`char.id !== 'blank'`). The roster surfaces never had to state this because they filter blank out of the corpus; **the slot card is the only place it renders**, and only in the PLANNER (the TB's `?team=` validates against a blank-less roster, so it can't reach a bench slot).

Mark placement: **`margin-right: auto`, not `margin-left`** — the auto margin swallows the row's free space on the mark's far side, keeping it snug against the name while the con chip holds the right edge. (The roster card uses `margin-left: auto` because there the mark IS the last item.) Lift is `translateY(-0.08em)` — Nate's measured value at this card's scale, vs the roster card's `-0.1em`.

## Hover = brighten the CONTENT, never fill (round 6, Nate's call)

Nate asked whether the loadout zones should hover on a `--frame-line` fill or instead brighten their content; **the opacity variant won** ("this is the winner"). It is now the card's rule:

- Icon zones: `.sp-lo-icon` rests at **0.85** so hover has somewhere to go → **1.0**.
- ⚠️ **Unset stays visibly below set even while hovered** — `0.4 → 0.65`, against set's 0.85 at rest. Opacity is this card's signal for "nothing equipped"; hover must never push an empty slot into looking filled.
- Refinement zone hovers to `var(--text)` — exactly the constellation chip's move.

Why not a fill: every other control on the card (con chip, slot actions) hovers by brightening, and a filled disc inside the capsule fragments the pill AND lands on the same circle silhouette as the action chips flanking it. `--frame-line` is also role-wrong — it is the _structure_ token (zone splits, hairlines), not an interactive fill.

Element `opacity` is safe here despite the WebKit transparency-layer note in `docs/rounds/unified-chrome-areas.md`: that jitter needs an element at FRACTIONAL coordinates that MOVE (parallax + fractional gap). These sit in a static card, and the unset state already shipped this property.

## The card wears TWO fills, not one (round 6)

Started as one shared `--sp-pill-fill`; it is now split, and that split is deliberate:

- **`--sp-pill-fill`** — the CHROME fill (constellation chip, loadout pill, action chips). No element tint: the element already speaks through the glyph, the portrait ring and the set values.
- **`--sp-avatar-fill`** — the PORTRAIT backing, which keeps the roster cards' element wash. A portrait wants a lit backing; the chrome fill read too dark behind the art (Nate). Its dark stop is **`--frame-bg`, not `--bg`** (Nate) — same fix as `--sp-pill-stop`: the circle's top now matches the ground it sits on instead of sitting below it, so the tint at the bottom reads as lift rather than the whole circle reading as a hole.

Both run the same direction — tint/light at the **BOTTOM**, the roster cards' gradient flipped — so the card still reads as one surface.

**⚠️ `--sp-pill-stop` is the pill-weight knob (50%).** Nate asked whether to color-mix the `--bg` stop or move the stop position; they do different things and the stop position is the better lever. At `100%` the gradient is still climbing when it runs out of pill, so **every** pixel is darker than the frame it sits on and the control reads heavy. Landing the frame-ground stop early concentrates the dark into a band under the TOP edge — an inner shadow — and lets the rest sit flush with its surroundings. Color-mixing the top stop instead just flattens the whole thing and loses the inset read. Lower = tighter/heavier shadow; higher = softer but darker overall.

**Avatar border states are SWAPPED** from the original: resting is `--el` at 85% toward transparent (receded), hover is full `--el`. They used to be the other way round, so hover _dimmed_ the edge and had nowhere to go.

## The avatar transform is now correct and size-independent

`transform: scale(1.25) translateY(-12%)` — **Nate measured this in the inspector**; the old `scale(1.333) translateY(-14%)` was a long-ago throwaway that overfilled the circle. Because the transform rides the circle, **`.sp-avatar-chip`'s 68px is a free knob** — retune it without touching the two transform numbers.

## `LoadoutPanel.svelte` — new; `LoadoutDropdown.svelte` RETIRED

Each section's heading carries its current pick inline — `ARTIFACT SET: Viridescent Venerer` — rather than captioning the grid beneath it (Nate, round 5). One line per section instead of two, and the label sits where you look _before_ choosing. Nothing truncates; long names wrap under the key. Verified with the corpus's longest, `Thrilling Tales of Dragon Slayers`, which still fits one line at the 202px panel width.

The corpus is **7 artifact sets / 6 weapons (≤3 of any one type, polearm genuinely 0)**, so lists were the wrong form: three icon grids + a caption naming each pick, no search, no scroll. `LoadoutDropdown` had exactly one call site (SlotPortrait), so this is a net simplification, not an addition.

## Converged CARD width = 160px

`LABEL_W` (RotationTimeline, 145 → 160 — the CARD) and `--tb-bench-w` (TB `+page.svelte`, 210 → 185 — card + zone chrome). **Move them together**, then re-run `probe-bench-align` + `probe-frame-rework` (the latter's `box.left == portraits.right` parity check reads `LABEL_W`; now 212/212). `TeamBonusesBlock`'s `.tb-key` rail follows the same geometry: `1 + 14 + 160 − 10 = 165px`.

Set when the actions were still in the identity row; it survived their move because the base band now sets the floor (136px of row inside 147px of content). At this width `Kuki Shinobu` is the only name that wraps to a second line and `Neuvillette` is the longest that fits on one.

## Measured, not estimated (vs `main`, 1600×1000, same seeded team)

|                      | main | v1  | v2 (32px chip) | FINAL                       |
| -------------------- | ---- | --- | -------------- | --------------------------- |
| bench content height | 1023 | 982 | 1075           | **983**                     |
| per-slot height      | 177  | 152 | 166            | **154**                     |
| bench width          | 210  | 165 | 165            | **185** (TB) / **160** (RP) |
| slot-card width      | —    | —   | —              | **160** (both)              |

The v2 spike is the lesson: making the con chip match the loadout pill at 32px cost 14px × 4 cards and put the bench ABOVE `main`. Nate's 26px brought it back under.

⚠️ **The per-slot saving (−100 total) does NOT all reach the bottom line**: narrowing to 165px makes the `.bn-factrow` / `.bn-coverage` chip rows wrap more, giving ~60px back. **The bench still scrolls at a 1000px viewport — as it did on `main`** (1023 > 841). The cards are no longer the main contributor; the facts+coverage+send+clear footer is. Open, out of this round's scope.

## Verified

Gates green (1297 vitest / check 0 / lint clean). **All probes pass**: probe-loadout-con-layers (the two-layer guard — retargeted to `.sp-lo-zone` + `.sp-popover--panel .lp-tile`, and it still proves Bench→Layer 1 / planner→Layer 2 through the new panel), probe-team-builder (audition retargeted to `.bn-act[aria-label^="Audition"]`), probe-bench-align 5, probe-frame-rework 26, probe-tb-bench-right 16, probe-tool-slide 14, probe-traveler-avatars.

**The `--cg-gutter` scroll-clipping rule does NOT bite here** — measured, not reasoned: the first card's controls clear `.bn`'s edges by 19px top / 30px right against the 4px a focus ring needs, because `.bn` carries its own 10px/12px padding (unlike the zero-padding `.cg-rail` that caused `c68f396`).

## Still open

- **The ◷ frames-not-curated marker has no home yet** (`docs/rounds/character-card-display-exploration.md`). The identity row is the natural spot (beside the element glyph) but is crowded in the TB by the two action chips. Deliberately NOT placed — it needs its own call about which tools show it.
- Bench footer height (above) — the remaining reason the bench scrolls.
- Real-Safari pass (Nate-only), as with everything else in the frame family.

Related: `docs/rounds/mirrored-tool-surfaces.md` · `docs/rounds/tb-loadout-constellation-port.md` · `docs/rounds/simplification-round-2026-07-24.md` · [[expose-tuning-knobs]]
