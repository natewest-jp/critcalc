# Parser hardening sweep — `notationParser.ts`

**Date:** 2026-08-14 · **Method:** 5-angle adversarial workflow (14 agents, ~70,000 fuzzed
and hand-built inputs), each finding independently reproduced by a separate verifier.
**Context:** pre-launch review of the site's only arbitrary-user-input surface.

> Persisted from a workflow run whose raw output lived in a temp directory. The
> **CLEAN list is the most valuable half of this document** — it records what was
> attacked and found sound, so nobody re-hunts it.

---

## Bottom line

**The parser's logic is sound. Its accounting is missing.**

Across every angle, every result was walked for non-finite numbers, negative
durations/cooldowns/starts, out-of-order `events`, inverted windows (`end < start`),
duplicate event ids and `readyAt < time`. **Zero violations, in any input, ever.** Not one
uncaught exception from the state machine.

Every defect found is one class: **no ceiling on how much work or output a single line of
input may produce**, and **no length cap anywhere on the notation path — including the `?r=`
share link.** That last part is what made it a launch blocker: payloads deflate to 52–360
character URLs that freeze or kill the _recipient's_ tab on load.

⚠️ **Caveat carried from the report:** browser-tab death is _inferred_ from measured Node
heap figures, not observed in Chrome/Safari. The multi-second main-thread freezes **are**
directly measured.

---

## Confirmed defects

Ordered by how little input it takes to fire. All rated **high**: no data loss, no
corruption, no security boundary crossed — availability of one victim's tab, recoverable by
closing it.

### 1. `~Xs` time advance is unbounded → tab OOM from 14 typed characters

- **Repro:** `Ifa ~99999999s` (any roster name works)
- **Observed:** parses in 2.5 ms, returns `totalDuration = 99999999`, `unknownTokens = []` —
  the parser says "I understood this." That flows into `rulerTicks`, which allocates one
  object per second. `1e6` → 155 MB / 49 ms; `1e7` → 853 MB / 586 ms with a visible stall;
  `4e7` → fatal OOM (exit 134). The array feeds **two** keyed `{#each}` blocks, so real DOM
  cost is 2× and the tab dies below the array-level threshold.
- **Root cause:** `notationParser.ts:3471` checks `isFinite(delta)` with no upper bound;
  `RotationTimeline.svelte:675-717` propagates unclamped; `barGeometry.ts:35-45` guards only
  `!isFinite(dur)`.
- **Fix:** clamp the `~Xs` delta (≤ 3600 s) _and_ cap tick count in `rulerTicks`.
- **Mitigation:** the trailing `s` is required, so this does **not** fire progressively while
  typing. Needs a paste, a held key, or a link. The 52-char `?r=` param
  `2~q1YqU7Iy0lHKyy9JLMnMz1OyUnLJzClNVvAzVKgzNICCYqVaAA` reproduces it with zero victim
  interaction.

### 2. `expandBrackets` caps the repeat count but not the total output

- **Repro:** `'Bennett 99[' + 'N9'.repeat(2000) + ']'` — 4,012 chars → 1,782,000 IR events,
  ~700 MB–1.3 GB heap. At 24–28 KB → fatal OOM on a 4 GB heap. As `?r=`, a **~116–190
  character URL**.
- **Observed:** no error — the parse _returns_, correctly, having allocated gigabytes first.
  Below OOM size it is a multi-second synchronous freeze **on every keystroke**
  (2 KB ≈ 400–600 ms, 8 KB ≈ 1.4–1.9 s).
- **Root cause:** `notationParser.ts:877-905`. `MAX_BRACKET_REPEATS = 99` is clamped per
  group (line 900); nothing bounds group count, body length, or total expanded tokens. `N9`
  costs 2 chars and yields 9 action events × 99 repeats ≈ **445 IR events per input
  character**. Control: the same 6 KB body without the bracket → 18,000 events / 20 ms / 19 MB.
