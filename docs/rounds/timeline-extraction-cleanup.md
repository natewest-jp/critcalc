# Timeline Extraction Cleanup — ✅ SHIPPED 2026-07-10

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

Done per the timeline-extraction handoff (pruned 2026-07-15 — this memory is the record), five separable commits on `main`
(`1635181` teamBuffRows → `3b8fd45` charReceivedBuffRows → `8693c48`
weaponProcRows → `604d944` summonSubrows → `8071f94` moonsignRows).

## What exists now

`src/lib/timeline/` — all pure, no Svelte reactivity (plain Map/Set):

- `types.ts` — shared row/bar shapes: TeamBuffSubrow, CharReceivedBuffBar/Subrow, WeaponProcSubrow, SummonBar/Subrow, MoonsignRow, SlottedTrack, BuffEffect/ResShredEffect
- `buffDisplay.ts` — formatBuffDisplayValue, canonicalHeadlineOf, resShredDisplayStat, etc.
- `effectCollection.ts` — getCharacterEffectsFor{Cast,OnHit,AfterDuration,TeamNightsoulBurst,OnReaction}, resolveCastContext/resolveBlockContext, getBlockDamageTag
- `teamBuffRows.ts` / `charReceivedBuffRows.ts` / `weaponProcRows.ts` / `summonSubrows.ts` / `moonsignRows.ts` — each with a sibling `*.test.ts` (18/11/4/12/4 tests)

**Character resolver is injected** (`getCharacter: (id) => CharacterData | null`) —
component passes the reactive `getLoadedCharacter`, tests pass hermetic fixtures.
Artifact/weapon lookups stay direct imports (eager, sync). The component's
`$derived`s are thin wrappers; the reactive graph is unchanged. `findCastSummon`
is also imported by the component template (E/Q bar rendering).

## Verification

- 768 tests green (was 719); check + lint clean.
- **Pixel parity**: built pre-extraction `659ec77` in a worktree vs new `main`,
  drove identical rotations (Mavuika/Xilonen/Linnea/Flins — NB + moonsign lanes;
  Fischl/Bennett/Furina/Kazuha — summons + team/received buffs) in headless
  Chrome — `.rp-root` screenshots 0 differing pixels, `.rp-tracks` DOM
  signatures identical.

## Notes for future work

- The rowMap `key` on TeamBuffSubrow is load-bearing (each_key_duplicate freeze,
  see `docs/rounds/bug-lessons.md`) — now regression-tested in teamBuffRows.test.ts,
  as are the dispatchedCharScoped / nbSelfDispatched multi-segment guards.
- Geometry (barGeom/xForTime, summonLaneTop) intentionally NOT extracted — waits
  for the SVG-overlay refactor (launch roadmap L3).
- These modules become the tested consumers of the P4 parser event-stream
  refactor (`docs/rounds/tier-c-architecture-plan.md`).
- Unlocks the planner mount-cost perf pass (`docs/rounds/planner-perf.md`) —
  pipelines can now be deferred/memoized off the first-paint path.
