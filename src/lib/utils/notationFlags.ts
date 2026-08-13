/**
 * src/lib/utils/notationFlags.ts
 *
 * THE NOTATION LINTER — what the text says that the timeline cannot honour.
 *
 * The parser never refuses a rotation. An unresolvable name skips its segment,
 * a cast the character cannot perform draws a generic bar, and a fifth
 * character has no slot to be drawn in. All three are SILENT, and silence is
 * what the single-truth round removes: once the notation IS the team, and once
 * the tool REWRITES it for you (an audition commit renames a character's
 * segments), a drop the user cannot see is a drop they cannot fix.
 *
 * ══ TWO REGISTERS, AND THEY ARE NOT THE SAME THING ═══════════════════════════
 *
 *   --ui-warning     "a CAUTION you caused" — the name doesn't resolve, so the
 *                    segment is skipped entirely. Shares the register (and the
 *                    class) with the tokenizer's unknown tokens, because it is
 *                    the same sentence: this text didn't parse.
 *   --ui-provisional "this timing is approximate" — the text parsed fine and
 *                    the bar is drawn from a stand-in. Nothing to fix, nothing
 *                    you did wrong; the palette split this out of danger in the
 *                    2026-08-12 UI-state round naming exactly this consumer
 *                    ("the planner's generic-timing text").
 *
 * ⚠ NO PARSE RUNS HERE. The linter is fed by the eager character index
 * (`casts`, published by castTokens.ts) so it can run per KEYSTROKE inside the
 * CodeMirror plugin, where the lazily-loaded character payloads and the
 * timeline's parse are both out of reach. That is a deliberate second
 * derivation of "can this character do this", and it is kept honest by the
 * index generator computing `casts` from the same JSON the parser resolves
 * against.
 */

import { tokenizeNotation, tokenizeActionRun, type Token } from './tokenizer';
import { getIndexEntryByDisplayName } from '$lib/data/characterLookup';

/** How many characters a team holds. The notation may name more; they have
 *  nowhere to go. */
export const TEAM_SIZE = 4;

export type NotationFlagReason =
	/** The leading name of a segment resolves to nobody — the segment is skipped. */
	| 'unknown-character'
	/** A cast token the segment's character cannot perform — timed by a stand-in. */
	| 'approximate-cast'
	/** A fifth (or later) distinct character: parsed, but with no slot to draw in. */
	| 'no-slot';

export type NotationFlag = {
	/** Start offset in the notation string (inclusive). */
	from: number;
	/** End offset (exclusive). */
	to: number;
	text: string;
	reason: NotationFlagReason;
	/** Player-facing sentence, shown as the token's title on hover. */
	message: string;
};

/** Warning register (the segment is dropped) vs provisional (it is stood in
 *  for). The editor maps these to its two squiggle classes. */
export function flagSeverity(reason: NotationFlagReason): 'warning' | 'provisional' {
	return reason === 'unknown-character' ? 'warning' : 'provisional';
}

const HOLD_TOKEN_RE = /^h[12]?E$/;

/** Why a particular cast token is a stand-in, in the player's words. */
function approximateCastMessage(name: string, token: string, casts: readonly string[]): string {
	if (casts.length === 0) {
		return `${name}'s kit isn't curated yet — this cast is drawn with generic timing.`;
	}
	if (HOLD_TOKEN_RE.test(token)) {
		return `${name} has no ${token} (hold) variant — timed as a plain E.`;
	}
	if (token === 'sQ') {
		return `${name} has no short-burst variant — timed as a full Q.`;
	}
	return `${name} can't perform ${token} — this cast is drawn with generic timing.`;
}

/** The E/Q cast tokens inside one segment, including the ones hiding inside a
 *  bracket repeat group. Optional `(...)` groups and `/Q` alternatives are
 *  skipped: the parser drops both, so there is no timing to approximate. */
function castTokensIn(tokens: readonly Token[]): Token[] {
	const out: Token[] = [];
	for (const tok of tokens) {
		if (tok.kind === 'E' || tok.kind === 'Q') {
			out.push(tok);
			continue;
		}
		// Bracket repeat groups arrive whole (`2[hE C]` is ONE label token), so
		// look inside. The slice keeps offsets absolute.
		if (tok.kind !== 'label') continue;
		const open = tok.text.indexOf('[');
		if (open < 0) continue;
		const close = tok.text.lastIndexOf(']');
		if (close <= open) continue;
		const inner = tok.text.slice(open + 1, close);
		for (const sub of tokenizeActionRun(inner, tok.from + open + 1)) {
			if (sub.kind === 'E' || sub.kind === 'Q') out.push(sub);
		}
	}
	return out;
}

/**
 * Lint a notation string. Returns flags in source order; an empty array means
 * the timeline draws exactly what the text says.
 */
export function flagNotation(notation: string): NotationFlag[] {
	const flags: NotationFlag[] = [];
	const tokens = tokenizeNotation(notation);

	// Group into segments: a character token opens one, everything up to the
	// next character token belongs to it. (Separators are structural; the
	// tokenizer already decides where a name may appear.)
	const distinct: string[] = [];
	for (let i = 0; i < tokens.length; i++) {
		const head = tokens[i];
		if (head.kind !== 'character') continue;
		let end = i + 1;
		while (end < tokens.length && tokens[end].kind !== 'character') end++;
		const body = tokens.slice(i + 1, end);

		const entry = getIndexEntryByDisplayName(head.text);
		if (!entry) {
			flags.push({
				from: head.from,
				to: head.to,
				text: head.text,
				reason: 'unknown-character',
				message: `No character called “${head.text}” — this segment is skipped.`
			});
			// The segment never parses, so its casts approximate nothing.
			continue;
		}

		if (!distinct.includes(entry.id)) {
			distinct.push(entry.id);
			if (distinct.length > TEAM_SIZE) {
				flags.push({
					from: head.from,
					to: head.to,
					text: head.text,
					reason: 'no-slot',
					message: `No slot for ${entry.displayName} — a team holds ${TEAM_SIZE}, and this is character ${distinct.length}.`
				});
			}
		}

		for (const tok of castTokensIn(body)) {
			if (entry.casts.includes(tok.text)) continue;
			flags.push({
				from: tok.from,
				to: tok.to,
				text: tok.text,
				reason: 'approximate-cast',
				message: approximateCastMessage(entry.displayName, tok.text, entry.casts)
			});
		}
	}

	return flags.sort((a, b) => a.from - b.from);
}
