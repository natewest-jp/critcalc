/**
 * src/lib/utils/notationFlags.ts
 *
 * THE NOTATION LINTER — what the text says that the timeline cannot honour.
 *
 * The parser never refuses a rotation. An unresolvable name skips its segment,
 * a cast the character cannot perform draws a generic bar, and a fifth
 * character has no slot to be drawn in. All three are SILENT, and silence is
 * what the single-truth round removes: once the notation IS the team, and once
 * the tool REWRITES it for you (a swap renames a character's
 * segments), a drop the user cannot see is a drop they cannot fix.
 *
 * ══ TWO REGISTERS, AND THE LINE BETWEEN THEM ═════════════════════════════════
 *
 *   --ui-warning     WE CANNOT TAKE THIS. An unresolvable name (the segment is
 *                    skipped), a token we do not simulate (nothing is drawn).
 *                    It is a statement about the INPUT, which is why it shares
 *                    the register — and the class — with the tokenizer's
 *                    unknown tokens: to the reader it is the same sentence.
 *   --ui-provisional WE TOOK IT, AND WHAT YOU SEE IS A STAND-IN. An approximated
 *                    cast, a fifth character with nowhere to sit. A statement
 *                    about OUR coverage; nothing to fix, nothing you did wrong.
 *                    The palette split this out of danger in the 2026-08-12
 *                    UI-state round naming exactly this consumer ("the planner's
 *                    generic-timing text").
 *
 * ↻ `W` CROSSED THE LINE (2026-10-18) AND LEFT IT (2026-10-19). It sat on the
 * warning side from 2026-08-13, as a token the parser stepped over; simulated
 * (it resets the attack string and the action before it runs to its walk point
 * — tokens.ts `peekActionKey`) it moved to provisional while the walk point was
 * gcsim's default alone. The walk-overrides round wrote gcsim's per-character
 * walk points into the FrameMaps (`W`), so nothing stands in and nothing is said.
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
import { TEAM_SIZE } from './notationEdit';
import { getIndexEntryByDisplayName, twinLabel, twinOfName } from '$lib/data/characterLookup';
import type { Twin } from '$lib/storage/records';

export type NotationFlagReason =
	/** The leading name of a segment resolves to nobody — the segment is skipped. */
	| 'unknown-character'
	/** A valid KQM token the planner draws nothing for: `A` on a character who
	 *  cannot take an aimed shot, or an `F` on a kit whose charge doesn't spin. */
	| 'unsupported-token'
	/** A cast token the segment's character cannot perform — timed by a stand-in. */
	| 'approximate-cast'
	/** A fifth (or later) distinct character: parsed, but with no slot to draw in. */
	| 'no-slot'
	/** A real profile's rotation names the twin the profile did not choose: timed
	 *  as written, which is not the account's Traveler (twin frames round). */
	| 'other-twin';

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

/** Warning (we cannot take this) vs provisional (we took it and stood in for
 *  it) — see the header. The editor maps these to its two squiggle classes. */
export function flagSeverity(reason: NotationFlagReason): 'warning' | 'provisional' {
	return reason === 'unknown-character' || reason === 'unsupported-token'
		? 'warning'
		: 'provisional';
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
	// The parser finds no special skill and casts the BASE skill's frames, so
	// "generic timing" would be untrue here.
	if (token === 'sE' && casts.includes('E')) {
		return `${name} has no sE variant — timed as a plain E.`;
	}
	if (token === 'sQ') {
		return `${name} has no short-burst variant — timed as a full Q.`;
	}
	return `${name} can't perform ${token} — this cast is drawn with generic timing.`;
}

/** Tokens the linter has an opinion about: the E/Q casts, the `label` tokens
 *  the planner may not be able to draw (`A`, `F`), and the plunge and charged
 *  classes it may draw with one. */
function isLintable(tok: Token): boolean {
	return (
		tok.kind === 'E' ||
		tok.kind === 'Q' ||
		(tok.kind === 'label' &&
			(/^[AF]$/.test(tok.text) ||
				PLUNGE_TOKEN_RE.test(tok.text) ||
				CHARGED_TOKEN_RE.test(tok.text)))
	);
}

/** `P`, `hP`, `lP` — the tokenizer's plunge class. */
const PLUNGE_TOKEN_RE = /^[lh]?P$/;

/** `C`, `C1`…`C9`, `sC` — the parser's charged class (run.ts reads the same
 *  pattern). A bow's `A` joins it there; here it has its own branch. */
const CHARGED_TOKEN_RE = /^s?C\d*$/;

/** The lintable tokens inside one segment, including the ones hiding inside a
 *  bracket repeat group. Optional `(...)` groups and `/Q` alternatives are
 *  skipped: the parser drops both, so there is nothing to say about them. */
