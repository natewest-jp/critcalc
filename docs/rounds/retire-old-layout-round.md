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

## Pass C (same day, `refactor/old-layout-pass-c`)

- ⚓ **A storage failure falls back to the in-memory stand-in** (Nate 2026-10-31). `storageSession.start()` used to drop the tools onto their old localStorage tab models when starting on the store failed. It now releases any locks the attempt took and starts again on `boot.ts` `openInMemory()`, so there is one document model whatever happens, and the memory notice tells the player. Only if that fails too do the tools take their defaults, persisted nowhere. Test: `session.test.ts` › "a store the session cannot start on". With it went `rotationTabs`/`boards` `restore()` and their localStorage writes, and the keys' constants.
- The navigation-start Planner prewarm: it read the localStorage tabs the migration froze, so it warmed the pre-flip rotation. The idle warmer for open tabs stays.
- The overlays nothing could open any more: `chromeModal.svelte.ts` (its one live job, Coverage's opener, is inlined in `openCoverage`), `ChromeModals`, `ChromeOverlay`, `NavPanel`, `LibraryOverlay`, `LibraryView`, `CloseMark`; the Help shell's and AreaTabs' `modal` mode; RosterTab's `inMenu=false` form; `library.svelte.ts` down to the Roster's focus; `/library` a placeholder like the other section routes.
- CSS: every rule that applied only without `data-next`, and every `.band-a` rule. ⚠ The `:not([data-next])` rules also painted the frames before hydration, so first paint changes: controls paint in sentence case from the first frame instead of flashing the old uppercase voice. `.site-chrome` and `--chrome-tag` went with SiteChrome.
- `crestPose` lost its lean and `SIDE_LEAN_DEG` (the side crane is gone).
- The comments that still described the switch were rewritten.
- ⚠ A line-based CSS script split a comment that mentioned `.band-a` into a selector list; `app.css` was restored and the cut redone with a comment-aware parser. Any CSS rewrite by script parses comments first.

## Left (on the to-do list)

- **The old multi-tab document model.** Most of `documentBar`, `boardBar` and `rotationTabs`' tab machinery is the old layout's: up to twelve tabs per tool, Recently closed, the saved banks (`savedNotations`, `savedBoards`), the make-room confirm. The profiles layout holds one document per tool; only a few paths are live (arrivals, sharing, Try in Planner, the guests' pairs). It needs a call-graph read rather than a substitution.
- **`data-next` itself**, on its own branch for Nate to compare: unwrapping the `:where(:root[data-next])` rules makes the profiles layout's CSS apply from the first frame.

## Gates

vitest (2692; −3 for the deleted seed tests), svelte-check 0/0, lint, build; e2e as in the merge commit.
