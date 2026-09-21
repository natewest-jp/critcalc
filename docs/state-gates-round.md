# §1.G — resolved states in the buff projections (2026-09-19)

_Status: ✅ SHIPPED 2026-09-19 on `feat/state-gates` — **§6 is the RECORD and
wins over §0–§5, which are the SCOPE as written before the measurement.**_

_Original status: SCOPE, not started. ⚓ Nate approved §1.G as the next engine round
2026-09-19. This file is the static half of the scope — what the data says and
what the code is handed. ⏭ The MEASURED half (which bars are wrong today, in
which rotations) is §4 and is still to be run; ⛔ don't start the change before
it, the last three rounds each overturned their spec at that step._

## 0. The defect, in one paragraph

`deriveBuffWindows` (`src/lib/utils/buffWindows.ts`) evaluates every effect's
`conditions` with an EMPTY state set — about fifty `evalCondition(…, 4, new
Set(), cLevel, …)` call sites. `evalCondition`'s `state` arm answers `true` only
for a state in `resolvedStates`, `false` only for one in
`context.negatedStates`, and `null` otherwise — and in a buff pool `null` means
**keep, optimistically**. So a buff gated on `inStance`, `duringSummon` or
`nightsoulBlessing` draws whether or not the state is up. The backlog's named
casualties: Durin's form-gated shreds, Lohen A4, Varesa A1's tiers (the stat
dedupe keeps the first-authored tier because neither resolves), Qiqi A1, Fischl's
Secret Rite (authored and inert), and the two it BLOCKS — Columbina C6 (seven
+80% bars in a rotation with no summon of hers) and Odette's Coda exclusion.

## 1. The static census (2026-09-19, over all 123 characters)

105 `state` conditions across 41 characters — but **where they sit decides
whether they are this round's**:

| host                          | n   | resolved today?                                     |
| ----------------------------- | --- | --------------------------------------------------- |
| an ABILITY's own `conditions` | 43  | ✅ live, by `resolveActiveAbility` — not this round |
| a VARIANT's `conditions`      | 5   | ✅ live, by `matchVariant` — not this round         |
| a MODIFIER's `conditions`     | 1   | ✅ live, `applyModifiers` takes `resolvedStates`    |
| an EFFECT's `conditions`      | 56  | ⚠️ depends on the trigger — below                   |

The 56 effect-hosted gates, by what they gate:

| effect / trigger                                                                     | n   | evaluated by                                                 |
| ------------------------------------------------------------------------------------ | --- | ------------------------------------------------------------ |
| `buff` / onCast                                                                      | 16  | ⛔ `buffWindows`, no states                                  |
| `resShred` / onReaction                                                              | 9   | ⛔ `buffWindows`, no states                                  |
| `buff` / passive                                                                     | 5   | ⛔ `buffWindows` + the always-on chip, no states             |
| `buff` / onReaction                                                                  | 3   | ⛔ `buffWindows`, no states                                  |
| `buff` / onHit                                                                       | 2   | ⛔ `buffWindows`, no states                                  |
| `resShred` / onCast                                                                  | 1   | ⛔ `buffWindows`, no states                                  |
| `shield` / passive                                                                   | 1   | to check                                                     |
| gainStacks · consumeStacks · damage procs · cooldownReduce · energy · heal · cdReset | 19  | ✅ the LIVE dispatchers, which already call `holderStatesAt` |

So the round's real target is **~37 effects across ≤19 characters**, not 88, and
they gate on exactly **three** states: `duringSummon` ×20 · `inStance` ×19 ·
`nightsoulBlessing` ×15 (+ `offField` ×2, which the per-segment `negatedStates`
already resolves).

## 2. Why this is tractable: the answer is already in the IR

`deriveBuffWindows` runs at FINALIZE and is already handed `windows` — the
parse's state / summon / shield windows with FINAL ends (extensions and
truncations applied). All three states are windows there:

- `inStance` — a `state` window named `inStance` (stances are emitted that way).
- `nightsoulBlessing` and every other opened / transient state — `state` windows
  by name.
