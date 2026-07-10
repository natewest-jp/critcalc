import { describe, it, expect } from 'vitest';
import { computeSummonSubrows, computeSummonTicks, findCastSummon } from './summonSubrows';
import type { TimelineBar } from '$lib/utils/notationParser';
import type { Ability, Summon } from '$lib/types/ability';
import type { CharacterData } from '$lib/types/character';
import type { SlottedTrack } from './types';

// ---------------------------------------------------------------------------
// Hermetic fixtures
// ---------------------------------------------------------------------------

function mkSummon(over: Partial<Summon> = {}): Summon {
	return { label: 'Oz', ...over } as Summon;
}

function mkChar(id: string, skillSummon?: Summon, burstSummon?: Summon): CharacterData {
	return {
		id,
		name: id,
		displayName: id,
		element: 'electro',
		rarity: 4,
		abilities: [
			{
				id: `${id}__skill`,
				name: `${id} Skill`,
				abilityType: 'skill',
				behavior: skillSummon ? 'persistent' : 'instant',
				input: ['E'],
				frames: { swap: 20 },
				cooldown: 10,
				...(skillSummon ? { duration: 10, summons: [skillSummon] } : {})
			} as Ability,
			{
				id: `${id}__burst`,
				name: `${id} Burst`,
				abilityType: 'burst',
				behavior: burstSummon ? 'persistent' : 'instant',
				input: ['Q'],
				frames: { swap: 20 },
				cooldown: 15,
				energyCost: 60,
				...(burstSummon ? { duration: 10, summons: [burstSummon] } : {})
			} as Ability
		],
		passives: [],
		constellations: []
	} as CharacterData;
}

function mkBar(start: number, over: Partial<TimelineBar> = {}): TimelineBar {
	return { start, uptime: 10, cooldown: 12, label: 'E', castTime: 0.5, ...over };
}

function mkTrack(
	characterId: string,
	slotIdx: number,
	over: Partial<SlottedTrack> = {}
): SlottedTrack {
	return {
		characterId,
		displayName: characterId,
		element: 'electro',
		activeStart: 0,
		activeEnd: 10,
		inputBlocks: [],
		hasUnsetDuration: false,
		eBars: [],
		qBars: [],
		slotIdx,
		...over
	};
}

function run(tracks: SlottedTrack[], chars: CharacterData[], cons: Record<string, number> = {}) {
	return computeSummonSubrows(tracks, cons, (id) => chars.find((c) => c.id === id) ?? null);
}

// ---------------------------------------------------------------------------

describe('computeSummonSubrows — basics', () => {
	it('returns an empty array for an empty rotation', () => {
		expect(run([], [])).toEqual([]);
	});

	it('emits no rows for bars without uptime or characters without summons', () => {
		const noSummon = mkChar('plain');
		expect(run([mkTrack('plain', 0, { eBars: [mkBar(0, { uptime: 0 })] })], [noSummon])).toEqual(
			[]
		);
	});

	it('emits one bar per cast, offset by summonActivatesAt frames', () => {
		const char = mkChar('fischl', mkSummon());
		const tracks = [mkTrack('fischl', 1, { eBars: [mkBar(2, { summonActivatesAt: 30 })] })];
		const rows = run(tracks, [char]);
		expect(rows).toEqual([
			{
				slotIdx: 1,
				characterId: 'fischl',
				label: 'Oz',
				bars: [{ start: 2.5, end: 12.5, source: 'skill', ticks: [] }]
			}
		]);
	});

	it('collapses E and Q casts sharing a summon label onto one sub-row', () => {
		const char = mkChar('fischl', mkSummon(), mkSummon());
		const tracks = [
			mkTrack('fischl', 0, {
				eBars: [mkBar(0)],
				qBars: [mkBar(12, { label: 'Q' })]
			})
		];
		const rows = run(tracks, [char]);
		expect(rows).toHaveLength(1);
		expect(rows[0].bars.map((b) => b.source)).toEqual(['skill', 'burst']);
	});
});

