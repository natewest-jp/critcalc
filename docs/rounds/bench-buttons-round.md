# Bench-buttons round (2026-10-22)

Follows phase 0 of the profiles build (`docs/rounds/planner-slots-round.md`). Merged `0b13c9c6`
(`feat/bench-buttons`); a layout follow-up merged `9030a7f8` (`fix/timeline-layout-steadiness`).
Both pushed 2026-10-22.

## Why

Slots that rest gave the retired rail a purpose again: a character you PLACE stays on the bench
until removed, and the desk had no Remove anywhere. ⚓ All six points agreed with Nate before the
build.

## What shipped

1. **⇄ Swap + ✕ Remove at the card's LEFT**, the pre-2026-10-13 rail lifted with its geometry
   (`git show 58680e9f^1:src/lib/components/SlotPortrait.svelte`): a 16px strip, two tiles splitting
   the band, each fill running on under the opaque disc as a `::before` that paints and cannot be
   clicked. The rail is an `actions` snippet on `SlotPortrait`, rendered by `BenchBand`.
   - 🎛️ `tune(nate)` `8b9a9c74`: quiet at rest (halfway from the card ground to the raised rung)
     and lit ONLY by hovering the tile itself. ⛔ A first cut raised the whole rail on card hover:
     "too many things lighting up all over the place". `--sp-rail-gap` 4 → 2 (the arc clearance
     re-solves to W ≥ 15.8, so 16 holds). The card's left padding is 0 now the rail stands there.
   - An empty slot hides its tiles with `visibility` (⛔ never element opacity on the
     transform-placed ribbon) and keeps their boxes.
2. **The portrait opens DETAILS on the desk too**; the hover magnifier retired.
3. **✕ = `rt.setSlot(i, null)`**: empties the slot and deletes the character's notation.
4. **Phone**: no swap (ruling stands); Remove is the details card's existing team button ("In team —
   remove"), shown on the Planner only in the narrow form.
5. **An empty (or Blank) portrait** still adds through the Builder's swap mode on the desk.
6. **Help**, "The team", second paragraph: Nate's wording.

⚓ A name longer than Kuki Shinobu's (the longest that fits on one line) is a font-size or
condensed-face question, ⛔ not a padding one.

## The layout follow-up (`9030a7f8`)

- **The aura lane follows its toggle alone.** It waited for the first application, so with Auras
  on it popped in mid-keystroke and pushed the chart down. Its empty plot and 1U rule are the
  "nothing on the target yet" reading.
- **An empty slot's name keeps one line box**, so the inert loadout pill sits where a filled card's
  does.
- **Diagnosed and KEPT (⚓ Nate):** with `Cryo Traveler E > Odette E E > Alyosha hE Q`, every slot
  shrinks a row when a fourth name is typed. All slots take the BUSIEST slot's aux rows
  (`auxRowsReserved`); Alyosha's slot carried his two summon rows plus his own Q buff, received
  because he ended the rotation on field. A fourth name ends it on someone else, the buff row moves
  to them, and the reserve drops. ⛔ A grow-only reserve was rejected: one rotation would render
  and export at different heights depending on edit history.

## Verification

Full e2e before each merge: 160/160, then 159 + 1 flaky (the webkit nav storm, which wants
`--workers=1`; 3/3 green alone). Nate checked Chrome and Safari.
