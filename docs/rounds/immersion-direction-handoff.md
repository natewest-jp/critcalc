# Immersion direction handoff (2026-05-31)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

Brief for **continuing the strategic conversation** about critcalc.app's direction, immersion, and getting to launch. This is the _discussion_ entry-point; the implementation detail lives in `docs/rounds/landing-status.md`, `docs/rounds/launch-roadmap.md`, memory `project_design_constitution`. Written 2026-05-31 because the prior context filled up mid-discussion.

## What the site is

critcalc.app — a Genshin Impact theorycrafting tooling site (SvelteKit + TS, KQM-aligned terms). Three tools:

- **Crit Visualizer** — complete (Crit Rate × Crit Damage heatmap).
- **Rotation Planner** — primary focus, in active dev (notation string → Gantt timeline; CodeMirror editor; 121 curated character JSONs).
- **Team Builder** — planned (side-by-side comparison); stub route exists, slated for launch.

Design theme: **"abyss as possibility"** — the Genshin Abyss reframed as a space of potential/exploration. See memory `project_design_constitution` for mission/audience/theme.

## What the scene is now

A persistent cinematic **cosmic landing**: a 21:9 layered scene — baked sky image (galaxy band + anchor stars) + baked floor (ground + reflections) + ~1500 CSS twinkle stars + CSS gradient gutters + a dim overlay. Landing shows the brand + three hero cards over the scene. Clicking a tool plays a **camera transition**: the scene pans up (and cranes sideways for the two side tools) toward the sky while the tool fades in; the scene persists, dimmed, behind the tool. Returning reverses it.

State: **committed `2f91d8c` on branch `design/landing`** (off `main`). All knobs + architecture in `docs/rounds/landing-status.md`. Hero cards are deliberately placeholder (flat, simple border-on-hover) pending real design.

## The challenge we've been wrestling with

The cinematic transition is **near the cross-browser ceiling of DOM/CSS animation.** Smooth in Safari/Chrome; **Firefox is "disastrous"** (it trundles). The hard truth Nate emphasized: for a _slow easing_ camera move, even a few dropped frames take it from graceful → trundling — the polish is fragile in exactly the way that matters, so "the drops are minimal" doesn't save it. We've already spent the cheap DOM wins (compositor WAAPI transforms, freezing the ~1500-node starfield during the pan, suppressing+revealing the heavy tool mount, route preload). Remaining DOM levers give diminishing returns on Firefox.

**The reframe that decides everything: is the immersion in the camera MOVE, or in the persistent SCENE?** Four directions were laid out (full writeup + Claude's recommendation at the TOP of `docs/rounds/landing-status.md`):

1. **Pre-render the move as video/image-seq** — keep the exact cinematics, robust everywhere (hardware decode); handoff/twinkle/reverse wrinkles.
2. **Shorten + lighten the DOM pan** — cheapest to try first; might clear Firefox's bar.
3. **Drop the move → static scene + a cheap _themed_ transition** (cross-fade, or an "iris/portal into the abyss") — bulletproof, and possibly a _better_ concept than the tilt-up. The scene already carries the immersion standing still.
4. **WebGL scene** — unbounded smooth cinematics + real depth/parallax, cross-browser. Scoped 2026-05-31: ~1–2 sessions to prototype, ~1–2 weeks to ship well; fixes scene/camera perf but **NOT** the tool-mount weight, and means maintaining a DOM fallback too. Aspirational / only if the camera move is truly central.

Claude's standing recommendation: try #2 first (a day), seriously evaluate #1, hold #3 as a strong floor (entertain the portal concept on its own merits), treat #4 as the ceiling-remover if cinematics become the centerpiece. **The decision is Nate's** and is fundamentally "how load-bearing is the slow camera move vs. the scene itself."

Separate but related perf item: the Rotation Planner's **1.79 MB mount** (121 eager-globbed character JSONs) — fixed by the ready-to-execute `docs/rounds/lazy-character-loading-plan.md` (own branch/session). WebGL would NOT address this; lazy-loading does. The fully-smooth end-state is _both_.

## Current goals → launch

Per `docs/rounds/launch-roadmap.md` (tiers L1 presentation / L2 sharing / L3 polish + ongoing curation Track O). The live threads to land for launch:

- **Resolve the landing/immersion direction** (the discussion above) — the entrance must feel polished on _every_ browser, or be simplified to something that does.
- **Lazy character loading** — planner cold-load/mount weight (`docs/rounds/lazy-character-loading-plan.md`).
- **Rotation Planner SSR fix** (`docs/rounds/rotation-planner-ssr-fix.md`).
- **L2 sharing**: URL-encoded rotation state + PNG export + Team Builder MVP (all decided at-launch 2026-05-12).
- **Real hero-card design** (current cards are placeholders).

## How to pick up the conversation

Immediate thread: the **immersion / transition direction** (move vs scene; the four alternatives) — Nate is mulling it. Broader thread: **what makes critcalc feel immersive _and_ launch-ready** across the whole site, not just the landing. Hold the three priorities throughout, in this order of tension:

1. **Maintain immersion.**
2. **Fit the scene + the 'abyss as possibility' theme.**
3. **Be easily performant / not a struggle** (the one Firefox exposed).
