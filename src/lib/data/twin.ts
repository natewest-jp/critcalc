/**
 * src/lib/data/twin.ts
 *
 * ⚓ The Traveler's twin, resolved (twin frames round, 2026-10-28). A Traveler's
 * JSON carries AETHER's timing in its base fields and Lumine's differences in
 * `twin.lumine` overlays (`TwinOverlay` in `$lib/types/ability.ts`). This is the
 * ONE reader of those overlays: it returns a character whose base fields ARE the
 * chosen twin's, so the parser and every other consumer read a plain
 * `CharacterData` and never learn that a twin exists.
 *
 * ⚠️ Runtime-import-free, so the Node audit and writers can load it directly.
 */

import type { CharacterData } from '$lib/types/character';
import type { Ability, AbilityVariant, NormalHit, Summon } from '$lib/types/ability';
import type { Twin } from '$lib/storage/records';

const resolved = new WeakMap<CharacterData, CharacterData>();

/** Whether this character carries any Lumine overlay at all. */
export function hasTwinOverlays(char: CharacterData): boolean {
	return char.abilities.some(
		(a) =>
			(a.abilityType === 'normal' && (a.twin || a.hits?.some((h) => h.twin))) ||
			((a.abilityType === 'skill' || a.abilityType === 'burst') &&
				(a.twin ||
					(a.variants ?? []).some((v) => v.twin || v.summons?.some((s) => s.twin)) ||
					(a.summons ?? []).some((s) => s.twin)))
	);
}

const summonFor = (s: Summon): Summon => (s.twin ? { ...s, ...s.twin.lumine } : s);
const hitFor = (h: NormalHit): NormalHit => (h.twin ? { ...h, ...h.twin.lumine } : h);
const variantFor = (v: AbilityVariant): AbilityVariant => {
	const out = v.twin ? { ...v, ...v.twin.lumine } : v;
	return out.summons?.some((s) => s.twin) ? { ...out, summons: out.summons.map(summonFor) } : out;
};

function abilityFor(a: Ability): Ability {
	if (a.abilityType === 'normal') {
		const out = a.twin ? { ...a, ...a.twin.lumine } : a;
		return out.hits?.some((h) => h.twin) ? { ...out, hits: out.hits.map(hitFor) } : out;
	}
	if (a.abilityType === 'skill' || a.abilityType === 'burst') {
		// ⚠ Spread through a widened type: the discriminated union rejects a spread of
		// one member's overlay onto the union, though every overlay field is shared.
		const out = (a.twin ? { ...a, ...a.twin.lumine } : a) as typeof a;
		return {
			...out,
			...(out.variants ? { variants: out.variants.map(variantFor) } : {}),
			...(out.summons ? { summons: out.summons.map(summonFor) } : {})
		} as typeof a;
	}
	return a;
}

/**
 * The character as `twin` plays it. Aether, or a character with no overlay,
 * returns the SAME object (so identity-keyed caches downstream keep working);
 * Lumine returns one memoised copy per loaded payload.
 */
export function forTwin(char: CharacterData, twin: Twin): CharacterData;
export function forTwin(char: CharacterData | null, twin: Twin): CharacterData | null;
export function forTwin(char: CharacterData | null, twin: Twin): CharacterData | null {
	if (!char || twin === 'aether' || !hasTwinOverlays(char)) return char;
	let out = resolved.get(char);
	if (!out) {
		out = { ...char, abilities: char.abilities.map(abilityFor) };
		resolved.set(char, out);
	}
	return out;
}
