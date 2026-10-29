# The element icon generator (2026-08-11)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

**Element icons are a BUILD ARTIFACT of `--el-*-main`** — `scripts/generate-element-icons.mjs`. Change a token and the icons follow on the next `predev`/`prebuild`. **Never hand-recolor an element icon**, and never build an icon path by hand — import `elementIcon()` from `src/lib/data/elementIcons.generated.ts`.

## The rule (⚠ REWRITTEN 2026-08-11, `82d91ae`)

```
icon = the token, painted onto the white silhouette.
```

Nothing read back off the art, nothing boosted, nothing offset. **The icon IS `--el-{element}-main`, exactly.**

⛔ **`SAT_BOOST`, `HUE_STEP` and `ICON_HUE_OFFSET` are DELETED, not zeroed.** All three existed to reconcile art drawn at one colour with tokens tuned to another. `docs/rounds/element-palette-round.md` adopted Genshin's palette verbatim, so the token IS the icon colour and there is nothing left to reconcile. If an element ever needs its glyph to differ from its bar again, that has to be argued in `app.css` first, not smuggled into the generator.

## The source is `flat-white`, not `flat-color`

Both are one colour + straight alpha (lossless tint), but flat-white is **128px against 84** and white art means the output is the token rather than the token filtered through whatever value the art was drawn at.

⚠ **flat-white also ships `lunar`, `omni`, `stellar` — NATE'S OWN**, traced from art Genshin uses but never drew as icons. White-only by design, **not generated** (no `--el-*` token). **He has colour schemes to suggest if they are ever wanted — do not invent one.**

## The other four sets, measured (⛔ none works on light)

`flat-color` 1.06–2.32 · `tcg` 1.38–2.14 · `glow` 1.01–1.54 · `gilded` 1.15–1.19 on parchment-100. Nothing clears 3:1. **Gilded sounds like paper and is nearly the worst** — it is bright gold _for dark grounds_.

- ⚠ **Only flat-color / flat-white are TINTABLE.** tcg (461–1201 colours), gilded (128–180) and glow (32–76) are artwork with baked palettes — using one means **that context's icons stop tracking `--el-*`**. A system cost, not a taste one.
- ✅ **Gilded is element-BLIND** (all seven the same gold within 0.05 of contrast) — Genshin's own proof that identity can ride on the silhouette alone. That licensed the ink-on-parchment rule.
- 🔎 **`glow` is their `hi` rung in icon form** (4.57–7.86 vs the star).

## ⛔ Glyph sizing is NOT normalised, on purpose

The art's glyphs fill different shares of their canvas (cryo 89%, hydro 75%). I called that a live defect and proposed fixing it in the generator; ⚓ **Nate: "to my eye, the non-normalized marks read most balanced"** — and he is right.

⚠ **My own numbers said so and I missed it:** ink area spans 1.28× where the bounding box spans 1.19×, and the two disagree about direction (hydro's box says ×1.19, its ink says ×1.00). If the art were careless, ONE metric would come out uniform. Both varying oppositely is what already-balanced-by-eye looks like. **A variance is not a defect until you can say what the correct value is.** Both rejected normalisations are still rendered on `/lab` as the evidence.

## Implementation constraints (all load-bearing)

- **Lossless tint:** sources are FLAT and PNG alpha is **straight, not premultiplied**, so replacing RGB per pixel while preserving the alpha byte recolors edges correctly. Silhouette out = silhouette in.
- ⚠️ **ADD-ONLY ASSETS.** `static/_headers` serves `/assets/*` immutable for a year. Outputs are `static/assets/elements/tinted/{el}-{hash}.png` where the hash is of the **colour** — a token change yields a NEW filename; superseded files are swept. This is why call sites must use the manifest.
- Wired into `predev`/`prebuild`; manual run is `npm run generate-element-icons`.

Related: `docs/rounds/element-palette-round.md` · `docs/rounds/color-families.md` · `docs/rounds/style-reference.md` · `src/lib/utils/elementColors.ts` is the runtime mirror and is locked to `app.css` by `timelineExport.mirror.test.ts`.
