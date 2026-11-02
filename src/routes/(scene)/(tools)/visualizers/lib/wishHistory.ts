// Reading the Capturing Radiance counter (and the pity and guarantee) off a
// character banner wish history: a Paimon.moe export, or a sequence the
// player enters by hand. Model: docs/library/game/capturing-radiance.md §5.

import { nextCounter, RADIANCE_RESET, type RadianceCounter } from './wish';
import { readXlsx, XlsxError } from './xlsx';

/** Version 5.0, when every account's counter was set to 1. Server dates, as wish histories record them. */
export const RADIANCE_SINCE = '2024-08-28';

/**
 * The standard banner's 5★ characters and the day each joined its pool
 * (Fandom `Wanderlust_Invocation` and each character's page). On the
 * character banner, one of these pulled after that day is a lost 50/50.
 * ⚠️ A standard character given a limited banner of their own would break
 * that rule; none has been since 5.0.
 */
export const STANDARD_FIVE_STARS: Readonly<Record<string, string>> = {
	Diluc: '2020-09-28',
	Jean: '2020-09-28',
	Keqing: '2020-09-28',
	Mona: '2020-09-28',
	Qiqi: '2020-09-28',
	Tighnari: '2022-09-28', // 3.1
	Dehya: '2023-04-12', // 3.6
	'Yumemizuki Mizuki': '2025-03-26' // 5.5
};

/** Was this character banner 5★ a lost 50/50? */
export function isLoss(name: string, time: string): boolean {
	const since = STANDARD_FIVE_STARS[name];
	return since !== undefined && time.slice(0, 10) >= since;
}

/**
 * What a 5★ was, read from the counter before it. `won` at counter 2 may have
 * been a Radiance; both leave the counter at 1, so the history can't tell
 * and doesn't need to.
 */
export type StepKind = 'lost' | 'guarantee' | 'won' | 'radiance';
export type ReplayStep = { kind: StepKind; counter: RadianceCounter; name?: string; time?: string };
export type Replay = { counter: RadianceCounter; guaranteed: boolean; steps: ReplayStep[] };

export const REPLAY_START: Readonly<{ counter: RadianceCounter; guaranteed: boolean }> = {
	counter: RADIANCE_RESET,
	guaranteed: false
};

/**
 * Replay 5★s in order (`featured`: was it the banner's featured character?)
 * through the counter model. Starts at 1 with no guarantee: the state at 5.0,
 * and the state right after a Radiance.
 */
export function replay(
	featured: readonly boolean[],
	start: { counter: RadianceCounter; guaranteed: boolean } = REPLAY_START,
	labels: readonly { name: string; time: string }[] = []
): Replay {
	let { counter, guaranteed } = start;
	const steps: ReplayStep[] = [];
	featured.forEach((isFeatured, i) => {
		let kind: StepKind;
		if (guaranteed) {
			// a guarantee leaves the counter alone (and a lost guarantee can't happen)
			kind = 'guarantee';
			guaranteed = false;
		} else if (!isFeatured) {
			kind = 'lost';
			counter = nextCounter(counter, 'lost');
			guaranteed = true;
		} else if (counter === 3) {
			kind = 'radiance';
			counter = nextCounter(counter, 'radiance');
		} else {
			kind = 'won';
			counter = nextCounter(counter, 'won');
		}
		steps.push({ kind, counter, ...labels[i] });
	});
	return { counter, guaranteed, steps };
}

export type FiveStarPull = { name: string; time: string };

/**
 * A whole character banner history, oldest first. 5★s before 5.0 only set
 * the guarantee (a pre-5.0 loss makes the first 5.0 5★ a guarantee, which
 * leaves the counter at 1); everything from 5.0 on is replayed.
 */
export function replayHistory(fives: readonly FiveStarPull[]): Replay {
	let guaranteed = false;
	const after: FiveStarPull[] = [];
	for (const f of fives) {
		if (f.time.slice(0, 10) >= RADIANCE_SINCE) after.push(f);
		else guaranteed = !guaranteed && isLoss(f.name, f.time);
	}
	return replay(
		after.map((f) => !isLoss(f.name, f.time)),
		{ counter: RADIANCE_RESET, guaranteed },
		after
	);
}

// ── Paimon.moe ──────────────────────────────────────────────────────────────

export type ImportResult = {
	replay: Replay;
	/** Pulls since the last 5★ on the character banners */
	pity: number;
	/** Character banner wishes read, and the first and last of them */
	wishes: number;
	first: string;
	last: string;
};

export type ImportError = 'not-a-workbook' | 'not-paimon' | 'no-wishes';

const PAIMON_TITLE = 'Paimon.moe Wish History Export';
const PAIMON_SHEET = 'Character Event';

/** Excel's day number (from 1899-12-30) as 'YYYY-MM-DD HH:mm:ss'. */
function fromSerial(serial: number): string {
	const ms = Math.round((serial - 25569) * 86400) * 1000;
	return new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * The character banner sheet of a Paimon.moe "Wish History Export" (format
 * version 3: Type, Name, Time, ⭐, Pity, #Roll, Group, Banner, Part), oldest
 * first. Wish and Wish-2 share one sheet, as they share pity, the guarantee
 * and the counter.
 */
export function fromPaimonSheets(sheets: Map<string, string[][]>): ImportResult | ImportError {
	const info = sheets.get('Information');
	const sheet = sheets.get(PAIMON_SHEET);
	if (!sheet || !info?.some((r) => r[0] === PAIMON_TITLE)) return 'not-paimon';
	const [head, ...rows] = sheet;
	const col = (h: string) => head?.indexOf(h) ?? -1;
	const nameAt = col('Name');
	const timeAt = col('Time');
	const starAt = col('⭐');
	if (nameAt < 0 || timeAt < 0 || starAt < 0) return 'not-paimon';

	const pulls = rows
		.filter((r) => r[nameAt])
		.map((r) => {
			const raw = r[timeAt] ?? '';
			const time = /^\d+(\.\d+)?$/.test(raw) ? fromSerial(Number(raw)) : raw;
			return { name: r[nameAt], time, star: Number(r[starAt]) };
		});
	if (pulls.length === 0) return 'no-wishes';

	const fives = pulls.filter((p) => p.star === 5);
	const lastFive = pulls.findLastIndex((p) => p.star === 5);
	return {
		replay: replayHistory(fives),
		pity: pulls.length - 1 - lastFive,
		wishes: pulls.length,
		first: pulls[0].time,
		last: pulls[pulls.length - 1].time
	};
}

/** Read an exported file. Nothing leaves the device. */
export async function readPaimonExport(buffer: ArrayBuffer): Promise<ImportResult | ImportError> {
	try {
		return fromPaimonSheets((await readXlsx(buffer)).sheets);
	} catch (e) {
		if (e instanceof XlsxError) return 'not-a-workbook';
		throw e;
	}
}
