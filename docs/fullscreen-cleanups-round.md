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

## Then (Nate, same day)

- **The New… buttons** (New team, New rotation, New lineup) are a size up,
  `--fs-lg`.
- **Lineup cards got a treatment.** Each team row LEADS with what it faces:
  a Stygian battlefield's boss (the lineup's pinned season, as the Builder
  reads it), an Abyss half ("1st", "2nd"), or a custom team's number, so
  every card's rows share one column. ⛔ No Abyss art: a lineup does not
  record its cycle, and the current blessing on an old lineup would pass a
  stale cycle off as live. Three rows, then "+N more teams" under the
  portraits.
- **The rows FILL the card** (Nate: at 24–30px they left half of it empty,
  even at 320). Every lineup card is one grid track wide, so one measured
  width sizes them all: a lead and four portraits across it, 30–64px
  (49px on a 320 phone, ~51 on desktop).
- ⚠ **Rows align on the BOTTOM.** A side portrait's box is its disc plus
  the hair rising above it, so centring put every disc below the boss
  beside it.
