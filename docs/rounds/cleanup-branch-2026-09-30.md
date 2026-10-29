# The chore branch `chore/cleanup-2026-09-30`

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

**`chore/cleanup-2026-09-30`** lives in a separate worktree checkout (cut from `main` at `b04ec7a5`); `node_modules` is a SYMLINK to the main checkout's. ⚠️ So `vite dev` there fails (the symlinked `@sveltejs/kit` is outside Vite's fs allow list) — verify on `npm run build` + `preview`.

Commits (vitest/check/lint green; e2e 78 + 78 at `9e0589bf`, one flaky TB Help-overlay test passed on retry):

- `ca67dc59` Human timing mode defaults to **padding** (was `both`) — see `docs/rounds/human-timing-round.md`. ⚠️ Visitors who already persisted settings keep their stored mode (the whole settings object is written on any change).
- `9e0589bf` 🐛 planner Undo scoped to the tab: `NotationEditor.showDocument(key, value)` parks one `EditorState` per tab id and swaps with `view.setState` (not a transaction). ⚠️ Svelte 5 runs an action's `update()` TRACKED — an object param + `historyTick++` looped (`effect_update_depth_exceeded`); the body is `untrack`ed.

- `a084eab2` landing cards' label rule → `<HRule variant="center" />` in `--hero-rule` (app.css role: gold-400 9% over slate-900, opaque — the outer ring's colour as it lands; ⚠ the L0 law forbids naming the ramps in the component). No hover change. ⏭ Nate judges the faintness on screen.
- `b8179997` 🌌 the BRAND KEEP-OUT: `(scene)/+layout.svelte` publishes `.chrome-brand-group`'s box → `sceneGL.setStarKeepOut` (module state) → `starPass` fades stars by centre distance to the padded box; strength `1 − dim`. 🎛️ `STAR_KEEPOUT_PAD_PX` 10 · `STAR_KEEPOUT_FEATHER_PX` 36 (starPass.ts). ⚓ Removes STARS, never paints a ground — the sky under the mark varies by viewport. ⏭ Nate judges in real Safari.
- `d387d92a` Nate's values: `--hero-rule: #333b4b` (the ring-colour try was too faint) · keep-out pad 0 / feather 4 (⚓ only the stars BEHIND the mark mattered).
- `9e76e757` crit heatmap: axis titles by INK — one `AXIS_TITLE_GAP` 10 of glyph-to-glyph space (+ `AXIS_TITLE_MARGIN` 6), built on measured Plex Sans metrics `AXIS_INK` in crit.ts; PAD derives. ⚠️ box gaps lie: 4/6/8 box = 13.9/12.1/11.3 ink. ⚠️ probe trap: `ctx.letterSpacing = 'normal'` is IGNORED — the previous value sticks.
- `9e76e757` 🎨 the ramp: OKLab reflected-end B-spline + `RAMP_CHROMA_GAIN` 1.08 (`critRamp.ts`, LUT 1024) — ⚓ Nate's pick over linear / Catmull-Rom / through-stops / plain B-spline, all compared LIVE. OKLCH itself: no gain with 8 close stops, and an OKLCH spline clips at the sRGB edge into new bands. ⏭ an emerald band at ~2.2x in every vivid curve is the GREEN STOP's chroma spike — fix the stop, not the curve, if it bothers him.
- ⚠️ An orphaned `vite preview` on :4173 from this worktree made e2e fail 62/78 with "Importing a module script failed" — check `lsof -iTCP:4173` before a run.

✅ **CLOSED 2026-09-30.** Merged `--no-ff` into `main` as `16022501` (e2e 77 + 1 flaky / 78; the same code at the branch tip ran 78 + 78 clean), then `main` into `text/round-2026-09-22` as `e82b1f2f` (vitest 2196, check clean, e2e 78 + 78 clean). Worktree removed, branch deleted (`-d`). ✅ `main` PUSHED. The text branch has no remote.
