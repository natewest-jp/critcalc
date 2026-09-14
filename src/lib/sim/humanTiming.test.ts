/**
 * Human timing (2026-09-14) — the transition rule and its reach into the parse.
 *
 * ⚓ Nate-approved promotion. The rule is the whole feature: a stored input
 * costs nothing, everything else costs the pad. The parse-level half pins where
 * pads may land, that "off" is really off, and that the default parse is
 * byte-identical with the feature absent — the last is what protects every
 * other reader of the timeline from this one.
 */
import { describe, expect, it } from 'vitest';
import type { CharacterData } from '$lib/types/character';
import { parseNotation } from '$lib/utils/notationParser';
import { FULL_ANIMATION_KEY } from '$lib/utils/frames';
import {
	cancelKeyFor,
	isBufferedTransition,
	padFramesAfter,
	type HumanTiming
} from './humanTiming';

const modules = import.meta.glob('../data/characters/*.json', { eager: true });
const all: CharacterData[] = Object.values(modules).map(
	(m) => (m as { default: CharacterData }).default
);
const lookup = (name: string) =>
	all.find(
		(c) => c.displayName.toLowerCase() === name.toLowerCase() || c.id === name.toLowerCase()
	) ?? null;

const PAD: HumanTiming = { padFrames: 10, fullAnimations: false };
const ANIM: HumanTiming = { padFrames: 0, fullAnimations: true };

const parse = (notation: string, ht: HumanTiming | null | undefined) =>
	parseNotation(notation, lookup, 9, undefined, undefined, undefined, ht);

/** The pad blocks of a parse as `[trackIndex, start, after]`, in order. */
const pads = (notation: string, ht: HumanTiming) =>
	parse(notation, ht).tracks.flatMap((t, i) =>
		t.inputBlocks.filter((b) => b.kind === 'pad').map((b) => [i, b.start, b.padAfter] as const)
	);

describe('the transition rule', () => {
	it('a swing stores the next swing — and only the next swing', () => {
		expect(isBufferedTransition('normal', 'N', false)).toBe(true);
		expect(isBufferedTransition('charged', 'N', false)).toBe(true);
		expect(isBufferedTransition('normal', 'C', false)).toBe(true);
		for (const next of ['E', 'Q', 'D', 'J', 'P', 'swap'] as const) {
			expect(isBufferedTransition('normal', next, false)).toBe(false);
		}
	});
	it("a bow's charged attack is its aimed shot, which cannot be buffered", () => {
		expect(isBufferedTransition('normal', 'C', true)).toBe(false);
		expect(isBufferedTransition('normal', 'N', true)).toBe(true);
	});
	it('nothing but a swing stores anything', () => {
		for (const prev of ['skill', 'burst', 'plunge', 'dash', 'jump', 'swap'] as const) {
			expect(isBufferedTransition(prev, 'N', false)).toBe(false);
		}
	});
	it('the pad and the full animation ride the same set', () => {
		expect(padFramesAfter(PAD, 'normal', 'N', false)).toBe(0);
		expect(padFramesAfter(PAD, 'normal', 'E', false)).toBe(10);
		expect(cancelKeyFor(ANIM, 'normal', 'N', false)).toBe('N');
		expect(cancelKeyFor(ANIM, 'normal', 'E', false)).toBe(FULL_ANIMATION_KEY);
		expect(cancelKeyFor(PAD, 'normal', 'E', false)).toBe('E');
	});
	it('null is frame-perfect', () => {
		expect(padFramesAfter(null, 'skill', 'N', false)).toBe(0);
		expect(cancelKeyFor(null, 'skill', 'N', false)).toBe('N');
	});
});

describe('where a pad may land', () => {
	it('never inside a normal-attack string, nor between two strings', () => {
		expect(pads('Xiangling N5 N5', PAD)).toEqual([]);
	});
	it('not before a charged attack — unless the character is a bow', () => {
		expect(pads('Xiangling N1 C', PAD)).toEqual([]);
		expect(pads('Fischl N1 A', PAD)).toEqual([[0, expect.any(Number), 'normal']]);
	});
	it('after a skill, and at the head of every turn but the first', () => {
		const p = pads('Xiangling E > Bennett E', PAD);
		// Bennett's E is the rotation's last action: nothing follows, so no pad.
		expect(p.map(([track, , after]) => [track, after])).toEqual([
			[0, 'skill'],
			[1, 'swap']
		]);
	});
	it('never before a typed wait, never after the last action', () => {
		// E is followed by a wait (the player is already waiting) and Q by nothing.
		expect(pads('Bennett E ~1s Q', PAD)).toEqual([]);
		// Without the wait the E pads (Q follows); the Q still does not.
		expect(pads('Bennett E Q', PAD).map(([, , a]) => a)).toEqual(['skill']);
	});
	it('moves everything after it by exactly its length', () => {
		const base = parse('Xiangling E N3 Q', null);
		const padded = parse('Xiangling E N3 Q', PAD);
		// E · pad · N3 · pad · Q · (no pad: last action) → +20 frames
		expect(padded.totalDuration).toBe(base.totalDuration + 20);
	});
});

describe('the default is untouched', () => {
	const NOTATION = 'Xiangling E N3 Q > Fischl E N2 A Q > Bennett E Q ~1s N1 D';
	it('an "off" object is off: no pads, no time', () => {
		const off = parse(NOTATION, { padFrames: 0, fullAnimations: false });
		const base = parse(NOTATION, null);
		expect(off.totalDuration).toBe(base.totalDuration);
		expect(off.tracks.flatMap((t) => t.inputBlocks).some((b) => b.kind === 'pad')).toBe(false);
	});
	it('omitted and null parse byte-identically', () => {
		expect(JSON.stringify(parse(NOTATION, undefined))).toBe(JSON.stringify(parse(NOTATION, null)));
	});
	it('full animations never lengthen a buffered swing', () => {
		const base = parse('Xiangling N5', null);
		const anim = parse('Xiangling N5', ANIM);
		// the string's four buffered swings keep their slice; only the LAST swing
		// (its next is the rotation's end, resolved as 'swap') grows
		const width = (r: typeof base) => r.tracks[0].inputBlocks[0].duration;
		expect(width(anim)).toBeGreaterThanOrEqual(width(base));
		const baseEvents = base.events.filter((e) => e.kind === 'action');
		const animEvents = anim.events.filter((e) => e.kind === 'action');
		for (let i = 0; i < baseEvents.length - 1; i++) {
			expect(animEvents[i].time).toBe(baseEvents[i].time);
		}
	});
});
