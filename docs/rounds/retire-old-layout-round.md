# Retiring the old layout (step 5, passes A and B) — 2026-10-31

⚓ Nate, 2026-10-31: retire it now rather than wait out the quiet week after the flip. Rollback was already ruled out and the stand-in covers browsers without IndexedDB, so the off state helped no player and every round paid for both branches.

## What went

- **Pass A, the switch.** Every `$nextLayout`, `get(nextLayout)` and `stores.ts` `underSwitch()` read collapsed to its on side; `nextLayout.ts` is deleted. Plain `{#if $nextLayout}` blocks were collapsed by script (nesting-aware), the rest by hand.
- **Pass B, what only the off state reached.** Found by svelte-check's unused-selector warnings, ESLint's unused-vars and an import walk against `main`, repeated until clean:
  - The roster loaders in `stores.ts` (and `deriveInitialOwnership` with its test). The migration reads those keys through the backup parser (`buildEnvelope` → `parseBackup`), not through the loaders.
  - The Planner's own DetailCard modal (the portrait opens the inspector), and the old backdrops and Escape handlers of DetailCard, BossDetail and AbyssOpponents (`InspectModal` owns them).
  - Settings' old reset rows and its old import confirm.
  - Band A: `ToolStack`'s `bandALeft`/`bandARight`/`bandAClass`/`noBandA`, the three tools' band A snippets, the Builder's tab-strip model and preset menu, the Visualizers' `--ws-band-a` reserve, `benchBand.noBandA`, and `ribbonHead`'s `noBandA` argument (with `RIBBON_HEAD` and `RIBBON_RESTING_H`, which nothing read).
  - The tools layout's SiteChrome tool switcher and its sliding underline, the scene layout's SiteChrome, `sideSign` (the side crane), the Builder's Show fold (`FOLD_SHOW_W`).
  - `MenuRoute` (it only redirected off the switch); its seven routes are comment-only pages.
  - Components: `SiteChrome`, `DocumentTabs`, `DocumentActions`.
- `inheritedLoadout` lost its unused roster argument.

## Traps met

- ⚠ **The server always read the switch as off** (`read()` returned false when `!browser`). So every server render was the old layout, and the browser swapped to the new one at hydration. Collapsing to "on" is right everywhere except the pages layout, whose old panel is the prerendered HTML search engines and no-JS readers get. It stays, under `{#if !browser}`, with a comment saying why. Collapsing it would have shipped empty FAQ, Help and Privacy pages.
- The prerendered HTML no longer carries the old `SiteChrome` bar, so crawlers lose its tool links. No player ever saw it after hydration; the sitemap covers discovery.
- `documentBar.receive`'s local path is still live: it is where arrivals go if the storage session fails to start (`session.start()` → `settleDocuments(false)`). Its tests now settle `documentsReady` first.

## Noticed, not changed

- A visitor whose last visit predates ownership tracking gets constellations but no ownership from the migration: the old loader seeded ownership from constellations, and `migrate.ts` reads `critcalc:ownership` raw. This was already true since the flip.

## Left (pass C, on the to-do list)

Still wired in but unable to act: `chromeModal` and its hosts, `NavPanel`, the old Library overlay, the `:root:not([data-next])` CSS, the session-failure fallback's tab models, `crestPose`'s lean, and the comments that still say "under the switch". The CSS part moves first paint and needs Nate's eye.

## Gates

vitest (2692; −3 for the deleted seed tests), svelte-check 0/0, lint, build; e2e as in the merge commit.
