import { afterEach, describe, it, expect } from 'vitest';
import { overwriteGetLocale } from '$lib/paraglide/runtime';
import type { CharacterData } from '$lib/types/character';
import sucrose from '$lib/data/characters/sucrose.json';
import { collectSlotCaveats } from './slotCaveats';

const kinds = (con: number) =>
	collectSlotCaveats([sucrose as unknown as CharacterData], { sucrose: con })[0].caveats.map(
		(c) => c.kind
	);

describe('collectSlotCaveats — the kind tag', () => {
	afterEach(() => overwriteGetLocale(() => 'en'));

	it('names a talent by its kind, and a constellation by its level', () => {
		expect(kinds(6)).toEqual(['Burst', 'Passive', 'C6']);
	});

	it("uses the game's words in Japanese, and keeps C6 as players write it", () => {
		overwriteGetLocale(() => 'ja');
		expect(kinds(6)).toEqual(['元素爆発', '固有天賦', 'C6']);
	});
});
