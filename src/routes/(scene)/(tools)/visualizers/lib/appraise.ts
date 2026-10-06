// Displayed-value → roll-count inference for 5★ substats, piece resolution
// (3-vs-4-line start, at any level), and what a displayed value says about a
// line's exact sum and its INITIAL roll (the one a reshape keeps).
//
// The game accumulates substat values in float32 and rounds for display
// (% stats to 1 decimal, flats to integers). We enumerate every ORDERED roll
// sequence up to 6 rolls with Math.fround accumulation — the same
// "accurateValue" chain the Genshin Optimizer generator uses — so displayed
// values map to exactly the roll counts the game can produce (float summation
// order matters at float32 precision in rare cases; ordered enumeration
// covers them all). Cross-validated against GO's artifact_sub_rolls.json.

import {
	addPairRolls,
	floorDist,
	jointOf,
	mixJoints,
	nextLineChance,
	rollsLeftAt,
	substatById,
	SUBSTATS,
	toValues,
	uniformLine,
	unitTiers,
	type LineSums,
	type MainStatId,
	type Substat,
	type SubstatId,
	type ValueDist,
	type ValueUnit
} from './artifactOdds';

/** Max total rolls per substat line on a 5★: 1 initial + 5 upgrades */
export const MAX_LINE_ROLLS = 6;

/** Roll-value % contributed by each tier (70/80/90/100% of max) */
const RV_PER_TIER = [70, 80, 90, 100];

export type CountInference = {
	/** Total rolls in this line, including the initial one (1…6) */
	count: number;
	/** Roll-value bounds (% of max-roll × count is not applied — RV sums) */
	rvMin: number;
	rvMax: number;
};

// display string in game units — the SAME formatting is applied to user input
export function displayValue(stat: Substat, accurateValue: number): string {
	return stat.isPct
		? (Math.round(Math.fround(accurateValue * 10)) / 10).toFixed(1)
		: Math.round(accurateValue).toFixed(0);
}

/** Format a user-typed game-units value into the lookup key. */
export function inputKey(stat: Substat, value: number): string {
	return stat.isPct ? (Math.round(value * 10) / 10).toFixed(1) : Math.round(value).toFixed(0);
}

/** One ordered roll sequence a displayed value can come from. */
type Sequence = { first: number; units: number; rv: number };

type StatTable = Map<string, Map<number, { rvMin: number; rvMax: number; seqs: Sequence[] }>>;

const tables = new Map<SubstatId, StatTable>();

function buildTable(stat: Substat): StatTable {
	// Game-unit per-roll values, float32-faithful: datamine decimals are
	// float32; % stats are scaled ×100 with fround at each step (GO's
	// accurateValue chain)
	const rollValues = stat.tiers.map((t) =>
		stat.isPct ? Math.fround(Math.fround(t) * 100) : Math.fround(t)
	);

	const table: StatTable = new Map();

	// Integer units for the exact sum: centi-percent for % stats (CR 2.72% =
	// 272, the unit artifactOdds' CV engine counts in), hundredths for flats
	const unitValues = stat.tiers.map((t) => Math.round(t * (stat.isPct ? 10000 : 100)));

	function record(key: string, count: number, seq: Sequence) {
		let byCount = table.get(key);
		if (!byCount) {
			byCount = new Map();
			table.set(key, byCount);
		}
		const entry = byCount.get(count);
		if (!entry) byCount.set(count, { rvMin: seq.rv, rvMax: seq.rv, seqs: [seq] });
		else {
			entry.rvMin = Math.min(entry.rvMin, seq.rv);
			entry.rvMax = Math.max(entry.rvMax, seq.rv);
			entry.seqs.push(seq);
		}
	}

	// DFS over ordered sequences (4^1 + … + 4^6 = 5460 nodes)
	function walk(value: number, count: number, first: number, units: number, rv: number) {
		if (count >= MAX_LINE_ROLLS) return;
		for (let tier = 0; tier < 4; tier++) {
			const next = Math.fround(value + rollValues[tier]);
			const seq = {
				first: count === 0 ? tier : first,
				units: units + unitValues[tier],
				rv: rv + RV_PER_TIER[tier]
			};
			record(displayValue(stat, next), count + 1, seq);
			walk(next, count + 1, seq.first, seq.units, seq.rv);
		}
	}
	walk(0, 0, 0, 0, 0);

	return table;
}

