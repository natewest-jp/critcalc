# Notices, the shortcuts sheet, and page meta — 2026-11-23

Round 4 of the translation item in `docs/todo.md`, after the frame pilot
(`i18n-frame-pilot-2026-11-19.md`): the three surfaces that record named as next, extracted
and drafted in Japanese, still hidden. Stacked branches: `feat/i18n-notices-keys-seo`
(extraction, a writer fix), `feat/i18n-ja-notices-keys-seo` (the Japanese draft, a text
fix), and this record on `docs/i18n-notices-keys-seo`.

## What was built

- **164 messages extracted, English unchanged.** The visible text, meta and labels of every
  prerendered page under `/`, `/ja` and `/zh` match `main`'s build line for line (diffed from
  both builds); only `/en-XA` changed. Notices are client-only, so the prerender diff can't
  see them: the toasts were checked in headless Chrome instead.
- **Notices** (70): the returning-visitor and links dialogs, toast and banner chrome, copy
  results, arrival notices, and the storage session's toasts and banners.
  - A toast that states a name builds from a message through `namedMessage()`
    (`src/lib/notices.svelte.ts`), so a translation can move the name while it keeps its
    heavier weight. A value that is itself a NoticeText (`{name}’s Library` inside "Comparison
    closed · … is in …") is spliced in with its own name. Test: `src/lib/notices.test.ts`.
  - "This {rotation|lineup} was deleted…" assembled the type's English word; it is two whole
    messages now.
  - The phone list's "**Title:** body" is one message with markup, so the colon is the
    locale's (Japanese uses `：` and no space).
  - The new blank lineup's name, "Lineup 1", was made a message here and reverted in the next
    round (`i18n-sections-2026-11-23.md`): it is a placeholder `isMintedLabel` knows by its
    English, never shown as a name.
- **The shortcuts sheet** (44): its table is `keyAreas()`, built at each opening. Key names
  (Esc, Space, Home, Delete) stay as printed on the key.
- **Page meta** (50): `seo.ts`'s map holds message getters (`entry()`), so each prerendered
  page reads its own language; the error titles in `SeoHead.svelte` are messages too.
- **The extractor read no `named` template**, so about twenty name-bearing toasts across the
  site were missing from the ledger. It reads them now; the Builder's, the Visualizers' and
  Profile's appear in their own surfaces' inventories, waiting with those surfaces.
- **The pseudo-locale writer formats its output with Prettier**: a fresh `en-XA.json` failed
  `npm run lint` after every English change.

## Left in English on purpose

The two thrown internal errors (`transaction aborted`, `storage unavailable`, never shown to
anyone), the stored default profile name My profile (the migration notice quotes it as
data), and Gauge Explorer, which waits for the Visualizers' instrument names.

## The Japanese draft: new terms for the reviewer

更新情報 (What's new) · ほしいものリスト (wishlist, kept apart from the game's 祈願) · 編成
(Party Setup) · 枠 (slot) · セオリークラフト (theorycrafting, the activity; the profile keeps
its English name, Theorycraft) · 元素付着 (an application) · イベントログ (event log) ·
OK (Got it) · 計器 (instrument, in the Visualizers' meta) · 対応状況 (coverage, as in
Character coverage) · 協力する (Contribute). The frame's house terms carry over unchanged.

## Text fixed directly

"Saved to Theorycraft · it doesn’t match {name}’s roster" had straight apostrophes, the one
string on the surface that did.

## Verified

Gates on each branch: vitest (2,981), check, lint, build. `npm run test:e2e` on the Japanese
branch: 147 passed, 1 skipped, both engines. In headless Chrome against the production build:
`/ja/planner` with the shortcuts sheet open, and a broken share link's toast in `/ja` and
`/`, with no page errors.

## For Nate's eye

- In Japanese, the gold section labels (the kicker) keep their wide letter-spacing, which
  reads as 所 持 キ ャ ラ. A `:lang(ja)` tracking value may want tuning; it is a visual call.
- The shortcuts sheet in Japanese at 1440 wide: a few action lines wrap to two rows.

## For when a locale opens

`SeoHead.svelte` points every page's canonical at the unprefixed (English) path. That is
harmless while `/ja` is `noindex`, but a public `/ja` needs its own canonical and `hreflang`
alternates, or search engines fold it into the English page.

## Next

The full-screen sections (Library, Profile, Teams, Trash, Roster) are the remaining
frame-adjacent surfaces; then tool interiors and Help.
