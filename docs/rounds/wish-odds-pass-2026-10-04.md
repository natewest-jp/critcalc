# Instrument pass — Wish Odds (2026-10-04)

**Status:** branch `polish/viz-wish`. The sixth hands-on instrument pass (shape:
`docs/rounds/instrument-passes-2026-10-01.md` §0). Worksheet 06 is CLOSED; its notes moved to
`docs/text/ledger/notes/vz_wish.md`. Mechanics truth: `docs/library/game/wish-mechanics.md`.

## 1. The mechanic: copies, not "the featured one" (`wish.ts`)

Nate's ask: the odds of C6 on a featured 4★ — "most modern characters are really only an
upgrade if you have their C6." It became the instrument's whole model: every target is
ONE chain (pity × guarantee × copies), walked a pull at a time (`copiesCdfs`), reading
"at least j copies within n pulls" for every level on the way.

- **The oracle is GGanalysis** (github.com/OneBST/GGanalysis — the library the 5★ model
  already cited), installed in a scratch venv and RUN. Nine fixture rows in `wish.test.ts`
  match it — mean to 2 dp, median and p90 exactly. Means from nothing: 4★ C0 34.4 · 4★
  C6 241.1 · 5★ C0 90.3 · 5★ C6 632.3 · R1 86.5 · R5 432.7. The closed-form one-copy pmf
  (`featuredPmf`) stays as a cross-check the walk must equal.
- **4★ rules**: 5.1% through 8, 56.1% on the 9th, certain on the 10th (wiki
  `Character_Event_Wish` § Rates, the 9.45M-wish estimate); 50% featured, losing
  guarantees the next (official); which of the three is **⅓ each** — unpublished, the
  universal community model, ⚓ Nate: taken as given ("if that were not true, it would be a
  bit sensational").
- ⚠️⚠️ **A featured 4★ can't come from a lost 50/50 on its own banner.** Every 4★ joins the
  standard pool a version after debut, and the first plan modelled an off-banner path for
  reruns (measured −3.6 pulls at C6) — then the banner's own Wish Pool showed the featured
  three EXCLUDED from its off-rate list (Surging Ballad 2026-09-23: Diona, Faruzan,
  Chongyun). The "rerun" toggle Nate approved was dropped before it was built.
- **Left out, measured:** a 5★ pushing a 4★ to the 11th pull (+1 pull, 0.4%, at 4★ C6).
  Multiple 5★ copies take each 5★ as an independent 55%; GGanalysis's conservative
  Radiance counter differs by <1% at C6 (637.1 vs 632.3).
- **5★ and weapon**: separate pities, so the pull counts ADD (`sumCdf`, a convolution) —
  stop each banner at its goal.
- The walk stops at a 10⁻⁶ tail (`cdfAt` reads past the end as certain); the axis runs to
  the goal's 99.9%, in tens.

## 2. The instrument

- **Pulling for**: Featured 5★ · Featured 4★ · Charted weapon · 5★ and weapon. Each banner
  section has **You have** (Not owned, C0…) / **Aiming for** (to C6 or R5), its own pity
  and guarantee; switching targets keeps each banner's state.
- **Chart**: one line per level, the goal's bold, labels where each crosses 50% (a pair's
  goals at 75% / 25% — their medians are often equal). A crowded fan keeps the goal's label
  and drops what collides; a label that would hit the y axis flips right. Soft pity only
  for the next 5★ copy. ⛔ The peak-normalised pmf silhouette is retired.
- **Readout**: the goal's chance (phrase on its own line), a level table (Chance · Half by
  · Unlucky tenth), the mean "from here".
- **One controls panel** (⚓ Nate): Pulling for and the banner sections in ONE panel, so a
  shared tile no longer split the banner panels around Pulling for.
  - **Wide (tile ≥ 60rem)**: Readout full-height right; sections side by side, Pulling for
    a fixed 11rem column of stacked chips.
  - **Shared (38–60rem)**: chart full width; panel and Readout at an **even 50/50** (⚓
    Nate — a column sized to its chips changed width with the target). ⛔ `.panels`' 22rem
    multicolumn can't do it: two 22rem columns don't fit a 675px tile, so it stacks.
    Level chips tightened (0.35rem padding, 0.2rem gap) so "Not owned … C5" holds one row
    down to two tiles at 1360 — 267/272px, Chrome and WebKit. Fallback if a font change
    wraps it: "None".
  - **Narrow**: everything stacks; 0 overflow at 390.
  - ⚠️ **Every item names its grid area.** A lost `grid-area: readout` left the Readout
    auto-placed in the chart's row; its height stretched that row and pushed the panel
    down in the pair view (Nate caught it). The same trap as SiteChrome's auto-placement.
  - Sections keep the panel's 0.7rem grid rhythm — as plain blocks, what followed a slider
    sat on its track.
- Share state `v: 2` (target, pulls, per-banner state); a `v: 1` link still opens.

## 3. Copy

⚓ **The vantage point is the player's** (Nate; style guide §1.10): explainers say what
happens to you ("you'll win the 50/50 about 55% of the time"), ⛔ not the pool's view. Nate
rewrote the explainers; Claude's edits: "you'll" for "you should", per-4★ / per-5★
framing, and the 4★ long run **22%, not 25%** (⅔ × 16.7% + ⅓ × 33.3% — the plain average
assumes half your 4★s are guaranteed; cross-checked 34.45 / 7.66 = 4.5 4★s per copy).
"Guarantee held …" / "Fate point held" keep "held"; the 4★ label is Nate's "(last 4★
wasn't featured)". ⛔ No line explains that losing guarantees the next one. "Odds only —
no verdicts" is gone (§1.3).

⏭ **Help's Wish Odds section** describes the new instrument but in the pre-§1.10 voice —
Nate will rewrite it with Claude in a dedicated session.
