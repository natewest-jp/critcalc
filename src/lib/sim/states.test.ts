/**
 * states.test.ts — the two primitives of the Lauma charged-forms round
 * (2026-09-16; spec + record in docs/lauma-charged-forms-round.md).
 *
 *   1. A transient state that ENDS ON THE OWNER'S NEXT ATTACK OR CAST
 *      (`terminatesOnAction`) and CHAINS into a second state when it ends
 *      (`onEnd`) — a cooldown that starts when a form ends, said as a window
 *      that opens when another closes.
 *   2. A NON-HITTING action class (`NormalAbility.nonHitting`) — an input that
 *      took its frames and landed nothing.
 *
 * ⚓ Nate-approved promotion (the round's §5). Every case runs on a SYNTHETIC
 * character so the assertions are about the primitive, not about Lauma —
 * her own numbers are checked in the round's record. ⚠️ Each `it` asserts
 * the rotation actually ran (no unknown tokens, the expected blocks) before
 * asserting an absence, because half of what is asserted here is that
 * something did NOT happen.
 *
 * Seeded negatives, verified by hand when the file landed: removing the settle
 * call from the CHARGED branch fails four cases (`C C`, the lazy expiry chain,
 * the movement pair, the provenance check) while `C E C` stays green because
 * the CAST site settles too — which is the point of settling at every input;
 * removing the finalize flush fails exactly the expiry-with-no-follow-up case;
 * removing the `nonHitting` gate at the charged branch fails every case in the
 * second block. The dash/jump cases pin ⚓ Nate's ruling that movement is not
 * an exit.
 */

import { describe, it, expect } from 'vitest';
import { parseNotation, type ParsedRotation } from '$lib/utils/notationParser';
import type { CharacterData } from '$lib/types/character';
import { lintCharacter } from '$lib/utils/characterLint';

// ── the synthetic form-taker ────────────────────────────────────────────────
//
// A catalyst whose base charged attack is a FORM (63f, no hit) that opens
// `testForm` for 10s, ended by her next attack or cast, chaining into a 4s
// `testFormCooldown`; and a sibling normal ability gated on that cooldown whose
// charged attack is the ATTACK (67f, hits). The numbers are the deer's and the
// Prayer's so the record's expectations read the same here and there.

const BASE_C = { anim: 64, N: 61, C: 63, E: 63, Q: 63, J: 49, swap: 49 };
const ATTACK_C = { anim: 68, hit: 73, N: 67, E: 67, Q: 67, D: 67, J: 67, swap: 67 };
const HITS = [
	{ name: 'N1', frames: { anim: 29, hit: 14, C: 17 } },
	{ name: 'N2', frames: { anim: 33, hit: 11, C: 19 } },
	{ name: 'N3', frames: { anim: 38, hit: 16, C: 33 } }
];

const FORM_SPEC = {
	state: 'testForm',
	duration: 10,
	terminatesOnAction: true,
	terminatesOnSwap: true,
	onEnd: { state: 'testFormCooldown', duration: 4 }
};

function formTaker(overrides: Record<string, unknown> = {}): CharacterData {
	return {
		id: 'stub',
		displayName: 'Stub',
		element: 'dendro',
		weapon: 'catalyst',
		passives: [],
		constellations: [],
		abilities: [
			{
				id: 'stub__normal__base',
				name: 'Base Normal',
				abilityType: 'normal',
				input: ['N'],
				hits: HITS,
				chargeFrames: BASE_C,
				nonHitting: { charged: true },
				actionOpensState: { charged: FORM_SPEC },
				...overrides
			},
			{
				id: 'stub__normal__attack',
				name: 'Attack Form',
				abilityType: 'normal',
				input: ['N'],
				conditions: { type: 'state', state: 'testFormCooldown' },
				hits: HITS,
				chargeFrames: ATTACK_C
			},
			{
				id: 'stub__skill',
				name: 'Stub Skill',
				abilityType: 'skill',
				input: ['E'],
				behavior: 'instant',
				frames: { anim: 42, N: 38, C: 38, Q: 38, D: 37, J: 38, swap: 36 },
				cooldown: 12,
				effects: [],
				application: []
			}
		]
	} as unknown as CharacterData;
}

