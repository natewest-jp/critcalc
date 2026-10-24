# Team loadouts round — 2026-10-24

Loadouts move from the roster into **teams** (behind `?next`). Branch `feat/team-loadouts`.

## Why (Nate)

A weapon and an artifact set are a team decision more than a character's: Cryo Traveler wears Tenacity of the Millelith in Stellar Swirl teams and not in Stellar Conduct ones, Sucrose wears Viridescent Venerer or Instructor by what she is there to do, and weapons depend on the team even more. Assigning them per team was not possible before there was a separate team step. Now there is, and the Teams screen has more room than any other place.

## Rulings (Nate, 2026-10-24)

1. **A team carries a loadout per member** (`TeamRecord.loadout`). Theorycraft has no teams, so a Theorycraft rotation's loadout is all its own.
2. **A rotation inherits it live**: one whose four are a saved team (by SET, `teamKey`) reads the team's loadout, so a change on the team reaches every rotation of it except where one chose otherwise.
3. **The bench pill edits the ROTATION's own override**, never the team. The panel says whose values are showing, and offers the way back to the team's.
4. **The roster's loadout migrates and retires.**
5. **A team whose members change:** whoever left takes their loadout with them; a newcomer starts with none. Rotations of the old four stop inheriting (already true of their counts).
6. **Save as team** starts the new team with the rotation's loadout.
7. **No display anywhere else** this round (not the Planner inspector, not the Builder's modal).
8. ↻ **The Teams OVERVIEW shows each member's loadout DISPLAY-ONLY** (Nate, same day). Choosing one belongs to team SETUP (the member-picker screen), which Nate wants built up into "setting up everything about the team" in its own focused design session; the loadout controls move there then. ⚠ Until that session, a team's loadout can be set only by the migration and by **Save as team**. `TeamLoadoutPill` keeps its editable form (`onSet`), and `storageSession.setTeamLoadout` waits for it.
9. **An explicit "None"** (Nate, same day: clicking None and getting no response felt wrong): under a team, None over the team's value is kept as an explicit none and resolves to nothing.

## How it works

- `src/lib/storage/teamLoadout.ts` holds the pure rules: `pruneInherited`, `bakeLoadout`, `membersOnly`, `teamOfSlots`, `retireRosterLoadout`.
- **The inherited layer** is `rotationTabs.inheritedLoadout(roster)`, the one resolver: under the switch, the rotation's team's loadout, or nothing; off it, the roster default as before. The four merge sites read it: the bench, the timeline (chart + PNG), and the `?r=` link (so a link carries what the team supplies).
- **The team is derived, not set:** the session pushes the profile's teams into `rotationTabs.teams` (as it hands over `rosterless`) on every team write, a message from another tab, and a profile switch, and `rotationTabs.team` is `$derived` from them and the seats. ⛔ Not an `$effect.root` in the session: the first cut was one, and it never runs under vitest, which resolves Svelte's server build. Nothing else in `src/lib` uses one.
- **A guest is never a team's rotation** (`rosterless` → no team): its values are all its own. This also closes the sweep's §3 item where a guest read the real profile's defaults.
- **Leaving the profile bakes:** a what-if's Theorycraft copy, and the migration's guest copies, take what they inherited as their own (`bakeLoadout`). Move only goes INTO a profile, where the team's values sit under the document's own.
- **An explicit none** (`NONE`, `ownChoice`): a part cleared to nothing where the team supplies one is stored as `'none'`, since an absent part means "follow the team". It exists ONLY in a rotation's own entry and is turned back into nothing by `resolveEntry`, the one resolver every merge site now calls (bench, timeline, PNG, share link, Save as team, the bake), so no reader past it ever sees it. None where the team sets nothing is dropped.
- **The bench prunes:** under a team a pill choice keeps only what DIFFERS from the team, so choosing the team's value follows the team again. The weapon and its refinement are one part: an R5 of the team's weapon is kept whole and does not pick up the team's next weapon.
- **The retirement** (`#retireRosterLoadouts`, at start, before the guests pass, under the `loadouts` lock): each real profile still holding a roster loadout has it moved into each team that contains the character (only where the team sets nothing) and into each **teamless** rotation's own (the same way), then cleared. A team's rotation needs nothing, since it inherits the same values. `updatedAt` stays (not an edit). It reads the DATA, not a flag, so it runs again after restoring an older backup. ⚠️ It runs on the PEEK path too (`peekProfile`): a cold load of Teams or the Library never calls `start`, and the first browser check found the team there without the loadout the roster still held for it.
- **The roster store's loadout part is no longer written** under the switch. Its one writer left, Settings' Reset › Loadouts, now clears the profile's team loadouts (a rotation's own choices are its content and stay).
- **Backup v3** carries `TeamRecord.loadout` (sanitized like every other loadout).

## Known limits

- The pill on the Teams card copies the bench pill's look rather than sharing its markup. When team setup is designed, the two should become one component.

## Copy (working; proposed for Nate)

1. Loadout panel footer, a team's rotation: "From the team {name}." / "This rotation's own choice. **Use the team's**"
2. Settings › Reset › Loadouts (under the switch): "Clears this profile's weapons and artifact sets." It now means the teams' loadouts. Proposed: "Clears the weapons and artifact sets on this profile's teams."
3. Privacy (`Privacy.svelte:37`, switch branch): "…at what constellation, with their loadouts), its teams, …". Proposed: "…at what constellation), its teams with their weapons and artifact sets, …".
4. Planner help, the bench: once the shape is settled, a line saying a team's rotation starts from the team's weapons and artifact sets.

## Tests

`teamLoadout.test.ts` (11, four of them the explicit None) and three cases in `session.test.ts`: the retirement (team, teamless rotation, team rotation untouched, `updatedAt` kept, roster emptied), live inheritance (a team edit reaches the rotation; a teamless one inherits nothing, never the roster), and a what-if copy carrying the team's loadout into Theorycraft.
