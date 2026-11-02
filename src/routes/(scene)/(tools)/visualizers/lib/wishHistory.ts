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

// ── The interview ───────────────────────────────────────────────────────────
// Find mine's questions, newest 5★ first. Instead of asking where the last
// Radiance was, it replays the answers from EVERY state the counter could have
// been in before them and keeps the ones that fit. It is done when all of them
// end on the same counter. Two facts keep it short: a Radiance always leaves
// the counter at 1, and two plain wins in a row always leave it at 0.

/**
 * One 5★, as the player remembers it. `featured` is a featured 5★ whose
 * animation they don't remember; `none` means there was no 5★ before this
 * point since 5.0 (so the replay starts at 5.0's 1).
 */
export type Answer = 'featured' | 'featured-radiance' | 'featured-plain' | 'standard' | 'none';

type State = { counter: RadianceCounter; guaranteed: boolean };

/** Every state the counter can be in (a guarantee comes from a loss, so never on 0). */
const ANY_STATE: readonly State[] = ([0, 1, 2, 3] as RadianceCounter[]).flatMap(
	(counter): State[] =>
		counter === 0
			? [{ counter, guaranteed: false }]
			: [
					{ counter, guaranteed: false },
					{ counter, guaranteed: true }
				]
);

/** One 5★ forward from a state, or null if that 5★ couldn't have happened there. */
function step(state: State, answer: Exclude<Answer, 'none'>): State | null {
	const { counter, guaranteed } = state;
	if (answer === 'standard') {
		// a guarantee can't be lost, and a 50/50 on 3 is a Radiance
		if (guaranteed || counter === 3) return null;
		return { counter: nextCounter(counter, 'lost'), guaranteed: true };
	}
	if (guaranteed) {
		// a guarantee never plays the Radiance animation
		return answer === 'featured-radiance' ? null : { counter, guaranteed: false };
	}
	if (answer === 'featured-radiance') return { counter: RADIANCE_RESET, guaranteed: false };
	if (counter === 3) {
		return answer === 'featured-plain' ? null : { counter: RADIANCE_RESET, guaranteed: false };
	}
	// counter 2: a plain win and a Radiance both leave it at 1
	return { counter: nextCounter(counter, 'won'), guaranteed: false };
}

export type Reading = {
	/** The counters the answers allow now, ascending; one when the interview is done, none if they contradict. */
	counters: RadianceCounter[];
	/** Whether a guarantee is held now; null until the newest 5★ is answered. */
	guaranteed: boolean | null;
};

/** What the answers (newest first) allow the counter and the guarantee to be now. */
export function readAnswers(answers: readonly Answer[]): Reading {
	const none = answers.indexOf('none');
	const told = (none < 0 ? answers : answers.slice(0, none)) as Exclude<Answer, 'none'>[];
	const starts = none < 0 ? ANY_STATE : [REPLAY_START];
	const ends: State[] = [];
	for (const start of starts) {
		let state: State | null = start;
		for (let i = told.length - 1; i >= 0 && state; i--) state = step(state, told[i]);
		if (state) ends.push(state);
	}
	const counters = [...new Set(ends.map((e) => e.counter))].sort((a, b) => a - b);
	const held = [...new Set(ends.map((e) => e.guaranteed))];
	return { counters, guaranteed: held.length === 1 ? held[0] : null };
}

/**
 * Is it worth asking whether this featured 5★ (the next, older one) played the
 * Radiance animation? Only when both answers are possible and lead to
 * different counters.
 */
export function radianceMatters(answers: readonly Answer[]): boolean {
	const yes = readAnswers([...answers, 'featured-radiance']).counters;
	const no = readAnswers([...answers, 'featured-plain']).counters;
	return yes.length > 0 && no.length > 0 && yes.join() !== no.join();
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
	/** Pulls since the last 5★ on the weapon banner; null when the export has none. The fate point isn't recorded. */
	weaponPity: number | null;
	/** Character banner wishes read, and the first and last of them */
	wishes: number;
	first: string;
	last: string;
};

export type ImportError = 'not-a-workbook' | 'not-paimon' | 'no-wishes';

const PAIMON_TITLE = 'Paimon.moe Wish History Export';
const PAIMON_SHEET = 'Character Event';
const PAIMON_WEAPON_SHEET = 'Weapon Event';

/** Excel's day number (from 1899-12-30) as 'YYYY-MM-DD HH:mm:ss'. */
function fromSerial(serial: number): string {
	const ms = Math.round((serial - 25569) * 86400) * 1000;
	return new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
}

type Pull = { name: string; time: string; star: number };

/** A banner sheet's wishes, oldest first; null when its header isn't Paimon.moe's. */
function pullsOf(sheet: string[][] | undefined): Pull[] | null {
	if (!sheet) return null;
	const [head, ...rows] = sheet;
	const col = (h: string) => head?.indexOf(h) ?? -1;
	const nameAt = col('Name');
	const timeAt = col('Time');
	const starAt = col('⭐');
	if (nameAt < 0 || timeAt < 0 || starAt < 0) return null;
	return rows
		.filter((r) => r[nameAt])
		.map((r) => {
			const raw = r[timeAt] ?? '';
			const time = /^\d+(\.\d+)?$/.test(raw) ? fromSerial(Number(raw)) : raw;
			return { name: r[nameAt], time, star: Number(r[starAt]) };
		});
}

/** Wishes since the last 5★ (every wish when there has been none). */
const pityOf = (pulls: Pull[]) => pulls.length - 1 - pulls.findLastIndex((p) => p.star === 5);

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
	const pulls = pullsOf(sheet);
	if (pulls === null) return 'not-paimon';
	if (pulls.length === 0) return 'no-wishes';
	const weapon = pullsOf(sheets.get(PAIMON_WEAPON_SHEET));

	return {
		replay: replayHistory(pulls.filter((p) => p.star === 5)),
		pity: pityOf(pulls),
		weaponPity: weapon && weapon.length > 0 ? pityOf(weapon) : null,
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
