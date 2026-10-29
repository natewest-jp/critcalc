# A hit that IS a reaction — the direct-reaction-damage round (PLAN, 2026-09-20)

_Status: **PLANNED, not started, shape NOT settled.** ⚓ Nate, 2026-09-20: "I'd like
to implement this … we might have to discuss the shape of it further, since it can
occur on any kind of attack: E, Q, Normals, etc." Start with §4's discussion, not
with a schema. ⛔ After the multi-hit round (§3 says why)._

## 1. What it is

Newer kits deal hits that are "considered <Reaction> DMG": Lumi's Heavy Overdrive
Hammer and Million Ton Crush (Lunar-Crystallize), Columbina's Gravity Interference,
Flins's and Ineffa's Lunar-Charged strikes, Lauma's Lunar-Bloom, Odette's and the
Cryo Traveler's Stellar hits. Such a hit:

- **applies no element** — ⚓ Nate knows no exception, and gcsim agrees: every
  Durability it states on one is an explicit `0`;
- scales as the REACTION does (level/EM curve, `*ReactionBonus` family), not as
  talent damage — which is why a Lunar-Crystallize DMG bonus reaches Lumi's Heavy
  and an ATK buff does not;
- is, for most of these kits, the hit the kit is built around.

**We do not track it.** No schema field; it lives in kit prose and, by accident, in
`application: []`. A reader cannot tell Lumi's Heavy from her Pound, and nothing
links a `lunarCrystallizeReactionBonus` bar to the hits it buffs.

## 2. Census (2026-09-20)

**gcsim** has five tags — `AttackTagDirectLunarCharged` / `LunarBloom` /
`LunarCrystallize` / `StellarConduct` / `StellarSwirl` — on **14 characters in
`main`** plus Linnea's unmerged PR #2596:

