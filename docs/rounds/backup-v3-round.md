# Backup v3, 2026-10-23

Under the switch (`?next`) the player's work lives in IndexedDB, which the v1/v2 backup (the `critcalc:*` localStorage keys) never read: a profile's roster, Teams, rotations, lineups and pairs were in no backup. v3 carries the store (design §10, §12 Q11). It blocked the release: with the switch as the default, a backup would have silently left out the real work.

## Rulings

- ⚓ **All profiles by default** (Nate 2026-10-23): one file holds every real profile and Theorycraft, and which was active. The format does not require all of them, so a one-profile export can come later without a new version.
- **Restore REPLACES** every profile in this browser, as v1/v2's Restore replaced the roster and saved work (the confirmation says so). ⏭ A merging import (by id and `updatedAt`, the sync-ready fields) is possible later; not asked for.
- **An older file loads** under the switch through the SAME migration a browser's own localStorage takes on its first visit (§10), so a v1/v2 backup arrives as "My account" plus Theorycraft, and the what-if pass runs on it.

## What shipped

- `storage/backup.ts` (pure): `buildStoreBackup` (live records only; tombstones left out) and `parseAnyBackup` (v3 sanitized record by record, reusing the v1/v2 sanitizers; v1/v2 through `migrate`). A v3 file also carries the PERSON's keys (`critcalc:siteSettings`, `critcalc:vizWorkspace`, §13.5) and ⛔ not the old roster or saved-entry keys, which under the switch are the untouched pre-migration originals. Sanitizing keeps seven real profiles with distinct colours, makes a Theorycraft if the file has none, drops documents and teams of unknown profiles, a pair whose other side did not come, and a current pointer to a missing document.
- `db.ts`: `replaceAll` (every store emptied and written in ONE transaction, so an interrupted restore leaves the old data or the new, never half) and `readAll`.
- Session: `backup()` (flushes first), `restore()` (stops saving — `#frozen` — so nothing pending writes the old data back, releases the locks, replaces, writes the person's keys, and tells other tabs, which reload on the new `replaced` channel message), `changedSince()` for Settings' "N items have changed since".
- Settings → Your data: under the switch Export writes v3, Import reads any version, the Restore text and the confirmation describe profiles. Off the switch, unchanged.

## Strings (working copy, for Nate)

1. Restore: "Load a backup file. It replaces every profile in this browser, with its roster, teams, rotations, and lineups, and your settings. An older backup loads too."
2. Confirmation: "This backup holds 2 profiles (Main and Alt), 5 rotations, 1 lineup, and 3 teams. Replace everything in this browser?"
3. Errors: "That backup's profiles couldn't be read." · "This browser isn't letting critcalc read its data."

## Not done

The backup prompt before the first switch-over (§13.1: a release-time step) · a one-profile export · a merging import · Settings' "Reset saved data" section still clears the OLD stores under the switch (release pass) · the storage-durability badge still counts the old saved entries.

## Verification

vitest · check · lint · build. The format checked inline (a temporary vitest file, deleted): a v3 round trip keeps profiles, pairs, rosters, teams and the active profile and leaves out tombstones and non-person keys; a pair missing its partner and a document of an unknown profile are dropped; a v2 file goes through the migration; bad JSON, a foreign file and a v3 file with no store are refused. Headless Chrome on the production build, under the switch: a profile with a rotation and a team → Export (a v3 file, Main and Theorycraft) → the team deleted → Import → "1 profile (Main), 2 rotations, 0 lineups, and 1 team" → after the reload the team is back and the rotation opens; a v2 file → "1 profile (My account), 1 rotation…" → its rotation in the Library. No page errors.
