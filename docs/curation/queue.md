# Character Curation Queue & Risk Classification

Snapshot date: **2026-04-27**.

Numbers below count the 117 character JSONs in `src/lib/data/characters/`.
Recompute when a new generator run lands.

| Bucket | Count |
|---|---|
| Already curated | 10 |
| Excluded — no gcsim source | 16 |
| Tier A — automation-friendly | 60 |
| Tier B — synchronous (stance / multi-mode / multi-stage) | 16 |
| Tier C — synchronous (complex mechanics, judgment-heavy) | 15 |

Identifiers below are critcalc JSON IDs (file basename without `.json`).
The gcsim directory name is given when it differs.

---

## Already curated (10)

`bennett`, `cyno`, `fischl`, `furina`, `ganyu`, `kaedehara_kazuha`
(gcsim: `kazuha`), `raiden_shogun` (gcsim: `raiden`), `xingqiu`, `yelan`,
`zhongli`.

In-progress: `hu_tao` is partially migrated (A1 effect already on its
passive). Not in any tier below — finishing it is owned by the human pass.

## Excluded — no gcsim source (16)

These have a critcalc JSON but no gcsim character dir, so first-pass
automation can't produce frame data. Revisit when gcsim adds them.

| ID | Reason |
|---|---|
| `aether`, `lumine` | Travelers — gcsim splits per element under `traveler/<element>/`; needs bespoke handling |
| `aino`, `columbina`, `durin`, `iansan`, `ifa`, `illuga`, `jahoda`, `kachina`, `linnea`, `manekin`, `manekina`, `nefer`, `zibai`, `varka` | Newer (post-Natlan) |

`blank.json` is a template stub and is omitted from all counts.

---

## Tier A — automation-friendly (60)

Standard E + Q. Effects are normal buffs / heals / shields. No stance, no
chained skill, no exotic mechanics. **Fair game for autonomous first-pass
drafts.**

Sub-grouped by suggested run order — simplest first, since the recipe will
need calibration on early runs.

### A.1 — Warm-up batch (simplest; run these first)

Effects are minimal or already mostly authored by the generator. Pure
mechanical work.

`amber`, `barbara`, `dori`, `faruzan`, `jean`, `kaeya`, `kuki_shinobu`
(gcsim: `kuki`), `layla`, `lisa`, `mika`, `mona`, `qiqi`, `sayu`, `sucrose`,
`thoma`.

### A.2 — Standard

`baizhu`, `beidou`, `candace`, `charlotte`, `chevreuse`, `chongyun`,
`collei`, `dahlia`, `diona`, `eula`, `freminet`, `gaming`, `gorou`, `kaveh`,
`keqing`, `klee`, `kokomi` (gcsim: `kokomi` — file id `sangonomiya_kokomi`),
`kujou_sara` (gcsim: `sara`), `lanyan`, `lauma`, `lynette`, `lyney`,
`navia`, `nilou`, `ningguang`, `noelle`, `ororon`, `razor`, `rosaria`,
`sethos`, `shenhe`, `shikanoin_heizou` (gcsim: `heizou`), `sigewinne`,
`tighnari`, `venti`, `xiangling`, `xinyan`, `yae_miko`, `yanfei`, `yaoyao`,
`yumemizuki_mizuki` (gcsim: `mizuki`), `yunjin`.

### A.3 — Standard with infusion

These have an always-on or skill-window infusion on normal attacks. The
recipe handles infusion via `Ability.infusion` field; flag in
`_curatorNotes` if anything looks off.

`aloy` (Coil → cryo-infused N4), `nahida` (E targeting and re-trigger
mechanic on charged hold).

---

## Tier B — synchronous, stance / multi-mode / multi-stage (16)

These need **multiple normal or multiple skill ability entries** in the
JSON, or some other multi-mode pattern that the recipe doesn't cover. Do
**not** draft autonomously.

