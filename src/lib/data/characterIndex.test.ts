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
import { artifactShredSources, characterShredSources } from '$lib/capabilities/shredSources';
import { shredSources } from './shredSources.generated';
import { decodeCoverage, deriveCoverage, encodeCoverage } from '$lib/coverage/deriveCoverage';
import { isCurated } from '$lib/utils/characterLint';
import {
	declaredCastTokens,
	hasChargeFrames,
	hasPlungeFrames,
	hasSpecialChargeFrames
} from '$lib/utils/castTokens';

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
	'release',
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
	entry.charged = hasChargeFrames(source);
	if (hasSpecialChargeFrames(source)) entry.specialCharge = true;
	if (source.abilities.some((a) => a.abilityType === 'normal' && a.chargeSpin))
		entry.chargeSpin = true;
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

	// A corpus fact, not kit shape, so it is checked here rather than in
	// lintCharacter (synthetic test kits carry no patch): every character but the
	// planner's `blank` slot names the patch it released in — the coverage page's
	// "Newest first" sort reads it.
	it('every character carries a "major.minor" release patch', () => {
		for (const source of sources) {
			if (source.id === 'blank') continue;
			expect(source.release, source.id).toMatch(/^\d+\.\d+$/);
		}
	});

	// The same kind of corpus fact: a character with no region is hidden by every
	// Region chip (seven were, until the pre-launch sweep). ⚓ Nate, 2026-10-15:
	// the Travelers, Skirk and Aloy come from outside Teyvat and read "Other". A
	// new nation is a deliberate edit to this list, and so is a misspelt one.
	it('every character names one of the known regions', () => {
		const REGIONS = [
			'Fontaine',
			'Inazuma',
			'Liyue',
			'Mondstadt',
			'Natlan',
			'Nod-Krai',
			'Other',
			'Snezhnaya',
			'Sumeru'
		];
		for (const source of sources) {
			if (source.id === 'blank') continue;
			expect(REGIONS, source.id).toContain(source.region);
		}
	});

	it('lists every shred source the data derives', () => {
		const artifacts = Object.entries(import.meta.glob('./artifacts/*.json', { eager: true }))
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([, mod]) => (mod as { default: Parameters<typeof artifactShredSources>[0] }).default);
		const expected = [
			...[...sources]
				.sort((a, b) => a.id.localeCompare(b.id))
				.flatMap((c) =>
					characterShredSources(
						c.id,
						c.displayName ?? c.name,
						deriveCharacterCapabilities(c).capabilities
					)
				),
			...artifacts.flatMap(artifactShredSources)
		];
		expect(shredSources).toEqual(expected);
	});

	it('matches the source JSON on every index field', () => {
		const byId = new Map(characterIndex.map((e) => [e.id, e]));
		for (const source of sources) {
			expect(byId.get(source.id), source.id).toEqual(indexFieldsOf(source));
		}
	});
});
