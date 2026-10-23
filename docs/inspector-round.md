# The inspector round (phase 5, 2026-10-23)

Design: `docs/profiles-and-surfaces-design.md` §7. Built straight into the real tools behind `?next` (Nate: no `/lab` mock-up, real data from the start). Branch `feat/inspector`.

## What it is

Reference about ONE thing picked out of the work, read beside it, never edited. Three surfaces site-wide: tools (work), the menu state (things you go to on purpose), the inspector; everything else is attached to a control (tooltip, popover, confirmation).

## Rulings (⚓ Nate, 2026-10-23)

1. The inspector is the CONTENT; its shape is the tool's: a pane in the Planner, a modal in the Builder, none in the Visualizers.
2. Strong candidates all in: buff bars, casts (E/Q, summons, shields), the always-on chips, a character's coverage. (Coverage: the character page links to it; the strip itself is still open.)
3. Notes become the inspector's team page; the button is never disabled.
4. The inspector reads, never edits.
5. Boss details stay a modal (the Builder's three share one shell).
6. Weapons, artifact sets and reactions: deferred.
7. Demo straight in the real tools behind `?next`.

## What shipped (commits on `feat/inspector`)

- `a8c86279` stage 1, Planner: `plannerView` gains the `'inspector'` aside and `target`; `PlannerInspector` (team / character / bar pages); `CharacterDetails` lifted out of `DetailCard`; `BuffDetailRows` lifted out of `BuffTooltip`; buff bars (received, team, Ascendant Gleam) click to pin; the gold inset ring.
- `54ed66c2` stage 2, Planner: casts (E/Q pills; summon and shield bars open the cast that raised them), the editor's picked-token mark (`setPickedRange`, not a history event), the editor's stand-in flag on the page, the always-on chips (`TeamBonusesBlock` resolves its own key).
- `effe21f7` stage 3, Builder: `InspectModal` shell for the character, boss and opponents modals; the character modal's "Adds to / Brings to" line.

## How it works

- ⚓ **A pick is a REFERENCE, never a copy** (`InspectTarget`: a bar is lane · row · start frame · clicked frame; a cast is character · ability · start; a chip is a key). Whoever draws the thing re-resolves it on every rebuild and publishes the result into `plannerView` (`inspectedTip` / `inspectedCast` / `inspectedBonus`), so an edit updates the page, and an edit that removes the thing drops the page back to the team. A copied payload would keep showing numbers the chart no longer draws.
- Hover and click print the same rows: one payload builder per lane (`receivedPayload`, `teamPayload`, `moonPayload`, `stepPayload`).
- Casts resolve against `rotation` (what is drawn, laps included); the editor mark only for a token inside the text (`src.to <= notation.length`).
- The ring is DOM-only (inset `box-shadow`), so the PNG export is unringed by construction.
- The Builder modals render their content as a snippet in the new shell under the switch and in the old shell without it; step 5 deletes the old shells. Under the switch the shell owns Escape, the scrim and leaving; the components' own handlers stand down.

## Traps met

- Clicking a summon of the cast already open CLOSES the pane (same pick, the toggle rule). Correct by the rule; worth watching whether it reads as a bug.
- A headless click at a bar's CENTRE can land past the track's scrolled edge; click the visible part.

## Rulings on the open list (⚓ Nate, 2026-10-23, later)

- All working copy APPROVED as written.
- The default build LEAVES the Builder's character modal under the switch (the inspector reads). ⏭ Loadouts go into **Teams** (Nate's call, not the Roster; reasons when that work starts), queued on the to-do list, before the flip. The old path keeps it until step 5.
- The bench shows the picked character by HOLDING the portrait ring's hover gold (`SlotPortrait` `picked`); the gold is `--sel-ring`, the site's selected colour.
- Width: the inspector steps by screen, 300 / 340 from `broad` / 380 from `vast` (`--rp-inspector-w`, a first proposal for Nate's eye); the log keeps 262, so the column changes width between them, to be judged by eye.
- A summon of the open cast closing the pane is fine.

## Still open

- Keyboard: bars, pills and chips are pointer-only doors (the aura pips' precedent).
- A character's coverage strip on their page (the page links to Coverage today).
