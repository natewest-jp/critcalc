---
paths:
  - 'src/**/*.svelte'
  - 'src/**/*.css'
  - 'src/lib/motion.ts'
  - 'src/lib/breakpoints.ts'
  - 'src/lib/media.svelte.ts'
---

# Design language

Budget: about 10,000 characters. Judge a look on `/lab` (the specimen board) and look things up on `/styleguide` (the exhaustive reference, including the full text of the sub-pixel laws). Both are dev-only. Visual verdicts are Nate's.

## Tokens: four layers and one law

- **A number means a primitive, and no component may name one. No number means a role, and a role is the only thing a component may name.** Enforced by `timelineExport.mirror.test.ts` (exempt: `app.css`, `/styleguide`, `/lab`, tests).
- L0 is the ramps: `--slate-*`, `--parchment-*`, `--gold-*`, `--ink-*`, `--night-*`, `--red-*`, `--blue-*`. They were reverse-engineered from Genshin screenshots, whose shades are a small palette layered with transparency. The source is the gitignored `assets-src/genshin-night.css`.
- L1 is compositing (`--glass-*` and the line stops). L2 is roles.
- L3 is three grounds and one material:
  - **Night** is the world itself: the unclassed `:root`, with no paint. Lines carry alpha. `--muted` is not allowed on night.
  - **`.ctx-dark`** is slate (charts, the bench ribbon, the aside).
  - **`.ctx-light`** is parchment, with navy ink.
  - **`.ctx-glass`** is a material worn over night, not a fourth palette. There is no light glass, and no glass on glass: alpha stacks.
- On paper the axis is size, not depth: `--surface-broad` (parchment-50) for large panels and heading ribbons, `--surface` (parchment-100) for cards, buttons and layers on a broad panel. So the thing on the paper is darker than the paper, and `.ctx-light` has no raised rung. Paper inverts the ink ladder: `--muted` anchors and `--text` recedes.
- `--accent` is gold: `--gold-400` on dark and night, `--gold-700` on light (one hue at two rungs). Gold names a block, never a word: the `.kicker` and its rule are gold, titles are not. No gold fill or glow on paper.
- Borders are ink. The inset frame is gold (`--inset-line`, zoned by context), 1px by default and 2px on large panels (`--inset-stroke`).
- `--debuff` is not a token: `var(--debuff)` would silently inherit. Destructive or loss ink is `--ui-danger`. `--ui-warning` means "we cannot take this"; `--ui-provisional` means "we took it, and this is a stand-in".
- ⚠️ A `color-mix` fed by another `color-mix` crashes WebKit. Derived stops ship as resolved literals, with the recipe checked in the mirror test.

## Materials

- **Night looks, glass touches, paper answers.** Charts sit on the scene; `.panel` (which is `.ctx-glass`) holds apparatus; `.panel.panel--paper` is the one readout card per instrument. It is written as a compound selector because a lone modifier ties with `.panel` and loses on source order.
- No surface paints a slab to stand on. The `.frame` class is retired; `--frame-bg` survives only as the unpainted mix reference.
- Glass is `.58` for a panel and `.45` for a well. Hovering a pane (under `@media (hover: hover)`) is `.80` plus an ink ring. A lit plate is a dim gold fill. Density separates resting from engaged.
- The shaped scrim is scrapped.

## Motion

- Three bands with easing baked in, banded by size (how much screen the change occupies, never what caused it): `--t-snap` (120ms) for a control, `--t-quick` (150ms) for a surface (modals and scrims, popovers, menus), `--t-move` (240ms) for travel (the toggle thumb, the damage breakdown).
- Every surface fade is linear. A control's small hover change keeps the token's easing.
- `prefers-reduced-motion` is honoured by zeroing the tokens in one `:root` block, so a new rule is covered automatically. Never enumerate selectors. Only keyframes, the scene machinery and Svelte's `transition:` honour it by hand (`$lib/motion.ts` mirrors the numbers; a smooth scroll asks its `scrollBehavior()`, since Chrome ignores the preference there).
- A refused action nudges with the shared `@keyframes nudge` in `app.css`, never a local shake.
- Scene and navigation clocks (`TOOL_NAV_MS`, the camera, the star clock, the veil) are tuned by Nate and never use these tokens.
- ⚠️ An outro transition can eat the click meant for what replaces it; the fix is `inert`. Read memory `project_motion_round_handoff.md` before adding a transition.

## Sub-pixel laws

- Alpha belongs in the paint (a translucent `background-color` or `fill-opacity`), never in element `opacity`, on anything transform-placed. WebKit rasterizes an opacity subtree at rounded coordinates and it visibly dances.
- Symbol marks are inline geometry (`<Mark name="…">`), never unicode characters, because engines pick different fallback faces at different sizes. They come from Lucide as a devDependency through `scripts/generate-marks.mjs` → `src/lib/marks.generated.ts`. Never import `@lucide/svelte` at runtime.
- Centering a label centers its box, not its ink. Measure with `scripts/probe-ink-centering.mjs` and tune optical nudges against Chrome (WebKit snaps glyphs to whole pixels).
- ⚠️ An inlined SVG's `fill-opacity` with no `fill` inherits `currentColor`. Always state `fill="#000"` on a wash path.
- Match a glyph's optical size by ink area, never height. Override per button.
- ⚠️ Real Safari shows a 1px gap in tiled multi-layer CSS backgrounds on timeline bars. Don't use them there.

## Breakpoints

- `$lib/breakpoints.ts` is the breakpoint table, each rung with its measured content fact; `$lib/media.svelte.ts` is its reactive half (`below()`, `short()`, `narrowForm()`, attached once by the tools layout).
- ⚠️ Custom properties do not work in media queries, so every `@media` writes the literal and cites the table. Enforced by `breakpoints.test.ts`.
- The narrow form is below `toolMin` or `(max-height: 30rem)` (`narrowFormQuery`).
- `pointer: coarse` grows hit boxes to 44px past the paint. It is a different axis and is not in the table.
- Below `compact`, a toolbar control keeps its mark and drops its word.

## Controls and pages

- A visually-hidden input's label must be positioned: `.check input` and `.toggle input` are `position: absolute`, and with no positioned ancestor they escape a scroll container. Both labels carry `position: relative`.
- Toolbar groups sit at even gaps, with no rules inside a control strip.
- Anything that must escape a toolbar or popover clip portals (`BandMenu.svelte`).
- Avatars come from `getAvatar(id, preferNewfit, size, traveler)`, with the Traveler from the profile's `travelerTwin`. The availability manifest (`hasAvatar`) prevents server-rendered 404 images, which fail prerendering. Regenerate with `npm run generate-newfit`.
- Notices (toasts, banners, confirms, save status) follow `docs/notices-design.md`. ⚠️ An Undo toast must check that its document and profile are still active.
