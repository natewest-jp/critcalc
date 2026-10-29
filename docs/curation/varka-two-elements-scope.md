# Varka's two claymores — scope and record, 2026-09-16

_⚠️ §0–§5 are the SCOPE, written before any of it was built; **§7 is the
record** and wins where they disagree. §6's three questions are answered._

_Original preamble: scoping only, nothing here is authored. Written after the T0.5 tranche gave
Varka an in-stance Anemo normal and asked, in its own notes, what the other
half would cost._

## 0. What the game actually says

The genshin-db description in `varka.json` is a summary. The Fandom Talent
Infobox for **Windbound Execution** (fetched verbatim 2026-09-16) is not, and it
settles every question this scope turns on:

> While in this mode … When Varka executes Normal or Charged Attacks, his
> dual-wielded claymores will deal corresponding Elemental DMG based on the
> Elemental Types of the characters in the party **respectively**:
>
> - DMG dealt by the claymore wielded in his **left hand** will be converted to
>   **Anemo DMG** that cannot be overridden by other infusions.
> - When there are Pyro, Hydro, Electro or Cryo characters in the party, the
>   claymore wielded in his **right hand** deals corresponding Elemental DMG
>   that cannot be overridden by infusions, following the aforementioned
>   priority order of Elemental Types.

So it is **two hands, two elements, every swing** — not one infusion. The same
page gives Four Winds' Ascension "AoE Elemental DMG … corresponding to the
element of the claymore wielded in Varka's right hand, **and** AoE Anemo DMG",
and Azure Devour "2 instances of Elemental DMG corresponding to the right
hand … **and** 2 instances of Anemo DMG".

⚓⚓ **And it resolves the question the T0.5 tranche left open.** Four Winds
"**Starts on cooldown** and has 2 maximum uses." gcsim's stance-entry block —
which consumes every ready charge and starts an 11s clock on each — is
therefore CORRECT, and the T0.5 note's reading ("cannot be reconciled with the
kit text by reading alone") was the incomplete one. The loop is closed by the
CD reduction: 0.5s per in-stance Normal that hits, 1.0s with 2+ Hexerei, up to
15 times per stance.

## 1. What we model today, and what it costs

⚓ **Varka self-enables his own Swirl, and today he cannot.** The right hand
applies the aura and the left hand swirls it, from the same swing — which is
why his A4 (Azure Fang's Oath), C4 and C6 are all Swirl-keyed with no enabler
requirement beyond "have a Pyro/Hydro/Electro/Cryo teammate". We author only
the Anemo half, so he can swirl an aura **someone else** applied and nothing
else.

Measured (`Varka E N5 C N5 C`, in stance):

| model                         | applications | reactions |
| ----------------------------- | ------------ | --------- |
| today, solo                   | 6 anemo      | **0**     |
| today, with Xiangling         | 6 anemo      | 4 swirl   |
| conversion half alone (probe) | 6 pyro       | 0         |
| both, on their own counters   | ~12          | ~6 swirl  |

⚠️⚠️ **The swirl is ORDER-SENSITIVE within a frame, and this is the load-bearing
fact of the whole design.** Measured directly against the gauge:

```
pyro then anemo, SAME instant  → swirl
anemo then pyro, SAME instant  → NO reaction
pyro, then anemo one frame later → swirl
```

Anemo landing first hits an empty target and dissipates. So a co-element
implementation **must feed the conversion element first**, and that is a
contract, not a detail.

⚠️ gcsim's real per-swing order alternates (N1 is conversion ONLY, one hit;
N2/N3 are Anemo-first; N4/N5 conversion-first), so in game an N2's Anemo swirls
the aura the PREVIOUS swing's right hand left. Our one-hit-per-swing model
cannot express within-swing ordering; conversion-first at the same frame gives
the same swirl COUNT, one swing earlier in phase. That is the approximation to
state, and it is a smaller one than the status quo.

⚠️ Both halves sit on `ICDGroupDefault` (150f, `{1,0,0}`) on SEPARATE tags
(`ICDTagVarkaNormalAttackElem` / `…Wind`, and the Extra pair for the charged
attack). Two clocks started on the same swing stay in phase, so both halves
apply on the same 1-in-3 swings — which is what makes the self-swirl land
rather than alternate.

