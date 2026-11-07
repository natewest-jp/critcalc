# Durin's dragon forms and Lan Yan's absorption (2026-11-07)

Nate's two Now items, run end to end on stacked branches: `feat/durin-dragon-form`
(cut from `main` at `fc27c71b`) and `feat/lan-yan-absorption` on top of it. The
check that queued both is `lan-yan-durin-check-2026-11-07.md` §1 and §2.

## 1. Durin: a state per dragon

Every form-split effect read `duringSummon`, true for either dragon. `darkForm` and
`whiteForm` are the wrong gate: they say what the next Q will be (`E Q N` casts the
White burst, then opens the Dark form).

Each burst now opens `whiteDragon` or `darkDragon` through `opensTransientState`
(`atFirstHit`, 20.5s, consuming the other), which is gcsim's `burstKeyWhite/Black`:
added at the first hit (97f) for `burstDuration`.

| Effect                      | Before                            | Now                                                                  |
| --------------------------- | --------------------------------- | -------------------------------------------------------------------- |
| A1 RES shred                | either dragon (caveat)            | `whiteDragon`; caveat removed                                        |
| A1 Vaporize/Melt +40% (70%) | not drawn                         | new `amplifyingReactionBonus`, self, `onState: darkDragon`           |
| C1 Dark                     | not drawn                         | 20 rotation-scoped stacks, 2 per Burst hit, +150% ATK `burstFlatDmg` |
| C2                          | `duringSummon`                    | `any(whiteDragon, darkDragon)`                                       |
| C6 DEF ignore               | 30%, all hits, 20s from the press | new `burstDefIgnore`, 30 White / 70 Dark, co-extensive with each     |
| C6 White DEF shred          | 6s from the cast, either form     | `onHit` Burst, `whiteDragon`, refreshed: first hit → last tick + 6s  |

Also: both dragons are `terminatesOn: 'burst'`. gcsim's `burstSrc = c.Core.F` at any
burst cast stops the old dragon's ticks, and `recast` is keyed by label and cut at
the new spawn, so it could say neither half. Lint D.22b allows the host's own kind
when a sibling of that kind leaves a differently-named summon. Measured before:
`E E Q W18 E N Q` drew the White dragon ticking 2s into the Dark one.

Engine: the `onState` buff pass accepts `self` targets (A1's Dark half and C6 are
his own). `burstDefIgnore` reaches the DEF & RES instrument as a Burst-scoped ignore.

**Measured:** `Durin E N Q` draws the C1 bar 158 → 690f, the tenth Burst hit (three
opening hits, seven ticks). The Hexerei rung (70%, −35%) needs a second Hexerei.

**Open:**

- C1's White half: each other party member gets their own 20 stacks and spends them
  on their own hits while active. A stack pool lives on one holder, so it needs
  per-receiver stacks.
- gcsim deletes the other form's status at the new burst's cast; ours closes at its
  first hit, so after a White→Dark switch the White half runs 97f long.
- C4's 30% chance to spend no stack is a coin flip and is not authored.

Tests: `notationParser.test.ts`, "Durin: which dragon is out".

## 2. Lan Yan: the lock carried from the dash to the rings

- The dash carries `absorbs` (one draw at the Detect hit, 7f, P > H > E > C).
- `absorbs.opensState` (new) opens a state at the lock: `charmAbsorbed`, 1.1s.
- `absorbedFrom: 'stance'` (new, on cast and normal abilities) reads the lock of the
  cast that opened the stance. The E ring's `{type: 'absorbed'}` entries and the N
  ring's absorbed `coInfusion` land the 50% twin on their own standard counter
  (gcsim `ICDGroupLanyanRingAttackMix`). A catalyst's absorbed `coInfusion` needs no
  `infusion` primary (lint C.19b); D.54 accepts absorbed entries beside
  `absorbedFrom` and requires a stance of the character that absorbs.
- C1: the E ring's "C1: four rings" variant and an N-ring sibling
  (`lan_yan__normal__feathermoon_ring_c1`), gated on `charmAbsorbed`, add
  [38, 64, 90] with their twins. Of the six Anemo hits, 38 and 64 apply, as in gcsim.

**Measured:** `Bennett E > Lan Yan E N` (and `E E`) now applies Anemo and Pyro at
120 and Swirls; at C1 again at 146. With no aura, Anemo alone, at every
constellation.

**Rejected:** routing the N press through the E ring's application list. It would
have reached into every normal-swing path for one character.

**Not drawn, and right:** the shield's element (no shield carries one, and incoming
damage is not modelled), the twin's 50% (a damage number).

Tests: `notationParser.test.ts`, "Lan Yan: the A1 absorption reaches the rings".

## 3. Copy landed in the existing patterns, for Nate's ruling

New strings, each mirroring its neighbours:

1. Buff label for `amplifyingReactionBonus`: "Vaporize and Melt Reaction Bonus"
2. Buff label for `burstDefIgnore`: "Burst DEF Ignore"
3. DEF & RES instrument, the ignore's reach: "own Burst DMG only"
4. Capability phrases: "while the Dragon of White Flame is present", "while the
   Dragon of Dark Decay is present", "after an Elemental Absorption"
5. Lan Yan's E-ring variant label "C1: four rings", and the N sibling's name
   "Feathermoon Ring (N follow-up, C1)"

## 4. What's new

The draft held in `lan-yan-durin-check-2026-11-07.md` §4 waits on Nate, now that
both rounds have landed.

## Gates

Vitest 2843, svelte-check, lint and build green on both commits; Chrome e2e 73
passed on `feat/lan-yan-absorption`. Both engines run before the merge.
