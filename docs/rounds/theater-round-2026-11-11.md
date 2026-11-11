# 2026-11-11: the Imaginarium Theater lineup

The Team Builder's fourth preset: from the player's roster, which Theater difficulty they can enter this month, and with whom. The design is `docs/design/team-builder-lineups-design.md` §12; the game's rules and lunaris's data are `docs/library/game/imaginarium-theater.md`.

Branches, stacked: `docs/theater-reference` → `feat/theater-data` → `feat/theater-board`.

## 1. The reference and the data

- **The library doc** (`6059e340`) from the Fandom page, read through the MediaWiki API (`api.php?action=parse&prop=wikitext`): the page itself answers curl with a Cloudflare 403. The wiki counts the whole cast; lunaris counts the Alternate Cast, which is the whole less the six Opening Characters. The Blessing formula and the 30 Fantasia Flowers per extra member were checked against two of Nate's screenshots.
- **The fetcher** (`5dff4ca0`): `scripts/fetch-endgame.mjs` reads lunaris's **live** build folder (`x.y.0`). The beta folder had looked like missing months. A self-check throws unless the Opening Characters are two of each element. Season dates stay hand-kept in `season-dates.json` (no leaks); Theater opens on the 1st.
- **The model** (`$lib/theater.ts`, tested in `theater.test.ts` with the screenshots as fixtures): eligibility (one Traveler, newest first), each mode's verdict, the room a mode leaves, the invite, Auto-select's order, and the default mode.

## 2. The Builder (`17dab01b` and the passes after it)

- A Theater lineup is a cast, not teams (`Board.theater`), with the season, the mode (the highest the roster opens, or the player's lower choice, which trims), and an optional +1 Supporting Cast.
- The roster gains one "can't enter Theater" mark per character (Nate's struck butterfly), in place of the deferred level-70 flag.
- The grid is the season's: guests on top, Available Characters below holding only who can be taken. The Lineup pane is the game's Party Setup on night.
- Rulings along the way (Nate): no auto-select on opening; Auto-select takes guests first, then newest to oldest (guests are the most valuable: doubled buffs, and reactions from outside the season's elements); no Share; the invite takes the cast's last free place (`c4a5398f` fixed a refusal one short, with a test); the ⊘ at 2× and stroke 3.
- **Phone** (`49e4d187`): grid section headers wrap; below `compact`, Auto-select and Clear move into the cast's header (band B needed 340px of 288 at 320).

## 3. Loose ends closed

- **The Library card** shows a Theater lineup's cast in rows of four, the season's elements in the lead column, and the mode in the foot. It had shown nothing.
- **`?team=` with no room** (`boardBar.svelte.ts`): a full lineup, or a Theater cast, now opens the team as a new Custom lineup in Theorycraft, the way `?b=` arrives, instead of dropping it with a warning. ⚓ Nate had queued this for full lineups (`closeout-2026-11-11.md` §3); the Theater case is the same path.

## 4. Copy (approved by Nate, 2026-11-11)

- "Team added to a new Custom lineup" (the `?team=` notice).
- "+{n} more" under a Theater card's third row (a team card says "+{n} more teams").

## 5. Left open

Nate checked the round in real Safari and approved it.

- Stats count roles only for characters with role data (⚓ Nate: an acceptable gap).
- December's Theater date goes into `season-dates.json` on or after 2026-12-01 (the daily check-in covers it).
- The "New" tag and the "This cycle" demo (`docs/todo.md`).
