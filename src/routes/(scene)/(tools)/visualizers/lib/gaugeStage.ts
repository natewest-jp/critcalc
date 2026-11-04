/**
 * The Gauge explorer's headline and the marks it draws for the old aura log
 * (design §8). ⚓ Nate, at the start of the stage round: the headline is the
 * aura on the target at the moment you point at or pin, and at rest, when the
 * target goes bare.
 */
import { gaugesAt, type AuraKey, type SeriesInterval, type SimEvent } from '$lib/utils/gauge';
import { AURA_MOD_META, AURA_MOD_ORDER } from '$lib/utils/auraDisplay';

/** The auras on the target at `t`, in the display order. The dashed fuel is
 *  bookkeeping, not an aura, so it is left out. */
export function aurasAt(series: SeriesInterval[], t: number): { mod: AuraKey; u: number }[] {
	const at = gaugesAt(series, t);
	return AURA_MOD_ORDER.flatMap((mod) => {
		const u = at[mod];
		return u === undefined || AURA_MOD_META[mod].dash ? [] : [{ mod, u }];
	});
}

/** When the last aura runs out, or null if no aura ever forms (an empty chart,
 *  or only Anemo and Geo). */
export function bareFrom(series: SeriesInterval[]): number | null {
	let end: number | null = null;
	for (const { key, points } of series) {
		if (AURA_MOD_META[key].dash || !points.length) continue;
		end = Math.max(end ?? 0, points[points.length - 1].t);
	}
	return end;
}

export type GaugeHead = { figure: string; sentence: string };

/** Units at two places, so a figure keeps its width while you scrub. */
const fmtU = (u: number) => `${u.toFixed(2)}U`;
const fmtT = (t: number) => `${t.toFixed(1)}s`;

/** The headline: what is on the target at `t`, or with no moment, when it
 *  goes bare. */
export function gaugeHead(series: SeriesInterval[], t: number | null): GaugeHead {
	if (t === null) {
		const end = bareFrom(series);
		return end === null
			? { figure: 'No aura', sentence: 'on the target' }
			: { figure: 'No aura', sentence: `from ${fmtT(end)}` };
	}
	const auras = aurasAt(series, t);
	return {
		figure: auras.length
			? auras.map((a) => `${fmtU(a.u)} ${AURA_MOD_META[a.mod].label}`).join(' · ')
			: 'No aura',
		sentence: `at ${fmtT(t)}`
	};
}

/** 🎛️ How finely `widestHead` samples the sequence. */
const SAMPLE_S = 0.05;

/**
 * The longest headline this sequence can show, for the room the headline
 * keeps (design §4: it has a fixed height, so nothing under it moves). A
 * pinned Burning moment names three auras and wraps on a phone where "No
 * aura" doesn't. Units are fixed-width, so the longest figure is the one
 * naming the most, and the longest sentence is the latest time's.
 */
export function widestHead(series: SeriesInterval[], duration: number): GaugeHead {
	let figure = 'No aura';
	for (let t = 0; t <= duration; t += SAMPLE_S) {
		const f = gaugeHead(series, t).figure;
		if (f.length > figure.length) figure = f;
	}
	return { figure, sentence: `at ${fmtT(Math.max(duration, 10))}` };
}

/** What a reaction took off each aura, for a label beside the curve's drop:
 *  the aura, the moment, the amount, and the gauge left just after. EC's
 *  ticks are not reactions here (the curves' steps show them). */
export type DropMark = { mod: AuraKey; time: number; amount: number; after: number };

/** 🎛️ How far past the reaction to read what is left: a frame and a bit, so
 *  the reading is after the drop, and decay in that time is invisible. */
const AFTER_S = 0.02;

export function dropMarks(series: SeriesInterval[], events: SimEvent[]): DropMark[] {
	const out: DropMark[] = [];
	for (const e of events) {
		if (e.kind !== 'reaction') continue;
		for (const c of e.consumed) {
			if (c.amount <= 0 || AURA_MOD_META[c.mod].dash) continue;
			out.push({
				mod: c.mod,
				time: e.time,
				amount: c.amount,
				after: gaugesAt(series, e.time + AFTER_S)[c.mod] ?? 0
			});
		}
	}
	return out;
}
