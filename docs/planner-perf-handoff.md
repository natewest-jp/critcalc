# Handoff — Planner mount-cost / tool-fade perf (for Fable 5)

**Depends on:** the Timeline Extraction Cleanup (`docs/timeline-extraction-handoff.md`) landing first — the pure pipelines are what make Track A below tractable and safe.
**Goal:** make tool→tool navigation _to the planner_ smooth on Safari — either by making the planner cheap enough to mount that the cross-fade isn't starved (Track A), or by making the fade robust to whatever mount cost remains (Track B), or both. They're independent; **Track B alone likely fixes the user-visible symptom** and is lower-risk.

---

## The problem, measured (2026-07-10 baseline)

Navigating between tools cross-fades via a keyed opacity transition in `src/routes/(scene)/(tools)/+layout.svelte`. It's smooth for Visualizers and Team Builder. The **planner jumps on Safari** (intermittently — sometimes a partial fade): the fade's wall-clock keeps advancing during a main-thread block while the screen can't repaint, so the block silently "eats" the first chunk of the fade and the content snaps in at ~45% opacity.

Numbers (rAF-gap stall detector, headless):

| Navigate to                | Chrome main-thread block  | WebKit main-thread block |
| -------------------------- | ------------------------- | ------------------------ |
| Visualizers / Team Builder | **0ms**                   | **0ms**                  |
| **Rotation planner**       | **~101ms** (single block) | **~227ms + ~126ms**      |

Attribution already done: **not CodeMirror** (`EditorView` construction = 6ms both engines), **not DOM volume** (158 nodes, 0 SVG on an empty rotation). An _empty_ rotation costs the same as a loaded one → this is **baseline instantiation of the 4,620-line `RotationTimeline` component** (reactive-graph setup + the initial run of its 29 `$derived`s + first render), paid _fresh on every navigation_ because SvelteKit re-creates the page.

### Reproduce before/after (do this — it's your success metric)

Drive headless Chrome + WebKit (see the `verify` skill). Run this rAF-gap detector, click the Planner nav link, read `maxGap`:

```js
await page.evaluate(() => {
	window.__gaps = [];
	let last = performance.now();
	const loop = () => {
		const now = performance.now();
		const g = now - last;
		if (g > 20) window.__gaps.push(Math.round(g));
		last = now;
		if (window.__on) requestAnimationFrame(loop);
	};
	window.__on = true;
	requestAnimationFrame(loop);
});
await page.click('.chrome-nav-link:has-text("Planner")');
await page.waitForURL('**/rotation-planner');
await page.waitForTimeout(1200);
const gaps = await page.evaluate(() => {
	window.__on = false;
	return window.__gaps.sort((a, b) => b - a);
});
// gaps[0] is the worst block. Baseline: ~101 Chrome, ~227 WebKit.
```

Real WebKit is the one that matters (Playwright's `webkit` build reproduces Safari-class behavior — it's how the earlier scroll + view-transition bugs were root-caused).

## Step 0 — profile precisely before optimizing (don't skip)

The rAF harness tells you _how big_ the block is, not _what's in it_. Get a flame chart before touching anything:

- **Chrome DevTools → Performance**: record, navigate to `/rotation-planner`, stop. Expand the long task in the main thread. Attribute the block across: Svelte signal-graph setup, each `$derived`'s first computation (the parser run, `computeTeamBuffRows`, `charReceivedBuffRows`, `summonSubrows`, `moonsignRows`), the CodeMirror mount action, and first layout/paint.
- **Safari → Web Inspector → Timeline** (you have a Mac): same recording, because the WebKit block is 2× Chrome's and may weight differently.

Rank the top 3 contributors. **The levers below are hypotheses — validate them against the profile and go after the biggest slices first.** Do not optimize blind.

---

## Track A — make the planner cheaper to instantiate

Likely levers, once the profile confirms where the time is:

1. **Short-circuit empty/near-empty inputs.** Every `$derived` runs once on init. Any pipeline that does real work on an _empty_ rotation is waste. Confirm `computeTeamBuffRows`, `charReceivedBuffRows`, `weaponProcRows`, `summonSubrows`, `moonsignRows` all early-return cheaply when `rotation.tracks` is empty (or the relevant pool is). If any eagerly iterate the roster or build tables regardless of input, gate them.

2. **Defer heavy computation off the first-paint path.** Render the timeline _shell_ (ruler, empty lanes, editor) synchronously and cheaply; compute the heavy lanes (team-buffs / summon / moonsign / weapon procs) in an `onMount` → `requestAnimationFrame` (or a `$effect` that runs post-mount), gated to only run when there's a rotation. Same total work, but the **first paint is cheap** — the cross-fade sees real content immediately, and the heavy lanes fill in a frame later. This is the highest-leverage change for the _fade_ specifically. (The extraction makes it a one-liner: call the pure fn from the deferred effect instead of a top-level `$derived`.)

