# Wish Odds: Capturing Radiance's counter (2026-11-02)

**Status:** built on `feat/wish-radiance` (on top of `docs/capturing-radiance`), gates green.
⏭ Nate: the look in the dev server, the copy (proposed as a list in the session), real Safari
and an iPhone (the file picker through Files).

## 1. Why

From the streamer list (`docs/todo.md` Now 1): the community has a well-tested model of
Capturing Radiance, and a player's counter can be read from their wish history. The model, its
evidence and its open questions: `docs/library/game/capturing-radiance.md`.

## 2. The ruling (⚓ Nate)

- The official 55% stays, as "Don’t know", and is the default. A known counter switches the
  5★ character chain to the counter model.
- Built straight onto the instrument (no `/lab` demo).
- A by-hand path beside the import, shaped to keep entry mistakes out (§4).

## 3. Engine (`wish.ts`)

- The counter is a fourth part of the walk's state, on the character banner only and only when
  known. `RADIANCE_CHANCE = [0, 0, 1/11, 1]`: counter 2's 1/11 is the back-solve that makes
  the long-run rate exactly 55%, inside every community estimate (2–20%).
- Oracle: GGanalysis's `capturing_radiance_dp`, ported line for line to a scratch script and
  run with the same chances (a DP over 5★s, not pulls). The walk matches it to three decimals
  on the mean and exactly on the median and the 90th percentile, at every counter. Installing
  GGanalysis itself was refused by the session's permissions; the port stands in.
- `worstCasePulls`: the most a goal can take. With the counter known, the model's rules; with it
  unknown, only the official one (no more than three lost 50/50s in a row, a held guarantee
  counting as one). ⚠️ The flat-55% chain itself lets a fourth loss through, so under "Don’t
  know" its curve has a sliver of mass past the stated maximum. That is the flat model's known
  simplification, unchanged.

## 4. Reading the counter

- `wishHistory.ts`: one replay for both sources. A 5★ on the character banners is a loss when
  it is a standard-pool character pulled after joining the pool (`STANDARD_FIVE_STARS`, with
  dates; Mizuki joined in 5.5). ⚠️ A 5★ that joins the standard pool needs an entry there.
- **The import** reads a Paimon.moe "Wish History Export" (version 3) with `xlsx.ts`, a small
  reader on the platform's `DecompressionStream`: no dependency, nothing uploaded. It sets the
  counter, the guarantee and pity, reports what it read, shows the steps since the last certain
  Radiance, warns when the file starts after 5.0, and has Undo. A file dropped on the section
  does the same (desktop).
- **By hand** ("Work it out"): every 5★ since the last Radiance, featured or not, oldest first.
  The replay decides which were 50/50s, so a guarantee can't be entered as a win, the mistake
  that would push the counter too high. A forgotten loss leaves it too low, which errs toward
  worse odds.
- The development history (a real export, kept in `scratch/`, never committed) replays to
  counter 1, no guarantee, pity 8.
