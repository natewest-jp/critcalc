# Varka's two claymores — scope, 2026-09-16

_Scoping only. Nothing here is authored. Written after the T0.5 tranche gave
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
