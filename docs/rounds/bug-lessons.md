# Bug lessons

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

Two resolved bugs distilled to their lessons. Code-level fixes are already in main; this file exists so future work can recognize the patterns.

---

## Timeline Freeze — NaN propagation through Svelte 5 derived signals

**Resolved 2026-04-07.** Root cause: `~[\d.]+s` in the tokenizer matched `~.s` (a bare dot with no digits, an intermediate state while editing `~?s`). `parseFloat(".")` = `NaN`, which poisoned `localCursor`, propagated into `eReadyAt`/`qReadyAt` Maps via `Math.max(x, NaN) = NaN`, and ultimately set `track.activeStart = NaN` on subsequent tracks. Svelte's keyed `{#each slotTracks as track (track.activeStart)}` then threw `each_key_volatile` because `NaN !== NaN` — which crashed the Svelte reactive scheduler and froze the entire page including unrelated buttons.

**The lesson — Svelte 5 derived caches thrown errors and freezes the signal subtree.** Any unhandled exception in a `$derived` permanently stops that signal subtree. Always wrap expensive/fallible deriveds in try/catch returning a safe empty value. The pattern lives in `RotationTimeline.svelte`'s `rotation = $derived.by(() => { try { return parseNotation(...); } catch (e) { console.error(...); return EMPTY; } })`.

**Defensive practices that came out of this:**

- Time regexes: anchor digits required on both sides of the optional dot. Bare `~.s` should fall through to `unknown`, never enter the parser as a `time` token.
- NaN-safe cooldown enforcement in the parser: `isFinite` guard before any `Math.max`-style merge. `if (isFinite(delta)) localCursor += delta`.
- Keyed `{#each ...}` keys must be stable strings, not values that can become NaN.
- `externalUpdate` flags around CodeMirror `view.dispatch()` should sit in try/finally so a throw doesn't leave the flag stuck `true` and silently swallow keystrokes.

---

## Tokenizer Crash + Multi-word Name Mis-classification — `re.lastIndex` reset on null exec

**Resolved 2026-04-21.** Root cause: `tokenizeNotation` in [src/lib/utils/tokenizer.ts](src/lib/utils/tokenizer.ts) — the multi-word name absorb loop called `re.exec(notation)` and broke without restoring `re.lastIndex` when `exec` returned null. JavaScript automatically resets `lastIndex` to 0 on null exec. The outer `while ((m = re.exec(notation)) !== null)` then continued from position 0, re-matching tokens already consumed.

Two distinct symptoms, one bug:

- **Unrecognized chips:** for a bare character name like "Xiangling" or "Hu Tao", the absorb loop hit end-of-string, lastIndex reset to 0, and the outer loop re-matched the name with `atSegmentStart = false`. The second pass fell through to `splitConcatenated`, which classified non-action-prefix words as `unknown`. Both a `character` token AND `unknown` tokens for the same text were emitted.
- **Crash on typing after `> `:** for "Xiangling E > F", the absorb loop on "F" hit end-of-string, reset lastIndex to 0, the outer loop re-processed everything, hit another end-of-string during "F"'s next absorb, ad infinitum.

**The lesson — when reusing a `/g`-flag regex across nested `exec` loops, always restore `re.lastIndex` before breaking, including in the null-match branch.** JS's automatic reset-to-0 on null exec is the footgun. The fix: `re.lastIndex = peekIndex;` before `break` in the `if (!nextM)` branch of the absorb loop.

**Adjacent observation:** `autoSlots` in `+page.svelte` was simplified to per-segment split-based matching with a 3-word greedy multi-word prefix during this debug. That change wasn't required — the tokenizer fix alone resolved both symptoms — but the simpler `autoSlots` was kept since it's adequate for its narrower use case.

---

## Team-Buffs Row Freeze — `each_key_duplicate` from a render-key coarser than the dedup key

**Resolved 2026-06-23** (branch `fix/rotation-planner`, off `main`). Symptom: entering a rotation froze the whole planner — even the reset button — until a hard refresh. Order-dependent: `Mavuika E > Ororon E Q > Chevreuse hE Q` froze, but `Mavuika E > Iansan E Q > Ororon E Q > Chevreuse hE Q` did not. Console: `each_key_duplicate ... duplicate key chevreuse::Chevreuse reaction at indexes 0 and 1`.

