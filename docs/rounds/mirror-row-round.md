# Mirror row round (2026-10-30)

Branch `feat/mirror-count-row`. Follows `docs/rounds/alhaitham-mirrors-round.md`: once the Mirrors were simulated, Nate asked whether to draw them, and ruled for Odette's stepped bar (⚓ Nate 2026-10-30) over Columbina's one-bar-per-fire Gravity Interference.

## 1. What shipped

- **`Ability.drawsStacks {key, label}`** on a skill or burst draws the key's count as one stepped bar in the summon lane for each span it is held. The label is the kit's own name ("Chisel-Light Mirror"). Lint D.57 requires a segment-scoped `lifetime` key the character grants.
- **The ledger is the turn's own instance pool** (`sim/stackLanes.ts`). A drawn key's future is in its expiry list the moment it is written, so `LaneLedgerMap` records every `set`/`delete` and `closeStackLanes` records the swap that drops the pool (at the `lastSwapOutAt` instant). Finalize rebuilds the steps exactly (`stepsOf`) and emits a new `stacks` window kind. The two numeric consume sites now write a new list through `set` instead of splicing in place, so no write escapes the ledger; the output is unchanged.
- **Projection** (`timeline/stackRows.ts`): into `SummonSubrow`, the way `shieldRows.ts` does, so lane heights, the block layout and the PNG export take it unchanged. `SummonBar` gains `steps` and `stepMax`. The summon lane, not a buff row, because a Mirror is a thing in the world and not a stat it grants, so the bar stays when the Buffs layer is off.
- **Paint:** hard stops, the element mixed toward the chart ground by count (`stackStepMix`, `barMix.ts`), so the bar stays opaque over the swap connectors the summon lane hides. The precedent is `UPTIME_DIM_MIX`. `STACK_STEP_MIX_MIN = 50` is the one-stack floor, rising to full at the cap. The tooltip is the stepped bar's own, `label ×count`. The export paints the same steps against `CHART_BG`.

## 2. Measured

- `sim/stackLanes.test.ts` (8): `stepsOf` on one list, a later list replacing an earlier one, and an expiry already past. Then Alhaitham against gcsim's frames: `E N5 N5 N5` gives 15→481 (2, then 1 at 248); `E C N5 N5` gives 3 at 63 with losses at 248/481/714; the burst ends a span and the refill's ends at the swap (418); an overflow moves the losses to 459/692/925; nobody else gets a row. `timeline/stackRows.test.ts` (3).
- Corpus against the previous commit: 9 of 1,152 rotations differ, all Alhaitham's, and the only new lines are `stacks` windows.
- Gates: Vitest, check, lint, build; `test:e2e:chrome` 71 passed. Production build: the row draws, steps and tooltips with no console errors.

## 3. Open (⏭)

- ⏭ Nate judges the row on screen: the 50% one-stack floor, the row's place in the lane (skill rows first, then shields, then drawn stacks), and real Safari.
- The two-Mirror sliver between an E and an A1 a few frames later is narrow at default zoom.
- A typed `{mirrors:N}` writes counts, not instances, so it draws no row.
