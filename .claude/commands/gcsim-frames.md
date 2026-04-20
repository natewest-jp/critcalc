# gcsim Frame Data Processing — Character Curation Guide

Use this skill when starting a new character curation session using gcsim source data.

Load the character's gcsim directory first:
```
/Users/producer/Code/gcsim/internal/characters/<character_name>/
```

---

## Source Files Per Ability Type

| Ability | File(s) to Read |
|---------|-----------------|
| Normal attacks | `attack.go` |
| Charged attacks | `charge.go` (or sometimes `attack.go` — search for `ActionCharge`) |
| Skill (E) | `skill.go` |
| Burst (Q) | `burst.go` |
| Plunge | `plunge.go` |

**Stance characters:** Characters with an alternate combat mode (Raiden, Hu Tao, etc.) often define *two* frame arrays in the same file — one for the base state and one for the stance. Look for multiple `init()` blocks and multiple frame array vars (e.g. `attackFrames` + `swordFrames`). The runtime switch is usually `if c.StatusIsActive(BurstKey)` inside the action function. Extract both sets: base frames go on the non-conditioned ability entry; stance frames go on the `inStance`-conditioned entry. This applies to `attack.go`, `charge.go`, and `plunge.go` — not just `skill.go`.

---

## Core gcsim Frame Functions

### `InitNormalCancelSlice(hitmark, animation)`

Used for **each hit** in a normal attack combo. Call signature:
```go
frames.InitNormalCancelSlice(p.Hitmarks[i], p.Animations[i])
```

**What it does:**
1. Sets ALL action slots (N, C, E, Q, D, J, Swap, Aim) to `animation`
2. Then explicitly overrides: Aim, Skill, Burst, Dash, Jump, Swap → `hitmark`
3. ActionAttack (N chain) and ActionCharge (C) stay at `animation` unless the file explicitly overrides them

**FrameMap mapping:**
| gcsim slot | Our key | Value |
|------------|---------|-------|
| Swap | `swap` | = `hitmark` |
| ActionAttack (N) | `N` | = `animation` |
| ActionCharge (C) | `C` | = `animation` (unless explicit override) |
| Skill | `E` | = `hitmark` (usually omit — `swap` is already the minimum) |
| Burst | `Q` | = `hitmark` (usually omit) |
| Dash | `D` | = `hitmark` (usually omit) |
| Jump | `J` | = `hitmark` (usually omit) |

**Convention:** For normal hits, only include `swap`, `N`, and `C` (if meaningful) in `hits[i].frames`. The `swap` key is the earliest cancel window. Explicit E/Q/D/J overrides on normals are only needed when they differ from swap.

**Example from Kazuha N1:**
```go
p.Hitmarks[0] = 13
p.Animations[0] = 21  // gcsim value; KQM may correct N to 16
```
→ `{ "swap": 13, "N": 21, "C": 21 }` (before KQM correction of N)

---

### `InitAbilSlice(animation)`

Used for **E, Q, and plunge** abilities. Call signature:
```go
f := frames.InitAbilSlice(animation)
```

**What it does:** Sets ALL action slots to `animation`. Then explicit `f[frames.ActionXxx] = value` overrides set individual cancel windows.

**FrameMap mapping:** Read each explicit override line. The lowest value = fastest cancel = should be your `swap`. Typical structure:
```go
f := frames.InitAbilSlice(90)     // default for all slots
f[frames.ActionDash] = 60
f[frames.ActionJump] = 61
f[frames.ActionAttack] = 75       // N cancel
```
→ `{ "swap": 90, "N": 75, "D": 60, "J": 61 }` — `swap` is always the fallback (highest/slowest)

**Important:** For E/Q, `swap` mirrors gcsim's `ActionSwap` slot specifically — it is the swap-out cancel window, not necessarily the highest value in the map. Explicit overrides for other actions (D, J, N…) may be slower than swap. Always set `swap` = whatever gcsim's `ActionSwap` is set to, and include other keys if they differ meaningfully from swap.

---

