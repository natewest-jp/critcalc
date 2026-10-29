# Instrument pass — Artifact Odds (2026-10-06)

**Status:** branch `polish/viz-artifact`. The seventh hands-on instrument pass (shape:
`docs/rounds/instrument-passes-2026-10-01.md` §0) and the last of the planned set. Worksheet 08 is
CLOSED; its notes moved to `docs/text/ledger/notes/vz_artifact.md`. The instrument was
**Artifact Rolls**; it is now **Artifact Odds**, internal id `artifact` (was `rolls`), files
`artifactOdds.ts` / `ArtifactInstrument.svelte` / `appraise.ts`. Like the Breakdown rename,
no `rolls` alias: the domain isn't connected, nobody holds a link.

## 1. Accuracy (re-verified against the wiki API, GO's source, the 5.5 notes)

Correct and kept: substat weights, tier values, sands/circlet main odds, 80/20 and 66/34
line counts, uniform line/tier upgrades, "the four lines are the same set whether the 4th
arrives at drop or +4", Advanced at 6 Hallowed Exegesis (1 per Dust), Decreed on the third
Advanced in a row, the defined-piece ≥2 guarantee (5.5 notes).

Fixed: the goblet's Elemental DMG is per element (5% each, 35% together — the table summed
to 70%) · "this line set at drop" was "by +4" · "you keep the better" — you CHOOSE ·
crit value is rounded per line as displayed (the ceiling is 54.5, not 54.4).

## 2. ⚓ The floor is a TOP-UP

The game doesn't say how "at least N rolls into the selected lines" is met. The three
readings disagree a lot (5 rolls, ≥2: P(3+) = 50% top-up · 61.5% re-draw · 87.5% forced).
The instrument had the re-draw. ⚓ Nate chose top-up: it is what BOTH independent exact
models in the wild compute — Genshin Optimizer's `rollCountProb` ("forced into the selected
bins if required") and SiriYu's enlightenment solver (forces the late picks once the floor
is at risk). A vitest enumerates the solver's late-forcing literally and matches the
engine at ≥2/≥3/≥4. No datamine or in-game sample exists; ⛔ revisit only with samples.
The same reading serves the Elixir's ≥2 (a defined piece mid-level counts what its lines
already took).

## 3. The shape (⚓ Nate, after a "what do players want to know" step back)

- **Three views, a piece's life:** Drop · Level up · Your piece. Appraise and Reshape
  merged — a reshape needs a real piece; the "current rolls" slider only stood in for one.
- **"Your stats" (1–4) replaces the target pair** — what counts as good. Crit-only stats
  are measured in CV; anything else in **useful rolls** (each roll by its size, a max roll
  1, the smallest 0.7; ⚓ Nate's name). The reshape SELECTION (two lines) is a separate
  thing and lives on the card.
- **One engine** (`outcome`): every split of the remaining upgrades over the four lines
  (≤56), the top-up floor on the selected lines, wanted lines' rolls added, tagged with
  the upgrades that landed in your stats. Level up, a piece's future, the population a
  finished piece is ranked against, and a reshape are all calls of it.
- **Histograms stack by upgrades into your stats** — the "comb" was the mechanic; it now
  reads as 1-in, 2-in, 3-in humps — with the middle half shaded "likely", point to read,
  and a draggable value to beat. A **worse/same/better bar** answers both "keep levelling?"
  and "reshape?" — INK densities on paper (no verdict colours, ⛔ no gold on paper).
- **Drop** is in DAYS of resin (180 a day), headlined "N in 100 players", two curves:
  domain (1.065 5★/run at AR45+) and a Stygian Onslaught Disturbance Outbreak (+1 5★ per 120
  resin — the in-game Dire Prestige text). Every main you'd take, "at least N of your
  stats" (a main stat that is one of them counts), either set. ⚓ The axis ends at the
  unluckiest tenth (90%), and a days slider on a SQUARE-ROOT scale gives the early days
  the travel. ⚠️ The slider's thumb keeps its own position while dragged — bound to the
  rounded days it jittered (§5).
- **Your piece is the game's reshape screen**: the upgrade badge per line (the number the
  game prints), a starred (Astroid, `mainStat` mark) main-stat row, your stats highlighted,
  the reshape radial on the right (two at most, like the game), Clear, blank rows anywhere.
  An ambiguous reading is a tappable pip wearing Nate's notification mark (red
  `--ui-danger` disc, white "!", turned 7°). Level chips are ranges (+4–7) and dim when the
  values can't be that level; a mismatch says why and which levels fit.
- Layout = the Wish Odds one: chart, ONE controls panel, the Readout a column when wide,
  50/50 when shared.

## 4. Copy

Every explainer rewritten with Nate (player's vantage §1.10, "would" §1.8, nothing the screen
says §1.9). His calls: "five-star" spelled out beside "1 in 109" (a 5 next to the odds
misread); no run count (players spend 40/60, not 20); "Recheck your values, or pick …";
"Half by" / "Unlucky tenth" shared with Wish Odds; "One set". A chip's chance sits UNDER its
name (Drop only) — "ATK 58%" beside "ATK% 43%" read as an ATK% of 58.

⏭ **Help's Artifact Odds section** is Claude's working text — for Nate's Help rewrite
session (with Wish Odds').

## 5. Bugs found on the way

- ⚠️ **A piece's main stat was the slot list's first ACCEPTED main**, not the one picked:
  a sands with [ER, ATK%] read as ATK% (the list puts ATK% before ER), so picking a main did
  nothing, ATK% could never be a substat and the collision-clear never ran. `primaryMain`
  reads picked order (tested). Nate caught it.
- ⚠️ **An svg's own width propped its box open** — `bind:clientWidth` never shrank, and a
  narrower tile clipped the chart's right end. `min-width: 0` + a capped svg.
- ⚠️ **ValueWheel's popover was translucent** inside glass (`--surface` IS the glass panel
  there) — it claims `.ctx-dark` now.
- A main stat that collides with a substat now CLEARS the line (⛔ never swaps in a guess).

## 6. Measured

- Phone: 390 and 320, all three views — 0px horizontal overflow; below a 300px CARD the
  dropdowns use short names and Clear drops its word (the card decides, never the screen).
- Pip digit centering (`probe-ink-centering.mjs` gained `PAGE` and `INK=dark` — it read
  bright pixels as ink, so a gold pip clamped): Chrome "1" +0.23px, "2" +0.11px; WebKit's
  renders ≈0.25px. No nudge. ⚠️ Safari snaps text to whole pixels by position, so a pip
  can read a pixel low there at some positions — no CSS constant fixes that.
- ⏭ Real Safari / iOS unchecked (Nate's eye).

## 7. Parked

Hallowed Exegesis tracking (which reshape tier is next) · farm vs. define with Elixir
(supply-capped) · the touch case of point-to-read on a finished piece (no hover on a phone;
the Readout carries the numbers).
