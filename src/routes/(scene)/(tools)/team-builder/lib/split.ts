/**
 * The split screen's one motion value (lineups design §2.4).
 *
 * 🎛️ The wipe moves a whole half of the screen, so it is its OWN clock — ⛔ not
 * one of the three `--t-*` bands (motion round: the bands are sized for
 * controls, surfaces and the toggle thumb). Nate tunes this number; the value
 * here is a placeholder. `prefers-reduced-motion` zeroes it at the use site.
 */
export const TB_WIPE_MS = 320;
