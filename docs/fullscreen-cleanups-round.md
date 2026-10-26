# Full-screen cleanups round (2026-10-26)

Branch `polish/fullscreen-cleanups`, behind `?next`. Small fixes on the
full-screen surface after the Roster round (Nate's list).

## Rulings

- **Team details open on EVERYONE.** They opened on Owned once the roster
  had any; of two toggles with one already lit, the pair read as a switch
  with no off, not as two filters (Nate).
- **No count on Trash.** It nudges people to micromanage what is already on
  its way out. Rotations and Lineups keep theirs (a nudge toward a tidy).
- **A selected PROFILE place wears the profile's colour on its edge**:
  Profile (or Add a profile), Roster, Teams, Rotations, Lineups. Help, About,
  Settings and Trash belong to no profile and keep the gold edge. Theorycraft
  wears its own white.
- **No gold kicker over a page's title.** It repeated the profile's name,
  "Library" or "Settings", and over Trash it was wrong; the sidebar says
  where you are. In-page group headings ("Appearance", "Data") stay.

## Fixed

- Team details' grid faded farther from the strip than the Roster's. The
  Roster round had removed the strip's -0.9rem margin there, believing it an
  overlap like the Roster's; in Teams it cancels the flex column's 0.9rem gap.
  Restored, so both surfaces start the grid 0.5rem under the strip.