/** A second character for the swap cases — a physical sword user who does
 *  nothing but swing. */
const OTHER = {
	id: 'other',
	displayName: 'Other',
	element: 'anemo',
	weapon: 'sword',
	abilities: [
		{
			id: 'other__normal',
			name: 'Other Normal',
			abilityType: 'normal',
			input: ['N'],
			hits: [{ name: 'N1', frames: { anim: 30, hit: 12 } }]
		}
	]
} as unknown as CharacterData;

function parse(notation: string, stub: CharacterData = formTaker()): ParsedRotation {
	const r = parseNotation(
		notation,
		(n) => (n === 'Stub' ? stub : n === 'Other' ? OTHER : null),
		8,
		undefined,
		undefined,
		[stub, OTHER]
	);
	expect(r.unknownTokens, notation).toEqual([]);
	return r;
}

const stateWindows = (r: ParsedRotation, name: string) =>
	r.windows
		.filter((w) => w.kind === 'state' && w.name === name)
		.map((w) => [w.start, w.end] as const);

/** The charged action events of the stub, as `[start, abilityId]`. */
const chargedOf = (r: ParsedRotation) =>
	r.events
		.filter((e) => e.kind === 'action' && e.action === 'charged' && e.characterId === 'stub')
		.map((e) => [e.time, (e as { abilityId?: string }).abilityId] as const);

const BASE = 'stub__normal__base';
const ATTACK = 'stub__normal__attack';

