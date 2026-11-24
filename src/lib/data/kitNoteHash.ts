/**
 * The fingerprint a translated kit note carries of the English it translates
 * (FNV-1a, 32 bits, as hex). When the English moves, the fingerprint no
 * longer matches and `kitNotes.test.ts` names the line to redraft.
 *
 * ⚠️ Runtime-import-free: `scripts/kit-notes.mjs` imports it under bare Node
 * type stripping.
 */
export function kitNoteHash(english: string): string {
	let h = 0x811c9dc5;
	for (let i = 0; i < english.length; i++) {
		h ^= english.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return (h >>> 0).toString(16).padStart(8, '0');
}

/** The two notes an entry can carry: its `caveat`, and its `notModeled`
 *  ruling's `reason`. */
export type KitNoteField = 'caveat' | 'reason';

type Host = { id: string; caveat?: string; notModeled?: { reason?: string } };

/** Every note in a character's data: entry id → field → English. */
export function kitNotesOf(c: {
	abilities: Host[];
	passives?: Host[];
	constellations?: Host[];
}): Record<string, Partial<Record<KitNoteField, string>>> {
	const out: Record<string, Partial<Record<KitNoteField, string>>> = {};
	for (const a of [...c.abilities, ...(c.passives ?? []), ...(c.constellations ?? [])]) {
		const note: Partial<Record<KitNoteField, string>> = {};
		if (a.caveat) note.caveat = a.caveat;
		if (a.notModeled?.reason) note.reason = a.notModeled.reason;
		if (Object.keys(note).length) out[a.id] = note;
	}
	return out;
}
