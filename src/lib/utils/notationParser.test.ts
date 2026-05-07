import { describe, it, expect } from 'vitest';
import { parseNotation } from './notationParser';
import type { CharacterData } from '$lib/types/character';
import type { Ability } from '$lib/types/ability';
import ganyuJson from '$lib/data/characters/ganyu.json';
import dilucJson from '$lib/data/characters/diluc.json';
import huTaoJson from '$lib/data/characters/hu_tao.json';
import xilonenJson from '$lib/data/characters/xilonen.json';

const ganyu = ganyuJson as unknown as CharacterData;

const lookupGanyu = (name: string): CharacterData | null =>
	name === 'Ganyu' ? ganyu : null;

describe('parseNotation — charge queue baseline (Bug #1 no-regression)', () => {
	it('Ganyu 1-charge: second E waits for full cooldown', () => {
		// No C2, no Sac Bow. One charge, 10s CD, ~0.45s cast.
		// E1 at t=0; E2 must wait until first E's cooldown expires.
		const result = parseNotation('Ganyu E E', lookupGanyu, 8);
		const ganyuTrack = result.tracks.find((t) => t.characterId === 'ganyu')!;
		expect(ganyuTrack.eBars).toHaveLength(2);
		// cooldownStartDelay=10 frames → 10/60 + 10s = ~10.17s
		expect(ganyuTrack.eBars[1].start).toBeGreaterThan(10);
		expect(ganyuTrack.eBars[1].start).toBeLessThan(10.5);
	});

	it('Ganyu C2 (2 charges), no Sac Bow: third E waits for first charge to return', () => {
		// With 2 charges and no proc, third E should wait ~10s after first cast.
		const result = parseNotation('Ganyu E E E', lookupGanyu, 8, { ganyu: 2 });
		const ganyuTrack = result.tracks.find((t) => t.characterId === 'ganyu')!;
		expect(ganyuTrack.eBars).toHaveLength(3);
		expect(ganyuTrack.eBars[0].start).toBe(0);
		expect(ganyuTrack.eBars[1].start).toBeLessThan(1); // charge 2 available immediately
		// E3 must wait for a charge to come off CD.
		expect(ganyuTrack.eBars[2].start).toBeGreaterThan(10);
		expect(ganyuTrack.eBars[2].start).toBeLessThan(10.5);
	});
});

describe('parseNotation — Sacrificial Bow proc (Bug #1)', () => {
	it('Ganyu C2 + Sac Bow: proc reset makes third E castable immediately', () => {
		// E1 at t=0 consumes one charge, Sac proc fires resetting that charge to
		// hitmark (~0.45s). E2 at ~0.45s consumes the other untouched charge.
		// E3 should use the proc-reset charge (ready at 0.45s), not wait 10s.
		const result = parseNotation(
			'Ganyu E E E',
			lookupGanyu,
			8,
			{ ganyu: 2 },
			{ ganyu: { weaponId: 'sacrificial_bow', weaponRefinement: 1 } }
		);
		const ganyuTrack = result.tracks.find((t) => t.characterId === 'ganyu')!;
		expect(ganyuTrack.eBars).toHaveLength(3);
		expect(ganyuTrack.eBars[0].sacProcFired).toBe(true);
		// Without the fix: queue[0] after the sort is the OTHER charge, so the
		// proc overwrites the wrong slot and the consumed charge keeps its 10s
		// CD. E3 ends up starting ~10.17s in. With the fix, E3 starts ~0.9s.
		expect(ganyuTrack.eBars[2].start).toBeLessThan(2);
	});
});

