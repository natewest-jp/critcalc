# Character Curation Recipe — First-Pass Draft

This document instructs an autonomous run to draft **one** character JSON to
first-pass quality from gcsim source. It is the source of truth for
autonomous curation; do not rely on memory recall alone.

KQM cross-checking, reaction-trigger enumeration, and final effect-modeling
decisions are **out of scope** for the autonomous pass — those are owned by
the human reviewer.

---

## Scope rules

- **One character per run.** Do not batch.
- **Tier A only.** Consult [`queue.md`](queue.md). If the target is in
  Tier B or Tier C, **stop** and report — those need synchronous review.
- **Branch:** `draft/<character-id>` off `main`. Never push to `main`.
- **Hand-off:** depends on mode (see below). Do not merge.

## Mode: local-only vs GitHub-remote

This repo currently has **no GitHub remote**. Until that changes, all runs
operate in **local-only mode**:

- Do **not** `git push`.
- Do **not** invoke `gh` or attempt to open a PR.
- After committing on the branch, **stop**. The branch stays local; the
  human reviews via `git diff` and merges manually.
- When listing the output checklist at exit, include the branch name and
  a one-line summary instead of a PR link.

When a GitHub remote is later added, this section will be replaced with
the original PR-based hand-off (push branch + `gh pr create` + checklist
in PR body). The recipe steps below assume the GitHub flow and will be
overridden by the launching script/prompt for local-only runs.

## Stop conditions (check first, before any edits)

Stop and report if any of the following are true:

1. Target is not Tier A in [`queue.md`](queue.md).
2. `/Users/producer/Code/gcsim/internal/characters/<gcsim-name>/` does not
   exist.