- ⚓ **Explicitly not by design** — line 898's own comment says the cap exists because an
  unbounded repeat "would freeze or OOM the tab." The guard covers one of two multiplicands.
- **Fix:** total-expansion budget in `expandBrackets` (cap `result.length`, bail and flag).

### 3. Quadratic `inferredStates` — 412 characters of valid notation freezes for 5 s

- **Repro:** `'Bennett 99[' + 'Q'.repeat(400) + ']'` → 5.3 s; `'Q'.repeat(800)` → 35 s;
  9,608 chars did not return under a 120 s alarm.
- **Observed:** hard main-thread freeze. Every token is valid KQM, `unknownTokens` empty, IR
  correct — it just takes 35 s. As a share link the 35 s payload is a **~90-character URL**,
  and `importShared` writes it to localStorage, so the planner **re-kills itself on every
  reload** until site data is cleared.
- **Root cause:** `notationParser.ts:572` — `inferredStates` runs
  `emittedCasts.some(c => activeDuringSummon(c))` across every cast the character has already
  emitted; `computeCurrentStates` (line 2895) calls it on every action _and_ every cast →
  O(casts-per-character²). Gated on `getPersistentBehavior(E|Q) === 'stationary'`.
- **Controlled confirmation:** at identical cast counts Keqing (branch never runs) is
  **linear** — 11/19/40/62 ms — while Bennett and Diluc are **quadratic** — 66/90/280/1087 ms.
  Xiangling quadratic at half the constant. Affects 38/123 characters.
- **Fix:** memoize per character (a boolean that flips once a qualifying cast is emitted).
- **Not organic:** the driver is casts _per character_. A realistic four-character rotation
  cycled out to 5,319 characters parses in **19 ms**.

### 4. Catastrophic backtracking on `~` followed by a long digit run

- **Repro:** `'~' + '1'.repeat(40000)` — bare tilde plus digits, **no character name needed**.
  2,350 ms per tokenize pass; 9,439 ms at 80,000; killed at 200,000. Clean 4× per 2×.
- **Observed:** costs **three** independent quadratic passes per keystroke —
  `tokenizeNotation`, `flagNotation`, and the CodeMirror highlight ViewPlugin (which fires on
  `update.docChanged || update.selectionSet`, i.e. also on caret moves and clicks). ~5.3 s of
  blocked main thread per keypress at a 20 KB digit run.
- **Root cause:** `tokenizer.ts:237` (also `:146` `CONCAT_SPLIT_RE`, `:114`
  `classifySubToken`) — the time alternative `~(?:\d+\.?\d*|\.\d+)s` has two adjacent digit
  quantifiers split by an optional dot. When the run is **not** terminated by `s` the match
  must fail, and the engine retries every `(i,j)` split of `\d+`/`\d*`.
- **Controls:** `~`+digits+`s` matches instantly (0.02 ms at n=10,000); the same digits with
  no `~` are instant; `~123` + non-digits is instant.
- **Fix:** `~(?:\d+(?:\.\d+)?|\.\d+)s` at all three sites. Zero behaviour change.
- **Vector:** 200,009 digits deflate to a **362-character URL**.

### 5. Quadratic tokenizer scan on unmatched `(` or `[`

- **Repro:** `'( '.repeat(20000)` → 1,132 ms; 40,000 → 4,689 ms. Packed: 200 KB → 61 s;
  400 KB → still running at 150 s. `[` identical.
- **Root cause:** `tokenizer.ts:237` and `:146` — alternatives `…\[[^\]]*\]…` and `\([^)]*\)`.
  At every unmatched opener the engine consumes it and lets `[^)]*` / `[^\]]*` run to
  end-of-input before failing. N openers × O(remaining) = O(n²). Not exponential — an
  unbounded linear rescan per position.
- **Controls that isolate it:** 40,000 unknown tokens using a non-scanning char → 27 ms vs
  2,290 ms, with _identical_ `unknownTokens.length` (downstream exonerated). Appending one
  `)` → 1,132 ms drops to 0 ms.
