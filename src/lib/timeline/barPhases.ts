/**
 * src/lib/timeline/barPhases.ts
 *
 * Pure E/Q pill phase geometry — the single source of the three-case segment
 * layout that both the live Gantt template (RotationTimeline.svelte) and the
 * PNG exporter (timelineExport.ts) render. Extracted in P4 step 3e from the
 * two arithmetically identical inline twins.
 *
 * Returns geometric segments in TIMELINE SECONDS. Each consumer applies its
 * own pixel projection (barGeom / barGeomW) and its own per-role styling
 * (DOM classes vs. canvas fills). Only the case selection and the start/span
 * math live here — styling stays consumer-side, faithful to each medium.
 *
 * The three cases:
 *   1. Sac-proc reset — a single dim continuation bar (CD reset to 0).
 *   2. Stance ability (uptime > 0, no summon lane) — a caster-state window,
 *      either clipped by the cooldown (case A: uptime + ghost-CD remainder) or
 *      outlasting it (case B: first phase up to CD + dim overflow past it).
 *   3. Single-phase — cast time + ghost-CD remainder (instant and
 *      summon-bearing abilities, whose lifetime lives on the summon lane).
 *
 * Pure + runtime-import-free (types only), safe for the pure timeline modules.
 */

/** Which visual treatment a segment carries. Geometry is medium-agnostic; the
 *  consumer maps the role to its own styling:
 *  - `uptime`      solid cast-fill, rounded, badge (case-A uptime & single cast)
 *  - `uptimeFlush` solid cast-fill, square, badge (case-B first phase)
 *  - `uptimeDim`   dim continuation tone, rounded, badge (sac-proc reset bar)
 *  - `overflow`    dim continuation tone, square, no badge (case-B past CD)
 *  - `ghost`       ghost CD track; carries `cooldown` for the "Ns" label */
export type BarPhaseRole = 'uptime' | 'uptimeFlush' | 'uptimeDim' | 'overflow' | 'ghost';

export interface BarPhaseSegment {
	role: BarPhaseRole;
	/** Segment start in timeline seconds. */
	start: number;
	/** Segment span in seconds (fed to the consumer's pixel projection). */
	span: number;
	/** Cooldown seconds for the ghost-track label — present on `ghost` only. */
	cooldown?: number;
	/** Which repetition of the cycle this segment belongs to (0 = the first, the
	 *  one that actually happened). Set only by `repeatCycles` for the Team
	 *  Builder's Compare chart, where later cycles are HYPOTHETICAL and render
	 *  weaker. The planner and the PNG exporter draw real casts off a parsed
	 *  rotation, never a projected cadence, so they neither set nor read it. */
	cycle?: number;
}

/** Minimal bar shape the phase math reads. `TimelineBar` (and the exporter's
 *  `ExportBar` superset) both satisfy this structurally. */
export interface BarPhaseBar {
	start: number;
	castTime: number;
	cooldown: number;
	uptime: number;
	summonActivatesAt?: number;
	sacProcFired?: boolean;
	/** Absolute time the ability is castable again. The ghost tail ENDS here.
	 *  Absent ⇒ falls back to `start + cooldown`, which is the same thing for
	 *  every ability with no `cooldownStartDelay` authored. */
	readyAt?: number;
}

/**
 * The three-case E/Q pill phase segments for one bar.
 *
 * `hasSummon` — whether the cast spawns a summon whose lifetime renders on the
 * dedicated summon lane. When true, a stance-style uptime bar collapses to the
 * single-phase layout (the lifetime is drawn on the lane, not the E/Q row).
 */
export function barPhases(bar: BarPhaseBar, hasSummon: boolean): BarPhaseSegment[] {
	const fieldOffset = (bar.summonActivatesAt ?? 0) / 60;
	const fieldStart = bar.start + fieldOffset;

	// Seconds from the bar's start until the ability is castable again. ⚠ THIS
	// IS NOT `bar.cooldown` — a cooldown whose CLOCK starts late ends late, and
	// the tail's END is where a reader looks to answer "when can I recast".
	// `bar.cooldown` survives as the ghost's LABEL, because the label's job is
	// to name the cooldown's LENGTH ("7s"), not to locate its end.
	const cdSpanFromStart = Math.max(
		bar.castTime,
		bar.readyAt !== undefined ? bar.readyAt - bar.start : bar.cooldown
	);

	// Case 1 — Sac proc: CD reset to 0, one dim continuation bar spanning the
	// duration (or the cast time when the ability is instant).
	if (bar.sacProcFired) {
		const span = bar.uptime > 0 ? bar.uptime : bar.castTime;
		const start = bar.uptime > 0 ? fieldStart : bar.start;
		return [{ role: 'uptimeDim', start, span }];
	}

	// Case 2 — Stance ability: caster-state window with optional CD overflow.
	if (bar.uptime > 0 && !hasSummon) {
		if (cdSpanFromStart >= fieldOffset + bar.uptime) {
			// Case A: cooldown outlasts the stance window.
			const segs: BarPhaseSegment[] = [{ role: 'uptime', start: fieldStart, span: bar.uptime }];
			const cdSpan = cdSpanFromStart - fieldOffset - bar.uptime;
			if (cdSpan > 0) {
				segs.push({
					role: 'ghost',
					start: fieldStart + bar.uptime,
					span: cdSpan,
					cooldown: bar.cooldown
				});
			}
			return segs;
		}
		// Case B: stance window outlasts the cooldown.
		return [
			{ role: 'uptimeFlush', start: fieldStart, span: cdSpanFromStart - fieldOffset },
			{
				role: 'overflow',
				start: bar.start + cdSpanFromStart,
				span: fieldOffset + bar.uptime - cdSpanFromStart
			}
		];
	}

	// Case 3 — Single-phase: cast time + ghost CD remainder.
	const segs: BarPhaseSegment[] = [{ role: 'uptime', start: bar.start, span: bar.castTime }];
	const cdSpan = cdSpanFromStart - bar.castTime;
	if (cdSpan > 0) {
		segs.push({
			role: 'ghost',
			start: bar.start + bar.castTime,
			span: cdSpan,
			cooldown: bar.cooldown
		});
	}
	return segs;
}
