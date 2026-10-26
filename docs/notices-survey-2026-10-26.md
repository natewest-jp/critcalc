# Notices survey (2026-10-26)

A sweep of everything the site says to the user (outcomes, conditions,
questions, refusals) and what it should say but doesn't, as the ground for a
notices round. The `?next` path is surveyed; the old path is retiring.
Three read-only code surveys (infrastructure + storage + chrome, the tools,
the full-screen surfaces), merged here; the load-bearing claims were
re-checked in the source (marked ✔). Nothing was run in a browser.

Nate's starting observation: a first-time user missed feedback that appeared
away from his focus, or in small text, sometimes even while looking at it.

## 1. How notices work today

- **One slot.** `documentBar.showNotice(msg, actions?, ms?)`
  (`src/lib/documentBar.svelte.ts`). One string, last write wins, no queue,
  no severity. Timers: 2200 ms plain, 8000 ms with a button, 15000 ms once
  (used once). No pause on hover or focus.
- **Where it renders under `?next`.** Band A is gone (`noBandA`), so the only
  renderer is the **top bar's right flank** (`TopBar.svelte` `.tb-notice`):
  `--ui-ctl-fs` (11–13 px), chrome at 75%, no icon, no colour, no motion.
  ✔ **Hidden below 47.5rem** (`TopBar.svelte` 47.5rem block): on a phone
  no notice from this slot is ever seen, nor its buttons (Move to a
  profile, Download a backup).
- The Builder also draws notices that carry buttons (Undo) beside the action:
  the grid's destination banner or the lineup rail (its rule, "a notice
  stands where its action happened", `builder/+page.svelte` ~L551). The top
  bar draws the same text again on desktop.
- **Other channels, each its own:** the save status in the tool button
  (`Saving…` / `✓ Saved`, `--fs-xs`, 1600 ms); the profile-switch cue (a
  colour wash from the top, 38vh, 2000 ms, plus the name under the picture;
  nothing under reduced motion); `HeldElsewhere` (a bottom-centre pill, until
  the lock returns); RosterTab's own line (6000 ms, `--fs-xs` muted); the
  Visualizers' Copy link button changing its own label (1500 ms); the shared
  `@keyframes nudge` (±2 px, no words, nothing under reduced motion);
  dialogs (`LinksDialog`, `MoveDialog`: `alertdialog`, focus, Escape — the
  only notices with proper focus handling); the render-error boundary and
  `+error.svelte`.
- **Confirms come in four styles:** an armed button that changes its own
  label (Library, Teams card, team details, Profile, Settings resets; 3000 /
  4000 ms / none), an inline block (Settings import, the new discard
  question), a real dialog (MoveDialog), and none.

## 2. Inventory by shape

### 2a. The control answers for itself (at the click)

Click-again deletes (Library row, ⋯ menu "Tap again to delete", Teams card,
Delete team, Delete profile "Delete it and everything in it?", Settings
Clear → Confirm / Confirm clear all) · Viz Copy link → Copied / Copy failed
(1500 ms, no live region) · Save as team → "In Teams · {name}" · DetailCard
Add to team / In team / Team full · lit plates and the folded ⋯ gold dot
(state, explained by `title` only).

### 2b. In place, at the work

The clash line on team details ("These four are already a team: X. Open
it", `--fs-sm` `--ui-warning`) · the Builder destination banner ("Adding to
Team 2 · n/4", "Team 2 is full…", "Replacing X") · the errand row ("From the
Planner: …") · notation lint squiggles (warning: we cannot take this;
provisional: a stand-in) whose words live in a `title` only · Artifact Odds
inline validation (the best-explained surface on the site) · Roster hints
("Click Edit roster to begin editing", first-use hint, key legend) · empty
states (`--fs-lg` muted) · Theorycraft invitations (paper cards).

### 2c. The one slot (top bar, far right; invisible on phones)

Saved · Saved as new · Already saved as "X" · Already in your library ·
Team saved · Link copied · Share failed · KQM copied · Copy failed · Image
copied · Image saved · Export failed · Invalid share link · Loaded shared
rotation / lineup · Team loaded · Opened in Theorycraft · your profiles are
untouched (+ Move to a profile) · The lineup is full · Team added to the
lineup · Builder undo notices (also drawn in-tool) · **Couldn't save your
changes. Trying again…** (2200 ms, once) · the migration notice + Download a
backup (15000 ms, once ever) · **Saved to Theorycraft · it doesn't match X's
roster** (2200 ms, once ever).

### 2d. Status (a state, not an event)

`Saving…` / `✓ Saved` (desktop only; the phone has none) · the document name
in the tool button · "Open now" on Library rows · the profile picture's
ring.

### 2e. Whole-screen

The profile-switch wash · `HeldElsewhere` · dialogs (LinksDialog, MoveDialog,
Settings import confirm is inline, not a dialog) · the crash boundary ·
`+error.svelte`.

## 3. Notices that exist but are in the wrong place

1. Every 2c notice: far from its cause, small, dim, 2.2 s, and absent on a
   phone. Share is in each tool's toolbar, the what-if fork starts at the
   bench, a refused paste is in the composer.
2. **The save-failure notice** shares the slot with "Link copied" (and any
   later notice overwrites it), lasts 2.2 s, and is never shown again.
   `saveFailed` is reactive state nobody renders; the retry loop runs
   silently forever, a full quota included.
3. **The what-if fork** (raising an owned character's constellation opens a
   Theorycraft copy) is told once ever, far from the bench, for 2.2 s; after
   that only "· Theorycraft" in the tool button says you are in another
   document. Its once-ever flag is set before it shows.
