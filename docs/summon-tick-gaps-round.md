# Summon tick gaps — Linnea, Faruzan, and the rest of the class

**Status: IN PROGRESS (2026-09-20). ⚓ Nate's calls are in §6; Faruzan F1 is built (§2), the rest is not.**

The question: now that hits and auras are simulated, a summon with no tick series
contributes nothing to the gauge, the hit stream or the reaction markers — it is a
bar and nothing else. Which summons are like that, and what would it take?

## 0. The census

105 authored summons; **42 carry no `damage` tick series**. Most of those are fine:

- **Damage carried another way** — a cast `application[]` schedule (Ganyu Q ×13,
  Klee Q ×25, Ayato Q ×10, Shenhe Q ×12, Kirara, Charlotte, Qiqi, Mona, Lyney,
  Eula, Diluc, Amber, Wake of Earth) or a proc (Albedo, Dehya, Raiden, Thoma,
  Xingqiu, Yelan).
- **Genuinely deals none** — Nahida's Shrine, Columbina's Lunar Domain (gcsim:
  a 0.8s buff re-check, no attack), Chongyun's field, Gorou's Banner, Iansan's
  Scale, Ningguang's Screen, Tighnari's field, Itto's Ushi, the Geo Traveler's
  Meteorite, Bennett / Jean / Xilonen / Furina's Singer (heal series only).

**Six are real gaps**, read against gcsim source: Linnea, Faruzan, Nilou, Jahoda,
Candace, Xianyun. ⚠️ Depth of the triage: those six plus Columbina were read in
gcsim; the rest were cleared on their authored `application[]` / proc / kit text,
not re-read.

⚠️ `audit-gcsim-frames.mjs` §5 **cannot see this class**: it cross-checks series we
HAVE against gcsim, so a summon with no series produces no row.

## 1. Linnea — Lumi

### 1.1 ⚠️ The source moved under us (the Iansan hazard, again)

Linnea is not in gcsim `main`; she was authored from PR #2596 (open, not a draft,
CONFLICTING). Our numbers are its April head (`1799e3953`). The head is now
`fe5e835a5` (2026-09-10, "Implement frames for Linnea counted by caramielle") and
nearly every number moved:

|                                    | April head (what we cite)     | September head               | Fandom Gameplay Notes      |
| ---------------------------------- | ----------------------------- | ---------------------------- | -------------------------- |
| Super Power, no Moondrift          | Pound every **111f**          | Pound every **62f**          | "every ~2 seconds"         |
| Super Power, Moondrifts            | P →111→ H →63→ P →144→ (318f) | P →62→ P →122→ H →90→ (274f) | Pound ~2s, Heavy ~5s       |
| Standard Power                     | Pound every **340f**          | every **120f**               | "every ~5 seconds"         |
| First attack after E               | 114f from cast                | 36 + 122 = **158f**          | —                          |
| First attack after Q (Lumi absent) | 92 + 78 = 170f                | **214f**                     | —                          |
| Pound's second hit                 | +16f                          | **+21f**                     | —                          |
| Burst heal ticks                   | 5 × **120f**                  | 5 × **60f**                  | "Healing Duration **12s**" |
| E / Q cancel frames                | 33/20…, 110/109/108           | 14/33/44/20/15…, 110/96/97   | —                          |

The wiki agrees with **April** on Standard (~5s), on the heal (12s needs 120f
ticks; 60f gives 6.6s) and on the bare Pound (~2s); both heads agree with it on
the Moondrift cycle (~5s per Heavy). ⚠️ The September no-Moondrift 62f may be an
artefact rather than a count — `advanceSkillIndex` resets the index to 0 and the
loop then re-reads `skillSuperInterval[0]`, which in the new ordering is the
P→P gap INSIDE the cycle. ⛔ Don't author the cadence from either head until this
is settled (§6.1). ⚠️ Linnea's authored FrameMaps are April's too.

Stable across all three sources, and enough to design on:

- **Pound-Pound Pummeler**: two hits, Geo **1U** each, ICD tag Elemental Skill,
  standard group (2.5s / 3 hits), one shared counter.
- **Heavy Overdrive Hammer** and **Million Ton Crush**: Lunar-Crystallize
  reaction damage, **0U**, no ICD tag — they HIT and apply nothing.
- Heavy appears only while a Moondrift stands (wiki: immediately when one
  appears; first attack if one already stands at the summon).
