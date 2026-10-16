# Mavuika's Nightsoul, simulated (2026-10-16)

Branch `feat/mavuika-nightsoul`. Opened by follow-up F1 of
`docs/mizuki-holds-field-round-2026-10-16.md`: a swap ended Mavuika's Nightsoul's
Blessing, but in game it carries on. ⚓ Nate: simulate her points and Fighting
Spirit for real, because she is one of the most important characters in the meta.

## 1. Decisions (⚓ Nate, 2026-10-16)

1. Her burst WAITS for 100 Fighting Spirit. She would be the first character whose
   burst waits on a resource rather than a cooldown (energy is not simulated for
   anyone).
2. Display stays minimal for now: the Blessing ends where her points run out, and
   the Q pill shows the Fighting Spirit it spent.
3. The in-Blessing recast that switches between the Flamestrider and the Ring is
   left for later. A swap already does the common bike-to-Ring switch.
4. The work ships in three phases: points / forms / the Blessing and Ring
   lifetimes (§3), then Fighting Spirit and the Q gate with A4/C1/C4, then the
   Crucible attack bonuses and polish.

## 2. The game (verified)

gcsim's model, read in full from `internal/characters/mavuika/` and
`internal/template/nightsoul/` (pinned `4eda9fc5f`), and checked against Nate's
four in-game runs (C0, combat log; screenshots in
`assets-src/ingame-logs/2026-10-16/`, record in the Mizuki doc's F1):

**Points**

- The pool is 80 points (120 at C1).
- Entering:
  - Tap E and Hold E enter at the maximum, or refill to it inside the Blessing.
  - The burst enters with 10 points at +87f, or adds 10 if she is already in it.
- The drain ticks every 6 frames from the entry: 0.5 per tick in Ring form, 0.9 on
  the bike (1.1 while charging).
- Spends:
  - A Ring hit costs 3, after it lands.
  - A bike Normal Attack costs 1 per swing, at its hitmark.
  - A bike dash costs 10.
- Her Crucible (burst +105f, 420f, or until a swap) multiplies every cost by 0.
- The Blessing ends when her points drop below 0.001. There is no timer.

**Forms**

- Tap E puts her in Ring form. Hold E and the burst put her on the bike.
- A swap while she is on the bike turns it into the Ring, which keeps attacking
  off-field.
- The Ring hits every 120f from its form entry: Pyro 1U, `ICDTagNone`.

**Nate's runs against the model**

| Run                 | Game                                                           | Sim                              |
| ------------------- | -------------------------------------------------------------- | -------------------------------- |
| Bike only           | ~8.9s                                                          | 534f = 8.9s                      |
| Ring only           | ~12s                                                           | 744f = 12.4s, 6 hits             |
| Bike ~3s, then swap | 4 Ring hits, about 2s after the swap and then every 2s, no 5th | 4 hits, the first at swap + 120f |
| E → Q → swap        | 5 Ring hits, no 6th                                            | 5 hits                           |

## 3. Phase 1 — points, forms, lifetimes

### Schema

- **`CharacterData.nightsoulPool` (`NightsoulPoolSpec`)** — the Blessing state,
  the maximum and its modifiers, `drainPerTick`, and the forms, each with an
  `extraDrainPerTick` and an optional `swapTurnsInto`.
- **`CastAbility.nightsoul` / `AbilityVariant.nightsoul` (`NightsoulCastSpec`)** —
  `points` (a number or `'max'`), `pointsAt`, `entersForm`, and `pause`.
- **On a `Summon`:**
  - `endsWithState`: the summon lives only inside its holder's window of that
    state that contains the spawn.
  - `spawnsAtSwapOutFrom`: the summon spawns at the owner's swap-out, if she is
    still in that form under this cast.
  - `nightsoulCostPerTick`.
- **`NormalAbility.nightsoulCost`** — `{ perSwing, perDash }`.
- **`State` `flamestrider`** — the two edits: the union and lint's `STATES`.

### Engine (`src/lib/sim/nightsoul.ts`)

- **⚓ The pool owns its windows, and their ends are its PREDICTION.** Every change
  re-predicts where the points run out and rewrites the Blessing's end and the
  current form's end, earlier or later. A query mid-parse therefore already
  agrees with the final answer, and a rotation that stops mid-Blessing still shows
  its real end. An exit task is generation-stamped.
- **The swap clamp in `run.ts` skips pool-owned states** (`ownsState`). Without
  that, a swap that ended her Hold-E stance clamped every state she held.
- **Where the pool is called:**
  - at a cast, before its stance and summons;
  - at a normal swing's landing and at a dash;
  - at a Ring tick, after the hit;
  - at her swap-out.
- **The Ring spawned at a swap** reaches the live chain through a closure the cast
  hands the pool, and reaches finalize through `ctx.swapSpawns`. It lives its own
  life (`summonEndAt`), because it starts after the cast's pill has ended.

### Data

- The Tap E Ring ends with the Ring form (`endsWithState: 'searingRing'`, which
  replaces `terminatesOn: 'burst'` + `opensState`), costs 3 per hit, and is a
  `recast` so a new Ring supersedes it.
- The Hold variant and the burst each carry the Ring as a swap-out spawn.
- The Hold-E stance pill is the bike, with an upper bound of 9s (C1 +4.4s = 134
  ticks). It is cut at a swap, a Tap, the burst, or empty points.
- The burst's stance stays the Crucible pill.
- The Flamestrider normals gate on `flamestrider` and cost 1 per swing and 10 per
  dash. C2's Normal/Charged flat damage moved to `flamestrider` (bike-only in
  gcsim).