describe('parseNotation — variant-level modifiers (Bug #3)', () => {
	it('hold variant with its own cooldownModifier applies variant modifier, not base', () => {
		// Synthetic character: base skill CD 10, no base modifiers. Hold variant
		// has a flat -4s modifier. Parser should use the variant's modifier when
		// the hE token matches the variant input.
		const synthAbilities: Ability[] = [
			{
				id: 'synth__skill',
				name: 'Synth Skill',
				input: ['E'],
				abilityType: 'skill',
				behavior: 'instant',
				frames: { swap: 20 },
				cooldown: 10,
				cooldownModifiers: [],
				charges: 1,
				variants: [
					{
						label: 'Hold',
						input: ['hE'],
						frames: { swap: 30 },
						cooldown: 10,
						cooldownModifiers: [
							{ source: 'Hold variant', type: 'flat', value: -4 }
						]
					}
				]
			},
			{
				id: 'synth__burst',
				name: 'Synth Burst',
				input: ['Q'],
				abilityType: 'burst',
				behavior: 'instant',
				frames: { swap: 20 },
				cooldown: 15,
				energyCost: 60
			}
		];

		const synth: CharacterData = {
			id: 'synth',
			name: 'Synth',
			displayName: 'Synth',
			element: 'pyro',
			weapon: 'sword',
			rarity: 5,
			abilities: synthAbilities,
			passives: [],
			constellations: []
		} as unknown as CharacterData;

		const lookup = (name: string): CharacterData | null =>
			name === 'Synth' ? synth : null;

		const tapResult = parseNotation('Synth E', lookup, 8);
		const holdResult = parseNotation('Synth hE', lookup, 8);

		const tapCd = tapResult.tracks[0].eBars[0].cooldown;
		const holdCd = holdResult.tracks[0].eBars[0].cooldown;

		// Base tap: 10s unmodified.
		expect(tapCd).toBe(10);
		// Hold: 10 + (-4) = 6s from the variant's own modifier.
		expect(holdCd).toBe(6);
	});
});


describe('parseNotation — chainStage (Diluc E1→E2→E3)', () => {
	const diluc = dilucJson as unknown as CharacterData;
	const lookup = (name: string): CharacterData | null => (name === 'Diluc' ? diluc : null);

	// Each stage's cast-time when the next token is E (peekActionKey → 'E', so frames.E).
	const e1CastBeforeE = 31 / 60; // E1 frames.E = 31
	const e2CastBeforeE = 37 / 60; // E2 frames.E = 37
	const e1CastBeforeSwap = 30 / 60; // frames.swap = 30 (end-of-segment fallback)

	it('three Es fire stages 1, 2, 3 with their distinct cast times', () => {
		const result = parseNotation('Diluc E E E', lookup, 8);
		const track = result.tracks.find((t) => t.characterId === 'diluc')!;
		expect(track.eBars).toHaveLength(3);
		// Distinct cast-times prove each stage was selected (not the same E1 three times).
		expect(track.eBars[0].castTime).toBeCloseTo(e1CastBeforeE, 5);
		expect(track.eBars[1].castTime).toBeCloseTo(e2CastBeforeE, 5);
		// E3 is the last token in the segment → swap fallback (66/60).
		expect(track.eBars[2].castTime).toBeCloseTo(66 / 60, 5);
		// And they line up sequentially.
		expect(track.eBars[0].start).toBe(0);
		expect(track.eBars[1].start).toBeCloseTo(e1CastBeforeE, 5);
		expect(track.eBars[2].start).toBeCloseTo(e1CastBeforeE + e2CastBeforeE, 5);
	});

	it('fourth E (after terminal) waits for the chain CD to reset and fires E1 again', () => {
		const result = parseNotation('Diluc E E E E', lookup, 8);
		const track = result.tracks.find((t) => t.characterId === 'diluc')!;
		expect(track.eBars).toHaveLength(4);
		// After E3 (terminal), chain resets to 0. E1 has cooldown 10s — its queue still
		// holds 10s from the first cast, so the 4th press waits until t≈10.
		expect(track.eBars[3].start).toBeGreaterThanOrEqual(10);
		expect(track.eBars[3].start).toBeLessThan(11);
		// And it's E1 again — last token → swap fallback (30/60).
		expect(track.eBars[3].castTime).toBeCloseTo(e1CastBeforeSwap, 5);
	});

	it('E after a long pause (window expired) resolves back to E1', () => {
		// "~5s" pushes the cursor 5s forward, well past the 4s chain window.
		const result = parseNotation('Diluc E ~5s E', lookup, 8);
		const track = result.tracks.find((t) => t.characterId === 'diluc')!;
		expect(track.eBars).toHaveLength(2);
		// The second E should be E1 (cast time → swap fallback, 30/60), not E2.
		// E1's queue had 10s cooldown — even though the chain window expired,
		// E1's queue still gates the next press until t≈10.
		expect(track.eBars[1].castTime).toBeCloseTo(e1CastBeforeSwap, 5);
		expect(track.eBars[1].start).toBeGreaterThanOrEqual(10);
	});
});


