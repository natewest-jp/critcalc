import { describe, expect, it } from 'vitest';
import { fromPaimonSheets, isLoss, readPaimonExport, replay, replayHistory } from './wishHistory';

// Model: docs/library/game/capturing-radiance.md. Histories here are made up;
// the shapes are the ones the threads and the development history show.

const H = '2025-01-01 12:00:00';

describe('isLoss — a standard-pool 5★ on the character banner', () => {
	it('is a loss once that character is in the standard pool', () => {
		expect(isLoss('Diluc', H)).toBe(true);
		expect(isLoss('Mavuika', H)).toBe(false);
		// Mizuki joined the pool in 5.5: on her own banner in 5.4 she was the featured 5★
		expect(isLoss('Yumemizuki Mizuki', '2025-02-20 10:00:00')).toBe(false);
		expect(isLoss('Yumemizuki Mizuki', '2025-08-23 17:34:44')).toBe(true);
	});
});

describe('replay — the counter model', () => {
	it('starts at 1; two losses in a row reach 3, and the next 50/50 is a Radiance back to 1', () => {
		// lost, guarantee, lost, guarantee, Radiance
		const r = replay([false, true, false, true, true]);
		expect(r.steps.map((s) => `${s.kind}${s.counter}`)).toEqual([
			'lost2',
			'guarantee2',
			'lost3',
			'guarantee3',
			'radiance1'
		]);
		expect(r).toMatchObject({ counter: 1, guaranteed: false });
	});

	it('a plain win steps down, to 0 at the least; from 0 it takes three losses', () => {
		const r = replay([true, true, false, true, false, true, false, true, true]);
		expect(r.steps.map((s) => s.counter)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 1]);
		expect(r.steps.at(-1)!.kind).toBe('radiance');
	});

	it('ends holding a guarantee after a loss', () => {
		expect(replay([false])).toMatchObject({ counter: 2, guaranteed: true });
	});

	it('takes a start, for a sequence counted from a remembered Radiance', () => {
		expect(replay([], { counter: 1, guaranteed: false })).toMatchObject({ counter: 1 });
		expect(replay([true], { counter: 3, guaranteed: true }).steps[0].kind).toBe('guarantee');
	});
});

describe('replayHistory', () => {
	it('counts from 5.0; a loss before it only carries its guarantee across', () => {
		const r = replayHistory([
			{ name: 'Jean', time: '2024-08-20 10:00:00' }, // 4.8: lost
			{ name: 'Mualani', time: '2024-08-29 10:00:00' }, // 5.0: the guarantee
			{ name: 'Qiqi', time: '2024-09-10 10:00:00' }, // lost: 1 → 2
			{ name: 'Mualani', time: '2024-09-12 10:00:00' }
		]);
		expect(r.steps.map((s) => `${s.name}:${s.kind}${s.counter}`)).toEqual([
			'Mualani:guarantee1',
			'Qiqi:lost2',
			'Mualani:guarantee2'
		]);
		expect(r).toMatchObject({ counter: 2, guaranteed: false });
	});

	it('a pre-5.0 guarantee already spent before 5.0 carries nothing', () => {
		const r = replayHistory([
			{ name: 'Diluc', time: '2024-07-01 10:00:00' },
			{ name: 'Arlecchino', time: '2024-07-05 10:00:00' },
			{ name: 'Kinich', time: '2024-09-20 10:00:00' }
		]);
		expect(r.steps.map((s) => s.kind)).toEqual(['won']);
		expect(r.counter).toBe(0);
	});
});

const HEAD = ['Type', 'Name', 'Time', '⭐', 'Pity', '#Roll', 'Group', 'Banner', 'Part'];
const row = (name: string, time: string, star: number) => [
	'Character',
	name,
	time,
	String(star),
	'1',
	'1',
	'1',
	'Some banner',
	''
];
const paimon = (rows: string[][]) =>
	new Map([
		['Character Event', [HEAD, ...rows]],
		[
			'Information',
			[
				['Paimon.moe Wish History Export', ''],
				['Version', '3']
			]
		]
	]);

describe('fromPaimonSheets', () => {
	it('reads the counter, the guarantee and the pity since the last 5★', () => {
		const r = fromPaimonSheets(
			paimon([
				row('Xingqiu', '2025-07-30 15:51:59', 4),
				row('Jean', '2025-07-30 16:13:37', 5),
				row('Fischl', '2025-07-31 10:00:00', 4),
				row('Ineffa', '2025-08-02 17:27:05', 5),
				row('Sethos', '2025-08-03 10:00:00', 4),
				row('Sethos', '2025-08-03 10:00:00', 4)
			])
		);
		if (typeof r === 'string') throw new Error(r);
		expect(r.replay).toMatchObject({ counter: 2, guaranteed: false });
		expect(r.pity).toBe(2);
		expect(r).toMatchObject({
			wishes: 6,
			first: '2025-07-30 15:51:59',
			last: '2025-08-03 10:00:00'
		});
	});

	it('a history with no 5★ yet: pity is every wish, the counter is the 5.0 start', () => {
		const r = fromPaimonSheets(paimon([row('Bennett', H, 4), row('Noelle', H, 4)]));
		if (typeof r === 'string') throw new Error(r);
		expect(r.pity).toBe(2);
		expect(r.replay).toMatchObject({ counter: 1, guaranteed: false, steps: [] });
	});

	it('reads a time stored as a spreadsheet day number', () => {
		const r = fromPaimonSheets(paimon([row('Jean', '45868.5', 5)]));
		if (typeof r === 'string') throw new Error(r);
		expect(r.first).toBe('2025-07-30 12:00:00');
	});

	it('names what is wrong with a file it can’t use', async () => {
		expect(fromPaimonSheets(new Map([['Sheet1', [['a']]]]))).toBe('not-paimon');
		expect(fromPaimonSheets(paimon([]))).toBe('no-wishes');
		expect(await readPaimonExport(new TextEncoder().encode('{"json": true}').buffer)).toBe(
			'not-a-workbook'
		);
	});
});
