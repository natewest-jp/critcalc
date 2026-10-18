/**
 * src/lib/sim/tokens.ts
 *
 * Token-stream shaping: bracket expansion and the one-token lookahead that
 * picks a cancel window (gauge-round L3c — lifted verbatim out of
 * `notationParser.ts`).
 *
 * ⚠️ Both caps below are BEHAVIOUR, not defensiveness. `MAX_EXPANDED_TOKENS`
 * truncates silently and deliberately, and `peekActionKey` SKIPS `{key:N}`,
 * `/alt` and `(…)` rather than reading them — a token that draws nothing has to
 * move nothing. ⛔ Neither is a detail to tidy while passing through. ↻ `W` was
 * on that list until 2026-10-18 and is READ now: a walk is an action (see
 * `peekActionKey`).
 */

import type { ActionKey } from '$lib/types/ability';
import { tokenizeNotation, type Token } from '$lib/utils/tokenizer';

/** A token that lands nothing on the timeline, so the lookahead steps over it.
 *  Exported for the driver, which joins a same-character `>` into one lookahead
 *  and needs to know where a peek would stop. */
export const isInert = (t: Token | undefined): boolean =>
	!!t && (t.kind === 'stack-assert' || t.kind === 'or-alt' || t.kind === 'optional');

/**
 * Maps the next token after position j to the ActionKey used for cancel-window
 * selection. Returns 'swap' (full animation fallback) for end-of-segment,
 * time advances, or anything else that isn't a direct action. ⚠️ "End of
 * segment" is the end of `tokens`: the driver hands in the next segment's
 * tokens too when a same-character `>` continues the turn (run.ts, `lookahead`). Inert tokens
 * (`{key:N}`, `/alt`, `(…)`) are stepped over, never read; a walk (`W`) is read
 * and answers `'W'`.
 *
 * `isBow` is threaded for ONE token: KQM's `A` is an aimed shot, which only a
 * bow can take, and which our data models as that bow's fully-charged attack
 * (see the charged branch). So a following `A` selects the 'C' cancel window
 * for a bow and stays 'swap' for anyone else — where the token performs no
 * action at all, and the conservative full animation is the honest reading.
 */
export function peekActionKey(tokens: Token[], j: number, isBow: boolean): ActionKey {
	// ⚓⚓ `W` IS AN ACTION (2026-10-18; it was skipped as inert from 2026-08-13).
	// A walk does two things in game, and gcsim models both:
	//
	// 1. It RESETS the normal-attack string. gcsim resets every counter on any
	//    action that is not an attack, walk included (`pkg/core/player/exec.go`,
	//    `if t != action.ActionAttack { h.ResetAllNormalCounter() }`), so
	//    `N1 W N1` is two FIRST swings. The old comment here said the opposite —
	//    that a walk-cancel keeps the string, "which is what makes it worth doing"
	//    — and gcsim's core says otherwise.
	// 2. It starts only once the action before it has finished its ANIMATION.
	//    `InitNormalCancelSlice(hitmark, animation)` (`internal/frames/frames.go`)
	//    fills every slot with the animation and moves only Aim/Skill/Burst/Dash/
	//    Jump/Swap to the hitmark; Walk keeps the full animation. So the answer
	//    here is the key `'W'`, which no FrameMap carries and which is not in
	//    `HIT_KEYS`, and `frameAt()` resolves it to `anim` — the same default
	//    gcsim's slice holds. ⏭ gcsim OVERRIDES Walk per character in places
	//    (normals, plunges, skills); a `W` key in the data is the follow-up round
	//    that captures them, and `frameAt` reads it the day it lands.
	//
	// The walk itself is gcsim's bare `walk` — one frame (`stam.go` `Walk`) — and
	// draws nothing (run.ts).
	//
	// What stays SKIPPED is what performs no action at all: a stack assert
	// (`{key:N}`), an or-alt (`/Q`) and an optional group (`(Q)`). Each one
	// used to answer 'swap' and move the cancel window of the action before it
	// (`Yanfei N1 {seal:3} C` timed its N1 at 12f, `Yanfei N1 C` at 21f).
	let k = j + 1;
	while (isInert(tokens[k])) k++;
	const next = tokens[k];
	if (!next) return 'swap';
	if (next.kind === 'label' && next.text === 'W') return 'W';
	if (next.kind === 'Q') return 'Q';
	if (next.kind === 'E') return 'E';
	if (next.kind === 'label' || next.kind === 'unknown') {
		const t = next.text;
		if (/^N\d*$/.test(t)) return 'N';
		if (t === 'D') return 'D';
		if (t === 'J') return 'J';
		if (/^s?C\d*$/.test(t)) return 'C';
		// A spinning Charged Attack's finisher is part of the Charged Attack.
		if (t === 'F') return 'C';
		if (t === 'A' && isBow) return 'C';
		if (/^[hl]?P$/.test(t)) return 'P';
	}
	return 'swap';
}

/**
 * The input a human pad would sit in front of, or `null` when there is none:
 * the next token is a wait (`~1s`), an unset `~?`, or something we do not
 * simulate, or the rotation simply ends here. ⚓ `peekActionKey` answers
 * 'swap' for all of those because the SLICE question has a right answer there
 * (the animation runs out); the PAD question does not — a player who typed a
 * wait is already waiting, and nothing follows the last action at all.
 * `swapFollows` says whether a real swap comes after the last token of `tokens`.
 */