describe('parseNotation — E-stance opens stance window (Hu Tao Paramita Papilio)', () => {
	const huTao = huTaoJson as unknown as CharacterData;
	const lookup = (name: string): CharacterData | null => (name === 'Hu Tao' ? huTao : null);

	it('N after stance E resolves the in-stance variant (pyro-infused)', () => {
		// Hu Tao's E (Guide to Afterlife) is behavior: stance + terminatesOnSwap: true.
		// The in-stance N (Paramita Papilio) has conditions: { state: inStance } and
		// infusion: pyro. Before the parser fix, E-stance didn't open the stance window
		// so the base (non-infused) normal would resolve.
		const result = parseNotation('Hu Tao E N1', lookup, 8);
		const track = result.tracks.find((t) => t.characterId === 'hu_tao')!;
		// Find the N block. It should be flagged as elemental-normal (infusion present),
		// proving the in-stance Paramita Papilio variant resolved.
		const nBlock = track.inputBlocks.find((b) => b.parts[0] === 'N1');
		expect(nBlock).toBeDefined();
		expect(nBlock!.kind).toBe('elemental-normal');
	});

	it('N before stance E resolves the base normal (no infusion)', () => {
		// Sanity check: same character, different ordering. N before E should pick the
		// base ability. Hu Tao is a polearm, so base normal kind is 'normal' (not catalyst).
		const result = parseNotation('Hu Tao N1 E', lookup, 8);
		const track = result.tracks.find((t) => t.characterId === 'hu_tao')!;
		const nBlock = track.inputBlocks.find((b) => b.parts[0] === 'N1');
		expect(nBlock).toBeDefined();
		expect(nBlock!.kind).toBe('normal');
	});
});

