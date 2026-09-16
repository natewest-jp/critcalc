# The non-hitting casts round — scope (2026-09-16)

_Status: ✅ SHIPPED 2026-09-16 on `feat/nonhitting-casts` — two landings
(`a4612eb1` engine, `27c96a4a` data). The cast-side twin of
`NormalAbility.nonHitting` (`docs/lauma-charged-forms-round.md` §7). The census
in §1 was read from the local gcsim checkout by two agents and re-checked at
every doubtful row. ⚠️ §0–§5 are the plan; **§6 is the record and wins where
they disagree.**_

## 0. The question

`application: []` says a cast APPLIES nothing. It does not say the cast landed
no hit, and the parser treats every cast as a hit: `handleCast` dispatches a
hit record for each one (`run.ts` ~994), and the buff derivation anchors every
`onHit skill|burst` effect on the cast event itself (four sites, all through
`resolveCastContext`). So a Guoba cast fires Xiangling's C1 shred at 0.22s when
the first flame is at 2.10s, and a stance opener like Xiao's burst offers "the
enemy took damage" to every coordinated-attack proc.

The question per cast is therefore not "does it apply" but **does the cast's own
animation land a hit at all** — and for our model, a hit that is the first
member of an authored summon-tick series is the SERIES' hit, not the cast's.

## 1. The census — 40 casts authored `application: []`

