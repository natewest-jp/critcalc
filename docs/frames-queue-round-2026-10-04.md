# Frames queue round — 2026-10-04

The queue memory `project_frames_curation_queue` held seven items, left behind when the
dumper started reading every capture on a fresh core (`6a2f5bba`): Zibai's Stage 4, and
the frames-audit rows that change had made honest. All seven are done, on
`data/frames-queue-2026-10-04`. gcsim is at `703ac69ba`.

## 1. What shipped

| #   | Item                        | Commit     | Outcome                                                                                                                                                                                                                                                                                  |
| --- | --------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Zibai** Stage 4           | `37a5f86c` | Every FrameMap and E/Q application came from the writers. Skill `cooldownStartDelay` 18. **Spirit Steed's Stride** is a state-gated sibling skill in Lohen's shape, capped at 4 casts (5 at C1) by a stack counter. She leaves `FRAMELESS_EXEMPT` and the landing's "in the works" list. |
| 2   | **Wanderer**'s burst        | `29a6416c` | ⚓ Nate's option 2. The base takes `burstFramesNormal` (anim 101) and a Windfavored variant takes `burstFramesE` (145). The old base held the in-stance slice, so an out-of-stance Q ran 44f long.                                                                                       |
| 3   | **Clorinde**'s burst        | `221bfe33` | Same shape, 1f: N/E are 128 outside Night Vigil and 127 inside. Split because the audit can now read a state-gated variant.                                                                                                                                                              |
| 4   | **Ningguang**'s C           | `1e3fcee2` | Added to CLAUDE.md's oracle-artefact list: off a fresh core gcsim draws the charge type at random. Not migrated.                                                                                                                                                                         |
| 5   | **Xianyun**'s Skyladder 2/3 | `1e3fcee2` | gcsim's leap slices are used whole. anim 243 / 178 is the fall if nothing follows. E 15 / 128 and P 15 / 18 are added. A chained `E E E` had waited 44f too long at the second leap.                                                                                                     |
| 6   | Small anim rows             | `1e3fcee2` | Itto's Saichi C 130→131 (both forms) · Keqing E 28→37 and recast 42→43 · Tartaglia's bursts 53→55 / 101→103 · Chasca's Q 98→114, by hand because her normals are an unresolved driver. Tartaglia's stale TRANSPOSED hold-back is retired.                                                |
| 7   | **Nilou** close-out         | `c20aacd3` | Steps resolve on her shared dance counter. The Tranquility Aura moves to the Water Wheel at +40. Matches gcsim's CLI frame for frame (§3).                                                                                                                                               |

## 2. Tooling changed along the way

All of it is in the audit's map layer (`scripts/lib/gcsim-map.mjs`) and the application
writer. Each change was measured as a full-audit diff, and each moved only its target.

- **`prereqFor` looks inside an `all`.** A conjunction such as state + cast cap (Lohen,
  Zibai) used to fall through to "no prerequisite" and read the base capture. It now
  sequences the gating state first and then any stack counts. Two different states are
  uncovered, never a guess. ⚠️ Side effect: Varka's Four Winds is now **uncovered**
  instead of a listed oracle-artefact disagreement, because her `inStance` has no
  driver row. That is the honest answer.
- **`stacks` prerequisites.** A `drivers.json` row may say what ONE stack of a counter
  costs (`"stacks": { "danceStep": [{ "action": "skill" }] }`). A `stacks` condition
  with `min: M` is then captured behind M repeats. A `min` of 0, or a key with no row,
  contributes nothing.
- **`variantPrereq`.** A skill/burst variant gated on a state the driver table can
  enter now reads that state's capture (Wanderer, Clorinde). A variant whose state has
  no row keeps the ability's context, as before: Albedo's `duringSummon` and Xilonen's
  team gate share the base schedule.
- **The application writer drops `element` on a no-gauge hit** (not applied, and no ICD
  check ran). That is the ICD cap round's rule, which the writer had not yet learned.
  Corpus drift against the writer fell from 47 files to 44.

## 3. Nilou, measured