describe('parseNotation — stacks condition + {key:N} assertion', () => {
	// Synthetic character with a base skill (no condition) and a stacks-gated
	// loaded variant. Same input "E", same frames, stacks: declension >= 4.
	const stub: CharacterData = {
		id: 'stackstub',
		name: 'Stub',
		displayName: 'Stub',
		element: 'pyro',
		weapon: 'sword',
		gender: 'Female',
		affiliation: 'Test',
		region: 'Test',
		rarity: 5,
		abilities: [
			{
				id: 'stackstub__normal__attack',
				name: 'Attack',
				input: ['N'],
				abilityType: 'normal',
				hits: [{ frames: { swap: 10 } }]
			} as Ability,
			{
				id: 'stackstub__skill__base',
				name: 'Base Skill',
				input: ['E'],
				abilityType: 'skill',
				behavior: 'instant',
				frames: { swap: 30 },
				cooldown: 5
			} as Ability,
			{
				id: 'stackstub__skill__loaded',
				name: 'Loaded Skill',
				input: ['E'],
				abilityType: 'skill',
				behavior: 'instant',
				frames: { swap: 30 },
				cooldown: 20,
				conditions: { type: 'stacks', key: 'declension', min: 4 }
			} as Ability
		],
		passives: [],
		constellations: []
	} as CharacterData;
	const lookup = (n: string): CharacterData | null => (n === 'Stub' ? stub : null);

	it('without an assertion, E resolves the base skill (cd 5)', () => {
		const result = parseNotation('Stub E E', lookup, 8);
		const track = result.tracks.find((t) => t.characterId === 'stackstub')!;
		expect(track.eBars).toHaveLength(2);
		expect(track.eBars[0].cooldown).toBe(5);
		expect(track.eBars[1].cooldown).toBe(5);
		// Second E waits for base 5s cooldown to expire (cooldown clock starts
		// at cast time, so E2 can fire exactly at t=5s).
		expect(track.eBars[1].start).toBeCloseTo(5, 1);
	});

	it('after {declension:4}, E resolves the loaded skill (cd 20)', () => {
		const result = parseNotation('Stub {declension:4} E', lookup, 8);
		const track = result.tracks.find((t) => t.characterId === 'stackstub')!;
		expect(track.eBars).toHaveLength(1);
		expect(track.eBars[0].cooldown).toBe(20);
	});

	it('stacks below min still resolve the base skill', () => {
		const result = parseNotation('Stub {declension:3} E', lookup, 8);
		const track = result.tracks.find((t) => t.characterId === 'stackstub')!;
		expect(track.eBars[0].cooldown).toBe(5);
	});

	it('a later assertion overrides the earlier count', () => {
		// First E with declension=4 (loaded). Second E with declension=0 (base).
		const result = parseNotation('Stub {declension:4} E ~10s {declension:0} E', lookup, 8);
		const track = result.tracks.find((t) => t.characterId === 'stackstub')!;
		expect(track.eBars).toHaveLength(2);
		expect(track.eBars[0].cooldown).toBe(20);
		expect(track.eBars[1].cooldown).toBe(5);
	});

	it('stack state resets between segments (per-character)', () => {
		// Segment 1: assert 4 stacks, fire loaded.
		// Segment 2 (same character, after a swap-out): no assertion, should resolve base.
		const result = parseNotation('Stub {declension:4} E > Stub E', lookup, 8);
		const track1 = result.tracks[0];
		const track2 = result.tracks[1];
		expect(track1.eBars[0].cooldown).toBe(20);
		expect(track2.eBars[0].cooldown).toBe(5);
	});

	it('the assertion token does not advance the cursor or emit a block', () => {
		const result = parseNotation('Stub {declension:4} E', lookup, 8);
		const track = result.tracks.find((t) => t.characterId === 'stackstub')!;
		// E should fire at t=0 — the assertion is a zero-width annotation.
		expect(track.eBars[0].start).toBe(0);
		// inputBlocks should contain only the E block, not the assertion.
		const blockLabels = track.inputBlocks.map((b) => b.parts[0]);
		expect(blockLabels).toEqual(['E']);
	});

	it('stamps stackContext onto the bar at cast time (per-cast snapshot)', () => {
		// First E with no assertion → no stackContext.
		// Second E with {declension:4} → stackContext { declension: 4 }.
		// Third E with {declension:0} → stackContext { declension: 0 }.
		const result = parseNotation('Stub E ~10s {declension:4} E ~25s {declension:0} E', lookup, 8);
		const track = result.tracks.find((t) => t.characterId === 'stackstub')!;
		expect(track.eBars).toHaveLength(3);
		expect(track.eBars[0].stackContext).toBeUndefined();
		expect(track.eBars[1].stackContext?.get('declension')).toBe(4);
		expect(track.eBars[2].stackContext?.get('declension')).toBe(0);
	});
});

describe('parseNotation — opensState (Xilonen nightsoulBlessing)', () => {
	const xilonen = xilonenJson as unknown as CharacterData;
	const lookup = (name: string): CharacterData | null => (name === 'Xilonen' ? xilonen : null);

	it('N after stance E resolves the in-stance Blade Roller (geo infusion via opensState)', () => {
		// Xilonen's E has behavior: stance + opensState: "nightsoulBlessing". Her in-stance
		// Blade Roller normal has conditions: { state: nightsoulBlessing } and infusion: geo.
		// Tests both the E-stance window opening AND the opensState named-state opening.
		const result = parseNotation('Xilonen E N1', lookup, 8);
		const track = result.tracks.find((t) => t.characterId === 'xilonen')!;
		const nBlock = track.inputBlocks.find((b) => b.parts[0] === 'N1');
		expect(nBlock).toBeDefined();
		// Sword + geo infusion → elemental-normal block kind.
		expect(nBlock!.kind).toBe('elemental-normal');
	});

	it('N before stance E resolves the base 3-hit physical normal', () => {
		// Without nightsoulBlessing state open, the base Ehecatl's Roar normal applies
		// (no infusion, sword character). Block kind should be 'normal'.
		const result = parseNotation('Xilonen N1 E', lookup, 8);
		const track = result.tracks.find((t) => t.characterId === 'xilonen')!;
		const nBlock = track.inputBlocks.find((b) => b.parts[0] === 'N1');
		expect(nBlock).toBeDefined();
		expect(nBlock!.kind).toBe('normal');
	});
});