Read from gcsim (`~/Code/gcsim`, main; Linnea from branch `linnea`; Kachina from
her PR's own dump, since no branch is local). Verdict = **does the cast land a
hit in OUR model**.

| id                 | cast                  | verdict    | gcsim, and why                                                                                                                                               |
| ------------------ | --------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| aino               | Q                     | NO-HIT     | ticks enumerated in `Burst()` from f133 — our `Cool Your Jets Ducky` series                                                                                  |
| amber              | Q                     | NO-HIT     | three arrow loops from f84 — our `Fiery Rain` series                                                                                                         |
| arataki_itto       | Q                     | NO-HIT     | buff only; damage is the stance normals                                                                                                                      |
| baizhu             | Q                     | NO-HIT     | shield + heal; Spiritvein fires from shield REFRESH (≈f252) — our `Pulsing Clarity` series                                                                   |
| barbara            | Q                     | NO-HIT     | heal only                                                                                                                                                    |
| clorinde           | E (tap)               | NO-HIT     | status only; damage from recasts and Night Vigil normals                                                                                                     |
| cyno               | Q                     | NO-HIT     | buff + stance                                                                                                                                                |
| durin              | E (tap)               | NO-HIT     | opens the 6s window; damage from the two commits                                                                                                             |
| emilie             | Q                     | NO-HIT     | spawns the Lv3 Lumidouce Case at f96; its ticks from ≈f126 — our series                                                                                      |
| furina             | E (Pneuma variant)    | NO-HIT     | the Singer heals only (the Ousia base hits at f18 and stays as authored)                                                                                     |
| gaming             | E                     | NO-HIT     | sets CD only; damage is the follow-up plunge                                                                                                                 |
| ifa                | E (tap)               | NO-HIT     | enters Nightsoul; damage from Tonicshots / the hold plunge                                                                                                   |
| kachina            | E                     | NO-HIT     | PR #2697's dump attributes the cast no hit; slams are the `Turbo Twirly` series                                                                              |
| kaeya              | Q                     | NO-HIT     | icicle ticker from f53 (inside the cast) — our `Glacial Waltz` series                                                                                        |
| kinich             | E                     | NO-HIT     | enters Nightsoul; damage from the Cannon recast and loop shots — ⚠️ see §4                                                                                   |
| kujou_sara         | E (press)             | NO-HIT @C0 | status only at C0; ⚠️ **C2 adds a cast hit** (f103, Electro 25) — see §4                                                                                     |
| kuki_shinobu       | Q                     | NO-HIT     | 7 ticks from f50 enumerated in `Burst()` — our series                                                                                                        |
| lauma              | Q                     | NO-HIT     | Pale Hymn stacks only                                                                                                                                        |
| layla              | Q                     | NO-HIT     | Starlight Slugs from f114 — our `Celestial Dreamsphere` series                                                                                               |
| linnea             | E (tap)               | NO-HIT     | queues Lumi's ticker; first Pound-Pound Pummeler ≈f114                                                                                                       |
| linnea             | Q                     | NO-HIT     | heals; Lumi memo summon                                                                                                                                      |
| mika               | Q                     | NO-HIT     | heal only                                                                                                                                                    |
| mualani            | E                     | NO-HIT     | Nightsoul only; the "Surfing Hit" is an `OnTick` subscription, damage is the Sharky bites                                                                    |
| nahida             | Q                     | NO-HIT     | buff field only                                                                                                                                              |
| sangonomiya_kokomi | E                     | NO-HIT     | f24 is the jellyfish's FIRST tick, queued from the cast — our `Bake-Kurage` series                                                                           |
| sethos             | Q                     | NO-HIT     | buff only                                                                                                                                                    |
| skirk              | E tap, E hold         | NO-HIT     | enters Seven-Phase Flash / absorbs rifts                                                                                                                     |
| skirk              | Q (Havoc: Extinction) | NO-HIT     | the in-stance sibling is the 10-empowered-normals buff; ⚠️ Havoc: Ruin HITS and is authored with its six entries already                                     |
| sucrose            | Q                     | NO-HIT     | wind-field ticks from f137, after the 65f animation — our `Large Wind Spirit` series                                                                         |
| traveler_anemo     | Q                     | NO-HIT     | tornado ticks from f94 — our `Gust Surge` series                                                                                                             |
| traveler_dendro    | Q                     | NO-HIT     | Lea Lotus Lamp gadget ticks on its own                                                                                                                       |
| venti              | Q                     | NO-HIT     | stormeye ticks from f106, after the 95f animation — our `Stormeye` series                                                                                    |
| wriothesley        | E                     | NO-HIT     | status only                                                                                                                                                  |
| xiangling          | E                     | NO-HIT     | Guoba gadget at f13 shoots on its own                                                                                                                        |
| xiao               | Q                     | NO-HIT     | buff + HP drain                                                                                                                                              |
| xingqiu            | Q                     | **HITS**   | the f18 Orbital tick is a real `QueueAttack` (Hydro 25, zero Mult, every 135f) — and the Orbital is unmodelled by ruling, so this cast keeps its hit; see §4 |
| yae_miko           | E                     | NO-HIT     | the Sesshou Sakura gadget ticks on its own                                                                                                                   |
| yaoyao             | E                     | NO-HIT     | the Yuegui gadget throws on its own                                                                                                                          |
| yoimiya            | E                     | NO-HIT     | infusion status only                                                                                                                                         |

**39 of 40 are non-hitting casts in our model.** Xingqiu's is the one whose cast
genuinely queues an attack the model does not otherwise carry.

## 2. Who consumes a cast's hit today

Three consumers, and a non-hitting cast has to be gated at all of them:

1. **The cast-site hit record** (`handleCast` → `dispatchHit`): the `onHit`
   stack dispatchers, `ctx.hitRecords` (which the ARTIFACT `onHit` branch reads
   — Deepwood, Tenacity, Silken Moon), and `notifyDamage`, the coordinated-attack
   proc stream (Xingqiu/Yelan waves, Beidou/Albedo/Dehya/Raiden procs). No
   character in §1 has an `onHit skill|burst` STACK effect, so the stack half is
   inert today.
2. **The cast-anchored `onHit` buff pools** in `buffWindows.ts` — the team
   pool and its resShred twin (~462, ~563), the active-target pool (~1425) and
   the self pool (~1942). Each takes `resolveCastContext(char, castType, cast)`
   and lets an `onHit` effect through on the cast's own filter context. ⚠️ This
   is the consumer that draws Xiangling's C1 from the cast; the summon-tick
   `onHit` pass (2026-08-31) draws the rest from the ticks, so removing the cast
   anchor leaves the tick windows standing.
3. **The provisional application fallback** — a cast with NO `application[]`
   applies its element at the cast. Every row in §1 authors `[]`, so this is a
   lint interaction, not a live consumer (§3).

Character consumers actually reached, from a corpus scan of `onHit` effects of
the cast's type on the same character:

| cast             | effect                              | today                                   | after                                           |
| ---------------- | ----------------------------------- | --------------------------------------- | ----------------------------------------------- |
| xiangling E      | C1 Dendro… Pyro shred, onHit skill  | bar from the cast, 0.22s                | bar from Guoba's first flame, 2.10s (tick pass) |
| emilie Q         | C2 shred, onHit burst               | from the cast, 0s                       | from the case's first tick, ≈2.1s               |
| venti Q          | C6 shreds ×2, onHit burst           | from the cast                           | from the first stormeye tick, 1.77s             |
| traveler_anemo Q | C6 shred, onHit burst               | from the cast                           | from the first tornado tick, 1.57s              |
| yoimiya E        | C1 self buff, onHit any + Pyro crit | at the E cast (she deals no Pyro there) | at her first infused swing                      |
| kinich E         | C2 shred + C6 damage, onHit skill   | at the E cast                           | ⚠️ NOTHING — see §4                             |

Plus every equipped Deepwood/Tenacity, whose "after E or Q hits" today fires on
Itto's, Cyno's and Xiao's bursts and on every stance opener; after, only on casts
and ticks that hit.

## 3. The shape

**Data.** `nonHitting?: true` on `SkillAbility`/`BurstAbility` (the cast-level
claim), and `nonHitting?: boolean` on `AbilityVariant` — a boolean there, not a
`true`, because a variant must be able to RE-ENABLE a hit the base withholds
(Kujou Sara at C2, §4). Resolution is the variant convention: `variant.nonHitting
?? base.nonHitting`. Lint: a `nonHitting` cast must author `application: []`
explicitly (both claims stated, and the fallback applier never has to know the
flag); a variant's `false` needs its own `application[]`.

**Engine.**

- `handleCast`: when the resolved cast is non-hitting, skip `dispatchHit`. That
  removes the record from the stack dispatchers, the artifact `onHit` branch and
  the proc stream in one place. The comment beside `notifyDamage` that says "it
  fires for a cast that deals no damage at all… because nothing in the corpus
  says a cast is damageless" retires.
- `resolveCastContext` returns `nonHitting` alongside the filter context
  (it already resolves the ability and the variant by label), and the four
  buff-pool sites drop an `onHit`-triggered effect when the cast is
  non-hitting — `onCast` effects on the same cast are untouched, which is why
  the gate is on the effect's trigger, not the pool. ⚠️ `resolveCastContext`
  takes the first UNCONDITIONED ability (§1.F's sibling limitation); Skirk's
  in-stance burst sibling is therefore invisible to it today, and its
  `nonHitting` reaches only the hit record until §1.F lands.
- `CastEvent` carries nothing new: the pools resolve from `abilityId` +
  `variantLabel`, as they do for effects.
- Lint arms + `orphanedSchema` consumers by construction.

**Guard.** The synthetic-harness block in `sim/states.test.ts` grows a cast
half: a non-hitting E with an `onHit skill` shred draws no window and offers no
damage to an armed proc; the same E with a hitting variant does both.

## 4. Judgment calls before authoring

- **Kinich E — defer, and say so at the map.** His C2 shred and C6 damage are
  `onHit skill`. Today they fire off the grapple cast, which is wrong; after the
  flag they fire off nothing, because the Scalespiker Cannon does not resolve
  (§1.F, a T0.5 item) and the loop shots are normals of an unreachable sibling.
  "Nothing" is strictly worse than "wrong anchor" for a reader (the Alyosha
  lesson). Author his `nonHitting` in the same commit that retypes the Cannon.
- **Kujou Sara E — the variant boolean's first use.** Base `nonHitting: true`,
  plus a `conditions: {constellation, min: 2}` press variant with
  `nonHitting: false` and `application: [{frame: 103, electro, 1U}]` — gcsim's
  C2 Ambush is a real cast-time hit, so C2+ Sara gains a correct application
  where today she has none. ⚠️ Confirm the variant matcher accepts a
  constellation-only condition on a press input before relying on it.
- **Xingqiu Q — leave hitting.** The f18 Orbital IS a `QueueAttack`, Hydro 25;
  the Orbital's ticks are unmodelled by a standing ruling, so the cast's hit is
  the only place its C2 (`onHit`, any) can anchor. Not a flag candidate.
- **Skirk Q (Extinction) — author**, knowing the buff pools cannot see the
  sibling (§3); the hit record and the proc stream are what it fixes today.
- **The heal/buff-only casts** (Barbara, Mika, Lauma, Nahida, Sethos, Cyno,
  Itto, Xiao, Wriothesley, Yoimiya, Gaming, Clorinde, Durin, Ifa, Mualani,
  Skirk E ×2, Furina-Pneuma) are the clean half: no series, no consumer, and the
  only thing that moves is what an equipped Deepwood/Tenacity or an armed proc
  stops doing at the cast.

## 5. Expected measurement

Engine landing alone: corpus digest byte-identical (no holder). Authoring: the
digest moves for the six characters in §2's table (Xiangling, Emilie, Venti,
Anemo Traveler, Yoimiya, and Kinich only if authored) and for any §1 character
whose rotation partner has an armed damage proc (the digest's Xingqiu partner
means every no-hit cast that used to trigger a rain-sword wave now does not — a
LARGER reach than the buff table, and the right place to read the proc half).
Everything else byte-identical at C0 and C6. Xiangling's C1 bar should read
2.10s → 13.10s where it read 0.22s → 13.10s.

## 6. The record (2026-09-16)

Shipped as §3 described, with two things the spec did not say:

- **`castLandsNoHit` resolves the variant from the cast event's own
  `variantLabel`, never from an input match.** The first cut matched by input,
  as `resolveCastContext` does, and took Kujou Sara's C2 variant at C0 because
  the press token is the same on both — the test caught it. Absent
  `variantLabel` means the base, the reading `findSummonsForBar` already takes.
- **The consumer table in §2 was one short.** Sucrose's A4 (Mollis Favonius)
  is `onHit` on `['skill','burst']` — an ARRAY — and the scan that built §2
  matched a scalar. The digest found it: her Q no longer fires the team EM at
  the cast, and the stormeye ticks still carry it. ⚓ A consumer census over
  `trigger.abilityType` must accept the array form.

**Measured** (corpus digest, 126 characters × C0/C6, each with a swap partner):
the engine landing is byte-identical to main at 252/252; the data landing moves
8 keys across 7 characters, every one a cast-anchored `onHit` window going away
while its tick-anchored twin stays, or a new correct application:

| character          | what moved                                                                           |
| ------------------ | ------------------------------------------------------------------------------------ |
| xiangling @C6      | C1 shred starts at the first Guoba flame, **2.10s**, not the cast (0.22s)            |
| emilie @C6         | C2 shred loses the cast anchor; the case's ticks keep it                             |
| venti @C6          | C6 shreds from the first stormeye tick                                               |
| traveler_anemo @C6 | C6 shred from the first tornado tick                                                 |
| yoimiya @C6        | C1 self buff no longer fires at the E cast; her infused swings still do              |
| sucrose @C0, @C6   | A4 team EM no longer fires at the Q cast (§6 above)                                  |
| kujou_sara @C6     | **+3** Electro applications — the C2 Ambush at each press, where she applied nothing |

No window gained anywhere else, no application lost anywhere. The proc half —
an armed `onHit` damage proc no longer hearing a stance opener — does not show
in the digest (its partners carry no such proc) and is pinned by the unit test.

**Data.** 38 of the 40 casts flagged, each with a one-line provenance note; Kinich
deferred to the Cannon retype (§4); Xingqiu left hitting (§4); Kujou Sara gains
the `C2 Ambush` variant, the variant boolean's first use.

**Guards.** Five cases in `sim/states.test.ts` (the file the Lauma round opened):
cast-anchored shred present/absent, the `onCast` buff surviving, an armed team
proc hearing nothing, the C2 re-enable with its application, the lint arms.
Seeded negatives: the cast-site gate removed fails the proc case; the buff-pool
gate removed fails the shred and variant cases.

**Still open.** Kinich E (with §1.F); the state-gated sibling blind spot in
`resolveCastPair` (Skirk's Extinction is invisible to the buff pools until
§1.F); the editor tint, unchanged.
