import { describe, it, expect } from 'vitest';
import { parseNotation, evalCondition } from './notationParser';
import type { CharacterData } from '$lib/types/character';
import type { Ability } from '$lib/types/ability';
import ganyuJson from '$lib/data/characters/ganyu.json';
import dilucJson from '$lib/data/characters/diluc.json';
import huTaoJson from '$lib/data/characters/hu_tao.json';
import xilonenJson from '$lib/data/characters/xilonen.json';
import kazuhaJson from '$lib/data/characters/kaedehara_kazuha.json';
import cynoJson from '$lib/data/characters/cyno.json';

const ganyu = ganyuJson as unknown as CharacterData;
const kazuha = kazuhaJson as unknown as CharacterData;

const lookupGanyu = (name: string): CharacterData | null => (name === 'Ganyu' ? ganyu : null);

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

describe('parseNotation — character cdReset (Kazuha C1: Q resets E)', () => {
	const lookupKazuha = (name: string): CharacterData | null => (name === 'Kazuha' ? kazuha : null);

	it('without C1 (cons 0): second E after Q waits for full E cooldown', () => {
		// E (6s base CD) → Q → E. The second E should wait for the E CD (~6s)
		// since C0 has no reset effect.
		const result = parseNotation('Kazuha E Q E', lookupKazuha, 8);
		const track = result.tracks.find((t) => t.characterId === 'kaedehara_kazuha')!;
		expect(track.eBars).toHaveLength(2);
		// E1 at t=0; E2 must wait for E CD. With Q cast in between (a couple
		// seconds), E2 still needs to clear the 6s CD on E1.
		expect(track.eBars[1].start).toBeGreaterThan(5);
	});

	it('with C1: Q-cast resets E CD, so the next E is castable immediately', () => {
		// E (CD 6s with C1 -10% → 5.4s) → Q → E. C1's cdReset on burst should
		// refund E's charge, so E2 starts right after Q's cast (no CD wait).
		const result = parseNotation('Kazuha E Q E', lookupKazuha, 8, { kaedehara_kazuha: 1 });
		const track = result.tracks.find((t) => t.characterId === 'kaedehara_kazuha')!;
		expect(track.eBars).toHaveLength(2);
		expect(track.qBars).toHaveLength(1);
		// E2 should start at the moment Q's cast finishes — well under the
		// 5.4s base E CD.
		const qEnd = track.qBars[0].start + track.qBars[0].castTime;
		expect(track.eBars[1].start).toBeGreaterThanOrEqual(qEnd);
		expect(track.eBars[1].start).toBeLessThan(qEnd + 0.1);
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
						cooldownModifiers: [{ source: 'Hold variant', type: 'flat', value: -4 }]
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

		const lookup = (name: string): CharacterData | null => (name === 'Synth' ? synth : null);

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

describe('parseNotation — durationExtensions[] onCast dispatch (Cyno burst stance)', () => {
	// Cyno's burst opens a stance with duration 11.87s. The burst's
	// durationExtensions[] entry { trigger: onCast skill, conditions: state inStance,
	// delta: 4, maxExtensions: 2 } extends the window by 4s on each in-stance
	// Mortuary Rite cast, capped at 2 extensions. Tests the migrated path
	// (formerly stanceExtension on the Mortuary Rite ability).
	const cyno = cynoJson as unknown as CharacterData;
	const lookup = (name: string): CharacterData | null => (name === 'Cyno' ? cyno : null);

	it('Q with no follow-up E leaves the stance bar at base duration', () => {
		const result = parseNotation('Cyno Q', lookup, 25);
		const track = result.tracks.find((t) => t.characterId === 'cyno')!;
		expect(track.qBars).toHaveLength(1);
		expect(track.qBars[0].uptime).toBeCloseTo(11.87, 2);
	});

	it('Q E extends the stance bar by exactly +4s for the first in-stance E', () => {
		// E inside the stance resolves to mortuary_rite_in_stance variant; the
		// burst's durationExtensions[] fires once.
		const result = parseNotation('Cyno Q E', lookup, 25);
		const track = result.tracks.find((t) => t.characterId === 'cyno')!;
		expect(track.qBars[0].uptime).toBeCloseTo(11.87 + 4, 2);
	});

	it('Q E E extends by +8s (two consecutive in-stance E casts)', () => {
		const result = parseNotation('Cyno Q E E', lookup, 30);
		const track = result.tracks.find((t) => t.characterId === 'cyno')!;
		expect(track.qBars[0].uptime).toBeCloseTo(11.87 + 8, 2);
	});

	it('Q E E E caps at maxExtensions: 2 — third E does not extend further', () => {
		const result = parseNotation('Cyno Q E E E', lookup, 35);
		const track = result.tracks.find((t) => t.characterId === 'cyno')!;
		// Stance bar should reflect 2 extensions (8s) total, not 3 (12s).
		expect(track.qBars[0].uptime).toBeCloseTo(11.87 + 8, 2);
	});

	it('E without an active stance does not fire any extension', () => {
		// Cold-open E resolves to base Secret Rite (no inStance condition matches);
		// no stance window is open so dispatch finds no owner ability and exits.
		const result = parseNotation('Cyno E', lookup, 10);
		const track = result.tracks.find((t) => t.characterId === 'cyno')!;
		expect(track.eBars).toHaveLength(1);
		// qBars is empty; nothing to assert on stance uptime.
		expect(track.qBars).toHaveLength(0);
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

describe('parseNotation — variant-driven stance + opensState', () => {
	// Synthetic Mavuika-shape character: base skill is `behavior: "instant"`;
	// Hold-E variant overrides to `behavior: "stance"` with opensState
	// "nightsoulBlessing" and terminatesOnSwap: true.
	const stub: CharacterData = {
		id: 'variantstub',
		name: 'VStub',
		displayName: 'VStub',
		element: 'pyro',
		weapon: 'sword',
		gender: 'Female',
		affiliation: 'Test',
		region: 'Test',
		rarity: 5,
		abilities: [
			{
				id: 'variantstub__normal__base',
				name: 'Base N',
				input: ['N'],
				abilityType: 'normal',
				hits: [{ frames: { swap: 10 } }]
			} as Ability,
			{
				id: 'variantstub__normal__bike',
				name: 'Bike N',
				input: ['N'],
				abilityType: 'normal',
				conditions: { type: 'state', state: 'nightsoulBlessing' },
				infusion: 'pyro',
				hits: [{ frames: { swap: 8 } }]
			} as Ability,
			{
				id: 'variantstub__skill__cast',
				name: 'Cast',
				input: ['E'],
				abilityType: 'skill',
				behavior: 'instant',
				frames: { swap: 30 },
				cooldown: 10,
				variants: [
					{
						label: 'Hold (Bike)',
						input: ['hE'],
						frames: { swap: 40 },
						behavior: 'stance',
						duration: 8,
						terminatesOnSwap: true,
						opensState: 'nightsoulBlessing'
					}
				]
			} as Ability,
			{
				id: 'variantstub__burst__cast',
				name: 'Burst',
				input: ['Q'],
				abilityType: 'burst',
				behavior: 'instant',
				frames: { swap: 60 },
				cooldown: 15,
				energyCost: 60
			} as Ability
		],
		passives: [],
		constellations: []
	} as CharacterData;
	const lookup = (n: string): CharacterData | null => (n === 'VStub' ? stub : null);

	it('Tap E (base) does NOT open Nightsoul Blessing', () => {
		// Base skill is instant; pressing E then N should resolve the BASE normal,
		// not the bike normal gated on nightsoulBlessing.
		const result = parseNotation('VStub E N1', lookup, 8);
		const track = result.tracks.find((t) => t.characterId === 'variantstub')!;
		const nBlock = track.inputBlocks.find((b) => b.parts[0] === 'N1');
		expect(nBlock?.kind).toBe('normal');
	});

	it('Hold E (variant) opens the bike-NS window and routes N to the in-stance variant', () => {
		// Variant overrides behavior → stance and opensState → nightsoulBlessing.
		// The N after hE should resolve to the in-stance Bike N (pyro infusion → elemental-normal).
		const result = parseNotation('VStub hE N1', lookup, 8);
		const track = result.tracks.find((t) => t.characterId === 'variantstub')!;
		const nBlock = track.inputBlocks.find((b) => b.parts[0] === 'N1');
		expect(nBlock?.kind).toBe('elemental-normal');
	});

	it('Hold E with terminatesOnSwap: true closes the stance on character swap', () => {
		// After hE opens the bike-NS, swap to another character and back. The
		// re-entered VStub should NOT have nightsoulBlessing active — pressing N1
		// resolves to the base normal again.
		const result = parseNotation('VStub hE > VStub N1', lookup, 8);
		const track2 = result.tracks[1];
		const nBlock = track2.inputBlocks.find((b) => b.parts[0] === 'N1');
		expect(nBlock?.kind).toBe('normal');
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

describe('evalCondition — enemyHpBelow (planner cannot simulate enemy HP)', () => {
	it('returns null for a bare enemyHpBelow condition (renders optimistically)', () => {
		const result = evalCondition({ type: 'enemyHpBelow', threshold: 50 }, 4);
		expect(result).toBeNull();
	});

	it('any-branch propagates null when only enemyHpBelow gates a clause', () => {
		// any: [false, null] → null (could become true if HP drops); matches the
		// existing null-propagation semantics used elsewhere in the planner.
		const result = evalCondition(
			{
				type: 'any',
				conditions: [
					{ type: 'ascension', min: 99 },
					{ type: 'enemyHpBelow', threshold: 30 }
				]
			},
			4
		);
		expect(result).toBeNull();
	});

	it('all-branch returns false when a sibling condition is decisively false', () => {
		// all: [false, null] → false (the false sibling decides), matches existing
		// short-circuit semantics — proves enemyHpBelow doesn't accidentally
		// upgrade null-handling to "always allow".
		const result = evalCondition(
			{
				type: 'all',
				conditions: [
					{ type: 'ascension', min: 99 },
					{ type: 'enemyHpBelow', threshold: 50 }
				]
			},
			4
		);
		expect(result).toBe(false);
	});
});

describe('evalCondition — enemyAffectedBy (planner cannot simulate aura state)', () => {
	it('returns null for a bare enemyAffectedBy condition', () => {
		const result = evalCondition({ type: 'enemyAffectedBy', element: 'cryo' }, 4);
		expect(result).toBeNull();
	});

	it('all-branch with enemyAffectedBy + a true sibling resolves null (cannot prove the aura)', () => {
		// all: [true, null] → null. The planner can't decide; renderer treats as
		// optimistic (gated effect renders with caveat).
		const result = evalCondition(
			{
				type: 'all',
				conditions: [
					{ type: 'ascension', min: 4 },
					{ type: 'enemyAffectedBy', element: 'electro' }
				]
			},
			4
		);
		expect(result).toBeNull();
	});
});

describe('evalCondition — teamFaction runtime resolution', () => {
	it('returns null when no teamFactionCounts context is provided', () => {
		const result = evalCondition({ type: 'teamFaction', faction: 'moonsign', min: 2 }, 4);
		expect(result).toBeNull();
	});

	it('returns true when count meets the minimum', () => {
		const counts = new Map([['moonsign', 2]]);
		const result = evalCondition(
			{ type: 'teamFaction', faction: 'moonsign', min: 2 },
			4,
			undefined,
			undefined,
			undefined,
			undefined,
			{ teamFactionCounts: counts }
		);
		expect(result).toBe(true);
	});

	it('returns false when count is below the minimum', () => {
		const counts = new Map([['moonsign', 1]]);
		const result = evalCondition(
			{ type: 'teamFaction', faction: 'moonsign', min: 2 },
			4,
			undefined,
			undefined,
			undefined,
			undefined,
			{ teamFactionCounts: counts }
		);
		expect(result).toBe(false);
	});

	it('returns false when faction is absent from the map', () => {
		const counts = new Map<string, number>();
		const result = evalCondition(
			{ type: 'teamFaction', faction: 'hexerei', min: 2 },
			4,
			undefined,
			undefined,
			undefined,
			undefined,
			{ teamFactionCounts: counts }
		);
		expect(result).toBe(false);
	});

	it('combines correctly inside an `all` compound', () => {
		const counts = new Map([['moonsign', 2]]);
		const result = evalCondition(
			{
				type: 'all',
				conditions: [
					{ type: 'teamFaction', faction: 'moonsign', min: 2 },
					{ type: 'constellation', level: 6 }
				]
			},
			4,
			undefined,
			6,
			undefined,
			undefined,
			{ teamFactionCounts: counts }
		);
		expect(result).toBe(true);
	});
});

describe('evalCondition — activeCharFaction (per-segment receiver routing)', () => {
	it('returns null when no activeCharFactions context is provided', () => {
		const result = evalCondition({ type: 'activeCharFaction', faction: 'moonsign' }, 4);
		expect(result).toBeNull();
	});

	it('returns true when the receiver belongs to the named faction', () => {
		const result = evalCondition(
			{ type: 'activeCharFaction', faction: 'moonsign' },
			4,
			undefined,
			undefined,
			undefined,
			undefined,
			{ activeCharFactions: new Set(['moonsign']) }
		);
		expect(result).toBe(true);
	});

	it('returns false when the receiver does not belong to the faction', () => {
		const result = evalCondition(
			{ type: 'activeCharFaction', faction: 'moonsign' },
			4,
			undefined,
			undefined,
			undefined,
			undefined,
			{ activeCharFactions: new Set(['natlan']) }
		);
		expect(result).toBe(false);
	});

	it('returns false when the receiver has no factions at all', () => {
		const result = evalCondition(
			{ type: 'activeCharFaction', faction: 'moonsign' },
			4,
			undefined,
			undefined,
			undefined,
			undefined,
			{ activeCharFactions: new Set() }
		);
		expect(result).toBe(false);
	});

	it('inverts correctly under `not` (Linnea A4 self-routing branch)', () => {
		const ctx = { activeCharFactions: new Set(['natlan']) };
		const result = evalCondition(
			{ type: 'not', condition: { type: 'activeCharFaction', faction: 'moonsign' } },
			4,
			undefined,
			undefined,
			undefined,
			undefined,
			ctx
		);
		expect(result).toBe(true);
	});
});

describe('evalCondition — negatedStates (off-field/on-field gating)', () => {
	it('returns false when state is in negatedStates', () => {
		const result = evalCondition(
			{ type: 'state', state: 'offField' },
			4,
			new Set(['onField']),
			0,
			undefined,
			undefined,
			{ negatedStates: new Set(['offField']) }
		);
		expect(result).toBe(false);
	});

	it('returns true when state is in resolvedStates (negatedStates ignored if other side asserted)', () => {
		const result = evalCondition(
			{ type: 'state', state: 'offField' },
			4,
			new Set(['offField']),
			0,
			undefined,
			undefined,
			{ negatedStates: new Set(['onField']) }
		);
		expect(result).toBe(true);
	});

	it('returns null when state is in neither set (preserves existing semantics)', () => {
		const result = evalCondition(
			{ type: 'state', state: 'duringSummon' },
			4,
			new Set(),
			0,
			undefined,
			undefined,
			{ negatedStates: new Set(['offField']) }
		);
		expect(result).toBeNull();
	});

	it('combines correctly: not(offField) is true when offField is negated', () => {
		const result = evalCondition(
			{ type: 'not', condition: { type: 'state', state: 'offField' } },
			4,
			new Set(['onField']),
			0,
			undefined,
			undefined,
			{ negatedStates: new Set(['offField']) }
		);
		expect(result).toBe(true);
	});
});
