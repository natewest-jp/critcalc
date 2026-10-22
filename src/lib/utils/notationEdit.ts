/**
 * src/lib/utils/notationEdit.ts
 *
 * REWRITING THE NOTATION ON THE USER'S BEHALF — the write half of single truth.
 *
 * ↻ 2026-10-22 (design §8.1): the team is STORED again as four seats the
 * notation fills — `seatSlots` below is the rule, and the "notation IS the
 * team" premise of the paragraph that follows holds for the text's own
 * rewrites (rename, delete) but no longer for who is seated.
 *
 * Once the notation IS the team (rotationTabs.slots is derived from it), every
 * team edit has to become a text edit: a swap RENAMES a character's segments,
 * removing one DELETES them, and adding somebody APPENDS a bare-name segment. This module is the only place that happens, and it is pure — the
 * store calls it, the tools call the store.
 *
 * ⚠ NEVER A SEARCH-AND-REPLACE. That is the trap this module exists to avoid:
 * "Ganyu" → "Ayaka" over the raw text would also rewrite a label, and a naive
 * pass at the segment level would corrupt `N2`. What makes the rewrite bounded
 * is a fact about the grammar — ⚓ A CHARACTER NAME IS ONLY EVER A SEGMENT'S
 * FIRST TOKEN. The parser reads `tokens[0]` as the character slot and the
 * tokenizer refuses to read a name anywhere else (there is no inline
 * `[Bennett Q]` construct), so every edit here is a leading-token splice with
 * offsets the tokenizer already computed.
 *
 * ⚠ SURGICAL, NOT REBUILT. Every function splices the original string and
 * leaves everything it did not target byte-identical — including the user's own
 * spacing, a dangling `> ` they are typing into, and any junk the tokenizer
 * could not classify. A rewrite that reformats the parts it was not asked about
 * is a rewrite you cannot trust with a document you are in the middle of.
 */

import { tokenizeNotation } from './tokenizer';
import { getCharacterIndexEntry, getIndexEntryByDisplayName } from '$lib/data/characterLookup';

/** How many characters a team holds. The notation may name more — they parse,
 *  and the linter says they have nowhere to sit (notationFlags).
 *  ⚠ Lives HERE, with the segment reader, because both the store's slot
 *  derivation and the linter's "this is the fifth" test are counting the same
 *  thing off the same list. (The Team Builder's own slot array and resonance.ts
 *  each still carry a local copy — pre-existing, and a different question:
 *  those count SLOTS, this counts NAMES.) */
export const TEAM_SIZE = 4;

/** One `>`-delimited segment, located in the source string. */
export type NotationSegment = {
	/** Character id the leading name resolves to, or null when it resolves to
	 *  nobody (the parser skips such a segment; so does the slot derivation). */
	charId: string | null;
	/** The leading character-name token's span — what a rename replaces. */
	nameFrom: number;
	nameTo: number;
	/** End of the segment's last token. Trailing whitespace and the following
	 *  separator are NOT included; deletion decides what else to take. */
	contentEnd: number;
};

/**
 * Locate every segment in a notation string, in source order.
 *
 * Resolution goes through the tokenizer's `character` token rather than the
 * word-prefix scan that used to live in rotationTabs — deliberately, because
 * the PARSER resolves that same token, and the two disagreeing is precisely how
 * a character could end up with a track and no slot to draw it in.
 */
export function notationSegments(notation: string): NotationSegment[] {
	const tokens = tokenizeNotation(notation);
	const segments: NotationSegment[] = [];
	for (let i = 0; i < tokens.length; i++) {
		const head = tokens[i];
		if (head.kind !== 'character') continue;
		let end = i + 1;
		while (end < tokens.length && tokens[end].kind !== 'character') end++;
		// The body may close with a separator belonging to the JOIN, not the
		// segment — walk back over it so `contentEnd` is the last real token.
		let last = end - 1;
		while (last > i && tokens[last].kind === 'separator') last--;
		segments.push({
			charId: getIndexEntryByDisplayName(head.text)?.id ?? null,
			nameFrom: head.from,
			nameTo: head.to,
			contentEnd: tokens[last].to
		});
	}
	return segments;
}

/** Every distinct character id the notation names, in segment order — callers
 *  take the first TEAM_SIZE (see rotationTabs.slotsFromNotation, which pads to
 *  four). */
export function orderedCharacterIds(notation: string): string[] {
	const seen: string[] = [];
	for (const seg of notationSegments(notation)) {
		if (seg.charId && !seen.includes(seg.charId)) seen.push(seg.charId);
	}
	return seen;
}

/**
 * A team's IDENTITY: its set of characters, order ignored (⚓ Nate 2026-10-08,
 * lineups design §10.1). "Bennett, Xiangling" and "Xiangling, Bennett, blank,
 * blank" are one team; a short team is its own key. The library groups by it
 * and a board team's pinned rotation must share it.
 */