### Cooldown Functions

| gcsim function | Our fields |
|----------------|------------|
| `SetCD(action, frames)` | `cooldown: frames/60` only |
| `SetCDWithDelay(action, frames, delay)` | `cooldown: frames/60` + `cooldownStartDelay: delay` (raw frame int) |

`cooldownStartDelay` is stored as a frame integer (not seconds). The parser divides by 60 internally.

---

## Standard Lookup Sequence Per Character

1. **Read `attack.go`** → extract `p.Hitmarks[]` and `p.Animations[]` for each hit → populate `hits[i].frames`
2. **Read `charge.go`** → extract ActionCharge slice → populate `chargeFrames`
3. **Read `plunge.go`** → extract plunge slice → populate `plungeFrames` (and midare ranzan if anemo infuse)
4. **Read `skill.go`** → extract E slice + SetCD/SetCDWithDelay → populate E `frames`, `cooldown`, optional `cooldownStartDelay`
5. **Read `burst.go`** → extract Q slice + SetCD + duration constants → populate Q `frames`, `cooldown`, `duration`
6. Check for **variants** in skill.go (press vs hold E) — they usually have separate frame slices
7. Check for **summonActivatesAt** in burst.go — look for comments like `burstStart` or `ozSpawn` constants

---

## Plunge Frames (Characters With Plunge In Rotation)

Characters like Kazuha use plunge in their normal combat rotation. For these:
- Add a `plunge` ability entry between E and Q
- Include `"P"` in the `ActionKey` type if not already present
- Frame data comes from `plunge.go` — look for the standard `InitAbilSlice` + overrides pattern
- The `P` key in E's `frames` = earliest frame after which a plunge cancel is available from E cast

For Kazuha specifically, midare ranzan (E→plunge) has its own frame slice separate from normal plunge.

---

## KQM Cross-Check

After extracting gcsim data, always cross-check against KQM frame counts at:
https://docs.google.com/spreadsheets/d/1zCwdd6_KYFqMD4OQ_llkLl5Zh2Q7IxVn6SJf4OeC0Eg/

gcsim N-chain frame values (`animation`) sometimes differ from KQM's measured values. When they diverge:
- KQM is sourced from recorded gameplay at 60fps — prefer it for `N` key on normal hits
- gcsim `hitmark` → `swap` is usually accurate (it affects combat outcome directly)
- Note any discrepancies in the `note` or `caveat` field

---

## Common Gotchas

- **`C` in `hits[]`:** For sword/claymore/polearm, include `C` frames in each hit's `frames` object (= charged-attack cancel window). Bows use `chargeHits[]` instead.
- **Multi-hit normals (e.g. N1 hits twice):** Both hitmarks matter — `swap` = last hitmark (cancelling before last hit loses damage).
- **Hold E variants:** gcsim often has a separate frame slice with `SkillHold` action key — treat as a `variant` with its own `frames` object.
- **`summonActivatesAt`:** Look for the constant (e.g. `burstStart = 82`) used to offset summon AoE. Only add this field if the value is non-zero.
- **`cooldownStartDelay`:** Only needed when `SetCDWithDelay` is used (second argument non-zero). Omit if `SetCD` is used instead.
- **Bow characters:** Use `chargeHits[]` (array of `NormalHit`) instead of `chargeFrames`. `C` resolves to last entry (full charge). See `ability.ts` comments for details.
- **`ActionCharge = 500` (illegal marker):** When gcsim sets a frame slot to 500 with a `TODO: this action is illegal` comment, it means that cancel is not a valid gameplay action from that hit (e.g. C cancel from N5 on polearm). Omit that key from the FrameMap entirely — do not include `"C": 500`.
- **Stance characters — dual plunge frames:** `plunge.go` may define two sets of plunge frame arrays (e.g. `lowPlungeFrames` / `lowPlungeFramesB`), one for base state and one for the stance. Extract both; place base frames on the regular normal ability's `plungeFrames` and stance frames on the `inStance`-conditioned ability's `plungeFrames`.
