# Structure and streamlining survey — 2026-10-21

**Status: a survey for discussion. Nothing here is decided.** Prompted by a streamer's live session (tools hard to get used to; controls too small on a 3440×1440 ultrawide, fixed with 125% browser zoom; the bench loadout popover hid the refinement row). Nate's framing: streamlining and scaling are one problem — a streamlined UI leaves room to show things larger, and showing things larger forces streamlining.

**Method.** One measurement pass (every region and visible control of each tool at 1366×768, 1920×1080, 2560×1440, 3440×1440 and a 390×844 phone, plus 3440 at 125/150% zoom), then four parallel surveys (Planner, Team Builder, Visualizers, the shared frame), then a re-derivation pass over the load-bearing claims (marked ✔ where re-checked in code or in a browser). The surveys' full inventories are summarised, not reproduced; file:line references are theirs unless marked ✔.

---

## 1. Seven cross-cutting findings

### 1.1 The size hierarchy is inverted, and nothing scales with the screen

✔ The task controls are the quietest type on the page and the site navigation the loudest (planner at 1920): band B labels **11px** uppercase, band A **12px** in 25px-tall buttons, the tool switcher **18px**, the brand 24px. The bench's constellation chip is a 19×14 target, its artifact/weapon zones 24×26 — below Apple's 44pt, Material's 48dp and WCAG 2.5.8's 24×24.

Every one of those sizes is the same at 1366 and at 3440. A 34″ 3440×1440 panel is ~110 PPI against ~92 for a 24″ 1080p, so the same label is ~16% smaller physically — close to the 125% the streamer chose.

### 1.2 Content grows with width; controls don't

| Tool        | What happens at 3440×1440                                                                                                                                                                                                                                                                                                                               |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Builder     | ✔ Roster cards reach **417×416px** (six columns, `--cg-max-cols: 6`, no maximum track size — `CharacterGrid.svelte:150`), while the lineup board stops at **800px** (`+page.svelte:1686`) with **64px** portraits. 12 cards fully visible vs 20 at 1920; 554px empty under the last team. The thing you build gets 11.5% of the screen, the roster 60%. |
| Planner     | ✔ Fixed **60 px/s** resting zoom (`plannerView.svelte.ts:41`), no Fit anywhere. An 18s rotation sits on an axis running to ~52s; ~460px of empty scene below the editor. At 1366 the same rotation is 2323px wide in a 1058px window.                                                                                                                   |
| Visualizers | ✔ Tile count is window width only (`viewportCapacity`: 3 from 2200, 2 from 1360 — `workspace.ts:58`). **2560 gets narrower tiles (811px) than 1920 (912px)**; only 3440 at 100% reaches each instrument's wide layout. Timeline charts stretch tall (the Gauge plots a 0–1U line ~740px tall at 2560).                                                  |

### 1.3 Hidden interactions — the streamer's main complaint

- **Planner:** the notation is the only input, but nothing on screen connects chart to text. Clicking a bar does nothing; hovering shows a tooltip only. Space, Home, ⌘Z, tab double-click/drag, pip → log, log → seek and portrait → Detail card live only in `title` text or the Help chapter. The desktop editor has no hint (the phone dock does).
- **Builder:** five of eight distinctive interactions are hidden — hover a card to preview the team; click a selected team's filled slot to enter swap mode; a faint fingerprint glyph is a "find someone" button; remove a member by clicking their card in the grid again (✔ there is no remove/reorder/move on the board itself — `boards.svelte.ts` has `reorderBoards` but no slot or team move); the two-click move under No repeats.
- **Visualizers:** six of the eight instruments sit behind a 12px caret at the far end of a 698–890px picker plate. Four different pointer schemes across eight instruments; four instruments carry no hint at all.
- **Everywhere:** no command palette, no `?` overlay (queued), no shortcut keys in tooltips except Play.

### 1.4 The document/view rule holds in one tool of three

