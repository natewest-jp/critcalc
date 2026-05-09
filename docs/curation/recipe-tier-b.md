# Tier B Curation Recipe — Stance, Multi-Mode, Multi-Stage Characters

> **ARCHIVAL (2026-05-07).** Tier B is complete (18/18). Future characters are
> curated individually on patch releases, not via autonomous batch runs.
> Preserved for pattern lookup; not the source of truth for new work.

This is an **addendum** to [`recipe.md`](recipe.md), not a replacement. Read
that doc first; this one only covers the patterns that the base recipe
explicitly stops on.

The base recipe says "stop on stance / multi-mode / multi-stage" because
Tier A drafting can't model those reliably from frame data alone. Tier B
runs lift that stop — the patterns here are recipe-shaped and have working
references in `src/lib/data/characters/`.

This doc is intended for an Opus 4.7 autonomous pass. It assumes more
judgment latitude than the Tier A recipe: when in doubt, mirror the closest
reference character, flag the deviation in `_curatorNotes`, and proceed.
Don't BLOCK over a stance; only BLOCK on genuinely-unrecognized mechanics
(see [§ Stop conditions](#stop-conditions-tier-b-version) below).

---

## Reference characters (read before drafting)

| Reference                                    | Pattern                              | Why                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/data/characters/hu_tao.json`        | **Stance-on-E**                      | `behavior: "stance"` on the skill, `terminatesOnSwap: true`, in-stance N variant with `conditions: { state: "inStance" }` + `infusion`, `onStanceEnd` trigger on A1. PP ATK conversion as a `value: { type: "scaling", stat: "hp", ratio: ... }` buff.                                                                                                                                                              |
| `src/lib/data/characters/cyno.json`          | **Stance-on-Q + multi-skill stance** | Burst is `behavior: "stance"` with `duration` and `terminatesOnSwap`. Has both a base E (`secret_rite_chasmic_soulfarer`) and an in-stance E variant (`mortuary_rite`) authored as **separate ability entries**, the latter gated by `conditions: { state: "inStance" }`. The in-stance E uses `stanceExtension: { frames, maxExtensions }` and `noICD: true`. Demonstrates the canonical multi-skill stance shape. |
| `src/lib/data/characters/furina.json`        | **Stance-on-Q (mode toggle)**        | `behavior: "stance"` on the burst with `duration` and `terminatesOnSwap`. Useful for the simpler "Q opens a stance" case without a multi-skill component.                                                                                                                                                                                                                                                           |
| `src/lib/data/characters/raiden_shogun.json` | **Stance-on-Q with sword infusion**  | Burst stance, normals replaced with electro-infused string. Reference for "Q stance + N replacement + infusion."                                                                                                                                                                                                                                                                                                    |

When the per-character note in this doc says "Cyno-shaped" or "Hu Tao-shaped," it
means: structure the JSON to look like that reference, with the deltas the
note calls out.

Also keep [`recipe.md`](recipe.md) §2 ("Frame data") at hand — and the
`reference_framemap_conventions.md` memory if you have it loaded. All the
`InitAbilSlice` / `InitNormalCancelSlice` / silent-default rules apply to
Tier B too. Stance work doesn't change frame extraction — it adds new
_ability entries_ that each carry their own frames.

---

## Stop conditions (Tier B version)

Replaces [`recipe.md`](recipe.md) § "Stop conditions" #5 ("unfamiliar
mechanic"). Items 1–4 still apply unchanged.

**5. Stop only on these mechanics (everything else, attempt the draft):**

a. **Bond of Life** — author the stance/skill frames as normal, but flag
the BoL economy with `_curatorNotes` on the affected ability/passive.
Do not author BoL-conditional buffs. Don't BLOCK; this is a "draft
what you can, flag the rest" case.

b. **Nightsoul resource pools** — Tier C territory; should not appear in
Tier B. If you see Nightsoul state in a Tier B character, BLOCK.

c. **Multi-step state machines that gate N-token meaning** (Nilou
Pirouette → Sword Dance / Whirling Steps; Lanyan Phase 1 → Feathermoon
Ring on N during status window). The schema can't represent N firing
a skill action conditionally on a recently-cast E. **BLOCK** with the
detailed handoff format from `recipe.md` § "Stop conditions" guidance
for multi-stage chains. The `draft/lanyan` and `draft/nilou`
branches are reference shapes for this BLOCK style.

d. **Anything else genuinely novel** — same posture as Tier A: BLOCK
with a detailed `_curatorNotes` entry on the affected ability.
Better one BLOCK than a wrong draft.

The Tier B classification in `queue.md` already pre-screens the targets;
treat any of (a/b/c) as a known case and do not re-tier mid-draft.

---

## Pattern 1 — Stance with N (and possibly C/P) replacement

**What it looks like in gcsim.** The character has either (i) a
status flag set on E/Q cast, or (ii) a gcsim `cd.SetCD(action.ActionStance, ...)` /
similar, with branching in `attack.go` and possibly `charge.go`/`plunge.go`
that reads the flag and dispatches different frame slices.

Common gcsim patterns:

- `if c.StatusIsActive(<stanceKey>)` — branches an if/else in attack/charge
- Separate slice constants like `attackHitmarksB`, `attackFramesPP`,
  `lowPlungeFramesB` — the "B" / mode suffix is the in-stance variant
- A `c.AddStatus(<stanceKey>, <frames>, ...)` call in the trigger ability

**What to author in JSON.** Two `normal` ability entries (or three, if
charge/plunge differ enough to warrant their own variant — rare). Pattern:

```jsonc
{
  // Base normal — out-of-stance
  "id": "<char>__normal__<base_name>",
  "abilityType": "normal",
  // ... hits[], chargeFrames, plungeFrames as in Tier A
},
{
  // In-stance normal — replaces N (and C/P if applicable) while stance is open
  "id": "<char>__normal__<stance_name>",
  "abilityType": "normal",
  "conditions": { "type": "state", "state": "inStance" },
  "infusion": "<element>",   // omit if no element conversion
  "hits": [ /* in-stance frame slices from gcsim */ ],
  "chargeFrames": { /* in-stance CA, if present */ },
  "plungeFrames": { /* in-stance plunge, if present */ }
  // No `description` needed if it duplicates the base; in-stance N is rendered alongside the base.
}
```

The triggering skill or burst gets `behavior: "stance"`:

```jsonc
{
  "abilityType": "skill",      // OR "burst"
  "behavior": "stance",
  "duration": <seconds>,       // REQUIRED on stance; gcsim's status frame count / 60
  "terminatesOnSwap": true,    // Set when the stance ends if the character swaps off-field
  "frames": { /* cast-side frames as usual */ },
  "cooldown": <seconds>,
  // ... energyCost on burst, cooldownStartDelay on skill, etc.
}
```

**Cancel-frame extraction for in-stance N.** Same rules as Tier A — the
`swap`/`N`/`C` keys come from the in-stance attack-cancel slice
(`attackFramesB`, `attackFramesPP`, `niwabiAttackFrames`, etc.). Compare
against the base: differences are usually small (a few frames per hit), but
real and worth recording. Hu Tao N5/N6 and N6 cancel-into-charge differ
between base and PP — that's normal.

**Infusion field.** Set `"infusion": "pyro"` (or `"electro"`, etc.) on the
in-stance N when gcsim converts the element on every hit. Do **not** set it
on the base N. The schema only allows infusion on `normal` abilities; if
the in-stance variant is a charge-only mod, see Pattern 4.

**`terminatesOnSwap`.** Most stance characters end the stance on swap. If
you're not sure, grep the gcsim character dir for `OnExitField` /
`SwapFunc` / `subscribe.*Swap` — a hook that calls `DeleteStatus(<stanceKey>)`
indicates `terminatesOnSwap: true`. Default to `true` when the gcsim source
has any swap-clear behavior; flag in `_curatorNotes` if the read is
ambiguous.

**Stance duration sources.** In `burst.go` or `skill.go`, look for either:

- `c.AddStatus(stanceKey, <frames>, ...)` — `<frames>` / 60 is duration
- A `dur := <frames>` constant near the top of the file
- A `for i := 0; i < <frames>; i += step` loop bound

Prefer the explicit constant. If the value depends on talent level (rare
but real), use `[8]` (talent 9 baseline) as Tier A does for damage scalings.

**`onStanceEnd` trigger.** Some characters have a passive that fires when
the stance ends (Hu Tao A1 — Flutter By → CRIT Rate buff to non-self). If
gcsim subscribes to a `OnStatusRemoved(stanceKey)` event, the corresponding
schema trigger is `{ "type": "onStanceEnd" }`. Use this when the gcsim
hookup is clear; flag with `_curatorNotes` if it isn't.

---

## Pattern 2 — Multi-skill stance (in-stance E or Q has different frames)

A specialization of Pattern 1. The in-stance state changes not just N but
the **skill cast itself** — typically the in-stance E has different
frames, a shorter CD, and may extend the stance window.

**Reference: Cyno.** `secret_rite_chasmic_soulfarer` is the base E.
`mortuary_rite` is a _second skill ability_ with `conditions: { state: "inStance" }`.

```jsonc
{
  // In-stance E — separate ability entry
  "id": "<char>__skill__<in_stance_skill_name>",
  "abilityType": "skill",
  "conditions": { "type": "state", "state": "inStance" },
  "frames": { /* in-stance gcsim skill frames */ },
  "cooldown": <seconds>,        // In-stance CD often differs from base
  "noICD": true,                // Often on in-stance variants — check gcsim
  "stanceExtension": {          // If casting this E extends the stance window
    "frames": <gcsim_extension>,  // 60fps
    "maxExtensions": <count>      // Cap from gcsim, often 2 or 3
  },
  "behavior": "instant"
}
```

**`stanceExtension`.** Look for `c.AddStatus(stanceKey, ..., extension)`
inside the in-stance skill function or for `if c.GetStatusDuration(stanceKey) >= ...`
gating logic. The cap count (`maxExtensions`) is usually a counter
incremented per cast and bounded; e.g. Cyno caps at 2 extensions per Q
window.

**Q-extends-E case.** If the _burst_ extends an _E-opened stance_, put
`stanceExtension` on the burst. The schema treats it symmetrically — only
one stance window exists per character.

**Multi-press placement (Yae Miko).** Three sequential E presses each
plant a totem at a different position. Author **three skill ability
entries**: base, `inStance` (after first totem), `inStance` (after second
totem) — each with its own frames and per-press CD if gcsim differentiates.
If the difference is purely positional (totem placement) with identical
frames per press, author **one entry** with a `_curatorNotes` flag noting
the multi-press behavior and skip the per-press differentiation. Reviewer
decides if a schema extension is needed.

---

## Pattern 3 — Multi-stage skill chain (sequential E variants)

**What it looks like in gcsim.** `attack.go` → `skill.go` has multiple
exported functions like `Skill1`, `Skill2`, `Skill3`, or a `state` int that
increments per cast. Each press fires a different attack with its own
frames and damage. The CD shared/separate behavior varies.

**Reference: `draft/lanyan` BLOCKED notes** for how to lay out the
phase-by-phase frame extraction. **For Tier B, attempt the draft** rather
than blocking, unless the chain depends on a state-machine condition the
schema can't express (then use the BLOCKED handoff pattern).

**Diluc shape (3-stage E):**

```jsonc
[
  {
    "id": "diluc__skill__searing_onslaught_e1",
    "abilityType": "skill",
    "frames": { /* E1 gcsim */ },
    "cooldown": <see note>,
    "behavior": "instant"
  },
  {
    "id": "diluc__skill__searing_onslaught_e2",
    "abilityType": "skill",
    // No `conditions` — all 3 presses are the same input but gcsim only allows
    // E2 within a window after E1. The notation parser treats them as separate
    // E presses in sequence; the first ability resolved via E with the matching
    // window-condition wins.
    "conditions": { "type": "state", "state": "afterPriorSkill" },  // see below
    "frames": { /* E2 gcsim */ },
    "behavior": "instant"
  },
  // ... E3 same shape, condition on prior E2
]
```

**Schema gap — `afterPriorSkill` is not a defined state.** The current
`Condition` union only has `inStance`, `hpBelow{50,70}`, etc. There is **no
"within N seconds after the prior E" condition**. For Diluc-shape multi-stage
chains, you have two choices:

1. **Author all stages as single-input `E` abilities with no `conditions`
   field**, in order. The notation parser will pick the first one each
   time, which is wrong — but the frame data is captured and reviewer can
   wire the chain logic later. Add a `_curatorNotes` flag on each stage
   describing the chain (window in frames, what gates the next press).

2. **Author only stage 1 (the cold-open)** and put the stage-2 / stage-3
   frames in `_curatorNotes` on the stage-1 ability. Less complete but
   doesn't pollute the JSON with parser-broken entries.

**Default to option 1.** Capturing frame data is the high-value work.
Reviewer schema-extends from there. Annotate clearly.

If gcsim implements the chain via a single skill with internal state
branching (one `Skill()` function with a switch on `c.skillState`), still
split into N ability entries — read the function's branches as separate
abilities. The internal-state representation is a gcsim implementation
detail; the JSON should reflect what the player observes (3 distinct E
presses with 3 distinct frame timings).

---

## Pattern 4 — Stack-gated charged-attack variant

**What it looks like in gcsim.** A passive or skill grants stacks (sometimes
called Seals, Stacks, Stamps, Marks). The base CA functions normally; once
stacks reach a threshold, CA fires a different animation / different damage

- consumes stacks. Examples: Yanfei Scarlet Seals (max 3, consumed by full
  CA → Done On Time AoE), Heizou Declension stacks (4 stacks at max → 4th
  charged punch is Fudou Style with different behavior).

**What to author in JSON.** A second `normal` ability entry for the
stack-charged CA, with a state condition. The catch: the schema's
`Condition` union doesn't have a `stacks >= N` form. Use this shape:

```jsonc
{
  // Base normal — chargeFrames is the cold-open CA
  "id": "<char>__normal__<base>",
  "chargeFrames": { /* base CA */ }
},
{
  // Stack-gated CA variant — separate normal entry
  "id": "<char>__normal__<stacked_ca_name>",
  "abilityType": "normal",
  "conditions": { "type": "state", "state": "inStance" },  // closest existing condition
  "hits": [],                  // empty if N-string is unchanged
  "chargeFrames": { /* gcsim's stack-CA frames */ },
  "_curatorNotes": [
    "Schema gap: this CA fires when <character> has <N> stacks of <resource>. The closest existing Condition is `state: inStance`; reviewer to add a `stacks` condition or repurpose this one. Stack source: <gcsim hook>. Stack consumption: <gcsim consume call>."
  ]
}
```

If the stack mechanic _only_ modifies stamina cost or damage (no animation
change), don't split into a second ability — just flag in `_curatorNotes`
on the base normal. The split is justified only when gcsim runs different
frame slices.

**Heizou-shaped stack-completing extra hit.** Heizou has a 4th charged
punch that can only fire after 4 Declension stacks accumulate from
N1–N4 + skills. This is closer to Pattern 3 (sequential stages) than
Pattern 4 (stack-gated CA). Author the 4th punch as a charge variant
with `_curatorNotes` describing the stack accumulation.

---

## Pattern 5 — Stamina-cost / damage modifier with no animation change

**Don't split into a second ability.** This is a single ability with
runtime-conditional behavior the schema can't represent. Examples: Hu Tao
C1 ("CA does not consume stamina while in PP"), Yanfei A1 (varying CA
stamina cost depending on Seals).

Add a `_curatorNotes` entry on the affected ability describing the
conditional, and move on. The base recipe's "stamina is not modeled in the
planner" guidance applies — these notes document the gap, they don't fix
it.

---

## Per-character notes

These notes pre-resolve the pattern + the obvious gotchas. Do not skip
reading them — they save a lot of gcsim spelunking.

### Stance characters (Pattern 1 / Pattern 2)

**`yoimiya`** (Pattern 1, simplest). Niwabi Fire-Dance: E opens a stance
window, N gets pyro infusion + auto-aim + different frames. No charge
attack in-stance (gcsim disables CA). `behavior: "stance"` on the skill
with `terminatesOnSwap: true`; in-stance N has `infusion: "pyro"`. CA in
the in-stance variant — omit `chargeFrames` or set it explicitly to the
base values; check gcsim. Yoimiya is bow → `chargeHits[]` not
`chargeFrames`.

**`tartaglia`** (Pattern 1 with weapon swap). Foul Legacy: E swaps from
bow to dual-blades melee; full N-string replacement, full `chargeFrames`
replacement. Stance has a fixed duration (gcsim: ~30s) and ends on swap or
auto-expire. `behavior: "stance"` on the skill, `terminatesOnSwap: true`,
`duration` from gcsim. **Note in `_curatorNotes`**: this is the only
character whose weapon TYPE changes mid-stance; planner caveat. The base N
remains `bow` weapon (`chargeHits[]`), in-stance N is melee
(`chargeFrames`). Both author cleanly with the schema.

**`wriothesley`** (Pattern 1). Chilling Penalty boxing: E grants Repulse
status, N becomes 6-hit boxing combo with cryo infusion + HP-cost
mechanic. Stance ends on cryo-application proc (gcsim: status gets cleared
when each Sledgehammer fires) — **flag `terminatesOnSwap` carefully**;
gcsim source is the truth, not the description. HP-cost is a self-buff
gating; don't author. Standard Hu Tao-shape.

**`kamisato_ayato`** (Pattern 1). Soukai Kanka: E places shroud, N becomes
Shunsuiken (3-hit per N press, hydro infusion). Stance has a fixed
duration (~6.4s) AND a max-hits cap (gcsim consumes a counter per N).
Author duration; `_curatorNotes` the hit-count cap. `terminatesOnSwap`:
yes. Hold E is a different attack (initiation dash) — handle as a hold
variant on the base skill.

**`xiao`** (Pattern 1, anemo). Yaksha Mask: Q opens a stance with anemo
infusion on N/C/P + plunge-emphasis kit. The N-string itself doesn't
change much, but **plunge frames change** — gcsim has dedicated `lowPlungeFramesB`
for the in-stance plunge. Stance duration ~15s. `behavior: "stance"` on
the burst; `terminatesOnSwap: true`. The HP-drain (1%/s) is unmodelled per
recipe. CA is also infused; flag if frames differ. Refer to the
`raiden_shogun.json` reference for stance-on-Q with infusion.

**`arataki_itto`** (Pattern 1). Raging Oni King: Q grants stance, N
becomes 4-hit string with Saichigiri replacing N3 (charged-only-at-N3).
Geo infusion. Stance ~11s, `terminatesOnSwap: true`. **C1 grants +1 skill
charge** — author as `chargeModifiers` on the skill; add the `E` key to
skill `frames` per recipe convention. The Saichigiri-after-N3 mechanic
is a charge variant gated on prior-N state — schema can't represent;
`_curatorNotes` the chain.

**`kirara`** (Pattern 1). Box mode: Hold E places Shrouded Box, sustained
run replaces N with paw-strikes; tap E summons one box. **Multiple skill
variants needed**: tap E (immediate paw-throw), hold E (Box mode entry).
Box mode is a sustained stance where the player runs around as a box; N
during box is forbidden in gcsim (`InvalidAction`). **This is a
borderline Pattern 4 case**. Author tap E as base, hold E as `variants[]`
on the skill. Box mode "stance" — flag with `_curatorNotes`; the schema's
`stance` semantic is "N replacement," not "N disabled," so don't set
`behavior: "stance"`. Use `behavior: "instant"` + `summons[]` (the box
entity) + a flag on the hold variant. Reviewer decides.

**`wanderer`** (Pattern 1, with dash/jump replacement). Skydweller: E
opens hover mode, replaces N (anemo infusion) AND dash (`Q` cancel from
hover) AND jump. Stance ~10s, `terminatesOnSwap: true`. The jump-cancel
mechanic is unique — `_curatorNotes` it; the schema doesn't model jump as
an ability that has its own frames. In-stance N has anemo infusion.
Element-absorption mechanic on E (absorbs Pyro/Hydro/Cryo/Electro at
cast); apply recipe.md § 3.5 "Elemental Absorption" — flag, don't author
the per-element conditional buffs.

**`mualani`** (Pattern 1, with stack consumption). Sharky Surfboard: E
opens stance, N becomes auto-targeting wave-chomp. Stack mechanic:
"Wavechompers" stacks consumed by full N-press. **Flag the stack economy
in `_curatorNotes`** — author N frames from gcsim's
`attackFrames` for the stance variant; do not author the stack-consumption
buff. `terminatesOnSwap: true`. Stance duration ~12s.

**`arlecchino`** (Pattern 1, with Bond of Life). Balemoon Rising: E
grants Masque + N replacement (3-hit pyro). **Flag Bond of Life mechanic
in `_curatorNotes`** — author the stance frames per the standard pattern,
but do not author BoL-conditional damage buffs (A4, C2). Stance duration
varies; gcsim has timer logic. `terminatesOnSwap`: gcsim — yes for the
N-replacement; the BoL pool persists separately.

**`clorinde`** (Pattern 1, mode toggle + Bond of Life). E has two modes:
Hunter's Vigil (single-tap, infused N) and Impale the Night (held; full
swap to ranged shots). Author both as skill variants, with the in-stance
N as a separate normal entry. **Flag BoL** (Clorinde converts incoming
hits to BoL via gcsim's PoLAcceptedQueue mechanic) — do not author. The
mode toggle is closest to Pattern 2 multi-skill stance. Reference Cyno's
shape but with the variant on the skill, not the burst.

### Multi-stage skill characters (Pattern 3)

**`diluc`** (Pattern 3, 3-stage E). E1 = Searing Onslaught, E2 = Searing
Onslaught (different frames + DMG mult), E3 = Searing Onslaught (different
again). Each press is gated by a 4s window since the last. **Use option 1
from Pattern 3** — author all 3 as separate skill entries, each input
`["E"]`, no conditions, in order. CD is shared (single 10s CD) — author on
E1 only, `_curatorNotes` on E2/E3 noting the shared CD. Reviewer wires the
chain logic.

**`alhaitham`** (Pattern 3, mirror count). E creates Projection mirrors;
mirror count gates skill behavior on subsequent casts. Tap E, hold E, and
post-burst E variants all behave differently. **This is the most complex
Tier B case** — closer to Tier C in shape. **Attempt to author tap E and
hold E as variants; if the mirror-count gating cannot be expressed,
BLOCK with the multi-stage handoff format**. Reference `draft/lanyan`
for the BLOCK shape if you go that route.

### Stack/seal-gated characters (Pattern 4)

**`shikanoin_heizou`** (Pattern 4 / 3 hybrid). Declension stacks: N1–N4
hits + skill grant stacks (max 4). 4th stack-tier charged punch (Fudou
Style) has different frames + significantly different DMG. Author base
CA in `chargeFrames`. Author Fudou Style 4-stack CA as a separate normal
entry with `conditions: { state: "inStance" }` (closest fit) +
`_curatorNotes` describing the stack accumulation. Hold E is a separate
skill variant.

**`yae_miko`** (Pattern 2 / multi-press placement). 3-press skill places
3 Sesshou Sakura totems with stacking placement state. **Author one
skill entry** with `_curatorNotes` describing the 3-press behavior
(gcsim's `c.skillCounter` tracks the press number, each press has slightly
different frames around 38–46f). Per-press frame slices in
`_curatorNotes`. The `summons[]` array on the skill captures the totems
collectively (`label: "Sesshou Sakura"`, `duration: 14`,
`mobility: "stationary"`). Reviewer decides whether per-press
differentiation is worth a schema extension.

**`yanfei`** (Pattern 4). Scarlet Seals: max 3 stacks, generated by N
hits + E. Full CA (Done On Time) consumes all seals → AoE pyro. CA frames
when stack-loaded differ from base CA (gcsim uses two slices). Author the
seal-loaded CA as a second `normal` entry with the `inStance` state
condition + `_curatorNotes` flagging the stack mechanic. A1 reduces CA
stamina cost per Seal — flag, don't author (Pattern 5).

---

## Output checklist (Tier B additions)

The base recipe's checklist still applies. Tier B adds these lines:

```
## Tier B pattern handling
- [ ] Pattern identified: [stance / multi-skill stance / multi-stage / stack-gated]
- [ ] In-stance ability entries authored with `conditions: { state: "inStance" }`
- [ ] Triggering ability has `behavior: "stance"` + `duration` + (if applicable) `terminatesOnSwap`
- [ ] Infusion field set on in-stance N (if elemental conversion applies)
- [ ] `stanceExtension` set on in-stance E/Q if it extends the stance window
- [ ] Schema-gap flags in `_curatorNotes` for stack/state/BoL conditions the schema can't express
- [ ] Reference character used: [hu_tao / cyno / furina / raiden / draft-shape]
```

---

## When in doubt

The Tier B recipe is more permissive than Tier A but the base posture
holds: **flag, don't fake**. If you can't decide whether the in-stance N
should have one frame value or another, pick the gcsim explicit value and
flag the ambiguity. If you can't decide whether the stance ends on swap,
default to `terminatesOnSwap: true` and flag. If you can't tell which
pattern fits, pick the closest reference, mirror its shape, and flag the
fit. The reviewer needs your _frame data_ much more than they need your
_judgment calls_ — the latter is reversible, the former is the high-value
output.

The four reference characters (hu_tao, cyno, furina, raiden_shogun) span
the canonical stance shapes. When you find yourself authoring something
that doesn't fit any of those, that's your signal to BLOCK and document.
