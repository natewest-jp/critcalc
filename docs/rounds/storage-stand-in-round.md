# The storage stand-in round

Step 5(b) of the redesign (`docs/todo.md` Now 1): a browser without IndexedDB gets the new layout on a stand-in store, instead of the whole old layout. Branch `feat/storage-stand-in`.

## What landed

- **`src/lib/storage/localDb.ts`**, the stand-in. All four stores live in ONE localStorage value (`critcalc:store`), so every write replaces the whole of it and lands entirely or not at all, which is what a transaction gives in IndexedDB. Nothing is cached between calls, so another tab's write is read on the next call. Where localStorage is blocked too, the same class runs on a Storage in memory.
- **`db.ts`** takes either store (`type Db = IDBDatabase | LocalDb`); each call branches on `instanceof LocalDb`. `writeMigration` and `replaceAll` compute their meta once for both homes, so the two cannot drift. The session, the journal and boot only changed a type.
- **`boot.ts` picks the home**, in order: IndexedDB · no `indexedDB` at all → the localStorage stand-in, for good · IndexedDB present but it would not open, or localStorage blocked as well → a store in memory for that tab.
- **The switch no longer asks about storage.** `storageUsable.ts` and `storageFailed` (the per-tab drop to the old layout) are deleted. A switch key that cannot be read now reads as ON (the default since the flip), in `nextLayout.ts` and `stores.ts` `underSwitch` together.

## Rulings and why

- ⚓ **A database that would not open gets a memory store, never the localStorage stand-in.** IndexedDB that fails once (WebKit drops connections) may already hold newer work than the old localStorage keys. A stand-in migrated from those keys would be sticky and hide the database from every later page. The memory store copies nothing (Theorycraft alone), and the next page tries the database again.
- ⚓ **A memory store never replays the unload journals.** Replaying takes them out of localStorage, and they belong to the store a later page opens. Without the guard, the boot test for this case fails (checked by removing it).
- **One value, not one key per record.** One key per record would make a write past the quota land halfway. One value keeps every write all-or-nothing, at the price of re-reading the whole store per call. That is fine at stand-in sizes: a notation is at most 16 KiB.
- **Rejected: `fake-indexeddb` as the production fallback.** It is in-memory, it would ship a database engine to every visitor, and it would still need its own persistence.

## Limits, accepted

- localStorage holds about 5 MB per site, and the migration copies, so the old keys and the stand-in share it. A write past the quota throws, and the session's existing failed-save banner ("Trying again…", Download a backup) says so.
- A memory store says nothing on screen yet: its work lasts as long as the tab. The old layout's behaviour for a browser with blocked storage was the same silent loss. The honest notice is flip-readiness §1.10, with copy for Nate.
- Two tabs on the stand-in writing in the same instant can overwrite each other's change. localStorage has no cross-tab lock, and the window is one synchronous read-modify-write.

## Verification

- Vitest: `db.test.ts` runs its whole suite against both homes, plus the stand-in's own cases (another tab's write is seen; a write past the quota throws and changes nothing; a record comes back as a copy). `boot.test.ts` covers the four homes, the copy-only migration, and the journal guard.
- Production build in headless Chrome with `indexedDB` removed: the new layout renders, an old saved rotation migrates into `critcalc:store` once (same `migratedAt` after a reload), it shows in the Library, an edit autosaves and survives a reload, and there are no console errors.
- `npm run test:e2e:chrome`: 71 passed.

## Next

Step 5(c), retiring the switch's off state, no longer has a storage reason to wait. Only `?next=0` in dev still reaches it (the e2e suite no longer seeds it; `nextLayout.ts`'s comment now says so).
