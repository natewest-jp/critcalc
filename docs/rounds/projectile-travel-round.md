# Projectile travel on swings (PLAN, 2026-09-20)

_↻ Status: **SHIPPED 2026-09-21 — §6 is the record and wins over §1–§5.** Originally: PLANNED, not started. ⚓ Nate's decisions (2026-09-20): travel is a
named **CONSTANT, not a setting** (for now) · a **`projectile` flag** on the
catalyst normals that need one is APPROVED · ⛔ never baked into a `hit` / `lands`
value. Start in a fresh context. Parent: `docs/rounds/swing-hitmark-round.md` §4.4._

## 1. Why

Today a ranged CAST lands with travel and a bow SWING lands without, because the
two were authored from differently-configured captures:

- **Casts carry it.** E/Q captures do not pin gcsim's `travel`, so `application[]`
  frames include gcsim's per-ability estimate. Pinning them moves **39 captures
  across 13 characters**: Itto E 4f · Aloy, Tighnari, Emilie, Escoffier 5f · Cryo
  Traveler 9f / 6f · Diona, Dori, Ororon 10f · Layla Q 22f · Mizuki E 30f ·
  **Mualani Q 70f** (a homing missile — that flight is real). Summon ticks carry it
  too, deliberately (Oz's `ozTravel`, Emilie's 5f, the Cryo Traveler's 9f).
  ⛔ **Do not strip it from casts.**
- **Swings do not.** The dumper pins `travel: 0` on every swing capture (§1.K stage
  2), so a bow's `hit` is its RELEASE frame. Measured: all 94 bow normals at Δ0.

So the consistent model adds travel to projectile swings. The alternative —
removing it everywhere — makes Mualani's burst land 70f early.

## 2. What gcsim exposes

|           | takes a `travel` param                                                       | default                           |
| --------- | ---------------------------------------------------------------------------- | --------------------------------- |
| Bows      | 20 of 21                                                                     | 10f (107 captures, no exceptions) |
| Catalysts | **9 of 28** — Citlali, Klee, Ningguang, Kokomi, Xianyun, Yae, Yanfei, Mizuki | 10f                               |
|           | Wanderer                                                                     | 5f                                |

The other 19 catalysts either punch (Heizou, Wriothesley) or fold their flight
into the hitmark constant, where it cannot be separated — their `hit`/`lands`
already include it and they must NOT be flagged.

## 3. The design

- **The kit fact, in data.** `NormalAbility.projectile: true` on the nine
  catalysts' normal abilities (and their stance siblings — Wanderer's Kuugo,
  Xianyun's two chain forms). Bows are projectiles by RULE, the same kind of
  near-universal census `resolveActionIcd` already holds for plunges; ⚠️ check
  the 21st bow (it took no param — likely uncovered, not melee) before writing
  the rule as `weapon === 'bow'`.
- **The assumption, in the engine.** `PROJECTILE_TRAVEL_F = 10` — one named
  constant (memory `feedback_expose_tuning_knobs`), added to the landing frame in
  `landSwing` for a projectile swing. It is gcsim's default and the same figure
  our cast data already carries. ⚠️ Wanderer's 5f becomes 10 under one constant;
  accept it or make the flag a number — ⏭ Nate, only if it shows.
- ⛔ Not a `siteSettings` control yet (⚓ Nate). If it becomes one, the precedent
  is Human timing: never in a character JSON, never in `?r=`.

## 4. The engine question — a landing AFTER the swing

This is what makes it a round. A bow N1 cancelled at its release frame lands 10f
INTO the next action — or after a swap. §1.K's `landSwing` refuses any landing at
or past the swing's end and falls back to the synchronous path, and its closure
uses the on-field character's live stack pool, "sound only because the landing
is inside the swing". With travel, most cancelled bow swings land outside.

- The task must be schedulable past the swing's end (the clock allows it; the
  refusal is `landSwing`'s own guard).
- A landing after a SWAP has no on-field pool to write. The summon-tick
  dispatchers already solve exactly this: they are handed a NULL segment pool and
  only rotation-scoped keys are writable. ⚠️ Decide it explicitly — ⛔ never hand
  the closure the NEW on-field character's pool "so it works".
- The state snapshot: a normal's landing uses its token-start states. A landing
  that arrives after the character's stance ended is still that swing's hit.
- ⚠️ Feed order = time order is pinned corpus-wide; a task on the queue keeps it.
- ⚠️ `source: 'active'` filters read `viaEntity`; a late arrow is NOT an entity
  hit, but its shooter may no longer be active. Measure what an `onReaction`
  effect with that source does with it before deciding.

## 5. Measure first

Digest against `out/k-data.json`. Expect every bow's normals to move +10f and the
nine catalysts' likewise; anything else moving is a finding. The digest rotation
has bow partners nowhere and no `A` — add a bow leg or measure at the site.
⚠️ Order this round AFTER `docs/rounds/multi-hit-swings-round.md` or before it, not
during: both rewrite `landSwing`.

## 6. What shipped (2026-09-21)

On `feat/projectile-travel`, the same day as the two rounds that rewrote
`landSwing` before it (`docs/rounds/cast-hit-record-round.md`,
`docs/rounds/multi-hit-swings-round.md` §7) — which is why §4 was small.

- **`PROJECTILE_TRAVEL_F = 10`** and **`projectileTravelOf(weapon, normal, cls)`**
  in `$lib/utils/frames.ts`. Bows fly by RULE — normals and charged/aimed shots,
  ⛔ never the plunge. §3's "21st bow" is Linnea, who is simply not in gcsim; all
  20 gcsim bows take the parameter, so the rule is `weapon === 'bow'`.
- **`NormalAbility.projectile: { normal?, charged? }` states the EXCEPTIONS, both
  ways**, and ↻ it is PER CLASS, not the single flag §3 sketched: all nine
  catalysts take `travel` on their normals, only FOUR on the charged attack
  (Citlali, Klee, Ningguang, Xianyun). `false` is a bow in a melee stance —
  Tartaglia's Foul Legacy, the one holder. Lint A.4d refuses a value that
  restates the rule (`true` on a bow, `false` off one), so the field cannot
  drift into a mass annotation. 11 abilities in 10 files (Wanderer's Kuugo form
  included). ⚠️ Wanderer is 5f in gcsim and 10 here — §3's accepted divergence.
- **`landSwing` takes `travel`.** A projectile landing is ALWAYS a task: release
  (`min(frame, swing end)` — a cancel cannot un-fire an arrow, only hurry it; an
  unmeasured map releases at the end) + travel. It composes with the landing
  lists: each hit of a multi-hit arrow swing flies on its own.
- **§4's question was already answered.** A landing after the shooter's TURN ends
  takes Phase A's off-field path unchanged: `liveSegment`, the null stack pool,
  `HitEvent.offField`, refused by `source: 'active'`. `onReaction`'s `active`
  needed nothing — `takeReactionProcs` already compares the applier to
  `ctx.activeCharId`. The closure keeps its token-start states (a late arrow is
  still that swing's hit).

### 6.1 Measured

Same probe as the two rounds before it (1504 digests, five rotations, every
character as the subject at C0 and C6).

- **Exactly the 30 expected characters moved — 21 bows + 9 catalysts — and nobody
  else.** 278 digests. Their swing applications shift +10f (Klee 189 → 199,
  335 → 345, …).
- Every application or reaction GAINED or LOST is downstream of that shift:
  a partner's cooldown re-phasing (C6 Faruzan's own Collapse loses one fire in
  R1 — the hit that used to find her 3s cooldown 4f clear now finds it 17f
  short) or an aura arriving on the other side of a teammate's application
  (Klee's orb now lands after Xingqiu's Hydro: +1 vaporize).
- ⚠️ **The oracle cannot adjudicate.** Its one flagged-catalyst fixture is
  Ningguang, and gcsim rolls her normal-attack variants per run — its own rows
  move by more than the 10f in question between two runs of the same commit.
  Summary counts are unchanged.

Gates: vitest 1957 · check · lint · build green; e2e in the merge commit.

### 6.2 Open

- ⏭ Nate, only if it shows: Wanderer's 5f (make the flag a number), and whether
  10f ever wants to be a setting.
- A swing cancelled BEFORE its release frame still fires its arrow (at the
  cancel). In game the arrow is never loosed; the notation cannot say which the
  player meant, and this is the placement the model always had, plus the flight.
- Casts keep gcsim's per-ability travel inside `application[]` (§1) — untouched.
