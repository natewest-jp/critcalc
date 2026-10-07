import { describe, expect, it } from 'vitest';
import { readRotationSwap, unionUptime } from './auditionRotation';

describe('unionUptime', () => {
	it('counts overlapping windows once', () => {
		expect(
			unionUptime(
				[
					{ start: 0, end: 60 },
					{ start: 30, end: 90 }
				],
				120
			)
		).toBe(0.75);
	});
	it('clips windows to the rotation', () => {
		expect(
			unionUptime(
				[
					{ start: -10, end: 30 },
					{ start: 100, end: 200 }
				],
				120
			)
		).toBeCloseTo(50 / 120);
	});
	it('is 0 for an empty rotation', () => {
		expect(unionUptime([{ start: 0, end: 60 }], 0)).toBe(0);
	});
});

describe('readRotationSwap — the planner-backed audition', () => {
	const base = {
		slots: ['bennett', 'xiangling', 'xingqiu', 'sucrose'],
		incumbentId: 'bennett',
		constellations: {},
		loadout: {},
		swapFrames: 8,
		humanTiming: null
	};

	it('reads nothing for a team of bare names', async () => {
		const read = await readRotationSwap({
			...base,
			notation: 'Bennett > Xiangling > Xingqiu > Sucrose',
			candidateId: 'chevreuse'
		});
		expect(read).toBeNull();
	});

	it("parses the real rotation twice and reports the team's coverage before → after", async () => {
		const read = await readRotationSwap({
			...base,
			notation: 'Bennett E Q > Xiangling E Q > Xingqiu E Q > Sucrose E Q > Xiangling N3',
			candidateId: 'chevreuse'
		});
		expect(read).not.toBeNull();
		const atk = read!.rows.find((r) => r.key === 'buff:atk');
		expect(atk, read!.rows.map((r) => r.key).join(',')).toBeDefined();
		expect(atk!.before).toBeGreaterThan(0);
		expect(atk!.before).toBeLessThanOrEqual(1);
	});

	it("counts the candidate's actions the planner has to stand in for", async () => {
		// Bennett has a held E; Xingqiu does not — the swapped hE is approximated.
		const read = await readRotationSwap({
			...base,
			notation: 'Bennett hE Q > Xiangling E Q',
			candidateId: 'xingqiu',
			slots: ['bennett', 'xiangling', null, null]
		});
		expect(read!.approximated).toBeGreaterThanOrEqual(1);
	});
});
