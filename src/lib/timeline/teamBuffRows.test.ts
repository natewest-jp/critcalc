import { describe, it, expect } from 'vitest';
import { computeTeamBuffRows } from './teamBuffRows';
import type {
	CharacterTrack,
	TimelineBar,
	CastEvent,
	ReactionEvent,
	TimelineWindow
} from '$lib/utils/notationParser';
import type { CharacterData } from '$lib/types/character';
import type { Ability, Effect, Element } from '$lib/types/ability';

// ---------------------------------------------------------------------------
// Hermetic fixtures — hand-built minimal characters/tracks, no roster JSONs.
// ---------------------------------------------------------------------------

type BuffEffect = Extract<Effect, { type: 'buff' }>;
type ResShredEffect = Extract<Effect, { type: 'resShred' }>;

function buff(over: Partial<BuffEffect> = {}): Effect {
	return {
		type: 'buff',
		source: 'character',
		trigger: { type: 'onCast' },
		target: 'team',
		stat: 'atk%',
		value: 20,
		duration: 12,
		snapshottable: false,
		...over
	} as Effect;
}

function resShred(over: Partial<ResShredEffect> = {}): Effect {
	return {
		type: 'resShred',
		source: 'character',
		trigger: { type: 'onReaction', reaction: 'overloaded' },
		target: 'enemy',
		value: -40,
		duration: 6,
		...over
	} as Effect;
}

type CharFixture = {
	id: string;
	element?: Element;
	factions?: string[];
	skillEffects?: Effect[];
	burstEffects?: Effect[];
	passiveEffects?: Effect[];
	constellationEffects?: Array<{ level: number; effects: Effect[] }>;
};

