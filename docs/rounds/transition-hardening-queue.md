# Transition hardening — ✅ merged + pushed, 🔴 the Chrome bug still open

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

**On `main` and LIVE:** `7aa56f5` star freeze · `46401ea` the watchdog ·
`7178435` the stale-settle fix. Branch deleted (fully merged).

## ⚠️ THERE ARE TWO BUGS HERE. Don't conflate them.

**Bug 1 — OURS, engine-independent, ✅ FIXED (`7178435`).** The settle timer
guarded on `page.url.pathname !== path`, which is only the question we meant
while paths are unique. A storm produces A→B→A→B, and there the OLDER pass's
settle passes that guard and runs with STALE captures — cancelling the newer
pass's in-flight animations, baking a mid-flight opacity onto a layer, and
clearing everything except opacity, so nothing is left to fade it. Same family
as the ghost `47dfe8b` fixed, by a different route: that one was a layer the
pass never drove, this one is a layer an OBSOLETE pass drove. Both deferred
callbacks now capture a pass counter. Found by transplanting the orchestration
into a standalone harness at 50x speed, where it failed in ALL THREE engines —
which is what proved it wasn't the Chrome bug.
⚠️ probe-tool-slide's storm check: **TIMING IS THE WHOLE CHECK.** Pass 3 must
start late enough that its own fade-out is still RUNNING when pass 1's timer
fires. At 600ms legs the check passes against the BROKEN code; at 850ms it
fails with a layer stranded across 59 frames. The first version of it did pass
while broken — that is why the both-directions rule exists.

**Bug 2 — CHROME-ONLY, still OPEN.** Everything below.

## 🔴 BUG 2, STILL OPEN — read before touching the (tools) layout

⚓ **Nate's cross-engine finding, which is the key evidence:** reproducible in
Chrome within seconds; NOT reproducible in
real Safari or Firefox under the most extensive click gymnastics he could
manage. It had been reported once before and dismissed as impossible —
"the transition math is the same everywhere, so every engine should show it" —
which had the evidence exactly backwards. **A defect three engines disagree
about IS an engine defect.** `scripts/probe-tool-layer-engines.mjs` exists to
re-check this automatically; ⚠️ only trust a run where the CHROME arm actually
reproduces, or it says nothing.

⚠️ **Both Nate and Claude LOST the ability to provoke it later on 2026-08-07** — Nate on
live and locally, Claude across 24 storm cycles including under 8 CPU burners —
after it had been reliable earlier the same day. Nothing we changed addresses
the cause. Do NOT read that as fixed. Ruled out as the reason: the star-freeze
patch (every reproduction post-dates it — Nate caught this) and the Chrome
version (Playwright drives the same installed binary). Untested: a Chrome
restart clearing long-lived process state (fits Nate's side, not Claude's — Claude's
runs launch a fresh profile every time).

**It is REAL and user-visible.** Screenshot-confirmed 2026-08-07: on
`/team-builder` after a nav storm, the entire tool is gone — site chrome and the
bench ribbon alone over the bare scene. This is the thing Nate half-noticed. The
mirror image also occurs: a DEPARTED layer painting at full opacity on another
route (a real ghost, stuck at its drift offset x≈−405).

**The characterization, which is the valuable part — measured on the live bug:**

- The layer's computed opacity is pinned at a value (0 for the invisible tool,
  1 for the ghost) that **no inline style and no listed animation accounts for**:
  `inline: ""`, `getAnimations(): []`, `animationName: none`,
  `transitionDuration: 0s`, all ancestors at opacity 1, `display:block`,
  `checkVisibility() === true`, real rect.
- **Normal inline declarations are IGNORED** — writing `p.style.opacity='0.5'`
  and reading computed synchronously returns the pinned value, while inline
  _transform_ on the same element applies fine.
- **A newly created WAAPI animation is ALSO ignored**, even `persist()`ed and
  read a frame later (`healResult: "1 (want 0)"`).
- **`!important` DOES move it.** That combination is impossible under the CSS
  cascade (nothing sits above animations and below important-author), which
  points at a browser-level fault rather than a logic error in the choreography.

**Hypotheses RULED OUT — do not re-run these:**

1. _A stale/removed animation still applying._ Minimal repro of
   commitStyles+cancel, of detach/re-insert with a live animation, and of a
   cancel during the before-phase: Chrome behaves correctly in all three.
2. _Chrome's automatic removal of REPLACED animations._ Reproduced the exact
   stack (fill-forwards fade-in replaced by fill-forwards fade-out, then
   settle-cancel): `replaceState` does go to `removed`, and the value does NOT
   leak. Normal inline still worked.
3. _Svelte's outro animation._ `holdPage` has no `css`, so Svelte creates
   `element.animate([], {duration, fill:'forwards'})` — an EMPTY-keyframe
   animation. Verified harmless in isolation; inline opacity applies normally
   alongside it.
4. _A CSS rule / `!important` in the stylesheets._ None exists; `.tool-page`
   carries only `grid-area` + `min-width`.

**Repro recipe (~1 run in 6, and observer-effect sensitive):**

- It needs `probe-bench-band`'s FULL preceding sequence, or the equivalent
  cycle: Viz leg (4600ms dwell) → RP → TB → then the storm (RP, 1100ms, TB back).
- ⚠️ **A per-frame rAF recorder in the page suppresses it** — several clean runs
  in a row means the instrumentation, not the fix. Sample on a timer instead, or
  let the watchdog be the detector.
- ⚠️ **CPU throttling (4×) does NOT reproduce it** — it is not simply "slow".
- ⚠️ **Do not cancel ALL animations on a layer while diagnosing**: that kills
  Svelte's outro-timing animation, whose `onfinish` removes the block, so the
  element never leaves the DOM and the state looks permanently stuck. That
  persistence was an artifact of the probe, not the bug.

