# The ICD-group round — what a per-ability ICD group would buy

**Status:** 🟢 **a, b and c are SHIPPED** (2026-08-17 / 18). ⛔ **d is CLOSED, not held** —
§10, on evidence that arrived after b landed.

- **c** — the charged-attack window (`chargedIcdWindow`, 16 characters).
- **a** — the shim reads gcsim's group and the audit reports the cadence (§6a, §9).
- **b** — `icdGate` generalised to `'none' | IcdWindow`, 14 tick series migrated (§6b, §9).

⚓ **§9 IS THE RECORD** — what moved, in which direction, and the per-fixture account the
fork in §6b demanded. Read it before quoting any number from §3 or §8: those are the
BEFORE, and they stay as written.

**Reads:** [`gauge-round-L5e.md`](gauge-round-L5e.md) §3.3 (where the default was chosen)
· [`gauge-round-L4.md`](gauge-round-L4.md) (the schema gap, first named) ·
`docs/library/game/icd.md` (the model, and the rule against mass-annotating a default)

> L4 named "per-ability ICD tag + group" as its top schema gap and L5e-a¾ shipped the
> narrow half of it — a summon tick series can say `'none'`. This document is the survey
> of the wide half: what gcsim's groups actually contain, what closing them is worth, and
> ⚓ **why the honest answer is "less than it looks".**

---

## 1. gcsim's model, exactly

`pkg/target/icd.go`, `WillApplyEle`. ⚓ **State is keyed `(character, ICDTag)` — the TAG,
never the group.** The GROUP contributes exactly two things:

- `ICDGroupResetTimer[grp]` — a reset window, in frames.
- `ICDGroupEleApplicationSequence[grp]` — a per-hit multiplier on the applied durability.

A hit reads `seq[counter]`, increments the counter, and — ⚠️ the detail worth having —
**past the end of the array it reads the LAST entry**, not zero. The counter is zeroed by
a **one-shot task scheduled at first-hit + `timer − 1`**, not by a sliding window.

⚠️ There is a second, parallel pair (`ICDGroupDamageSequence`, `GroupTagDamageMult`) for
reaction-damage ICD. ⛔ Not ours; don't read it by mistake.

## 2. All 58 groups collapse to `(timer, period)`

Measured over the whole table:

| shape                             | groups | examples                                           |
| --------------------------------- | -----: | -------------------------------------------------- |
| one application per window        | **34** | `PoleExtraAttack`@30f, `ColleiBurst`@180f          |
| period 3 (incl. **Default**@150f) |  **9** | `Amber`@60f, `Venti`@60f, `NaviaBurst`@720f        |
| period 4                          |      5 | `Fischl`@300f, `Nilou`@114f, `Tighnari`@150f       |
| period 2                          |      5 | `CharlotteMark`@720f, `FurinaSalonSolitaire`@1800f |
| period 5 / 7                      |      2 | `Diluc`@300f, `Layla`@180f                         |
| every hit                         |      2 | the two reaction groups — not ours                 |
| one per window at **1.5×**        |      1 | `NahidaSkill`@60f                                  |

17 distinct timers, from 6 frames to 1800.

⚓⚓ **That pair is the shape `IcdParams` already had.** `{ timer, hits }` IS
`(window, period)`, and `hits: Infinity` already expresses one-per-window — the branch in
`icdApplies` is `count > hits`, which simply never fires. ⛔ **So this round needs no new
ICD mechanism, and anyone starting it should not build one.** It needs data, and a
resolver willing to return something other than the standard.

⚠️ **The 1.5× multiplier still does not belong in the ICD model** — but ↻ **not for the
reason first written here.** This document originally claimed Nahida's Tri-Karma "already
carries `units: 1.5` in her authored `application[]`". It does not, and **no `units: 1.5`
exists anywhere in the corpus** — her list holds one 1U entry for the cast's own hit, and
Tri-Karma is not authored at all. The 1.5U is gcsim's, in the oracle's column.

⚓ The conclusion survives its evidence: a gauge STRENGTH belongs beside the application
that carries it, which is where `units` already lives, ⛔ not in a cadence model. But the
field is unwritten, so **whoever authors Tri-Karma writes the corpus's first 1.5U** — see
§5, and ⛔ do not treat this as solved.

## 3. ⚠️⚠️ The residue is NOT all groups — it splits three ways

This is the correction the survey exists for. The oracle's ICD-shaped residue looked like
17 applications across three characters; it is three different faults:

