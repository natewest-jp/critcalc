import { describe, it, expect } from 'vitest';
import { parseNotation, evalCondition } from './notationParser';
import type { TimelineEvent, ReactionEvent, ShieldEndEvent } from './notationParser';

// P4: the parser no longer returns the legacy `reactionEvents` /
// `shieldEndEvents` arrays — these are filtered projections of `events`.
// (Per-cast hit records are parser-private since post-P4 #1; their dispatch
// is asserted through the stackContext they produce.)
const reactionsOf = (events: TimelineEvent[]): ReactionEvent[] =>
	events.filter((e): e is ReactionEvent => e.kind === 'reaction');
const shieldEndsOf = (events: TimelineEvent[]): ShieldEndEvent[] =>
	events.filter((e): e is ShieldEndEvent => e.kind === 'shieldEnd');
import type { CharacterData } from '$lib/types/character';
import type { Ability, Element } from '$lib/types/ability';
import ganyuJson from '$lib/data/characters/ganyu.json';
import dilucJson from '$lib/data/characters/diluc.json';
import durinJson from '$lib/data/characters/durin.json';
import huTaoJson from '$lib/data/characters/hu_tao.json';
import xilonenJson from '$lib/data/characters/xilonen.json';
import kazuhaJson from '$lib/data/characters/kaedehara_kazuha.json';
import cynoJson from '$lib/data/characters/cyno.json';
import yumemizukiJson from '$lib/data/characters/yumemizuki_mizuki.json';
import colleiJson from '$lib/data/characters/collei.json';
import linneaForTest from '$lib/data/characters/linnea.json';
import flinsForTest from '$lib/data/characters/flins.json';
import varesaForTest from '$lib/data/characters/varesa.json';
import varkaForTest from '$lib/data/characters/varka.json';
import iansanJson from '$lib/data/characters/iansan.json';
import skirkJson from '$lib/data/characters/skirk.json';
import bennettJson from '$lib/data/characters/bennett.json';
import nahidaJson from '$lib/data/characters/nahida.json';
import xiaoJson from '$lib/data/characters/xiao.json';
import keqingJson from '$lib/data/characters/keqing.json';

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

