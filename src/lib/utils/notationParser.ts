/**
 * src/lib/utils/notationParser.ts
 *
 * KQM-aligned rotation notation parser. Produces timeline track data from a
 * notation string like:
 *   Bennett Q > Kazuha Q hEP > Xiangling Q E > Fischl E N1 N2 ~2s
 *
 * Time model:
 *   - All Q/E bars for a character start at a local cursor that begins at
 *     that character's active-start.
 *   - Q advances the local cursor by Q_CAST_S, E by E_CAST_S.
 *   - ~Xs advances the cursor by X seconds (pure time advance, no label).
 *   - ~?s is a placeholder meaning "duration unset" — advances by MIN_ACTIVE_S
 *     and flags the track so the renderer can show a visual warning.
 *   - Swapping costs swapFrames/60 seconds before the next character starts.
 *   - ( ) marks optional actions (KQM-compatible); contents are label tokens
 *     rendered with lower opacity.
 *   - [ ] bracket groups (e.g. [N2D]x3) are preserved as label tokens.
 */

import type { CharacterData } from '$lib/types/character';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TimelineBar = {
	start: number;    // seconds
	uptime: number;   // seconds (0 = instant)
	cooldown: number; // seconds
	label: string;    // notation token displayed on the bar (e.g. "Q", "hEP")
	castTime: number; // seconds — duration of the cast animation (used for active-bar overlay)
};

export type CharacterTrack = {
	characterId: string;
	displayName: string;
	element: string;
	activeStart: number;      // seconds
	activeEnd: number;        // seconds
	activeLabel: string;      // notation text shown inside the active bar
	labelStart: number;       // seconds — cursor when first label token was added
	hasUnsetDuration: boolean; // true when ~?s was encountered
	eBars: TimelineBar[];
	qBars: TimelineBar[];
};

export type ParsedRotation = {
	tracks: CharacterTrack[];
	totalDuration: number;
	unknownTokens: string[]; // tokens not recognised as valid notation
};

// ---------------------------------------------------------------------------
// Timing constants (seconds)
// ---------------------------------------------------------------------------

const Q_CAST_S = 1.0;
const E_CAST_S = 0.5;
const MIN_ACTIVE_S = 0.5; // minimum on-field time when no ~Xs is specified

// ---------------------------------------------------------------------------
// Token classification
// ---------------------------------------------------------------------------

/**
 * Tokenise a segment (everything between two `>` separators).
 *
 * Priority order in the regex:
 *   ~?s            — unset-duration placeholder (must precede ~[\d.]+s)
 *   ~[\d.]+s       — time advance token
 *   [...]x?N       — bracket repeat group (KQM [ ] notation)
 *   (...)          — optional action group (KQM ( ) notation)
 *   [^\s]+         — any other non-whitespace token
 */
function tokenise(segment: string): string[] {
	const tokens: string[] = [];
	const re = /~\?s|~[\d.]+s|\[[^\]]*\](?:x\d+)?|\([^)]*\)|[^\s]+/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(segment)) !== null) {
		tokens.push(m[0]);
	}
	return tokens;
}

type TokenKind = 'Q' | 'E' | 'time' | 'unset-time' | 'optional' | 'label';

/**
 * Returns true for label tokens that are part of the KQM notation standard:
 * normal attacks (N1–N9), charged attacks (C, C1–C9), aim (A), plunge
 * (P, hP, lP), dash (D), jump (J), walk (W), and bracket repeat groups.
 */
function isKnownLabelToken(tok: string): boolean {
	return /^N[1-9]?$|^C[1-9]?$|^A$|^[lh]?P$|^D$|^J$|^W$/.test(tok) ||
		/^\[[^\]]*\](?:x\d+)?$/.test(tok);
}

function classify(tok: string): TokenKind {
	if (tok === '~?s') return 'unset-time';
	if (/^~[\d.]+s/.test(tok)) return 'time';
	if (tok === 'Q') return 'Q';
	// E actions: E, tE, hE, h1E, h2E, hEP, EP
	if (/^(?:t|h|h1|h2)?E(?:P)?$/.test(tok)) return 'E';
	// Optional action group: (...)
	if (/^\([^)]*\)$/.test(tok)) return 'optional';
	// Everything else: label tokens (N1, N2, C, A, D, J, W, hP, lP, [N2D]x3, …)
	return 'label';
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