### Tests

- **`src/lib/sim/nightsoul.test.ts`:** Nate's four runs as fixtures, plus the
  rules: burst entry at 87f, the burst ending the Ring, swing costs, C1 at 120,
  and a fresh Blessing from Hold E.
- **The IR oracle** cannot rebuild a pool-driven summon from pill geometry (its
  end is her points), so it asserts containment in the state window instead, the
  same way it handles `summonsFollowState`.
- **The lint opener walk** now reaches `nightsoulPool`.

### Frames audit

- Her driver row is re-keyed to `flamestrider`.
- One new uncovered row: the burst's Ring, which gcsim's empty core never swaps
  out to reach.

## 4. Open (later phases)

⚓ **Phase 2 is DEFERRED until after launch** (Nate, 2026-10-16). Fighting Spirit
is mostly a damage multiplier.

- Its one timing effect is the Q gate: the burst needs 100. It starts at 200, so
  the first Q is always ready, and in her real teams it refills well inside her
  18s cooldown. Until then her Q is gated by its cooldown alone.
- ⚠️ When it is built, the gate must count teammates' Nightsoul spending. In
  gcsim, ten others feed it (Chasca, Citlali, Iansan, Ifa, Kinich, Mualani,
  Ororon, the Pyro Traveler, Varesa, Xilonen) — her core teammates among them.
  Counted from her own spending alone, the gate would wait too long in exactly
  her best teams.
- C1's +40% ATK on every gain is effectively permanent, and A4 is shown at the
  full-200 value (40%).

The bike Charged Attack round (§5–§6) moves up: it is NEXT after Phase 1.

- **Phase 2:**
  - Fighting Spirit: +1 per Nightsoul point spent by anyone; +1.5 per party Normal
    Attack hit on a 6f ICD; ×1.25 at C1; capped at 200; starts at 200.
  - The burst waits for 100.
  - A4's value from the Fighting Spirit spent (0.2% per point, decaying over 20s;
    C4 +10% with no decay).
  - C1's +40% ATK on each gain.
  - The Q pill shows the Fighting Spirit spent.
- **Phase 3:**
  - The Crucible's Normal/Charged/burst damage bonuses.
  - C2's DEF shred still triggers on the skill cast, so it misses the swap-spawned
    Ring. Move it onto the Ring form's span.
  - C6's Hold-E shred still has a fixed 9s.
  - The Tap E pill still draws the Ring's 12.4s even when a burst cuts the Ring
    sooner. This is not new; it was true before this round.
  - The Crucible pill starts at the cast; the Crucible itself starts at +105f.
- **Not modelled:**
  - The bike Charged Attack's +0.2 drain (no bike Charged Attack is authored).
  - The in-Blessing recast (decision 3).

## 5. Queued after Phase 2 (⚓ Nate, 2026-10-16): the bike Charged Attack and its finisher

The gcsim-faithful version (⚓ Nate).

- **`C` on the bike** is one spin hit, so `C3` is three. gcsim's `charge` count
  mode: the first hit can land at 35f, one revolution takes 45f, and same-target
  hits are at least 42f apart. Today a bike `C` draws her on-foot Charged Attack.
