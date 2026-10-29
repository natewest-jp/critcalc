---
paths:
  - 'e2e/**'
  - 'playwright.config.ts'
---

# End-to-end tests (Playwright)

Budget: about 6,000 characters. Rules in the present tense; the suite's history is `docs/e2e-rewrite-round.md`.

## Running

- `npm run test:e2e:chrome` (about a minute) after every round. `npm run test:e2e` (Chrome and WebKit in one invocation, about 3.3 minutes) before a merge. Say in the commit when a run was skipped and which commit last ran green.
- A green run is one "N passed" line, and the exit code covers both engines.
- ⚠️ Always pass `--project=` for a single spec (`npx playwright test e2e/x.spec.ts --project=webkit`). A bare run includes the Firefox project and hangs.
- ⚠️ Never pipe e2e output through `tail`.
- ⚠️ Never run another gate beside it. It serves `build/`, so a `npm run build` or `prettier --write` in another shell rewrites the tree the browsers are loading, and the failures scatter across unrelated specs.
- Each run builds and serves its own preview, so it cannot measure a stale server.
- The `chrome` project runs Playwright's headless shell (Chromium, not Nate's Chrome). Real-Chrome and real-Safari checks are manual.
- Variants: `test:e2e:webkit`, `test:e2e:ui`, `test:e2e:storm` (the cross-engine nav storm, tagged `@storm` and excluded from the default run; needs `--workers=1`, because concurrent headless browsers driving the WebGL scene starve each other's `requestAnimationFrame`), `test:e2e:report`.

## Writing a spec

New specs are proposed to Nate first (see the root `CLAUDE.md`). The traps, each documented at its site in `e2e/fixtures/critcalc.ts`:

- `addInitScript` re-runs on every navigation, including `reload()`, so the `seed` fixture fills only absent keys. Seeding unconditionally makes a reload-then-assert test measure the seed instead of the app.
- `hasText` matches `textContent`, not rendered text. A button that leads with a `<Mark>` SVG has whitespace first, so `/^Save/` never matches. The uppercase you see is CSS `text-transform`, a separate trap.
- A seeded test must arrive through `openTool` / `openSection`, which answer the returning-visitor dialog.
- Travelers need two counts: `ROSTER_SIZE` and `e2e/traveler.spec.ts`.