export function parseNotation(
	notation: string,
	lookupChar: (name: string) => CharacterData | null,
	swapFrames = 8
): ParsedRotation {
	const swapS = swapFrames / 60;
	const raw = notation.trim();
	if (!raw) return { tracks: [], totalDuration: 0, unknownTokens: [] };

	const segments = raw.split('>').map((s) => s.trim()).filter(Boolean);
	const tracks: CharacterTrack[] = [];
	const unknownTokens: string[] = [];
	let cursor = 0; // rotation clock (seconds)

	for (let i = 0; i < segments.length; i++) {
		const tokens = tokenise(segments[i]);
		if (tokens.length === 0) continue;

		// First token must be the character's displayName
		const charName = tokens[0];
		const char = lookupChar(charName);
		if (!char) {
			unknownTokens.push(charName);
			continue; // unknown character — skip segment
		}

		const eAbility = char.abilities.find((a) => a.abilityType === 'skill');
		const qAbility = char.abilities.find((a) => a.abilityType === 'burst');

		const track: CharacterTrack = {
			characterId: char.id,
			displayName: char.displayName,
			element: char.element ?? 'pyro',
			activeStart: cursor,
			activeEnd: cursor,
			activeLabel: '',
			labelStart: cursor,
			hasUnsetDuration: false,
			eBars: [],
			qBars: []
		};

		let localCursor = cursor;
		const labelParts: string[] = [];
		let labelStartSet = false; // tracks whether labelStart has been pinned

		for (let j = 1; j < tokens.length; j++) {
			const tok = tokens[j];
			const kind = classify(tok);

			if (kind === 'Q') {
				track.qBars.push({
					start: localCursor,
					uptime: qAbility?.duration ?? 0,
					cooldown: qAbility?.cooldown ?? 15,
					label: 'Q',
					castTime: Q_CAST_S
				});
				localCursor += Q_CAST_S;
			} else if (kind === 'E') {
				track.eBars.push({
					start: localCursor,
					uptime: eAbility?.duration ?? 0,
					cooldown: eAbility?.cooldown ?? 12,
					label: tok,
					castTime: E_CAST_S
				});
				localCursor += E_CAST_S;
				// Carry the original token into the active label so hEP etc. are shown
				if (tok !== 'E') labelParts.push(tok);
			} else if (kind === 'time') {
				// ~Xs — pure time advance, no embedded label
				const m = tok.match(/^~([\d.]+)s/);
				if (m) localCursor += parseFloat(m[1]);
			} else if (kind === 'unset-time') {
				// ~?s — duration placeholder, advance by minimum and flag the track
				track.hasUnsetDuration = true;
				localCursor += MIN_ACTIVE_S;
			} else if (kind === 'optional') {
				// (label) — optional action group; preserve parens for renderer
				const inner = tok.slice(1, -1).trim();
				if (inner) {
					if (!labelStartSet) {
						track.labelStart = localCursor;
						labelStartSet = true;
					}
					labelParts.push(`(${inner})`);
				}
			} else {
				// label tokens: N1, N2, C, A, P, hP, lP, D, J, W, [N2D]x3, …
				if (!labelStartSet) {
					track.labelStart = localCursor;
					labelStartSet = true;
				}
				if (!isKnownLabelToken(tok)) {
					unknownTokens.push(tok);
				}
				labelParts.push(tok);
			}
		}

		// Ensure minimum on-field width
		if (localCursor <= cursor) localCursor = cursor + MIN_ACTIVE_S;

		track.activeEnd = localCursor;
		track.activeLabel = labelParts.join(' ');
		tracks.push(track);

		// Swap time before the next character enters
		if (i < segments.length - 1) {
			cursor = localCursor + swapS;
		} else {
			cursor = localCursor;
		}
	}

	return { tracks, totalDuration: cursor, unknownTokens };
}