Frames count from the first press (gcsim's log is +1).

| String    | gcsim CLI                                      | planner, before                  | planner, after                |
| --------- | ---------------------------------------------- | -------------------------------- | ----------------------------- |
| `E E E E` | steps 40 / 75 / 121 · aura 118, first tick 119 | 40 / 67 / 94 (WS1 ×3) · aura 161 | 40 / 75 / 121 · aura 118      |
| `E N E`   | WS2 cast 33, hit 62                            | WS1                              | WS2 cast 33, hit 62           |
| `E N N E` | Water Wheel 49 / 92 · aura 89                  | WS1                              | Water Wheel 49 / 92 · aura 89 |
| `E N3`    | Sword Dance hits 33 / 49 / 95                  | same                             | same                          |

⚠️ The writer dropped `units` from WS1/WS2: behind their prerequisite presses they are
ICD-blocked hits on her shared counter. The nominal 1U is kept and a note on each says
why, so ⛔ don't let a writer run strip it.

## 4. Left open

- ✅ ~~A cast that ENDS a stance~~ — Nate said yes; built the same day, see §5.
- Nilou's Sword Dance swing is chosen by the Normal combo index, where gcsim indexes it
  by the shared counter (`E E N` is gcsim's SD2 and our SD1). Lunar Prayer is still the
  stance standing in for itself.
- Zibai's Ascendant Gleam N4 extra hit is not authored. It is Moonsign-conditional, and
  gcsim gives it Durability 25 where her other Lunar-Crystallize hits carry 0.
- Still in §2 of `gcsim-frames-diff.md` and outside this queue: Chasca's normals and
  skill, Lan Yan, Sigewinne's burst, Yun Jin's hold, and others. Most are listed
  artefacts or unresolved drivers.
- ⚠️ Mavuika's "E re-press inside Nightsoul" still panics in pass B. No authored map
  reads it.

e2e: see the merge commit.

## 5. Follow-up: `endsStance` (Nate-approved, same day, `engine/cast-ends-stance`)

A cast can now end its caster's stance. `endsStance: { at, conditions? }` is declared on
a skill, a burst or a variant, and a variant's value overrides its ability's.

- **`at`** is frames from the cast's start, or `'castEnd'`.
- **`conditions`** read the cast's pre-cast states and its `stackContext`, which is
  AFTER this cast's own gains.

| Kit                          | Authored                                 | gcsim                                                                                 |
| ---------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------- |
| Zibai, Spirit Steed's Stride | `at: 0` when `strideCasts` ≥ 4 (C1: ≥ 5) | `DeleteStatus(skillKey)` at the cast; the two hits still land                         |
| Nilou, Water Wheel           | `at: 40`                                 | queued from Pirouette() at the third press + `delaySteps`, the same frame as the aura |
| Wanderer, Windfavored burst  | `at: 'castEnd'`                          | Skydweller points zeroed; the stance closes at the next action's `checkForSkillEnd`   |

**Engine.** `clampStance` (`sim/states.ts`) is now the ONE stance off edge, shared with
the swap close. It clamps the window and its `opensState` companion, and moves a
`cooldownStartsAtStanceEnd` clock (both `readyAt` and the charge queue). The swap path
calls it and keeps its own extra behaviour: it clamps every state, and the owner bar
keeps full width. ⚓ A closing cast also shortens the OWNER BAR, because the stance
really ended. The roster IR invariant (bar end === window end) caught the first cut
that didn't. Only a stance open at the cast is affected.

**Lint D.47** (`ends-stance-invalid`, strict): `at` must be a non-negative integer or
`'castEnd'`, and the character must own a stance-behaviour skill or burst, otherwise the
field is inert. A seeded negative (Zibai with `at: -3`, Bennett's Q) fires both.

**Rider:** Wanderer's skill gets `cooldownStartsAtStanceEnd: true`. gcsim's
`SetCD(ActionSkill, 360)` runs only in `skillEndRoutine`; her note had asked for the
field before it existed. `E … Q` now readies E at stance end + 6s (225 + 360 = 585),
where it was cast + 6s, i.e. mid-stance.

**Measured** (`E N4 E N2 ×4` and friends): Zibai's mode ends on the 4th Stride (5th at
C1) and the normals after it are Physical. Nilou's stance ends at 118 and her normals
are Dance of Samser again; the Sword Dance route is untouched. Wanderer's stance ends at
the Q's end (225). The Zibai and Nilou caveats lose the sentences this made false.
