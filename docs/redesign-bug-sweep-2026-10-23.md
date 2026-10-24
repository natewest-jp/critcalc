# Redesign bug sweep — 2026-10-23

A hunt for bugs, gaps and unwired things in the profiles-and-surfaces redesign (everything behind `?next`), run on `main` at `58f98af1` before the flip. Four agents: the storage layer (code, with throwaway `fake-indexeddb` vitest runs), the UI wiring and parity with the old model (code), desktop journeys in headless Chrome, and links / two tabs / phone / WebKit in headless Chrome + Playwright WebKit. The serious findings were re-checked in the source afterwards, and the phone toolbar overlap re-measured.

**Baseline:** vitest 2557, `check` 0 errors, lint clean, build OK, and no console or page error in any browser run. The happy paths held: a realistic migration (3 rotations, roster, loadouts, 2 lineups, settings) arrived intact and survived reloads; a v3 backup restores exactly; a v2 import matches a live migration; all 13 section URLs survive a reload; Back/Forward is right; every broken or hostile link is refused cleanly; no horizontal overflow at 320 or 390.

Confidence: **confirmed** = reproduced by running · **traced** = followed in the code end to end · **suspected** = read, not run.

## 1. Data loss and corruption (before the flip)

1. **A reload within ~400 ms loses the last edit** (confirmed). Planner notation lost at 50/250 ms, kept at 450 ms; a roster click lost at 100 ms. The old layout kept it at 50 ms. Writes are debounced by `SAVE_DELAY_MS` (`storage/session.svelte.ts:78`) and the only early flush is `#onVisibility`, whose IndexedDB write does not finish before the page unloads. "Saving…" shows only during the write itself, so the losing window has no signal. Likely fix: a synchronous `pagehide` journal in localStorage, replayed on the next load.
2. **One failed write ends autosave for the page, silently** (confirmed). `#flushing = #flushing.then(() => this.#write())` (`session.svelte.ts:228`) stays rejected once a write throws, so every later flush is a no-op; `#profileQueue` has the same pattern, and `restore()` throws after it too. Triggers: quota, WebKit's "Connection to Indexed Database server lost" after a backgrounded iPhone tab, a `DataCloneError`, a future `DB_VERSION` bump closing the connection.
3. **Another tab's Delete, Rename, Pin or Move is undone by the tab holding the document** (confirmed). `#save` spreads its own `#records` copy over the stored record without re-reading it; `remove`, `rename`, `setPinned` and `moveTo` never check the lock (`isHeld` has no caller). A delete comes back, a rename and pin revert, a moved document goes back to Theorycraft. `deleteProfile` posts no per-document `deleted`, so a tab holding one of its documents can write it back live inside a tombstoned profile. Related: a Library rename of a document this tab shows read-only is dropped (`#hold` fails, nothing written, the label shows the new name).
4. **A failed Restore leaves the page frozen** (traced). `restore()` sets `#frozen` and clears pending work and locks before `replaceAll`; on a throw, `SettingsPanel` shows an error and does not reload, and `#frozen` is never reset, so nothing after it saves and a second tab can take the documents. In the OTHER tabs, the `replaced` handler sets `#frozen` but leaves `#pending`/`#rosterPending`, and `#write`/`#flushRoster` never check `#frozen`, so the reload's visibility flush can write stale work over the restore.
5. **A deleted profile left as the active pointer drops the next load into the old model** (confirmed). `get` returns tombstones, so `start()` (`session.svelte.ts:~120`) takes the fallback branch: localStorage tabs, an empty roster with no sink, the user's IndexedDB data invisible. Reached by: tab A switches to P and closes, tab B (on Theorycraft) deletes P. `peekProfile` has the same hole.
6. **A read-only tab never takes the document back when it frees** (confirmed, both engines). The lock is tried once with `ifAvailable`. After the other tab switches profile or closes, this tab still says "Open in another tab" with no lock held anywhere, and everything typed is thrown away; "Edit here" discards it by reloading the stored copy.
7. **Without Web Locks the tools never finish loading** (traced). `docLock.ts:44` throws inside the Promise executor when `navigator.locks` is undefined; `start()` rejects uncaught and `documentsReady` never settles. Safari < 15.4 and any insecure context, including an iPhone testing a dev server over LAN `http://`. `storageUsable()` checks only IndexedDB.
8. **Two tabs on the first load after migration make duplicate what-if copies** (confirmed). `#makeGuests` is guarded only by `meta.guestsMadeAt`, written after the loop; one copy is left orphaned. Also after a v1/v2 Restore, when every tab reloads together.
9. **Cross-tab roster lost update** (traced). `#flushRoster` writes the tab's whole map; two tabs editing one profile's constellations within 400 ms lose the earlier change.
10. **A transient IndexedDB open failure sends the tab to the old model for the rest of its life** (traced). `storageFailed` (`storageUsable.ts:37`) sets a sessionStorage flag; that tab then shows pre-migration localStorage data beside other tabs on the new store, and its edits land where nothing under the switch reads them. An involuntary way back (see §7).

