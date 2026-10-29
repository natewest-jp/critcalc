# Planner mount-cost / tool-fade perf — 2026-07-10

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

> **⚠️ ATTRIBUTION REVISED by the L2 perf audit (same day, `docs/archive/perf-audit-2026-07-10.md`):**
> the mount block is NOT chunk parse/compile — removing 287KB of CodeMirror from
> the planner chunk (lazy-loaded at `a266708`) left the nav block unchanged
> (Chrome 4× 486→486ms, WebKit 306→312ms). It's component instantiation +
> style/layout, i.e. the Track A levers below (less mount-time DOM/derived work)
> are the real fix after all — planner-redesign territory. The block remains
> fully masked by the paint-gated fade.

Per the planner-perf handoff (pruned 2026-07-15 as housekeeping — work shipped, this memory is the record; git history has the doc at `0ee897c`).

## What shipped (Track B, `41a7ea2` + revival fix `9e747b7` on `main`)

The tool→tool cross-fade in `src/routes/(scene)/(tools)/+layout.svelte` is now
**paint-gated**: the incoming `.tool-page` is frozen at opacity 0 pre-paint,
waits double-rAF for its first real paint, then both layers cross-fade via
inline CSS transitions (500ms, cubicInOut bezier). A style-free `out:holdPage`
transition (1500ms retention cap) keeps the outgoing page in the DOM — Svelte
marks it inert — fully opaque under the incoming one while the mount block
runs. Svelte's `fade()` is gone from this path.

**Architecture note (learned the hard way, see `docs/rounds/bug-lessons.md` —
"Empty-Shell Navigation"):** the first cut (`41a7ea2`) drove the fade from a
one-shot `use:` action + module state, which broke on A→B→A back-navigation —
Svelte _revives_ the outroing element (same node, actions don't re-run), so the
revived page stayed stuck at opacity 0 ("empty shell", planner ~2/3 of the
time). The shipped design (`9e747b7`) re-orchestrates ALL layers on EVERY
navigation from `afterNavigate` (runs post-render, pre-paint): layers are
stamped `data-page` at creation; each pass re-derives incoming (stamp matches
new pathname) vs outgoing and restyles everything; revived mid-fade layers
resume from their computed opacity; stale rAF callbacks bail when a newer
navigation owns the layers.

Verified on headless WebKit + Chrome: fadeprobe shows WebKit holds the old tool
~270ms then a full monotonic 0→1 arc (was: truncated snap); A→B→A at 9 delays,
A→B→C fast/mid-fade, ping-pong, triple-fast, browser back/forward, cold-load
clicks at 15 delay/wait combos, reduced motion, portal entry + post-portal nav
all pass on both engines. Visualizers/Teams fades unaffected (maxGap ≤35ms
WebKit).

## Numbers (rAF-gap harness, headless, dsf=2, prod build)

|                 | Chrome  | WebKit                             |
| --------------- | ------- | ---------------------------------- |
| baseline maxGap | 86–91ms | 221–281ms (+ secondary ~110–180ms) |
| after Track B   | 78–82ms | 197–230ms                          |

The block shrank a little (see below) but mostly it's now **invisible** — it
plays out behind the held, fully-painted old tool.

## Profile attribution (CDP sampling profiler, Chrome)

- **Biggest single JS slice pre-fix: Svelte `fade()` itself** — its
  `getComputedStyle(node).opacity` read forced a synchronous style recalc of the
  freshly-mounted planner subtree = **42ms**. Removed by Track B.
- Remaining block: `(program)` ~218ms self (parse/compile of the 475KB planner
  chunk `nodes/7.*.js` + native style/layout) + ~43ms CodeMirror init internals
  - only ~20ms actual Svelte flush.

## Residual WebKit mid-fade stutter (fixed `040f629` + `993b6b6`, 2026-07-10)

After the revival fix Nate still saw the planner fade "jump ~2/10". Probing
with a SAVED rotation (localStorage seeded — earlier probes used an empty
planner and missed it) showed 2–4 blocks of 25–85ms landing exactly at fade
start on WebKit only — and they **moved with the fade** when its start was
shifted: WebKit builds + rasterizes compositor layers for both full-viewport
retina page layers the moment an opacity transition starts on unpromoted
elements. Chrome was already clean. Fixes in the afterNavigate orchestration:

- `will-change: opacity` on both layers at freeze time (layerization happens
  during the mount paint, behind the held old page); cleared ~100ms post-fade
  (≈25MB/layer retina — don't keep alive, per the Dire-border texture lesson).
- Incoming layer freezes at opacity **0.001, not 0** — WebKit defers raster of
  fully-transparent layers until nonzero, which put ~40ms back at fade start.
- Settle-gate on the paint-gate: after first paint, wait for two consecutive
  <24ms frames (capped 450ms) before starting the fade.

Result: WebKit mid-fade blocks → zero in 3/5 runs, single ≤25ms otherwise;
Chrome zero. Also `993b6b6`: prewarm slotted character payloads at
beforeNavigate (mirrors autoSlots resolution) — no measurable localhost effect
but prevents staggered post-mount re-parse rebuilds under real network latency.

## Track A status: deferred, with evidence

The handoff's Track A levers (defer lanes post-paint, split the component,
memoize pipelines) attack the Svelte-flush slice — which the profile shows is
~20ms, NOT the bottleneck. The dominant cost is chunk parse/compile, which lane
deferral can't fix. If the block ever needs shrinking for real (it's currently
masked), the lever would be reducing/splitting the planner chunk's code volume,
not deferring deriveds. The timeline extraction (`docs/rounds/timeline-extraction-cleanup.md`)
still makes memoization/deferral trivial if wanted later.

## Measurement recipes

the rAF-gap harness (from the now-pruned planner-perf handoff) is reproducible via the `verify` skill; this session's scripts
(gap.mjs, fadeprobe.mjs, profile.mjs — CDP Profiler with self/total
aggregation) lived in the session scratchpad; the fadeprobe idea (sample
computed opacity of `.tool-page` per frame after nav-click, assert monotonic
full-range ramp) is the right regression check for any future fade change.
