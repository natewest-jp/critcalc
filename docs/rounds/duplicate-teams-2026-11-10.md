# Duplicate teams (2026-11-10)

Two teams can now hold the same four. The one-team-per-set rule held because a rotation found its team by its four, so this round gives rotations and lineup teams a link to one team.

## Rulings (Nate, 2026-11-10)

1. A character on a linked rotation is replaced by a different one: the rotation unlinks. A different slot order keeps the link.
2. Typed four match several teams and there is no link: a picker on the bench.
3. Lineup board teams link to a team too.
4. A team card's "N rotations" counts linked rotations plus unlinked set matches.
5. Save as team, when the four already exist as a team: offer the existing one, with an option to make a second.

## The model

- `RotationBody.teamId` and `LineupTeam.teamId` are optional, so nothing migrates.
- A link counts only while the work's four are the team's and the team is live (`linkedTeam`). A rotation whose linked team is in the Trash falls back to its four.
- `teamOfWork` is the one resolver: the link, else the only team holding the four, else no team.
- `belongsToTeam` answers a team card's counts, the Library filter, and a linked board team's rotation list.
- The `seating` setter on `rotationTabs` ends the link when a member is replaced, so the editor's own writes are covered.
- A link is made by Plan a rotation, New lineup, the Builder's Open in Planner, Save as team, and the bench's picker.

## What went

The refusals in `saveTeam`, `updateTeam`, the migration, and the Trash restore, along with the Teams details' clash line and its toast.

## Worth knowing

- The Builder has no Save team in this layout, so ruling 5 lands only on the bench. `docs/design/profiles-and-surfaces-design.md` §3 said otherwise.
- `pinnedRotation` stays set-matched: a pin names one rotation, and the set check is what says it still applies.
- A hand-filled board team stays unlinked and matches by its four; the picker is on the bench only.
- The bench's strings are working copy until Nate rules on them.