- **`F` is the finisher token** (KQM `C3F`). It always performs the finisher.
- **It is added automatically when the game forces it:**
  - the next token is a Normal Attack;
  - the spin reaches its 375f maximum;
  - her Nightsoul runs out mid-spin.
- **Before a dash, jump, E, Q or swap, a missing `F` means NO finisher**: gcsim
  cancels it (`bikeChargeFrames[next] = 0`, and `OnRemoved` resets the CA state).
- **Finisher timing:** a release delay of 0–20f by spin angle (`GetCAFDelay`), then
  a 45f hitmark. After it, a Normal Attack at 74f; dash, jump, E, Q and swap at
  45f. A bare `F` needs at least 50f of spin first.
- **While charging**, her drain rises to 1.1 per tick (the +0.2 Phase 1 left out).
- **Frames to measure with the dumper** rather than compute: `C1`…`Cn` and `CnF`.

## 6. Candidate after §5: the dash-cancelled Charged Attack ("CDC")

Raised by Nate on 2026-10-16. It is the main tech players use today: tap a dash
while still holding the Charged Attack, and she hops on her front tyre instead of
spinning. gcsim implements it (PR #2669):

- **The cancel.** `dash[charge_cancel=1]`, made during the bike Charged Attack
  (cyclic or the finisher), is cut at its `travel` frame: 6f by default (6–24), or
  2f with `collision=0`. The next `charge` starts there instead of at the dash's
  normal 20f.
- **The windup skip.** That `charge` skips the 15f windup (`buffered`, 0–15).
- **The lockout.** The cancel is refused 79–87f into the spin and in the same
  window of every revolution after it (`cdcLockoutStatus`).
- **The cost.** Each dash still costs 10 Nightsoul points.
- **Variance.** Our Human timing setting is where a player's variance lives; gcsim
  exposes it as `travel` / `buffered` / `collision`, with frame-perfect defaults.
- ⏭ **Notation:** check a real KQM Mavuika rotation before choosing a token shape.

### §6 notation, from Prydwen (Nate, 2026-10-16)

KQM's guide does not cover the CDC combos, so Nate sourced them from Prydwen.gg:

- `Q CDCDCCF DCDCCF DCDCC FDC`
- `Q CDC (tap) CDCDCCF DCDCCF DCDCC`
- `Mav hE CDCDCC FDCDC Q`

⚓ Uppercase only: lowercase stays reserved for variants (`hE`, `sC`). Prydwen
writes the strings in lowercase.

| Prydwen                      | Meaning                                                   | gcsim                                             |
| ---------------------------- | --------------------------------------------------------- | ------------------------------------------------- |
| `C` after anything but a `C` | Start a spin. No windup after a dash, an attack or her Q. | `charge` (`buffered`)                             |
| `CC`                         | The spin continues for another hit.                       | Another `charge` inside the same CA.              |
| `F`                          | The finisher.                                             | `charge[final=1]`                                 |
| `CDC`                        | A dash cuts the spin; the next spin has no windup.        | `dash[charge_cancel=1]`                           |
| `FDC`                        | The same cancel, after the finisher has landed.           | As above.                                         |
| `(tap)`                      | Keep spinning until the dash is ready again.              | Needs no parameter: it is the dash-cooldown WAIT. |

- **The tokenizer** already splits compact runs into `C` and `D`. `F` is unknown
  today, so `FDC` is unknown as a whole.
- **⚠️ The dash cooldown** (gcsim `ApplyDashCD`): a dash within 0.8s of the
  previous one starts a 1.5s lockout. This is why Prydwen says only two quick
  dashes work. It is NOT modelled for anyone today. Modelled, a `D` that is too
  early WAITS like a skill on cooldown, and the spin continues meanwhile — which
  is the double-tap tech.
- ✅ **Decided (⚓ Nate, 2026-10-16): the dash cooldown is UNIVERSAL** — it is the
  game's rule, and gcsim applies it to every character. Measure which saved
  rotations it moves before landing it.

## 7. The bike Charged Attack round — gcsim's measured timings (2026-10-16)

Branch `feat/mavuika-bike-ca`. Measured with gcsim's own CLI (built into
`scratch/`, the checkout at `4eda9fc5f`). The setup: one target 2.5m in front,
Tap E then Q first (from a cold start her Q has only 10 points), then Prydwen's
`Q CDCDCCF DCDCCF DCDCC FDC` translated action for action.

