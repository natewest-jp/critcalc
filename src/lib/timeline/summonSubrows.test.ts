import { describe, it, expect } from 'vitest';
import { computeSummonSubrows, computeSummonTicks, findCastSummons } from './summonSubrows';
import { framesOf } from '$lib/utils/frames';
import type { TimelineBar, TimelineWindow } from '$lib/utils/notationParser';
import type { Ability, Summon } from '$lib/types/ability';
import type { CharacterData } from '$lib/types/character';
import type { SlottedTrack } from './types';

// ---------------------------------------------------------------------------
// Hermetic fixtures
//
// Post-3c, computeSummonSubrows PROJECTS parser-authored `summon` windows onto
// sub-rows: it no longer reconstructs spawn/end/truncation from bar geometry.
// The tracks supply sub-row ordering + the Summon object (for tick markers);
// the windows supply the final spans. Fixtures therefore build both, exactly as
// the parser+renderer pair would at runtime.
//
// TIME UNIT: the IR is FRAMES (gauge-round.md C1). The helpers below take
// SECONDS — the unit these game facts were authored in — and snap them with
// `framesOf`, so a fixture still reads as the timing it encodes. The one
// exception is `summonActivatesAt`, which is authored in FRAMES on the ability
// and is written here as a bare frame count.
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

/** `startSec` in seconds; the bar's own fields land in frames. */
function mkBar(startSec: number, over: Partial<TimelineBar> = {}): TimelineBar {
	return {
		start: framesOf(startSec),
		uptime: framesOf(10),
		cooldown: framesOf(12),
		label: 'E',
		castTime: framesOf(0.5),
		...over
	};
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
		activeEnd: framesOf(10),
		inputBlocks: [],
		hasUnsetDuration: false,
		eBars: [],
		qBars: [],
		slotIdx,
		...over
	};
}

/** A parser summon window (spawn offset + swap/recast truncation already
 *  applied, as the finalize pass emits it). Spans given in seconds. */
function mkWin(
	characterId: string,
	startSec: number,
	endSec: number,
	source: 'skill' | 'burst',
	label = 'Oz',
	/** ⚠️ The parse publishes a summon's markers since 2026-08-18 — this pass
	 *  reads them rather than deriving them, so a fixture that wants ticks on a
	 *  bar has to put them on the window. */
	ticks?: number[]
): Extract<TimelineWindow, { kind: 'summon' }> {
	return {
		kind: 'summon',
		characterId,
		label,
		start: framesOf(startSec),
		end: framesOf(endSec),
		source,
		...(ticks ? { ticks } : {})
	};
}

function run(
	tracks: SlottedTrack[],
	windows: TimelineWindow[],
	chars: CharacterData[],
	cons: Record<string, number> = {}
) {
	return computeSummonSubrows(
		tracks,
		windows,
		cons,
		(id) => chars.find((c) => c.id === id) ?? null
	);
}

// ---------------------------------------------------------------------------

