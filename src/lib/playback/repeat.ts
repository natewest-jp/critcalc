/**
 * The Repeat stream's text (playback round B, 2026-09-29; plan
 * docs/playback-round-plan.md §3–§4).
 *
 * ⚓ Repeat simulates the notation JOINED TO ITSELF by a swap — the document,
 * then `> document` again, `REPEAT_LAPS` times in all. The join is a `>`
 * because the copy opens with a name, which is what a `>` introduces; nothing
 * new is minted and the user types nothing. ⛔ This is a DERIVED string for the
 * parser, never written into the editor: the notation stays the single source
 * of truth and the lint runs on the document alone.
 *
 * Why text and not IR: the sim already answers every question a repeat asks —
 * it waits on a cooldown, carries a buff, a stack, a state and an aura across a
 * segment boundary — and it answers them for a longer notation exactly as for a
 * shorter one. Appending segments IS simulating the next lap.
 *
 * Two edits to the copies:
 *   - trailing connectors are dropped from the document first, so `A > B >`
 *     does not join as `A > B > > A`;
 *   - stack asserts `{key:N}` are BLANKED in every copy (⚓ Nate 2026-09-29:
 *     braces notation is an artefact of the pre-aura sim and retires later). An
 *     assert states a lap-1 starting condition; from lap 2 the carried count is
 *     the truth. Blanked to SPACES of the same length so every other token in a
 *     copy keeps its offset relative to its lap — `src` ranges stay a fixed
 *     stride apart.
 */

import { STACK_ASSERT_RE } from '$lib/utils/tokenizer';

/**
 * Laps drawn in all, the document included. ⏭ A knob for Nate (plan §9): the
 * stream settles into a period within two or three laps for every kit we know,
 * and each lap costs a parse and a lap of DOM.
 */
export const REPEAT_LAPS = 5;

/** The text between laps: a swap back to the opener. */
export const LAP_JOIN = ' > ';

const TRAILING_CONNECTORS = /(\s*>\s*)+$/;
// STACK_ASSERT_RE is anchored for single-token tests; this is the same shape,
// global, for a sweep through prose.
const ASSERT_SWEEP = new RegExp(STACK_ASSERT_RE.source.slice(1, -1), 'g');

/** The document with its trailing `>`s removed — what a lap IS. */
export function lapText(notation: string): string {
	return notation.replace(TRAILING_CONNECTORS, '');
}

/** A copy with every stack assert blanked, length preserved. */
export function copyText(lap: string): string {
	return lap.replace(ASSERT_SWEEP, (m) => ' '.repeat(m.length));
}

/** The stream: the lap, then `laps − 1` copies each joined by a swap. */
export function repeatNotation(notation: string, laps = REPEAT_LAPS): string {
	const lap = lapText(notation);
	if (lap.trim() === '' || laps <= 1) return lap;
	const copy = copyText(lap);
	let out = lap;
	for (let i = 1; i < laps; i++) out += LAP_JOIN + copy;
	return out;
}

/** Character offset at which lap `k` (0-based) begins in the stream. */
export function lapOffset(notation: string, k: number): number {
	return k * (lapText(notation).length + LAP_JOIN.length);
}
