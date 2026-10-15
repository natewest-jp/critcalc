# Portal transition — archived 2026-08-05 (ascend choreography)

Retired by the ascend revival (Nate's 2026-08-02 direction call): the portal
existed to rationalize a hard cut after the 2026-06 Firefox verdict killed the
DOM scene pan. The GL scene world (camera as a uniform, smooth in all three
engines) removed the reason it existed; the ascend/descend camera choreography
replaced it. Archived rather than lost — this note is the recovery map.

## What it was

An iris-style tool transition. On a hero click a pre-rendered vortex plate
spiraled open from the clicked card's center while a black backing filled the
screen (easing in late so the vortex read against the scene, blacking out by
`PORTAL_VORTEX_FADE_AT`); at full black the tool — mounted beneath on its own
black background, suppressed `visibility:hidden` until then — was revealed by
fading the backing off it (dark-to-dark, reads as the tool fading in). The
reverse covered the tool with black, ran the navigation at full black, then
collapsed the spiral back down to the stored hero-card center. Everything was
transform + opacity on two layers — compositor-cheap and Firefox-safe.

Two handshakes worth remembering (both survive in spirit elsewhere):

- **Reveal handshake:** the portal DROVE the tool reveal (`revealToolNow()` →
  the shell's registered callback), then waited two rAFs so the shell was
  actually PAINTED opaque before lifting the backing — the race a fixed
  millisecond hold could never close. The double-rAF "painted" guarantee lives
  on in the scene-occlusion report and the tool cross-fade.
- **Hero origins:** card centers captured on the forward click, keyed by tool
  path (`setHeroOrigin`/`getHeroOrigin`), so the reverse could collapse to the
  right card without the landing being mounted to measure.

## Final tuned knobs

`PORTAL_SPIN_MS = 450` · `PORTAL_TOOL_FADE_MS = 550` · `PORTAL_SPIN_DEG = 240`
· `PORTAL_SCALE_END = 2.6` · `PORTAL_VORTEX_FADE_AT = 0.65` ·
`PORTAL_REDUCED_MS = 180` · `PORTAL_HOLD_MS = 0` · black easing
`cubic-bezier(0.5, 0, 0.75, 0.45)` (ease-in, blacks out late) · vortex easing
linear (burst handled by the scale keyframes).

## Where it lives

Last commit containing the working system: the parent of the ascend-choreography
commit on `experiment/ascend-pan` (see
`git log --follow -- src/lib/components/landing/PortalTransition.svelte`).
Removed there: `PortalTransition.svelte` (the runner + layers), the portal
section of `src/lib/landing/transition.ts` (`PORTAL*` consts,
`registerPortalRunner`/`startPortalTransition`, hero origins, the
`registerToolReveal` handshake), the tools layout's suppression/`returnToLanding`
wiring, and the landing page's origin capture.

Still in the tree (unreferenced, kept deliberately): the vortex sprite at
`static/assets/transitions/vortex-plate.{avif,webp}`, its source
`assets-src/transitions/vortex-plate-2048.png`, and the generator
`scripts/optimize-portal.js` — a revival needs only the component + transition
wiring back.

↻ 2026-10-15: `scripts/optimize-portal.js` and its npm script were deleted (⚓ Nate's call,
pre-launch sweep §3 item 16); the sprite and its source remain.

## If revived

Don't revive it for tool entry — the ascend choreography is the settled
destination (landing scene = the world the site lives in). Its plausible reuse
is as a punch transition for something small and rare (an error boundary, a
seasonal easter egg) where a spatial camera move has no meaning.
