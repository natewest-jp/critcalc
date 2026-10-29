# The cleanup branch, 2026-09-24 to 2026-09-26

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

**`chore/cleanup-2026-09-24`** lives in its own worktree (`critcalc-chore`, cut from `main` at `5d482e12`), so the text round's checkout (the main clone, branch `text/round-2026-09-22`) was never touched. ✅ CLOSED + merged 2026-09-26 (see the end).

Commits (all green on vitest/check/lint/build; **e2e NOT yet run on this branch**):

- `ac99d148` Vesna + Vodyanitsa avatars
- `42b4be7a` Human Timing ON by default · timeline `overscroll-behavior-x: none` · aura pip/marker click → `plannerView.revealInLog` · Undo/Redo stacked with words · Clear team always confirms · 🐛 Reset-this-rotation fix
- `e46d5df1` the ⋯ menu's confirms stay IN the menu; `documentBar.resetConfirm` + the layout's window disarm are gone
- `c95c885f` re-graded landing plate (master `6443f1f9`) + `--sky-grain` 0.45 → 0.38 — see `docs/rounds/landing-scene-pipeline.md`
- `7117ba56` (2026-09-25) brightened plate (master `6c490e58`) + `--sky-grain` 0.38 → 0.32
- `2990dc51` (2026-09-26) Nate's daylight pass: hazed floor (master `05f2722f`), `--floor-grain` 0.3 → 0.25, footer gradient → `#0d1124 → #0d112000` (200px). ✅ The landing plate is DONE — Nate: "then we'll work on other things"

- `c9cd8e81` (2026-09-26) Merge `feat/scene-dim-shader` — the tool dim is the scene renderer's final pass (`docs/rounds/scene-dim-shader.md`). ✅ Full e2e ran on the dim branch tip `abafa6c4`: 78 + 78 green.
- `274c79ec` (2026-09-26) loading veil from the dimmed world: ground `#06080f` → `#111422` (Nate's by-eye shaping, A/B over `#111321`), ink `#24a0fe`, rules `#607b90`.
- `5105e49c` (2026-09-26) floor by LEVELS, not curves (master `78d5a32e`; sky byte-identical) — Nate: "hole in one", but may re-judge in daylight.
- `cdf3f164` (2026-09-26) ONE night ground: `--veil-ground-*` tokens + `VeilGround.svelte` (gradient + grain) for the veil, the 404 and the scene's pre-GL/failed fallback (was flat `--bg`); a failed GL mount now hides the canvas (it was an opaque black rect over the fallback); footer gradient → `#06080f99 → #06080f00`.
- `b4ff0859` (2026-09-26) favicon plate `#312537` (eggplant) → `#25293e` (veil hue, same lightness, chroma 0.039).
- ✅ Nate 2026-09-26: "we've reached the end of my cleanups" — the branch is feature-complete; what remains is the merge gate below.

- `19626ed4` (2026-09-26) the 404, designed: lockup-headed, between two capped rules, four ways out, no status number (copy untouched — the text round's).

✅ **CLOSED 2026-09-26.** Merged `--no-ff` into `main` as `7cc9558d` (full e2e 78 + 78 green on the merge), then `main` merged into `text/round-2026-09-22` as `bfff20e6` (e2e 78 + 78 green there too). Both worktrees (`critcalc-chore`, `critcalc-tint`) removed; `chore/cleanup-2026-09-24` and `feat/scene-dim-shader` deleted (`-d`, merged). The six untracked Vesna/Vodyanitsa `.webp` copies were verified byte-identical to the committed ones and deleted before the merge.
⚠️ **NOTHING IS PUSHED** — local `main` is 23 commits ahead of `origin/main` (incl. the notation-follows-chart merge `7cb0ed36`). Push only when Nate says.
⏭ For the text round: `error.back` and `error.tools.label` no longer exist on the 404 (errors-and-frame sheet). The `@storm` e2e spec's fixture is broken (`team.slots is not iterable`, pre-existing).