describe('computeSummonSubrows — termination semantics', () => {
	it('terminatesOn:"swap" truncates the bar at the next swap-out', () => {
		const char = mkChar('guoba', mkSummon({ label: 'Guoba', terminatesOn: 'swap' }));
		const other = mkChar('other');
		const tracks = [
			mkTrack('guoba', 0, { activeEnd: 4, eBars: [mkBar(0)] }),
			mkTrack('other', 1, { activeStart: 4, activeEnd: 12 })
		];
		const rows = run(tracks, [char, other]);
		expect(rows[0].bars).toEqual([{ start: 0, end: 4, source: 'skill', ticks: [] }]);
	});

	it("terminatesOn:'swap' on the character's last track runs to natural end", () => {
		const char = mkChar('guoba', mkSummon({ label: 'Guoba', terminatesOn: 'swap' }));
		const rows = run([mkTrack('guoba', 0, { eBars: [mkBar(0)] })], [char]);
		expect(rows[0].bars[0].end).toBe(10);
	});

	it('terminatesOn:"recast" truncates the previous bar and trims its ticks', () => {
		const summon = mkSummon({
			label: 'Oz',
			terminatesOn: 'recast',
			effects: [
				{
					type: 'damage',
					trigger: { type: 'summonTick', interval: 2 },
					target: 'enemy'
				} as unknown as NonNullable<Summon['effects']>[number]
			]
		});
		const char = mkChar('fischl', summon);
		const tracks = [mkTrack('fischl', 0, { eBars: [mkBar(0), mkBar(6)] })];
		const rows = run(tracks, [char]);
		expect(rows[0].bars).toHaveLength(2);
		// First bar truncated from 10 → 6 at the recast; ticks past 6 trimmed.
		expect(rows[0].bars[0].end).toBe(6);
		expect(rows[0].bars[0].ticks).toEqual([2, 4]);
		expect(rows[0].bars[1].start).toBe(6);
		expect(rows[0].bars[1].end).toBe(16);
	});
});

describe('computeSummonTicks', () => {
	it('emits one marker per interval, respecting firstTickDelay', () => {
		const summon = mkSummon({
			effects: [
				{
					type: 'damage',
					trigger: { type: 'summonTick', interval: 3, firstTickDelay: 1 },
					target: 'enemy'
				} as unknown as NonNullable<Summon['effects']>[number]
			]
		});
		expect(computeSummonTicks(summon, 10, 20, 0)).toEqual([11, 14, 17]);
	});

	it('abstains for constellation-gated tick effects below the level', () => {
		const summon = mkSummon({
			effects: [
				{
					type: 'damage',
					trigger: { type: 'summonTick', interval: 2 },
					conditions: { type: 'constellation', level: 2 },
					target: 'enemy'
				} as unknown as NonNullable<Summon['effects']>[number]
			]
		});
		expect(computeSummonTicks(summon, 0, 10, 0)).toEqual([]);
		expect(computeSummonTicks(summon, 0, 10, 2)).toEqual([0 + 2, 4, 6, 8]);
	});
});

describe('findCastSummon', () => {
	const variantSummon = mkSummon({ label: 'Hold Oz' });
	const baseSummon = mkSummon({ label: 'Oz' });
	const char = {
		...mkChar('fischl', baseSummon),
		abilities: [
			{
				id: 'fischl__skill',
				name: 'Fischl Skill',
				abilityType: 'skill',
				behavior: 'persistent',
				input: ['E'],
				frames: { swap: 20 },
				cooldown: 10,
				duration: 10,
				summons: [baseSummon],
				variants: [{ label: 'Hold', input: ['hE'], summons: [variantSummon] }]
			} as unknown as Ability
		]
	} as CharacterData;

	it('resolves the base summon for the base input', () => {
		expect(findCastSummon(char, 'skill', 'E')?.label).toBe('Oz');
	});

	it('resolves the variant summon when the bar label matches variant input', () => {
		expect(findCastSummon(char, 'skill', 'hE')?.label).toBe('Hold Oz');
	});

	it('returns undefined for a null character or missing ability', () => {
		expect(findCastSummon(null, 'skill', 'E')).toBeUndefined();
		expect(findCastSummon(char, 'burst', 'Q')).toBeUndefined();
	});
});
