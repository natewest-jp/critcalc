# Energy & Particles

**Sources:** KQM — <https://library.keqingmains.com/combat-mechanics/energy>
(fetched 2026-07-14).
**Game version reflected:** 6.x (energy mechanics are edition-stable).
**See also:** [`snapshotting.md`](snapshotting.md), [`icd.md`](icd.md).

> **Status: REFERENCE ONLY — not modeled by our tools, by design.** This doc exists
> so the mechanics are written down and so curators know _why_ energy is out of scope,
> not because any tool simulates it. See → Schema mapping for the boundary.

> KQM is the strongest player-side authority but not ground truth (see the library
> [README](../README.md)). gcsim is a second source. Reconcile divergences deliberately;
> `⚠️ NEEDS-CONFIRM` marks anything unsettled.

## Why this is reference-only (read first)

Energy generation is fundamentally **unmodelable with our current tooling**, for three
independent reasons (Nate's call, 2026-07-14):

1. **RNG** — Normal/Charged attacks only have a _chance on hit_ to grant flat energy, and
   per-character particle generation has variance in count and timing.
2. **It requires hitting enemies** — an Elemental Skill generates particles only when it
   _hits an enemy_. Our tools model rotations and timelines; they have no enemy and no
   hit-connection model, so there's nothing to hang particle generation on.
3. **It's runtime-dependent** — energy actually gained depends on each character's Energy
   Recharge and the party composition (on/off-field, party size), which the planner does
   not resolve.

So we **document** the mechanic and can **label** notorious energy-granters (see → Schema
mapping — the derived `energy` capability), but we do **not** simulate energy income. We
can say "this character is a battery"; we cannot say "how much energy it makes."

## The two sources: particles & orbs

| Source             | Base energy |
| ------------------ | ----------- |
| Elemental Particle | **1**       |
| Elemental Orb      | **3**       |

- **Elemental Skills** generate particles **on hitting an enemy** (exceptions: e.g.
  Barbara, Noelle skills). Particle counts are per-character (external spreadsheets).
- **Enemies** drop particles/orbs at set HP thresholds.
- **Normal/Charged attacks** have a _chance on hit_ to give the **on-field** character
  ≈1 **flat energy** (each multi-hit counts individually). Flat energy is **not** affected
  by ER and only benefits the active character.

## Conversion: element match × field status × party size

Energy actually received per particle/orb, before ER (the KQM table, exact):

| Field     | Party | Type      | E. Particle | E. Orb | Clear Particle | Clear Orb |
| --------- | ----- | --------- | ----------- | ------ | -------------- | --------- |
| On-field  | —     | Same el.  | 3.0         | 9.0    | 2.0            | 6.0       |
| On-field  | —     | Diff. el. | 1.0         | 3.0    | 2.0            | 6.0       |
| Off-field | 4-man | Same el.  | 1.8         | 5.4    | 1.2            | 3.6       |
| Off-field | 4-man | Diff. el. | 0.6         | 1.8    | 1.2            | 3.6       |
| Off-field | 3-man | Same el.  | 2.1         | 6.3    | 1.4            | 4.2       |
| Off-field | 3-man | Diff. el. | 0.7         | 2.1    | 1.4            | 4.2       |
| Off-field | 2-man | Same el.  | 2.4         | 7.2    | 1.6            | 4.8       |
| Off-field | 2-man | Diff. el. | 0.8         | 2.4    | 1.6            | 4.8       |

Rules behind the table:

- A particle/orb of **your element** gives **3×** what a different-element one does.
- **Clear** (element-less) particles/orbs give **2×** a different-element one — regardless
  of your element.
- **Off-field penalty:** an off-field unit gains **60% (4-man) / 70% (3-man) / 80% (2-man)**
  of the on-field amount.

## Energy Recharge (ER%)

ER% multiplies energy gained from **incoming** particles/orbs. It does **not** change how
many particles a skill generates, nor flat-energy sources. No soft cap — tested effective
to 300.1%.

## Flat-energy sources (bypass particles)

- **Weapons:** Favonius series (3 Clear particles on proc, ER-affected); Prototype Amber,
  Amenoma Kageuchi, Katsuragikiri Nagamasa, Kitain Cross Spear (flat energy to the
  **wielder only**).
- **Artifacts:** 4-pc Scholar and The Exile (flat energy on passive condition).

## Funneling

Because off-field collection is penalised, **collect particles on the intended burst user
while they're on-field** to maximise their energy. This is a rotation/positioning concern,
not something our timeline expresses.

## → Schema mapping & current state

**Energy income is not modeled** — no particle/orb simulation, no enemy or hit-connection
model, and ER/party effects are unresolved at plan time. What we _do_ capture is the
identity/labeling layer:

- **`type: 'energy'` Effect** (`amount: number`) — a **flat/direct energy grant** to team
  or self (e.g. Raiden's Burst energy restore, Sara). Feeds the derived **`energy`
  capability** (`deriveCapabilities.ts`), which the Team Builder can surface as a facet /
  badge — this is the "battery" label the tools _can_ make.
- **`energyCost`** (required on Burst) — display only; casts are **not** gated by an
  accumulated-energy model (Q availability is a cooldown, not an energy simulation).
- **`caveatMode` runtime-dependent value** (`ability.ts`) — the escape hatch for values
  that depend on a character's ER or energy cost, shown verbatim in tooltips rather than
  computed.
- ⚠️ **Gap — particle-based batterying isn't represented.** The `energy` capability only
  fires on _flat/direct_ energy grants. A character who batteries via **particle
  generation** (the more common mechanism — high-particle skills) has no data flag today.
  If we ever want to label particle batteries, it would be a deliberate hand-annotation to
  design, not something derivable from the current effect set.

## Curator signal

- Ability grants **flat/direct energy** to the team or self → `type: 'energy'` effect with
  `amount`.
- Particle generation, ER interactions, funneling → **document in `caveat` / `_curatorNotes`**;
  never invent particle counts or imply the tool computes income. `~?` any unknown.
