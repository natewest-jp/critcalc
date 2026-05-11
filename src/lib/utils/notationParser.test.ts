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
import yumemizukiJson from '$lib/data/characters/yumemizuki_mizuki.json';
import colleiJson from '$lib/data/characters/collei.json';
import linneaForTest from '$lib/data/characters/linnea.json';
import flinsForTest from '$lib/data/characters/flins.json';

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

	it('camelCase keys (e.g. {coldDish:5}) tokenize and apply correctly', () => {
		// Path B / authoring convention uses camelCase identifiers (coldDish,
		// huntersExperience) consistent with the rest of the codebase. The
		// tokenizer must accept them; the asserted value lands on stackState
		// under the same key the consumer reads from.
		const result = parseNotation('Stub {coldDish:5} E', lookup, 8);
		const track = result.tracks.find((t) => t.characterId === 'stackstub')!;
		expect(track.eBars).toHaveLength(1);
		expect(track.eBars[0].stackContext?.get('coldDish')).toBe(5);
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

describe('parseNotation — gainStacks effect (E3 v1)', () => {
	// Synthetic character with `gainStacks` on a C1 constellation node:
	// each E cast grants 6 fieldCatalog stacks, max 18. Models the Linnea C1
	// shape directly: the gainStacks effect lives on the constellation, gated
	// on `constellation: 1`, with `trigger: { type: 'onCast', ability: 'skill' }`.
	const stub: CharacterData = {
		id: 'gainstub',
		name: 'GainStub',
		displayName: 'GainStub',
		element: 'geo',
		weapon: 'sword',
		gender: 'Female',
		affiliation: 'Test',
		region: 'Test',
		rarity: 5,
		abilities: [
			{
				id: 'gainstub__normal__attack',
				name: 'Attack',
				input: ['N'],
				abilityType: 'normal',
				hits: [{ frames: { swap: 10 } }]
			} as Ability,
			{
				id: 'gainstub__skill__cast',
				name: 'Cast',
				input: ['E'],
				abilityType: 'skill',
				behavior: 'instant',
				frames: { swap: 30 },
				cooldown: 5
			} as Ability,
			{
				id: 'gainstub__burst__cast',
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
		constellations: [
			{
				id: 'gainstub__constellation__c1',
				name: 'C1',
				abilityType: 'constellation',
				constellationLevel: 1,
				effects: [
					{
						type: 'gainStacks',
						target: 'self',
						trigger: { type: 'onCast', ability: 'skill' },
						conditions: { type: 'constellation', level: 1 },
						key: 'fieldCatalog',
						amount: 6,
						max: 18
					}
				]
			} as unknown as Ability
		]
	} as CharacterData;
	const lookup = (n: string): CharacterData | null => (n === 'GainStub' ? stub : null);

	it('without C1, E cast does not accrue stacks', () => {
		const result = parseNotation('GainStub E', lookup, 8);
		const track = result.tracks.find((t) => t.characterId === 'gainstub')!;
		expect(track.eBars).toHaveLength(1);
		expect(track.eBars[0].stackContext).toBeUndefined();
	});

	it('at C1, a single E grants 6 stacks (post-grant snapshot on the bar)', () => {
		const result = parseNotation('GainStub E', lookup, 8, { gainstub: 1 });
		const track = result.tracks.find((t) => t.characterId === 'gainstub')!;
		expect(track.eBars[0].stackContext?.get('fieldCatalog')).toBe(6);
	});

	it('successive casts accumulate cumulatively and saturate at max', () => {
		const result = parseNotation('GainStub E E E E', lookup, 8, { gainstub: 1 });
		const track = result.tracks.find((t) => t.characterId === 'gainstub')!;
		expect(track.eBars).toHaveLength(4);
		expect(track.eBars[0].stackContext?.get('fieldCatalog')).toBe(6);
		expect(track.eBars[1].stackContext?.get('fieldCatalog')).toBe(12);
		expect(track.eBars[2].stackContext?.get('fieldCatalog')).toBe(18);
		expect(track.eBars[3].stackContext?.get('fieldCatalog')).toBe(18);
	});

	it('stack state resets across segments (per-character per-segment scope)', () => {
		// Segment 1: 2 E casts → 12 stacks. Segment 2 (same char after swap-out):
		// stackState clears, first E grants only 6.
		const result = parseNotation('GainStub E E > GainStub E', lookup, 8, { gainstub: 1 });
		expect(result.tracks).toHaveLength(2);
		const seg1 = result.tracks[0];
		const seg2 = result.tracks[1];
		expect(seg1.eBars[1].stackContext?.get('fieldCatalog')).toBe(12);
		expect(seg2.eBars[0].stackContext?.get('fieldCatalog')).toBe(6);
	});

	it('does not fire on Q cast (trigger.ability gates skill-only)', () => {
		const result = parseNotation('GainStub Q', lookup, 8, { gainstub: 1 });
		const track = result.tracks.find((t) => t.characterId === 'gainstub')!;
		expect(track.qBars).toHaveLength(1);
		expect(track.qBars[0].stackContext).toBeUndefined();
	});

	it('composes with {key:N} assertions: assertion adds to gainStacks accrual', () => {
		// Assertion sets fieldCatalog=10 BEFORE the cast; gainStacks adds 6,
		// landing at 16 (within cap). Tests that the two stack mechanisms
		// share a single per-segment stackState (no separate buckets).
		const result = parseNotation('GainStub {fieldCatalog:10} E', lookup, 8, { gainstub: 1 });
		const track = result.tracks.find((t) => t.characterId === 'gainstub')!;
		expect(track.eBars[0].stackContext?.get('fieldCatalog')).toBe(16);
	});
});

describe('parseNotation — gainStacks drain (E3 v2)', () => {
	// Synthetic Iansan-shape character: skill opens `nightsoulBlessing` for 10s
	// and grants 50 resource with drain 5/sec while NS active; burst grants +10
	// resource (no drain field — convention: drain declared on the first
	// gainStacks effect that introduces the key). Round numbers chosen so the
	// expected snapshots are easy to verify.
	const drainStub: CharacterData = {
		id: 'drainstub',
		name: 'DrainStub',
		displayName: 'DrainStub',
		element: 'electro',
		weapon: 'polearm',
		gender: 'Female',
		affiliation: 'Test',
		region: 'Test',
		rarity: 5,
		abilities: [
			{
				id: 'drainstub__normal__attack',
				name: 'Attack',
				input: ['N'],
				abilityType: 'normal',
				hits: [{ frames: { swap: 10 } }]
			} as Ability,
			{
				id: 'drainstub__skill__cast',
				name: 'Skill',
				input: ['E'],
				abilityType: 'skill',
				behavior: 'stance',
				duration: 10,
				opensState: 'nightsoulBlessing',
				terminatesOnSwap: false,
				frames: { swap: 60 },
				cooldown: 20,
				effects: [
					{
						type: 'gainStacks',
						target: 'self',
						trigger: { type: 'onCast', ability: 'skill' },
						key: 'resource',
						amount: 50,
						max: 50,
						drain: { ratePerSecond: 5, state: 'nightsoulBlessing' }
					}
				]
			} as unknown as Ability,
			{
				id: 'drainstub__burst__cast',
				name: 'Burst',
				input: ['Q'],
				abilityType: 'burst',
				behavior: 'instant',
				frames: { swap: 60 },
				cooldown: 15,
				energyCost: 60,
				effects: [
					{
						type: 'gainStacks',
						target: 'self',
						trigger: { type: 'onCast', ability: 'burst' },
						key: 'resource',
						amount: 10,
						max: 50
					}
				]
			} as unknown as Ability
		],
		passives: [],
		constellations: []
	} as CharacterData;
	const lookupDrain = (n: string): CharacterData | null => (n === 'DrainStub' ? drainStub : null);

	it('single E: full grant in the snapshot (state opens after the snapshot is taken)', () => {
		// applyDrain fires before dispatch and sees NS inactive (stance not yet
		// opened); dispatch adds 50 and anchors lastUpdate to the cast time.
		// Snapshot post-dispatch shows the pristine grant.
		const result = parseNotation('DrainStub E', lookupDrain, 8);
		const track = result.tracks.find((t) => t.characterId === 'drainstub')!;
		expect(track.eBars[0].stackContext?.get('resource')).toBe(50);
	});

	it('E then in-state Q: drain decays the resource between casts before the grant lands', () => {
		// E at t=0 (1s cast, stance opens 0..10 with NS active). ~5s wait → Q at
		// t=6. applyDrain at Q: state active, elapsed=6, decay=30 → resource=20.
		// Q grants +10 → 30 in the snapshot.
		const result = parseNotation('DrainStub E ~5s Q', lookupDrain, 8);
		const track = result.tracks.find((t) => t.characterId === 'drainstub')!;
		expect(track.eBars[0].stackContext?.get('resource')).toBe(50);
		expect(track.qBars[0].stackContext?.get('resource')).toBe(30);
	});

	it('Q after state has expired: settles drain to the state-end time, not the cast time', () => {
		// E at t=0 opens NS until t=10. ~12s skip → cursor=13. applyDrain at Q:
		// state inactive, lastUpdate=0, stateEnd=10, elapsed=10 → decay=50 →
		// resource=0 (saturated, never negative). Q grants +10 → 10.
		const result = parseNotation('DrainStub E ~12s Q', lookupDrain, 8);
		const track = result.tracks.find((t) => t.characterId === 'drainstub')!;
		expect(track.qBars[0].stackContext?.get('resource')).toBe(10);
	});

	it('re-cast E after state expires: prior anchor cleared, fresh grant from zero', () => {
		// E1 at t=0 (resource=50, anchor=0, NS to t=10). ~20s skip + E2 at t≈21.
		// applyDrain at E2: state inactive, settle drain → resource=0, anchor
		// cleared. dispatch +50 → 50 in the snapshot. Stance reopens.
		const result = parseNotation('DrainStub E ~20s E', lookupDrain, 8);
		const track = result.tracks.find((t) => t.characterId === 'drainstub')!;
		expect(track.eBars).toHaveLength(2);
		expect(track.eBars[1].stackContext?.get('resource')).toBe(50);
	});

	it('drain saturates at 0: extended in-state casts never push the resource negative', () => {
		// E at t=0, then a Q at t=11 (cooldowns permitting). state remained
		// active until t=10 — but cursor=12 (after 1s E cast + 11s wait).
		// applyDrain settles state-end decay (10s × 5 = 50) → resource clamped
		// to 0. Q +10 → 10. Confirms the saturation clause is doing real work.
		const result = parseNotation('DrainStub E ~11s Q', lookupDrain, 8);
		const track = result.tracks.find((t) => t.characterId === 'drainstub')!;
		expect(track.qBars[0].stackContext?.get('resource')).toBe(10);
	});

	it('drain spec absent: keys without a drain declaration are not decayed', () => {
		// Compact stub mirroring the v1 shape: skill grants +6 with no drain
		// field. Two E casts with a long gap should cumulate to 12 — confirms
		// the v2 drain machinery is a no-op for keys lacking a drain spec.
		const noDrainStub: CharacterData = {
			id: 'nodrain',
			name: 'NoDrain',
			displayName: 'NoDrain',
			element: 'geo',
			weapon: 'sword',
			gender: 'Female',
			affiliation: 'Test',
			region: 'Test',
			rarity: 5,
			abilities: [
				{
					id: 'nodrain__normal__attack',
					name: 'Attack',
					input: ['N'],
					abilityType: 'normal',
					hits: [{ frames: { swap: 10 } }]
				} as Ability,
				{
					id: 'nodrain__skill__cast',
					name: 'Skill',
					input: ['E'],
					abilityType: 'skill',
					behavior: 'instant',
					frames: { swap: 30 },
					cooldown: 5,
					effects: [
						{
							type: 'gainStacks',
							target: 'self',
							trigger: { type: 'onCast', ability: 'skill' },
							key: 'plain',
							amount: 6,
							max: 18
						}
					]
				} as unknown as Ability
			],
			passives: [],
			constellations: []
		} as CharacterData;
		const lookupNoDrain = (n: string): CharacterData | null =>
			n === 'NoDrain' ? noDrainStub : null;
		const result = parseNotation('NoDrain E ~20s E', lookupNoDrain, 8);
		const track = result.tracks.find((t) => t.characterId === 'nodrain')!;
		expect(track.eBars).toHaveLength(2);
		expect(track.eBars[0].stackContext?.get('plain')).toBe(6);
		expect(track.eBars[1].stackContext?.get('plain')).toBe(12);
	});
});

describe('parseNotation — gainStacks variant gating + consumeStacks (E3 v2.x)', () => {
	// Skirk-shape stub: skill has two `gainStacks` effects with mutually-exclusive
	// `trigger.input` filters (Tap-E grants 45, Hold-E grants 18). Burst has a
	// `consumeStacks` effect that zeroes the resource. Confirms variant-gated
	// dispatch and the post-snapshot consume ordering (bar reflects pre-consume
	// stackContext; stackState carries forward at zero).
	const skirkStub: CharacterData = {
		id: 'skirkstub',
		name: 'SkirkStub',
		displayName: 'SkirkStub',
		element: 'cryo',
		weapon: 'sword',
		gender: 'Female',
		affiliation: 'Test',
		region: 'Test',
		rarity: 5,
		abilities: [
			{
				id: 'skirkstub__normal__attack',
				name: 'Attack',
				input: ['N'],
				abilityType: 'normal',
				hits: [{ frames: { swap: 10 } }]
			} as Ability,
			{
				id: 'skirkstub__skill__warp',
				name: 'Warp',
				input: ['E'],
				abilityType: 'skill',
				behavior: 'instant',
				frames: { swap: 30 },
				cooldown: 8,
				variants: [
					{
						label: 'Hold',
						input: ['hE'],
						frames: { swap: 15 },
						behavior: 'instant'
					}
				],
				effects: [
					{
						type: 'gainStacks',
						target: 'self',
						trigger: { type: 'onCast', ability: 'skill', input: ['E'] },
						key: 'serpentsSubtlety',
						amount: 45,
						max: 100
					},
					{
						type: 'gainStacks',
						target: 'self',
						trigger: { type: 'onCast', ability: 'skill', input: ['hE'] },
						key: 'serpentsSubtlety',
						amount: 18,
						max: 100
					}
				]
			} as unknown as Ability,
			{
				id: 'skirkstub__burst__ruin',
				name: 'Ruin',
				input: ['Q'],
				abilityType: 'burst',
				behavior: 'instant',
				frames: { swap: 60 },
				cooldown: 15,
				energyCost: 50,
				effects: [
					{
						type: 'consumeStacks',
						target: 'self',
						trigger: { type: 'onCast', ability: 'burst' },
						key: 'serpentsSubtlety',
						amount: 'all'
					}
				]
			} as unknown as Ability
		],
		passives: [],
		constellations: []
	} as CharacterData;
	const lookup = (n: string): CharacterData | null => (n === 'SkirkStub' ? skirkStub : null);

	it('Tap-E grants 45 SS (input filter matches the base "E" token)', () => {
		const result = parseNotation('SkirkStub E', lookup, 8);
		const track = result.tracks.find((t) => t.characterId === 'skirkstub')!;
		expect(track.eBars[0].stackContext?.get('serpentsSubtlety')).toBe(45);
	});

	it('Hold-E grants 18 SS (input filter routes to the hE branch)', () => {
		const result = parseNotation('SkirkStub hE', lookup, 8);
		const track = result.tracks.find((t) => t.characterId === 'skirkstub')!;
		expect(track.eBars[0].stackContext?.get('serpentsSubtlety')).toBe(18);
	});

	it('mixed casts accumulate per-input grants: E hE → 63 SS', () => {
		// Tap-E (+45) then Hold-E (+18) → 63 in the second bar's snapshot.
		// Confirms both filters fire on their matching cast, neither on the other.
		const result = parseNotation('SkirkStub E hE', lookup, 8);
		const track = result.tracks.find((t) => t.characterId === 'skirkstub')!;
		expect(track.eBars[0].stackContext?.get('serpentsSubtlety')).toBe(45);
		expect(track.eBars[1].stackContext?.get('serpentsSubtlety')).toBe(63);
	});

	it('consumeStacks "all" zeroes resource AFTER snapshot: burst bar shows pre-consume value', () => {
		// E (+45) Q. The burst bar's stackContext should show 45 (pre-consume);
		// stackState clears to 0 after the cast. We can verify both: the bar
		// snapshot still reads 45, and a follow-up E adds 45 to the now-empty pool.
		const result = parseNotation('SkirkStub E Q', lookup, 8);
		const track = result.tracks.find((t) => t.characterId === 'skirkstub')!;
		expect(track.eBars[0].stackContext?.get('serpentsSubtlety')).toBe(45);
		expect(track.qBars[0].stackContext?.get('serpentsSubtlety')).toBe(45);
	});

	it('consumeStacks: post-consume state carries forward (next E grants from zero)', () => {
		// E (+45) Q (consume all → 0) E (+45 from empty). The second E bar should
		// show 45, not 90. Validates that the Q's consume mutated stackState even
		// though the bar's stackContext was a snapshot copy.
		const result = parseNotation('SkirkStub E Q E', lookup, 8);
		const track = result.tracks.find((t) => t.characterId === 'skirkstub')!;
		expect(track.eBars).toHaveLength(2);
		expect(track.qBars[0].stackContext?.get('serpentsSubtlety')).toBe(45);
		expect(track.eBars[1].stackContext?.get('serpentsSubtlety')).toBe(45);
	});

	it('consumeStacks does not fire when burst is omitted: SS persists across E casts', () => {
		// Two E casts in a row → 90 SS (no consume). Confirms the consume is
		// gated on burst-cast, not on cursor advance.
		const result = parseNotation('SkirkStub E E', lookup, 8);
		const track = result.tracks.find((t) => t.characterId === 'skirkstub')!;
		expect(track.eBars[1].stackContext?.get('serpentsSubtlety')).toBe(90);
	});
});

describe('parseNotation — consumeStacks numeric subtraction', () => {
	// Stub for the numeric (non-'all') branch of consumeStacks: each Q removes 5
	// stacks; saturates at 0 when below the consumption amount.
	const stub: CharacterData = {
		id: 'numstub',
		name: 'NumStub',
		displayName: 'NumStub',
		element: 'pyro',
		weapon: 'sword',
		gender: 'Female',
		affiliation: 'Test',
		region: 'Test',
		rarity: 5,
		abilities: [
			{
				id: 'numstub__normal__attack',
				name: 'Attack',
				input: ['N'],
				abilityType: 'normal',
				hits: [{ frames: { swap: 10 } }]
			} as Ability,
			{
				id: 'numstub__skill__cast',
				name: 'Skill',
				input: ['E'],
				abilityType: 'skill',
				behavior: 'instant',
				frames: { swap: 30 },
				cooldown: 5,
				effects: [
					{
						type: 'gainStacks',
						target: 'self',
						trigger: { type: 'onCast', ability: 'skill' },
						key: 'energy',
						amount: 3,
						max: 20
					}
				]
			} as unknown as Ability,
			{
				id: 'numstub__burst__cast',
				name: 'Burst',
				input: ['Q'],
				abilityType: 'burst',
				behavior: 'instant',
				frames: { swap: 60 },
				cooldown: 15,
				energyCost: 60,
				effects: [
					{
						type: 'consumeStacks',
						target: 'self',
						trigger: { type: 'onCast', ability: 'burst' },
						key: 'energy',
						amount: 5
					}
				]
			} as unknown as Ability
		],
		passives: [],
		constellations: []
	} as CharacterData;
	const lookup = (n: string): CharacterData | null => (n === 'NumStub' ? stub : null);

	it('numeric consume subtracts the literal amount and saturates at 0', () => {
		// 3× E (+9) → Q (consume 5 → 4) → E (+3 → 7) → Q (consume 5 → 2) → Q (consume 5 → 0, saturated).
		const result = parseNotation('NumStub E E E Q E Q Q', lookup, 8);
		const track = result.tracks.find((t) => t.characterId === 'numstub')!;
		expect(track.qBars).toHaveLength(3);
		// Snapshots are pre-consume:
		expect(track.qBars[0].stackContext?.get('energy')).toBe(9);
		expect(track.qBars[1].stackContext?.get('energy')).toBe(7);
		expect(track.qBars[2].stackContext?.get('energy')).toBe(2);
	});
});

describe('parseNotation — synthetic reaction emission (E3 v1.5)', () => {
	// Two-character lookup: a pyro applicator (Diluc) and an Anemo absorber
	// (Kazuha). Used for cold-start, anemo→anemo, and pyro→anemo cases without
	// needing synthetic stubs.
	const diluc = dilucJson as unknown as CharacterData;
	const lookupPyroAnemo = (n: string): CharacterData | null =>
		n === 'Diluc' ? diluc : n === 'Kazuha' ? kazuha : null;

	it('cold-start: solo Anemo char emits no reactions (no aura applied yet)', () => {
		// First character casts. No PHEC/dendro applicator has fired; the aura
		// set is empty. Anemo cast computes zero eligible reactions.
		const result = parseNotation('Kazuha E', lookupPyroAnemo, 8);
		expect(result.reactionEvents).toEqual([]);
	});

	it('Anemo → Anemo: neither cast emits reactions (no aura applicator)', () => {
		const result = parseNotation('Kazuha E > Kazuha Q', lookupPyroAnemo, 8);
		expect(result.reactionEvents).toEqual([]);
	});

	it('Pyro → Anemo: anemo cast emits swirl', () => {
		// Diluc E applies pyro; subsequent Kazuha cast emits swirl.
		const result = parseNotation('Diluc E > Kazuha E', lookupPyroAnemo, 8);
		// Diluc's E applies pyro to empty aura — no reaction emitted on his cast.
		// Kazuha's E sees pyro applied — emits swirl.
		const swirlEvents = result.reactionEvents.filter((ev) => ev.reaction === 'swirl');
		expect(swirlEvents).toHaveLength(1);
		expect(swirlEvents[0].characterId).toBe('kaedehara_kazuha');
	});

	it('Pyro → Pyro: second pyro cast does not react (same-element no-op)', () => {
		const result = parseNotation('Diluc E > Diluc Q', lookupPyroAnemo, 8);
		expect(result.reactionEvents).toEqual([]);
	});
});

describe('parseNotation — Mizuki A1 stance extension (E3 v1.5)', () => {
	const mizuki = yumemizukiJson as unknown as CharacterData;
	const diluc = dilucJson as unknown as CharacterData;
	const lookup = (n: string): CharacterData | null =>
		n === 'Yumemizuki Mizuki' ? mizuki : n === 'Diluc' ? diluc : null;

	it('cold-start Mizuki E: no swirl, stance bar at base 5s', () => {
		// No prior aura applicator → no swirl emitted → no extension fires.
		const result = parseNotation('Yumemizuki Mizuki E', lookup, 8);
		const track = result.tracks.find((t) => t.characterId === 'yumemizuki_mizuki')!;
		expect(track.eBars).toHaveLength(1);
		expect(track.eBars[0].uptime).toBeCloseTo(5, 2);
	});

	it('after Pyro applicator, Mizuki E swirls and extends stance by +2.5s', () => {
		// Diluc E applies pyro; Mizuki E swirls, A1 fires once → +2.5s extension.
		const result = parseNotation('Diluc E > Yumemizuki Mizuki E', lookup, 8);
		const track = result.tracks.find((t) => t.characterId === 'yumemizuki_mizuki')!;
		expect(track.eBars[0].uptime).toBeCloseTo(5 + 2.5, 2);
	});

	it('Pyro → Mizuki E Q: max 2 extensions reached (+5s total)', () => {
		// E swirl fires once (+2.5s); Q cast also anemo → another swirl event,
		// 0.3s ICD passes (E cast is ~0.5s long), so Q's swirl fires the
		// second extension (+2.5s more = +5s total, the in-game cap).
		const result = parseNotation('Diluc E > Yumemizuki Mizuki E Q', lookup, 8);
		const track = result.tracks.find((t) => t.characterId === 'yumemizuki_mizuki')!;
		expect(track.eBars[0].uptime).toBeCloseTo(5 + 5, 2);
	});

	it('Anemo only (no aura applicator): Mizuki E does not extend its own stance', () => {
		// Just to confirm cold-start guard at the stance owner — no swirl fires.
		const result = parseNotation('Yumemizuki Mizuki E Q', lookup, 8);
		const track = result.tracks.find((t) => t.characterId === 'yumemizuki_mizuki')!;
		expect(track.eBars[0].uptime).toBeCloseTo(5, 2);
	});
});

describe('parseNotation — Collei A4 summon extension (E3 v1.5)', () => {
	const collei = colleiJson as unknown as CharacterData;
	const diluc = dilucJson as unknown as CharacterData;
	const lookup = (n: string): CharacterData | null =>
		n === 'Collei' ? collei : n === 'Diluc' ? diluc : null;

	it('cold-start Collei Q: no dendro reaction, zone at base 6s', () => {
		const result = parseNotation('Collei Q', lookup, 8);
		const track = result.tracks.find((t) => t.characterId === 'collei')!;
		expect(track.qBars).toHaveLength(1);
		expect(track.qBars[0].uptime).toBeCloseTo(6, 2);
	});

	it('after Pyro applicator, Collei Q triggers burning and zone extends +1s', () => {
		// Diluc E pyro → Collei Q dendro on pyro → burning emitted → +1s zone.
		const result = parseNotation('Diluc E > Collei Q', lookup, 8);
		const track = result.tracks.find((t) => t.characterId === 'collei')!;
		expect(track.qBars[0].uptime).toBeCloseTo(6 + 1, 2);
	});
});

describe('parseNotation — bloom core lifecycle (E3 v1.5)', () => {
	// Use existing characters whose elements drive the lifecycle:
	// Diluc (pyro) for aura, Collei (dendro) for bloom + as a hyperbloom proxy
	// is actually electro... we need an electro char. Let's use Cyno.
	const collei = colleiJson as unknown as CharacterData;
	const cyno = cynoJson as unknown as CharacterData;
	// Build a synthetic hydro stub for the "apply hydro" step.
	const hydroStub: CharacterData = {
		id: 'hydrostub',
		name: 'HStub',
		displayName: 'HStub',
		element: 'hydro',
		weapon: 'sword',
		gender: 'Female',
		affiliation: 'Test',
		region: 'Test',
		rarity: 5,
		abilities: [
			{
				id: 'hydrostub__skill__cast',
				name: 'Cast',
				input: ['E'],
				abilityType: 'skill',
				behavior: 'instant',
				frames: { swap: 30 },
				cooldown: 5
			} as Ability
		],
		passives: [],
		constellations: []
	} as CharacterData;
	const lookup = (n: string): CharacterData | null =>
		n === 'HStub' ? hydroStub : n === 'Collei' ? collei : n === 'Cyno' ? cyno : null;

	it('hydro → dendro forms bloom (no extension on cold-start hydro)', () => {
		// HStub E (hydro, cold-start, no reaction) → Collei Q (dendro on hydro
		// → bloom emitted, zone extends).
		const result = parseNotation('HStub E > Collei Q', lookup, 8);
		const bloomEvents = result.reactionEvents.filter((ev) => ev.reaction === 'bloom');
		expect(bloomEvents).toHaveLength(1);
		expect(bloomEvents[0].characterId).toBe('collei');
	});

	it('hydro → dendro → electro fires hyperbloom (consumes core)', () => {
		// HStub E (hydro applied) → Collei E (dendro+hydro=bloom, push core) →
		// Cyno E (electro on bloomCore → hyperbloom).
		const result = parseNotation('HStub E > Collei E > Cyno E', lookup, 8);
		const hyper = result.reactionEvents.filter((ev) => ev.reaction === 'hyperbloom');
		expect(hyper).toHaveLength(1);
		expect(hyper[0].characterId).toBe('cyno');
	});
});

describe('parseNotation — lunarCrystallize gating (E3 v1.5)', () => {
	// Linnea is geo + Moonsign. With 1 Moonsign in the team, lunarCrystallize
	// does NOT emit. With 2+ Moonsign chars in the team, it does.
	const linnea = linneaForTest as unknown as CharacterData;
	const flins = flinsForTest as unknown as CharacterData;
	const diluc = dilucJson as unknown as CharacterData;
	const lookup = (n: string): CharacterData | null => {
		if (n === 'Linnea') return linnea;
		if (n === 'Flins') return flins;
		if (n === 'Diluc') return diluc;
		return null;
	};

	it('solo Moonsign (1) + pyro applicator: geo cast emits crystallize but NOT lunarCrystallize', () => {
		const result = parseNotation('Diluc E > Linnea E', lookup, 8);
		const reactionsByType = new Set(result.reactionEvents.map((ev) => ev.reaction));
		expect(reactionsByType.has('crystallize')).toBe(true);
		expect(reactionsByType.has('lunarCrystallize')).toBe(false);
	});

	it('two Moonsign + pyro applicator: geo cast emits both crystallize AND lunarCrystallize', () => {
		// Linnea + Flins are both Moonsign → 2-Moonsign team → lunarCrystallize gated open.
		const result = parseNotation('Diluc E > Linnea E > Flins E', lookup, 8);
		const linneaCrys = result.reactionEvents.filter(
			(ev) => ev.characterId === 'linnea' && ev.reaction === 'lunarCrystallize'
		);
		expect(linneaCrys.length).toBeGreaterThanOrEqual(1);
	});
});