function statTable(id: SubstatId): StatTable {
	let table = tables.get(id);
	if (!table) {
		table = buildTable(substatById(id));
		tables.set(id, table);
	}
	return table;
}

/**
 * Every displayed value the game can produce for a substat (game units,
 * ascending). Drives the value-wheel picker — only legal values are offered.
 */
export function possibleValues(id: SubstatId): number[] {
	return [...statTable(id).keys()].map(Number).sort((a, b) => a - b);
}

/**
 * All roll counts consistent with a displayed value (game units), with
 * roll-value bounds per count. Empty array = impossible value (typo guard).
 */
export function inferRollCounts(id: SubstatId, value: number): CountInference[] {
	const stat = substatById(id);
	const byCount = statTable(id).get(inputKey(stat, value));
	if (!byCount) return [];
	return [...byCount.entries()]
		.map(([count, { rvMin, rvMax }]) => ({ count, rvMin, rvMax }))
		.sort((a, b) => a.count - b.count);
}

// ── What a displayed value says about the line ──────────────────────────────

/**
 * Every ordered roll sequence behind a displayed value at a known roll count
 * is equally likely (each is ¼ per roll), so they weigh equally here.
 * - `sum`: the line's exact total in integer units (centi-% for % stats) and
 *   in roll value — where its future rolls start from.
 * - `initial`: its FIRST roll (tier index 0–3) — the one a reshape keeps.
 */
export function lineDetail(id: SubstatId, value: number, count: number) {
	const stat = substatById(id);
	const seqs = statTable(id).get(inputKey(stat, value))?.get(count)?.seqs ?? [];
	const w = seqs.length ? 1 / seqs.length : 0;
	const units = new Map<number, number>();
	const rv = new Map<number, number>();
	const initial = new Map<number, number>();
	for (const s of seqs) {
		units.set(s.units, (units.get(s.units) ?? 0) + w);
		rv.set(s.rv, (rv.get(s.rv) ?? 0) + w);
		initial.set(s.first, (initial.get(s.first) ?? 0) + w);
	}
	return { units, rv, initial };
}

// ── Piece resolution ────────────────────────────────────────────────────────

export type PieceResolution = {
	/** Per line: total rolls (incl. initial) chosen for this resolution */
	counts: number[];
	/** Value rolls the piece gets from +0 to +20: 5 (4-line start) or 4 (3-line start) */
	events: number;
	fourLineStart: boolean;
};

/**
 * Resolve a piece at `level`: choose one roll count per line so the total is
 * what the level allows. With 4 lines after u = ⌊level/4⌋ upgrades that is
 * 4 + u (a 4-line start) or 3 + u (a 3-line start, whose first upgrade added
 * a line); at +0 a piece shows its 3 or 4 starting lines, one roll each.
 * Usually unique; ambiguous pieces return every consistent resolution.
 */
export function resolvePiece(inferences: CountInference[][], level = 20): PieceResolution[] {
	const lines = inferences.length;
	if ((lines !== 3 && lines !== 4) || inferences.some((line) => line.length === 0)) return [];
	const u = Math.floor(Math.min(20, Math.max(0, level)) / 4);

	// total rolls → a 4-line start?
	const allowed = new Map<number, boolean>();
	if (lines === 3) {
		if (u === 0) allowed.set(3, false);
	} else {
		allowed.set(4 + u, true);
		if (u > 0) allowed.set(3 + u, false);
	}

	const resolutions: PieceResolution[] = [];
	const max = Math.max(0, ...allowed.keys());

	function walk(line: number, counts: number[], total: number) {
		if (line === lines) {
			const four = allowed.get(total);
			if (four !== undefined)
				resolutions.push({ counts: [...counts], events: four ? 5 : 4, fourLineStart: four });
			return;
		}
		for (const inf of inferences[line]) {
			if (total + inf.count > max) continue;
			counts.push(inf.count);
			walk(line + 1, counts, total + inf.count);
			counts.pop();
		}
	}
	walk(0, [], 0);

	return resolutions;
}

// ── A piece's pair: now, at +20, and after a reshape ────────────────────────

export type PieceLine = { id: SubstatId; value: number };

