# Foundations round (phase 1), 2026-10-22

Phase 1 of the profiles-and-surfaces build plan (`docs/profiles-and-surfaces-design.md` §13.2): the storage the new shape runs on, built on `main` and dormant behind the switch. Users see nothing.

## What shipped

- **The switch** (`src/lib/nextLayout.ts`): `?next` turns it on for this browser, `?next=0` off; its own key `critcalc:nextLayout`, deliberately outside `siteSettings` so a backup never carries a tester's switch to another browser. Settings shows **Use the new layout** only while it is on (the public never meets it). The root layout loads the storage code on demand, so with the switch off nothing new is downloaded (a 5.5 KB chunk).
- **Records** (`src/lib/storage/records.ts`): profiles, documents (rotation | lineup) and teams, each with a stable id (`crypto.randomUUID`), `updatedAt` and a tombstone. Theorycraft lives at the fixed id `theorycraft`.
- **IndexedDB** (`src/lib/storage/db.ts`): one database, `profiles` / `documents` / `teams` (indexed by `profileId`) / `meta`. ⛔ Never hard-delete: `tombstone()`. `writeMigration` writes everything in ONE transaction and refuses a second run (two tabs opening at once). `clearAll` makes the migration re-runnable.
- **The copy-only migration** (`src/lib/storage/migrate.ts`, pure): its input is `BackupData` as `parseBackup` sanitized it, so a v1/v2 backup file and live `localStorage` (`boot.ts`: `buildEnvelope` → `parseBackup`) meet the same rules. Nothing in `localStorage` is written or removed (verified in Chrome).
- **The two-tab rule** (`src/lib/storage/docLock.ts`): a per-document Web Lock (`holdDocument`, `steal` for Edit here, `onLost` for the tab that lost it) and a `BroadcastChannel` for everything else. Built and tested, not yet called: documents open in phase 2.

## Calls made in the migration (for Nate to overrule)

1. **A tab linked to a saved entry is ONE document**: the tab's content (the working copy), the saved entry's name.
2. **Minted labels store no name** (`Tab 3`, `Lineup 2`, `Sample: …`), per §4.2's derived labels; a saved entry's name is always kept.
3. **Blank tabs and empty minted lineups are dropped.**
4. **An untouched first-visit sample goes to Theorycraft**; an edited one is the player's.
5. **My account is made when the browser holds any of the player's work** (a roster, a team, a non-sample document); otherwise Theorycraft alone. Its twin is `siteSettings.travelerVariant`; Theorycraft takes the same twin as its default.
6. **Stored levels stay on the rotation** (`body.con`). The design's Theorycraft guest for a disagreeing level needs phase 4's pairs.
7. A lineup team's `pinnedRotationId` is remapped onto the rotation's new document id; a pin to a vanished entry is dropped. A team row's legacy `'blank'` becomes an empty slot.

## Verification

vitest (22 new: `migrate`, `db` over `fake-indexeddb`, `docLock` over a Web Locks stand-in and Node's real `BroadcastChannel`) · check · lint · build. One headless-Chrome run against the production build: seeded storage + `?next` produced My account (Anemo, Lumine, current Planner set) + Theorycraft, the tab merged into its saved entry, every seeded `localStorage` key unchanged, and `?next=0` cleared the switch. e2e not run (nothing user-visible changed; last green: see the bench-buttons merge).

## Next

Phase 2, the switch-over: profiles + Theorycraft + link routing, the top bar and toolbar, one document per tool + autosave (the first caller of the store and the locks), the menu state.
