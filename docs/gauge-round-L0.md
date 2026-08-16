# L0 — The gcsim Oracle

**Status:** planned · 2026-08-16 · first landing of [the gauge round](gauge-round.md)
**Goal:** be able to measure how wrong we are, before changing anything.

> ⚡ **The spike changed this landing's scope.** The oracle is substantially stronger than the
> contract document assumed, and **L0 now subsumes most of L4's extraction work** — which
> retires the static Go-parsing plan entirely. See [§3](#3-the-restructuring).

---

## 1. What the spike verified

Built gcsim (`go1.26.6`, checkout `d146b6d0`) and ran five configs. Everything below is
observed output, not inference.

### 1.1 The element log is a complete application record

```json
{
	"abil": "Frostgnaw",
	"applied_ele": "cryo",
	"dur": 50,
	"attack_tag": 4,
	"existing": null,
	"after": ["cryo: 40.000"],
	"target": 1
}
```

- `dur` is **durability** — 50 = 2U. ✅ Kaeya's E is 2U, matching the worked example in
  `docs/library/game/elemental-reactions.md` §1.1.
- `existing` / `after` give **the aura gauge before and after every application**
  (`40 = 0.8 × 50` — the aura tax, visible in the data).
- `frame` is exact.

### 1.2 Hitmarks are observable, and they reproduce the gcsim source constants

Pair each `element` application with the preceding `action` event:

| character | action frame | element frame | Δ      | source constant        |
| --------- | ------------ | ------------- | ------ | ---------------------- |
| Albedo Q  | 196          | 271           | **75** | `burstHitmark = 75` ✅ |
| Albedo E  | 163          | 188           | 25     | —                      |
| Kaeya E   | 1            | 29            | 28     | —                      |

### 1.3 "This cast applies nothing" is observable

- **Xiangling E** — no element event at the cast at all; only `abil: "Guoba"` at f=280, 380,
  480, 580. ✅ Confirms the §1 finding in the contract doc, empirically this time.
- **Hu Tao E** — nothing at cast; `"Blood Blossom"` DoT at f=356, 596.
- **Xiao Q** — nothing at cast (it is a self-infusion).

### 1.4 ICD is observable, and our model already matches

- **Klee, 5 normals** → applications on swings **1 and 4** only. That is exactly the "hits 1,
  4, 6" standard-ICD pattern documented in `icd.ts`'s header. ✅
- **Klee, 2 charged** → **both** apply (`tag=2`). ✅ Confirms the catalyst-CA blanket rule in
  `resolveActionIcd`.
- **Xiao, 2 high plunges** → **both** apply (`tag=3`). ✅ Confirms the plunge blanket rule.
- Separate `icd` events expose the counter and reset timer directly
  (`{"counter": 1, "group on timer": true, "grp": 0, "tag": 31}`).

### 1.5 Ability variants self-label

```
sayu skill[hold=0]  →  f=8   "Fuufuu Windwheel (DoT Press)"
sayu skill[hold=1]  →  f=19  "Fuufuu Windwheel (DoT Hold)"
```

⚓ `skill[hold=1]` is the parameter syntax — `skill hold=1` is a parse error and `skill:1` is
the _repeat count_, not a param. Tested; do not guess this.

### 1.6 Reactions are extractable, in three shapes

| family                        | where it appears                                                                                    |
| ----------------------------- | --------------------------------------------------------------------------------------------------- |
| Amplifying (vaporize / melt)  | a `damage` event with `logs.amp = "melt"`                                                           |
| Additive (spread / aggravate) | a `damage` event with `logs.cata` set                                                               |
| Transformative                | a `damage` event whose `abil` **is** the reaction (`crystallize-pyro`, `overload`, `swirl-pyro`, …) |

⚠️ There is **no** log line whose `msg` says "melt". A naive message grep finds nothing —
the first pass of this spike found zero reactions in a config that definitely melted.

⛔ **This table is INCOMPLETE — there is a fourth shape.** Crystallize and freeze produce no
`damage` event at all, and the first pass of the harness reported zero crystallizes in a
fixture that produced seven. See [§10](#10-corrections-from-implementation-2026-08-16).

### 1.7 Two config facts that matter

- ⚓ **`options hitlag=false;`** exists. gcsim skips the reactable tick during hitlag and we do
  not model hitlag at all, so this removes the one clock divergence we could not otherwise
  explain. Cost: the oracle then measures gcsim-without-hitlag, not the game.
- **111 of 123 characters map to a gcsim key by removing underscores.** The 12 that don't are
  exactly the known no-gcsim-source set (blank, iansan, ifa, illuga, jahoda, kachina, linnea,
  lohen, nefer, prune, sandrone, zibai).

---

## 2. Stats do not matter, which makes the generator small

Elemental application depends on **element, durability, ICD tag and frame** — none of which
are stat-dependent. EM scales reaction _damage_, not gauge. So the generated config needs
**no artifacts, no substats, no talent tuning**:

```
options iteration=1 duration=<D> swap_delay=<our swapFrames> hitlag=false;
target lvl=100 resist=0 pos=0,0 radius=1;

<key> char lvl=90/90 cons=<C> talent=9,9,9;
<key> add weapon="<inert>" refine=1 lvl=90/90;
```

⚠️ **Constellations DO matter** (they add hits and change kits) and must be passed through.
⚠️ **The weapon slot is required**, so it needs a curated **inert-weapon** table — one per
weapon type, chosen for _no_ element-applying or reaction-triggering passive. Favonius is
energy-only and safe; ⛔ never a Sacrificial (CD reset changes the rotation) or an infusion
weapon.

---

## 3. The restructuring

The contract document planned L4's extraction as a static read of gcsim's Go source. Measured,
that was: 924 call sites, ~64% folding to an integer, ~27% needing loop interpretation, **~9%
needing a human**, plus wrapper-flattening ambiguity, two different scheduling clocks,
mode-indexed tables, and hit counts that depend on runtime state.

**Running the simulator dissolves all of it.** The 25 category-D sites resolve themselves
because the simulator resolves them. Hitmark, durability, element, ICD behaviour and
"does this cast apply at all" all fall out of one log.

|                                      | was                                         | now                            |
| ------------------------------------ | ------------------------------------------- | ------------------------------ |
| hitmarks                             | parse `QueueAttack` args + flatten wrappers | `element.frame − action.frame` |
| units                                | read `Durability:` literals                 | `element.logs.dur / 25`        |
| applies-at-all                       | infer from talent sidecars                  | absence of an element event    |
| loops / mode tables / runtime counts | interpret Go                                | the sim ran it                 |

⚠️⚠️ **What observation does NOT give you: anything the driver never exercises.** Static
reading sees all branches; running sees one path. **Coverage becomes the central risk of the
data track**, and it moves from "can we parse this?" to "did we drive this?" — which is a much
better problem, because it is measurable. See §5.

⛔ The static-extraction plan in `gauge-round.md` §L4 is superseded. Amend it when L4 is
planned, not before.

---

## 4. Design

Three files. The split is deliberate: L0 ships the first two, L4 adds the third on the same
foundation.

| file                                     | role                                                        | lands  |
| ---------------------------------------- | ----------------------------------------------------------- | ------ |
| `scripts/lib/gcsim.mjs`                  | name mapping · config generation · invocation · log parsing | **L0** |
| `scripts/audit-gcsim-reactions.mjs`      | the differ → `docs/curation/gcsim-reaction-diff.md`         | **L0** |
| `scripts/extract-gcsim-applications.mjs` | the data extractor                                          | L4     |

⚓ **`audit-*.mjs` is the right family and the right precedent** — `audit-genshin-db-diff.mjs`
is already "a review-candidate generator against an external source, never an auto-fixer",
and this is the same contract. ⛔ Not `scripts/probe-*.mjs`, which is a retired pattern.

**Preflight:** the script shells out to a `gcsim` binary. It must fail with an actionable
message (`go build -o <path> ./cmd/gcsim` in `~/Code/gcsim`) rather than a stack trace, and
record the gcsim commit hash in the report so a diff can be attributed to an upstream change.

### 4.1 ⚓ What we diff: the aura trajectory, not just the reaction list

The obvious comparison is "our reaction events vs theirs". **The better one is the aura gauge
over time**, because `existing`/`after` hand it to us for free, and because our reaction list
is _derived_ from aura state anyway.

A trajectory diff says **where** we diverge; a reaction-list diff only says **that** we did.
When the first melt goes missing at t=40 because an aura expired at t=13, the trajectory shows
the expiry; the reaction list shows a hole.

So the report carries three tiers, in this order:

1. **Applications** — (frame, character, element, units) ours vs theirs. Catches the whole L4
   data class, and it is the tier that will move most.
2. **Aura trajectory** — gauge per element at each application instant.
3. **Reactions** — the derived list, which is what actually drives buff windows.

### 4.2 Notation → config mapping

| ours                 | gcsim                 | notes                                                                                                                                    |
| -------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `E`                  | `skill`               |                                                                                                                                          |
| `hE` / `h1E` / `h2E` | `skill[hold=1]`       | ⚠️ per-character param; `h1`/`h2` need a per-character map                                                                               |
| `Q`                  | `burst`               |                                                                                                                                          |
| `N5`                 | `attack:5`            |                                                                                                                                          |
| `C` / `C3`           | `charge` / `charge:3` |                                                                                                                                          |
| `A` (bow)            | `aim`                 | ⚠️ see the `travel` warning below                                                                                                        |
| `P` / `hP`           | `jump; high_plunge`   | ⚠️ **gcsim rejects a plunge with no preceding jump** — verified: `error … only plunge after using jump`. Our notation allows a bare `P`. |
| `lP`                 | `jump; low_plunge`    |                                                                                                                                          |
| `D`                  | `dash`                |                                                                                                                                          |
| `J`                  | `jump`                |                                                                                                                                          |
| `~Xs`                | `wait(round(X*60))`   | frames                                                                                                                                   |
| `>`                  | a new `<char> …` line | swap is implicit                                                                                                                         |
| `sQ`                 | ⚠️ unresolved         | per-character; determine during implementation                                                                                           |
| `W`                  | —                     | ⛔ skipped, matching `peekActionKey`                                                                                                     |
| `{seal:4}`           | —                     | no equivalent; skipped                                                                                                                   |
| `[…]x3`              | expand first          | reuse `expandBrackets`                                                                                                                   |
| `(…)`                | ⚠️ decide             | recommend **excluding** optionals so the diff measures one definite path                                                                 |

⚠️⚠️ **`travel` is a gcsim policy, not game data** (76 `p["travel"]` sites, default 10). Any
aimed/bow-charged timing we observe has that assumption baked in. Either exclude `A` from the
corpus or pin `travel` to a constant and mark every derived figure provisional. ⛔ Never
ingest it as measured frame data.

### 4.3 Log → facts mapping

| fact                    | source                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------- |
| cast instant            | `event=="action"`, `logs.action`, `char_index`, `frame`                               |
| application             | `event=="element"`, `msg=="application"` → `applied_ele`, `dur`, `abil`, `attack_tag` |
| aura before / after     | same event → `existing`, `after` (`"cryo: 29.889"` — parse the pair)                  |
| ICD decision            | `event=="icd"` → `counter`, `group on timer`, `val`                                   |
| amplifying reaction     | `event=="damage"` → `logs.amp`                                                        |
| additive reaction       | `event=="damage"` → `logs.cata`                                                       |
| transformative reaction | `event=="damage"` where `abil` is a reaction name                                     |

`attack_tag`: 1 normal · 2 charged/extra · 3 plunge · 4 skill · 6 burst.

⚠️ **Attribution is the one genuinely fiddly part.** A cast hit and a summon tick both arrive
as `element` events; pairing an application to the action that caused it needs care. Three
signals, in order of reliability: gcsim often **self-labels** (`"… (Initial)"` vs `"… (Tick)"`,
`"(DoT Press)"` vs `"(DoT Hold)"`); `attack_tag` narrows the class; and a tick recurs on an
interval while a cast hit does not. ⛔ Do not silently guess — emit the `abil` string in the
report and let a human adjudicate the ambiguous ones.

---

## 5. The driver, and why coverage is now the risk

⚓ **Reuse the roster-notation generator.** `notationParser.roster.test.ts` already builds a
per-character notation from each character's _declared input tokens_ — including hold/tap/press
variants the plain smoke test misses. That is exactly the driver this needs, and it means
coverage is defined by the same data the parser-invariant gate already walks.

For L0 the corpus is smaller and hand-picked: **≥10 rotations spanning the reaction families** —
vaporize, melt, electro-charged, freeze, quicken/bloom/hyperbloom, swirl-heavy,
geo/crystallize, burning, plus one long rotation (>60 s) to exercise decay and one
plunge-heavy one.

**Coverage is reported, not assumed.** The report states how many characters and how many
declared input tokens were exercised, and what was skipped and why. ⛔ A believed-total partial
oracle is worse than an acknowledged partial one.

---

## 6. Deliverables

1. `scripts/lib/gcsim.mjs` + `scripts/audit-gcsim-reactions.mjs`.
2. `docs/curation/gcsim-reaction-diff.md` — the three-tier report.
3. **A baseline divergence count recorded in `gauge-round.md`**, which is the number every
   later landing is measured against.
4. An inert-weapon table (one per weapon type) with the reason each was chosen.
5. A short note in `gauge-round.md` §L4 that static extraction is superseded.

## 7. Acceptance

- Runs green on ≥10 rotations with no unhandled notation construct silently dropped —
  anything unmappable is **reported**, not skipped quietly.
- The three-tier report distinguishes _we applied and they did not_ from _we applied at a
  different frame_ from _we applied a different number of units_.
- Coverage is stated numerically.
- ⛔ ~~Re-running reproduces byte-identically (`iteration=1`, fixed seed).~~
  **WRONG — corrected during implementation.** See §10.
- ⛔ No production code changes. L0 touches `scripts/` and `docs/` only.

## 8. Limits to state in the report

- **`hitlag=false`** — we measure gcsim-without-hitlag, deliberately, because we do not model
  hitlag. This is a divergence from the game, not from gcsim's default.
- **Single target** (`radius=1`, one target). Swirl AoE spread, multi-target crystallize and
  shatter are all out of scope.
- **gcsim is not the game.** It is an implementation-level second source with a different
  method. Where it and KQM disagree, evaluate both — ⚓ the burning-ICD finding was confirmed
  against `docs/library/game/icd.md` _independently_, and the audit also found two places
  where gcsim itself is buggy and should not be copied.
- **The 12 characters with no gcsim source** cannot be oracled at all.
- **`travel`-dependent timings are policy**, not data.

## 9. Open questions for implementation

1. **`sQ`** — no known gcsim spelling; determine per character (Flins, Varesa).
2. **`h1E` / `h2E`** — which `hold` value each maps to, per character.
3. **Optional groups `(…)`** — recommend excluding; confirm when writing the generator.
4. **Where does the gcsim binary live?** Recommend: not committed, built on demand into a
   gitignored path, with the commit hash recorded in every report.

---

## 10. Corrections from implementation (2026-08-16)

Four things the plan got wrong or did not know. All are fixed in the shipped harness.

### ⚠️⚠️ gcsim is NOT deterministic, and no flag makes it so

The plan asserted byte-identical reproduction with `iteration=1`. It is not achievable: the
sample seed comes from `CryptoRandSeed()` (`cmd/gcsim/main.go:201`), and **some kits genuinely
roll dice** — Ningguang's catalyst normals pick a random animation variant per swing
(`Normal (Left)` / `(Right)` / `(Twirl)`), and Fischl's A4 fired 5 or 6 times across otherwise
identical runs. Application counts flickered 199/200 across the corpus.

⚓ **So the oracle is STATISTICAL, not exact.** The harness runs every fixture **3×**, reports
the modal run, and **flags any fixture whose runs disagreed** — turning a silent baseline
wobble into a stated property. ⛔ Do not "fix" this by patching gcsim.

### ⚠️⚠️ Reactions leave FOUR kinds of trace, not one

The plan listed three. The fourth is the one that matters, and the first pass of the harness
reported **zero** crystallizes in a fixture that produced seven.

| kind                    | trace                                                                                                                                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| amplifying              | `damage.logs.amp`                                                                                                                                                                                                              |
| additive                | `damage.logs.cata`                                                                                                                                                                                                             |
| damaging transformative | a `damage` event whose `abil` IS the reaction                                                                                                                                                                                  |
| **non-damaging**        | **no `damage` event at all** — crystallize emits `element :: "<ele> crystallize shard spawned"`; **freeze emits nothing** and is only visible as `frozen` appearing in an application's after-state, so the harness DERIVES it |

⚠️ Also: bloom and burning each log a second `… (self damage)` event for the same reaction.
Counting both doubles those families.

### ⚠️ The two reaction counts are not the same unit

Ours is one event per triggering application; gcsim's is one damage **instance**, and burning
and electro-charged **tick** — 20 gcsim rows against our 2 for one burning window. The report
now says so at both the summary and the per-fixture level, and tallies by reaction type rather
than implying a 1:1 list comparison. **The application rows are the comparable ones.**

### Syntax and ergonomics

- `wait(n)` is a **system function**, not a character action — `<char> wait(n);` is a parse
  error. It takes no prefix.
- The harness self-bootstraps: `scripts/lib/alias-hook.mjs` is a **static** import (so the
  `$lib` resolver and an `import.meta.glob` shim are registered before the dynamic parser
  imports run), which means plain `node scripts/audit-gcsim-reactions.mjs` works. ⚓ That hook
  is what lets the audit drive **the real parser** rather than a re-implementation of it.
- Our side's applications are replayed from the IR using the **exported** `icd.ts` model —
  the same module the parser calls — so the description of our behaviour cannot drift from the
  behaviour.