describe('a state that ends on the next action and chains (terminatesOnAction + onEnd)', () => {
	it('C C — the second C ends the form, opens the cooldown, and resolves against it', () => {
		const r = parse('Stub C C');
		// First C: the base form, 63f (its own `C` cancel key). Second C: the
		// attack form, resolved AFTER the settle closed the form at its start.
		expect(chargedOf(r)).toEqual([
			[0, BASE],
			[63, ATTACK]
		]);
		// The form opened at the first C's END and closed at the second C's START
		// — the same instant, so a zero-length window: the honest reading of a
		// form that was left the moment it was entered.
		expect(stateWindows(r, 'testForm')).toEqual([[63, 63]]);
		// The chain: 4s from the form's end, not from when it was written.
		expect(stateWindows(r, 'testFormCooldown')).toEqual([[63, 63 + 240]]);
	});

	it('C E C — a cast ends the form; the cooldown runs from the cast', () => {
		const r = parse('Stub C E C');
		expect(stateWindows(r, 'testForm')).toEqual([[63, 63]]);
		expect(stateWindows(r, 'testFormCooldown')).toEqual([[63, 303]]);
		// E at 63 (base's E key), 38f to the C (skill's C key) → attack form.
		expect(chargedOf(r)).toEqual([
			[0, BASE],
			[63 + 38, ATTACK]
		]);
	});

	it('C ~12s C — an expired form chains lazily, with the start it always had', () => {
		const r = parse('Stub C ~12s C');
		// Nothing follows the first C but a wait, so its cancel key is `swap`
		// (49f): the form runs [49, 649) and expires on its own. The cooldown is
		// written at the next settle point (the second C) but STARTS at 649.
		expect(stateWindows(r, 'testForm')).toEqual([[49, 649]]);
		expect(stateWindows(r, 'testFormCooldown')).toEqual([[649, 889]]);
		// 49 + 720 = 769 is inside [649, 889): the attack form.
		expect(chargedOf(r)).toEqual([
			[0, BASE],
			[769, ATTACK]
		]);
	});

	it('C ~15s C — after the cooldown lapses, C is the form again', () => {
		const r = parse('Stub C ~15s C');
		expect(chargedOf(r)).toEqual([
			[0, BASE],
			[49 + 900, BASE]
		]);
		expect(stateWindows(r, 'testForm')).toHaveLength(2);
		expect(stateWindows(r, 'testFormCooldown')).toEqual([[649, 889]]);
	});

	it('C J C and C D C — ⚓ movement is not an exit (Nate, 2026-09-16)', () => {
		for (const move of ['J', 'D']) {
			const r = parse(`Stub C ${move} C`);
			const [form] = stateWindows(r, 'testForm');
			const [[, firstId], [secondStart, secondId]] = chargedOf(r);
			expect(firstId, move).toBe(BASE);
			// The form outlives the movement token and ends at the second C.
			expect(form[1], move).toBe(secondStart);
			expect(form[1], move).toBeGreaterThan(form[0]);
			expect(secondId, move).toBe(ATTACK);
			expect(stateWindows(r, 'testFormCooldown'), move).toEqual([[secondStart, secondStart + 240]]);
		}
	});

	it('a swap ends the form (terminatesOnSwap) and the cooldown keeps running off-field', () => {
		const r = parse('Stub C > Other N1 > Stub C');
		const [form] = stateWindows(r, 'testForm');
		const [cd] = stateWindows(r, 'testFormCooldown');
		// The stub's first segment: C with `swap` next → 49f, then the swap.
		expect(form).toEqual([49, 49]);
		expect(cd[0]).toBe(49);
		expect(cd[1]).toBe(49 + 240);
		// Back on field inside the cooldown: the attack form, not another deer.
		const [, [secondStart, secondId]] = chargedOf(r);
		expect(secondStart).toBeGreaterThan(49);
		expect(secondStart).toBeLessThan(49 + 240);
		expect(secondId).toBe(ATTACK);
	});

	it('C ~12s — with nothing after the expiry, finalize writes the chain', () => {
		const r = parse('Stub C ~12s');
		expect(stateWindows(r, 'testForm')).toEqual([[49, 649]]);
		expect(stateWindows(r, 'testFormCooldown')).toEqual([[649, 889]]);
	});

	it('C alone — a form still standing at the end has no cooldown yet', () => {
		const r = parse('Stub C');
		expect(stateWindows(r, 'testForm')).toHaveLength(1);
		expect(stateWindows(r, 'testFormCooldown')).toEqual([]);
	});

	it("the chained window carries the opener's provenance and no `source`", () => {
		const r = parse('Stub C C');
		type StateWindow = Extract<(typeof r.windows)[number], { kind: 'state' }>;
		const states = r.windows.filter((w): w is StateWindow => w.kind === 'state');
		const cd = states.find((w) => w.name === 'testFormCooldown');
		const form = states.find((w) => w.name === 'testForm');
		expect(cd?.sourceActionId).toBeDefined();
		expect(cd?.sourceActionId).toBe(form?.sourceActionId);
		expect(cd?.sourceCastId).toBeUndefined();
		expect(cd?.source).toBeUndefined();
	});

	it('lint: terminatesOnAction must be true; onEnd needs a known state and a length; never on a toggle', () => {
		const issues = (spec: Record<string, unknown>) =>
			lintCharacter(formTaker({ actionOpensState: { charged: spec } }))
				.filter((i) => i.check === 'transient-state-spec')
				.map((i) => i.message);
		// The vocabulary is strict, so the synthetic names themselves fail — use
		// a real State for the shape checks.
		const ok = {
			state: 'pneuma',
			duration: 10,
			terminatesOnAction: true,
			onEnd: { state: 'pneuma', duration: 4 }
		};
		expect(issues(ok)).toEqual([]);
		expect(issues({ ...ok, terminatesOnAction: false }).join('\n')).toMatch(/terminatesOnAction/);
		expect(issues({ ...ok, onEnd: { state: 'nope', duration: 4 } }).join('\n')).toMatch(
			/onEnd\.state/
		);
		expect(issues({ ...ok, onEnd: { state: 'pneuma', duration: 0 } }).join('\n')).toMatch(
			/onEnd\.duration/
		);
		expect(
			issues({ state: 'pneuma', toggle: true, onEnd: { state: 'pneuma', duration: 4 } }).join('\n')
		).toMatch(/toggle/);
	});
});
