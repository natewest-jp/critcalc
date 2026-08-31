/**
 * summonTickStacks.test.ts — a summon tick reaches the stack machinery, and a
 * stack key can outlive a segment (Half A, 2026-08-31).
 *
 * ⚓⚓ TWO CLAIMS, AND THE SECOND IS THE ONE THE ROUND HAD TO DECIDE FIRST.
 *   1. The LIVE tick chain dispatches `gainStacks`/`consumeStacks` at the tick's
 *      own instant, so Tugarin's maul activates Alyosha's Hunter's Mark.
 *   2. `gainStacks.scope: 'rotation'` gives a key a home that is not the
 *      per-segment pool — which is what makes (1) possible at all, because a
 *      tick fires while its owner may be OFF FIELD, inside another character's
 *      segment, where the owner has no segment pool to write.
 *
 * ⚠️⚠️ THE HALF-B SWEEP (`utils/summonTickBuffs.test.ts`) CANNOT SEE ANY OF THIS
 * AND MUST NOT BE MADE TO. It guards the TEAM surface, where one window is
 * extended in place by the next tick and the SPAN is the signature. An
 * active-target activation is a per-RECEIVER slice: one activation is several
 * windows, each exactly the effect's own duration, fused only at the projection.
 * That is why the last `describe` here asserts the projected BAR — the span
 * claim, made where the span actually exists.
 *
 * ⚠️ Several assertions below are ABSENCES (`Alyosha Q` at C0 draws nothing),
 * so a notation the parser could not read would satisfy them. `parseAt` asserts
 * the rotation actually ran — the harness `shields.test.ts` had to grow for the
 * same reason.
 */

import { describe, it, expect } from 'vitest';
import { parseNotation, type ParsedRotation, type TimelineWindow } from '$lib/utils/notationParser';
import { projectCharReceivedBuffRows } from '$lib/timeline/charReceivedBuffRows';
import type { CharacterData } from '$lib/types/character';
import type { Effect } from '$lib/types/ability';
import { createCharState, type CharState } from './charState';
import { dispatchGainStacksOnHit, stackScopeOf } from './stacks';
import type { HitEvent } from './hits';

const modules = import.meta.glob('../data/characters/*.json', { eager: true });
const all: CharacterData[] = Object.values(modules).map(
	(m) => (m as { default: CharacterData }).default
);
const byId = new Map(all.map((c) => [c.id, c]));
const byName = new Map(all.map((c) => [c.displayName, c]));

type BuffWindow = Extract<TimelineWindow, { kind: 'buff' }>;

function parseAt(notation: string, cLevel: number): ParsedRotation {
	const team = [...new Set(notation.split('>').map((s) => s.trim().split(/\s+/)[0]))]
		.map((n) => byName.get(n))
		.filter((c): c is CharacterData => c !== undefined);
	const r = parseNotation(
		notation,
		(n) => byName.get(n) ?? null,
		8,
		{ alyosha: cLevel },
		undefined,
		team
	);
	expect(r.unknownTokens, `"${notation}" @C${cLevel}`).toEqual([]);
	expect(
		r.events.filter((e) => e.kind === 'cast').length,
		`"${notation}" @C${cLevel} cast events`
	).toBeGreaterThan(0);
	return r;
}

/** Every instant a summon of `char` ticked, as the parse published them. */
function tickInstants(r: ParsedRotation, charId: string): Set<number> {
	const out = new Set<number>();
	for (const w of r.windows)
		if (w.kind === 'summon' && w.characterId === charId) for (const t of w.ticks ?? []) out.add(t);
	return out;
}

/** Buff windows that OPEN on a tick instant and NOT on a cast instant.
 *
 *  ⚠️⚠️ THE CAST EXCLUSION IS LOAD-BEARING and is borrowed verbatim from the
 *  Half-B sweep, which watched its own guard fail to fail without it: a
 *  summon-spawning cast's `fieldStart` is often exactly where the first tick can
 *  land, so "a window starts on a tick" is satisfiable by coincidence.
 *  ⛔ Never relax it. */
function tickAnchored(r: ParsedRotation, charId: string): BuffWindow[] {
	const ticks = tickInstants(r, charId);
	const castInstants = new Set<number>();
	for (const e of r.events)
		if (e.kind === 'cast') {
			castInstants.add(e.time);
			castInstants.add(e.fieldStart);
		}
	return r.windows.filter(
		(w): w is BuffWindow =>
			w.kind === 'buff' &&
			w.characterId === charId &&
			ticks.has(w.start) &&
			!castInstants.has(w.start)
	);
}

const ATK_BUFFS = (w: BuffWindow): boolean =>
	(w.effects ?? []).some((e) => e.type === 'buff' && e.stat === 'atk%');

// ---------------------------------------------------------------------------
// The container decision, asserted at the dispatcher
// ---------------------------------------------------------------------------