4. **The discard question** (built this morning): small, top right, after a
   click at the far left; replaces Cancel/Save in place (change blindness).
5. **Invalid share link**: the worst stakes for its place; may also fire
   under the loading veil and expire unseen. No reason, no next step.
6. **The profile-switch cue**: 2 s, motion only, nothing under reduced
   motion, no words saying why (a link arrival, Move, a profile deleted here
   or in another tab).
7. Refusals by nudge: the party strip (team details), the card and board row
   (Builder), the Edit roster button at the far right of the bar (Roster,
   away from the clicked tile). Words in a `title`, if anywhere; nothing at
   all under reduced motion.
8. Explanations in `title` only (invisible on touch; on desktop too for a
   disabled button, ✔ since `.btn:disabled { pointer-events: none }`
   swallows its title): disabled Add your account, taken colours, Save /
   Plan / New lineup disabled on a part team, lint messages, battlefield
   checks, bench card cues, generic-timing bars, lit plates, ellipsized
   Builder notices, filter icons, resonance effects, loadout names.

## 4. Things that say nothing and should

**Data at stake**

1. ✔ **Library delete is permanent** under `?next` (a tombstone with no
   restore UI; the old Library promised "It goes to Recently closed"), behind
   a 14 px armed icon. Deleting the document a tool shows silently swaps that
   tool to another document.
2. Team delete: no undo; never says its rotations and lineups stay.
3. Profile delete: no count of what goes, no backup suggestion, no undo;
   afterwards a silent switch to Theorycraft.
4. ✔ Builder **remove a team** from a custom lineup: no confirm, no undo, no
   notice.
5. ✔ Builder **No repeats ON** silently removes repeated members from other
   teams (and their pins).
6. Bench ✕ / Remove: undoable only by the composer's ⌘Z, which nobody is
   told; the composer's Clear also empties the bench.
7. Pins dropped by a membership change: said only by the swap notice.
8. Settings resets: no result, no undo, don't name the profile; failures
   swallowed.
9. ICD → Gauge handoff overwrites the Gauge's applications without asking.
10. Team details: Escape and closing the tab drop the draft without a
    question (Escape by the round's ruling; worth revisiting).

**Cross-tab and storage (correct in data, silent on screen)** 11. A document deleted in another tab disappears from this one. 12. Edits made while read-only (HeldElsewhere) are replaced without a word
when the lock returns or Edit here is pressed. 13. A profile deleted in another tab: a wash and "Theorycraft" for 2 s, no
reason. 14. A restore in another tab reloads this one, no notice; and no tab says
"restored" after the reload. 15. IndexedDB refused: a silent reload into the old layout. 16. The persistence ask fires on the first keystroke of an existing document
(Firefox shows its prompt); the answer is never used.

**Outcomes nobody sees** 17. Profile edits autosave with no cue; an emptied name is silently ignored. 18. Backup export: no success word; the export error lands under Restore. 19. Every write other than autosave (switch, move, delete, create, rename,
pin, pair, what-if) fails into the console. 20. Deep links that don't decode: `?team=` with no valid ids, `?swap=` out
of range, `?i=` (Visualizers), instrument share state: all silent. 21. The 16 KiB notation cap refuses a paste silently; a parser throw empties
the chart with only a console line. 22. Pick mode with no second rotation reads "No rotations for this team
yet" (wrong reason); the team filter on the Library is a small chip
while the page title says "Rotations". 23. Loads that stall or fail (Library, Teams, a Help chapter) render
nothing. 24. Copy link / KQM silently return on nothing to copy, or say "Copy failed"
for an empty notation.

## 5. Bugs found on the way (fix regardless of the design)

1. ✔ **⌘S shows ✓ Saved for a document another tab holds** (`#save` returns
   false without throwing when it can't hold the lock, so `saveFailed` stays
   false and ⌘S sets `savedAt`). While `saveFailed` is set, ⌘S shows nothing.
2. ✔ **Roster undo survives a profile switch** (`RosterTab` isn't keyed on
   the profile; its snapshots would write profile A's roster into B). Data
   corruption, not just a notice.
3. ✔ (likely) **✓ Saved and the switch cue replay when the top bar
   remounts** (their effects fire on mount whenever `savedAt` /
   `switchedAt` is set; the top bar is mounted separately on and off the
   tools). It teaches people to ignore both.
4. Same-tick overwrite: an arriving `?team=` into a full lineup shows "The
   lineup is full", replaced at once by the Theorycraft arrival. The
   migration's backup offer can lose a race the same way, and its flag is
   cleared before it shows.
5. ✔ **Copy image falls back to a download and says "Image saved"** when the
   clipboard refuses (Safari): the user asked to copy and never learns it
   failed.
6. `MoveDialog.confirm` has no catch: a failure leaves Move disabled for
   good.
7. Once-ever notices are marked seen before they are shown
   (`seenGuestNotice`, `backupOffer`).
8. The top-bar notice is `nowrap` in a `max-content` flank: a long notice
   squeezes the tool buttons.
9. A team saved by `saveTeam` onto a set already filed returns the old team,
   dropping the draft's name and loadouts, and leaves as if saved.

## 6. Accessibility notes

`role="status"` spans are mounted with their text, which many screen readers
won't announce; errors use `status`, not `alert`. The 8 s Undo can't be
paused or reached by keyboard in time (WCAG 2.2.1). No armed button
announces itself or moves focus.
