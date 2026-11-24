/**
 * The kit notes in the page's language: an entry's `caveat` (the Inspector's
 * and coverage's notes) and its `notModeled.reason` (coverage's "outside the
 * planner's scope"). English is the character data, where curation writes
 * it; every other locale is `src/lib/data/kitNotes/{locale}.json`, keyed by
 * character and entry id, each line carrying a fingerprint of the English it
 * translates (`kitNoteHash`). `kitNotes.test.ts` fails on a line that is
 * missing or whose English has moved; `scripts/kit-notes.mjs` lists them and
 * stamps a redraft.
 *
 * A locale's file loads only on that locale's pages, with the first
 * character payload (`localeTables.ts`).
 */
import { localeTables } from './localeTables';
import type { KitNoteField } from '$lib/data/kitNoteHash';

export type KitNoteLine = { en: string; text: string };
export type KitNoteTable = Record<
	string,
	Record<string, Partial<Record<KitNoteField, KitNoteLine>>>
>;

const notes = localeTables(
	import.meta.glob('../data/kitNotes/*.json', { import: 'default' }) as Record<
		string,
		() => Promise<KitNoteTable>
	>
);

/** Load a locale's kit notes (the page's by default). */
export const loadKitNotes = notes.load;

/** A note as the page shows it: the locale's translation, else the English. */
export function kitNote(
	characterId: string,
	entryId: string,
	field: KitNoteField,
	english: string
): string {
	return notes.current()?.[characterId]?.[entryId]?.[field]?.text ?? english;
}