| character                 | apps | cause                                                                                |
| ------------------------- | ---: | ------------------------------------------------------------------------------------ |
| **Fischl's Oz**           |    8 | ⚓ **genuinely group** — `ICDGroupFischl` is 300f/period-4 against our 150f/period-3 |
| **Zhongli's Stone Stele** |    6 | ⛔ **not group, and ↻ not counter sharing either** — see the correction below        |
| **Xiangling's Pyronado**  |    3 | ⛔ **wrong too** — it is Burning's own Pyro, and Xiangling is EXACT (§10.1)          |

⚓ **So a per-ability group buys 8 in the oracle, not 17.** Quote that number, ⛔ don't
re-derive the 17.

### ↻⚠️⚠️ CORRECTION 2026-08-18 — the stele's 6 are GEO-CONSTRUCT RESONANCE

This section originally filed Zhongli's 6 under §4's counter sharing. **That is wrong, and
it mattered: those 6 were half of d's entire prize.** Measured in an isolated core, gcsim's
stele applies on **8 of 16 ticks, 240f apart** — which is exactly what our model does, at
`ICDGroupDefault`. ⚓ **In isolation we reproduce the stele perfectly.**

The divergence is the FIXTURE. `zhongli/stele.go`'s `resonance()` queues one hit per stele
**plus one per non-stele construct within radius 8**, and the crystallize fixture has
Ningguang's Jade Screen sitting there. Two hits per tick against
`ICDGroupDefault`'s `{1,0,0,1,0,0,…}` walks the counter twice as fast, so index 3 comes up
on the very next tick and gcsim applies on **every** tick — the observed 2 s cadence
against our 4 s.

⚓ So it is an unmodelled MECHANIC (a Geo construct near a stele doubles its hits), not an
ICD fault of any kind. ⛔ **d buys nothing here.** ⚠️ And the general shape is a warning
about this whole survey: a fixture with a second character in it can make one character's
cadence look wrong. Re-measure a suspect series in the ISOLATED core before attributing it.

### And the over-application is 1–3, not a factor

Feeding each authored tick stream through `simulateIcd` at `STANDARD_ICD_FRAMES`, beside
gcsim's own `(timer, sequence)`:

| series                          | ours | gcsim | ungated |
| ------------------------------- | ---: | ----: | ------: |
| Collei Cuilein-Anbar (0.5s ×12) |    5 |     2 |      12 |
| Venti Stormeye (0.4s ×20)       |    8 |     7 |      20 |
| Navia Cannon Fire (0.7s ×17)    |    9 |     6 |      17 |
| Fischl Oz (0.98s ×10)           |    4 |     3 |      10 |

⚓ L5e §3.3's ranking holds **by a wide margin** — standard is within 1–3 everywhere while
ungated is off by 5–13. ⚠️ We are nonetheless less accurate than gcsim on every one, and
always in the same direction: we over-apply.

## 4. ⚓ The other half of the fault: counter SHARING

gcsim keys the counter `(character, ICDTag)`, so **everything a character emits under one
tag shares one counter** — Zhongli's E cast and his Stone Stele's ticks are both
`ICDTagElementalArt` and draw on the same budget. We isolate: a fresh clock per cast, a
separate clock per summon series.

That isolation is deliberate and documented (`resolveActionIcd`), justified on **112 of
166 gcsim skills being `ICDTagNone`** — for those, sharing would change nothing. ⚠️ For
the other 54 it does. ↻ **The stele was cited here as what it looks like when it bites, and
it is not** — see §3's correction; the stele matches us exactly in isolation. This section
keeps its argument but has **lost its worked example**, which is worth knowing before
pricing anything on it.

⛔ **This is not a data question and must not be folded into the group work.** It asks
whether our clock key should become `(character, gcsim tag)`, which is an engine change
with its own risk: Xiao's skill sits in a group whose reset timer is **5 frames**, so
sharing naively across casts would delete his second E's application — the exact case the
isolation was chosen to protect.

## 5. ✅ The primitive that was going to reshape this has SHIPPED

⚓ **The Nahida Tri-Karma / Fischl A4 round landed 2026-08-17** (`0719850` → `6a643e2` →
`e26703a`, `docs/rounds/mark-triggered-damage-round.md`), and it did NOT mint a general ICD-group
form — so this round's shape is unchanged and its question is still open.

What it did pick, and what that means here:

- **Gauge strength lives in the effect's own `application[]`**, as `units`. Tri-Karma's
  1.5U — `ICDGroupNahidaSkill`'s `{1.5, 0, …}` multiplier applied to `Durability: 25` — is
  a measured NUMBER on the authored hit, not a group reference. ⚓ So the 1.5× multiplier
  no longer argues for a group primitive: the one place it appears is already served.
