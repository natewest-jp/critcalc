/**
 * src/lib/sim/jahodaFlask.test.ts
 *
 * ⚓ Jahoda's flask (`StanceFill`, 2026-11-27; ⚓ Nate: model the fill and the
 * re-press exit, no attack exit). Every number is gcsim's (41bfe4915
 * jahoda/skill.go, cons.go), cited in the character's curator notes: the flask
 * polls from 37f every 30f, +20 for its locked element, full at 100, drained 4f
 * later; the drain hit lands 2f (full) or 4f (unfilled) after the end; the next
 * action starts `skillCancelFrames[next]` after it; the cooldown is 930f from
 * it. Under Ascendant Gleam a full flask fires ten Meowballs in its element,
 * fired from 129f after the drain every 116f and landing 13f later, and C6
 * opens 20s of CRIT for Moonsign members at the drain.
 */
import { describe, expect, it } from 'vitest';
import { parseNotation } from '$lib/utils/notationParser';
import type { CharacterData } from '$lib/types/character';
import type { CastEvent, TimelineWindow } from '$lib/utils/rotationEvents';

const all = Object.values(import.meta.glob('../data/characters/*.json', { eager: true })).map(
	(m) => (m as { default: CharacterData }).default
);
const byName = new Map(all.map((c) => [c.displayName, c]));
const lookup = (n: string) => byName.get(n) ?? null;

function parse(notation: string, team: string[], cons: Record<string, number> = {}) {
	const r = parseNotation(notation, lookup, 8, cons, {}, team.map(lookup));
	const press = r.events.find(
		(e): e is CastEvent =>
			e.kind === 'cast' && e.abilityId === 'jahoda__skill__savvy_strategy_splitting_the_spoils'
	)!;
	const stance = r.windows.find(
		(w) => w.kind === 'state' && w.characterId === 'jahoda' && w.name === 'inStance'
	)!;
	const after = (who: string) =>
		r.events.find((e) => e.kind === 'action' && e.characterId === who && e.time > press.time)?.time;
	const meowballs = r.windows.find(
		(w): w is Extract<TimelineWindow, { kind: 'summon' }> =>
			w.kind === 'summon' && w.label === 'Meowball'
	);
	const anemo = r.applications
		.filter((a) => a.characterId === 'jahoda' && a.element === 'anemo')
		.map((a) => a.time - press.time);
	return { r, press, stance, after, meowballs, anemo };
}

/** Bennett's Pyro holds through the stance; Flins and Ineffa make Gleam. */
const GLEAM = ['Bennett', 'Jahoda', 'Flins', 'Ineffa'];
const NO_GLEAM = ['Bennett', 'Jahoda', 'Xingqiu', 'Kaeya'];

describe("Jahoda's flask", () => {
	it('a steady aura fills it at 157f: the stance ends 4f later, and everything follows the end', () => {
		const { press, stance, after, anemo } = parse('Bennett E > Jahoda E N1', NO_GLEAM);
		const end = press.time + 161;
		expect(stance.end).toBe(end);
		// The Filled Treasure Flask, 2f after the drain: the cast's one hit.
		expect(anemo).toEqual([163]);
		expect(press.hitsAt).toEqual([end + 2]);
		expect(press.filledAt).toBe(end);
		expect(after('jahoda')).toBe(end + 43);
		expect(press.readyAt).toBe(end + 930);
	});

	it('with nothing to absorb it runs its full 364f and drains unfilled', () => {
		const { press, stance, after, anemo } = parse('Jahoda E N1', NO_GLEAM);
		expect(stance.end - press.time).toBe(364);
		expect(anemo).toEqual([368]);
		expect(press.filledAt).toBeUndefined();
		expect(after('jahoda')).toBe(press.time + 364 + 43);
		expect(press.readyAt).toBe(press.time + 364 + 930);
	});

	it('a swap waits for the end too', () => {
		const { press, after } = parse('Jahoda E > Xingqiu N1', NO_GLEAM);
		expect(after('xingqiu')).toBeGreaterThanOrEqual(press.time + 364 + 41);
	});

	it('the re-press ends it at once and drains unfilled 4f later', () => {
		const { press, stance, after, anemo } = parse('Jahoda E E N1', NO_GLEAM);
		expect(stance.end - press.time).toBe(42);
		expect(anemo).toEqual([46]);
		expect(after('jahoda')).toBe(press.time + 42 + 43);
		expect(press.readyAt).toBe(press.time + 42 + 930);
	});

	it('under Ascendant Gleam a full flask fires ten Meowballs in its element', () => {
		const { r, press, meowballs } = parse('Bennett E > Jahoda E ~25s', GLEAM);
		const end = press.time + 161;
		expect(meowballs?.start).toBe(end);
		const lands = Array.from({ length: 10 }, (_, k) => end + 142 + 116 * k);
		expect(meowballs?.absorbedTicks?.map((m) => [m.time, m.element])).toEqual(
			lands.map((t) => [t, 'pyro'])
		);
		// ICDTagNone: every Meowball applies.
		expect(
			r.applications
				.filter((a) => a.characterId === 'jahoda' && a.element === 'pyro')
				.map((a) => a.time)
		).toEqual(lands);
	});

	it('no Meowballs without Gleam, and none from a flask that never filled', () => {
		expect(parse('Bennett E > Jahoda E ~25s', NO_GLEAM).meowballs).toBeUndefined();
		expect(parse('Jahoda E ~25s', GLEAM).meowballs).toBeUndefined();
	});

	it('C6 opens 20s of CRIT at the drain, for Moonsign members only', () => {
		const { r, press } = parse('Bennett E > Jahoda E > Flins N1 > Bennett N1', GLEAM, {
			jahoda: 6
		});
		const end = press.time + 161;
		const crit = r.windows.filter(
			(w): w is Extract<TimelineWindow, { kind: 'buff' }> =>
				w.kind === 'buff' &&
				w.characterId === 'jahoda' &&
				w.effects.some((e) => e.type === 'buff' && e.stat === 'critDmg')
		);
		expect(crit.map((w) => w.receiverId)).toEqual(['jahoda', 'flins']);
		expect(crit[0].start).toBe(end);
		expect(crit.every((w) => w.end <= end + 1200)).toBe(true);
		// Not at C5, and not from a flask that never filled.
		const none = (n: string, c: number) =>
			parse(n, GLEAM, { jahoda: c }).r.windows.some(
				(w) =>
					w.kind === 'buff' &&
					w.characterId === 'jahoda' &&
					w.effects.some((e) => e.type === 'buff' && e.stat === 'critDmg')
			);
		expect(none('Bennett E > Jahoda E > Flins N1', 5)).toBe(false);
		expect(none('Jahoda E > Flins N1', 6)).toBe(false);
	});
});
