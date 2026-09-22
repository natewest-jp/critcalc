/**
 * THE BREAKPOINT TABLE (responsive survey 2026-09-01 § 5, landed 2026-09-05).
 *
 * Every `@media` width condition in `src/` is one of these values, and each
 * value is here because a MEASURED content fact put it there — the fact is
 * written beside it so the next person moving one knows what they are moving.
 *
 * ⚠⚠ CSS CUSTOM PROPERTIES DO NOT WORK IN MEDIA QUERIES, and `@custom-media`
 * is not shipped. So this table cannot be a set of tokens a stylesheet reads:
 * a component's `@media` has to write the LITERAL. The rule that keeps the
 * literals honest is the same one the layer law uses for colour — a documented
 * table plus a grep — and until a guard exists it is a convention: cite this
 * file in the comment beside every width query, and never mint a threshold
 * that is not in it.
 *
 * The TS side reads these directly (matchMedia takes the same string), which
 * is how a JS-driven layout decision and its CSS twin stay on one number.
 *
 * ⚠ 40rem / 47.5rem / 54rem are REM so they scale with the user's root font
 * size, as the chrome's own stop always has; the two tile-density stops are px
 * because they were authored that way and nothing measured argues for a move.
 *
 * ⛔ Two strays are deliberately NOT in this table: AtlasView's `1260px`
 * (two-column role cards; a content stop of its own — see its comment) and the
 * Visualizers' `min-width: 1024px` (the workspace's second column). Neither
 * maps onto a measured site fact, and a system that forces a real content
 * stop onto a wrong shared number is worse than the strays it replaces.
 * AtlasView's `620px` was the one the survey named for absorption into
 * `compact`; absorbed 2026-09-22. ⚓ The grep guard the survey proposed is
 * `breakpoints.test.ts` (approved the same day): a width literal is either a
 * rung here or a NAMED content stop there, nothing else.
 */
export const BP = {
	/**
	 * `compact` — 40rem / 640px. The narrow form of a surface that folds.
	 * ChromeOverlay's padding step; the Team Builder's band-B fold (measured:
	 * with the bench horizontal its full band B needs 120 + 4 + 229 + 4 + 110
	 * = 467px plus the tool's 32px of pads, so 531px is the content stop and
	 * 40rem is the first rung above it).
	 */
	compact: '40rem',
	/**
	 * `roomy` — 47.5rem / 760px. Where the site chrome keeps its wordmark AND
	 * its full navigation (measured 664.8px of demand); HelpAreaShell's
	 * sidebar-to-tabs stop.
	 */
	roomy: '47.5rem',
	/**
	 * `toolMin` — 54rem / 864px. ⚓ THE PLANNER'S MEASURED MINIMUM with the
	 * bench ribbon beside it: TOOL_INSET 240 + band B's end zone 564 + pads 32
	 * = 836, so the shell clips at 800 and fits at 864. Below it the bench
	 * ribbon turns HORIZONTAL (a row above the bands) and hands its 240px
	 * column back to the tool — see benchBand.svelte.ts.
	 */
	toolMin: '54rem',
	/**
	 * `wide` — 68rem / 1088px. ⚓ THE PLANNER'S BAND B IN FULL FORM beside the
	 * bench column (2026-09-14). The Human timing plate, the full-height zoom
	 * steppers and the slider's plate took band B's zones to 268 + 426px, and
	 * the rail needs ~103 for the Total, so the full form (every word, the
	 * slider) demands ~806px of band; above `toolMin` the band is the viewport
	 * less ~276 (the bench column), so it fits from ~1082. Measured before the
	 * rung: the Total spilled under the first right-zone plate by 24px at 1040
	 * and 37px at 900. Below this rung band B keeps its MARKS and drops its
	 * WORDS and the slider — the fold `compact` used to own, moved up because
	 * the row it governs grew. ⚠️ A fact about the planner, as `toolMin` is;
	 * the Team Builder's band B does not need it.
	 */
	wide: '68rem',
	/** `broad` — the Team Builder's tile-density step-up (existing, 2 uses). */
	broad: '1500px',
	/** `vast` — the Team Builder's second tile-density step-up (existing, 2 uses). */
	vast: '1900px'
} as const;

export type Breakpoint = keyof typeof BP;

/** `(max-width: <bp>)` — the string a `@media` block and `matchMedia` share. */
export function belowQuery(bp: Breakpoint): string {
	return `(max-width: ${BP[bp]})`;
}
