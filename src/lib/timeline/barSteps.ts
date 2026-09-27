/**
 * src/lib/timeline/barSteps.ts
 *
 * ⚓ A `whileStacks` window's count history, cut to one bar (stepped stacks
 * round, 2026-09-27). Shared by both buff-row projections so the two surfaces
 * cannot step differently.
 */

import type { TimelineWindow } from '$lib/utils/rotationEvents';
import type { BarStep, MergedEffectDisplay } from './types';

type BuffWindow = Extract<TimelineWindow, { kind: 'buff' }>;

/** The window's steps clamped to [`start`, `end`), each formatted at its own
 *  count by `format`. `undefined` when the window carries no steps. */
export function barStepsOf(
	w: BuffWindow,
	start: number,
	end: number,
	format: (stackContext: ReadonlyMap<string, number>) => MergedEffectDisplay[]
): BarStep[] | undefined {
	const src = w.stackSteps;
	if (!src || src.length === 0) return undefined;
	const value = w.effects[0] as { value?: { type?: string; key?: string } };
	const key = value.value?.type === 'perStack' ? value.value.key : undefined;
	if (key === undefined) return undefined;
	const out: BarStep[] = [];
	for (let i = 0; i < src.length; i++) {
		const s = Math.max(src[i].at, start);
		const e = Math.min(src[i + 1]?.at ?? end, end);
		if (e <= s) continue;
		const count = src[i].count;
		const prev = out[out.length - 1];
		if (prev && prev.count === count && prev.end === s) {
			prev.end = e;
			continue;
		}
		out.push({ start: s, end: e, count, effects: format(new Map([[key, count]])) });
	}
	return out.length > 0 ? out : undefined;
}

/** The step under `frame`, or the bar's first/last at its edges. */
export function stepAt(steps: readonly BarStep[], frame: number): BarStep {
	for (const s of steps) if (frame < s.end) return s;
	return steps[steps.length - 1];
}

/**
 * The density a step is drawn at, as a fraction of the bar material's own:
 * `STEP_DENSITY_MIN` at one stack, full at `max`. ⚓ The ramp envelope's floor
 * (`ENVELOPE_MIN` in RotationTimeline, 0.5) and for the same reason — the thin
 * end must still read as a bar, and "sheer" is a retired register. One formula
 * for the screen and the PNG export.
 */
export const STEP_DENSITY_MIN = 0.5;
export function stepDensity(count: number, max: number): number {
	if (!(max > 0)) return 1;
	return STEP_DENSITY_MIN + (1 - STEP_DENSITY_MIN) * Math.min(1, count / max);
}

/** The count full density means: the key's ceiling, else the bar's own peak. */
export function stepCeiling(steps: readonly BarStep[], stepMax: number | undefined): number {
	return stepMax ?? Math.max(...steps.map((s) => s.count));
}