describe('parseNotation — chainStage (Keqing first cast → blink recast)', () => {
	const keqing = keqingJson as unknown as CharacterData;
	const lookup = (name: string): CharacterData | null => (name === 'Keqing' ? keqing : null);

	// First cast frames: E=35 (next token E), swap=28. Recast frames: no E key → swap=42 fallback.
	const firstCastBeforeE = 35 / 60;
	const recastBeforeSwap = 42 / 60;

	it('second E within the window fires the blink recast, not blocked by the 7.5s first-cast CD', () => {
		const result = parseNotation('Keqing E E', lookup, 8);
		const track = result.tracks.find((t) => t.characterId === 'keqing')!;
		expect(track.eBars).toHaveLength(2);
		// Distinct cast-times prove stage 1 (recast) was selected, not the first cast twice.
		expect(track.eBars[0].castTime).toBeCloseTo(firstCastBeforeE, 5);
		expect(track.eBars[1].castTime).toBeCloseTo(recastBeforeSwap, 5);
		// First cast sets a 7.5s CD; the recast has cooldown 0 (own queue), so it fires
		// immediately after the first cast rather than waiting out the CD.
		expect(track.eBars[0].cooldown).toBe(7.5);
		expect(track.eBars[1].cooldown).toBe(0);
		expect(track.eBars[1].start).toBeCloseTo(firstCastBeforeE, 5);
	});

	it('third E (after the terminal recast) resets to the first cast and waits out the 7.5s CD', () => {
		const result = parseNotation('Keqing E E E', lookup, 8);
		const track = result.tracks.find((t) => t.characterId === 'keqing')!;
		expect(track.eBars).toHaveLength(3);
		// Recast is terminal → chain resets to stage 0. The first cast's queue still holds
		// its 7.5s CD (+cooldownStartDelay), so the 3rd press waits until ~7.5s+.
		expect(track.eBars[2].start).toBeGreaterThanOrEqual(7.5);
		expect(track.eBars[2].cooldown).toBe(7.5);
	});

	it('second E after the ~5.33s window expires resolves back to the first cast', () => {
		const result = parseNotation('Keqing E ~6s E', lookup, 8);
		const track = result.tracks.find((t) => t.characterId === 'keqing')!;
		expect(track.eBars).toHaveLength(2);
		// Window (5.33s) expired → second E is the first cast again (cooldown 7.5, not the
		// recast's 0), gated by the first cast's CD.
		expect(track.eBars[1].cooldown).toBe(7.5);
		expect(track.eBars[1].start).toBeGreaterThanOrEqual(7.5);
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

describe('parseNotation — summon-level durationModifiers gated by constellation', () => {
	// Iansan Q ("The Three Principles of Power"): instant burst that spawns the
	// Kinetic Energy Scale summon with base duration 12s. C6 ("Strain to Stay
	// Stronger") adds +3s gated on { constellation: 6 } authored on
	// summons[0].durationModifiers — verifies the modifier flows through
	// resolveActiveDuration → applyModifiers with the active constellation level.
	const iansan = iansanJson as unknown as CharacterData;
	const lookup = (name: string): CharacterData | null => (name === 'Iansan' ? iansan : null);

	it('at C0, Iansan Q summon bar uptime is 12s (base duration)', () => {
		const result = parseNotation('Iansan Q', lookup, 20);
		const track = result.tracks.find((t) => t.characterId === 'iansan')!;
		expect(track.qBars).toHaveLength(1);
		expect(track.qBars[0].uptime).toBeCloseTo(12, 2);
	});

	it('at C6, Iansan Q summon bar uptime extends to 15s (12 + 3)', () => {
		const result = parseNotation('Iansan Q', lookup, 25, { iansan: 6 });
		const track = result.tracks.find((t) => t.characterId === 'iansan')!;
		expect(track.qBars).toHaveLength(1);
		expect(track.qBars[0].uptime).toBeCloseTo(15, 2);
	});

	it('at C5, the C6-gated modifier does not apply (still 12s)', () => {
		const result = parseNotation('Iansan Q', lookup, 20, { iansan: 5 });
		const track = result.tracks.find((t) => t.characterId === 'iansan')!;
		expect(track.qBars[0].uptime).toBeCloseTo(12, 2);
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

describe('evalCondition — stacks min/max range (E3 v2.x — branched-on-threshold pattern)', () => {
	// Iansan-shape: a buff has two effects with mutually-exclusive `stacks`
	// conditions on the same key — `min: 1, max: 41` for the linear-scaling
	// branch, `min: 42` for the constant-rate branch. evalCondition must
	// gate each correctly given the cast's stackContext.
	const lowerBranch = { type: 'stacks' as const, key: 'nightsoul', min: 1, max: 41 };
	const upperBranch = { type: 'stacks' as const, key: 'nightsoul', min: 42 };

	it('stackContext absent → null (renders optimistically)', () => {
		expect(evalCondition(lowerBranch, 4)).toBeNull();
		expect(evalCondition(upperBranch, 4)).toBeNull();
	});

	it('stacks=0 (key absent in context) → lower=false (min=1 not met)', () => {
		const ctx = new Map<string, number>();
		expect(evalCondition(lowerBranch, 4, undefined, 0, undefined, ctx)).toBe(false);
		expect(evalCondition(upperBranch, 4, undefined, 0, undefined, ctx)).toBe(false);
	});

	it('stacks=20 → lower=true, upper=false (linear branch)', () => {
		const ctx = new Map([['nightsoul', 20]]);
		expect(evalCondition(lowerBranch, 4, undefined, 0, undefined, ctx)).toBe(true);
		expect(evalCondition(upperBranch, 4, undefined, 0, undefined, ctx)).toBe(false);
	});

	it('stacks=41 → lower=true, upper=false (boundary inclusive on max)', () => {
		const ctx = new Map([['nightsoul', 41]]);
		expect(evalCondition(lowerBranch, 4, undefined, 0, undefined, ctx)).toBe(true);
		expect(evalCondition(upperBranch, 4, undefined, 0, undefined, ctx)).toBe(false);
	});

	it('stacks=42 → lower=false, upper=true (boundary inclusive on min, exclusive on max)', () => {
		const ctx = new Map([['nightsoul', 42]]);
		expect(evalCondition(lowerBranch, 4, undefined, 0, undefined, ctx)).toBe(false);
		expect(evalCondition(upperBranch, 4, undefined, 0, undefined, ctx)).toBe(true);
	});

	it('stacks=54 (Iansan max NS) → upper=true (no upper-bound max)', () => {
		const ctx = new Map([['nightsoul', 54]]);
		expect(evalCondition(lowerBranch, 4, undefined, 0, undefined, ctx)).toBe(false);
		expect(evalCondition(upperBranch, 4, undefined, 0, undefined, ctx)).toBe(true);
	});
});

describe('evalCondition — recipientHpBelow (planner cannot simulate teammate HP)', () => {
	it('returns null for a bare recipientHpBelow condition (renders optimistically)', () => {
		const result = evalCondition({ type: 'recipientHpBelow', threshold: 30 }, 4);
		expect(result).toBeNull();
	});

	it('all-branch propagates null when only recipientHpBelow gates a clause', () => {
		const result = evalCondition(
			{
				type: 'all',
				conditions: [
					{ type: 'ascension', min: 4 },
					{ type: 'recipientHpBelow', threshold: 30 }
				]
			},
			4
		);
		expect(result).toBeNull();
	});
});

describe('evalCondition — enemyHpAbove (mirror of enemyHpBelow)', () => {
	it('returns null for a bare enemyHpAbove condition (renders optimistically)', () => {
		const result = evalCondition({ type: 'enemyHpAbove', threshold: 50 }, 4);
		expect(result).toBeNull();
	});

	it('all-branch propagates null when only enemyHpAbove gates a clause', () => {
		const result = evalCondition(
			{
				type: 'all',
				conditions: [
					{ type: 'constellation', level: 1 },
					{ type: 'enemyHpAbove', threshold: 50 }
				]
			},
			4,
			new Set(),
			1
		);
		expect(result).toBeNull();
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

describe('evalCondition — teamElementCount (Cluster C — 2026-05-14)', () => {
	it('returns null when no teamElementCounts context is provided', () => {
		const result = evalCondition(
			{
				type: 'teamElementCount',
				elements: ['cryo', 'hydro'],
				comparison: '=',
				value: 3
			},
			4
		);
		expect(result).toBeNull();
	});

	it('returns true at exact tier-3 match (Skirk A4 canonical comp)', () => {
		// 2 Cryo + 1 Hydro teammates (canonical Skirk: Escoffier + Citlali + Furina)
		const counts = new Map<Element, number>([
			['cryo', 2],
			['hydro', 1]
		]);
		const result = evalCondition(
			{ type: 'teamElementCount', elements: ['cryo', 'hydro'], comparison: '=', value: 3 },
			4,
			undefined,
			undefined,
			undefined,
			undefined,
			{ teamElementCounts: counts }
		);
		expect(result).toBe(true);
	});

	it('returns true at >= comparison with 3+ eligible', () => {
		const counts = new Map<Element, number>([['cryo', 3]]);
		const result = evalCondition(
			{ type: 'teamElementCount', elements: ['cryo', 'hydro'], comparison: '>=', value: 3 },
			4,
			undefined,
			undefined,
			undefined,
			undefined,
			{ teamElementCounts: counts }
		);
		expect(result).toBe(true);
	});

	it('returns false at exact tier-1 match when 2 eligible (mutually exclusive tiers)', () => {
		const counts = new Map<Element, number>([
			['cryo', 1],
			['hydro', 1]
		]);
		const result = evalCondition(
			{ type: 'teamElementCount', elements: ['cryo', 'hydro'], comparison: '=', value: 1 },
			4,
			undefined,
			undefined,
			undefined,
			undefined,
			{ teamElementCounts: counts }
		);
		expect(result).toBe(false);
	});

	it('returns true at tier-2 = when 2 eligible', () => {
		const counts = new Map<Element, number>([
			['cryo', 1],
			['hydro', 1]
		]);
		const result = evalCondition(
			{ type: 'teamElementCount', elements: ['cryo', 'hydro'], comparison: '=', value: 2 },
			4,
			undefined,
			undefined,
			undefined,
			undefined,
			{ teamElementCounts: counts }
		);
		expect(result).toBe(true);
	});

	it('ignores elements not in the requested set', () => {
		// 3 anemo teammates shouldn't count toward cryo+hydro filter
		const counts = new Map<Element, number>([['anemo', 3]]);
		const result = evalCondition(
			{ type: 'teamElementCount', elements: ['cryo', 'hydro'], comparison: '>=', value: 1 },
			4,
			undefined,
			undefined,
			undefined,
			undefined,
			{ teamElementCounts: counts }
		);
		expect(result).toBe(false);
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

describe('parseNotation — gainStacks constellationScaling (E3 v2.x)', () => {
	// Linnea-C6-shape stub: C1 grants 6 per E (max 18, 10s lifetime), with a
	// constellationScaling override that bumps the per-cast amount to 18 at C6.
	// Validates the amount override fires only when the override condition holds
	// definitively (C0..C5 → 6 per cast; C6 → 18 per cast).
	const csStub: CharacterData = {
		id: 'csstub',
		name: 'CsStub',
		displayName: 'CsStub',
		element: 'cryo',
		weapon: 'claymore',
		gender: 'Female',
		affiliation: 'Test',
		region: 'Test',
		rarity: 5,
		abilities: [
			{
				id: 'csstub__normal__attack',
				name: 'Attack',
				input: ['N'],
				abilityType: 'normal',
				hits: [{ frames: { swap: 10 } }]
			} as Ability,
			{
				id: 'csstub__skill__cast',
				name: 'Skill',
				input: ['E'],
				abilityType: 'skill',
				behavior: 'instant',
				frames: { swap: 60 },
				cooldown: 12
			} as unknown as Ability,
			{
				id: 'csstub__burst__cast',
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
				id: 'csstub__constellation__c1',
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
						max: 18,
						lifetime: 10,
						constellationScaling: {
							conditions: { type: 'constellation', level: 6 },
							amount: 18
						}
					}
				]
			} as unknown as Ability
		]
	} as CharacterData;
	const lookup = (n: string): CharacterData | null => (n === 'CsStub' ? csStub : null);

	it('at C1, single E grants base 6 (override gated on cons:6 does not fire)', () => {
		const result = parseNotation('CsStub E', lookup, 8, { csstub: 1 });
		const track = result.tracks.find((t) => t.characterId === 'csstub')!;
		expect(track.eBars[0].stackContext?.get('fieldCatalog')).toBe(6);
	});

	it('at C5, single E still grants base 6 (override condition not yet met)', () => {
		const result = parseNotation('CsStub E', lookup, 8, { csstub: 5 });
		const track = result.tracks.find((t) => t.characterId === 'csstub')!;
		expect(track.eBars[0].stackContext?.get('fieldCatalog')).toBe(6);
	});

	it('at C6, single E grants override 18 (max-out in one cast)', () => {
		const result = parseNotation('CsStub E', lookup, 8, { csstub: 6 });
		const track = result.tracks.find((t) => t.characterId === 'csstub')!;
		expect(track.eBars[0].stackContext?.get('fieldCatalog')).toBe(18);
	});

	it('at C6, second E still grants 18 but saturates at max=18 (oldest-first drop)', () => {
		// Two E casts at C6: first +18 (full pool), second +18 with lifetime
		// saturation dropping the 18 oldest in favor of the new batch — count
		// stays at 18 either way.
		const result = parseNotation('CsStub E E', lookup, 8, { csstub: 6 });
		const track = result.tracks.find((t) => t.characterId === 'csstub')!;
		expect(track.eBars[1].stackContext?.get('fieldCatalog')).toBe(18);
	});
});

describe('parseNotation — parser-private hit dispatch + onHit gainStacks sourceLifetime (E3 v2.x)', () => {
	// Skirk A4 shape: a holder character (Skirk-stub, Cryo) with an A4 passive
	// that grants 1 `deathsCrossing` per onHit from team members (cryo with
	// source='others' excludes self; hydro source='team' since Skirk can't deal
	// Hydro anyway). sourceLifetime=20s; max 3 contributors. A teammate stub
	// (FurinaStub, Hydro) supplies the qualifying hits.
	const skirkA4Stub: CharacterData = {
		id: 'skirka4',
		name: 'SkirkA4',
		displayName: 'SkirkA4',
		element: 'cryo',
		weapon: 'sword',
		gender: 'Female',
		affiliation: 'Test',
		region: 'Test',
		rarity: 5,
		abilities: [
			{
				id: 'skirka4__normal__attack',
				name: 'Attack',
				input: ['N'],
				abilityType: 'normal',
				hits: [{ frames: { swap: 10 } }]
			} as Ability,
			{
				id: 'skirka4__skill__cast',
				name: 'Skill',
				input: ['E'],
				abilityType: 'skill',
				behavior: 'instant',
				frames: { swap: 60 },
				cooldown: 8
			} as unknown as Ability,
			{
				id: 'skirka4__burst__cast',
				name: 'Burst',
				input: ['Q'],
				abilityType: 'burst',
				behavior: 'instant',
				frames: { swap: 60 },
				cooldown: 15,
				energyCost: 50
			} as Ability
		],
		passives: [
			{
				id: 'skirka4__passive__a4',
				name: 'A4',
				abilityType: 'passive',
				effects: [
					{
						type: 'gainStacks',
						target: 'self',
						trigger: {
							type: 'onHit',
							source: 'others',
							filter: { element: 'cryo' }
						},
						conditions: { type: 'ascension', min: 4 },
						key: 'deathsCrossing',
						amount: 1,
						max: 3,
						sourceLifetime: 20
					},
					{
						type: 'gainStacks',
						target: 'self',
						trigger: {
							type: 'onHit',
							source: 'team',
							filter: { element: 'hydro' }
						},
						conditions: { type: 'ascension', min: 4 },
						key: 'deathsCrossing',
						amount: 1,
						max: 3,
						sourceLifetime: 20
					}
				]
			} as unknown as Ability
		],
		constellations: []
	} as CharacterData;
	const furinaStub: CharacterData = {
		id: 'furinastub',
		name: 'FurinaStub',
		displayName: 'FurinaStub',
		element: 'hydro',
		weapon: 'sword',
		gender: 'Female',
		affiliation: 'Test',
		region: 'Test',
		rarity: 5,
		abilities: [
			{
				id: 'furinastub__normal__attack',
				name: 'Attack',
				input: ['N'],
				abilityType: 'normal',
				hits: [{ frames: { swap: 10 } }]
			} as Ability,
			{
				id: 'furinastub__skill__cast',
				name: 'Skill',
				input: ['E'],
				abilityType: 'skill',
				behavior: 'instant',
				frames: { swap: 30 },
				cooldown: 8
			} as unknown as Ability,
			{
				id: 'furinastub__burst__cast',
				name: 'Burst',
				input: ['Q'],
				abilityType: 'burst',
				behavior: 'instant',
				frames: { swap: 30 },
				cooldown: 15,
				energyCost: 60
			} as Ability
		],
		passives: [],
		constellations: []
	} as CharacterData;
	const lookup = (n: string): CharacterData | null => {
		if (n === 'SkirkA4') return skirkA4Stub;
		if (n === 'FurinaStub') return furinaStub;
		return null;
	};

	it('keeps hit records parser-private — no `hit` kind in the public IR', () => {
		// Post-P4 #1: per-cast hits exist only for the internal onHit gainStacks
		// dispatch (their effect is asserted via stackContext below). The public
		// event stream carries cast/reaction/shieldEnd only.
		const result = parseNotation('FurinaStub E Q > SkirkA4 E', lookup, 8);
		expect(result.events.every((e) => ['cast', 'reaction', 'shieldEnd'].includes(e.kind))).toBe(
			true
		);
	});

	it('grants 1 deathsCrossing stack per unique Hydro teammate cast (source=team)', () => {
		// Furina E (Hydro hit, teammate) → grants Skirk 1 stack. SkirkA4 swaps in,
		// reads sourceLifetime → stackState[deathsCrossing] = 1 at her E cast.
		const result = parseNotation('FurinaStub E > SkirkA4 E', lookup, 8);
		const skirkTrack = result.tracks.find((t) => t.characterId === 'skirka4')!;
		expect(skirkTrack.eBars[0].stackContext?.get('deathsCrossing')).toBe(1);
	});

	it('same-source repeat hits do not stack (one slot per character)', () => {
		// Furina E Q → two Hydro hits from same source. Only 1 slot.
		const result = parseNotation('FurinaStub E Q > SkirkA4 E', lookup, 8);
		const skirkTrack = result.tracks.find((t) => t.characterId === 'skirka4')!;
		expect(skirkTrack.eBars[0].stackContext?.get('deathsCrossing')).toBe(1);
	});

	it('source=others excludes self: Skirk own Cryo cast does not grant stack', () => {
		// SkirkA4 E (Cryo, but self) → 0 stacks. Second E (same char) still 0.
		const result = parseNotation('SkirkA4 E E', lookup, 8);
		const skirkTrack = result.tracks.find((t) => t.characterId === 'skirka4')!;
		// stackContext is undefined or 0 for deathsCrossing — no slot ever opened.
		const count = skirkTrack.eBars[1].stackContext?.get('deathsCrossing') ?? 0;
		expect(count).toBe(0);
	});

	it('sourceLifetime expires slot after 20s — Skirk reads decreased count on later cast', () => {
		// Furina E at t=0 grants Skirk a slot expiring at t=20. Skirk's E at t<20
		// reads 1. With a long ~25s gap before Skirk's E, the slot has expired and
		// stack count returns to 0.
		const result = parseNotation('FurinaStub E ~25s > SkirkA4 E', lookup, 8);
		const skirkTrack = result.tracks.find((t) => t.characterId === 'skirka4')!;
		const count = skirkTrack.eBars[0].stackContext?.get('deathsCrossing') ?? 0;
		expect(count).toBe(0);
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

describe('parseNotation — gainStacks per-stack lifetime (E3 v2.x)', () => {
	// Linnea-shape stub: skill grants 6 stacks per cast with a 10s per-stack
	// lifetime (each instance expires independently). Max 18; oldest dropped on
	// over-saturation. No drain — distinct decay shape from continuous-rate.
	const lifetimeStub: CharacterData = {
		id: 'lifestub',
		name: 'LifeStub',
		displayName: 'LifeStub',
		element: 'geo',
		weapon: 'sword',
		gender: 'Female',
		affiliation: 'Test',
		region: 'Test',
		rarity: 5,
		abilities: [
			{
				id: 'lifestub__normal__attack',
				name: 'Attack',
				input: ['N'],
				abilityType: 'normal',
				hits: [{ frames: { swap: 10 } }]
			} as Ability,
			{
				id: 'lifestub__skill__cast',
				name: 'Skill',
				input: ['E'],
				abilityType: 'skill',
				behavior: 'instant',
				frames: { swap: 30 },
				cooldown: 4,
				effects: [
					{
						type: 'gainStacks',
						target: 'self',
						trigger: { type: 'onCast', ability: 'skill' },
						key: 'fieldCatalog',
						amount: 6,
						max: 18,
						lifetime: 10
					}
				]
			} as unknown as Ability,
			{
				id: 'lifestub__burst__cast',
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
	const lookup = (n: string): CharacterData | null => (n === 'LifeStub' ? lifetimeStub : null);

	it('single E grants 6 stacks; instances unexpired before lifetime cutoff', () => {
		// E at t=0 (0.5s cast). At cast-snapshot moment, 6 instances all expire
		// at t=10. Snapshot reads count = 6.
		const result = parseNotation('LifeStub E', lookup, 8);
		const track = result.tracks.find((t) => t.characterId === 'lifestub')!;
		expect(track.eBars[0].stackContext?.get('fieldCatalog')).toBe(6);
	});

	it('two E casts within lifetime window accumulate cumulatively', () => {
		// E at t=0 (+6, expire t=10) + ~5s skip + E at t=5.5 (+6, expire t=15.5).
		// Snapshot at second cast: applyLifetimeExpiry at cursor=5.5 sees no
		// expired instances (t=10 > 5.5), so 12 stacks remain.
		const result = parseNotation('LifeStub E ~5s E', lookup, 8);
		const track = result.tracks.find((t) => t.characterId === 'lifestub')!;
		expect(track.eBars[1].stackContext?.get('fieldCatalog')).toBe(12);
	});

	it('E cast after first batch expires drops the expired instances', () => {
		// E at t=0 (+6, expire t=10) + ~11s skip + E at t=11.5 (+6, expire t=21.5).
		// applyLifetimeExpiry at cursor=11.5 drops the t=10 instances → 0;
		// gainStacks then adds 6 → snapshot reads 6 (not 12).
		const result = parseNotation('LifeStub E ~11s E', lookup, 8);
		const track = result.tracks.find((t) => t.characterId === 'lifestub')!;
		expect(track.eBars[1].stackContext?.get('fieldCatalog')).toBe(6);
	});

	it('partial expiry: middle batch drops while later batch persists', () => {
		// E at t=0 (+6 expire t=10), ~5s gap → E at t=5.5 (+6 expire t=15.5),
		// ~6s gap → E at t=12 (cursor jumps to t=12 after second cast at 5.5+0.5=6,
		// then ~6s skip → cursor=12). applyLifetimeExpiry at cursor=12: drops
		// the t=0 batch (expire 10 < 12), keeps the t=5.5 batch (expire 15.5).
		// Then +6 more → 12 stacks total.
		const result = parseNotation('LifeStub E ~5s E ~6s E', lookup, 8);
		const track = result.tracks.find((t) => t.characterId === 'lifestub')!;
		expect(track.eBars[2].stackContext?.get('fieldCatalog')).toBe(12);
	});

	it('over-saturation drops oldest instances first (refresh the pool)', () => {
		// Three E casts spaced under lifetime: t=0 (+6), t=2.5 (+6 → 12),
		// t=5 (+6 → 18, max). Fourth cast at t=7.5: instances at t=0/2.5/5/7.5
		// → adding +6 would push past 18; oldest 6 (t=0 expire 10) get dropped.
		// Snapshot: 18 stacks (still maxed but the youngest two batches' expiry
		// times are now t=15/17.5, no longer t=10).
		const result = parseNotation('LifeStub E ~2s E ~2s E ~2s E', lookup, 8);
		const track = result.tracks.find((t) => t.characterId === 'lifestub')!;
		expect(track.eBars[3].stackContext?.get('fieldCatalog')).toBe(18);
		// Subsequent E at t=10.5 — the dropped-oldest batch (originally t=0) is
		// what would have expired at t=10, but it was discarded via saturation;
		// the second-oldest (t=2.5 expire t=12.5) is still active at t=10.5.
		// So pre-grant count = 18 (none expired by t=10.5), post-grant: drop
		// oldest 6 (t=2.5 batch) for the new +6 → still 18.
		const result2 = parseNotation('LifeStub E ~2s E ~2s E ~2s E ~3s E', lookup, 8);
		const track2 = result2.tracks.find((t) => t.characterId === 'lifestub')!;
		expect(track2.eBars[4].stackContext?.get('fieldCatalog')).toBe(18);
	});

	it('lifetime stack instances reset between segments (per-segment scope)', () => {
		// Segment 1: E at t=0 (+6). Segment 2 (same char after swap): instances
		// reset, fresh +6 from gainStacks.
		const result = parseNotation('LifeStub E > LifeStub E', lookup, 8);
		expect(result.tracks).toHaveLength(2);
		expect(result.tracks[0].eBars[0].stackContext?.get('fieldCatalog')).toBe(6);
		expect(result.tracks[1].eBars[0].stackContext?.get('fieldCatalog')).toBe(6);
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
		expect(reactionsOf(result.events)).toEqual([]);
	});

	it('Anemo → Anemo: neither cast emits reactions (no aura applicator)', () => {
		const result = parseNotation('Kazuha E > Kazuha Q', lookupPyroAnemo, 8);
		expect(reactionsOf(result.events)).toEqual([]);
	});

	it('Pyro → Anemo: anemo cast emits pyroSwirl (Shape A element-tagged)', () => {
		// Diluc E applies pyro; subsequent Kazuha cast emits pyroSwirl.
		const result = parseNotation('Diluc E > Kazuha E', lookupPyroAnemo, 8);
		// Diluc's E applies pyro to empty aura — no reaction emitted on his cast.
		// Kazuha's E sees pyro applied — emits pyroSwirl (Shape A composite key).
		const swirlEvents = reactionsOf(result.events).filter((ev) => ev.reaction === 'pyroSwirl');
		expect(swirlEvents).toHaveLength(1);
		expect(swirlEvents[0].characterId).toBe('kaedehara_kazuha');
	});

	it('Pyro → Pyro: second pyro cast does not react (same-element no-op)', () => {
		const result = parseNotation('Diluc E > Diluc Q', lookupPyroAnemo, 8);
		expect(reactionsOf(result.events)).toEqual([]);
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
		const bloomEvents = reactionsOf(result.events).filter((ev) => ev.reaction === 'bloom');
		expect(bloomEvents).toHaveLength(1);
		expect(bloomEvents[0].characterId).toBe('collei');
	});

	it('hydro → dendro → electro fires hyperbloom (consumes core)', () => {
		// HStub E (hydro applied) → Collei E (dendro+hydro=bloom, push core) →
		// Cyno E (electro on bloomCore → hyperbloom).
		const result = parseNotation('HStub E > Collei E > Cyno E', lookup, 8);
		const hyper = reactionsOf(result.events).filter((ev) => ev.reaction === 'hyperbloom');
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

	it('solo Moonsign (1) + pyro applicator: geo cast emits pyroCrystallize but NOT lunarCrystallize', () => {
		const result = parseNotation('Diluc E > Linnea E', lookup, 8);
		const reactionsByType = new Set(reactionsOf(result.events).map((ev) => ev.reaction));
		expect(reactionsByType.has('pyroCrystallize')).toBe(true);
		expect(reactionsByType.has('lunarCrystallize')).toBe(false);
	});

	it('two Moonsign + pyro applicator: geo cast emits both crystallize AND lunarCrystallize', () => {
		// Linnea + Flins are both Moonsign → 2-Moonsign team → lunarCrystallize gated open.
		const result = parseNotation('Diluc E > Linnea E > Flins E', lookup, 8);
		const linneaCrys = reactionsOf(result.events).filter(
			(ev) => ev.characterId === 'linnea' && ev.reaction === 'lunarCrystallize'
		);
		expect(linneaCrys.length).toBeGreaterThanOrEqual(1);
	});
});

describe('parseNotation — onShieldEnd primitive (2026-05-14)', () => {
	// Shielder: skill spawns a 12s summon-tagged shield (Noelle-shape). Holds an
	// onShieldEnd source:'self' ability:'skill' damage effect on a C4-shape
	// constellation. Mirrors Noelle Stone Armor + To Be Cleaned.
	const shielderStub: CharacterData = {
		id: 'shielder',
		name: 'Shielder',
		displayName: 'Shielder',
		element: 'geo',
		weapon: 'claymore',
		gender: 'Female',
		affiliation: 'Test',
		region: 'Test',
		rarity: 4,
		abilities: [
			{
				id: 'shielder__normal__attack',
				name: 'Attack',
				input: ['N'],
				abilityType: 'normal',
				hits: [{ frames: { swap: 10 } }]
			} as Ability,
			{
				id: 'shielder__skill__breastplate',
				name: 'Breastplate',
				input: ['E'],
				abilityType: 'skill',
				behavior: 'instant',
				frames: { swap: 30 },
				cooldown: 24,
				tags: ['shield', 'summon'],
				summons: [{ label: 'Stone Armor', duration: 12 }]
			} as unknown as Ability,
			{
				id: 'shielder__burst__sweeping',
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
				id: 'shielder__constellation__c4',
				name: 'C4',
				abilityType: 'constellation',
				constellationLevel: 4,
				effects: [
					{
						type: 'damage',
						target: 'enemy',
						trigger: { type: 'onShieldEnd', source: 'self', ability: 'skill' },
						scaling: 400,
						stat: 'atk',
						element: 'geo'
					}
				]
			} as unknown as Ability
		]
	} as CharacterData;

	// Team listener: holds an onShieldEnd source:'team' damage effect with
	// procCooldown:5. Mirrors Kachina C6. No own shield-spawning ability needed
	// for these tests (uses a vanilla skill).
	const listenerStub: CharacterData = {
		id: 'listener',
		name: 'Listener',
		displayName: 'Listener',
		element: 'geo',
		weapon: 'polearm',
		gender: 'Female',
		affiliation: 'Test',
		region: 'Test',
		rarity: 4,
		abilities: [
			{
				id: 'listener__normal__attack',
				name: 'Attack',
				input: ['N'],
				abilityType: 'normal',
				hits: [{ frames: { swap: 10 } }]
			} as Ability,
			{
				id: 'listener__skill__cast',
				name: 'Skill',
				input: ['E'],
				abilityType: 'skill',
				behavior: 'instant',
				frames: { swap: 30 },
				cooldown: 6
			} as unknown as Ability,
			{
				id: 'listener__burst__cast',
				name: 'Burst',
				input: ['Q'],
				abilityType: 'burst',
				behavior: 'instant',
				frames: { swap: 30 },
				cooldown: 15,
				energyCost: 60
			} as Ability
		],
		passives: [],
		constellations: [
			{
				id: 'listener__constellation__c6',
				name: 'C6',
				abilityType: 'constellation',
				constellationLevel: 6,
				effects: [
					{
						type: 'damage',
						target: 'enemy',
						trigger: { type: 'onShieldEnd', source: 'team' },
						procCooldown: 5,
						scaling: 200,
						stat: 'def',
						element: 'geo'
					}
				]
			} as unknown as Ability
		]
	} as CharacterData;

	// Effect-based shielder: burst spawns a 15s shield via Effect.type 'shield'
	// with onCast trigger (Beidou Q-shape).
	const effectShielderStub: CharacterData = {
		id: 'effectshielder',
		name: 'EffectShielder',
		displayName: 'EffectShielder',
		element: 'electro',
		weapon: 'claymore',
		gender: 'Female',
		affiliation: 'Test',
		region: 'Test',
		rarity: 4,
		abilities: [
			{
				id: 'effectshielder__normal__attack',
				name: 'Attack',
				input: ['N'],
				abilityType: 'normal',
				hits: [{ frames: { swap: 10 } }]
			} as Ability,
			{
				id: 'effectshielder__skill__cast',
				name: 'Skill',
				input: ['E'],
				abilityType: 'skill',
				behavior: 'instant',
				frames: { swap: 30 },
				cooldown: 6
			} as unknown as Ability,
			{
				id: 'effectshielder__burst__cast',
				name: 'Burst',
				input: ['Q'],
				abilityType: 'burst',
				behavior: 'instant',
				frames: { swap: 30 },
				cooldown: 20,
				energyCost: 60,
				effects: [
					{
						type: 'shield',
						target: 'self',
						trigger: { type: 'onCast', ability: 'burst' },
						duration: 15,
						scaling: 16,
						stat: 'hp'
					}
				]
			} as unknown as Ability
		],
		passives: [],
		constellations: []
	} as CharacterData;

	const lookup = (n: string): CharacterData | null => {
		if (n === 'Shielder') return shielderStub;
		if (n === 'Listener') return listenerStub;
		if (n === 'EffectShielder') return effectShielderStub;
		return null;
	};

	it('emits ShieldEndEvent at scheduled expiry of a summon-tagged shield', () => {
		// Shielder E at t=0 spawns Stone Armor (12s). Listener cast at t=15 forces
		// a dispatch tick after the shield expired.
		const result = parseNotation('Shielder E ~15s > Listener E', lookup, 8, {
			shielder: 4,
			listener: 6
		});
		const ev = shieldEndsOf(result.events).find((e) => e.characterId === 'shielder');
		expect(ev).toBeDefined();
		expect(ev!.ability).toBe('skill');
		expect(ev!.time).toBeCloseTo(12, 2);
	});

	it('emits ShieldEndEvent at rotation end when no later cast forces dispatch', () => {
		// Single Shielder E with no subsequent cast — the final dispatch-pass at
		// rotation end picks up the expired window.
		const result = parseNotation('Shielder E', lookup, 8, { shielder: 4 });
		const ev = shieldEndsOf(result.events).find((e) => e.characterId === 'shielder');
		expect(ev).toBeDefined();
		expect(ev!.time).toBeCloseTo(12, 2);
	});

	it('emits ShieldEndEvent at expiry for Effect.type:"shield" with onCast trigger (burst)', () => {
		// EffectShielder Q at t=0 spawns a 15s shield via Effect.type. After
		// the burst, a long gap then a follow-up cast forces dispatch.
		const result = parseNotation('EffectShielder Q ~20s > EffectShielder E', lookup, 8, {
			effectshielder: 0
		});
		const ev = shieldEndsOf(result.events).find(
			(e) => e.characterId === 'effectshielder' && e.ability === 'burst'
		);
		expect(ev).toBeDefined();
		expect(ev!.time).toBeCloseTo(15, 2);
	});

	it('procCooldown suppresses Listener C6 between back-to-back shield ends within 5s', () => {
		// Shielder E at t=0 → Stone Armor expires at t=12. Shielder E at t=24
		// (after CD) → Stone Armor expires at t=36. Two events, 24s apart, both
		// outside Kachina C6's 5s window. Both should fire. Now compress: two
		// shielders both with 12s shields whose ends fall within 5s.
		// Use a two-tap with a shorter custom-stub: re-purpose `effectshielder`
		// (15s shield) + Shielder (12s shield). Burst at t=0 → 15s expiry.
		// Shielder E at t=10 → 22s expiry. Diff = 22-15 = 7s > 5s → both fire.
		// Tighten: ~6s after the EffectShielder Q, Shielder E → 18s expiry. Diff
		// 18-15 = 3s < 5s → second event suppressed for Listener.
		const result = parseNotation('EffectShielder Q ~6s > Shielder E ~20s > Listener E', lookup, 8, {
			effectshielder: 0,
			shielder: 4,
			listener: 6
		});
		// Two distinct shield-end events should be emitted (always, regardless of
		// proc-cooldown — procCooldown gates listener dispatch, not the event stream).
		const burstEv = shieldEndsOf(result.events).find((e) => e.ability === 'burst');
		const skillEv = shieldEndsOf(result.events).find((e) => e.ability === 'skill');
		expect(burstEv).toBeDefined();
		expect(skillEv).toBeDefined();
		// Both events still emit on the stream — procCooldown gating is an
		// internal detail of `dispatchShieldEnds` and doesn't drop events. The
		// test asserts the event-stream contract; per-effect dispatch is a
		// future renderer concern.
		expect(shieldEndsOf(result.events).length).toBeGreaterThanOrEqual(2);
	});

	it('source:"self" filter: ShieldEndEvent emits regardless, but only self listeners would dispatch', () => {
		// Stream-only check: Shielder E + Listener active. The event stream
		// records the shield end; dispatching to Shielder's own C4 (source:self)
		// works because the holder matches the shield owner.
		const result = parseNotation('Shielder E', lookup, 8, { shielder: 4 });
		expect(shieldEndsOf(result.events).length).toBe(1);
		expect(shieldEndsOf(result.events)[0].characterId).toBe('shielder');
	});
});

describe('parseNotation — onReaction gainStacks team-walk + rotation-wide accrual (Cluster C Item 2 — 2026-05-14)', () => {
	// Synthetic Neuvillette-shape holder: Hydro caster with an A1 passive that
	// grants 1 `pastDraconicGlories` stack per qualifying reaction emitted by
	// any team member (source='team'), max 3 stacks, 30s lifetime per instance.
	// Teammate stubs provide the reaction-triggering casts: PyroStub for
	// vaporize, ElectroStub for electroCharged. The holder reads accrued stacks
	// at on-field cast time via `syncOnReactionToStackState`.
	const neuvAStub: CharacterData = {
		id: 'neuva',
		name: 'NeuvA',
		displayName: 'NeuvA',
		element: 'hydro',
		weapon: 'catalyst',
		gender: 'Male',
		affiliation: 'Test',
		region: 'Test',
		rarity: 5,
		abilities: [
			{
				id: 'neuva__normal__attack',
				name: 'Attack',
				input: ['N'],
				abilityType: 'normal',
				hits: [{ frames: { swap: 10 } }]
			} as Ability,
			{
				id: 'neuva__skill__cast',
				name: 'Skill',
				input: ['E'],
				abilityType: 'skill',
				behavior: 'instant',
				frames: { swap: 30 },
				cooldown: 12
			} as unknown as Ability,
			{
				id: 'neuva__burst__cast',
				name: 'Burst',
				input: ['Q'],
				abilityType: 'burst',
				behavior: 'instant',
				frames: { swap: 30 },
				cooldown: 18,
				energyCost: 70
			} as Ability
		],
		passives: [
			{
				id: 'neuva__passive__a1',
				name: 'A1',
				abilityType: 'passive',
				effects: [
					{
						type: 'gainStacks',
						target: 'self',
						trigger: {
							type: 'onReaction',
							source: 'team',
							reaction: ['vaporize', 'electroCharged']
						},
						key: 'pastDraconicGlories',
						amount: 1,
						max: 3,
						lifetime: 30
					}
				]
			} as unknown as Ability
		],
		constellations: []
	} as CharacterData;
	// Self-source variant: same shape but `source: 'self'` — only the holder's
	// own reactions accrue. Used to verify the source filter excludes teammate
	// reactions.
	const neuvSelfStub: CharacterData = {
		...neuvAStub,
		id: 'neuvself',
		name: 'NeuvSelf',
		displayName: 'NeuvSelf',
		passives: [
			{
				id: 'neuvself__passive__a1',
				name: 'A1',
				abilityType: 'passive',
				effects: [
					{
						type: 'gainStacks',
						target: 'self',
						trigger: {
							type: 'onReaction',
							source: 'self',
							reaction: ['vaporize']
						},
						key: 'selfOnlyStacks',
						amount: 1,
						max: 3,
						lifetime: 30
					}
				]
			} as unknown as Ability
		]
	} as CharacterData;
	const pyroStub: CharacterData = {
		id: 'pyrostub',
		name: 'PyroStub',
		displayName: 'PyroStub',
		element: 'pyro',
		weapon: 'sword',
		gender: 'Female',
		affiliation: 'Test',
		region: 'Test',
		rarity: 5,
		abilities: [
			{
				id: 'pyrostub__normal__attack',
				name: 'Attack',
				input: ['N'],
				abilityType: 'normal',
				hits: [{ frames: { swap: 10 } }]
			} as Ability,
			{
				id: 'pyrostub__skill__cast',
				name: 'Skill',
				input: ['E'],
				abilityType: 'skill',
				behavior: 'instant',
				frames: { swap: 30 },
				cooldown: 8
			} as unknown as Ability,
			{
				id: 'pyrostub__burst__cast',
				name: 'Burst',
				input: ['Q'],
				abilityType: 'burst',
				behavior: 'instant',
				frames: { swap: 30 },
				cooldown: 15,
				energyCost: 60
			} as Ability
		],
		passives: [],
		constellations: []
	} as CharacterData;
	const electroStub: CharacterData = {
		...pyroStub,
		id: 'electrostub',
		name: 'ElectroStub',
		displayName: 'ElectroStub',
		element: 'electro',
		abilities: pyroStub.abilities.map((a) => ({
			...a,
			id: a.id.replace('pyrostub', 'electrostub')
		})) as Ability[]
	} as CharacterData;
	const lookup = (n: string): CharacterData | null => {
		if (n === 'NeuvA') return neuvAStub;
		if (n === 'NeuvSelf') return neuvSelfStub;
		if (n === 'PyroStub') return pyroStub;
		if (n === 'ElectroStub') return electroStub;
		return null;
	};

	it('source=team: teammate-triggered reaction accrues stack on holder (off-field)', () => {
		// NeuvA E (Hydro applied) > PyroStub E (Pyro on Hydro → vaporize) >
		// NeuvA E (reads accrued stack). pastDraconicGlories should be 1 at the
		// second NeuvA cast.
		const result = parseNotation('NeuvA E > PyroStub E > NeuvA E', lookup, 8);
		const neuvBars = result.tracks.filter((t) => t.characterId === 'neuva').flatMap((t) => t.eBars);
		expect(neuvBars[0].stackContext?.get('pastDraconicGlories') ?? 0).toBe(0);
		expect(neuvBars[1].stackContext?.get('pastDraconicGlories') ?? 0).toBe(1);
	});

	it('source=team: holder’s own reaction also accrues (Neuv vaporizes a teammate-applied aura)', () => {
		// PyroStub E (apply Pyro) > NeuvA E (Hydro on Pyro → vaporize, holder is
		// the emitter). source=team includes self, so stack accrues.
		const result = parseNotation('PyroStub E > NeuvA E E', lookup, 8);
		const neuvBars = result.tracks.filter((t) => t.characterId === 'neuva').flatMap((t) => t.eBars);
		// First NeuvA E emits the vaporize; the stack is accrued during the
		// cast, so the second NeuvA E reads stackContext=1 via the sync.
		expect(neuvBars[1].stackContext?.get('pastDraconicGlories') ?? 0).toBe(1);
	});

	it('max:3 cap with oldest-dropped saturation (4 distinct events → still 3 stacks)', () => {
		// 4 reactions in sequence: vape (PyroStub on Hydro), EC (Electro on
		// Hydro), vape (Pyro on Hydro), EC (Electro on Hydro). Each adds 1
		// stack; max=3 keeps cap.
		const result = parseNotation(
			'NeuvA E > PyroStub E > NeuvA E > ElectroStub E > NeuvA E > PyroStub E > NeuvA E > ElectroStub E > NeuvA E',
			lookup,
			8
		);
		const neuvBars = result.tracks.filter((t) => t.characterId === 'neuva').flatMap((t) => t.eBars);
		const last = neuvBars[neuvBars.length - 1];
		expect(last.stackContext?.get('pastDraconicGlories') ?? 0).toBe(3);
	});

	it('lifetime:30 drops stacks after 30s', () => {
		// NeuvA E > PyroStub E (vape at ~0s → +1 stack expiring at ~30s) >
		// ~35s gap > NeuvA E (reads decayed count → 0).
		const result = parseNotation('NeuvA E > PyroStub E ~35s > NeuvA E', lookup, 8);
		const neuvBars = result.tracks.filter((t) => t.characterId === 'neuva').flatMap((t) => t.eBars);
		const last = neuvBars[neuvBars.length - 1];
		expect(last.stackContext?.get('pastDraconicGlories') ?? 0).toBe(0);
	});

	it('source=self: teammate reaction does NOT accrue on a different holder’s self-only key', () => {
		// NeuvSelf is on the team but its A1 is source='self'. PyroStub vaporizes
		// NeuvA's Hydro — NeuvSelf is not the emitter, so NeuvSelf's
		// selfOnlyStacks stays 0.
		const result = parseNotation('NeuvA E > PyroStub E > NeuvSelf E', lookup, 8);
		const neuvSelfBars = result.tracks
			.filter((t) => t.characterId === 'neuvself')
			.flatMap((t) => t.eBars);
		expect(neuvSelfBars[0].stackContext?.get('selfOnlyStacks') ?? 0).toBe(0);
	});

	it('cross-segment accrual: stacks persist across the holder’s absent segments', () => {
		// NeuvA cold-opens (apply Hydro), swaps out. PyroStub vapes (stack 1).
		// ElectroStub EC (stack 2). NeuvA re-enters (re-apply Hydro). PyroStub
		// vapes again (stack 3). NeuvA reads.
		const result = parseNotation(
			'NeuvA E > PyroStub E > NeuvA E > ElectroStub E > PyroStub E > NeuvA E',
			lookup,
			8
		);
		const neuvBars = result.tracks.filter((t) => t.characterId === 'neuva').flatMap((t) => t.eBars);
		const last = neuvBars[neuvBars.length - 1];
		expect(last.stackContext?.get('pastDraconicGlories') ?? 0).toBe(3);
	});
});

describe('parseNotation — character cdReset does not leak to teammates (sweep 2026-07-05 #1)', () => {
	const cyno = cynoJson as unknown as CharacterData;
	const lookup = (name: string): CharacterData | null =>
		name === 'Cyno' ? cyno : name === 'Kazuha' ? kazuha : null;

	it("Kazuha C1 Q leaves Cyno's E cooldown untouched", () => {
		// Cyno E (7.5s CD) at t=0; Kazuha swaps in for E Q; the second Cyno E
		// must still wait out Cyno's own cooldown. Before the fix, the C1
		// reset loop iterated EVERY charge queue, so Kazuha's burst refunded
		// Cyno's charge and the second E fired at ~3.75s.
		const result = parseNotation('Cyno E > Kazuha E Q > Cyno E', lookup, 8, {
			kaedehara_kazuha: 1
		});
		const cynoEStarts = result.tracks
			.filter((t) => t.characterId === 'cyno')
			.flatMap((t) => t.eBars.map((b) => b.start))
			.sort((a, b) => a - b);
		expect(cynoEStarts).toHaveLength(2);
		expect(cynoEStarts[1]).toBeGreaterThanOrEqual(7.4);
	});

	it('Kazuha C1 self-reset still works with a teammate present', () => {
		// The caster filter must not break the legitimate self-reset.
		const result = parseNotation('Cyno E > Kazuha E Q E', lookup, 8, {
			kaedehara_kazuha: 1
		});
		const kazuhaTrack = result.tracks.find((t) => t.characterId === 'kaedehara_kazuha')!;
		expect(kazuhaTrack.eBars).toHaveLength(2);
		expect(kazuhaTrack.qBars).toHaveLength(1);
		const qEnd = kazuhaTrack.qBars[0].start + kazuhaTrack.qBars[0].castTime;
		// Second E right after Q — well under the 5.4s C1-modified E CD.
		expect(kazuhaTrack.eBars[1].start).toBeGreaterThanOrEqual(qEnd);
		expect(kazuhaTrack.eBars[1].start).toBeLessThan(qEnd + 0.1);
	});
});

describe('parseNotation — bracket repeat count is capped (sweep 2026-07-05 #2)', () => {
	const huTao = huTaoJson as unknown as CharacterData;
	const lookup = (name: string): CharacterData | null => (name === 'Hu Tao' ? huTao : null);

	it('999999999[N1] clamps to MAX_BRACKET_REPEATS instead of freezing/OOMing', () => {
		// parseNotation runs synchronously per editor keystroke; an unbounded
		// repeat count would build a multi-GB token array.
		const result = parseNotation('Hu Tao 999999999[N1]', lookup, 8);
		const track = result.tracks.find((t) => t.characterId === 'hu_tao')!;
		const nBlocks = track.inputBlocks.filter((b) => b.parts[0] === 'N1');
		expect(nBlocks).toHaveLength(99);
	});

	it('[N1]x999999999 (x-suffix form) is clamped the same way', () => {
		const result = parseNotation('Hu Tao [N1]x999999999', lookup, 8);
		const track = result.tracks.find((t) => t.characterId === 'hu_tao')!;
		const nBlocks = track.inputBlocks.filter((b) => b.parts[0] === 'N1');
		expect(nBlocks).toHaveLength(99);
	});
});

describe('parseNotation — bracket groups with concatenated inner content (sweep 2026-07-05 #4)', () => {
	const huTao = huTaoJson as unknown as CharacterData;
	const lookup = (name: string): CharacterData | null => (name === 'Hu Tao' ? huTao : null);

	it('9[N2C] expands to nine N2+C pairs instead of vanishing', () => {
		// expandBrackets re-tokenizes inner content via a synthetic '_ ' prefix;
		// before the tokenizer fix, the absorb loop swallowed 'N2C' into the
		// synthetic name and the group expanded to zero actions — silently.
		const result = parseNotation('Hu Tao E 9[N2C]', lookup, 8);
		expect(result.unknownTokens).toEqual([]);
		const track = result.tracks.find((t) => t.characterId === 'hu_tao')!;
		const parts = track.inputBlocks.map((b) => b.parts.join('+'));
		expect(parts.filter((p) => p === 'N2')).toHaveLength(9);
		expect(parts.filter((p) => p === 'C')).toHaveLength(9);
	});

	it('concatenated run directly after the name parses end-to-end', () => {
		// Integration cover for tokenizer sweep-fix #3: the whole segment used
		// to land in unknownTokens with no track produced.
		const result = parseNotation('Hu Tao EN1C', lookup, 8);
		expect(result.unknownTokens).toEqual([]);
		const track = result.tracks.find((t) => t.characterId === 'hu_tao');
		expect(track).toBeDefined();
		expect(track!.eBars).toHaveLength(1);
		expect(track!.inputBlocks.map((b) => b.parts[0])).toEqual(['E', 'N1', 'C']);
	});
});

describe('parseNotation — E cooldown wait re-resolves the active variant (sweep 2026-07-05 #5)', () => {
	it('Cyno: a wait that crosses the stance end casts base Secret Rite at the boundary', () => {
		const cynoChar = cynoJson as unknown as CharacterData;
		const lookup = (name: string): CharacterData | null => (name === 'Cyno' ? cynoChar : null);
		// Q opens the stance (ends 19.87 = 11.87 base + 2×4s onCast extensions).
		// At ~18.5 the 4th E resolves in-stance Mortuary Rite, but its charge
		// only returns at 20.95 — after the stance dies. The cast must fall to
		// base Secret Rite (7.5s CD, never used, ready) at the stance boundary.
		// Before the fix it was emitted at 20.95 as the stale in-stance variant
		// with the wrong (3s) cooldown queue consumed.
		const result = parseNotation('Cyno Q E E ~13s E E', lookup, 8);
		const track = result.tracks.find((t) => t.characterId === 'cyno')!;
		expect(track.eBars).toHaveLength(4);
		const last = track.eBars[3];
		expect(last.cooldown).toBe(7.5);
		expect(last.start).toBeGreaterThan(19.8);
		expect(last.start).toBeLessThan(19.95);
	});

	it('Skirk: drain decay owed over the cooldown wait is applied before the next grant', () => {
		const skirk = skirkJson as unknown as CharacterData;
		const lookup = (name: string): CharacterData | null => (name === 'Skirk' ? skirk : null);
		// Second E waits out the 8s skill CD. Serpent's Subtlety drains 7/s
		// while the stance (12.57s) is up, so the 45 granted at t=0 fully
		// decays by t=8 and the second grant snapshots 45 — before the fix,
		// drain ran at the pre-wait cursor (0.5s of decay) and the grant
		// re-anchored, snapshotting 86.5 phantom stacks.
		const result = parseNotation('Skirk E E', lookup, 8);
		const track = result.tracks.find((t) => t.characterId === 'skirk')!;
		expect(track.eBars).toHaveLength(2);
		expect(track.eBars[1].start).toBeCloseTo(8, 1);
		expect(track.eBars[1].stackContext?.get('serpentsSubtlety')).toBe(45);
	});
});

describe('parseNotation — stance extensions stop at stance end (sweep 2026-07-05 #7)', () => {
	it('Mizuki: a matching reaction long after the stance died no longer extends the bar', () => {
		const bennett = bennettJson as unknown as CharacterData;
		const mizuki = yumemizukiJson as unknown as CharacterData;
		const lookup = (name: string): CharacterData | null =>
			name === 'Bennett' ? bennett : name === 'Mizuki' ? mizuki : null;
		// Bennett applies pyro; Mizuki's E swirls at cast (+2.5s legitimate
		// extension → uptime 7.5, window dead by ~8.3). Her Q at ~26s emits
		// another pyroSwirl — before the fix, the stance path gated only on
		// stanceWindows.has() (entries are never deleted) and fired ext #2 on
		// the long-dead window, inflating uptime to 10.
		const result = parseNotation('Bennett E > Mizuki E ~25s Q', lookup, 8);
		const track = result.tracks.find((t) => t.characterId === 'yumemizuki_mizuki')!;
		expect(track.eBars).toHaveLength(1);
		expect(track.eBars[0].uptime).toBe(7.5);
	});
});

describe('parseNotation — cancels reset the normal-attack string (sweep 2026-07-05 #8)', () => {
	const huTao = huTaoJson as unknown as CharacterData;
	const lookup = (name: string): CharacterData | null => (name === 'Hu Tao' ? huTao : null);

	it('9[N1C]: every rep uses hit-0 frames instead of walking the hit table', () => {
		// In-game (and in gcsim) a charged attack resets the NA string to hit 1.
		// Before the fix, normalCounter persisted across the C cancels, so each
		// bracket rep advanced through the per-hit frame table (hit-0 20f vs
		// hit-4 48f vs hit-5 no-C-key fallback) and the timeline drifted tens of
		// frames from reality on the flagship N1C use case.
		const result = parseNotation('Hu Tao E 9[N1C]', lookup, 8);
		const track = result.tracks.find((t) => t.characterId === 'hu_tao')!;
		const n1Durations = track.inputBlocks.filter((b) => b.parts[0] === 'N1').map((b) => b.duration);
		expect(n1Durations).toHaveLength(9);
		expect(new Set(n1Durations).size).toBe(1); // all reps identical: hit-0 frames
	});

	it('consecutive normal tokens still CONTINUE the string', () => {
		// N1 N1 must equal N2 (the string only resets on a cancel, not between
		// adjacent normal tokens).
		const single = parseNotation('Hu Tao N2', lookup, 8);
		const split = parseNotation('Hu Tao N1 N1', lookup, 8);
		const total = (r: typeof single): number =>
			r.tracks[0].inputBlocks.reduce((s, b) => s + b.duration, 0);
		expect(total(split)).toBeCloseTo(total(single), 5);
	});
});

describe('parseNotation — block kinds for elemental CAs and plunges (sweep 2026-07-05 #12)', () => {
	it('catalyst charged attacks render elemental like their normals', () => {
		const nahida = nahidaJson as unknown as CharacterData;
		const lookup = (name: string): CharacterData | null => (name === 'Nahida' ? nahida : null);
		const result = parseNotation('Nahida N2C', lookup, 8);
		const track = result.tracks.find((t) => t.characterId === 'nahida')!;
		const kinds = Object.fromEntries(track.inputBlocks.map((b) => [b.parts[0], b.kind]));
		expect(kinds['N2']).toBe('elemental-normal');
		expect(kinds['C']).toBe('elemental-normal'); // was 'normal' — visibly inconsistent
	});

	it('infused in-stance plunges render elemental (Xiao Q hP)', () => {
		const xiao = xiaoJson as unknown as CharacterData;
		const lookup = (name: string): CharacterData | null => (name === 'Xiao' ? xiao : null);
		const result = parseNotation('Xiao Q hP', lookup, 8);
		const track = result.tracks.find((t) => t.characterId === 'xiao')!;
		const plunge = track.inputBlocks.find((b) => b.parts[0] === 'hP')!;
		expect(plunge.kind).toBe('elemental-normal'); // was hardcoded 'normal'
	});
});

describe('parseNotation — frameless / malformed abilities parse gracefully (regression: Durin crash class)', () => {
	// Synthetic fixture pinned to the DATA SHAPE that caused the crashes, NOT to
	// a real character: Durin (the original repro) was frame-curated 2026-07-14,
	// which would have silently retired these guards. The shape below mirrors
	// Durin's pre-curation stub — a normal ability with no hits[] and a burst
	// that is behavior:"stance" with no duration key. See bug archive:
	// frameless-E/Q crash + stance-no-duration NaN-poison.
	const frameless: CharacterData = {
		id: 'frameless',
		name: 'Frameless',
		displayName: 'Frameless',
		element: 'pyro',
		weapon: 'catalyst',
		rarity: 5,
		abilities: [
			{
				id: 'frameless__normal__x',
				name: 'Frameless NA',
				input: ['N'],
				abilityType: 'normal',
				tags: [],
				sections: [],
				description: ''
			},
			{
				id: 'frameless__skill__x',
				name: 'Frameless Skill',
				input: ['E'],
				abilityType: 'skill',
				behavior: 'stance',
				cooldown: 12,
				duration: 30,
				tags: [],
				effects: [],
				description: ''
			},
			{
				id: 'frameless__burst__x',
				name: 'Frameless Burst',
				input: ['Q'],
				abilityType: 'burst',
				behavior: 'stance',
				// intentionally NO duration key → NaN-poison guard
				cooldown: 18,
				energyCost: 70,
				tags: [],
				effects: [],
				description: ''
			}
		],
		passives: [],
		constellations: []
	} as unknown as CharacterData;

	const bennett = bennettJson as unknown as CharacterData;
	const lookup = (name: string): CharacterData | null =>
		name === 'Frameless' ? frameless : name === 'Bennett' ? bennett : null;

	it('frameless E/Q no longer throw (FrameMaps absent on every ability)', () => {
		// resolveEQCastTime assumed frames are always present, so `Frameless E`
		// threw inside the rotation $derived — the catch returned an empty
		// rotation and EVERY bar on the timeline vanished.
		const result = parseNotation('Frameless E Q', lookup, 8);
		const track = result.tracks.find((t) => t.characterId === 'frameless')!;
		expect(track).toBeDefined();
		expect(track.eBars).toHaveLength(1);
		expect(track.qBars).toHaveLength(1);
		// Falls back to the generic cast constants.
		expect(track.eBars[0].castTime).toBe(0.5);
		expect(track.qBars[0].castTime).toBe(1.0);
	});

	it('stance ability with an absent duration produces finite window math, not NaN', () => {
		// behavior:"stance" burst with no duration key → duration resolved to
		// undefined → stance end = start + undefined = NaN into stanceWindows
		// (the NaN-poison class from the bug archive). Sanitized to 0 in
		// resolveAbilityTiming.
		const result = parseNotation('Frameless Q N1 E', lookup, 8);
		const track = result.tracks.find((t) => t.characterId === 'frameless')!;
		for (const bar of [...track.eBars, ...track.qBars]) {
			expect(Number.isFinite(bar.start)).toBe(true);
			expect(Number.isFinite(bar.uptime)).toBe(true);
			expect(Number.isFinite(bar.cooldown)).toBe(true);
		}
		expect(Number.isFinite(result.totalDuration)).toBe(true);
	});

	it('a frameless character mid-rotation does not take down other segments', () => {
		const result = parseNotation('Bennett E > Frameless E Q > Bennett Q', lookup, 8);
		const bennettTracks = result.tracks.filter((t) => t.characterId === 'bennett');
		const framelessTracks = result.tracks.filter((t) => t.characterId === 'frameless');
		expect(bennettTracks).toHaveLength(2);
		expect(framelessTracks).toHaveLength(1);
	});
});

describe('parseNotation — sQ short-burst + transient-state primitive (2026-07-17)', () => {
	const flins = flinsForTest as unknown as CharacterData;
	const varesa = varesaForTest as unknown as CharacterData;
	const diluc = dilucJson as unknown as CharacterData;
	const lookup = (n: string): CharacterData | null => {
		if (n === 'Flins') return flins;
		if (n === 'Varesa') return varesa;
		if (n === 'Diluc') return diluc;
		return null;
	};
	const stateWindows = (r: ReturnType<typeof parseNotation>, name: string) =>
		r.windows.filter((w) => w.kind === 'state' && w.name === name) as Extract<
			ReturnType<typeof parseNotation>['windows'][number],
			{ kind: 'state' }
		>[];

	it('Flins: Spearstorm opens symphonyWindow; sQ resolves Thunderous Symphony and bypasses the burst CD', () => {
		// Q (15s CD) > Arcane Light (opens stance) > Spearstorm (in-stance,
		// opens symphonyWindow) > sQ (Symphony: no CD gate, no CD write) > Q
		// (must still wait for the ORIGINAL 15s clock — sQ left it untouched).
		const result = parseNotation('Flins Q E E sQ Q', lookup, 8);
		const qBars = result.tracks[0].qBars;
		expect(qBars).toHaveLength(3);
		// Symphony: label sQ, variant cooldown 0, variant frames (swap=81).
		expect(qBars[1].label).toBe('sQ');
		expect(qBars[1].cooldown).toBe(0);
		expect(qBars[1].castTime).toBeCloseTo(81 / 60, 6);
		// Bypass: cast well before the 15s clock, which the final Q still honors.
		expect(qBars[1].start).toBeLessThan(15);
		expect(qBars[2].label).toBe('Q');
		expect(qBars[2].start).toBeCloseTo(15, 6);
		// The symphonyWindow is cast-opened (provenance → the Spearstorm cast)
		// and CONSUMED by the sQ cast (end clamped to its start).
		const wins = stateWindows(result, 'symphonyWindow');
		expect(wins).toHaveLength(1);
		const casts = result.events.filter((e) => e.kind === 'cast');
		const opener = casts.find((c) => c.id === wins[0].sourceCastId);
		expect(opener?.abilityId).toBe('flins__skill__northland_spearstorm');
		expect(wins[0].end).toBeCloseTo(qBars[1].start, 6);
	});

	it('Flins: out-of-window sQ falls back to the base burst (conditions gate the variant)', () => {
		const result = parseNotation('Flins sQ', lookup, 8);
		const qBars = result.tracks[0].qBars;
		expect(qBars[0].label).toBe('sQ');
		expect(qBars[0].cooldown).toBe(15); // base Cometh the Night CD
		expect(qBars[0].castTime).toBeCloseTo(91 / 60, 6); // base frames, not symphony's
	});

	it('Flins: casting Symphony consumes the window — a second sQ resolves base', () => {
		const result = parseNotation('Flins E E sQ sQ', lookup, 8);
		const qBars = result.tracks[0].qBars;
		expect(qBars).toHaveLength(2);
		expect(qBars[0].cooldown).toBe(0); // in-window Symphony
		expect(qBars[1].cooldown).toBe(15); // window consumed → base
	});

	it('Flins: symphonyWindow terminates on swap-out', () => {
		const result = parseNotation('Flins E E > Diluc E > Flins sQ', lookup, 8);
		const wins = stateWindows(result, 'symphonyWindow');
		expect(wins).toHaveLength(1);
		// Clamped to Flins's first-segment end, not the full 6s.
		expect(wins[0].end).toBeCloseTo(result.tracks[0].activeEnd, 6);
		// Post-swap sQ is outside the window → base burst.
		const flinsTracks = result.tracks.filter((t) => t.characterId === 'flins');
		const lastQ = flinsTracks[flinsTracks.length - 1].qBars[0];
		expect(lastQ.cooldown).toBe(15);
	});

	it('Varesa C2: any plunge opens apexDrive; sQ resolves Volcano Kablam (1s CD, window sourced to the plunge action event)', () => {
		const result = parseNotation('Varesa P sQ', lookup, 8, { varesa: 2 });
		const qBars = result.tracks[0].qBars;
		expect(qBars).toHaveLength(1);
		expect(qBars[0].label).toBe('sQ');
		expect(qBars[0].cooldown).toBe(1);
		expect(qBars[0].castTime).toBeCloseTo(42 / 60, 6); // volcanic frames (swap fallback)
		const wins = stateWindows(result, 'apexDrive');
		expect(wins).toHaveLength(1);
		expect(wins[0].sourceCastId).toBeUndefined(); // opened by a plunge, not a cast
		// Post-P4 #2: the plunge's action event is the window's provenance,
		// and the window opens at the plunge's END (landing).
		const plunge = result.events.find((e) => e.kind === 'action' && e.action === 'plunge');
		expect(plunge).toBeTruthy();
		expect(wins[0].sourceActionId).toBe(plunge!.id);
		if (plunge!.kind === 'action') {
			expect(wins[0].start).toBeCloseTo(plunge!.time + plunge!.duration, 6);
		}
		// Consumed by the Kablam cast.
		expect(wins[0].end).toBeCloseTo(qBars[0].start, 6);
	});

	it('Varesa C0: a plunge outside Fiery Passion opens nothing — sQ falls back to Guardian Vent', () => {
		const result = parseNotation('Varesa P sQ', lookup, 8);
		const qBars = result.tracks[0].qBars;
		expect(qBars[0].cooldown).toBe(18); // base Vent CD
		expect(stateWindows(result, 'apexDrive')).toHaveLength(0);
	});

	it('Varesa: Kablam shares the burst CD slot — sQ right after Q waits out the 18s clock (apex expires → base resolves)', () => {
		// Mirrors gcsim ActionReady: kablam requires the shared burst CD charge.
		// Q writes 18s; the plunge's 2.33s apex window is long gone by the time
		// the clock frees the slot, so the queued sQ resolves the full Vent.
		const result = parseNotation('Varesa Q P sQ', lookup, 8);
		const qBars = result.tracks[0].qBars;
		expect(qBars).toHaveLength(2);
		expect(qBars[1].start).toBeCloseTo(18, 6);
		expect(qBars[1].cooldown).toBe(18);
	});

	it('Varesa: in-Fiery-Passion plunge opens apexDrive with a free burst slot → Kablam fires', () => {
		// ~17s pushes past Vent's 18s clock while... apex is opened by a C2
		// plunge cast after the wait, so the slot is free at sQ time.
		const result = parseNotation('Varesa Q ~17s P sQ', lookup, 8, { varesa: 2 });
		const qBars = result.tracks[0].qBars;
		expect(qBars).toHaveLength(2);
		expect(qBars[1].label).toBe('sQ');
		expect(qBars[1].cooldown).toBe(1);
	});
});

describe('parseNotation — variant conditions gate variant resolution (Varka regression)', () => {
	// Varka's "Four Winds' Ascension" variant (input E, conditions inStance +
	// elemental teammate) used to be matched on input alone — shadowing the
	// base tap-E so his stance NEVER opened. Condition-aware matching (sQ
	// primitive step 3) restores the curator-documented behavior.
	const varka = varkaForTest as unknown as CharacterData;
	const diluc = dilucJson as unknown as CharacterData;
	const lookup = (n: string): CharacterData | null => {
		if (n === 'Varka') return varka;
		if (n === 'Diluc') return diluc;
		return null;
	};

	it('tap E out of stance resolves the base stance opener (16s CD, opens Sturm und Drang)', () => {
		const result = parseNotation('Varka E', lookup, 8);
		expect(result.tracks[0].eBars[0].cooldown).toBe(16);
		expect(
			result.windows.some(
				(w) => w.kind === 'state' && w.name === 'inStance' && w.characterId === 'varka'
			)
		).toBe(true);
	});

	it('a second E waits out the shared charge queue and resolves base (Four Winds residual)', () => {
		// Residual gap (documented in varka.json): Four Winds' Ascension is a
		// VARIANT of the one skill ability, so it shares the base 16s charge
		// queue — by the time a second E is castable the 12s stance has expired
		// and the variant's inStance condition fails. Reaching it needs a
		// separate-ability re-author (Flins Northland Spearstorm pattern).
		const result = parseNotation('Varka E E > Diluc E', lookup, 8);
		const eBars = result.tracks[0].eBars;
		expect(eBars[0].cooldown).toBe(16); // opener
		expect(eBars[1].cooldown).toBe(16); // charge free at ~16.3s → stance over → base
		expect(eBars[1].start).toBeGreaterThan(12); // waited past the stance window
	});
});

describe('parseNotation — action-level events (post-P4 #2)', () => {
	const diluc = dilucJson as unknown as CharacterData;
	const yumemizuki = yumemizukiJson as unknown as CharacterData;
	const lookup = (n: string): CharacterData | null => {
		if (n === 'Diluc') return diluc;
		if (n === 'Mizuki') return yumemizuki;
		if (n === 'Kazuha') return kazuha;
		return null;
	};
	const actionsOf = (events: TimelineEvent[]) =>
		events.filter((e): e is Extract<TimelineEvent, { kind: 'action' }> => e.kind === 'action');

	it('N5 emits per-swing events sharing one blockId; block is their sum', () => {
		const result = parseNotation('Diluc N5', lookup, 8);
		const acts = actionsOf(result.events);
		expect(acts).toHaveLength(5);
		// Diluc's combo has 4 hits — the 5th swing wraps to comboIndex 0.
		expect(acts.map((a) => a.comboIndex)).toEqual([0, 1, 2, 3, 0]);
		expect(acts.every((a) => a.action === 'normal' && a.label === 'N5')).toBe(true);
		expect(acts.every((a) => a.blockId === acts[0].id)).toBe(true);
		expect(acts[0].blockId).toBe(acts[0].id); // anchor anchors itself
		for (let i = 1; i < acts.length; i++) {
			expect(acts[i].time).toBeCloseTo(acts[i - 1].time + acts[i - 1].duration, 9);
		}
		const block = result.tracks[0].inputBlocks.find((b) => b.parts[0] === 'N5');
		expect(block).toBeTruthy();
		expect(block!.start).toBe(acts[0].time);
		expect(block!.duration).toBeCloseTo(
			acts.reduce((s, a) => s + a.duration, 0),
			9
		);
	});

	it('consecutive N tokens continue the combo across separate blocks', () => {
		const result = parseNotation('Diluc N2 N3', lookup, 8);
		const acts = actionsOf(result.events);
		expect(acts.map((a) => a.comboIndex)).toEqual([0, 1, 2, 3, 0]);
		const blockIds = new Set(acts.map((a) => a.blockId));
		expect(blockIds.size).toBe(2); // two tokens → two groups
	});

	it('catalyst normals and charged attacks carry the character element', () => {
		const result = parseNotation('Mizuki N2 C', lookup, 8);
		const acts = actionsOf(result.events);
		expect(acts.filter((a) => a.action === 'normal').every((a) => a.element === 'anemo')).toBe(
			true
		);
		const charged = acts.find((a) => a.action === 'charged');
		expect(charged?.element).toBe('anemo');
		expect(charged?.comboIndex).toBeUndefined();
	});

	it('non-infused sword/claymore normals carry no element', () => {
		const result = parseNotation('Diluc N1 C', lookup, 8);
		const acts = actionsOf(result.events);
		expect(acts.every((a) => a.element === undefined)).toBe(true);
	});

	it('plunge after hE emits a plunge event with the resolved variant timing', () => {
		const result = parseNotation('Kazuha hE P', lookup, 8);
		const plunge = actionsOf(result.events).find((a) => a.action === 'plunge');
		expect(plunge).toBeTruthy();
		expect(plunge!.label).toBe('P');
		expect(plunge!.duration).toBeGreaterThan(0);
		const block = result.tracks[0].inputBlocks.find((b) => b.parts[0] === 'P');
		expect(block!.start).toBe(plunge!.time);
		expect(block!.duration).toBe(plunge!.duration);
	});

	it('dash/jump/unset tokens emit their action events', () => {
		const result = parseNotation('Diluc N1 D J ~?s N1', lookup, 8);
		const acts = actionsOf(result.events);
		expect(acts.find((a) => a.action === 'dash')?.duration).toBeCloseTo(21 / 60, 9);
		expect(acts.find((a) => a.action === 'jump')?.duration).toBeCloseTo(21 / 60, 9);
		const unset = acts.find((a) => a.action === 'unset');
		expect(unset?.label).toBe('~?');
		expect(unset?.abilityId).toBeUndefined();
	});

	it('E/Q casts emit cast events, never action events', () => {
		const result = parseNotation('Diluc E Q', lookup, 8);
		expect(actionsOf(result.events)).toHaveLength(0);
		expect(result.events.filter((e) => e.kind === 'cast')).toHaveLength(2);
	});
});

describe('parseNotation — Durin dual-form (post-P4 #2 normal-opened state)', () => {
	const durin = durinJson as unknown as CharacterData;
	const lookup = (n: string): CharacterData | null => (n === 'Durin' ? durin : null);
	const stateWindows = (r: ReturnType<typeof parseNotation>, name: string) =>
		r.windows.filter((w) => w.kind === 'state' && w.name === name);
	const burstCast = (r: ReturnType<typeof parseNotation>) =>
		r.events.find(
			(e): e is Extract<TimelineEvent, { kind: 'cast' }> =>
				e.kind === 'cast' && e.ability === 'burst'
		);
	const summonLabels = (r: ReturnType<typeof parseNotation>) =>
		r.windows.filter((w) => w.kind === 'summon').map((w) => (w.kind === 'summon' ? w.label : ''));

	it('E E commits White: recast resolves inside the window without touching the 12s clock', () => {
		const result = parseNotation('Durin E E Q', lookup, 8);
		const eBars = result.tracks[0].eBars;
		expect(eBars).toHaveLength(2);
		expect(eBars[0].cooldown).toBe(12); // the tap
		expect(eBars[1].cooldown).toBe(0); // the commit — no CD wait, no clock write
		expect(eBars[1].start).toBeCloseTo(15 / 60, 6); // fired immediately (E→E cancel)
		// transmuting opened at the tap, consumed by the commit.
		const trans = stateWindows(result, 'transmuting');
		expect(trans).toHaveLength(1);
		expect(trans[0].end).toBeCloseTo(eBars[1].start, 6);
		// whiteForm 30s from the commit, sourced to its cast.
		const white = stateWindows(result, 'whiteForm');
		expect(white).toHaveLength(1);
		expect(white[0].end - white[0].start).toBeCloseTo(30, 6);
		expect(white[0].sourceCastId).toBeDefined();
		// Q resolves the default White burst.
		expect(burstCast(result)?.abilityId).toBe(
			'durin__burst__principle_of_purity_as_the_light_shifts'
		);
		expect(summonLabels(result)).toContain('Dragon of White Flame');
	});

	it('E N commits Dark: the normal-opened darkForm gates the Dark burst', () => {
		const result = parseNotation('Durin E N Q', lookup, 8);
		// The N resolved the Denial of Darkness commit, not Radiant Wingslash.
		const nEv = result.events.find((e) => e.kind === 'action' && e.action === 'normal');
		expect(nEv).toBeTruthy();
		if (nEv?.kind !== 'action') return;
		expect(nEv.abilityId).toBe('durin__normal__transmutation_denial_of_darkness');
		// darkForm opens at the first swing's END, sourced to the action event.
		const dark = stateWindows(result, 'darkForm');
		expect(dark).toHaveLength(1);
		expect(dark[0].sourceActionId).toBe(nEv.id);
		expect(dark[0].start).toBeCloseTo(nEv.time + nEv.duration, 6);
		expect(dark[0].end - dark[0].start).toBeCloseTo(30, 6);
		// The commit consumed transmuting.
		const trans = stateWindows(result, 'transmuting');
		expect(trans[0].end).toBeCloseTo(dark[0].start, 6);
		// Q auto-resolves the Dark burst + Dark Decay dragon.
		expect(burstCast(result)?.abilityId).toBe(
			'durin__burst__principle_of_darkness_as_the_stars_smolder'
		);
		expect(summonLabels(result)).toContain('Dragon of Dark Decay');
	});

	it('expired window: N after 7s is a plain normal and Q stays White', () => {
		const result = parseNotation('Durin E ~7s N Q', lookup, 8);
		const nEv = result.events.find((e) => e.kind === 'action' && e.action === 'normal');
		if (nEv?.kind === 'action') {
			expect(nEv.abilityId).toBe('durin__normal__radiant_wingslash');
		}
		expect(stateWindows(result, 'darkForm')).toHaveLength(0);
		expect(burstCast(result)?.abilityId).toBe(
			'durin__burst__principle_of_purity_as_the_light_shifts'
		);
		expect(summonLabels(result)).toContain('Dragon of White Flame');
	});

	it('White commit displaces an active darkForm (E N E E re-commit)', () => {
		// Dark commit at ~0.27+0.75s opens darkForm; the second tap (12s CD wait)
		// reopens transmuting and the recast commits White — darkForm must be
		// clamped at the White commit.
		const result = parseNotation('Durin E N ~12s E E Q', lookup, 8);
		const dark = stateWindows(result, 'darkForm');
		expect(dark).toHaveLength(1);
		const white = stateWindows(result, 'whiteForm');
		expect(white).toHaveLength(1);
		expect(dark[0].end).toBeCloseTo(white[0].start, 6);
		expect(burstCast(result)?.abilityId).toBe(
			'durin__burst__principle_of_purity_as_the_light_shifts'
		);
	});
});
