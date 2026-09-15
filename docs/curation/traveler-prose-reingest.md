# Traveler prose re-ingest — plan (2026-09-15)

_Status: ✅ SHIPPED 2026-09-15 (branch `curation/gcsim-sync-2026-09`, one commit
per variant). §0–§2 are the spec; §3 is the record. Found by the
essential-characters scoping (batch 10) and widened in-session._

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

## 3. Record (2026-09-15)

All four files carry genshin-db 5.2.13's passive and constellation entries now —
ids re-slugged from the real names, descriptions verbatim, every FrameMap and
`application[]` untouched — and each retired entry's invented name is recorded in
the replacing entry's `_curatorNotes`. Effects re-authored from the real text
against gcsim `ac2d76dde` (`internal/characters/traveler/common/<element>/`):

| variant | authored                                                                                                                                                                                                                                                                                                           | left to description (why)                                                                                  |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| geo     | A4 Frenzied Rockslide as an onHit damage effect on N5 (`filter.hitIndex: 4`); C1 +10% CR to the active character for the wall's life (15s / 20s at C6, two arms — an effect cannot read the summon's durationModifier); C4 +5 Energy at the burst (single-target case); modifier sources renamed to the real A1/C6 | C2 (construct-destroyed trigger; damage magnitude); interruption resistance                                |
| electro | nothing new — C2 was already right on the burst                                                                                                                                                                                                                                                                    | A1/A4 (amulet pickup unmodelled), C1, C4, C6 (count-triggered multiplier)                                  |
| dendro  | A1 Verdant Overgrowth as a **ramping** EM buff to the active character (0 → 60 in 6/s steps, 12s / 15s at C2); C1 +3.5 Energy at the skill; C2 as a `durationModifiers` entry on the Lamp; C6 +12% Dendro DMG to the active character for the Lamp's life                                                          | A4 (damage magnitude); C4 and the C6 element half (Lotuslight Transfiguration unmodelled)                  |
| pyro    | A4 Embers Unspent as a `source: 'active'` reaction energy proc (12s CD, gated on the Blessing); C1 +6% DMG to the active character for the Threshold's life; C4 +20% Pyro DMG for 9s after the burst; C6 as the Cryo Traveler's `infuse` shape plus a +40% CRIT DMG bar over the same 12s                          | A1 (AoE), C2 (Nightsoul points), C1's +9% (a receiver-side state), A4's +4 on Nightsoul Burst (no trigger) |

The two "party members within the AoE" bars (Geo C1, Dendro A1/C6) and the
three Nightsoul-bound bars (Pyro C1/C6) carry caveats that name the pixel: drawn
for the field's or the state's whole life, held only while standing inside / until
the Nightsoul points empty.

🐛 **Two live defects came out with the prose.** The Geo A1's cooldown gate was
authored `{type:'ascension', level:1}` where `evalCondition` reads `min`, so the
−2s never applied and his skill sat at 6s (now 4s — measured `E@0.00 cd=240`);
it was the corpus's only such key. The Pyro hold-E `anim` was 77 for gcsim's 81.

Probe (`<name> E N1 N2 N3 N4 N5 Q E > Fischl E N1`, C0 and C6): Geo C6 draws the
CR bar 10.35–30.35s; Electro C6 the C2 shred; Dendro the ramping EM 12s at C0 and
15s at C6 with the Lamp's ticks following (22.55s → 25.55s) and the C6 Dendro
bonus; Pyro C6's infusion makes his normals apply Pyro (1.10 / 2.72 / 3.87s where
C0 applies nothing) beside the C1, C4 and CRIT DMG bars.

Sidecars: `docs/curation/talents/traveler_{geo,electro,dendro,pyro}.json`,
generated through the Cryo Traveler's recorded one-lookup patch
(`db.characters` monkeypatched to answer `{ name }` for the four keys).

**The guard (§2) shipped as `audit-genshin-db-text.mjs --names`** — a section of
every full report and a stand-alone, network-free check of every corpus passive
and constellation NAME against the installed genshin-db. Its first run: 15
divergent rows. Six are the 7.0 Witch's Revelation passives genshin-db 5.2.13
does not carry (Beidou, Cyno, Diona, Qiqi, Wriothesley, Yae Miko) — real, and why
the check is a report, not a gate. ⚠️ **The other nine are Lan Yan: both passives
and all six constellations diverge** — the same hand-written class. ✅ Re-ingested the same day: names and
descriptions from genshin-db, the gcsim-derived mechanics (C4 buff, C6 charge)
kept verbatim. The guard now reports the six Witch's Revelation rows only.
