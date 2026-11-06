# Witch's Revelation against gcsim: Mizuki, Diona, Cyno, and Nicole's A1 (2026-11-06)

**Status:** on `data/revelation-gcsim`, not merged. First of three stacked rounds in one unattended run (then `data/kokomi-a1-refresh`, then the Mitya and Valeriy ingest). Copy and visual calls below wait for Nate.

gcsim implemented four Witch's Revelation kits since our 2026-07-29 wiki authoring: Mizuki (#3208), Diona (#3254), Cyno (#3250, fixes #3263/#3264), plus Nicole's A1 self-exclusion (#3259) and Varesa's Kablam cooldown (#3255). Each was read against its gcsim diff and the current Fandom `|buff` text (MediaWiki API) before anything was written. Where they disagree, the reason is stated below.

## 1. What changed

**Diona** (`diona.json`)

- **C6 Radiance splits by enabler.** The wiki and gcsim now give two branches: Radiance: Stellar-Conduct (Superconduct + Stellar-Conduct +40%) and Radiance: Stellar Swirl (Cryo Swirl + Stellar Swirl +40%). Cryo Swirl moved from the Stellar-Conduct gate to `teamEnablesReaction: stellarSwirl`, and a Stellar Swirl line was added. With Vesna (Stellar Swirl only), C6 used to draw nothing; it now draws the two Swirl lines.
- **Choice Treasures' paws are authored.** Within 20s of the skill, a party Superconduct, Stellar-Conduct, Cryo Swirl or Stellar Swirl fires three Icy Paws, once per 3.5s. gcsim gives each paw 1U Cryo (Durability 25, standard ICD), so they are an aura-lane pixel, which overturns the 2026-08-19 "no source gives these paws a gauge". Authored as an armed `onReaction` damage proc on the skill and its Hold variant (Nahida's Tri-Karma shape: `armedFor: 20`, `procCooldown: 3.5`, three landings at +10/11/12f, one applying). Stellar Swirl joins the passive's description (wiki text).

**Mizuki** (`yumemizuki_mizuki.json`)

- **C2's Revelation RES shred.** −20% Pyro, Hydro, Cryo, Electro and Anemo RES while Dreamdrifter lasts (gcsim re-applies every 0.7s while the state is live). Five `onState: inStance` shreds sharing `mod: mizukiC2Revelation`, the Mavuika pattern, so the bar is the stance's own span with A1's extensions and an early end included. It also appears as a source in the Visualizers' Enemy RES & DEF (generated `shredSources`).
- **C6's Revelation CRIT.** 0.04% CRIT Rate and 0.16% CRIT DMG per EM above 500, up to 20% / 80%, as two passive scaling buffs (`offset: 500`, `cap`). ⚠️ gcsim writes `max(…, 0.8)` and `max(…, 0.2)`, which turns the caps into floors; that contradicts the text and reads as a slip, not in-game testing, so we follow the text. Possibly worth an upstream report (Nate's call: it's public).
- **The drift cloud's cadence:** 45f → 44f ("14 ticks per skill"). 14 entries at 48 + 44k; the frames audit's capture now matches at +48, +92, … +312.
- **C4** gains the Revelation heal in its description only; snack pickups are not modelled.
- C2, C4 and C6 descriptions now carry the Revelation (`|buff`) text, as Cyno's do.

**Cyno** (`cyno.json`)

- **Pactsworn N4's `hit` 5 → 14**, through `migrate-frames-shape.mjs --char cyno` (gcsim builds the cancel slice off the second hitmark). The audit's one new disagreement is gone.
- The rest **agrees** with our authoring and is recorded in the Revelation passive's notes: the skill-opened 6s Pactsworn that can't be extended, Endseer inside it, the Polestar-gated Radiance, 0U Starsame bolts, C1's length (712f = our 11.87s) and its hand-off on swap, C4's 20 Energy / 18s.

**Nicole** (`nicole.json`)

