---
paths:
  - 'src/routes/(scene)/(tools)/builder/**'
  - 'src/lib/boards.svelte.ts'
  - 'src/lib/boardBar.svelte.ts'
  - 'src/lib/characterFilters.ts'
  - 'src/lib/components/CharacterGrid.svelte'
  - 'src/lib/components/CharacterFilterStrip.svelte'
  - 'src/lib/components/MoreFilters.svelte'
  - 'src/lib/components/CharacterCard.svelte'
  - 'src/lib/components/DetailCard.svelte'
  - 'src/lib/components/CharacterDetails.svelte'
  - 'src/lib/components/InspectModal.svelte'
---

# Team Builder

Budget: about 6,000 characters. Read `docs/team-builder-lineups-design.md` before any Builder work. Records: `docs/builder-toolbar-round.md`, `docs/tb-lineup-fit-round-2026-10-20.md`, `docs/tb-endgame-round-2026-10-09.md`.

## Shape

- The Builder's document is a board: a lineup of several teams. Teams on a board can be live-linked (`boardBar.svelte.ts`), and each carries a fingerprint (`Fingerprint.svelte`).
- The board docks beside the roster. Below `toolMin` the two become tabs, Characters and Lineup.
- The Builder has no bench and no aside.
- Inbound links: `?team=` lands on the active board, `?b=` opens a board, and `?swap=N` opens swap mode for a planner slot (a commit returns to the planner).

## The roster

- The roster is capability-faceted ("who can heal, shield or buff, at which constellation"), with facets in `builder/lib/facets.ts` and provenance in the detail card (`DetailCard.svelte`, a shell over `CharacterDetails`).
- Filters are `CharacterFilterStrip` plus the More popover (`MoreFilters`). `CharacterGrid` and the strip are siblings that meet on the consumer's `GridFilters` object (`characterFilters.ts`).
- Capabilities are derived, never hand-maintained (`.claude/rules/data.md`). The Builder's checks are `deriveCapabilities.test.ts` and `e2e/team-builder.spec.ts`.

## The toolbar

- Per-pane cells: Search, Owned/Wishlist, More, the constellation lens, Clear, Add team, No repeats, Share. The lens folds into More by measured cell width (`foldLens`).

## The inspector

- In the Builder the inspector is a modal (`InspectModal.svelte`) with one frame: a kicker, a display title, a hairline header and an inset, for a character, a boss or the opponents. The Stygian boss detail is `builder/lib/BossDetail.svelte`.
