# Flip readiness: 2026-10-26

On the evening of 2026-10-26 Nate asked for one last sweep before making the redesign (the `?next` switch) the default, with two things already known to be required: the static pages' screenshot placeholders and a notice for returning visitors. Four agents swept the code changed since `340f78b1`, the browser surface, the open items and the flip mechanics. The gates on `main` at `42dd4a4c` were green (vitest 2606, check, lint).

**⚓ Nate's decision: postponed to 2026-10-27.** Nothing found is large, but the "must do" work comes to about two hours, and it was midnight. This record is the plan for the next session.

## 1. Must do before the flip

1. **The flip itself (~25 min).** The raw key `critcalc:nextLayout` is read in TWO places, and they must flip together:
   - `src/lib/nextLayout.ts`: `read()` becomes `getItem(KEY) !== '0'`. `set()` removes the key for on and stores `'0'` for off. `fromUrl` gets `if (!dev) return;`, so `?next=0` only works in dev. Update the header comment.
   - `src/lib/stores.ts` `underSwitch()`: the same `!== '0'` test. ⚠️ If this one is missed, the roster stores read and write localStorage alongside the IndexedDB session, silently.
   - Delete the "Use the new layout" section in `SettingsPanel.svelte` (~347–362), and its CSS note in `app.css` (~4352).
   - Keep a stored `'0'` working in production. No user can reach it, but the e2e fixture needs it (item 3).
   - A browser without IndexedDB still reads the switch as off and gets the whole old layout. That is acceptable until step 5's localStorage stand-in.
2. **Two Undo toasts that can overwrite data (~20 min together, plus a vitest case).** Both closures act on whatever is active at the click, and nothing dismisses the toast when that changes. This is the same class as the roster ⌘Z fix in `84c9a12f`, come back by another route.
   - `rotationTabs.svelte.ts` `#snapshot` (used by `takeOff` and `clearWithUndo`). Scenario: Clear rotation A, open rotation B within the toast's life, click Undo. B's text and seats are replaced by A's and autosaved; A stays cleared. Fix: capture `activeTabId` and do nothing unless it still matches.
   - `RosterTab.svelte` `bulk` / `takeBack`. Scenario: "Mark all owned at C6" in profile A, switch to profile B, click Undo. B's ownership and constellations for that list are overwritten with A's old values. Fix: capture `storageSession.profile?.id` and do nothing if it changed.
3. **The e2e suite (~15 min plus a 6-minute run).** All 80 tests (12 specs) run the OLD layout and none passes `?next`, so most would break at the flip.
   - Cheapest fix: in `e2e/fixtures/critcalc.ts`, an `addInitScript` that sets `critcalc:nextLayout` to `'0'` when it is absent, keeping the suite as the guard of shared code.
   - That leaves the new default covered only by vitest and this sweep's browser pass. A smoke spec for the new layout (~45 min) is a PROMOTION, so it waits for Nate's approval.