function mkChar(fx: CharFixture): CharacterData {
	const skill: Ability = {
		id: `${fx.id}__skill`,
		name: `${fx.id} Skill`,
		abilityType: 'skill',
		behavior: 'instant',
		input: ['E'],
		frames: { swap: 20 },
		cooldown: 10,
		effects: fx.skillEffects
	} as Ability;
	const burst: Ability = {
		id: `${fx.id}__burst`,
		name: `${fx.id} Burst`,
		abilityType: 'burst',
		behavior: 'instant',
		input: ['Q'],
		frames: { swap: 20 },
		cooldown: 15,
		energyCost: 60,
		effects: fx.burstEffects
	} as Ability;
	return {
		id: fx.id,
		name: fx.id,
		displayName: fx.id,
		element: fx.element ?? 'pyro',
		rarity: 5,
		factions: fx.factions,
		abilities: [skill, burst],
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
		constellations: (fx.constellationEffects ?? []).map(
			(c) =>
				({
					id: `${fx.id}__c${c.level}`,
					name: `${fx.id} C${c.level}`,
					abilityType: 'constellation',
					constellationLevel: c.level,
					effects: c.effects
				}) as Ability
		)
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
	loadout?: Parameters<typeof computeTeamBuffRows>[2];
	nbBars?: Array<{ start: number; cooldown: number }>;
	reactionEvents?: Array<{
		characterId: string;
		reaction: import('$lib/types/ability').Reaction;
		time: number;
		castKind: 'skill' | 'burst';
	}>;
	windows?: TimelineWindow[];
};

function run(tracks: CharacterTrack[], chars: CharacterData[], opts: RunOpts = {}) {
	const reactionEvents: ReactionEvent[] = (opts.reactionEvents ?? []).map((e, i) => ({
		kind: 'reaction',
		id: 10_000 + i,
		...e
	}));
	return computeTeamBuffRows(
		tracks,
		opts.constellations ?? {},
		opts.loadout ?? {},
		new Map(),
		new Map(),
		opts.nbBars ?? [],
		castsFromTracks(tracks),
		reactionEvents,
		opts.windows ?? [],
		(id) => chars.find((c) => c.id === id) ?? null
	);
}

// ---------------------------------------------------------------------------

describe('computeTeamBuffRows — empty inputs', () => {
	it('returns an empty array for an empty rotation', () => {
		expect(run([], [])).toEqual([]);
	});

	it('returns no rows for a track whose character has no team effects', () => {
		const char = mkChar({ id: 'plain' });
		const tracks = [mkTrack('plain', { eBars: [mkBar(0)] })];
		expect(run(tracks, [char])).toEqual([]);
	});

	it('tolerates an unresolvable characterId without crashing', () => {
		const tracks = [mkTrack('ghost', { eBars: [mkBar(0)] })];
		expect(run(tracks, [])).toEqual([]);
	});
});

describe('computeTeamBuffRows — onCast dispatch', () => {
	it('emits one bar per burst cast at cast start + duration', () => {
		const char = mkChar({ id: 'buffer', burstEffects: [buff({ duration: 12 })] });
		const tracks = [mkTrack('buffer', { qBars: [mkBar(2, { label: 'Q', cooldown: 15 })] })];
		const rows = run(tracks, [char]);
		expect(rows).toHaveLength(1);
		expect(rows[0].key).toBe('buffer::char::Q');
		expect(rows[0].sourceLabel).toBe('buffer Q');
		expect(rows[0].bars).toEqual([
			{ start: 2, end: 14, effects: [{ stat: 'atk%', displayValue: '+20%' }] }
		]);
	});

	it('does not put active-only-target effects in the team row', () => {
		const char = mkChar({ id: 'onfield', burstEffects: [buff({ target: 'active' })] });
		const tracks = [mkTrack('onfield', { qBars: [mkBar(0, { label: 'Q' })] })];
		expect(run(tracks, [char])).toEqual([]);
	});

	it('offsets buff start by summonActivatesAt frames', () => {
		const char = mkChar({ id: 'summoner', skillEffects: [buff({ duration: 10 })] });
		const tracks = [
			mkTrack('summoner', { eBars: [mkBar(1, { summonActivatesAt: 30, uptime: 10 })] })
		];
		const rows = run(tracks, [char]);
		expect(rows[0].bars[0].start).toBeCloseTo(1.5); // 1s + 30f/60
		expect(rows[0].bars[0].end).toBeCloseTo(11.5);
	});
});

describe('computeTeamBuffRows — constellation gating', () => {
	const char = mkChar({
		id: 'consy',
		constellationEffects: [
			{
				level: 1,
				effects: [
					buff({
						trigger: { type: 'onCast', ability: 'burst' },
						conditions: { type: 'constellation', level: 1 }
					})
				]
			}
		]
	});
	const tracks = [mkTrack('consy', { qBars: [mkBar(0, { label: 'Q' })] })];

	it('drops the effect below the required constellation level', () => {
		expect(run(tracks, [char], { constellations: { consy: 0 } })).toEqual([]);
	});

	it('emits the effect at or above the required constellation level', () => {
		const rows = run(tracks, [char], { constellations: { consy: 1 } });
		expect(rows).toHaveLength(1);
		expect(rows[0].key).toBe('consy::char::Q');
	});
});

describe('computeTeamBuffRows — duplicate-dispatch regression (multi-segment characters)', () => {
	// The character-scoped pools (NB, onReaction) are filtered by characterId
	// only — dispatching them per TRACK duplicated every bar when a character
	// appeared in multiple rotation segments (2026-07-05 sweep, bug #11 class).
	const nbChar = mkChar({
		id: 'natlan',
		passiveEffects: [buff({ trigger: { type: 'onTeamNightsoulBurst' }, stat: 'em', value: 80 })]
	});
	const reactionChar = mkChar({
		id: 'reactor',
		passiveEffects: [
			buff({ trigger: { type: 'onReaction', reaction: 'pyroSwirl' }, stat: 'em', value: 100 })
		]
	});

	it('a character split across two tracks produces the same NB rows as one track', () => {
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

	it('a character split across two tracks produces the same onReaction rows as one track', () => {
		const reactionEvents = [
			{
				characterId: 'reactor',
				reaction: 'pyroSwirl' as const,
				time: 3,
				castKind: 'skill' as const
			}
		];
		const oneTrack = run([mkTrack('reactor')], [reactionChar], { reactionEvents });
		const twoTracks = run(
			[mkTrack('reactor', { activeEnd: 5 }), mkTrack('reactor', { activeStart: 8, activeEnd: 12 })],
			[reactionChar],
			{ reactionEvents }
		);
		expect(twoTracks).toEqual(oneTrack);
		expect(twoTracks[0].bars).toHaveLength(1);
	});

	it('NB effects fire once per nbBars event, not once per track', () => {
		const nbBars = [
			{ start: 5, cooldown: 18 },
			{ start: 25, cooldown: 18 }
		];
		const rows = run(
			[mkTrack('natlan', { activeEnd: 5 }), mkTrack('natlan', { activeStart: 8, activeEnd: 12 })],
			[nbChar],
			{ nbBars }
		);
		expect(rows).toHaveLength(1);
		expect(rows[0].key).toBe('natlan::char::NB');
		expect(rows[0].bars.map((b) => b.start)).toEqual([5, 25]);
	});
});

describe('computeTeamBuffRows — onReaction scoping', () => {
	const holder = mkChar({
		id: 'holder',
		passiveEffects: [
			buff({ trigger: { type: 'onReaction', reaction: 'pyroSwirl' }, stat: 'em', value: 100 })
		]
	});
	const other = mkChar({ id: 'other' });

	it("fires only on the holder's own reaction events by default", () => {
		const tracks = [mkTrack('holder', { activeEnd: 5 }), mkTrack('other', { activeStart: 5 })];
		const rows = run(tracks, [holder, other], {
			reactionEvents: [{ characterId: 'other', reaction: 'pyroSwirl', time: 6, castKind: 'skill' }]
		});
		expect(rows).toEqual([]);
	});

	it('fires on a matching own-reaction event', () => {
		const tracks = [mkTrack('holder')];
		const rows = run(tracks, [holder], {
			reactionEvents: [{ characterId: 'holder', reaction: 'pyroSwirl', time: 4, castKind: 'skill' }]
		});
		expect(rows).toHaveLength(1);
		expect(rows[0].key).toBe('holder::char::onReaction::em');
		expect(rows[0].bars).toEqual([
			{ start: 4, end: 16, effects: [{ stat: 'em', displayValue: '+100' }] }
		]);
	});

	it('ignores non-matching reactions', () => {
		const tracks = [mkTrack('holder')];
		const rows = run(tracks, [holder], {
			reactionEvents: [
				{ characterId: 'holder', reaction: 'overloaded', time: 4, castKind: 'skill' }
			]
		});
		expect(rows).toEqual([]);
	});
});

describe('computeTeamBuffRows — key uniqueness (each_key_duplicate regression)', () => {
	it('a dual-element resShred (Chevreuse A4 shape) yields two rows with distinct keys', () => {
		// Two RES shreds from one Overloaded trigger share the sourceLabel
		// "<name> reaction" — the render key must stay as fine-grained as the
		// rowMap dedup key or Svelte throws each_key_duplicate (frozen tool).
		const chev = mkChar({
			id: 'chev',
			passiveEffects: [resShred({ element: 'pyro' }), resShred({ element: 'electro' })]
		});
		const rows = run([mkTrack('chev')], [chev], {
			reactionEvents: [{ characterId: 'chev', reaction: 'overloaded', time: 2, castKind: 'skill' }]
		});
		expect(rows).toHaveLength(2);
		expect(rows[0].sourceLabel).toBe(rows[1].sourceLabel);
		expect(rows[0].key).not.toBe(rows[1].key);
		expect(rows.map((r) => r.kind)).toEqual(['debuff', 'debuff']);
		const keys = rows.map((r) => r.key);
		expect(new Set(keys).size).toBe(keys.length);
	});

	it('keys are stable across recomputes with identical inputs', () => {
		const char = mkChar({ id: 'stable', burstEffects: [buff()] });
		const tracks = [mkTrack('stable', { qBars: [mkBar(0, { label: 'Q' })] })];
		const a = run(tracks, [char]);
		const b = run(tracks, [char]);
		expect(a).toEqual(b);
		expect(a.map((r) => r.key)).toEqual(b.map((r) => r.key));
	});
});

describe('computeTeamBuffRows — defIgnore buff (G7)', () => {
	it('renders defIgnore as a percentage buff bar', () => {
		const char = mkChar({ id: 'ign', burstEffects: [buff({ stat: 'defIgnore', value: 40 })] });
		const tracks = [mkTrack('ign', { qBars: [mkBar(2, { label: 'Q', cooldown: 15 })] })];
		const rows = run(tracks, [char]);
		expect(rows).toHaveLength(1);
		expect(rows[0].kind).not.toBe('debuff');
		expect(rows[0].bars[0].effects[0]).toMatchObject({ stat: 'defIgnore', displayValue: '+40%' });
	});
});

describe('computeTeamBuffRows — DEF shred (resShred shredStat:def, G6)', () => {
	it('renders a DEF shred with the def% display stat and signed value', () => {
		const char = mkChar({
			id: 'defshred',
			passiveEffects: [resShred({ shredStat: 'def', value: -30 })]
		});
		const rows = run([mkTrack('defshred')], [char], {
			reactionEvents: [
				{ characterId: 'defshred', reaction: 'overloaded', time: 2, castKind: 'skill' }
			]
		});
		expect(rows).toHaveLength(1);
		expect(rows[0].kind).toBe('debuff');
		expect(rows[0].primaryStat).toBe('def%');
		expect(rows[0].bars[0].effects[0]).toMatchObject({ stat: 'def%', displayValue: '-30%' });
	});

	it('DEF shred and element-less RES shred stay distinct (dedup by shredStat, not collapsed)', () => {
		const char = mkChar({
			id: 'mix',
			passiveEffects: [resShred({ shredStat: 'def', value: -30 }), resShred({ value: -40 })]
		});
		const rows = run([mkTrack('mix')], [char], {
			reactionEvents: [{ characterId: 'mix', reaction: 'overloaded', time: 2, castKind: 'skill' }]
		});
		const stats = rows.flatMap((r) => r.bars.flatMap((b) => b.effects.map((e) => e.stat)));
		expect(stats).toContain('def%');
		expect(stats).toContain('allElementalRes');
		expect(rows.every((r) => r.kind === 'debuff')).toBe(true);
	});
});

describe('computeTeamBuffRows — artifact 4pc onCast dispatch', () => {
	it('dispatches Noblesse Oblige onCast-burst from the wearer loadout', () => {
		const char = mkChar({ id: 'wearer' });
		const tracks = [mkTrack('wearer', { qBars: [mkBar(3, { label: 'Q' })] })];
		const rows = run(tracks, [char], {
			loadout: { wearer: { artifactSetId: 'noblesse_oblige' } }
		});
		expect(rows).toHaveLength(1);
		expect(rows[0].key).toBe('wearer::artifact::noblesse_oblige::burst::Q');
		expect(rows[0].bars).toEqual([
			{ start: 3, end: 15, effects: [{ stat: 'atk%', displayValue: '+20%' }] }
		]);
	});

	it('tolerates a stale/unknown artifact id without crashing', () => {
		const char = mkChar({ id: 'wearer' });
		const tracks = [mkTrack('wearer', { qBars: [mkBar(0, { label: 'Q' })] })];
		expect(run(tracks, [char], { loadout: { wearer: { artifactSetId: 'nope' } } })).toEqual([]);
	});
});

describe('computeTeamBuffRows — afterDuration window join (sourceCastId)', () => {
	// The afterDuration anchor pairs each cast with the stance/summon window it
	// opened via the window's `sourceCastId` (IR provenance) — never by
	// timestamp coincidence. The buff starts at cast.time + window span.
	function runWithWindows(casts: CastEvent[], windows: TimelineWindow[], chars: CharacterData[]) {
		const tracks = [mkTrack(casts[0].characterId)];
		return computeTeamBuffRows(
			tracks,
			{},
			{},
			new Map(),
			new Map(),
			[],
			casts,
			[],
			windows,
			(id) => chars.find((c) => c.id === id) ?? null
		);
	}

	const afterBuff = buff({ trigger: { type: 'afterDuration' }, duration: 10 });
	const char = mkChar({ id: 'ender', burstEffects: [afterBuff] });
	const cast: CastEvent = {
		kind: 'cast',
		id: 42,
		characterId: 'ender',
		ability: 'burst',
		abilityId: 'ender__burst',
		label: 'Q',
		time: 2,
		castTime: 1,
		uptime: 6,
		cooldown: 15,
		readyAt: 17,
		summonActivatesAt: 0,
		fieldStart: 2
	};

	it('anchors the buff at the linked window end (cast.time + window span)', () => {
		const windows: TimelineWindow[] = [
			{ kind: 'stance', characterId: 'ender', start: 2, end: 8, source: 'burst', sourceCastId: 42 }
		];
		const rows = runWithWindows([cast], windows, [char]);
		expect(rows).toHaveLength(1);
		expect(rows[0].key).toBe('ender::char::Q::afterDuration');
		expect(rows[0].bars).toEqual([
			{ start: 8, end: 18, effects: [{ stat: 'atk%', displayValue: '+20%' }] }
		]);
	});

	it('ignores windows opened by other casts even at coincident timestamps', () => {
		const windows: TimelineWindow[] = [
			{ kind: 'stance', characterId: 'ender', start: 2, end: 8, source: 'burst', sourceCastId: 7 }
		];
		const rows = runWithWindows([cast], windows, [char]);
		// No linked window → falls back to the cast start.
		expect(rows[0].bars[0].start).toBe(2);
	});
});