- **Fix:** bound the scan (`\([^)\s]{0,64}\)`), or require the closer to exist before
  entering the alternative.
- **Lowest realism of the five.** Balanced text is cheap (80,000 chars of `((((…))))` → 1 ms;
  minified JS-shaped text → 0 ms; a pasted minified `ganyu.json` → 5 ms).

### 6. Unbounded spread-push → `RangeError` (⚠️ code-confirmed, not fuzz-verified)

Dropped by the workflow's verification cap; **the code sites and the V8 behaviour were
confirmed directly.**

- `notationParser.ts:904` — `result.push(...innerTokens)`
- `notationParser.ts:4139` — `windows.push(...buffWindows)`
- V8 throws `RangeError: Maximum call stack size exceeded` at 200k spread elements.
- ⚓ **A throw is worse than a hang here**: with no error boundary it is an instant white
  screen. Ranking `hang` above `throw` in the verify cap was the wrong order.
- **Fix:** loop or chunk the pushes.

---

## The multiplier common to all of them

- **No length cap anywhere on the notation path.** Grepped `src/lib/components` and
  `src/lib/utils`: no `maxLength`, no `MAX_NOTATION`, no slice.
- **`?r=` is the remote vector.** `decodeRotation` validated the `2~` marker, `v === 2` and
  `typeof notation === 'string'` — **no length check**. `rotation-planner/+page.svelte:162`
  imports it in `afterNavigate`. All payloads compress to 52–360 characters and were
  round-tripped through the repo's own codec.
- **No debounce.** `notationEditorExtension.ts:495` fires `onChange` on every `docChanged`;
  `RotationTimeline.svelte:361` parses in a synchronous `$derived.by`.
- **The `try/catch` at `RotationTimeline.svelte:359-381` is useless here** — nothing throws,
  and a heap OOM is not a JS exception.

---

## ✅ What was attacked and came back CLEAN

⛔ **Do not re-hunt any of this. Corrupt IR is not there.**

- **Semantic nonsense** (~31,000 fuzzed + 101 hand-built): `sQ` before any `Q`, `sQ sQ sQ sQ`,
  impossible transient-state orders on Flins/Varesa/Durin/Cyno/Skirk, stance thrash, a
  character named 30×, 20 and then all 123 distinct names in one notation, names colliding
  with token syntax (Qiqi, Escoffier, Diluc, Jean, Chasca), bare tokens used as names,
  out-of-range/negative/NaN constellations. All graceful.
- **Structural malformation** (20,000 randomized + 6,000 structured + hand battery): nesting
  to depth 1000, unbalanced delimiters, interleaved mismatched delimiters, empty/whitespace
  groups, separator abuse, the `re.lastIndex` restore hazard the tokenizer comments warn
  about. All ≤5 ms.
- **Bracket nesting does not multiply.** `[[N1]x99]x99`, `99[99[N1]]`, 50-deep → 0 events,
  ~3 ms. `[^\]]*` cannot span a nested bracket and `expandBrackets` never recurses.
  `MAX_BRACKET_REPEATS` holds per group: `999999999[N1C]`, `[N1C]x999999999`, a 400-digit
  prefix all clamp to 99.
- **Huge N/C counts are unreachable.** `N9999` splits to `N9,9,9,9` and is absorbed as one
  unknown token. Same inside brackets.
- **Stack asserts are inert.** `{seal:999999999}`, 60-digit counts, 300 consecutive asserts —
  the push loops read curated `fx.amount`, never the user's number.
- **Text and encoding** (84 hand cases + 12,000 fuzzed over 60+ hostile code points):
  zero-width, BOM, bidi/RTL overrides, 200,000-mark Zalgo stacks, emoji + ZWJ + regional
  indicators, astral plane, lone surrogates, all 32 C0 controls, NUL, homoglyphs, exotic
  whitespace. All clean, ~3 ms.
