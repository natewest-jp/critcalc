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