| Source file kind                | Holders                                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------------------ |
| `attack.go` (normals)           | Lauma                                                                                      |
| `charge.go` (charged)           | Columbina, Cryo Traveler                                                                   |
| `skill.go`                      | Columbina (Gravity — all three Lunar kinds), Lauma, Mizuki, Odette, Linnea (Lumi)          |
| `burst.go`                      | Flins, Lauma, Odette, Cryo Traveler                                                        |
| `asc.go` (passives → procs)     | Baizhu, Flins, Heizou, Ifa, Ineffa, Lauma, Odette, Yae Miko, Linnea                        |
| `cons.go`                       | Flins, Ineffa, Lauma, Mizuki, Mona, Nahida, Nilou, Odette, Yae Miko, Cryo Traveler, Linnea |
| `stellar.go` (Witch's passives) | Odette, Yae Miko                                                                           |

⚠️ **The reaction can be CONDITIONAL**: Odette and the Cryo Traveler name BOTH
`StellarConduct` and `StellarSwirl` at the same sites — which one a hit is depends
on the situation. Columbina's Gravity is one attack in three Lunar kinds, picked
by the dominant accrued key (already modelled: `onStack.dominant`).
⚠️ Absent from gcsim and not counted: Zibai (two abilities in our text), Nefer C6,
Cyno's Stellar passive, Sandrone, Lohen, Alyosha.

**Our corpus**: kit text says "considered … Reaction DMG" on **16 hosts across 11
characters** (⚠️ a prose regex — it undercounts; phrasing varies). Of those, 12
have no `damage` effect at all, Lauma C6's are on the retired `manual` trigger,
and **exactly ONE is drawn**: Columbina's Gravity Interference.

**What is already on screen.** The summon lane has a two-mark grammar
(`RotationTimeline.svelte`): `.rp-summon-tick`, a 7px × 1px stub ("the summon
hit"), and `.rp-summon-fire`, full bar height × 2px in the hit's element (a
stack-threshold fire, 2026-09-18). ⚓ The one direct-reaction hit we draw already
wears the heavy mark — arrived at for a different reason ("the accrual paid for a
hit"), but it is the same kind of hit. Nate's "slightly wider tick for Lumi's
Lunar hits" has a register to reuse; the PNG export draws it too
(`timelineExport.ts`).

## 3. Why it waits for the multi-hit round

⚓ **Reaction damage is a property of a HIT, and a hit does not yet have one home
per attack kind.** `docs/rounds/multi-hit-swings-round.md` is what gives it one: a swing's
hits become `FrameMap.lands[]`, a cast's hits are its `application[]` entries
(§6 there), a tick and a proc are one hit each. Designing this field first means
designing it against hosts that are about to change.

And the two rounds meet at one unsolved spot. Multi-hit §6.3 names it from its
side: a cast that HITS at Durability 0 "wants a hitmark with nowhere to live —
`application[]` cannot hold an entry that applies nothing". Every direct-reaction
cast hit is exactly that case. ⚠️ The tension to resolve THERE, once: an empty
`application[]` is today the positive claim "this cast applies nothing" (39
abilities), so an entry that lands and applies nothing either needs `units: 0` to
be legal (and "applies nothing" stops meaning "empty") or the landing list and the
application list have to become two things.

## 4. The shape — open, to discuss

A sketch of the ground, ⛔ not a spec.

**The claim.** `reactionDamage: Reaction` — "this hit is considered <Reaction>
DMG". Implies no application: lint refuses it beside a non-empty application on
the same hit. ⚠️ Conditional holders (Odette, Cryo Traveler) need either the array
form or two gated siblings; decide from their kit text, not from gcsim's tag pair.

**Where a hit lives, per attack kind, and what each needs:**

| Hit kind                       | Home today                            | State                                                                                                      |
| ------------------------------ | ------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Threshold fire                 | `onStack` `damage`, `application: []` | ✅ expressible and drawn (Columbina)                                                                       |
| Summon tick                    | `summonTick` `damage` effect          | needs E1 — a tick with `application: []` (`summon-tick-gaps-round.md` §5)                                  |
| Proc (passive / constellation) | `damage` + `application[]`            | ⛔ NOT expressible: `procs.ts` and lint B.13b define a damage proc as one with a NON-EMPTY `application[]` |
| Cast hit (E / Q)               | `application[]` entry                 | ⛔ no home for a 0U landing — §3's tension                                                                 |
| Swing (N / C / P)              | `NormalHit` / `FrameMap.lands`        | a flag on the hit; per-landing once `lands` is an array                                                    |

**Consumers** (⚠️ `orphanedSchema.test.ts`: no field without one):

1. The mark — heavy where the hit is drawn on a lane (summon lane today).
2. A tooltip naming the reaction.
3. ⏭ Possibly the link from a `*ReactionBonus` buff to the hits it reaches — the
   strongest mechanical reason for the field, and the largest piece.

**Display questions for Nate:**

- A cast's or a swing's reaction hit has no lane mark today (a pill and a block).
  What marks it — an edge, a glyph, nothing but the tooltip?
- A proc from a passive (Ineffa A1, Flins's) has NO lane at all, and by ruling
  puts nothing on the aura lane (Durability 0). Where does it show, if anywhere?
- One heavy mark for both meanings ("a threshold fired" / "a reaction hit"), or
  does the threshold keep its own? Today every threshold `damage` IS a reaction
  hit, so they coincide — but `onStack` also fires shields and buffs.

⚓ **Constitution (2026-09-20):** the mark says a hit is a different KIND — no
element, scales with the reaction — ⛔ never that it is BIG. "Which hits are the
big ones" is a verdict; "which hits are reaction damage" is a mechanic, and the
first is what a player infers from the second.

## 5. Order

1. The multi-hit round (both phases) — gives every hit a home.
2. This round's §4 discussion → schema → the tick and threshold kinds first (they
   are nearly free and they are Lumi's), then procs, then casts and swings.
3. ⚠️ Lumi herself does not wait for this: her Heavy ships as a tick that hits and
   applies nothing (E1), drawn as an ordinary stub, and gains the heavy mark when
   this lands.