3. **Split `RotationTimeline` into lazily-mounted sub-components.** The 4,620-line monolith instantiates everything at once. Carve the lanes into child components (`TeamBuffsLane`, `SummonLane`, `MoonsignLane`, `WeaponProcLane`) that mount behind `{#if}` — only when their data is non-empty, or after first paint. Fewer signals set up synchronously = smaller init block. This also just makes the file maintainable. Do it _after_ the extraction so each lane consumes a tested pure pipeline.

4. **Memoize parser + pipeline output by notation string (module-level).** The planner persists its notation (localStorage/tabs), so re-navigating recomputes the _identical_ result. A module-level `Map<notationString, ComputedTimeline>` (bounded, LRU-ish) means the 2nd+ mount in a session reuses the cached computation instead of re-running the parser + pipelines. Targeted, lower-risk version of "keep-alive," and it directly attacks the _repeat_-navigation cost. Watch memory (cap the cache) and cache-key correctness (notation + constellations + loadout all affect output — key on all of them, or invalidate on store change).

5. **Trim the reactive-graph surface only if the profile blames it.** 29 `$derived` + 5 `$effect` is a lot, but Svelte 5 signal setup is usually cheap — likely _not_ your bottleneck. Only collapse/memoize deriveds if the flame chart actually points there.

**Target:** get the WebKit block under ~60–80ms (enough that the 500ms fade barely notices it). Document before/after `maxGap` for both engines.

---

## Track B — make the cross-fade robust to the mount (the direct symptom fix)

Independent of Track A, and arguably the more reliable fix: **don't start the fade until the incoming page has actually painted.** The pattern already exists in this codebase — the portal's reveal handshake in `src/lib/landing/transition.ts` (`registerToolReveal` / `revealToolNow`) does exactly this for home→tool: it mounts the tool hidden, **waits two frames for paint**, then reveals. Borrow it for tool→tool.

Sketch (in `(scene)/(tools)/+layout.svelte`, which already owns the `{#key page.url.pathname}` cross-fade):

- On navigation start (`beforeNavigate`), keep the outgoing `.tool-page` at full opacity and mark the incoming one "pending" (opacity 0, no transition yet).
- After the new page mounts and paints — `afterNavigate` + a double `requestAnimationFrame` (the portal's trick) — flip a `ready` flag that triggers the cross-fade.
- Net effect: the ~220ms mount block happens while the _old, fully-painted_ tool is still on screen (a brief "hold", not a blank jump — and the Dire border keeps animating live, since it's compositor-driven and outside `.tool-main`), then a clean cross-fade once the new page is real.

The tricky bit is that Svelte's built-in `fade` can't "wait for a flag" — you'll likely drive opacity via a reactive class + CSS transition (compositor opacity, so it stays smooth) rather than the `in:`/`out:` directives, orchestrated by the `ready` flag. Prototype it and **verify on real WebKit** with the rAF harness above (there should be no fade truncation) before committing. Keep the first-mount gate (`crossfadeReady`) and reduced-motion handling that are already there.

**Trade-off to accept:** a short (~200ms on Safari) hold on the old tool before the fade-in. That reads as intentional "loading the heavy tool," and is strictly better than the current jump.

---

## Constraints & done

- **No behavior change** to the planner's output; **no regression** for the already-smooth Visualizers/Team Builder fades or the home↔tool portal.
- Measure everything: before/after `maxGap` (Chrome + WebKit) for Track A; visual no-truncation on WebKit for Track B. Put the numbers in the commit message.
- `npm run check` 0/0, `npm run lint` clean, `npm test` ≥ current count. Keep commits separable (one lever per commit).
- **Done when:** navigating to the planner on Safari cross-fades cleanly (no snap), the border stays live throughout, and Chrome/FF are unchanged — with documented before/after block numbers.

## Pointers

- Cross-fade + `{#key}` + first-mount gate: `src/routes/(scene)/(tools)/+layout.svelte`.
- The paint-wait handshake to copy: `src/lib/landing/transition.ts` (`registerToolReveal`, `revealToolNow`, and the two-frame paint wait).
- The heavy component: `src/lib/components/RotationTimeline.svelte`; its pipelines (post-extraction) under `src/lib/timeline/`.
- Measurement recipe / headless WebKit: `.claude/skills/verify/SKILL.md`.
- Earlier diagnosis context lives in this session's summary; baseline numbers are above.