**Also ruled out: the COMPOSITOR.** Opacity is one of the four properties
Chrome animates off the main thread, so it was the obvious suspect for a
Chrome-only defect. It reproduces just as readily with
`--disable-threaded-animation` (4 hits) and `--disable-gpu-compositing` (2)
as by default (2). That points at Blink's main-thread style resolution instead.
No matching public Chromium issue found; nearest prior art is
[csswg-drafts #11084](https://github.com/w3c/csswg-drafts/issues/11084)
(commitStyles-then-cancel and a missing style flush) — related in flavour, far
milder in effect.

⚠️ **A reduction attempt REPRODUCED THE WRONG BUG.** Transplanting the
orchestration into a standalone harness produced failures in Chrome, Firefox
AND WebKit — but with inline style and computed style AGREEING (`opacity: 1`
inline, computed 1, want 0). That is Bug 1, not this one, and it is what led to
the `7178435` fix. A reduction only reproduces THIS bug if inline and computed
DISAGREE. Don't accept a three-engine failure table as this bug's repro.

**Where to pick up:** CDP (`CSS.getMatchedStylesForNode` / the Animation
domain) on a live hit, to ask Blink directly what is winning the cascade —
JS-side introspection is exhausted. Needs a live hit, which is currently the
hard part.

## ✅ SHIPPED: the stale-layer watchdog (`46401ea`)

A low-frequency audit (1500ms) past the leg's settle deadline: the latest layer
stamped with the current route must be opaque, every other layer transparent.
`window.__toolWatchdog` = `{hits, last, log}`; `log` carries the layer roster and
time-since-navigation so a hit is diagnosable. Two hard-won details:

- **The deadline is armed in `beforeNavigate`, not only `afterNavigate`.** There
  is a real window between the URL flipping and the pass running (route module
  load + subtree mount) where the departing layer is legitimately still opaque
  while `page.url` already names the destination. Arming only on the way out let
  the watchdog judge inside it and "correct" the outgoing layer before its fade
  existed — a self-inflicted pop, and a false positive convincing enough that it
  cost a bug hunt. A timestamp, not a flag, so an aborted nav expires.
- **It heals with `!important`** (see above — nothing else lands) and
  **verifies the heal on the next frame**, warning again if it did not take. A
  heal that silently fails is worse than none: it makes `hits` look handled.
  `clearWatchdogPin()` releases it at the top of every navigation pass.

`probe-bench-band` asserts `hits === 0` **instead of** trusting its geometry
check alone — the heal would otherwise hide the very bug the check existed for.
⚠️ That check is a KNOWN INTERMITTENT until the root cause is fixed; red there
is the bug, not a flaky probe.

## ⏭ STILL UNBUILT: the nav-storm invariant probe

Biased storm patterns (settle-then-burst, burst-then-settle, triple-fast) across
all three tools, asserting **per-frame invariants**: any layer that is not the
current incoming has monotonically non-increasing opacity; after any settle,
exactly one visible layer at identity transform and it is the current route.
Frame-level invariants catch bug classes rather than the one sequence you
thought to script. Storm **both** lifecycles — revived (re-enter within
HOLD_MAX_MS 4000) and fresh (wait it out). Verify it **both directions** against
a deliberately re-broken layout before trusting a pass.
⚠️ Given the observer effect above, prefer timer sampling over a per-frame rAF
recorder, or the probe will suppress the very thing it is hunting.

## Probe-running gotchas (cost real time here)

- These probes need the **preview build on :4998**, not `npm run dev`.
- A stale `build/` behind an already-running preview serves broken hashed assets
  and every geometry check goes wild. **Rebuild AND restart between A/B runs.**

## The View Transitions API verdict (settled with Nate 2026-08-06 — verbatim)

> No, I wouldn't call it a definite eventual improvement — it's a conditional
> one, and the condition is your design. It definitively solves the
> layer-lifecycle problem (old DOM torn down instantly, no retention, interrupts
> auto-skip — the whole ghost class becomes impossible). But it solves it by
> snapshotting the old page as a **frozen image**, and that's where it collides
> with what makes critcalc's transition distinctive: your world is _alive_
> during the 2-second leg. Under View Transitions, the outgoing frame would carry
> a frozen still of the GL scene cross-fading over the live scene — a two-second
> double-exposure where one copy of the world has stopped moving. That's exactly
> the kind of tear the world-locked fade was designed to eliminate. You'd also
> lose the paint gate that hides the planner's heavy mount, and you'd take on a
> Safari-floor bet this project is already cautious about.
>
> So the honest framing: for a conventional site — opaque pages, short 200–400ms
> fades — View Transitions would be a straight upgrade and I'd recommend
> migrating. For this design, with a live scene as the reference frame and long
> choreographed legs, the current hand-rolled WAAPI orchestration isn't a
> workaround; it's genuinely the better fit. The bookmark should read:
> _reconsider if the transition design ever becomes shorter/simpler, or if the
> platform gains scoped or live-old-state transitions_ — not "migrate when we get
> around to it."

Related: `docs/rounds/bench-band-round.md` (the orchestration + the earlier two bugs) ·
`docs/rounds/scene-star-freeze.md` (this session's other half) · `docs/rounds/scene-occlusion-perf.md`

**⚠️ 2026-09-27:** the `@storm` nav-storm spec (`e2e/tool-layers.spec.ts`, excluded from the default run) fails in SETUP on main — `TypeError: team.slots is not iterable` — identically before and after the gcsim-sync merge. A stale fixture (the seed shape predates notation-as-single-truth's team derivation, probably), not a transition regression. Fix the fixture before trusting a storm run.
