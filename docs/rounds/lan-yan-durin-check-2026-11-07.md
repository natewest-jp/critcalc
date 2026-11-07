# Lan Yan and Durin check (2026-11-07)

Nate asked for a look at two characters a streamer plays often: anything not
simulated or not fully working, with Durin's E-window orders (`E Q E` against
`E E Q`) and Lan Yan's "infusion" (her A1 absorption) called out. Each kit was
read against gcsim (`internal/characters/durin`, `internal/characters/lanyan`)
and driven through `parseNotation`.

## 1. Durin: every order resolves as gcsim does

gcsim opens a 6s window on the tap E (`skillWindowKey`). Inside it a second E is
the White commit and an N is the Dark commit, and the Q reads only `blackKey`
(30s), defaulting to White. The Q does not close the window.

| Notation   | Burst drawn | Form state after      | gcsim |
| ---------- | ----------- | --------------------- | ----- |
| `E E Q`    | White       | whiteForm from the E  | same  |
| `E Q E`    | White       | whiteForm after the Q | same  |
| `E N Q`    | Dark        | darkForm from the N   | same  |
| `E Q N`    | White       | darkForm after the Q  | same  |
| `Q`, `E Q` | White       | none                  | same  |

**Fixed:** the N after the Dark commit played N2's frames. gcsim returns
`skillRecastBlack()` before `AdvanceNormalIndex`, so it is N1 again. See §3.

**Open, all three waiting on one engine gap** (no condition says which burst form is
live; `duringSummon` is true for either dragon):

- A1's RES shred is drawn in either form; in game it is White only (the existing
  caveat says so).
- A1's Dark half, +40% Vaporize and Melt DMG (70% with Hexerei), is not drawn.
- C1 and C6 differ by form and are drawn as one (C6's caveat says so).

Checked and fine: the Hexerei −35% shreds (`factionBonuses`), both dragons' tick
cadences against `burstTicksWhite/Black`, the Dark dragon's 9f travel. The flat
skill energy sits on the tap rather than the commits, but no engine reader
consumes `energy` effects, so nothing on screen is wrong.

## 2. Lan Yan: the N follow-up never worked

gcsim routes both buttons to `reathermoonRings()` for 66f after a landed dash:
three Anemo rings at 38/62/85f on their own ICD group, with `ringsFrames`.

- **Fixed:** the N follow-up was a skill sibling with `input: ["N"]`.
  `resolveActiveAbility` matches by type and conditions, never input, so an N
  only ever saw her normals (`E N` drew an ordinary N1), and an E found that
  sibling first and wore its "(N follow-up)" name. It is now a state-gated
  normal (`lan_yan__normal__feathermoon_ring`, the Durin and Nilou shape).
- **Fixed:** neither follow-up had an `application[]`, so each applied Anemo at
  the press, 38f early and provisional; the E follow-up also carried a stray
  `noICD`. Both now land on the rings' hitmarks and share one ICD counter
  (`icdCounter: feathermoonRing`), off her normal-attack clock.
- **Open, queued already:** A1's absorption (the shield's element, the 50% twin
  ring in the absorbed element) and C1's extra ring. The absorption engine locks
  an element per cast; the twin rides a later cast, so the lock has to carry
  from the dash to the rings (`elemental-absorption-survey.md` §8, listed in
  `launch-roadmap.md` § Engine and data leftovers).
- Deliberately unmodelled and right: C2's shield refill, A4's EM flat DMG, the
  burst's pull.

## 3. The engine change: `routesToSkill`

`NormalAbility.routesToSkill` marks an attack press gcsim hands to a skill
action. It does not read or advance the combo, opens no Normal Attack state
for a listener, and queues its hits at the press (`chargeLandsAfterCancel`'s
rule), so Lan Yan's 62f and 85f rings land past the 37f cancel. Lint A.5c lets
such a map land past `anim`. ⚠️ Its hit records still say `normal`, so a
teammate effect that listens for Normal Attack hits sees it. Moving those
records to `skill` would be the faithful next step, but it reaches every onHit
consumer, so it is left for its own round.

Tests: `notationParser.test.ts`, "Lan Yan: the Feathermoon Ring follow-ups" and
"Durin: the Normal Attack after the Dark commit", written against the measured
wrong output first.
