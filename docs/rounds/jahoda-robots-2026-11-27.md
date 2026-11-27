# Jahoda's robots — absorption under Ascendant Gleam (2026-11-27)

**Status: ✅ built** on `feat/jahoda-robots`. Nate: continue absorption with Jahoda (`launch-roadmap.md` § Engine and data leftovers; `summon-tick-gaps-round.md`, Jahoda), and draft What's new for the absorption batch already merged.

## What gcsim does (at 41bfe4915)

- **`burst.go`.** The robots' damage exists only at `GetMoonsignLevel() >= 2`. Each robot gets its own `absorbCheckTask`: first at 6f + 41f × robot, then every `int(robotHitmarkInterval / 3)` (46f; 42f under A1 Cryo) until it finds Pyro > Hydro > Electro > Cryo on an enemy in range, or the burst's 790f status ends. On the lock, `robotAtkTick` fires 41f later and every `robotHitmarkInterval` (140f; 126f under A1 Cryo) while the status lasts. Durability 25, `ICDTagElementalBurst<El>` on `ICDGroupJahodaBurst` (900f, every 4th, five 1s in the list), FlatDmg `burstSkill` × ATK: 31.08% at talent 10. It hits the three closest enemies.
- **`asc.go` A1.** At init, the element most party members carry (strictly most, ties by P > H > E > C, none → nothing): Pyro ×1.3 robot DMG, Hydro ×1.2 heal, Electro +1 robot, Cryo interval × 0.9. **`cons.go` C2** (under Gleam) adds the runner-up among the rest. **C4** gives +4 Energy at each robot's lock.

## What we built

- **`summonTick.ownLock`** (`AbsorbSpec`): a series' own lock in place of the summon's `absorbs`, polled only if the series passed its conditions, on key `<summon key>#<series index>`. Marks still publish under the summon's window. A robot's lock is not published as `CastEvent.absorbed` (nothing reads it there: C4's energy is not modelled).
- **`summonTick.icdPerElement`**: the named `icdCounter` split by the element each tick lands in, so two robots on Pyro share one window and a Pyro and a Hydro robot keep two.
- **`teamElementRank {order, element, rank: 1 | 2}`**: A1's pick (rank 1) and C2's runner-up (rank 2), holder-excluded like `teamElementCount`. Evaluated in `sim/conditions.ts` and, as the `elementRank` team need, in `deriveCapabilities.ts`; `teamNeeds.test.ts` pins the twins.
- **Lint.** D.37b: the condition's shape. D.54: `ownLock` only on an absorbed series of a summon without `absorbs`; `icdPerElement` needs `absorbed` and `icdCounter`; an absorbed series needs `absorbs` or `ownLock`.
- **Team Builder.** A summon's off-field damage now carries each damage series' own conditions (one source per series). Before, `pushSummonCapabilities` ignored them, which would have lit Jahoda's off-field damage in every team. Aino is the only other entry that moved, and it reads the same (her pair covers both sides of Gleam).
- **Data.** Six absorbed streams on the robots' summon: robots 1, 2 and 3 (first poll 6, 47, 88f), each under the 140f cadence and the A1 Cryo 126f one, with mutually exclusive conditions (the house form for a cadence change). Robot 3 needs A1, or C2, on Electro. Shared gate `icdGate {timer: 900, every: 4, cap: 5}` on counter `robots`, per element. The old curator note's 172.66% was `burstSkill[0]` misread; level 10 is 31.08%.
- **Not authored:** A1 Pyro's ×1.3 and Hydro's ×1.2 (a figure, not a frame); C4's Energy; the three-target spread (one target here).

## Tests

`sim/jahodaRobots.test.ts`: no robots without Gleam; two robots' landings and which hits apply (1st, 5th, 9th); A1 Electro's third robot and the cap of five; A1 Cryo's 126f; C2 with Electro first and Cryo second, against C0; two elements keeping two windows (synthetic: robot 2 narrowed to Electro on an Electro-Charged target, because after the first poll robot 2 polls one frame after robot 1, so real play almost never locks two elements; the test fails with the split switched off); and `teamElementRank`'s ties, absences and missing scope. `teamNeeds.test.ts`: Jahoda's off-field damage lit with a second Moonsign member, not without.

## What to look at

On `Bennett E > Jahoda Q ~13s` with Flins and Ineffa, the robots' row turns Pyro from 0.78s after the burst, with stubs every 2.33s from three robots (0.78s, 1.47s and 2.15s after the cast, then repeating), and five Pyro applications on the aura lane. Swap Flins and Ineffa for two non-Moonsign characters and the row keeps its heal ticks only, as before. On `Kaeya E > Jahoda Q ~13s` with Rosaria and Lauma (Cryo leads), the gap is 2.1s. The heal markers are unchanged in every team.

## What's left

- ✅ **The flask** is built: `jahoda-flask-2026-11-27.md`. The brief as queued: ⚓ Nate 2026-11-27: players mostly wait for the flask to fill, since it is her main gimmick, so model the fill and gcsim's E re-press exit, and no attack exit. What gcsim does: Shadow Pursuit starts 30f after the press for up to 334f. The flask polls from 37f every 30f, P > H > E > C with the locked element first, +20 for the locked element and +10 for another, so a steady aura fills it at 157f and drains 4f later (Filled Treasure Flask, Anemo). The unfilled drain is at the stance's end or 4f after an E re-press. Under Gleam a full flask fires 10 Meowballs in its element, the first 129f after the drain and then every 116f, ICDTagNone, landing 13f after each (`travel`), and C6 opens at the drain (+5% CRIT Rate, +40% CRIT DMG to Moonsign members, 20s). Her cooldown starts at the stance's end. Nothing but an E re-press can start while the stance runs. Today the planner draws the full 6.07s, lets an N1 follow at 43f, and lands the drain at 368f even after a swap. The engine piece is a stance whose end comes from the live gauge. C1's bounce stays out (a coin flip).
- **`holdsField` for Jahoda** (the Mizuki round's F7) is covered by the flask's hold; Wanderer's half stays open.

## What's new (✅ approved by Nate, landed with Japanese and Chinese)

One entry for 2026-11-27, covering the merged batch, plus Jahoda once this branch merges:

1. Title → "Elemental absorption for Prune, Wanderer, Sucrose, Kazuha, and Jahoda"
2. → "When Prune's skill triggers Swirl, pressing it again within 6s now casts Clang Clang! Witch-tribution Comes! in the swirled element, and Tolling Rally comes from that hit." (the Prune record's draft, unchanged)
3. → "Wanderer's Jade-Claimed Flower now grants the buffs for the elements his Skill absorbs, up to two. Sucrose's sixth constellation raises the DMG Bonus of the element her Burst absorbs, and Kazuha's Plunging Attack right after his Skill now lands its extra hit in the element the Skill absorbed."
4. → "Under Moonsign: Ascendant Gleam, Jahoda's Purrsonal Coordinated Assistance Robots now attack in the element each one absorbs. Plan to Get Paid adds a third robot when your team leads with Electro and makes them attack faster when it leads with Cryo."
