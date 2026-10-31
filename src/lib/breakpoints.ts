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
	 * The Team Builder's band-B fold (measured:
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
	 * `wide` — 71rem / 1136px (↻ 2026-09-30, was 68rem). ⚓ THE PLANNER'S
	 * BAND B IN FULL FORM beside the
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
	 *
	 * ↻ 2026-09-30 (playback round), twice. The transport (⏮ ▶, a 49px
	 * speed plate, Laps) first took the left zone to 469px and the rung to
	 * 82rem — ⚠️ the Repeat plate had already broken the old fact on
	 * 2026-09-29. Then the zoom's steppers, slider and Reset left the band for
	 * ONE Zoom plate and a popover (⚓ Nate), and the left zone fell to 295px
	 * (the right zone is 426). Measured with a four-character rotation: at the
	 * rung the Total clears the zones by 18 and 37px. Re-measure when a band B
	 * word changes (the text round rewrites them).
	 */
	wide: '71rem',
	/** `broad` — the Team Builder's tile-density step-up (existing, 2 uses). */
	broad: '1500px',
	/** `vast` — the Team Builder's second tile-density step-up (existing, 2 uses). */
	vast: '1900px',
	/**
	 * `huge` — 2200px. ⚓ Where the LARGE interface size comes on by itself
	 * (Nate 2026-10-22: Small for the phone, Medium the default, Large for very
	 * wide screens). Above `vast` on purpose, so a 1920 monitor, the most common
	 * desktop, stays Medium, while 2560 monitors and ultrawides get Large. ⚠ A
	 * judgment, not a measured content stop: re-judge it once Nate has seen
	 * Large on a big screen.
	 */
	huge: '2200px'
} as const;

export type Breakpoint = keyof typeof BP;

/** `(max-width: <bp>)` — the string a `@media` block and `matchMedia` share. */
export function belowQuery(bp: Breakpoint): string {
	return `(max-width: ${BP[bp]})`;
}

/**
 * THE HEIGHT AXIS (responsive sweep 2026-10-15, §3 item 3 — ⚓ Nate approved).
 *
 * A second axis, kept OUT of the width table the way `pointer: coarse` is: a
 * landscape phone is 568–932 wide, so no width rung can find it (932×430 is
 * above `toolMin` and gets the desk form). ONE condition:
 *
 * `short` — `(max-height: 30rem)` / 480px. ⚓ LANDSCAPE PHONES, whose layout
 * viewport is 320–430 tall (568×320, 667×375, 844×390, 896×414, 932×430).
 * Every surface the sweep measured there ran out of HEIGHT, not width: 19–146px
 * of planner chart at rest, a 13–83px Builder grid under its pinned filter
 * strip, landing captions 44–106px into the legal footer, 170–280px of page
 * panel. 30rem sits 50px over the tallest of them and well under a laptop
 * window (1366×768 less the browser's own chrome is ~650). ⚠ REM, like the
 * width rungs, so it scales with the root font size.
 *
 * ⚠ It ADDS to a width condition, never replaces one: a surface with a narrow
 * form writes `(max-width: <rung>), (max-height: 30rem)` (a media query LIST
 * is an OR), and the TS side reads `narrowFormQuery` / `narrowForm()`. Guarded
 * by `breakpoints.test.ts`: a height literal in an `@media` is this one.
 */
export const HEIGHT = {
	short: '30rem'
} as const;

/** `(max-height: 30rem)` — the short-screen condition, for `matchMedia`. */
export const SHORT_QUERY = `(max-height: ${HEIGHT.short})`;

/**
 * The PLANNER'S NARROW FORM — below `toolMin` OR short (sweep §3 item 4): the
 * bench as a row, slots at their own heights, layers off and zoom 30 at load.
 * ⚠ Only those. The aside DRAWER and the band folds stay width-only: they
 * answer a width shortage, and a short screen has the width.
 */
export const narrowFormQuery = `${belowQuery('toolMin')}, ${SHORT_QUERY}`;
