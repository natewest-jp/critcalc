# 2026-11-17: Help screenshots, the Team builder chapter

The to-do's Help screenshots item, second chapter (the pipeline and the planner chapter: `help-screenshots-planner-2026-11-15.md`). Branch `feat/help-shots-builder`.

## What was decided

- **The cast (⚓ Nate):** a Custom lineup of Mavuika Vaporize (Mavuika, Mona C2, Iansan C6, Sucrose C6) and Zibai Lunar-Crystallize (Zibai, Columbina, Linnea, Illuga C6). Claude made one staging choice: Illuga is the one character not owned, so the roster section's hollow chip has something to show.
- **The shot list (Claude proposed, Nate agreed):** seven shots. No shot for the Stygian checks, Imaginarium Theater (both date with the season) or Rotations (one paragraph about a small control).
- The lineup keeps the app's minted label, shown as "Custom lineup", so the shots add no name of their own.

## How it works

- `shots.mjs` seeds the lineup through the old-layout `critcalc:boards` key (`capture.mjs` writes it), migrated on first load like the planner's rotation.
- The grid shots turn on **Owned**: the grid then holds only the cast, so a new release can't reorder it.
- A shot can name a narrower desk (`width`). At 1600 the roster pane is ~860px and shrinks to unreadable text in the margin (~450px); at 1100 it is ~600px with the whole toolbar, the lens included.
- Pins stay off content at margin size: the strip's stand in the left gutter, the card's are on Mavuika (the last card), and the magnifier's is on Zibai's card, under the banner's empty middle.

## Traps met

- The Library's This cycle cards sit behind the New lineup menu and name the live seasons; the crop stops tight at the menu's right and bottom edges.
- A clicked card keeps focus, and a focused card shows its magnifier as a hovered one does; blur before hovering another.
- At 1100 the team-number badge covers a card's first capability icon.
- Clicking a portrait in an unselected team selects the row; its slot's accessible name differs from the selected team's ("Replace …" only once selected).

## Left open

- Nate's look in real Safari, and his rulings on the alt texts and two prose examples (the report lists them).
- The Visualizers chapter (to-do, Now).