- Q summons Lumi in Super Power if she is absent; E or Q while she is out
  refresh her 25s and leave her form alone.
- Ultimate → Standard needs rapid re-presses (wiki: 5 taps; gcsim: 3 recasts).

### 1.2 What makes the approximation cheap: one Pound applies exactly once

Run the shared standard counter over the real two-hit stream, in every mode of
both heads (April bare 111f, April cycle, September cycle, Standard at 340f or
120f): **every Pound-Pound lands exactly one Geo application** — via its first hit
when the 150f timer has lapsed, via its second when the three-hit rule comes
round. The lone exception is September's disputed 62f (2 of every 3).

So **one tick per Pound-Pound, Geo 1U, `icdGate: 'none'`** reproduces gcsim's
application stream to within the 16–21f between the two hits. That is the Emilie
rule ("pair the gate with the stream OUR effect models") and it sidesteps the
objection recorded in her notes — three series would take three ICD counters
(`aura.ts` keys the clock per `series.index`) where the game shares one. With one
tick per Pound and no clock, there is no counter to share.

Cost: a Pound is ONE hit record, not two (the same documented approximation a
multi-hit swing carries today).

### 1.3 The plan

**Phase 1 — static gate, the Aino pattern. Near-zero engine work.**

Lumi gets the same cadence twice under mutually exclusive `conditions`:

- _Moondrift-capable party_ — `all[teamEnablesReaction lunarCrystallize,
teamElementCount hydro >= 1]`: three series on one cycle period
  (Pound · Pound · Heavy at their phase offsets).
- _Otherwise_ — `not(...)`: one Pound series at the bare interval.

The approximation, named: in a Hydro party the cycle is assumed from Lumi's first
attack to her last. In game it starts at the first Lunar-Crystallize (normally
Lumi's own first or second Pound) and lapses if no Lunar-Crystallize lands for 9s
(`MOONDRIFT_LIFETIME_F`). Wrong for a few seconds at the head, wrong in a
rotation that starves the enemy of Hydro; right in the rotation she is built for.

Engine item **E1** (small): a tick `damage` effect may carry `application: []` —
"hits, applies nothing" — for Heavy. The live chain reads only `element` today
(`aura.ts:1044`); with E1 it skips `offerApplication` and still builds the hit
record and calls `notifyDamage`. Same vocabulary, same meaning as a cast's
`application: []` and `onStack`'s (Columbina's Interference). Lint: only `[]` is
legal on a tick (per-tick units do not exist).

Data: Q gains a second summon labelled **`Lumi`** — the E summon's label, so the
existing recast truncation gives "one Lumi at a time" and the ICD key carries.
⚠️ `Memo Heal Aura` must stay `summons[0]` (only `[0]`'s `durationModifiers` reach
the bar, and the state index reads PRIMARY summon windows). ⚠️ A Q during a live
E-Lumi will RESTART her first-attack delay where the game continues the chain —
a small phase artefact, and the existing burst caveat gets rewritten to name it.

Not in Phase 1: Ultimate / Standard Power. No token expresses the tap chain
today, and the skill's notes already record why `chainStage` does not fit.

**Phase 2 — dynamic Moondrift presence (optional, judge Phase 1 first).**