## 2. Broken in normal use

1. **Planner toolbar controls overlap on the phone** (confirmed, re-measured). At 390 a tap on Compare hits Bench; at 320 a comparison's ⇅ and ✕ sit under Bench and Auras. The agent also measured overlaps just below several desktop fold points (Zoom over Total, Compare over Buffs at 1140; worse at Large interface size); a re-check hit test at 1140 did not reproduce it, so judge by eye.
2. **The docked notation strip covers the bottom of the phone compass menu** (confirmed): Settings cannot be tapped there (`.rp-composer--docked` / `.rp-dock-strip`).
3. **Space/Home inside Library or Help plays or rewinds the Planner underneath** (traced). `onTransportKey` (`planner/+page.svelte:376`) stops only on `[aria-modal="true"]`; `MenuState` is `role="dialog"` without it and the tool is not inert, so Tab also reaches controls under the slate. Suspected, same root: Escape in the Move dialog, the links dialog or the top-bar dropdown also closes the menu state (MenuState's window listener runs first); Escape in the Teams picker with focus outside it closes the menu and loses the team edit.
4. **Turning "Use the new layout" off leaves a half-switched UI until a reload** (traced). Moot once the toggle goes at the flip (§7).

## 3. Loadouts: beyond the known gap

↻ **2026-10-24: resolved by the team-loadouts round** (`docs/team-loadouts-round.md`): the roster default retired into teams, so the invisible migrated defaults are moved into teams and teamless rotations, and a guest no longer reads the profile's defaults (a guest has no team). The Privacy line is in that record's copy list.

Known: nothing under the switch sets a roster default loadout (the Builder modal and the Planner inspector both pass `defaultBuild={false}`). What else follows:

- A **migrated** profile keeps its old defaults (`migrate.ts:141`). They still drive every rotation's bench pill (`BenchBand.svelte:177`), parse (`RotationTimeline.svelte:580`), PNG (`:2251`) and `?r=` link (`documentBar.svelte.ts:633-653`), but are invisible and uneditable; Settings › Reset › Loadouts clears them all, which is the only way out.
- A **guest** reads the real profile's defaults: shown inside Main, it simulates and shares with Main's weapons; opened from Theorycraft, it has none. `rt.rosterless` gates levels, not the loadout merge. Moving a document into a profile also picks up that profile's defaults, unlisted in the Move dialog (suspected, may be intended by §2.4).
- Privacy (switch on) still promises a roster "with their loadouts" (`Privacy.svelte:37`).

## 4. Inconsistent or unwired

- **Builder `?team=`** goes into Theorycraft's current lineup (`boardBar.svelte.ts:184-215`), with no new document and no From a link mark, and is dropped with "The lineup is full" on a full battlefield lineup (confirmed). `/planner?team=` does make a new document.
- **The Traveler twin has two sources.** `profile.twin` is copied from Settings once at creation (`session.svelte.ts:1218`) and nothing updates it; Teams, Library, the top-bar picture, the profile form and Move read it, the tools read `$siteSettings.travelerVariant`.
- **The Planner inspector judges the kit by the roster's level** (`PlannerInspector.svelte:120`, `conMode="mine"`), not the rotation's: Theorycraft shows a C6 character's C0 capabilities, a guest shows the profile's level. Its note about the per-rotation selector is wrong under the switch, and "Your roster" shows in Theorycraft.
- **In Theorycraft the Builder reads the empty roster:** Show › Owned is empty, the "My constellations" lens gives C0 for everyone. Help says every character is there at every level.
- **Builder notices with Undo show twice** (top bar + the tool), and Undo is unreachable when neither tool spot holds (traced, visual unverified).
- **Builder Share** is enabled on an empty lineup and does nothing (`TopBar.svelte:131`).
- **The profile menu has no Teams entry** (design §2.3 lists one).
- **The top bar's Beta link** navigates to `/beta` instead of opening the section.
- **Save as team** is missing on the phone bench row (`BenchBand.svelte:129,268`).
- **Interface size** renders as unstyled browser buttons, and shows on the phone: `.sp-row { display: flex }` comes after the `.sp-desktop` media query at the same specificity (`SettingsPanel.svelte:~864`).
- **Migration reorders a rotation:** the what-if pass stamps the profile copy's `updatedAt`, so it sorts as just edited.
- Smaller: ⌃` from Help › Planner opened over the Builder flips the Planner's document (`location.pathname.includes('/planner')`) · `/roster`and`/teams`flash the Theorycraft invitation on a cold load ·`/library?tab=roster`opens Rotations · the`index`section is blank on desktop · "Duplicate and compare" on an empty blank does nothing ·`ProfileForm.create` goes to Roster even when creation returned early · a first visit through a shared link also saves the unseen sample rotation · the backup reminder is missing a space ("ago.1 saved item") · migrated names: "Shared rotation" survives as a stored name, and a saved entry named like a minted label ("Tab 2") loses it on first autosave · migration does not dedupe teams by member set (only legacy data or a v1 backup could hold such a pair) · Restore silently drops a profile past seven or with a repeated colour, with all its documents.

## 5. Stale help and copy (to be proposed before editing)

- Planner › "Notes and coverage" (switch branch) describes the old Notes panel; the inspector is documented nowhere in Help.
- Planner › "The team": "Clicking the portrait opens the character's details" (it opens the inspector).
- Team Builder: "Clicking a portrait on its bench opens swap mode" (⇄ does); "a new rotation with the team's names" (they are seated, resting).
- `Faq.svelte:120`: "Report a problem in the ⋯ menu" inside a tool.
- `SettingsPanel.svelte:472`: the Playback sound intro still says "view bar", unforked.

## 6. Parity: old capability → home under the switch

- Rotation tabs → Library › Rotations, ⌃` (previous document), Compare's ⇅. Save → autosave + ⌘S. Save as new → Duplicate and compare. Clear → beside Undo. Close all / Recently closed / 12-tab limit → retired by design.
- Library search and tag filter → **missing** (only the team chip remains). Per-row Share → **missing**. Placing a saved team onto a board team → missing (a later concept).
- Share (link / KQM / PNG) → the top bar's Share menu; Builder link only; Visualizers per tile.
- Lineups → Library › Lineups, New lineup presets, Teams' New lineup. Swap mode and `?swap=` → unchanged. Con lens → unchanged (but see §4, Theorycraft).
- Default loadout → **missing** (§3). Per-rotation loadout → the bench pill.
- `?r=` / `?b=` → a new Theorycraft document with Move. `?team=` → Planner fine, Builder not (§4).
- Notes → the inspector's team page. Aura log → unchanged. Human timing → Settings + the tag by the Total. Roster editing → Roster (Theorycraft shows the invitation). Outfits → Settings. Traveler → Settings, split (§4). Backup → Settings, v3.
- The "not backed up" badge (§5.1) → **not built**. Theorycraft pruning of untouched link documents (§4.3) → **not built**.

## 7. Rulings (Nate, 2026-10-23)

- **Closed tabs migrate as SAVED.** A Recently closed tab linked to a saved entry migrates in its saved state, never with the unsaved changes it was closed with (`migrate.ts` `takeTab`/`takeBoard` currently let the closed tab's body win). A closed tab that was never saved stays its own document (§10).
- **An open tab keeps its working copy AND its saved version.** The open tab's content wins (a reload in the old model brought exactly that back, so migrating only the saved version would look like a rollback). When it differs from its saved entry, the saved version migrates too, as a second document named **"<name> (saved)"** (Nate picked the wording).
- **No way back after the flip.** The switch is never offered to users. At the flip: the Settings toggle goes, `?next=0` works in dev only, and the involuntary path in §1.10 becomes an honest "can't save right now" state instead of a silent return to the old model.
- **Lineups get no what-if pass.** Lineups are more throwaway than rotations; a migrated lineup's owned characters converting to the roster's levels is accepted.
- **Theorycraft pruning of link documents waits until after the flip.** Every Library row can already be deleted by hand, link documents included. The window is still to be chosen.
- **The "not backed up" badge** is decided in the refinement pass (it would be the phone's only backup cue).
- **§2 (the broken interactions) is deferred to the refinement pass**: the toolbar may change substantially and is sculpted hands-on with Nate. Storage hardening (§1 + the migration rulings) comes first.

## 8. Not covered

Real Safari and real touch gestures · Restore with a second tab open · a pair compared across tabs · the old-route 301s (Cloudflare-only, not served by the local preview) · Theorycraft pruning (nothing to test; not built).

## 9. The storage-hardening round (`fix/storage-hardening`)

§1 and the migration rulings of §7, built the same day. What changed, by finding:

- **§1.1 reload loses the last edit →** an unload JOURNAL (`storage/journal.ts`): on `pagehide` the session writes what it has not saved yet (documents it holds, new ones, the current pointer, roster changes) to localStorage, synchronously, under its own page's key; the next page to open the store replays and removes every journal (`boot.ts`). ⚓ A journal only fills a gap: a record written after it, a deletion, or a restore (`migratedAt`) wins. Measured in Chrome on the production build: a reload 50, 150 and 300 ms after a keystroke keeps it (it lost it at 50 and 250 before).
- **§1.2 one failed write ends autosave →** `flush()` never leaves the chain rejected; a failed write puts its work back in the queue, reopens the connection (`reopenStorage`), retries (1 s doubling to 30 s), and says so once (`saveFailed` + the notice “Couldn’t save your changes. Trying again…”, Nate’s pick). The profile queue is the same. `boot.ts` retries a failed open once before giving up.
- **§1.3 another tab's Delete/Rename/Pin/Move undone →** `#save` merges the tab's CONTENT onto the stored record inside ONE transaction (`db.modify`), so name, pin, pair, `openedAt` and `profileId` stay whatever is stored; a name changed elsewhere stands unless this tab renamed it too. `#patch`, `#setPair` and `#putProfile` use the same single-transaction read-and-write. A deletion elsewhere moves the tool showing it on (`#deletedElsewhere`), and a deleted profile now posts each of its documents. A rename in a tab showing the document read-only goes to the store (it went nowhere).
- **§1.4 failed Restore freezes the page →** pending work is written FIRST, then saving stops; a failed `replaceAll` (one transaction, so nothing replaced) resumes saving. A tab told of a restore elsewhere drops its pending work and its journal (`#freeze`).
- **§1.5 deleted active profile →** the site opens in Theorycraft (`#activeProfile`, also for `peekProfile`), and deleting a profile moves the site's pointer off it.
- **§1.6 read-only tab never takes the document back →** a read-only document WAITS for its lock (`waitForDocument`) and is taken, re-read and editable the moment the holder lets go; the wait ends when the tab moves on.
- **§1.7 no Web Locks →** every document is held here (one tab's behaviour) and the channel is silent where BroadcastChannel is missing; `start()` falls back instead of hanging if loading throws.
- **§1.8 duplicate what-if copies →** the pass runs under a lock (`exclusively`) and re-checks `guestsMadeAt` inside it; each copy and its pairing land in one transaction (`putMany`); the paired rotation keeps its `updatedAt` (§4's reorder).
- **§1.9 cross-tab roster lost update →** a roster flush writes only the characters this tab changed, key by key, onto what is stored (`rosterChange` / `applyRosterChanges`); a profile change from another tab flushes this tab's edits before it reloads the roster.
- **Migration (§7):** a Recently closed tab linked to a saved entry migrates as SAVED; an open tab that moved on keeps its working copy and adds "<name> (saved)". Lineups follow the same two rules. Also: one team per set (§4), and "Shared rotation" / "Imported team" are minted labels; a stored name is kept even when it looks minted ("Tab 2").
- **Not in this round:** §1.10 (`storageFailed`'s silent return to the old layout) goes with the flip, per the §7 ruling. "Saving…" still shows only during the write itself; with the journal the delay no longer loses work.

Tests: `journal.test.ts` (new, 11), `docLock.test.ts` (+5: waiting, no locks, exclusivity), `migrate.test.ts` (+5), `convert.test.ts` (+1). `session.test.ts` (new, 14): two sessions over one fake IndexedDB, a shared lock manager and Node's BroadcastChannel; 13 of its cases fail on the code before this round (promotion approved by Nate).

## 10. Small fixes (`fix/next-sweep-small`, 2026-10-24)

The §4 items that were plainly wrong and that the refinement pass would not change, plus the long-queued small bug branch. Done unattended while Nate was away; nothing here changes a string, a layout or a rule.

- **Interface size:** its segment buttons lacked `class="btn"` (the unstyled browser buttons), and `.sp-desktop`'s phone rule lost to the later `.sp-row { display: flex }`, so it showed on the phone. Now a compound `.sp-row.sp-desktop`, the `.sp-row--stack` precedent.
- **"ago.1 saved item":** the space after "ago." sat at an `{#if}` boundary and was trimmed. The sentence is one derived string now. (Live site too.)
- **`/library?tab=roster` opened Rotations:** `sectionForPath` read only the pathname; it takes the query now (the pages layout and the menu state's in-section link handler both pass it).
- **Add your account went to Roster when nothing was created:** `createProfile` returns whether it made one, and the form moves on only then.
- **⌃` from Help › Planner over the Builder flipped the Planner's document:** the key read the tool from the address, which names a section while the menu state is open. It does nothing while the menu state is showing (`[data-menu-state]`).
- **Duplicate and compare on an empty blank did nothing:** an empty blank is not a document yet, so the item is disabled until the rotation has something in it (the save's own test).
- **CritInstrument's risk slider:** `style:background` reset the coarse-pointer `background-clip: content-box`, so on a touch screen the gradient painted the whole enlarged hit box. Now `style:background-image`. (Live site too.)
- **Popover clamps:** the bench card's constellation and loadout popovers are clamped vertically as well as horizontally (`placeAcross`; the loadout panel centred on a low card ran off the bottom). A band menu taller than the room below its trigger scrolls within that room (set only then, since a scroll container clips its contents); the old layout's DocumentTabs menu is capped the same way.

**Left for a ruling:** the blank `index` section on desktop (the sidebar is already the index; what the main area shows there is a design call) and everything else in §4.
