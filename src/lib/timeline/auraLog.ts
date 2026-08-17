/**
 * src/lib/timeline/auraLog.ts
 *
 * THE PLANNER'S AURA LOG — the target-aura lane, in words (2026-08-17).
 *
 * ⚓⚓ IT IS THE LANE'S OWN PROJECTION, NOT A SECOND READING OF THE PARSE. It
 * takes the `AuraLane` the chart draws: the same ticks, the same
 * already-collapsed reaction runs, the same spans. So a row and the mark above
 * it cannot disagree about what happened — which they would within a week if
 * this walked `rotation.applications` and `rotation.events` on its own, because
 * every rule the lane has learned (run collapsing, family labels, the
 * provisional test) would have to be learned twice.
 *
 * ⚠️ WHAT IT CANNOT SAY, and why that is not a gap to fill here: the Gauge
 * Explorer's log reports what each application DID to the gauge — "tops the aura
 * up to 0.8U", "−0.5U Hydro" — because it drives `simulateGauge` directly and
 * keeps its `SimEvent`s. The parse keeps only the resulting trajectory
 * (`auraSeries`) plus the IR's reaction events, so the amounts are not in the
 * planner's hands at all. ⛔ Don't reconstruct them by re-running the gauge over
 * `applications`: a replay is a second copy of the truth and cannot see the
 * gauge's internal chain, so it describes a model the parse never had. ⚠️ It is
 * NOT that the list is mis-ordered — that defect was fixed 2026-08-17 and the
 * rule outlived its first reason. If the amounts are ever wanted here, they have
 * to come from the sim recording them.
 *
 * What it says instead is the thing the instrument cannot: WHO. In the planner
 * an application is somebody's cast, and that attribution is the whole reason a
 * rotation's aura log is worth reading.
 */
import type { EventLogRow } from '$lib/components/EventLog.svelte';
import type { AuraLane } from './auraPlot';
import { elementPalette, shiftHue } from '$lib/utils/elementColors';

const FPS = 60;

/** Trailing zeros dropped — "1", "1.5", "0.8". The pip carries no unit letter;
 *  the panel and the chart's own axis both say what U is. */
const fmtUnits = (u: number) => `${Number(u.toFixed(2))}`;

/**
 * ⚠ NOT `AURA_MOD_META`. That map is keyed by `AuraKey` — the things that can BE
 * an aura — and an application's element is an `Element`, which includes the two
 * that never attach. Anemo and Geo land constantly and must be logged; looking
 * them up in the mod map is a type error, and casting past it would have printed
 * `undefined` for exactly the elements the reader most needs named.
 * ⚠ Capitalised rather than table-driven on purpose: every element's display
 * name IS its id capitalised, and a seven-entry table restating that is a table
 * that can fall out of step with the ids.
 */
const elementLabel = (element: string) => element[0].toUpperCase() + element.slice(1);

/**
 * The pip's fill and its halo — ⚓ THE SAME PAIR THE CHART'S BARS USE.
 *
 * `bar` is the palette rung derived for "a fill with white written on it", and
 * the halo is its dark shade at the identical `shiftHue(_, 0, −30)` the timeline
 * computes per character block. ⛔ Not `main` with dark ink: that is the
 * bright-chip idiom this chart retired in 2026-08-11 (⚓ Nate, again on
 * 2026-08-17 for the pips).
 */
function pipPaint(element: string) {
	const pal = elementPalette(element);
	return { color: pal.bar, halo: shiftHue(pal.bar, 0, -30, 1) };
}

/**
 * Merge the lane's three streams into one time-ordered transcript.
 *
 * ⚠️ A REACTION HANGS UNDER ITS APPLICATION when they share a frame, and stands
 * alone when they do not. Both cases are real and the distinction carries
 * information: a Vaporize is a consequence of the hit above it, while an
 * Electro-Charged TICK five seconds into a run was caused by nothing on that
 * frame. ⛔ Never give a sub row its own time — see EventLog's note on the
 * column.
 */
export function buildAuraLog(
	lane: AuraLane,
	nameOf: (characterId: string) => string
): EventLogRow[] {
	type Entry = { time: number; order: number; row: EventLogRow };
	const entries: Entry[] = [];

	// The markers a tick will adopt: keyed by the frame the run STARTS on.
	const markersByFrame = new Map<number, typeof lane.markers>();
	for (const marker of lane.markers) {
		const list = markersByFrame.get(marker.time) ?? [];
		list.push(marker);
		markersByFrame.set(marker.time, list);
	}
	const adopted = new Set<(typeof lane.markers)[number]>();

	// ── Applications, each with any reaction that landed on its frame ────────
	for (const tick of lane.ticks) {
		const seconds = tick.time / FPS;
		const element = elementLabel(tick.element);
		entries.push({
			time: tick.time,
			// ⚠ ORDER, not just time: several things share a frame constantly, and a
			// bare time sort would interleave a decay notice between an application
			// and the reaction it caused. 0 = the application, 1 = its consequences,
			// 2 = bookkeeping.
			order: 0,
			row: {
				time: seconds,
				pip: {
					text: fmtUnits(tick.units),
					...pipPaint(tick.element),
					provisional: tick.provisional
				},
				text: `${nameOf(tick.characterId)} · ${element}`,
				tone: 'lead'
			}
		});
		for (const marker of markersByFrame.get(tick.time) ?? []) {
			if (adopted.has(marker)) continue;
			adopted.add(marker);
			entries.push({
				time: tick.time,
				order: 1,
				// ⚠ No `time` — it hangs under the application above it — but it DOES
				// carry `endTime`, which is highlighting-only. A run has width, so
				// "is the chart's cursor on this row" has to be a containment test.
				row: { endTime: marker.endTime / FPS, text: marker.label, tone: 'sub' }
			});
		}
	}

	// ── Reactions with no application on their frame (a run's later life) ────
	for (const marker of lane.markers) {
		if (adopted.has(marker)) continue;
		entries.push({
			time: marker.time,
			order: 1,
			row: {
				time: marker.time / FPS,
				endTime: marker.endTime / FPS,
				text: marker.label,
				tone: 'sub'
			}
		});
	}

	// ── Where each aura ran out ──────────────────────────────────────────────
	// ⚓ ENDS ONLY. A span's START coincides with the application that made it,
	// which already has a row — but "when did I lose it" is not on any other
	// surface in words, and it is half of what the lane exists to show.
	for (const series of lane.series) {
		for (const span of series.spans) {
			entries.push({
				time: span.end,
				order: 2,
				row: { time: span.end / FPS, text: `${series.label} gone`, tone: 'quiet' }
			});
		}
	}

	entries.sort((a, b) => a.time - b.time || a.order - b.order);
	return entries.map((e) => e.row);
}