`{ type: 'moondriftPresent' }`, a per-tick condition with exactly the Radiance
round's shape: `ctx.lunarCrystallizeTimes` pushed as reactions fire, read
STRICTLY before the tick's instant (or Lumi's own Pound un-draws the Heavy it
caused), one reader shared by the live chain and `collectSummonTicks`. ⚠️ The
Radiance rule "a refused tick keeps the ORIGINAL phase" is right for the Star and
WRONG here — two gated series on independent phases can land a bare Pound and a
cycle Pound frames apart at the switch. Doing it properly is a _sequenced_ series
(next delay chosen per step — gcsim's `lumiAttack`), which the one-tick-at-a-time
live chain fits natively and the finalize walk does not. One holder in the
corpus; ⛔ not proposed unless Phase 1 reads badly on screen.

### 1.4 The Zajef77 reading (2026-09-20; video `fSS61S6GN9I`, 7:52–13:21, transcript from Nate)

⚠️ **BETA footage**, and he says so himself ("the early footage was really
inconsistent … it is possible this isn't how it turns out"). It validates the
MODEL; it cannot settle live-game constants.

What he states, and what it settles:

- **The sequence is Lunar · Geo · Geo, repeating**, the Lunar hit (Heavy) needs a
  Moondrift nearby, and with none Lumi **starts on Geo**; that Pound's own
  Lunar-Crystallize makes the Moondrifts and "the order will still be the same",
  everything ~2s later. That is gcsim's `lumiAttack` / `advanceSkillIndex` state
  machine, described independently — ⚓ **the state machine is confirmed; only its
  constants are open.**
- **Neither E nor Q deals Geo on deploy** — `application: []` on both, confirmed.
- **One Geo application per Pound-Pound**, by exactly §1.2's argument (1st hit of
  the 1st attack, 2nd hit of the 2nd, because the pair sits inside one 2.5s window
  and the next pair does not). "You do not get a Geo application on the Lunar hit."
- **Redeploying Lumi resets the Lunar "cooldown"** — a recast restarts the
  sequence, Heavy first if Moondrifts stand. Our recast truncation does this free.
- **Ultimate Power is not a third form** — "just the hit that happens before you
  go to the Standard form": the nuke, then slow Pounds, no further Lunar hits.
- ⚓ **The pixel that matters: FOUR Lunar hits in an 18s rotation, or THREE** if
  Lumi had to start on Geo. That count is the model's acceptance test.

His timeline against both gcsim heads (E at 0, 18s = 1080f):

|                                  | Zajef                            | April head                | September head        |
| -------------------------------- | -------------------------------- | ------------------------- | --------------------- |
| Lunar hits, Moondrifts standing  | ~1, ~6.5, ~12, "right before 18" | 1.9, 7.2, 12.5, **17.8s** | 2.6, 7.2, 11.8, 16.3s |
| Lunar period                     | "a little less than 6s"          | 318f = **5.3s**           | 274f = 4.6s           |
| Pounds (Geo applications) in 18s | **6**                            | **6**                     | 7                     |
| Geo-first: the delay             | "like 2 seconds"                 | +111f = **1.85s**         | +184f = 3.1s          |
| Geo-first: the 4th Lunar hit     | "19.5"                           | **19.65s**                | 19.4s                 |
| Lunar hits in 18s: 4, or 3       | 4 / 3                            | 4 / 3                     | 4 / 3                 |
| Standard Power Pound interval    | "like 4 seconds", 4 in 18s       | 340f = 5.7s (wiki: "~5s") | 120f = 2s             |
| First attack after E             | "about 1 second"                 | 114f = 1.9s               | 158f = 2.6s           |

**April reproduces his timeline on six rows of eight and September on two** — but
⚠️ April is ALSO a beta-era count (first commit 2026-04-13), so that agreement may
only mean both describe the beta. September is the one post-release frame count
and the one source that disagrees with the live-game wiki (Standard "~5s", heal
"12s"). ⛔ Still not settled by reading.

**Still missing after the video** (⏭ Nate, in game — the live game is the only
source that outranks all four):

1. **Lunar-to-Lunar period**, Moondrifts standing: stopwatch first Heavy → fourth
   Heavy. **15.9s = April, 13.7s = September.** The most valuable single number.
2. **Standard Power**: Pounds in the 25s after the nuke — **~4** (April 340f) ·
   **~6** (Zajef 4s) · **~12** (September 120f). The most discriminating count.
3. **First attack after E** — ~1s (Zajef) / 1.9s / 2.6s; and after a Q with Lumi
   absent (170f April / 214f September).
4. **No aura at all** (solo, nothing to crystallize): Pounds in 25s — ~13 (111f) /
   ~22 (62f). Rare in play; it is the default branch of the sequence.
5. **A Q cast while Lumi is out**: the kit says her duration resets and her form
   holds — does it ALSO restart the Lunar sequence the way an E does? Cast Q just
   before a Heavy is due and see whether the Heavy is pushed back. No source says.
6. The gaps INSIDE the cycle (Heavy→Pound, Pound→Pound) — only a 60fps recording
   gives these; (1) plus the fact that there are two Pounds per cycle is enough
   to author from if no recording exists.

**What the video changes in §1.3:** Phase 1's static gate is dead (⚓ §6.2) and the
video says why it would have been wrong where it matters — the 4-vs-3 count is
DECIDED by whether a Moondrift stood at the deploy, which a party-composition gate
cannot know. The model is the **sequenced series**: one chain, a step list
(Heavy · Pound · Pound with its three gaps), a Heavy step that REQUIRES
`moondriftPresent`, and gcsim's reset rule (no Moondrift at the advance ⇒ back to
the Pound step). ⚓ The live tick chain already fires one tick at a time and asks
the world before scheduling the next, so the sequence is native THERE; the open
design question is the second reader — replay it at finalize (`moondriftOpenAt`
over the finished Lunar-Crystallize stream, STRICTLY before, the Radiance
precedent), or have the live chain PUBLISH its marks the way a summon-hosted proc
already does (`ctx.stateGatedTicks`), which removes the second computation
instead of requiring it to agree. The engine work does not wait on the numbers.

