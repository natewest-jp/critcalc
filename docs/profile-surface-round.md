# Profile surface round (2026-10-26)

Branch `polish/profile-surface`. The full-screen surface's per-surface pass
for Profile, after the Settings round moved Clear data onto it.

## Rulings (⚓ Nate, 2026-10-26)

- **The picture is chosen in a DIALOG**, ⛔ not inline and not an accordion:
  ~140 circles buried everything under them, and an accordion would push
  Clear data and Delete down while open. The page shows the current picture
  in its colour's frame with Change…; the dialog is `InspectModal` (art set,
  search, owned, everyone else) and a pick applies and closes it.
- **The Settings row** (NAME · CONTROL · NOTE) is now shared:
  `app.css` § THE SETTING ROW holds the row and its two folds; each page keeps
  its own pickers scoped. Identity rows (Name · Picture · Color · Traveler),
  then a Data section (Clear data · Delete profile).
- **The Traveler twin is per PROFILE** (design §13.5 had locked it; the bug
  sweep's "two sources"). `$lib/travelerTwin.svelte.ts` is the ONE reader:
  the active profile's `twin` under the new layout, Settings'
  `travelerVariant` in the old. Every portrait, the old chrome's roster mark
  and the avatar warmer read it. Settings' Traveler row shows only in the old
  layout. Theorycraft's page offers the twin as its one changeable thing
  (`updateProfile` refuses any other key for it). A new profile picks its
  twin on the form, starting on the one the site shows.
- `InspectModal` takes Escape in the CAPTURE phase and spends it: over the
  menu state, the menu's own listener ran first and closed the whole menu.

## Open

- The new layout's top bar has no twin-aware glyph (the old chrome's roster
  mark followed the twin); not a regression of this round.
- Wording: the new notes, the Theorycraft lede, and profile vs account.
