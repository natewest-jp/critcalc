/**
 * src/lib/sim/chargeForms.test.ts
 *
 * ⚓ A CHARGED ATTACK THAT STATES ITS OWN ELEMENT, AND LANDS AFTER ITS CANCEL
 * (Columbina's Moondew Cleanse, 2026-10-16). With a Dendro teammate her `C` is
 * three Dendro hits at 50/58/80f that apply nothing (`chargeElement`
 * `applies: false`), and the earliest cancel is 43f — so `C > swap` must still
 * land all three on their own frames (`chargeLandsAfterCancel`), where the
 * melee rule would pile them onto the cancel.
 *
 * End to end over the shipped corpus, in FRAMES. The landing is read through
 * Raiden's Eye, which answers any damage the opponent takes 5 frames on: with
 * no aura to show, a hit's only visible consumer is a listener like this one.
 * (⚠️ Not Deepwood — it hears Skill and Burst hits only, as in game.)
 */
import { describe, it, expect } from 'vitest';
import type { CharacterData } from '$lib/types/character';
import { parseNotation } from '$lib/utils/notationParser';
import type { ParsedRotation } from '$lib/utils/notationParser';

const modules = import.meta.glob('../data/characters/*.json', { eager: true });
const corpus: CharacterData[] = Object.values(modules).map(
	(m) => (m as { default: CharacterData }).default
);
const byName = new Map(corpus.map((c) => [c.displayName, c]));
const lookup = (name: string): CharacterData | null => byName.get(name) ?? null;

const parse = (notation: string): ParsedRotation =>
	parseNotation(notation, lookup, 8, {}, {}, undefined);

const chargedOf = (r: ParsedRotation) => {
	const ev = r.events.find(
		(e) => e.kind === 'action' && e.characterId === 'columbina' && e.action === 'charged'
	);
	if (!ev || ev.kind !== 'action') throw new Error('no charged attack for columbina');
	return ev;
};

describe('Moondew Cleanse', () => {
	it('⚓⚓ lands its hits on their own frames after a swap cancels it', () => {
		const r = parse('Raiden E > Nahida E > Columbina C > Raiden N1');
		const c = chargedOf(r);
		expect(c.element).toBe('dendro');
		expect(c.duration).toBe(43); // the swap cancel, where the Dew is spent
		// The Eye answers the FIRST landing — 7 frames after the swap, not at it.
		const eye = r.applications
			.filter((a) => a.characterId === 'raiden_shogun' && a.time > c.time)
			.map((a) => a.time - c.time);
		expect(eye[0]).toBe(50 + 5);
	});

	it('applies nothing to the gauge, and her normals stay Hydro', () => {
		const r = parse('Nahida E > Columbina C N1');
		const c = chargedOf(r);
		const apps = r.applications.filter((a) => a.characterId === 'columbina');
		expect(apps.map((a) => a.element)).toEqual(['hydro']); // the N1 only
		expect(apps[0].time).toBeGreaterThan(c.time + c.duration);
	});

	it('without a Dendro teammate the C is the Hydro Charged Attack', () => {
		const r = parse('Furina E > Columbina C > Furina N1');
		const c = chargedOf(r);
		expect(c.element).toBe('hydro');
		const apps = r.applications.filter((a) => a.characterId === 'columbina');
		expect(apps.map((a) => [a.time - c.time, a.element])).toEqual([[57, 'hydro']]);
	});
});

describe("Neuvillette's Equitable Judgment (2026-10-17)", () => {
	// gcsim `neuvillette/charge.go`: a beam's frames are windup + 3 + charge-up
	// (209 − {0, 57, 111, 209} for 0–3 droplets) + 173 + end lag (C 30, swap 27);
	// its four applications land at beam start + 6, 78, 153 and 173.
	const beams = (notation: string) => {
		const r = parse(notation);
		return {
			blocks: r.events
				.filter(
					(e) => e.kind === 'action' && e.characterId === 'neuvillette' && e.action === 'charged'
				)
				.map((e) => ({ time: e.time, duration: (e as { duration: number }).duration })),
			apps: r.applications.filter((a) => a.characterId === 'neuvillette').map((a) => a.time)
		};
	};

	it('E Q C C C: three droplets each, so no charge-up — 206f apart (gcsim measured)', () => {
		const { blocks, apps } = beams('Neuvillette E Q C C C');
		expect(blocks.map((b) => b.duration)).toEqual([3 + 173 + 30, 3 + 173 + 30, 3 + 173 + 27]);
		const s = blocks[0].time + 3;
		expect(apps.filter((t) => t >= s && t <= s + 173)).toEqual([s + 6, s + 78, s + 153, s + 173]);
	});

	it('E C C: the skill drops three, so the second beam charges up in full', () => {
		const { blocks } = beams('Neuvillette E C C');
		expect(blocks.map((b) => b.duration)).toEqual([3 + 173 + 30, 3 + 209 + 173 + 27]);
	});

	it('a C out of nothing pays the windup and the whole charge-up', () => {
		expect(beams('Neuvillette C').blocks[0].duration).toBe(14 + 3 + 209 + 173 + 27);
	});
});
