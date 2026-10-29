# Team Builder — the endgame presets + team rows (round record, 2026-10-09)

Branch `tb/endgame`, lineups design build step 5 (team rows) plus the endgame
presets' data. The design doc (`docs/design/team-builder-lineups-design.md`, §10 wins)
holds the model; this is what shipped and what Nate ruled live.

## What shipped

- **Endgame data** from lunaris.moe (`scripts/fetch-endgame.mjs` →
  `src/lib/data/endgame/{stygian,abyss}.json`; art via
  `build-endgame-art.mjs`). ⚓ No leaks: `season-dates.json` is
  hand-maintained — one Stygian line per patch, one Abyss line per cycle
  (Nate names the blessing). ⚠️ lunaris carries BETA records.
- **⛔ No elemental RES.** lunaris's `monsterStats` is the BASE template —
  Gale Hewing read 10/30% where the fight opens at 90% and steps down per
  Stellar Glimmer stack (stygian.moe) — and most bosses' RES moves with their
  mechanics. Removed from the modal, data, type and fetch script; stygian.moe
  is the place for it. A wrong number is worse than none.
- **Boss names in the game's order:** "Battlefield 1: Battle-Hardened
  Domovoy Sculptor: Gale Hewing" — the part before the colon is the NAME, the
  part after it the title. One gold voice in the header; the modal heads with
  the name, the title beneath.
- **Materials, after the game's Party Setup:** only a row's HEADER is glass
  (a battlefield, an Abyss half with its blessing); everything under it is on
  the night. Night text is `--text` only.
- **The pick model (Nate, the game's own):** a ROW is selected, never a slot;
  picks fill its earliest empty slot in click order, the same pick again frees
  its slot (others keep their places). With no chosen row the selection
  follows the board. A fifth pick into a full team NUDGES (2px shake, twice;
  none under reduced motion) and adds nothing. ✕ remove buttons retired; a
  filled portrait only selects its row. The library places only into a
  CHOSEN row. Reordering = remove and re-add (what players know); drag is a
  possible later addition.
- **Views:** Roster · Roster + board wide, Roster · Board on a phone. Wide: a
  pick from the full roster opens the split; phone: the board shows once the
  team fills.
- **No repeats, allow-and-mark:** a warning mark at the disc's bottom left
  (⏭ watch it against chins), a toggle beside Add team; new boards ON for
  Stygian/Abyss, OFF for Custom.
- **Fingerprint glyphs:** six of fifteen traced (Healing, Shield, ATK, EM,
  Crit, ER), inlined by `scripts/generate-fingerprint-glyphs.mjs` from
  `static/assets/effects/` (24-unit, fills only; a two-tone glyph names its
  quiet half with an id containing "gray"/"shade"). ⚓ TWO STATES, every
  glyph always drawn: lit = the team has it (dots = providers); faint = it
  doesn't (dots = who WOULD — higher constellation or an unmet condition; no
  dots = nobody). An uncurated member reads faint/no dots; the tooltip says so.
- Rings: members and boss at `--line-faint` on the night, library portraits at
  `--line-soft` on slate. Empty slots wear the blank side portrait.
- Dropdowns: season + pinned rotation are `BandMenu`s (`align`, `size` added).
- 🐛 The Abyss banner text sat under its art — `mask-image` makes a stacking
  context that paints over in-flow text in the same grid cell.

## Queued

- ⏭ **Phone width overflows** (Nate checked) — a real pass, not a tweak.
- ⏭ The other nine glyphs (Nate: the split HP/DEF buff icon first, then a
  conversation about the look of the rest).
- ⏭ Step 6 swap mode, step 8 copy (every new string here is working copy).
- ⏭ Open question: should a plain card click pick (as in the game) while the
  board is showing, with details behind a small button?
- 11 of 40 check phrasings are UNKNOWN (never guessed); the 187 KB season data
  could lazy-load.
  - ↻ 2026-10-12: both settled. The bosses' words now load with their modal
    (`stygian-bosses.json`; the page chunk went 346 → 135 KB). ⚓ Nate ruled
    the phrasings (the rules live in `endgameChecks.ts`'s header): the
    Nightsoul pair = any Natlan character or the Pyro Traveler; crowd control
    (both spellings) = a Grouping provider, else still unknown; Bond of Life =
    Arlecchino and Clorinde (hand-kept). Still UNKNOWN on purpose: the three
    frequency checks, Plunging-Attack Characters, and Single and Multi
    Elemental DMG (↻ same day: a member's element is not the element they
    deal — infusions, buffers who barely hit). So 7 of 40 stay unknown, plus
    crowd control without a grouper.