4. **The returning-visitor dialog (~30–45 min, plus Nate's copy).**
   - **The signal:** decide it inside the migration branch (`boot.ts` ~48, the `migratedAt` check) and store it as e.g. `meta.flipNotice` beside `backupOffer` in `writeMigration`. Use "any `BACKUP_KEYS` entry (`settingsBackup.ts`) exists RAW in localStorage", ⛔ not `parsed.ok`: a sanitizer dropping one empty tab would miss a real visitor.
   - **Who it catches:** anyone who ever opened the Planner or Builder (the old tools layout writes `rotationTabs` on any visit). It misses visitors who saw only the landing, About, Help or Visualizers, which is acceptable.
   - **Who it misses:** testers who already migrated never see it, so build a dev trigger.
   - **The component:** `notices.ask` is a centred paper dialog the backdrop does not dismiss, but its body is one plain string. If the copy needs a list or a link to What's new, clone `LinksDialog.svelte` instead.
   - **Mounting and order:** mount it in `(scene)/+layout.svelte` beside LinksDialog, so it also shows on the landing. Clear the flag on dismiss, as `backupOffer` does. HOLD the migration toast until the dialog is dismissed: the browser sweep saw two notices at once on a shared link.
5. **A What's new entry** in `src/lib/help/chapters/Changelog.svelte`: an `<article class="entry">` placed first in the October `.timeline`. The copy is Nate's.

## 2. Should do, Nate's call whether before the flip

- **Stale Help copy, about 10 places that the new layout shows (~25 min once the wording is approved; propose it as a numbered list):**
  - `RotationPlanner.svelte` ~120 says the portrait opens details; it opens the inspector, and Help documents the inspector nowhere.
  - `RotationPlanner.svelte` ~327 says "Notes … disabled when"; the button is now Inspector and is never disabled.
  - `RotationPlanner.svelte` ~368 says "Compare in the toolbar"; Compare is on the bench.
  - `RotationPlanner.svelte` ~399 and `TeamBuilder.svelte` ~287 say "Share in the top bar"; Share is in each tool's toolbar.
  - `TeamBuilder.svelte` ~121 and ~271 say "Show"; it is now the Owned/Wishlist pair.
  - `TeamBuilder.svelte` ~220 says a bench portrait opens swap mode; ⇄ does. `TeamBuilder.svelte` ~234 says "a new rotation with the team's names"; they are seated, resting.
  - `Faq.svelte` ~119, `Beta.svelte` ~38 and `Contribute.svelte` ~31 say "Report a problem in a tool's ⋯ menu"; it lives in the top bar's `?` menu, desktop only.
  - `Privacy.svelte` ~36 and ~61 mention "loadouts" (on the team-loadouts round's copy list).
- **The "screenshot placeholders" (~10 min).** The slate mock is `{#if dev}` and absent from the build (verified). A visitor instead sees the EMPTY margin column: `MenuState.svelte` ~866 `minmax(16rem, 28rem)` reserves it beside every Help or About chapter above 56rem. Use one column when a chapter has no margin content.
- **Space or Home under the menu state plays the Planner (~5 min).** `onTransportKey` (`planner/+page.svelte` ~389) stops only on `aria-modal`. Add the `[data-menu-state]` guard that `session.svelte.ts` ~2223 already uses.
- **Restoring a team from the Trash can duplicate an existing four (~10 min).** `untrash` → `#revive` skips the one-team-per-set rule that `saveTeam` and `updateTeam` keep. It is recoverable: each copy's `clash` is the other, so Save refuses until one is deleted.
- **The Planner inspector still uses the roster's level** (`PlannerInspector.svelte` ~119, `conMode="mine"`), shows the "use the selector on the Planner" note, and shows "Your roster" in Theorycraft (~30 min).

## 3. Rulings needed

- **A returning visitor who opens a shared link STAYS in Theorycraft.** Opening in Theorycraft is by design (`docs/rounds/profiles-round.md`, §9.3). But in a later tab, plain `/planner` and `/library` show none of their work, and the top bar says "Add a profile". Nothing is lost: the switcher brings it all back. After the flip, shared links are how many returning visitors will first arrive. Options: return to the real profile on the next visit, or let the dialog explain it.
- **The first paint is the old layout on every cold load.** The server renders with the switch off (`read()` is false without `browser`), and `data-next` is set in `onMount`, so every page paints the old shell and then hydrates across `{#if}` mismatches. Testers already live with this. Nate is to look at a cold load of `/library` and `/roster` in his own browser; server-rendering the new layout is its own job.
- **The sitemap.** `/library/rotations`, `/library/lineups`, `/profile`, `/profile/new`, `/roster`, `/teams` and `/trash` are left out "until the release" (`seo.ts` ~149), yet they carry a canonical link and no noindex. Add them, or mark them noindex (~10 min).

## 4. After the flip

- **§1.10 of the bug sweep:** a failed storage open (or a migration that throws, since `boot.ts open()` returns `null` for both) quietly reloads the tab into the old model. That is safe today, because a migration bug shows the user their old data. The honest replacement (a sticky banner, saving off for that tab) is ~45 min plus copy. ⚠️ The session's no-sink fallback would show tabs but an empty roster.
- **A tab still on the old bundle keeps writing localStorage after another tab migrated.** Those edits are orphaned but not destroyed. Later: fingerprint the legacy keys at migration and offer "changes from an older tab" (~60 min), or say it in the release note.
- **The migration toast stays until dismissed and survives reloads.** It is probably intended; it sits mid-timeline on desktop and at the timeline's foot on a phone.
- **Remaining bug-sweep §4 items:**
  - Builder `?team=` goes into Theorycraft's current lineup and is dropped when that lineup is full.
  - The top bar's Beta link is a plain `<a>`.
  - `/roster` and `/teams` flash the Theorycraft invitation on a cold load (`isTheorycraft` is true while the profile is undefined).
  - The blank `index` section awaits a ruling.
- **§6 parity:** Library search, its tag filter and per-row Share. The "not backed up" badge.
- **`crypto.randomUUID` runs at module import** (`records.ts` `newId`, through `session.svelte.ts`'s `#page`). It is not new since `340f78b1`. iOS 15.0–15.3 and any insecure context (a phone on the dev server over LAN `http://`) throw during module evaluation, which takes down hydration site-wide. Fallback: build an id from `crypto.getRandomValues` (~10 min).

## 5. Checked and fine

- **The browser sweep:** headless Chromium on the production build of `42dd4a4c`, 82 checks at 1440×900 and 390×844. It found zero page errors, zero console errors and zero 4xx responses.
- **First visit:** all 24 routes load cold, and Escape or "‹ Menu" leaves every section.
- **Returning visitor:** seeded with 3 saved rotations (pre- and post-slots), 2 tabs, constellations, ownership and two boards. The migration produced "My profile" with 5 rotations, 2 lineups and the roster intact, and it was stable across a reload.
- **A v3 `?r=` link:** correct for both a new and a returning visitor.
- **An edit then a reload:** the text persists at both sizes.
- **Static review of the storage layer:** trash, journal replay, purge stubs, profile delete and untrash, the team-loadout retirement, backup v3, wipe and restore, and two tabs migrating at once (`writeMigration` re-checks `migratedAt` inside its own transaction). Every destructive surface asks first or goes to the Trash with Undo.
- **Every section route** has a route file, is prerendered (`+layout.ts` sets `prerender = true`) and has a `seo.ts` entry. `static/_redirects` targets all exist.

**Limits:** headless Chromium only, with no Safari, no real touch, and no Cloudflare headers or redirects.
