# A buff bound to ONE named summon — plan (2026-09-21)

_Status: **PLANNED, not started.** Scoped out of the judgment pass on 2026-09-21,
where ⚓ Nate answered three accumulated display calls and two of them turned out
to want the same primitive. ⛔ Read §1 before scoping: one of the three calls had
a FALSE PREMISE and must not be implemented as asked._

## 1. ⛔ The call that does NOT survive its own evidence — Skirk / Varka / Zibai

The state-gates round left this for Nate: _"a buff whose gate is the stance its
own cast opened outlives an EARLY stance exit"_, measured on `Skirk E N1 >
Furina …` where the stance ends at 33f and the A4 bar still runs 0–754f. His
answer was **"cut the buffs at the swap, IF that is the behavior in-game."**

⚓⚓ **It is not, and the conditional is what saves us from shipping a
regression.** Checked against gcsim on 2026-09-21:

- **Skirk's A4** (`skirk/asc.go:106-124`) is _Death's Crossing_: a **20s status
  per teammate** who lands a hit in their own Cryo or Hydro element, max 3,
  each independent. `a4Dur = 20 * 60`. There is **no stance in it at all** —
  `a4Init` subscribes to `OnEnemyHit` and never reads a skill status.
- **Varka's A1** (`varka/asc.go:22-52`) is two `modifier.NewBase(…, **-1**)`
  stat mods — **permanent**, magnitude re-derived from his ATK every 60f. Again
  no stance.
- **Zibai** is **absent from gcsim entirely**, so he has no oracle at all.

Our authoring is a STAND-IN in each case: `onCast skill` + `state: inStance` +
a `teamElementCount` tier, with `duration` set to the stance's length. That is a
reasonable way to state the MAGNITUDE, and a poor way to state the WINDOW.

⛔ **So do not build the clamp.** Cutting these bars at the stance exit would
make them shorter than a buff that in game is 20s (Skirk) or permanent (Varka).
The bar is wrong at both ends; clamping fixes the end we can see and worsens the
one we cannot.

⏭ **What to do instead — per character, data only:**

| character | authored now                              | what gcsim says                                    | shape                                                                                                                                                                                    |
| --------- | ----------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Skirk A4  | `onCast skill`, `inStance`, 12.57s        | 20s per qualifying teammate hit, max 3 independent | an `onHit` buff with `source: 'others'` + a `filter` on the hitter's own element — ⚠️ blocked on the queued defect "a character's `onHit` buff cannot anchor on ANOTHER character's hit" |
| Varka A1  | `onCast skill`, `inStance`, stance length | permanent, ATK-scaled                              | `passive` + `scaling atk` + the composition gates it already carries                                                                                                                     |
| Zibai C2  | ditto                                     | no oracle                                          | ⛔ leave; a stub with no source stays a stub                                                                                                                                             |

⚓ Varka's is authorable today and is the cheap half. Skirk's waits on an engine
defect already in the queue, which is an argument for that defect's priority.

## 2. ✅ The call that DOES want a primitive — and there are two holders

### 2.1 Columbina C6 (⚓ Nate asked for a recommendation; this is it)

**Recommend: gate it on the DOMAIN alone.** The current tail is wrong.

gcsim `columbina/cons.go:232-241`: the C6 grant is wrapped in

```go
if !c.ReactBonusModIsActive(burstBuffKey) { return }
```

and `burstBuffKey = "columbina-q-buff"` (`cons.go:28`), applied in `burst.go:93`.
So the 8s CRIT DMG grant fires **only while the burst's react-bonus mod is
live** — the Lunar Domain. The Gravity Ripple is her SKILL and has nothing to do
with it.

Ours is gated `duringSummon`, which is satisfied by **any** live summon of the
holder, so the Ripple (25s) keeps it firing for ~3s after the Domain (20s)
closes. Measured on `Columbina E Q N1 N2 N3 > Fischl E > Xingqiu E Q` at C6: a
C6 window opens at 22.0s, with the Domain already over at 21.9s.

### 2.2 Gorou's DEF bar through Glory

⚓ Nate: cut it at the death of its provider. gcsim agrees, and says something
more precise than "cut it".

`gorou/skill.go:95-128` is a **0.3s re-application loop** that hands the active
character a **2-second** stat mod, and it `return`s — stopping the chain — when

```go
eActive := Status.Duration(generalWarBannerKey) > 0
qActive := Status.Duration(generalGloryKey) > 0
if !eActive && !qActive { return }
```

Three consequences, and the middle one is the trap:

1. The buff's honest end is **the field's end + 2s**, not the field's end — the
   last tick's mod outlives it. ⚓ This is the Bennett/Faruzan rule CLAUDE.md
   already states ("buffs re-applied per tick are authored at their HONEST
   length") and Gorou belongs to that family.
2. ⚠️⚠️ **The buff does not die when the BANNER dies if the GLORY is up.** The
   loop accepts either field. So `Gorou E ~3s Q` must show one continuous buff,
   not a cut and a restart — cutting on the banner's death alone would be a new
   wrong answer. The bar dies only when **both** fields are down.
3. ⚠️ There is a third gate we do not model and should not pretend to: with only
   the banner up, the buff requires the player to be **inside the field area**
   (`IsWithinArea`). Under the burst it is unconditional. That is a position
   fact, so it belongs in a caveat, not in the window.

## 3. The primitive both want

A buff whose life is bound to a **named** summon rather than to a flat duration.

⚓ The state-gates round predicted this exactly (§6.7: _"a label-qualified
`duringSummon` (Columbina's Domain vs Ripple), only if a second holder needs
it"_). Gorou is the second holder.

**The good news:** the machinery already makes the distinction and then throws it
away. `sim/states.ts:100-115` tests the burst summon and the skill summon in two
separate branches and adds the same unlabelled `'duringSummon'` from both.

Sketch, smallest first:

- **A qualifier on the state condition** — `{ type: 'state', state: 'duringSummon',
source?: 'skill' | 'burst' }`, defaulting to "either" so all 30-odd existing
  authors are untouched. Columbina's C6 takes `source: 'burst'`.
- **Both readers must learn it together** — ⚠️⚠️ `sim/states.ts` (live) and
  `src/lib/utils/stateIndex.ts` (finalize). The state-gates round's own record
  is emphatic that a gate implemented in one and not the other produces a
  silent, measurable divergence (the `liveNegatedStates` bug).
- **The SPAN half, for Gorou** — a buff that does not merely _gate_ on a summon
  but _ends with it_. Cheapest honest form: clamp a bound buff's end to
  `max(end of each named window) + duration`, so Gorou's skill buff ends 2s
  after the later of the two fields. ⚠️ Not `min`; not the first window.
- **Lint**: a `source` qualifier is only meaningful on `duringSummon`; a bound
  buff must name a summon its holder actually has.

## 4. Measurement

- Columbina: `Columbina E Q N1 N2 N3 > Fischl E > Xingqiu E Q` at C6 — the C6
  windows opening after the Domain's end must vanish, and **nothing else may
  move**.
- Gorou: `Gorou E ~3s Q ~10s N1 N2 N3` — one continuous DEF bar ending 2s after
  General's Glory, not two bars and not a bar ending at the banner's death; plus
  `Gorou E ~12s N1 N2 N3` (no burst) where it must end at banner + 2s.
- Corpus: the buff digest and the summon-aware digest. ⚓ A `source`-less
  `duringSummon` must be byte-identical for every existing author.

## 5. ⏭ Also queued from the same pass

- **Varka A1 → `passive`** (§1) — data only, authorable today.
- **Skirk A4 → an `onHit` buff on a teammate's hit** (§1) — blocked on the
  queued engine defect of the same shape.
- ⚠️ Gorou's in-field position gate (§2.2, point 3) wants a caveat sentence
  whichever way the primitive lands.

---

## 6. ✅ THE RECORD (2026-09-21) — this section WINS over §1–§5

Shipped: **one primitive, two data fixes, and one of the two holders turned out
not to want the primitive at all.**

### 6.1 The primitive — `duringSummon` may name its opener

`{ type: 'state', state: 'duringSummon', source?: 'skill' | 'burst' }`.

⚓⚓ **The resolvers publish a qualified member of the SAME `Set<string>`, not a
second field.** A live summon adds `duringSummon` and `duringSummon:burst`
together; a `source`-less gate asks for the bare name and is untouched, which is
why all thirty-odd existing authors are byte-identical and none had to be
edited. `stateKey()` in `$lib/types/ability` is the one spelling — ⛔ never
hand-write the `${state}:${source}` string, four call sites across three files
have to agree on it and a typo resolves as `null` forever.

⚠️⚠️ **Both readers learned it in the same commit**, as §3 demanded:

- `sim/states.ts` — `inferredStates` (the two branches already knew their kind
  and were throwing it away) and `holderStatesAt`. ⚠️ The latter's scan **no
  longer breaks at the first live summon**: a holder with two has to publish
  both qualified names, so the exit waits until both kinds are known. Still at
  most two matches, and a one-summon holder leaves by the same cheap route.
- `utils/stateIndex.ts` — `trackedStatesOf` collects the qualified name on the
  gated side and, on the openable side, attributes a summon to the enclosing
  ability's class (⚠️ carried down the walk as a parameter, so a summon declared
  on a VARIANT is still attributed to the skill or burst that holds it — an
  un-openable key is dropped from `tracked` and the gate would answer `null`);
  `buildStateIndex` pushes each summon window into TWO span lists, narrowed by
  `TimelineWindow.source`, which the window has always carried.
- ⚠️ `liveNegatedStates`' `duringSummon` exemption is a `startsWith` now. Naming
  the summon's kind does not repair either live resolver's disagreement about
  what `duringSummon` means, so the qualified members stay un-negated too.

**Lint C.20** (`state-source-scope`, strict): a `source` is meaningful only on
`duringSummon`; it must be a cast kind; and it must name a kind that character
actually summons — a qualifier pointing at nothing is the same silence from the
other side, since `trackedStatesOf` then drops the key.

**Guard**: `sim/states.test.ts`, a third block, six cases on a synthetic
two-summon holder (a 5s skill summon, a 15s burst one, three `onHit` buffs that
differ only in how they gate). Seeded negatives verified by hand: removing
either reader's qualified add fails the four behavioural cases and leaves the
lint case green.

### 6.2 Columbina C6 — the recommendation of §2.1, taken

`source: 'burst'` on all four gates. The evidence is §2.1's and it stands.

⚠️ **The measurement §4 proposed is the WEAKER of the two.** On
`Columbina E Q N1 N2 N3 > Fischl E > Xingqiu E Q` at C6 every Lunar reaction
already falls inside the Domain (114–1314f), so that rotation is byte-identical
before and after — it proves nothing. The rotation that shows the defect is the
one with **no burst in it at all**: `Columbina E N1 N2 N3 > Fischl E >
Xingqiu E Q` drew **eleven** +80% CRIT DMG windows off the Gravity Ripple alone,
and now draws zero. ⚓ A gate that is wrong because it is too broad is measured
by removing the thing it should have been naming, not by a rotation that
contains it.

### 6.3 ⛔ Gorou did NOT want the primitive — he wanted the house rule

§3 scoped a "SPAN half" for him. It was not built, and the reason is §2.2's own
point 1 followed to its end: **the buff's honest end is the field's end + 2s**,
and at that length there is nothing left to bind.

Authored: the skill's three buffs **10s → 12s**, the burst's three **9s → 11s**
— the Bennett (12s field / 14.1s buff) and Faruzan form CLAUDE.md already
states. Measured against gcsim's chain (`skill.go:95-128`, a 0.3s loop handing
the active character a 2s mod, returning only when BOTH fields are down):

| rotation        | banner / glory      | our buff bars              | gcsim's chain ends |
| --------------- | ------------------- | -------------------------- | ------------------ |
| `Gorou E ~12s`  | banner 34–634       | 34–**754**                 | 754                |
| `Gorou E ~3s Q` | banner 34–226 (cut) | 34–**754** and 257–**917** | 917                |

⚓⚓ **And the union is why binding would buy nothing.** §2.2's trap — the buff
does not die with the banner while the Glory is up — is avoided by the lengths
themselves: the two bars cover 34–917 with no gap, and neither claims an instant
at which the buff is actually down (the banner can only die early by being
replaced by the Glory, which keeps the chain alive). A span-bound primitive
would re-attribute the 257–754 overlap from the E to the Q and change nothing a
reader can act on. ⛔ It is not a primitive worth minting for zero holders.

⚠️ §2.2 point 3 landed as caveats, one per ability:

- skill: the in-field position gate — with only the banner out the buff reaches
  whoever is standing inside it, and the bar follows the active character
  regardless.
- burst: rewritten. Its old first clause ("the War Banner's DEF bar keeps
  drawing through General's Glory") is no longer a defect — that bar is now
  correct — so only the live half survives: **an E cast while the Glory is up
  still draws a banner**, where the game creates none.

### 6.4 Measurement

- Buff digest (252): **2 moved**, `gorou@C0` and `gorou@C6`, both only buff ends
  — plus two extra windows each, which are `target: 'active'` per-receiver
  slices reaching one segment further because the buff is 2s longer. Nothing
  else in the corpus moved, which is the `source`-less-is-byte-identical claim.
- Summon-aware digest (630): **5 moved**, Gorou at C0/C1/C2/C4/C6, buff ends
  only — no summon, tick or application movement.
- `characterIndex.generated.ts` unchanged, so the Team Builder's derived
  capabilities are untouched by the qualifier.

### 6.5 ⏭ Still open, and one CORRECTION to §1

⚠️⚠️ **§1's Varka row describes work that was already done, and misses the bar
Nate was actually looking at.** §1 reads `varka/asc.go:22-52` — the two
`NewBase(…, -1)` stat mods, i.e. the ATK-scaled Anemo + conversion-element DMG
bonus — and prescribes `passive` + `scaling atk`. **That is what the corpus has
carried since 2026-09-16** (T0.5; the A1 passive's own curator note records the
`manual` → `passive` retrigger). Nothing was owed there and nothing was changed.

The bar gated on `inStance` is the A1 **multiplier** (140% / 220%), authored
2026-09-19 on Windbound Execution — two days before the judgment pass, and not
examined by §1. Its gate is `a1Multiplier`, applied at `skill.go:150`,
`charge.go:124`, `charge.go:180` and `attack.go:146` — **every one an in-stance
action**, matching the talent's own "while in the **Sturm und Drang** mode". So
unlike the stat half, this one IS stance-scoped, and §1's "again no stance"
does not cover it.

What is wrong is only its **fixed `duration: 12`**, a stand-in for the stance's
real length. Measured 2026-09-21 in a 2-Cryo party:

| rotation                                        | stance | A1 multiplier bar |
| ----------------------------------------------- | ------ | ----------------- |
| `Varka E N1 N2 > Kaeya N1 N2 N3 > Rosaria N1`   | 0–159  | 0–**720**         |
| `Varka E N1 N2 Q N1 N2 > Kaeya N1 > Rosaria N1` | 0–406  | 0–**720**         |

Both diverge because the stance is `terminatesOnSwap: true` and the bar is not;
the curator note already records the other edge (the burst's +2.3s extension,
which the bar also does not follow).

⚓ **So Nate's original call — "cut the buffs at the swap, if that is the
behavior in-game" — is CORRECT for this effect**, and §1's ⛔ does not apply to
it: §1 refused a clamp because the thing it examined is permanent in gcsim, and
this thing is not. ⛔ It was still not built here, because the fix is a
STATE-bound buff end (a third shape beside the summon qualifier and the honest
length) and that is a round, not a line. ⏭ Nate's call.

⛔ **§1's Skirk and Zibai rows stand unchanged** — Skirk's A4 really is a 20s
per-teammate-hit status with no stance in it, and Zibai has no oracle.
