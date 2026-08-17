# The ICD-group round — what a per-ability ICD group would buy

**Status:** 🟡 **PARTLY SHIPPED.** Sub-landing **c** landed 2026-08-17 (the charged-attack
window).

⏭ **a + b are QUEUED — this is the next session's work** (⚓ Nate 2026-08-17). ⛔ **d is
HELD, deliberately, and is not part of that session** — see §6d for what it is waiting on.

✅ The dependency the old header warned about is RESOLVED: the Nahida/Fischl primitive
shipped and did **not** change a/b/d's shape (§5). ⛔ Don't go looking for it.

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

## 5. ✅ The primitive that was going to reshape this has SHIPPED

⚓ **The Nahida Tri-Karma / Fischl A4 round landed 2026-08-17** (`0719850` → `6a643e2` →
`e26703a`, `docs/mark-triggered-damage-round.md`), and it did NOT mint a general ICD-group
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

### ⏭ a — the dumper and the audit report the pair · **QUEUED**

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

### ⏭ b — `icdGate` generalises · **QUEUED**

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

§4. An engine change, not data. Worth **6** (the stele) — ⚓ **the smallest prize of the
three and the largest blast radius**, which is why it is held rather than queued.

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
