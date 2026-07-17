import { describe, it, expect } from 'vitest';
import { computeCharReceivedBuffRows } from './charReceivedBuffRows';
import type { CharacterTrack, TimelineBar, CastEvent } from '$lib/utils/notationParser';
import type { CharacterData } from '$lib/types/character';
import type { Ability, Effect, Element } from '$lib/types/ability';
import type { LoadoutEntry } from '$lib/stores';

// ---------------------------------------------------------------------------
// Hermetic fixtures — hand-built characters/tracks; weapon paths use the real
// authored weapon JSONs (eager lookup) for TTDS/Widsith swap semantics.
// ---------------------------------------------------------------------------

type BuffEffect = Extract<Effect, { type: 'buff' }>;

function buff(over: Partial<BuffEffect> = {}): Effect {
	return {
		type: 'buff',
		source: 'character',
		trigger: { type: 'onCast' },
		target: 'self',
		stat: 'atk%',
		value: 20,
		duration: 12,
		snapshottable: false,
		...over
	} as Effect;
}

type CharFixture = {
	id: string;
	element?: Element;
	skillEffects?: Effect[];
	burstEffects?: Effect[];
	passiveEffects?: Effect[];
};

function mkChar(fx: CharFixture): CharacterData {
	return {
		id: fx.id,
		name: fx.id,
		displayName: fx.id,
		element: fx.element ?? 'pyro',
		rarity: 5,
		abilities: [
			{
				id: `${fx.id}__skill`,
				name: `${fx.id} Skill`,
				abilityType: 'skill',
				behavior: 'instant',
				input: ['E'],
				frames: { swap: 20 },
				cooldown: 10,
				effects: fx.skillEffects
			} as Ability,
			{
				id: `${fx.id}__burst`,
				name: `${fx.id} Burst`,
				abilityType: 'burst',
				behavior: 'instant',
				input: ['Q'],
				frames: { swap: 20 },
				cooldown: 15,
				energyCost: 60,
				effects: fx.burstEffects
			} as Ability
		],
		passives: fx.passiveEffects
			? [
					{
						id: `${fx.id}__p1`,
						name: `${fx.id} Passive`,
						abilityType: 'passive',
						effects: fx.passiveEffects
					} as Ability
				]
			: [],
		constellations: []
	} as CharacterData;
}

function mkBar(start: number, over: Partial<TimelineBar> = {}): TimelineBar {
	return { start, uptime: 0, cooldown: 10, label: 'E', castTime: 0.5, ...over };
}

// P4 IR: the module consumes `cast` events, not track bars. Fixtures still
// express casts as eBars/qBars (the readable shape); this projects them into
// the cast-event stream the parser now emits — `fieldStart` bakes the summon
// offset in, `stackContext` rides along. Time-sorted like the real IR.
let castSeq = 0;
function castFromBar(characterId: string, ability: 'skill' | 'burst', b: TimelineBar): CastEvent {
	return {
		kind: 'cast',
		id: castSeq++,
		characterId,
		ability,
		abilityId: `${characterId}__${ability}`,
		label: b.label,
		time: b.start,
		castTime: b.castTime,
		uptime: b.uptime,
		cooldown: b.cooldown,
		readyAt: b.start + b.cooldown,
		summonActivatesAt: b.summonActivatesAt ?? 0,
		fieldStart: b.start + (b.summonActivatesAt ?? 0) / 60,
		sacProcFired: b.sacProcFired,
		stackContext: b.stackContext
	};
}

function castsFromTracks(tracks: CharacterTrack[]): CastEvent[] {
	const out: CastEvent[] = [];
	for (const t of tracks) {
		for (const b of t.eBars) out.push(castFromBar(t.characterId, 'skill', b));
		for (const b of t.qBars) out.push(castFromBar(t.characterId, 'burst', b));
	}
	return out.sort((a, b) => a.time - b.time);
}

function mkTrack(characterId: string, over: Partial<CharacterTrack> = {}): CharacterTrack {
	return {
		characterId,
		displayName: characterId,
		element: 'pyro',
		activeStart: 0,
		activeEnd: 10,
		inputBlocks: [],
		hasUnsetDuration: false,
		eBars: [],
		qBars: [],
		...over
	};
}