## 2. Faruzan — there are no summon ticks to add

**The Dazzling Polyhedron's Whirlwind Pulses deal no damage and apply no Anemo.**
gcsim queues no attack for them (`burst.go`: each pulse is `applyBurstShred` on
enemies within 6m of a triangle corner, at 180f + 120k from the cast — 6 after the
initial hit, 9 at C2), and Fandom's Advanced Properties lists a gauge for the
burst's initial hit ONLY ("7 Pulses including the initial one", 10 at C2). Her
burst bars are already at their honest 16 / 22s.

What she is actually missing is **Pressurized Collapse**, from two sources:

**F1 — C6's vortex. Authorable TODAY, no engine work.** gcsim `cons.go`
`c6Collapse`: when the ACTIVE character deals non-zero damage while carrying
Prayerful Wind's Benefit, once per 3s (kit text: 3s — ⚠️ gcsim's own comment says
2.5s, its code says 180f), a vortex lands 33f later: Anemo **1U, `ICDTagNone`**,
Elemental Skill damage. That is a swirl every 3s from the standard Faruzan, and
it is the thing that makes her look inert on the aura lane.

```
burst.effects += {
  type: 'damage', target: 'enemy', element: 'anemo',
  trigger: { type: 'onHit', source: 'active', armedFor: 23.1, icdGate: 'none' },
  procCooldown: 3,
  application: [{ frame: 33, element: 'anemo', units: 1 }],
  conditions: { type: 'constellation', level: 6 }
}
```

`armedFor` is the buff's life from the CAST (43f → 1388f; C6 implies C2). Hosted
on the cast, not the summon: the buff outlives the polyhedron by 4s, and a marker
on the Polyhedron's lane would claim the Polyhedron hit. ⚠️ `source: 'active'`
refuses entity-delivered hits, where gcsim accepts any attack whose actor is the
active character — an on-field character's own summon is the difference.

**F2 — Hurricane Arrow's vortex (E → fully-charged shot).** The arrow is already
an Anemo `C`; the missing part is the vortex 33f after it lands (same attack as
F1), and with it A1's 4s shred — the `Faruzan E C` bar the 2026-08-19 caveat pass
recorded as expected-but-absent. Shape: a cast-hosted `onHit` proc on E, `source:
'self'`, `filter: charged`, `armedFor: 18`. It needs a COUNT — one arrow per E,
two at C1 — which is engine item **E2** below. ⛔ Not `procCooldown` as a
stand-in.

**F3 — pulse markers (optional, low value).** Non-hitting marks at the pulse
instants would need a marker-only series; the corpus has zero non-damage,
non-heal `summonTick` effects and `buffWindows` reads none. Recommend NOT doing
this: the bars already say what the pulses do.

## 3. The others

**Nilou — Tranquility Aura. The largest gauge gap of the six.** gcsim
`skill.go:309`: Hydro 1U every **30f** for 12s (18s at C1), around the active
character (2.5m), `ICDGroupNilou` — a 114f window, first hit only — so **one
Hydro application every 120f**. `AttackTagNone`, no multiplier: it APPLIES and is
NOT damage. That is the inverse of Lumi's Heavy, and the same small item:
**E1b** — `nonHitting: true` on a tick series = offered to the gauge, no hit
record, no `notifyDamage` (a 0-damage tick must not feed Raiden's Eye or any
`onHit` stream). Authored at the true 0.5s with `icdGate {timer: 114, every: 4}`,
drawing 24 marks. The existing caveat (the aura is drawn from the first cast)
stands untouched.

