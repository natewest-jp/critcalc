# The crest is one rest — the starfield holds its frame across tools

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

**⚓ Nate 2026-08-07:** "the stars flash into a different stage of animation"
when navigating between tools. The scene should stay paused on the same frame
for as long as the user is in the crest tool space, whichever tool they're on;
it unpauses only on the way back to the landing.

Two bugs stacked — fixing either alone still flashes.

1. **The tool→tool leg woke the field.** `scheduleRest` in the (scene) layout
   un-rested on EVERY navigation. Now a leg that starts _and_ ends on a tool
   route leaves the rest alone. Only leaving tool space (the descend, or a
   static page) thaws it.
2. **Stopping the loop was never enough to hold a FRAME.** Star phases ran on
   absolute time (`fract((performance.now() + offset)/duration)`), and the
   camera's own animation loop draws every frame of a tool→tool crane
   _independently of the twinkle loop_ — so those draws jumped the field to the
   phase it "should" be at seconds later. ⚠️ The old comment claimed absolute
   time made resume "pop-free"; it guarantees the opposite.

**The STAR CLOCK (`sceneGL.ts`)** is the fix for #2: star phases run on their
own clock that holds at freeze and banks the paused span, so any draw during a
freeze reproduces the frozen frame and the eventual thaw _resumes_ rather than
jumping (that return was a second, unnoticed jump before). Bound to
`start()`/`stop()`, so "the field is running or frozen" stays one concept.

⚠️ **The freeze pins the phase of the last frame actually DRAWN, not
`performance.now()` at the stop.** They differ by ~1ms — invisible, but it made
the invariant a near-equality instead of an equality, and a probe can only pin
what is exact.

## probe-star-freeze (12 checks)

Every star phase is a pure function of the clock, so "frozen on one frame" is
exactly "`window.__scene.starTime()` does not move" — a numeric equality beats
diffing screenshots of a starfield. ⚠️ The probe surface reports the value that
reached the **shader**, not a recomputation of the clock; a recomputing probe is
blind to half the fix (it would report a frozen clock while the draw call
happily passed the raw timestamp). Verified both directions: re-breaking the
layout half drifts 2398ms across a leg, re-breaking the clock half 4725ms.

**Re-pinned:** `probe-tool-slide` carried `twinkle loop LIVE mid tool→tool leg`
— an assertion of exactly the retired behavior. It now asserts the field stays
rested.

Side benefit for `docs/rounds/transition-hardening-queue.md`: tool routes now do genuinely
zero starfield rAF from settle through every subsequent tool leg.

Related: `docs/rounds/ascend-revival-2026-08-02.md` (the scene) · `docs/rounds/scene-occlusion-perf.md` ·
`docs/rounds/bench-band-round.md` (the tool→tool legs this rides on)
