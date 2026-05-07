# Character Curation Queue & Risk Classification

Snapshot date: **2026-05-07** (Tier C start).

Numbers below count the 116 character JSONs in `src/lib/data/characters/`.
Recompute when a new generator run lands.

| Bucket | Count |
|---|---|
| Already curated | 64 |
| Excluded — no gcsim source | 16 |
| Tier A — automation-friendly | 0 |
| Tier B — synchronous (stance / multi-mode / multi-stage) | 21 |
| Tier C — synchronous (complex mechanics, judgment-heavy) | 15 |

Identifiers below are critcalc JSON IDs (file basename without `.json`).
The gcsim directory name is given when it differs.

---

## Already curated (49)

**Original 10 (pre-automation):** `bennett`, `cyno`, `fischl`, `furina`,
`ganyu`, `kaedehara_kazuha` (gcsim: `kazuha`), `raiden_shogun` (gcsim:
`raiden`), `xingqiu`, `yelan`, `zhongli`.

**Calibration runs:** `sucrose`, `mona`, `amber`.

**A.1 batch (2026-04-27 → 2026-04-28):** `barbara`, `dori`, `faruzan`,
`jean`, `kaeya`, `kuki_shinobu`, `layla`, `lisa`, `mika`, `qiqi`, `sayu`,
`thoma`.

**A.2 batch (2026-05-01 → 2026-05-06):** `baizhu`, `beidou`, `candace`,
`charlotte`, `chevreuse`, `chongyun`, `collei`, `dahlia`, `diona`, `eula`,
`freminet`, `gaming`, `gorou`, `kaveh`, `keqing`, `klee`,
`sangonomiya_kokomi`, `kujou_sara`, `lauma`, `lynette`, `lyney`, `navia`,
`ningguang`, `noelle`, `razor`, `rosaria`, `sethos`, `shenhe`,
`sigewinne`, `tighnari`, `venti`, `xiangling`, `xinyan`, `yaoyao`,
`yun_jin`.

**A.3 batch (2026-05-06):** `aloy`, `nahida`.

**Tier B start (2026-05-06):** `hu_tao` finished as the canonical stance
reference for the rest of Tier B's stance characters. Authored as
`behavior: "stance"` on the skill (not the burst — Hu Tao is the only
Tier B stance triggered by E rather than Q), with `terminatesOnSwap: true`,
PP ATK conversion as a `value: { type: "scaling", stat: "hp", ratio: ... }`
buff, infusion + `conditions: { state: "inStance" }` on the PP normal,
and `onStanceEnd` trigger on Flutter By A1.

`lanyan` and `nilou` blocked during the A.2 run on multi-stage skill
chains and have been promoted to Tier B (see below).

## Excluded — no gcsim source (16)

These have a critcalc JSON but no gcsim character dir, so first-pass
automation can't produce frame data. Revisit when gcsim adds them.

| ID | Reason |
|---|---|
| `aether`, `lumine` | Travelers — gcsim splits per element under `traveler/<element>/`; needs bespoke handling |
| `aino`, `columbina`, `durin`, `iansan`, `ifa`, `illuga`, `jahoda`, `kachina`, `linnea`, `manekin`, `manekina`, `nefer`, `zibai`, `varka` | Newer (post-Natlan) |

`blank.json` is a template stub and is omitted from all counts.

---

## Tier A — automation-friendly (0 remaining)

**Tier A is complete as of 2026-05-06.** All 60 originally classified
characters were either curated or re-tiered to B/C. Sub-section history
preserved below for reference; nothing to action here.

### A.1 — Warm-up batch (done 2026-04-27 → 2026-04-28)

`amber`, `barbara`, `dori`, `faruzan`, `jean`, `kaeya`, `kuki_shinobu`
(gcsim: `kuki`), `layla`, `lisa`, `mika`, `mona`, `qiqi`, `sayu`, `sucrose`,
`thoma`.

### A.2 — Standard (done 2026-05-01 → 2026-05-06)

35 characters drafted: `baizhu`, `beidou`, `candace`, `charlotte`,
`chevreuse`, `chongyun`, `collei`, `dahlia`, `diona`, `eula`, `freminet`,
`gaming`, `gorou`, `kaveh`, `keqing`, `klee`, `sangonomiya_kokomi`,
`kujou_sara`, `lauma`, `lynette`, `lyney`, `navia`, `ningguang`, `noelle`,
`razor`, `rosaria`, `sethos`, `shenhe`, `sigewinne`, `tighnari`, `venti`,
`xiangling`, `xinyan`, `yaoyao`, `yun_jin`.

7 characters promoted to B/C during the run: `lanyan`, `nilou`,
`shikanoin_heizou`, `yae_miko`, `yanfei` → B; `ororon`,
`yumemizuki_mizuki` → C.

### A.3 — Standard with infusion (done 2026-05-06)

