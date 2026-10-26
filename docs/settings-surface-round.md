# Settings surface round (2026-10-26)

Branch `polish/settings-surface`. The full-screen surface's per-surface pass
for Settings, from the streamer's session: they could not scan it quickly.

## What was wrong

- Every row was a bold name between paragraphs of grey prose at the same
  size, so scanning meant reading the names out of the prose.
- The groups followed the code, not the question: Swap ping sat under
  Display, apart from Human timing; Coverage strips (a Planner choice) too.
- The controls zigzagged (right-aligned at different widths), and the panel
  used ~40rem of a ~70rem content area.
- Settings sits OUTSIDE every profile, yet Reset saved data cleared the
  ACTIVE one.

## Rulings (⚓ Nate, 2026-10-26)

- **A row is NAME · CONTROL · NOTE**, fixed columns (12rem · 22rem · up to
  28rem), so the names make one column and the controls one edge. The note is
  the reading layout's margin idea, level with its row. The panel is a
  CONTAINER: below 53rem the note folds under the name, below 34rem the
  control too (also the old gear modal's form).
- **Groups are questions**: Appearance · Planner · Playback sound · Your data.
  Listed under Settings in the sidebar as Help's chapters are: the heading IS
  the first group, the highlight follows the scroll, one page (not sub-URLs).
- **Human timing is ONE control**: Off · Padding · Animations · Both. The
  padding rows show only when padding is in effect.
- **Planner › Reset to defaults**, one click with an Undo (the Reset zoom
  reasoning: values you fiddle with and want back).
- **Storage joined Backup** (both answer "is my work safe?").
- **⛔ Interface size is RETIRED.** It sized only the top bar and toolbar (a
  weaker browser zoom). Auto-by-width stays; zoom moves the width it reads.
- **Clear data lives on the profile's page**; Settings carries a LINK to it,
  ⛔ never a second copy (a destructive control on a global page aimed at
  whoever is active is the mismatch this round removed). The old layout keeps
  its resets in Settings: it has no Profile page.
- **Delete everything is offered** rather than "clear site data in your
  browser" (buried, differs per browser, iOS hides it). It ends as a FIRST
  VISIT: `storageSession.wipe` empties the stores, drops critcalc's
  `localStorage` but the switch, and the boot path's own migration of an empty
  browser runs on reload. ⚠ The stores clear first, so a failure loses nothing.
  It skips the Trash. The dialog says when the last backup was (two buttons
  only; no "Download first" button).
- **Tips and notices › Show again** resets the one-time notices
  (`siteSettings.resetSeen`).
- Wording: every note proposed line by line and landed in Nate's words.

## Open

- On the Profile page, Clear data sits below ~140 character pictures. That is
  the Profile surface's own pass (collapse "Everyone else" behind the search).

## Follow-ups (same day, ⚓ Nate)

- **Storage is its own row again**: the control column states the browser's
  answer (Kept · Unknown · Not kept · Declined) or holds Keep my data. ⛔ No
  prompt for it: the site already asks on the first save, and only Safari's
  clearing is a real risk, which the request can't fix there. A BACKUP is what
  is worth prompting for.
- **The backup's VALUE is bold** ("never", "3 days ago", the count), ⛔ never
  the sentence or its label; `--ui-warning` only when it is a problem
  (`backupIsStale`: never with saved work, or > `BACKUP_STALE_DAYS` (30) with
  changes since). ⛔ No gold (gold names a block).
- **The backup reminder** (`#remindBackup`): a toast once a window has passed
  since the later of the last backup (else the first visit) and the last
  reminder, if a REAL profile's work changed since. Shown once, then quiet for
  a window whether acted on or not. Its Settings action scrolls to Your data
  after a 250ms settle (a scroll begun before the storage/profile rows render
  is clamped to the shorter page). ⏭ The row highlight is not built.
- **Theorycraft's documents never count** toward "changed since": they are
  scratch, and a first visit's samples live there.
- **Show padding → Mark padding** (it read as the switch for padding itself).
- **Note sets keep their names** (Nate's keyboard choices, picked by ear); the
  chosen ORDER is spelled out under the note, since its `title` is hover-only.
- **A picker previews what it changes**: the swap picker plays the swap alone;
  Voice and the Notes rows play the phrase without its swap
  (`PREVIEW_NOTES`). Sound mode, Preview and Volume keep the whole phrase.
