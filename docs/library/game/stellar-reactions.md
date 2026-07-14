# Stellar Reactions 🚧

**Status:** STUB — Stellar reactions are in **beta**, expected to release ~**2026-08**.
Fill this in from a KQM/official source once live; treat everything below as
**⚠️ NEEDS-CONFIRM** provisional expectation, not fact.
**See also:** [`lunar-reactions.md`](lunar-reactions.md), [`elevation.md`](elevation.md).

## What we expect (per Nate, 2026-07-14)

- Stellar reactions are the **7.x reaction generation**, following the 6.x Lunar
  generation. They are a **new family of damage types**, analogous in structure to
  Lunar reactions.
- **Stellar-Conduct** is the **first** Stellar reaction. Later additions are expected
  (e.g. **Stellar Swirl**) — others unannounced.
- Like Lunar, these are expected to be **enabled by faction/benediction passives** on
  limited (5-star) units of the new generation, and to make those units strong.
- **Elevation** is expected to apply here too: some limited 5-stars will carry
  **elevation** on higher-constellation effects for Stellar damage (same multiplicative
  bucket as Lunar — see [`elevation.md`](elevation.md)).

## Known character touchpoints (pre-release)

- **Sandrone** — her kit references a **Stellar-Conduct** reaction (Polestar Field). Its
  numbers/mechanics are not confirmed; currently stubbed in her JSON with curator notes.

## → Schema mapping (anticipated)

When Stellar-Conduct ships and is confirmed:

- Add `stellarConduct` (and later `stellarSwirl`, …) to the **`Reaction`** union
  (`ability.ts`). This unblocks `onReaction` triggers and `elevate { reactions: [...] }`.
- Extend the elevate display mapping (`effectCollection.elevateReactionToDisplayStat`)
  to the new reactions — currently lunar-only.
- Decide whether Stellar gets its own `*DmgBonus` **Stat** keys (additive bucket) or
  whether the additive bonus is expressed differently.
- Revisit the "no primitive for the multiplicative Reaction Bonus bucket" gap — Stellar
  units may need it too.

_Do not author Stellar mechanics into character data until confirmed from a real source._
