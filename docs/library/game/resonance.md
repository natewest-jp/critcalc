# Elemental Resonance

**Sources:** gcsim `SetupResonance` and `updateGeoResonance` in
`pkg/simulation/setup.go` (checkout `fcc117b31`, 2026-10-28); our own
`src/lib/utils/resonance.ts` (the facts the tools show, KQM-aligned). KQM's page,
<https://library.keqingmains.com/combat-mechanics/elemental-effects/elemental-resonance>,
was not re-fetched for this doc.
**Game version reflected:** 6.x and the 7.x Stellar reactions, which gcsim already wires into
the Electro, Dendro, Cryo and Geo resonances.
**See also:** [`elemental-reactions.md`](elemental-reactions.md) §6 (the stub this replaces),
[`energy-and-particles.md`](energy-and-particles.md) (High Voltage's particle),
[`damage-formula.md`](damage-formula.md) (which bucket each bonus lands in).

> KQM is the strongest player-side authority but not ground truth (see the library
> [README](../README.md)). gcsim implements most of each resonance, not all of it; the
> parts it leaves out are marked below. `⚠️ NEEDS-CONFIRM` marks anything unsettled.

## What resonance is

A team-composition passive: the party's elements, counted once at setup, grant bonuses to
the whole party for as long as it stands.

- **Two characters of one element** grant that element's resonance. Two pairs grant both.
- **A full party of four** is required. gcsim returns early with fewer than four characters
  (`if len(chars) < 4 { return }`).
- **Four different elements** grant Protective Canopy. ⚠️ **NEEDS-CONFIRM:** gcsim has no
  Protective Canopy case at all; the figure below is `resonance.ts`'s.

gcsim counts `c.Base.Element`, each character's own element, and adds every resonance as a
permanent modifier (`modifier.NewBase(…, -1)`), except the conditional parts noted below.

## The eight resonances

Figures are gcsim's unless the row says otherwise. Every gcsim percentage is a fraction in the
source (`0.25`); it is written here as a percent.

| Resonance              | Element | What gcsim applies                                                                                                                                                                                                                                                                                                 | Not in gcsim (from `resonance.ts`)                                               |
| ---------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| **Fervent Flames**     | Pyro    | ATK +25% (`ATKP = 0.25`), party-wide                                                                                                                                                                                                                                                                               | Cryo aura duration −40% ⚠️                                                       |
| **Soothing Water**     | Hydro   | Max HP +25% (`HPP = 0.25`), party-wide                                                                                                                                                                                                                                                                             | Pyro aura duration −40% ⚠️ (gcsim: `TODO: reduce pyro duration not implemented`) |
| **Shattering Ice**     | Cryo    | CRIT Rate +15% (`CR = .15`) against an enemy whose aura contains Cryo or Frozen. A separate hook adds the same 15% to Lunar-Charged hits (`cryo-res-lunarcharge`)                                                                                                                                                  | Electro aura duration −40% ⚠️                                                    |
| **High Voltage**       | Electro | One Electro particle, at most once per 300 frames (5s), on Overload, Superconduct, Stellar-Conduct, Electro-Charged, Lunar-Charged, Quicken or Aggravate against an enemy, or on Hyperbloom against anything                                                                                                       | Hydro aura duration −40% ⚠️                                                      |
| **Impetuous Winds**    | Anemo   | Stamina consumption −15% (`AddStamPercentMod`, `-0.15`); cooldowns −5% (`CooldownMod`, `-0.05`)                                                                                                                                                                                                                    | Movement speed +10% ⚠️ (gcsim: `TODO: movement spd increase?`)                   |
| **Enduring Rock**      | Geo     | Shield strength +15% (`AddShieldBonusMod`, `0.15`). While the active character is shielded, or stands within 16 (gcsim distance units) of a Lunar-Crystallize Moondrift: that character's DMG +15% (`DmgP = .15`), and its hits lower the enemy's Geo RES by 20% for 15s (`-0.2`, `15*60` frames, hitlag-extended) | —                                                                                |
| **Sprawling Greenery** | Dendro  | EM +50, party-wide. Then +30 EM for 6s after Burning, Bloom, Lunar-Bloom or Quicken on an enemy, and +20 EM for 6s after Aggravate or Spread on an enemy, or Hyperbloom or Burgeon on anything                                                                                                                     | —                                                                                |
| **Protective Canopy**  | (none)  | not modelled                                                                                                                                                                                                                                                                                                       | All Elemental and Physical RES +15% ⚠️                                           |

Details that are easy to miss:

- **Enduring Rock is polled, not evented.** `updateGeoResonance` re-checks the active
  character's shield (and the Moondrifts) every 60 frames, and immediately on a swap, a new
  shield or a broken one. The DMG bonus and the shred belong to the active character only
  (`s.Player.Active() == c.Index()`).
- **Sprawling Greenery's two boosts stack.** gcsim keeps them under separate modifier keys
  (`dendro-res-30`, `dendro-res-20`), so both can run at once on top of the 50.
- **Impetuous Winds' −5% reaches every cooldown gcsim's template sets.** Its `CooldownMod`
  returns `-0.05` for any action, so it shortens a Burst cooldown as well as a Skill's.
  ⚠️ **NEEDS-CONFIRM:** the planner applies it to Skills only (see below); which is right is
  a game question, not settled here.
- ⚠️ **The −40% aura durations, the +10% movement speed and Protective Canopy's +15% RES**
  come from `resonance.ts`, which was written KQM-aligned but cites no page. None is in
  gcsim. Re-check them against KQM before relying on them.

## → Schema mapping & current state

Resonance is **not authored in the character data**: there is no resonance `Effect`, and
nothing in the corpus names one. It is derived from the four slots' elements by one
module, `src/lib/utils/resonance.ts` (`deriveResonances`), which every surface shares.

- **The Team Builder** (`TeamDetail.svelte`, the lineup board's `CompositionChips.svelte`,
  and the swap diff in `builder/lib/team.ts`) shows the active resonances as facts, label and
  effect, never as a verdict. It keeps the full-party rule: fewer than four filled slots
  shows none.
- **The Rotation Planner** shows them as always-on chips under the chart
  (`TeamBonusesBlock.svelte`), and drops the full-party rule (`requireFullParty: false`,
  ⚓ Nate 2026-07-19): a pair resonates even with blank example slots. Protective Canopy
  still needs four distinct filled slots.
- **Only Impetuous Winds reaches the sim.** `notationParser.ts`'s
  `teamSkillCooldownModifiers` turns it into a −5% `CooldownModifier`, which
  `sim/resolve.ts` prepends to each **Skill**'s own cooldown modifiers (not Bursts'). It
  runs on the characters the notation names, again without the full-party rule (⚓ Nate
  2026-09-18: a two-character rotation is a four-character party with two seats unwritten).
- **Everything else is display only.** The ATK, HP, CRIT Rate, EM, DMG and shield bonuses
  draw no buff row, because the tools draw windows rather than damage. High Voltage's
  particle is outside the model, like all energy
  ([`energy-and-particles.md`](energy-and-particles.md)). The aura-duration reductions would
  matter to the gauge, and are not modelled there.

## Curator signal

There is nothing to author per character: resonance follows from `element`, an identity
field. A kit line that changes resonance itself would be new schema; flag it rather than
approximating it with a `buff`.
