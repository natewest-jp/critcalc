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
