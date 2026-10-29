# FrameMap Curation Conventions

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

⚠️⚠️ **LARGELY SUPERSEDED — gauge-round L4b, 2026-08-16.** See
`docs/rounds/gauge-round-L4.md`. Three things below are now WRONG:

1. ⛔ **"`ActionSwap` = `swap`, NOT `AnimationLength` (InvalidAction)"** is exactly
   backwards as a FALLBACK rule. `anim` (InvalidAction) is required and IS what an
   absent key resolves to; `swap` is an ordinary override. A normal is
   `{ anim, hit }` — two numbers.
2. ⛔ **"Source priority: KQM > gcsim"** — ⚓ Nate 2026-08-16 (contract C4b): gcsim is
   the source for all frame data, and it is EXTRACTED, not hand-read
   (`scripts/gcsim-dump/`, `audit-gcsim-frames.mjs`). KQM is not consulted routinely.
3. ⛔ **Hand-curation of the key sets is retired for the 111 characters with a gcsim
   source.** The migration writes a MINIMAL map — only keys that differ from what
   `frameAt()` resolves — so the "canonical set per ability type" below no longer
   describes what a curated character looks like.

✅ **Still useful**: the key sets as a guide for the ~12 characters with no gcsim
source, the `name` convention, and the summon-activation notes.

All frame values are 60fps integers. A gap >10f between D and J is a red flag; flag for
re-check.

## `name` field in `hits[]` and `chargeHits[]`

Always include a `"name"` field on every entry. Makes the JSON self-documenting, especially for multi-hit normals and bow charge variants.

```json
{ "name": "N1", "frames": { "swap": 13, "N": 15 } }
{ "name": "Breakthrough Barb", "frames": { "swap": 42, "D": 32, "J": 32 } }
```

**Retroactive update:** All curated characters (Ganyu, Bennett, Xingqiu, Fischl, Cyno, Zhongli, Kazuha, Raiden) need `name` fields added to their `hits[]` and `chargeHits[]` entries. Batch this with another pass.

---

## Required keys per ability type

### Normal attack `hits[]` — non-bow, non-final hit

```
{ "swap": X, "N": X, "C": X }
```

- `N` = cancel window when the next hit in the combo follows
- `C` = cancel window when a charged attack follows

### Normal attack `hits[]` — non-bow, final hit in combo

```
{ "swap": X, "N": X }
```

No `C` key. After the final normal the combo resets; C from the final hit is not a commonly measured or optimised sequence.

### Normal attack `hits[]` — bow characters (all hits)

```
{ "swap": X, "N": X }
```

Bow N→C (aimed shot) transitions are not measured by KQM; bow DPS characters do not chain normals into aimed shots in typical rotations. No `C` key for any bow hit.

### Charged attack `chargeHits[]` — bow characters

```
{ "swap": X, "D": X, "J": X }
```

Aimed shots are self-contained; the only practical cancels are D/J/swap.

### Charged attack `chargeFrames` — sword / claymore / polearm

```
{ "swap": X, "N": X, "E": X, "Q": X, "D": X, "J": X }
```

E and Q after a charged attack are very common (CE, CQ sequences). All keys included.

### Elemental Skill `frames` (E abilities)

```
{ "swap": X, "N": X, "Q": X, "D": X, "J": X }
```

- `Q` added: E→Q is a common sequence (use skill then burst)
- `E` key: include only when the character has ≥2 E charges and E→E is a real rotation sequence (e.g. Xingqiu C1, Ganyu C2). Omit otherwise.
- Exception: omit `Q` if the ability can only be cast while already inside a Q stance (e.g. Cyno's Mortuary Rite — he cannot cast Q again while in Pactsworn Pathclearer). Note the omission with a comment in the JSON if non-obvious.

### Elemental Burst `frames` (Q abilities)

```
{ "swap": X, "N": X, "E": X, "D": X, "J": X }
```

- `E` added: Q→E is common (cast burst then immediately use skill)
- `C` omitted: Q→C (charged attack immediately after burst) is not a standard sequence
- Exception: omit `Q` key (self-referential) — Q→Q is impossible.

## Key ordering convention

Within a FrameMap object, use this key order for readability:
`swap` → `N` → `C` → `E` → `Q` → `D` → `J`

Omit absent keys entirely (do not write `"Q": null`).

## `summonActivatesAt` convention

`summonActivatesAt?: number` on `Ability` (frames, 60fps) — the frame at which the persistent summon becomes active, relative to cast start. The renderer offsets the active bar by this value; `duringSummon` state detection uses it for both the start and end bounds.

**When to set:** only on `type: "persistent"` abilities where the summon/field activates after frame 0. Omit entirely when the summon is active from frame 0 (e.g. Xingqiu Q, Cyno Q).

**Source:** gcsim's per-character activation constant, typically named `burstStart`, `burstStartFrame`, `skillOzSpawn`, or the first `QueueAttack` offset. **Not** `AnimationLength`/`InvalidAction`. Check `burst.go` / `skill.go` for the character.

**Current values:**
| Character | Ability | `summonActivatesAt` | gcsim constant |
|-----------|---------|---------------------|---------------|
| Ganyu | Q | 122 | `burstStart = 122` |
| Ganyu | E | 13 | first hitmark (`QueueAttack(..., 13, ...)`) |
| Bennett | Q | 34 | `burstStartFrame = 34` |
| Fischl | E | 18 | `skillOzSpawn = 18` |
| Fischl | Q | 1 | `burstShortOzSpawn = 1` (swap-away path) |

Note: `summonActivatesAt` can be less than `frames.swap` (the swap cancel) — Bennett Q field activates at 34f but swap cancel is 51f. The active bar starts at the true activation frame; the cast overlay (swap cancel frame) may slightly overlap the start of the active bar.

## Source notes

- **gcsim `ActionSwap`** = `swap` key. NOT `AnimationLength` (InvalidAction).
- **Bow N→N via gcsim is unreliable** (`InitNormalCancelSlice` leaves ActionAttack at full animation fallback). Always cross-check bow N→N against KQM.
- **Multi-hit attacks:** all keys must reflect the _final_ hitmark frame, not an earlier sub-hit. Cancelling before the last hit loses damage and is not a valid rotation decision.
- **D/J gap >10f** between D and J values is a red flag; re-check source data.