Root cause: in `RotationTimeline.svelte`, `computeTeamBuffRows()` dedups rows in a `rowMap` keyed by a **granular** `rowKey` that includes the display stat (e.g. `chevreuse::char::onReaction::<stat>`). But the template's keyed `{#each teamBuffRows as subrow (...)}` re-derived its key from **coarser** fields — `` `${subrow.characterId}::${subrow.sourceLabel}` ``. Chevreuse's A4 emits **two** `resShred` effects on Overloaded (Pyro RES + Electro RES), which `rowMap` correctly keeps as two rows, but both carry the identical `sourceLabel` `"Chevreuse reaction"` → two rows, one render-key → Svelte throws. The order-dependence is a red herring about Chevreuse: both rows are only built when an Overloaded **reaction event** is actually emitted for her, and whether the parser emits one depends on the team's elemental aura state, which depends on sequencing.

**The lesson — a keyed `{#each}` render-key must be _exactly as unique_ as whatever key deduped the collection.** When a collection is built via a `Map` and rendered via a separately-derived each-key, the two keys can drift: if the render-key is coarser, legitimately-distinct rows collide. Don't re-derive the each-key from a subset of fields — carry the authoritative map key onto each row and render by it. Fix: `return [...rowMap].map(([key, row]) => ({ ...row, key }))` + `{#each teamBuffRows as subrow (subrow.key)}`. This also closed latent collisions for the `::resShred` / `::afterDuration::resShred` row pairs.

**Cross-reference:** this is the THIRD keyed-`{#each}` crash in this component (see the NaN `each_key_volatile` lesson above). Pattern to internalize for this codebase: **every `(expr)` in an `{#each}` is a crash surface** — it must be a stable, collision-free string. The sibling `charReceivedBuffRows` is safe precisely because its `rowMap` key (`` `${receiverId}::${bar.sourceLabel}` ``) is the _same_ expression the template renders by.

---

## Empty-Shell Navigation — Svelte revives outroing keyed blocks (same element, actions don't re-run)

**Resolved 2026-07-10** (`9e747b7`, follow-up to the paint-gated cross-fade `41a7ea2`). Symptom: tool→tool navigation intermittently landed on an "empty shell" — URL and chrome correct, page content invisible. Planner failed ~2/3 of the time in real use; all browsers.

Root cause: the cross-fade in `(tools)/+layout.svelte` used a one-shot `use:` action on the incoming `.tool-page` (set inline `opacity: 0`, double-rAF, fade in) plus an `out:` transition that retains the outgoing element 1.5s. But when you navigate A→B→A while A's element is still in its outro-retention window, **Svelte cancels A's outro and reinserts the SAME DOM element** (verified by `data-*` stamps surviving) — it does NOT create a fresh branch. The revived element still carries the inline `opacity: 0` it faded out with, and **`use:` actions do not re-run on a revived element**, so nothing ever fades it back in. A second latent bug in the same scheme: the action's style-cleanup `setTimeout` fired even after its element had since become the _outgoing_ layer, resetting it to opacity 1 mid-outro.

**The lesson — never drive enter/exit visuals of keyed-block layers from one-shot per-element hooks (actions, mount effects) + module-level "current outgoing" state.** Outroing branches are revivable; element identity and hook lifecycles don't align with navigation events. Instead, re-orchestrate ALL layers on EVERY navigation from `afterNavigate`: stamp each layer with the pathname it was created for (an action is fine _for stamping_ precisely because it runs once — a revived layer keeps its stamp), then each pass re-derives incoming (stamp matches new pathname) vs outgoing and restyles everything, freezing the incoming layer pre-paint (fresh → 0; revived mid-fade → its computed opacity, so the fade resumes without a pop) and bailing from stale rAF callbacks when a newer navigation owns the layers.

**Also observed:** `afterNavigate` runs after the new page's render flush but before the browser paints (probe: first painted frame had the incoming layer at opacity 0) — safe for pre-paint style freezes. And Svelte's transition manager sets `inert` on outroing elements and restores it on revival.
