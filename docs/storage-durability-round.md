# Storage durability ("level 0") — 2026-10-21

A streamer asked for saved data that survives past a browser clear. Nate weighed three levels (to-do list, On hold → Accounts) and ruled on the one with no server: make local storage harder to lose, and make the backup a complete restore.

## What shipped

- **Persistent storage, asked on save.** `src/lib/utils/storageDurability.ts`. `savedNotations.save` and `savedBoards.save` call `requestPersistentStorage()`, which is a no-op once granted. ⚓ Nate: on the FIRST SAVE, because Firefox prompts and a Firefox user should not lose work without knowing the browser could clear it. Chrome and Safari decide silently.
- **Settings → Your data → Storage** reports `navigator.storage.persisted()` (granted / undetermined / not granted / declined). A **Keep my data** button appears only while not granted, because a roster-only user never saves anything and would otherwise never be asked.
- **The backup carries everything** (`BACKUP_VERSION` 2): open Planner tabs, open lineups, both Recently closed lists, the Visualizers' layout. Each has a sanitizer in `settingsBackup.ts`; the tools' own loaders still migrate at restore. A v1 file loads unchanged (keys a file lacks are left alone).
- **Last backup** lives in `critcalc:lastBackup`, deliberately OUTSIDE `BACKUP_KEYS`, so restoring an old file never rewinds it. Settings shows the date and how many saved rotations/lineups changed since. ⚓ Nate: the reminder lives in Settings only for now (no in-tool hint).
- Copy: Settings, Privacy (+ Last updated), FAQ (account, device move, iPhone home screen), Beta. All approved by Nate as numbered lists.

## Device findings (Nate, 2026-10-21) and the follow-up

- **Firefox re-prompts after a decline** (tested through the Settings button). The first cut asked on EVERY save, so a decliner would have been prompted on every save. ↻ Only the first save asks now (`askOnFirstSave`, flag `critcalc:persistAsked`, outside `BACKUP_KEYS` because it describes this browser); the Settings button always asks. An accepted grant was already skipped (`persisted()` answers first), which is why a save test after ACCEPTING showed no prompt.
- **Safari declines in an ordinary tab.** WebKit names the home-screen web app as its example of a grant. ↻ In Safari, Settings drops the button (it cannot succeed) and points at Add to Home Screen. Detected by user agent (`isSafari`), which steers advice only.

## Open

- ⏭ Confirm on an iPhone that the site opened from the Home Screen reports storage as kept.
- The FAQ's iPhone claim rests on WebKit's published policy that home-screen web apps are not subject to the 7-day storage cap; not tested on a device.
- Desktop Safari's Add to Dock web apps may get the same treatment; unverified, so the copy names only the Home Screen.