export function teamKey(ids: readonly (string | null | undefined)[]): string {
	const set: string[] = [];
	for (const id of ids) if (id && id !== 'blank' && !set.includes(id)) set.push(id);
	return set.slice(0, TEAM_SIZE).sort().join('+');
}

/** The team key of a notation — the first four distinct names it holds. */
export function teamKeyOfNotation(notation: string): string {
	return teamKey(orderedCharacterIds(notation));
}

/** A rotation's four party slots (keys 1–4). `null` is an EMPTY slot; the
 *  string `'blank'` is the Blank character, seated — the two were one value
 *  while the team was derived, and only `benchBand.blankUsed` told them apart. */
export type Seats = (string | null)[];

export const emptySeats = (): Seats => Array<string | null>(TEAM_SIZE).fill(null);

/** Stored seats as exactly TEAM_SIZE entries: missing become empty, a
 *  duplicate keeps its first seat. `'blank'` is kept — here it is the Blank
 *  character (see `seatsFromLegacy` for lists where it meant empty). */
export function normalizeSeats(
	raw: readonly (string | null | undefined)[] | null | undefined
): Seats {
	const out = emptySeats();
	(raw ?? []).slice(0, TEAM_SIZE).forEach((id, i) => {
		// Only a character we know: seats arrive from links and backups too.
		if (id && !out.includes(id) && getCharacterIndexEntry(id)) out[i] = id;
	});
	return out;
}

/** A LEGACY slot list (`manualSlots`, a board's team row, `rt.slots`'s own
 *  shape), where `'blank'` meant an empty slot. */
export function seatsFromLegacy(
	raw: readonly (string | null | undefined)[] | null | undefined
): Seats {
	return normalizeSeats((raw ?? []).map((id) => (id === 'blank' ? null : id)));
}

/**
 * ⚓ SLOTS HOLD UNTIL SOMETHING NEEDS THEM (design §8.1, Nate 2026-10-22).
 *
 * The notation FILLS the slots; it no longer IS them. A seated character the
 * notation does not name is RESTING — still in the party, drawing no bars —
 * and a name the notation adds takes the first EMPTY slot, else the first
 * RESTING one, lowest number first. Nothing else ever moves: a character keeps
 * their key whatever order the text names them in, and only an explicit write
 * (✕, a swap, Clear) empties or reassigns a seat.
 *
 * ⚠ IDEMPOTENT by construction — every name already seated is skipped, so
 * running it twice over the same text is the same as once. The store's
 * notation setter and the editor's transaction both call it, and that is what
 * lets them run in either order without fighting.
 *
 * Starting from empty seats it reproduces the old derivation exactly (the
 * first four names, in order), which is how every document saved before slots
 * existed migrates.
 */
export function seatSlots(seats: readonly (string | null)[], notation: string): Seats {
	const out = normalizeSeats(seats);
	const names = orderedCharacterIds(notation);
	for (const id of names) {
		if (out.includes(id)) continue;
		let i = out.indexOf(null);
		if (i < 0) i = out.findIndex((x) => x !== null && !names.includes(x));
		if (i < 0) continue; // all four awake: a fifth name has nowhere to sit
		out[i] = id;
	}
	return out;
}

/** A SAVED entry's seats: its stored slots; else a legacy `manualSlots` in its
 *  own order with the notation seated into it; else the notation's old
 *  derivation (the seat rule from empty seats). */
export function seatsOfSaved(e: {
	notation: string;
	slots?: readonly (string | null)[] | null;
	manualSlots?: readonly (string | null)[] | null;
}): Seats {
	if (e.slots) return normalizeSeats(e.slots);
	return seatSlots(seatsFromLegacy(e.manualSlots ?? []), e.notation ?? '');
}

/** The seated characters the notation names (the rest are resting). */
export function awakeIds(seats: readonly (string | null)[], notation: string): string[] {
	const names = orderedCharacterIds(notation);
	return seats.filter((x): x is string => !!x && names.includes(x));
}

/**
 * True when the notation says more than who is on the team — i.e. at least one
 * segment carries an action after its name.
 *
 * The Team Builder's "Clear team" asks: under single truth it deletes every
 * character's segments, which on a written rotation means deleting the
 * rotation. A team of four bare names is nothing to lose; a team of four with a
 * rotation attached wants to be asked first.
 */
export function notationHasActions(notation: string): boolean {
	return notationSegments(notation).some((s) => s.contentEnd > s.nameTo);
}

/** `id` → the name to type for it. Unknown ids fall back to the id itself,
 *  which will lint as an unresolvable name rather than vanish silently. */
function displayNameFor(charId: string): string {
	return getCharacterIndexEntry(charId)?.displayName ?? charId;
}

/**
 * Rename every segment led by `charId` to `toCharId` — what a swap does (the
 * Team Builder's swap mode, Try in Planner). The segments keep their actions verbatim; whether the new character can
 * PERFORM them is the linter's sentence to pass (notationFlags), not this
 * module's to censor.
 */
