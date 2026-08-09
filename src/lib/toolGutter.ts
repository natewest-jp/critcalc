/**
 * THE TOOL GUTTER (⚓ NATE 2026-08-08) — the breathing-room round.
 *
 * ONE number for the bare scene between any two boxes inside a single tool
 * object. The band stack's gap and the main↔aside gap both derive from it, so
 * a tool's interior rhythm is one knob rather than two that have to be kept
 * agreeing by hand.
 *
 *     ▓▓▓▓▓▓▓▓▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒
 *     ▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
 *     ▓▓▓▓▓▓▓▓                                          ← TOOL_GUTTER
 *     ▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░ ▒▒▒▒▒▒▒▒▒▒▒▒▒
 *     ▓▓▓▓▓▓▓▓                        ↑
 *     ▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░│▒▒▒▒▒▒▒▒▒▒▒▒▒
 *     ▓▓▓▓▓▓▓▓                    TOOL_GUTTER
 *
 * WHY IT EXISTS. The three tools were measured for how much bare scene shows
 * INSIDE each one's own bounding box: the Rotation Planner 2.1%, the Team
 * Builder 6.7%, the Visualizers 11.5% — while TOTAL opaque coverage below the
 * chrome was near-identical across all three (95.8 / 88.9 / 87.4). So the
 * planner did not feel cramped because it had less empty space; it felt
 * cramped because all of its empty space was at the PERIMETER, where it reads
 * as a margin, instead of running THROUGH the composition, where it reads as
 * air. The Visualizers' channels are `1.25rem` = 20px. Both benched tools ran
 * at 8.
 *
 * ⚠ AND 8 IS NOT A SMALL GUTTER, IT IS A SEAM. Below roughly 12px, bare scene
 * between two same-valued darks stops reading as a channel and starts reading
 * as a crack in a join — it adds a LINE to the composition rather than air.
 * That is why raising this number lightens the tools instead of merely
 * shrinking them, and it is the one thing to keep in mind when tuning it down:
 * there is a floor below which the gap is worse than no gap at all.
 *
 * The planner already proved it once, by accident. Its single genuinely
 * breathing edge was the `clamp(16px, 2.5vw, 32px)` above TeamBonusesBlock —
 * the only Visualizers-scale gap in either benched tool.
 *
 * ⚠ IMPORT THIS WITH ITS `.ts` EXTENSION — `from './toolGutter.ts'`. It is the
 * only extensioned relative import in src/, and it is deliberate: the geometry
 * modules that consume it (toolBands, toolColumns) are imported BY PROBES, and
 * scripts/probe-*.mjs run under Node's native type stripping, where the ESM
 * resolver does not do extension inference. Vite would happily resolve
 * `./toolGutter`, so the build stays green and only the probe breaks — with an
 * ERR_MODULE_NOT_FOUND naming this file, from a probe that was passing an hour
 * ago. `rewriteRelativeImportExtensions` is already on in tsconfig for exactly
 * this, so the extension costs nothing and typechecks clean.
 *
 * The rule that generalizes: a module a probe imports is a module NODE has to
 * be able to resolve, transitively. Probes import these so they cannot drift
 * from the implementation, and that guarantee is what pays for the extension.
 */

/**
 * Bare scene between two boxes inside one tool. ⚓ NATE — the round's headline
 * knob; everything else here follows it.
 *
 * Consumers: BAND_STACK_GAP (toolBands.ts) vertically, COLUMN_GAP
 * (toolColumns.ts) horizontally, `.tb-stack` in the Team Builder and
 * `.rp-root` in the planner. The planner's own stack→TeamBonusesBlock gap is
 * deliberately DOUBLE this (see `.rotation-page`): that seam separates the
 * tool from a caption about it, which is a bigger break than the one between
 * two boxes of the same tool, and the two must not collapse to equal.
 */
export const TOOL_GUTTER = 16;

/**
 * Bare scene between the bench ribbon's right edge and the tool beside it.
 * ⚓ NATE — its own knob, because the ribbon is a different KIND of neighbour
 * (site-persistent HUD, not part of this tool), but it starts on the rhythm.
 *
 * ↻ 2026-08-08: was 0 and lived in benchBand.svelte.ts. It shipped at 0 in the
 * abutting round because the job there was to stop the two surfaces
 * OVERLAPPING — two things that fade together must not composite the tool's
 * ground twice — and tiling was the conservative way to prove they no longer
 * did. Once a tool became a set of objects with the world running between them,
 * the bench being the one seam with no world in it made it read as glued to the
 * tool rather than standing beside it: the last edge of the upside-down U.
 *
 * ⚠ IT MOVED HERE BECAUSE PROBES HAVE TO READ IT. benchBand.svelte.ts is a
 * RUNES module — Node's type stripping happily loads it and then dies on
 * `$state is not defined`, so no probe can import anything from it, transitively
 * or otherwise. A pure spacing number had no business living in a reactive-state
 * module; the probe hitting that wall is the signal, not the problem.
 * TOOL_INSET and everything that aligns to the seam still derive from it in
 * benchBand, so this remains the only number to move.
 */
export const RIBBON_GAP = TOOL_GUTTER;
