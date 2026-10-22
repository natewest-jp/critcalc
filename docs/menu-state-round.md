# The menu state and the Library (phase 2c), 2026-10-22

Under the switch (`?next`), everything you go to on purpose is one full-screen state on slate with the top bar on it (design §6): the Library's two places, the Roster, Help, About and Settings. With the switch off, nothing changes.

## What shipped

- **`src/lib/menuState.svelte.ts`**: the sections, their addresses and the sidebar groups. ⚓ **Every section has its own address without remounting the tool** (§13.4): over a tool a section is a SHALLOW history entry (`pushState` with the section's path), so the address bar, Back and a copied link name the section while `page.url`, and so the tools layout's `{#key}`, still names the tool. A reload of that address lands on the section's own route. `menuDepth` counts the entries one visit pushed, so ONE Escape (or ✕, or the current tool's button) returns to the tool rather than to the previous section; Back steps through sections.
- **`MenuState.svelte`**: one host in the scene layout for every surface (the landing, a section's route, over a tool). Sidebar groups per §6.1: the profile's name (Roster), Library (Rotations · Planner, Lineups · Builder), Help (today's chapters), About (today's chapters), Settings. A link inside a section that names another section switches in place. The world stops rendering once the slate has faded in (`sceneOccluded`). On a phone (below `roomy`) the sidebar IS ☰'s index, with the three tools at its top, and a section shows alone with "‹ Menu" back.
- **`LibraryPlace.svelte`**: the profile's documents from IndexedDB. Rotations as rows (portraits, label, Open now, time), Lineups as cards (the teams inside); Pinned heads Recent; Rename in place (an empty name clears it back to the derived label), Pin, and Delete on a second click (a tombstone). ⚓ It is the SWITCHER: a row puts its document in the tool and returns; New opens a blank one.
- **The session's document API** (`storageSession.documents / currentId / open / create / rename / setPinned / remove`, `version`), working with or without a tool mounted: off a tool it moves the profile's current pointer (or flags a blank start) and the tools layout opens it on arrival. `DocumentRecord.pinned`.
- **Every old door leads here under the switch**: the top bar (the current tool's button TOGGLES its Library place, ☰ the index, `?` Help and About, ⚙ Settings, the picture the Roster), and `openArea`/`openSettings`/`openNav`/`library.show`/`library.openRoster`, so a chapter's link, Coverage's opener, the Builder's "Open the Roster" and a details card's "Edit in Roster" arrive too. The old Library overlay, the chrome modals and the compass are unreachable under the switch.
- **The static pages are sections under the switch**: the pages layout hands its address to the menu state and draws neither its panel nor the page (the old `/library` page would have restored and persisted the old tab models). New routes `/library/rotations`, `/library/lineups`, `/roster` (with the switch off they go to `/library`).
- ☰ wears Nate's compass (`navigation.svg`) and the way out his `close.svg`.

## Calls for Nate to overrule

1. **Teams is not in the sidebar** until phase 3 builds it (an empty section would be a promise).
2. **Help and About show today's chapters**; §6.4's short strings on slate with paper patches is a copy round, and Getting started / Keyboard shortcuts join when written.
3. **A section's own route closes to** its tool for a Library place, else the landing.
4. **New does not move the current pointer** until the blank has content, so a reload before typing reopens the previous document (a blank was never a document).
5. **The new addresses are not in the sitemap**: they show a profile's own data, and indexability is the release's decision (§13.4). `seo.ts` has their titles.
6. **Delete confirms by a second click** on the same button ("Delete?", 3 s), as Settings' resets do.
7. The menu state's sidebar and the main column are **text straight on slate**; rows and cards are `--surface-raised`. No paper yet.

## Not yet (owned by later steps)

The mini timeline strip on a row (a parse per row) · the from-a-link mark (2d's routing) · guests nested under their row and pick mode (phase 4) · the flip transition beyond a `--t-quick` fade (§12 Q17) · the tool's own keyboard shortcuts still hear keys while the menu covers it · a Builder team's pinned rotation still reads `savedNotations` (2a's gap, phase 3).

## Verification

vitest 2557 · check · lint · build. Headless Chrome against the production build: the door opens `/library/rotations` over the Planner; New → blank, typed, saved, listed; opening a row switches the document; Back steps section to section, Escape returns to the tool; ⚙ → `/settings`; Help → `/help/planner` in place; rename reaches the bar; pin splits Pinned/Recent; reload on `/library/rotations` shows the routed state; the phone index at 390. Chrome and WebKit: ⚙ from the landing and Escape home; a cold `/about` renders the menu state and no panel; New lineup from a routed section lands in the Builder on a fresh board. No page errors.