describe('computeSummonSubrows — basics', () => {
	it('returns an empty array for an empty rotation', () => {
		expect(run([], [], [])).toEqual([]);
	});

	it('emits no rows for zero-uptime bars or characters without summons', () => {
		const noSummon = mkChar('plain');
		// Zero-uptime bar registers no row; no summon window exists for it.
		expect(
			run([mkTrack('plain', 0, { eBars: [mkBar(0, { uptime: 0 })] })], [], [noSummon])
		).toEqual([]);
		// ↻ 2026-09-04 (Arkhe round, landing c): a window for a SLOTTED character
		// no longer needs a bar-registered lane — it mints one. This assertion used
		// to read "even a stray window finds no registered lane and is dropped",
		// and that contract had to go: a `summonsFollowState` cast hands its window
		// to a lineup the CAST never resolved (Furina's Charged Attack replacing the
		// Salon Members with the Singer off an Ousia cast), so pass 1 cannot
		// enumerate the lanes any more. ⚠️ The old behaviour was not a safety net
		// being removed — pass 1 and pass 2 resolved through the SAME function with
		// the same arguments, so a "stray window" was unreachable in a real parse
		// and only a synthetic input could produce one.
		expect(
			run(
				[mkTrack('plain', 0, { eBars: [mkBar(0)] })],
				[mkWin('plain', 0, 10, 'skill')],
				[noSummon]
			)
		).toEqual([
			{
				slotIdx: 0,
				characterId: 'plain',
				label: 'Oz',
				bars: [{ start: 0, end: framesOf(10), source: 'skill', ticks: [] }]
			}
		]);
		// ⚓ What the drop still guards, and the reason the slot is looked up rather
		// than assumed: a window for a character with NO SLOT has nowhere to go.
		expect(run([], [mkWin('plain', 0, 10, 'skill')], [noSummon])).toEqual([]);
	});

	it('projects each summon window onto a bar, taking the span from the window', () => {
		const char = mkChar('fischl', mkSummon());
		// Bar geometry (start 2s, summonActivatesAt 30f) is IGNORED — the window is
		// authoritative (parser already applied the +0.5s spawn offset).
		const tracks = [mkTrack('fischl', 1, { eBars: [mkBar(2, { summonActivatesAt: 30 })] })];
		const windows = [mkWin('fischl', 2.5, 12.5, 'skill')];
		expect(run(tracks, windows, [char])).toEqual([
			{
				slotIdx: 1,
				characterId: 'fischl',
				label: 'Oz',
				bars: [{ start: framesOf(2.5), end: framesOf(12.5), source: 'skill', ticks: [] }]
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
		const windows = [mkWin('fischl', 0, 10, 'skill'), mkWin('fischl', 12, 22, 'burst')];
		const rows = run(tracks, windows, [char]);
		expect(rows).toHaveLength(1);
		expect(rows[0].bars.map((b) => b.source)).toEqual(['skill', 'burst']);
	});

	it('orders a lane by the track-then-kind walk, not by window start', () => {
		// Corpus case (Fischl `E … Q … E`): two skill casts straddle one burst on a
		// shared Oz lane. The parser sorts windows by start ([E@0.3, Q@5.15,
		// E@25.6]); the pre-3c walk grouped skills before bursts ([E, E, Q]). The
		// lane's bars must match the walk, so a later skill precedes an earlier
		// burst.
		const char = mkChar('fischl', mkSummon(), mkSummon());
		const tracks = [
			mkTrack('fischl', 0, {
				eBars: [mkBar(0.3), mkBar(25.6)],
				qBars: [mkBar(5.15, { label: 'Q' })]
			})
		];
		// Windows arrive start-sorted, as the parser emits them.
		const windows = [
			mkWin('fischl', 0.3, 10.3, 'skill'),
			mkWin('fischl', 5.15, 15.15, 'burst'),
			mkWin('fischl', 25.6, 35.6, 'skill')
		];
		const rows = run(tracks, windows, [char]);
		expect(rows[0].bars.map((b) => [b.start, b.source])).toEqual([
			[framesOf(0.3), 'skill'],
			[framesOf(25.6), 'skill'],
			[framesOf(5.15), 'burst']
		]);
	});

	it('drops a registered row whose casts all truncated to zero (no windows)', () => {
		const char = mkChar('fischl', mkSummon());
		// A cast happened (row registered by the walk) but the parser emitted no
		// surviving window (e.g. immediate swap before spawn) → no bars → dropped.
		expect(run([mkTrack('fischl', 0, { eBars: [mkBar(0)] })], [], [char])).toEqual([]);
	});
});

describe('computeSummonSubrows — window projection + ticks', () => {
	const tickSummon = () =>
		mkSummon({
			label: 'Oz',
			effects: [
				{
					type: 'damage',
					trigger: { type: 'summonTick', interval: 2 },
					target: 'enemy'
				} as unknown as NonNullable<Summon['effects']>[number]
			]
		});

	// ↻ 2026-08-18: the tick WALK moved to `finalize` (one producer — see the note
	// in computeSummonSubrows). These three used to drive `computeSummonTicks`
	// THROUGH the projection; the derivation assertions moved down to that
	// function, which still owns them, and what is left here is that a bar carries
	// its window's ticks verbatim.
	it('carries the window’s ticks onto the bar, verbatim', () => {
		const char = mkChar('fischl', tickSummon());
		const win = mkWin('fischl', 0, 6, 'skill', 'Oz', [framesOf(2), framesOf(4)]);
		const rows = run([mkTrack('fischl', 0, { eBars: [mkBar(0)] })], [win], [char]);
		expect(rows[0].bars).toEqual([
			{
				start: 0,
				end: framesOf(6),
				source: 'skill',
				ticks: [framesOf(2), framesOf(4)]
			}
		]);
	});

	it('gives a window with no ticks an empty array, not undefined', () => {
		const char = mkChar('fischl', tickSummon());
		const rows = run(
			[mkTrack('fischl', 0, { eBars: [mkBar(0)] })],
			[mkWin('fischl', 0, 6, 'skill')],
			[char]
		);
		expect(rows[0].bars[0].ticks).toEqual([]);
	});

	it('derives a span-truncated series — `computeSummonTicks`, where the walk lives', () => {
		// Parser-truncated window ends at 6 (terminatesOn swap/recast baked in);
		// ticks past 6 must not appear.
		const summon = tickSummon();
		expect(computeSummonTicks(summon, 0, framesOf(6), 0)).toEqual([framesOf(2), framesOf(4)]);
		expect(computeSummonTicks(summon, framesOf(6), framesOf(16), 0)).toEqual([
			framesOf(8),
			framesOf(10),
			framesOf(12),
			framesOf(14)
		]);
	});

	it('projects multiple windows on one key as chronological bars', () => {
		const char = mkChar('fischl', tickSummon());
		// A recast: parser truncated the first window at 6 and opened a second.
		const rows = run(
			[mkTrack('fischl', 0, { eBars: [mkBar(0), mkBar(6)] })],
			[
				mkWin('fischl', 0, 6, 'skill', 'Oz', [framesOf(2), framesOf(4)]),
				mkWin('fischl', 6, 16, 'skill', 'Oz', [framesOf(8), framesOf(10)])
			],
			[char]
		);
		expect(rows[0].bars).toHaveLength(2);
		expect(rows[0].bars[0]).toEqual({
			start: 0,
			end: framesOf(6),
			source: 'skill',
			ticks: [framesOf(2), framesOf(4)]
		});
		expect(rows[0].bars[1]).toEqual({
			start: framesOf(6),
			end: framesOf(16),
			source: 'skill',
			ticks: [framesOf(8), framesOf(10)]
		});
	});

	it('respects the constellation level when gating tick effects', () => {
		const gated = mkSummon({
			label: 'Oz',
			effects: [
				{
					type: 'damage',
					trigger: { type: 'summonTick', interval: 2 },
					conditions: { type: 'constellation', level: 2 },
					target: 'enemy'
				} as unknown as NonNullable<Summon['effects']>[number]
			]
		});
		// ↻ Asserted on the WALK now, not through the projection — the gating lives
		// in `collectSummonTicks` and the projection no longer derives anything.
		expect(computeSummonTicks(gated, 0, framesOf(8), 0)).toEqual([]);
		expect(computeSummonTicks(gated, 0, framesOf(8), 2)).toEqual([
			framesOf(2),
			framesOf(4),
			framesOf(6)
		]);
	});

	it('carries the source field from the window', () => {
		const char = mkChar('guoba', undefined, mkSummon({ label: 'Guoba' }));
		const rows = run(
			[mkTrack('guoba', 0, { qBars: [mkBar(0, { label: 'Q' })] })],
			[mkWin('guoba', 0, 4, 'burst', 'Guoba')],
			[char]
		);
		expect(rows[0].bars[0].source).toBe('burst');
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
		expect(computeSummonTicks(summon, framesOf(10), framesOf(20), 0)).toEqual([
			framesOf(11),
			framesOf(14),
			framesOf(17)
		]);
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
		expect(computeSummonTicks(summon, 0, framesOf(10), 0)).toEqual([]);
		expect(computeSummonTicks(summon, 0, framesOf(10), 2)).toEqual([
			framesOf(2),
			framesOf(4),
			framesOf(6),
			framesOf(8)
		]);
	});
});

describe('findCastSummons', () => {
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
		expect(findCastSummons(char, 'skill', 'E')[0]?.label).toBe('Oz');
	});

	it('resolves the variant summon when the bar label matches variant input', () => {
		expect(findCastSummons(char, 'skill', 'hE')[0]?.label).toBe('Hold Oz');
	});

	it('returns an empty array for a null character or missing ability', () => {
		expect(findCastSummons(null, 'skill', 'E')).toEqual([]);
		expect(findCastSummons(char, 'burst', 'Q')).toEqual([]);
	});

	// The reason this went plural: an ability may own more than one summon and
	// only the first was ever reachable.
	it('returns EVERY summon on the ability, in authored order', () => {
		const second = mkSummon({ label: 'Second' });
		const multi = {
			...char,
			abilities: [{ ...char.abilities[0], summons: [baseSummon, second] }]
		} as CharacterData;
		expect(findCastSummons(multi, 'skill', 'E').map((s) => s.label)).toEqual(['Oz', 'Second']);
	});
});
