# Landing hero cards (2026-07-26)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

⚠️ **SUPERSEDED 2026-09-17** — the card described here (blue toplight, 481×1240 plate, blue inlay) is GONE; the current card is in `docs/rounds/landing-card-round.md`. Kept for the two rules below, which still stand (flat body, no filters).

**✅ MERGED to `main` + PUSHED 2026-07-26 — `7099713`** (branch `feat/hero-cards`). Gates: vitest 1292, check 0/0, lint clean, probe-site-chrome 48/48. Replaces the 4:5 placeholder rectangles described in `docs/rounds/landing-status.md`.

## The shape

Nate's artwork: `assets-src/landing/hero-card.svg` — a tall hexagonal plate (vertical flanks, shallow point top and bottom, shoulders eased not mitred), viewBox **481×1240**. Inlined in `src/routes/(scene)/+page.svelte` as three constants (`PLATE_VIEWBOX` / `PLATE_TRANSFORM` / `PLATE_PATH`); **the export's own transform is kept on the element rather than baked into the path**, so a redraw from Nate is a two-string swap.

The card's `aspect-ratio` is set to the viewBox's, so default `preserveAspectRatio` fits the plate exactly — the apexes land on the card's own corners at every size, no distortion.

**Four passes of the one path:** flat interior → toplight → outer edge → inset hairline. Gradients are defined ONCE in a hidden `.hero-defs` svg and referenced by id from all three cards (cross-`<svg>`-root refs, confirmed working in Safari).

The inset hairline uses a **non-uniform** scale about the plate center (`.9501 .9806`). On a 2.6:1 card a uniform scale sits 12 units off the flanks and 31 off the points; solving each axis separately keeps the gap even. Both strokes carry `vector-effect="non-scaling-stroke"`.

## ⚠️ Two rules that were learned by getting them wrong

1. **Hover raises the TOPLIGHT, never the interior's opacity.** The first pass raised `--fill-opacity` and read exactly backwards: the body is dark, so "more of it" made the hovered card the heaviest thing on screen. Light has to be _added_, not un-hidden.
2. **The interior is FLAT (`#131c36`), never a gradient.** WebKit renders gradients at 8 bit with no dithering, so a 580px vertical ramp bands into visible steps — Blink dithers, which is why Chrome looked clean and real Safari didn't. The obvious fix is grain (`feTurbulence`, exactly what `docs/rounds/abyssal-loading-screen.md`'s veil does for the same reason); **it was tried and Nate rejected it on sight — at card scale grain reads as paper stock, "dated office supplies", not sky.** A flat body has no ramp to band. The toplight is the only interior gradient and fades out by 62% — short enough that its own stepping stays under notice. **A gradient reintroduced in the body brings the banding back with it.**

## Geometry + motion knobs

- `--card-h: clamp(19rem, 58vh, 40rem)`; `--card-w` derives from the artwork's aspect (**must** be height-driven — at the old 42vh these are 16vh wide). `--gap: clamp(1rem, 2.6vw, 2.5rem)`.
- `.heroes` at `top: 47%` + `translateY(-50%)`: clears the chrome and plants the bottom points just past the horizon (63% down the frame), so the cards stand ON the ground.
- **Hover travel is 1px** (`none` → `translateY(-1px)`), Nate-dialled down from 8 → 3 → 1. The lighting change is what reads; the travel only makes the card feel answerable.
- **No filters anywhere in the card** — same standing reason as the chrome (`docs/rounds/unified-chrome-areas.md`). Hover is transform + opacity on shapes already being painted.

## Naming

Each card wears a poetic title over the tool's real name, small and letter-spaced: **Ephemeris** / Team Builder · **Astrolabe** / Rotation Planner · **Observatory** / Visualizers. (Nate assigned these three; the set came from a "instruments of observation" brainstorm — `Orrery` and `Conjunction` are the unused alternates.) **The plain name comes FIRST in the DOM**, so that is what a screen reader announces for the link.

Card order is the task narrative and matches the chrome switcher left-to-right; the portal transition still measures each card's rect, so the iris opens from the plate's center unchanged.

## Open

- **The art inside the plate.** The upper two-thirds is deliberately empty — that's the art zone, and the label sits dead-center only until Nate works out the composition. Related: `docs/rounds/character-card-display-exploration.md`.
