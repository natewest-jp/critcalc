# Ingest Mitya and Valeriy (7.2), and genshin-db 5.2.15 (2026-11-06)

**Status:** on `data/mitya-valeriy`, stacked on `feat/kokomi-a1-refresh`, not merged. Third of three rounds in one unattended run. 7.2 went live on 2026-11-04. Nate supplied the avatars (all three sizes for both).

## 1. Stage 0a: the patch sweep

genshin-db 5.2.14 → 5.2.15. ⚠️ The sweep's auto-detected baseline was 5.2.13 again, because the bump is uncommitted when it runs (the same trap as 2026-09-22), so it was re-run with `--since 5.2.14`. Against the right baseline: **2 added** (Mitya, Valeriy) and **Vodyanitsa revised**: Vodyanitsa's skill (Rechitativ: Sonorous Dawn) and C2 (Echoes That Pierce the Snow). Per the recipe, re-authoring a revised kit is its own round; it is queued below, not done here. Report: `docs/curation/genshin-db-text-diff.md`.

## 2. Stages 0–2: the two characters

Both stubs came from `ingest-character.mjs` and are frameless: gcsim has no source and no PR for either. They are in `FRAMELESS_EXEMPT` and show under "not yet curated" in the Team Builder, the honest bucket. The positional `extraPassives` trap fired on both: Mitya's **Stellar Jubilee: Top-Secret Protocol** (the enabler passive) and Valeriy's **Subzero Conditioning** (his Radiance) were in the sidecar and are pulled into the characters. Stages 1–2 ran as two parallel agents, one file each; I reviewed both diffs. Fandom's 7.2 pages are thin, so the mechanics come from the game's own tooltips via Ambr (`gi.yatta.moe`), cited in each character's `_curatorNotes`.

**Mitya** (5★ Electro Catalyst; `mitya.json`)