describe('a summon tick writes only a rotation-scoped key', () => {
	/** A holder with ONE `onHit` gainStacks, at the given scope. ⚓ The two cases
	 *  differ in exactly one field, which is the whole point: the scope is the
	 *  only thing deciding whether a tick can land. */
	const holderWith = (scope: 'segment' | 'rotation'): CharacterData =>
		({
			id: 'stub',
			displayName: 'Stub',
			element: 'electro',
			weapon: 'polearm',
			abilities: [
				{
					id: 'stub__burst',
					name: 'Stub Burst',
					abilityType: 'burst',
					input: ['Q'],
					behavior: 'instant',
					effects: [
						{
							type: 'gainStacks',
							target: 'self',
							trigger: { type: 'onHit', abilityType: 'burst' },
							key: 'stubMark',
							amount: 1,
							max: 2,
							...(scope === 'rotation' ? { scope } : {})
						} as Effect
					]
				}
			]
		}) as unknown as CharacterData;

	/** A tick: delivered by an entity, carrying its owner's id. */
	const tick: HitEvent = {
		characterId: 'stub',
		time: 120,
		abilityType: 'burst',
		damageTag: 'burst',
		abilityName: 'Stub Summon',
		viaEntity: true,
		sourceEventId: -1
	};

	const fire = (holder: CharacterData): CharState => {
		const state = createCharState();
		dispatchGainStacksOnHit(
			[holder],
			tick,
			() => new Set<string>(),
			new Map([['stub', 6]]),
			() => state,
			// ⚓ NULL — the tick has no segment pool, which is the container
			// decision made structural. ⛔ Never hand this a live segment pool.
			null
		);
		return state;
	};

	it('a rotation-scoped grant lands on the holder CharState', () => {
		const holder = holderWith('rotation');
		expect(stackScopeOf(holder, 'stubMark')).toBe('rotation');
		expect(fire(holder).rotationStacks.get('stubMark')).toBe(1);
	});

	it('a segment-scoped grant lands NOWHERE — it is dropped, not redirected', () => {
		const holder = holderWith('segment');
		expect(stackScopeOf(holder, 'stubMark')).toBe('segment');
		const state = fire(holder);
		// ⚠️ All three pools, not just the obvious one: the failure this guards
		// against is a fallback that "makes it work" by writing whichever map is
		// to hand — the on-field character's, or the team/others accrual map.
		expect(state.rotationStacks.size).toBe(0);
		expect(state.onHitStacks.size).toBe(0);
		expect(state.onHitStackInstances.size).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// Alyosha — the round's one customer
// ---------------------------------------------------------------------------

describe("Tugarin's maul activates the Hunter's Mark", () => {
	it('C0: the FIRST maul activates the one mark, and no later maul does', () => {
		const r = parseAt('Alyosha E Q', 0);
		const windows = tickAnchored(r, 'alyosha').filter(ATK_BUFFS);
		// ⚓ Exactly one. At C0 the burst applies no mark of its own, so Tugarin
		// consumes the mark the skill left and the remaining mauls find nothing.
		expect(windows.length).toBe(1);
		const ticks = [...tickInstants(r, 'alyosha')].sort((a, b) => a - b);
		expect(windows[0].start).toBe(ticks[0]);
		// Hunter's Precision runs its own 15s from that maul.
		expect(windows[0].end - windows[0].start).toBe(15 * 60);
	});

	it('C0: a burst cast with NO mark up activates nothing at all', () => {
		// ⚠️⚠️ THE SNAPSHOT GUARD. A `stacks` Condition with no map to read is
		// UNRESOLVABLE, not false, and `deriveBuffWindows` drops only a definitive
		// false — so before the tick's stack snapshot was stamped onto the
		// synthesized hit, this rotation drew Hunter's Precision off every maul
		// with no mark to activate. Measured, then fixed.
		const r = parseAt('Alyosha Q', 0);
		expect(r.windows.filter((w) => w.kind === 'buff')).toEqual([]);
	});

	it('C2: the first maul APPLIES without activating; every maul after activates', () => {
		// ⚓ "This effect does not activate existing Hunter's Marks" — C2's own
		// clause, and the reason the activation gate is `min: 2` at C2 and
		// `min: 1` below it. Both dispatch pipelines run gains → snapshot →
		// consumes, so C2's own application is already counted in the snapshot.
		const r = parseAt('Alyosha Q', 2);
		const ticks = [...tickInstants(r, 'alyosha')].sort((a, b) => a - b);
		const starts = new Set(
			tickAnchored(r, 'alyosha')
				.filter(ATK_BUFFS)
				.map((w) => w.start)
		);
		expect(starts.has(ticks[0])).toBe(false);
		expect(starts.has(ticks[1])).toBe(true);
	});
});

describe('the mark is a state on the OPPONENT, so it survives a swap', () => {
	// ⚠️ Both rotations drew NOTHING before `scope: 'rotation'` — the skill's
	// caveat named them by name. A segment-scoped pool resets at every segment
	// start, including one handed back to the same character.
	for (const notation of ['Alyosha N4 > Fischl E > Alyosha E', 'Alyosha N4 > Alyosha E']) {
		it(`"${notation}" activates on the skill cast`, () => {
			const r = parseAt(notation, 0);
			const atk = r.windows.filter(
				(w): w is BuffWindow => w.kind === 'buff' && w.characterId === 'alyosha' && ATK_BUFFS(w)
			);
			expect(atk.length).toBeGreaterThan(0);
		});
	}
});

describe('the projection fuses one activation per maul into ONE bar', () => {
	it('C2: a single received row spanning past the burst', () => {
		const r = parseAt('Alyosha E Q', 2);
		const rows = projectCharReceivedBuffRows(r.windows, (id) => byId.get(id) ?? null);
		const atkRows = rows.filter((row) => row.primaryStat === 'atk%');
		// ⚓ ONE row and ONE bar: nine per-tick windows, refresh-merged.
		expect(atkRows.length).toBe(1);
		expect(atkRows[0].bars.length).toBe(1);
		// Longer than the effect's own 15s — the span claim, made where the span
		// exists. ⛔ Not asserted on the windows: those are per-receiver slices.
		expect(atkRows[0].bars[0].end - atkRows[0].bars[0].start).toBeGreaterThan(15 * 60);
	});
});
