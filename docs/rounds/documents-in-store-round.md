# Documents in the store (phase 2a), 2026-10-22

The first caller of phase 1's storage (`docs/rounds/foundations-round.md`). Under the switch (`?next`), the Planner and the Builder open the active profile's CURRENT documents from IndexedDB and autosave to them. With the switch off, nothing changes.

## What shipped

- **`src/lib/storage/session.svelte.ts`**: loads the active profile (`meta.activeProfileId`, else Theorycraft) and its current rotation and lineup; autosaves `SAVE_DELAY_MS` (400 ms) after the last change and on `visibilitychange` → hidden; writes a document only when its `{name, body}` changed; moves `profile.current` when the active tab changes. ⌘S is caught and flushes (§4.1). Falls back to localStorage (today's behaviour) if the store is unavailable.
- **The tab models are untouched apart from a persistence SINK** (`rotationTabs.persistSink`, `boards.persistSink`) and `restoreFrom(stored)`, the restore body lifted out so the session can hand it a document. ⚓ Under the switch localStorage is not written by the tab models, so it stays as the migration found it (copy-only).
- **Each tab IS a document**, keyed by the document's id (`convert.ts`). A blank tab becomes a document on its first content. ⚓ An unnamed document stores no name: its label is derived (`rotationLabel`: the characters' full display names, ⛔ not `shortName`, which makes Hu Tao "Hu"; `lineupLabel`: "Stygian 7.1" / "Abyss" / "Custom lineup"), and a minted "Tab 2" is never stored as a name.
- **The two-tab rule in use**: a document is saved only by the tab holding its lock. A tab that can't take it shows `HeldElsewhere` (working copy: "Open in another tab. Changes here aren't saved." · **Edit here**); Edit here steals the lock, re-reads the latest saved state, and resumes saving, and the first tab gets the notice. A read-only tab re-reads a document when the other tab broadcasts a save.
- **Profile pictures**: `ProfileRecord.picture` (art by name, or a character avatar), read through `pictureOf` so a record migrated before it existed gets the default (Theorycraft's art; the Traveler for a real profile).
- The session is a lazily loaded chunk: with the switch off, the tools layout downloads none of it.

## Known gaps, each owned by a later step

- The old document UI still shows under the switch (band A's tabs, Save, Load, the bank overlay). Extra tabs become documents, but only the current one reopens on reload; the rest wait for the Library (2c). Save/Load still write the old banks.
- A lineup team's pin now names a rotation DOCUMENT, while the Builder's `pinnedRotation` still looks in `savedNotations`, so pins read as unpinned under the switch (2c/3).
- The roster stores still read and write localStorage; the profile's `roster` is the migration's copy (2d).
- A shared link opens in the active profile, not Theorycraft (2d's routing).
- Closing a tab still writes Recently closed to localStorage (retires with tabs, 2b).
- No real read-only editor yet: the held-elsewhere tab can still type, it just doesn't save (2b).

## Verification

vitest 2557 (4 new in `convert.test.ts`) · check · lint · build. Headless Chrome against the production build: a seeded tab migrated and opened in the Planner; typing autosaved within ~1 s; localStorage's tab key unchanged; reload restored from IndexedDB; a second tab on the same document showed the notice, Edit here moved it to the first tab, and the second tab's edits then saved. e2e not run (switch-gated; off-switch behaviour unchanged).