**Jahoda — the robots.** gcsim `burst.go`: under Ascendant Gleam only, each of 2
robots (3 with A1's Electro) absorbs the enemy's aura element (PHEC priority) and
hits every 140f (126f with A1's Cryo), first at ~47f and ~88f;
`ICDGroupJahodaBurst` = 15s window, every 4th hit, shared. Gate: `teamFaction
moonsign >= 2`, already the house form. Element: absorption is unmodelled
corpus-wide (§4); the stand-in is Varka's `teamElementPriority` ElementRef —
**E3** (small): resolve an `ElementRef` on a tick's `element` (it is live at
`infusion`, `application[].element` and `coInfusion` only). Approximation: the
robots as ONE evenly spaced stream at 70f with `icdGate {timer: 900, every: 4}`,
because two series would again take two counters.

**Candace — the burst's waves.** gcsim `burst.go:104`: on a character swap during
the 9s burst, a Hydro wave — 1U, `ICDTagNone`, at swap + 1f, **at most 3**. Needs
`onSwapIn` as a fourth `PROC_TRIGGERS` member (**E4**, medium; the swap-in
dispatch site exists since the `gainStacks onSwapIn` round), summon-hosted so
its marks land on the Prayer's lane, plus E2's count.

**Xianyun — Starwicker.** gcsim `burst.go:107`: the active character's plunge
lands a "Starwicker" Anemo hit — 1U, `ICDTagElementalBurst` standard — spending
one of **8** Adeptal Assistance stacks. Summon-hosted `onHit`, `source:
'active'`, `filter: plunge`: expressible today except the 8, and a Xiao rotation
reaches 8. Needs E2. Closes the burst's existing caveat in passing.

## 4. Adjacent, NOT in this round: elemental absorption

Venti's Stormeye carries its Anemo series and nothing for the absorbed element
(gcsim: 15 further ticks at 24f once absorbed — his own notes say so). Kazuha,
Sucrose, Sayu, the Anemo Traveler and Jahoda's flask are presumably alike (⚠️
Venti verified, the rest not). Absorption reads the LIVE aura, which the gauge
can now answer — a real primitive (`ElementRef {type: 'absorbedAura'}`) and its
own round. Named here so the census above is not read as "everything else is
complete".

## 5. Engine items, and an order

|     | Item                                                        | Size   | Unblocks                     |
| --- | ----------------------------------------------------------- | ------ | ---------------------------- |
| —   | none                                                        | —      | **Faruzan F1**               |
| E1  | tick `application: []` (hits, applies nothing)              | small  | Linnea                       |
| E1b | tick `nonHitting` (applies, no hit)                         | small  | Nilou                        |
| E2  | `procCap.per: 'arming'` — fires per armed listener instance | small  | Faruzan F2, Xianyun, Candace |
| E3  | `ElementRef` on a tick's `element`                          | small  | Jahoda                       |
| E4  | `onSwapIn` proc trigger                                     | medium | Candace                      |

E2 note: `procCap` admits a `per` member only with its consumer (lint B.17);
this one arrives with three. "Arming" = one cast's `armedFor` window or one
summon spawn — the listener record `procs.ts` already keeps.

Suggested order: **F1** (data only, immediate) → **E1 + E1b + Linnea Phase 1 +
Nilou** (one round: both are "a tick says what it applies") → **E2 + Faruzan F2 +
Xianyun** → **E3 + Jahoda** → **E4 + Candace**.

Measurement, per the house rules: every one of these is invisible to the corpus
digest's single-character rows where the reaction needs a partner — measure at
the SITE with a multi-character rotation (Linnea + a Hydro applier; Nilou + a
Dendro applier; C6 Faruzan + an on-field Anemo), and the frames oracle cannot
adjudicate Linnea (absent from `main`), Jahoda's robots (Gleam-gated; the dumper
runs one character) or any C6 branch.

## 6. ⚓ Nate's calls (2026-09-20)

1. **Linnea's numbers — NOT from either gcsim head yet.** Nate has a Zajef77 video
   that goes into how Moondrifts change Lumi's hits; it is the source to read
   before anything is authored. ⏭ BLOCKED on that transcript. The in-game count
   (solo `E`, no Hydro, Pounds over 25s: ~13 means 111f, ~22 means 62f) is the
   fallback for whatever the video leaves open — ⚠️ a transcript gives behaviour
   in words, and may not give frame intervals.
2. **Track Moondrift presence — Phase 2 is the plan, not the option.** ⛔ The static
   Hydro-party gate (§1.3 Phase 1) is NOT to be built as the model. So the round
   needs the `moondriftPresent` reader AND an answer to the phase problem §1.3
   names (two gated series on independent phases collide at the switch) — which
   points at the sequenced series. Design it after the video, not before.
