# Filling a lineup row from Teams (2026-11-10)

Nate wanted a way to place a saved team into a Builder row; Teams itself only starts a new lineup, by design.

## What landed

- An empty row grows the column at its right, holding one Teams plate. A filled row has a Teams icon beside "Planner →"; the narrow form has it beside the pin.
- `TeamChoice.svelte` is one menu row: a check column, four overlapping faces, and the team's name. The Builder's menu and the Planner's bench menu both use it (⚓ Nate: the faces are what separate a team from the bench menu's plain verbs). The knobs are `--tc-face` and `--tc-overlap`.
- Picking a team fills the row, links it (`BoardTeam.teamId`), and clears its pin. Undo is offered when the pick moved something already on the board.

The strings ("Teams", "Placed …", the aria label) are working copy until Nate rules on them.
