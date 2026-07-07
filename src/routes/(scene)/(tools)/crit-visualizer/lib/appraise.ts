// Displayed-value → roll-count inference for 5★ substats, plus piece
// resolution (3-vs-4-line start) and value-luck distributions.
//
// The game accumulates substat values in float32 and rounds for display
// (% stats to 1 decimal, flats to integers). We enumerate every ORDERED roll
// sequence up to 6 rolls with Math.fround accumulation — the same
// "accurateValue" chain the Genshin Optimizer generator uses — so displayed
// values map to exactly the roll counts the game can produce (float summation
// order matters at float32 precision in rare cases; ordered enumeration
// covers them all). Cross-validated against GO's artifact_sub_rolls.json.

import { SUBSTATS, substatById, type Substat, type SubstatId } from './artifactRolls';

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

type StatTable = Map<string, Map<number, { rvMin: number; rvMax: number }>>;

const tables = new Map<SubstatId, StatTable>();

function buildTable(stat: Substat): StatTable {
	// Game-unit per-roll values, float32-faithful: datamine decimals are
	// float32; % stats are scaled ×100 with fround at each step (GO's
	// accurateValue chain)
	const rollValues = stat.tiers.map((t) =>
		stat.isPct ? Math.fround(Math.fround(t) * 100) : Math.fround(t)
	);

	const table: StatTable = new Map();

	function record(key: string, count: number, rv: number) {
		let byCount = table.get(key);
		if (!byCount) {
			byCount = new Map();
			table.set(key, byCount);
		}
		const entry = byCount.get(count);
		if (!entry) byCount.set(count, { rvMin: rv, rvMax: rv });
		else {
			entry.rvMin = Math.min(entry.rvMin, rv);
			entry.rvMax = Math.max(entry.rvMax, rv);
		}
	}

	// DFS over ordered sequences (4^1 + … + 4^6 = 5460 nodes)
	function walk(value: number, count: number, rv: number) {
		if (count >= MAX_LINE_ROLLS) return;
		for (let tier = 0; tier < 4; tier++) {
			const next = Math.fround(value + rollValues[tier]);
			const nextRv = rv + RV_PER_TIER[tier];
			record(displayValue(stat, next), count + 1, nextRv);
			walk(next, count + 1, nextRv);
		}
	}
	walk(0, 0, 0);

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
 * All roll counts consistent with a displayed value (game units), with
 * roll-value bounds per count. Empty array = impossible value (typo guard).
 */
export function inferRollCounts(id: SubstatId, value: number): CountInference[] {
	const stat = substatById(id);
	const byCount = statTable(id).get(inputKey(stat, value));
	if (!byCount) return [];
	return [...byCount.entries()]
		.map(([count, rv]) => ({ count, ...rv }))
		.sort((a, b) => a.count - b.count);
}

// ── Piece resolution ────────────────────────────────────────────────────────

export type LineEntry = { id: SubstatId; value: number };

export type PieceResolution = {
	/** Per line: total rolls (incl. initial) chosen for this resolution */
	counts: number[];
	/** Upgrade events: 5 (4-line start) or 4 (3-line start) */
	events: number;
	fourLineStart: boolean;
};

/**
 * Resolve a full +20 piece: choose one roll count per line such that total
 * rolls = 8 (3-line start) or 9 (4-line start). Usually unique; ambiguous
 * pieces return every consistent resolution.
 */
export function resolvePiece(inferences: CountInference[][]): PieceResolution[] {
	if (inferences.length !== 4 || inferences.some((line) => line.length === 0)) return [];

	const resolutions: PieceResolution[] = [];

	function walk(line: number, counts: number[], total: number) {
		if (line === 4) {
			if (total === 8 || total === 9) {
				resolutions.push({
					counts: [...counts],
					events: total - 4,
					fourLineStart: total === 9
				});
			}
			return;
		}
		for (const inf of inferences[line]) {
			if (total + inf.count > 9) continue;
			counts.push(inf.count);
			walk(line + 1, counts, total + inf.count);
			counts.pop();
		}
	}
	walk(0, [], 0);

	return resolutions;
}

// ── Roll-value distribution (stat-agnostic value luck) ─────────────────────
// Every substat roll is worth 70/80/90/100 RV regardless of stat, so the
// value-luck distribution for any target set is one convolution: `lines`
// initial rolls (one per line present) plus Binomial(events, lines/4)
// upgrade rolls, each a uniform tier.

export function rvDistribution(events: number, lines: 1 | 2): { rv: number; p: number }[] {
	let dist = new Map<number, number>([[0, 1]]);

	const convolveTier = (source: Map<number, number>, weightEach: number) => {
		const next = new Map<number, number>();
		for (const [v, p] of source) {
			for (const rv of RV_PER_TIER) {
				next.set(v + rv, (next.get(v + rv) ?? 0) + p * weightEach);
			}
		}
		return next;
	};

	// Initial roll for each line present
	for (let i = 0; i < lines; i++) dist = convolveTier(dist, 0.25);

	// Upgrade events: lines/4 chance to hit the set (uniform tier), else miss
	const hit = lines / 4;
	for (let i = 0; i < events; i++) {
		const next = new Map<number, number>();
		for (const [v, p] of dist) {
			next.set(v, (next.get(v) ?? 0) + p * (1 - hit));
			for (const rv of RV_PER_TIER) {
				next.set(v + rv, (next.get(v + rv) ?? 0) + p * (hit / 4));
			}
		}
		dist = next;
	}

	return [...dist.entries()].map(([rv, p]) => ({ rv, p })).sort((a, b) => a.rv - b.rv);
}

/** P(X ≤ value) over a sorted discrete distribution keyed by `key`. */
export function percentileOf<K extends string>(
	dist: Array<Record<K, number> & { p: number }>,
	key: K,
	value: number
): number {
	let acc = 0;
	for (const d of dist) {
		if (d[key] <= value + 1e-9) acc += d.p;
		else break;
	}
	return acc;
}