- **Cadence lives in `procCooldown`**, which the effect already had.
- ⚠️ Tri-Karma's group also never binds in practice (a 1 s timer under a 2.5 s trigger
  interval), so it is the weakest possible case for the general form.

⛔ **The `icdGate` general form is therefore still unminted, and still should not be minted
speculatively** — but the reason has changed. It is no longer "wait and see what the
mark-triggered primitive needs"; it is the original one: no consumer needs it yet.

## 6. The sub-landings

### ✅ c — the charged-attack window (SHIPPED 2026-08-17)

`NormalAbility.chargedIcdWindow?: IcdWindow` — a measured `(timer, every)` pair that
`resolveActionIcd` prefers over the standard default. Authored on **16 characters, 19
normal abilities**; `characterLint` A.4b guards it.

⚠️⚠️ **It began as "two lines in the resolver" and the census killed that.** The intended
rule was `weapon === 'polearm' → 30f`, beside the existing plunge and catalyst-CA rules.
It does not hold:

- **16 of 19** oracled polearm users carry `ICDGroupPoleExtraAttack`…
- …but **Xiao, Raiden and Emilie** sit on `ICDGroupDefault`,
- and **Ayato, who wields a sword**, carries the polearm group.

⚓ The two existing blanket rules are near-universal censuses — plunges 165/166, catalyst
charged attacks all of them. 84% with three named counter-examples is not that, so it went
into the data. ⛔ **Never move it back into the resolver as a weapon branch.**

⚠️ Raiden is a counter-example twice over: inside Musou Isshin her charged attack is tagged
as a NORMAL attack in gcsim, so it shares the normal counter instead of carrying a window.
Unmodelled, and stated here rather than discovered later.

⚠️ **Ayato is deliberately NOT authored.** A sword user carrying a group named for
polearms is prima facie an upstream mislabel, there is no corroborating second source, and
his charged attack is Physical and unavailable in stance — so it is unreachable either way.
⚓ Same posture as `GDB_CD_KNOWN_WRONG`: a single-source oddity is a review candidate, not
data.

**Measured effect** — a probe, because ⚠️ **the oracle cannot see this at all**: no fixture
spams a polearm charged attack, and the baseline is byte-identical (169 / 50 / 3 / 0)
before and after.

| case                                | before | after | gcsim       |
| ----------------------------------- | -----: | ----: | ----------- |
| Hu Tao `E N1 C N1 C N1 C N1 C`      |      2 | **4** | every CA    |
| Cyno stance `C C C`                 |      1 | **3** | every CA    |
| Hu Tao `E 3[N5C]` (CAs >2.5s apart) |      3 |     3 | unchanged ✓ |
| Xiao `E Q N1 C N1 C N1 C` (default) |      1 |     1 | unchanged ✓ |

⚓ The two unchanged rows are the point: it moves only the case it should, and the
counter-example stays on the default.

⚠️ Reachable only while the swing is elemental — bare, a polearm charged attack is
Physical and applies nothing. It is spent by a stance infusion (Hu Tao, Cyno, Flins) or one
granted by a teammate, which is why it is authored on every character gcsim measures rather
than only on the self-infusers.

### ✅ a — the dumper and the audit report the pair (SHIPPED 2026-08-17)

`scripts/gcsim-dump/main.go` emits `(timer, period)` per attack, read from gcsim's own
exported tables; `audit-gcsim-frames.mjs` §5 grows a column beside the existing
applied/total verdict. ⛔ **Numbers, never gcsim's group NAMES** — 58 names is a taxonomy
we would have to maintain and whose entire content is those two numbers. ⚓ In pattern with
L4: the audit REPORTS, a migration writes.

⚠️⚠️ **VERIFIED PREMISE, and it is not the obvious one (2026-08-17).** gcsim's debug log
does **NOT** carry `ICDTag` or `ICDGroup`: `pkg/enemy/attack.go`'s damage event writes
`target` / `attack-tag` / `ele` / `damage` / `crit` / `amp` / `cata` / `abil` /
`source_frame`, and nothing more. ⛔ **So this is not "parse a new log column"** — the
existing capture correlates `damage` and `element` events by `(frame, abil)` and there is
nothing there to read.