- **A1's Guidance landed on Nicole herself.** Our active-target buff drew it on her own on-field segment after the 3s wait; the kit says "other" members and gcsim #3259 refuses Nicole explicitly. Fixed with `state: offField` on the A1 effect and on C4's Pathfinder's Blessing (granted by the same upgrade). No new primitive: an active-target slice already gives the holder's field fact per segment, so `offField` reads as "the receiver isn't Nicole". Her A4 self-Guidance is untouched.

**Varesa:** a dated note beside the Kablam note, saying gcsim #3255 now agrees with our `bypassesCooldown`.

## 2. Tests

- `src/lib/sim/procs.test.ts`, Diona's Choice Treasures end to end: no fire without a reaction; a Superconduct she didn't cause fires one applying paw at +10f; Hold carries it; the 20s window opens at the cast and closes.
- `src/lib/utils/buffWindows.test.ts`: Diona C6's split (Vesna draws the two Swirl lines; Sandrone all four); Mizuki C2's shred is one bar of five elements co-extensive with the stance (600f with A1, the trailing `~2s` end, absent at C1); Nicole's A1 reaches the teammate and not Nicole. The Nicole and Vesna cases failed on the old data.
- `notationParser.test.ts`: Mizuki's last applying cloud moves 588 → 576 (the 14th lands at 620 inside the 72f timer).

Gates: Vitest 2804 passed · svelte-check 0 errors · lint clean · build · Chrome e2e 73 passed.

## 3. Not done, on purpose

1. **Cyno: Together We Rise from the skill-opened Pactsworn** (gcsim `c1RevelationOnPactsworn(379)`). An `onState: inStance` trigger would cover both openings, but the onState pass refuses active-target buffs (`buffWindows.ts`, `isActiveTargetOnly`), and the state ends at Cyno's swap, which is exactly when the buff should pass to the incoming character. Options: (a) let the onState pass slice active-target buffs and add a "carry on swap-out" rule; (b) an `onCast skill` effect gated on "not already in the stance" at the press, which needs the pre-cast state snapshot to answer; (c) leave it as an omission. **Recommendation: (c) for now.** It is an under-claim (no bar, so nothing on screen is wrong), and (a) is a new rule worth a round of its own.
2. **Cyno C2's Stellar-Conduct stacks** stay stacked-at-max (the 2026-07-29 precedent). gcsim builds 16% per Normal/Charged hit, up to 5, and never resets the count between windows (a gcsim quirk, not followed).
3. **Mizuki C4's heal** waits on snack pickups, like its energy.
4. **A narrower Radiance gate.** An `inPolestarField` condition now exists (`sim/conditions.ts`). Cyno's and Diona's Radiance clauses still use `teamEnablesReaction`, which their caveats call broader than the field. Moving them onto `inPolestarField` is a follow-up worth weighing; it changes when bars draw.

## 4. Copy for Nate (proposals, not landed)

1. **Diona C6's caveat is now stale.** ✅ Nate 2026-11-06: deleted, no replacement. It says the three Reaction Bonus lines draw "whenever a teammate enables Stellar-Conduct". Proposed: "The Elemental Mastery and Incoming Healing bars are drawn together, the Superconduct and Stellar-Conduct lines whenever a teammate enables Stellar-Conduct, and the Cryo Swirl and Stellar Swirl lines whenever one enables Stellar Swirl. In game a character gets only the one their HP qualifies for, the Reaction Bonus lines also need the matching Radiance, and all of them need standing inside the burst's radius."
2. **Mizuki C6's `notModeled` line was removed** (✅ Nate 2026-11-06: no replacement) ("The Rotation Planner doesn't draw damage amounts, and this only lets Swirl damage land critical hits."). Lint refuses `notModeled` beside authored effects, and the line was no longer true. The Swirl-crit half has no pixel, so no replacement is proposed. Say if you want one.

## 5. For Nate's eye

1. Mizuki at C2: a new debuff bar spanning Dreamdrifter (planner), and a new row in the Visualizers' Enemy RES & DEF sources.
2. Diona with a Superconduct or Cryo Swirl partner: an extra Cryo application on the aura lane within 20s of her skill.
3. Diona C6 with Vesna: the Cryo Swirl and Stellar Swirl lines, and no Stellar-Conduct lines.