## 2. Four sites, one defect

| site                   | authored today                      | truth                                                            |
| ---------------------- | ----------------------------------- | ---------------------------------------------------------------- |
| in-stance normals + CA | `infusion: 'anemo'` (T0.5)          | right hand = conversion element, left = Anemo, two counters      |
| Four Winds' Ascension  | `application: [{43, anemo}]` (T0.5) | `fourWindsHitmark = [34, 43]`, conversion at 34 and Anemo at 43  |
| **the burst**          | `[{112, anemo}, {131, anemo}]`      | `burstHitmark = [112, 131]`, **hit 0 is the conversion element** |
| Azure Devour           | unmodelled                          | 2 conversion + 2 Anemo instances                                 |

🐛 **The burst is wrong today in three ways at once** and this scope found it:
its first hit's element is the conversion element (Anemo only as the fallback
when the party has no PHEC character — the normals have **no** such fallback
and keep the right hand Physical); both hits are `ICDTagNone` and must apply;
and measured, our per-cast standard counter suppresses the second entry
outright — `Varka Q` yields **one** application where the game lands two.

## 3. The primitives, sized

**P1 — a team-derived Element value.** `{ type: 'teamElementPriority', order:
['pyro','hydro','electro','cryo'] }`, resolving at parse time off the team
roster (the same `ctx.team` context `teamElementCount` already reads), to an
Element or nothing. Readable wherever an element is named: `infusion`,
`application[].element`, and P2 below.

⚓ The alternative — four condition-gated sibling abilities per site, on the
`not`-nested priority ladder — needs **no new primitive at all** and became
viable when T0.5 gave `resolveActiveAbility` its condition context. It costs
~17 ability entries for one character (5 normals × 4 Four Winds × 4 bursts × 4
Azure Devours), every one of which has to be re-edited whenever a frame or a
talent value moves. **P1 is the recommendation**; the ladder is the fallback if
a one-holder primitive is not wanted.

**P2 — a co-element on a normal ability.** `NormalAbility.coInfusion`, the
positive claim that every swing of this ability lands a SECOND application of
another element on its own ICD counter. Touches: `emitReactionsAtSwing` (a
second offer, conversion-first, keyed `${char.id}:${tag}:co`), the action
event's element (one field today), and `InputBlock.element` (one field today).
⚠️ This is a genuinely new primitive with **exactly one holder** — a gcsim
census of the `ele := []attributes.Element{…}` idiom returns Varka's four files
and nothing else.

**P3 — the per-cast ICD escape.** Already a queued engine round (§1.A of the
essential-characters backlog): a cast's `application[]` runs on the standard
counter with no per-cast override, which is exactly why the burst's second
entry vanishes. Needed for the burst, Four Winds and Azure Devour; **not**
needed for the normals.

## 4. Authorable today, with no engine work at all

- **A1's conversion-element half.** The passive gives its ATK-scaled DMG bonus
  to Anemo **and** the conversion element; only `anemoDmgBonus` is authored.
  Four more effects on the priority ladder (`pyroDmgBonus` gated on
  `teamElementCount(pyro) >= 1`, `hydroDmgBonus` on `all[pyro == 0, hydro >= 1]`,
  and so on) express it exactly. ⚓ Safe from the §1.H stat-dedupe trap because
  the four are DIFFERENT stats.
- **The burst's `application[]`**, partially: the frames are right and only the
  element is wrong, so the ladder (or P1) fixes hit 0 without P3 — though the
  second entry stays suppressed until P3 lands.

## 5. The rest of the kit, and why each is out

- **Four Winds' charges.** `charges: 2` is authorable, but our charge queue
  initialises every charge READY (`new Array(n).fill(0)`), and the kit says
  "starts on cooldown". Authoring 2 today hands a player two free uses. Needs a
  `startsOnCooldown` flag — small, and it has a second holder in any future
  "charges begin recharging on entry" kit.
- **The per-hit CD reduction** (0.5s / 1.0s Hexerei, max 15 per stance).
  ⚠️⚠️ `cooldownReduce` is declared in the schema and has **no consumer
  anywhere** — its only occurrences in `src` are its own type declaration and
  one doc cross-reference, and the two characters that author it (Raiden,
  Beidou) are inert. ⛔ `orphanedSchema.test.ts` cannot see it, because it
  matches property ACCESS and this is a `type` VALUE. Wiring it is its own
  round, plus a per-stance proc cap.