3. That dir is missing any of `attack.go`, `skill.go`, `burst.go`.
4. The character JSON already has frame data populated (run is idempotent;
   don't double-curate).
5. Any feature you encounter while reading gcsim that you cannot model with
   confidence using this recipe — e.g. a stance not flagged in the queue,
   special infusion not described here, multi-stage skill chain, exotic
   resource system. **Stop and ask** rather than guessing.

When stopping: leave a `_curatorNotes` entry on the relevant ability or at
the top of the JSON describing what blocked you, commit it, push, and open
a PR titled `draft/<id> — BLOCKED`.

---

## Inputs

| What | Where |
|---|---|
| Character JSON (target file) | `src/lib/data/characters/<character-id>.json` |
| gcsim source | `/Users/producer/Code/gcsim/internal/characters/<gcsim-name>/` |
| id → gcsim-name mapping | [`queue.md`](queue.md) |
| Schema reference | `src/lib/types/ability.ts` (JSDoc is authoritative) |
| Reference characters (already curated, study before editing) | `fischl.json` (bow + summon), `bennett.json` (sword + Q field), `zhongli.json` (polearm + shield), `sucrose.json` (catalyst — uncurated, for "before" shape) |

## Out of scope (do NOT touch)

- **KQM cross-checking.** Use gcsim values as-is. Do not WebFetch KQM data.
  The human reviewer cross-checks against KQM and resolves conflicts.
- **Reaction-trigger enumeration.** If a passive has an `onReaction` trigger,
  use whatever the genshin-db description literally says, then leave a
  `_curatorNotes` flag: `"Reaction list needs KQM verification — game text
  uses vague phrasing"`. Do not author a specific list.
- **`factionBonuses`.** Already authored if present; leave alone. Don't add new.
- **Constellation/passive effect *judgment* calls.** When in doubt about
  whether to model an effect or skip it, **always skip + flag** — do not
  decide. Authoring an inaccurate effect implies reliable uptime and misleads
  users (see Fischl A4 precedent in `feedback_conventions.md`).
- **Scaling buffs.** If you spot one, leave a `_curatorNotes` flag and skip
  the `value` field. The 44 scaling-buff characters get a dedicated second
  pass.

---

## Workflow

### 1. Read both files end-to-end first

Before editing anything, read:
- The full character JSON (already partially populated by the generator)
- All `.go` files in the gcsim character dir

This is to catch a stop-condition early. Don't start editing if anything
looks unfamiliar.

### 2. Frame data — the main mechanical work

Frames are 60fps integers. The cancel slice in gcsim maps action constants
to cancel-frame counts; extract these into the JSON's `FrameMap` shape.

#### Action constant → JSON key

| gcsim constant | JSON key | Notes |
|---|---|---|
| `action.ActionSwap` | `swap` | Swap-cancel frame |
| `action.ActionAttack` | `N` | Cancel into next normal |
| `action.ActionCharge` | `C` | Cancel into charged attack |
| `action.ActionSkill` | `E` | Cancel into skill |
| `action.ActionBurst` | `Q` | Cancel into burst |
| `action.ActionDash` | `D` | Cancel into dash |
| `action.ActionJump` | `J` | Cancel into jump |
| `action.InvalidAction` | (do not use) | This is `AnimationLength`, **not** swap |

Required key set per ability type — see the table in
`src/lib/utils/notationParser.ts` JSDoc and the reference memory
`reference_framemap_conventions.md`. Quick reference:

- **Normal hit (non-bow, non-final):** `swap`, `N`, `C`
- **Normal hit (non-bow, final in combo):** `swap`, `N` (no `C`)
- **Normal hit (bow, all hits):** `swap`, `N` (no `C`)
- **Charged attack (sword/claymore/polearm) `chargeFrames`:** `swap`, `N`, `E`, `Q`, `D`, `J`
- **Charged attack (bow) `chargeHits[].frames`:** `swap`, `D`, `J`
- **Skill `frames`:** `swap`, `N`, `Q`, `D`, `J` (add `E` only if char has ≥2 charges)
- **Burst `frames`:** `swap`, `N`, `E`, `D`, `J` (no `Q`, no `C`)

Key ordering: `swap` → `N` → `C` → `E` → `Q` → `D` → `J`. Omit absent keys
entirely (do not write `null`).

#### How gcsim cancel slices work

```go
attackFrames[0] = frames.InitNormalCancelSlice(attackHitmarks[0], 28) // walk
attackFrames[0][action.ActionAttack] = 17
attackFrames[0][action.ActionCharge] = 20
```

`InitNormalCancelSlice(hitmark, animation)`:
- All actions default to `animation` (second arg) — this is `AnimationLength`,
  **not** swap.
- The function then **overrides** `ActionAim`, `ActionSkill`, `ActionBurst`,
  `ActionDash`, `ActionJump`, **`ActionSwap`** to `hitmark` (first arg).

So in the example above for N1: `swap = 17`, `N = 17` (overridden after init),
`C = 20`, `D = 17`, `J = 17`, `Q = 17`. The "walk" comment marks
`AnimationLength = 28`, which is **not** a key we record.

For skills/bursts, look for `skillFrames` / `burstFrames` and the equivalent
explicit assignments after `InitAbilSlice(animation)`.

#### `name` field on hits

Always include `"name"` on every `hits[]` and `chargeHits[]` entry:
- Normal hits: `"N1"`, `"N2"`, ... or descriptive (`"Breakthrough Barb"` for
  Fischl's fully-charged aimed shot).
- Multi-stage hits: copy the in-game name when distinct.

Use `"N1"` through `"N{n}"` as the default. The genshin-db description
usually states `"Performs up to {n} consecutive shots/strikes/..."` — that
gives you `n`.

#### `summonActivatesAt`

Set on `behavior: "persistent"` abilities only, when the summon spawns at
frame > 0. Source from gcsim:

- `burstStart`, `burstStartFrame` constants in `burst.go`
- `skillOzSpawn` or first `QueueAttack(..., delay, ...)` in `skill.go`
- For bursts that loop attacks, e.g. `for i := 137; i <= duration+5; i += 113`,
  the first `i` value (137) is the activation frame.

**Do not** use `AnimationLength` or `InvalidAction` for this.

If the summon is active from frame 0 (e.g. an instant skill that doesn't
summon, or a Q where the field appears immediately), **omit `summonActivatesAt`
entirely**.

#### Cooldowns and energy cost

Look for `c.SetCDWithDelay(action.ActionSkill, frames, delayFrames)` or
`c.SetCD(action.ActionBurst, frames)`:
- `cooldown` (in JSON) = `frames / 60`. Check whole-second division: if it
  doesn't divide evenly, prefer the in-game description.
- `cooldownStartDelay` = `delayFrames` (frames, not seconds).

Energy cost: pull from `data_gen.textproto` (search for `cost:`). Do **not**
infer from `c.ConsumeEnergy(...)` — that's something else.

Burst duration: look for `duration := <frames>` in `burst.go`. Convert to
seconds. If a constellation modifies it (`if c.Base.Cons >= N { duration = ... }`),
add a `durationModifiers[]` entry with `conditions: { type: "constellation",
level: N }`.

### 3. Behavior field

| Pattern | `behavior` | Notes |
|---|---|---|
| Single-frame skill that just deals DMG and ends | `"instant"` | Most basic skills |
| Skill places a summon / creates a field | `"persistent"` | Set `summonActivatesAt` if > 0 |
| Skill applies a buff to self with explicit duration | `"persistent"` | The "duration" is the buff window |
| Burst with field/summon | `"persistent"` | Almost always |
| Burst that's a one-shot nuke | `"instant"` | Rare; e.g. Diluc Q is persistent infusion |

If unclear, leave the existing value from the generator and add a
`_curatorNotes` entry.

### 4. Effects — skeletal only

The generator already populates some `effects[]` arrays from genshin-db.
Your job is **not** to author new effects from scratch. Your job is:

1. Confirm the existing effect skeletons are well-formed (correct
   `target`, `trigger`, `durationType`, `source: "character"`).
2. **Add a `_curatorNotes` flag** for any effect whose details need
   reviewer judgment:
   - Reaction-trigger enumeration (`"Reaction list needs KQM verification"`)
   - Constellation gating (`"Verify conditions object — generator may use
     flat constellationLevel field"`)
   - Scaling buffs (`"Scaling buff — value depends on caster's stat"`)
   - Aura-dependent procs (`"Possibly unreliable in practice — see Fischl A4
     precedent"`)
3. **Do not** invent new effects. If the genshin-db description mentions a
   buff with no skeleton in the JSON, add a `_curatorNotes` entry on the
   parent passive/constellation: `"Effect not yet authored — needs reviewer
   pass"`.

Percentages: whole numbers (`22.5` not `0.225`). The generator usually gets
this right but verify a couple values.

### 5. Plunge frames (where present)

Plunge frames live on the **NormalAbility** as `plungeFrames` (single
FrameMap), not as a separate plunge ability. If gcsim has `plunge.go`,
extract:

```go
plungeFrames[action.ActionAttack] = ...
// etc.
```

Required keys: `swap`, `N`, `E`, `Q`, `D`, `J`.

If the character has plunge variants keyed by preceding E (Kazuha pattern),
**stop** — that's Tier B territory. The queue should already flag this; if
it slipped through, escalate.

### 6. Update `meta`

```json
"meta": {
  "source": "genshin-db",
  "generatedAt": "<existing value, do not change>",
  "draftedAt": "<today, ISO date>",
  "draftedBy": "claude-autonomous"
}
```

Do **not** set `curatedAt` — that field is reserved for the human review
pass.

---

## Output checklist

Every PR body should contain this checklist, with each line either filled or
marked N/A:

```
## Frame data
- [ ] Normal `hits[]`: <n> hits populated, names included
- [ ] Charged attack: chargeHits[] (bow) OR chargeFrames (other)
- [ ] Plunge frames: populated / N/A
- [ ] Skill `frames`: populated
- [ ] Burst `frames`: populated
- [ ] `summonActivatesAt`: set / N/A

## Mechanical fields
- [ ] Skill cooldown / cooldownStartDelay
- [ ] Burst cooldown / energyCost
- [ ] Burst duration (+ durationModifiers if constellation-gated)
- [ ] `behavior` field on each ability

## Effects
- [ ] Existing effect skeletons reviewed (no new effects authored)
- [ ] `_curatorNotes` flags added for ambiguous cases
- Number of `_curatorNotes` flagged: <count>

## Stop-condition triggers
- [ ] Reviewed all gcsim files; no unfamiliar mechanics encountered
- [ ] OR: stopped early — see <ability> _curatorNotes

## Reviewer punch list (things deferred to human pass)
- KQM frame cross-check
- Reaction-trigger enumeration
- Effect modeling decisions for flagged items
```

---

## Notes for future iterations

If autonomous runs surface recurring failure modes (a class of mechanic the
recipe doesn't cover, a frame-extraction edge case, a recurring schema
mistake), update this doc rather than memorizing the lesson — autonomous
mode reads the doc, not memory.
