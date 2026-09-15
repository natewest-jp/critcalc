# Essential characters — gap scoping, 2026-09-15

_The 65 characters people will use in these tools most: Prydwen's tier list through
T1.5 (16 at T0, 15 at T0.5, 12 at T1, 22 at T1.5), read on 2026-09-15. Ten Opus 5
scoping agents audited them in parallel — whole JSON, gcsim `ac2d76dde` source, the
committed curation reports, and a live `parseNotation` probe per character — and
their ten reports are reproduced verbatim in the appendix. This head is the
compilation: what repeats, what is cheap, what needs an engine round._

⚠️ **Provenance.** Everything in the appendix is an agent's reading. Items marked
**✔** below were re-verified in this session against source or by a probe; the rest
are agent-measured and should be re-measured at the site before they are written.
Nothing in this document is a change — it is the backlog.

---

## 0. The shape of it

- **Frames and applications are in good shape wherever gcsim main reaches** — and
  the agents found the two exceptions the audit cannot see (§1.E, §1.A).
- **The effects half is where the reports will come from.** The same six engine
  facts recur across all ten batches, and between them they explain most of the
  "my buff isn't drawn" class: `manual` triggers, self-defaulting reaction
  triggers, a silent plunge token, standing `state` gates that never resolve,
  cast-level ICD with no per-cast gate, and the stat-dedupe trap.
- **Roughly 60 items are data-only and authorable today**; §3 lists them by tier.
  **Nine engine rounds** would unblock most of the rest; §4 sizes each by the
  characters it frees.
- **Five characters have no oracle at all** (Lohen, Sandrone, Zibai, Alyosha,
  Linnea/Iansan/Nefer only on unmerged branches) and are honest stubs by policy;
  what can still be done for them is in §3.

---

## 1. Cross-cutting — the same defect on many characters

Ranked by reach. Each names the characters in scope that it touches.

**A. A cast's `application[]` always runs on the STANDARD ICD, and a no-Durability hit is not an `[icd]` suppression.** ✔ (`resolveActionIcd` has no per-cast gate; the frames-diff's `[icd]` mark cannot tell the two apart.)
Wrong because of it: Varka Q (`ICDTagNone`, applies twice, we draw one), Mizuki's Dreamdrifter cloud (`ICDGroupMizukiSkill` 72f/every-4), Arlecchino E (Cleave always applies, directive tick suppressed — we do the reverse), Chevreuse mines (own 180f group), Cyno's Duststalker bolts. Phantom pills from zero-Durability hits authored as entries: Flins tap-E (+ burst mid/final + `sQ` inheriting four), Emilie +62f, Wriothesley +160f, Navia +75/+105, Neuvillette +60, Escoffier +83, Lauma hE (inherits frame 16). → A `chargedIcdWindow`-shaped `icdGate` on `application[]`, a lint rule refusing entries with no `units` AND no durability source, and a corpus sweep.

**B. `manual` triggers reach NO planner surface but DO reach `deriveCapabilities`.** ✔ (69 files carry one.)
The Team Builder is claiming things the planner refuses to draw, and some of the values are fabricated (Wriothesley's `+50% ATK` on Icefang Rush has no source in game or gcsim). Characters where a `manual` effect is a real bar a user will look for: Columbina (12 effects — her whole Gravity system, incl. C6's +80% team CRIT DMG), Xiangling C6 (+15% Pyro team, also has no `duration`), Nahida C4, Furina A1, Chevreuse A4/C6, Shenhe A1/C2, Yae C4, Arlecchino C6, Clorinde A1/A4/C1/C6, Gaming (six), Mualani A4/C1, Emilie A4, Citlali C4 skull, Gorou C4 heal, Diona C6, Lyney A1/C2, Yelan C2, Bennett C4, Sucrose C6, Varka A1/C2. → One decision per effect: re-trigger (many are `onCast`-shaped today), or INERT-list with a reason so the TB stops deriving them. **Rubric N1 needs a sibling rule: the TB must ignore `manual` too.**

**C. `onReaction` with no `source` fires only off the HOLDER's reactions.** ✔ (`buffWindows.ts:274`; 20 effects across the corpus have no source.)
Wrong per kit text: Chevreuse A1 shred ("a character"), Citlali A1 + C2 shreds ("nearby party members"), Clorinde C2, Ororon's Hypersense (a proc, same default in `procs.ts`), and plausibly Lauma C? heal, Tighnari, Varka, Nilou (review the 20). Correct as self: Kazuha A4, Sucrose A1, the energy refunds. → `source: 'team'` per effect; consider making the lint demand an explicit `source` on every `onReaction`.

**D. A `P` token on a character with no `plungeFrames` emits NOTHING.** ✔ (`run.ts:1424`; **84 of 126** characters.) Zero time, no block, no application, no lint flag — indistinguishable from a typo, and it shifts every later action earlier. Two can take real frames from gcsim today (Furina, Xilonen — including her Nightsoul plunge — and Albedo, Bennett, Kazuha's press-E path). → Author where gcsim has them; for the rest, either the human-timing round's provisional strip or a `notationFlags` refusal like `W`. **Silent is the one option that misleads.**

**E. The frames audit compares `KEYS` only — never `anim` or `hit`.** ✔ (`gcsim-map.mjs:30`.) A pre-L4b stand-in (`anim === swap === hitmark`, no `hit`) passes as "matching". Found by hand: Nefer (every map), Linnea (normals), Iansan (normals + both charge anims), Cyno's in-stance N5 (`{anim:40,N:62}` → `{anim:62,hit:40}`), Kinich's base normals, Varesa's normals + plunge, Hu Tao's `plungeFrames` (hold LOW values), Kazuha's after-hold plunge, Nilou (E 21→22, WS1 31→33, WS3 61→63), Pyro Traveler hE (77→81), Furina CA (33→253, and `C` 47→253), Nahida CA (65→69), Gaming Q (66→77). → Add `anim` and `hit` to the compared set (one line), then re-run `migrate-frames-shape` for the affected characters. ⚠️ `drivers.json` gives Hu Tao's Paramita an EMPTY prereq; with `[{action:'skill'}]` four of her seven §2 rows vanish (agent-measured with the dumper).

**F. Sibling abilities that share `input` + `conditions` resolve to the FIRST; `abilityType:'skill'` with `input:['N']` is unreachable.** (`resolve.ts` matches by type only.)
Kinich: Scalespiker Cannon never resolves and Loop Shot is unreachable from `N` — his whole Nightsoul kit draws as a physical claymore (data fix: retype Loop Shot as a state-gated `normal`, the Mualani shape). Nilou: Whirling Steps 2 and 3 never resolve, so `E E E E` is three WS1s and the Water Wheel never appears (needs a chain-step condition). Lan Yan has the same shape. Also: **§2 rows for Nilou WS2/WS3 and Flins's burst are ORACLE ARTEFACTS** of this — ⛔ don't migrate them.

**G. Standing `state` gates render optimistically** (`evalCondition` returns null for an unlisted state; 88 conditions across 36 characters) — Durin's form-gated shreds, Lohen A4, Varesa A1 tiers, Xilonen's burst heal (`teamElementCount` is not carried into the summon-tick projection while `teamFaction` IS — Aino's cadence proves the plumbing exists). → Carry the resolved states and element counts the parse already knows into the buff and tick projections.

**H. The self/active buff pool dedupes by `stat` BEFORE evaluating conditions** — tiered effects on one stat collapse to the first tier: Neuvillette A1 (three tiers, none draws), Navia A4, Varesa A1 (only the weaker tier ever prints). Third recorded occurrence of the trap CLAUDE.md names.

**I. `constellationScaling` has no display reader** — Illuga's Lightkeeper's Oath prints C0 numbers at C6, Skirk's SS cap, Linnea C1, Varesa C1.

**J. Heal + damage on one cadence draw DUPLICATE tick markers** (the open L5e bug) — Diona (12 for 6), Mizuki (16 for 8), Alyosha (three-deep: 27 for 9), Gorou's C4 would join. → Needs the corpus measurement the memory note asks for, then a dedupe at the projection.

**K. A normal's application lands at its CANCEL-resolved end, never at `frames.hit`** — harmless where the two coincide, severe on Mualani's Sharky's Bite (17f hit vs 109/215f cancels: Hydro 1.5–3.3s late on every bite) and Varesa's CA.

**L. Nobody has a stance-CANCEL token** — Varesa's plunge exit, Mualani's E re-press, Jahoda's Q inside Shadow Pursuit, Ifa's landing, Xilonen's re-press. One primitive, five characters.

**M. A summon cannot terminate on a DIFFERENT cast** — Mavuika's ring dies on Q (we keep applying Pyro after it), Gorou's banner dies on Q (both draw), Emilie's E case is stowed by Q. `terminatesOn` is `swap | recast` only.

**N. `cdReset` never walks `char.abilities`** — Arlecchino's burst clears All Is Ash (her canonical rotation is ~28s wrong on the second E); Freminet.

**O. Report hygiene.** `capability-audit.md`, `capability-sweep.md` and `data-outliers.md` were last regenerated 2026-08-31 (Odette still an "uncurated stub", Furina's fixed zero-buffs still listed, Cryo Traveler's cadence still open); `drivers.json` Hu Tao row; frames-diff artefact rows (Flins burst, Nilou WS2/3, Durin dark burst tail, Yelan `chargeHits` pairing off by one); rubric N12 stale (`lunarBloom`/`lunarCharged`/`stellarSwirl` ARE emitted); rubric P4 stale (tick-extended bars shipped 2026-08-31); several curator notes claim closed blockers (Mualani's "no CD-starts-at-stance-end field", Ineffa C6 "lunarCharged never emitted", Jahoda's cooldown claim, Chiori's C2 blocker, Mizuki's Swirl-bonus blocker).

**P. Bow aimed shots are `ICDTagNone` in gcsim for 16 of 20 bows** (agent census) while ours ride the standard charged clock — Fischl and Lyney lose an application per double shot. A corpus question, not a per-character fix.

---

## 2. Per character — headline and the cheapest real fix

| id                | tier | headline (S = wrong on screen in a common rotation)                                                                                         | cheapest real fix                                                                                                  |
| ----------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| mavuika           | T0   | Tap-E ring smuggled into `application[]`: no bar, 4 of 7 Pyro survive the cast ICD, and it keeps applying after Q deletes it                | Ring as a summon (`activeDuration` + `summonTick {2s, none}`), trim the list; Q-terminate is engine (§1.M)         |
| nefer             | T0   | Every FrameMap pre-L4b; no `application[]`; two E charges stack two stance bars                                                             | Re-shape frames from her own notes + author both lists (numbers are in the file)                                   |
| sandrone          | T0   | Empty timeline for a T0 carry: 6s hovermech drawn as an instant, no Fagio lane                                                              | `behavior: stance, duration: 6` from kit text; restore the Fagio caveat                                            |
| zibai             | T0   | In-mode Geo normals resolve Physical → 1 Lunar-Crystallize where an infused sibling normal gives 5 (measured)                               | State-gated normal with `infusion: 'geo'` (the Durin shape)                                                        |
| columbina         | T0   | 12 `manual` effects — her whole Gravity system, C6 team CRIT DMG included — draw nothing                                                    | Decision on an `onReaction`+`procCooldown` approximation (Nate's), else restore the caveats                        |
| ineffa            | T0   | `E → Q` draws two Birgittas and doubles her Electro feed                                                                                    | `terminatesOn: 'recast'` on both Birgittas (verified in a scratch mutation); C2 burst shield is authorable         |
| linnea            | T0   | Burst applies a phantom Geo (gcsim's burst deals no damage); Lumi is a 25s bar with no ticks and the cadence IS constant without Moondrifts | `application: []` on Q; Lumi series 111f from the unmerged branch (precedent: Illuga)                              |
| odette            | T0   | Solid after Stage 4; the Coda restarts the Dance Double and we keep the old phase                                                           | Engine (lineup-change precedent); narrow the Coda's re-grant of Splendor                                           |
| yae_miko          | T0   | C2's EM bar left at 14s against the new 24s totem; Tenko thunderbolts apply no Electro; C4 draws nothing                                    | C2 `duration: 24` (one number); the rest is engine                                                                 |
| chevreuse         | T0   | **Zero windows of any kind** in her canonical team: A1 shred is self-only, A4 has no value, C6 `manual`                                     | `source: 'team'` on A1; author A4 (`scaling hp ratio 0.1 cap 40`, team)                                            |
| citlali           | T0   | Itzpapa under-applies ~30% on the wrong ICD; shreds self-only; C6 Cifra has no bar                                                          | `icdGate {90, every 2}`; `source: 'team'` ×4                                                                       |
| iansan            | T0   | Her Nightsoul Charged Attack applies no Electro; both casts apply at frame 0                                                                | E/Q `application[]` from the unmerged branch (21/34); CA infusion needs a CA-scoped field                          |
| lauma             | T0   | Burst draws nothing (18 Pale Hymn stacks); `C` authored with the deer-transform frames                                                      | `activeDuration: 15` on Q; re-author `chargeFrames`; `hE` application at 45                                        |
| mona              | T0   | Solid; bubble explosion's 2U Hydro drawn ~8s late, uncaveated                                                                               | One caveat sentence                                                                                                |
| nicole            | T0   | Best-covered file in T0; residue is `maxProcs`-shaped                                                                                       | Nothing cheap                                                                                                      |
| sucrose           | T0   | Solid; C6 `manual` makes TB and planner disagree at C6                                                                                      | Blocked on absorption; note the 10s C6 duration                                                                    |
| cyno              | T0.5 | Burst's +100 EM self-buff unauthored; in-stance N5 FrameMap inverted                                                                        | Author the EM buff; `{anim:62, hit:40}`; C2's stack shape                                                          |
| flins             | T0.5 | Three over-authored application lists manufacture phantom Electro — and phantom Lunar-Charged, Thunderclouds                                | Tap-E `[]`, burst → one entry, `sQ` `[]`                                                                           |
| skirk             | T0.5 | E cooldown starts at cast not stance exit; stance drawn at its 12.57s max where SS depletion ends it at ~6.4s; swap zeroes the SS pool      | `cooldownStartsAtStanceEnd: true`; the rest is the E3 drain round                                                  |
| traveler_cryo     | T0.5 | Two crystal series doubled the gauge feed — **fixed today (`4b18535e`)**                                                                    | Radiance-window round scoped in `docs/radiance-window-round.md`                                                    |
| varka             | T0.5 | Sturm und Drang swings apply nothing (his identity); burst applies once where `ICDTagNone` gives two                                        | State-gated in-stance normal with `infusion: 'anemo'`; Four Winds as a sibling skill (`cooldown 11, charges 2`)    |
| wriothesley       | T0.5 | A fabricated `+50% ATK` shipped in the TB index; A4 authors nothing                                                                         | Delete the effect, regenerate the index; an honest stance-long A4 bar                                              |
| yumemizuki_mizuki | T0.5 | Witch's Revelation passive (Vast Be the Dream) missing entirely; her EM-scaled Swirl bonus draws nothing on a stale blocker                 | Author the passive's team EM buff; add a `swirlReactionBonus` Stat member; C2 as four `scaling` buffs              |
| durin             | T0.5 | Solid; White commit has no `application[]`                                                                                                  | `[{frame:35, pyro, 1U}]`                                                                                           |
| escoffier         | T0.5 | Cooking Mek ticks fed to the gauge TWICE (summon series + smuggled list), 18f out of phase, wrong ICD group                                 | Trim `application[]`; `firstTickDelay 2.167`; `icdGate {90, every 6}`; A4 trigger `['skill','burst']`              |
| fischl            | T0.5 | Oz well modelled; every tick 10f early (missing travel); burst Oz hard-coded to the swap-cancel spawn; C1/A1 unauthorable                   | `firstTickDelay` +10f on both Ozes; Hexerei gate on `duringSummon`                                                 |
| alyosha           | T0.5 | No gcsim anywhere; both casts apply at frame 0; Tugarin draws every marker three times                                                      | Blocked (oracle) / §1.J                                                                                            |
| bennett           | T0.5 | The most-read bar in the tool ends ~2.6s early (126f re-applied per tick → runs to 14.67s)                                                  | ATK/C6 windows 12 → ~14.1 (Nate's call); `tickCap: 12`; in-field `h2E` variant; three `cooldownStartDelay`s        |
| illuga            | T0.5 | Nightingale's Song unmodelled (can END the 20s window early); `constellationScaling` prints C0 at C6                                        | Stack pool authorable; reader fix (§1.I)                                                                           |
| prune             | T0.5 | Stage 4 exact; the Clang Clang recast (frames, element, 6s window, CD bypass — all in gcsim now) has no token                               | Engine: a reaction-opened transient state                                                                          |
| qiqi              | T0.5 | Applications exact; Herald's 9 swipes and the Talisman's per-second heal draw no ticks; no off-field-DMG facet                              | A1 incoming-healing buff if a Stat exists; the rest engine                                                         |
| arlecchino        | T1   | Burst doesn't reset All Is Ash (§1.N); Masque's Pyro infusion unauthored so six swings apply nothing                                        | `infusion: 'pyro'` + caveat; `units: 1` at 338f; C6 → `onCast skill`                                               |
| kinich            | T1   | Cannon and Loop Shot unreachable from notation (§1.F)                                                                                       | Retype Loop Shot as a state-gated normal; author both lists; `durationExtensions +1.7` on Q                        |
| lohen             | T1   | Honest stub, no oracle; A4's wrong-row caveat was removed                                                                                   | Restore the A4 caveat                                                                                              |
| mualani           | T1   | Skill CD starts at cast instead of stance end — the note claiming no field exists is stale; bite Hydro 1.5–3.3s late (§1.K)                 | `cooldownStartsAtStanceEnd: true`; caveat the 6s stance                                                            |
| varesa            | T1   | `sQ` waits out the 18s burst CD and resolves as the BASE burst; Kablam's Electro lands after its own block                                  | `bypassesCooldown: true`; `application [{42, electro, 1U}]`; `consumes: ['apexDrive']` on E                        |
| albedo            | T1   | Solid; the burst's 7 Fatal Blossoms are missing and §4 structurally cannot see it (empty-core dump)                                         | Extend the burst list (7 × +5f from 145); plunge maps                                                              |
| furina            | T1   | Most complete in T1; CA `anim` 33 → 253 (it is the Arkhe toggle now); A1 overheal-heal is `manual`                                          | Fix the CA map; C4 energy for TB parity                                                                            |
| ororon            | T1   | **Hypersense never fires** — no `application[]`, no `armedFor`, passive-hosted, `source` self                                               | Move to the skill: `armedFor 15`, `application [{12, electro, 1U}]`, `source: 'team'`                              |
| aino              | T1   | Exemplary conditional cadence; C1 grants Aino +80 EM twice                                                                                  | Team arm → `target: 'active'`                                                                                      |
| faruzan           | T1   | Her two signature bars are ~4.2s SHORT at every constellation (pulsed 240f re-application); A1 vortex unauthored                            | 12 → 16 / 18 → 22 on buff + shred; `C: 61` on Q                                                                    |
| nahida            | T1   | Shrine of Maya 15s in every team; a Hydro team gives 21–24s; C4 `manual`                                                                    | Summon `durationModifiers` +6.02 / +9.03 on Hydro count; C4 → `onCast skill, 25s`                                  |
| xilonen           | T1   | Frames exact; burst heal gate unresolvable so 8 heal ticks draw in every team; no plunge maps (three sets in gcsim)                         | §1.G; author the plunges; C2's permanent Geo shred as a C2 twin                                                    |
| clorinde          | T1.5 | Frames/applications clean; every passive + constellation reaches no surface                                                                 | C6 → `onCast skill, 12s`; `source: 'team'` on C2; add `stellarConduct`                                             |
| gaming            | T1.5 | Cloudstrider applies no Pyro; Man Chai's E-CD reset unmodelled; zero windows at C6                                                          | Plunge variant/infusion; Q `anim` 77; burst heal type/number                                                       |
| hu_tao            | T1.5 | Blood Blossom unmodelled (2 off-field Pyro per Paramita CA); `plungeFrames` hold LOW values; 4 of 7 §2 rows are driver artefacts            | Fix both plunge maps + base charge keys; `drivers.json` Hu Tao row                                                 |
| klee              | T1.5 | C6's team Pyro bar never renders — `onCast.ability` carries an ability NAME (the corpus's only illegal value) ✔                             | `ability: 'burst'`; burst summon needs a tick series                                                               |
| lyney             | T1.5 | The Prop Arrow's Hat and its +377f strike don't exist in the data; aimed shots wrongly ICD-gated; `chargeHits` shifted one step             | `noICD` on the normal; re-slot `chargeHits`                                                                        |
| navia             | T1.5 | A1's 4s Geo infusion unauthored → her normal string applies nothing (the Cryo-Traveler lesson)                                              | `infuse self onCast skill 4s geo`                                                                                  |
| neuvillette       | T1.5 | Equitable Judgment drawn as 74f/1 application vs ~6.4s/4 (frames are a closure artefact); A1's three tiers collide on one stat (§1.H)       | Author EJ from source (`anim 87` short CA + the 8-hit list)                                                        |
| venti             | T1.5 | Absorption unmodelled and uncaveated; C6's second shred draws nameless on every burst                                                       | Caveat; gate on absorption is engine                                                                               |
| beidou            | T1.5 | No `hE` variant, so the parry, A4 and Polaris are unreachable; TB still claims a shield                                                     | `hE` variant (gcsim shares the slice); C1 shield target check                                                      |
| chiori            | T1.5 | A1's DEFAULT branch — a 5s Geo infusion after every E — is unauthored and authorable                                                        | `infuse` effect; C2 Kinu as a burst series (`3s`, `icdGate {114}`)                                                 |
| emilie            | T1.5 | Phantom Dendro pip on every E (Spiritbreath Thorn is Durability 0); burst neither stows the E case nor leaves the 22s one behind            | Delete the +62 entry; second summon on Q; C4 `durationModifiers`                                                   |
| xiangling         | T1.5 | Everything measured is exact; C6 party Pyro is `manual` with no duration                                                                    | `onCast burst, team, 10s` + C4 modifier; two missing `units`                                                       |
| xingqiu           | T1.5 | C2's shred fires off the wrong casts and shows 4s of an 18s burst                                                                           | `abilityType: 'burst'` (partial); waves→onHit is engine                                                            |
| yelan             | T1.5 | Exquisite Throw's Lifeline trigger, C2, C6 unmodelled; `chargeHits[1]` carries the Barb's frames                                            | `chargeHits[1]` → 96/86; C2 as a second proc (`procCooldown 1.8, icdGate none`)                                    |
| diona             | T1.5 | Frames/cadence exact; 12 markers for 6 Mist ticks (§1.J); C2 + C6 reach nothing                                                             | C2 splash shield authorable                                                                                        |
| gorou             | T1.5 | C4's heal is `manual`; banner and Glory render as two overlapping fields the game never lets coexist                                        | C4 heal as a Glory `summonTick` (mind §1.J); caveat                                                                |
| jahoda            | T1.5 | Re-migration clean; E cooldown runs from the cast where gcsim runs it from stance end — a note claims otherwise                             | `cooldownStartsAtStanceEnd: true`; fix two flask numbers in notes                                                  |
| kaedehara_kazuha  | T1.5 | Best-curated in T1.5; glide-cancel unmodelled; both plunge-after-E paths wrong; C2 never buffs Kazuha himself                               | After-hold plunge `anim 61`; press-E plunge variant `{55, D 43, J 50, swap 50}`; C2 `self` twin; Q `duration 8.78` |
| nilou             | T1.5 | Pirouette draws 12s/18s instead of 10 because a stance reads its summon's duration; WS2/WS3 never resolve; the aura feeds the gauge nothing | WS2/WS3 frames 29/43 + `units`; three `anim`s; the rest engine                                                     |
| shenhe            | T1.5 | Quill model matches the September fixes; A4 unauthored, A1 + C2 `manual` — three team buffs draw no bar                                     | A4 press/hold split on base + `hE`; A1 and C2 → `onCast burst, active, 12s`; Quill as the five `*FlatDmg`          |
| traveler_pyro     | T1.5 | **Every passive and constellation name AND mechanic is wrong** (the July sweep found it, never actioned)                                    | Full re-ingest of the passive/constellation block; hE `anim 81`                                                    |
| zhongli           | T1.5 | C2's burst Jade Shield unauthored (now trivially authorable); Petrification window never drawn                                              | C2 shield (`trigger.ability: 'burst'`); `activeDuration: 4` on Q; stele `spawnsAt 24`                              |

---

## 3. Authorable today — the data-only backlog, by tier

No engine work; every item names its source. Order within a tier is by how often
the pixel is on screen. ⚠️ Re-measure each at the site before writing it, and run
the affected character through `parseNotation` after.

**T0**

1. Chevreuse A1 `source: 'team'`; author A4 (`buff team atk% scaling hp ratio 0.1 cap 40`, 30s; gate on an Overcharged Ball via `gainStacks`/`consumeStacks`). 2. Citlali `icdGate {timer 90, every 2}` on Itzpapa; `source: 'team'` ×4; C4 skull as an onHit proc (`procCooldown 8`, 1U). 3. Ineffa `terminatesOn: 'recast'` ×2; C2 burst shield (`trigger.ability: 'burst'`, 37f, 20s). 4. Mavuika ring → summon + trimmed list. 5. Yae C2 `duration: 24`; retire A4's dead effect. 6. Zibai state-gated `infusion: 'geo'` normal. 7. Lauma Q `activeDuration 15`; CA frames; `hE` application; C4 energy. 8. Linnea Q `application: []`; Lumi 111f series from the branch; normal `{anim,hit}` re-shape. 9. Iansan E/Q applications (21/34); normal + charge anims; A1 `onHit charged` below C2. 10. Nefer frames re-shape + applications + C4 caveat. 11. Sandrone E stance 6s; C1 caveat wording (Stellar Glimmer); Fagio caveat. 12. Odette: exclude the Coda from Splendor grants; note C4's 0U. 13. Mona explosion caveat. 14. Columbina: restore C1/C2/C6 caveats unless the approximation is taken.

**T0.5**

1. Flins three application trims. 2. Cyno burst +100 EM; stance N5 `{anim 62, hit 40}`; C2 stack shape; A1 bolt caveat. 3. Skirk `cooldownStartsAtStanceEnd`; two stale numbers. 4. Varka in-stance Anemo normal; Four Winds sibling skill; A1 → `passive`; A4/C6 `perStack` via a swirl `gainStacks`. 5. Wriothesley delete the phantom `+50% ATK` (+ index); A4 stance bar; scope C1/C4/C6. 6. Mizuki: Vast Be the Dream passive (team EM `scaling em ratio 10`, state-gated); `swirlReactionBonus` Stat + the Dreamdrifter buff; C2 ×4. 7. Escoffier: trim list, `firstTickDelay 2.167`, `icdGate {90, every 6}`, A4 `['skill','burst']`, `flat` on the burst heal, the 5/10/15/55 ladder as tier effects. 8. Bennett windows 12 → ~14.1 (Nate), `tickCap 12`, in-field `h2E` variant, three `cooldownStartDelay`s, plunge maps. 9. Fischl Oz `firstTickDelay` +10f ×2; Hexerei `duringSummon` gate. 10. Durin White commit `[{35, pyro, 1U}]`. 11. Prune A1 `procCooldown 1.2`; C2 window 13.6/17.6s. 12. Qiqi A1 if an incoming-healing Stat exists; C2 base half (`enemyAffectedBy cryo`). 13. Illuga Nightingale stack pool (`gainStacks` 21 on Q, `consumeStacks source others filter geo`).

**T1**

1. Ororon Hypersense as a cast-armed proc (`armedFor 15`, `[{12, electro, 1U}]`, `source: 'team'`). 2. Varesa `bypassesCooldown`, Kablam application, `consumes: ['apexDrive']`, `fiery_passion_rush` application at 2, normal anims. 3. Faruzan durations 16/22; `C: 61`. 4. Nahida summon `durationModifiers` on Hydro count; C4 re-trigger; CA `anim 69, Q 64`; INERT-list C2's crits. 5. Kinich Loop Shot retype; both applications (30/38, 48); normals `{anim,hit}`; Q `durationExtensions +1.7`; A4 `gainStacks` on `onTeamNightsoulBurst`. 6. Arlecchino `infusion: 'pyro'` + caveat; 338f `units`; C6 re-trigger; delete the stale C6 note. 7. Mualani `cooldownStartsAtStanceEnd`; stance + in-stance CA caveats; retire two `manual` skeletons. 8. Albedo 7 Fatal Blossoms; plunge maps; Silver-Isotoma caveat. 9. Furina CA map; C4 energy. 10. Xilonen three plunge maps; C2 Geo-shred twin; C1 stance caveat; burst heal-mode variant. 11. Aino C1 team arm → `active`. 12. Lohen A4 caveat.

**T1.5**

1. Klee C6 `ability: 'burst'`. 2. Emilie delete +62; burst second summon (22s, 14 ticks, `firstTickDelay ~1.6`); C4 `durationModifiers`; C6 `infuse`. 3. Xiangling C6 re-trigger with the Pyronado's duration; two `units`. 4. Navia A1 `infuse`; Shrapnel `gainStacks` on `hydroCrystallize`/`lunarCrystallize`. 5. Shenhe A4/A1/C2; Quill on all five `*FlatDmg` (check merge). 6. Zhongli C2 shield; Q `activeDuration 4`; stele `spawnsAt 24`; press `cooldownStartDelay 22`; hold-E 2nd entry `units 2`. 7. Traveler Pyro passive/constellation re-ingest; hE `anim 81`. 8. Jahoda `cooldownStartsAtStanceEnd`; note fixes; provenance lines to E/Q. 9. Kazuha plunge maps (after-hold `anim 61`, press-E variant); C2 `self` twin; Q `duration 8.78`. 10. Nilou WS2/WS3 frames 29/43 + `units`; three `anim`s. 11. Chiori A1 `infuse` (5s geo); C2 Kinu series; A4's C1 branch; `hE` variant; 17.0 vs 17.5 check. 12. Yelan `chargeHits[1]` 96/86; C2 proc; C4 caveat. 13. Hu Tao plunge maps + base charge keys; Paramita N6 `hit 27`; `drivers.json` row. 14. Lyney `noICD`; re-slot `chargeHits`. 15. Neuvillette EJ frames + list; C1 free stack. 16. Clorinde C6; C2 source + `stellarConduct`. 17. Gaming Q `anim 77`; burst heal 30%. 18. Beidou `hE`; C1 shield target. 19. Gorou C4 heal series; banner/Glory + C6 caveats. 20. Diona C2 splash shield. 21. Venti absorption caveat. 22. Xingqiu C2 `abilityType: 'burst'`; C6 note.

---

## 4. Engine rounds this would need, sized by what each frees

| round                                                                                                                                     | frees                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Per-cast ICD gate on `application[]` + Durability-0 lint (§1.A)                                                                           | Varka Q, Mizuki cloud, Arlecchino E, Chevreuse mines, Cyno bolts; retires ~10 phantom pills             |
| `manual` reaches the TB — decide, then INERT-list or re-trigger (§1.B)                                                                    | 69 files; Columbina's kit, Wriothesley's fabrication, every TB over-claim                               |
| Plunge policy: refuse or provisional strip (§1.D)                                                                                         | 84 characters' `P`                                                                                      |
| Audit compares `anim`/`hit` (§1.E)                                                                                                        | ~15 stand-in maps found by hand; the rest of the corpus unknown                                         |
| Resolved states + element counts into the buff/tick projections (§1.G)                                                                    | Durin, Lohen, Varesa, Xilonen heal, 88 conditions                                                       |
| Conditions before stat-dedupe (§1.H)                                                                                                      | Neuvillette A1, Navia A4, Varesa A1                                                                     |
| `constellationScaling` display reader (§1.I)                                                                                              | Illuga, Skirk, Linnea, Varesa                                                                           |
| Duplicate-marker dedupe after a measurement (§1.J)                                                                                        | Diona, Mizuki, Alyosha, Gorou C4                                                                        |
| Summon terminates on another cast (§1.M) / stance-cancel token (§1.L) / `cdReset` on abilities (§1.N) / normal hit at `frames.hit` (§1.K) | Mavuika, Gorou, Emilie / Varesa, Mualani, Jahoda, Ifa, Xilonen / Arlecchino, Freminet / Mualani, Varesa |
| Chain-step condition (§1.F)                                                                                                               | Nilou WS2/WS3, Kinich Cannon ordering                                                                   |
| Radiance as a window                                                                                                                      | Cryo Traveler (scoped in `docs/radiance-window-round.md`), then nine holders                            |
| `swirlReactionBonus` + reaction-CRIT Stat families                                                                                        | Mizuki; Lauma A1                                                                                        |

---

## 5. Corrections and things the agents settled

- **Cryo Traveler's double-counted crystals** (batch 4) — ✔ confirmed in `aura.ts` (counter keyed per series) and fixed in `4b18535e`: one series, `gainStacks.amount: 2`.
- **Illuga's Moonsign `min: 2`** (batch 5) — resolved in favour of the current authoring: every Moonsign member contributes exactly 1 in gcsim and our count includes the holder.
- **Illuga C1's reaction list** is more correct than gcsim's (the PR duplicates one crystallize and omits Pyro) — ⛔ don't "fix" toward the oracle.
- **Shenhe's quills already match the September gcsim fixes** — no change there.
- **Hu Tao's `terminatesOnSwap: true`** is correct; four of her seven §2 rows are driver artefacts.
- **Xingqiu's Orbital, Nicole's Projections, Nahida's Electro interval, Zhongli's `standard` tick gate** — all closed by prior decisions; the agents re-derived the reasons and agree. ⛔ Don't re-file.
- **Batch 3's Flins §2 row and batch 10's Nilou WS2/WS3 rows are oracle artefacts** — a migration run would corrupt correct maps. Add a suppression or a note at the rows before the next `migrate-frames-shape` pass.

---

## Appendix — the ten batch reports, verbatim

---

<!-- batch 1 -->

## Batch 1 — data-gap scoping (mavuika, nefer, sandrone, zibai, columbina, ineffa)

_All six are Prydwen T0. Audited 2026-09-15 against gcsim `ac2d76dde` (main), the committed
curation reports, and live `parseNotation` probes (scratch scripts written, run, and deleted)._

Method note: every "measured" line below is a real `parseNotation` run. Candidate fixes marked
**verified in a scratch mutation** were applied to an in-memory clone of the character JSON and
re-parsed — no repository file was modified.

---

### mavuika (Mavuika) — T0

**Status:** curated ✓ · frames from **gcsim main**, complete and byte-matching (no §2/§3 rows in
`gcsim-frames-diff.md`) · `application[]` on tap E (7 entries), hold E (1), Q (1), all with `units`
· gcsim coverage is full (`internal/characters/mavuika/`, 11 files).

**Gaps**

- **[S] The Ring of Searing Radiance is not a summon — its six Pyro pulses are smuggled into the
  SKILL's `application[]`, and the cast's ICD counter then eats three of them.**
  Evidence: `mavuika.json:132-140` authors `+16 / +120 / +240 / … / +720` on the tap E, which is the
  cast hit plus six ring ticks at gcsim's 2 s cadence (`~/Code/gcsim/internal/characters/mavuika/skill.go:285-315`,
  `skillRingTask`, `2*60` re-queue). `gcsim-frames-diff.md:324` flags it verbatim:
  `⚠️ regular, no authored summon: Rings of Searing Radiance ×6/120f`.
  Two consequences, both measured. (a) There is **no summon bar and no tick markers** after a tap E —
  six Pyro marks appear in the aura lane out to 12 s with nothing on the chart to explain them.
  (b) A cast's own hits share ONE ICD counter, so `Mavuika E` at C0 applies Pyro at
  **0.27 / 4.00 / 8.00 / 12.00 s — four of the seven gcsim applies** (the ring is `ICDTagNone`,
  skill.go:296, so every tick lands).
  Fix: `activeDuration` on the tap E + a real `summons[]` entry with
  `summonTick { interval: 2, firstTickDelay: 2, icdGate: 'none' }`, and trim `application[]` back to
  `[{ frame: 16 }]`. **Verified in a scratch mutation:** bar `0.27→12.27 s`, 5 tick markers,
  6 applications. **Authorable today** — `activeDuration`, `icdGate` and the summon-tick pipeline all
  exist.

- **[S] The ring keeps applying Pyro after the Burst, and `E → Q` is the canonical opener.**
  gcsim's `Burst()` calls `enterBike()` (`burst.go:60`) and `skillRingTask` returns immediately once
  `armamentState != ring` (`skill.go:286-290`) — the ring is gone the instant Q is pressed. We keep the
  whole schedule: measured `Mavuika E Q` at C0 applies Pyro at **4.00 / 8.00 / 12.00 s** from an entity
  the game deleted at 0.30 s.
  Fix: needs **engine work** — a summon that ends on a BURST cast. `Summon.terminatesOn` is
  `'swap' | 'recast'` only (`src/lib/types/ability.ts:1105`).

- **[A] Tap E opens no Nightsoul window at all, so every `state: nightsoulBlessing` gate is dead after a tap.**
  gcsim calls `enterNightsoulOrRegenerate(MaxPoints)` on EVERY press, tap included (`skill.go:117`).
  We author tap as `behavior: 'instant'` with no state (`mavuika.json:100`), so at C2 the +200 Base ATK
  and the three FlatDmg buffs (`mavuika.json:240-304`, all gated on that state) never engage after a
  tap, and no window is drawn where the game gives one (~12.3 s at C0).
  Fix: partly authorable (`activeDuration` + a state), but distinguishing ring-state from bike-state
  inside Nightsoul is the multi-state primitive the curator note already names — **engine work**.

- **[A] C2's Ring-form −20% DEF shred is unmodelled, and the C2↔C6 asymmetry is now undisclosed.**
  gcsim `cons.go:63-82` re-queues a `DefMod -0.2` every 18 f while `isRingFollowing()`; below C6 that
  means ring form (`cons.go:129-134`). Measured at C6 our timeline **does** draw a −20 % DEF bar after
  a tap E (`Mavuika E Q` → `resShred:def=-20` 0→9 s); at C2 it draws none. The caveat that covered this
  was deleted 2026-08-19 — the note quoting it survives at `mavuika.json:310` and categorises it
  "expected-but-absent", which is the correct reading.
  Fix: blocked on the same ring-state primitive; **the caveat is restorable today**.

- **[A] C1's +40 % ATK is unauthored, and C1's Nightsoul window length is a drawn-bar lie.**
  gcsim `c1OnFightingSpirit` (`cons.go:34-43`) refreshes a 10 s +40 % ATK on **every** Fighting-Spirit
  gain — i.e. continuously in any real rotation. No "on FS gain" trigger exists. Separately, the hold-E
  stance bar is a flat 9 s for every reader while a C1 owner's Flamestrider is ~13 s (max NS 80→120,
  `cons.go:19-25`) — named in `docs/curation/caveat-open-items.md:21` as a _trim_ item still unapplied.
  Fix: the ATK buff needs an engine trigger; the C1 window needs a constellation-conditional `duration`.

- **[B] C6's `input: ['hE']` filter is ignored for resShred**, so the 9 s DEF-shred bar draws after a
  tap E too (`engine-capability-rubric.md:137`, `:292`). The curator note calls this acceptable and at
  C6 it is — but the _duration_ is the hold window's 9 s where the tap ring lives ~12 s.

- **[B] `tags: ["summon"]` on a skill with no `summons[]`** (`mavuika.json:104`) — the tag claims an
  entity the data does not carry. It does not currently mint a false Team Builder capability (her index
  `caps` carry no `offFieldDamage`), but it is a lie in the data.

- **[B] C4 unauthored** (removes A4's 20 s decay, adds +10 %): at C4 the A4 bar still draws a gradient
  decaying to 0 where the game holds it flat. This one HAS a pixel — the gradient — and it _is_
  disclosed on the A4 caveat (`mavuika.json:212`). Correct as-is.

**Improvements:** frames are byte-identical to gcsim and `units` is present everywhere — nothing to
tighten there. Two caveats worth restoring (the C2 ring shred; the tap-E ring having no bar).
Retiring the smuggled `application[]` in favour of a real summon would also let the aura LOG name the
ring, which it currently cannot.

**Confidence: high.** gcsim main is complete for her, and every claim above is either a gcsim line or
a probe measurement.

---

### nefer (Nefer) — T0

**Status:** `curated: true` but **frames come from an unmerged gcsim PR** — she has no gcsim main
directory and all seven of her maps are listed under "no gcsim source" in
`gcsim-frames-diff.md:18` / `:91`, so nothing here can be oracled. **No `application[]` anywhere**;
both casts fire one provisional Dendro at the cast instant. Declares `enablesReactions: ["lunarBloom"]`
(verified working: `Nefer E Q N4 > Xingqiu E Q` emits `bloom` + `lunarBloom` and spawns Dendro Cores).

**Gaps**

- **[S] Every FrameMap is in the pre-L4b shape: `anim` holds the HITMARK and `hit` is absent.**
  Skill: `{ anim: 25, …, swap: 25 }` (`nefer.json:102-109`) while her own note records
  `skillFrames = InitAbilSlice(52)` (`nefer.json:119`). Burst: `{ anim: 118, …, swap: 118 }`
  (`nefer.json:131-138`) while the note records `burstAnimationLength = 131` (`nefer.json:147`).
  `anim === swap` is the stand-in marker, and `anim` is the fallback for every unlisted key
  (`src/lib/utils/frames.ts`, `frameAt`), so E→P / E→walk are understated by 27 f and Q→P by 13 f.
  Her four normals are the same shape — `anim == swap == hitmark`, no `hit` key
  (`nefer.json:20-56`). ⚠️ The swing hit times currently come out **right only by coincidence**,
  because `hit` falls back to `anim` and `anim` happens to hold the hitmark: ⛔ correcting `anim`
  without adding `hit` in the same edit would break every swing time.
  Fix: **authorable today** from the numbers already in her own notes plus the PR.

- **[A] No `application[]` on E or Q, and the burst is two hits.** Her note records burst hitmarks
  `[26, 46]` and skill hitmark `24 f` (`nefer.json:116`, `:144`). Measured `Nefer E Q` →
  `0.00:dendro? 0.63:dendro?` — both at the cast instant, both flagged provisional, and the burst's
  second Dendro application is missing entirely. Fix: authorable from the PR's hitmarks.

- **[A] Phantasm Performance — the Shadow-Dance Charged Attack — is not a variant.** It is the reason
  to play her: 5 sub-hits at charge-relative `[10, 15, 23, 24, 25]`, three of them Lunar-Bloom
  (`nefer.json:73`). Today every `C` typed inside her 9 s stance draws the basic 28 f catalyst CA with
  one Dendro application. Named in `caveat-open-items.md:44`; disclosed on the normal's caveat
  (`nefer.json:66`) ✓. Blocked on the **Verdant Dew** resource, which has no primitive — correctly
  refused.

- **[A] Two E charges → two overlapping stance bars and two overlapping shred bars.**
  Measured `Nefer E E Q`: `inStance` windows at `0.00→9.00` **and** `0.42→9.42`, plus C4 shred windows
  `0.00→13.50` and `0.42→13.92`. In game a second cast _refreshes_ Shadow Dance. She ships
  `charges: 2` (`nefer.json:112`), so `E E` is her normal opener — this is not an edge case.
  Fix: stance re-entry should refresh rather than stack — **engine work**.

- **[B] C4's shred is a flat 13.5 s window from the cast** (9 s stance + 4.5 s linger,
  `nefer.json:219`) while the stance bar itself correctly cuts on swap (`terminatesOnSwap: true`).
  A reader who swaps at 2 s sees a 13.5 s Dendro-RES bar hanging under a 2 s stance. Disclosed only in
  `_curatorNotes`, not in a caveat — a real visible-divergence with no reader-facing text.

- **[B] Veil of Falsehood / Seeds of Deceit / Verdant Dew — A1, A4, C1, C2 all unauthored.** Correct
  (no resource primitive), and the file's own 2026-08-18 self-correction at `nefer.json:162` is accurate
  and worth keeping. ⚠️ C2's "+2 instant Veil stacks on E" is the one piece `gainStacks` could express
  today, but it buys nothing while the consumers are absent.

- **[B] No `plungeFrames`** though the PR carries high/low plunge multipliers (`nefer.json:70`).

**Improvements:** the frame re-shape (S above) is a single mechanical pass using numbers already
written down in the file; do it together with the `application[]` authoring, since both come from the
same PR read. Add a caveat for the C4 shred/stance mismatch.

**Confidence: medium-high.** No oracle exists, so every frame claim rests on the PR values quoted in
her own notes; the _shape_ defect is certain regardless of what the right numbers are.

---

### sandrone (Sandrone) — T0

**Status:** `curated: false`, in `FRAMELESS_EXEMPT` (`characterLint.test.ts:1906`) · **no gcsim source
at all** (`gcsim-frames-diff.md:18`) · **zero** FrameMaps, **zero** `application[]`, **zero** summons,
six `effects: []` entries. Measured `Sandrone E Q N3 C` at C6: **two provisional Cryo applications and
no windows whatsoever** — an empty timeline for a T0 on-field carry. Her _enabler_ role does work:
`Sandrone E Q > Fischl E Q` produces a `Starlight Prism` gadget and a live Polestar Field ✓.

**Gaps**

- **[S] The E is drawn as an instant where the kit gives a 6 s mode.** Kit text: "boards the Tea Party
  Tactical Assault Hovermech and hovers forward for **6s**" (`sandrone.json:48`). Cooldown is 4 s
  (sidecar `CD` col 10 = 4.0 s), so the mode is up more often than it is down — and the timeline shows
  a bare marker with no bar, so a reader cannot see the overlap at all.
  Fix: `behavior: 'stance'` + `duration: 6` is **authorable today** from the kit's own stated number
  (⛔ nothing invented). Worth Nate's sign-off since it is a wiki/kit-text source rather than gcsim.

- **[S] Fagio does not exist on the timeline, and the caveat that said so was deleted.** Fagio is a
  persistent mech summoned by the Charged Attack that "periodically fires condensed beams"; the
  Prismatic Resonance Cannon is summoned by the E and the Q. No `summons[]` entry exists on any
  ability. The curator note correctly refuses to invent a cadence (no source states the beam interval —
  `sandrone.json:250`), and that refusal is right. But the consequence is that a `C` token draws a bare
  swing beside an **empty summon lane**, which is precisely the pixel the removed caveat named
  (`sandrone.json:37`, category "expected-but-absent"). Fix: the cadence is blocked on gcsim/wiki; the
  **caveat is restorable today**.

- **[A] No FrameMaps → the whole timeline geometry is the generic profile.** Every E/Q cast length,
  cancel window and swap point for a T0 on-field carry is a corpus-median stand-in
  (`src/lib/data/genericProfile.ts`). Blocked: gcsim has nothing for her on main and no PR.

- **[A] Both casts under-apply Cryo, and she is the Stellar-Conduct enabler, so the Polestar Field's
  hit ledger is under-fed.** Her E fires **2** Prism Shots and her Q is **3 Bombardments + 1 Convective
  Inhibition Ray** — both stated in the sidecar (`docs/curation/talents/sandrone.json`: "Prism Shot DMG"
  ×2 rows, "Bombardment DMG 158.8% ×3", "Convective Inhibition Ray DMG"). We emit one provisional Cryo
  per cast. The hit COUNTS are known; only the frames are not, so this is blocked on gcsim and
  correctly left alone rather than guessed.

- **[B] C1's user-facing caveat is stale wording.** `sandrone.json:166` says "The party-wide
  **Stellar-Conduct** bonus", but the effect was re-keyed to the family-wide
  `stellarGlimmerReactionBonus` on 2026-08-31 (`sandrone.json:163`). The caveat should say Stellar
  Glimmer.

- **[B] C6's `elevate` reaches no surface** — documented in full at `sandrone.json:234-236`; `elevate`
  rendering is frozen tool-wide, so at C6 nothing at all appears. Not a Sandrone defect, but it means
  her C6 entry is entirely blank on the timeline and on the Team Builder.

- **[B] Two committed reports carry stale Sandrone rows.** `caveat-open-items.md:27` still claims
  "THREE bars actually draw on any team Stellar-Conduct: +20 % Cryo, +20 % Electro and a −40 % Physical
  RES debuff bar" — those three mirror effects were **deleted 2026-09-01** by the Polestar Field round
  (`sandrone.json:106`). `capability-sweep.md:189`'s `resShred(physical)` row is stale for the same
  reason. Both should be struck on the next regeneration.

**Improvements:** her enabler wiring is exactly right and needs nothing (`enablesReactions` alone
produces the Prism — the round's own ruling). The cheap wins are the E's stance window and restoring
the Fagio caveat; everything else waits on gcsim.

**Confidence: high** on _what is absent_; **low** on what the correct numbers would be — there is no
oracle and the sidecar carries no durations beyond CD/energy.

---

### zibai (Zibai) — T0

**Status:** `curated: false`, in `FRAMELESS_EXEMPT` (`characterLint.test.ts:1907`) · **no gcsim
source** · the normal ability has **no `hits` array at all**, E/Q have no `frames`, nothing has
`application[]`. What _is_ modelled: a 15 s stance with a `durationExtensions` +1.7 s from the burst
(verified: `Zibai E Q` → `inStance 0.00→16.70`), the C2 team `lunarCrystallizeDmgBonus` bar, and two
`perTeamCount` self chips. `meta.draftedBy: "claude-autonomous"`, no `curatedAt` — she has never had a
recorded human curation pass.

**Gaps**

- **[S] Her in-mode Geo Normals apply nothing, which silently disables her own signature reaction —
  and the fix is one field.** In Lunar Phase Shift "Zibai's Normal Attacks and Charged Attacks will
  deal Geo DMG that cannot be overridden by other infusions" (`zibai.json:76`). That is exactly the
  shape of Durin's dark-commit fix (`infusion` on a state-gated normal ability). Today all five swings
  resolve Physical and reach no clock.
  **Measured**, `Xingqiu E Q > Zibai E N4 C N4`:
  - as shipped → **1** `lunarCrystallize`, one Moondrift field `1.92→10.92`;
  - with a state-gated sibling normal carrying `conditions: {state:'inStance'}` + `infusion: 'geo'`
    (scratch mutation) → **5** `lunarCrystallize` events at 1.92/2.97/4.80/5.97/7.40 s and the
    Moondrift field refreshed out to **13.80 s** via Moondrift Harmony.
    The sidecar already carries the mode normals as their own rows ("Lunar Phase Shift 1/2/3/4-Hit DMG",
    DEF-scaling). It is caveated (`zibai.json:36`) so it is disclosed — but it is the biggest mechanic in
    this batch that a one-field edit closes. **Authorable today.** ⚠️ She has no `hits`, so the sibling
    ability would carry generic frames; the infusion still works (measured).

- **[A] No normal-attack `hits` at all** → every `N` token uses the corpus-median generic FrameMap, so
  her entire on-field string has stand-in geometry. Blocked on gcsim.

- **[A] No `application[]` on E or Q.** Her Q is two Geo hits, the second counting as Lunar-Crystallize
  (sidecar "Skill 1/2-Hit DMG"); we emit one provisional Geo at the cast instant
  (measured: `0.00:geo? 0.73:geo?`). Blocked on frames.

- **[A] Spirit Steed's Stride — the enhanced Skill the whole mode exists to fuel — has no
  representation at all.** No token, no bar, no cooldown, no charge counter (4 uses per mode, 5 at C1).
  Blocked on the Phase Shift Radiance resource (no primitive); correctly refused and caveated
  (`zibai.json:67`).

- **[B] The C2 team buff draws a flat 15 s while the stance correctly cuts on swap.** Measured
  `Zibai E Q > Xingqiu E Q`: `inStance 0.00→2.32` but the `lunarCrystallizeDmgBonus` bar runs
  `0.00→15.00`. Caveated (`zibai.json:203`) ✓.

- **[B] `perTeamCount` prints a formula, never a resolved number** (`engine-capability-rubric.md:346`,
  `:348`) — the rubric explicitly names this as a true omission to keep. Correct as-is.

- **[B] C1 / C4 / C6 all effect-less.** C1 (+100 Radiance, 5 charges), C4 (no combo reset,
  Scattermoon Splendor), C6 (+50 % Radiance rate, the consumed-Radiance `elevate`) are all radiance-
  dependent — correctly unauthored, and `elevate` would render nowhere anyway.

**Improvements:** the infused state-gated normal is the single highest-value edit in the batch.
Recording a `curatedAt` and a human pass would also be worth it — she is the only T0 here still marked
`draftedBy: claude-autonomous`.

**Confidence: high** on the infusion finding (probe-measured, and the mechanism has a shipped
precedent in Durin); **medium** on the rest, since there is no oracle.

---

### columbina (Columbina) — T0

**Status:** curated ✓ · frames from **gcsim main**, byte-matching (no §2/§3 rows) · `application[]`
on both casts with `units` (`+21 hydro 1U`, `+110 hydro 2U`) · Gravity Ripple's cadence matches the
oracle exactly (`gcsim-frames-diff.md:517`: authored `138 f / 117 f × 12 · none` == observed, 12/12
applied). Enabler of all three Lunar reactions, verified: `Columbina E Q > Fischl E Q` spawns a
`Thundercloud` gadget ✓.

**Gaps**

- **[S] Twelve of her effects are `trigger: 'manual'` and therefore draw nothing, anywhere — that is
  her entire Gravity Interference system, including the largest buff in her kit.**
  The twelve: the three Gravity Interference damage variants on the skill (`columbina.json:123-163`),
  A1's stacking CRIT Rate (`:267-284`), all three C1 branches — Rainsea Shield, +6 Energy, interruption
  resistance (`:319-395`), all four C2 buffs (`:427-537`), and **C6's +80 % team CRIT DMG**
  (`:650-666`). `manual` has exactly one occurrence in `src` — its own type declaration — so none of
  these reaches a bar, chip, marker or Team Builder claim.
  **Measured** `Columbina E Q N3 C` at C6: the only windows are `Gravity Ripple`, `Lunar Domain` and
  the three Reaction-Bonus bars. A C6 owner sees no CRIT DMG bar at all. Every one of these entries'
  caveats was deleted in the 2026-08-19 ruthless pass under "expected-but-absent" — so the absence is
  now entirely undisclosed too.
  **What changed since:** the parse now emits `lunarCharged` / `lunarBloom` / `lunarCrystallize` as
  first-class reaction events (`src/lib/sim/reactionBridge.ts`, 2026-08-31) and she is the enabler for
  all three — so the trigger these effects need exists for the first time. gcsim's accumulator
  (`skill.go:99-123`: 10 gravity/s while a 2 s `gravityKey` status set by each Lunar reaction is alive,
  cap 60) is ≈ 6 s of sustained party Lunar reactions. An `onReaction` (source `team`) trigger with
  `procCooldown: 6` would put all twelve on screen with primitives that exist today.
  ⚠️ That IS a claim about cadence and needs Nate's ruling, not a curator's — but the gap is real
  either way, and it is the largest single gap in this batch.

- **[A] Moondew Cleanse — the Verdant Dew Charged Attack — is not a variant.** A stamina-free 3-hit AoE
  **Dendro** (Lunar-Bloom) attack replaces her Hydro CA whenever she holds a Verdant Dew. Today every
  `C` draws the Hydro CA and applies Hydro (measured `C/hydro@4.57`). Caveated ✓ (`columbina.json:72`).
  Blocked on Verdant Dew (a party-generated resource with no primitive).

- **[A] Her Moonsign Benediction is absent from the JSON entirely** — no passive node, no
  `factionBonuses` entry (`columbina.json:696` documents the exclusion). `enablesReactions` covers the
  conversion half ✓, but the Lunar-reaction Base DMG bonus (0.2 %/1000 Max HP, cap 7 %) and the
  **+1 party Moonsign level** are nowhere. The Moonsign level matters mechanically here: her own
  C1/C2 Ascendant-Gleam branches are gated `teamFaction moonsign min: 2`, and
  `docs/library/game/factions.md` resolves party level == member count on the premise that _no current
  character adds more than +1_. Worth re-verifying that premise against her 7.x text before it becomes
  load-bearing for two more characters.

- **[B] Three Reaction-Bonus bars for what is one in-game bonus**, each running the full 20 s where the
  game requires the active character to stay inside the domain. Caveated ✓ (`columbina.json:247`);
  listed in `caveat-open-items.md:20` as a _trim_ item still unapplied.

- **[B] `BuffEffect.stacks { maxStacks, durationModel }` on A1 has no consumer**
  (`engine-capability-rubric.md:529`; `durationModel` sits on the `orphanedSchema` INERT allow-list).
  Even if A1's trigger were repaired, it would draw a flat +5 % CRIT Rate, not 3 stacks.

- **[B] `Lunar Domain` is authored as a `summon` with no `effects`** (`columbina.json:195-201`). It is a
  field, not a thing she leaves behind — the Polestar round minted `TimelineWindow` kind `gadget` for
  exactly this class. Cosmetic today (it draws a correct 20 s bar in the summon lane); worth revisiting
  if gadget rows grow.

- **[B] A4's Moonridge Dew half (up to 3 per 18 s) is a countable cadence and is description-only.**
  Low value while Verdant Dew is unmodelled, but it is the one A4 branch that _has_ a stated period.

**Improvements:** her frames, applications, units and summon cadence are all exact — there is nothing
to tighten on the measured half. The whole of her remaining value is locked behind the `manual`
trigger. If the `onReaction` + `procCooldown` approximation is rejected, at minimum the deleted
caveats on C1/C2/C6 should come back: "expected-but-absent" is exactly the category the name-the-pixel
rule keeps.

**Confidence: high.** gcsim main is complete for her, and the manual-trigger count and the empty
window list are both probe-measured.

---

### ineffa (Ineffa) — T0

**Status:** curated ✓ · frames from **gcsim main**, byte-matching (no §2/§3 rows) · `application[]` on
both casts with `units` · Birgitta's cadence matches the oracle on both hosts
(`gcsim-frames-diff.md:529-530`: authored `110 f / 120 f × 10 · none` and `153 f / 120 f × 10 · none`
against observed `119 f`, 10/10 applied). `chargedIcdWindow` authored for the polearm group ✓.
Enabler of `lunarCharged`.

**Gaps**

- **[S] `E → Q` draws TWO Birgittas and roughly doubles her Electro application.**
  Kit and gcsim: the burst _re-summons Birgitta at the new spot and resets her duration_
  (`ineffa.json:210`). **Measured** `Ineffa E Q` at C0: two overlapping summon bars
  (`1.13→21.13` and `2.38→22.38`), **20 tick markers and 22 Electro applications** over 21 s where the
  game has one Birgitta and ~11. It is caveated (`ineffa.json:203`) ✓, but this is the canonical
  opener and it doubles the gauge feed for the character whose entire job is driving Lunar-Charged.
  Fix: **`terminatesOn: 'recast'` on both Birgitta summons.** The truncation key is
  `characterId::label` (`src/lib/sim/finalize.ts:322`), so the skill's and the burst's Birgitta already
  share one. **Verified in a scratch mutation:** one `1.13→2.38` stub (1 tick) + one `2.38→22.38` bar
  (10 ticks), **11 applications**. ⚠️ The stub bar is exactly what Fischl's Oz already looks like, so
  the shape has precedent. **Authorable today — one field, twice.**

- **[A] C2 is entirely unauthored, and its shield half is authorable today.** C2 has two parts:
  Punishment Edict (a 300 % ATK Lunar-Charged detonation after a delay or on the marked enemy's death)
  and **"nearby party members gain Optical Flow Shield Barriers" on the burst**. gcsim's `c2OnBurst`
  (`cons.go:60-66`) is a plain `QueueCharTask(c.addShield, 37)` — the _identical_ 20 s
  "Optical Flow Shield Barrier" at Q + 37 f (`shield.go:13-31`). That is precisely the shape
  `pushShield` accepts (`onCast` + positive `duration`), and the constellation-shield wire (`53db108`)
  made constellation-hosted shields reachable. Today her E's shield bar draws and her burst's does not,
  at any level. **Highest-value unauthored item in her file.** (Lint B.8a applies: bind
  `trigger.ability: 'burst'`.) The Punishment Edict half stays blocked — no enemy-death trigger.
  ⚠️ Related: `addShield` also calls `c1OnShield()`, so at C1+C2 the **burst** refreshes Carrier Flow
  Composite too; our C1 buff is keyed `onCast skill` only (`ineffa.json:271-275`).

- **[A] A1 (Overclocking Circuit) is unauthored** — an extra 65 % ATK Lunar-Charged hit on _every_
  Birgitta discharge while a thundercloud is up (`asc.go:19-27`, gated on `reactable.LcKey`). We now
  **draw thunderclouds** in the gadget strip (Polestar round §8), so a reader can see the cloud and see
  no extra marker beside it. Note gcsim gives that hit **no `Durability`**, so the missing pixel is a
  tick/marker, not a gauge application. Blocked: CLAUDE.md names "Ineffa A1" explicitly among the kits
  that read a gadget as a CONDITION — no primitive.

- **[B] The C6 curator note is STALE and will send the next curator down a closed path.**
  `ineffa.json:374` states reason (2): "`lunarCharged` IS NEVER EMITTED". That was **fixed 2026-08-31** —
  `reactionBridge.ts` converts `electroCharged → lunarCharged` whenever an enabler is in the party, and
  she is one. Reason (1) still stands (no `application[]` → `procs.ts:157` rejects the effect;
  `engine-capability-rubric.md:135`, `:304`), and ⛔ authoring one would be _wrong_ anyway: gcsim's C6
  `AttackInfo` (`cons.go:145-155`) carries no `Durability`, so it applies nothing. Net: the effect
  correctly draws nothing and there is no pixel — but the note must be corrected.

- **[B] C4's +5 Energy per team Lunar-Charged now actually fires** (same reactionBridge change) —
  worth a confirming look, though `energy` effects have no planner surface so there is no pixel either
  way.

- **[B] The 250 % Electro shield-absorption multiplier is unmodelled** (no per-element shield-strength
  field). Correctly undisclosed: the bar's length, label and scaling are all right.

- **[B] Interval rounding.** `interval: 2` (120 f) against gcsim's measured 119 f — a 10-frame drift at
  the tenth tick. Below the noise floor; ⛔ not worth changing.

**Improvements:** `terminatesOn: 'recast'` and the C2 burst shield are both one-line edits with
measured or gcsim-line evidence. After the recast fix her caveat at `ineffa.json:203` should be
retired, not reworded.

**Confidence: high.** gcsim main is complete, and both headline findings are probe-measured with a
verified candidate fix.

---

### Batch summary

| id        | tier | #S  | #A  | #B  | headline                                                                                                                                                                                                     |
| --------- | ---- | --- | --- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| mavuika   | T0   | 2   | 3   | 3   | The tap-E Ring is smuggled into `application[]` instead of being a summon — no bar, no ticks, 4 of 7 Pyro applications survive the cast's ICD counter, and they keep firing after the Burst deletes the ring |
| nefer     | T0   | 1   | 3   | 3   | Every FrameMap is pre-L4b (`anim` == `swap` == the hitmark, no `hit`), her own notes hold the right `anim` values, and no cast has an `application[]`                                                        |
| sandrone  | T0   | 2   | 2   | 3   | A T0 on-field carry with an empty timeline: the 6 s hovermech draws as an instant, Fagio has no lane, no frames and no applications exist                                                                    |
| zibai     | T0   | 1   | 3   | 3   | Her in-mode Geo normals resolve Physical, so the lunarCrystallize enabler produces 1 reaction where an `infusion: 'geo'` state-gated normal produces 5 (measured)                                            |
| columbina | T0   | 1   | 2   | 4   | Twelve `manual`-trigger effects — her whole Gravity Interference system, C6's +80 % team CRIT DMG included — reach no surface, and the reaction triggers they need now exist                                 |
| ineffa    | T0   | 1   | 2   | 4   | `E → Q` draws two Birgittas and doubles her Electro feed; `terminatesOn: 'recast'` fixes it (verified), and C2's burst shield is authorable today                                                            |

**Cheapest high-value edits across the batch** (all measured or gcsim-sourced, all authorable with
shipped primitives): Ineffa `terminatesOn: 'recast'` ×2 · Ineffa C2 burst shield · Zibai state-gated
`infusion: 'geo'` normal · Mavuika ring-as-summon with `icdGate: 'none'` · Sandrone E as a 6 s stance.

**Engine work these findings would need:** a summon that terminates on a burst cast (Mavuika) · stance
re-entry that refreshes instead of stacking (Nefer's 2 charges) · a cadence-bearing trigger for
resource accumulators (Columbina's Gravity, Nefer's Verdant Dew, Zibai's Radiance, Sandrone's Decoding
Power) · a gadget-presence condition (Ineffa A1).

**Stale text to correct** (not gaps, but they will mislead the next pass): Ineffa's C6 note claiming
`lunarCharged` is never emitted · `caveat-open-items.md:27` and `capability-sweep.md:189` describing
three Sandrone Polestar bars deleted on 2026-09-01 · Sandrone's C1 caveat still saying
"Stellar-Conduct" after the Stellar Glimmer re-key.

---

<!-- batch 2 -->

## Batch 2 — data-gap audit (2026-09-15)

Characters: linnea, odette, yae_miko, chevreuse, citlali, iansan (all Prydwen T0).
Oracle: gcsim main `ac2d76dde`; reports as of `74eba882` (frames-diff regenerated today).
Everything below was read in the JSON, cross-read in gcsim source, and — where it
concerns a drawn pixel — **measured** with a throwaway `parseNotation` probe
(written to `scratch/`, run, deleted in the same turn). No repo file was modified.

---

### ⚠️ One cross-character defect found by probe, not by reading

**`onReaction` triggers default to `source: 'self'`**
(`src/lib/utils/buffWindows.ts:274` — `trig.source === 'team' ? reactionEvents : ownEvents`,
and again at `:1259`). Two characters in this batch author a reaction-triggered
debuff whose kit text says _any party member_, and neither sets `source: 'team'`,
so the bar only draws when **the holder herself** triggers the reaction:

| holder    | effect                          | kit text                                                | measured                                                                           |
| --------- | ------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| chevreuse | A1 −40% Pyro/Electro RES        | "After **a character** triggers Overloaded"             | `Chevreuse E Q > Fischl E Q` @C6 → **3 Overloaded events, 0 shred windows**        |
| citlali   | A1 + C2 −20/−40% Pyro/Hydro RES | "after **nearby party members** trigger Frozen or Melt" | `Citlali E Q > Xiangling E Q` @C6 → 7 melts, **only the 5 Citlali triggered** draw |

Both are one-key fixes (`"source": "team"` on the trigger) and authorable today.
⚠️ This is worth a corpus sweep beyond this batch — the default is silent.

---

### linnea (Linnea) — T0

**Status:** curated=true, but the thinnest kit in the batch. No gcsim on `main`,
**but a full unmerged gcsim implementation exists** (`efebba93a "Linnea"`,
13 files incl. `skill.go`/`asc.go`/`burst.go`/`cons.go`). Normals carry no `hit`
key; E/Q carry no `application[]`; Lumi has **no effects at all**.

**Gaps**

- **[S] Linnea's Elemental Burst deals no damage in game, but we apply Geo at the cast instant.**
  `linnea__burst__…` has no `application[]` → absent → `resolveCastApplications`
  falls back to the character's element at the cast (`aura.ts:522`). Measured:
  `Linnea E Q` → `0.00geo 0.33geo`, the second from the Q. gcsim's
  `burst.go` (commit `efebba93a`) queues **only heals and a Lumi (re)summon — no
  `QueueAttack` at all**. Fix: author `"application": []` (the positive claim).
  Authorable today, one line; removes a phantom pill and any phantom
  crystallize/melt/etc. it causes.
- **[S] Lumi is a 25s bar with zero tick markers, so Linnea's whole Moonsign kit is inert.**
  `abilities[1].summons[0]` has no `effects` array; the E's `application[]` is also
  absent. Consequence measured: Lumi contributes **nothing** to the gauge, so no
  crystallize → no `lunarCrystallize` → C1's `fieldCatalog` consumer bar and C6's
  `elevate` can only ever fire off Linnea's own aimed shots.
  ⚠️ **The curator note's blocker is weaker than it claims.** The note says the
  cadence is variable (111/63/144f) and therefore unauthorable. In gcsim
  `skill.go`, `advanceSkillIndex()` resets `skillHitNum` to 0 whenever
  `Constructs.CountByType(GeoConstructLunarCrystallize) == 0` — i.e. **with no
  Moondrifts on the field the cadence is a constant 111f (1.85s) Pound-Pound**,
  first attack at frame 114 from the E cast (`skillSuperStart = 114 - skillRecastDur`).
  `poundPoundHammer` is Geo / `Durability: 25` / `ICDTagElementalArt` /
  `ICDGroupDefault`, two hits 16f apart (`skillSecondHitDelay`). That is exactly a
  `summonTick` series. Heavy Overdrive and Million Ton Crush carry **no
  `Durability`** (0U) so they need no application at all.
  Fix: author one (or two, offset 16f) `summonTick` damage series at
  `interval: 1.85`, `firstTickDelay: (114 − 36)/60 = 1.3`, standard icdGate.
  Authorable today **if** the unmerged-PR precedent applies — which this repo
  established two commits ago (`2627c5a2` Illuga from PR #2677, `8e9a63df`
  Kachina from PR #2697).
- **[A] C2 and C4 have no `effects` at all** — +40% CRIT DMG to Hydro/Geo team for
  8s, and +25% DEF to Linnea _and_ the active character for 5s. Both hang off
  **Moondrift Harmony**, for which there is no trigger primitive
  (gcsim's `event.OnMoondriftHarmony`). Two missing team-buff bars at C2/C4.
  Needs engine work (a Moondrift-Harmony trigger), _or_ — since the Polestar
  round already produces Moondrifts as `gadget` windows in `sim/fields.ts` — a
  trigger keyed to a Moondrift top-up/refresh would now be reachable.
- **[B] Normal-attack FrameMaps are mis-shaped: `anim` holds the HITMARK and `hit` is absent.**
  Authored `N1 {anim:17, N:21, swap:17}`; gcsim
  `InitNormalCancelSlice(attackHitmarks[0]=17, 21)` → the correct shape is
  `{anim:21, hit:17}`. Same for N2 (`{anim:12,N:26}` → `{anim:26, hit:12}`) and
  N3 (`{anim:27,N:43}` → `{anim:43, hit:27}`). Compare fischl/ganyu/yelan, all
  `{anim, hit}` with `anim > hit`. Practical damage is narrow because the
  cancel keys coincidentally resolve right, but: the **Human-timing "Animations"
  mode reads `FULL_ANIMATION_KEY = 'anim'`** and gets a value up to 16f short per
  swing; and `anim === swap` is the frames-diff's own stand-in marker, so the
  report files all five maps under "no gcsim source" (§3, 45 entries).
- **[B] A1's −15% Geo RES bar is a flat 25s from the E cast with no tie to Lumi.**
  gcsim `a1Ticker` re-applies a 1.5s shred **every 60f while Lumi is alive**, and
  `a1OnLumi` also fires from the **burst** when Lumi is absent. Ours fires only on
  `onCast skill`. The caveat was removed 2026-08-19 as "no pixel" — the bar's END
  is still an assumption.
- **[B] C1's consumer prints the C0 value at C6.** `constellationScaling` on a
  `BuffValue` has **no reader** in `buffWindows.ts`/`buffDisplay.ts` (documented
  in the JSON's own note; 6 corpus holders). At C6 the bar draws and says
  "+75% DEF" where the game gives 150%.
- **[B] No `plungeFrames`** (no `plunge.go` in the gcsim branch either) → `P`
  falls back to a generic cast length.
- **[B] Two stale curator notes.** (a) The 2026-08-18 note says `lunarCrystallize`
  is "gated on `hasMoonsignTeam`" — that flag was **deleted** in the 7.0 rollout
  (2026-08-31); the conversion is now `hydroCrystallize → lunarCrystallize`
  (`reactionBridge.ts:80`, `replace`) driven by `enablesReactions`, which she has.
  ⚠️ Note the practical consequence: a **Geo-onto-Hydro** aura is the only route,
  so a Hydro teammate is required for any of her lunar kit to fire.
  (b) The same note's "variable cadence" blocker — see the S gap above.

**Improvements:** author `application[]` for the E from the branch
(`skillHitmark`-equivalent; her E's own hit is the Lumi spawn, worth checking);
`tickCap: 1` on the burst's initial-heal series instead of the `interval: 13 ≥ 12s`
coincidence (the JSON's own note flags it as a latent trap).

**Confidence:** high on the burst phantom, the FrameMap shape and the Lumi gap
(all measured or read directly in gcsim). Medium on the cadence proposal — the
111f constant is read from source, not measured by the dumper (there is no dumper
for an unmerged branch).

---

### odette (Odette) — T0

**Status:** the best-curated character in the batch. Frames + `application[]`
landed **today** from gcsim main `ac2d76dde` (PR #2749). `curated: true`.
Tick counts, cadences and ICD gates all match §5 of the frames-diff exactly
(skill 5 Plume + 5 Wing @234f `none`; burst 5 + 4). No §2 or §3 rows.

**Gaps**

- **[A] The Coda does not restart the Dance Double, so every tick after it is at the wrong time.**
  gcsim `skill.go:skillRecast` sets `c.danceDoubleSrc = src` (killing the running
  tickers) and re-queues `danceDoubleTicker(src, danceDoublePlume)` at
  `skillRecastFinalHitmark + skillRecastFirstTickDelay`. Measured `Odette E E`
  @C6: our Double keeps its original cadence — ticks at
  2.6/4.4/6.5/8.3/10.4/12.2/14.3/16.1/18.2/20.0s. In game the whole series shifts.
  `E → E(Coda)` is _the_ Odette rotation, so this is nearly always on screen.
  Documented in the JSON's own note. Needs engine work — closest existing
  primitive is the Arkhe round's `ctx.lineupChanges` (parse records the instant,
  finalize cuts/re-seeds the window).
- **[B] The Coda re-grants Marvelous Splendor and re-fires every A1/C2/C6 bar.**
  `adagio_coda_at_dawns_tolling` is `abilityType: "skill"`, so `onCast ability:'skill'`
  matches it. Measured `Odette E E` @C6: two full sets of buff windows,
  0.38→20.38s and 0.68→20.68s. The kit says stacks come from **summoning the
  Solo Dance Double**, which the Coda does not do. Visible cost is small (the
  stacks are already at `max`, so no printed value changes — only the bar ends
  0.3s late and an extra row draws). Fix: narrow the grants' trigger, e.g. a
  condition that excludes the Coda, or move the grant to the summon. Authorable.
- **[B] The A1 / C2 buff bars print a value that in game decays away.**
  Marvelous Splendor drains 1 stack/s off-field (`drain` authored), but `perStack`
  is read from a cast-time snapshot, so the bar says "+60% Stellar Glimmer" for
  the full 20s while the game has her at 0 after 4s off-field. The JSON argues
  this is invisible _because the drain RATE never changes a number_, which is
  true of C1/C6's rate change but does not cover the decay itself. No caveat.
- **[B] Two curation reports are stale on her.**
  `docs/curation/capability-audit.md:74` still lists odette as an "uncurated stub
  (no frame data)" (file last regenerated `1b0fb5b8`, 2026-08-31);
  `docs/curation/capability-sweep.md:44` still lists `resShred(physical)→enemy C0`,
  which was the Polestar mirror **deleted 2026-09-01**. `characterIndex.generated.ts:87`
  now reads `"curated":true` with no physical resShred. Regenerate both.
- **[B] C4's coordinated attack is unauthored and the stated blocker is now half-wrong.**
  The note says "application[] is measured from gcsim, which has nothing for
  Odette" — gcsim now has her. But the conclusion still stands for a different
  reason: `cons.go:c4Init`'s AttackInfo sets **no `Durability`** (0U), so it
  reaches no gauge. Worth rewriting the note to say _that_, so nobody re-opens it.
- **[B] No `plungeFrames`** (gcsim has no `plunge.go` for her).

**Improvements:** the Coda's `_curatorNotes` claim about the trimmed
`application[]` is exactly right and verified against §4 (the dropped 62f hit has
no `Durability` in `skillRecast`'s `aiFinal`). Nothing to tighten there.

**Confidence:** high. Everything checked against gcsim source and the fresh
report; the two behavioural findings were measured.

---

### yae_miko (Yae Miko) — T0

**Status:** curated, frames + summon cadence match gcsim. Her Witch's Revelation
passive (`Edict of Cleansing`) landed **today**, taking the Sesshou Sakura from
14s/5 ticks to 24s/8 ticks — which §5 confirms (`observed 121f/176f × 8`, ours
`120f/176f × 8`). No §2/§3 rows.

**Gaps**

- **[A] The Tenko Thunderbolts apply no Electro.** `burst.go:kitsuneBurst` re-uses
  the burst's `ai` (Electro, `Durability: 25`, **`ICDTagNone`** → every one
  applies) and fires one per live Sesshou Sakura at `154 + i*24`. Our burst
  authors a single `{frame:100, electro, 1U}`. Measured `Yae Miko E E E Q`: **one**
  burst application where the game gives **four**. It cannot be a static
  `application[]` — the count is the live totem count — so it needs engine work
  (a summon-count-conditional application, or the burst consuming the summon
  windows and emitting per consumed entity). No caveat names it.
- **[A] C2's +200 EM bar is 10s short of the summon it describes.**
  `constellations[1].effects[0].duration` is **14**, and the note says explicitly
  "duration 14 (the totem lifetime)". The totem lifetime became **24** in today's
  Revelation edit and the C2 duration was not moved with it. Measured @C6:
  EM windows 0.57→14.57 / 1.18→15.18 / 1.80→15.80 while the sakura run to
  24.57/25.18/25.80. One-number fix, authorable today.
- **[A] C4 draws nothing at all.** Both halves — the party-wide +20% Electro DMG
  for 5s and the 8 Energy — are `trigger: "manual"`, which reaches **no surface**.
  The JSON names the missing primitive precisely (a `summonTick`-triggered buff
  collector in `buffWindows.ts`; the cadence half already exists on
  `TimelineWindow.ticks`). Caveat present and honest. Needs engine work.
  Measured: `Yae Miko E E E Q` @C6 emits **zero** C4 windows.
- **[A] A1's per-thunderbolt skill-charge reset is unmodelled**, so the E bars after
  a Q sit later than in game (`gcsim` calls `ResetActionCooldown(ActionSkill)` once
  per thunderbolt). Caveat present. Needs a `cdReset` trigger with a per-totem
  multiplier.
- **[B] C1's 8-Energy-per-thunderbolt clause is unauthored** (the two Stellar
  buff bars are authored and do fire). Energy has no planner surface today, so
  this is a Team Builder facet gap only.
- **[B] A4 "Enlightened Blessing" is mis-authored dead data**: `trigger: manual`,
  `stat: "em"` with **no `value`**, where the real effect is +0.15% Sesshou Sakura
  DMG per EM point. Its own note says the stat is wrong. Damage magnitude is out
  of scope, so the right resolution is to retire the effect (or move it to
  `INERT` with a reason), not to fix the stat.
- **[B] The skill's `_curatorNotes` still contain the superseded 2026-07-29 `[Stellar]`
  note** asserting the +10s is "unsupported" and "Summon duration left at 14".
  The new note flags it, but the file now carries both readings.
- **[B] `firstTickDelay` is 1 frame early** (ours 120f from cast, gcsim 121f).
  Trivial; listed because §5 shows it.

**Checked and correct:** the three totems **share one ICD counter** in our model
(clock key `${char.id}:summon:${label}:${index}`, identical for all three), which
matches gcsim's per-(actor, ICDTag) gate — measured 8 applications from 24 tick
markers, i.e. every third, which is what the standard gate gives.
Also correct: **the burst does NOT destroy the Sakura when Revelation is unlocked**
(`kitsuneBurst`: `if !c.revelation { c.popAllKitsune() }`), so our un-truncated
summon bars are right for the assumed-unlocked case the caveat states.
C6's DEF-ignore and CRIT-DMG halves are correctly left unauthored (pure
damage-formula terms — the "invisible-omission" category).

**Confidence:** high.

---

### chevreuse (Chevreuse) — T0

**Status:** frames and all three `application[]` lists match §4 of the frames-diff
exactly. **Everything else about her is broken or missing.** Measured
`Chevreuse E Q > Fischl E Q` @C6: **zero** Chevreuse windows of any kind.

**Gaps**

- **[S] Her signature −40% Pyro/Electro RES shred never draws in her canonical team.**
  A1's two `resShred` effects have no `trigger.source`, which defaults to
  self-only (see the cross-character note above). Measured: 3 Overloaded events
  triggered by Fischl → 0 shred windows. Fix: `"source": "team"`. One key each.
- **[S] Her other signature buff — A4 "Vertical Force Coordination" — reaches no surface and has no value.**
  `passives[1].effects[0]` is `trigger: "manual"` (no surface), `target: "self"`
  (gcsim `asc.go:a4` buffs **every Pyro and Electro party member**), and carries
  **no `value` field at all** ("value field deleted per recipe — reviewer to
  implement"). The real effect is `min(MaxHP/1000 × 1%, 40%)` ATK% for 30s to
  Pyro+Electro teammates. Authorable today: `BuffValue {type:'scaling', stat:'hp',
ratio: 0.1 per 100 HP, cap: 40}` (⚠️ `ratio` is per **100 stat units**, so
  1%/1000 HP = `ratio: 0.1`), `target: 'team'`, and the Overcharged-Ball
  prerequisite expressed as `gainStacks` on `onReaction overloaded` (max 1) +
  `consumeStacks` on the Hold-E cast + a `stacks min 1` gate — all primitives
  that exist.
- **[S] C6's two +20% Pyro/Electro DMG team bars reach no surface.**
  Both are `trigger: "manual"`, `target: "self"` (gcsim applies to the character
  being healed). At C6 that is a party-wide 20%/20% bar the player will look for.
  Same shape as Yae C4 — it fires off the 2s skill-heal tick, so it needs the same
  missing `summonTick`-buff collector, **or** an honest approximation (one
  `target: 'active'` 8s window per skill cast). No caveat.
- **[A] C1 has no `effects` at all** — 6 Energy to the active non-Chevreuse
  character on Overloaded, 10s ICD. The `energy` effect type exists and
  `procCooldown` exists, so this is authorable today; energy has no planner
  surface but it _is_ a Team Builder facet
  (`capability-sweep.md:82` files it as "wiki attributes energy — nothing derives").
- **[A] C6's team heal reaches no surface** (`trigger: "manual"`, 10% Max HP once,
  12s after the skill heal starts). No heal reaches a planner lane at all today,
  but the Team Builder facet is real.
- **[A] The 12s skill heal draws no window.** The effect IS authored
  (`onCast skill`, `target: 'active'`, `duration: 12`) but no non-summon heal
  reaches a lane, so her E is an instant with a cooldown tail and nothing else —
  while Bennett and Xilonen on the same screen get marks. The caveat that said so
  was **removed** 2026-08-19 and the note claims it was "rewritten"; there is now
  **no `caveat` key anywhere in chevreuse.json** (`grep -c caveat` → 1, the string
  inside a note). Either the rewrite was lost or the note is wrong.
- **[A] C4's cooldown suppression is unmodelled** — after Q, two Hold-E casts skip
  the 15s CD (gcsim `c4ShotsLeft`). The E bars after a Q therefore sit later than
  in game. `bypassesCooldown` exists as a variant field but not as a
  count-and-window-limited state. Needs engine work.
- **[B] The Arkhe Surging Blade proc is unmodelled — and should stay so.**
  gcsim `skill.go:arkhe` gives it **`Durability: 0`**, so it reaches no gauge.
  ⚠️ Worth recording, because the JSON note calls it "Not modeled — needs
  reviewer pass" as though it were work.
- **[B] The burst's three applications land 9–11 frames late and carry provisional feet.**
  Her mines run on `ICDGroupChevreuseBurstMines` (180f, sequence
  `{1,0,0,1,0,0,0,0}`), which our cast-level gate cannot express — casts are
  gated with the standard 150f/every-3 (`resolveActionIcd`). Measured
  `Chevreuse E Q`: applications at cast+59 (2U), **+92, +110**; gcsim applies at
  +59, **+83, +101**. The count is right, the times are not, and because the
  author put `units` only on the entries gcsim applied, our two picks fall on
  entries with no `units` → flagged `--ui-provisional` on the aura lane. Schema
  gap: there is no cast-level equivalent of `summonTick.icdGate`.
- **[B] No `plungeFrames`** (no `plunge.go` in gcsim).
- **[B] The A1 party-composition gate is unenforced** (all-Pyro/Electro with ≥1 of
  each). Its own note admits it. Once `source: 'team'` is set this becomes the
  _next_ wrongness: the shred will draw in any overloading team. `teamElementCount`
  can express ≥1 Pyro and ≥1 Electro; the "and nothing else" half needs either a
  `<=`/`==` comparison on the sum or a new primitive — check
  `teamElementCount.comparison` before promising it.

**Improvements:** her `application[]` lists and `chargedIcdWindow: {timer: 30}`
are correct and well-sourced; nothing to tighten there.

**Confidence:** high — the "zero windows" result is measured, and every missing
mechanic was read in `asc.go`/`cons.go`.

---

### citlali (Citlali) — T0

**Status:** curated; E/Q `application[]` match §4; the Opal Shield draws as a real
shield lane; Itzpapa draws 20 tick markers. §5 shows **no observed stream** for
Itzpapa, because in an isolated core Nightsoul never reaches 50 and Opal Fire
never starts — so her tick series has never been oracled.

**Gaps**

- **[A] Itzpapa's ticks are gated on the wrong ICD and under-apply by ~30%.**
  gcsim `skill.go:itzpapaHitTask` tags the Frostfall Storm
  `ICDTagCitlaliFrostfallStorm` / `ICDGroupCitlaliFrostfallStorm`, whose params
  are **timer 90f, sequence `{1.0, 0.0}`** (`pkg/core/attacks/icd_groups.dm.go:94,160`)
  — every _second_ tick applies. Our series authors no `icdGate`, so it falls to
  the standard 150f/every-3. Measured `Citlali E Q`: **7** tick applications
  (1.28/4.23/7.18/10.13/13.08/16.03/18.98s) from 20 markers; the correct gate
  gives **10** (the 59f interval is under the 90f timer, so the counter never
  resets). Fix: `"icdGate": { "timer": 90, "every": 2 }`. Authorable today
  (14 series across 11 characters already carry one).
  ⚠️ §5 cannot propose this — the oracle saw no stream — so it will not surface
  in any report.
- **[A] Her A1/C2 shreds fire only off her own Frozen/Melt.** Same
  `onReaction` source default as Chevreuse; kit text is "nearby party members".
  Measured `Citlali E Q > Xiangling E Q` @C6: 7 melts, only the 5 Citlali's own
  cryo ticks triggered produced shred windows — Xiangling's two melts at 3.60s
  and 4.23s drew nothing. Fix: `"source": "team"` on all four triggers.
- **[A] C4's bonus Spiritvessel Skull is a real Cryo application source and is inert.**
  `cons.go:c4SkullCB` fires off a Frostfall Storm hit, 8s ICD, **Cryo /
  `Durability: 25` / `ICDTagNone`** — one extra Cryo application every 8s at C4+.
  Ours is a `trigger: "manual"` damage effect → no surface, no gauge. Authorable
  today on the coordinated-attack shape (a `damage` effect with its own
  `application[]` on an `onHit` trigger + `procCooldown: 8`) — summon ticks do
  reach `sim/procs.ts`.
- **[A] C6 "Cifra of the Secret Law" is entirely unauthored** — up to 40 stacks,
  each giving the whole party +1.5% Pyro **and** Hydro DMG (so up to +60/+60) and
  Citlali +2.5% all DMG. That is the single largest thing a C6 Citlali owner
  looks for and there is **no bar at all**. The stack count needs Nightsoul
  tracking (out of scope by the constitution), but a `stellar`-style honest bar —
  one window over Itzpapa's lifetime with a stated caveat, or a
  `BuffValue {type:'unknown'}` (the Furina Fanfare precedent from 2026-09-04) —
  would be a large improvement over silence. Currently not even caveated.
- **[B] C2's "nearby active characters are also granted an Opal Shield" is unmodelled.**
  Since the constellation-shield wire shipped (2026-08-18) a `shield` Effect on a
  constellation entry _does_ reach the lane — but a same-span pair collapses to
  one bar ("ONE SPAN, ONE BAR"), so authoring it would change nothing visible.
  Low value; record it so it is not re-proposed.
- **[B] At C2 the shred draws as A1's −20% _plus_ C2's −20% where gcsim replaces.**
  `asc.go:a1Hook` sets `amt = -0.4` on the **same** mod key at C2. Both encodings
  total −40%, but measured @C6 the window carries **four `resShred` effects**
  (2× A1 + 2× C2), so the reader may see "−20%" twice per element rather than
  "−40%" once. Worth an eyeball on the rendered row.
- **[B] The burst's second application frame is an RNG roll.**
  `burst.go:spiritVesselSkullRandHitmark` = `57 + 30 + Rand.Intn(31)`, so the
  skull lands `iceStormHitmark + 87…117`. We author the single dumped value
  (frame 232, the top of the range). Fine as a stand-in; note it is not a
  measurement.
- **[B] `activeDuration` is not authored on the skill** even though the
  2026-08-14 note says it was added there. Harmless today (the Itzpapa summon
  supplies the window) but the note and the file disagree.
- **[B] No `plungeFrames`.** C1's Stellar Blades and A4's EM additions are
  correctly inert (damage magnitude), though they sit in the file as four
  `manual`-trigger damage effects that reach nobody.

**Improvements:** the caveat about tick markers being over-shown while Nightsoul
builds is exactly right and well placed. The Opal Shield authoring (scaling, flat,
duration, frame 37) is verified line-for-line against `shield.go`.

**Confidence:** high on the ICD group (read straight from the group tables) and
the shred source (measured). Medium on the C6 proposal — it is a design call.

---

### iansan (Iansan) — T0

**Status:** curated; the flagship ATK buff (both Nightsoul tiers) is authored and
**draws correctly** — measured `Iansan E C N3 Q` @C6: one `atk%` window
3.05→18.05s (the ≥42-point tier, and 15s matching the C6-extended Scale).
No gcsim on `main`, but a full unmerged implementation exists
(`dea44df4e "add iansan"`).

**Gaps**

- **[S] Her Nightsoul Charged Attack applies no element.** Swift Stormflight is
  **Electro / `Durability: 25` / `ICDTagNone`** at hitmark 14f
  (`charge.go` @ `dea44df4e`), but the in-Nightsoul normal variant authors
  **no `infusion`** — its own note says so. Measured: `Iansan E C N3 Q` produced
  applications only at the E cast and the Q cast; the `C` inside Nightsoul
  contributed **nothing**. This is Iansan's only on-field Electro source besides
  her two casts. ⚠️ The obvious fix does _not_ work: `NormalAbility.infusion`
  infuses the whole ability, and her N1–N3 stay **Physical** in Nightsoul. So it
  needs a charged-attack-scoped infusion field (small schema work). Whoever does
  it should note the CA sits on `ICDGroupDefault`, **not** the polearm
  `ICDGroupPoleExtraAttack` her bare CA uses — so no `chargedIcdWindow`.
- **[A] Neither E nor Q has an `application[]`, so both apply at the cast instant.**
  gcsim: `skillHitmark = 21`, `burstHitmark = 34`, both Electro `Durability: 25`.
  Measured: applications at 0.00s and at the Q's cast frame. Authorable today
  from the branch (two three-key lists), and it would drop the provisional foot
  off both pills.
- **[A] A1 "Precise Movement" (+20% ATK self, 15s) is unauthored below C2.**
  `passives[0]` has **no `effects` array**. The note calls the trigger
  unreachable, but `Trigger.onHit.abilityType` accepts `'charged'`
  (`src/lib/types/ability.ts:510-516`), so
  `buff / self / onHit abilityType:'charged' / conditions state nightsoulBlessing /
duration 15` is expressible today. At C2+ the same buff _is_ authored (on the
  burst), so the gap is C0–C1 only — but that is where most 4★ owners are.
- **[B] Normal-attack FrameMaps are mis-shaped, same defect as Linnea.**
  Authored `N1 {anim:13, N:22, C:22, swap:13}`; the note itself says
  `attackHitmarks=[13,16,12]` and `InitNormalCancelSlice(hitmark, animLen)`, so
  the correct shape is `{anim:22, hit:13}` / `{anim:22, hit:16}` / `{anim:41, hit:12}`.
  `hit` is absent on all six maps (both normal abilities).
- **[B] Both `chargeFrames` `anim` values are wrong.** Base CA: gcsim
  `InitAbilSlice(55)`, ours says `anim: 49`. Swift Stormflight CA: gcsim
  `InitAbilSlice(52)`, ours says `anim: 49`. The `anim` key is the fallback for
  every un-overridden cancel _and_ the Human-timing "Animations" value.
- **[B] The Kinetic Energy Scale draws as a bar with no markers.** Correct as far
  as damage goes (it deals none), but its 1s Nightsoul-restoration cadence — the
  thing that decides which ATK tier she is on — is invisible. No primitive; record
  only.
- **[A] C4 and the second half of C6 have no `effects`** (Surging Force stacks;
  +25% active-character DMG for 3s on Nightsoul overflow). Both gate on Scale
  restoration ticks. Needs engine work; documented.
- **[B] C1's 15 Energy** is unauthored — no planner surface, but
  `capability-sweep.md:102` files it as a derivation gap, so it costs a Team
  Builder facet.
- **[B] The A2 heal (`onTeamNightsoulBurst`, 60% ATK) is authored but reaches no
  planner lane** — no `heal` branch exists in `buffWindows.ts` or
  `src/lib/timeline/`. It does derive the Team Builder facet, so this is
  engine-side, and the caveat was correctly removed as an invisible omission.
- **[B] No `plungeFrames`.** The 5s post-skill `fastSkill` window (an N press
  auto-converts to a free stomp) is unmodelled and **is** caveated —
  `caveat-open-items.md:39` files it as `visible-divergence`, still open.

**Improvements:** the two-tier ATK buff authoring (perStack below 42 NS, flat
`scaling.cap 690` at ≥42) is good and measured correct. The C6 `durationModifiers`
entry works — the buff window came out at 15s, so the note worrying that the
buff's `duration: 12` would not follow the Scale is unfounded.

**Confidence:** high on the missing Electro CA and the FrameMap shape (both read
in gcsim and measured); medium on the A1 `onHit charged` proposal — the trigger
member exists, but it has not been exercised on a stance-gated CA.

---

### Batch summary

| id        | tier | #S  | #A  | #B  | headline                                                                                                                                                               |
| --------- | ---- | --- | --- | --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| chevreuse | T0   | 3   | 4   | 4   | Measured: **zero windows of any kind** in her canonical team — the A1 shred is self-only, and A4 + C6 are `manual` triggers with no value                              |
| linnea    | T0   | 2   | 1   | 6   | Her burst applies a phantom Geo (gcsim's burst deals no damage), and Lumi is an empty 25s bar whose cadence **is** authorable — it is constant 111f without Moondrifts |
| citlali   | T0   | 0   | 4   | 5   | Itzpapa under-applies ~30% on the wrong ICD group (`{90, every 2}`, authorable), her shreds are self-only, and C6 Cifra has no bar at all                              |
| iansan    | T0   | 1   | 3   | 6   | Her Nightsoul Charged Attack applies no Electro at all, and both casts apply at the cast instant (gcsim data exists on an unmerged branch)                             |
| yae_miko  | T0   | 0   | 4   | 4   | Fresh Revelation edit left C2's EM bar at 14s against a 24s summon; the Tenko Thunderbolts apply no Electro; C4 draws nothing                                          |
| odette    | T0   | 0   | 1   | 5   | Genuinely solid after today's Stage 4 — the one real gap is the Coda not restarting the Dance Double, so every later tick marker is misplaced                          |

**Two things that are bigger than this batch:**

1. **`onReaction` defaults to self-only.** Chevreuse and Citlali both author a
   team-wide reaction debuff with no `source`, and it silently never draws.
   Worth a corpus grep for `"type": "onReaction"` without a sibling `"source"`.
2. **Two gcsim characters are reachable on unmerged branches.** `efebba93a`
   (Linnea, full kit) and `dea44df4e` (Iansan, full kit) are in the local clone's
   history and readable with `git show <sha>:path` without leaving `main`. The
   repo already established the unmerged-PR precedent at `2627c5a2` (Illuga) and
   `8e9a63df` (Kachina) — these two would close most of the S/A gaps above.
3. **`docs/curation/capability-audit.md` and `capability-sweep.md` are stale**
   (last regenerated 2026-08-31, before the Odette/Cryo-Traveler work). Odette is
   still listed as an uncurated stub with a physical resShred she no longer has.

---

<!-- batch 3 -->

## Batch 3 — data-gap scoping: lauma · mona · nicole · sucrose · cyno · flins

Method: whole-file read of each character JSON; `~/Code/gcsim` @ `ac2d76dde` source read (skill/burst/attack/charge/asc/cons per character, plus `pkg/core/attacks/icd_groups.dm.go`); the four committed curation reports; and a throwaway `parseNotation` probe (deleted — repo left clean, no file modified). Measurements below marked "measured" came from the probe.

Two cross-cutting facts established while probing, which several findings depend on:

- **A variant with no `application[]` INHERITS the base ability's** (`src/lib/sim/run.ts:909`, `variant?.application ?? active.application`) — but a variant with no `summons` also inherits (`src/lib/sim/summons.ts:102`). Mona's curator note claiming an omitted variant `summons` would be "silently dropped" is **wrong**; Lauma's hE inheriting the Sanctuary is fine, but Flins's `sQ` inheriting the base burst's four-entry application list is not.
- **`[icd]` in `gcsim-frames-diff.md` §4 cannot distinguish "the ICD suppressed it" from "the hit carries no `Durability`."** `scripts/gcsim-dump/main.go:114-117` records durability _only when an application actually landed_, and `scripts/audit-gcsim-frames.mjs:609` prints `[icd]` for any non-physical hit that did not apply. The §4 instruction "still a NOMINAL application and is still authored" is right for the first case and wrong for the second. This is the root of Flins's largest defect and is worth stating in the report's own legend.

Also worth flagging: **rubric N12 is stale.** `docs/curation/engine-capability-rubric.md:N12` says Lunar-Bloom, Lunar-Charged and Stellar Swirl are never emitted. `src/lib/sim/reactionBridge.ts:72-85` emits all three when an enabler is in the party, and I measured `lunarBloom` firing for Lauma and `lunarCharged` (plus a Thundercloud gadget) for Flins. Only `shatter` remains unemitted.

---

### lauma (Lauma) — T0

**Status:** curated; frames from gcsim main (the whole kit is implemented there); skill + burst `application[]` authored and matching §4; summon cadence matches the oracle **exactly** (§5 row 536: 62f/117f ×8, 8/8 `none`). But the burst — the character's entire payload — draws nothing, and the charged attack is modelled as the wrong ability.

**Gaps**

- **[S]** **The burst renders as an instant pill with no window and no effect.** `effects: []`, no `activeDuration`. Pale Hymn is 18 stacks at 15s each (gcsim `burst.go:110-117` `setPaleHymnBurst(18)` + `AddStatus(burstKey, paleHymnDur=900)`), and it is the reason anyone brings her. Measured: `Lauma E Q` produces **no burst window at all**. — evidence: `src/lib/data/characters/lauma.json` burst `effects: []` + probe; fix: `activeDuration: 15` on the burst gives the Pale Hymn window a span today (the shield/summon-split field, exactly the Nicole-burst precedent). The per-stack reaction-DMG increase is EM-scaled magnitude and correctly stays out.
- **[S]** **`C` is modelled as a damaging Dendro charged attack using the DEER-TRANSFORM frames.** The authored `chargeFrames` `{anim:64, N:61, C:63, E:63, Q:63, J:49, swap:49}` is byte-for-byte gcsim's `deerFrames` (`charge.go:29-38`), not the charged attack. The real Spiritcall Prayer CA is `chargeFrames = InitAbilSlice(68)` with every cancel key at 67 and `chargeHitmark = 73` (`charge.go:40-45, 66-78`). `deerStateReady` starts **true** (`lauma.go:34`), so the first `C` in any rotation is a non-damaging 10s transformation. Measured: `Lauma C C` draws two charged blocks of 63f and 49f, each carrying one Dendro application. In game the first applies nothing. The curator note on the normal ability ("chargeFrames here records Spiritcall Prayer only") is inverted and will mislead the next author. — evidence: lauma.json normal `chargeFrames` + `_curatorNotes[0]` vs gcsim `charge.go`; fix: re-author `chargeFrames` to `{anim:68, hit:73, N/C/E/Q/D/J/swap:67}` today and caveat the transformation; drawing the 10s Spirit Envoy state itself needs a second charged-attack form gated on a cooldown — engine work (same class as rubric N15).
- **[A]** **`hE` applies Dendro 29 frames early.** The Hold variant authors no `application[]`, so it inherits the tap's `{frame:16}`; gcsim's Hold hitmark is 45 (`skill.go:24 skillHoldHitmark`), and the frame-16 Lunar-Bloom hit it inherits carries **no `Durability`** (`skill.go:121-133`) so it applies nothing. Measured: `Lauma hE Q` → first application at 0.27s. — evidence: run.ts:909 + gcsim skill.go; fix: `application: [{frame:45, element:'dendro', units:1}]` on the hE variant, authorable now. ⚠ The oracle cannot check this — `gcsim-frames-diff.md:474` records the driver failing with "Cannot use Skill Hold without Dew", so it has to be read from source.
- **[A]** **Verdant Dew and Moon Song are wholly unmodelled**, so `hE` is always available and always the empowered form. gcsim refuses Hold with zero Dew (`skill.go:105-108`), and each Dew consumed grants a Moon Song stack → 6 Pale Hymn each on the burst (`skill.go:168-200`). — fix: Dew is a _player-level_ team resource fed by Lunar-Bloom; `gainStacks` is character-scoped even at `scope: 'rotation'`, so this needs a team-resource primitive — engine work. Worth a caveat on the skill today.
- **[A]** **A1 "Light for the Frosty Night" draws nothing** — the 20s post-E window is a team **reaction-CRIT** buff at both Moonsign tiers (Nascent: Bloom/Hyperbloom/Burgeon CR fixed 15% / CD fixed 100%; Ascendant: Lunar-Bloom CR +10 / CD +20, `asc.go:33-75`). The passive has no `effects`. — evidence: `src/lib/types/ability.ts:159-169` has the bucket-5 `*ReactionBonus` family and **no reaction-CRIT flavour**; fix: a `*ReactionCritRate` / `*ReactionCritDmg` family on the exact bucket-5 precedent (Nate's 2026-07-29 "authorable — we visualize, we don't compute" ruling), after which the 20s `onCast skill` team window is ordinary authoring. Small schema round.
- **[B]** **C2's Pale Hymn half is half-authored**: one `manual` damage effect (500% EM, the Bloom path) with the **400% EM Lunar-Bloom path missing entirely** (`cons.go:102-114` has both). Three `manual` effects total across C2/C6 — all magnitude, all reaching no surface (rubric N1) — yet `deriveCapabilities` filters by effect TYPE, so they still shape TB claims.
- **[B]** **C4's energy refund is unauthored** and the sweep already files it: `capability-sweep.md:118` "wiki attributes energy (C4) — nothing derives". gcsim `cons.go:118-127` gives 5 on a 5s ICD; the kit text says 4 (the JSON's note flags the discrepancy). `energy` effects reach no planner surface, but they do derive a TB capability. Authorable today as `energy` / `onHit skill` / `procCooldown: 5` / `amount: 4`.
- **[B]** No plunge frames (gcsim has no `plunge.go`); `interruptionRes` for the Spirit Envoy state not derived (`capability-sweep.md:119`).

**Improvements:** the Frostgrove shred is the best part of this file — the summon-tick `onHit` pass extends it to 24.68s off the last tick, which is exactly gcsim's behaviour (ticks re-apply via `applySkillShredCB`). The C6 tick's `Durability: 0` is correctly recorded as applying nothing. Two small polish items: the first shred window starts at the cast (0.00) rather than the skill hitmark (0.27), and the burst is missing the "Basic Duration"-style window above.

**Confidence:** high on frames, applications and the summon (oracle + source + probe agree); medium on the right shape for the deer state.

---

### mona (Mona) — T0

**Status:** curated; frames from gcsim; full application coverage including the 2U explosion; the Phantom's four ticks are capped and the §5 verdict is `standard` (2/4), matching. The kit's _visible_ mechanics are modelled about as well as the engine allows; what is left is enemy-state-shaped.

**Gaps**

- **[A]** **The bubble EXPLOSION's 2U Hydro application is drawn ~8s late.** `application[2] = {frame: 588, hydro, 2U}` is the _timeout_ path — gcsim queues the break attack at `burstHitmark + 480` only as a fallback and `triggerBubbleBurst` fires on the first impulse damage (`burst.go:63-72, 107-140`). Measured: `Mona E Q N3 C` → `10.27 hydro 2U`. In any real team the bubble pops within a second of landing, so the aura lane shows a large Hydro spike at the wrong moment. — evidence: mona.json burst `application`, gcsim burst.go; fix: needs enemy state (rubric N11/N14) — engine work. ⚠ This half is **not** in the existing caveat, which talks only about the DMG-bonus bar; a sentence is cheap and honest.
- **[A]** **The +60% Omen bar is cast-anchored 5s**, and the 8s Illusory Bubble summon bar runs its full length regardless. In game the bubble lands at 1.78s and the 5s Omen starts when a hit pops it. — evidence: mona.json burst `caveat` + `caveat-open-items.md` row "Mona | Burst"; fix: `terminatesOn: {type:'trigger'}` + sequential-spawn semantics — deferred schema work, correctly caveated today.
- **[A]** **C1 draws nothing at all** despite three of its six bonuses (Electro-Charged, Lunar-Charged, Lunar-Crystallize) having bucket-5 stats. The blocker is the TRIGGER, not the stat: "any party member hits an Omen-affected opponent" needs an enemy-status Condition, and `enemyAffectedBy` returns null (`src/lib/sim/conditions.ts:201-210`, rubric N11). — the JSON's own 2026-08-18 note has this exactly right; nothing to fix, but a C1 owner sees a blank.
- **[B]** C4's two bars render as permanent team chips; in game both are Omen-gated and the CRIT DMG half reaches Hexerei members only. Caveated.
- **[B]** C6 is a single `manual` effect → no surface (rubric N1); the 3-stack ramp is unmodelled.
- **[B]** A1's auto-Phantom on dash is unmodelled (`asc.go:28-62`, recursive 2s dash check) — a `D` token produces no phantom. Out of reach.
- **[B]** Hexerei Secret Rite: the Omen refresh budget (4 × 2s) would run the Omen to ~13s in a 2-Hexerei party, more than doubling the drawn bar. `durationExtensions` on `onHit` is on the CANNOT list; recorded on the normal ability, caveat removed 2026-08-19.
- **[B]** The hold variant's curator note claims an absent variant `summons` would be "silently dropped" — **false** (`sim/summons.ts:102`). Harmless here (it restates) but it will mislead.
- **[B]** No `plungeFrames` although `input` advertises `P`; gcsim has no `plunge.go`.

**Improvements:** the `tickCap: 4` record is exemplary and needs nothing. The only tightening available is the extra caveat sentence about the explosion's timing.

**Confidence:** high — every claim is source-read plus a probe measurement.

---

### nicole (Nicole) — T0

**Status:** curated; frames from gcsim main; both casts carry `application[]`; shield, the Grace→Guidance ladder, `onFieldDelay` with both waivers, C2/C4/C6 all authored. The best-covered file in this batch. The residue is `maxProcs`-shaped and one corpus-wide pooling defect.

**Gaps**

- **[A]** **The Arcane Projections are invisible as events.** The burst draws a 20s `activeDuration` span and nothing inside it: the 3s proc cadence and the 4-per-burst cap have no primitive (rubric N3, and the JSON names itself as one of the three `maxProcs` requesters). ⚓ The "applies no element" half is **settled** (Nate, 2026-08-18) — do not reopen it; the missing pixel is the cadence, not the application. — evidence: nicole.json burst effect `_curatorNotes`, `sim/procs.ts:157` (a damage effect with no `application[]` is never armed); fix: `maxProcs` + a proc marker lane — engine work.
- **[A]** **C4's Pathfinder's Blessing bar is a flat 20s** when in game it is consumed after 8 instances (faster against several opponents) and re-gated at 16s per character. — evidence: `caveat-open-items.md` row "Nicole | C4"; the entry-level caveat exists and is accurate; fix: `maxProcs` — engine work.
- **[A]** **A4 Philokalia is anchored at Nicole's own E and Q casts**, not at teammates' elemental hits. A passive-hosted `onHit` with no `trigger.abilityType` is excluded from the N/CA/P pass (`utils/effectCollection.ts:352-366`) and admitted for `castType skill|burst`, and `onHitTriggerMatches` is never called on the character-buff path — so `source: 'active'` and `damageType: 'elemental'` are both inert. Measured: `Nicole E Q > Bennett E Q` draws the +300 ATK bar at 0.00 and 0.53 (her own casts). — evidence: the effect's own `_curatorNotes` and the entry-level caveat both state this correctly; it is corpus-wide (rubric P2), not Nicole's to fix.
- **[B]** C6's "Guidance no longer reverts" is unmodelled — one `active`-target effect cannot say four members hold it at once. Caveated on the A1 passive with the "at C6" prefix, which is the right call given `slotCaveats` has no level for a passive host.
- **[B]** C2's element-varying RES shred renders as All-Elemental for a flat 20s. Caveated.
- **[B]** **`capability-audit.md:26` carries a stale expectation**: "expected shield target=team, derived targets: active". That expectation is now deliberately wrong — the C2 shield is co-op-only and unmodelled by ruling (`docs/constellation-shield-gap.md` §7.3, and the rubric's FROZEN list says it "needs no caveat"). The fixture should be updated so the audit stops reporting a closed decision as backlog.
- **[B]** No `plungeFrames` although `input` lists `P` (gcsim has no `plunge.go`).
- **[B]** `data-outliers.md:33` flags C1's `scaling: 600` as a magnitude outlier — correct as authored (gcsim `cons.go` `Mult: 6`), benign.

**Improvements:** nothing material. Four effect-level caveats were promoted to entry level in the ruthless pass and the remaining effect-level `_curatorNotes` are accurate and well-sourced.

**Confidence:** high.

---

### sucrose (Sucrose) — T0

**Status:** curated; frames and applications match gcsim; the burst tick series is capped 3 / 4-at-C2 with `icdGate: 'none'` and matches §5 exactly (3/3 `none`); A1 and A4 were both corrected in the 2026-08-15 pass (target, scaling form, snapshottable); Hexerei `factionBonuses` authored. Genuinely solid — the residue is one unmodellable mechanic and one `manual` effect.

**Gaps**

- **[A]** **Elemental Absorption is wholly unmodelled**, so the Large Wind Spirit's tick markers all read Anemo. gcsim queues a parallel absorbed-element attack on the same 113f cadence (`burst.go:52-85`). — evidence: rubric N13 ("grep for `absorb` over src/lib returns no sim path"); fix: an absorbed-element resolution primitive — engine work.
- **[A]** **C6 is a `manual` effect, so at C6 the burst draws NO team DMG-bonus bar at all** — while the Team Builder _still claims_ Sucrose is a C6 team `allDmgBonus` buffer, because `deriveCapabilities` filters by effect TYPE and never looks at the trigger. Two surfaces disagreeing about the same constellation. — evidence: `caveat-open-items.md` row "Sucrose | constellation caveat (C6)", and the JSON's own verified 2026-08-18 note; fix: blocked on the absorbed element, not on the trigger — the surrounding machinery (constellation gating at collection, `onCast` buffs) would carry it.
- **[B]** **The C6 duration in the curator note is wrong**: it says "6s base / 8s at C2+", but gcsim `cons.go:49` uses `modifier.NewBaseWithHitlag("sucrose-c6", 60*10)` = **10s**. One of the two is mis-sourced; check before C6 is ever upgraded to a real trigger.
- **[B]** C4 (E CD −1..7s per 7 N/CA hits, `cons.go:12-40`) is unauthored. `cooldownReduce` is schema-and-lint-only with zero corpus authors (rubric N2) and the magnitude is a die roll — not honestly authorable.
- **[B]** **TB Compare draws FOUR tick marks for the Large Wind Spirit at C0 where the timeline draws three** — `DerivedCapability.summon` carries no tick cap and Compare re-derives from interval-until-uptime. Documented in the JSON; still a live cross-tool disagreement a Sucrose player can see.
- **[B]** The A1 EM buff renders for the whole team; only element-matching members receive it and Anemo characters never do. Caveated (and the target was already corrected from the outright-wrong `self`).
- **[B]** `genshin-db-text-diff.md:30` records A1 gaining "Stellar Swirl". Already authored in the reaction OR-array, and `stellarSwirl` **is** emitted now (`reactionBridge.ts` CONVERSIONS `cryoSwirl → stellarSwirl`, `mode: 'replace'`). ✅ Listing both sides is safe here precisely because the mode is `replace` — worth stating so nobody "fixes" it.
- **[B]** `plungeFrames` / `lowPlungeFrames` still carry the original ingest's "reviewer should confirm" flags, and the high-plunge values live only in a note.

**Improvements:** the `tickCap` note (including the explicit ⛔ against nudging the 6s duration) is a model entry. Nothing to tighten.

**Confidence:** high.

---

### cyno (Cyno) — T0.5

**Status:** curated; base + in-stance ability pairs, the two-cooldown model, `opensTransientState` for the 7.x Revelation passive (**ahead of gcsim**, which still gates `skillB` on `burstKey` alone), and the Stellar half authored under the bucket-5 ruling. Two concrete, fixable defects, one of them the character's signature buff.

**Gaps**

- **[S]** **The in-stance N5 FrameMap is inverted and missing its hitmark.** Authored `{anim: 40, N: 62, swap: 40}`; gcsim is `InitNormalCancelSlice(attackBHitmarks[4][0]=40, 62)` with **no override** (`attack.go:102, 124`), which is `{anim: 62, hit: 40}`. `anim` is the fallback for every unlisted key, so an in-stance `N5 → C/E/Q/D/J` resolves **40 frames instead of 62** (0.37s short each), and the swing carries no `hit` at all — a lint-shape violation for a normal swing. — evidence: `cyno.json` `pactsworn_pathclearer.hits[4]`; `gcsim-frames-diff.md:111` lists exactly this map under "**not captured** (N5@state-inStance)", which is why the oracle never caught it; fix: `{anim: 62, hit: 40}`, authorable today. (I re-derived all eight other Cyno normal FrameMaps against gcsim — every one matches.)
- **[A]** **The burst's +100 EM self-buff is unauthored.** The official talent table carries it as a named row — `docs/curation/talents/cyno.json` burst rows, "Elemental Mastery Bonus": `100` at every level — and gcsim adds it as a 712f `StatMod` (`burst.go:36-45`). Cyno's whole identity is an EM-scaled self-buffer and there is **no bar for it anywhere**. — fix: one `buff` / `target: 'self'` / `stat: 'em'` / `value: 100` / `onCast burst` / `duration: 11.87` — ordinary authoring, today. This is the highest-value single edit in the batch.
- **[A]** **Judication's Duststalker Bolts apply Electro and we model none.** `skillB` reuses the Mortuary Rite `AttackInfo` (`Durability: 25`) for the three bolts, re-tagging them `ICDTagElementalArt` / `ICDGroupCynoBolt` — timer 150f, element sequence `{1,0,0,…}` (`skill.go:115-145`; `pkg/core/attacks/icd_groups.dm.go:97, 163`) — a counter _separate_ from the cast's `ICDTagNone`, so each Judication adds one extra 1U Electro application. Endseer is up 84f every 234f, first at cast+328f (`asc.go:23-29`), so in a real burst rotation this recurs. Measured: `Cyno Q E N4 E N4 E` yields three Mortuary applications and no bolts. — fix: not authorable today (Judication has no gate primitive — an internal cadence plus player timing); an honest caveat on the A1 is the move, and note that the current A1 caveat was _removed_ in the ruthless pass on the grounds that the bolts "cost the aura lane nothing", which is **wrong** — they carry 25 durability.
- **[A]** **C2's base half is unauthored** (+10% Electro DMG per Normal hit, 4s, max 5, 0.1s ICD — `cons.go:47-77`) although the engine supports the shape exactly: an `onHit` `gainStacks` on `electroDmgBonus` with `procCooldown: 0.1`, which `dispatchGainStacksOnHit` honours per `${src.id}#${effIdx}`. The JSON's own note calls it an implement candidate. Authorable today.
- **[B]** C1's Together We Rise duration (11.87s) is an inference — no published timer. Caveated correctly.
- **[B]** C1 is granted on entering Pathclearer from **either** source, but is authored on the burst only, because an `onCast skill` trigger cannot tell the base skill from Mortuary Rite (same E token). So a skill-opened 6s Pathclearer gets no +200 EM.
- **[B]** C4's base half (3 Energy to everyone else, 5× per burst) unauthored — no `maxProcs`; `energy` effects reach no planner surface either way.
- **[B]** C6 unauthorable: the work item is `procCooldown` gating in `dispatchConsumeStacksOnHit` (deliberately unspecified today), and the bolts are magnitude.
- **[B]** `data-outliers.md:24` flags C2's `80` as a magnitude outlier — deliberate (stacked-at-max, the Noelle/Mona-C6 precedent), benign.
- **[B]** `capability-sweep.md:86` "wiki attributes interruptionRes (Sacred Rite) — nothing derives".

**Improvements:** the two-cooldown model (7.5s base / 3s Mortuary Rite, separate clocks) matches the official table — and is _better_ than gcsim, which sets 7.5s on both. `durationExtensions` (+4s, max 2) matches gcsim's `burstExtension < 2` exactly. Measured `Cyno Q E N4 E N4 E` → `inStance 0.00→19.87s`, correct.

**Confidence:** high on the N5 and the missing EM (source + official talent table + probe); medium on how the bolts should be surfaced.

---

### flins (Flins) — T0.5

**Status:** curated; stance + `sQ` wired through the transient-state primitive; Moonsign effects, the separate Spearstorm cooldown and the C2 element-filtered shred all correct. But the **application schedule is materially over-stated in three places**, which matters more for him than for anyone else in this batch: he is a Lunar-Charged _enabler_, so a phantom Electro application manufactures a phantom reaction, a phantom Thundercloud, and (at C1) phantom energy.

**Gaps**

- **[S]** **Tap E applies 1U Electro where the game applies nothing.** gcsim `skill.go:68-77` queues `"Arcane Light (0 dmg)"` with `AttackTagNone` and **no `Durability`** — it exists only to stack PJWS. Our `application: [{frame: 19, element: 'electro'}]` has no `units`, so it becomes a provisional 1U. Measured (`Xingqiu E Q > Flins E E Q`): a `lunarCharged` reaction at **2.23s** and a Thundercloud gadget spawned off it — both phantom; the first real reaction is the Spearstorm's at 2.67s. — fix: `application: []`, the positive "applies nothing" claim. Authorable today.
- **[S]** **The burst's mid and final Lunar-Charged hits are authored as applications but carry no gauge.** Only the initial hit has `Durability: 25`; the two mid hits and the final hit are `AttackTagDirectLunarCharged` with no durability (`burst.go:64-88`). Measured: `Flins E E Q` produces **two** burst Electro applications (cast+93 and cast+164) where the game produces one — the frame-164 entry survives because the per-cast standard ICD sequence `{1,0,0}` wraps on the fourth entry. — evidence: `gcsim-frames-diff.md:265` labels 110/119/164 `[icd]`, but see the legend caveat at the head of this report: the oracle **cannot** tell a suppressed hit from a zero-durability one. Same class as Nicole's Arcane Projection, which Nate already ruled applies nothing; fix: trim `application[]` to the single frame-93 entry, authorable today.
- **[S]** **The `sQ` variant inherits the BASE burst's four-entry `application[]`.** Thunderous Symphony's single hit is at frame 44 and carries no `Durability` (`burst.go:100-115`). Measured: `Flins E E sQ N5` puts Electro applications at cast+93 (2.38s) and cast+164 (3.57s) for an ability whose only hit lands at 0.73s — two applications that should not exist, at times that correspond to nothing. — evidence: `sim/run.ts:909`; fix: `application: []` on the `sQ` variant, authorable today.
- **[A]** **The plunge caveat retargeting never landed.** `P` is refused in Manifest Flame but the parser accepts the token and draws a block. The 2026-08-19 ruthless pass explicitly kept this as a real pixel and instructed a rewrite onto the drawn block (Kinich's phrasing) — the caveat is simply gone now. — evidence: flins.json in-stance normal `_curatorNotes` last entry, no `caveat` on the entry; fix: write the caveat, today.
- **[A]** C2's Devil's Wall (next NA after Spearstorm, +50% ATK as Lunar-Charged DMG, 6s) unauthored — Tier-2 frozen by ruling, correctly held. C4's A4 upgrade (10% ATK→EM, cap 220 vs the base 8%/160) unauthored — needs a constellation replace-form for a scaling `BuffValue` (rubric N9 neighbourhood); the effective under-count is ~60 EM in every C4+ rotation, which the JSON's note states.
- **[B]** Moonsign: Ascendant Gleam adds two extra mid-phase hits (`burstHitmarkMid[2..3]` = +35/+44) and the `sQ` an extra hit at +62 gated on a live Thundercloud; neither is in `application[]`. All zero-durability, so no aura impact — the divergence is only the hit count.
- **[B]** A1's ATK-scaled Lunar-Charged base-DMG bonus (0.7% per 100 ATK, cap 14%, `asc.go:60-90`) unauthored — magnitude, correctly out.
- **[B]** ⚠ **`gcsim-frames-diff.md:57` lists the base burst's FrameMap as disagreeing** (`N 102→53, E 103→53, D 103→51, J 103→50, swap 91→81`). **That row is an ORACLE ARTEFACT, not our error** — the dumper's driver had Flins in Manifest Flame, so `Burst()` returned Thunderous Symphony, and the "gcsim" column is our own `sQ` variant's numbers. Our authored values match `burstFrames` exactly (`burst.go:28-35`). ⛔ Do not let `migrate-frames-shape.mjs` resolve this row "in gcsim's favour" — it would give the base burst the `sQ`'s frames. Worth a `GDB_CD_KNOWN_WRONG`-style suppression or a note at the row.
- **[B]** No `plungeFrames` although the base normal advertises `P`; gcsim has no `plunge.go`.
- **[B]** `capability-sweep.md:95` "wiki attributes interruptionRes (Ancient Rite) — nothing derives".

**Improvements:** the `sQ` wiring, the separate Spearstorm cooldown with the C1 `cooldownModifiers` entry, and the C2 per-swing element-filtered shred are all correct and measured. The three application trims above are small edits with a large visible payoff on the aura lane.

**Confidence:** high — every application claim is a gcsim source read confirmed by a probe measurement; high on the frames-diff artefact reading.

---

### Batch summary

| id      | tier | #S  | #A  | #B  | one-line headline                                                                                                                                                       |
| ------- | ---- | --- | --- | --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| lauma   | T0   | 2   | 3   | 3   | The burst draws nothing at all, and `C` is authored with the deer-transform frames instead of the charged attack.                                                       |
| mona    | T0   | 0   | 3   | 5   | Solid; the residue is enemy-state-shaped, but the bubble explosion's 2U Hydro lands ~8s late on the aura lane and is not caveated.                                      |
| nicole  | T0   | 0   | 3   | 4   | Best-covered file in the batch; everything left is `maxProcs` or the corpus-wide character-`onHit` pooling defect.                                                      |
| sucrose | T0   | 0   | 2   | 6   | Solid; absorption is unmodellable and C6's `manual` effect makes the TB and the planner disagree at C6.                                                                 |
| cyno    | T0.5 | 1   | 3   | 5   | The burst's signature +100 EM is unauthored, and the in-stance N5 FrameMap has `anim` and `N` inverted with no `hit`.                                                   |
| flins   | T0.5 | 3   | 2   | 4   | Three separate over-authored application lists manufacture phantom Electro applications — and he is a Lunar-Charged enabler, so they manufacture phantom reactions too. |

**Cheapest high-value edits, ranked:** (1) Flins's three `application[]` trims — tap E `[]`, burst → one entry, `sQ` `[]`; (2) Cyno's burst +100 EM buff; (3) Cyno's stance N5 `{anim: 62, hit: 40}`; (4) Lauma's burst `activeDuration: 15`; (5) Lauma's `hE` `application: [{frame: 45, dendro, 1U}]`; (6) Lauma's `chargeFrames` → the real Spiritcall Prayer CA. All six are authorable today with no engine work.

**Report-level follow-ups** (not character data): flag Flins's `gcsim-frames-diff.md:57` row as an oracle artefact before any migration run; refresh `capability-audit.md`'s Nicole shield expectation against the co-op ruling; and refresh rubric **N12**, which is stale — `lunarBloom`, `lunarCharged` and `stellarSwirl` are all emitted today.

---

<!-- batch 4 -->

## Batch 4 — Prydwen T0.5 data audit (2026-09-15)

Characters: `skirk`, `traveler_cryo`, `varka`, `wriothesley`, `yumemizuki_mizuki`, `durin`.
Method: whole-file read of each JSON + talent sidecar, gcsim `ac2d76dde` source read per character
(`skill.go`/`burst.go`/`attack.go`/`charge.go`/`asc.go`/`cons.go` + `pkg/core/attacks/icd_groups.dm.go`),
all six curation reports grepped, and a throwaway `parseNotation` probe (written to `scratch/`, run, deleted
in the same turn). No repository file was modified.

⚠️ **Honesty baseline used throughout:** the 2026-08-19 ruthless pass deleted 141 caveats under a
Nate-approved site-wide ruling that _an unrendered buff leaves no noticeable blank_. So a missing caveat
on an "expected-but-absent" gap is a **ruling, not an oversight** — I only flag caveat prose where the
text is now **false on screen**.

---

### skirk (Skirk) — T0.5

**Status:** fully curated. All FrameMaps match gcsim exactly (absent from §2 _and_ §3). `application[]`
authored on both bursts, including `[]` on Havoc: Extinction — which §4 confirms as the correct positive
claim (gcsim `BurstExtinction` queues no attack). Serpent's Subtlety is genuinely tracked and drained.
gcsim coverage complete.

**Gaps**

- **[S] The E's cooldown starts at the CAST; gcsim starts it at STANCE EXIT.** gcsim
  `skill.go exitSkillState()` → `SetCD(action.ActionSkill, 8*60)`, and `skirk.go ActionReady` refuses E
  outright while `skillKey` is live. Measured: `Skirk E …` → cast event `cooldown 480f`, `readyAt 480f`
  (8.00 s) against `uptime 754f` (12.57 s); `Skirk hE E` places a second E at **8.00 s**, inside a window
  where the game has not even started the clock. The ghost CD tail therefore ends ~4.6–12.6 s early on the
  single most-used bar of the character. _Fix:_ `cooldownStartsAtStanceEnd: true` on
  `skirk__skill__havoc_warp` — the Xilonen/Ifa primitive (`src/lib/types/ability.ts:2149`,
  `isCooldownAtStanceEnd` at :2427), already honoured by the parser. **Authorable today**; lint D.22's
  `durationExtensions` exclusion does not bite (Skirk has none).
- **[S] The stance bar is drawn at its 12.57 s maximum; SS depletion ends it at ~6.4 s (C0) / ~7.9 s (C2)
  — and our own engine already computes that.** gcsim `serpentsReduceTask` drains 1.4 SS per 12 f (7/s) and
  calls `exitSkillState` at zero. Measured `Skirk E ~7s Q` → stack snapshot **0** at 7.48 s while the
  `state` window still runs to 12.57 s. Everything keyed to that duration is equally long: A4's +70 %
  Normal DMG and C4's +40 % ATK both carry `duration: 12.57`. No caveat names the stance length (the
  skill's only caveat is about hold-E). _Fix:_ engine — a drain-driven state end; belongs in the open
  E3 v2 drain round (`project_e3_v2_handoff`). ⛔ Don't shorten `duration` to 6.43 — void-rift absorption
  genuinely extends it, so the max is not wrong, the _termination rule_ is missing.
- **[S] A swap destroys the Serpent's Subtlety pool, in two different wrong directions.**
  Measured at C0: `Skirk E N3 > Fischl E > Skirk Q` → the stance correctly ends on swap at 1.28 s, but the
  burst's stack snapshot reads **0** (should be ~36), so the +Burst DMG bar silently never draws.
  `Skirk hE > Fischl E Q > Skirk Q` → snapshot **undefined**, so the `stacks {min: 51}` gate fails OPEN and
  the bar draws with nothing behind it. ⚠️ This _updates_ `caveat-open-items.md §3`, whose single measured
  case was the fails-open one; the commoner shape today is the silent zero. _Fix:_ `gainStacks.scope:
'rotation'` on all three `serpentsSubtlety` grants **plus** drain semantics across a segment boundary —
  Skirk's own note flags this "⏭ UNBLOCKED, NOT DONE" and explicitly refuses a ride-along, because SS is
  the corpus's only drain-bearing key.
- **[S] At C2 an in-stance `Q` draws the OTHER burst's bonus bar.** Measured `Skirk E Q` at C2: the Q
  resolves to `skirk__burst__havoc_extinction` (correct), SS = 51.38, and a `burstDmgBonus` perStack window
  draws 0.52→3.12 s — that effect belongs to **Havoc: Ruin**, which Extinction is explicitly not (gcsim
  `BurstExtinction` consumes no SS and carries no bonus). Cause: `collectOnCastEffects` matches on
  `src.abilityType === castType` and never evaluates the sibling ability's own `conditions`
  (`engine-capability-rubric.md:455/457` — Skirk is one of four live carriers). _Fix:_ engine.
- **[A] C2's SS cap raise (12 → 22) reaches no surface.** `BuffEffect.constellationScaling` is read only by
  `sim/stacks.ts` (gainStacks amounts) and `sim/summons.ts:211` (tick caps), never by `buffWindows.ts` /
  `buffDisplay.ts` (rubric:524). So a C2 reader sees the base cap printed. The data shape is right; the
  reader is missing. _Fix:_ engine.
- **[A] The whole Void Rift chain (A1 + C1 + C6) is a deliberate gadget stub, and its one visible
  consequence is now uncaveated.** Each unabsorbed rift is +8 SS, and SS is the number printed on the
  burst's perStack bar — so the printed % undercounts. The ruthless pass deleted that caveat; given the
  bar now genuinely prints a tracked value, this is worth re-judging at the next caveat pass.
- **[B] `P` is a silent no-op.** `skirk__normal__havoc_sunder` lists `P` in `input` but has no
  `plungeFrames`; measured `Skirk P` → `unknownTokens: []`, **zero** action events, zero time cost. The
  in-stance chain has no `P` at all, so a plunge inside the stance is also dropped.
- **[B] Two stale curator numbers.** The burst note says "`ConsumeSerpentsSubtlety(0)` drains all SS on
  cast" — gcsim main is `ConsumeSerpentsSubtlety(7, burstRuinKey)`, a 7-frame _delayed_ drain. And the
  skill note's "~7.86 s drain at C0" conflates the rungs (C0 is 45 / 7 = **6.43 s**; 7.86 s is C2's 55 SS).
- **[B] CA hit counts are approximated.** Out-of-stance CA is 2 hits and **Physical**
  (`charge.go` `Element: attributes.Physical`) — correctly applies nothing. In-stance CA is 3 Cryo hits
  (`chargeSkillHitmarks {28,37,46}`) drawn as one swing; measured `Skirk E C C` gives 1 application where
  gcsim gives 2 (its `ICDTagExtraAttack` counter lets the 4th hit through).

**Improvements:** `hit` present on both normal chains; `terminatesOnSwap` verified against gcsim
`onExitField`; the A4/C4 `teamElementCount` approximation is caveated and accurate in framing.

**Confidence:** high — gcsim read in full, every claim above measured through `parseNotation`.

---

### traveler_cryo (Cryo Traveler) — T0.5

**Status:** deliberately uncurated (`curated: false`, `FRAMELESS_EXEMPT`) — no E/Q FrameMaps, no
`application[]`, by design. Normals derived from the six sibling Travelers (three independent agreements,
documented). The Frostpierce Star cadence and the Frostglow stack chain were authored **today** from gcsim
**draft PR #2742**, which has no main-branch oracle. (Radiance / Polestar-Field behaviour excluded per
`docs/radiance-window-round.md`.)

**Gaps**

- **[S] The Star's two crystal series each get their OWN ICD counter, so the Star applies Cryo twice per
  tick.** Our summon ICD key is per SERIES — `aura.ts:884`,
  `` `${char.id}:summon:${summon.label}:${series.index}` `` — and the two crystals are authored as two
  series 3 frames apart (`firstTickDelay` 1.25 / 1.30). Measured `Cryo Traveler E Q` at C0: applications at
  **1.25 and 1.30, 4.25 and 4.30, 7.25 and 7.30, 10.25 and 10.30** = 8 crystal applications. In gcsim both
  crystals carry the same `ICDTagElementalArt` / `ICDGroupDefault` (the summon's own curator note says so),
  i.e. **one** counter: 150 f timer, sequence {1,0,0} over hits 3 f apart → **4** applications. We feed the
  gauge double, and the aura lane draws a pair of exactly-coincident pills per tick — the
  `polestar-field` §12 case that never separates at any zoom. _Fix:_ either author ONE series (interval 3 s,
  `firstTickDelay` 1.25) and accept one marker per pair, or teach the engine a shared counter for sibling
  series on one summon. ⚓ Worth deciding before this ages into the corpus — it was authored today and has
  no oracle to catch it.
- **[A] C2's +60 EM active-target buff is emitted twice per tick** for the same reason — measured 10 buff
  windows at C4 where the kit refreshes one 5 s window 5 times. They coincide within 3 frames so
  `mergeRefreshedBars` may fuse them visually, but the window count and the underlying refresh cadence are
  doubled.
- **[A] Neither E nor Q has an `application[]`,** so both apply the character's element at the CAST instant
  and are flagged provisional — measured `0.00cryo?` and `0.73cryo?`. The hitmarks _are_ stated by the same
  draft PR the cadence came from and are recorded in the JSON's own notes
  (`burstTickHitmarks 60/75/81/87/93` from `burstSpawnFrame 55`; skill 165.02 % ATK). Authoring them would
  remove two provisional pills and time them correctly. This is a **consistency decision** (the round took
  the cadence but not the hitmarks) rather than an oversight — but it should be a decision, not a default.
- **[B] C1's `energy` effect is authored into a dead channel.** `energy` has exactly one reader in `src`
  (`deriveCapabilities.ts:300`) and its Energy facet excludes `target: 'self'` (:628); no planner surface
  reads it at all. Durin's JSON records this explicitly; this one does not.
- **[B] Ever-Keen Frost's infusion window does not follow C4.** 12 s authored, while C4 takes the Star to
  15 s — so at C4 the infusion is 3 s short of the window the kit ties it to ("when a Frostpierce Star is on
  the field"). Documented in the notes, no caveat; structurally blocked (`durationModifiers` live on the
  summon, an `infuse` effect cannot read them).
- **[B] `docs/curation/capability-audit.md:14` is stale.** It still files `offFieldDamage` as the open
  backlog item to be resolved "by authoring the cadence". The cadence was authored today and the index
  already derives it (`characterIndex.generated.ts`: `{"kind":"offFieldDamage","detail":"summon"}`). Only
  the report needs regenerating.
- **[B] `P` is a silent no-op** (input lists `P`, no `plungeFrames`).

**Improvements:** the skill caveat is exemplary (names the draft source _and_ what is still untimed). When
PR #2742 merges: take the E/Q cancel slices, take the application schedules, re-verify the interval, and
settle the shared-ICD question above.

**Confidence:** medium-high. The over-application is measured and the ICD key is read from source; everything
upstream of it rests on an unmerged draft.

---

### varka (Varka) — T0.5

**Status:** curated; FrameMaps re-migrated against gcsim main (PR #2668 → `5d1ec8c79`) and clean in §2. The
only §3 row is `windbound_execution.variants[E]` ("no gcsim analogue") — correct, because gcsim models Four
Winds as a separate `action.ActionSpecialSkill`, not a skill variant. `application[]` authored on skill,
hold and burst.

**Gaps**

- **[S] Sturm und Drang Normal and Charged Attacks apply NOTHING.** This is the entire point of the stance:
  gcsim `attack.go skillAttack()` fires **two** hits per swing — the party's conversion element and Anemo —
  on two dedicated counters (`ICDTagVarkaNormalAttackElem` / `ICDTagVarkaNormalAttackWind`,
  `icd_tags.dm.go:88-89`), and `charge.go skillCharge()` does the same. We author one normal ability with no
  state gate and no infusion. Measured `Varka E N5 C` → **0 applications** from five swings plus a CA (only
  the E's own frame-40 Anemo lands). So a Varka rotation's aura lane is blank, and his own A4 / C4 / C6 —
  all Swirl-triggered — can never fire off his own attacks. It _is_ caveated on the normal ability
  ("Shown as Physical…"). _Fix:_ a state-gated in-stance normal per conversion element
  (`conditions: all[state inStance, teamElementCount …]` + `infusion`, the Cyno/Varesa pattern) is
  **authorable today** and would restore one of the two elements; ⚓ choose **Anemo**, since that is the half
  his own kit reads. The second hit per swing has no shape (`infusion` is one element per ability) and needs
  engine work.
- **[S] The burst applies Anemo ONCE where the game applies twice.** gcsim `burst.go:40` tags both hits
  `ICDTagNone`, and §4 marks both `+112 anemo (1U)` and `+131 anemo (1U)` as applied. Our engine always runs
  a cast's `application[]` through the standard counter (`resolveActionIcd` returns `STANDARD_ICD_FRAMES`
  for `skill`/`burst`; a burst-level `noICD` is inert by the stated ICD-round ruling), so the second hit is
  suppressed — measured `Varka E N5 Q` → one anemo at 6.30 s. For an Anemo character whose whole kit keys
  off Swirl, a missing application is a missing Swirl. _Fix:_ engine — `application[]` has no per-cast ICD
  override.
- **[A] Four Winds' Ascension cannot be placed at all** — caveated, and measured: `Varka E E` puts the
  second E at **16.65 s**, after the 12 s stance has expired. gcsim gives it its own pool: 2 charges, 11 s
  each, all reset on stance entry, cut 0.5 s (1.0 s with 2+ Hexerei) per in-stance NA hit, max 15
  (`skill.go fourWindsCDRedCB`, `asc.go hexSkillCDReduction`). _Fix:_ re-author as a separate
  `inStance`-gated skill ability with `cooldown: 11`, `charges: 2` — the Flins pattern already named in
  `caveat-refresh-2026-08-18.md` item 6. **Authorable today**; the per-hit CD reduction is not.
- **[A] A4's Azure Fang's Oath prints a flat +7.5 %.** `stacks: {maxStacks: 4, durationModel: 'shared'}` has
  **no reader anywhere** (rubric:529, three authors corpus-wide), so a player who knows the talent gives up
  to +30 % reads 7.5 % and wonders. Same defect on C6's +20 % CRIT DMG per stack. _Fix:_ **authorable
  today** — a `gainStacks` key on the same swirl trigger (`max: 4`, `lifetime: 8`) plus
  `value: {type: 'perStack', …}`; the `onReaction` → stack-state sync already exists
  (`syncOnReactionToStackState`).
- **[A] A1 (Dawn Wind's March) is `trigger: 'manual'`** — reaches no planner surface at all, though it _is_
  an always-on ATK-scaling Anemo DMG bonus, exactly a chip/bar shape. In gcsim it is a permanent conditional
  stat mod (`AddStatMod`, `NewBase(-1)`), so `trigger: {type: 'passive'}` is the correct shape and is
  authorable today. (It nevertheless reaches the Team Builder — see the cross-cutting note.)
- **[B] C2's `damage / manual / 800 % ATK` is inert and is a live outlier row.**
  `data-outliers.md:35` flags it as a magnitude outlier; the proc registry rejects it (no `application[]`).
  Correct to leave unmodelled, but nobody can close the row.
- **[B] The stance starts 0.65 s early.** gcsim queues `AddStatus(skillKey, 12*60)` at `skillHitmark-1 = 39`;
  we open it at the cast. (`cooldownStartDelay: 39` is correct and verified.)
- **[B] The Hold variant has no oracle.** gcsim's `Skill(p)` ignores `p["hold"]` entirely, so the 8 s
  cooldown comes from the talent sidecar ("Hold CD" — I verified the row exists) and "Hold also enters Sturm
  und Drang" is an assumption; the kit text's Hold paragraph describes only the leap. Measured `Varka hE` →
  `readyAt 8.65 s` while the stance runs to 12.00 s, so the tool lets you re-press E mid-stance off a hold.
- **[B] `P` is swallowed silently** — the normal ability does not even list `P` in `input`, yet `Varka P`
  parses with empty `unknownTokens` and emits no action. Out of stance he can plunge in game.

**Improvements:** `durationExtensions` (+2.3 s from the burst) verified working — measured state
0.00→14.30 s. The Hexerei `factionBonuses` entry with `effects: []` is the right honest shape (a CD
modification has no schema). The 7.0 `stellarSwirl` additions to A4/C4/C6 are correct.

**Confidence:** high.

---

### wriothesley (Wriothesley) — T0.5

**Status:** curated; FrameMaps clean in §2/§3; burst `application[]` matches §4; `application: []` on the
skill is correct (Icefang Rush deals no damage). But **five of his authored effects use the `manual`
trigger, and one of them is a fabricated value that is live in the Team Builder.**

**Gaps**

- **[S] The skill carries a phantom `+50 % ATK` self buff with no source in the game or in gcsim.**
  `wriothesley__skill__icefang_rush.effects[0]` = `buff / atk% 50 / trigger: manual`. Its own curator note
  says _"Likely a generator artifact. Reviewer to delete or correct; do not author replacement"_ — never
  done. It draws no planner bar (manual reaches nothing), **but `deriveCapabilities` never inspects
  `trigger`**, so it is shipped: `src/lib/data/characterIndex.generated.ts:117` carries
  `{"kind":"buff","detail":"atk%","target":"self","minCon":0,"conditional":false}`. A Team Builder user is
  told Icefang Rush grants +50 % ATK. _Fix:_ delete the effect, then
  `npm run generate-character-index`. **Authorable today, one line.**
- **[A] A4 (There Shall Be a Reckoning for Sin) authors nothing** — a 10 s, stance-wide, up-to-+30 % ATK
  buff (gcsim `applyA4`: `ATKP = a4Stack × 0.06`, duration = the stance) leaving a blank received-buff lane
  under the stance bar. Its real trigger is an HP change (`OnPlayerHPDrain` / `OnHeal`), rubric N6 and
  unconsumed — a faithful model needs engine work, but an honest stance-long bar at the canonical 5 stacks
  is authorable and would fill the blank. ⚓ It is also the gate for C2's +40 %-per-stack burst bonus, which
  is unauthored for the same reason.
- **[A] C1's Chilling Penalty extension (+4 s, once per window) is not modelled** — caveated
  ("the skill's active span is shown 4 s short"). gcsim `cons.go` calls `ExtendStatus(skillKey, 4*60)` on a
  Rebuke hit. The `durationExtensions[]` primitive exists but only `onCast` extensions dispatch; `onHit`
  dispatch to a stance owner is the missing half (stated in the skill's own note). _Fix:_ engine.
- **[A] Three more `manual` effects mis-scope and still reach the Team Builder.** C1 `allDmgBonus 200`
  (`data-outliers.md:37`) and C6 `critRate 10` / `critDmg 80` derive as _unconditional self-buff_
  capabilities at their minCon, when gcsim adds all three at snapshot time on **one** Rebuke: Vaulting Fist
  instance (`charge.go` → `c1()` / `addC6Buff`). C4's `heal / manual / 50 %` duplicates A1's 30 % (gcsim
  _replaces_: `c.caHeal = 0.5`), and both derive. _Fix:_ delete or scope, the way Nicole C2 / Kirara C2 were
  ruled (`53db108`). The Team Builder is the surface being lied to, and no caveat can reach it.
- **[A] "Rebuke: Vaulting Fist" has no variant.** It is a distinct action in game — no stamina, +50 %/+200 %
  DMG, the heal, C6's extra icicle, and the C1 stance extension all hang off it — and the timeline draws an
  ordinary `C` block. The heal is approximated onto any charged-attack hit with `selfHpBelow 60` + a 5 s
  `procCooldown` (documented, reasonable).
- **[B] Chilling Penalty's >50 % HP gate is not expressible.** `skillBuffActive()` is
  `StatusIsActive(skillKey) && CurrentHPRatio() > 0.5`; `state: inStance` models only the flag, so the
  enhanced in-stance normals draw regardless of HP. Documented on the variant.
- **[B] The burst's frame-160 Surging Blade is authored as a Cryo application, but gcsim gives it
  `Durability: 0`** (`burst.go aiOusia`) — it applies nothing, ever. Harmless today (our per-cast counter
  suppresses it anyway: measured 2 applications at 99 and 114, matching gcsim exactly), but it is a nominal
  entry that consumes a counter slot. ⚓ This is precisely the `[icd]` ambiguity the §4 header warns about —
  the mark cannot distinguish "ICD suppressed it" from "carries no durability".
- **[B] Witch's Revelation currency is good but partial.** The A1 rewrite
  (`There Shall Be an Unveiling for Injustice`) is authored, wiki-sourced, with
  `stellarConductReactionBonus 30` + the 2 s heal, and caveated. The C1/C2/C4/C6 Radiance branches are
  correctly unauthored (damage magnitudes; `atkSpd` and damage-reduction have no Stat key). ⚓ **C4's
  Radiance package is the one team-facing piece** (+10 % ATK SPD to other party members, −25 % DMG taken)
  and is blocked purely on a missing Stat — worth revisiting if `atkSpd` ever lands.

**Improvements:** normals carry `hit`, and he is the only character in this batch with authored
`plungeFrames` + `lowPlungeFrames`.

**Confidence:** high.

---

### yumemizuki_mizuki (Mizuki) — T0.5

**Status:** curated; FrameMaps exact against gcsim (`hit` correctly omitted — every key
`InitNormalCancelSlice` would fill is explicitly authored, so it would be inert, the Durin-dark-commit
argument); the Dreamdrifter cloud is authored as the skill's own `application[]`; the Mini Baku summon
carries the measured `tickCap: 8`.

**Gaps**

- **[S] Her Witch's Revelation passive is entirely missing from the JSON.** Fandom
  **`Vast Be the Dream`** (`Category:Witch's Revelation Passives`, Change History "Luna VIII"; unlocked by
  the world quest _Witch's Revelation: Instruction Beyond Dreams_). genshin-db 5.2.13 carries **no**
  Revelation passive for anyone (`extraPassives` is empty for all six of this batch), so nothing in the
  pipeline would have surfaced it — the only source is the wiki, which is how Wriothesley's got in. Its
  renderable half is a **team buff**: _"while Yumemizuki Mizuki is in the Dreamdrifter state, the Elemental
  Mastery of nearby party characters is also increased by 10 % of her Elemental Mastery."_ That is
  `buff / target: team / stat: em / value: {type:'scaling', stat:'em', ratio: 10}` gated on
  `state: nightsoulBlessing` — **authorable today with zero schema work**, and it would be the only team EM
  bar she has. (The 1,000 %-EM enhanced tick and the Radiance: Stellar Swirl 8 s state are damage magnitude
  / a state with no surface.)
- **[S] Her headline mechanic — Dreamdrifter's EM-scaled Swirl DMG bonus for the whole party — draws
  nothing, and its stated blocker is STALE.** The skill note reads _"gcsim adds it via AddReactBonusMod
  which we don't have a primitive for … a buff on swirl/anemoDmgBonus isn't quite right either."_ The 7.0
  round minted exactly that primitive: bucket-5 `*ReactionBonus` **is** `AddReactBonusMod`
  (`ability.ts:151-169`), with `superConductReactionBonus`, `cryoSwirlReactionBonus`,
  `stellarSwirlReactionBonus`, … already authored by Wriothesley, Qiqi and Diona. What is missing is a
  `swirlReactionBonus` member (or four per-element ones) — a Stat-union addition with a live consumer (the
  buff lane), not an engine build. gcsim `skillInit()` returns `swirlDMG[tl] * EM * 0.01` for the four Swirl
  tags and `stellarSwirlDMG[tl] * EM * 0.01` for the two Stellar tags, so the two halves map cleanly.
  Until then the Team Builder shows her as a healer with a grouping tag and **no team buff at all**.
- **[A] C2 draws nothing** — "every Elemental Mastery point she has will increase all nearby party members'
  Pyro, Hydro, Cryo, and Electro DMG Bonuses by 0.04 %". That is four `buff` effects, `target: team`,
  `value: {type:'scaling', stat:'em', ratio: 4}` (⚓ `ratio` is per **100** stat units), gated on
  `nightsoulBlessing`, duration = the stance. **Authorable today** — the note's "not modellable cleanly"
  predates the `scaling` BuffValue being used for exactly this shape (Varka A1, Cryo Traveler A4).
- **[A] A4 (Thoughts by Day Bring Dreams by Night) is `trigger: 'manual'`** — the +100 EM / 4 s self buff
  reaches no bar. Its real trigger is a teammate's Pyro/Hydro/Cryo/Electro hit during Dreamdrifter;
  `onHit` with `source: 'others'` now dispatches per-swing (rubric P2, `dispatchHit`), so the shape is much
  closer than when it was authored, though the element filter still has no home.
- **[A] The Dreamdrifter cloud is run on the WRONG ICD.** gcsim gives the cloud its own group —
  `ICDGroupMizukiSkill`, **72 f timer / sequence {1,0,0,0}** (`icd_groups.dm.go:117,183`) — and the
  activation hit `ICDTagNone` (always applies). We push all 8 `application[]` entries through the standard
  150 f/every-3 counter. Measured `Mizuki E Q` at C0: applications at **f2, 138, 183, 318**; gcsim (§4
  row) applies at **f2, 48, 138, 228, 318**. One fewer Anemo application per Dreamdrifter, and three of ours
  land at instants gcsim does not. Since every Swirl she triggers extends her own stance (A1, +2.5 s ×2) and
  drives C1, both the aura-lane pips and the E bar's length move. _Fix:_ the `IcdWindow` shape exists
  (`summonTick.icdGate`, `chargedIcdWindow`) but has no home on a cast's `application[]` — schema + engine.
- **[B] Mini Baku draws 16 tick marks for 8 snacks.** Measured `ticks=16`: the heal and damage series share
  `interval 1.5` and `firstTickDelay 1.5`, so both emit markers at identical instants. This is the known
  open bug in memory `gauge_round_l5e` ("8 summons draw DUPLICATE tick markers … `opacity:.92` makes them
  read solid") — Mizuki is one of the eight. The burst's caveat ("Each tick mark is one snack") is true on
  screen and false in the data.
- **[B] The first snack tick is 0.3 s early against the oracle** — §5: ours 183 f, gcsim 201 f. 183 f is the
  snack SPAWN (`spawnTime = burstHitmark 93`, `+ snackInterval 90`); 201 f is when the Munen damage lands.
  Well inside the caveat's stated ±4 s pickup lag, so arguably correct-by-design — recorded so the §5 row is
  not "fixed" by accident.
- **[B] `P` is a silent no-op** (input lists `P`, no `plungeFrames`).
- **[B] C4 and C6 are description-only and correctly so** — C4's 5 Energy ×4 per burst has no pickup trigger
  (and `energy` reaches no planner surface anyway); C6's fixed-crit Swirl has no per-reaction crit override.

**Improvements:** the 2026-08-31 C1 value split (1,100 % base / 550 % Stellar) is the model correction to
copy for any future reaction-rename patch. The A1 extension is correctly driven off the live gauge, and
the 2026-08-18 note retiring the old "cast-only emission" warning is accurate.

**Confidence:** high. The Revelation find is wiki-verified through the MediaWiki API; the ICD-group numbers
are read straight off `icd_groups.dm.go`.

---

### durin (Durin) — T0.5

**Status:** the most complete character in this batch. The dual-form state machine is wired end to end
(`transmuting` → `whiteForm` / `darkForm` → form-gated burst, with the Dark commit as a state-gated normal
carrying `infusion: 'pyro'`); both dragons carry measured `firstTickDelay` **and** per-series `icdGate`;
both bursts' `application[]` were trimmed to their three opening hits on 2026-09-04. Measured: `Durin E E Q`
→ White dragon, 20 ticks, 10 applications; `Durin E N1 Q` → Dark dragon, 16 ticks, applications every
2.47 s. §5 matches exactly.

**Gaps**

- **[A] The White commit has no `application[]`.** `durin__skill__transmutation_confirmation_of_purity`
  deals 190.1 % ATK Pyro at hitmark **35** (gcsim `skillWhite`, recorded in the ability's own note), but the
  field is absent, so the parse falls back to the character's element at the CAST instant and flags it
  provisional — measured `Durin E E Q` → `0.25pyro?`. 35 frames early, wearing the `--ui-provisional` foot.
  The oracle cannot reach it (§3: "panic: unexpected charges less than 0"), but the sibling Dark burst's
  numbers were derived from source the same way. _Fix:_ `[{frame: 35, element: 'pyro', units: 1}]` —
  **authorable today**.
- **[A] Every `state`-gated bar on this character renders optimistically.** A1's five RES shreds, the five
  Hexerei shreds, C2's team Pyro bar and C6's DEF shred are all gated `state: duringSummon`;
  `deriveBuffWindows` passes `new Set()` as resolvedStates and `conditions.ts` returns **null** for an
  unlisted state, so nothing is dropped (rubric:377 — 88 `state` conditions over 36 characters corpus-wide).
  Measured at C6: `Durin E N1 Q` in the **Dark** form draws the White-form-only −30 % DEF shred. Caveated on
  A1 and on the C6 entry; _fix:_ engine.
- **[A] C1 (Adamah's Redemption) authors nothing** — a named, 20 s, Burst-granted team buff, with a blank
  where a bar should be. The blocker is one missing Stat key: an all-attack-class flat-DMG bonus. The bar
  _shape_ already exists (Cyno's A4 draws `normalFlatDmg` / `skillFlatDmg`), so this is a schema addition
  with a live consumer, not an engine rebuild.
- **[B] C6's `defIgnore` prints 30 % in both forms** (Dark is 70 %) — caveated, and one of the 29 unlanded
  trims in `caveat-open-items.md §1`. Two mutually-exclusive effects gated on `darkForm` / `not darkForm`
  would express it in data, but the gate would render optimistically (see above), so it is blocked on the
  same engine gap.
- **[B] A1's second path is unauthored** — "…or deal Pyro DMG or Dendro DMG to an opponent affected by
  Burning" (gcsim's separate `OnEnemyDamage` hook). Only the reaction path is modelled; documented.
- **[B] A1's Dark-form +40 % / +70 % Vaporize & Melt has no stat.** The bucket-5 `*ReactionBonus` family now
  exists but has no `vaporize` / `melt` member; `schema-gaps-design.md:127` still lists this as open. One
  Stat addition away from being a caveat we could delete.
- **[B] ⚠️ `docs/curation/gcsim-frames-diff.md:251` proposes the WRONG `application[]` for the Dark burst.**
  It lists 23 entries whose tail (156 f, then 58.8 f steps) is the **White** dragon's tick stream on the
  **Dark** ability — the exact defect the 2026-09-04 pass removed. The report was regenerated on 2026-09-15
  and still says it, because `scripts/gcsim-dump/drivers.json` gives durin `darkForm: []`. ⛔ A future
  curator reconciling our three-entry array against that row would reintroduce the double-feed. Worth a
  suppression or a warning note beside the row.
- **[B] The skill's `energy` effect is inert** (no planner consumer; `deriveCapabilities`' Energy facet
  excludes `target: 'self'`) — correctly and fully documented on the effect itself.
- **[B] `P` is a silent no-op**, and a `C` or `P` typed inside the 6 s `transmuting` window resolves the
  Dark-commit ability, which has no charge/plunge frames — documented as a degenerate path.

**Improvements:** the Hexerei mutually-exclusive `not(teamFaction ≥2)` / `teamFaction ≥2` shred gating is
the pattern to copy elsewhere (one bar per element in either world). Both dragons' `⛔ NO tickCap, checked
not assumed` notes are the right discipline.

**Confidence:** high.

---

### Cross-cutting findings (report once, they are not per-character defects)

1. **`P` is accepted and draws NOTHING for any character with no `plungeFrames`.** Measured on `skirk`,
   `varka`, `traveler_cryo`, `durin`, `mizuki` — five of six; only Wriothesley has them. `unknownTokens`
   stays empty, and no action event, no block, no time cost and no application is produced. Three of those
   five list `P` in the ability's own `input` array, so the data advertises an action the tool discards.
   ⚓ Either author plunge frames or make the notation **refuse** `P` the way `W` (walk-cancel) is refused —
   silently swallowing it is the one option that misleads.
2. **A cast's `application[]` is always gated by the STANDARD ICD** (`resolveActionIcd` returns
   `STANDARD_ICD_FRAMES` for `skill` / `burst`; `abilityNoICD` is only read for normals). Three of the six
   need something else: Varka's burst (`ICDTagNone` — both hits apply), Mizuki's Dreamdrifter cloud
   (`ICDGroupMizukiSkill`, 72 f / every 4), Wriothesley's Surging Blade (`Durability: 0` — applies never).
   The `IcdWindow` shape already exists on `summonTick.icdGate` and `NormalAbility.chargedIcdWindow`; it
   simply has no home on `application[]`. This is the single highest-leverage engine gap in the batch.
3. **`manual` triggers reach no planner surface but DO reach `deriveCapabilities`**, which never inspects
   `trigger` at all. Live in this batch: Wriothesley ×5 (one of them, `atk% 50`, a **fabricated** value
   with no source in game or gcsim), Varka ×2, Mizuki ×1. The Team Builder is showing capabilities derived
   from effects that the planner correctly refuses to draw — and `caveat-open-items.md §4`'s framing
   ("167 effects render nothing") understates it: they render nothing _on the timeline_, and something
   wrong on the roster.
4. **Two per-series ICD counters on one summon double the applications** when a kit spawns two projectiles
   from one tick (`aura.ts:884` keys by `series.index`). Cryo Traveler is the new instance, authored today;
   CLAUDE.md §12 already records Alyosha as the exactly-coincident-pill case. Worth a corpus sweep for
   sibling damage series sharing an interval.

---

### Batch summary

| id                  | tier | #S  | #A  | #B  | headline                                                                                                                                                                                                                                                            |
| ------------------- | ---- | --- | --- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `skirk`             | T0.5 | 4   | 2   | 3   | The E bar is wrong at both ends — cooldown starts at cast instead of stance exit, and the stance is drawn at its 12.57 s max when SS depletion ends it at ~6.4 s; a swap then zeroes the Serpent's Subtlety pool.                                                   |
| `varka`             | T0.5 | 2   | 3   | 4   | The Sturm und Drang stance — his whole identity — applies **zero** elements: five in-stance swings and a CA produce no aura at all, and the burst applies Anemo once where `ICDTagNone` gives two.                                                                  |
| `yumemizuki_mizuki` | T0.5 | 2   | 3   | 4   | Her Witch's Revelation passive (`Vast Be the Dream`, with a team EM buff) is missing entirely, and her headline EM-scaled Swirl DMG buff draws nothing on a blocker that the 7.0 bucket-5 round already retired.                                                    |
| `traveler_cryo`     | T0.5 | 1   | 2   | 4   | Today's draft-sourced authoring gives the Star's two crystal series their own ICD counters, so it applies Cryo 8× per cast where gcsim applies 4× — measured, and with no oracle to catch it.                                                                       |
| `wriothesley`       | T0.5 | 1   | 4   | 3   | A fabricated `+50 % ATK` on Icefang Rush is shipped in the Team Builder index, and his A4 — a 10 s up-to-+30 % ATK stance buff — authors nothing at all.                                                                                                            |
| `durin`             | T0.5 | 0   | 3   | 6   | Genuinely solid: dual forms, both dragons' cadences and ICD gates measured and exact. What is left is one missing `application[]` on the White commit, the corpus-wide `state`-gate optimism, and a stale oracle row that would re-break the Dark burst if trusted. |

---

<!-- batch 5 -->

## Batch 5 — escoffier · fischl · alyosha · bennett · illuga · prune · qiqi (all Prydwen T0.5)

Audited 2026-09-15 against gcsim main `ac2d76dde`, the committed curation reports, and a throwaway
`parseNotation` probe (deleted). Everything marked **measured** came out of that probe; everything
marked gcsim `file:line` was read in source.

---

### escoffier (Escoffier) — T0.5

**Status:** curated · frames from gcsim main (no §2/§3 rows) · `application[]` on both casts · full gcsim
coverage (`internal/characters/escoffier/`). Effect authoring is mature but the E's gauge feed is
double-counted and its summon cadence is measurably off.

**Gaps**

- **[S] The Cooking Mek's Frosty Parfait ticks are fed into the gauge TWICE, on two different clocks.**
  `application[]` entries at frames 153/212/270/329/…/855 (`escoffier.json:159-217`) _are_ gcsim's
  Frosty Parfait hitmarks — `skill.go:21-23` `skillFirstTickDelay=148`, `skillInterval=58.5`, plus
  `c.skillTravel` 5 — and the same stream is authored again as the summon's `summonTick`
  (`escoffier.json:120-133`). Measured `Escoffier E` (C6): applications land at 23, **171, 212**, **348,
  387**, **525, 563**, **702, 738**, **879**, 1056 — the pairs are the two streams gating independently;
  gcsim applies at 23, 153, 270, 387, 504, 621, … at an even 117f. This is `docs/furina-arkhe-round.md`
  §8 **kind A** (real double count, same as Kinich/Furina). ⚠️ §8 explicitly _cleared_ escoffier
  ("their late entries are genuine cast hits") — that verdict was reached with a phase test, and the
  phase is wrong for the reason below, so the test missed it. **Fix:** trim `application[]` to the cast's
  own hits. Data-only, authorable today.
- **[S] Every Cooking Mek tick marker is 18 frames late, and 3 ticks are missing.** `firstTickDelay: 2.467`
  is gcsim's 148f **from the cast**, but `collectSummonTicks` starts at `spawnAt + firstDelay`
  (`src/lib/sim/summons.ts:212`), and `spawnsAt` is 23 → markers at 171/230/289… against gcsim's
  153/212/270…. Correct value is (148+5−23)/60 = **2.167**. Separately gcsim runs `skillTicks = 21`
  (`skill.go:19`, status 148+20×58.5 = 1318f ≈ 22.0s) while our 20s window yields **18** (§5 row
  `escoffier | lowtemperature_cooking | Cooking Mek (Cold Storage) 171f / 59f × 18`). ⚠️ `tickCap`
  cannot add ticks — it only bounds, widening by at most one interval (`summons.ts:208-215`) — so the
  extra three need the authored `duration`, which then makes the summon bar disagree with the kit's 20s.
  Worth a decision, not a blind edit.
- **[A] No `icdGate` on the Cooking Mek series, and gcsim's is not the standard.** The initial hit, every
  parfait and the C6 parfaits all carry `ICDGroupEscoffierSkill` (`skill.go:52,168`; `cons.go:c6Init`),
  whose table entry is **90f window, sequence {1,0,0,0,0,0}** — `pkg/core/attacks/icd_groups.dm.go:104,170`
  — i.e. every other parfait applies. Ours runs standard (150f / every 3rd). The ICD-group round missed
  this for exactly Durin's reason: §5's oracle column is **empty** (`—`) because the dumper filed those
  hits under the cast. **Fix:** `icdGate: {timer: 90, every: 6}` on the summonTick. Authorable today.
- **[A] Frame 83 is a Durability-0 hit and can never apply — it should not be an application entry.**
  gcsim `skill.go:73` Surging Blade: `Durability: 0`, `ICDTagNone`. The authored
  `{frame: 83, element: "cryo"}` carries no `units`, which means UNMEASURED → 1U provisional, i.e. a
  phantom Cryo pip whenever our cast clock lets it through. This is precisely the `[icd]`-vs-no-durability
  ambiguity the §4 header warns about (report row `gcsim-frames-diff.md:254`).
- **[A] The A4 shred does not refresh off the BURST.** Trigger is `onHit / abilityType: 'skill'`
  (`escoffier.json:296-315`); gcsim attaches `makeA4CB` to the skill hit, the Surging Blade, **every**
  parfait and the **burst** hit (`asc.go:makeA4CB` + call sites in `burst.go:40,47`). Measured, the Mek's
  ticks already carry the window to 31.57s (the summon-tick→onHit pass), so a Q-only or post-Mek Q draws
  no shred. **Fix:** `abilityType: ['skill','burst']` — the file's own ↻2026-08-18 note proves the array
  form is legal and that `mergeRefreshedBars` handles the overlap; its stated verification boundary (do
  the two windows land on ONE row key?) is still open.
- **[A] The 5/10/15/55 RES-shred ladder is flat −55% in every team** (caveated). The same note shows it is
  authorable **today** as 8 tier effects on excl-self counts 0/1/2/3, because `resShredBase` evaluates
  conditions before `dedupResShredByElement`.
- **[A] C4 is entirely unauthored** (`escoffier.json:436-444`, no `effects`): Rehab Diet +6s
  (gcsim `cons.go:c4ExtraCount` → 6 more heal ticks), so at C4+ the A1 heal window still draws 9s. The
  CR-chance bonus heal + 2 Energy (7 procs) is genuinely unmodelable.
- **[B] C2 `coldDish` has no `gainStacks`/`consumeStacks` pair** — the key appears only in the buff's
  condition and `perStack` value, so the user must type `{coldDish:N}`. Caveated. The file's note is right
  that authoring the pair would _not_ make the bar count down (cast-anchored snapshot).
- **[B] `chargedIcdWindow: {timer:30}` rests on a wrong reading of gcsim.** The curator note says
  "gcsim charge.go tags it ICDTagExtraAttack / ICDGroupPoleExtraAttack"; current main
  `escoffier/charge.go:33` is **`ICDTagNone`**. She is 1 of only 3 polearm users on the None tag
  (with flins and ineffa — surveyed all 17 `ICDGroupPoleExtraAttack` holders), and all three carry the
  field. Practical impact is near zero (her CA is Physical unless infused), but the premise is false.
- **[B] The 6-proc-per-Mek C6 cap and the 4-particle/5-energy-drain bookkeeping are unmodelled** — both
  named in the notes, both with no surface today.

**Improvements**

- The burst heal's dropped flat component is **authorable today**: the note claims "a known schema gap
  (no mixed flat+scaling heal value form)", but `flat?: number` is declared on the heal effect
  (`src/lib/types/ability.ts:1436-1441`) and bennett/qiqi both use it. `flat: 2372.936` closes it.
- Once the double-feed is trimmed, the aura lane's pip spacing becomes the even 1.95s cadence a player
  sees in game instead of paired pips 0.7s apart.

**Confidence:** high. The double count, the 18f phase error and the ICD group are each derived from
gcsim source plus a measured parse; the only soft call is how to recover the 3 missing ticks.

---

### fischl (Fischl) — T0.5

**Status:** curated · frames from gcsim main · applications on both casts · ICD gates authored on both Ozes ·
A4 proc and C6 coordinated attack both wired (mark-triggered + coordinated-attack rounds). The best-modelled
character in the batch; what is left is C1, A1 and two timing choices.

**Gaps**

- **[A] C1 Gaze of the Deep is unauthored and unmodelable today.** `fischl.json:392-398` has no `effects`.
  22% ATK Electro coordinated attack off Fischl's own Normal Attacks **while Oz is not out** — and
  `whileNormalAttacking` is summon-hosted only (lint B.13c), so the one trigger that fits is structurally
  unavailable when the summon is absent. gcsim doesn't implement C1 either (no `c1` in `cons.go`), so
  there is no oracle. C1 is the single most common Fischl constellation.
- **[A] A1 Stellar Predator is unauthored** (`fischl.json:371-376`, no `effects`): a fully-charged Aimed
  Shot hitting Oz brings down Thundering Retribution. gcsim carries it as an explicit TODO
  (`asc.go:22-23`). No trigger exists for "your own attack hits your own summon" — engine work.
- **[A] The burst's Oz is hard-coded to the swap-cancel spawn.** `spawnsAt: 1` + `firstTickDelay: 1.05`
  mirrors gcsim's `burstShortOzSpawn = 1 / burstShortOzFirstTick = 63` (`burst.go:20-22`); without a swap
  gcsim spawns Oz at **frame 113** with first tick +69 — §5 row is explicit: ours `Oz 64f`, gcsim
  `Oz (Burst) 192f` (`gcsim-frames-diff.md:525`). Measured `Fischl E Q`: the burst-Oz bar starts at 0.73s;
  an un-cancelled burst should start ~1.9s later. A conditional spawn is engine work; today there is not
  even a caveat.
- **[B] Every Oz tick marker is 10 frames early.** `ozTravel = 10` is added to every tick
  (`skill.go:queueOz` → `QueueAttackEvent(&ae, c.ozTravel)`) and our `firstTickDelay: 1.067` is the
  pre-travel 64f. §5 prints it side by side: ours `82f`, gcsim `92f`. Fix: 1.233 (74f) on the skill Oz and
  the matching value on the burst Oz.
- **[A] The Hexerei Secret Rite has no "Oz on the field" gate.** gcsim `asc.go:hexInit` — both `atkpHook`
  and `emHook` `return` when `!c.StatusIsActive(ozActiveKey)`. Our `factionBonuses` effects
  (`fischl.json:450-495`) carry only the `teamFaction ≥ 2` count, so the +22.5% ATK / +90 EM bars draw off
  any Electro reaction with Oz long gone. A `state: duringSummon` condition would close it.
- **[B] C6 doubles the Hexerei bonus and the bar does not.** `cons.go:c6HexBonus` → `0.225 × (1+1)` /
  `90 × 2` for 10s after a C6 wave; at C6 our bar still prints +22.5% / +90.
- **[B] C4's other half is an unmodelled 2U application.** `burst.go:52-63`: 222% Electro at frame **8**,
  `Durability: 50`. So at C4+ the burst's opening application should be 2U at frame 8, not 1U at 18.
  `application[]` has no constellation gate — needs a schema/engine answer, and is why it is B not A.
- **[B] The Oz recast (reposition) is not expressible.** gcsim: a second E while Oz is out is a _free_
  action on a 92f internal cooldown that resets the tick timer without re-spawning Oz
  (`fischl.go:ActionReady`, `skill.go:skillRecast`). We have no token, and `terminatesOn: 'recast'` would
  end the window instead. ✅ The E→Q case is right: measured, `Fischl E Q` truncates the skill Oz at 0.73s
  and runs the burst Oz 0.73→12.73s at C6 (10+2) / →10.73s at C0.
- **[B] The Aimed Shot is `ICDTagNone` in gcsim** (`aimed.go:53`), i.e. every aimed shot applies 1U
  Electro; our model puts bow charged attacks on the standard charged clock. ⚠️ Corpus-level, not
  Fischl-only — surveyed 20 bows, **16 are ICDTagNone** (aloy, collei, chasca, fischl, lyney, faruzan,
  gorou, ganyu, jahoda, sethos, ororon, sara, tartaglia, tighnari, yelan, yoimiya; amber, diona, sigewinne,
  venti are ExtraAttack). That is the same shape as the plunge and catalyst-CA censuses and wants its own
  measured round — but Fischl is the character it costs the most.
- **[B] `noICD: true` on her skill and burst is inert data** — only `NormalAbility.noICD` is read.
- **[B] No `plungeFrames`** (gcsim has none for bows; `P` falls back to the generic cast).

✅ Correctly _not_ authored: C2 (gcsim folds the 200% into the same hit's Mult — no extra application),
and the A4's `source: 'active'` refusal of Oz-delivered reactions (right where gcsim is wrong; documented).

**Confidence:** high on everything except the aimed-shot ICD item, which is a corpus question I only
sampled (20 bows) rather than measured end to end.

---

### alyosha (Alyosha) — T0.5

**Status:** `curated: false` (`characterIndex.generated.ts:11`), **no gcsim source anywhere** (the report's
"no gcsim source (11)" list, `gcsim-frames-diff.md:18`), no frames and no `application[]` on E or Q.
Effect authoring is the richest in the batch — the Hunter's Mark rotation-scoped stack model, three
activation sites, the C0/C2 gate asymmetry — and it behaves exactly as its notes claim.

**Gaps**

- **[S] Both casts apply Electro at frame 0.** Measured `Alyosha Q`: the cast's application lands at frame
  0 (no `application[]`, no frames → the provisional fallback fires at the cast instant). No oracle exists
  — genshin-db carries no hitmarks and Fandom's Gameplay Notes are empty — so this is blocked, not
  deferrable. It is the reason he is in `FRAMELESS_EXEMPT`, and it is worth naming because a T0.5
  character's E/Q pips sit visibly earlier than the rest of the team's.
- **[A] Tugarin's tick markers are drawn THREE times per instant.** Measured at C6:
  `ticks: 120,120,120, 240,240,240, …` — **27 marks for 9 mauls**, because the damage series, the A1 heal
  and the C4 heal all sit on the identical 2s cadence with `opacity:.92`. This is the open 8-summon
  duplicate-marker bug in memory `gauge_round_l5e`, and Alyosha is its worst case (three deep, not two).
  At C0 it is 12 marks for 6 mauls.
- **[A] Two summons on one cadence produce exactly-coincident applications.** Measured: applications at
  **120 and 120**, 360 ×2, 600 ×2, 840 ×2 (Tugarin + Fulgurite Hunting Field, same element, same 1U).
  That is the Polestar round §12 `sameFrame` case — the aura lane draws one pill where two landed, and
  it never separates on zoom.
- **[A] C2's Fulgurite bar is short** — caveated ✓: at C2 the burst runs 20s but the Hunting Field's bar
  stops at 14s, because only `summons[0]`'s `durationModifiers` are read and Tugarin took the slot
  deliberately.
- **[B] The boundary maul.** "Every 2s" across a 14s window draws 6 ticks (2…12s); a 7th at 14s is
  plausible. `firstTickDelay` is deliberately unauthored (defaults to the interval). No oracle can settle
  it — a doubt to record, not a defect to fix.
- **[B] C6's second Hunter's Precision stack is not modelled** (caveated ✓): the bar shows one stack's ATK
  and grants the +100 EM off the first activation. The notes correctly reject both `BuffEffect.stacks`
  (no consumer) and `constellationScaling` (inert on display).
- **[B] `Into the Fray` renders optimistically.** `teamElementCount` does not resolve on an active-target
  buff (the received-buff context omits team element counts), so the +20% Stellar-Conduct bonus draws in
  any team with a Conduct enabler whether or not a Cryo teammate is present. Documented in the notes, no
  caveat — consistent with the Gorou precedent.
- **[B] C4's `target: 'team'` over-claims** (the kit heals the single lowest-HP% ally). Unlike Qiqi's C4
  this one is on a live trigger, so the Team Builder's `heal/team/C4` claim _and_ the drawn heal ticks
  both say "party-wide".
- **[B] C1's 15 Energy is inert** — no energy surface anywhere; knowingly authored as the record.
- **[B] No frames of any kind on the normal ability** (no `hits`, no `chargeFrames`, no `plungeFrames`) and
  `input: ["N"]` only — yet `C` parses (measured, `unknownTokens` empty) onto a generic cast length.
  `filter.hitIndex: 3` correctly lands on N4 via the raw counter.

✅ **Verified by probe, not by note:** the Hunter's Mark gate design works as documented. `Alyosha N4 E Q`
at C0 draws exactly one 15s Hunter's Precision window (granted by the E, which is the second mark) and
**nothing** off the mauls; at C6 each maul opens its own 15s window (`9.60→24.60`, `11.60→26.60`, …) which
`mergeRefreshedBars` fuses. The `min:2` / `min:1`+`not(C2)` pairs behave as the notes claim.

**Confidence:** high on behaviour (measured), medium on completeness — with no gcsim and no Fandom
Gameplay Notes there is no independent source to diff the numbers against.

---

### bennett (Bennett) — T0.5

**Status:** curated · frames from gcsim main with **one §2 disagreement** and **one `anim === swap`
stand-in**, both on `h2E` · applications on the press, both holds and the burst (all match §4 exactly).

**Gaps**

- **[S] The Inspiration Field's ATK buff bar ends about 2.6s early.** gcsim re-applies a **126-frame
  (2.1s)** statmod on every field tick — `burst.go:22 burstBuffDuration = 126`, applied at 34, 94, …,
  754 — so a character standing in the field keeps the ATK bonus (and at C6 the Pyro DMG bonus and the
  weapon infusion) until **frame 880 ≈ 14.67s**. Ours is `duration: 12, durationType: 'fixed'`; measured
  `Bennett Q` → the buff window runs **0.57→12.57s**. The ~2s lingering tail is the thing Bennett
  rotations are _built_ around ("leave the field, keep the buff"), and nothing on screen or in a caveat
  says it exists. **Fix:** the engine has no "re-applied per tick" buff form, so the honest edit is a
  longer fixed window (12 → 14.1) on the ATK buff, the C6 `pyroDmgBonus` and the C6 `infuse`. Authorable
  today; wants Nate's call because it changes the most-read bar in the tool.
- **[A] `h2E` inside Bennett's own field is a different action and we have only one form.** A4 Fearnaught's
  "will not be launched" half selects `skillFrames[4]` — **anim 175**, D 171, J 174, swap 175 — instead of
  343 (`skill.go:56-64, 217-224`, gate `asc.go:a4NoLaunch`). A `Q … h2E` rotation therefore over-charges by
  ~2.8s. **Fix:** a second variant gated on `state: duringSummon` (variants take `conditions`) —
  authorable today.
- **[A] `h2E`'s `anim` is a stand-in and one key disagrees.** `bennett.json:156` has `anim === swap === 337`;
  gcsim's animation length is **343**. And `gcsim-frames-diff.md:50` files
  `bennett__skill__passion_overload.variants[h2E] | J 240→340` as a §2 review candidate.
- **[B] `cooldownStartDelay` is missing on all three skill forms.** gcsim: press `SetCDWithDelay(..., 14)`
  (`skill.go:110`), hold-1 **43**, hold-2 **110** (`skill.go:222-232`). So the ghost CD tail and the next E
  are early — up to 1.83s on hold-2.
- **[B] The field draws 11 heal ticks; gcsim heals 12.** Ticks at 34+60k for k=1..12 = 94…754
  (`burst.go:70-77`); our half-open walk ends at 754 and drops the boundary tick (measured:
  `94,154,…,694`). Exactly the `tickCap` boundary rule — `tickCap: 12` lands it.
- **[B] No `plungeFrames`** although gcsim has `bennett/plunge.go` (low slice 67 / high slice, hitmarks
  36/38, `ActionAttack 45`, `Skill 46`, `Burst 46`, `Swap 53`). ⚠️ Invisible to the reports: §3 lists
  _authored_ maps with no gcsim reading, so a map we never wrote never appears.
- **[B] C4 is a `manual` damage effect** (`bennett.json:355-369`) — one of the 167 corpus-wide effects that
  reach no surface. In gcsim it is a distinct hold-1 frame set (107) plus a hit at frame 94
  (`skill.go:180-190`), i.e. really a third skill variant. Not authorable as a variant today because the
  trigger is "press N as the second attack of Charge Level 1".
- **[B] The field's self-infusion is unmodelled and probably should stay so** —
  `p.ApplySelfInfusion(Pyro, 25, 126)` every tick paints the _character_, not the enemy; the tool models
  only the enemy's gauge, so nothing on screen is wrong.
- **[B] C2 (ER below 70% HP) unauthored** — no HP simulation; correctly nothing.

✅ **Verified by probe:** the A1 + A4 cooldown reduction composes **multiplicatively**, matching gcsim's
`a4CD(a1(5*60))`. Measured `Bennett Q E E E` → cooldown **120f = 2.00s** inside the field; `Bennett h1E h2E`
→ 360f (6.0s) and 480f (8.0s) outside it. All three are gcsim-exact.

**Confidence:** high. The 126-frame buff duration and the in-field hold-2 slice are both read straight out
of `burst.go`/`skill.go` and the bar timings are measured.

---

### illuga (Illuga) — T0.5

**Status:** ⚠️ **`curated: true` as of today** (`characterIndex.generated.ts:51`) — frames and applications
were seeded from gcsim **PR #2677**, head `db0153ae4`, which is **unmerged and CHANGES_REQUESTED**. I read
that commit out of the local clone without checking it out (`git show db0153ae4:internal/…`): **every
authored FrameMap and every application matches the PR exactly** — skill 47/38/38/37/39/36, hold
58/50/50/50/49/49, burst 65/64/64/62, normals `{30,13,14,21}/{33,16,21,21}/{57,32,45,52}/{80,43,66}`,
charge 66/63/64/64/23/23/61, hitmarks 27 / 36 / 48, all `ICDTagNone` / 25 durability. He is still listed
in §3 "no gcsim source", which the report cannot know.

**Gaps**

- **[S] Nightingale's Song — the burst's entire mechanic — is unmodelled, and its absence makes three bars
  the wrong length.** PR `burst.go`: the cast grants **21 stacks** (+5 per Geo Construct within 30 units,
  max +15), each nearby active character's Geo hit consumes one, and **when the pool empties the 20s
  Haunted Night's Oriole-Song status is deleted** (`if c.nightingalesSong < 1 { c.DeleteStatus(burstKey) }`).
  Today the A1 crit/EM bars and the C4 DEF bar all draw a flat 20s that the game frequently cuts short.
  The stack POOL is authorable now — `gainStacks` on the burst cast plus `consumeStacks` with
  `source: 'others'` and `filter.element: 'geo'` (both honoured by `dispatchConsumeStacksOnHit`, per
  escoffier's C2 note) — but the window truncation and the per-hit EM-scaled flat DMG add are not (no
  element-scoped flat-DMG Stat key; the burst's own note explains why).
- **[S] At C6 the three Lightkeeper's Oath bars print the C0 numbers.** `BuffEffect.constellationScaling`
  has **no reader on any display path** (`illuga.json:259`, rubric N9 names this character as the worked
  example). Measured at C6: the bars carry `critRate` / `geoCritDmg` at +5% / +10% where the kit gives
  +10% / +30%, and the Moonsign EM rung at +50 where C6 gives +80. ⚠️ It is a **reader** fix
  (`buffWindows.ts` / `buffDisplay.ts`), not data — and the file already carries the ⏭ work item.
- **[A] C2's Aedon strike applies 1U Geo and is authored `manual`.** PR `cons.go:c2Hit()` — Geo,
  `Durability: 25`, `ICDTagNone`, hitmark 50, fired every 7 stacks consumed. Nothing draws, nothing
  applies, and no `procCooldown`-style primitive expresses "per 7 stacks".
- **[B] C4's DEF buff is the wrong target and the wrong length.** Ours: `target: 'active'`, flat 20s. PR
  `cons.go:c4()`: a 1.1s statmod re-applied every 1s to **every party member except Illuga**
  (`teamExcludingSelf`), for as long as the burst status holds — which, per the item above, can end early.
- **[B] The Haunted Night's Oriole-Song state has no window bar of its own.** It is an instant cast; a
  20s `activeDuration` would give the reader a span to read the buffs against. The notes accept surfacing
  it via the A1/C4 bars, which is defensible but leaves a solo-lane reader with nothing (the A1 buffs are
  `teamExcludingSelf`).
- **[B] A4's 1/2/3 Hydro-or-Geo ladder is unauthored** — correctly: it feeds the same flat-DMG add with
  no matching Stat key (gcsim `asc.go:a4GeoBuff/a4LcrBuff`).
- **[B] No `plungeFrames`** (the PR has no `plunge.go`), and `input: ["N"]` only although `C` parses.
- **[B] The frames may move.** The JSON says to re-run the writers when #2677 lands; `curated: true` now
  rests on an unmerged branch.

✅ **Two open questions I can close:**

- **The Moonsign threshold flag ("the true activation threshold may be lower than a bare min:2 count —
  flagged for Nate") resolves in favour of the current authoring.** Every Moonsign character in gcsim
  contributes exactly `Moonsign = 1` (aino, columbina, flins, ineffa, jahoda, lauma — and the PR's
  `illuga.go:29` sets `c.Moonsign = 1`), `GetMoonsignLevel()` sums them (`pkg/core/player/player.go:364`),
  and our `teamFaction` count is "number of party members per faction key", holder **included**
  (`src/lib/sim/conditions.ts:47-49`). So `min: 2` is exactly gcsim's `>= 2`. Nothing to change.
- **C1's reaction list is more correct than gcsim's.** The PR's `geoReactionEvents` duplicates
  `OnCrystallizeElectro` and **omits** `OnCrystallizePyro`; ours lists all four crystallizes plus
  `lunarCrystallize`. ⛔ Don't "fix" it toward the oracle.

**Confidence:** high on the frames (read from the exact commit the JSON cites) and on the
`constellationScaling` and Moonsign findings; medium on Nightingale's Song, since the PR is under review
for mechanics.

---

### prune (Prune) — T0.5

**Status:** curated · **full Stage 4 landed today** from gcsim main `ac2d76dde` · no §2 or §3 rows at all ·
§5 is an exact match both ways (`Witchlure Bell 137f / 117f × 6 · none` on both sides,
`gcsim-frames-diff.md:546`). The gauge side of this character is in very good shape; the gap is the half
of the kit the dumper structurally cannot reach.

**Gaps**

- **[S] "Clang Clang! Witch-tribution Comes!" is unmodelled, and it is the cast the whole kit hangs off.**
  gcsim main now specifies it completely (`skill.go:37-46, 139-176`): `skillConvertFrames` **anim 82**,
  N 65, C 76, E 69, Q 67, D 67, J 66, swap 65; **hitmark 30**; element = the swirled element;
  **Durability 25 (1U)**; `ICDTagNone`; a **364f (6.07s)** recast window opened by a Swirl the chime itself
  caused (0.2s shared ICD across the four elements); **it bypasses the cooldown outright** (`prune.go:ActionReady`
  returns ready while the window is open, and `skillConvert` never calls `SetCD`); and the base E's →E
  cancel drops to 28f while the window is open. Today: no token, no second E pill, no off-element
  application, and A4 / C1 / C4 / C2's ramp are all anchored to the base `onHit skill` instead of the cast
  that really grants them (caveated). ⚠️ The curator note "its skillConvertFrames (anim 82) are unmeasured
  for us" is only half true now — the dumper cannot reach the branch, but the numbers are readable in
  source exactly as Illuga's Hold variant was hand-read from its PR. **Fix needs engine work**: a transient
  state opened by a _reaction_ rather than by an action's end; `bypassesCooldown` already exists on variants.
- **[A] A1's 1.2s shared ICD is unauthored.** `asc.go:a1SwirlCheckICDKey` is a **1.2s** status shared across
  all four swirl elements, and the passive fires **only off the Witchlure Bell's** swirls
  (`if atk.Info.Abil != "Witchlure Bell" { return }`), where ours fires off any of Prune's own swirls during
  any active summon. `procCooldown: 1.2` is authorable today; the ability-name narrowing is not.
  ✅ The hammer itself is `Durability: 0`, so no application is missing — our effect correctly carries none.
- **[B] C2's ATK window is short, and badly short at C6.** gcsim's C2 statmod runs `duration − 57` from
  frame 57 → **813f (13.6s)** at C0–C5 and **1053f (17.6s)** at C6 (`burst.go:30-58`, `cons.go:c6BurstBonusDur`).
  Ours is a flat 12s refresh from the cast, with the C6 +4s reaching only the summon. Measured `Prune Q`
  at C6: the C2 bar runs 7.88→19.88s while the bell bar runs 7.88→23.88s — visibly mismatched.
- **[B] C6's self-ATK window is 5.5s, not 5s** (`cons.go:c6Init`, `(5+0.5)*60`), and its "other active
  characters carrying Tolling Rally" half is a 0.5s-polled grant that follows whoever is on field.
- **[B] The bell stops, it does not skip.** `burst.go:burstTick` — with no enemy within 10 units the task
  `return`s **without re-queueing**, so the whole stream ends. The note says "skips a tick"; gcsim's
  behaviour is stronger than that.
- **[B] The summon bar's right edge is 0.6s short** — ours 12s from spawn (57→777f) against gcsim's
  57→813f. No visible tick difference (the 6th lands at 722 either way).
- **[B] `input: ["N"]` only** though `C` and `P` are in her sections; `C` parses fine (measured), `P` has no
  frames (gcsim has no `plunge.go` for her — catalyst plunges are generally unmodelled, so this is fine).

✅ **Verified exact against gcsim, worth recording as done:** burst application frame 34 (1U Anemo,
`Durability: 25`); bell cadence `firstTickDelay 1.333` / `interval 1.95` → 137, 254, 371, 488, 605, 722
(measured, 6 ticks at C0; 8 at C6 out to 956), `icdGate: 'none'` matching `ICDTagNone`; `cooldownStartDelay: 25`
matching `SetCDWithDelay(15*60, 25)`; and A4's `ratio 2.5 / offset 2000 / cap 50` reproducing
`min(max(atk−2000,0)*0.00025, 0.5)` exactly.

**7.x currency:** the Hexerei Secret Rite's two runtime gates (the triggerer must be Hexerei **and** carry
Tolling Rally) are confirmed by `asc.go:hexInit` and correctly caveated; the `stellarSwirl` trigger addition
matches the 7.0 text rename on both A1 and the skill.

**Confidence:** high — the whole character was diffed against source today and only the recast branch is
out of the oracle's reach.

---

### qiqi (Qiqi) — T0.5

**Status:** curated · frames from gcsim main (no §2/§3 rows) · applications match the oracle **exactly**
(measured: 32 / 231 / 426 / 621 / 816, which is precisely gcsim's five applied hits from §4's
ten-entry list). The gauge is right; most of the rest of her kit is unauthored or on a `manual` trigger.

**Gaps**

- **[A] The Herald of Frost's nine coordinated-attack swipes draw no tick markers, and the Team Builder
  does not know she has off-field damage.** The swipes live in the skill's `application[]` — which is
  **correct** per `docs/furina-arkhe-round.md` §9.2: gcsim's own comment concedes it is guessing, and the
  cadence is PAIRED (1.5 / 3.75 / 4.75 / 7 / 8 / 10.25 / 11.25 / 13.5 / 14.5s) which a fixed `summonTick`
  interval cannot express. The costs are two: the Herald's summon bar shows **4 heal marks and zero damage
  marks** (measured ticks `32, 302, 572, 842`), and `deriveCapabilities` derives `offFieldDamage` only from
  a `summonTick` damage effect (`deriveCapabilities.ts:430`), so she carries no off-field-DMG facet at all.
  Named in `caveat-open-items.md` §5 as an implement candidate; the real fix is an irregular/list-form tick
  series — engine work.
- **[A] A1 Life-Prolonging Methods is unauthored** (`qiqi.json:286-294`, no `effects`, note says "needs
  reviewer pass"): +20% Incoming Healing Bonus for 8s to whoever triggers a reaction under the Herald.
  gcsim implements it (`asc.go:a1()`, subscribed to every reaction event, gated on `skillBuffKey`). That is
  a real team buff bar that never draws. Shape is `buff / onReaction (class list) / target active /
duration 8 / condition state duringSummon` — authorable today if an incoming-healing Stat key exists.
- **[A] A4 is unauthored** — 50% chance on N/CA hit to apply a 6s Fortune-Preserving Talisman, 30s ICD
  (`burst.go:onNACAHitHook`). The Talisman **is** a lane bar the tool already draws (the burst authors it
  as a 15s summon), so at A4 a second bar should appear and never does. The proc chance has no primitive.
- **[A] The burst's Talisman HEALING is unauthored** (162% ATK + 1270 at TL10, once per second, to whoever
  damages the marked enemy — `burst.go:talismanHealHook`, 1s ICD via `talismanICDKey`). The Talisman bar
  therefore carries **no tick marks at all**, and the character's entire identity is that heal. Recorded in
  the curator notes as "STILL UNAUTHORED (pre-existing)".
- **[B] C2's base half is unauthored** — +15% N/CA DMG against Cryo-affected opponents
  (`cons.go:c2()`); only the Stellar half is. The file's own note says it is wireable as
  `normalDmgBonus` + `chargeDmgBonus` gated on `enemyAffectedBy: cryo`.
- **[B] C4's `target: 'team'` `manual` heal hands the Team Builder a party-wide-heal claim no caveat can
  reach** (the kit heals one ally, lowest HP%). Already queued for Nate as the Kirara-C2 house form
  (`caveat-open-items.md` §3). Its other half — the 20% enemy ATK debuff — needs an enemy-debuff target model.
- **[B] C1 is two `manual` energy effects** — inert, knowingly; energy has no surface.
- **[B] The Herald's bar is 0.53s long.** Our summon runs `spawnsAt 32 → 932f` (15s from spawn); gcsim's
  `skillBuffKey` is `15*60 + 1` **from the cast** (`skill.go:35`), i.e. 0→901.
- **[B] The unconditional `cooldownModifiers: flat -15`** means every reader sees a 15s E whether or not
  they have done the Witch's Revelation quest, and it does not reproduce the "subtract 15s from the
  remaining cooldown" mechanic under Anemo Resonance. Caveated ✓ and listed in `caveat-open-items.md:25`.

**7.x currency (G):** the Witch's Revelation passive _Seven Sacred Treasures_ is authored from the Fandom
page alone (gcsim has no Stellar Qiqi) — the CD patch plus two bucket-5 Reaction-Bonus team buffs, with
Radiance approximated by `teamEnablesReaction: stellarConduct` and caveated ✓. C2's Radiance +50% ATK is
authored with a caveat ✓. Correctly **not** authored: the burst's extra Stellar-Conduct instance and C6's
Glimpse of Mystery ledger (both additive-base-DMG, i.e. damage magnitude), and A4's Radiance upgrade (a
proc-chance change on an unauthored proc). ⚠️ The wiki infobox's stray "Cryo Swirl DMG Bonus" tag is
flagged for the next snapshot refresh and is still unresolved.

**Confidence:** high. Applications were measured against the oracle row directly; the unauthored items are
all self-declared in the file's own "needs reviewer pass" notes and confirmed present in gcsim.

---

### Cross-cutting observation (affects 6 of the 7)

The `↻ CAVEAT REMOVED 2026-08-19 (ruthless pass, Nate-approved): **no pixel** — …` notes store, after the
words "no pixel", a paragraph that in several cases **describes a live on-screen divergence and closes with
a keep-category label**. Examples in this batch: escoffier's skill ("a hold cast draws the TAP form's 15s
cooldown, its 35f cast and a Cooking Mek lane with 17 tick marks, none of which is the mode the player
asked for" · `visible-divergence`), bennett's burst ("the screen shows healing and the ATK buff running
together for the whole 12s, which the game never does" · `approximation-disclosure`), qiqi's A4 ("a blank in
a lane the character already populates" · `expected-but-absent`), prune's burst ("a bare bar" ·
`expected-but-absent`). Those three categories are the ones `caveat-open-items.md` uses for caveats that
were **kept**. I am not claiming the removals were wrong — the ruthless pass was a deliberate 261→107 cut
with Nate in the loop — but if anyone re-audits caveats, these rows are where the stored rationale reads as
an argument against its own verdict, and escoffier's `hE`→tap fallback in particular is a genuinely wrong
pixel with no caveat now standing over it.

---

### Batch summary

| id        | tier | #S  | #A  | #B  | one-line headline                                                                                                                                                          |
| --------- | ---- | --- | --- | --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| escoffier | T0.5 | 2   | 4   | 3   | The Cooking Mek's ticks are fed to the gauge twice, on two clocks, 18f out of phase, with the wrong ICD group — §8 cleared her with a test the phase error defeated        |
| fischl    | T0.5 | 0   | 4   | 6   | Oz is modelled well; C1 and A1 are structurally unauthorable, the burst Oz is hard-coded to the swap-cancel spawn, and every tick marker is 10f early (missing `ozTravel`) |
| alyosha   | T0.5 | 1   | 3   | 6   | Best effect authoring in the batch and it measures correct — but no gcsim anywhere, so both casts apply at frame 0, and Tugarin draws every tick marker three times        |
| bennett   | T0.5 | 1   | 2   | 6   | The most-read buff bar in the tool ends ~2.6s early: gcsim re-applies a 126f statmod per field tick, so the ATK bonus really runs to 14.67s                                |
| illuga    | T0.5 | 2   | 1   | 6   | Frames match PR #2677 exactly, but Nightingale's Song (which can END the 20s window early) is unmodelled and `constellationScaling` prints C0 numbers at C6                |
| prune     | T0.5 | 1   | 1   | 5   | Stage 4 is exact everywhere the oracle reaches; the Clang Clang recast — frames, element, 6.07s window, cooldown bypass, all now in gcsim main — has no token at all       |
| qiqi      | T0.5 | 0   | 4   | 6   | Applications match the oracle exactly, but the Herald's 9 swipes and the Talisman's per-second heal draw zero tick marks and she derives no off-field-DMG facet            |

---

<!-- batch 6 -->

## Batch 6 — arlecchino · kinich · lohen · mualani · varesa · albedo (all Prydwen T1)

_Audited 2026-09-15 against gcsim `ac2d76dde`, `docs/curation/*` as committed on `curation/gcsim-sync-2026-09`, and live parses (throwaway probes under `scratch/`, deleted). No repository file was modified._

**Two findings dominate this batch and neither is in any curation report:**

1. **Kinich's Scalespiker Cannon and Loop Shot are both unreachable from notation** — the whole Nightsoul kit renders as his out-of-stance physical claymore. Data-fixable, no engine work.
2. **Varesa's `sQ` (Volcano Kablam) is blocked by the base burst's 18s cooldown** and, when it finally fires, resolves as the _base_ burst. Data-fixable.

---

### arlecchino (Arlecchino) — T1

**Status:** curated, frames from gcsim main and clean (no §2/§3 rows, every N carries `hit`, charge + both plunge maps present). Skill and burst both carry measured `application[]` (§4 rows match). gcsim coverage complete. **Zero caveats in the file** — every one was removed in the 2026-08-19 ruthless pass, and two of the gaps below now reach no reader.

**Gaps**

- **[S] Her burst does not reset All Is Ash's cooldown.** Kit: "clearing the CD of All Is Ash"; gcsim `arlecchino/burst.go:47` `QueueCharTask(func(){ c.ResetActionCooldown(action.ActionSkill) }, 107)`. Measured `Arlecchino E N1 N2 N3 C Q E` → casts at `skill@0.00 burst@5.15 skill@30.27`; in game the second E is castable ~1.8s after Q. This is the single most visible error in her canonical rotation. — fix: a `cdReset { source:'character', trigger:{onCast,burst}, resets:'skill' }`, but **engine work first**: `getCharacterCdResetTargets` (`src/lib/sim/cooldowns.ts:83`) walks `passives` + unlocked constellations only and never `char.abilities`, so an ability-intrinsic reset has nowhere to live (rubric **D8**, same defect as Freminet's burst).
- **[S] Masque of the Red Death's Pyro infusion is unauthored, so six N swings and a CA apply nothing to the gauge.** gcsim `attack.go:134-137`, `charge.go:66-67`, `plunge.go:94/150/185` all set `ai.Element = attributes.Pyro` under `naBuffKey`. Measured `Arlecchino E N1 N2 N3 C Q` → applications `0.28pyro 5.63pyro 6.98pyro 10.63pyro` — **not one of the six swings or the CA contributes**, where in game she is a continuous Pyro applicator (her CA carries `chargedIcdWindow {timer:30}`, which is authored and currently unreachable because the swing is Physical). The curator note calls this out of scope because Bond of Life is untrackable, but a played Arlecchino is in Masque essentially always. — fix: `NormalAbility.infusion: 'pyro'` on the normal entry plus a caveat ("assumes Masque"), exactly the shape the Durin dark-commit fix used 2026-09-04. Authorable today.
- **[A] C6's crit buffs use `trigger: 'manual'` and therefore draw nothing at C6.** `arlecchino.json` constellations[5].effects — both `critRate 10` and `critDmg 70`, `duration 20`, trigger `manual`. Rubric **D3**: 167 manual-trigger effects reach no planner surface. gcsim `cons.go:108` fires them from the skill on a 15s ICD. Measured `Arlecchino E … Q` at C6 → **zero windows of any kind**. — fix: retrigger as `onCast / ability:'skill'`, `duration 20`. Authorable today; the per-ability scoping (N + Q only) and the 15s ICD are not expressible (`procCooldown` is not read on a character buff bar, rubric D4).
- **[A] C2's 900% Pyro AoE + 20% all-RES for 15s also `manual` → nothing draws.** gcsim `cons.go:45-48` (`c2OnAbsorbDue`, frame 50 after an absorb, 10s ICD). — fix: needs an `onAbsorbDirective` trigger primitive (engine). Its damage effect also carries no `application[]`, so even wired it would be rejected by `sim/procs.ts:157` (rubric D10).
- **[A] Blood-Debt Directive has no bar and no tick markers.** A 30s enemy-attached debuff that deals 2 Pyro instances at +5s/+10s (gcsim `skill.go:100-130`) — the only trace on screen is two Pyro dots on the aura lane. Curator note already asks for "enemy-attached debuffs with periodic damage callbacks". — fix: engine (no enemy-side lane exists).
- **[A] The Masque cooldown refund is unmodelled.** Every Masque-consuming normal hit cuts All Is Ash's CD by 0.8s (gcsim `attack.go` `bondConsumeCB` → `ReduceActionCooldown(ActionSkill, 0.8*60)`), so an N1–N6 string takes ~4.8s off a 30s CD — a visible shift of the next E pill. `cooldownReduce` exists in `ability.ts:1507` but is explicitly schema-only ("parser implementation deferred"). — fix: engine.
- **[B] Her E's application list is ICD-filtered the wrong way round.** Measured `Arlecchino E` → `17f · 338f · 638f`; gcsim (`gcsim-frames-diff.md:191`) → `+17 (1U) · +38 (1U) · +338 [icd] · +638 (1U)`. The frame-38 Cleave is `ICDTagNone` in gcsim and always applies; the frame-338 directive tick sits on `ICDGroupArlecchinoElementalArt` (600f / every 3, `icd_groups.dm.go:83,149`) and is suppressed. We do the opposite because `resolveCastApplications` (`sim/aura.ts:539-541`) runs the whole list through one _standard_ clock. Net count is right, two of three land on the wrong frame (0.63s vs 5.63s). — fix: a per-cast `icdGate` on `application[]` mirroring `summonTick.icdGate` would get 17/638 but still not the Cleave; truly correct needs per-entry ICD tags. Engine, low priority.
- **[B] `application[]` frame 338 carries no `units`**, so that Pyro tick draws a `--ui-provisional` foot. gcsim's directive tick is `Durability: 25` = 1U. One-line fix.
- **[B] Stale curator note.** `constellations[5]._curatorNotes` says "the critRate skeleton above has `value: 70` — this is **wrong** … Reviewer to fix to 10". The value **is** 10. Delete the note.
- **[B] C4 (−2s burst CD, +15 energy per absorb, 10s ICD) unauthored** — `capability-sweep.md:77` files it as "wiki attributes energy (C4) — nothing derives". Needs `cooldownReduce` + an energy surface; both engine.
- **[B] `data-outliers.md:22`** flags `damage|atk = 900` on C2 — real value, inert effect. No action.

**Improvements:** add `units: 1` to the 338f application; delete the stale C6 note; restore at least one caveat (the burst/CD reset and the Masque infusion are both "name the pixel" qualifiers). A1 (BoL-on-kill, Due upgrade) and the CA early-cancel are correctly unauthored — no pixel.

**Confidence:** high. Frames, applications and cooldowns cross-read against gcsim source; the CD-reset and infusion gaps measured in the parser.

---

### kinich (Kinich) — T1

**Status:** curated; base normals have §2 disagreements, both Nightsoul abilities are §3-uncovered and §4 "no observed schedule" because `drivers.json:27` cannot enter his Nightsoul ("gcsim errors on `skill` under every prereq we tried"). gcsim main has full source, so the oracle's blindness is **not** a data blocker — everything below was read straight out of `internal/characters/kinich/`. **Zero caveats.**

**Gaps**

- **[S] Scalespiker Cannon is unreachable from any notation, at any constellation.** `resolveActiveAbility` (`src/lib/sim/resolve.ts:264-290`) matches candidates by `abilityType` alone and returns the **first** conditioned one. Loop Shot (`abilities[1]`) and Scalespiker Cannon (`abilities[3]`) are both `abilityType:'skill'` with the identical `conditions {state:'nightsoulBlessing'}`, so Loop Shot always wins. Measured `Kinich E E E` → `canopy_hunter_riding_high@0, kinich__skill__loop_shot@42, kinich__skill__loop_shot@75`. His payoff cast — the one A4, C1, C2 and C6 all hang on — never draws. — fix: see next item; data-only.
- **[S] Loop Shot is unreachable from `N`.** It is typed `abilityType:'skill'` with `input:['N']`, and the parser resolves an `N` token through the _normal_ ability list. Measured `Kinich E N` → one action event on `kinich__normal__nightsun_style` (his out-of-Nightsoul **physical** claymore swing) and **zero applications**. So the in-Nightsoul N rotation draws the wrong ability, the wrong element and no Dendro at all. — fix: re-type Loop Shot as `abilityType:'normal'` with `conditions {state:'nightsoulBlessing'}` — Mualani's Sharky's Bite shape, which resolves correctly (verified). That simultaneously frees the in-stance `E` slot for Scalespiker Cannon. Authorable today, no engine change. (⚠ the same defect class sits on `lan_yan__skill__feathermoon_ring_n`.)
- **[S] Base normals have no `hit` and carry `swap = anim`.** `gcsim-frames-diff.md:68-70`: `swap 47→21 / 48→22 / 79→44`; gcsim `attack.go:45-52` is `InitNormalCancelSlice(21|22|44, 47|48|79)`. A normal→E/Q/swap transition is 26–35 frames late. — fix: `{anim:47, hit:21, N:30}` etc.; `migrate-frames-shape.mjs` writes it.
- **[A] Neither Nightsoul ability authors `application[]`.** Absent ⇒ Dendro at the cast instant, flagged provisional (measured: `Kinich E E` → one `42f dendro` with `provisionalUnits: true`). gcsim: Loop Shot lands **two** hits at 30 and 38 (`attack.go:29` `skillAttackHitmarks`), the Cannon lands at release 35 + 1 + travel 12 = **48** (`skill.go:152`). — fix: author both lists (1U each, `Durability: 25`). Authorable today from source even though the oracle can't reach it.
- **[A] C2's −30% Dendro RES fires off the cold-open Canopy Hunter cast, which deals no damage.** gcsim `skill.go:51-91` queues **no attack** for the cold-open (our own `application: []` says the same), and `c2ResShredCB` is attached only to Loop Shot / Cannon hits. Measured at C6: `Kinich E N N E Q` → a shred window `0.00→6.00` anchored on the cold open. — fix: once Loop Shot/Cannon resolve properly, narrow `trigger` to those hits (needs an ability-id filter on `onHit`, which the schema lacks → engine) or accept and caveat.
- **[A] The burst's +1.7s Nightsoul extension is unauthored.** gcsim `burst.go:38-42` `SetNightsoulExitTimer(duration + 1.7*60)` when Q is cast in-blessing. `durationExtensions` is live (Lohen's `+1.65s` works — measured `Lohen E Q` → stance `0.00→14.65`). — fix: add `durationExtensions [{trigger:{onCast,burst}, conditions:{state:'nightsoulBlessing'}, delta:1.7}]` to Canopy Hunter. Authorable today.
- **[A] Hold-E is unauthored** (`hE` falls through to tap). gcsim supports a hold up to 300f, and the cooldown delay grows with it. Low priority (the hold is an aim).
- **[B] A4 Hunter's Experience draws on the wrong cast and for the wrong length.** `trigger: onCast ability:'skill'` with a 1s placeholder duration for what is a single-hit FlatDmg snapshot on the Cannon; measured, it draws on the cold-open E and on each Loop Shot. Stack acquisition (a teammate's Nightsoul Burst) is not authored either, though `onTeamNightsoulBurst` **exists** and Varesa uses it — a `gainStacks` on that trigger would at least make the `stacks min 1` gate honest. Authorable today.
- **[B] Ajaw's series is `standard` while gcsim shares one ICD counter between the burst hit and every laser.** `gcsim-frames-diff.md:301`: gcsim applies at 161/403/553/703/993 and suppresses 253/848; ours applies 161/253/547/841 (measured summon `ticks=6`, spans 5.05→20.05s, cadence and count both correct). Standing rule ("counters are NOT shared across casts"); documented in the burst's curator notes. No action.
- **[B] C6's bounce fires on any skill hit** (`onHit abilityType:'skill'`) — over-fires on Loop Shot in game; currently moot because Loop Shot resolves from E. `data-outliers.md:29` flags `damage|atk = 700` — real value.
- **[B] C4's +5 Energy per Loop Shot/Cannon hit (2.8s ICD) unauthored** — `capability-sweep.md:115`. Energy has no timeline surface anyway.
- **[B] No `chargeFrames` and no `plungeFrames`** — correct: gcsim `charge.go` carries explicit TODOs and there is no `plunge.go`.
- **[B] Zero caveats**, including for the charged attack the game refuses inside Nightsoul (that caveat was removed 2026-08-19 and its "kept half" was never re-added).

**Improvements:** the ability-shape fix (S1+S2) is one edit and unblocks the C2 shred, the A4 bar and the `application[]` work at the same time. `duration: 10` vs gcsim's `10*60+10` is a 10-frame rounding — leave it.

**Confidence:** high for the unreachability findings (measured three ways) and the frame rows; medium on the right _replacement_ ICD handling for Loop Shot (its real group is `ICDGroupKinichLoopShot`, 120f / `{1,0,0,0}` — expressible by neither `noICD` nor the standard window).

---

### lohen (Lohen) — T1

**Status:** honest stub. **No gcsim source anywhere** (`gcsim-frames-diff.md:18` lists him among the 11 un-oracleable characters; `capability-audit.md:73` "uncurated stub (no frame data)"), in `FRAMELESS_EXEMPT`, Stages 1–3 only. Sourcing is the KQM quickguide + Fandom. Three caveats present and all of them earn their place.

**Gaps**

- **[S] No frames at all — not one FrameMap in the file.** The normal ability has no `hits`, and neither E nor Q has `frames`. Every block is a generic cast-time fallback, and both casts apply Cryo at frame 0 flagged provisional (measured `Lohen E` → `{time:0, cryo, provisionalUnits:true}`). — fix: blocked until gcsim ships him; nothing else can close it (the recipe forbids fabricating frames).
- **[A] Etched Into Bone and Soul — the special Elemental Skill a Lohen player casts up to 3× (5 at C6) per Masterstroke — has no ability entry and no token.** Caveated ✓ (`abilities[1].caveat`). It also blocks the Hexerei Secret Rite's hit trigger and C2's arming chain. — fix: needs the Joy resource plus a token; engine + data.
- **[A] A4's +15% ATK lands on the wrong row and ignores its Masterstroke gate.** `target: ['self','active']` puts the teammate's half on the ACTIVE character; in game it belongs to whoever triggered the Cryo reaction, usually an off-field applier. And the `conditions {state:'inStance'}` gate resolves **null** in buff-window evaluation (rubric **D6** — 88 such conditions over 36 characters), so it renders optimistically. Measured `Lohen E Q > Xiangling E`: Masterstroke ends at 2.32s on the swap, and the +15% ATK bar still draws `4.55→12.55` off Xiangling's melt. **The caveat that said this was removed 2026-08-19** and nothing replaced it. — fix: caveat (the target and the gate are both engine-shaped).
- **[A] No `application[]` anywhere**, and the Cryo cadence his infused attacks produce (~6 instances / 5s per the KQM guide) is unmodelled — his whole reason for being in a team is Cryo application. Blocked on gcsim.
- **[B] C2's +200 EM draws twice, from the E cast _and_ from the Q cast**, with no arming gate and with `procCooldown: 4` ignored on a character buff bar (rubric D4). Measured `Lohen E Q` at C2 → two 8s windows at 0.00 and 0.73. Caveated ✓ and tracked in `caveat-open-items.md:31`.
- **[B] The Hexerei Secret Rite fires on every burst cast** — the Will-to-Win ≥50% gate has no primitive. Caveated ✓.
- **[B] The Cryo self-infusion keeps a flat 13s while the stance can extend to 14.65s** (own curator note; effect windows do not ride `durationExtensions`). Measured. Small, not caveated.
- **[B] C1 / C4 / C6 carry `effects: []` and that is CORRECT** — Will to Win cap, Joy, self energy, self CRIT DMG are all on-field self-DPS resources with no team-facing pixel. C4's 15 Energy is self-only; `capability-sweep.md:123` files it as an over-attribution by the wiki.
- **[B] `summon-conditions-round.md:44` lists `lohen C6`** as an open summon-condition item — no summon exists, so it is a false positive there.

**Improvements:** nothing authorable improves him materially until gcsim ships a Lohen package; the one cheap win is restoring an A4 caveat.

**Confidence:** high on what is absent, medium on the _values_ (all web-sourced, no oracle — the 13s Masterstroke, the 1.65s extension and the +15%/+200 numbers cannot be cross-checked).

---

### mualani (Mualani) — T1

**Status:** curated; frames from gcsim main, no §2/§3 rows. Skill `application: []` is a correct positive claim (gcsim's E queues no attack) and the burst's frame 178 matches `108 + travel 70` exactly. Her _in-stance_ normal resolves correctly. **Zero caveats**, and her passives/constellations contribute exactly one thing to the timeline.

**Gaps**

- **[S] The skill's 6s cooldown starts at the cast; in game it starts when Nightsoul ends.** gcsim sets it **only** in `cancelNightsoul` (`skill.go:57` `c.SetCD(action.ActionSkill, 6*60)`), which runs on point exhaustion, on a re-press, and on swap (`mualani.go:121-127`). Measured `Mualani E E` → second E at 6.00s; in game it is stance-end + 6s. **The curator note saying "Schema has no field to express 'CD starts on stance end'" is STALE** — `cooldownStartsAtStanceEnd` shipped 2026-08-15 with Xilonen and Ifa (`docs/stance-cooldown-round.md`). — fix: one field. Authorable today.
- **[S] Sharky's Bite applies Hydro at the swing's cancel point, not its hitmark.** A normal's hit time is `action.time + cancel-resolved duration` (verified: `Klee N3` → app at 31 = `frames.N`; `Mualani N3` → app at 23 = `frames.N`), and Sharky's Bite's cancel ladder is gcsim's genuine one (`sharkBiteFrames[0]`: Attack 109, anim/swap 215) while its hitmark is 7 + 10 travel. Measured `Mualani E N` → Hydro at **frame 220** where gcsim lands it at 22; mid-chain `Mualani E N N N Q` → `1.90 3.72 4.38` vs gcsim's `0.36 2.18 4.00`. She is the Hydro applicator in every team she is in, so the aura lane is 1.5–3.3s late on every bite. — fix: **engine** — a normal's hit record must read `frames.hit` independently of the cancel key. Authoring `hit` cannot fix it (`hit` only fills _absent_ cancel keys, and hers are all explicit).
- **[A] Wave Momentum / Sharky's Surging Bite / Marked as Prey / Shark Missiles are entirely unmodelled.** No stack resource, no 3-stack frame variant (gcsim `sharkBiteFrames[3]`: Attack 144, anim 258, hitmark 42), no mark, no missile spread. Every bite draws the 0-stack block — and at C2 the game hands her 2 free stacks on entry, so the _first_ bite is usually a Surging Bite with a 44-frame-later hitmark and a much longer block. — fix: `gainStacks`/`consumeStacks` exist and dispatch on `onHit`, so the resource is partly authorable today; the **frame variant is not** (a `hits[]` entry cannot be stack-gated).
- **[A] A4 "Wavechaser's Exploits" and C1 both carry `trigger: 'manual'` damage effects → they reach no surface.** Rubric D3. Combined with C2/C6 being description-only, **the only thing her passives and constellations put on screen is C4's +75% burst chip.** — fix: A4 is a stack-gated FlatDmg on the burst (no pixel — damage magnitude, correctly out of scope); C1 likewise. The honest action is to delete the two `manual` skeletons and say so in `_curatorNotes`, not to author them. `data-outliers.md:32` flags C1's `damage|hp = 66`.
- **[A] Re-pressing E cancels the stance and is not modelled** (gcsim `skill.go:83-90` returns `skillCancelFrames`, swap 11 / N 7 / Q 4). Our second E starts a fresh 6s stance. Same missing primitive as Varesa's plunge exit — a stance **terminator** token.
- **[A] `duration: 6` is gcsim's no-movement baseline.** Real uptime is ~12s once A1 Puffers (+20 points ×2) and C2 (+12 over 2s) are in play; the pill is roughly half the window a player sees. — fix: not authorable honestly (Nightsoul points are a gauge we do not track); **caveat it**.
- **[B] `genshin-db-diff.md:18`** — `cd-mismatch … ours=6 vs genshin-db=1.8`. Ours is right (gcsim `6*60`); genshin-db's 1.8 is the Sharky's Bite attack cooldown. Suppress the row.
- **[B] Sharky's Bite's own 1.8s cooldown is unmodelled** (gcsim `SetNumCharges(ActionAttack, 1)` + `ResetActionCooldown` on stance exit). In practice the 109f block spacing already approximates it.
- **[B] A charged attack inside the stance draws a block the game refuses** (gcsim blocks `ActionCharge` during Nightsoul). Not caveated. Same class as Kinich's removed caveat.
- **[B] No plunge frames — correct** (gcsim has no `plunge.go` for her). Base-normal cancel keys are all explicit and match gcsim; the missing `hit` is harmless there.

**Improvements:** `cooldownStartsAtStanceEnd: true` is a one-line, high-value fix. Add a caveat for the 6s stance length and for the in-stance CA. Retire the two `manual` skeletons.

**Confidence:** high — every claim measured in the parser or read off gcsim source; the only judgement call is grading the bite-timing gap S rather than A.

---

### varesa (Varesa) — T1

**Status:** curated; base frames from gcsim, but every Fiery-Passion map is §3-uncovered ("no gcsl spelling … no driver row for its state") and the `sQ` variant and `fiery_passion_rush` are both in §4's "No observed schedule" list, because `drivers.json:29` says her skill leaves her **airborne** so a post-skill `attack` reads a plunge, not her Nightsoul normal. gcsim main has the full source, so the oracle's blindness is again not a data blocker. Rich authoring (transient states, `sQ`, `constellationScaling`) — and **zero caveats**, which the file's own notes twice flag as wrong.

**Gaps**

- **[S] `sQ` is blocked by the base burst's 18s cooldown, and then resolves as the base burst.** Measured `Varesa E Q C P sQ` at C0: `apexDrive` runs `4.95→7.28s`, but the casts come out `skill@0.00 burst@0.37 burst@18.37` — the `sQ` waits out the 18s clock, by which time Apex Drive has lapsed, so it resolves **Guardian Vent** (70 energy, a fresh 15s Fiery Passion) instead of Volcano Kablam. The kit is explicit: "While affected by Apex Drive, Varesa can **ignore her Elemental Burst CD** and consume less Energy". The curator note copied gcsim's `ActionReady` gate (`varesa.go:66-72`, an `AvailableCDCharge` check) and chose no `bypassesCooldown` — but gcsim's own working rotation enters Fiery Passion by _plunge_, so its burst charge is never spent and the gate never bites. **This is the central Varesa rotation and it is wrong at C0.** (At C2 without a preceding Q it works: `Varesa E C P sQ` → `burst@3.35 [Volcano Kablam]` ✓.) — fix: `bypassesCooldown: true` on the variant (the Flins Thunderous Symphony precedent). Authorable today.
- **[S] The Volcano Kablam variant has no `application[]` and inherits the base burst's frame 88.** Measured at C2: the Kablam casts at 3.35s and its Electro lands at **4.82s** — 46 frames _after_ the variant's own 42–47-frame block has ended. gcsim `burst.go:22` `kablamHitmark = 42`, Electro, `Durability: 25`. — fix: `application: [{frame: 42, element: 'electro', units: 1}]` on the variant. Authorable today.
- **[A] Only ONE of A1's two `plungeFlatDmg` tiers ever draws, and it is the weaker one.** The self-buff pool dedupes by `stat` **before** conditions are evaluated, and a kit `state` condition returns null (rubric D6), so the first-authored out-of-Fiery-Passion `+50% ATK` effect is what prints at every constellation, in and out of the stance. Compounding it, `constellationScaling` (C1's upgrade to 180%) is read only by the `gainStacks` amount override and `tickCapScaling` — it appears nowhere in `buffWindows.ts`/`buffDisplay.ts`. Measured at C0, C2 **and** C6: always `plungeFlatDmg = {scaling, atk, ratio: 50}`. The in-FP 180% tier is unreachable. — fix: engine (either evaluate conditions before the stat dedupe, or teach the buff path `constellationScaling`). The curator note at `constellations[0]` already records both halves.
- **[A] Pressing `E` should close Apex Drive and does not.** gcsim `skill.go:91-92` `if c.StatusIsActive(apexState) { c.DeleteStatus(apexState) }`; kit: "Varesa will exit Apex Drive after using her Elemental Skill." Our parse leaves the 2.33s window open, so `P E sQ` still fires the Kablam. — fix: add `consumes: ['apexDrive']` to the skill's transient-state spec — the primitive exists (mode displacement). Authorable today.
- **[A] A plunge inside Fiery Passion ends the blessing; our 15s pill runs its full authored length.** gcsim `plunge.go:175-186` sets `exitNS = true` and consumes all points, and `clearNightsoulCB` drops the blessing at the next non-burst animation. So after `Q C P sQ` the player is out of Fiery Passion at ~4s while the chart shows the stance to 15.37s — and every in-FP variant after that keeps resolving. The file's own note says this "currently reaches no reader at all". — fix: the stance-**cancel** primitive (a token that terminates a state), which `TokenKind` lacks — same engine gap as Ifa's landing (`docs/stance-cooldown-round.md`). Meanwhile it is caveat-shaped, and the burst ability is the only host that can carry the prose.
- **[A] A4 is two independent 12s stacks; we draw one refreshing +35% bar.** gcsim `asc.go:62-76` uses `MultipleRefreshNoRemove(2, …)` — peak **+70% ATK**. Own note acknowledges it. — fix: an independent-stack-duration BuffValue (engine).
- **[B] Normal FrameMaps carry `anim = swap = hitmark` instead of the animation length.** Ours: base `anim` 23/7/33, fiery 17/29/37. gcsim `attack.go:35-58`: `InitNormalCancelSlice(hitmark, 49|30|59)` base, `(…, 39|47|63)` fiery. `gcsim-frames-diff.md:79-80` flags `by_the_horns.hits[0]` and `.plungeFrames` (part of that row is gcsim's 6-frame N1 windup, but the `anim` error is real and independent). `by_the_horns.plungeFrames.anim = 37` where gcsim's high plunge is `InitAbilSlice(72)`. — fix: mechanical, per §1.
- **[B] `fiery_passion_rush` has no `application[]`** → provisional Electro at frame 0 vs gcsim's `fierySkillHitmark = 2`. Two frames, but it puts a `--ui-provisional` foot on the lane for no reason. One-line fix.
- **[B] C6's +10% CRIT Rate / +100% CRIT DMG on plunges and burst is unauthored** (gcsim `cons.go:86-107`) — a real C6 omission; blocked on per-ability buff scoping.
- **[B] C2's +11.5 and C6's +30 `energy` effects reach no planner surface** — `deriveCapabilities` is their only reader. (Note gcsim implements neither C6 energy nor the C2 Apex trigger the way the kit words it; our values follow the kit and are right.)
- **[B] A1's cancellation on ground impact is not modelled** (`a1Cancel`), and **C1's Tornado-plunge Rainbow Crash grant cannot be authored** — a buff cannot be gated to a variant (`trigger.input` is read only by the stack dispatchers). Both recorded in `_curatorNotes`; don't re-open the second.
- **[B] Charged-attack Electro lands at the swing's end (139f) rather than gcsim's `chargeHitmark = 69`** — the same engine approximation as Mualani's bite, ~1.2s here.

**Improvements:** `bypassesCooldown` + the Kablam's `application[]` are two small edits that fix the rotation everybody types. The Fiery-Passion-ends-on-plunge divergence deserves the file's first caveat (the burst is the only legal host).

**Confidence:** high on the `sQ` and application findings (measured at C0/C2/C6); medium on grading the CD question, since gcsim and the kit text disagree and there is no third oracle — but the measured on-screen result (a 13-second-late cast that silently becomes a different ability) is wrong under either reading.

---

### albedo (Albedo) — T1

**Status:** the strongest file in the batch. Frames match gcsim exactly (no §2/§3 rows), skill and burst both carry measured `application[]` (§4:180-181), the construct's 30s/`spawnsAt 25`/`terminatesOn recast` and the 4s/23f cooldown all match `skill.go`, and the Transient Blossom is authored as a real summon-hosted `onHit` proc with its own `application[]` (coordinated-attack round, 2026-08-18). Hexerei Secret Rite split into two correctly-labelled entries with a caveat. Measured `Albedo E Q > Xiangling E Q` → Isotoma `0.42→30.42s` with 6 blossom tick markers.

**Gaps**

- **[A] The burst's 7 Fatal Blossoms are missing from `application[]` and from every lane.** gcsim `burst.go:80-99` queues 7 attacks at `145 + i×5` frames (Geo, `Durability: 25`, sharing `ICDTagElementalBurst` with the initial hit) **whenever a Solar Isotoma is up** — i.e. in every real rotation. Our burst authors only `frame 75`. ⚠ **§4's row cannot see this**: the dumper runs one ability in an empty core, so `c.skillActive` is false and the blossom branch returns early — this is exactly the oracle-artefact class the report warns about, in the opposite direction (a row that looks complete and is not). — fix: extend the burst's `application[]` with the seven hits (a `[icd]`-suppressed hit is still authored). Authorable today; needs a driver that casts E first, or hand-authoring from source.
- **[A] Homuncular Nature's +125 EM bar starts 75 frames early.** gcsim calls `c.a4()` inside the `burstHitmark` task (`burst.go:65`), so the 10s window runs 75→675; ours is `onCast burst`, measured `0.55→10.55s` for a cast at 0.55. 1.25s early at both ends. — fix: no `onHit`-anchored team buff shape exists for a burst that deals its damage mid-animation; accept, or engine.
- **[B] No `plungeFrames` / `lowPlungeFrames`, though gcsim has both** (`plunge.go`: high `InitAbilSlice(66)`/hitmark 39, low `63`/37). A `P` in an Albedo segment emits **no action event at all** (`run.ts`: an unresolvable plunge emits nothing), which matters because C4 is a plunge buff and Albedo appears in Geo plunge comps. — fix: mechanical.
- **[B] The Transient Blossom fires off Albedo's own E hit and the Isotoma's radius gate is unmodelled.** gcsim `skill.go:118-120` excludes `skillAbilInitial` by name and requires `trg.IsWithinArea(c.skillArea)` (radius 10). Measured `Albedo E Q` at C6 → `ticks=1`, and that one tick is from his own E while the Q's hit at 1.80s is suppressed by our 2s proc cooldown — gcsim would do the reverse. The effect's own `_curatorNotes` state both halves accurately. Positional gating is a standing refusal (`docs/gauge-round-L5e.md`); the self-exclusion is authorable only with an ability-name filter on the proc trigger (engine).
- **[B] The Silver Isotomas (2+ Hexerei) are not summons and never will be** — enemy-anchored, spawn-gated on a skill HIT within 20s of a _prior_ skill cast, 2-construct pool. Caveated on the Secret Rite entry ✓, and the Secret Rite's Silver buff correspondingly fires from the first skill hit. Correct call; note the removed skill-level caveat ("a Hexerei player sees ONE lane where they expect up to two more") was a real pixel and now reaches nobody.
- **[B] C1 energy (1.2/blossom), C2 Fatal Reckoning, C4 plunge, C6 crystallize+position — all correctly unauthored**, and each reason was re-derived 2026-08-18. ⚓ The load-bearing one: a proc landing announces itself through `notifyDamage` and **never enters `dispatchHit`**, so a blossom cannot grant a Fatal Reckoning stack. ⛔ Do not re-open any of these on the strength of the blossoms now existing.
- **[B] `data-outliers.md:21`** flags C1's `def% = 50` as a magnitude outlier — correct value (the permanent current-patch C1 addition, Nate's 2026-07-29 ruling). No action.

**Improvements:** add the Fatal Blossom applications and the two plunge maps; consider restoring the Silver-Isotoma "missing lanes" caveat on the skill. Everything else is either right or refused for a stated, still-current reason.

**Confidence:** high. The only claim I could not measure end-to-end is the exact ICD outcome of the seven blossoms, because `skillActive` is false in the oracle's core.

---

### Batch summary

| id         | tier | #S  | #A  | #B  | headline                                                                                                                                                       |
| ---------- | ---- | --- | --- | --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| kinich     | T1   | 3   | 4   | 5   | Scalespiker Cannon and Loop Shot are both **unreachable from notation** — his Nightsoul kit draws as out-of-stance physical claymore; one data edit fixes both |
| varesa     | T1   | 2   | 4   | 5   | `sQ` waits out the 18s burst CD and then resolves as the **base burst**; the Kablam's Electro lands after its own block ends                                   |
| arlecchino | T1   | 2   | 4   | 5   | Her burst doesn't reset All Is Ash (engine), and Masque's Pyro infusion is unauthored so six N swings apply **nothing**                                        |
| mualani    | T1   | 2   | 4   | 4   | Skill CD starts at cast instead of stance end (`cooldownStartsAtStanceEnd` exists — the note is stale); Sharky's Bite applies Hydro 1.5–3.3s late              |
| lohen      | T1   | 1   | 3   | 4   | No gcsim anywhere: no frames, no applications, no Etched Into Bone and Soul — honest stub, but the A4 wrong-row caveat was removed and not replaced            |
| albedo     | T1   | 0   | 2   | 6   | Solid. The burst's 7 Fatal Blossoms are missing from `application[]` and **§4 structurally cannot see it** (empty-core dump ⇒ no construct)                    |

**Cross-cutting, worth one round of their own**

1. **`abilityType:'skill'` with `input:['N']` is unreachable** — `resolveActiveAbility` matches by `abilityType` only. Affects `kinich__skill__loop_shot` and `lan_yan__skill__feathermoon_ring_n`; both also sit ahead of their siblings in the array and so _steal_ the in-stance `E`. Worth a lint rule.
2. **A normal's application time is its cancel-resolved block end, never `frames.hit`** — harmless where `hit ≈ swap` (most of the corpus), severe where gcsim's cancel ladder is genuinely long (Mualani's bite: 17 vs 109/215 frames).
3. **A stance-CANCEL token** would close Varesa's FP plunge, Mualani's E re-press, Kinich's cold-open charged-attack block and Ifa's landing in one primitive.
4. **`cdReset` never walks `char.abilities`** (rubric D8) — Arlecchino joins Freminet as a victim, and hers is a signature mechanic.
5. **Four of these six files carry zero caveats.** The ruthless pass removed several that named a real pixel (Arlecchino's burst behaviour, Kinich's in-stance CA, Albedo's missing Silver lanes, Lohen's A4 row); Mualani and Varesa never had one despite their own curator notes saying a divergence reaches no reader.

---

<!-- batch 7 -->

## Batch 7 — furina · ororon · aino · faruzan · nahida · xilonen (all Prydwen T1)

Audited 2026-09-15 against gcsim `ac2d76dde` (local checkout, left on main), the
committed curation reports, and a live parse probe (written to `scratch/`, run,
deleted). No repository file was modified.

---

### ⚠️ Batch-wide finding — `P` is a SILENT no-op on all six

None of the six authors `plungeFrames`. `run.ts:1424` guards the whole plunge
branch on `if (plungeFrames)`, with the comment _"An unresolvable plunge (no
frames) emits NO action event, matching the no-block legacy behavior."_ Measured:

| notation                           | events emitted | total frames |
| ---------------------------------- | -------------- | ------------ |
| `Xilonen P N1`                     | `N1@0`         | 18           |
| `Aino P N1`                        | `N1@0`         | 23           |
| `Nahida P N1`                      | `N1@0`         | 21           |
| `Faruzan P N1`                     | `N1@0`         | 14           |
| `Furina P N1`                      | `N1@0`         | 15           |
| `Ororon P N1`                      | `N1@0`         | 12           |
| `Diluc P N1` (control, has frames) | `P@0 N1@51`    | 75           |

The token costs **zero time**, draws **no block**, applies **nothing**, and
`unknownTokens` is **empty**. `notationFlags.ts` cannot flag it either — the
linter walks `castTokensIn(body)` (cast tokens only), and its only two
`unsupported-token` cases are `W` and a non-bow `A`. So a plunge on any of these
six is indistinguishable from a typo: it silently shifts every subsequent
action earlier. Contrast `W`, which is explicitly REFUSED with a message.

Two of the six can be closed from the oracle **today**:

- **furina** — `~/Code/gcsim/internal/characters/furina/plunge.go:36-56`:
  high `{anim:76, N:59, C:55, E:59, Q:59, D:47, swap:63}`,
  low `{anim:75, N:58, C:56, E:58, Q:58, D:46, swap:60}`.
- **xilonen** — `plunge.go:22-29,44-61`: low hitmark 47 / anim 75, high hitmark
  50 / anim 75, **plus a Nightsoul-state plunge** `skillHighPlungeFrames`
  (anim 77, hitmark 39) that belongs on the Blade Roller ability.

aino / nahida / faruzan / ororon have no `plunge.go` upstream, so their frames
are genuinely unsourced — but the **silent drop** is still wrong for them, and
the cheap fix is a `notationFlags` `unsupported-token` case for `P` on a
character whose index entry has no plunge (same shape as `A` on a non-bow).

---

### furina (Furina) — T1

**Status:** curated, frames from gcsim main (skill/burst/normals exact incl. the
Pneuma variant), applications authored and correct post-Arkhe-round, three
summon-tick series with measured ICD gates, `summonsFollowState` verified live.
This is the most complete character in the batch.

**Verified working (probed):**

- `Furina E N1 C N1` → `Salon Solitaire 0.30→2.07 (1 tick)` then
  `Singer of Many Waters 2.07→30.30 (14 ticks)` — the mid-window hand-off tiles
  the original window exactly.
- `Furina C E Q` → Singer summoned, **0 elemental applications from the E**
  (the `application: []` positive claim holds), `pneuma` toggle state runs from
  the flip to the end of the rotation.
- `Furina E` → 21 Hydro applications; Crabaletta (`icdGate: 'none'`) applies
  every tick, Usher/Chevalmarin every other. Matches gcsim's
  `ICDGroupFurinaSalonSolitaire {1800, every 2}` vs `ICDTagNone`.
- C6 `Center of Attention` draws a 10s self window on the **E only** (not the
  Q), matching `skill.go:82-85`.

**Gaps**

- **[A] The Charged Attack's `anim` is 33 where gcsim's is 253, and its `C` key
  is 47 where gcsim's is 253.** `furina.json` `chargeFrames = {anim:33, N:37,
C:47, E:47, swap:33}`; gcsim `charge.go:20-27` is
  `InitAbilSlice(253)` with only Attack=37, Skill=47, Burst/Dash/Jump/Swap=33.
  Report row: `gcsim-frames-diff.md:58` (`C 47→253`); the `anim` half is the §1
  class. Consequence: `Furina C C` is drawn 206 frames (3.4 s) short, and under
  the Human-timing **Full animations** toggle (`FULL_ANIMATION_KEY = 'anim'`)
  _every_ Furina CA is drawn as 0.55 s instead of 4.2 s. This matters now in a
  way it did not before the Arkhe round: the CA **is** the Arkhe toggle, so it
  is a token people will actually write. Fix: `anim: 253`, `C: 253`, and add the
  now-needed explicit `Q/D/J: 33` (today they ride the wrong `anim` and happen
  to be right). Authorable today, pure data.
- **[A] A1 Endless Waltz is a `manual` trigger — it reaches no surface.**
  `furina.json` passives[0] → `{type:'heal', target:'team', trigger:{type:'manual'},
scaling:2, stat:'hp'}`. Rubric **N1**: `manual` has exactly one code
  occurrence (its own type declaration). gcsim `asc.go:22-67` — on non-Furina
  overheal on the active char, heal ALL party members 2% Max HP every 2 s for
  4 s (a 2-tick heal, refreshable). In a Furina team (which by construction has
  a healer) this fires constantly and draws nothing. Needs engine work: there is
  no `onHeal`/overheal trigger (rubric **N6**). Until then the effect is dead
  data and should be either INERT-listed with a reason or re-triggered.
- **[B] C4 authors no `energy` effect** while Ororon C4 and Aino C4 both do.
  `capability-sweep.md:98` — _"furina — wiki attributes energy (C4) — nothing
  derives"_. gcsim `cons.go:38-50`: +4 Energy on a Salon-Member hit **or** a
  Singer heal, 5 s ICD. Energy reaches no planner pixel, but the corpus is
  inconsistent about authoring it, and it is the difference between the Team
  Builder deriving an energy capability at C4 and not.
- **[B] Salon Solitaire summon duration is 30 s; gcsim's status is
  `skillMaxDuration + ousiaBubbleHitmark` = 1754 f (29.2 s from cast).**
  Our bar runs 18→1818 f, ~1.1 s long. The kit table says 30.0 s, so this is a
  deliberate kit-vs-gcsim call — worth a line in the notes rather than a change.
- **[B] The three member cadences are statistical MEANS with ±7 f of real
  jitter** (`skill.go:52-60`, box-cox). The tick markers are the most countable
  thing on the lane and they are drawn on a fixed grid. Documented in the
  curator note, not caveated. Genuinely unmodelable — mention only.
- **[B] `Furina P` is a silent no-op** — see the batch-wide finding; gcsim has
  the frames.

**Improvements:** `data-outliers.md:26-28` still reports Furina's three
`allDmgBonus=0 / healingBonus=0` placeholders — those were converted to
`BuffValue {type:'unknown'}` on 2026-09-04 and the report is stale (last
regenerated `1b0fb5b8`, 2026-08-31). Re-run `audit-data-outliers.mjs` and the
three LOW rows disappear.

**Confidence:** high. Frames, ICD groups, the toggle and the hand-off were all
read in the Go and confirmed by probe.

---

### ororon (Ororon) — T1

**Status:** curated; frames exact against gcsim (skill `InitAbilSlice(31)`,
burst `InitAbilSlice(62)`, both aimed slices); applications authored;
`dark_voices_echo` is ✅ in §5 with a measured ICD gate and a C4-gated second
cadence. **But his signature mechanic does not fire at all.**

**Gaps**

- **[S] Hypersense never fires. Not once, in any rotation.** Three independent
  reasons, all in `src/lib/sim/procs.ts`:
  1. `procEffects` (`procs.ts:158`) requires a non-empty `application[]` —
     `ororon.json` passives[0].effects[0] has none.
  2. `armCastProcs` (`procs.ts:230`) skips any effect with no `trigger.armedFor`
     — it has none.
  3. `armCastProcs` is called at exactly one site (`run.ts:973`) with
     `variant?.effects ?? active.effects` — **the resolved cast ability's own
     effects only**. A PASSIVE-hosted proc is never armed by any path.

  Measured: `Ororon E Q > Xingqiu E Q > Fischl E` produces four
  `electroCharged` reactions and **zero** Ororon damage/applications after his
  own two casts. gcsim `asc.go:110-130` gives Hypersense
  `Durability: 25, ICDTagNone, ICDGroupDefault, Electro`, queued at delay 12 —
  i.e. it _should_ be a full 1 U Electro application every 1.8 s in his home
  team. Fix (authorable today, the Nahida Tri-Karma shape verbatim): move the
  effect from the passive onto `ororon__skill__nights_sling.effects[]`, add
  `armedFor: 15` (the A1 window, and his E cooldown is 15 s so a real rotation
  keeps it continuously armed), `application: [{frame:12, element:'electro',
units:1}]`, and `source: 'team'`.

- **[S] Even if armed, the trigger says `source: 'self'` by default.**
  `procs.ts:359-360`: `const source = trig.source ?? 'self'` then
  `if (source === 'self' && src.characterId !== l.holderId) continue`. Ororon is
  an off-field support; the EC/LC branches in gcsim (`asc.go:69-84`) subscribe
  to the reaction event with **no actor filter**, and the Nightsoul branch
  explicitly _excludes_ Ororon (`asc.go:87-91`). So the correct value is
  `source: 'team'`, and today's default is the opposite of the kit.
- **[A] The Nightsoul-aligned branch of Hypersense is unmodelled** — any
  teammate's Nightsoul-tagged damage also triggers it (`asc.go:86-95`), which in
  a Natlan team is the _majority_ of triggers. No `onNightsoulHit` primitive
  exists; would need engine work. The curator note already says so and is
  accurate.
- **[A] C6 is entirely absent (`effects` ABSENT).** Two halves: (a) `Q` fires a
  free Hypersense at 200% (`cons.go:141-149`, `hypersense(3.2, …)`) — that is a
  1 U Electro application on the burst cast, expressible as a `damage` effect
  with `application[]` on the burst _once the proc path above exists_; (b) +10%
  ATK to the active char per Hypersense, 9 s, 3 stacks (`cons.go:151-176`) —
  needs per-proc stacking, engine work.
- **[B] C1's Nighttide (+50% Hypersense DMG vs marked enemies, 12 s) and the
  +2 bounces** are correctly unmodelled — damage magnitude (out of scope) and a
  per-enemy state we don't carry. Curator note is accurate.
- **[B] The Supersonic Oculus bar runs 9 s from the SPAWN (36 f), gcsim's
  `supersonic-oculus` status runs 9 s from the CAST** (`burst.go:56`). Our bar
  ends 36 f late. Tick count agrees at C0 (9 = 9, §5 row confirms) and the
  curator note explicitly declines a `tickCap` for this reason — correct call,
  but the bar's right edge is 0.6 s optimistic.
- **[B] C4's 0.8 s interval is a deliberate 0.05 s divergence from gcsim's
  hardcoded 0.75.** Documented at length on the series. ⚠️ Still unverified
  in-game and the oracle structurally cannot adjudicate it (the dumper runs C0).
  Flagging only so it is not forgotten — do not "fix" it to 0.75.
- **[B] `Ororon P` is a silent no-op** (no `plunge.go` upstream — not
  authorable, but should at least be flagged in the editor).

**Improvements:** the C4 curator note's closing paragraph correctly flags that
the **Team Builder's Compare lane** takes the first authored damage series and
ignores effect `conditions`, so Ororon always shows the C0 1 s cadence there
regardless of the con lens. That is a Compare-surface bug, not a data bug, and
it is the only place in the batch where the con lens lies.

**Confidence:** high on Hypersense (three independent code reasons + a probe
showing four unconsumed reactions). Medium on the C4 interval judgement.

---

### aino (Aino) — T1

**Status:** curated; skill/burst frames exact; applications authored with
`units`; the conditional Moonsign cadence **works, verified live**. The cleanest
conditional-cadence implementation in the corpus.

**Verified working (probed):**

- `Aino E Q` → duck 2.88→16.88, **10 ticks**, 5 applications (every 3 s) —
  matches §5's `133f / 90f × 10 · 5/10 standard` exactly.
- `Aino E Q > Ineffa E` (Moonsign ≥ 2) → **21 ticks**, applications every 2.1 s,
  `lunarCharged` reactions firing. The `teamFaction` gate resolves at the tick
  projection, the `tickCap: 21` lands the boundary tick, and the
  `{timer:108, every:4}` group behaves exactly as the curator note predicts.
- `Aino E` skill: application at 15 f (1 U) and 33 f (ICD-suppressed) — matches
  `gcsim-frames-diff.md:178`.
- Burst `application: []` is the correct positive claim: `burst.go` queues no
  direct attack, only the tick loop.

**Gaps**

- **[A] No `chargeFrames` and no `plungeFrames`; both tokens are advertised.**
  `aino.json` normals declare `input: ["N1","N2","N3","C","P"]`. gcsim has
  neither `charge.go` nor `plunge.go` for Aino (dir listing: `aino.go asc.go
attack.go burst.go cons.go skill.go`), so the curator note is right that this
  is an upstream gap. Consequence measured: `Aino C N1` → `C@0 N1@51` (a generic
  51-frame stand-in, flagged provisional by the editor since `C` is not in her
  `casts`), while `Aino P N1` → `N1@0`, **silently zero**. A claymore CA is a
  multi-second spin; 51 frames is a large understatement, and the plunge is
  free. Not closable from the oracle; the plunge half should at minimum be
  flagged in the editor.
- **[B] C1 grants +80 EM twice to Aino.** `aino.json` C1 authors a `self` +80
  and a `team` +80 with identical triggers/duration. gcsim `cons.go:29-60`
  deliberately builds two mods — a per-OTHER-character mod that additionally
  requires the recipient be **active**, and a separate self mod — precisely so
  Aino gets +80 once. Our `team` arm is drawn as one team-lane bar over
  everyone including its own caster, so a reader sees Aino's self bar **and** the
  team bar. Also: gcsim's teammate half only applies while that teammate is
  active; ours claims it for off-field members too. Fix: author the team arm as
  `target: 'active'` (the per-receiver slice, which is what gcsim's gate means)
  and keep the self arm. Authorable today.
- **[B] C6 has the same `team`-vs-active shape** — `cons.go:129-149` gates the
  reaction bonus on `c.Core.Player.Active() != char.Index() → 0`. Ten authored
  `team` effects; the active-only gate is not expressed. Lower stakes (a
  reaction bonus is consumed by the active character anyway), but it is the same
  class.
- **[B] C2's `source: "others"` is one step wider than gcsim** — documented in
  full on the effect and on the constellation entry, which is the right place.
  The divergence is real: a third party's off-field summon tick can fire it, and
  gcsim additionally requires Aino herself to be off-field. Extra tick markers
  on the duck's lane during on-field Aino segments. `onHit` has no `'active'`
  source arm; needs engine work (the same arm `onHit.source` gained for
  `viaEntity` in the summon-tick round would close it).
- **[B] C4 is authored `onCast: skill` where gcsim is on the skill's HIT**
  (`cons.go:118-131`, `c4CB` on both hitmarks). Negligible for a 15 f hitmark;
  noted only because the curator note flags it as a known semantic mismatch.
- **[B] The Ascendant Gleam radius change (1 → 4) is unmodelled** and correctly
  gets no caveat (single-target tool). ✅ Agreed.

**Improvements:** none needed on the burst — `firstTickDelay: 0.167` correctly
models gcsim's constant 10-frame travel on _every_ tick rather than just the
first, which is an unusually careful reading.

**Confidence:** high.

---

### faruzan (Faruzan) — T1

**Status:** drafted (`draftedBy: claude-autonomous`, never marked `curatedAt`);
frames exact including both aimed slices and the A1 Hurricane Arrow; burst
effects authored with a C2-gated duration pair. **The skill's `effects[]` is
empty, and the burst buff is materially too short.**

**Gaps**

- **[S] Her signature buff and shred are drawn ~4.2 s SHORT — every rotation,
  at every constellation.** `faruzan.json` authors the Anemo DMG Bonus and the
  −30% Anemo RES as 12 s (18 s at C2) windows. The mechanic is a _pulsed_
  re-application: `burst.go:106-114` re-runs `buffFunc` from frame 43 through
  `43 + duration` (745 f base, 1105 f at C2) and every application lasts
  **240 f**. The talent sidecar agrees: `Prayerful Wind's Benefit Duration =
4.0s`, `Perfidious Wind's Bale Duration = 4.0s`, `Duration = 12.0s`. So real
  coverage is 43→1028 f (**16.4 s**) at C0 and 43→1388 f (**23.1 s**) at C2.
  Measured, `Faruzan E C Q` draws `2.48→14.48` where the game gives roughly
  `2.48→18.7`. Faruzan's _entire_ on-screen content is those two bars; a 26%
  under-claim on the bar length is the single most consequential number in this
  batch. Fix: 12→16 and 18→22 on both the buff and the shred (and the summon's
  own bar stays 12/18 — the polyhedron really does expire there). Authorable
  today, pure data. The curator note already identifies the tail and calls it
  "not modeled"; it is a number, not a mechanism.
- **[S] `skill.effects[]` is empty, so the A1 route draws nothing.**
  `Faruzan E C` — the standard Hurricane Arrow opener, and the whole reason A1
  exists — produces the E's own 14 f application and the arrow's, and then
  **nothing**: no Pressurized Collapse vortex, no shred. gcsim
  `skill.go:96-134`: the vortex is a separate `Durability: 25`, `ICDTagNone`
  Anemo hit at `vortexHitmark = 33` after the arrow lands, and at A1+ it carries
  `applyBurstShredCb` — i.e. the full −30% Anemo RES with no burst required.
  Measured apps for `Faruzan E C Q`: `0.23A 1.58A 2.48A` — the vortex is
  missing. Fix: the vortex is authorable as a second `application[]` entry (the
  arrow is a charged attack, so it would need a `chargeHits`-hosted schedule) or
  as a skill-hosted proc; the shred half needs a trigger on the charged attack.
  Partly authorable, partly engine work. ⚠️ A caveat for this was **deleted** on
  2026-08-19 (the passive's note records it: _"if Nate wants the column shorter,
  this is the first of my keeps to reconsider"_) — the gap is real and now
  undisclosed.
- **[A] A4 Hurricane Guard over-fires.** `faruzan.json` passives[1] authors an
  `onHit(source:'team', filter:{element:'anemo'})` damage effect with
  `procCooldown: 0.8`. gcsim `asc.go:29-63` additionally requires the hitting
  character to be carrying `burstBuffKey` — i.e. **only inside the burst
  window**. There is no "while affected by buff X" condition (rubric has no such
  primitive), so it fires all rotation long. Needs engine work; the curator note
  is accurate.
- **[A] Manifest Gale is an 18 s state with no bar and no gate.** The skill's
  `caveat` admits _"Charged shots are drawn with Hurricane Arrow timing whether
  or not the Manifest Gale state is active"_ — honest, but two things are now
  authorable that were not when this was drafted: `activeDuration` (2026-08-14)
  would give the E an 18 s window bar, and `opensTransientState` +
  `conditions: {type:'state'}` on `chargeHits[1]` would gate the Hurricane Arrow
  timing properly (the Xilonen Blade Roller / Durin pattern). Cost: adding a
  `manifestGale` member to the `State` union — ⚠️ **two edits**, per the Furina
  `codaWindow` lesson (`characterLint`'s `STATES` set is separate and the suite
  cannot say so).
- **[B] C6's CRIT DMG buff is authored flat 12 s with no C2 pair**, unlike the
  burst's own effects which split 12/18. Probed at C6: it renders 0.90→18.90
  (pooled into the burst window), which happens to be right — but by accident,
  not by authoring. Add the C2-gated 18 s twin for symmetry, or confirm the
  pooling is load-bearing.
- **[B] C6's extra Pressurized Collapse is unmodelled** — `cons.go:73-92`, a
  180 f ICD proc off any active-character damage while buffed. Each one is a
  full 1 U Anemo application (`ICDTagNone`), so at C6 the aura lane is missing a
  3 s-cadence Anemo stream. Same blocker as the A1 vortex.
- **[B] `Q → A` is drawn 10 frames long.** gcsim `burst.go:29`
  `burstFrames[ActionAim] = 61`; our FrameMap has no `C` key so an aimed shot
  after the burst falls back to `anim: 71`. Trivial; add `C: 61`.
- **[B] `Faruzan P` is a silent no-op** (no `plunge.go` upstream).

**Improvements:** `chargeHits[0]`/`[1]` are byte-exact against `aimed.go`
(`aimedFrames[1]` = 96/86, `aimedEFrames` = 60/49); the §3 "no gcsim analogue
for Hurricane Arrow" row is a dumper-naming artefact, not a data problem.

**Confidence:** high on the buff-duration arithmetic (three sources agree:
gcsim's loop bounds, the 240 f mod duration, and the talent table's 4.0 s row).
High on the vortex (read in the Go, confirmed absent by probe).

---

### nahida (Nahida) — T1

**Status:** drafted; frames exact (press + hold, burst); Tri-Karma Purification
is fully wired as an `onReaction` proc with the corpus's first 1.5 U application
and **verified firing** in a probe. The burst, however, models none of its three
team-composition branches, and four of her constellation effects are `manual`.

**Verified working (probed):**

- `Nahida E Q > Xingqiu E Q` → `bloom@2.72`, then a Nahida Dendro application at
  **2.77** (Tri-Karma, 3 f after the reaction ✓), and correctly **no** second
  proc off `bloom@3.03` (the 2.5 s `procCooldown` binding).
- A1's +250 EM is `target: 'active'` and slices per receiver on the swap:
  `nahida 1.63→2.38`, then `xingqiu 2.52→16.63`. Correct.
- Burst `application: []` ✓ — gcsim's `Burst()` queues no attack at all.

**Gaps**

- **[S] The Shrine of Maya's bar is 15 s in every team; with Hydro teammates it
  is up to 24 s.** `burst.go:25-29`:
  `dur = 15 + burstTriKarmaDurationExtend[hydroCount-1][TalentLvlBurst]`.
  At TL10 (`zz_nahida.dm.go:277,293`) that is **+6.019 s** with one Hydro and
  **+9.029 s** with two → 21.0 s / 24.0 s. C1 adds +1 to the count, so a C1
  Nahida with one Hydro teammate already gets the 2-character row. Probed:
  `Nahida E Q > Xingqiu E Q` draws `Shrine of Maya 1.63→16.63` — 5.4 s short,
  in a Hydro-bloom team, which is _the_ Nahida team. **Authorable today**: the
  summon already supports `durationModifiers` with `conditions`, and
  `teamElementCount` already resolves in buff/shred evaluation (Xilonen's five
  shreds prove it — see below). Two flat entries (`+6.02` for hydro ≥ 1,
  `+9.03` for hydro ≥ 2, mutually exclusive) close it. The A1 +250 EM window is
  authored 15 s too and rides along.
- **[A] C4 is a `manual` trigger — it reaches no surface** (rubric N1).
  `nahida.json` C4 → `{type:'buff', target:'self', trigger:{type:'manual'},
stat:'em', value:100}`. gcsim `cons.go:98-116`: +80 + 20·(marked enemies,
  capped 4) EM, permanent while Seeds are up. Probed at C6: no bar. This is a
  real self-EM bar that should exist. Fix: re-trigger as `onCast: skill` with
  `duration: 25` (the Seed lifetime, exactly what Tri-Karma's `armedFor` already
  uses) — authorable today; the single-enemy value is 100.
- **[A] C6 Karmic Oblivion is a `manual` damage effect** — no bar, no marker, no
  application. gcsim `cons.go` + `charge.go:53`: 200% ATK + 400% EM Dendro on
  N/CA hits against a marked enemy, 0.2 s ICD, 6 per 10 s post-burst window.
  Blocked on two rubric CANNOTs: the on-field-state gate (`c6ActiveKey`) and
  `maxProcs` (**N3**). Correctly deferred; the curator note is accurate.
- **[B] C2's two crit buffs are `manual`** and are additionally mis-shaped:
  they are `target: 'self'` `critRate`/`critDmg` buffs standing in for an
  _enemy-side_ property (reaction DMG can crit against Seed-marked enemies). If
  they ever became live they would be wrong. They should be INERT-listed with a
  reason, not left as `manual`.
- **[B] C2's Lunar-Bloom rider is unauthored** — `cons.go:73-90`: +10% CR /
  +20% CD on `AttackTagDirectLunarBloom` against marked enemies, **additive**,
  not the set-to-100% form. The curator note flags it as "completely absent from
  the skeleton" and that is still true. 7.x-currency item; same enemy-side
  shape, so same verdict as above, but it should at least be recorded.
- **[B] The burst's Pyro and Electro branches are unauthored.** Pyro raises
  Tri-Karma DMG (magnitude — correctly out of scope). Electro reduces the
  Tri-Karma interval by up to 0.446 s/teammate at TL10 (`skill.go:145-150`) —
  this _is_ a pixel (Tri-Karma pips on the aura lane), but the curator note's
  measurement stands: observed reaction gaps on the oracle fixtures are
  4.9–5.6 s against a 2.5 s floor, so the interval never binds. Agreed
  non-finding; keep the note.
- **[B] `chargeFrames.anim` is 65; gcsim's is 69** (`charge.go:17`
  `InitAbilSlice(69)`, with Attack/Charge/Skill = 65, Burst = 64). Missing
  `Q: 64`. 4 frames on the full animation, 1 on `C → Q`. Trivial.
- **[B] `Nahida P` is a silent no-op** (no `plunge.go` upstream).
- **[B] The hold variant discards `cooldownStartDelay`** — rubric **N16**, and
  Nahida's is parametric (`hold + 30`) besides. Curator note asks for a schema
  decision; still open.

**Improvements:** the two canonical-assumption caveats (`+250 EM`, `+80% / +24%`
at cap) are listed in `caveat-open-items.md:32-33` as
`approximation-disclosure`. Both are accurate and both name a printed number, so
they pass "name the pixel". Nothing to trim.

**Confidence:** high. The duration table was read directly out of
`zz_nahida.dm.go` and the 15 s bar was measured in a Hydro team.

---

### xilonen (Xilonen) — T1

**Status:** curated; every FrameMap (base normals, Blade Roller, skill, burst,
charge) is byte-exact against gcsim; the stance, `opensState`,
`cooldownStartsAtStanceEnd` and `terminatesOnSwap` are all correct and
Nate-verified. The five element-gated RES shreds **resolve correctly**. Two
condition gates on the _burst_ do not.

**Verified working (probed):**

- Solo / non-qualifying team → **one** shred bar (the Geo `<=2` fallback).
  With Bennett + Xingqiu → **three** (pyro, hydro, geo) — exactly gcsim's
  `samplersConverted = 2 < 3` branch. `teamElementCount` resolves cleanly in the
  buff/shred path.
- `Xilonen E …` opens both `inStance` and `nightsoulBlessing` for 9 s; Blade
  Roller normals resolve with `infusion: geo`; `Xilonen E N1` costs 20 f then
  the roller — all matching `attack.go:51-61`.

**Gaps**

- **[S] The burst's heal ticks draw in teams where the game plays damage beats
  instead.** The heal carries
  `conditions: {teamElementCount [pyro,hydro,cryo,electro] >= 2}`, but measured,
  `Xilonen E N1 Q > Albedo E > Sucrose E` (0 qualifying teammates) still draws
  `Ebullient Rhythm 3.68→15.68, ticks=8`, and so does the 2-qualifying version —
  **the gate has no effect in either direction**. It is _unresolvable_ in the
  summon-tick projection, and the projection drops only a definitive false.
  ⚠️ This is fixable now and the curator note predates the fix: Aino's
  `teamFaction` gate on the _same_ projection demonstrably works (10 ticks → 21
  ticks with Ineffa), so `finalize`'s condition context exists — it just isn't
  carrying `teamElementCounts`. Closing it removes a caveat and makes the
  Xilonen heal lane honest in the mono-Geo / Natlan teams where she is most
  used. Engine work, small and well-scoped.
- **[A] The burst authors three Geo applications unconditionally; in heal mode
  gcsim lands one.** `burst.go:47-58`: `samplersConverted < 2 → burstDamage`
  (hitmarks 96/128/164) else `burstHeal` (**hitmark 96 only**). Our
  `application[]` has all three. The two extras are ICD-suppressed
  (`gcsim-frames-diff.md:435` marks both `[icd]`) so the gauge is unharmed
  today, but the array nominally claims hits the common mode never makes, and
  it consumes the cast's ICD counter twice. Fix: a `teamElementCount`-gated
  variant carrying the one-hit array (the Furina Pneuma shape). Also ⚠️ entries
  2 and 3 carry **no `units`**, so they are flagged provisional while entry 1 is
  measured — an authoring inconsistency either way.
- **[A] No `plungeFrames` on either normal ability, and gcsim has three sets.**
  `plunge.go:22-29,44-61`: low 47/75, high 50/75, and
  `skillHighPlungeFrames` 39/77 — the **Nightsoul-state** plunge. Xilonen's
  plunges are not incidental: A1 (`asc.go:52-70`) generates her 35 Nightsoul
  points on Normal _or Plunging_ hits, which is what activates the Samplers, and
  C6 triggers on sprint/leap/N/P. Measured, `Xilonen P` costs zero frames and
  emits nothing. Authorable today, straight from the oracle.
- **[A] C2 is entirely unauthored** (`effects` ABSENT) and it is the reason
  people pull C2. Two halves: (a) the per-element team buffs (Geo +50% DMG /
  Pyro +45% ATK / Hydro +45% HP / Cryo +60% CD / Electro 25 energy + −6 s burst
  CD, `cons.go:30-38,94-112`) — genuinely blocked, there is no per-teammate-
  element buff target, and the curator note's reasoning is right; but (b)
  **"Xilonen's Geo Source Samples will always remain active"** is a _duration_
  change on an already-authored shred, and at C2 the Geo shred should be
  permanent rather than a 15 s window. That half is authorable today as a
  C2-gated long-duration twin of the Geo shred, exactly as Faruzan's C2 pair is
  authored. The note currently lumps both halves under "skip".
- **[B] The base Geo Sample is active for the WHOLE Nightsoul window, not just
  the 15 s activation.** `skill.go:110-128` `activeGeoSampler` re-applies every
  0.3 s for as long as she is blading, independent of `activeSamplerKey`. The
  curator note says the Geo shred uptime "is understated" — correct, and it is
  a second, earlier Geo window (the 9 s stance) our single 15 s bar merges away.
- **[B] The shreds are drawn from the cast; in game they start when Nightsoul
  points max out.** Measured ≈ 37 f later (`E` anim 20 + Blade Roller N1 hitmark
  17), and **they do not start at all if she never swings** — `a1MaxPoints` is
  reached only through `a1cb`, a Normal/Plunge hit. So `Xilonen E Q` with no
  normal draws five shred bars the game would not grant. The caveat covers the
  first half ("the Samplers activate moments later") but not the second.
- **[B] A4's +20% DEF fires at frame 0 on her own cast.** Probed:
  `buff xilonen 0.00→15.00 def%=20` in a solo `Xilonen E …`. gcsim emits
  `OnNightsoulBurst` from `a4MaxPoints` — i.e. at the _Sampler activation_, not
  the E cast, and behind a 14 s ICD. Self-consistent enough (it does fire for
  her own activation in gcsim too), but the timing is ~0.6 s early and the 14 s
  ICD is unmodelled.
- **[B] C1 and C6 are `effects` ABSENT.** Both correct per the constitution:
  C1 is a draining-gauge extension (windows, not gauges) and C6 pauses the
  Nightsoul timer — neither expressible. ⚠️ But C1's +45% timer extension does
  make the _visible_ 9 s stance bar wrong at C1 (≈13 s in play, gcsim
  `nightsoulDurationMul`), and the note explains why it is not a clean
  `durationModifier` rather than saying the bar is short. Worth a caveat under
  "name the pixel" — the stance bar is a pixel and it is 4 s short at C1+.
- **[B] `data-outliers.md:39` flags `heal|def = 187.2` as a magnitude outlier** —
  a false positive (DEF-scaling heal against an ATK/HP-scaling bucket median).
  No action; worth a suppression if the audit gains one.

**Improvements:** `Xilonen P` aside, the frames here are the best in the batch —
all seven normal/roller slices, both charge slices and both cast slices match
gcsim exactly, and `terminatesOnSwap` carries a full FOR/AGAINST record plus an
in-game verification. Nothing to tidy.

**Confidence:** high on the heal gate and the plunge (both measured). High on
C2's Geo half (read in `cons.go:56-74`).

---

### Batch summary

| id      | tier | #S  | #A  | #B  | headline                                                                                                                                           |
| ------- | ---- | --- | --- | --- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| furina  | T1   | 0   | 2   | 4   | Most complete in the batch; the CA's `anim`/`C` are 220 f short and A1's overheal-heal is a dead `manual` trigger                                  |
| ororon  | T1   | 2   | 2   | 4   | **Hypersense never fires** — no `application[]`, no `armedFor`, hosted on a passive that no proc path reads, and defaulting to `source:'self'`     |
| aino    | T1   | 0   | 1   | 5   | The conditional Moonsign cadence is exemplary and verified; C1 grants Aino +80 EM twice, and `C`/`P` have no frames upstream                       |
| faruzan | T1   | 2   | 2   | 4   | Her two signature bars are **~4.2 s short at every constellation**, and the A1 Hurricane-Arrow vortex (shred + 1 U Anemo) is entirely unauthored   |
| nahida  | T1   | 1   | 2   | 6   | Tri-Karma is fully wired and firing; the Shrine of Maya's bar is 15 s where a Hydro team gives 21–24 s, and C4's EM bar is a dead `manual` trigger |
| xilonen | T1   | 1   | 3   | 5   | Frames are exact and the shred gates resolve; the burst's heal gate is **unresolvable** in the tick projection so 8 heal ticks draw in every team  |

**Cross-cutting, ranked by reach:**

1. **`P` is a silent no-op on all six** (and every other plunge-frameless
   character). Zero frames, no event, no lint flag. Two of the six can take real
   frames from gcsim today (furina, xilonen); the rest need a `notationFlags`
   `unsupported-token` case so the token stops disappearing.
2. **`manual` triggers** (rubric N1) account for 6 authored effects across two
   of these characters (furina ×1, nahida ×4). Two of them — Nahida C4's EM bar
   and Furina's A1 heal — describe bars a user would expect to see.
3. **`teamElementCount` does not resolve in the summon-tick projection** while
   `teamFaction` does (Xilonen's heal vs Aino's cadence, both measured). One
   engine fix closes a caveat and a visible over-claim.
4. **Pulsed re-application authored as a single window** understates Faruzan's
   buff/shred by the pulse duration (4 s). Worth a corpus sweep — any effect
   whose kit text says "applies … at intervals" has the same tail.
5. **`data-outliers.md` is stale** (regenerated 2026-08-31, before the Arkhe
   round): its three Furina `zero-buff` rows were fixed on 2026-09-04.

---

<!-- batch 8 -->

## Batch 8 — clorinde · gaming · hu_tao · klee · lyney · navia · neuvillette (all Prydwen T1.5)

Method: read every character JSON + talent sidecar; read gcsim `ac2d76dde` source for all seven; re-ran
the **gcsim dumper** (`scratch/gcsim-dump/gcsim-dump`, already built) per character with the correct
stance drivers and diffed **every** authored FrameMap key _including `anim` and `hit`_; probed
`parseNotation` for applications, windows, variants and constellation gating. All scratch files deleted;
repo untouched (`git status` clean).

#### Two method findings that colour every row below

1. **`audit-gcsim-frames.mjs` compares only `KEYS = ['N','C','E','Q','D','J','P','swap']`**
   (`scripts/audit-gcsim-frames.mjs:318`). It never compares `anim` or `hit`. So a map whose `anim`
   is wrong — the exact "`anim === swap` stand-in" the L4b round exists to remove — passes the audit
   silently. Hu Tao and Gaming both carry such maps and neither is in §2.
2. **`scripts/gcsim-dump/drivers.json` claims Hu Tao's Paramita stance is frame-identical to the base**
   (`"hutao": {"note": "Paramita Papilio — frames identical to the base reading", "states": {"inStance": []}}`).
   gcsim says otherwise (`ppChargeFrames = InitAbilSlice(42)` vs `chargeFrames = InitAbilSlice(62)`).
   Re-running the dumper with `prereq: [{action:"skill"}]` reproduces **our authored PP values exactly**.
   → **four of the seven hu_tao §2 rows are oracle artefacts, not defects.** Fixing that one driver row
   would remove them from the report.

---

### clorinde (Clorinde) — T1.5

**Status:** Curated. Frames re-migrated today and **all maps match gcsim `ac2d76dde`**, base _and_
in-stance (verified against a fresh `state-inStance` capture). Applications complete and correct:
`hunters_vigil` `[]` (positive "applies nothing"), `impale_the_night` `+11 electro 1U`,
`last_lightfall` 5 entries with units on the two gcsim applied (97, 115). gcsim coverage full.
**The frames/applications half of Clorinde is clean. Everything below is the effects half.**

**Gaps**

- **[S] Not one of A1, A4, C1, C2 or C6 reaches any surface.** A1/A4/C1/C6 are `manual` triggers
  (`manual` has no consumer, CLAUDE.md N1); C2 _is_ wired (`onReaction` with the 9-reaction electro
  list) but **omits `source: 'team'`**, so it defaults to `'self'` while the kit says _"After a nearby
  party member triggers an Electro-related reaction"_. Measured: `Fischl E > Barbara E > Clorinde E N1 N2 N3 Q`
  at C6 produces **16 electroCharged events and zero Clorinde windows** — only the stance bar draws.
  Evidence: `clorinde.json` passives[0]/[1], constellations[0]/[1]/[5]; gcsim `asc.go:36-45`, `cons.go:34-78`.
  Fix: C6's CR/CD pair is authorable **today** — `trigger {type:'onCast', ability:'skill'}`, `duration 12`,
  `procCooldown 12` (gcsim `c6Icd = 12*60`, gated on the stance being live). C2/A1's payload is a _flat DMG add_
  to N/Q hits, which is damage magnitude and stays out of scope — but `source: 'team'` should still be fixed
  so the effect is honest.
- **[A] C1 "Nightvigil Shade" is a coordinated attack and is now authorable.** gcsim `cons.go:40-78`:
  subscribes `OnEnemyDamage`, gated on her own Electro **normal** hits while the stance is live, 1.2s ICD
  (`c1Icd = 72`), fires 2 hits at hitmark 1, `ICDGroupClorindeElementalArt`, Durability 25 → Electro 1U.
  That is exactly the mark-triggered/coordinated-attack shape (`damage` effect + own `application[]` on an
  `onHit` trigger + `procCooldown`). Authorable per the rubric; today it is `manual`.
- **[A] `stellarConduct` is missing from C2's reaction list.** gcsim subscribes `event.OnStellarConduct`
  alongside the other nine (`asc.go:41`). This is _not_ the forbidden subsumption — it is positive
  evidence, and 11 corpus characters already author `stellarConduct`. Without it, in a Stellar-enabler
  team her superconduct trigger converts away and the C2 goes dark.
- **[B] `Impale the Night` is not on her normal-attack ICD counter.** gcsim tags it
  `AttackTagNormal` / `ICDTagNormalAttack` (`skill.go:87-96`), so in game it shares the counter with
  Swift Hunt. Our sim gives every E/Q cast a _fresh_ clock, so a stance loop `E N1 N2 N3 E` over-applies
  Electro by ~1 per Impale. Documented engine ruling ("counters are NOT shared across casts"), so this is
  a known-limit note, not an authoring fix.
- **[B] `tags: ['heal']` with no heal effect** (capability-audit row, line 44). Deliberate and documented
  (Bond-of-Life-scaled, no BoL primitive) — the tag is the honest capability signal. No action; listed so
  the audit row is not re-opened.
- **[B] In-stance burst frames unauthored.** gcsim has `burstSkillStateFrames` (N/E rise 128 → 127).
  One frame; ignore unless a variant is cheap.

**Improvements:** Arkhe "Surging Blade" carries `Durability: 0` (`attack.go` `arkheAttack`) — it applies
nothing, so leaving it out of `application[]` is _correct_, and the curator note asking a reviewer to decide
should be closed as "deliberately none". `_curatorNotes` on this file are unusually long and several are
now answered (terminatesOnSwap verified, burst variant measured) — they could be trimmed.

**Confidence:** high. Frames verified against a fresh dump; the "no surface" claim is a measured probe.

---

### gaming (Gaming) — T1.5

**Status:** Frames present for normals/E/Q (E and burst match gcsim except the burst's `anim`).
Applications: skill `[]` ✓ (Bestial Ascent itself deals no damage), burst `+60 pyro 1U` ✓. gcsim coverage
full. **But the character's entire mechanical identity — the Charmed Cloudstrider plunge and Man Chai —
is unmodelled, and at C6 the parse produces zero windows.**

**Gaps**

- **[S] Plunging Attack: Charmed Cloudstrider is not modelled, so Gaming applies no Pyro at all.**
  gcsim `plunge.go` `specialPlunge()`: `Element: Pyro`, `IgnoreInfusion: true`, `ICDTagNone`, `Durability: 25`,
  hitmark 32, own frame slice (`specialPlungeFrames`: anim 99, N/E/Q 52, D 32, swap 69). Our JSON has no
  plunge variant and no infusion, so the token `P` after `E` resolves to a physical claymore plunge.
  Measured: `Gaming E P E P Q` yields **one** application (the burst). Fix: the schema has
  `plungeVariants` (with a `conditions` gate) and `infusion` on stance normals; a plunge variant gated on
  "last action was skill" needs a state the parser can see — nearest today is `opensTransientState` on the
  skill + a `conditions: {type:'state'}` plunge variant. Authorable with a small parser/schema check, not a
  data-only edit.
- **[S] Man Chai resets the Elemental Skill cooldown, and we model a flat 6s CD.** gcsim `burst.go`
  `queueManChai()` → after `manChaiWalkBack` (default 100f, 92f after a special plunge)
  `c.ResetActionCooldown(action.ActionSkill)`. His signature loop is E→plunge→E→plunge, which only works
  because of this. Probe `Gaming E P E P Q`: our second E is gated to 6.07s. Fix: `cdReset` exists in the
  cooldown module, but the trigger ("the summon walks back") has no schema shape — engine work, or an
  approximation via a delayed `cdReset` on the burst.
- **[A] Man Chai and the 12s Wushou Stance window are unauthored, and the burst's one authored effect is
  wrong twice over.** gcsim: `AddStatus(burstKey, 12*60)` at `burstStart=36`, deleted on swap-off
  (`onExitField`), plus `Heal{Type: HealTypePercent, Src: 0.3}` = 30% MaxHP. Our JSON authors a `manual`
  `buff / hp% / value: 50` — wrong type, wrong number, and unreachable. The file's own curator note says so.
- **[A] A4, C2, C4, C6 draw nothing at any constellation.** A4 (`incomingHealingBonus` <50% HP /
  +20% Cloudstrider DMG) and C2 (ATK +20% for 5s on healing overflow, gcsim `cons.go` `c2()` via
  `event.OnHeal`) are unauthored; C4 (+2 energy per Cloudstrider hit, 0.2s ICD) unauthored; C6's CR/CD pair
  is `manual` with a `durationType: 'fixed'` and **no `duration`** — a generator artefact. Probe
  `Gaming E lP hE Q` at C6: **zero windows**.
- **[A] A1 and C1 heals sit on `manual`.** A1 is a 4-tick 1.5%-MaxHP chain with an 0.8s gate; C1 is
  15% MaxHP on link-up. Both unreachable.
- **[B] Burst FrameMap `anim` is 66, gcsim's is 77** (`burstFrames = InitAbilSlice(77)`), so `Q→C`, `Q→Q`,
  `Q→P` and the "full animations" human-timing reading are 11 frames short. Invisible to the audit
  (see method finding 1).
- **[B] No `chargeFrames`** — correct, gcsim does not model the claymore spin.

**Improvements:** the burst is tagged `summon` with no `summons[]`; either author Man Chai (a real thing
left in the world, with a walk-back lifetime) or drop the tag so the Team Builder stops claiming it.

**Confidence:** high. Every claim is a gcsim line plus a probe.

---

### hu_tao (Hu Tao) — T1.5

**Status:** Curated and well-noted. E/Q frames, cooldown delays (14 / 62) and applications
(E `+14` physical ✓ — the 0-dmg freeze-breaker; Q `+66 pyro 2U` ✓) all match gcsim. Stance modelling
(`behavior: 'stance'`, `terminatesOnSwap: true`) is **correct** — gcsim `hutao.go:61-67` deletes
`paramitaBuff` on swap and fires A1 there. The gaps are Blood Blossom and a stale plunge/N5 migration.

**Gaps**

- **[S] Blood Blossom is entirely unmodelled — two off-field Pyro applications per Paramita charged
  attack.** Measured in the isolated core (`C@state-inStance`): Pyro 1U at +3 (the CA), then
  **Blood Blossom Pyro 1U at +243 and +483**, `ICDTagNone`, on a 570f (9.5s) enemy debuff that re-ticks
  every 240f (gcsim `skill.go` `applyBB` / `bbtickfunc`). At C2 the burst applies it too. We draw no
  debuff span and no ticks; probe `Hu Tao E N1 C N2 C Q` at C6 gives 4 applications where the game gives 8.
  For a vape Hu Tao this is the single biggest missing thing on the aura lane.
  Fix: needs **engine work** — it is a thing left on the _enemy_, spawned by a **charged attack**, and
  `emitSummon` only runs from an E/Q cast (`summons[]` lives on skill/burst). Closest existing shape is a
  summon-hosted tick series; there is no host.
- **[A] `plungeFrames` on BOTH normal abilities hold LOW-plunge numbers — the L4b HIGH/LOW split was
  never applied here.** Base `plungeFrames` is byte-identical to `lowPlungeFrames`; gcsim's high plunge is
  `{anim 76, hit 64, N 59, E 60, Q 60, J 76}` (base) and `{anim 77, hit 63, N 60, E 59, Q 59}` (Paramita).
  §2 rows 3 and 6 are real — though row 6's _proposed_ numbers come from the wrong (base) capture.
  Both `lowPlungeFrames` also carry `anim: 61` where gcsim is 75.
- **[A] Base `chargeFrames`: E 53→60, Q 54→62, D 26→19, J 24→19** (gcsim `charge.go`:
  `chargeFrames[ActionSkill]` is assigned twice, 57 then **60**; D/J = `chargeHitmark` = 19). A real §2 row.
  ⚠ The file's `[A7]` note about position-dependent D/J cancels applies to the **Paramita** charge, not this one.
- **[B] N5 on both abilities: `anim` 28 → 48, `swap` 28 → 26, and no `hit`.** `anim === swap` is the
  un-migrated stand-in marker; gcsim is `InitNormalCancelSlice(26, 48)` with `ActionAttack` 37/36.
  Only the `swap` half is in §2 (method finding 1).
- **[B] Paramita N6 `hit` is 23; in stance it is 27** (`ppAttackHitmarks[5] = {27}`). Unreported because
  `hit` is not compared.
- **[B] Four §2 rows are ARTEFACTS, not defects** — `paramita_papilio.hits[4]` (N 36→37),
  `.chargeFrames` (Q 33→62, D 3→19, J 3→19, swap 42→62), `.plungeFrames` (the gcsim column) and
  `.lowPlungeFrames` (E 58→59, Q 58→59). With the correct driver the in-stance capture reads
  N5 N=36, C `{anim 42, D 3, J 3, Q 33, swap 42}`, lP `{N 58, E 58, Q 58, swap 61}` — **exactly ours**.
  The defect is `drivers.json`, which should read `{"inStance": [{"action": "skill"}]}` like Clorinde's.
- **[B] Stance `duration: 9` vs gcsim 554f (9.23s)**; the A1 team-CR bar therefore anchors 14f early.
  Sub-pixel at default zoom; listed for completeness.
- **[B] C1 (stamina), C2 (BB flat DMG + Q applies BB), C6 (revive + HP-gated CR) correctly unauthored;**
  C4 is `manual` with an accurate, still-true caveat (enemy-death has no primitive).

**Improvements:** A1's team +12% CR bar _does_ render correctly (verified). `chargedIcdWindow {timer: 30}`
is authored on both normals and matches the dump's measured `t30 / applies 1` — this is right and worth
keeping as the reference for the other 15 polearm holders.

**Confidence:** high — the artefact/defect split is proved by a second dump run, not argued.

---

### klee (Klee) — T1.5

**Status:** Curated. **Every FrameMap matches gcsim exactly** (normals, charge, both plunges, E, Q).
Cooldowns/charges/delays correct (E 20s ×2 charges, delay 33; Q 15s delay 9). Application coverage is the
richest in the batch (28 entries) but the burst's 25 are one RNG sample and the burst summon has no ticks.

**Gaps**

- **[S] C6's +10% team Pyro DMG for 25s never renders.** `klee.json` constellations[5].effects[1] has
  `trigger: {type: 'onCast', ability: "Sparks 'n' Splash"}`, but `onCast.ability` is typed
  `'skill' | 'burst'` (`src/lib/types/ability.ts:510`). Measured: `Klee E Q N1 C` at C6 draws the C2 shred
  and three C1 ATK bars and **no pyroDmgBonus window**. A corpus sweep finds this is the **only**
  non-`skill`/`burst` value in all 126 character files — a one-word fix (`ability: 'burst'`).
  Note that neither `characterLint` nor `orphanedSchema` catches it.
- **[A] The burst summon has no `summonTick` series → a 10s bar with zero tick markers.** gcsim's waves
  are a near-regular 1.8s cadence (186 / 294 / 401 / 503 / 610 / 718 from cast, i.e. ~107f apart), so
  unlike Charlotte/Qiqi this summon _does_ have a fixed interval and the Furina §9 "application[] is
  sometimes correct" exemption does not obviously apply. Authorable: `interval 1.8`,
  `firstTickDelay 0.67` (186 − spawnsAt 146), 6 ticks inside the 10s window. Trade-off: it would replace
  the per-wave 3-shot detail now carried in `application[]`.
- **[A] The 25 burst application entries encode one random roll.** gcsim `burst.go:57-72` fires
  1 + 1@+12 + **30% chance** of another + 1@+24 + **50% chance** of another, per wave. Our list has
  3/5/4/5/4/4 entries per wave — i.e. the dump's dice, not a cadence. Anything measured against it inherits
  that sample.
- **[A] C2's DEF shred anchors ~4s early.** Authored `onHit / abilityType: skill`, which fires at the E
  cast; gcsim attaches `c.c2` to the **mine** attacks at frame 240 (`skill.go:145`). Probe: bar draws
  0→10s; in game it is ~4→14s. The curator note calls the offset "accepted", but 4s on a 10s bar is a
  visible, checkable divergence, not a rounding.
- **[B] The skill's application list carries only one bounce.** gcsim's `bounce` param defaults to **1**
  (`skill.go:41`); in game Jumpy Dumpty bounces three times — `bounceHitmarks = [71, 111, 140]` — and the
  **third bounce is `Durability: 50` (2U)**. So the true nominal schedule is +71 (1U), +111 (1U),
  +140 (**2U**), +240 (1U), +240 (1U).
- **[B] The mines are a thing left in the world and are not authored as a summon** (documented; gcsim
  models them as a scheduled explosion, and the real ground-lifetime is unverified).
- **[B] C4's 555% Pyro on swap-out is `manual`.** gcsim `onExitField` fires it with `Durability: 50`
  (**2U**) when Klee swaps out with `kleeq` live. There is no `onSwap` trigger in the union, so this needs
  engine work — worth recording rather than leaving as a bare `manual`.
- **[B] C1's spark bombardment applies Pyro** (gcsim `cons.go` `c1()`, Durability 25) — unauthored; the
  authored half is the current-patch +60% ATK buff, correctly caveated as "shown on every qualifying hit".

**Improvements:** the Hexerei `factionBonuses` entry is description-only, which is right for a Spark/attack-
sequence mechanic. `chargeFrames`/`plungeFrames` match gcsim including the windup/lag notes — no action.

**Confidence:** high for the C6 bug (probe + type + corpus sweep) and the C2 offset; medium on whether the
burst should become a tick series (a design call, not a data fact).

---

### lyney (Lyney) — T1.5

**Status:** Curated. E/Q frames and the burst's Grin-Malkin Hat are authored and match. But **the Hat his
rotation actually makes — the one from the Prop Arrow — does not exist in the data**, and the three
`chargeHits` rows are each shifted one step off gcsim's aimed ladder.

**Gaps**

- **[S] The Prop Arrow's Grin-Malkin Hat, and its Pyrotechnic Strike, are unmodelled.** Measured, `A`
  emits: `+103 Prop Arrow pyro 1U`, `+145 Spiritbreath Thorn` (Durability 0 → applies nothing), and
  **`+377 Pyrotechnic Strike pyro 1U`** — the Hat expiring after `grinMalkinHatAimedDuration = 238`f and
  firing. Probe `Lyney C E Q`: only the CA's own application appears; there is no Hat bar for the CA path
  and no second Pyro pip ~6s later. The curator note names the blocker correctly
  (`summons[]` is not supported on a `chargeHit`) → **schema/engine work**, and it is the single most
  load-bearing thing about the character.
- **[A] Aimed shots are ICD-exempt in gcsim and ICD-gated in ours.** `aimed.go`: both the Fully-Charged
  shot and the Prop Arrow are `ICDTagNone`. Probe `Lyney C C` (two CAs 1.85s apart) → **1** application;
  gcsim → 2. `NormalAbility.noICD` exists and is read (Mualani); authoring it here is safe because his
  N1–N4 are Physical and reach no clock anyway. ⚠ Not a blanket bow rule — Amber/Venti use
  `ICDTagExtraAttack`, so it is per-character data.
- **[A] The three `chargeHits` are shifted by one.** gcsim: Aimed Shot `InitAbilSlice(23)` D/J 15;
  Fully-Charged `InitAbilSlice(80)` D/J 72; Prop Arrow `InitAbilSlice(111)` D/J 103. Ours:
  "Aimed Shot" = 80/72 (the fully-charged slice), "Fully-Charged Aimed Shot" = 111/103 (the Prop Arrow
  slice), "Prop Arrow" = a duplicate of that. §2 is silent because `gcsim-map.mjs` pairs `hA`→index 0 and
  `A`→"fully-charged" by name, which lands on those same values. Practically harmless (`C` and `A` both
  resolve to 111f, which is the rotation shot) but the first two rows state timings the game does not have.
- **[A] A1 `manual` and missing its +3 energy;** A4 (Pyro-aura DMG scaling by Pyro count) unauthored;
  C1 (2 Hats, extra Prop Surplus, 15s ICD) unauthored; **C2 Crisp Focus is `manual`** and models one of
  three stacks; C6 (Pyrotechnic Strike: Reprised on every Prop Arrow, `ICDGroupLyneyExtra`) unauthored —
  it is a Pyro 1U instance we could draw.
- **[B] Prop Surplus stacks unmodelled**, so the skill's heal is authored at one stack (documented, and the
  heal reaches no surface anyway).
- **[B] The burst's Hat bar has no tick or end marker** — its Pyrotechnic Strike at +563 is drawn as a
  _cast_ application, outside the bar it belongs to.
- **[B] The in-burst E variant is unauthored.** gcsim `skillBurstFrames` (swap 28, N 14, D 8, J 7) is the
  standard QE cancel and is ~13 frames faster on swap than the base E we draw.

**Improvements:** C4's Pyro RES shred is correctly wired (`onHit / charged / filter.element: pyro`) and
renders. The `summons[0].mobility: 'stationary'` on the burst Hat is right.

**Confidence:** high — all measured.

---

### navia (Navia) — T1.5

**Status:** Curated, and the burst is one of the best-modelled summons in the corpus (17 ticks, measured
`icdGate {timer: 720, every: 3}`, 6/17 applied, verified ✅ in §5). Frames all match; 2 charges correct.
**But her A1 — the Geo infusion every rotation runs on — is not authored at all, so her whole
normal-attack string applies nothing.**

**Gaps**

- **[S] A1 "Undisclosed Distribution Channels" is unauthored: no Geo infusion, so N/C/P are Physical.**
  gcsim `navia.go:48-59` overrides `ai.Element = Geo` for Normal/Plunge/Extra while `a1Key` is live, and
  `asc.go:29` sets that status for `60*4` frames, armed at `firingTime` (11f tap / 41+hold). Measured:
  `Navia E N1 N2 N3` produces **one** application (the E at 0.33s); all six swings apply nothing → no
  crystallize, no aura, no Crystal Shrapnel loop. This is the Cryo-Traveler "Ever-Keen Frost" lesson
  repeating. **Authorable today**: an `infuse` Effect, `target: 'self'`, `trigger {onCast, ability:'skill'}`,
  `duration: 4`, `element: 'geo'` — the five existing `infuse` holders are the pattern.
- **[A] Crystal Shrapnel is unmodelled, and three constellations hang off it.** gcsim `skill.go:262-292`:
  gained on `OnShielded` with a Crystallize shield **and** on `OnLunarCrystallize` (1s ICD, added in
  gcsim `2e13ba4da`), cap 6, consumed on E. C1 (3 energy + 1s burst-CD cut per stack, ≤3),
  C2 (CR + one extra Cannon Fire Support shot per E, 0.25s ICD) and C6 (CD per excess stack + stack return)
  are all `manual`/unauthored. The stack half is authorable — `gainStacks` on an `onReaction`
  `hydroCrystallize`/`lunarCrystallize` trigger, plus `consumeStacks` on the E — and C1's energy + `cdReset`
  would then have a gate. C2's extra cannon shot is a Geo 1U application we could draw.
- **[A] A4's team-element ATK buff is `manual` and encodes one stack.** gcsim counts Pyro/Electro/Cryo/Hydro
  members, capped at 2 → +20/+40%. Authorable as two mutually-exclusive `teamElementCount` conditions on a
  `passive` trigger. ⚠ Both would share `stat: 'atk%'` — see the Neuvillette finding below for the
  dedupe trap; order the ≥2 branch first or make the conditions definitive.
- **[B] The Hold variant has no cooldown-start delay.** gcsim's `firingTime` for a hold is
  `skillHoldCDStart (41) + hold`, against the base's 11 — so our `hE` starts its 9s cooldown 30 frames
  early. The curator note names the schema gap (`AbilityVariant` has no `cooldownStartDelay`).
- **[B] One authored interval vs gcsim's alternating 42/42/48.** Documented; measured drift is ~30f
  (0.5s) by tick 17 (gcsim's last tick 865f, ours ~835f).
- **[B] The Surging Blade entries (`+75` tap / `+105` hold) are Durability-0 hits** (`skill.go`
  `surgingBlade`, `ICDTagNone`) — they apply **nothing**, ever. They are authored as applications and are
  masked today only because the standard ICD suppresses hit #2. A latent over-claim; this is precisely the
  `[icd]`-vs-no-Durability ambiguity the report header warns about.

**Improvements:** the `_curatorNotes` on the burst tick series are exemplary and still accurate. Once A1
lands, her normals will start feeding the gauge and the Crystal Shrapnel loop becomes visible work rather
than theoretical.

**Confidence:** high.

---

### neuvillette (Neuvillette) — T1.5

**Status:** Curated, and every FrameMap "matches gcsim" — but that match is an artefact (below).
E/Q applications and cooldowns are correct. **Both of his signature mechanics — Equitable Judgment and
Past Draconic Glories — reach the screen wrongly or not at all.** Highest gap-density in the batch.

**Gaps**

- **[S] Equitable Judgment: the wrong length and a quarter of the applications.** Measured in the isolated
  core, `C` emits **8 Hydro hits from +232 to +399** (`Charged Attack: Equitable Judgment`,
  `ICDTagExtraAttack / ICDGroupDefault`), of which 4 apply. Our model draws a 74-frame block with **one**
  application, and `Neuvillette C C C` finishes in **2.6s** where the game takes ~19s. For the character
  whose entire rotation is a CA loop, every downstream timing (buff uptime, swaps, reaction cadence) is wrong.
  ⚠ **The authored `chargeFrames` are themselves a capture artefact.** gcsim's frame function closes over
  `chargeLegalEvalLeft` and `tickAnimLength`, which are `0` and `6` at the instant the dumper samples them
  (`charge.go:141-146`), so `{anim 74, C 53, E/Q/D/J 23, swap 50}` = `windup 14 + 3 + 0 + 6 + endLag[next]`
  — an EJ aborted at its first tick. The audit reports a match because the dumper re-reads the same closure.
  gcsim's _short_ CA slice is `{anim 87, C 69, E 26, Q 27, D 25, J 26, swap 58}` and is not what we ship.
  Fix: needs schema work (a multi-tick channelled charged attack — `activeDuration` + a tick series on a
  charged action). The **droplet dependency is not the blocker** the notes assume: EJ's own duration is a
  flat 173f and only the _Legal Eval windup_ (209f) shortens with droplets, so a droplet-free EJ is
  fully specifiable today.
- **[S] Past Draconic Glories (A1) draws nothing, and the curator note claims it does.** The three tiers all
  carry `stat: 'chargeDmgBonus'`; the self/active buff pass **dedupes by stat before per-segment evaluation
  and keeps the first authored** — the `{min: 1, max: 1}` tier — which is false as soon as the team has 2+
  stacks, i.e. always. Differential proof: `Fischl E > Neuvillette N1 N1 N1 E C` at C0 draws nothing;
  reordering the three effects to (3, 2, 1) makes `chargeDmgBonus = 60` appear; a lone `{min: 1}` tier also
  appears. The stacks accrue correctly — the collision is the bug. This is the exact hazard recorded on
  `BuffEffect.onFieldDelay` ("don't use the two-effect pattern when the pair shares a `stat`").
  Fix is authorable today: one effect with `constellationScaling`-style branching, or `perStack`, or
  conditions that resolve definitively in the pre-filter.
- **[A] The Charged Attack caveat is wrong about what the tool draws.** It says _"Typing 'C' shows the
  short Charged Attack; in game, holding to charge enters Equitable Judgment…"_ — but the authored frames
  are Equitable Judgment's (aborted), not the short CA's. The caveat should say the CA block is ~1.2s where
  the real channel is ~6.4s, and that it lands one Hydro application instead of four.
- **[B] The skill's `_curatorNotes` frame block is stale** — it quotes `chargeFrames = InitAbilSlice(87)`
  with `ActionSkill 26 / ActionBurst 27 / ActionSwap 58`, none of which are the shipped values.
- **[B] Spiritbreath Thorn (`+60`) is a Durability-0 hit** (`skill.go`, `Durability: 0`) — it applies
  nothing. Authored as an application entry; masked today by ICD. Same class as Navia's Surging Blade.
- **[B] C1/C2/C4/C6 stubs are correct _given_ the EJ gap** — and all four unblock together if EJ lands
  (C1 = a free stack on field entry, which is authorable _right now_ and independent of EJ).
- **[B] No plunge frames** — correct, gcsim implements none for him.

**Improvements:** A4's `unknown` buff value with a 41-char label is the right call and reads well.
The burst's 3-hit application list and `energyCost: 70` / `cooldown: 18` are exact. Once A1's dedupe
collision is fixed, he gains three real buff bars for free.

**Confidence:** high. Both S findings are differentials, not readings.

---

### Batch summary

| id          | tier | #S  | #A  | #B  | headline                                                                                                                                                                                         |
| ----------- | ---- | --- | --- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| clorinde    | T1.5 | 1   | 2   | 3   | Frames + applications are clean; **every passive and constellation reaches no surface** — four `manual`, and C2 missing `source: 'team'` (measured: 16 team reactions, zero windows).            |
| gaming      | T1.5 | 2   | 3   | 2   | **Charmed Cloudstrider applies no Pyro and Man Chai's E-cooldown reset is unmodelled** — his whole loop; at C6 the parse draws zero windows.                                                     |
| hu_tao      | T1.5 | 1   | 2   | 5   | **Blood Blossom (two off-field Pyro 1U per Paramita CA) is missing**; 4 of the 7 §2 rows are driver artefacts, 3 are real (plungeFrames hold LOW values, base chargeFrames, N5 `anim`).          |
| klee        | T1.5 | 1   | 3   | 4   | **C6's team Pyro bar never renders** — `onCast.ability: "Sparks 'n' Splash"` is the only illegal value in the corpus; burst summon has no ticks and its 25 applications are one RNG roll.        |
| lyney       | T1.5 | 1   | 4   | 3   | **The Prop Arrow's Grin-Malkin Hat and its +377f Pyrotechnic Strike don't exist in the data**; aimed shots are ICD-exempt in gcsim and gated in ours; chargeHits shifted one step.               |
| navia       | T1.5 | 1   | 2   | 3   | **A1's 4s Geo infusion is unauthored, so her entire normal string applies nothing**; the burst summon, by contrast, is exemplary.                                                                |
| neuvillette | T1.5 | 2   | 1   | 4   | **Equitable Judgment is 1.2s/1 application against the game's ~6.4s/4**, and its frames are a mutable-closure capture artefact; **A1's three tiers collide on one stat and none of them draws.** |

#### Cross-cutting items worth a separate ticket

1. `audit-gcsim-frames.mjs` does not compare `anim` or `hit` (`KEYS` at line 318) — add them, or the
   L4b stand-in markers stay invisible. Batch 8 alone has 5 such maps (hu_tao ×4, gaming ×1).
2. `scripts/gcsim-dump/drivers.json` → `hutao.states.inStance` should be `[{"action": "skill"}]`;
   the current empty list manufactures 4 false §2 rows.
3. `onCast.ability` is a two-value union and nothing validates the JSON against it — klee C6 escaped.
4. **A Durability-0 gcsim hit is not an `[icd]` suppression** and should not be authored as an
   application at all. Found on navia (`+75`/`+105`), neuvillette (`+60`), clorinde (Arkhe, correctly
   omitted). Worth a lint rule and a sweep.
5. The self/active buff pool's **dedupe-by-stat before condition evaluation** silently kills tiered
   effects (neuvillette A1 today; navia A4 would be next). This is the third time it has been recorded.

---

<!-- batch 9 -->

## Batch 9 — venti, beidou, chiori, emilie, xiangling, xingqiu, yelan (all Prydwen T1.5)

Method: whole JSON read for each; gcsim `ac2d76dde` read per character (skill/burst/asc/cons + the
summon files); `gcsim-frames-diff.md` §2–§5, `gcsim-reaction-diff.md`, `capability-sweep.md`,
`data-outliers.md`, `summon-conditions-round.md`, `caveat-ruthless-verdicts.json`, the talent
sidecars, and `engine-capability-rubric.md` (⚠️ snapshot of 2026-08-18 — where it disagreed with a
probe, the probe wins, and it does in one place: P4's "Xiangling C1 / Emilie C2 bars are not extended
by ticks" was closed by the summon-tick onHit round of 2026-08-31, measured below). Parse measured
with a throwaway `scratch/probe-b9*.mjs` (deleted). No repository file was modified.

---

### venti (Venti) — T1.5

**Status:** curated; all FrameMaps from gcsim main (press + hold variant), cast applications complete
and unit-correct (skill 2U @51f, hE 2U @74f, burst `[]` — right, the burst lands no cast hit);
Stormeye series byte-matches §5 (106f / 24f × 20, `icdGate {60, every 3}`, 7/20 applied vs the
oracle's 7/20); Hexerei Secret Rite wired in `factionBonuses` and measured firing. gcsim coverage is
complete except A1 (upstream refuses it) and absorption.

**Gaps**

- **[S]** C6's second shred draws as an **element-less −20% RES** on every burst, unconditionally —
  `venti.json` C6 `effects[1]` deliberately omits `element` because absorption is runtime-dynamic.
  Probe (`Venti E Q`, C6): one window 2.13→19.73s carrying `resShred:anemo=-20, resShred:(none)=-20`.
  In game the second shred exists only if an Elemental Absorption happened. Fix: needs the absorption
  model (below) to gate it; until then it is a caveat-shaped honesty gap — there is no caveat.
- **[A]** **Elemental Absorption is entirely unmodelled and uncaveated.** gcsim `burst.go:83-101`:
  an absorb check starts at the 4th Anemo tick (frame 178) and on success queues **15 extra ticks at
  24f of the absorbed element**; sidecar row "Additional Elemental DMG 33.8%". Consequences on
  screen: no absorbed-element pips on the aura lane, C6's second shred (above) and A4's second
  15-energy both hang off it. Rubric **N13** (no absorb path in the sim) → engine work. ⚠️ Rubric D1
  says explicitly "KEEP every absorption caveat (Kazuha, Anemo Traveler, Wanderer, Sucrose family)" —
  Venti has the same mechanic and no caveat on the burst.
- **[B]** The A4 `energy` effect (15 Energy when the Stormeye ends) is **inert** — rubric P8 names
  Venti A4 as one of two `afterDuration` energy authors with "no planner consumer at all". The second
  half (15 Energy to matching-element party members) is deliberately dropped pending element-
  conditional target routing. No pixel; the Team Builder capability claim stands.
- **[B]** The `hE` variant has no `cooldownStartDelay` — gcsim `SetCDWithDelay(900, 34)` vs the
  press's 21. `AbilityVariant` has no such field (rubric **N16**: four variants author it and it is
  silently discarded), so the hold's ghost tail starts 13f early. Schema + reader work.
- **[B]** Skill carries `tags:["summon"]` with **no `summons[]`** — the A1 upcurrent, which gcsim
  states it will never implement. A tag with no content feeding a TB claim; decide tag-or-author.
- **[B]** The `duringSummon` half of the Secret Rite gate never resolves (rubric **P15**), so the
  +50% swirl buff draws in a 2-Hexerei team even with no Stormeye ever cast. Documented in the note
  as the corpus-wide P15 class; ⛔ the note is right that the condition should stay.
- **[B]** C1 (2 extra aimed-shot arrows) has no effect skeleton — damage-only, correct to skip.

**Improvements:** nothing to tighten in the numbers. Both live caveats (Stormeye length under
Hexerei; the Hexerei CD reset) survived the ruthless pass as `keep/keep` and are accurate.

**Confidence:** high — every number cross-checked against gcsim source and §5, and the Hexerei
behaviour was measured by a previous round and re-read here.

---

### beidou (Beidou) — T1.5

**Status:** curated; frames from gcsim (press only), applications unit-correct (skill 2U @23f =
Durability 50, burst 4U @28f = Durability 100); the Stormbreaker bounce is a working coordinated
attack — probe `Beidou E Q > Fischl N1…N5` gives electro applications at 2.08 / 4.73 / 7.80s off the
teammate's swings, exactly the 1s proc cooldown with standard ICD letting every third through.
gcsim covers everything except A1 (perfect-parry timing).

**Gaps**

- **[A]** **No `hE` variant, and the hold is the ability.** gcsim shares ONE `skillFrames` slice
  between press and hold (the `counter` param selects the damage tier), so cast frames exist for
  free. Everything hold-only is therefore unreachable: the parry shield, A4, and Polaris's whole
  payload. Probe: `Beidou hE Q` produces **no unknown token** and silently draws the tap; the
  notation linter flags it at the token (`notationFlags.ts` `approximateCastMessage`), which is why
  the caveat was deleted — but the missing variant is still the root.
- **[A]** **A4 "Lightning Storm" has no `effects`** (gcsim `asc.go`: +15% Normal/Charged DMG and
  +15% ATK SPD for 600f, on a max-tier Tidecaller). Authorable as a buff — ⚠️ but it **cannot be
  gated to the hold**: rubric **P1** says `onCast.input` is read only by the stack dispatchers, so a
  buff authored with `input:['hE']` would also draw off a tap (the live Razor C6 / Mavuika C6 bug).
  So this one wants P1 closed first, or it trades a blank for a wrong bar.
- **[B]** The skill's shield **draws nothing and nothing says so.** `tags:['shield']` plus a real
  `shield` effect (25.9% Max HP + 3050) with no `duration`, which `pushShield` refuses (rubric P27);
  probe confirms an empty summon lane at the E while C1's 15s shield bar draws two rows away. ⚓ The
  caveat was deleted 2026-08-19 with a stated and good reason (only the press is castable and the
  press grants no shield in game). The residue is the **Team Builder**, which has no linter and still
  claims she shields. Decision, not necessarily a fix.
- **[B]** **C1 shield target may be wrong.** We author `target: 'self'`; gcsim's `shield.Tmpl` uses
  `Target: -1` (player-wide) while the skill shield uses `Target: c.Index()`. Kit text is silent.
  Worth one wiki check — it changes what the TB claims and, if player-wide, which lane the bar
  belongs to.
- **[B]** **Polaris (Witch's Revelation) is authored on the wrong gate.** The wiki conditions the
  8 Energy on "**holding** down to unleash Tidecaller **and hitting** the opponent"; we author it as
  `onCast ability:skill` + `procCooldown 15`, so a plain `E` grants it. Energy reaches no planner
  surface (no pixel), but the TB capability claim rides the wrong condition. The −4s-per-stack CD cut
  is unauthored because `cooldownReduce` is rubric **N2** (schema + lint only, zero authors) — ⚓ and
  the ruthless pass' overturn is right that the 7.5s tail is correct for the only castable form.
  ⏭ Radiance: Stellar-Conduct still has **no documented payload** on the Fandom Polaris page as of
  our 2026-07-29 note; re-check on the next wiki refresh.
- **[B]** C4 Stunning Revenge unauthored — `OnPlayerHPDrain`, and HP state is rubric **N11**
  (null-resolving). Correct as a stub.
- **[B]** No `chargeFrames` and no `plungeFrames` (gcsim has neither for her). A `C` falls back to a
  generic 45f block (probe). The curator note already asks for a KQM source.
- **[B]** C6's shred is approximated as one continuous 15s window; gcsim re-applies a 1.5s debuff
  every 30f for the burst's duration. Same picture, cheaper — correct, and the note says so.

**Improvements:** her C6 shred and C1 shield both carry no `conditions` — correct since the
constellation-gating round gates at collection, so nothing to do.

**Confidence:** high.

---

### chiori (Chiori) — T1.5

**Status:** curated only in its tap-E half. Frames for tap-E and Q, the Tamoto series with the
measured `icdGate {timer:114}` (= ICDGroupChioriSkill), cast applications 1U/2U correct. Everything
the kit hangs off her A1 — the branch, the infusion, the Kinu family, the C6 cooldown cut — is
unauthored, and so is the second Tamoto.

**Gaps**

- **[S]** **The A1 Geo infusion is the DEFAULT branch, and it is unauthored.** gcsim `asc.go`
  `activateA1Window(start, duration)` queues `a1Tailoring()` to fire when the window expires with no
  input, so in ordinary play every E ends in a **5s Geo infusion on her Normal/Charged/Plunge**
  (`AddWeaponInfuse`, 300f). Our chart leaves those swings Physical — probe `Chiori E Q N1 N2 N3 N4`
  shows only the 7 geo applications from the cast and the Tamoto, none from the swings. `infuse`
  effects are fully wired (rubric **C9**), so the default branch is **authorable today**; only the
  Tapestry fork is not. ⚠️ The curator note frames the whole passive as unmodellable, which is too
  strong and is why it has stayed a blank.
- **[A]** **The second Tamoto ("rock doll") is never drawn.** gcsim `createRockDoll`: same 17.5s
  life, same 3.6s interval, 1.2s start delay, spawned whenever a Geo construct is nearby and
  unconditionally at C1 with a second Geo party member. That is an entire second tick lane and its
  Geo applications missing in every Geo team. `summons[1]` is supported (Furina precedent) but the
  spawn condition is not — this is the open `docs/curation/summon-conditions-round.md` work, and
  chiori C1 is **not** on its list of 32.
- **[A]** **C2 Kinu is unauthored, and its stated blocker is stale.** gcsim `cons.go c2()`: a Kinu
  every 3s for 10s after the burst, each striking once (kinu.go, 0.6s spawn delay, `ICDGroupChioriSkill`).
  That is a regular cadence a burst-hosted summon series expresses today (`interval 3`,
  `firstTickDelay ≈ 3.6`, `duration 10`, `icdGate {timer:114}`). The note's reason — "depends on
  Tamoto-emitted damage authoring (P3)" — was written before the Tamoto series was authored.
- **[A]** **A4 "The Finishing Touch" is a `manual` trigger** → no bar and not even a chip (rubric
  **N1**; **P9** requires `trigger.type === 'passive'` for the always-on strip). The **C1 branch is
  authorable today**: `onCast ability:skill` with `all[constellation 1, teamElementCount geo ≥ 2]`
  (rubric **P12** resolves definitively). The generic construct-spawn branch needs the new trigger the
  note describes.
- **[A]** **C6's −12s skill cooldown is unmodelled**, so a C6 Chiori's E ghost tail and next-E
  placement are ~12s wrong on a 16s cooldown. Blocked twice: on the A1 trigger state and on
  `cooldownReduce` (**N2**).
- **[B]** **No `hE` variant** though gcsim has the numbers (`skillFrames[1]`: anim 88, swap 87,
  `skillCDStarts[1]` 34, hitmark 37, vs the tap's 51 / 49 / 19 / 21). Caveat deleted 2026-08-19
  because the notation linter says the same sentence at the keystroke — reasonable, but the variant
  itself is cheap and would make `hE` correct rather than merely flagged.
- **[B]** **Tamoto duration disagreement: our 17.5s vs the talent table's 17.0s.**
  `docs/curation/talents/chiori.json` gives `Tamoto Duration` as `17.0s` at all 15 levels; gcsim uses
  `skillDollDuration = 17.5*60`. Tick count is 5 either way, so only the bar's length moves. Resolve
  against the wiki.
- **[B]** `firstTickDelay 0.6` puts the first mark at 55f; measured 60f (§5) because gcsim adds
  `skillDollAttackDelay = 5`. A 5-frame marker offset on every tick.
- **[B]** `input` declares `P` but no plunge map is authored, so the token emits **nothing at all**
  (see the cross-cutting note at the end).
- Correct and verified: `icdGate {114}` matches the group table; burst uses `SetCD` (no delay) so the
  absent `cooldownStartDelay` is right; C6's `normalFlatDmg` chips as a passive.

**Improvements:** the `capability-sweep.md` row "chiori — wiki attributes infuse (Tailor-Made) —
nothing derives" closes the moment the A1 default infusion is authored.

**Confidence:** high on the gcsim reading; medium on the 17.0/17.5 duration (two sources disagree and
I did not consult the wiki).

---

### emilie (Emilie) — T1.5

**Status:** curated frames and two tick series with measured cadences (the burst's 0.9s re-target
cadence and its `firstTickDelay 0.5` match gcsim's +126/+180/+234 exactly; the E series carries
`icdGate {timer:120}` = ICDGroupEmilieLumidouce and the burst's bare default is verified correct —
gcsim runs the Level-3 stream on `ICDGroupDefault`). Every scent/level mechanic and three of six
constellations are unauthored.

**Gaps**

- **[S]** **A spurious Dendro application at +62f on every E.** We author
  `application: [{37, dendro, 1U}, {62, dendro}]`; gcsim's Spiritbreath Thorn
  (`skill.go arkheAttack`) carries **`Durability: 0`** — it applies nothing. `gcsim-frames-diff.md`
  line 252 marks it `[icd]`, and the report's own header warns that `[icd]` cannot distinguish "the
  ICD suppressed it" from "the hit carries no Durability". Probe (`Emilie E Q N1 N2 N3`) shows the
  phantom pip at 1.77s. Fix: delete that one entry — a one-line data edit, authorable today.
- **[S]** **The burst neither stows the E's case nor leaves one behind.** gcsim
  `spawnBurstLumidouceCase` re-keys `lumidouceSrc`, which stops the E case's tick chain for the
  burst's duration; then at frame `306 (+2s at C4)` it respawns a case at the PREVIOUS level with a
  **full 22s duration**. §4 states the burst's streams as `18× Lumidouce Case (Level 3), Lumidouce
Case (Level 1)` — 4 L3 + 14 L1 — and §5 spells the second out as `401f / 90f × 14`. We draw the L3
  case and keep the E case ticking straight through it (probe: E case 0.27→22.27s, 14 ticks, straddling
  the 2.00→4.80s burst). So: ticks drawn that the game does not give, and a 22s summon with 14 ticks
  omitted after every burst. The "leave one behind" half is authorable now (a second summon on the
  burst); the "stow" half wants the burst to truncate the skill's summon, which the recast machinery
  already does for a re-cast summon.
- **[A]** **C4 is unauthored** — +2s burst duration, and the per-target re-target interval drops
  0.7 → 0.4s (gcsim `burstMarkDuration -= 0.3*60`), i.e. a faster tick cadence. The duration half is
  exactly Xiangling's C4 shape (`durationModifiers` + a constellation condition) and is authorable
  today; the cadence half is the conditional-cadence primitive (rubric **P18**, Aino/Ororon).
- **[A]** **C6's Dendro infusion is unauthored.** gcsim `applyC6Bonus` sets `ai.Element = Dendro,
IgnoreInfusion = true` on Normal/Charged for 5s after an E or Q, 12s ICD. `infuse` + `procCooldown`
  both exist (rubric **C9**), so this is authorable; today a C6 Emilie's swings stay Physical and
  their pips are missing. The authored `manual` damage effect (300% ATK) reaches nothing (**N1**).
- **[A]** **A1 Cleardew Cologne unmodelled** — a real 25-durability Dendro hit (`asc.go a1()`,
  `Mult: 6`) every time the Level-2 case banks 2 Scents, which in a Burning team is roughly every
  2.9s at C1. It is her whole Burning gameplay. Needs a Scent stack resource plus an "enemy is
  Burning" condition, which is rubric **N11** (`enemyAffectedBy` returns null) — **not authorable
  today**.
- **[B]** **A4 "Rectification" is `manual` with a hard-coded `36`** — the CAP of an ATK-scaled,
  Burning-gated bonus. Draws nothing today (**N1**); if it is ever wired, 36 over-claims. Candidate
  for `BuffValue {type:'unknown'}` (the Furina Fanfare precedent) or a `scaling` value.
  `data-outliers.md:25` also flags the A1's `600` as a magnitude outlier — that value is correct
  (`Mult: 6`), so the row is expected.
- **[B]** The Level-2 case fires **two** hits per tick (hitmarks 5 and 23); we draw one marker
  (rubric **N4**). ICD-gated to one application either way, so cosmetic.
- **[B]** Case LEVEL is a canonical assumption (2 for the E series, 3 for the burst) with no
  level-decay modelling (`8s without a Scent → Level 1`); stated in the notes, correct given the
  constitution.
- **[B]** No plunge map.
- Correct and verified: `application: []` on the burst is the right positive claim; C2's two shreds
  now extend off the case's ticks (probe: 1.77→31.27s), which ⚠️ **contradicts rubric P4's ❌ line**
  — that was closed by the summon-tick onHit round of 2026-08-31 and the rubric is stale there.

**Improvements:** the burst's `tickCap` refusal is well argued and the audit's recurring "count
3 → 4" flag is expected, not a backlog item — leave it.

**Confidence:** high. The Durability-0 finding was read directly out of gcsim and reproduced in the
parse.

---

### xiangling (Xiangling) — T1.5

**Status:** the best-measured character in the batch. Both summons match §5 byte for byte (Guoba
126f / 100f × 4 `none`; Pyronado 56f / 73f × 9 `none`), `chargedIcdWindow {timer:30}` matches
ICDGroupPoleExtraAttack, `application: []` on the E is correct, C1's shred now extends off Guoba's
ticks (probe: 2.10→13.10s). Her two team-facing mechanics are the hole.

**Gaps**

- **[S]** **C6 draws nothing.** It is a `manual` trigger **and** carries `durationType:"fixed"` with
  no `duration`, so even a rewrite of the trigger alone would produce a zero-length bar. The 15% Pyro
  DMG bonus to the whole party for the Pyronado's life is the single most-consumed Xiangling
  constellation buff; probe (`Xiangling E Q`, C6) produces no team buff window at all. **Authorable
  today**, exactly as the note describes: `onCast ability:'burst'`, `target:'team'`, duration tied to
  the Pyronado (10s, 14s at C4 — the same `durationModifiers` the summon already carries).
- **[A]** **A4 "Beware, It's Super Hot!" has no `effects`** — the +10% ATK for 10s the active
  character picks up when Guoba expires. `afterDuration` joined to a summon window works (rubric
  **P8** ✅) **but only for `team` / `teamExcludingSelf` targets**; an `active`-target `afterDuration`
  buff has no call site. So a faithful authoring needs the afterDuration pass extended to the active
  surface; authoring it as `target:'team'` would draw today and over-claim. ⚠️ Pickup timing is also
  player-controlled (gcsim makes it an `a4_delay` config param).
- **[B]** **C2 "Oil Meets Fire" is a `manual` damage effect** — the Implode detonation 2s after N5 is
  a real Pyro application the aura lane misses. The trigger shape now exists (`onHit` +
  `filter.hitIndex`, the Alyosha N4 precedent); the 2s delay between trigger and hit has no
  vocabulary on a damage effect.
- **[B]** **Two of the three burst cast applications carry no `units`** (`{33, pyro}`, `{57, pyro}`)
  while gcsim gives all three initial swings `Durability: 25`. Absent `units` means "unmeasured" by
  convention; the number is measured. One-line tightening.
- **[B]** C4 is authored `type:"flat", value:4` against kit text reading "+40%" — numerically right
  (10 → 14s) and listed as UNCLEAR at `summon-conditions-round.md:53`. Restate, don't change.
- **[B]** The normal-ability curator note says the high plunge is "not represented" — **stale**;
  `plungeFrames` IS authored beside `lowPlungeFrames`.
- ⛔ Not a gap: `gcsim-reaction-diff.md` lines 526-528 show three 🔴 Pyronado ticks in the Collei
  fixture. Checked — those are the **ordinal-pairing artifact** CLAUDE.md warns about (gcsim's three
  Burning self-applications shift the pairing); our Pyronado ticks at 11.25 / 12.47 / 13.68 match
  gcsim's 11.27 / 12.48 / 13.70. Do not file it.

**Improvements:** with C6 authored and the two `units` filled in, she has no remaining measurable
divergence from the oracle other than Burning's own accounting pyro.

**Confidence:** high.

---

### xingqiu (Xingqiu) — T1.5

**Status:** curated; frames, both cast applications (12f / 31f, 1U each), `Rainbow Bladework`
15.55s (15s + 33f anim) with C2's +3s, and the coordinated attack all measured and correct. The
weak points are both constellation-shaped, and one of them is on screen in every rotation.

**Gaps**

- **[S]** **C2's Hydro shred is drawn off the wrong casts and dies 4s into an 18s burst.** Kit and
  gcsim both scope it to SWORD RAIN hits — `c2cb` is attached inside `summonSwordWave`
  (`burst.go:100-122`) with a 1-frame ICD, so **every wave refreshes it** and its real uptime is the
  burst's whole length. We author a bare `onHit` with no `abilityType`, so it fires on the E's cast
  hit and at the burst's cast instant and is never touched by the waves. Measured
  (`Xingqiu Q > Fischl N1…N5 ×2`, C6): ONE window `0.00→4.00s` under an `18.55s` burst carrying 18
  wave marks. Wrong in both directions — wrong source, and ~14s short. ⚠️ The wave stream does not
  reach the character `onHit` pools (a `whileNormalAttacking` fire is not a summon tick, so the
  2026-08-31 round does not cover it), so full correctness needs engine work; a cheap partial is
  `abilityType:'burst'`, which at least puts the bar on the right cast.
- **[A]** **C6 unauthored, and its recorded reason is stale.** The note says "triggered by normal
  attacks which aren't simulated" — normals are simulated now and the wave registry already fires per
  wave. What is genuinely missing is a per-Nth-fire trigger (every third wave: 5 swords and +3
  Energy). Energy reaches no planner surface anyway, so the visible half is only the wave count.
  `capability-sweep.md:163` files the derived-capability half of this.
- **[B]** ⛔ **The Orbital's 7 missing Hydro applications per window are CLOSED BY DECISION — do not
  re-file.** `gcsim-reaction-diff.md` lines 127-133 and 444-450 show 7 missing hydro applications in
  each of two fixtures, the largest single-character miss in the report. `docs/gauge-round-L5e.md` §4
  refuses it on two independent grounds: gcsim's `AttackInfo` for `Xingqiu Orbital` carries no `Mult`
  at all (our gauge is reachable only through a `damage` effect, so authoring needs a lying
  `scaling: 0`), and the hit is a **radius-1.2 circle centred on the PLAYER** — asserting it would
  make a positional claim the game does not. ⚠️ Also `applyOrbital` EXTENDS one entity rather than
  spawning a second, so authoring it on both the skill and the burst would double-apply.
- **[B]** `Rain Swords` is a summon bar with no effects and no ticks — correct (the DMG reduction is
  defensive and unmodellable), and it is the entity the Orbital belongs to.
- **[B]** C4 (+50% skill DMG during the burst) unauthored — damage-only plus a `burstActive` state;
  correct to skip. Listed as UNCLEAR at `summon-conditions-round.md:55`.
- **[B]** A1's heal is authored on `onHPDecrease`, which has exactly one author and **no reader**
  (rubric **N6**) — deliberate, and the caveat was correctly deleted as an invisible omission.
- **[B]** No plunge map.
- Correct and verified: the wave's `icdGate: 'none'` is the kit's "each wave applies one Hydro"
  claim, knowingly diverging from gcsim's per-sword `ICDGroupDefault`, and the note states that.

**Improvements:** `scaling: 97.7` names ONE sword while a wave is 2/3 (5 at C6) — recorded in the
note and out of scope by the constitution; leave it.

**Confidence:** high — the C2 divergence was measured in the parse, and the gcsim attachment site was
read.

---

### yelan (Yelan) — T1.5

**Status:** curated; skill CD 10s with `cooldownStartDelay: 33` (= gcsim's `skillHitmark - 2`), C1's
extra charge, burst 2U @76f (Durability 50), and the Exquisite Throw's `icdGate {timer:120, every:3}`
taken verbatim from ICDGroupYelanBurst — with the note correctly rejecting the coordinated-attack
survey's Breakthrough-group misreading. Three mechanics missing and one frame map wrong.

**Gaps**

- **[A]** **The Exquisite Throw's SECOND trigger is unauthored** — "will occur each time Yelan's
  Lifeline explodes and hits opponents" (gcsim `skill.go` cb: `if c.StatusIsActive(burstKey) {
c.summonExquisiteThrow() }`). In the standard Q → E → E rotation every E inside the burst fires an
  extra 3-dart wave with its own Hydro application; we draw nothing. The wave is already a
  summon-hosted damage effect, so the shape is a sibling proc listener on an `onCast`/`onHit` skill
  trigger carrying the same `application[]` (rubric **P3** ✅ — she is already on its working list).
- **[A]** **C2 is a `manual` damage effect** → reaches nothing (**N1**). gcsim fires an extra
  `ICDTagNone` arrow on every Exquisite Throw wave behind a 1.8s ICD, i.e. an additional Hydro
  application every 1.8s on top of the wave's own gated one. Authorable today as a second
  `whileNormalAttacking` damage effect with `procCooldown: 1.8` and `icdGate: 'none'`.
- **[A]** **C6 "Mastermind" is unauthored** — 20s / 5 arrows during which every Normal Attack becomes
  a Breakthrough Barb (different element, different ICD group — gcsim `attack.go` puts C6 Barbs on
  `ICDTagExtraAttack`/`ICDGroupDefault` — and a different frame profile). No state window, no changed
  normals, no changed applications.
- **[B]** **`chargeHits[1]` "Fully-Charged Aimed Shot" carries the Breakthrough Barb's frames.** Ours
  is `anim 42, D 32, J 32`; gcsim's `aimedFrames[1]` is `InitAbilSlice(96)` with D/J = `86`
  (`aimed.go:32-34`) — compare Venti's 94/86. ⚠️ Read the §2 row (`chargeHits[0]` D 15→86, swap
  25→96) carefully: our `chargeHits[0]` (25 / 15 / 15) matches gcsim's partial aimed shot **exactly**,
  so the report's pairing is off by one and the real defect is in `[1]`. Consequence is latent
  because `C` resolves to the LAST entry — which is its own over-claim: probe `Yelan C C` draws two
  42f Breakthrough blocks where the game gives one Breakthrough and then a ~1.6s fully-charged shot.
- **[B]** **C4 is modelled at its cap and fires at the wrong instant.** We author a flat
  `hp% = 40` on `onCast`; the kit gives 10% per marked opponent (single target = 10%), and gcsim
  applies it in the `skillHitmark` (35f) marked-target pass. Probe: a 0.00→25.00s `+40% HP` team bar
  in a single-target rotation. `_curatorNotes` admits it; there is no caveat, and it is not in
  `caveat-open-items.md`.
- **[B]** **A1 "Turn Control" has no `effects`** (Max HP +6/12/18/30% by team elemental count).
  `teamElementCount` resolves definitively (**P12**) and `passive`-trigger effects DO chip in the
  always-on strip (**P9**) — ⚠️ but chip conditions are **not** evaluated, so four authored rungs
  would list optimistically. Low value on a timeline; note the trade rather than authoring blind.
- **[B]** Hold E unauthored (sidecar row "Max Duration (Hold) 3.0s"). gcsim has no hold frames either
  (`// TODO: frames for hold e`), so there is no oracle — correct to leave, and `hE` is linted at the
  token.
- **[B]** No plunge map.
- Correct and verified: the A4 ramping buff re-targets properly across a swap (probe: a short slice
  on Yelan, then 2.32→16.95s on the incoming character); the wave cadence gives 8 fires over 5
  teammate swings, which is the documented elapsed-animation-time rule, not swing count.

**Improvements:** the §2 `chargeHits` row is the one number in this batch that is simply wrong and
cheap to fix.

**Confidence:** high, except the C1 shield-style question does not arise here; medium only on whether
`C` _should_ resolve to Breakthrough by default (that is a design call, not a data error).

---

### Cross-cutting (applies to five of the seven, reported once)

- **A `P` token on a character with no plunge map emits NOTHING** — no block, no marker, no entry in
  `unknownTokens` (probe: Chiori, Emilie, Xingqiu all silently drop it; Venti, who has
  `plungeFrames`, draws a 58f block). This is deliberate and documented at the site
  (`src/lib/sim/run.ts:1430`, "An unresolvable plunge (no frames) emits NO action event, matching the
  no-block legacy behavior") — but it now sits against the human-timing round's rule that a frameless
  token draws the ordinary strip with a `--ui-provisional` label. **84 of 123 characters have no
  plunge map**, so this is a corpus-wide policy question, not a batch-9 gap. Raised once, here.

---

### Batch summary

| id        | tier | #S  | #A  | #B  | one-line headline                                                                                                                                                  |
| --------- | ---- | --- | --- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| venti     | T1.5 | 1   | 1   | 5   | Elemental Absorption is unmodelled and uncaveated, and C6's second shred draws as a nameless −20% RES on every burst.                                              |
| beidou    | T1.5 | 0   | 2   | 6   | No `hE` variant, so the parry, A4 and all of Polaris's payload are unreachable; the shield blank is a defensible deletion but the TB still claims she shields.     |
| chiori    | T1.5 | 1   | 4   | 4   | Her A1's DEFAULT branch — a 5s Geo infusion after every E — is unauthored and authorable today; the second Tamoto, C2's Kinu and C6's −12s CD are all still blank. |
| emilie    | T1.5 | 2   | 3   | 4   | A phantom Dendro pip on every E (gcsim's Spiritbreath Thorn is `Durability: 0`), and the burst neither stows the E's case nor leaves the 22s / 14-tick one behind. |
| xiangling | T1.5 | 1   | 1   | 4   | Everything measured matches the oracle, but C6's party-wide +15% Pyro is a `manual` trigger with no duration and draws nothing at all.                             |
| xingqiu   | T1.5 | 1   | 1   | 5   | C2's shred fires off the wrong casts and shows 4s of an 18s burst it should cover end to end.                                                                      |
| yelan     | T1.5 | 0   | 3   | 6   | The Exquisite Throw's Lifeline trigger, C2 and C6 are all unmodelled, and `chargeHits[1]` carries the Breakthrough Barb's frames instead of the 96f aimed shot.    |

**Cheapest high-value fixes, in order:** delete Emilie's `+62f` application (one line, removes a
phantom pip) · rewrite Xiangling C6 `manual → onCast burst` with the Pyronado's duration · fix
Yelan's `chargeHits[1]` frames to 96/86 · author Chiori's A1 default Geo infusion as an `infuse`
effect · put `abilityType:'burst'` on Xingqiu's C2 while the wave-to-`onHit` path is out of reach ·
fill in Xiangling's two missing `units`.

---

<!-- batch 10 -->

## Batch 10 — data scoping report (all Prydwen T1.5)

Characters: diona, gorou, jahoda, kaedehara_kazuha, nilou, shenhe, traveler_pyro, zhongli.
gcsim checkout left on `main` at `ac2d76dde`. Everything below was either read out of the
gcsim source, read out of a committed curation report, or **measured** — by running the
gcsim dumper (`scripts/lib/gcsim-dump.mjs`) and by running `parseNotation` on throwaway
probes under `scratch/`, all of which were deleted in the same turn. No repository file
was modified (`git status` clean).

---

### Two cross-cutting findings first (they change how you read the rest)

**1. `docs/curation/gcsim-frames-diff.md` §2 cannot see a wrong `anim`.**
`KEYS` in `scripts/lib/gcsim-map.mjs:30` is `['N','C','E','Q','D','J','P','swap']` — `anim`
is not in it — and the mismatch filter is `KEYS.filter(k => m.frames[k] !== undefined && …)`
(`scripts/audit-gcsim-frames.mjs:318`), so a key we never authored is skipped too. §1
reports the aggregate fallback exposure but never names a map. **Four maps in this batch
are wrong in exactly that blind spot** and every one of them reports as "matching":
`traveler_pyro` hE (`anim` 77 vs gcsim 81), `kaedehara_kazuha` `plungeVariants[After Hold E]`
(54 vs 61), `nilou` base E (21 vs 22), `nilou` WS1 (31 vs 33) and WS3 (61 vs 63). Adding
`anim` to the compared set is a one-line change with corpus-wide payoff. I verified the
blind spot directly: `node scripts/audit-gcsim-frames.mjs --char traveler_pyro` reports
"9 authored · 9 matching · 0 disagreeing" against a dump that reads `hE … anim:81, E:77`.

**2. A §2 row is an artefact when several abilities share one input + state gate.**
Nilou's WS1/WS2/WS3 all carry `input: ["E"]` + `conditions: {state: inStance}`, so
`authoredMaps` gives all three the same dump key and §2's two nilou rows diff WS2 and WS3
against **WS1's** slice. Checked against the dump: WS2 matches gcsim byte-for-byte. ⛔ Do
not "fix" those two rows.

---

### diona (Diona) — T1.5

**Status:** curated; frames byte-exact vs gcsim `main` (N1–N5, both aimed shots, E, hE, Q);
`application[]` complete on E/hE/Q and matching §4; Drunken Mist cadence (178f / 120f × 6,
standard ICD, 3/6 applied) matches gcsim §5 exactly. The Witch's Revelation passive is
authored description-only with the C6 Radiance clause wired.

**Gaps**

- **[S]** Drunken Mist draws **12 tick markers for 6 firings** — the heal and the damage
  effect sit on the same 2s cadence and `computeSummonTicks` takes both. Measured:
  `Diona hE Q` → `summon Drunken Mist 1.58→14.08s ticks=12`. Evidence:
  `src/lib/data/characters/diona.json` burst `summons[0].effects[0..1]` (both
  `summonTick interval 2 firstTickDelay 2`). Fix: this is the open corpus bug in memory
  `project_gauge_round_l5e` ("8 summons draw DUPLICATE tick markers"); Diona is one of the
  eight. Needs the engine-side dedupe decision, not authoring — and per that memory note,
  ⛔ not without a corpus measurement first.
- **[A]** C2 has no `effects` at all. gcsim `skill.go` `pawsPewPew`: `if Cons >= 2 { shdHp *= 1.15 }`;
  the kit also grants a 5s splash shield at 50% absorption to _other_ party members, which
  gcsim does not implement. Nothing on screen changes at C2. Fix: the 5s splash shield is a
  second `shield` Effect, authorable today (the constellation-shield wire of 2026-08-18
  handles a `shield` on a constellation entry, lint B.8a satisfied by binding
  `trigger.ability: 'skill'`); ⚠ the shield lane draws spans under the CASTER with no notion
  of a recipient, so weigh whether a second bar beside the 12s one helps or confuses.
- **[A]** C6's whole HP-conditional block reaches nothing. The +200 EM effect is
  `trigger: {type: 'manual'}` (diona.json C6 `effects[0]`) — `manual` has one occurrence in
  `src/`, its own type declaration — and the +30% Incoming Healing Bonus half is unauthored.
  Fix needs **engine work**: `recipientHpBelow`/`selfHpBelow` all fall through one
  `return null` in `src/lib/sim/conditions.ts:201-210` and `ConditionContext` carries no HP.
  ⚠ Separately, the inert effect's `target: 'self'` is _wrong_ (gcsim buffs the active
  character in the radius) and `deriveCapabilities` ignores triggers, so the Team Builder
  carries an `em/self/C6` claim with no planner counterpart. Same class as the Nicole C2
  ruling. Both facts are already in the JSON's notes and correct.
- **[B]** Hold-E cooldown start: gcsim `SetCDWithDelay(900, skillHoldHitmark=29)`; the variant
  schema has no `cooldownStartDelay`, so the parse falls back to the base's 5. Measured
  `readyAt = 15.08s` vs gcsim's 15.48s. Known schema gap (the JSON records it).
- **[B]** C4 (fully-charged aimed-shot charge time −60% inside the burst field) unmodelled.
  gcsim carries an explicit alternate slice (`aimedC4Frames`: swap 58 / D,J 50 against the
  base 94 / 86). Needs a constellation-gated `chargeHits` variant, which the schema has no
  shape for — schema work.
- **[B]** The Revelation passive's clause 1 (three auto Icy Paws on a team Superconduct /
  Stellar-Conduct / Cryo Swirl, 20s window after E, 3.5s ICD) is dismissed in the curator
  note as "pure DMG output … no pixel". I'd push back one notch: Icy Paws are Cryo hits, so
  the candidate pixel is **aura-lane application pips**, not damage. It is still genuinely
  unauthorable (no source states a durability; gcsim has no Stellar implementation), but the
  note's reasoning should say "no measured gauge" rather than "no mechanic".
- **[B]** A4 Drunkards' Farce unauthored — correct (gcsim's `asc.go` says "A4 is not
  implemented", no timing source, and an enemy ATK debuff has no lane).
- **[B]** The JSON's burst note flags a live disagreement with `scripts/capability-expectations.mjs`
  (fixture expects the Drunken Mist heal `target: 'team'`, JSON says `active`) and says it was
  "flagged for orchestrator". Diona no longer appears in `capability-audit.md`, so either the
  fixture was changed or the row is suppressed — worth one line of confirmation.

**Improvements:** the 250% Cryo absorption efficiency is unmodelled (corpus-wide
shield-efficiency gap, shared with Kaeya/Thoma/Yanfei); per-paw shield duration stacking
(gcsim extends `Expires += pawDur` per landing paw, capped at 5×) is flattened to the
all-paws-land maximum, which the caveat states honestly.

**Confidence:** high — frames and cadence measured against the dumper, the tick-marker count
measured off the parse.

---

### gorou (Gorou) — T1.5

**Status:** curated; frames byte-exact (N1–N4, aimed, E, Q; gcsim's hold slice _is_ the tap,
so having no `hE` variant is correct); applications exact; General's Glory 5 ticks at 1.5s
with standard ICD (3/5 applied) matches gcsim §5. Banner tier gating verified rung by rung
against gcsim's `geoCharCount`.

**Gaps**

- **[S]** **C4's heal reaches no surface.** `gorou.json` C4 `effects[0]` is a `heal` with
  `trigger: {type: 'manual'}`. gcsim `burst.go` `gorouBurstHealField` runs a real 1.5s heal
  tick for the whole 9s General's Glory whenever ≥2 Geo characters are in the party
  (`if c.Base.Cons >= 4 && c.geoCharCount > 1`), healing 50% of snapshotted DEF. Fix is
  authorable today: a `heal` `summonTick` effect on the General's Glory summon
  (`interval: 1.5`, `target: 'active'`, `scaling: 50`, `stat: 'def'`) with
  `conditions: all[{constellation: 4}, {teamElementCount geo >= 1}]` — tick series do take a
  `ConditionContext`. ⚠ It will double the Glory's tick markers (same damage+heal-on-one-cadence
  bug as Diona), so it should land with that in view.
- **[A]** The War Banner and General's Glory are drawn as two independent, overlapping
  objects. In game the burst **destroys** the banner (gcsim `Status.Delete(generalWarBannerKey)`
  at `burstHitmark`) and E cannot create one while Glory is up
  (`if c.Core.Status.Duration(generalGloryKey) == 0`). Measured `Gorou E Q` at C6: banner
  0.57→10.57s runs straight through Glory 1.30→10.30s, and **both** sets of banner buff bars
  draw. Fix needs a cross-ability terminate primitive (`terminatesOn` only covers recast) —
  engine work; a caveat is the authorable stopgap and there is none today.
- **[A]** C6 draws **two** 12s Geo CRIT DMG bars — one on the Skill row, one on the Burst row —
  because `trigger.ability` is deliberately omitted so it fires on both casts, and
  `teamBuffRows` keys character cast rows by ability class so the refresh-merge cannot collapse
  them. Measured: 0.57→12.57s and 1.30→13.30s. In game the buff explicitly "cannot stack and
  will take reference from the last instance". The caveat that said this was **deleted**
  2026-08-19 as "no pixel", yet the removal note itself files it `Category: visible-divergence`
  — that looks like a mis-filed removal worth re-reading.
- **[B]** C1 (E cooldown −2s when a non-Gorou character deals Geo DMG inside the field, 10s ICD)
  unauthored — needs an onHit-driven cooldown reduction; engine work.
- **[B]** C2 (+1s Glory per Crystallize shard or Lunar-Crystallize, 0.1s ICD, max +3s)
  unauthored; already listed in `docs/curation/summon-conditions-round.md:48`.
- **[B]** The 2s off-field buff linger is not modelled; buff windows run the field's full length.
- **[B]** A4's two `damage` effects carry `manual` triggers and are inert. They are damage
  magnitude, so out of scope by the constitution — but they are exactly the authored-but-unread
  shape `orphanedSchema` exists to catch; decide retire-or-document.
- **[B]** `capability-sweep.md:179` (grouping) is already VERIFIED and closed.

**Improvements:** verified against gcsim `Init()` that our tier conditions are right at every
rung — `geoCharCount` 1/2/3 maps to `teamElementCount geo = 0 / = 1 / >= 2` because
`teamElementCount` excludes the holder, and the same mapping is correct for C6's +10/+20/+40.
A1's team-wide +25% DEF for 12s on Q matches gcsim's `a1Buff` and 720f.

**Confidence:** high.

---

### jahoda (Jahoda) — T1.5

**Status:** re-migrated against `ac2d76dde` today; frames byte-exact (N1–N3, both aimed shots,
E, Q), applications match §4 exactly, robot heal cadence (87f / first at 12f) and its **9**
ticks match gcsim's loop exactly. Essentially the entire Moonsign half of the kit (flask,
Meowballs, robot damage, A1, C1, C4, C6) is unmodelled and mostly caveated.

**Gaps**

- **[A]** **The E cooldown starts at the wrong instant, and a curator note asserts otherwise.**
  gcsim sets it inside `cancelPursuit`: `SetCD(ActionSkill, skillCD + skillWindup)` = 930f, at
  **stance end**. The JSON note claims "With behavior:stance + duration:5.57 + cooldown:15.5,
  the parser counts cooldown after duration ends — total cycle = 21.07s". Measured, it does
  not: `Jahoda E ~25s E` → `cd=930 readyAt=15.50s` from the cast. Fix is one field,
  authorable today: `cooldownStartsAtStanceEnd: true` on the skill (the Xilonen/Ifa primitive;
  lint D.21/D.22 keep it away from `cooldownStartDelay`/`durationExtensions`). Worth ~5.6s of
  ghost-tail on every Jahoda rotation.
- **[A]** Casting Q inside the stance: gcsim **refuses** it outright
  (`errors.New("burst called in skill state")`, burst.go:43). Our parse puts Q at frame 42 (the
  E's Q-cancel key) and then still fires the flask-drain Anemo application at frame 368 —
  measured `Jahoda E Q` → applications `85 anemo (burst)` then `368 anemo (skill)`, i.e. the
  skill's only hit lands 4.7s _after_ the burst. Needs a stance-CANCEL primitive (the same one
  Ifa and Xilonen's re-press want) or, today, a caveat. ⚠ The kit text does not say whether Q
  ends Shadow Pursuit, so the target behaviour is a judgement call.
- **[A]** The Meowball volley is entirely unmodelled and it is the character's Moonsign
  payload: gcsim `meowballTick` fires **10** hits at 129f + 116f intervals, `ICDTagNone`
  (so _every one applies_), Durability 25, element = the **absorbed** element, each granting
  +2 Energy on a 3.5s ICD. Ten non-Anemo applications this tool never draws. Unauthorable
  today (runtime element resolution + the unmodelled flask gauge) — engine work. Caveated on
  the skill ✓.
- **[A]** The robots' damage series (Moonsign ≥2) is unmodelled: 140f cadence, ×0.9 = 126f with
  a Cryo-majority team, `ICDGroupJahodaBurst` = **900f timer / every 4th hit**
  (`pkg/core/attacks/icd_groups.dm.go:109,175`), absorbed element. The summon lane therefore
  draws the heal cadence only. Caveat exists but lives on the C6 node rather than the burst.
- **[B]** Stance start offset: gcsim enters Shadow Pursuit at `skillWindup` = 30f and runs
  `shadowPursuitMaxDuration` = 334f **from there** (ending at 364). Our window is 0→334, so the
  bar is 0.5s early at both ends. The drain application at +368 is right, which is why the two
  disagree by exactly the windup.
- **[B]** Two numbers in `_curatorNotes` are wrong and would mislead whoever authors the flask:
  gcsim `flaskFillInterval = 30` (0.5s), not "29"; and `flaskFillValue = 20` with a half value
  of 10 for an off-element aura, not "fill the gauge by 25 each".
- **[B]** A1 "Plan to Get Paid" is flagged as unauthored, which over-states it. Of its four
  branches only Electro (+1 robot) and Cryo (−10% interval) change anything drawable, and both
  act on `robotHitmarkInterval`/`robotCount` — the **damage** series. `healInterval` is a
  constant 87, so the tick markers we draw are correct under every A1 branch. Say so in the note.
- **[B]** A4 (+100 EM 6s to the healed character when above 70% HP) is caveated as needing three
  primitives. In gcsim it fires on the _active_ character at every heal tick — so if a `buff`
  effect is legal on a `summonTick` trigger, it is authorable as a 6s `em: 100` `target: 'active'`
  tick with the HP gate caveated, turning "no bar" into "a bar with one stated approximation".
  Worth checking the schema before accepting the caveat.
- **[B]** `docs/curation/genshin-db-diff.md:17` still files jahoda's `cooldown 15.5` vs
  genshin-db's `15` as an open cd-mismatch; ours is deliberate (`skillCD + skillWindup`). A
  `GDB_CD_KNOWN_WRONG` entry would clear it.
- **[B]** Prose: the two notes updated today say "gcsim main has **him**"; `gender` is `Female`.

**Improvements:** the `↻ 2026-09-15` re-migration lines are attached to the A4 and C6 nodes,
which are odd homes for a frames/application provenance statement — they belong on the skill and
burst entries.

**Confidence:** high on everything measured; medium on the Q-during-stance target behaviour.

---

### kaedehara_kazuha (Kazuha) — T1.5

**Status:** the best-curated file in the batch. N1–N5, chargeFrames, `plungeFrames`,
`lowPlungeFrames`, E, hE and Q are all byte-exact against the gcsim dump; applications exact;
Autumn Whirlwind verified at `firstTickDelay 0.967 / interval 1.95 / tickCap 5 / icdGate 'none'`
(gcsim `for i := range 5`, `ICDTagNone`, §5 measures 5/5 `none`). A4's per-element swirl buffs
and the `stellarSwirl` → cryo-only pairing are correct, and the `source: 'self'` default matches
gcsim's `atk.Info.ActorIndex != c.Index() → return`.

**Gaps**

- **[A]** **The glide-cancel — the transition every Kazuha rotation uses — is not modelled.**
  Our FrameMap is `{anim: 77, P: 24}`, so `E → Q` and `E → swap` both cost 77f. gcsim carries a
  second slice per cast (`skillPressFrames[1]`, selected by the `glide_cancel` param):
  Burst 61, Dash 61, Jump 59, **Swap 60**; hold: Attack 158 / Burst 159 / Swap 155 against 175.
  So a press-E timeline runs ~0.28s long from the E onward and a hold-E one ~0.33s. Fix is a
  notation-level cast variant (no token exists) — engine work. ⚠ The caveat that disclosed this
  was deleted 2026-08-19 although its own note files it `Category: approximation-disclosure`;
  worth re-reading alongside the Gorou C6 removal.
- **[A]** `plungeVariants["After Hold E"].anim` is a **stand-in**: ours is 54, equal to its own
  `swap` (the pre-L4b marker), while gcsim's `plungeHoldFrames` animation length is **61**
  (`InitAbilSlice(61)` with Skill 60 / Burst 60 / Dash 48 / Jump 55 / Swap 54). Every unlisted
  key (C, P) therefore resolves 7f short. Invisible twice over: §3 files the map as
  "no gcsim analogue", and §2 excludes `anim`.
- **[A]** There is **no plunge variant for the press-E Midare Ranzan**, and the base
  `plungeFrames` are not what the curator note says they are. gcsim's `plungePressFrames` is
  `{anim 55, D 43, J 50, swap 50}`; our base is gcsim's **generic** high plunge
  `{anim 73, N 54, E 53, Q 53, D 47, J 69, swap 55}` — verified against the dump's `P` key. The
  note claims the base "represent[s] the Press-E plunge path (plungePressFrames …)", which is
  false. `E P Q` therefore runs ~18f long on the plunge and the whole tail shifts.
- **[A]** C2 buffs **Kazuha himself even off-field** as well as the active character (gcsim
  `cons.go c2`: two `AddStatMod` calls, the second explicitly `if active.Base.Key != c.Base.Key`).
  We author one `target: 'active'` effect, so Kazuha's own +200 EM — the stat his A4 scales off —
  never draws, and he is off-field for essentially the whole window. Fix: a second
  `target: 'self'` effect, authorable today.
- **[B]** The Autumn Whirlwind's 5th tick marker lands **outside its own bar**. Measured
  `Kazuha E Q` at C6: `summon 2.65→10.65s, ticks 3.62 / 5.57 / 7.52 / 9.47 / 11.42`. That is the
  `tickCap` widening the window by one interval, working as designed — but gcsim's own
  `burstStatus` runs `(140−81) + 117×4 = 527f ≈ 8.78s`, not 8.00s. Authoring
  `duration: 8.78` would put the marker back inside its bar without touching the cap.
- **[B]** C4 (Press/Hold +3/+4 Energy while Energy < 45, +2/s while gliding) unauthored — the
  energy-threshold condition has no primitive. Filed at `capability-sweep.md:107`.
- **[B]** The Elemental Absorption DoT (`burstEleDot`, riding the identical 117f cadence in the
  absorbed element) and the A1 absorption bonus on Midare Ranzan are correctly unauthored
  (runtime element) — but nothing on screen says the Autumn Whirlwind can carry a second element.
- **[B]** `genshin-db-text-diff.md:24` lists passive2 as revised for Stellar Swirl; already closed
  by the 7.0 round (the trigger carries `["cryoSwirl","stellarSwirl"]` and the text is re-synced).
  No action.

**Confidence:** high.

---

### nilou (Nilou) — T1.5

**Status:** the most divergent file in the batch. Normals, Sword Dance, charge and burst frames
are byte-exact; three `anim` values are short; the parser structurally cannot walk her step
chain; her defining off-field mechanic puts nothing on the gauge.

**Gaps**

- **[S]** **The Pirouette stance bar is the wrong length and grows with a constellation that
  does not touch it.** Measured: `Nilou E` → `{"kind":"state","name":"inStance","start":0,"end":720}`
  = **12.00s** at C0, and **18.00s** at C1+. Pirouette is **10s** at every constellation
  (gcsim `skill.go:120`, `AddStatus(pirouetteStatus, 10*60)`; our own `duration: 10`). Cause:
  `resolveActiveDuration` in `src/lib/sim/resolve.ts:145-152` ranks `ability.summons[0].duration`
  **above** `ability.duration`, so the stance inherits the Tranquility Aura's 12s _and its C1
  `durationModifier` +6s_. This is exactly the precedence trap that function's own comment warns
  about at the variant level ("rungs 3 and 4 are the order that matters", written for Zhongli's
  hold-E) — Nilou is the base-level instance and nobody caught it. It also widens the `inStance`
  gate that admits Sword Dance and Whirling Steps. Fix needs an engine decision (a stance must
  not read a summon's duration) or removing the summon from the base ability — ⛔ the latter is
  what the current authoring deliberately did _to make the aura draw_, so the two are entangled.
- **[S]** **Whirling Steps 2 and 3 never resolve.** All three carry `input: ["E"]` +
  `conditions: {state: inStance}`, so the parser takes the first match each time. Measured
  `Nilou E E E E` → three casts of `nilou__skill__whirling_steps_1`. The canonical Nilou rotation
  _is_ `E E E E`. On screen: three 31f bars instead of 31 / 62 / 61, three Hydro pips at +0.35s
  instead of +0.35 / +0.48 / +0.72, and the Water Wheel — the cast that actually ends Pirouette
  and spawns the aura — never appears. Needs a chain-step condition primitive; engine work. The
  JSON documents it in three places.
- **[S]** **The Tranquility Aura has no tick markers and feeds nothing to the gauge.** gcsim
  `TranquilityAura` ticks every **30f (0.5s)**, Hydro, Durability 25 (1U), with
  `ICDGroupNilou` = **114f timer, every 4th hit** (`pkg/core/attacks/icd_groups.dm.go:120,186`)
  — so one application every ~2s for 12s (18s at C1). Our `summons[0]` has no `effects` at all.
  This is the documented "a tick can apply an element and deal NO damage" class (the aura's
  `AttackTag` is `AttackTagNone` with no `Mult`, exactly like Xingqiu's Orbital and Barbara's
  Melody Loop): the gauge is reachable only through a `damage` effect, and a `scaling: 0` would
  be a placeholder the outlier audit flags. Engine work — and Nilou is the highest-visibility
  instance in the corpus, because off-field Hydro application is her entire job.
- **[A]** WS2's and WS3's `application[]` frames are **copied from WS1**: all three author
  `{frame: 21, element: 'hydro'}` where gcsim's `whirlingStepsHitMarks` are **21 / 29 / 43**.
  Authorable today (one number each), and none carries `units` though gcsim's Durability is 25 →
  `units: 1`, so each currently draws a provisional foot on the aura lane.
- **[A]** Three understated `anim` values, all invisible to §2: base E **21 → 22** (the JSON's own
  note already says `InitAbilSlice(22)`), WS1 **31 → 33**, WS3 **61 → 63**. WS2 is exact.
- **[A]** ⛔ `gcsim-frames-diff.md` §2 lines 73–74 (nilou WS2/WS3) are **oracle artefacts** — see
  the cross-cutting finding. Verified against the dump: WS2 matches gcsim exactly. Writing them
  would corrupt a correct map.
- **[B]** C2's Hydro shred uses `trigger: {onHit, damageType: 'elemental'}`, broader than the kit
  ("after characters affected by the Golden Chalice's Bounty deal **Hydro** DMG"). Measured
  `Nilou E E E E Q` at C6 → five overlapping 10s hydro-RES windows (they should refresh-merge into
  one bar). The Lunar-Bloom half cannot be expressed: only `bloom` is in our reaction enum for
  that trigger while gcsim has `AttackTagDirectLunarBloom`.
- **[B]** A1's headline mechanic — Bloom → **Bountiful** Cores — stays notes-only. Since the
  polestar-field round the gadget strip _does_ draw dendro cores, so a Nilou team's cores now draw
  as ordinary Bloom cores with no sign they are Bountiful. That is a newly available surface for
  this claim.
- **[B]** C4's two effects carry `manual` triggers → inert. gcsim's `c4cb` fires on **SD3**
  (`skillStep == 2` during Pirouette), i.e. the Sword Dance path only, never WS3 — correctly noted.
  Unblocking it depends on the step-chain gap above.
- **[B]** A4 (Bountiful Core DMG scaling off Max HP over 30000) is description-only — damage
  magnitude, correct.
- **[B]** `caveat-open-items.md:45` already files the aura's fixed +161f spawn as a visible
  divergence, and the skill's caveat covers both it and the "E does nothing in Lunar Prayer" case.

**Improvements:** Sword Dance frames (20 / 23 / 60 with hitmarks 14 / 12 / 35 and the two
`ActionAttack` overrides) are byte-exact vs gcsim; the burst's two applications (+91 initial,
+212 Lingering Aeon) are exactly right and `application[]` is the only place the enemy-attached
delayed hit can live today.

**Confidence:** high — every claim above was measured off the gcsim dump or the parse.

---

### shenhe (Shenhe) — T1.5

**Status:** frames byte-exact (N1–N5, chargeFrames, E, hE, Q); the burst's 12-entry
`application[]` matches gcsim's nominal schedule and the six that survive our per-cast ICD are
exactly gcsim's applied set; `chargedIcdWindow {timer: 30}` matches `ICDGroupPoleExtraAttack`;
C1's `chargeModifiers` +1 charge matches `SetNumCharges`. **The effects half is the weak one —
three team-facing buffs reach no surface at all.**

**On the September gcsim quill fixes (#2735 "not working when below A4", #2774 "regression
caused by the A4 bugfix"):** in current `main`, the quill grant is a task independent of
`a4PressBuff`/`a4HoldBuff` (`skill.go`, `other.AddStatus(quillKey, …); other.SetTag(quillKey, 5|7)`),
so quills work below A4 and the A4 buff is a separate thing. Our Icy Quill effect is gated on
nothing, so **we already match the fixed behaviour** — no change needed there. The fixes do,
however, make the A4 gap below more conspicuous, because they separated the two mechanics we
have merged into one.

**Gaps**

- **[S]** **A4 "Spirit Communion Seal" is entirely unauthored** (no `effects`; the note says
  "needs reviewer pass"). gcsim `asc.go`: Press → **+15% Elemental Skill and Elemental Burst DMG
  to every party member for 10s**; Hold → **+15% Normal / Charged / Plunging DMG for 15s**. A 15%
  team damage buff on Shenhe's most-pressed button, and the planner draws nothing. **Authorable
  today**, and the press/hold split falls out of the existing shape for free: `skillDmgBonus` +
  `burstDmgBonus` on the base `effects`, `normalDmgBonus` / `chargeDmgBonus` / `plungeDmgBonus`
  on the `hE` variant (a variant's `effects` REPLACE the base's). All Stat keys exist
  (`src/lib/types/ability.ts:117,118,125`). Gate `ascension >= 4` as Gorou's A1 does.
- **[S]** **A1 "Deific Embrace" is `trigger: {type: 'manual'}` → invisible**, and its
  `target: 'team'` is wrong (gcsim applies to `Core.Player.ActiveChar()` only, inside the field,
  re-checked every 18f). Authorable today as `onCast ability: 'burst'`, `target: 'active'`,
  `duration: 12`, `stat: 'cryoDmgBonus'`, `value: 15`, `conditions: {ascension >= 1}` — exactly
  the shape the burst's own resShred pair already uses.
- **[S]** **C2's +15% Cryo CRIT DMG is also `manual`** → invisible at C6. Same fix
  (`onCast burst`, `target: 'active'`, `duration: 12`, `cryoCritDmg`). C2's other half (+6s field)
  _is_ authored as a summon `durationModifier` ✓, so the constellation currently half-works.
- **[A]** **The Icy Quill is authored as `normalFlatDmg` only.** gcsim's `quillDamageMod` hook adds
  the flat DMG to **every** Cryo hit: burst, skill, skill-hold, normal, charged and plunge. Measured,
  the planner draws one team bar whose stat reads as a Normal-Attack flat DMG bonus — a
  Shenhe/Ayaka or Shenhe/Ganyu user reads that as "my burst isn't buffed". The `*FlatDmg` family is
  complete (`ability.ts:208-211`) and Zhongli's own A4 is the five-effect precedent. ⚠ Check
  against `mergeRefreshedBars` first: five same-window effects on one trigger may draw five bars.
- **[A]** **At C2 the RES-shred bars are 6s shorter than the field they come from.** Measured
  `Shenhe hE Q` at C6: summon `Talisman Spirit Field` 1.53→19.53s, shred window 1.53→**13.53**s.
  gcsim re-applies both shreds every 18f for the whole extended `burstDuration`. The summon carries
  the `durationModifier`; the two `resShred` Effects cannot (no `durationModifiers` on `Effect`) —
  so this needs a schema field or a duplicated C2-gated pair. The JSON records the choice; nothing
  on screen discloses it.
- **[A]** The burst's `application[]` is fixed at C0's 12 entries over 12s. gcsim runs `count = 9`
  pairs over 18s at C2 (18 nominal). Constellation-varying application lists have no expression
  today, and there is no caveat saying so.
- **[B]** The Talisman Spirit Field summon has **no tick markers** (no `effects`). That is defensible
  and should be _recorded_ so a future curator does not "fix" it: gcsim fires the DoT in irregular
  **pairs** (`82 + i*117`, second at `+30 + {0,2,4}`), which a fixed `summonTick` interval cannot
  state — the Furina/Charlotte ruling that an `application[]` carrying summon damage is sometimes
  the only correct home.
- **[B]** C4 Skyfrost Mantra (≤50 stacks, 60s, consumed on the next E) unauthored. The stack
  machinery exists now, but the gain trigger is "a party member consumed a quill" — which we do not
  model — and the payoff is a damage bonus. Correct to leave.
- **[B]** C6 (N/CA Cryo hits do not consume a quill) has nothing to author because quill
  **consumption** is not modelled. ⚠ But the skill's caveat states the 5/7 consumption rule flatly
  and does not say C6 changes it — one clause would fix that.
- **[B]** Hold-E `cooldownStartDelay` 32 is unavailable on variants (measured `readyAt` 15.03s vs
  gcsim's 15.53s). Known schema gap.
- **[B]** The hold slice's `E` key is gcsim's own documented approximation ("assume skill (press)";
  H→H is 52f) — flagged in the JSON, nothing to do.

**Confidence:** high.

---

### traveler_pyro (Pyro Traveler) — T1.5

**Status:** frames right except one `anim`; applications right and the six Blazing Threshold pulses
are exactly correct for the bare-`E` case. **But the entire passive and constellation block
describes a character that does not exist** — wrong names and wrong mechanics at every node.

**Gaps**

- **[S]** **Every passive and constellation is wrong.** Cross-checked against the Fandom MediaWiki
  API and gcsim `internal/characters/traveler/common/pyro/{asc,cons}.go`:

  | node | ours                                                       | actual (wiki + gcsim)                                                                                                                                                             |
  | ---- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | A1   | "Resounding Battlecries"                                   | **True Flame of Incineration** — same radius mechanic, wrong name                                                                                                                 |
  | A4   | "Crackling Adversity", +30% Pyro DMG 5s on a Pyro reaction | **Embers Unspent** — +5 Energy when the active character inside a Threshold triggers a Pyro reaction (12s ICD); +4 Energy on any party member's Nightsoul Burst (`asc.go a4Init`) |
  | C1   | "Burning Resolve", +14 max Nightsoul points                | **Starfire's Flowing Light** — while a Threshold is active the **active character deals +6% DMG, +9% more if in Nightsoul's Blessing** (`cons.go c1Init`)                         |
  | C2   | "Spreading Flames", +30% ATK to active 8s                  | **Ever-Lit Candle** — within 12s of E, a party member's Pyro reaction restores **14 Nightsoul points**, max 28 per cast (`c2Init`)                                                |
  | C4   | "Brightening Embers", +30% Q DMG in NS                     | **Ravaging Flame** — +20% Pyro DMG for 9s after the burst (`c4AddMod`)                                                                                                            |
  | C5   | "C5 Talent Boost"                                          | **The Fire Inextinguishable**                                                                                                                                                     |
  | C6   | "Final Bloom", +30% Q CRIT Rate                            | **The Sacred Flame Imperishable** — +20% Move SPD, −30% stamina, N/CA emit 96%-ATK Nightsoul Pyro waves, +40% CRIT DMG on those attacks (`c6Init` implements the CRIT DMG half)   |

  C1's real effect is a **team-facing damage buff that should draw a bar**; C4's is a self
  Pyro-DMG window; A4 is energy. None of them exists in our data.
  `docs/curation/capability-sweep.md:155-156` already names "Embers Unspent", "Ravaging Flame" and
  "Starfire's Flowing Light" as _talents absent from our JSON_ — the sweep found this and it was
  never actioned, and `capability-audit.md:64` ("frame-curated but zero capabilities derive —
  verify") is the same finding from the other side. Fix: a full re-ingest of the passive +
  constellation block. ⚠ Every Traveler constellation has a **Base Effect** (only vs the Lord of
  Eroded Primal Fire / Gosoythoth) plus an ore-unlocked general effect — author the general half,
  as the other Traveler variants do.

- **[A]** Hold-E `frames.anim` is **77**; gcsim's animation length is **81**, and 77 is its
  `ActionSkill` value. Measured off the dumper:
  `hE {A:81, C:81, D:60, E:77, J:61, N:61, P:81, Q:59, anim:81, swap:59}`. So the E→E number is
  sitting in the fallback slot and there is no `E` key at all; every unlisted transition (C, P, A)
  resolves 4f short. gcsim changed this in PR #2747 ("Add checking animation length in tests"), and
  §2 could not see it because it excludes `anim`.
- **[A]** C6's flaming waves on Normal/Charged attacks are a Nightsoul-Pyro coordinated attack — a
  per-swing application source nothing draws. gcsim implements only the CRIT DMG half, so the wave's
  durability is unmeasured; unauthorable today.
- **[B]** The skill draws **two** identical 12s `state` bars — `inStance` (from `behavior: 'stance'`)
  and `nightsoulBlessing` (from `opensState`). Measured. Correct by the data model, visually
  redundant; the only character in the batch that does this.
- **[B]** The Nightsoul drain is caveated ✓ and the six authored applications are exactly right for
  the bare `E` (42 points ÷ 0.7 per 6f = 360f; pulses at 24 + 66k give exactly six). But the burst's
  4×7-point refresh, the real C1's point cap and the real C2's +14-per-reaction all extend it, so
  the count is right only for that one case — and two of those three do not exist in our data at all.
- **[B]** Scorching Threshold (the Hold-E on-damage proc: 81.4% ATK Pyro, 3s ICD,
  `ICDTagTravelerScorchingThreshold`, 12f hit delay) is unmodelled. It is now _expressible_ — it is
  the `onHit` proc shape the coordinated-attack round shipped — but lint B.13c makes
  `whileNormalAttacking`/proc hosting summon-only and Pyro Traveler has no summon.
- **[B]** `capability-sweep.md:191` ("Ravaging Flame heal") is marked VERIFIED as the Gosoythoth-only
  base effect — correct, but the verification noted the talent was absent from our JSON and stopped
  there rather than filing the ingest.

**Confidence:** high. The wiki and gcsim agree against our file on every node, and the frames are
measured.

---

### zhongli (Zhongli) — T1.5

**Status:** frames byte-exact (N1–N6, chargeFrames, E, hE, Q); applications exact; the Stone Stele's
`tickCap: 15` and standard ICD are right — gcsim's group for the tick **is** `ICDGroupDefault`
(150f / every 3rd), so §5's `other` reading is the Geo-construct resonance case CLAUDE.md already
closed, not a missing `icdGate`. The hold-E RES-shred pair (all-elemental + physical) matches
gcsim's eight-element list.

**Gaps**

- **[S]** **C2 grants no Jade Shield.** gcsim `burst.go`: `if c.Base.Cons >= 2 { c.addJadeShield() }`
  — the burst raises the _same_ 20s shield and the _same_ −20% all-element + physical RES package.
  Our C2 entry has no `effects`. Measured `Zhongli E hE Q` at C6: the Q produces no shield and no
  shred window. **Authorable today** — this is exactly the shape the constellation-shield wire
  shipped for on 2026-08-18 (`getNonAbilityEffectsForCast`), with lint B.8a satisfied by binding
  `trigger.ability: 'burst'`. ⚠ A hold-E shield and a burst shield that resolve to the same 20s span
  will collapse to one bar by the "ONE SPAN, ONE BAR" rule — which is the right outcome.
- **[A]** **Planet Befall's Petrification window is never drawn.** The burst authors `duration: 4`
  plus a C4 `durationModifiers` +2 on an ability whose `behavior` is `instant`; measured, the Q
  produces no window of any kind. Petrification is a control mechanic — a thing that IS, for 4s
  (6s at C4) — which is precisely what `activeDuration` exists for; `duration` here is one of the
  twelve inert strays CLAUDE.md names. One-field fix, and C4's modifier starts working for free.
- **[A]** The **hold-E stele is deliberately not drawn** (`summons: []` on the variant, with a long
  note explaining why). gcsim creates one whenever `steleCount < maxStele` (`skill.go` `skillHold`).
  So the most common Zhongli opener shows a shield and no stele, and `E hE` shows one stele lane
  where two exist at C1. Fix needs per-summon durations on a variant (the Ineffa/Citlali/Furina work
  already flagged) — engine/schema.
- **[A]** **C1 (two simultaneous steles) is unmodelled**, which in game also doubles the resonance
  output. Needs a per-instance summon model, not a second `summons[]` entry (two live instances of
  the _same_ summon).
- **[B]** The Stone Stele summon has no `spawnsAt`; gcsim creates it at `skillPressHimark` = 24f.
  Measured, the bar starts at 0.00s while its first tick correctly lands at 2.40s — so the bar and
  its own ticks disagree about when the stele exists. One field.
- **[B]** The base press-E has no `cooldownStartDelay`; gcsim is `SetCDWithDelay(240, 22)` (0.37s).
  The hold's is 47f and the variant schema cannot carry it.
- **[B]** N5's FrameMap has no `hit`, so that swing has no hitmark for the ICD clock or the aura
  lane. (gcsim's cancel keys split 4 / 5 there, which is why it was authored key-by-key rather than
  as `{anim, hit}`.)
- **[B]** The hold-E `application[]`'s second entry at frame 48 is the **Stone Stele (Initial)**
  hit, whose gcsim Durability is **50 → `units: 2`**, not the defaulted 1. It is ICD-suppressed and
  so never reaches the gauge, making this cosmetic — but it is wrong data.
- **[B]** A1 Resonant Waves and C6 (40% of incident damage healed, capped 8% Max HP) are correctly
  unauthored — no incoming-damage model, no pixel. The 2026-08-19 C6 caveat removal reasoning holds
  (unlike Gorou's and Kazuha's).
- **[B]** The Jade Shield's 150% absorption efficiency is unmodelled (corpus-wide gap).
- **[B]** `capability-sweep.md:169` — "wiki attributes interruptionRes (Dominus Lapidis) — nothing
  derives" is still open. The Jade Shield does grant interruption resistance, and Gorou's
  `interruptionRes` with `value: {type: 'unknown'}` is the corpus precedent for saying so.

**Confidence:** high.

---

### Batch summary

| id               | tier | #S  | #A  | #B  | headline                                                                                                                                                          |
| ---------------- | ---- | --- | --- | --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| diona            | T1.5 | 1   | 2   | 6   | Frames and cadence exact; Drunken Mist draws 12 markers for 6 ticks, and C2 + all of C6 reach no surface.                                                         |
| gorou            | T1.5 | 1   | 2   | 5   | C4's heal is a `manual` trigger that draws nothing, and the banner and Glory render as two overlapping fields the game never lets coexist.                        |
| jahoda           | T1.5 | 0   | 4   | 7   | Re-migration is clean, but the E cooldown runs from the cast where gcsim runs it from the stance end — and a curator note claims otherwise.                       |
| kaedehara_kazuha | T1.5 | 0   | 4   | 4   | Best-curated file in the batch; the glide-cancel every rotation uses is unmodelled and both plunge-after-E paths are wrong.                                       |
| nilou            | T1.5 | 3   | 3   | 5   | Pirouette draws 12s (18s at C1) instead of 10s because a stance reads its summon's duration; WS2/WS3 never resolve; the Tranquility Aura feeds the gauge nothing. |
| shenhe           | T1.5 | 3   | 3   | 5   | Quill model matches the September gcsim fixes, but A4 is unauthored and A1 + C2 are `manual` — three team buffs that draw no bar.                                 |
| traveler_pyro    | T1.5 | 1   | 2   | 5   | Every passive and constellation name **and** mechanic is wrong; the capability sweep found it in July and it was never actioned.                                  |
| zhongli          | T1.5 | 1   | 3   | 7   | C2's burst Jade Shield is unauthored (and now trivially authorable), and Planet Befall's Petrification window is never drawn.                                     |

**Highest-value work, ranked across the batch, restricted to what is authorable today:**

1. `traveler_pyro` passive/constellation re-ingest (the whole block is fiction).
2. `shenhe` A4 + A1 + C2 (three team buffs, all one-shape fixes).
3. `zhongli` C2 Jade Shield + `activeDuration` for Petrification.
4. `gorou` C4 heal as a `summonTick` (mind the duplicate-marker bug).
5. `jahoda` `cooldownStartsAtStanceEnd: true`.
6. `nilou` WS2/WS3 application frames, and the three short `anim` values across nilou +
   traveler_pyro + kazuha.
7. Add `anim` to the frames audit's compared `KEYS` so class 6 stops being invisible.
