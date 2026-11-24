/**
 * Which of a character's English names the page shows as the game's name:
 * every ability, passive, and constellation, and every summon and shield an
 * ability or its variants raise. One list for the generator
 * (`scripts/generate-ability-names.mjs`) and the test that holds its table
 * complete (`$lib/i18n/abilityNames.test.ts`).
 *
 * ⚠️ Runtime-import-free: the generator imports it under bare Node type
 * stripping.
 */
import type { CharacterData } from '$lib/types/character';

type Host = {
	summons?: { label?: string }[];
	effects?: { type: string; label?: string }[];
};

export function namesOf(c: CharacterData): string[] {
	const out = new Set<string>();
	const raised = (host: Host) => {
		for (const s of host.summons ?? []) if (s.label) out.add(s.label);
		for (const e of host.effects ?? []) if (e.type === 'shield' && e.label) out.add(e.label);
	};
	for (const a of c.abilities ?? []) {
		out.add(a.name);
		raised(a as Host);
		for (const v of ('variants' in a ? a.variants : undefined) ?? []) raised(v as Host);
	}
	for (const p of c.passives ?? []) out.add(p.name);
	for (const k of c.constellations ?? []) out.add(k.name);
	return [...out].filter(Boolean);
}
