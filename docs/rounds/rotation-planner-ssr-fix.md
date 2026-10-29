# The Rotation Planner SSR fix (2026-07-10)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

**✅ SHIPPED+pushed `33634d5` 2026-07-10.** `ssr = false` removed (deleted `+page.ts`); the planner prerenders the full scene shell + chrome + Dire border like every other route.

## Measured (blankprobe recipe: CDP 6×CPU + slow-3G 400ms/50KBps, FCP, crit-viz control 1.89s both runs)

- First contentful paint **6.09s → 2.26s** — now within 0.4s of crit-viz.
- Prerendered HTML 1,524B → 31,639B (scene shell present, markers identical to crit-viz).
- Lazy CodeMirror chunk timing unchanged (~14s on slow-3G — async by design, off critical path).

## The pattern (copy this for any future localStorage-backed SSR route)

1. **Deterministic default init** — server and client `$state` initializers produce identical markup (one empty tab, `notation = ''`). No localStorage reads during component init.
2. **Restore in `onMount`** — runs post-hydration, pre-paint (Svelte flushes in a microtask before the browser paints), so no flash of empty state at hydration time. Restore MUST precede the `?r=` import in the same `onMount` (the import's pristine-tab check reads tabs state).
3. **Gate the persist `$effect` behind a `restored` flag** — otherwise the default state clobbers saved tabs on first effect run. This replaced the old `if (!browser)` guard.
4. Value-level store divergence at hydration ($siteSettings-driven text/attributes) is safe — Svelte 5 re-applies text/attribute/bind effects at hydration. Only _structural_ branches ({#if}/{#each}) keyed on client-only state mismatch, and everything structural in the planner derives from `notation` (identical `''` both sides).
5. `genId()`'s `Math.random` is fine — ids are each-keys/comparisons only, never rendered.

## Verified (all headless Chrome; probe scripts recreated in job tmp, not kept)

Dev-mode console: **zero hydration warnings** with maximally-mismatched localStorage seeds (tabs + siteSettings + constellations + loadout). Prod: tabs/notation restore, typing persists without clobbering background tabs, `?r=` import + param-strip works from a fresh profile, viz→planner paint-gated cross-fade intact (first frame 0.001, monotonic ramp — probe must sample `.tool-page`, not `.rotation-page`), landing→planner portal entry keeps tabs. check/lint/771 tests clean.

## Residual notes

- Cold-load UX now: scene + tab bar + notation box (raw text placeholder) at ~2.3s worst-case; saved tabs appear when JS hydrates (~6s worst-case). The seconds-long default-empty-shell window before hydration is the accepted trade (Nate-approved shape; a "flash of wrong notation" would not be).
- `.claude/skills/verify/SKILL.md` intro updated (tools no longer `ssr=false`).
- ⚠️ Still true: never statically import notationEditor from planner-reachable code (CM lazy-load, `a266708`).

For broader context: `docs/rounds/landing-status.md` · `project_architecture_overview` (a retired note) · `docs/archive/perf-audit-2026-07-10.md`
