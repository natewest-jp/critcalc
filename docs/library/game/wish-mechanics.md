# Wish Mechanics — pity, soft pity, Capturing Radiance, Epitomized Path

Compiled 2026-07-24 for the Wish Odds instrument. Sources: official HoYoverse
banner details (in-game "Details" text, quoted by the wiki), the Genshin
Impact Wiki (`Character_Event_Wish`, `Wish` — fetched via MediaWiki API), and
**GGanalysis** (github.com/OneBST/GGanalysis, `games/genshin_impact/
gacha_model.py`) — the reference statistical library by the researcher behind
the canonical large-sample soft-pity analysis. Where official statements and
empirical models differ, both are recorded.

## 5★ pity tables (per-pull probability of a 5★)

**Character Event Wish** (and Wish-2; they share one pity counter):

| pulls since last 5★ | P(5★ this pull)                            |
| ------------------- | ------------------------------------------ |
| 1–73                | 0.6%                                       |
| 74 + k (k = 0…15)   | 6.6% + k × 6% (6.6%, 12.6%, … 96.6% at 89) |
| 90                  | 100% (hard pity)                           |

**Weapon Event Wish:**

| pulls since last 5★ | P(5★ this pull)                            |
| ------------------- | ------------------------------------------ |
| 1–62                | 0.7%                                       |
| 63 + k (k = 0…13)   | 7.7% + k × 7% (7.7%, 14.7%, … 98.7% at 76) |
| 77                  | 100%                                       |

⚠️ The weapon banner's official text says "guaranteed within 80"; the
empirical table (GGanalysis `PITY_W5STAR`) reaches 100% at **77**. Both are
true — the datamined ramp simply saturates before the official ceiling.

- Officially published "consolidated" rates (including pity): character 1.6%
  per pull (≈ one 5★ per 62.5 wishes); weapon 1.85%.
- Soft pity itself is **unofficial** — determined by community testing on
  very large samples; the ramp above is the accepted model.
- Pity carries across banners of the same type and never expires; character /
  weapon / standard pities are fully separate.

## Featured-character rules (Character Event Wish)

- A non-guaranteed 5★ is the promotional character with **consolidated
  probability 55%** (official, in banner details since ~5.4). Losing makes
  the next 5★ guaranteed to be promotional.
- **Capturing Radiance** (since 5.0): the mechanism that lifts the old 50/50
  to the 55% consolidated figure. Official facts:
  - Base per-pull probability of a radiance-converted 5★: **0.018%**.
  - If the promotional 5★ was obtained as the second 5★ (i.e. via the
    guarantee) on **three consecutive occasions**, radiance is guaranteed on
    the next 5★ — you cannot lose the "50/50" four times in a row.
  - Radiance does not affect guarantees; it only upgrades non-guaranteed wins.
- ⚠️ The interior counter model (trigger chance at 1/2/3 consecutive losses)
  is **not fully reverse-engineered**. GGanalysis models it conservatively as
  `CR_P = [0, 0, 0, 1]` (trigger only at the guaranteed 3-loss cap) and
  documents that this over-estimates the pulls needed. Any tool should model
  the official 55% consolidated rate and state the counter as unmodeled.

## Featured-weapon rules (Weapon Event Wish + Epitomized Path)

- A non-guaranteed 5★ is from the featured pair with **75%** probability
  (25% standard pool). The two featured weapons split evenly → a specific
  charted weapon is **37.5%** of a non-guaranteed 5★.
- **Epitomized Path (fate points)**: chart a weapon; every 5★ that is NOT
  the charted weapon grants 1 fate point. Since **5.0 the requirement is 1
  point** (was 2 before) — at 1 point the next 5★ IS the charted weapon.
  Worst case: 2 weapon-banner 5★s. Fate points reset when the banner
  changes; the charted weapon can be re-charted.

## 4★ pity (for completeness; not modeled in the instrument)

- Character banner: 5.1% per pull, ~56.1% at pull 9, 100% at 10.
- Weapon banner: 6.0% per pull, ~66% at pull 8, 100% at 9.
- 4★ featured/50-50 rules mirror the 5★ structure at those rates.

## Modeling guidance (what the Wish Odds instrument does)

- 5★-timing pmf: exact pity tables above, from the player's current pity.
- Featured character: `0.55 × first5★ + 0.45 × (first5★ ⊛ second5★-from-0)`
  (or just `first5★` when the guarantee is held). The radiance counter is NOT
  modeled — stated in-app.
- Charted weapon: same shape with 0.375 / 0.625 and the 1-fate-point cap.
