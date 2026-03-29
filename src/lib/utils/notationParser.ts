/**
 * src/lib/utils/notationParser.ts
 *
 * KQM-aligned rotation notation parser. Produces timeline track data from a
 * notation string like:
 *   Bennett Q > Kazuha Q hEP > Xiangling Q E > Fischl E ~2s(N1 N2)
 *
 * Time model:
 *   - All Q/E bars for a character start at a local cursor that begins at
 *     that character's active-start.
 *   - Q advances the local cursor by Q_CAST_S, E by E_CAST_S.
 *   - ~Xs advances the cursor by X seconds and optionally attaches a label.
 *   - Swapping costs swapFrames/60 seconds before the next character starts.
 */

import type { CharacterData } from '$lib/types/character';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TimelineBar = {
	start: number;   // seconds
	uptime: number;  // seconds (0 = instant)
	cooldown: number; // seconds
};

export type CharacterTrack = {
	characterId: string;
	displayName: string;
	element: string;
	activeStart: number;  // seconds
	activeEnd: number;    // seconds
	activeLabel: string;  // notation text shown inside the active bar
	eBars: TimelineBar[];
	qBars: TimelineBar[];
};

export type ParsedRotation = {
	tracks: CharacterTrack[];
	totalDuration: number;
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
 * ~Xs(...) is preserved as a single token even when the label contains spaces.
 */
function tokenise(segment: string): string[] {
	const tokens: string[] = [];
	// Match ~Xs(label with spaces) as single token, then any non-whitespace
	const re = /~[\d.]+s(?:\([^)]*\))?|[^\s]+/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(segment)) !== null) {
		tokens.push(m[0]);
	}
	return tokens;
}

type TokenKind = 'Q' | 'E' | 'time' | 'label';

function classify(tok: string): TokenKind {
	if (/^~[\d.]+s/.test(tok)) return 'time';
	if (tok === 'Q') return 'Q';
	// E actions: E, tE, hE, h1E, h2E, hEP, EP
	if (/^(?:t|h|h1|h2)?E(?:P)?$/.test(tok)) return 'E';
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
	if (!raw) return { tracks: [], totalDuration: 0 };

	const segments = raw.split('>').map((s) => s.trim()).filter(Boolean);
	const tracks: CharacterTrack[] = [];
	let cursor = 0; // rotation clock (seconds)

	for (let i = 0; i < segments.length; i++) {
		const tokens = tokenise(segments[i]);
		if (tokens.length === 0) continue;

		// First token must be the character's displayName
		const charName = tokens[0];
		const char = lookupChar(charName);
		if (!char) continue; // unknown character — skip segment

		const eAbility = char.abilities.find((a) => a.abilityType === 'skill');
		const qAbility = char.abilities.find((a) => a.abilityType === 'burst');

		const track: CharacterTrack = {
			characterId: char.id,
			displayName: char.displayName,
			element: char.element ?? 'pyro',
			activeStart: cursor,
			activeEnd: cursor,
			activeLabel: '',
			eBars: [],
			qBars: []
		};

		let localCursor = cursor;
		const labelParts: string[] = [];

		for (let j = 1; j < tokens.length; j++) {
			const tok = tokens[j];
			const kind = classify(tok);

			if (kind === 'Q') {
				track.qBars.push({
					start: localCursor,
					uptime: qAbility?.duration ?? 0,
					cooldown: qAbility?.cooldown ?? 15
				});
				localCursor += Q_CAST_S;
			} else if (kind === 'E') {
				track.eBars.push({
					start: localCursor,
					uptime: eAbility?.duration ?? 0,
					cooldown: eAbility?.cooldown ?? 12
				});
				localCursor += E_CAST_S;
				// Carry the original token into the active label so hEP etc. are shown
				if (tok !== 'E') labelParts.push(tok);
			} else if (kind === 'time') {
				// ~Xs or ~Xs(label)
				const m = tok.match(/^~([\d.]+)s(?:\(([^)]*)\))?/);
				if (m) {
					localCursor += parseFloat(m[1]);
					if (m[2]) labelParts.push(m[2]);
				}
			} else {
				// label tokens: N1, N2, C, P, walk, dash, …
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

	return { tracks, totalDuration: cursor };
}
