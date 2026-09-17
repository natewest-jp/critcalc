# The small-fix bundle — record (2026-09-17, branch `engine/small-fix-bundle`)

\_Round 2 of the post-tranche engine queue (order ⚓ Nate-approved 2026-09-17;
round 1 is `docs/buff-pool-round.md`). Six measured defects, each one commit,
each probed at its site before and after. ⚠️ The corpus digest (every character

- Kaeya + Xingqiu, `E Q N1 N2 N3 C P`, C0/C6) is BLIND to four of the six — it
  casts each ability once, records no `readyAt`, and does not record window ends
  — so the site probe is the evidence for those.\_

| #   | defect                                                                                                                                                                | fix                                                                                                                                                                                                                                                                                                                                                                                                               | measured                                                                                                                                                                                                                          |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | The character `cdReset` walk read `[...passives, ...unlockedConstellations]` — a bespoke surface walk that SKIPPED `char.abilities`                                   | `getCharacterCdResetTargets` walks `effectSourcesAtConstellation`, the one idiom. **Arlecchino's Balemoon Rising** now authors the reset the kit states ("clearing the CD of All Is Ash"; gcsim `ResetActionCooldown(ActionSkill)` at f107 — ours lands at the cast, ⚠️ 1.8s early, `cdReset` has no delay field). Freminet's burst-hosted reset had been authored into the gap and never fired.                  | Arlecchino `E N1 N2 Q E`: second E at 265, was 1816. Freminet: 131, was 635.                                                                                                                                                      |
| 2   | `registerInfusionsOnCast` read `getCharacterEffectsForCast`, which walks EVERY sibling of the cast's type                                                             | The resolved ability's own effects (variant first — they REPLACE) + `getNonAbilityEffectsForCast`, the shield registrar's shape. Census: **Lohen is the only holder** (siblings sharing a type where any carries an `infuse`).                                                                                                                                                                                    | `Lohen E ~5s E ~10s N1 N2`: swings at 16.5s drew Cryo (the in-stance Etched cast re-opened Unforeseen Strike's 13s infusion); no element now.                                                                                     |
| 3   | `teamEnabledReactions` read the SLOT roster while the faction/element counts read the SEGMENTS, and finalize rebuilt slot maps for the buff and NB passes             | `ctx.team.rosterChars` — the slot roster when a NON-EMPTY one is supplied, else the notation's characters — and every map is built once in the parser and read off the context. ⚠️ An EMPTY slot list reads as "no roster": an empty count map is unresolvable and let the first tier win.                                                                                                                        | Skirk's A4 with four slots + a fifth Hydro name: +15% (the four count) on both surfaces. `[]` slots: +5% → +60%, as with no slots at all. Corpus byte-identical.                                                                  |
| 4   | A `durationExtensions` moved a stance's end but NOT its `opensState` companion (`nightsoulBlessing`), so abilities gated on the companion went dark for the extension | `StanceRecord.companion` (name + IR record) set at open; `extendStance` is the ONE way a stance grows, used by both the onCast and the reaction dispatcher; live gate and record move together. The swap-close clamp already walked both. Census: **two holders** carry both a companion and an extension (Kinich, Mizuki).                                                                                       | Kinich `E N1 Q N1 N2`: Blessing 600 → 702 beside the stance's 702. Mizuki under two swirls: 346 → 646.                                                                                                                            |
| 5   | `tickCap`'s one-interval widening applied to ANY end, so a window cut by a swap widened past the cut                                                                  | The summon window carries `naturalEnd` (spawn + lifetime, extensions applied, no swap/recast/flip cut); `collectSummonTicks` widens only when `end ≥ naturalEnd`, and the live chain's `liveUntil` tests `summonEndAt` with no swap — ⛔ the two must agree. A recast never reaches the chain's widening (`liveAt` stops a superseded chain at the spawn).                                                        | `Yaoyao Q ~2s N1 > Xingqiu E`: markers [146, 206] → [146] on a window cut at 197 (the gauge already refused the 206 tick). Kuki's and Sigewinne's capped recast rings cannot be cut — their cooldowns outlast them.               |
| 6   | A `P` on a character with no `plungeFrames` emitted NOTHING (80 of 126) — zero time, no block, no application                                                         | ⚓ Nate: **PROVISIONAL**. `GENERIC_PLUNGE_FRAMES` (medians over the 52 authored maps) stands in, after the BASE normal's frames (a stance form rarely authors its own plunge: Ayato, Wanderer, Wriothesley); the eager index carries `plunge` (`hasPlungeFrames`) and `notationFlags` squiggles the token "…plunge isn't measured yet — drawn with generic timing." ⛔ Never author the generic into a character. | `Fischl E hP N1`: a 58f block + the flag; Bennett unflagged. Corpus: **166 of 252** digests move — exactly the 80 frameless × C0/C6, plus the three stance forms now on their base frames (+63/+57/+51f, not one generic number). |

## Rulings worth keeping

- ⚓ `effectSourcesAtConstellation` is the ONE walk — the cdReset site was the
  last bespoke one (`constellation-gating-plan.md` §7 stands).
- ⚓ "The resolved ability's own effects + the non-ability surface" is the
  shape for ANY per-cast registrar (shields, infusions); ⛔
  `getCharacterEffectsForCast` is a POOL collector for the buff pass, where the
  sibling's effects are gated by their own conditions.
- ⚓ One roster: ⛔ never rebuild `teamFactionCounts` / element counts from
  `slotRoster` or `teamChars` downstream of the parser.
- ⚓ The boundary-tick widening is an argument about a NATURAL end.
- ⚠️ The digest is blind to window ENDS and to a second cast of one ability —
  measure those at the site.

## Commits

`c2b933ee` cdReset walk · `447ede8f` Arlecchino's reset · `5c13c5d0`
infusions · `eb1aef5f` one roster · `3d776bc4` companion state · `6130677a`
tick cap natural end · `c96bb21d` plunge stand-in.

Gates per commit: vitest 1870/1870, check, lint; build + e2e before the merge.

## Queued from here (round 3 →)

Per-cast `icdGate` on `CastAbility` → `onStack` reader (Columbina) →
cooldown-reduction round → `Summon.conditions` → `terminatesOn` a different
cast → `onSwapIn` / `onCast` ability binding. Still needing Nate's words: the
stance-cancel token, the Radiance window. ⚠️ §1.K (a normal's application at
`frames.hit`) must ride the clock's task queue.