Band A = the document, band B = the view (`toolBands.ts:40`). It holds in the Planner. The Builder puts **Clear** (destructive, document-level) and the **season** (a property of the lineup) in band B. The Visualizers have no document, so band A holds the **layout** control (Auto/1/2/3, Reset layout) and Share sits per tile in band B. "Share" means three different things across the site; the Library has two doors (band A's Library, the chrome's Roster icon).

Band A is also mostly empty: ~1,140px of nothing between one tab and four buttons on the Planner at 1920; ~3,000px at 3440, with Save ~3,000px from the tab it saves.

### 1.5 State you can't see

- Planner zoom level (only inside its popover) — against the planner's own rule that a changed chart announces itself (layers, Speed and Laps light their plates).
- Builder active filters (a thin gold ring on a 13px glyph; More shows a count); notices + Undo appear in three places and vanish after 8s (the Planner's Undo/Redo are permanent).
- Visualizers: whether a tile differs from its defaults; the Gauge's selected application has no label.

### 1.6 Popovers that aren't kept on screen (bug class)

✔ `SlotPortrait.svelte`'s `.sp-popover` clamps X (`placeBeside`) but centres on the anchor in Y with `translateY(-50%)` and no clamp; its own CSS comment claims a clamp that doesn't exist. Measured on the bottom card: 119px off-screen at 1440×900@125%, 56px at 1366×768, 32px in a 1000px-tall window at 125%. The same unclamped-vertical pattern: the constellation popover, `BandMenu` (✔ clamps X only), the `DocumentTabs` menu (grows with tab count). The bar tooltip and team-bonus blocks pick above/below with a fixed `rect.top > 80` rule instead of their real height. **Proposal:** one shared placement helper that clamps or flips on both axes.

### 1.7 Short screens

- Planner at 1366×768 overflows: the tool scrolls 990 of 768, the 4th row and bench card fall below the fold, and the sticky editor covers the chart's bottom.
- Visualizers: at 1920 with the default lineup the Crit Heatmap's answer card (Pin, Roll) is entirely below the fold (Pin at y≈1306); at 1366 both readouts are cut. This is the defect class Nate fixed for the Gauge toolbar on 2026-10-02 ("every edit was a scroll down and back up"), hitting the answer instead of the editor.

---

## 2. The frame (vertical budget)

✔ On every tool at every desktop size: chrome 64 + band A 29 + gap 4 + band B 36 + gap 16 = **content at y=149** (+24 bottom pad).

| Viewport           | Height above content  | At a realistic browser inner height |
| ------------------ | --------------------- | ----------------------------------- |
| 1366×768           | 19.4%                 | ~23%                                |
| 1920×1080          | 13.8%                 | ~16%                                |
| 2560 / 3440 × 1440 | 10.3%                 | ~11.5%                              |
| 390×844 planner    | 26.2% (bench row +80) | —                                   |

The frame is cheap in pixels on big screens and expensive on small ones; on big screens its problem is physical size (1.1), not area.

### Structural options

| Option                      | What                                                                                                       | Saves | Clarity        | Rulings / measured values it disturbs                                                                                                                                                                                                                                                                                                                                                   | Applies |
| --------------------------- | ---------------------------------------------------------------------------------------------------------- | ----- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| (i) Tidy                    | Visualizers' layout control into band B; Builder's Clear and season into band A / ⋯; band B type 11 → 12px | 0     | +              | `BP.wide` (71rem) is a measurement of band B's words — re-measure                                                                                                                                                                                                                                                                                                                       | all     |
| (ii) One band row           | Bands A and B side by side above a width                                                                   | 33px  | ±              | ⚓ 08-09 (bands split by the gap), ⚓ 08-10 (band A keeps its natural ~25px height); the threshold moves with tab count (~1640px with one Planner tab)                                                                                                                                                                                                                                  | wide    |
| (iii) Chrome absorbs band A | Tabs + Save/Library/Share move into the site chrome inside tools (the Docs/Figma/VS Code shape)            | 33px  | ++             | SiteChrome's "identical pixels on every surface"; the compass priority order (restate: brand > meta > switcher > document > tabs); ⚓ 08-17 ribbon top = band A top (`RIBBON_FRAME_TOP_INSET` 28 is hand-tuned); the chrome is stationary while tools pan on Nate-tuned `TOOL_NAV_MS`. Room measured: actions need 308px; free chrome space is 276 + 344px at 1366, 548 + 616px at 1920 | ≥ ~1366 |
| (iv) Wide side column       | A persistent column on ultrawide                                                                           | 0     | + at ultrawide | ⚓ "a panel is something you deliberately opened"; spends chart width; doesn't fix size                                                                                                                                                                                                                                                                                                 | ≥ ~2400 |

The frame survey recommends **Interface size first, then (iii), then re-levelling the type, then ⌘K + `?`**. (iii) also removes the dead middle of band A and puts the document where users already look for it.

---

## 3. Per tool — the strongest proposals

### Planner

1. **Link chart and text.** Hovering a bar highlights its token; clicking a bar puts the caret on that token. Still a text edit, so it fits ⚓ notation as single truth.
2. **Fit zoom + an Auto default** (track width ÷ rotation length) + the **current % on the Zoom plate**, lit when not at rest. Keeps ⚓ one Zoom plate + popover (2026-09-30).
3. **One loadout target per bench card** on desktop, as the phone already does; fix the popover (1.6).
4. **A short-screen form** for ~768px tall (a screen-only compact aura plot keeps ⚓ `AURA_PLOT_H` and PNG parity; or Auras default off on short screens).
5. Band B mixes three subjects — time (transport, Total), scale (zoom) and what is drawn/open (Human timing, layers, panels). Premiere, Figma and Logic put zoom at the chart's own edge. Re-opens the ⚓ 2026-09-14 zoom placement → a `/lab` question, not a change.
6. Questions that re-open rulings: can Human timing shrink to an indicator + its Settings entry? Can band B's ~2,400px empty centre at 3440 carry the zoom % or a `3.2 / 18.1s` playback readout?

### Team Builder

1. **Cap the card at ~200–240px and add columns** past six (3440 → ~11 columns, ~55 cards visible instead of 12), or scale the card's glyphs/name with the tile. Contradicts the wording of ⚓ "six at most" (2026-10-20); its stated reason (cards too small at 1482–1500px) was a minimum, which a maximum doesn't touch.
2. **A larger board from ~2400px** (96px portraits, 20–24px glyphs, extending `BoardView`'s `roomy` prop), rows growing into the empty height. Bends ⚓ §11.2's fixed width, which has already moved 580 → 720 → 800 → fluid. Restores ⚓ §11.1 item 1: the thing you build is the subject.
3. **Labelled filters** where width allows (26 icon-only today, roles drawn as icon pairs); band B's character controls + the filter strip as **one row** at wide widths (~1,830px needed; the roster column is 1,680px at 2560).
4. **Visible cues for the hidden interactions** (a swap mark on hover, a hover ✕ on filled slots, a cursor/ring on faint glyphs, the magnifier faintly always shown) and **remove / reorder / drag on the board** — the game itself says "Drag to adjust the order".
5. **A removable-chip row for active filters**; the two Clears labelled by scope; one home for notices + a permanent Undo/Redo like the Planner's.
6. The empty 412px rail plate in band B reads as a disabled text field; the default Stygian lineup is labelled "Lineup 1" (✔ `boards.svelte.ts:245`) against the ⚓ L1 comment "the tab names the mode".

### Visualizers

1. **A visible instrument catalog** — e.g. an eight-chip shelf in band A (which today holds only the rarely used layout control); picking one uses the existing `pick()` swap.
2. **Three tiles only when each can reach its wide layout** (~3008px). Then 2560 gets 2-up at 1232px, and zooming in at 3440 trades a tile for size — "scaling and streamlining are one problem" in one function.
3. **Readouts on screen:** give Crit its wide form (controls + readout in the side column) earlier, or cap chart height in the middle layout; cap the timeline charts' height.
4. **Per-tile verbs:** keep the picker, Share and ⋯; move Defaults into ⋯ (which today holds one item) with a "changed" dot on ⋯.
5. **One pointer rule** (hover reads, drag sets) and one caption line in a fixed spot under every chart.
6. Gauge: label the selected application's group; its 14 example presets (29px, 14px text) are bigger than its editing chips (23px, 12px).
7. A per-tile Focus control (a temporary one-up) would answer "too small" without any zoom.

---

## 4. Interface size (CSS zoom) — what it would really take

**Correction to the earlier discussion:** CSS `zoom` on the root is _not_ equivalent to browser zoom. ✔ Measured at `zoom: 1.5` on a 1920×1080 window, in both Chrome and WebKit:

- `innerWidth` stays 1920 and `matchMedia('(min-width: 1500px)')` still matches, though the layout has 1280px to work with — **no breakpoint fires** (47 width `@media` rules, and `media.svelte.ts`'s `matchMedia`).
- **`100vh` becomes 1620px** (a 100px box becomes 150px) — every viewport-unit height overflows (26 uses, incl. the Planner's `viewport − 300px` fit and the Visualizers' `100svh` workspace).
- JS thresholds that read `innerWidth` (e.g. `viewportCapacity`) don't see the zoom either.

Browser zoom has none of these problems, because it changes the CSS-px viewport itself — which is why the streamer's 125% worked.

**What a safe version needs:**

1. **A guard:** apply a rung only while `vw / zoom ≥ 1136` (`BP.wide`) and `vh / zoom ≥ 480`. Above that, every media query is already in its widest state, so breakpoints firing on the unzoomed width is harmless. This makes Interface size a **big-screen feature by construction**.
2. One `uiZoom()` divisor for viewport units (`calc(100dvh / var(--ui-zoom))`) and for JS width thresholds.
3. Pointer math that mixes `clientX − rect.left` with a CSS-px scale: `RotationTimeline.svelte:2444–2446`, the Gauge's `timeAtX`, `DefResChart`, Wish (ratio math like Crit's is safe); the bench snap (`(tools)/+layout.svelte:273–346`) writes measured px back.
4. Fixed popovers (25 files) — the same class as 1.6; fix the helper first.
5. Keep the WebGL scene outside the zoomed root. The PNG export is immune (model geometry).
6. **Auto keyed on inner height** (≥1250 → 1.25, ≥1700 → 1.5, both under the guard). It self-corrects: someone already at 125% browser zoom reports ~1040 CSS px of height, so Auto stays at 1.0.

**A cheaper first step** the frame survey suggests: detect a tall, DPR-1 screen and show a "press ⌘+" hint, to measure demand before building the setting.

Root font-size scaling stays ruled out: geometry is mostly px (1,915 px literals vs 1,126 rem) and `BAND_A_H` is a measurement of type inside px padding.

---

## 5. Defects found along the way (no design decision needed)

1. **Loadout popover vertical clamp** and its siblings (1.6).
2. ✔ **Crit "Hits per rotation" slider paints as a solid 24px bar on touch screens:** `style:background={riskGradient(myCR)}` (`CritInstrument.svelte:270`) is the shorthand, which resets the `background-clip: content-box` the coarse-pointer rule sets (`app.css:3716`). Use `background-image`.
3. The scene reads `devicePixelRatio` once at mount, so a browser zoom change after load is never picked up (`sceneGL.ts:507`).

---

## 6. Questions for Nate

1. **Frame:** (i) tidy, (ii) one band row, or (iii) the chrome absorbs band A? Or demo two of them in `/lab`?
2. **Type:** re-level band B 11 → 12px and the switcher 18 → ~15–16px?
3. **Interface size:** build the guarded, height-keyed version, start with the browser-zoom hint, or leave it to the browser for now?
4. **Builder:** cap the card and add columns (re-opens "six at most"), and/or a larger board at wide sizes (re-opens §11.2)?
5. **Planner:** Fit + Auto zoom + a visible %; chart ↔ text linking?
6. **Visualizers:** a visible catalog, the 3-up rule, Defaults into ⋯?
7. **Discoverability:** ⌘K palette and the `?` overlay — one project or two?
8. **The defects in §5:** fix now, separately from all of the above?
