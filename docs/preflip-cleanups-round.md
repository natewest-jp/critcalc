# Pre-flip cleanups: 2026-10-27

Nate's last cleanups before the redesign goes live, worked through with him in one session. Merged as `0c4e48a5` (`polish/preflip-cleanups`), **not pushed**. Gates: vitest 2613, check, build, e2e chrome 80 + webkit 80.

## 1. What shipped

| Area                   | Change                                                                                                                                                                                                                   | Where                                                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Coverage               | The column labels stick clear of the menu state's ✕ and fill the band above them once stuck; on a phone (no ✕) flush at the top. The ✕ is z 2.                                                                           | `MenuState.svelte` publishes `--menu-sticky-top` / `--menu-sticky-reach` on `.main`; `CoverageList.svelte` `stuckWatch`         |
| Phone dock             | Never over a full-screen section: it docks only while `menu.open` is false, folds on open, and drops `--notice-floor` under the menu.                                                                                    | `RotationTimeline.svelte` `dockOn`                                                                                              |
| Reload on a section    | Closing a section reloaded on its own route goes to the surface this TAB last showed, else the old fixed exits.                                                                                                          | `menuState.svelte.ts` `rememberSurface` (sessionStorage `critcalc:lastSurface`, pathname only), fed by `(scene)/+layout.svelte` |
| Composer position      | At the screen's foot whatever the rotation's height, above `toolMin`, under the switch.                                                                                                                                  | ToolStack `floor` (min-height = `fill`'s height), `.rp-root` `flex: 1 0 auto`, composer `margin-top: auto`                      |
| Composer pinned offset | Pinned at the shell's bottom pad (24px, was 8) so pinned and resting are the same pixel; the plate reaches the screen's edge.                                                                                            | `.rp-composer` `bottom`, `.rp-composer-body::before`                                                                            |
| Composer look          | Pinned, the plate is `--surface` (the bench's slate, was `--surface-raised`) and the field is a WELL (`--rp-chart-bg`).                                                                                                  | `.rp-composer--pinned` rules                                                                                                    |
| History buttons        | Undo \| Redo over a full-width Clear, two 24px rows; an empty or one-line field is the stack's 50px (line centred by padding), growing from there. Not in the dock.                                                      | `.rp-history--clear`                                                                                                            |
| Coverage strips        | Moved from under the notation box to under the chart's last row (outside the Buffs layer).                                                                                                                               | `.rp-coverage-row`                                                                                                              |
| Scroll lag             | The ruler and the aura lane are the first row INSIDE `.rp-track-scroll`; the follower strip, its rAF mirror and `onHeaderWheel` are gone. Unit labels stay outside the scroller as a legend, now in `.rp-timeline-area`. | `RotationTimeline.svelte`                                                                                                       |
| Compare                | `pairHome` on the side the comparison started from; home is the LEFT side; ✕ lives INSIDE the away side and returns home from either side, with a toast naming where the other went.                                     | `records.ts`, `backup.ts`, `session.svelte.ts` `#setPair` / `endPair(home)`, `CompareControl.svelte`                            |
| Toast names            | Names in toast text set at `--fw-semibold` over the toast's 400.                                                                                                                                                         | `notices.svelte.ts` `NoticeText` + `named`, `NoticeRegion.svelte` `.nt-name`                                                    |
| Cross-tab pair         | A read-only tab follows a pair ended or begun in the tab holding it (pre-existing bug).                                                                                                                                  | `session.svelte.ts` `#reload` runs `#plannerContext`                                                                            |

## 2. Rulings (⚓ Nate)

- **The composer is pinned to the foot always**; the blank space on a tall screen with a short rotation is accepted for one place to reach for.
- **Pinned look:** plate at the bench's `--surface`; the field becomes a well. Claude's reasoning, accepted: the editor's dimmed tokens are mixed against the chart ground (`COMPOSER_BG` in `notationEditorExtension.ts`), and `--fill-rest` over slate-700 came out far lighter, which is why the `>` separators faded. A darker plate was the other option, rejected because it would merge into the night chart.
- **History buttons:** Nate's layout, Undo | Redo side by side over Clear spanning both.
- **Coverage strips:** kept and moved, not dropped (they're off by default).
- **Compare:** store which side is home; home is always left; ✕ returns home from either side; keep both rotations and say where the other went in a toast; home stays as stored (opening the away side from the Library does not move it). ✕ belongs INSIDE the comparison's button, so it is clear what it closes (and leaves room for more than one comparison someday).
- **Toast names:** the names of documents (rotations, lineups, teams) and profiles are a rung heavier. Claude's calls, unchallenged: the curly quotes around names went where the weight now does their job; character names and "Theorycraft" (a fixed term, like "the Library") stay plain.

## 3. Traps for whoever touches this next

- ⚠️ **A sticky inset does not count the scroll container's padding.** That is why Coverage's header stuck 24px down in the menu state. A section needing a sticky header reads `--menu-sticky-top` / `--menu-sticky-reach`.
- ⚠️ **`named` treats every STRING value as a name.** Plain words go in as an array (`['the Library']`); a `NoticeText` built elsewhere is spliced as is. The first draft bolded "the Library" by passing it as a string.
- ⚠️ **The header now scrolls WITH the tracks.** Anything that measured or mirrored `.rp-ruler-scroll` is gone; `trackPad` and `scrollToSeconds` were already reading `.rp-track-scroll`. The gauge round's records (`docs/gauge-round-L6.md`, memory `gauge_round_l6`) describe the old follower and carry a ↻ note.
- ⚠️ **A pair from before `pairHome` has no home.** `CompareControl` keeps the old order for it (a what-if's real profile first, else the older) and treats the left side as home, passing that to `endPair(home)`.
- ⚠️ From inside Theorycraft, a what-if's home belongs to another profile, so ✕ there ends the pair and stays put.
- ⚠️ Trashing one side leaves the other's `pairId` pointing at a tombstone. Nothing shows it, and it is what lets Undo restore the pair.
- ⚠️ **On the dev server, `import('/src/…')` in the page is the app's own module only if nothing has hot-reloaded since the server started** (an HMR'd module loads as `?t=…`, a second instance). Restart the server before driving the app through its own modules.
- ⚠️ The phone rail's CompareControl is in the DOM (zero width) beside the desktop foot's: a locator must take `:visible`.

## 4. The Compare edge-case pass

Eleven scenarios driven headless against the dev server, setup through the session's own API, the ✕/flip/Undo clicks on the real buttons; all pass after the `#reload` fix. Duplicate and compare (✕ from each side) · a what-if (✕ from the guest returns to the real profile's rotation, no longer a guest) · Compare with… a pinned rotation · pin and unpin both sides while paired, through an autosave · trash the shown side then Undo · ✕ in either of two tabs (the watching tab drops the pair) · a what-if replacing an existing pair · opening the away side directly · a reload while paired. Not committed (a one-off, per the verification policy).

## 5. Left open

- `feat/flip-notice` now **conflicts** with `main` (`src/lib/storage/db.ts`, `src/routes/(scene)/+layout.svelte`): it predates `main` and carries its own copy of the link-return commit `5956326a`. Resolve when the returning-visitor dialog resumes. `release/flip` merges clean.
- The toast's "Comparison closed · … is in …" words are working copy.
- After a reload on a section's route, the tool is not drawn UNDER the section; you get it back on close. Drawing it underneath is a bigger job, not asked for.
- Real-phone and real-Safari looks at the scroll fix and the pinned composer are Nate's (the lag fix confirmed on his phone the same day).
