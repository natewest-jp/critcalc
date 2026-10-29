# HRule: the ornamental horizontal rules

> Moved from Claude's working memory on 2026-10-29, where it was kept as a living reference. Check the code before relying on a detail.

**`src/lib/components/HRule.svelte`** — shipped `ee67f98`, MERGED to main `238a783` 2026-07-26. Nate's artwork, available site-wide.

```svelte
<HRule />
<!-- cap ————————————— cap  -->
<HRule variant="center" />
<!-- ————————— ✳ ————————— (NO endcaps) -->
```

Sources: `assets-src/transitions/hr-endcap-left.svg`, `hr-center.svg` (gitignored Affinity masters). `hr-endcap-right.svg` is **redundant** — see rotation below.

## The normalization that makes it work

All artwork is a 17-unit-tall export sharing one centerline, mapped through **the same transform**: **scale 0.5 · centerline → y=5 of a 10px box · art → y 0.8–9.2**. That is what puts the 2px line on the pixel grid, and it is why caps and the center mark can't drift apart. Cap box **19×10**, mark box **28×10**. Re-derive with SVGO (`floatPrecision: 2`, `removeAttrs: path:(fill|style)` — Affinity stamps `fill:rgb(129,129,129)` inline and it beats the stylesheet).

## Four things that are NOT arbitrary

1. **⚠️ Rotate the cap 180°, never flip it.** The caps are point-symmetric, not mirror-symmetric (`13.8,0.8` → `4.8,9.2` under rotation; `scaleX(-1)` points the chevron the wrong way).
2. **⚠️ Cap join needs the 1px `<rect>`.** The art tapers to a knife edge and only spans the full 2px band at its tip; the axis-aligned `crispEdges` rect carries the band to the box edge so the line has something square to meet. Overlap **1px** (defeats sub-pixel rounding only).
3. **⚠️ Center-mark join overlaps 2px.** Its sides are POINTS, and the wedge is thinner than 2px for ~1.5px past each tip — a butt join pinches visibly. `margin-inline: -2px` on the mark pulls the lines in over that stretch.
4. **⚠️ `--rule-opacity` is a GROUP fade, parts stay opaque.** Translucent parts stack at every overlap and show a brighter notch at each join (obvious at 8× zoom).

## Styling

`--rule-tint` (default `currentColor`) · `--rule-opacity` (default 1). Width comes from the parent; the line takes the slack. Consumers set the knobs on a wrapper — the veil maps its own `--veil-rule-*` onto them so Nate's tuned values keep their names.

## In use

- **Loading veil** (`docs/rounds/abyssal-loading-screen.md`): two capped rules framing the word — see that memory for the mark column and the derived gap.
- **Site footer**: `<HRule variant="center" />` above the disclaimer at the same 62rem measure. **Test placement pending Nate's visual confirmation**; it shows on the content pages too, since `SiteFooter` is shared.

Geometry is guarded: `probe-loading-veil.mjs` (capped, in the veil) and `probe-site-chrome.mjs` §7 (center, in the footer — asserts no caps, shared measure, 2px line, exact 2px overlaps).
