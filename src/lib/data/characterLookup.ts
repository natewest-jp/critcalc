/**
 * src/lib/data/characterLookup.ts
 *
 * Synchronous accessors over the eager character identity index
 * (characterIndex.generated.ts). These serve the consumers that need only
 * scalar fields across the whole roster — the character selector grid,
 * CodeMirror autocomplete, saved-rotation slot resolution, and per-keystroke
 * notation→slot resolution.
 *
 * Full CharacterData payloads (abilities/passives/constellations) are NOT
 * available here — they load lazily per character via characterData.ts
 * (loadCharacter / getLoadedCharacter).
 */

import type { CharacterIndexEntry } from '$lib/types/character';
import type { Twin } from '$lib/storage/records';
import { tokenizeNotation } from '$lib/utils/tokenizer';
import { characterIndex } from './characterIndex.generated';

const indexById = new Map<string, CharacterIndexEntry>();
const idByDisplayName = new Map<string, string>(); // lowercase displayName -> id

/** A twin's name as the game writes it. */
export const twinLabel = (twin: Twin): string => (twin === 'aether' ? 'Aether' : 'Lumine');

/** A Traveler's notation name for a twin (`Anemo Lumine`), or the bare
 *  `Anemo Traveler` for null. */
export const travelerName = (displayName: string, twin: Twin | null): string =>
	twin ? displayName.replace(/Traveler$/, twinLabel(twin)) : displayName;

/** Notation names that pin a Traveler's twin, lowercased → the twin. */
const twinByName = new Map<string, Twin>();

for (const entry of characterIndex) {
	indexById.set(entry.id, entry);
	if (entry.displayName) {
		idByDisplayName.set(entry.displayName.toLowerCase(), entry.id);
		// ⚓ `Anemo Aether` / `Anemo Lumine` name the twin as well as the element
		// (twin frames round, 2026-10-28); `Anemo Traveler` leaves it to the profile.
		if (entry.id.startsWith('traveler_'))
			for (const twin of ['aether', 'lumine'] as const) {
				const name = travelerName(entry.displayName, twin).toLowerCase();
				idByDisplayName.set(name, entry.id);
				twinByName.set(name, twin);
			}
	}
}

/** The twin a notation name pins (`Anemo Lumine` → `'lumine'`), or null when it
 *  names none — every non-Traveler, and the bare `<Element> Traveler`. */
export function twinOfName(name: string): Twin | null {
	return twinByName.get(name.toLowerCase()) ?? null;
}

/**
 * The twin names a query asks for (⚓ Nate 2026-10-28: only when typed): "Lum"
 * offers every `<Element> Lumine`, "Aeth" every `<Element> Aether`, in index
 * order; anything else offers none, so a Traveler search keeps one row per
 * element.
 */
export function searchTwinNames(query: string): string[] {
	const q = query.toLowerCase();
	if (q.length < 2) return [];
	const twin = (['aether', 'lumine'] as const).find((t) => t.startsWith(q));
	if (!twin) return [];
	return characterIndex
		.filter((e) => e.id.startsWith('traveler_'))
		.map((e) => travelerName(e.displayName, twin));
}

/** The twin a rotation's notation pins: its first `<Element> Aether|Lumine`, or
 *  null when it names the Traveler bare (or not at all). */
export function notationTwin(notation: string): Twin | null {
	for (const tok of tokenizeNotation(notation)) {
		if (tok.kind !== 'character') continue;
		const twin = twinOfName(tok.text);
		if (twin) return twin;
	}
	return null;
}

export function getCharacterIndexEntry(id: string): CharacterIndexEntry | null {
	return indexById.get(id) ?? null;
}

export function getIndexEntryByDisplayName(name: string): CharacterIndexEntry | null {
	const id = idByDisplayName.get(name.toLowerCase());
	return id ? (indexById.get(id) ?? null) : null;
}

export function getAllCharacterIndex(): CharacterIndexEntry[] {
	return characterIndex;
}

/**
 * Search the index by prefix/word match against both name and displayName.
 * Searches each word in the name so "Kae" matches "Kaedehara Kazuha", and
 * inserts the displayName on selection.
 */
export function searchCharacterIndex(query: string, limit = 6): CharacterIndexEntry[] {
	const q = query.toLowerCase();
	const results: CharacterIndexEntry[] = [];
	for (const entry of characterIndex) {
		const fields = [entry.name.toLowerCase(), entry.displayName.toLowerCase()];
		const matches = fields.some(
			(f) => f.startsWith(q) || f.split(/\s+/).some((word) => word.startsWith(q))
		);
		if (matches) {
			results.push(entry);
			if (results.length >= limit) break;
		}
	}
	return results;
}

/**
 * ⚓ ONE TRAVELER (Nate 2026-10-19). The game has a single Traveler whose
 * element changes, so every `traveler_*` variant is the SAME character: a team
 * holds one of them, and under No repeats one team of a board holds any of them.
 * Every "is this the same character" question on a board goes through here.
 */
export const characterKey = (id: string): string => (id.startsWith('traveler_') ? 'traveler' : id);

/**
 * The name a sentence uses for a character: the first word of the display name,
 * except a Traveler's, whose first word is its element. "Cryo provides it"
 * names nobody, so a Traveler keeps "Cryo Traveler".
 */
export function shortName(id: string): string {
	const name = getCharacterIndexEntry(id)?.displayName ?? id;
	return id.startsWith('traveler_') ? name : name.split(' ')[0];
}
