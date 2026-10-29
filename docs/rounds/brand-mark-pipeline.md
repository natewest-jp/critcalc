# Brand mark pipeline

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

**`npm run build-logo` (`scripts/build-logo.mjs`) owns every shipped form of the mark.** Nate re-exports `assets-src/landing/new_critcalc-logo-white.svg`; the script flattens its nested transform chain into ONE path, bakes the 7° clockwise lean, crops the viewBox to the artwork's own ink, and emits `static/critcalc-logo-white.svg` (chrome) and `src/lib/assets/favicon.svg`. ↻ **2026-10-14: it no longer writes `static/apple-touch-icon.png`** — the home-screen icons are Nate's STARFIELD TILE (the mark on the scene's sky), built by `npm run build-app-icons` from `assets-src/app-icon.png` (512, square) → apple-touch 180 + manifest `icon-192`/`icon-512` (the 512 doubles as Android's maskable: the mark reaches 178px from centre, inside the 205px safe circle). ⛔ Don't put the starfield in the favicon — at 16px it is noise; the tab keeps the bare mark on its plate. Shipped 2026-07-28/29 thru `953a86f`; replaced the SvelteKit default Svelte-logo favicon. **Deliberately NOT on predev/prebuild** — the source changes a few times a year and every output is committed.

## The non-obvious one — baked rotation ≠ `transform: rotate()`

⚠️ Nate tunes sizing in devtools, where a CSS `transform` is the only way to rotate. **That is not equivalent to the shipped file at the same `height`.** `transform` leaves the element box at the UNROTATED ink box and spins the art inside it; baking re-crops the box to the ROTATED ink. For this mark the rotated box is **0.95× as tall** (7° brings its diagonals closer to the axes), so a devtools value renders ~5% smaller once baked.

The script **prints the exact conversion on every run** — height factor and margin correction. SiteChrome's `height: 2.09rem` IS Nate's tuned 2.2rem, converted; `margin-top: -0.24em` carried over unchanged (the centring drift works out to 0.001em). Verified pixel-identical: 56.00px ink width in both, 0.25px of vertical difference. **Read the report rather than re-deriving this.**

Also: the chrome mark is sized by **HEIGHT, not width** — the redraw took the box from 4:3 to 1.67:1, and width-sizing would silently have shortened it by 8px on the 64px strip.

## Favicon policy

- ⚠️ **Opaque plate, never transparency.** The mark is near-white; a transparent favicon inherits the browser's tab-strip colour and vanishes on a light-themed tab. iOS also composites apple-touch onto white regardless.
- ↻ **Plate = `#25293e` since 2026-09-26** (the veil's hue at the old plate's lightness, chroma 0.039 by eye) and the **mark is pure WHITE** — the source SVG and `INK` were converted, so the script owns the chrome logo again (⛔ no hand re-export; it used to revert one). History: **Plate was `#312537`, the loading veil's mauve** (Nate 2026-07-29, after iterating on the `PLATE` constant himself). Reasoning worth keeping: **mauve is the site's chameleon — it belongs to whichever scene you're on rather than committing to a zone**, which is what a favicon must do since it lives on _both sides of the portal_. It also measures best: 13.1:1 contrast vs the mark, against 11.2:1 for the sky blue and 8.3:1 for dire. ⚠️ **Dire was rejected on the zoning rule, not taste** — dire is enemy-facing and PAST THE PORTAL ONLY (`docs/rounds/color-families.md`), and a favicon is the most outside-the-portal surface there is.
- **The favicon is CROPPED to ~1.7×** (mark is 1.67:1 art in a 1:1 tile; fit-to-width filled only 53% of the height and strokes fell below one device pixel). Measured: full-strength ink pixels 26%→53% at 16px. It also **centres the ink's alpha-weighted CENTROID, not its box** — the mark's weight sits 4.6% low, measured, and corroborated independently by Nate's hand-tuned chrome nudge. A guard throws if the shift would ever clip the star's spike.
- ⚠️ **apple-touch-icon is FULL-BLEED SQUARE.** iOS applies its own mask at a _larger_ radius (~22.4%) than the plate is drawn with (18%); shipping the SVG's transparent corners leaves a ring of transparency for the OS to composite arbitrarily. Flattening onto the plate colour makes iOS's mask the only rounding.
- A heavier hand-stroked favicon variant was tried and **dropped** once the tile was cropped: the crop buys the stroke weight back, and unthickened arms keep the negative space between them open instead of merging.

## Honest limit

At **16px the mark is marginal** no matter what — it's five concentric thin curves in ~8 pixel rows, and past a point more weight just merges them into a blob. The crop got it from 26% to 53% crisp; beyond that would need different art (star alone, or thickened strokes), not tuning.

Related: `docs/rounds/unified-chrome-areas.md` · `docs/rounds/landing-scene-pipeline.md` · `docs/rounds/color-families.md` · memory `feedback_expose_tuning_knobs`