⚓ **Subscribe in the SHIM instead.** `main.go` links gcsim as a library, so it can take
`event.OnEnemyDamage` (or `OnEnemyHit`, emitted at `attack.go:32` with `(target, atk)`),
read `atk.Info.ICDTag` / `atk.Info.ICDGroup` off the live `AttackInfo`, and look the pair
up in `attacks.ICDGroupResetTimer[grp]` + `attacks.ICDGroupEleApplicationSequence[grp]` —
both exported `var`s in `pkg/core/attacks/icd_groups.dm.go`. ⚓ **This is exactly what
linking as a library was for (L4); ⛔ do NOT patch the gcsim checkout to log the fields.**
It is a `replace` target, a fork is a maintenance liability, and the shim already owns
every other capture decision.

⚠️ `OnEnemyHit` is gated on `grpMult > 0` at its emit site — check whether that suppresses
any hit we care about before choosing between the two events.

✅ **It does, so `OnEnemyDamage` is what shipped.** `grpMult` is the REACTION-damage group's
multiplier, and eight groups zero it for the later hits of a window (Yelan's Breakthrough,
Cyno's bolts, Ayaka's and Yae's charged groups, Xiao's dash…). Those hits still emit a
`damage` log line, so keying off the gated event would have left holes exactly where a
cadence is most interesting.

⚠️ `OnEnemyDamage` is emitted from a ZERO-DELAY TASK rather than synchronously, so whether
`c.F` at callback time is still the hit's frame was an open question — `Tasks.Run()` drains
re-entrant additions inside the same `Tick`, so it is. ⚓ That is an empirical claim and the
report carries the line that proves it: **hits carrying a measured cadence, 2631 of 2631**.
⛔ Don't delete that line; a broken join would show up as a hit with no cadence, never as an
error.