- **Azure Devour** — a charged attack that SPENDS a Four Winds use. No shape:
  a CA cannot consume a skill charge.
- **A1's 140%/220% multiplier and C2's 800% strike** — damage magnitude, out by
  the tool constitution.

## 6. For Nate

1. **Does the co-element earn a primitive for one holder?** P2 is one field and
   about three touch points, against ~17 duplicated ability entries. My read is
   yes, but it is a one-holder schema addition and that is your bar.
2. **Which hand tints the block?** A swing lands two elements and
   `InputBlock.element` is one field. The aura lane already has a story — the
   `sameFrame` disclosure from the Polestar round fires on exactly-coincident
   pills — but the input strip does not. Options: tint by the conversion
   element (what reacts), tint Anemo (what he is), or split the block.
3. **Is the burst worth fixing ahead of the rest?** Its first hit's element is a
   one-line correction once the conversion element is expressible, and it is
   wrong in every Varka team today.

---

## 7. The record (2026-09-16, branch `curation/varka-two-elements`)

⚓ **Nate's three answers** (§6): a one-holder primitive is fine, "especially
since Varka is a newer, meta-relevant character"; the **infused PHEC hand tints
the input blocks**; and the burst goes in wherever it fits.

### What shipped

**`a0888cd9` — the two primitives, measured byte-identical corpus-wide**
(252 digests, 0 moved, the digest now recording input-block elements too).

- `ElementRef` — a field naming an element may name a literal or a
  `teamElementPriority`, resolved at parse time off the same
  `teamElementCounts` map the Conditions read. Live at `NormalAbility.infusion`,
  `ElementalApplication.element` and `coInfusion`.
- `NormalAbility.coInfusion` — the second claymore, on its own ICD counter
  (`${char}:${tag}:co`), offered AFTER the primary at the same instant.

⚠️⚠️ The ordering is the mechanic and it is now a documented contract at three
sites. The plunge path is wired with **no holder and no possible one** — Varka
is refused plunges in the stance that gives him two hands — so that the rule is
one rule. Lint C.19b refuses `coInfusion` without `infusion`.

**`594ac42e` — Varka's four sites.** The in-stance normal (right hand infuses,
left is Anemo), Four Winds, the burst, and A1's conversion-element half as a
four-rung ladder in `conditions` (⚓ a ladder and not a ref, because what varies
there is the STAT KEY and no element expression reaches one).

Measured `Xiangling E > Varka E N5 C N5 C`: applications **11 → 17**, swirls
**4 → 6**, every one his own and paired right-then-left at one instant. ⚓ And
it works with a teammate who applies nothing off-field: Xingqiu, Fischl and
Kaeya teams each draw his A4 stacks where only Xiangling's Guoba could feed him
before. Solo, the right hand stays Physical and he applies Anemo alone.

### Gates

vitest 1861/1861, check, lint, build, and **e2e 73 + 73 green cross-engine** on
`2df2924c` (⚠️ the Chrome run also printed six of the known upstream
"worker did not exit" teardown lines — two "N passed" lines are the gate, not
the exit code). Corpus digest against the pre-primitive baseline: 252 digests,
**2 moved**, both Varka — and the digest records input-block elements now, so
the `sC`/`sE` blocks and the PHEC tint are inside what it compares.

### Two corrections this round makes to older notes

🐛 **`CastAbility.noICD` IS read, and both CLAUDE.md and Fischl's curator note
say it is not.** The ICD round's line — "only `NormalAbility.noICD` is read
(Mualani alone); the skill/burst holders stay inert for a stated reason" —
describes the SWING path and was never true of the cast path: `run.ts`'s own
comment at the `emitReactionsAtCast` call names itself as its first reader, and
eight characters already depend on it (cyno, fischl ×2, ganyu, kinich, lan_yan
×2, xingqiu). Verified by probe before relying on it.

↻ **T0.5's "⚓ ANEMO is the half we take" is superseded** — that was the right
call with one element per ability, and the note is replaced rather than left to
be found.

### `sE` and `sC` — KQM's stance-special tokens

