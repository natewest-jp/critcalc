# Tool pages are REVIVED, not remounted — `onMount` registration is a trap

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

Navigate tool A → B → A inside the outgoing layer's retention window and Svelte
**cancels A's outro and reinserts the SAME component**. `onMount` does not run a
second time. The `(tools)` layout documents this at `TOOL_NAV_ANIM` and answers it
by re-deriving every layer's role in `afterNavigate` — that note is about
animations, but the hazard is general.

**The failure shape is worse than "it doesn't re-register".** Anything holding a
single last-writer-wins slot gets nulled by the OTHER tool's late teardown:

1. planner mounts → slot = P
2. → Team Builder → slot = T; the planner outroes but is retained, never destroyed,
   never unregisters
3. → planner → revived, no onMount, slot is still T
4. the TB finally tears down; its cleanup sees slot === T and nulls it

The tool on screen looks perfectly fine and its affordances are dead until a
reload. An identity-guarded unregister does **not** save you — it covers ordering,
not revival.

**Fix: key the registry by tool** (`BenchBandState#hosts`, 2026-08-13 `9c7374a`),
so an entry is removed only by its own tool and a stale one is simply not the entry
`mode` asks for. Re-registering from `afterNavigate` also works but leaves the
single-slot race in place and adds a second registration site per tool to keep in
sync.

⚠️ Found on `847acdb` (pre-existing — it killed the planner's character Source on
the same round trip), surfaced by the round that made ⇄ the planner's only slot
affordance. See `docs/rounds/rp-source-retirement.md` and `docs/rounds/bench-band-round.md`.

**How to apply:** before putting a registration, claim or subscription in a tool
page's `onMount`, ask what happens on A→B→A. If a single shared slot is involved,
key it by tool. `claimMetrics` in the same file already defends against the
neighbouring "retention-delayed unmount" case and is worth reading alongside it.