`aloy` (Coil → cryo-infused N4), `nahida` (E targeting and re-trigger
mechanic on charged hold). Both completed cleanly without recipe
extension — no schema changes were needed for the infusion handling.

---

## Tier B — synchronous, stance / multi-mode / multi-stage (16)

These need **multiple normal or multiple skill ability entries** in the
JSON, or some other multi-mode pattern that the base recipe doesn't cover.

**Automation status (2026-05-06):** Tier B is now eligible for autonomous
drafting via Opus 4.7 with `--effort high`, driven by
[`recipe-tier-b.md`](recipe-tier-b.md) and run via
[`scripts/run-tier-b.sh`](../../scripts/run-tier-b.sh). The Tier A
"don't draft autonomously" rule is **lifted** for Tier B targets that
match a documented pattern (stance, multi-stage skill chain, stack-gated
CA, multi-press placement). Mechanics still flagged as BLOCK-worthy:
multi-step state machines that gate N-token meaning historically — Lanyan
and Nilou were the canonical examples; both are now drafted (2026-05-07)
with documented schema-fit caveats — Nightsoul resource pools (any C tier
slipping through), and anything genuinely novel.

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

**Promoted from A.2 on 2026-05-06, completed via human-paired pass on 2026-05-07:**

| ID | gcsim name | Shape used |
|---|---|---|
| `lanyan` | `lanyan` | Cyno-shape multi-skill stance: in-stance N as `abilityType: "skill"` with `input: ["N"]` (truthful to gcsim's SkillState categorisation) + paired in-stance E variant for the E-fired ring follow-up. Brief 1.1s stance window. |
| `nilou` | `nilou` | Hybrid: in-stance N as a hydro-infused 3-hit normal chain (Sword Dance), in-stance E as 3 diluc-shape skill entries (Whirling Steps 1/2/3). Tranquility Aura summon authored on the base E with spawnsAt timed for the canonical "E E E E" rotation. Lunar Prayer state collapsed into the same `inStance` condition as Pirouette (caveat surfaced for E-disabled-during-Lunar-Prayer behaviour). |
| `shikanoin_heizou` | `heizou` | Declension stacks gate a 4th Fudou-style charged punch with different behavior |
| `yae_miko` | `yae_miko` | Sequential 3-press E places 3 Sesshou Sakura totems with stacking placement state |
| `yanfei` | `yanfei` | Scarlet Seals modify charged-attack stamina cost and damage; stack-conditional CA variant |

---

## Tier C — synchronous, complex mechanics (13)

Not strictly stance, but mechanics make accurate first-pass authoring
risky enough that autonomous drafting will produce work the human pass
mostly has to redo. Constructs, redirected damage, multi-element absorption,
Nightsoul economies, exotic resource systems.

| ID | gcsim name | Reason |
|---|---|---|
| `chasca` | `chasca` | Soulsniper bullet system absorbs party elements |
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

**Completed Tier C (2026-05-07):**

| ID | gcsim name | Shape used |
|---|---|---|
| `albedo` | `albedo` | Construct pattern: Solar Isotoma authored as `summons[0]` (30s, stationary, terminatesOn `recast`). Transient Blossom on-hit emission flagged for P3 (`Summon.effects[]`). A4 EM team buff modelled with `onCast` `ability: "burst"`. Removed C2 placeholder damage effect; C1/C2/C4/C6 flagged as blossom- or position-dependent. |
| `chiori` | `chiori` | Construct pattern: Tamoto authored as `summons[0]` (17.5s, stationary). Tamoto interval slashes flagged for P3. C6 +235% DEF flat normal damage modelled as `normalFlatDmg` scaling buff (Zhongli-shape). A1 Tailor-Made branching (Tapestry / Tailoring) and C2/C4 Kinu mechanics flagged. Hold E variant skipped — niche aim mode with sparse gcsim measurements. |

**Promoted from A.2 on 2026-05-06** (Natlan Nightsoul mechanics out of recipe scope):

| ID | gcsim name | Reason |
|---|---|---|
| `ororon` | `ororon` | Night Realm's Gift Nightsoul resource (80-point pool) + bullet-consumption mechanic |
| `yumemizuki_mizuki` | `mizuki` | Nightsoul Dream Drifter mode restricts actions (swap/dash/burst only); E re-press cancels |

---

## Re-classification policy

- A character can move from B/C to A if a synchronous pass establishes a
  recipe extension that handles their pattern reliably — update both the
  recipe and this file in the same PR.
- A character can move from A to B/C at any time if an autonomous draft
  comes back wrong in a way the recipe didn't anticipate; document the
  reason in this file.

## Calibration runs (historical — completed 2026-04-27)

The first three autonomous runs (`sucrose`, `mona`, `amber`) validated
that the recipe produced the right shape across catalyst, bow, and
multi-charge-skill cases. After they came back clean, A.1 was promoted to
scheduled runs and the rest of A.2 followed without re-calibration.
