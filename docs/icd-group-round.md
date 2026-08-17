# The ICD-group round — what a per-ability ICD group would buy

**Status:** 🟡 **PARTLY SHIPPED.** Sub-landing **c** landed 2026-08-17 (the charged-attack
window). **a**, **b** and **d** are SCOPED AND DELIBERATELY NOT STARTED — see §6 for why,
and ⛔ read §5 before opening any of them, because the Nahida/Fischl primitive may change
their shape.
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
| **Zhongli's Stone Stele** |    6 | ⛔ **not group at all** — the stele is `ICDGroupDefault`; it is COUNTER SHARING (§4) |
| **Xiangling's Pyronado**  |    3 | neither — ungated on both sides, so it is geometry or the sim horizon                |

⚓ **So a per-ability group buys 8 in the oracle, not 17.** Quote that number, ⛔ don't
re-derive the 17.

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
the other 54 it does, and the stele is what it looks like when it bites.

⛔ **This is not a data question and must not be folded into the group work.** It asks
whether our clock key should become `(character, gcsim tag)`, which is an engine change
with its own risk: Xiao's skill sits in a group whose reset timer is **5 frames**, so
sharing naively across casts would delete his second E's application — the exact case the
isolation was chosen to protect.

## 5. ⏭ What may reshape all of this

⚓ **Do the Nahida Tri-Karma / Fischl A4 primitive first** (⚓ Nate 2026-08-17). It is 13
oracle applications against this round's 8, and it closes a whole schema CLASS —
mark- and passive-triggered off-field damage — rather than tightening one that exists.

⚠️ And it plausibly changes this round's shape: Tri-Karma is `ICDGroupNahidaSkill`, one of
the 58, and it is the **only** group carrying a 1.5× multiplier. Whatever primitive
carries a mark-triggered hit will need somewhere to put a cadence and a gauge strength, and
that may well be the same field this round would otherwise invent. ⛔ **Don't mint
`icdGate`'s general form until that primitive has picked its shape.**

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

### ⏭ a — the dumper and the audit report the pair

`scripts/gcsim-dump/main.go` emits `(timer, period)` per attack, read from gcsim's own
exported tables; `audit-gcsim-frames.mjs` §5 grows a column beside the existing
applied/total verdict. ⛔ **Numbers, never gcsim's group NAMES** — 58 names is a taxonomy
we would have to maintain and whose entire content is those two numbers. ⚓ In pattern with
L4: the audit REPORTS, a migration writes.

### ⏭ b — `icdGate` generalises

Today `'none' | absent`. It would become `'none' | IcdWindow`, reusing the key rather than
minting one — ⚠️ that name is already unique and already has a consumer, which is the
`orphanedSchema` trap L5e paid for once. Standard stays **absent**; icd.md's rule against
mass-annotating a default is untouched.

Worth **8** oracle applications (Oz), plus the unmeasured series on characters no fixture
reaches.

### ⏭ d — counter sharing by tag

§4. An engine change, not data. Worth **6** (the stele). ⛔ Do not start it without
resolving Xiao's 5-frame group first.

---

## 7. Risks, for whoever opens a/b/d

| risk                                                                             | handling                                                                                         |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **It moves the oracle in BOTH directions.** Some series over-apply, some under-. | Watch mean \|Δ\| and the paired-row count, ⛔ never the raw missing count alone.                 |
| **gcsim's reset is `timer − 1`**, ours is `time - timerStart >= timer`.          | One frame. Measure it before assuming it is noise — the Stone Stele's 3-vs-4 is a boundary case. |
| **Importing 58 group names.**                                                    | ⛔ Emit the numbers. The name is not data.                                                       |
| **Adding a gauge multiplier for Nahida's 1.5×.**                                 | ⛔ Already authored as `units: 1.5`. Two sources for one number is the fault, not the fix.       |
| **Mass-annotating the default.**                                                 | icd.md forbids it. Absent means standard, and standard is the measured majority.                 |