- Stellar-Conduct enabler (`enablesReactions: ['stellarConduct']`); the Jubilee passive's party Stellar-Conduct DMG +0.028% per EM, up to 14%.
- Skill: tap spawns **Detection Core: Steady State**, the new Hold variant spawns **Detection Core: Overloaded**, 25s each, ended by recast.
- A1: party EM on a tap, value `unknown` (it is +30 per Gradient Beacon held).
- C1: active CRIT DMG +40% for 25s; 10 Energy per party Stellar-Conduct, once per 8s.
- C2: Cryo and Electro RES −20%; party EM +123 on a tap and active EM +234 on a hold.
- C6: party Stellar-Conduct elevate +20 (like Sandrone's, it reaches no surface yet).

**Valeriy** (4★ Electro Sword; `valeriy.json`)

- Skill: **Supercharged Shield** (376% ATK + 2881, 18s), +40 Impact Momentum (rotation-scoped, max 100; +52, max 130 at C4).
- Direct-Fire Mortar: a Charged Attack at ≥40 Momentum spends it all and grants **Offensive Directive** to the active character for 18s (flat damage at 43.78% ATK on N/C/P/E/Q). That is Shenhe's Icy Quill shape, gated off in Radiance (the Alyosha idiom: a Stellar-Conduct enabler plus a Cryo teammate).
- Burst: **Thunderburst Shells**, 12s, no tick series (no cadence published).
- C1: 6 Energy per mortar, once per 15s (the floor of 6–15). C2: party EM +100 for 18s after the skill.

**Left out on purpose** (each in `_curatorNotes`): Mitya's Gradient Beacon count (its gain rate, spend rate and C6 chance are unstated, so A1's number, A4, C1's cap, C4 and the Gradient Detonation charged attack wait); the Steady Core's damage ticks and the Shells' cadence (no source); Valeriy's A1 and A4 (engine gaps below); his Radiance branch (no stat for flat Stellar-Conduct damage); the 0.8s E/Q → Normal Attack conversion (needs a state); damage-magnitude halves.

**Shared files I changed:** `FRAMELESS_EXEMPT`; `HOLD_TIMING_EXEMPT` gets `mitya:hE`, because the hold resolves (it spawns the other Core) but neither form has frames yet, so their timing matches until gcsim ships Mitya; `ROSTER_SIZE` 127 → 129; capability fixture entries from the agents' research (`scripts/capability-expectations.mjs`); the index, shred sources and the avatar manifest regenerated.

## 3. Engine gaps the agents measured (follow-ups, not fixed here)

1. **A non-self `gainStacks` onHit grant ignores `scope`.** `dispatchGainStacksOnHit` (`sim/stacks.ts`) writes it to `CharState.onHitStacks` whatever the key's scope, while the skill's grant of the same rotation-scoped key goes to `rotationStacks`. The two sync passes each overwrite the segment copy, so the pools never add up. The consume side already routes by `homeOf`; the gain side doesn't. Repro: `Valeriy Q > Fischl N1 > Raiden Shogun E Q N4 N4 N4 N4 > Valeriy C` gives no mortar. This blocks Valeriy's A1, and it's a real bug for any future key of that shape. **A fix round with a failing test first.**
2. **Same-stat buffs from one cast collapse** (`dedupByStat`, `buffWindows.ts`): Mitya's C2 +123 EM is hidden behind A1's EM bar on a tap, and Valeriy's A4 can't add to the Offensive Directive bar. Needs an engine decision (pool them, or draw both).
3. **A Mitya party still draws a 7s Starlight Prism** (`sim/fields.ts`) on every Stellar-Conduct, while the kit says Stellar-Conduct then makes Gradient Beacons and no Prism.
4. **No `stellarConductFlatDmg` stat.** It would unlock Valeriy's Radiance branch, and Cyno's Starsame A4 too. A schema call.
5. The Detection Core's form is not a planner state, so form-dependent effects key off the cast token, and a recast of the other form can leave a 25s window up to about 7s too long.

## 4. Copy for Nate (proposals, not landed unless marked)

1. **Landed, needs approval:** Mitya A1's unknown-value tooltip reads "+30 per Gradient Beacon Mitya holds, up to +120 (+150 at C1)". (An `unknown` value must carry a description.)
2. Mitya skill caveat: "A second tap within 6s switches the Detection Core's state in game. The timeline keeps the state the cast chose."
3. Mitya Jubilee caveat, unless gap 3 is fixed: "With Mitya in the party, Stellar-Conduct creates Gradient Beacons instead of a Starlight Prism. The Polestar Field span shown is the Prism's 7s."
4. Mitya C2 caveat, unless gap 2 is fixed: "After a tapped Elemental Skill, the team Elemental Mastery bar shows the per-Beacon bonus; in game this +123 applies on top."
5. Mitya `notModeled` reasons for the coverage page: A4 "The planner doesn't track Gradient Beacons, and this raises Mitya's CRIT Rate for each one created." C4 "The Rotation Planner doesn't draw damage amounts, and this is extra damage from the Detection Core."
6. Valeriy normal-attack caveat: "Shown for the full 18s at its base amount; in game each Electro hit spends one of 15 stacks, only Electro DMG gets the bonus, and the amount grows with the Impact Momentum spent."
7. Valeriy normal-attack caveat: "A Normal Attack within 0.8s of the skill or burst becomes Direct-Fire Mortar in game; write it as C to draw Offensive Directive."
8. Valeriy A1 caveat: "Impact Momentum from the burst isn't counted, so a Charged Attack after it only becomes Direct-Fire Mortar here if the skill supplied the Momentum."

## 5. For Nate's eye

1. Both characters in the Team Builder's "not yet curated" bucket, with your avatars.
2. The Roles: Fandom lists both as unrated, so neither has a role card yet; the check-in's roles audit will report them when Genshin rates them.
3. Valeriy in a Stellar-Conduct party with a Cryo teammate draws no Offensive Directive bar (the Radiance gate). An under-claim, but a visible absence beside a Charged Attack.

## 6. Gates

Vitest 2820 passed · svelte-check 0 errors · lint clean · build · capability audit: the two expected off-field damage misses (no cadence), nothing else new · outliers: none for either. Chrome e2e: 72 passed, 1 flaky. `site-chrome.spec.ts` "the brand holds still" logged "scene: GL mount failed EncodingError: The source image cannot be decoded" once. The new avatars all decode and the scene loads no character art; the spec passed 14/14 alone. First sighting, so it's recorded here rather than chased.

## 7. Queue for the to-do (Nate's rulings)

- Vodyanitsa's skill and C2 revised in 5.2.15: re-read and re-author.
- Engine gaps 1–5 above; 1 is a bug.