- Left out: the 4★ guarantee (needs every banner's featured 4★s) and the weapon banner's fate
  point (resets with the banner; the export doesn't record the charted weapon).

## 4a. The layout, condensed (⚓ Nate: "the panel is full and complex")

- ⚓ One controls panel still (the 2026-10-04 ruling: separate panels split around "Pulling
  for" in a shared tile). Condensed inside it instead.
- The guarantee and the counter sit together but stay two controls, so the guarantee alone
  works as before. One note under both says what comes next. Guarantee + 3 is the "double
  guarantee": "Your next two featured 5★s are certain."
- **Find mine**, a button at the end of the counter row, opens both ways to read the counter
  (the import, then the by-hand list). It opens on its own when a file is dropped, to show the
  report.
- The fine print on how the counter moves went to Help's Wish odds paragraph, rewritten for
  the counter.
- Considered and not taken: a second panel; one control merging guarantee and counter (it
  would tie guarantee-only players to the counter); merging You have and Aiming for into one
  range row (a new interaction, held in case the section still feels heavy).
- Section height with Find mine closed: 393px at a 1600px tile.

## 4b. Tabs, the report in the Readout, and precise chances (⚓ Nate)

- **What you're pulling for is the chart's tabs**, Reaction curves' `.segment` on the chart
  (`role="radiogroup"`): they choose what the chart draws. The panel's first section keeps only
  **Pulls saved**; in a wide tile it is the 11rem column the target chips used to fill.
- **The import's report is in the Readout** ("Your wish history", under a hairline), shown on the
  Featured 5★ and 5★ and weapon tabs. Find mine closes after an import. On paper the step pills
  are ink only (no gold on paper). The counter's one-line note stays by the controls.
- **Precise chances** (`chance.ts`, `formatChance`, for Artifact Odds too when it gets its pass):
  two decimals in the middle, three significant figures under 1%, enough decimals over 99% to
  show what is left, and `<0.0001%` / `>99.9999%` beyond. 🎛️ `FLOOR` (1e-4 of a percent) is the
  one knob. The Readout's headline and table use it; the chart's marker label stays whole.
- **A chance past a level's worst case reads 100%** (`chanceAt`): counter 3 at 90 pulls used to
  print ">99.9%" from a floating-point shortfall.

## 4c. The by-hand list: names, order, and only possible entries (⚓ Nate)

- The buttons are **Featured 5★** and **Standard 5★**.
- **Oldest first · Newest first** (a segment). The list is stored oldest first either way;
  newest first puts each 5★ in front, the strip reads in the order typed, and Undo takes off
  the end being added to.
- **An impossible list can't be entered.** `impossibility()` (`wishHistory.ts`) checks the
  model's two rules: a standard 5★ is always followed by the guaranteed featured one, and a
  50/50 on counter 3 is always a Radiance. **Standard 5★** is disabled when it would break
  one, with the reason beside it, because a disabled button's title never shows. Featured is
  always possible: an older win added in front only lowers the counter. Newest first is why
  the check is a full replay, not "no two standards in a row": a standard added in front can
  push a later loss onto counter 3.
- `formatChance`'s middle range is one decimal (63.5%); the ends are unchanged.

## 4d. Set-once settings fold away, and Find mine becomes an interview (⚓ Nate)

- **Set once, folded.** You have and Aiming for become one **Goal** line ("Not owned → C2")
  whose summary opens them in a popover; the **Radiance counter** line's summary ("1",
  "Don’t know") opens its chips, the import and the interview. Pity, the guarantee and the
  one-line note stay in view: they change every session or every 5★. The guarantee stayed
  inline, not folded in with the counter as first proposed, because it is one checkbox and is
  the 4★ and weapon banners' only status. The Character Event section went from 393px to 208px.
- **The interview** (concept A of three; B "which sounds like you" and C "a story strip with a
  staircase" were not taken; Nate had an idea of his own and preferred A). Newest 5★ first:
  featured, standard, or none since 5.0, then the Radiance animation only when its answer would
  change the counter (`radianceMatters`). `readAnswers` replays the answers from every state the
  counter can be in and is done when they all end on one counter; it writes the counter and the
  guarantee into the controls. A Radiance or "none since 5.0" settles it in one answer; three
  featured in a row settle it at 0. Contradictory answers say so ("Check the last one") instead
  of being blocked, since the answers are recollection. The by-hand list and its rule check
  (`impossibility`) are gone.
- **`BandMenu`, shared**, learned two things the interview needed. It re-fits whenever its
  contents change size (a `ResizeObserver`), and opens upward when there is more room above,
  staying on that side while it grows. Before, it measured once at open, so a growing dialog
  ran off the bottom of the screen. And Escape closes it when focus has dropped to `<body>`,
  which happens when a dialog's buttons are replaced under the hand.

## 5. Share links

`v: 3` carries the counter on the character banner; a `v: 2` link opens as "Don’t know".

## 6. Gates

Vitest 2692 passed (Wish 42, history 13, reader 4), svelte-check clean, lint clean, build. Chrome
e2e 71 passed (after §4b: 71 passed; after §4a: 70 passed and 1 flaky, `site-chrome.spec.ts` "the brand holds still
from the landing into a tool", passing on retry; it doesn't touch the visualizers). Driven in headless Chrome against the production build: every counter state,
the import of the real export, Undo, the by-hand list, a wrong file, and 0px overflow at 390px,
with no page errors.
