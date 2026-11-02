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

## 5. Share links

`v: 3` carries the counter on the character banner; a `v: 2` link opens as "Don’t know".

## 6. Gates

Vitest 2692 passed (Wish 42, history 13, reader 4), svelte-check clean, lint clean, build. Chrome
e2e 71 passed. Driven in headless Chrome against the production build: every counter state,
the import of the real export, Undo, the by-hand list, a wrong file, and 0px overflow at 390px,
with no page errors.