function castTokensIn(tokens: readonly Token[]): Token[] {
	const out: Token[] = [];
	for (const tok of tokens) {
		if (isLintable(tok)) {
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
			if (isLintable(sub)) out.push(sub);
		}
	}
	return out;
}

/**
 * Lint a notation string. Returns flags in source order; an empty array means
 * the timeline draws exactly what the text says.
 */
export function flagNotation(
	notation: string,
	/** The party's seats AFTER the seat rule (§8.1). Given, a name is flagged
	 *  only if it found no seat (all four awake); absent, the old count — the
	 *  fifth distinct name. */
	seats?: readonly (string | null)[],
	/** The profile's twin, given only where the other one is a what-if (a real
	 *  profile's own rotation); a name pinning the other twin is then flagged. */
	profileTwin?: Twin | null
): NotationFlag[] {
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

		const twin = twinOfName(head.text);
		if (profileTwin && twin && twin !== profileTwin)
			flags.push({
				from: head.from,
				to: head.to,
				text: head.text,
				reason: 'other-twin',
				message: `Your profile’s Traveler is ${twinLabel(profileTwin)}. This rotation is timed as ${twinLabel(twin)}.`
			});

		if (!distinct.includes(entry.id)) {
			distinct.push(entry.id);
			if (seats ? !seats.includes(entry.id) : distinct.length > TEAM_SIZE) {
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
			// ⛔ NOTHING IS DRAWN for these two, so they take the warning register
			// rather than the provisional one — see the header for the line.
			if (tok.text === 'F') {
				// `F` is the finisher of a SPINNING Charged Attack (Mavuika's
				// Flamestrider); on any other kit the parser draws nothing for it.
				if (entry.chargeSpin) continue;
				flags.push({
					from: tok.from,
					to: tok.to,
					text: tok.text,
					reason: 'unsupported-token',
					message: `F is the finisher of a spinning Charged Attack — ${entry.displayName}'s doesn't spin.`
				});
				continue;
			}
			if (tok.text === 'A') {
				// A bow's `A` is that bow's fully-charged shot and parses as one; on
				// anyone else there is no aimed shot to take, and gcsim says so in the
				// same words ("action aimed not implemented").
				if (entry.weapon === 'bow') continue;
				flags.push({
					from: tok.from,
					to: tok.to,
					text: tok.text,
					reason: 'unsupported-token',
					message: `Only a bow can take an aimed shot — ${entry.displayName} wields a ${entry.weapon ?? 'melee weapon'}.`
				});
				continue;
			}
			// A plunge on a character with no MEASURED plunge is drawn with the
			// generic profile (⚓ Nate 2026-09-17: provisional, not refused) — the
			// same register a frameless E or Q gets. `lP` reads `lowPlungeFrames`
			// and falls back to `plungeFrames`, so one index fact covers all three.
			if (PLUNGE_TOKEN_RE.test(tok.text)) {
				if (entry.plunge) continue;
				flags.push({
					from: tok.from,
					to: tok.to,
					text: tok.text,
					reason: 'approximate-cast',
					message: `${entry.displayName}'s plunge isn't measured yet — drawn with generic timing.`
				});
				continue;
			}
			// A charged attack on a character with no MEASURED one is drawn with
			// the generic profile (⚓ Nate 2026-10-15: the plunge's rule, so its
			// sentence's shape) — about fifteen framed claymores (Diluc, Eula,
			// Navia…) whose spin nobody has measured. `sC` on anyone without the
			// special form is timed as their plain `C`, and says so — unless the
			// plain C is itself the stand-in, which is the truer sentence.
			// ⚠ A BOW is exempt: its `C` and `A` read `chargeHits`, every bow in
			// the corpus carries them, and one without would draw NOTHING (the
			// parser has no generic aimed shot), so "generic timing" would be
			// untrue. ⚠ Like `plunge`, the fact is per KIT — a stance sibling with
			// no `chargeFrames` of its own still draws the generic profile, and
			// the linter cannot see the stance (no parse runs here).
			if (CHARGED_TOKEN_RE.test(tok.text)) {
				if (entry.weapon === 'bow') continue;
				if (!entry.charged) {
					flags.push({
						from: tok.from,
						to: tok.to,
						text: tok.text,
						reason: 'approximate-cast',
						message: `${entry.displayName}'s charged attack isn't measured yet — drawn with generic timing.`
					});
				} else if (tok.text.startsWith('s') && !entry.specialCharge) {
					flags.push({
						from: tok.from,
						to: tok.to,
						text: tok.text,
						reason: 'approximate-cast',
						message: `${entry.displayName} has no special charged attack — timed as a plain C.`
					});
				}
				continue;
			}
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
