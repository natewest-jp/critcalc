# Planner slots round — phase 0 of the profiles build (2026-10-22)

**Branch:** `feat/planner-slots` (from `main` `51665f63`). **Spec:** `docs/profiles-and-surfaces-design.md` §8.1 (the rule) and §13 (why this ships first, on its own).

## The problem

A streamer opened a team from the Library to start a rotation. It arrived as bare names joined by swap connectors (`Xiangling > Bennett > …`); he cleared the text to start writing, and the team vanished. The cause was the 2026-08-13 ruling that DERIVED the team from the notation (the first four distinct names), so deleting text deleted characters, and the stub existed only to make the team exist.

## The rule (⚓ Nate 2026-10-22)

> **Characters you put on the team stay until you remove them; characters you type come and go with the text.** (↻ refined the same day, before the push: a seat remembers whether it was PLACED — a team, a lineup, a link, a swap, the Builder — or TYPED. Nate found the first cut leaving a typo resting: on a fresh tab, Xiangling typed then deleted stayed in slot 1, and the next name went to slot 2.)

A rotation stores **four slots** (the party keys 1–4) and the notation **fills** them.

- A **typed** seat whose character leaves the notation **empties** (as before slots existed); a typo fix returns the character to the slot they just left (`vacated`).
- A **placed** character the notation does not name **rests**: the card keeps its slot (art dimmed), the lane draws nothing, and the character still counts for the party (resonance, faction counts), as in the game.
- A newly named character takes the slot it just left by text, else the first **empty** slot, else the first **resting** (placed) one, lowest first, and is typed there. Nothing else moves.
- Only an explicit write empties or reassigns a seat: a swap (keeps the slot, renames the segments), Clear, and `setSlot(i, null)`.
- A team document (Library team, `?team=`, a Builder board team) opens with the four **seated in an empty notation**, and the editor's hint names slot 1.

## How it is built

| Piece                                                                                                                                                                                                                                           | Where                                                                                                 |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| The rule: `seatSlots` (idempotent; from empty seats it IS the old derivation, which is how everything saved before migrates), `seatsOfSaved`, `seatsFromLegacy`                                                                                 | `src/lib/utils/notationEdit.ts`                                                                       |
| The store: `seats` ((string\|null)[], `null` = empty, so a seated Blank is finally distinct); `notation` is an accessor that runs the rule on an outside write; `setDocument` writes both without it; `rt.slots` keeps its consumers' old shape | `src/lib/rotationTabs.svelte.ts`                                                                      |
| ⌘Z: the seats are a CodeMirror field; a transaction extender seats typed changes, inverted effects give the history the old seats                                                                                                               | `src/lib/utils/notationSeats.ts` (+ `notationEditor.ts`, `RotationTimeline.svelte`)                   |
| Persistence: tabs, saved entries, the backup and the `?r=` codec carry `slots` and `placed`; the codec is **format 3** and still decodes format 2 (the retention rule)                                                                          | `rotationUrl.ts`, `stores.ts`, `settingsBackup.ts`                                                    |
| Readers moved to stored slots: the bench, the Library's grouping, board pins, shares, the linter's "no slot"                                                                                                                                    | `BenchBand`, `library.ts`, `LibraryView`, `boards.svelte.ts`, `library.svelte.ts`, `notationFlags.ts` |

## Why the seats live in the editor

Under derivation, undo was free: undoing the text restored the team because the team WAS the text. The seat rule depends on history (who rests, who took whose seat), so re-running it over undone text does not give seats back: type Kazuha into a full party with Bennett resting and he takes Bennett's seat; undo, and the rule leaves Kazuha resting and Bennett gone. Keeping the seats in the `EditorState` puts them in the same history as the text, so ⌘Z and Redo restore both in one step, and a store-side write (a swap) dispatches text and seats as one transaction.

⚠ CodeMirror's `placeholder()` CLONES the element it is given, so a hint updated in place never reached the screen (a new tab named the last tab's team). The hint is a decoration computed from the seats field (`seatHint`).

## Open

- ⏭ **Where a deliberate "take off the team" lives** (Nate). The bench's ✕ retired on 2026-10-13 when the portrait became the swap; the lab demo put ✕ on the card on hover. Until decided, a slot empties through Clear, or is replaced by typing a newcomer or by a swap.
- ⏭ **Nate's eye on the resting look**: art at `brightness(.5) saturate(.6)`, the name in muted ink, a tooltip. ⚠️ A filter on the gliding bench cards is unverified in real Safari (the sub-pixel laws ban element opacity there; a filter on one image is likely safe, and is what the Safari pass must confirm).
- The PNG export draws a resting character like any seated one (an empty lane, undimmed card); the phone's bench row dims, being the same card. Judge whether the export should dim too.

## Gates

vitest 2527 · `npm run check` · `npm run lint` · `npm run build`; e2e `cross-tool`, `marks`, `loadout-layers` 13/13 on chrome; **full e2e 160/160 on chrome + webkit** (2026-10-22, at `a3100829`).
