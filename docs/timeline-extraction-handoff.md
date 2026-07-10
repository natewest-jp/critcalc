# Handoff — Timeline Extraction Cleanup (for Fable 5)

**Status:** ready to start. Tree clean on `main` @ `659ec77`, 719 tests green, lint + `svelte-check` clean.
**Owner picking this up:** Fable 5, advanced-compute run.
**Est. size:** medium-large, self-contained. No behavior change — this is a pure refactor + test-coverage pass.

---

## Mission (one sentence)

Extract the semantic computation pipelines currently trapped inside `src/lib/components/RotationTimeline.svelte` (~4,620 lines) into **pure, unit-tested modules**, so the buff/summon/moonsign logic can be tested line-by-line instead of only by reading the component — **without changing a single pixel of rendered output.**

## Why this, why now

1. **Testability (the roadmap reason).** The duplicate-dispatch bug class from the 2026-07-05 sweep (bug #11 + the `nbSelf` bonus find, and the Chevreuse `each_key` freeze before it) lived in these functions _precisely because they can't be tested in place_. A per-track loop that mixes track-scoped and character-scoped dispatches can only be caught today by careful reading. Post-extraction, "a character appearing in two rotation segments produces the same rows as one segment" becomes a one-line regression test. See `memory/project_timeline_extraction_cleanup.md` and `memory/archive_bug_lessons.md` (the `each_key` lesson).
2. **Architecture.** It shrinks the blast radius of the future P4 parser event-stream refactor (`memory/project_tier_c_architecture_plan.md`, P4 section): the extracted modules become tested consumers of the event stream.
3. **Performance context (secondary — read the honest caveat below).** A 2026-07-10 diagnosis found that navigating _to_ the planner blocks the main thread ~101ms (Chrome) / ~227ms (WebKit) — this is **baseline instantiation of the 4,620-line component**, not the buff pipeline (an _empty_ rotation costs the same, and `computeTeamBuffRows` does almost nothing when there are no bars). So **this extraction will NOT by itself fix the Safari tool-to-tool fade jump.** What it _does_ is make a follow-on perf pass possible: once these pipelines are isolated pure functions, they can be made lazy/memoized and the component can be split so instantiation front-loads less work. Treat perf as a _later_ payoff that this unlocks, not this task's success metric. Do not chase the 227ms here.

## The targets (with line refs in `RotationTimeline.svelte`)

Ordered by value. Each becomes a module under a new `src/lib/timeline/` folder with a sibling `*.test.ts`.

| Target                     | Line   | Shape today                                                                                                                                                                                                                                                                                                                             | Work to extract                                                                                                                                                                                    |
| -------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`computeTeamBuffRows`**  | `667`  | **Already a pure function** — every input is a parameter (`tracks`, `constellationLevels`, `loadoutMap`, `teamFactionCounts`, `teamElementCountsByHolder`, `nbBars`, `reactionEvents`) → `Array<TeamBuffSubrow & {key}>`. Only external dep is `getLoadedCharacter` + the local `normalizeBuffLikeEffects` / effect-collection helpers. | Move it + its private helpers to `src/lib/timeline/teamBuffRows.ts`. This is the biggest win and the lowest risk — it's _shaped_ right, it just lives where it can't be tested.                    |
| **`charReceivedBuffRows`** | `1647` | A `$derived.by(() => …)` closure that reads reactive state directly (`$constellations`, `effectiveLoadout`, `nbBars`, etc.). Contains the `nbSelfDispatched` guard (`2069`).                                                                                                                                                            | Lift the store reads to **parameters**, then extract the body to `src/lib/timeline/charReceivedBuffRows.ts`. The `$derived.by` stays in the component but becomes a one-liner calling the pure fn. |
| **`weaponProcRows`**       | `1611` | `$derived.by` → `WeaponProcSubrow[]`.                                                                                                                                                                                                                                                                                                   | Same pattern: lift reads to params, extract.                                                                                                                                                       |
| **`summonSubrows`**        | `2394` | `$derived.by` → `SummonSubrow[]`, plus `summonLaneTop()` (`2474`) geometry.                                                                                                                                                                                                                                                             | Extract the data computation; leave geometry (`summonLaneTop`) component-side for now.                                                                                                             |
| **`moonsignRows`**         | `2564` | `$derived` window computation.                                                                                                                                                                                                                                                                                                          | Smallest; extract last.                                                                                                                                                                            |

**Do NOT extract yet:** `barGeom` / `xForTime` and other pixel-geometry helpers. They belong with the SVG-overlay refactor (launch roadmap L3) — that's the natural moment. Keep this diff to _semantic_ computation only.

**Shared types** (`TeamBuffSubrow`, `CharReceivedBuffSubrow`, `WeaponProcSubrow`, `SummonSubrow`, `CharacterTrack`, `LoadoutEntry`) that are declared inside the component and are needed by the extracted modules: move them to `src/lib/timeline/types.ts` (or reuse existing homes in `src/lib/types/`). Import back into the component.

## Approach (step by step)

1. **Create `src/lib/timeline/`.** Start with `teamBuffRows.ts` — move `computeTeamBuffRows` + its private helpers verbatim. Change `SvelteMap`/`SvelteSet` → plain `Map`/`Set` in the extracted module (they don't need reactivity outside a component; this also makes them testable in node). Verify the component still imports and renders identically.
2. **Write `teamBuffRows.test.ts` first, before touching the others.** Lock in the behavior (see Tests below). This is the safety net for everything after.
3. **Repeat for each target**, one PR-sized commit each, in the table's order. After each: `npm run check`, `npm run lint`, `npm test`, and a browser spot-check (see Verify).
4. **Lift store reads carefully.** For the `$derived.by` targets, the component keeps a thin `$derived.by(() => pureFn($constellations, effectiveLoadout, …))`. The reactive graph is unchanged; only the _body_ moved. Keep the exact same inputs in the exact same order the component computed them.

## Hard constraints

- **Zero behavior change.** Same rows, same keys, same order, same pixels. This is a refactor; if output differs, you broke it.
- **Keep commits separable** — one target per commit, each green. Do not bundle unrelated changes.
- **KQM conventions throughout** (ICD, snapshotting, ER, gauge theory). Match the surrounding code's idiom, comment density, and naming. Read `CLAUDE.md` + `memory/feedback_conventions.md`.
- **No fake timing data**; `// TODO: data gap — [field]` for gaps, never plausible-looking fills.
- **The keyed-`{#each}` lesson.** The `key` returned by `computeTeamBuffRows` (`TeamBuffSubrow & {key}`) is load-bearing — the render key must stay at least as fine-grained as the dedup key, or you get an `each_key_duplicate` freeze (`memory/archive_bug_lessons.md`, Chevreuse A4). Preserve it exactly.

## Tests to write (the whole point)

For `computeTeamBuffRows` especially, cover the bug classes the sweep found:

- **Duplicate-dispatch regression:** a character split across two tracks/segments produces the **same** buff rows as the same character in one segment (the `dispatchedCharScoped` guard, line `690`). One character in N segments ≠ N× the bars.
- **NB-self dispatch** fires once per `nbBars` event, not once per track (the `nbSelfDispatched` guard, `2069`).
- Constellation-gated effects appear/disappear at the right cons level.
- `onReaction` effects keyed to the emitting character + castKind.
- Empty inputs → empty output (no crash, no phantom rows).
- Stable `key`s across recompute for identical inputs.

Fixtures: build minimal `CharacterTrack[]` by hand (don't load real 140-char JSONs in unit tests — keep them fast and hermetic). Cross-check a couple against a known-good rendered rotation if helpful.

## Verify

- `npm run check` (svelte-check, must stay 0/0), `npm run lint` (prettier + eslint — run **lint**, not just check), `npm test` (must stay ≥719 and only grow).
- **Browser parity:** load a real rotation in the planner and confirm the team-buffs row, summon lane, moonsign lane render identically before/after. Use the `verify` skill (`.claude/skills/verify/SKILL.md`) — the tools are client-rendered, so drive headless Chrome; type notation into the CodeMirror `.cm-content`, screenshot the timeline. A good fixture: a Natlan team (exercises NB bars) + a Moonsign pair.

## Definition of done

- `src/lib/timeline/` holds the five pipelines as pure modules, each with a passing `*.test.ts`.
- `RotationTimeline.svelte` imports them; its `$derived`s are thin wrappers. The file is meaningfully smaller.
- Rendered output is pixel-identical (verified in-browser on a real rotation).
- `check` + `lint` clean, test count up, tree ready to commit in separable steps.

## Pointers

- Component: `src/lib/components/RotationTimeline.svelte` (line refs above).
- Parser it consumes: `src/lib/utils/notationParser.ts` (see `memory/project_parser_architecture.md`).
- Schema: `memory/reference_data_schema.md` + `src/lib/types/ability.ts` JSDoc.
- Prior art for pure+tested timeline logic: the existing `*.test.ts` under `src/routes/(scene)/(tools)/crit-visualizer/lib/` are a good style reference.
- Full rationale: `memory/project_timeline_extraction_cleanup.md`, `memory/project_bug_sweep_2026-07-05.md`, `memory/project_tier_c_architecture_plan.md` (P4).