export function renameCharacterInNotation(
	notation: string,
	charId: string,
	toCharId: string
): string {
	const name = displayNameFor(toCharId);
	let out = notation;
	// Descending, so an earlier splice can't shift a later span's offsets.
	for (const seg of notationSegments(notation).reverse()) {
		if (seg.charId !== charId) continue;
		out = out.slice(0, seg.nameFrom) + name + out.slice(seg.nameTo);
	}
	return out;
}

/**
 * Delete every segment led by `charId` — what removing a character from the team does.
 *
 * ⚠ THE JOINS ARE THE HARD PART, not the segments. Removing a middle segment
 * has to take ONE `>` with it or the survivors collide; removing the LAST has
 * to take the one BEFORE it instead. Doing that as independent spans overlaps
 * the moment two adjacent segments both go, so the string is reassembled from
 * the surviving pieces instead: each survivor's text verbatim, joined by an
 * ORIGINAL join (the one that followed the earlier survivor), with whatever sat
 * before the first segment and after the last left exactly where it was.
 */
export function deleteCharacterFromNotation(notation: string, charId: string): string {
	const segments = notationSegments(notation);
	const doomed = segments.filter((s) => s.charId === charId);
	if (doomed.length === 0) return notation;
	const survivors = segments.filter((s) => s.charId !== charId);

	const prefix = notation.slice(0, segments[0].nameFrom);
	const suffix = notation.slice(segments[segments.length - 1].contentEnd);
	if (survivors.length === 0) return (prefix + suffix).trim();

	// The join that FOLLOWED segment k, verbatim (`" > "`, `">"`, `"  >\n"` …).
	const joinAfter = (k: number) =>
		k < segments.length - 1 ? notation.slice(segments[k].contentEnd, segments[k + 1].nameFrom) : '';

	let out = prefix + notation.slice(survivors[0].nameFrom, survivors[0].contentEnd);
	for (let i = 1; i < survivors.length; i++) {
		const prevIdx = segments.indexOf(survivors[i - 1]);
		out += joinAfter(prevIdx) + notation.slice(survivors[i].nameFrom, survivors[i].contentEnd);
	}
	return out + suffix;
}

/**
 * Append a bare-name segment — what adding somebody to the team does when there
 * is nothing of theirs to rename.
 *
 * A lone name is valid notation: it parses, it takes a slot, and it draws an
 * empty track waiting for actions. That is the whole mechanism by which a Team
 * Builder user can assemble four characters before typing a single cast.
 */
export function appendCharacterToNotation(notation: string, charId: string): string {
	const name = displayNameFor(charId);
	const body = notation.replace(/\s+$/, '');
	if (body === '') return name;
	// A dangling separator is somebody mid-thought — complete it rather than
	// adding a second one.
	return body.endsWith('>') ? `${body} ${name}` : `${body} > ${name}`;
}

/**
 * MIGRATION: fold a legacy explicit team (`manualSlots`, the `?r=` `team`
 * field) into the notation, so a document restored from before single truth
 * still has the team it was saved with.
 *
 * Anyone the notation already names keeps their place; anyone it does not is
 * appended as a bare-name segment, in the order the old team held them. Slot
 * ORDER can therefore change — a character sitting in slot 3 of a manual team
 * whose notation names nobody arrives in slot 0 — which is the trade Nate took
 * knowingly (⚓ 2026-08-13: "having the tool and notation agree is way more
 * important" than preserving slot order).
 */
export function foldTeamIntoNotation(
	notation: string,
	team: readonly (string | null)[] | null | undefined
): string {
	if (!team) return notation;
	let out = notation;
	const present = new Set(orderedCharacterIds(notation));
	for (const id of team) {
		if (!id || id === 'blank' || present.has(id)) continue;
		if (!getCharacterIndexEntry(id)) continue;
		present.add(id);
		out = appendCharacterToNotation(out, id);
	}
	return out;
}

/**
 * Set slot `index` of the team a notation implies. A filled slot is RENAMED
 * (the character's segments keep their actions and change who performs them);
 * an empty one APPENDS a bare-name segment; `null` DELETES the occupant's
 * segments. ONE rule for both editors of a notation-backed team — the
 * planner's working tab and a board team linked to a tab (lineups design §2.3).
 *
 * ⚠ `index` is honoured for the outgoing character, not the incoming one:
 * filling an empty slot appends, so slot ORDER stays notation order.
 */
export function setSlotInNotation(notation: string, index: number, id: string | null): string {
	const slots = orderedCharacterIds(notation).slice(0, TEAM_SIZE);
	const outgoing = slots[index] ?? null;
	if (outgoing === id) return notation;
	if (id === null) return outgoing ? deleteCharacterFromNotation(notation, outgoing) : notation;
	if (slots.includes(id)) return notation;
	return outgoing
		? renameCharacterInNotation(notation, outgoing, id)
		: appendCharacterToNotation(notation, id);
}
