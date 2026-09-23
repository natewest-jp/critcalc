/**
 * src/lib/data/characterIndex.test.ts
 *
 * Guards the committed generated index (characterIndex.generated.ts) against
 * drift from the character JSON sources. If this fails, re-run
 * `npm run generate-character-index` and commit the result.
 */

import { describe, it, expect } from 'vitest';
import type { CharacterData, CharacterIndexEntry } from '$lib/types/character';
import { characterIndex, inTheWorks } from './characterIndex.generated';
import {
	collectGatedReactions,
	deriveCharacterCapabilities,
	summarizeCapabilities
} from '$lib/capabilities/deriveCapabilities';
import { decodeCoverage, deriveCoverage, encodeCoverage } from '$lib/coverage/deriveCoverage';
import { isCurated } from '$lib/utils/characterLint';
import { declaredCastTokens, hasPlungeFrames } from '$lib/utils/castTokens';

const INDEX_FIELDS = [
	'id',
	'name',
	'displayName',
	'element',
	'weapon',
	'gender',
	'affiliation',
	'region',
	'rarity',
	'noConstellations',
	'factions',
	'enablesReactions'
] as const;

const modules = import.meta.glob('./characters/*.json', { eager: true });
const sources = Object.values(modules)
	.map((mod) => (mod as { default?: CharacterData }).default ?? (mod as CharacterData))
	.filter((c): c is CharacterData => !!c?.id);

function indexFieldsOf(source: CharacterData): CharacterIndexEntry {
	const entry: Record<string, unknown> = {};
	for (const field of INDEX_FIELDS) {
		if (source[field] !== undefined) entry[field] = source[field];
	}
	entry.curated = isCurated(source);
	entry.casts = declaredCastTokens(source);
	entry.plunge = hasPlungeFrames(source);
	entry.caps = summarizeCapabilities(deriveCharacterCapabilities(source).capabilities);
	entry.coverage = encodeCoverage(deriveCoverage(source));
	const gated = collectGatedReactions(source);
	if (gated.length > 0) entry.gatedReactions = gated;
	return entry as CharacterIndexEntry;
}

describe('generated character index', () => {
	it('has exactly one entry per source character JSON', () => {
		const indexIds = characterIndex.map((e) => e.id).sort();
		const sourceIds = sources.map((c) => c.id).sort();
		expect(indexIds).toEqual(sourceIds);
	});

	it('lists the frameless characters as in the works', () => {
		const expected = characterIndex
			.filter((e) => e.id !== 'blank' && decodeCoverage(e.coverage)[0] === 'missing')
			.map((e) => e.displayName);
		expect(inTheWorks).toEqual(expected);
		expect(inTheWorks.length).toBeGreaterThan(0);
	});

	it('matches the source JSON on every index field', () => {
		const byId = new Map(characterIndex.map((e) => [e.id, e]));
		for (const source of sources) {
			expect(byId.get(source.id), source.id).toEqual(indexFieldsOf(source));
		}
	});
});