3. **Faruzan: no pulse marks.** The only hits are Pressurized Collapses.
4. **Scope: Linnea, Faruzan, Nilou.** Jahoda, Candace and Xianyun wait.
5. 🆕 **Elemental absorption is its OWN focused round** (§4), survey first: every
   Anemo absorber. Found by Nate on a Stellar-Conduct team — Lynette's Bogglecat
   Box hits Anemo and never the absorbed element, so it can never feed a Conduct.
   Jahoda's robots (§3) belong to that round, not this one.

## 7. Built

**Faruzan F1 — C6's Pressurized Collapse** (`curation/faruzan-collapse`). Data only,
as §2 specified, with the vortex's real multiplier (194.4% ATK, the skill table's
row at talent level 10). Cast-hosted, so ⚠️ **no mark on the Polyhedron's lane** —
the Fischl-A4 / Tri-Karma precedent; the Collapses show as pills on the aura lane.
✅ ⚓ Nate, 2026-09-20: aura lane only, "like Fischl's A4 and Nahida's Tri-Karma" —
⛔ don't move the effect onto the summon.

Measured at the site, `Bennett E > Fischl E > Faruzan Q > Xiao E N3×16`, C0 vs C6:
Faruzan's applications **1 → 8** (~215f apart: the 3s cooldown plus the wait for
the next hit), her swirls **1 → 3**. ⚠️ The first Collapse is fired by her own
burst and lands at cast + 33f where gcsim has 87f — a cast's hit record sits at
the cast instant, not its hitmark; engine-wide. Gates: vitest 1944 green, check,
lint, build. ⛔ e2e not run (data-only; no browser surface moved).

## 8. Found on the way: a CAST's hit record sits at the cast instant (2026-09-20)

↻ **MOVED: the working copy of this is `docs/multi-hit-swings-round.md` §6** (⚓ Nate:
"very important" — it is the next session's work, with the multi-hit round). What
follows is the discovery record.

Not this round's to fix — recorded so it is not re-discovered. `run.ts` (the cast
branch, just before `clock.advance(castEnd)`) dispatches the cast's hit record
with `time: castStart`, synchronously, while the SAME cast's `application[]` is
scheduled at `castStart + frame`. So one cast's damage is in two places: the gauge
sees it at the hitmark, every `onHit` consumer sees it at the button press.
§1.K closed exactly this for swings (⚓ Nate: "everything stays synced" — one
closure at `landsAt`) and did not touch casts.

gcsim is right and so is our own `application[]` (it IS gcsim's damage stream);
the hit record is the odd one out.

Census, 2026-09-20: **266 hitting casts** state a measured landing and ALL of them
are offset (none lands on frame 0) — median **35f**, p75 71f, p90 106f; the tail
is delayed detonations (Amber's Bunny 530f, Mona 344f, Heizou 200f, Klee 186f).
88 are multi-hit and still ONE hit record; 45 of those span more than a second.
16 casts state no `application[]` and 3 hit at Durability 0 (`application: []`),
so they have no frame to move to.

What it does on screen:

- ⚠️ **ORDER INVERSION, not just an offset.** A damage proc fired by a cast's hit
  lands its application before the cast's own. Measured: C6 Faruzan's first
  Collapse at cast + 33f, her burst's hit at cast + 54f; gcsim has 54 then 87.
  Same for Raiden's Eye, Beidou, Albedo, Dehya off any teammate's cast.
- An `onHit skill|burst` buff / shred window opens at the press, not the hit
  (same length, shifted early) — 12 + 17 characters can hear a cast hit.
- Stack grants, `cooldownReduce` and artifact `onHit` sets fire early likewise.

The fix has §1.K's shape — the hit record joins the application in one `Band.LAND`
closure at the FIRST landing, queued before the advance (the cast pipeline already
schedules before it advances) — with three things §1.K did not face: the record's
pre-consume `stacks` snapshot is taken at the cast, the four finalize-side buff
sites anchor `onHit skill|burst` on the CAST EVENT, and a cast with no landing
frame keeps the synchronous path. ⚠️ It touches the same ground as
`docs/multi-hit-swings-round.md` (every hit a swing lands) — a cast's 2nd..Nth
landings are that round's cast-side twin. ⛔ One at a time.
