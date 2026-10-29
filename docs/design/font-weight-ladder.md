# Font weight ladder

> Moved from Claude's working memory on 2026-10-29, where it was kept as a living reference. Check the code before relying on a detail.

**IBM Plex Sans is a VARIABLE face since 2026-08-11** (`@fontsource-variable/ibm-plex-sans/wght.css`, family `'IBM Plex Sans Variable'`). All four rungs resolve to themselves:

`--fw-normal 400` · `--fw-medium 500` · `--fw-semibold 600` · `--fw-bold 700`

Before that, only two static faces were loaded, so **500 folded onto 400 and 700 onto 600** — four token names, two rendered weights, and every hierarchy written across them was decorative. ⚓ Nate caught the 400/500 half by eye.

⚠ **THE SWAP WAS CHEAPER THAN THE BUG.** The weight-axis latin file is 44.6 KB against the 45.8 KB of the two statics it replaced — the whole ladder for 1.2 KB _less_, in one request instead of two. Buying statics for 500 and 700 would have been 91.7 KB for four fixed rungs. ⛔ Don't "save weight" by going back to statics.

## Still traps

- ⚠ **700 is the CEILING** of Plex's axis — 800/900 clamp to it.
- ⚠ **`--font-mono` and `--font-condensed` are STILL static 400/600** (no variable cut exists for either). Reaching for `--fw-medium` on mono or condensed text puts you straight back in the folded case.
- ⚠ **The canvas literal in `timelineExport.ts` must name `'IBM Plex Sans Variable'`** — canvas takes a font STRING and can't resolve a custom property. Left stale it drops every exported label to a system sans: renders perfectly, only visible holding a PNG next to the screen.

## 🔬 How to detect a fold

⛔ **Computed style CANNOT show one** — it reports the weight you asked for whether or not a face exists to draw it. Measure the **rendered advance width** of a string at each weight:

```js
probe.style.fontFamily = '"IBM Plex Sans Variable"'; probe.style.fontSize = '40px';
for (const w of [400,500,600,700,800]) { probe.style.fontWeight = w; …getBoundingClientRect().width }
```

Identical widths = a fold. (Pre-swap: 400.844 at both 400 and 500; 412.563 at 600, 700 AND 800.)

The rule generalises: **CSS font-matching walks DOWN for a target ≤500 and UP for ≥600**, so missing faces fail silently and plausibly in both directions.
