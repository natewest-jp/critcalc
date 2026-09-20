# Projectile travel on swings (PLAN, 2026-09-20)

_Status: **PLANNED, not started.** ⚓ Nate's decisions (2026-09-20): travel is a
named **CONSTANT, not a setting** (for now) · a **`projectile` flag** on the
catalyst normals that need one is APPROVED · ⛔ never baked into a `hit` / `lands`
value. Start in a fresh context. Parent: `docs/swing-hitmark-round.md` §4.4._

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
⚠️ Order this round AFTER `docs/multi-hit-swings-round.md` or before it, not
during: both rewrite `landSwing`.
