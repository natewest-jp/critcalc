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
import { tokenizeNotation } from '$lib/utils/tokenizer';

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
	activeStart: number;       // seconds
	activeEnd: number;         // seconds
	activeLabel: string;       // notation text shown inside the active bar
	labelStart: number;        // seconds — cursor when first label token was added
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

	// Tokenize the full string, then group into segments by separator tokens.
	const allTokens = tokenizeNotation(raw);

	const segments: (typeof allTokens)[] = [];
	let current: typeof allTokens = [];
	for (const tok of allTokens) {
		if (tok.kind === 'separator') {
			if (current.length > 0) segments.push(current);
			current = [];
		} else {
			current.push(tok);
		}
	}
	if (current.length > 0) segments.push(current);

	const tracks: CharacterTrack[] = [];
	const unknownTokens: string[] = [];
	let cursor = 0; // rotation clock (seconds)

	for (let i = 0; i < segments.length; i++) {
		const tokens = segments[i];
		if (tokens.length === 0) continue;

		// First token is always the character-name slot.
		const charToken = tokens[0]; // kind === 'character'
		const char = lookupChar(charToken.text);
		if (!char) {
			unknownTokens.push(charToken.text);
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
		let labelStartSet = false;

		for (let j = 1; j < tokens.length; j++) {
			const tok = tokens[j];

			if (tok.kind === 'Q') {
				const qCast = qAbility?.castTime ?? Q_CAST_S;
				track.qBars.push({
					start: localCursor,
					uptime: qAbility?.duration ?? 0,
					cooldown: qAbility?.cooldown ?? 15,
					label: 'Q',
					castTime: qCast
				});
				localCursor += qCast;

			} else if (tok.kind === 'E') {
				const eCast = eAbility?.castTime ?? E_CAST_S;
				track.eBars.push({
					start: localCursor,
					uptime: eAbility?.duration ?? 0,
					cooldown: eAbility?.cooldown ?? 12,
					label: tok.text,
					castTime: eCast
				});
				localCursor += eCast;
				// Carry non-plain-E variants into the active label (hEP, EP, etc.)
				if (tok.text !== 'E') labelParts.push(tok.text);

			} else if (tok.kind === 'time') {
				const m = tok.text.match(/^~([\d.]+)s/);
				if (m) localCursor += parseFloat(m[1]);

			} else if (tok.kind === 'unset-time') {
				track.hasUnsetDuration = true;
				localCursor += MIN_ACTIVE_S;

			} else if (tok.kind === 'optional') {
				const inner = tok.text.slice(1, -1).trim();
				if (inner) {
					if (!labelStartSet) { track.labelStart = localCursor; labelStartSet = true; }
					labelParts.push(`(${inner})`);
				}

			} else {
				// 'label' or 'unknown' — both contribute to the active label
				if (!labelStartSet) { track.labelStart = localCursor; labelStartSet = true; }
				if (tok.kind === 'unknown') unknownTokens.push(tok.text);
				labelParts.push(tok.text);
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