- **Pathological whitespace is a non-issue at any size.** 8 MB of `\t\n \r` → 19 ms.
- **Raw volume is linear.** 100k tokens → 151 ms; 1 MB → 366 ms; 30k segments → 299 ms;
  100k `>` → 16.5 ms; 1 MB of one unknown word → 2.7 ms. Empty segments are mildly
  super-linear (~n^1.6, 500 KB → 2.3 s) but that is GC pressure, not a trap.
- **Other regex shapes probed for backtracking and found safe:** the bracket prefix, the
  stack-assert pattern, `\/\S*`, `[^\s>]+`, and 200k-char runs of digits, `1-`, `z`, `A`,
  `~`, `{`, `/`.

---

## Fix order

⚓ **Item 1 alone blunts all of them** — it closes the remote vector, after which everything
else is self-inflicted-only.

1. ✅ **Hard length cap in `decodeRotation`** + `maxLength` on the editor — `015f610`.
2. ✅ **Total-expansion budget in `expandBrackets`** — `MAX_EXPANDED_TOKENS = 20_000`. 1.78M
   events/~1GB → **180k events / 139 ms**. `37c01f4`.
3. ✅ **`~Xs` clamped** (`MAX_TIME_ADVANCE_S = 3600`) **+ `rulerTicks` capped**
   (`MAX_RULER_TICKS = 10_000`) — 99,999,999s → 3,600s; ~1e8 ticks → 10,000. ⚠️ Two
   INDEPENDENT guards: the per-token clamp cannot bound a document full of small waits,
   which sum. `37c01f4`.
4. ✅ **Regex fix** at all three scanning sites — 80k digits **9,439 ms → 0 ms**. `37c01f4`.
   ⚠️ **Correction to §4 above:** this is zero-behaviour-change not because the pattern is
   equivalent, but because these are only the SCANNING patterns — kinds are assigned by a
   separate `/^~[\d.]+s$/` that never backtracked. `~12.s` and `~12.5.7s` still classify as
   `time`, verified. ⛔ Do NOT "align" the two patterns as a tidy-up; that WOULD change
   behaviour.
5. ✅ **Both spread-pushes are loops** (§6) — `37c01f4`.
6. 🟡 **PARTIAL — `inferredStates` (§3)**, `04fd258`. ⚠️ **Correcting §3's own suggested
   fix:** "a boolean that flips once a qualifying cast is emitted" would be a **correctness
   bug** — summon windows CLOSE (`cursor < start + uptime`), so a latching flag reports
   `duringSummon` forever after the first cast.

   Isolated by stubbing the function: it is **76% of parse time** (396 ms → 94 ms without
   it). ⚓ **And the cost is the MISSING scan, not the matching one** — a pure-burst run
   makes the skill branch walk every cast and never match, and vice versa. Interleaved E/Q
   measured _faster_ than either pure run (180 ms vs ~400 ms). `castKindsByChar` now indexes
   which kinds exist and skips an absent branch.

   Measured at 12,000 casts: **all-E 421 → 47 ms (9×)**; all-Q 392 → 366; mixed 180 → 173;
   16 KiB worst case **678 → 646 ms**.

   ⏭ **Still open — the present-but-not-matching scan.** With many Bennett bursts the field
   expires ~3 s before each recast, and in those gaps the burst branch walks every cast for
   nothing. A time-ordered early break would close it, but is sound only if a cast's
   `uptime` is stable during parse — and this function's docblock documents that extendable
   stationary summons carry un-extended uptime until finalize. ⛔ Not worth that risk for
   pathological-input-only time.

7. ⏭ Still open, non-blocking: bound the `[^)]*`/`[^\]]*` scans (§5); debounce the editor
   parse. ✅ The error boundary landed separately in `cbedff0`.

**Status: the sweep is CLOSED for launch.** Every measured figure was re-verified in a
scratch harness against real modules after the fixes; realistic rotations are unaffected
(1,037 chars → 280 events, 9 ms, zero unknown tokens).
