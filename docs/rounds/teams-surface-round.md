# Teams surface round (2026-10-25 → 26)

Branch `polish/teams-surface`, behind `?next`; MERGED `23e89b90` and pushed
(2026-10-26). The full-screen surface's
per-surface pass for **Teams**: its cards, and the team's DETAILS screen,
which is also the "team setup" session the loadouts round queued
(`docs/rounds/team-loadouts-round.md`). Worked hands-on with Nate, one look per
step; anything he didn't answer directly counts as accepted.

## Rulings

**Cards**

- Forward-facing portraits on the Roster's element well and 2px ring
  (`TeamMemberPortrait`). Teams is the one full-screen card that keeps them.
- The loadout is CUTOUT PIPS round the portrait's bottom right: the artifact
  set at the corner, the weapon (with its refinement digit) stacked above it
  along the circle. Only what is equipped gets a pip; one alone takes the
  corner. 22px on a card (26 on the larger details portraits), icon filling
  the disc. The disc paints `--pip-ground`, which the card sets to its own
  ground, so it stays cut out on hover.
- The slot-number pips and the display-only loadout pill are gone. Delete is
  the card's one verb (Rename moved into details); on touch it is always
  shown.
- Any click on a card opens the team's details (the name is a stretched
  button; the controls sit above it); a portrait opens them on its slot.
- Unowned characters FADE with some colour kept (`--portrait-unowned`,
  `saturate(0.45) brightness(0.72)`; was `grayscale(0.85) brightness(0.6)`),
  on the Roster too. Nate: a team built round one shouldn't read as a
  punishment. Accepted as is.

**Details** (`TeamDetail`, a history entry over Teams: `menu.openTeam`,
`page.state.teamDetail` / `teamSlot`)

- No page head and no ✕ (MenuState `headless`): two closes on one screen were
  taken for each other. The name is the title (display face, a pencil beside
  it, the field fits its text); Done is the way out, Cancel + Save team (or
  Add team) once anything changed. Escape leaves; Back leaves.
- Top bar: the name with "2 rotations · 1 lineup" BESIDE it (a line under it
  cost a phone a row) · Plan a rotation, New lineup, Delete team and Done as
  ONE right-hand group. Below toolMin: two rows, Done on the name's row.
- The party strip, centred over the grid: drag to trade places, 1–4 to choose
  a slot, a corner ✕ to take someone off, loadout PLATES under each member
  (artifact set, weapon + refinement) opening the bench's LoadoutPanel. A
  column too narrow for names (`PLATE_NAMES_MIN`) shows icons only.
- Resonance and faction chips CENTRED UNDER THE FOUR: they are what those
  four make, and they change as you pick. Capabilities are parked.
- No hint line: the selected empty seat reads "Choose a character", a tile's
  title says what a click does, and a pick with no seat chosen NUDGES the
  party (the shared `@keyframes nudge`).
- The grid is the Roster's tiles under the BUILDER'S FILTER STRIP (search,
  roles, elements, Owned/Wishlist, More, Clear), sitting on the grid with no
  rule. The Roster's filter column was tried first and rejected: it stood
  beside the party, a screen from the grid it filters. The Roster keeps its
  column (filtering is its whole job there).
- On the team: the house SELECTED state on the TILE (a ground that stays + a
  gold ring round the box). A gold portrait ring + glow + slot badge were
  tried first and rejected. Hovering a member lights their tile and the
  reverse (kept from that try).
- Only the grid scrolls: a section that FILLS (the Roster, a team's details)
  gets the content area's height (MenuState `fills`). The area used to scroll
  as one block, so the Roster's bar and the party strip scrolled away.
- Everything is a draft until Save; Plan a rotation / New lineup save first.

**One team per set STAYS** (Nate, after weighing it): a rotation finds its
team by its four (`teamOfSlots`) and inherits that team's loadout, so two
teams of one set would leave it two to follow. The details say so at once,
naming the team, with "Open it". Relaxing it needs a rotation → team LINK
first (a rotation remembers the team it was planned from).

## Moved

`RosterFilterStrip` → `$lib/components/CharacterFilterStrip.svelte` and
`MoreFilters` → `$lib/components/`; `OWNERSHIP_VIEWS` / `OwnershipView` →
`$lib/characterFilters` (re-exported from the Builder's `facets.ts`). The
strip draws its capability glyphs only when `activeFacets` is passed, takes
`start` / `end` snippets, and `slate` swaps glass for the slate's raised
rung. The Builder's use is unchanged (its spec 19 + 19).
`TeamLoadoutPill` → `TeamLoadoutPlates` (editable plates; the card shows
pips). `storageSession.updateTeam` takes a `loadout` patch.

## Open

- Browser Back drops an unsaved draft without asking.
- Reordering is drag only (no keyboard), and HTML drag does not work on iOS
  touch.
- The Roster still has its column; whether it follows the strip is open.
- The capability facets (glyphs in the strip, coverage) for Teams are parked.

Gates on `51debf1b`: vitest 2606, check, lint, build; full e2e chrome 79 +
webkit 79 passed.

## Notes carried over from Claude's working memory (2026-10-29)

Traps met during the round that the rulings above do not name:

- A wrapping flex line breaks on an item's BASIS before anything shrinks: give a search field a small basis plus grow plus a max-width, or the last control wraps onto a line of its own.
- `--sel-ring` is itself a `color-mix`, so it must never be mixed again (the WebKit nested-mix crash); mix from `--accent` instead.
- `:empty` never matches a Svelte element whose content is `{#if}` blocks; gate the element itself.
- A history entry that names a team has to be cleared (`replaceState`) when that team is gone, or `headless` keeps hiding the head over the cards.