export type PieceQuery = {
	unit: ValueUnit;
	/** The target pair, in the unit's order (for `cv`: CR first) */
	pair: [SubstatId, SubstatId];
	main: MainStatId;
	level: number;
	lines: PieceLine[];
	/** Per line, the resolution's roll count */
	counts: number[];
};

/** A pair line's sums on this piece (or null when the piece doesn't have it). */
function pairLine(q: PieceQuery, i: 0 | 1, pick: 'sum' | 'initial'): LineSums {
	const at = q.lines.findIndex((l) => l.id === q.pair[i]);
	if (at < 0) return null;
	const detail = lineDetail(q.lines[at].id, q.lines[at].value, q.counts[at]);
	if (pick === 'sum') return q.unit === 'cv' ? detail.units : detail.rv;
	// the initial roll's tier → its value in the unit
	const tiers = unitTiers(q.unit, q.pair[i]);
	return new Map([...detail.initial].map(([tier, p]) => [tiers[tier], p]));
}

const has = (q: PieceQuery, i: 0 | 1) => q.lines.some((l) => l.id === q.pair[i]);

/** The pair's value on the piece as it is now (exact for CV, read for RV). */
export function pieceNow(q: PieceQuery): ValueDist {
	return toValues(q.unit, jointOf(pairLine(q, 0, 'sum'), pairLine(q, 1, 'sum')));
}

/** Rolls the pair lines already received beyond their first. */
const rollsInPair = (q: PieceQuery) =>
	q.lines.reduce((acc, l, i) => acc + (q.pair.includes(l.id) ? q.counts[i] - 1 : 0), 0);

/**
 * What the pair can be at +20, from where the piece is. A defined piece's
 * floor counts the rolls the pair already has (the top-up reading: the
 * guarantee only acts on what is left). A 3-line piece at +0 first draws its
 * 4th line — weighted, from the pool minus the main stat and its three — and
 * that line may be one of the pair.
 */
export function pieceFuture(q: PieceQuery, floor = 0): ValueDist {
	const tiers = q.pair.map((id) => unitTiers(q.unit, id)) as [number[], number[]];
	const fromLines = (
		ids: SubstatId[],
		start: ReturnType<typeof jointOf>,
		already: number,
		left: number
	) => {
		const onA = ids.includes(q.pair[0]);
		const onB = ids.includes(q.pair[1]);
		const lines = Number(onA) + Number(onB);
		const counts = floorDist(left, lines / 4, lines === 2 ? floor : 0, already);
		return addPairRolls(start, counts, onA ? tiers[0] : null, onB ? tiers[1] : null);
	};

	const start = jointOf(pairLine(q, 0, 'sum'), pairLine(q, 1, 'sum'));
	const ids = q.lines.map((l) => l.id);
	if (q.lines.length === 4)
		return toValues(q.unit, fromLines(ids, start, rollsInPair(q), rollsLeftAt(q.level)));

	// 3 lines at +0: the next upgrade adds a line, then 4 value rolls
	const parts = SUBSTATS.map((x) => x.id)
		.filter((id) => id !== q.main && !ids.includes(id))
		.map((id) => {
			const w = nextLineChance(q.main, ids, id);
			const slot = q.pair.indexOf(id);
			const seeded =
				slot < 0
					? start
					: jointOf(
							slot === 0 ? uniformLine(tiers[0]) : pairLine(q, 0, 'sum'),
							slot === 1 ? uniformLine(tiers[1]) : pairLine(q, 1, 'sum')
						);
			return { w, joint: fromLines([...ids, id], seeded, 0, rollsLeftAt(4)) };
		});
	return toValues(q.unit, mixJoints(parts));
}

/**
 * The pair after a reshape of this +20 piece at `floor` (2 Standard, 3
 * Advanced, 4 Decreed): every line keeps its INITIAL roll, and all the
 * piece's value rolls are dealt again, topped up to the floor. Needs both
 * pair lines on the piece — a reshape selects two of its own lines.
 */
export function pieceReshape(q: PieceQuery, events: number, floor: number): ValueDist {
	if (!has(q, 0) || !has(q, 1)) return [];
	const [ta, tb] = q.pair.map((id) => unitTiers(q.unit, id));
	const start = jointOf(pairLine(q, 0, 'initial'), pairLine(q, 1, 'initial'));
	return toValues(q.unit, addPairRolls(start, floorDist(events, 0.5, floor), ta, tb));
}
