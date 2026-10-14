/**
 * src/lib/timeline/mergeRefreshedBars.ts
 *
 * Refresh-merge for buff ROWS (2026-08-15).
 *
 * ⚓ A BUFF RE-APPLIED BEFORE IT EXPIRES IS ONE COVERED SPAN, NOT TWO BARS.
 * Every emit site in `deriveBuffWindows` produces one window per mechanical
 * trigger — which is correct, and the IR keeps it that way for provenance and
 * for the export. What the CHART wants is different: two windows saying the
 * same thing at overlapping times used to draw as two bars, two leading edges
 * and — the actual pain — TWO LABELS, the second landing on top of the first's
 * tail. Merging happens here, at the projection, so the windows stay honest and
 * only the drawing changes.
 *
 * ⛔ NO INTERIOR SEAMS (⚓ Nate 2026-08-15). A merged bar gets ONE lit leading
 * edge and nothing inside it. The seam was considered and refused on a
 * principle worth keeping: in the Team Builder's Compare view (retired
 * 2026-10-13) the lane WAS the ability, so a seam was the only place "where
 * does this cast end" could live —
 * but in the planner the cast markers and E/Q bars sit one row up, so a seam in
 * a buff row re-encodes what the chart already says. That is the same
 * redundancy the labels were guilty of. The 2px edge itself STAYS; it was only
 * ever doing two jobs (separating stacked bars, and marking a buff bar as a
 * different kind of object), and merging retires the first while leaving the
 * second untouched.
 *
 * ⚓ The payoff is that a seam becomes MEANINGFUL. Only same-shape overlaps
 * merge, so two bars that still touch in one row are genuinely different — a
 * stack-scaled buff at 2 stacks vs 3, or a cast whose conditions qualified a
 * different effect set. Today an edge means "a bar starts here" and is nearly
 * always noise; after this it means "the buff CHANGED here".
 *
 * ↻ 2026-09-17 (pool round): ONE interior seam now exists, and it is that
 * meaning drawn on purpose — `fuseNestedBars` below fuses the parts of one
 * cast into one bar with a seam where a SHORTER part ends. It is not a refresh
 * seam; see its note.
 */

import type { MergedEffectDisplay } from './types';

/** The shape both buff-row bar types share. */
type MergeableBar = {
	start: number;
	end: number;
	effects: MergedEffectDisplay[];
	seams?: number[];
	/** The received surface's own length of the buff (frames), which a slice's
	 *  `end − start` is not. */
	duration?: number;
	/** Where the buff ends on its own (`CharReceivedBuffBar.naturalEnd`); a
	 *  slice ending before it was CUT by a swap and draws no seam. */
	naturalEnd?: number;
};

/** Two bars say the same thing iff their display effects match pairwise. The
 *  comparison is on the FORMATTED value, not the underlying effect object,
 *  because that is exactly the question being asked: would these two bars print
 *  identical text? A stack-scaled buff that ramped between the two triggers
 *  formats differently and therefore stays two bars, which is the intent. */
function sameDisplay(a: MergeableBar, b: MergeableBar): boolean {
	if (a.effects.length !== b.effects.length) return false;
	return a.effects.every(
		(e, i) =>
			e.stat === b.effects[i].stat &&
			e.displayValue === b.effects[i].displayValue &&
			e.note === b.effects[i].note
	);
}

/** Frames → seconds for a seamed effect's note, the same rounding the tooltip
 *  footer uses (754f prints 12.57, not 12.566…). */
const fmtSecs = (frames: number): string => `${Number((frames / 60).toFixed(2))}s`;

/**
 * ⚓ THE PARTS OF ONE CAST ARE ONE BAR WITH A SEAM (pool round, 2026-09-17).
 *
 * `deriveBuffWindows` emits one window per (provenance, duration) — a cast
 * granting a 12s ATK and a 15s ATK% is two windows from one start — and both
 * land in one row because the row key is the source. Drawn as two bars they
 * overlap from the same left edge and the shorter vanishes under the longer's
 * label. So bars that share a START in one row fuse here into ONE bar running
 * to the longest end, with a lit seam at each inner end and every effect
 * carrying its own length as a `note` (⚓ Nate 2026-09-17; the fallback, if the
 * seam does not read, is one row per duration).
 *
 * ⚓ This is the merge law's seam, not a violation of it. "No interior seams"
 * refuses a seam at a REFRESH, where it would re-encode the cast marker one row
 * up; a seam here says the buff CHANGED — one of its stats ended — which is
 * exactly what the law says a surviving edge means.
 *
 * ⛔ A seamed bar never refresh-merges (see `mergeRefreshedBars`): a compound
 * re-applied before it expires would need its inner seams re-placed at the new
 * ends, and two lit leading edges say the same thing honestly.
 *
 * `canFuse` is the consumer's gate, checked over the whole same-start group —
 * one refusal keeps every bar in the group separate. The received surface
 * refuses envelopes (a ramp's gradient is drawn over the bar's span, and a
 * fused span is the longest part's); the team surface refuses ledger bars.
 */
