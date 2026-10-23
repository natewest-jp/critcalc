# Teams (phase 3), 2026-10-23

Under the switch (`?next`), a real profile has Teams: a Party Setup grid of named teams that new work starts from (design §3, §6.2). Theorycraft shows the invitation in their place. Documents can leave Theorycraft for a real profile with Move, which lists what changes first (§4.3, §9.3).

## Nate's calls (2026-10-23, all four recommendations)

1. **New team** adds a card with four empty slots; a slot opens the character grid in the menu state. Party order is slot order.
2. **Save as team** on the Planner's bench saves at once, labelled by its members until renamed in Teams; only with all four slots filled; a set that is already a team shows a quiet "In Teams" (with its name, if it has one) that opens Teams.
3. **Add to a lineup** puts the team in the current lineup's first EMPTY team, else appends one (a Custom lineup only: an endgame mode's teams are the game's, so a full Stygian/Abyss lineup says "The lineup is full"). The Builder opens with that team selected. Nothing is overwritten.
4. **Move to a profile** lives on Theorycraft's Library rows and on an arrival's notice ("Opened in Theorycraft · …"), ⛔ not in the top bar.

Defaults stated with the calls, unvetoed: demo 2's grid; Plan a rotation always opens a NEW rotation; each card shows "N rotations · M lineups", each a link into the Library narrowed to that team.

## What shipped

- **Store** (`storage/session.svelte.ts`): `teams` / `teamFor` / `saveTeam` / `updateTeam` / `deleteTeam` (a tombstone; its rotations and lineups stay). ⚓ One team per SET: a set already filed comes back instead of a duplicate, and an edit into another team's set is refused. An empty name is a derived label (§4.2). Teams broadcast on the storage channel.
- **`/teams`** (`TeamsPlace.svelte`, a menu-state section with its own route, `seo.ts` entry; not in the sitemap, per §13.4's pending ruling). Cards: name (rename in place), the four slots with their keys, the work line, Plan a rotation, Add to a lineup, Delete on a second click. Clicking a slot edits the team in the picker (search, element, Owned once the roster has owned characters); a pick fills the slot and moves to the next empty one, and picking a member again takes them off.
- **Plan a rotation** (`createRotation` / `planTeam`): a new rotation document in the CURRENT profile, the four seated and resting, empty notation; it becomes the Planner's current document.
- 🐛 **Fixed on the way:** under the switch, the Builder's "open this team in the Planner" went through the arrival path and so opened in THEORYCRAFT, marked "from a link". It now plans in the current profile (or opens the pinned rotation).
- **Add to a lineup** (`addToLineup`, `boardFocus` in `boards.svelte.ts`): off a tool it goes to the Builder and waits for `documentsReady`.
- **The Library narrowed to a team** (`menu.teamFilter`, a chip with ✕), for the cards' work links.
- **Save as team** (`SaveTeamButton.svelte`) in the ribbon's head, loaded only under the switch so the session stays out of the bench's bundle. ⏭ The phone's row form has no head, so it has no Save as team yet.
- **Move to a profile** (`storage/move.ts`, `MoveDialog.svelte`, `moveRequest.svelte.ts`): the confirmation lists each OWNED character whose level changes (`C0 → C2`); unowned characters and loadouts keep the document's own values. Moving drops the owned levels so they read the roster, switches to that profile and opens the document there. With several real profiles, the dialog picks one. Notice buttons gained `bar: true` so the top bar renders Move while the Builder keeps rendering its own (swap's Undo).
- **2a's gap closed:** the Builder's pins read the profile's rotation DOCUMENTS under the switch (`rotationAsSaved`), so a pin migrated from a saved entry shows as pinned again. "Try it with … in the Planner" makes a new rotation in the current profile instead of opening a tab.

## Strings (working copy, for Nate)

1. Sidebar: "Teams"
2. Invitation: "Teams belong to an account. Add yours to name the teams you play and start rotations and lineups from them."
3. Empty: "No teams yet. Make one here, or save the team on the Planner's bench as a team."
4. Card: "Plan a rotation" · "Add to a lineup" · "2 rotations · 1 lineup" · "No rotations or lineups yet"
5. Picker: "Search characters" · "Owned" · "Cancel" · "Add team" / "Save team" · "Already a team: <label>" · "No characters match."
6. Bench: "Save as team" · "In Teams" / "In Teams · <name>"
7. Library: "No rotations for this team yet." · the chip's tooltip "Show all"
8. Notice: "The lineup is full"
9. Move: "Move to a profile" · "Move to <name>" · "In <name>, owned characters read the roster, so this rotation changes:" · "If this rotation depends on those levels, keep it in Theorycraft." · "No levels change in <name>."

## Not done

The derived label of a rotation does not yet use a matching team's NAME (`convert.ts`'s ⏭) · Save as team on the phone · team order by drag · the Builder row's own "Save team" (§10.2) does not exist to update · Move between two real profiles (§12 Q8) · pruning (§12 Q9).

## Verification

vitest 2557 · check · lint · build. Headless Chrome against the production build, under the switch: Teams in Theorycraft shows the invitation; a new profile's Teams is empty; New team by search and pick → a card labelled by its members; the same set in another order is refused by name; Plan a rotation → the Planner with four seated and the bench reading "In Teams"; the card then reads "1 rotation", and after Add to a lineup "1 rotation · 1 lineup", the team on Battlefield 1 and selected; the rotation link opens the Library narrowed to one row; a typed rotation's Save as team → "In Teams", a second card. A `?team=` link from Main → Theorycraft, the notice with Move to a profile → the dialog → Main, the rotation in Main's Library. `move.ts` checked inline for an owned level change, an unowned level kept, and a lineup listing a character once. No page errors. e2e not run (pre-merge gate; last green 160 at `7872d565`).
