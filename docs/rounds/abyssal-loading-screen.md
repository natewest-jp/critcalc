# Abyssal-script loading veil — SHIPPED 2026-07-11 (`064a44f`)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

**↻ EXTENDED SITE-WIDE 2026-07-26 (`2b98e22`; merged to main in `238a783`).**
Now rendered by the **scene layout**, not the landing page, so it covers every
server-rendered surface — the content pages' empty-sky blink and the planner's
"shell, then the saved rotation appears" blink are the same defect. The scoping
mechanism below is unchanged and is what still keeps it off SPA navs and the
hero-card portal. Two additions:

- **Ready handshake** (`src/lib/landing/veilReady.ts`, shaped like the portal's
  `registerToolReveal`): a surface that finishes asynchronously calls
  `claimVeilReady()` at component **init** (page scripts run during the layout's
  render pass, before any onMount) and releases when its real content is on
  screen — planner = restored + slotted payloads landed + painted; TB/viz =
  restored + painted; the scene claims nothing and keeps the two-frame rule.
  Claims are no-ops unless the SSR'd veil is in the DOM, so SPA navs cannot leak
  one. **`READY_CAP_MS = 2500`** so a stalled fetch can't strand it (the 4s JS
  backstop and 8s CSS self-destruct sit behind that).
- **Per-surface floor:** scene keeps `MIN_HOLD_MS` 1100; **tools get 500**
  (Nate) — a tool is reloaded repeatedly while iterating, where the full
  ceremony is friction. The floor only governs how long a FAST load lingers;
  covering the blink is the handshake's job. Veil z-index 10 → 20 (it must now
  cover the opaque tool shell inside `.content`).
- Probe grew 11 → 26 checks; the old "veil absent from tool SSR HTML" assertion
  is deliberately INVERTED. The tool section seeds a saved rotation before
  loading so it asserts **ordering** — restored notation on screen at the last
  sample where the veil still covered — not just timing.

## Restyle + horizontal rules (2026-07-26, `6c6164a` + `b4fc3ad`)

- **New glyph artwork** (Nate deregularized + spaced the characters). Re-SVGO'd
  on the original settings — **precision 1, `mergePaths: false`** — plus
  `removeAttrs` for `path:(fill|style)`, because Affinity stamps
  `fill:rgb(129,129,129)` inline and it would beat the stylesheet. viewBox
  347×65 → **413×72**; 49.9 → 9.7 KiB, page HTML unchanged (~7.6 KiB gzip).
  Nate then scaled `.word`'s clamp up by 413/347 to keep glyph SIZE.
- **Color on knobs** (all on `.veil`, Nate hand-tuned after): `--veil-ink`
  (drives fill AND the `color-mix`'d halo — they can't drift),
  `--veil-ground-top` / `--veil-ground-bottom`. Ground is a near-black VIOLET
  ramp now, not neutral: the veil opens onto both the landing's blue sky and
  the tools' crimson border, and a desaturated violet sits between them.
- **Horizontal rules**: `[cap][flex line][cap]`, **ONE cap asset `<use>`d 4×
  and ROTATED 180°** at the far ends. ⚠️ The caps are **point-symmetric, not
  mirror-symmetric** — `scaleX(-1)` points the chevrons the wrong way (verified:
  13.8,0.8 → 4.8,9.2 under rotation). `hr-endcap-right.svg` is redundant,
  source-only.
- ⚠️ **Two things the art forced.** (1) It tapers to a knife edge and only
  spans the full 2px band at its tip — there is no "connecting strand" to butt
  into, so a **1px axis-aligned `<rect>` at `crispEdges`** carries the band to
  the box edge for the line to overlap. (2) **Faintness must be a GROUP opacity
  on `.rule`, never translucent parts** — the 1px overlap otherwise stacks two
  layers into a brighter notch at every join (obvious at 8× zoom).
- Cap normalized so **1 user unit = 1 CSS px**: the 4-unit strand centered on
  y=720 in Affinity space maps to y 4–6 of a **19×10** box.
