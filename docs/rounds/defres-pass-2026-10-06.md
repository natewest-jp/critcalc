# Instrument pass — Enemy RES & DEF (2026-10-06)

**Status:** branch `polish/viz-defres`. The eighth and LAST hands-on instrument pass (shape:
`docs/rounds/instrument-passes-2026-10-01.md` §0) — every Visualizers instrument has now had one.
Worksheet 05 is CLOSED; its notes moved to `docs/text/ledger/notes/vz_defres.md`. The
instrument was **Enemy DEF & RES**; it is now **Enemy RES & DEF**, internal id still
`defres`. The session was cut by a Mac freeze before Nate's first look and resumed the same
day.

## 1. Mechanics (re-verified against gcsim)

- **gcsim's `defadj > 0.9` clamp caps DEF INCREASES, never reductions** — so the DEF shred
  slider runs to 100%.
- Shreds ADD; shred × ignore MULTIPLY (`(1 − shred)(1 − ignore)` on the enemy's DEF term);
  several ignores add, capped at 100%.
- **Transformative, Lunar AND Stellar reactions ignore DEF.** Stellar was missing: Fandom's
  Stellar-Conduct formula has no DEF term, and gcsim sets `IgnoreDefPercent: 1` on every
  Stellar-Conduct hit (Qiqi, Yae, Cryo Traveler) and both Stellar Swirl hits.
- Above 75% RES each point of shred is worth LESS (`1/(4·res + 1)`); the big gains come
  from crossing back under 75%. (A first draft said the opposite; corrected.)
- Immune is ×0 — not a RES value, so no shred reaches it.
- ⚓ RES range (Nate's read of Stygian Onslaught: bosses commonly at 30/60/90, up to 200):
  base RES −50…200, rungs 10/30/60/90/200 + Immune, axis fixed at −100…200.

## 2. The data (`585adb52`, `687695a9`, `16e0132c`, `5f5fb9d3`, `fc1a1644`)

- **`resShred.mod`** — the in-game debuff a shred IS (gcsim's mod key, in our words). Two
  shreds naming one mod never stack. ⛔ Never infer it from same entry / same amount: the
  data cannot otherwise tell Zhongli's Jade Shield reached two ways (one debuff) from Citlali
  C2 or Linnea's Gleam (two that add).
- `DerivedCapability.amount/mod`, and **`shredSources.ts` → `shredSources.generated.ts`**,
  the derived sources table the picker reads (written by generate-character-index,
  drift-guarded in `characterIndex.test.ts`).
- **Raiden C2** (60% DEF ignore, self, the burst's 7s, `whileState: inStance`) and **Yae C6**
  (new class-scoped Stat `skillDefIgnore`, her Sesshou Sakura ticks only).
- **Mavuika C2's Ring −20% DEF** was missing. ⚓ It spans the Ring EXACTLY: the Ring summon
  opens `searingRing` for its life (`Summon.opensState`, Odette's precedent) and the shred
  is cast on Tap E (`input: ['E']`) and clipped to it (`whileState`). A first cut rode the
  Ring's hits (≤2s slack at each end) and was replaced the same day. Nate checked E,
  `E ~5s Q` and `hE` at C0/C2/C6 on screen.
- **Durin's Secret Rite description** lost two pieces of curator-speak.

## 3. Two engine gaps closed (`16e0132c`)

- **A summon a CAST ends can open a state.** The state was opened at spawn with the end
  known then, so the Burst cut the Ring and left `searingRing` running.
  `retireSummonsOnCast` now closes the summon's state through `closeStateWindows` (the clamp
  a stance's early end uses); lint D.22c admits `terminatesOn: 'skill' | 'burst'` beside
  `opensState` (still refusing swap, extensions and `summonsFollowState`).
- **`onCast.input` reaches the bars.** It was honoured by the stack and cooldown passes and
  IGNORED by every buff window — partially-wired data, the class `orphanedSchema.test.ts`
  cannot see. `collectOnCastEffects` applies it whenever the caller knows the token (all
  three buff-window sites). ⚠️ Visible beyond Mavuika: **Razor C6's** Hold-only CRIT buff and
  **Mavuika C6's** Hold-only shred no longer draw after a Tap. `getNonAbilityEffectsForCast`
  (shields, infusions) passes no token and is unchanged.

## 4. The surface (`848e3821`, `ec428337`)

- ⚓ The two charts STACK (the toggle is retired) over one combined readout (DEF × RES).
  Pointing only READS (a crosshair and a value); press-and-drag sets.
- ⚓ **The reading is a glass TAG**, not outlined text (⚓ Nate): an HTML overlay wearing
  `.ctx-glass` at the engaged density (`--surface-hover`, .80 — .58 read too thin over the
  curves), placed by `bottom`, never a transform.
- ⚓ **One caption under each chart** (Nate's pick, over the top of the readout): it explains
  the chart's shape; the readout's regime line speaks for the reading.
- Sources picker from the derived table — per-element RES shred, DEF shred, DEF ignore,
  constellation-badged, alternatives as amount chips, plus "Other sources" sliders. Share
  state v1.
- ⚠️ **Shrink-to-fit rules live ONLY in the ≥60rem container query** — applied everywhere,
  they squeezed narrower tiles into the tile height with no scroll (Nate caught it).
- ⚠️ The chart wrapper is a grid with an EXPLICIT `minmax(0, 1fr)` column — an auto column
  grows to the SVG's width (the Artifact Odds clipping hazard). The background check found
  the hazard in NONE of the other five instruments (ICD, Gauge, Reaction Curves and Wish
  use a plain block in a `minmax(0, 1fr)` column; Breakdown lays out in percentages) — from
  the CSS, not a browser.
- ⛔ **Tried and cut: a gold `RES` / `DEF` kicker over each chart** — the first kickers on the
  bare scene. ⚓ Nate: the rename was enough; the RES chart says "shred" all over it.
- ⚓ **Renamed Enemy RES & DEF** so the name reads in the instrument's own order (RES chart,
  readout row and shred list all come first; DEF drops out for reaction damage). Help anchor
  `#enemy-res-def`; the termbase lists the old name under `avoid`.

## 5. Copy (⚓ Nate, lines 1–20 approved)

- ⚓ **Shred works at half / full / less than full STRENGTH, never "points"** — the game only
  says "decreases RES by X%"; points are the arithmetic.
- The dropped explainers became the two captions; "equal levels already cost you half"
  LEADS the DEF one (worksheet 05). The VV note stays dropped — VV is a checkbox in the list.
- The Help section is rewritten to match.

## 6. Gates

vitest 2293 · check · lint · build green at `ec428337`; full e2e before the merge (see the
merge commit).

## Notes carried over from Claude's working memory (2026-10-29)

From `docs/rounds/defres-pass-2026-10-06.md`:

- ⚠️ Lesson: Claude told Nate "no engine change" for Mavuika before checking, and it needed two. Probe the actual bars (a throwaway vitest under `src/`, deleted afterwards) before claiming a shape works; the probe is what found both gaps.
- Still open at the close: form switching mid-Blessing (Mavuika's skill re-cast) is unmodelled, and at C6 her C2 and C6 bars draw as two rows of one debuff (Nate accepted that). The other five instruments were checked for the svg-width clipping hazard from CSS only, and none has it.
