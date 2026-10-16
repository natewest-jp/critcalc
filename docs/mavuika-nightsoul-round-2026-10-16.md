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
