# The language switcher, Plex in exports and in Japanese, and the top bar's spacing — 2026-11-26

The day's check-in plan, on three stacked branches, with one report at the end:

1. `experiment/language-switcher`: a language switcher in the top bar and in Settings.
2. `fix/png-plex-sc`: PNG exports draw Chinese and Japanese in the page's own face.
3. `feat/plex-sans-jp`: Japanese in IBM Plex Sans JP, then Nate's language icon and the top
   bar's optical spacing on top of it.

`/ja` and `/zh` stay hidden and `noindex`; nothing here opens a language.

## The language switcher

- **The model** is `src/lib/i18n/switcher.ts`. Each language is named in itself (English ·
  日本語 · 简体中文), so those names are data, not messages. `hrefIn` links the page the
  reader is on in another language, keeping `?r=` and the hash. `offeredLanguages` shows a
  hidden language only on a hidden language's own pages, so an English visitor never finds a
  draft through it, and on English the switcher appears only once two languages are open. Dev
  offers every language. Six tests in `switcher.test.ts`.
- **Two places (⚓ Nate):** a top-bar door between Help and the cog, with a menu that ticks the
  current language, and a Language row at the top of Settings' Appearance. Below `roomy` the
  door folds away and Settings carries it, as Help folds into the index.
- **Copy (Nate approved):** Language / 言語 / 语言, and the note "Opens this page in the
  language you pick." / このページを選んだ言語で開きます。 / 以所选语言打开此页面。
- ⚠️ A switch is a full page load (`data-sveltekit-reload`), as every locale move is. A
  prerendered page may not read `url.search`, so each link paints the bare path on the server
  and adds the query after mount (`withQuery`). The first build failed prerendering on
  `/ja/settings` before this.
- **The icon** is Nate's book (`assets-src/tools/language.svg`, 文A on its pages, a 40% black
  shade). It replaced his first disc the same day. Sized by ink: rasterised, the book shows
  0.90 luminous ink per height², the densest glyph on the bar (Help 0.71). Measured parity
  with Help was ×0.89 of `--disc`; Nate set ×0.96 by eye (`tune(nate)`). The viewBox is
  cropped to the ink so the box centres it.

## The top bar's spacing

Every door had the same box, so the air between two inks was whatever their shapes left:
about 14px either side of the book's flat edges, about 20px either side of Teams' narrow
figures. Each door now has a side bearing (`--sb`, in glyph heights; `--sb-l` / `--sb-r`
where a side differs) in `TopBar.svelte`, so every pair shows the same air in any lineup.

The bearings were measured as type is spaced: each side's air is the mean depth of its
rasterised profile across the bar's band, capped at a quarter glyph height. Book +0.13,
Teams −0.13, compass −0.04, the round doors 0. Nate found Teams a little close to the picture,
whose ring weighs more than the model counts, so its left side is −0.07. Result: 17–18.5px of
air per pair on desktop, 13–14.4px on a phone. Teams' hit box overlaps its neighbours' by
about 2px on a phone, in empty air.

## PNG exports in the page's face

Canvas takes a font string and draws only with a face that is already loaded. The exports
named their faces as literals, so Chinese drew in the system face. Now `exportFonts.ts` reads
the page's `--font-body` and `--font-mono` into `exportFaces` and, before painting, loads
every non-ASCII character in the snapshot in each weight the exports use
(`document.fonts.load`). On `/zh/planner` a timeline copy loaded 20 more Plex Sans SC slices
across four weights. Nate checked the exports. Three tests in `exportFonts.test.ts`.

## IBM Plex Sans JP

The same setup as Plex Sans SC (`docs/rounds/i18n-zh-2026-11-25.md`). The vendor script
became `scripts/vendor-plex-sans-cjk.mjs` and takes either package, from `npm pack`, never
installed (IBM's postinstall runs telemetry). 3.0.0 is 496 `unicode-range` slices under
`/assets/fonts/ibm-plex-sans-jp-3.0.0/`, linked only on `/ja`: about 147 KB of `@font-face`
rules gzipped on a first visit, then only the slices a page uses. JP's own line metrics give a
1.5em line against Plex Sans's 1.3em, so it carries the same ascent, descent, and line-gap
overrides as SC. `--font-cjk` leads with it under `:root:lang(ja)`. Nate compared `/ja`
before and after and kept it.

⚠️ SC's vendored stylesheet header still names the script's old filename; `/assets` is
add-only, so it stays.

## Gates

Vitest 3,073 · svelte-check 0 · lint clean · build. Chrome e2e 73 passed. Both engines 146
passed, 1 skipped, 1 flaky: the scene's GL mount failing to decode an image under parallel
load, seen in earlier rounds, passed on retry.
