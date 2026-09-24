import { describe, expect, it } from 'vitest';
import { parseNotation } from '$lib/utils/notationParser';
import type { CharacterData } from '$lib/types/character';
import { notationTints } from './notationTints';

const modules = import.meta.glob('../data/characters/*.json', { eager: true });
const all = Object.values(modules).map((m) => (m as { default: CharacterData }).default);
const byName = new Map(all.map((c) => [c.displayName, c]));
const lookup = (name: string): CharacterData | null => byName.get(name) ?? null;
const byId = new Map(all.map((c) => [c.id, c]));

/** The element each occurrence of `token` in `notation` resolved to, in order. */
function tintsOf(notation: string, token: string, slots?: string[]) {
	const team = slots?.map((id) => byId.get(id) ?? null);
	const tints = notationTints(parseNotation(notation, lookup, 8, undefined, undefined, team));
	const out: (string | null)[] = [];
	for (const t of tints) if (notation.slice(t.from, t.to) === token) out.push(t.element);
	return out;
}

describe('notationTints — the notation wears what the chart resolved', () => {
	it('a stance infusion tints the swings inside it, not the ones before', () => {
		// Cyno's normals are physical until his burst opens Pactsworn Pathclearer.
		expect(tintsOf('Cyno N1 Q N2', 'N1')).toEqual([null]);
		expect(tintsOf('Cyno N1 Q N2', 'N2')).toEqual(['electro']);
	});

	it('E/Q follow the pill: Varka in a Pyro party opens in Pyro', () => {
		const notation = 'Bennett E > Varka E Q';
		const slots = ['bennett', 'varka', 'sucrose', 'xiangling'];
		expect(tintsOf(notation, 'E', slots)).toEqual(['pyro', 'pyro']);
		expect(tintsOf(notation, 'Q', slots)).toEqual(['pyro']);
	});

	it('an E/Q with nothing special wears its caster', () => {
		expect(tintsOf('Xingqiu E Q', 'E')).toEqual(['hydro']);
	});

	it('a bracket repeat is one token per inner input, tinted by its first repeat', () => {
		const t = tintsOf('Klee 3[N1 C]', 'N1');
		expect(t).toEqual(['pyro']);
	});
});
