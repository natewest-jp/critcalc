# Retiring the old layout (step 5, passes A to F) — 2026-10-31 and 2026-11-01

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

- A visitor whose last visit predates ownership tracking gets constellations but no ownership from the migration: the old loader seeded ownership from constellations, and `migrate.ts` reads `critcalc:ownership` raw. ⚓ Nate 2026-11-01: a non-issue. Ownership tracking arrived on 2026-07-20, before the site was live, so no visitor and no backup file predates it.

## Pass C (same day, `refactor/old-layout-pass-c`)

- ⚓ **A storage failure falls back to the in-memory stand-in** (Nate 2026-10-31). `storageSession.start()` used to drop the tools onto their old localStorage tab models when starting on the store failed. It now releases any locks the attempt took and starts again on `boot.ts` `openInMemory()`, so there is one document model whatever happens, and the memory notice tells the player. Only if that fails too do the tools take their defaults, persisted nowhere. Test: `session.test.ts` › "a store the session cannot start on". With it went `rotationTabs`/`boards` `restore()` and their localStorage writes, and the keys' constants.
- The navigation-start Planner prewarm: it read the localStorage tabs the migration froze, so it warmed the pre-flip rotation. The idle warmer for open tabs stays.
- The overlays nothing could open any more: `chromeModal.svelte.ts` (its one live job, Coverage's opener, is inlined in `openCoverage`), `ChromeModals`, `ChromeOverlay`, `NavPanel`, `LibraryOverlay`, `LibraryView`, `CloseMark`; the Help shell's and AreaTabs' `modal` mode; RosterTab's `inMenu=false` form; `library.svelte.ts` down to the Roster's focus; `/library` a placeholder like the other section routes.
- CSS: every rule that applied only without `data-next`, and every `.band-a` rule. ⚠ The `:not([data-next])` rules also styled the frames before hydration (behind the loading veil, so with JavaScript nothing was ever visible). Without JavaScript the prerendered tools now paint `.btn` in sentence case, as after hydration, but control chips in `.chip`'s Title Case and selected segments, chips, on plates and filters with no selection mark, since the surviving rules wait for `data-next`. Not a player regression; the `data-next` branch settles it. `.site-chrome` and `--chrome-tag` went with SiteChrome.
- `crestPose` lost its lean and `SIDE_LEAN_DEG` (the side crane is gone).
- The comments that still described the switch were rewritten.
- ⚠ A line-based CSS script split a comment that mentioned `.band-a` into a selector list; `app.css` was restored and the cut redone with a comment-aware parser. Any CSS rewrite by script parses comments first.

## The review (same day, `fix/retirement-review`)

A twelve-agent review of `561e09b7..943335d6`, six dimensions each checked by a skeptic: 21 findings held, 3 were refuted as older than the range. After hydration the text is identical to before on every route, with no hydration warnings, and no collapsed branch behaves differently. Fixed on Nate's go (items 1–4):

1. The scene footer (the HoYoverse notice) shared the top bar's gate, so the server stopped rendering it. It has its own gate now, `!isToolPath && (!browser || TopBarC)`: the server renders it, and the browser waits for the top bar as before.
2. After the memory fallback, Backup, Restore and Delete everything acted on the memory store, so the way out of a store that will not start did nothing. They act on the browser's own store (`#home`); a store that will not read gives no backup rather than an empty one.
3. The failed start's waits for documents another tab held survived the fallback; one could later take that tab's lock and replay its journal into memory. `#abandon()` gives up locks, waits and read-only marks.
4. A throw after the session is running no longer falls back (it would swap working documents for an empty store). No test: it needs a throw after `active`, which nothing reachable produces now.

Tests: `session.test.ts` › "a store the session cannot start on" (the last two fail without the fix). Then (`docs/retirement-cleanup`): the stale docs and comments the review found, the orphaned 1360px content stop, the dead hit-box selectors, and COPYRIGHT.md's artwork lists (Nate: only the Help glyph and the bench tail are his own; the cog, compass, Teams figure and notification mark go under HoYoverse).

## Pass D, the old document model (2026-11-01, `refactor/old-layout-pass-d`)

Found by reading every caller of `documentBar`, `boardBar`, `rotationTabs` and `boards` against what the storage session reaches. The session always hands each tool ONE document (`restoreFrom` with a single tab or board), so everything that chose among several was unreachable.

- **`be40e541`, the machinery.** documentBar's Save, Save as new, Load, Close all, the twelve-tab limit and its make-room confirm, Recently closed, the tab strip model and the bank's team entries; boardBar's equivalents; rotationTabs' and boards' switch, add, open, adopt, close, rename, reorder and reset; the `synced` flag and `viewedAt`; the restore-time `manualSlots` fold (nothing that restores carries it now). Whole files: `tabSet.ts`, `TabLimitDialog`, `library.ts`, `RotationNotes`. The `savedNotations` and `savedBoards` stores went; only the `SavedNotation` type stays, the shape the Builder's pins read through `storageSession.savedRotations()`. The Planner's `'notes'` aside went with `plannerView.hasCaveats`: the Inspector's team page carries the same caveats and the sample credit.
- **`01538e78`, the shape.** `rotationTabs.tabs`/`activeTabId` became `rotationTabs.tab`, `boards.boards`/`activeBoardId` became `boards.board`, and the session's pending write, save collection and journal read one of each. `prewarmPlanner.ts` went too: it warmed tabs you weren't looking at.
- **What stays:** documentBar is arrivals, Try in Planner and Share (the link and the timeline's KQM and PNG exporters); boardBar is arrivals and Share. The migration and the backup parser still read every legacy key; the backup's two list caps moved into `settingsBackup.ts`.
- **One behaviour change, in a path nobody should reach:** with no store at all (even the in-memory stand-in failed), an arriving link used to go through `adopt` and the make-room confirm. It now takes the place of the tool's defaults, which persist nowhere either way. Test: `rotationTabs.test.ts` › "documentBar.receive — with no store". The Undo tests now swap documents the way the session does.
- **Corrected on the to-do list:** `rotationsForTeam`/`pinnedRotation` were listed as old-layout code to retire. They are live: the Builder's team rotations and pins, matched by set over the store's rotations.
- Not done, deliberately: renaming the `rotationTabs` module and `RotationTab`, which would touch every importer for a word.

### Pass D's review (same day, `fix/pass-d-review`)

A `/code-review high` of `84eb2ce8..9bbbd6c8`: ten findings, one refuted (`closeIfShowing` still serves the Log, from `RotationTimeline`). Fixed:

- `rotationTabs.tab` held a copy of the document's content from load time, which nothing refreshes now that `flush()` is gone. It is `TabMeta` now (id, label, sample), so a reader can't reach stale content. Two readers had been reading it, both wrong since before pass D: Compare's "nothing to duplicate" test (a blank typed into stayed disabled until a reload) now reads the live notation and seats; the Builder's errand row ("From the Planner: …") and the PNG title read the session's stored name (`nameOf`), falling back to the label derived from the current team as the top bar does (⚓ Nate: keep a stand-in title on the export; the layout reads better with one).
- Dead or stale: the aside's `'Notes'` title fallback and the planner comments describing a Notes button, `tabCharacterIds` (only a test used it), `boardWorthKeeping` → `boardHasMembers`, comments citing `stores.ts` key constants, `library.isTeamEntry` and `hasCaveats`, and the date on CLAUDE.md's layout line.
- Left, as a judgment: with no store at all, an arriving link replaces the work on screen, where the old `adopt` refused to. That state persists nothing anyway (the work is gone at the next reload), and refusing would need a new notice to say where the link went.

## Pass E, `data-next` itself (2026-11-01, `refactor/data-next`)

The root layout no longer sets `data-next` on `<html>`, and every rule scoped to it is unwrapped, so the profiles layout's CSS applies from the first frame instead of waiting for hydration.

- 23 rules were `:where(:root[data-next]) …` (app.css, CharacterFilterStrip, ToolStack, the Builder page, InstrumentPicker). `:where` adds no weight, so dropping the prefix is exact.
- Three had weight and were folded by hand. `--chrome-h` is `var(--ui-bar-h)` in the base `:root` (it was 64px until mount). Band B's `font-size: var(--ui-ctl-fs)` joined `.band-b .tab, .band-b .btn`, going from (0,4,0) to (0,2,0); no rule that could then outrank it reaches a band B control (component rules setting `font-size` on a `.btn` were read: the error page, the menu places, the dock and the board). The scene chrome's z-index 10 is its base rule.
- **Measured, not assumed.** A computed-style snapshot of every element on all 22 routes at 1600 and 390 wide, with `Math.random` seeded (unseeded, the Planner's sample made two runs of `main` differ in 1,219 places). After hydration: 0 differences against `main`. Without JavaScript: no structural differences; what changed is the hydrated look arriving early. The bar reserve is the bar's height (56px at the default size, so pages and tools sit 8px higher), toolbar type is at control size, lit plates and chosen segments fill gold, the planner's centre zone loses the rail it no longer has, and the Visualizers' picker is in sentence case.
- For Nate's eye: a cold load in real Safari and Chrome (with JavaScript the frames before hydration are behind the loading veil, so nothing should change), and a page with JavaScript turned off. ⚓ Nate 2026-11-01: looks good.

## Pass F, what band A left behind (2026-11-01, `refactor/old-layout-cleanup`)

- **The toolbar maths.** `BAND_A_H`, `BAND_STACK_H` and `BAND_STACK_TO_SURFACE` existed only so `ribbonHead` could add band A's height and take it back out; it is `bandBH + BAND_STACK_GAP` now, the same number. `BAND_CTRL_H` had no reader. `toolBands.ts`'s header describes the one toolbar.
- **The dead CSS.** `.tab`, `.tab--lg`, `.tab--closeable`, `.tab-close` (with their focus and hit-box entries) rendered only on `/lab` and `/styleguide`, whose specimens went with them; the Builder's `.tb-doc-actions` (band A's end zone) rendered nowhere. The centre zone's two rules, the second undoing the first's padding and ground, are one rule. A sweep of every component's scoped classes against its own markup found no other dead selector (the rest are built as `x--{variant}`).
- **Comments that described band A, SiteChrome, NavPanel or document tabs as present**, across ToolStack, toolBands, toolColumns, benchBand, TopBar, the Planner, Builder and Visualizers pages, the tools layout (two tombstones for rules SiteChrome made unreachable), the error page and the style guide. Rulings that still govern a value keep their reason.
- Measured as in pass E: 0 differences against `main` after hydration and without JavaScript.

## Gates

Passes A–C: vitest (2692; −3 for the deleted seed tests), svelte-check 0/0, lint, build; e2e as in the merge commit. Pass D: vitest 2664 (−28 with the deleted code, +2), svelte-check 0/0, lint, build; e2e Chrome 71 passed at each commit. Passes E and F: vitest 2664, svelte-check 0/0, lint, build; e2e Chrome 71 passed, both engines 142 before E's merge.
