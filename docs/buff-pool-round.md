# The buff-pool round — record (2026-09-17, branch `engine/buff-pool-round`)

_The first engine round after the essential-characters tranches. Scoped with
Nate first (⚓ his ruling from T1.5: the FIRST-effect-length defect was not to be
fixed ad hoc — census, then row options, then the fix). This file is the record;
`essential-characters-2026-09-15.md` §10's "engine queue" entry points here._

## 0. What was wrong

Three defects shared the same twenty-two emit sites in
`src/lib/utils/buffWindows.ts`:

1. **A cast buff pool took its span from its FIRST effect.** Every cast-shaped
   site did `framesOf(barEffects[0].duration!)` after filtering, so a pool
   holding a 12s ATK buff beside a 15s ATK% buff drew both to whichever was
   authored first. Live: Iansan's C2 +30% ATK% ran 15 → 12s on every receiver;
   Skirk's C2 +70% ATK ran 12.5 → 2.6s on herself; Kazuha's C2 self twin was
   HELD in T1.5 because it pooled with his C6's 5s buffs and drew them 9.48s.
2. **The stat dedupe ran BEFORE the per-event conditions** (§1.H of the
   backlog). At pool construction a `stacks` gate is unresolvable, so two tiers
   of one stat collapsed to the first-authored. Skirk's A4 Burst DMG tiers
   (gated on Cryo/Hydro count) drew in NO team, because the burst's own
   stack-gated Burst DMG buff sat first in the pool and lost its gate at the
   cast. Iansan's tier ORDER was a load-bearing mitigation.
3. (Adjacent, NOT taken here) a character's `onHit` buff anchors only on its own
   swings (`hitsForTrack` filters by the track's character). Same file, a
   different axis — the hit stream's SOURCE. Queued.

## 1. The fix — one restructure

Per event (cast, hit, tick, NB bar): evaluate every candidate's conditions with
the EVENT's snapshot → dedupe by stat, keeping the first SURVIVOR → **partition
the survivors by `duration`** (`partitionByDuration`, first-seen order) → emit
one window per part. The faction split (`byProvenance`) was the precedent — a
pool is one span, so anything that changes the span splits the pool — and the
artifact `onHit` branch already partitioned by `(debuff, duration)`.

- The pools are now UNDEDUPED at construction (`poolsFor`, `activeEffectsFor`,
  `selfEffectsFor`, the block/tick prefilters); `dedupByStat` and
  `dedupResShredByElement` run per event.
- The refresh-in-place `lastWin` at the hit and tick sites is keyed by duration
  (`lastWinByDur`) — one open window per part.
- `poolFirstEffect` (the row's attribution / primary stat) still reads the
  pre-partition pool's first effect. Unchanged semantics.
- ⚠️ The received-surface note that said "supply the context, ⛔ never reorder
  the dedupe" was about a gate the CONTEXT could answer (team element counts,
  the T1 fix). A stack gate is answerable only per event; this is the ordering
  that lets it be. Strictly a superset: a gate still unresolvable at the event
  (a `state` gate, §1.G) keeps the first-authored tier, exactly as before.

**Measured** (corpus digest, every character + `> Kaeya E N1 N2 N3 > Xingqiu E Q
N1 N2 N3`, C0 and C6): **4 of 252** digests move — iansan@C6, skirk@C0
(A4 +15% draws), skirk@C6, kaedehara_kazuha@C6 (the twin). A real-team probe of
the other §1.H names is byte-identical: Neuvillette A1, Navia A4 and Nahida are
`teamElementCount`-gated and the T1 context fix (`d71bca2a`) already resolved
them; Varesa A1's tiers are state-gated (§1.G) and fall to the first tier both
ways. ⚠️ The static census (13 pools with mixed durations) over-counts: it
cannot see press/hold variants replacing each other or constellation-exclusive
tiers. The parse probe is the list.

## 2. The row — one bar, one seam (⚓ Nate 2026-09-17)

Two parts from one cast share a ROW (the row key is the source) and overlap
from the same start. Options put to Nate: (a) one bar with a seam where the
shorter part ends; (b) one row per duration; (c) nested bars. ⚓ **(a), try it
and judge; (b) is the fallback.**

`fuseNestedBars` (`src/lib/timeline/mergeRefreshedBars.ts`) runs BEFORE the
refresh merge in both projections. Bars sharing a START in one row fuse into
one bar to the longest end, `seams: number[]` at each inner end, and every
effect carrying its own length as `note` ("12s" beside a value whose bar runs
15s). The renderer draws a seam as the leading edge's ink (`.rp-buff-seam`,
white .3, 2px); the PNG export paints the same at both lane-bar sites; the
tooltip prints the note in the footer's register.

- ⚓ This is the merge law's seam, not a violation of it: "no interior seams"
  refuses a seam at a REFRESH; a seam here says the buff CHANGED.
- ⛔ A seamed bar never refresh-merges.
- ⚠️ The note is the effect's LENGTH (`duration` on the received surface),
  not the slice's `end − start` — a slice ends where the receiver leaves the
  field, and Iansan's ATK on her own row is 0.58s of a 12s buff. Notes key on
  length, seams on end; the fused bar's `duration` is the longest.
- ⚓ An identical grant (same stat, same printed value) is ONE line, the longer
  instance wins, and its end is a seam only if it survives. Kazuha's C2 gives
  +200 EM to the active character AND to himself ("do not stack"): on his own
  row the active slice and the self half print once, no seam at his swap-out.
- Guards: an envelope bar (ramp/decay) is held out of the fuse on the received
  surface; a ledger bar on the team surface.

Verified on the production build in headless Chrome (`Iansan E Q > Xiangling
N1 N2 N3 > Kaeya E N1 N2` at C6): one "Iansan Q" bar per receiver, the seam at
12s, tooltip ATK 12s / ATK% 15s under a 15s footer. ⏭ **Nate judges the seam
on screen**; if it does not read, key the row by duration.

## 3. Commits

- `35890b64` fix(planner): one window per duration, dedupe after conditions
- `5a9bc4e6` polish(planner): the seam projection
- `56d74316` polish(planner): identical grants collapse; seams from surviving lines
- `86cb9d32` feat(data): Kazuha's C2 self twin

Gates: vitest 1870/1870 (seven new fuse tests), check, lint, build; e2e before
the merge.

## 4. Still queued (from the scoping of 2026-09-17, Nate-approved order)

Small-fix bundle → per-cast `icdGate` → `onStack` → cooldown reduction →
`Summon.conditions` → `terminatesOn` a different cast → `onSwapIn` / `onCast`
ability binding. `P` with no `plungeFrames` is **provisional** (⚓ Nate). ⚠️ A
normal's application at `frames.hit` (§1.K) must ride the clock's task queue.
