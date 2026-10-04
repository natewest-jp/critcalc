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

## 4★ pity and the featured 4★ (modeled since 2026-10-04)

| pulls since last 4★ | P(4★ this pull)  |
| ------------------- | ---------------- |
| 1–8                 | 5.1%             |
| 9                   | 56.1%            |
| 10                  | 100% (guarantee) |

- Character banner table above (wiki `Character_Event_Wish` § Rates, from the
  9.45M-wish community estimate; GGanalysis `PITY_4STAR`). Weapon banner: 6.0%
  per pull, 66% at 8, 100% at 9 (`PITY_W4STAR`; not modeled).
- **Featured rule (official):** a 4★ is one of the three featured characters
  with 50%; losing makes the next 4★ featured. **Which of the three is
  unpublished** — the community model (GGanalysis
  `up_4star_specific_character`, `pick = 1/3`) splits evenly. ⚓ Nate,
  2026-10-04: we take the even split as given.
- ⚠️⚠️ **The featured three are NOT in the banner's off-rate pool.** Every
  4★ character joins the standard pool one version after its debut, but a
  banner's own Wish Pool lists its non-featured 4★s WITHOUT the featured three
  (e.g. Surging Ballad 2026-09-23: Diona, Faruzan, Chongyun featured and absent
  from `character_4`). So a lost 4★ 50/50 never yields a featured character on
  its own banner. (GGanalysis's header worries about the opposite; on the event
  banner it cannot happen.)
- **A 5★ does not reset the 4★ counter** (official), so a 5★ landing on the
  10th pull pushes the 4★ to the 11th. Not modeled; measured +1 pull (0.4%) on
  4★ C6 from nothing.

## Copies (constellations, refinements)

- C6 = 7 copies, R5 = 5. Every target is one chain — pity × guarantee × copies
  — walked a pull at a time (`copiesCdfs` in `visualizers/lib/wish.ts`).
- Multiple 5★ copies take each 5★ as an independent 55%. GGanalysis's
  conservative Radiance counter (`CR_P = [0, 0, 0, 1]`) differs by <1% at C6
  (637.1 vs 632.3 mean pulls) — the truth sits between.
- A character and their weapon: separate pities, so the pulls ADD
  (convolution); the combined curve assumes you stop each banner at its goal.
- Reference means from nothing (GGanalysis, matched to 2 dp in
  `wish.test.ts`): 4★ C0 34.4 · 4★ C6 241.1 · 5★ C0 90.3 · 5★ C6 632.3 ·
  R1 86.5 · R5 432.7.

## Modeling guidance (what the Wish Odds instrument does)

- Drop-timing pmf: exact pity tables above, from the player's current pity.
- A goal of N more copies: the copies chain above, for each level on the way.
- Not in the curves: Starglitter shop copies, event freebies, and pulls on
  banners that don't feature the goal — the player sets what they own.