⚓ **FOUR numbers shipped, not two.** The plan said `(timer, period)`; a third is needed and
a fourth is free. `applies` — how many hits of the window apply at all — is the half the
pair cannot state, because four groups run at a regular period and then **STOP** for the
rest of the window (Arlecchino, Chevreuse, Layla, Charlotte's Kamera). `mult` is the first
application's multiplier, 1 everywhere but Nahida's group. Both are numbers off the same
exported table, so the rule against importing 58 NAMES is untouched.

### ✅ b — `icdGate` generalises (SHIPPED 2026-08-18)

Today `'none' | absent`. It would become `'none' | IcdWindow`, reusing the key rather than
minting one — ⚠️ that name is already unique and already has a consumer, which is the
`orphanedSchema` trap L5e paid for once. Standard stays **absent**; icd.md's rule against
mass-annotating a default is untouched.

Worth **8** oracle applications (Oz), plus the unmeasured series on characters no fixture
reaches.

⚓ **Scope: summon tick SERIES only.** `icdGate` lives on the `summonTick` trigger and that
is where it stays — Oz is a tick series, and widening it to casts is a different question
with §4's counter-sharing sitting underneath it.

⚓ **THE ONE FORK, decided in advance so it is not decided at 3am.** §7 says this moves the
oracle in BOTH directions. If the measured pairs come out net-WORSE on the headline count:
**land it anyway, with the per-fixture evidence, and say so.** The pairs are gcsim's own
measured numbers and standard is a stand-in for them; a scoreboard that prefers the
stand-in is measuring agreement, not correctness. ⚠️ That is the same call the
mark-triggered round made when tier 2 dipped on a one-frame sampling artifact — ⛔ but it
is only legitimate WITH the per-fixture breakdown, never as a bare assertion. If the
breakdown cannot explain the direction, ⛔ stop and write it up instead.

### ⛔ d — counter sharing by tag · **HELD (⚓ Nate 2026-08-17)**

§4. An engine change, not data. Originally priced at **6** (the stele) — ↻ **which was a
misattribution; see §3's correction and §10, where d is CLOSED.** Kept below as written
because the reasoning about the Xiao case is still the reason not to do the naive version.

⛔ **Do not open it in the a+b session.** It is not a task with an unresolved detail; it is
an unresolved DESIGN QUESTION wearing a sub-landing's number. It would re-key the ICD clock
from our per-cast / per-series isolation to `(character, gcsim tag)`, and §4 names the
concrete case where the naive version is WRONG: Xiao's skill sits in a group whose reset
timer is **5 frames**, so sharing across casts deletes his second E's application — the
exact failure the isolation was chosen to prevent.

⏭ **What it is waiting for:** a resolution to the Xiao case, brought to Nate as a DECISION
with its evidence, ⛔ not shipped on a judgement call. Until then the stele's 6 stay
documented as a known divergence, which is what they already are.

---

## 7. Risks, for whoever opens a/b/d

| risk                                                                             | handling                                                                                         |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **It moves the oracle in BOTH directions.** Some series over-apply, some under-. | Watch mean \|Δ\| and the paired-row count, ⛔ never the raw missing count alone.                 |
| **gcsim's reset is `timer − 1`**, ours is `time - timerStart >= timer`.          | One frame. Measure it before assuming it is noise — the Stone Stele's 3-vs-4 is a boundary case. |
| **Importing 58 group names.**                                                    | ⛔ Emit the numbers. The name is not data.                                                       |
| **Adding a gauge multiplier for Nahida's 1.5×.**                                 | ⛔ Already authored as `units: 1.5`. Two sources for one number is the fault, not the fix.       |
| **Mass-annotating the default.**                                                 | icd.md forbids it. Absent means standard, and standard is the measured majority.                 |

---

## 8. The a+b session — run order, gates, and when to stop

⚓ Written for a COLD context. Read §1–§5 first; they hold the numbers, and ⛔ the recorded
baselines are quoted, never recomputed.

1. **a** — instrument the shim (§6a's verified premise), grow the audit column, eyeball
   the report. Behaviour-zero: no product code changes. Commit.
2. **b** — generalise `icdGate`, migrate the measured pairs onto the tick series that need
   them, measure. Commit on the result, whichever way it goes (§6b's fork).
3. ⛔ **Stop.** Do not open **d**.

**Gates per landing:** `npx vitest run` · `npm run check` · `npm run lint` · `npm run build`
(~30 s together). **`test:e2e` before the merge only** — and ⛔ never piped through `tail`;
capture whole and grep for TWO "N passed" lines ([[feedback_gate_cadence]]).

**The measurement** is `node scripts/audit-gcsim-reactions.mjs` — recorded baseline after
the mark-triggered round:

| metric                       | baseline   |
| ---------------------------- | ---------- |
| applications — ours          | 183        |
| **gcsim applies, we do not** | **39**     |
| we apply, gcsim does not     | 7          |
| element mismatch             | 0          |
| tier-2 agreeing              | 136 of 278 |
| mean \|Δ\|                   | 0.170U     |

⚓ **Watch mean |Δ| and the paired-row count, ⛔ never the raw missing count alone** (§7).

⚠️ **This round has no visual surface**, which is what makes it unattended-friendly — but
applications changing DOES move the aura lane's pips, so 👤 **a morning Safari glance is
owed** on a Nahida/Fischl rotation. ⛔ It is not a merge blocker; it is not zero either.

---

## 9. ✅ What a + b actually did (2026-08-17 / 18)

### 9.1 a — behaviour-zero, and the premise held

§6a's verified premise was right and its warning about `OnEnemyHit` was worth taking: see
the ✅ block there. Probe coverage **2631 of 2631** hits. The only thing that moved is
`gcsim-frames-diff.md`, which grew a **gcsim cadence** column in §5 and a **§5b** census.

⚓ **§5b's own count vindicated the schema comment.** `icdGate`'s JSDoc had claimed "13
series are neither standard nor none" from an applied-count inference; measuring the groups
directly gives **exactly 13**. It also confirmed §3's headline first-hand — `ICDGroupFischl`
is 300f / every 4 against our 150f / every 3, on both Ozes.

### 9.2 b — 14 series across 11 characters

`icdGate?: 'none' | IcdWindow`; the translation to clock params is **one** function
(`icdParamsFor` in `icd.ts`), shared with `chargedIcdWindow`'s resolver so the two shapes
cannot drift. Lint **D.27b** guards the window, including the unit trap — ⚠️⚠️ `interval`
two lines up is SECONDS and this is FRAMES, in the same authored object — and refuses a
window that merely restates the standard.

Authored: amber (60f/×3) · chiori (114f/first) · collei (180f/first) · durin White
(90f/first) · emilie SKILL (120f/first) · fischl ×2 (300f/×4) · navia (720f/×3) · ororon
(180f/first) · sigewinne ×3, base + both variants (120f/first) · venti (60f/×3) · yaoyao
(150f/first).

⛔ **Three measured-adjacent series deliberately NOT authored**, each for a stated reason:

- **Emilie's BURST.** ⚠️⚠️ **The pairing trap, and §5b now names it in prose.** Her burst
  shows in §5b at 120f/first — but that is the **Level-1** stream, and gcsim runs the
  **Level-3** phase her authored series models on `ICDGroupDefault`. An id-join would have
  authored a window onto a series that is genuinely standard. ⚓ Pair by the stream OUR
  SERIES MODELS, never by the character.
- **Durin's Dark Decay.** gcsim gives it `ICDGroupDurinBurstBlack` (120f/first) but the
  oracle has no capture of the dark form, and an unmeasured pair is a claim, not data.
- **Furina's Salon Solitaire** (1800f/×2, three series) — same, uncaptured.

⚓ **Five of the 14 measured as `standard` on their fixture and were authored anyway**
(Emilie's skill, Ororon, Sigewinne ×3, Yaoyao). Their GROUPS are not standard; their
EFFECTS coincided at the one cadence the fixture drives. ⚠️⚠️ **That coincidence is how two
curator notes came to assert the wrong thing** — Sigewinne's and Yaoyao's both said
"ICDGroupSigewinne / ICDGroupYaoyaoRadishSkill → standard ICD", and both are now corrected
in place. **An applied count says only THAT the default is wrong, never what is right**, and
before a there was nothing else to read. The audit's disagreement check moved to the RULE
for the same reason.

### 9.3 The measurement, and the fork

`node scripts/audit-gcsim-reactions.mjs`, 12 fixtures:

| metric                          |     before |      after |                           |
| ------------------------------- | ---------: | ---------: | ------------------------- |
| applications — ours             |        183 |        174 |                           |
| **we apply, gcsim does not**    |      **7** |      **2** | ✅ the round's own target |
| gcsim applies, we do not        |         39 |         44 | ⚠️ see below              |
| element mismatch                |          0 |          0 |                           |
| tier-2 agreeing                 | 136 of 278 | 135 of 275 |                           |
| 🟠 aura we have, gcsim does not |         57 |         54 | ✅                        |
| mean \|Δ\|                      |    0.173U¹ |     0.167U | ✅                        |

¹ §8 records 0.170U; the reproduced baseline is 0.173U. gcsim is **non-deterministic** on
the electro-charged and crystallize fixtures (Ningguang's random normal variants), so the
last digit of this row moves run to run. ⚠️ Don't chase it.

⚓ **§7 said watch mean |Δ| and the paired-row count, ⛔ never the raw missing count** — and
this is exactly the split it anticipated. **Over-application, which is what §3 priced the
round on, fell 7 → 2**; mean |Δ| improved; the aura-we-invented count fell. The missing
count rose **because we now apply less**, which mechanically leaves more gcsim rows
unpaired.

**Per fixture, as §6b's fork requires** (⛔ the direction is not assertable without this):

| fixture                                | ours  | extra   | missing |                                                          |
| -------------------------------------- | ----- | ------- | ------- | -------------------------------------------------------- |
| electro-charged (Barbara/Fischl)       | 18→16 | **3→1** | 2→2     | ✅ clean                                                 |
| burning (Collei/Xiangling)             | 21→19 | **2→0** | 3→3     | ✅ clean — Collei's leaps now match gcsim's 2/12 EXACTLY |
| quicken (Nahida/Fischl)                | 12→9  | 1→0     | 5→7     | ⚠️ Oz, below                                             |
| crystallize (Fischl/Ningguang/Zhongli) | 19→18 | 0→0     | 8→10    | ⚠️ Oz, + one gcsim non-determinism                       |
| long rotation                          | 28→27 | 0→0     | 2→3     | ⚠️ Oz, below                                             |
| the other 7                            | —     | —       | —       | unchanged                                                |

⚓⚓ **EVERY new miss is Fischl's Oz, and the cause is §4 — not the window.** Read directly
off gcsim's source while landing this:

```
skill.go:51   Abil "Oz (Summon)"       ICDTagNone          ICDGroupFischl
skill.go:142  Abil "Oz (%v)"  ← BOTH   ICDTagElementalArt  ICDGroupFischl
burst.go:33   "Midnight Phantasmagoria" ICDTagElementalBurst ICDGroupFischl
asc.go:49     "Thundering Retribution (A4)" ICDTagNone      ICDGroupFischl
```

Three findings in four lines:

1. ⚓ **ONE function emits both "Oz (Skill)" and "Oz (Burst)"** — `fmt.Sprintf("Oz (%v)",
src)` — under ONE tag, so in gcsim the recast Oz **inherits the skill Oz's counter**
   mid-window. We key a fresh clock per series. That is why gcsim's Oz applications come
   0.98 s apart in places (two consecutive ticks) where no per-series clock can put them.
   ⛔ **This is d, and it is held.**
2. **The A4 proc is `ICDTagNone`** — ungated in gcsim, and every A4 row in the oracle is a
   proc the game does not make (gcsim's `ActorIndex` defect, recorded by the mark-triggered
   round). ⛔ **The oracle is the wrong target for A4**, so roughly half the new 🔴 rows are
   rows we are right to be missing.
3. **`Oz (Summon)`** — the E cast's own hit — is also `ICDTagNone`, which is why it is
   unaffected.

⚓ **Verdict: landed.** The pairs are gcsim's own measured numbers, the metric the round set
out to move improved, and the counter-metric's every increment is attributable to a
sub-landing that is deliberately not open. ⛔ Do not "fix" the missing count by loosening a
window.

### 9.4 Second-order effects, all in tests

Four unit assertions changed value, and ⚓ **none changed meaning**. All are recorded at
their site with what moved and why.

- **`reactionProcs.test.ts` ×3.** Fewer Oz applications ⇒ fewer aggravates/electro-charges
  ⇒ fewer procs. ⚓ Nahida's Tri-Karma now **agrees with gcsim's first two** (3.2 / 8.28
  against 3.22 / 8.47) where it used to fire four times — the test's own comment had named
  this round as the reason it did not. ⚠️ A proc is a consequence of a reaction, so one of
  these lists changed **twice over**: Barbara's ring tick at 6.05 s procs nothing now
  because the Electro it would have reacted with has decayed.
- **`notationParser.test.ts` — Collei's A4 zone extension went +1s → +3s (the cap).**
  ⚓⚓ **Fewer dendro applications give MORE extensions**, which is the opposite of the
  obvious guess: at the old cadence the dendro gauge was topped up continuously and the
  Pyro was spent inside a single Burning, while now the Pyro survives between leaps and
  re-ignites — three separate `burning` reactions rather than one. ⚠️ Worth knowing that a
  cadence change can move a downstream count UPWARD.

### 9.5 ⚠️⚠️ One trap caught by `npm run build` and by nothing else

D.27b wants the standard's numbers to refuse a redundant annotation, so the first cut
imported `STANDARD_ICD_FRAMES` into `characterLint.ts`. **That breaks `prebuild`:**
`scripts/generate-character-index.mjs` imports the lint under bare Node type-stripping, so
⛔ **`characterLint.ts` must stay free of RUNTIME imports** (type-only imports are stripped
and are fine). The failure is `Cannot find package '$lib'`, and ⚠️ **vitest, `npm run check`
and `npm run lint` were all GREEN across it** — Vite resolves the alias for every one of
them. Only the production build sees it, which is the standing rule about the build being
the real gate, earning its place again.

The constant is therefore a local copy with the reason on it, matching how that file already
handles every vocabulary set. ⚓ Its drift is covered: §5 of the frames report flags an
authored gate that disagrees with the measured group, so a stale copy cannot quietly bless a
wrong annotation.

---

## 10. ⛔ d is CLOSED — and where the remaining 44 actually come from

⚓ **Written 2026-08-18, after b landed, because b produced the evidence that priced d.**
⛔ d is not "held pending the Xiao decision" any more; the Xiao decision is not worth
taking, because the thing it would buy is smaller than §3 believed and is not mostly a
clock-key problem at all.

### 10.1 The whole residue, attributed

All 44 `gcsim applies, we do not` rows in `gcsim-reaction-diff.md`, by cause:

| cause                                                                                                                     |   apps | disposition                         |
| ------------------------------------------------------------------------------------------------------------------------- | -----: | ----------------------------------- |
| **Application-only ticks** — Xingqiu's Orbital 14, Barbara's Melody Loop 2, plus the 4 Tri-Karma procs downstream of them | **20** | ⛔ CLOSED BY DECISION (positional)  |
| **Geo-construct resonance** — the stele × Ningguang's Jade Screen                                                         |      6 | 🆕 unmodelled MECHANIC (§3)         |
| **Oz** — 6 burst ticks + 1 Tri-Karma downstream                                                                           |      7 | geometry + phase, see 10.2          |
| **gcsim's `ActorIndex` defect** — Fischl's A4                                                                             |      5 | ⛔ the ORACLE is wrong, not us      |
| **Burning's own Pyro re-application** — filed under Pyronado by the ordinal pairing                                       |      3 | ⛔ ACCOUNTING, we already do it     |
| **Boundary + RNG** — Kaeya ×2, Ningguang ×1                                                                               |      3 | localized, ⛔ not distributed noise |

⚓⚓ **Not one of the 44 is a rule we believe is wrong.** 20 are a refusal we made on
purpose, 5 are the oracle being wrong, 3 are pure accounting, and the rest is geometry.
⚠️ Read that alongside the two `we apply, gcsim does not` rows and the **0** element
mismatches.

#### ⚠️⚠️ The report pairs by ORDINAL, so ONE unpaired insertion shifts every row after it

Internalise this before reading any fixture table; it produced two of §3's wrong causes.

**Xiangling looked like 3 missing Pyronado ticks and is in fact EXACT.** All 14 of her
applications match gcsim within 1–2 frames. What gcsim has and we do not are three rows
labelled `burning` (ability `19`) at 3.58 / 5.83 / 8.03 s — **Burning's own Pyro
re-application**, which we model too (`gauge.ts`, `BURNING_ICD`: a 2 s reset over
`1,0,0,0,0,0,0,0`) but resolve INSIDE the gauge, so it never enters
`ParsedRotation.applications`. ⚓ Tier 2 settles it — at those three instants our Pyro reads
**0.80/0.78, 0.77/0.75, 0.78/0.78**. Three unpaired insertions pushed our last three
Pyronado ticks off the end of the ordinal join and they were reported 🔴.

⛔ **And gcsim does NOT model a large-hitbox double-hit** (a hypothesis worth ruling out):
`xiangling/burst.go` fires one spin hit per **73 frames**, flat, with an explicit
`// TODO: proper hitbox` on the hit shape. Our authored 1.217 s interval IS that number.

⚠️ The same split inflates tier 2: **11 of the 54 `aura we have and gcsim does not` rows
are `burningFuel`**, a series we track separately and gcsim has no name for. Bookkeeping,
not disagreement.

### 10.1b The three "tail" rows are localized, not distributed noise

⚓ Asked directly (⚓ Nate): do these turn up across all kinds of rotations? **No.** All
three are boundary or RNG cases on named characters, and the other nine fixtures have
zero.

- **Kaeya ×2 — we DROP a boundary tick, by one frame.** Every Glacial Waltz application
  matches within 1 frame; the single 🔴 is the 13th icicle. gcsim: `burstHitmark = 53`,
  `burstDuration = 480`, `Status.Add(burstKey, burstDuration + burstHitmark + 1)` — that
  **`+ 1` is deliberate**, so the icicle at frame 533, exactly 8.000 s after the first,
  still sees a live status. Our summon window is half-open, `[53, 533)`, and 533 is not
  `< 533`. ⚓ **Not Kaeya-specific: 11 series land on that boundary and 4 measurably lose a
  tick** — the full split, and why a bounded `for` loop in gcsim matches us exactly while a
  status-gated chain does not, is in `gauge-round-L5e.md` §4 under "tick count is derived
  from `duration`". ⛔ Not fixable by nudging a duration the kit text states.
  ⚠️ The second Kaeya row — Frostgnaw in the long rotation — is the ordinal-pairing shadow
  of the first, not an independent miss.
- **Ningguang ×1 — gcsim's dice.** Her normals pick randomly among Left / Right / Twirl
  with hitmarks 29 / 19 / 27 and different lockouts, so an `N3` lands on different frames
  every run; the report already flags this fixture non-deterministic (28 / 27 / 28 across
  runs). ⛔ Not modellable in a deterministic planner and not worth trying.

### 10.2 Why d would not collect the 7

⚠️⚠️ **Our two Ozes ALREADY share one ICD clock.** `aura.ts` keys it
`${char.id}:summon:${summon.label}:${series.index}` in a rotation-wide map, and both
authored Ozes are `"Oz"` at index 0 — so the skill's and the burst's tick series draw on one
counter today. ⛔ **The premise that d would fix Oz is false.** Whoever priced it (this
document, §6b) had not checked the key.

What actually differs on the long-rotation fixture is the summon's GEOMETRY: our burst Oz
runs 45.12 → 55.12 while gcsim's spawns later and runs past 56.9, and our E-Oz is truncated
by the recast before it gets the tick gcsim lands at 45.67. Those are spawn-time and
lifetime questions, one per character, and ⛔ no clock re-key touches them.

### 10.3 And the original d is bigger than it was ever priced

Re-keying to `(character, gcsim tag)` needs a **per-ability ICD tag** the corpus does not
have — ~300 authoring sites across skills and bursts — which was never in the estimate. On
top of that sits §4's Xiao case, where the naive version is provably wrong. ⚓ **A ~300-site
fan-out plus an unresolved design question, to collect a share of 7 rows that are mostly
geometry, against a scoreboard where over-application is already down to 2.** That is a no.

⏭ **If any of this is ever reopened, reopen the SPECIFIC thing, not d:** Oz's burst-summon
spawn time and lifetime (7), or the Geo-construct resonance mechanic (6). Both are ordinary
per-character curation with no engine change behind them. ⛔ Don't reopen "counter sharing"
as a programme.