export function peekHumanPadTarget(
	tokens: Token[],
	j: number,
	isBow: boolean,
	swapFollows: boolean
): ActionKey | null {
	let k = j + 1;
	while (isInert(tokens[k])) k++;
	if (!tokens[k]) return swapFollows ? 'swap' : null;
	const key = peekActionKey(tokens, j, isBow);
	// A walk is not an input anyone is late for — the one AFTER it is. So the
	// pad stands in front of the walk only when something follows the walk that
	// would take one (a trailing `W`, or `W ~1s`, pads nothing). `'W'` is then
	// the target, and `isBufferedTransition` never buffers it: the game stores no
	// input across a walk, which is the existing rule, not a new one.
	if (key === 'W') return peekHumanPadTarget(tokens, k, isBow, swapFollows) === null ? null : 'W';
	return key === 'swap' ? null : key;
}

// ---------------------------------------------------------------------------
// Bracket expansion
// ---------------------------------------------------------------------------

/**
 * Expands bracket repeat groups (e.g. '2[N5C]', '[N5C]x3') in an action-token
 * list into their constituent sub-tokens, repeated the specified number of
 * times. Range prefixes (e.g. '2-4[N5C]') use the lower bound.
 *
 * The character-name token must NOT be included in the input — pass
 * tokens.slice(1) from the segment. The returned array is a flat list of
 * action tokens ready for the main parser loop.
 *
 * Inner content is re-tokenized via a synthetic segment prefix ('_ ') so the
 * tokenizer does not treat the first action token as a character name.
 */
/** Hard cap on bracket repeat counts; real rotations stay in single digits. */
export const MAX_BRACKET_REPEATS = 99;

/**
 * Hard cap on the TOTAL tokens expansion may produce.
 *
 * ⚠️ `MAX_BRACKET_REPEATS` bounds one multiplicand and this bounds the other.
 * Capping only the count was the 2026-08-14 sweep's second finding: nothing
 * bounded the bracket BODY, so `99[` + 2,000 × `N9` — 4 KB of input — expanded
 * to 1.78 million IR events and ~1 GB of heap, and 24 KB of it OOM-ed the tab
 * outright. Measured ceiling was ~445 IR events per input character.
 * (docs/parser-hardening-2026-08-14.md §2.)
 *
 * 20k is far past legitimate use and still cheap: the heaviest plausible bracket
 * — `99[` around fifty tokens `]` — expands to ~5k, and a realistic twenty-cycle
 * rotation is ~300 tokens parsing in 13 ms. Measured at the cap, the worst case
 * lands near 180k events / ~90 ms: a hitch on a pathological paste, not a freeze.
 * (A first cut used 50k and measured 450k events / 222 ms — correct, but there
 * was no reason to buy headroom nobody can legitimately spend.)
 *
 * ⚠️ Hitting it truncates SILENTLY, which is a deliberate and slightly
 * uncomfortable choice: `unknownTokens` is the only warning channel on
 * `ParsedRotation` and nothing renders it (the editor lint in `notationFlags.ts`
 * took that job), so a flag here would go nowhere. Building a display path for a
 * condition no legitimate input can reach is the speculative abstraction the
 * conventions warn against. ⏭ If a warning channel ever exists, this is a
 * candidate — and the better home is the LINT, which already owns the "we cannot
 * take this" vocabulary and could flag an over-budget group from the text alone.
 */
export const MAX_EXPANDED_TOKENS = 20_000;

export function expandBrackets(tokens: Token[]): Token[] {
	const result: Token[] = [];
	for (const tok of tokens) {
		if (tok.kind !== 'label') {
			result.push(tok);
			continue;
		}
		const m = tok.text.match(/^(\d+(?:-\d+)?)?\[([^\]]*)\](?:x(\d+))?$/);
		if (!m) {
			result.push(tok);
			continue;
		}
		const inner = m[2].trim();
		if (!inner) continue;
		let count = 1;
		if (m[1])
			count = parseInt(m[1].split('-')[0]); // prefix, lower bound for ranges
		else if (m[3]) count = parseInt(m[3]); // x-suffix
		if (count < 1) continue;
		// Parsing runs synchronously per keystroke — an unbounded repeat count
		// (e.g. 999999999[N1C]) would freeze or OOM the tab.
		count = Math.min(count, MAX_BRACKET_REPEATS);
		// Re-tokenize inner content; skip the synthetic character-name token.
		// ⚠ The offsets come back measured from the synthetic string, so they are
		// shifted onto the SOURCE: the inner text starts after the `[` and its
		// leading whitespace, and the `_ ` prefix is two characters. Every repeat
		// shares these tokens, so every repeat's events point at the one inner
		// token they came from (`src` on the IR events).
		const innerAt = tok.from + tok.text.indexOf('[') + 1 + (m[2].length - m[2].trimStart().length);
		const shift = innerAt - 2;
		const innerTokens = tokenizeNotation('_ ' + inner)
			.slice(1)
			.map((t) => ({ ...t, from: t.from + shift, to: t.to + shift }));
		for (let rep = 0; rep < count; rep++) {
			// Budget check BEFORE appending, so the cap is a ceiling rather than a
			// threshold we overshoot by one body's worth.
			if (result.length + innerTokens.length > MAX_EXPANDED_TOKENS) return result;
			// ⛔ NOT `result.push(...innerTokens)`. Spreading an array as arguments
			// hits V8's argument limit and throws `RangeError: Maximum call stack
			// size exceeded` somewhere north of ~125k elements — and a throw here is
			// worse than the freeze it replaced, because it unwinds through the
			// synchronous $derived that drives the timeline. A plain loop has no
			// such limit. (Same reason the buff-window merge below is a loop.)
			for (const innerTok of innerTokens) result.push(innerTok);
		}
	}
	return result;
}