| Step                                                                       | Frames (from the press)                                                   |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `C` after a dash, a Normal Attack or her Q (windup skipped, `buffered` 15) | first spin hit +20                                                        |
| `C` fresh (after E, or from idle)                                          | first spin hit +35                                                        |
| each further `C` in the same spin                                          | +42 (`bikeChargeAttackICD`, one target)                                   |
| `D` in a CDC (`charge_cancel`)                                             | pressed at the spin hit; Sprint hit +6; next `C` +6                       |
| `F`                                                                        | finisher hit +45, plus the spin-angle delay (`GetCAFDelay`: 0 and 3 here) |
| `F` → `D`                                                                  | +48                                                                       |
| `F` → `N`                                                                  | +77 (74 + 3)                                                              |
| her Q → `C`                                                                | 116                                                                       |

- **The dash cooldown never blocked** Prydwen's strings. The dashes at 155 and 181
  start the 1.5s lockout (ending 271); the next dash is at 297. Each `CCF` is long
  enough, so the combos are built around it.
- **Every spin hit, finisher and Sprint is Pyro 1U on `ICDTagMavuikaFlamestrider`,**
  the same tag her bike Normal Attacks use.
- ⚠️ A cold `Q` + these combos runs her Blessing dry ("nightsoul blessing expired
  before Mavuika could perform charge cancel"). Real rotations press E first.

### §7 built (2026-10-16)

- **`NormalAbility.chargeSpin` (`ChargeSpin`) and its own parser branch** in
  `run.ts`, ahead of the generic Charged Attack:
  - each `C` is one spin hit, and `F` is the finisher;
  - the finisher is added automatically only before a Normal Attack or at the
    375f maximum;
  - before anything else a missing `F` means none.
- **The finisher's release delay** is gcsim's `GetCAFDelay`. A bare `F` spins 50f
  first. The auto finisher joins the last `C`'s block (it carries no token of its
  own).
- **The dash branch:**
  - a `D` between two spin `C`s, or after an `F` into one, is the cancel, cut at
    6f, and the next spin skips its windup;
  - `dashHit` lands the Sprint's Pyro;
  - any spin ends at a dash.
- **⚓ The dash cooldown is universal** (`CharState.dashCdUntil` / `dashLockout`;
  48f window, 90f lockout, a waiting dash waits). No test or fixture rotation
  moved.
- **The pool's charging drain** (`chargingExtraPerTick` 0.2, `nightsoulCharging`)
  runs from the first spin press to the finisher's hit, or to the cancel.
- **`icdCounter: 'flamestrider'`** puts her bike Normal Attacks, spin, finisher
  and Sprint on gcsim's one tag. The lint allows a lone holder that spends the
  counter from several action classes.
- **Tokenizer:** `F` is a label, splits inside compact runs (`CCF`, `FDC`), and
  `peekActionKey` reads it as a Charged Attack. Names starting with F are
  unaffected.
- **Editor:** `F` is flagged on any kit without a spinning Charged Attack (index
  fact `chargeSpin`).
- **Tests (`sim/nightsoul.test.ts`, +6):** the measured timings, the
  forced/cancelled finisher, CDC, Prydwen's combo against gcsim's trace, and the
  dash cooldown (Mavuika and Bennett).
- ⚠️ **Not modelled:**
  - hitlag (gcsim's +3f after a finisher);
  - the CDC lockout (never reached at a spin hit against one target);
  - spin hits during a dash's cooldown wait (the caveat says to add `C`s);
  - multi-target spin geometry;
  - the finisher forced by her Nightsoul running out mid-spin.

### §7 Human timing: the cancel dash's next `C` is held (Nate, 2026-10-16)

- **How the CDC is played** (Nate, in game): press `C` and hold it, tap `D` while
  holding, then release. There is ONE press: the `C` after the dash is the same
  hold resuming. For FDC, Nate stepped through Prydwen's demo frame by frame: `C`
  is held BEFORE `D` is tapped. gcsim agrees — the resume's windup skip is its
  `buffered` parameter.
- **So a cancel dash pays no human pad.** The tap itself is still a timed press,
  so the transition into the dash keeps its pad.
- **In Nate's Overloaded rotation**
  (`Mavuika E > Ororon E Q > Chevreuse hE > Iansan E N Q > Mavuika Q CDCDCCF DCDCCF DCDCC FDC`),
  the last DC now stays on the bike up to 10f of padding (last `C` at 1006,
  Blessing ends at 1032). Before the fix it needed 7f.
- ⚓ The 10f default stays: KQM's sourced "starting point", which our model
  already applies only where the game does not buffer.
