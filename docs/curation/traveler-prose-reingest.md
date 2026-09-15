# Traveler prose re-ingest — plan (2026-09-15)

_Status: SPEC. Found by the essential-characters scoping (batch 10) and widened
in-session._

## 0. The defect

Four of the seven element Travelers carry INVENTED passive and constellation
names and mechanics. All six element entries were hand-written in `a3cdc48a`
(2026-05-08), before the genshin-db ingest pipeline existed; `meta.source` says
`gcsim`, which is true of the FRAMES and false of the prose — gcsim carries no
talent text, so the prose came from memory.

| variant          | constellations                                  | passives                                                      |
| ---------------- | ----------------------------------------------- | ------------------------------------------------------------- |
| traveler_anemo   | correct                                         | correct                                                       |
| traveler_hydro   | correct                                         | correct                                                       |
| traveler_cryo    | correct (hand-built 2026-08-31 from genshin-db) | correct                                                       |
| traveler_geo     | C1/C4/C5/C6 wrong                               | both wrong (real: Shattered Darkrock, Frenzied Rockslide)     |
| traveler_electro | C1/C3/C4/C5 wrong                               | order swapped                                                 |
| traveler_dendro  | all six wrong                                   | both wrong (real: Verdant Overgrowth, Verdant Luxury)         |
| traveler_pyro    | all six wrong                                   | both wrong (real: True Flame of Incineration, Embers Unspent) |

Checked with `require('genshin-db').constellations('traveler<element>')` and
`.talents(...)` against each JSON's names — genshin-db has the real data for
every variant, so nothing here needs the wiki.

Why nothing caught it: `ingest-character.mjs` refuses Travelers, so
`audit-genshin-db-diff` and `audit-genshin-db-text` never cover them; the frames
audit checks only frames; the July capability sweep filed Pyro's real talents as
"absent from our JSON" and stopped.

## 1. The work (Opus-friendly, one commit per variant)

For each of geo, electro, dendro, pyro:

1. Pull the real passive + constellation blocks from genshin-db (names,
   descriptions, and the sidecar rows `docs/curation/talents/<id>.json` where
   the generator can be coaxed — the Cryo Traveler notes record the one-lookup
   patch that makes `db.characters()` answer for a Traveler).
2. Replace the entries WHOLESALE: ids, names, descriptions. Then re-author
   effects from the real text — every Traveler constellation has a Base Effect
   (only vs. the Lord of Eroded Primal Fire) and an ore-unlocked general effect;
   author the general half, as the other Travelers do. Known real mechanics
   worth a bar: Pyro C1 (active-character DMG while a Threshold is up), Pyro
   C4 (+20% Pyro DMG 9s after Q), Pyro A4 (energy), Geo C1 shield-on-field
   (check text), Dendro C1/C4 (check text).
3. Keep every FrameMap and `application[]` — those are gcsim's and correct.
4. Run the normal probe, `generate-character-index`, and the gates.

Also: fix Pyro Traveler's hold-E `anim` 77 → 81 while in the file.

## 2. The guard this needs

A names-only diff of ALL 126 characters' passives and constellations against
genshin-db, run once now (any other May-era hand-written prose has the same
exposure) and added to `audit-genshin-db-text.mjs` so Travelers are covered by
NAME even though the generator refuses them. ⛔ Not a new script — a Traveler
branch in the existing text audit.
