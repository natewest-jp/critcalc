# Storage durability ("level 0") — 2026-10-21

A streamer asked for saved data that survives past a browser clear. Nate weighed three levels (to-do list, On hold → Accounts) and ruled on the one with no server: make local storage harder to lose, and make the backup a complete restore.

## What shipped

- **Persistent storage, asked on save.** `src/lib/utils/storageDurability.ts`. `savedNotations.save` and `savedBoards.save` call `requestPersistentStorage()`, which is a no-op once granted. ⚓ Nate: on the FIRST SAVE, because Firefox prompts and a Firefox user should not lose work without knowing the browser could clear it. Chrome and Safari decide silently.
- **Settings → Your data → Storage** reports `navigator.storage.persisted()` (granted / undetermined / not granted / declined). A **Keep my data** button appears only while not granted, because a roster-only user never saves anything and would otherwise never be asked.
- **The backup carries everything** (`BACKUP_VERSION` 2): open Planner tabs, open lineups, both Recently closed lists, the Visualizers' layout. Each has a sanitizer in `settingsBackup.ts`; the tools' own loaders still migrate at restore. A v1 file loads unchanged (keys a file lacks are left alone).
- **Last backup** lives in `critcalc:lastBackup`, deliberately OUTSIDE `BACKUP_KEYS`, so restoring an old file never rewinds it. Settings shows the date and how many saved rotations/lineups changed since. ⚓ Nate: the reminder lives in Settings only for now (no in-tool hint).
- Copy: Settings, Privacy (+ Last updated), FAQ (account, device move, iPhone home screen), Beta. All approved by Nate as numbered lists.

## Open

- ⏭ Real-device checks: whether Firefox re-prompts after "Don't allow" (believed not), and Safari's answer to `persist()`.
- The FAQ's iPhone claim rests on WebKit's published policy that home-screen web apps are not subject to the 7-day storage cap; not tested on a device.
