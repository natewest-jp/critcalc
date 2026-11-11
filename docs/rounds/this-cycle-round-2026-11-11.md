# 2026-11-11: the New tag and This cycle

Announcing a new endgame cycle, from the to-do's "Signaling a new endgame". Branches, stacked: `feat/abyss-cycles` → `feat/new-tag` → `feat/this-cycle`. The shape is in `docs/design/team-builder-lineups-design.md` §12.6 and below; it is a demo for Nate's look, built in place.

## Rulings (Nate, 2026-11-11)

- A past lineup is an archive of what was planned for its cycle. It never wears the New tag; nothing nudges a player to bring it up to date.
- The New tag stands in two places: on the Builder's season picker while the open lineup is pinned to an older cycle, and on the Library's This cycle blank card for a cycle just dropped. Both clear on the first click and never return.
- Abyss lineups keep their cycle, as Stygian and Theater lineups do. The Abyss data already keeps every cycle since 2026-09-16 (`keepsEveryEntry` in `fetch-endgame.mjs`).
- This cycle leads the Builder's Library only. A running endgame with no lineup shows a blank card that opens a new lineup of it. A lineup of a running cycle stands in This cycle only, and moves down on its own when the cycle ends.
- The tag matches the game's as closely as our visuals allow, in Bitter, with two new colors for it.

## 1. Abyss lineups keep their cycle (`feat/abyss-cycles`)

- `Board.season` holds an Abyss cycle's start ("2026-10-16") beside a Stygian version. The first character placed pins it, the Stygian rule generalized; the board shows that cycle's blessing and opponents, and band B gets the season picker, listing each opened cycle by its Moon and dates.
- An Abyss lineup saved with characters before this has no stored cycle: it takes the cycle of its last edit (`lineupCycle`, `$lib/endgameCycle`), in the Library and in the Builder's pin. Pinning it to the running cycle was rejected: it would file an October lineup under November.
- The share link and the backup accepted a version only, and would have dropped an Abyss cycle. Both take either now (`isCycleId`). Tests, written failing first: `boardUrl.test.ts`, `backup.test.ts`; and `endgameCycle.test.ts` (new).

## 2. The New tag (`feat/new-tag`)

- `NewTag.svelte`: lemon text and a 1px lemon border on an amber fill, a soft glow, and four-point sparkles on the top-right and bottom-left corners. Measured off Nate's inventory screenshot, where all six tags agree to within 2 per channel: text and border `#FFFB5C`, fill `#D38D26`. New primitives `--lemon-200` and `--amber-500` behind the roles `--new-ink` and `--new-fill`; the L0-law test polices both ramps.
- 🎛️ Knobs in `app.css` beside the roles: `--new-tag-size` (0.75rem; the rest is in em), `--new-tag-lift` (0.6em above the host's top edge), `--new-tag-inset` (0.5em in from its right edge).
- Acknowledgement is `seenCycles` in site settings: per endgame, the cycle last acknowledged. One record serves both places, so a click on either announces the cycle once. An absent record shows the tag, so a first visit sees it on every blank card.

## 3. This cycle (`feat/this-cycle`)

- `LibraryPlace.svelte` splits the Builder's lineups by `inThisCycle`: the running Abyss, Stygian and Theater, in that order, each with its lineups or a blank card; then the rest, pinned first as before. The blank card draws the empty rows a new lineup starts with and the cycle's dates, and a click acknowledges the cycle and opens the new lineup. Under a team filter, no blanks.
- An Abyss between cycles (data not yet extended) has no This cycle place, by `currentAbyss`'s end guard.

## 4. Copy proposed, not yet approved

1. Now: (no heading over the lineups below This cycle)
   → "Other lineups" (in the demo as working copy)
2. Now: "Abyss" (an Abyss lineup's derived label, in the Library and the Builder's tab)
   → "Abyss Stardread Moon" (its cycle, as "Stygian 7.2" and "Theater November" carry theirs)
3. Now: (none; the Abyss picker's screen-reader name)
   → "Cycle: Stardread Moon, Oct 16 – Nov 16" (in the demo as working copy)

## 5. Verification

- Gates green on each branch; `npm run test:e2e:chrome` green on `feat/this-cycle` (73 passed, 1 skipped).
- Seen in headless Chrome at 1440 and 390: the tag on all three pickers, cleared by a click; This cycle with three blank cards; a 7.1 lineup among the rest; an Abyss lineup kept on Cascading Moon. Nate's look, and real Safari, are still owed.
