# Cursor parallax — archived 2026-08-02 (ascend rebuild)

Retired by Nate's call during the ascend-concept revival: parallax existed to
make the static landing "feel alive," and the returning camera pan supersedes
that job. Archived rather than lost — this note is the recovery map.

## What it was

`src/lib/landing/parallax.ts` — a cursor-follow controller: on pointer move
the whole scene (`.parallax-world`: sky + stars + floor) shifted a few px as
one RIGID unit (everything-at-infinity model) while the foreground
(`.composition-inner`, chrome, footer, pages panel, meta overlays) counter-
shifted a smaller amount the opposite way. One rAF lerp wrote
`style.transform` directly to registered elements (never an inherited custom
property — descendants must not restyle). Gated to `hover:hover` +
`pointer:fine`, off under reduced motion, eased to 0 during scene transitions.

Validated cross-browser (including Firefox — an interactive lerp has no
scripted trajectory for the eye to judge dropped frames against, unlike the
slow eased pan that failed there).

## Nate-tuned knobs (final values)

`PARALLAX_MAX_X_DVH = 1.2` · `PARALLAX_MAX_Y_DVH = 0.45` · `PARALLAX_LERP =
0.09` · `PARALLAX_WORLD_SIGN = -1` (world opposite the cursor) ·
`PARALLAX_CONTENT_FACTOR = 0.5` (positive — foreground drifts WITH the world;
Nate's "window" feel vs the "diorama" alternative).

## Where it lives

Last commit containing the module and all wiring: the parent of the commit
titled "experiment(landing): GL scene world — plates into one canvas" on
`experiment/ascend-pan` (see `git log --follow -- src/lib/landing/parallax.ts`).
Call sites removed: `(scene)/+layout.svelte` (world + chrome + footer),
`(scene)/+page.svelte` (composition-inner), `(scene)/(pages)/+layout.svelte`
(pages panel), `ChromeOverlay.svelte` (the `parallax` prop, renamed `onScene`
for its surviving backdrop-styling half). The 110px/side L/R + 66px T/B plate
bleed the parallax reserved is still in the plates (and grows in the ascend
master) — a future camera-drift ambient can reuse it.

## If revived

The GL scene camera is the natural sink now — feed the lerped offset into
`sceneGL`'s camera instead of DOM transforms (a `registerParallaxSink` hook
existed briefly mid-rebuild; see this file's git history). The DOM
counter-shift half would still need per-element transforms.