type RunOpts = {
	constellations?: Record<string, number>;
	loadout?: Record<string, LoadoutEntry>;
	nbBars?: Array<{ start: number; cooldown: number }>;
};

function run(tracks: CharacterTrack[], chars: CharacterData[], opts: RunOpts = {}) {
	return computeCharReceivedBuffRows(
		tracks,
		opts.constellations ?? {},
		opts.loadout ?? {},
		new Map(),
		new Map(),
		opts.nbBars ?? [],
		castsFromTracks(tracks),
		(id) => chars.find((c) => c.id === id) ?? null
	);
}

// ---------------------------------------------------------------------------

describe('computeCharReceivedBuffRows — empty inputs', () => {
	it('returns an empty array for an empty rotation', () => {
		expect(run([], [])).toEqual([]);
	});

	it('returns no rows when no self/active-target effects exist', () => {
		const char = mkChar({ id: 'plain' });
		expect(run([mkTrack('plain', { eBars: [mkBar(0)] })], [char])).toEqual([]);
	});
});

describe('computeCharReceivedBuffRows — self-target ability buffs', () => {
	it('puts a self-target onCast buff on the caster row for the full duration', () => {
		const char = mkChar({ id: 'selfy', skillEffects: [buff({ duration: 8 })] });
		const rows = run([mkTrack('selfy', { eBars: [mkBar(1)] })], [char]);
		expect(rows).toHaveLength(1);
		expect(rows[0].characterId).toBe('selfy');
		expect(rows[0].sourceLabel).toBe('selfy E');
		expect(rows[0].bars).toEqual([
			{
				start: 1,
				end: 9,
				primaryStat: 'atk%',
				effects: [{ stat: 'atk%', displayValue: '+20%' }],
				sourceLabel: 'selfy E',
				isMutuallyExclusive: false,
				duration: 8
			}
		]);
	});

	it('drops a self-target buff conditioned on offField (self-buffs are on-field)', () => {
		const char = mkChar({
			id: 'offy',
			skillEffects: [buff({ conditions: { type: 'state', state: 'offField' } })]
		});
		expect(run([mkTrack('offy', { eBars: [mkBar(0)] })], [char])).toEqual([]);
	});
});

describe('computeCharReceivedBuffRows — active-target segmentation', () => {
	it('slices an active-target buff across on-field windows, extending the last segment', () => {
		// Source casts E at t=0 with a 12s active-target buff; source is on
		// field 0–5, receiver 5–10 (last overlapping segment → extends to 12).
		const source = mkChar({ id: 'source', skillEffects: [buff({ target: 'active' })] });
		const receiver = mkChar({ id: 'receiver' });
		const tracks = [
			mkTrack('source', { activeStart: 0, activeEnd: 5, eBars: [mkBar(0)] }),
			mkTrack('receiver', { activeStart: 5, activeEnd: 10 })
		];
		const rows = run(tracks, [source, receiver]);
		expect(rows).toHaveLength(2);
		const sourceRow = rows.find((r) => r.characterId === 'source')!;
		const receiverRow = rows.find((r) => r.characterId === 'receiver')!;
		expect(sourceRow.bars[0].start).toBe(0);
		expect(sourceRow.bars[0].end).toBe(5);
		expect(receiverRow.bars[0].start).toBe(5);
		// Last segment renders to the buff's natural end, not the track end.
		expect(receiverRow.bars[0].end).toBe(12);
	});
});