- **The rules FRAME THE WORD, not the viewport** (Nate's revision, `c2aa88f`).
  Markup is `.mark` = rule / word / rule as one centered flex column; the column
  carries `--veil-word-w`, so the rules are as wide as the glyph artwork by
  construction (`.word` is just `width:100%`) — no second clamp to keep in sync.
  **Gap is derived, not picked:** `--veil-rule-gap = calc(--veil-glow-blur * 2)`
  and `.glow` reads the same token, so retuning the glow moves the frame with
  it. Measured against the real render (rules hidden): the glow tail runs +9
  luminance at 4px above the word, +2.3 at 20px, and hits background at **24px**
  — exactly where 2×blur lands. Knobs: `--veil-rule-tint` / `-opacity` /
  `--veil-word-w` / `--veil-glow-blur` / `--veil-rule-gap`.
- ⚠️ **Accepted tradeoff:** centring the column means its absolute Y follows the
  word's height (width × 72/413, rarely integral), so the 2px line can rasterize
  on a half-pixel. The rhythm INSIDE the mark stays exact (gap/cap/line are whole
  px and shift together — the shared centerline never breaks); only the raster
  softens, imperceptibly at these opacities. Forcing an integer origin would mean
  duplicating the artwork's aspect ratio in CSS. **The probe no longer asserts
  integer-y** — it asserts rule-width == word-width, shared left edge, and
  symmetric gaps instead.

`src/lib/components/landing/LoadingVeil.svelte`. Originally covered the WebGL
starfield first-paint gap on hard loads of `/`. Glyphs are **Nate's own original artwork** (exported from Affinity to
`assets-src/transitions/loading.svg` — gitignored source master; the IP
concern about HoYo's cipher font is moot). **CLOSED by Nate 2026-07-11**
("Boom, this looks great") after iterative preview: he drove Chrome-throttled
tests himself; headless Chrome+WebKit renders verified identical.

## Refinements after Nate's throttled preview (`6536e30`, `e0cde24`)

- **MIN_HOLD_MS = 1100** (from first contentful paint): Nate found the ~450ms
  fast-connection dismissal read as "what was that?". The hold lets the glyph
  entrance play; slow loads exceed it naturally; reduced motion skips it.
  Measured: fade starts ~1.16s, removed ~1.6s on a fast load.
- Word sized down twice → `clamp(8rem, 20vw, 14rem)`; gradient floor
  `#0a1428` → `#0e0f12` (near-black gray, per Nate).
- **Grain = inline feTurbulence at 0.08, NOT the scene's noise-128 tile**: the
  tile has a wrap seam every 128px — invisible under sky-bg's `overlay` blend
  on brighter tones, obvious composited plainly over near-black. Turbulence is
  seamless and also dithers the banding of the 14-step near-black gradient.
- **Glyph midline hairline is DESIGNED**: the cipher glyphs are bisected at
  midheight in Nate's raw Affinity export (verified by rendering it directly);
  not an SVGO or AA artifact. Don't "fix" it.
- **Per-glyph shimmer (`9aed443`) + worn resting levels (follow-up)**: each
  glyph breathes on its own opacity cycle — duration (3.4–5.1s), phase, peak
  `--lit` (0.68–0.95) and floor `--dim` (0.38–0.55) via nth-of-type custom
  props feeding ONE shared keyframe set (vars resolve per animated element).
  The word is NEVER uniformly lit — entrance lands on `--lit`, not 1 (Nate:
  full-opacity reads as artificial/un-worn; keep this on any redesign). Nate
  asked for "slower than firefly glow". Note: glyph opacity changes re-raster the drop-shadowed ink
  layer per frame — small region, dies with the veil; fine.
- Nate's throttling findings (Chrome DevTools): fast-4G ideal; slow-4G stars
  ~2s late after veil; 3G stars ~10s late. Accepted — gamer audience.

## Implementation facts

- SVG: SVGO'd Affinity export 49.9→9.7KB (precision 1, `mergePaths: false` to
  keep 7 per-glyph paths — default SVGO merges them and kills the stagger).
  `/` HTML 9.4→19.7KB raw / 6.9KB gzip.
- Look: fill `#00a8ff` + tight drop-shadow on the ink; wide bloom = a blurred
  (0.75rem) `<use>` clone behind it whose **opacity-only** pulse stays
  compositor-safe during chunk parse. Bg: `#000→#0a1428` gradient blended with
  the scene's noise tile (same request as sky-bg). Per-glyph staggered
  rise+fade entrance (70ms steps), all pure CSS so it animates pre-hydration.
- Chrome behavior note: the `<use>` clone does NOT mirror the originals'
  entrance animation → the full word's glow shows faintly before the ink
  staggers in. Kept deliberately — reads as "smolders before igniting."

## Scoping pattern (reusable: "SSR-only element that survives hydration")

`let show = $state(browser ? document.getElementById('loading-veil') !== null : true)`
— SSR renders it; at hydration the component finds its own SSR DOM and keeps
it; a fresh SPA-nav mount finds nothing and renders nothing. No flags/stores.
Dismissal: two rAFs after `onMount` (starfield has presented its first frame
by then — TwinkleStars starts it in an `$effect`, which flushes before rAF),
then a 400ms opacity transition, removed on `transitionend` (+3s backstop).

## Safety nets

- CSS-only self-destruct: `veil-bail` animation at 8s `forwards`
  (opacity 0 + visibility hidden) — JS blocked/failed chunk can't strand it.
- `<noscript><style>` hide via `{@html}` (eslint-disable needed).
- `prefers-reduced-motion`: no flourish, quick 120ms functional fade.

## Verification

`scripts/probe-loading-veil.mjs` (preview on :4998) — 11 checks: SSR scoping,
paint→fade→DOM removal (~460ms on localhost), SPA-nav absence, JS-blocked
bail, reduced-motion dismissal. Gotcha encoded in the probe: when testing the
no-JS path, abort only `**/*.js` — blocking all of `_app/immutable` kills the
stylesheet that carries the bail animation and fails the test spuriously.

## Related

- `docs/archive/perf-audit-2026-07-10.md` — the starfield conversion that created the gap
- `docs/rounds/rotation-planner-ssr-fix.md` — sibling hydration-safety pattern for SSR routes