| ID | gcsim name | Reason |
|---|---|---|
| `alhaitham` | `alhaitham` | Mirror count gates skill behaviors; chained skill |
| `arataki_itto` | `itto` | Raging Oni King stance after Q changes N attack pattern |
| `arlecchino` | `arlecchino` | Balemoon Rising stance after E + Bond of Life mechanic |
| `clorinde` | `clorinde` | Skill-mode toggle changes N infusion + Bond of Life |
| `diluc` | `diluc` | Three-stage E (E1 / E2 / E3) — each press is a different ability |
| `hu_tao` | `hutao` | Paramita Papilio stance changes N + infusion (already partially curated) |
| `kamisato_ayato` | `ayato` | Soukai Kanka stance after E (Shunsuiken N replacement) |
| `kirara` | `kirara` | Box mode (sustained run) is stance-like with own behaviors |
| `mualani` | `mualani` | Sharky Surfboard mode replaces normals with charge-stack chomps |
| `tartaglia` | `tartaglia` | Foul Legacy stance after E — full melee replacement |
| `wanderer` | `wanderer` | Skydweller hover mode after E replaces N/dash/jump |
| `wriothesley` | `wriothesley` | Chilling Penalty boxing stance after E |
| `xiao` | `xiao` | Yaksha mask burst stance with anemo infusion |
| `yoimiya` | `yoimiya` | Niwabi Fire-Dance changes N behavior (auto-aim + pyro infusion) |

(2 additional slots reserved — re-tier as we learn from synchronous passes.)

---

## Tier C — synchronous, complex mechanics (15)

Not strictly stance, but mechanics make accurate first-pass authoring
risky enough that autonomous drafting will produce work the human pass
mostly has to redo. Constructs, redirected damage, multi-element absorption,
Nightsoul economies, exotic resource systems.

| ID | gcsim name | Reason |
|---|---|---|
| `albedo` | `albedo` | Geo construct with elevation mechanic + transient flower A1 |
| `chasca` | `chasca` | Soulsniper bullet system absorbs party elements |
| `chiori` | `chiori` | Tamoto construct with placement/strike mechanic |
| `citlali` | `citlali` | Itzpapa field + Cipactli Q with EM scaling debuff |
| `dehya` | `dehya` | Field redirect + Roaring Barrage chain |
| `escoffier` | `escoffier` | Hydro/cryo dual mechanic with charge-stack consumption |
| `flins` | `flins` | Newer character; mechanics not yet stable |
| `ineffa` | `ineffa` | Newer character; mechanics not yet stable |
| `kinich` | `kinich` | Nightsoul stamina drain + Scalehound combo system |
| `mavuika` | `mavuika` | Nightsoul + Ringsaber/Drakespur multi-mode + Ride the Wind |
| `neuvillette` | `neuvillette` | Sourcewater Droplets + CA-emphasis + sustained beam |
| `skirk` | `skirk` | Newer character; mechanics not yet stable |
| `varesa` | `varesa` | Nightsoul + multi-mode plunge state |
| `xianyun` | `xianyun` | Plunge enabler with Driftcloud Wave repositioning |
| `xilonen` | `xilonen` | Yohualtecuhtli skateboard + Source Samples team buff |

---

## Re-classification policy

- A character can move from B/C to A if a synchronous pass establishes a
  recipe extension that handles their pattern reliably — update both the
  recipe and this file in the same PR.
- A character can move from A to B/C at any time if an autonomous draft
  comes back wrong in a way the recipe didn't anticipate; document the
  reason in this file.

## Suggested first three autonomous runs

For calibration, before scheduling recurring runs:

1. **`sucrose`** — generator already populated effect skeletons; pure
   mechanical frame work. Good check that the recipe produces the right
   shape.
2. **`mona`** — second catalyst, similar shape, lets us confirm consistency.
3. **`amber`** — bow user, exercises the `chargeHits[]` path and bow
   normal-hit conventions.

If those three come back clean, promote the rest of A.1 to scheduled runs.
