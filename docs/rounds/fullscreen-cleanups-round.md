# Full-screen cleanups round (2026-10-26)

Branch `polish/fullscreen-cleanups`, behind `?next`; MERGED `6604ea4d` (2026-10-26; e2e chrome 80 + webkit 80). Small fixes on the
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
- ⛔ **A first cut sized the faces to FILL the card** (measured width,
  30-64px: 49 on a 320 phone, ~51 on desktop). Beside the rotation cards it
  read as posters (Nate: "sloppy"), with row gaps grown by each portrait's
  hair overhang. The lesson: "use the space" meant intentional layout, not
  bigger faces, and the yardstick was the sibling card on the same surface.
- **Second pass, at the shelf card's scale.** 34px faces (a pinned rotation
  card's; a rotation ROW is 28), one grid for every card: a lead column,
  the four portraits, and the saved TEAM'S NAME when the four are one of
  your teams (⛔ never the members' names: they repeat the portraits and
  truncate). Cards keep their own height (a two-team Abyss card no longer
  stretches to a twelve-team one's). The meta line names the mode only
  under a name of your own: an unnamed lineup's label already is its mode.
- **Third pass (Nate):** cards take the row's TALLEST height again; faces
  34 → 40px (at the narrowest card a row left ~125px empty; at 40 it is
  ~235px and still fits a 320 phone's 262); a hairline RULE between the
  lead column and the teams, from the first disc to the last, on every
  kind of card; the rows lift by 0.3 × the face into the title's air (the
  first row's hair room was mostly empty, and his "Tall avatars" lineup
  still clears the title).
- **The card's foot** (when it was saved, Open now) takes the bottom edge
  (`margin-top: auto`), so it sits on one line across a row of
  equal-height cards.
- ⚠ **Rows align on the disc's line** (grid `align-items: end`): a side
  portrait's box is its disc plus the hair above it, so centring dropped
  every disc below the lead beside it.

## Notes carried over from Claude's working memory (2026-10-29)

From `docs/rounds/fullscreen-cleanups-round.md`:

- Judge a lineup card at desktop width and at a 320 phone's card width. To see the phone width on a desktop, narrow `.cards` to a 288px track in JS, then reset it.
- A grid item pinned to row 1 (the lead rule) makes the full-width auto-placed rows skip row 1, so every row names its own `grid-row`.
- The sidebar's `MINE` set (MenuState) decides which places wear `--side-mine`, the profile's colour.