describe('computeCharReceivedBuffRows — NB self-target dispatch (nbSelfDispatched guard)', () => {
	const nbChar = mkChar({
		id: 'natlan',
		passiveEffects: [
			buff({ trigger: { type: 'onTeamNightsoulBurst' }, target: 'self', stat: 'atk%', value: 30 })
		]
	});

	it('fires once per NB event', () => {
		const nbBars = [
			{ start: 5, cooldown: 18 },
			{ start: 25, cooldown: 18 }
		];
		const rows = run([mkTrack('natlan')], [nbChar], { nbBars });
		expect(rows).toHaveLength(1);
		expect(rows[0].bars.map((b) => b.start)).toEqual([5, 25]);
	});

	it('a character split across two tracks produces the same bars as one track', () => {
		const nbBars = [{ start: 5, cooldown: 18 }];
		const oneTrack = run([mkTrack('natlan')], [nbChar], { nbBars });
		const twoTracks = run(
			[mkTrack('natlan', { activeEnd: 5 }), mkTrack('natlan', { activeStart: 8, activeEnd: 12 })],
			[nbChar],
			{ nbBars }
		);
		expect(twoTracks).toEqual(oneTrack);
		expect(twoTracks[0].bars).toHaveLength(1);
	});
});

describe('computeCharReceivedBuffRows — weapon swap procs', () => {
	const holder = mkChar({ id: 'holder' });
	const dps = mkChar({ id: 'dps' });

	it('TTDS (onSwapOut) buffs the incoming character at swap time', () => {
		const tracks = [
			mkTrack('holder', { activeStart: 0, activeEnd: 3 }),
			mkTrack('dps', { activeStart: 3, activeEnd: 20 })
		];
		const rows = run(tracks, [holder, dps], {
			loadout: { holder: { weaponId: 'thrilling_tales_of_dragon_slayers', weaponRefinement: 5 } }
		});
		expect(rows).toHaveLength(1);
		expect(rows[0].characterId).toBe('dps');
		expect(rows[0].bars).toEqual([
			{
				start: 3,
				end: 13,
				primaryStat: 'atk%',
				effects: [{ stat: 'atk%', displayValue: '+48%' }], // R5
				sourceLabel: 'TTDS',
				isMutuallyExclusive: false,
				procCooldown: 20,
				duration: 10
			}
		]);
	});

	it('enforces the proc ICD across repeated swaps', () => {
		// Swaps at t=3 and t=8: the 20s ICD from the first proc suppresses the second.
		const tracks = [
			mkTrack('holder', { activeStart: 0, activeEnd: 3 }),
			mkTrack('dps', { activeStart: 3, activeEnd: 6 }),
			mkTrack('holder', { activeStart: 6, activeEnd: 8 }),
			mkTrack('dps', { activeStart: 8, activeEnd: 20 })
		];
		const rows = run(tracks, [holder, dps], {
			loadout: { holder: { weaponId: 'thrilling_tales_of_dragon_slayers', weaponRefinement: 1 } }
		});
		expect(rows).toHaveLength(1);
		expect(rows[0].bars).toHaveLength(1);
		expect(rows[0].bars[0].start).toBe(3);
	});

	it('does not proc on consecutive segments of the same character', () => {
		// Two back-to-back segments of the holder are one continuous field
		// presence — no swap, no proc, no ICD consumed.
		const tracks = [
			mkTrack('holder', { activeStart: 0, activeEnd: 3 }),
			mkTrack('holder', { activeStart: 3, activeEnd: 6 })
		];
		const rows = run(tracks, [holder], {
			loadout: { holder: { weaponId: 'thrilling_tales_of_dragon_slayers', weaponRefinement: 1 } }
		});
		expect(rows).toEqual([]);
	});

	it('Widsith (onSwapIn) merges its ICD-shared themes into one mutually-exclusive bar', () => {
		const tracks = [
			mkTrack('holder', { activeStart: 0, activeEnd: 3 }),
			mkTrack('dps', { activeStart: 3, activeEnd: 20 })
		];
		const rows = run(tracks, [holder, dps], {
			loadout: { dps: { weaponId: 'the_widsith', weaponRefinement: 1 } }
		});
		expect(rows).toHaveLength(1);
		expect(rows[0].characterId).toBe('dps');
		expect(rows[0].bars).toHaveLength(1);
		expect(rows[0].bars[0].isMutuallyExclusive).toBe(true);
		expect(rows[0].bars[0].effects.map((e) => e.stat)).toEqual(['atk%', 'allDmgBonus', 'em']);
	});
});