⚓ Nate, reading KQM's Varka guide 2026-09-16: they write the two stance
specials as **`sC`** and **`sE`** (`E N2 sC`, `E N2 sE`), the siblings of the
`sQ` the tokenizer has carried since the post-P4 transient-state primitive.
Both are wired.

- **`sE`** classifies as an ordinary E — which ABILITY it lands on is still
  `resolveActiveAbility` reading the state and the party, never the token. Four
  Winds lists `['sE', 'E']` and ⚠️ **both spellings on purpose**: in game the
  stance REPLACES Windbound Execution, so a plain `E` in Sturm und Drang really
  is Four Winds, which is not Flins's case (his base Q stays castable behind
  `sQ`). What listing `sE` buys is the eager index's `casts` — ⚠️ and that meant
  widening `CAST_TOKEN_RE`, or the editor would have linted the token we are
  telling people to type.
- **`sC`** reads the new **`NormalAbility.specialChargeFrames`**. ⚓ FRAMES
  ONLY, and that is the whole shape: Azure Devour's four hits are
  `[conv, Anemo, conv, Anemo]` on the same `ICDTagVarkaExtraAttack` pair the
  ordinary in-stance charged attack uses, so both claymores already come from
  `infusion`/`coInfusion` and the animation is the only thing that differs.
  ⚠️ It falls back to `chargeFrames` where an ability authors none — the
  out-of-window `sQ` rule, so `Diluc sC` is his ordinary charge rather than an
  unknown token.

Measured: `Xiangling E > Varka E N2 sC` → 64f (Azure Devour), `… sE` → 68f
(Four Winds), `… C` → 60f (the ordinary in-stance charge); out of stance both
fall back; `N2sC` splits correctly concatenated; and the corpus is byte-identical
apart from Varka. ↻ Azure Devour SPENDS its Four Winds use since 2026-09-18
(`docs/rounds/varka-azure-devour-round.md`).

### ⚠️⚠️ What is left, and why it is a PAIR rather than two edits

↻ **SHIPPED TOGETHER 2026-09-18** — the cooldown-reduction round
(`docs/rounds/cooldown-reduction-round.md` §4): `charges: 2` (+1 at C1),
`startsOnCooldown`, and Secret Rite as two `cooldownReduce` effects capped 15
per stance; charges recharge one at a time now, which is what makes the second
use honest. Measured `Xiangling E > Varka E N2 sE`: Four Winds at 685f. ↻ And
**Azure Devour's cost shipped the same day** (`docs/rounds/varka-azure-devour-round.md`),
which also found that round's C1 (`+1` charge) wrong — it is a use handed back
at entry, not a third charge on cooldown.

**Four Winds' charges and its cooldown reduction cannot be landed
separately, and landing the first alone would make the tool WORSE.**

- The kit says "**Starts on cooldown** and has 2 maximum uses", which vindicates
  gcsim's stance-entry block and retires the T0.5 note's doubt. Our charge queue
  initialises every charge READY (`new Array(n).fill(0)`), so expressing it needs
  a `startsOnCooldown` flag.
- But the loop only closes because each in-stance Normal that HITS cuts the
  11s cooldown by 0.5s (1.0s with 2+ Hexerei), up to 15 times per stance.
- Today the tool says Four Winds is ready at t = 0 — too generous. With
  `startsOnCooldown` and no reduction it would say 11s into a 12s stance — too
  stingy, and further from a real rotation than the status quo. ⛔ So neither
  ships alone.

The reduction is its own round: `cooldownReduce` is declared in the schema with
**no consumer anywhere in `src`** (its only occurrences are its own type
declaration and one doc cross-reference; Raiden and Beidou author it inert, and
`orphanedSchema.test.ts` cannot see it because it matches property ACCESS and
this is a `type` VALUE). Wiring it means a new dispatcher on the hit stream that
shifts a queued charge earlier, plus a per-stance proc cap, which is the
`maxProcs` gap several other characters are waiting on.

⛔ Also still out, each for its own reason: ~~**Azure Devour**~~ (↻ shipped
2026-09-18); **A1's 140%/220% multiplier** and
**C2's 800% strike** (damage magnitude, out by the tool constitution);
**within-swing hand ordering** and **N1's single hit** (a per-hit element model,
not worth it for one swing in five).
