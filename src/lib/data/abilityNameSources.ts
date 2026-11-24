/**
 * Which of a character's English names and labels the page shows: every
 * ability, passive, and constellation, every summon and shield an ability or
 * its variants raise, and the labels the planner prints for them (a variant's
 * "Hold Lv.2", an effect's attribution "A1: Rekindle", a threshold's fire, a
 * drawn stack count), and the faction bonuses' names. A label composed from a game name and our words comes
 * apart through `nameParts.ts`. One list for the generator
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

/** The labels an entry's effects print, at any depth: an `attribution`, and a
 *  trigger's `label` (a stack threshold's fire). */
function printed(o: unknown, out: Set<string>) {
	if (Array.isArray(o)) for (const x of o) printed(x, out);
	else if (o && typeof o === 'object')
		for (const [k, v] of Object.entries(o)) {
			if (k === 'attribution' && typeof v === 'string') out.add(v);
			else if (k === 'trigger' && v && typeof (v as { label?: unknown }).label === 'string')
				out.add((v as { label: string }).label);
			if (k !== 'conditions') printed(v, out);
		}
}

export function namesOf(c: CharacterData): string[] {
	const out = new Set<string>();
	const raised = (host: Host) => {
		for (const s of host.summons ?? []) if (s.label) out.add(s.label);
		for (const e of host.effects ?? []) if (e.type === 'shield' && e.label) out.add(e.label);
	};
	for (const a of c.abilities ?? []) {
		out.add(a.name);
		raised(a as Host);
		for (const v of ('variants' in a ? a.variants : undefined) ?? []) {
			raised(v as Host);
			if (v.label) out.add(v.label);
		}
		const drawn = (a as { drawsStacks?: { label?: string } }).drawsStacks?.label;
		if (drawn) out.add(drawn);
	}
	for (const p of c.passives ?? []) out.add(p.name);
	for (const k of c.constellations ?? []) out.add(k.name);
	for (const f of (c as { factionBonuses?: { name: string }[] }).factionBonuses ?? [])
		out.add(f.name);
	printed([c.abilities, c.passives, c.constellations], out);
	return [...out].filter(Boolean);
}