- `duringSummon` — the holder's `summon` windows.

So the round needs no new parse output. It needs ONE index,
`statesAt(holderId, t) → { active, negated }`, built once from `windows`, and
the fifty call sites handed the right `(holder, t)`.

⚠️⚠️ **Closed world only for TRACKED states.** `negated` may contain a state
only if the IR would have recorded it had it been up. `afterNormalAttack`,
`afterSkill`, `afterBurst`, `afterDurationEnds` have no window and must stay
`null` (optimistic) — a blanket "not in the active set ⇒ false" would silently
delete every effect gated on one. `shielded` has shield windows but is
unsurveyed here; leave it `null` unless §4 shows a wrong bar.

⚠️ **`duringSummon` has two meanings in the sim already** (`states.ts` header):
`inferredStates` counts only STATIONARY summons, `holderStatesAt` counts
following ones too (Escoffier C6's Cooking Mek). The buff passes are the
`holderStatesAt` question — any holder, any instant, off field included — so
the index must use the BROAD reading, ⛔ not the stationary one.

## 3. The design questions §4 must answer before any code

1. **Which `t`?** An onCast pool evaluates at the cast; an onHit / onReaction
   pool at the trigger event. But a buff whose gate is `inStance` and whose
   window outlives the stance — does the bar end with the state, or is the gate
   only an entry test? The data decides per effect (a `duration` beside the gate
   says entry test; none says co-extensive), and the census of which is which
   belongs in §4.
2. **Whose state?** The HOLDER's, for every case surveyed so far — but
   `target: 'active'` effects already carry a second subject (the receiver's
   `weaponType`), so check no state gate means the receiver's.
3. **Dedupe order.** The pool rule is conditions → dedupe by stat (buff-pool
   round). Varesa A1's tiers collapse to the first-authored one ONLY because
   neither resolves; with states supplied the existing order should pick the
   right tier with no further change. Verify, don't assume.
4. **The always-on chip** (`TeamBonusesBlock`) lists `passive` effects and
   evaluates party-composition gates since 2026-09-19. A state-gated passive
   there has no instant to evaluate at — it should keep listing optimistically,
   which is what it does. Confirm it is untouched.
5. **The summon-tick projection.** `summonTickSeries` also evaluates with no
   states (its header calls that load-bearing: the markers a viewer SEES must
   be the ticks that FIRE, and the live chain uses the same empty set). The
   census above found **no** state-gated tick series, so this round should
   leave both readers alone — re-check at §4 and say so in the record.

## 4. ⏭ The measurement still to run

- A **state-gate digest**: for each of the ≤19 characters, a rotation that casts
  the gated ability both INSIDE and OUTSIDE its state (e.g. `Q` cold, then
  `E … Q` in stance), at C0 and C6, recording every buff window with its
  effects. The "outside" run is where today's optimistic bars show.
- The **before** list from that digest is the round's definition of done; the
  **after** must remove exactly those bars and move nothing else (the corpus
  buff digest, `scratch/probe/digest.test.ts`, is the differential — ⚠️ it
  casts E and Q once each, so most of these never appear in it and a green run
  there proves little).
- Then re-try the two blocked items in memory: Columbina C6 as four
  element-keyed `onReaction` CRIT DMG buffs gated `duringSummon`, and Odette's
  Coda exclusion.

## 5. Out of scope, stated so nobody reaches for them

- `teamElementCount` / `teamFaction` in the buff and tick passes — already
  carried (T1's two prerequisites, `d71bca2a` / `64d22ae1`).
- A `stacks` gate in the buff passes — a different missing context, with its own
  snapshot-time question.
- `manual` retirement — runs after this, because Columbina C6 and Odette leave
  the `manual` pile only once this lands.

## 6. RECORD (2026-09-19)

### 6.1 The measurement came first, and it changed the design twice

The inside/outside digest (28 scenarios × C0/C6, gitignored
`scratch/probe/stategates.test.ts`) ran on `main` before any code. It confirmed
the scope's casualties — Citlali's A1 shred off a melt with no Itzpapa and 22s
after it expired, Durin's shreds and C2 with no dragon, Iansan's A1 off a cold
charged attack, Lohen's A4 and C2 out of stance, Skirk's A4 off a hold-E that
opens no stance and her C2 off a cold burst, Fischl's and Venti's Secret Rites
with no Oz / Stormeye, Varesa's A1 drawing the 50% tier inside Fiery Passion —
and it found two things the static scope could not:

1. **§3 Q1 ("which `t`?") has no answer for a cast that OPENS the state it is
   gated on, because the corpus authors both readings.** Skirk's A4, Varka's
   A1, Zibai's C2, Durin's C6 and Xianyun's A1 gate POSITIVELY on the state
   their own cast opens ("after"); Varesa's C4 gates `not nightsoulBlessing` on
   the burst that opens the Blessing ("before"). Any instant deletes one side.
2. **Qiqi's A1 drew nothing in EITHER state** — not a state defect at all
   (§6.4).

### 6.2 What shipped — `src/lib/utils/stateIndex.ts`

One index over the parse's final `state` and `summon` windows, the
finalize-time twin of `holderStatesAt` (any holder, any instant, PRIMARY summon
only — finalize hands over `primarySummonWindows` so the projection cannot
widen `duringSummon` behind the live resolver's back). Every per-EVENT pass in
`deriveBuffWindows` reads it: cast, N/CA/P hit, summon tick, reaction,
threshold fire, and the three per-receiver slice sites (which now build ONE
gate from the event's states plus the slice's on/off-field fact). The reaction
sites had no per-event pass at all and gained one (`makeReactionGate`).

Three rules, each with a seeded negative in `buffWindows.test.ts`:

- ⚠️⚠️ **Closed world only for states the holder's own data can OPEN** — a
  stance, an `opensState`, a transient spec and its `onEnd` chain, a summon
  (`trackedStatesOf`, a cached deep walk). Everything else stays `null`.
  ⚓ Measured: every gated state in the corpus except `offField` IS openable by
  its holder, so the intersection drops nothing today; it is the guard for the
  character who gates on a state we do not model for them. ⛔ Rejected: a fixed
  three-state allowlist.
- ⚓⚓ **A state the cast ITSELF opens answers `null` at that cast**
  (`sourceCastId === cast.id`, whether the window covers the cast instant or
  spawns after it — Durin's dragon lands 97f after the burst gated on it). The
  gate is then decided only by a window some OTHER cast opened: Skirk's bar
  stays on `E` and drops on `hE`; Varesa's C4 stays on a cold Q and would drop
  on a Q inside a standing Blessing.
- ⚓ **The gate is an ENTRY TEST** (§3 Q1's other half): every state-gated
  effect that reaches the pass carries its own `duration`.

§3's other questions: Q2 — every gate is the HOLDER's. Q3 — confirmed, no
change needed: with states supplied the conditions → dedupe order picks
Varesa's 180% tier in Fiery Passion and 50% outside. Q4 — the chip is
untouched. Q5 — re-checked, no state-gated tick series; `summonTickSeries` and
the live chain are untouched.

⚠️ Left stateless on purpose: the pool PREFILTERS (they run once per token,
before any event — no instant to read), and the `afterDuration`,
Nightsoul-Burst and `onState` sites (no state gate sits on one).

### 6.3 🐛 The live twin — a `not state` gate never fired in the stack dispatchers

Found by measuring Odette's gate: the five `stacks.ts` dispatch sites demand a
definitive `true` and evaluated with NO negated set, so `not(state)` was `null`
forever. One corpus effect was already sitting on it — **Lohen's
`consumeStacks … not inStance`**, the clear that resets his special-skill count
on re-entering Masterstroke. Measured on `main`, `Lohen E E E ~20s E E E` @C0:
the count carried 2 → 3 into the second Masterstroke, which got ONE Etched Into
Bone and Soul and then fell back to Unforeseen Strike on its 18s cooldown.
`liveNegatedStates` is the same per-holder tracked set, minus what is up.
⚠️ `duringSummon` is never negated live — `inferredStates` (stationary) and
`holderStatesAt` (following too) disagree about it, and both read a
pre-extension `uptime` mid-parse. Blast radius: exactly the `not(state)` gates
on stack effects (positive gates already skipped on `null`).

### 6.4 🐛 `onReaction … source: 'active'` had no reader in the buff pass

The three reaction sites chose their stream with `source === 'team' ? all :
own`, so `'active'` fell through to the holder's own reactions and Qiqi's A1
fired for nobody but Qiqi (her note claimed an optimistic bar). `'active'` is
the whole stream minus entity-delivered reactions; `ReactionEvent.viaEntity`
carries what `emitReaction` already had in hand. One holder (census).

### 6.5 Data

- **Columbina C6** authored: four `onReaction` source-team +80% element CRIT
  DMG buffs, 8s, Hydro on all three Lunar reactions (its row refreshes across
  kinds — "same Elemental Type do not stack"), gated `duringSummon`. `manual`
  1 → 0 on her; the caveat is retired. ⚠️ One stated imprecision: the Gravity
  Ripple (25s) satisfies the gate as well as the Lunar Domain (20s) gcsim
  checks, so a Lunar reaction in the ~3s after the Domain closes still draws
  (measured: a bloom rotation's row ends 1905f, exact 1788f). No
  label-qualified summon gate exists.
- **Odette**: nine `onCast ability: 'skill'` grants gated `not codaWindow` —
  the Coda re-fired every A1 / C2 / C6 bar 0.3s after the E that raised them.
- **Lohen A4**'s caveat lost its "after Masterstroke has ended" pixel.
- Xilonen's burst heal gate (held with these in the stack-threshold record) was
  ALREADY resolved by T1's tick-context fix — measured 0 ticks in mono-Geo.
- ⏭ Still unreachable: Lohen's Etched Secret Rite trigger — the self-opened
  rule keeps the cold-open E too; it needs hosting, which a `factionBonuses`
  entry cannot have.

### 6.6 Measured

Inside/outside digest: every removed window is an OUT / LATE scenario, no IN
scenario moved, Varesa's tier flips 50 → 180 in Fiery Passion. Corpus: 5 of 630
summon-aware + 2 of 252 buff digests moved on the engine commit (all Lohen), 0
on the live fix (blind — no corpus rotation re-enters a stance; measured at the
site), 5 + 2 on the `'active'` fix (all Qiqi). No timing change on
1,500–5,000-cast rotations of a tracked holder.

### 6.7 ⏭ Open, for Nate

- ⛔⛔ **RESOLVED 2026-09-21 AND THE ANSWER IS "DO NOT BUILD THE CLAMP."** This
  item read: "a buff whose gate is the stance its own cast opened outlives an
  EARLY stance exit" (`Skirk E N1 > Furina …`: stance ends at 33f, the A4 bar
  runs 0–754f). ⚓ Nate approved cutting it **"if that is the behavior
  in-game"** — and gcsim says it is not. Skirk's A4 is _Death's Crossing_, 20s
  per teammate hit with **no stance in it at all** (`skirk/asc.go:106`);
  Varka's A1 is a **permanent** `modifier.NewBase(…, -1)` (`varka/asc.go:32`);
  Zibai is absent from gcsim. The stance-length `duration` is a stand-in for
  the MAGNITUDE, never a claim about the window, so a clamp would fix the end
  we can see and worsen the one we cannot. ⏭ The real fix is per character:
  Varka A1 → `passive` + `scaling atk` (authorable today); Skirk A4 → an
  `onHit` buff on a TEAMMATE's hit, blocked on the queued cross-character
  `onHit` defect. Full reasoning: `docs/summon-bound-buffs-round.md` §1.
- ✅ **A label-qualified `duringSummon` — the second holder ARRIVED** (Gorou's
  DEF bar, 2026-09-21), so this is scoped: `docs/summon-bound-buffs-round.md`
  §3. Columbina's C6 takes `source: 'burst'` (gcsim gates it on
  `ReactBonusModIsActive(burstBuffKey)`, `cons.go:232` — the Domain, not the
  Ripple).