export function fuseNestedBars<T extends MergeableBar>(
	bars: T[],
	canFuse?: (b: T) => boolean
): T[] {
	if (bars.length < 2) return bars;
	const byStart = new Map<number, T[]>();
	for (const b of bars) {
		const g = byStart.get(b.start);
		if (g) g.push(b);
		else byStart.set(b.start, [b]);
	}
	if (byStart.size === bars.length) return bars;
	const out: T[] = [];
	for (const group of byStart.values()) {
		if (group.length === 1 || (canFuse && !group.every(canFuse))) {
			out.push(...group);
			continue;
		}
		const longest = group.reduce((a, b) => (b.end > a.end ? b : a));
		// ⚠ The note is the effect's OWN length, which on the received surface is
		// the bar's `duration` and NOT `end − start`: a slice ends where the
		// receiver leaves the field (Iansan's ATK on her own row is 0.58s of a
		// 12s buff), and a note reading "0.58s" would describe the swap, not the
		// mechanic. Two parts can also share a span and still differ in length —
		// both cut by one swap-out — so the notes key on length, the seams on end.
		//
		// ⚓ AN IDENTICAL GRANT IS ONE ROW, AND ITS END IS A SEAM ONLY IF IT SURVIVES.
		// A kit can say the same thing twice from one cast — Kazuha's C2 gives
		// +200 EM to the active character AND to himself, "do not stack" — so on
		// his own row the active slice (cut at his swap-out) and the self half
		// (the field's length) print one line, the longer instance wins, and the
		// slice's end draws no seam because nothing the bar still lists ends there.
		const lengthOf = (b: T) => b.duration ?? b.end - b.start;
		// ⚓ A SEAM ONLY AT A NATURAL END (⚓ Nate 2026-09-17, on Iansan's own row):
		// her slice of the active-target ATK stops where SHE swaps out, and a
		// seam there marks the swap, which the connector one row up already
		// draws. The same rule the tick cap got the same day — a cut is not an
		// end. A bar with no `naturalEnd` (the team surface, a self buff) ends
		// naturally by construction.
		const naturalEndOf = (b: T) => b.end >= (b.naturalEnd ?? b.end);
		const kept = new Map<
			string,
			{ effect: MergedEffectDisplay; length: number; end: number; natural: boolean }
		>();
		for (const b of group) {
			for (const effect of b.effects) {
				const key = `${effect.stat}::${effect.displayValue}`;
				const cur = kept.get(key);
				const len = lengthOf(b);
				if (!cur || len > cur.length || (len === cur.length && b.end > cur.end))
					kept.set(key, { effect, length: len, end: b.end, natural: naturalEndOf(b) });
			}
		}
		const rows = [...kept.values()];
		const lengths = new Set(rows.map((r) => r.length));
		const maxLength = Math.max(...lengths);
		const effects =
			lengths.size > 1
				? rows.map((r) => ({ ...r.effect, note: fmtSecs(r.length) }))
				: rows.map((r) => r.effect);
		const seams = [
			...new Set(rows.filter((r) => r.natural && r.end !== longest.end).map((r) => r.end))
		].sort((a, b) => a - b);
		out.push({
			...longest,
			...(longest.duration !== undefined ? { duration: maxLength } : {}),
			effects,
			...(seams.length > 0 ? { seams } : {})
		});
	}
	return out;
}

/**
 * Collapse overlapping same-shape bars within ONE row into single spans.
 *
 * `canMerge` is an extra per-consumer gate, checked only after the display
 * comparison passes. The received surface needs it: its bars carry ramp/decay
 * envelopes drawn from `buffStart`, and a refreshed ramp RESTARTS — merging two
 * of those would paint one continuous gradient over a buff that actually
 * reset. It also carries `procCooldown` and `duration` for the tooltip, which
 * must agree before two bars can become one.
 *
 * ⚠ Sorts by start first. Bars arrive in window-EMISSION order (`id`), which is
 * per-track and only incidentally time-ordered; the renderer's `labelCapPx`
 * already assumed `bars[i + 1]` is the next bar SPATIALLY, so sorting fixes a
 * latent mismatch as well as making the merge order-independent.
 */
export function mergeRefreshedBars<T extends MergeableBar>(
	bars: T[],
	canMerge?: (a: T, b: T) => boolean
): T[] {
	if (bars.length < 2) return bars;
	const sorted = [...bars].sort((a, b) => a.start - b.start || a.end - b.end);
	const out: T[] = [];
	for (const bar of sorted) {
		const open = out[out.length - 1];
		if (
			open &&
			bar.start <= open.end &&
			!open.seams?.length &&
			!bar.seams?.length &&
			sameDisplay(open, bar) &&
			(canMerge === undefined || canMerge(open, bar))
		) {
			// ⚠ max(), not assignment: a shorter effect re-triggering inside a
			// longer open window must not pull its end backwards.
			open.end = Math.max(open.end, bar.end);
			continue;
		}
		// Copied rather than pushed by reference — `open.end` above mutates, and
		// the caller's array must not change under it.
		out.push({ ...bar });
	}
	return out;
}
