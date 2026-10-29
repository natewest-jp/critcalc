# In-game test batch (2026-10)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

**⏭ When testing resumes:** open items below, in Nate's preferred order. Ask for combat logs rather than stopwatch reads.

⚓ **Method (2026-10-14): the in-game COMBAT LOG, not a stopwatch.** ms timestamps + a gauge column (`1U`) + reaction lines + char swaps; Nate turns on 100% crit so a damage value identifies the hit type (and a buff shows as a changed number on a repeated hit). A stopwatch read was ~0.4s off the log. ⚠️ The gauge prints ONLY on damage lines — a no-damage application (Nilou's aura) shows as a reaction line or nothing. ⚠️ Element is only the number's COLOUR (Swirl / Anemo / Cryo are hard to tell apart) — ask Nate to name colours. ⚠️ A dummy hit can trigger a touch-gadget (Dahlia's Shower) — place gadgets away from it.
**Dummy capabilities:** NO heals/shields/buffs/enemy hits/reaction END in the log. Detailed view = live attribute panel (active char stats + target RES) that UPDATES LIVE (Bennett's Q seen) — with a screen recording (Time Elapsed is on screen; `ffmpeg` is installed to pull frames) it can time buff/shred windows. Infinite energy yes, cooldown reset no, enemy mobs / multiple targets yes, enemy + own stats/RES/level adjustable.
**Screenshots:** `assets-src/ingame-logs/<date>/` (gitignored, Nate drops them there). Transcriptions go in `docs/library/ingame-logs/<date>.md` (started 2026-10-16; ⏭ session 1's 10-14 logs still untranscribed).

## Open

- **Kazuha Q absorption log — 🎯 BOUNTY (queued 2026-10-17, absorption round §8.6):** a Pyro aura, Kazuha Q — five Pyro twins on the field's ticks, landing on the same frame as (and BEFORE) each Anemo tick. (The late-Venti half moved to the BOUNTY line below.)
- **Linnea E then Q at once (queued 2026-10-17, Lumi round):** a Hydro aura on the dummy, press E then Q as fast as possible, log the first Lumi strike. ~3.9s after the E (≈ Q + 3.57s) = the Q RESTARTED her (what the model does); ~1.8s after the E = the E's deploy stood (gcsim). Same session, if cheap: does a Pound land ~25.8s after a lone E (the no-aura log's 11th Pound is past the 25.6s Lumi we draw — doc §9 open item 2).
- **Columbina Moondew Cleanse (shipped + pushed 2026-10-16, `2536aca2`):** with a Dendro teammate, `C` then swap — do three Dendro lines land ~0.83/0.97/1.33s after the press (gcsim 50/58/80f), with NO gauge column? Confirms `chargeLandsAfterCancel` + `applies: false`.
- **Nilou stance vs aura (15):** optional glance — stance 10s, aura 12s (18s C1).
- **Sucrose C6 length (14) — NATE TESTS (moved off the bounty 2026-10-18):** gcsim adds the absorbed-element +20% for 10s from the absorb lock; the kit text reads "during its duration" (the Burst's). Swirl an aura with her Q, then watch the attribute panel's element DMG% on a teammate — does it drop at the Q's end (~6s) or ~10s after the lock? Unblocks restoring the effect (`docs/rounds/elemental-absorption-survey.md`).
- **Ororon C4 0.8 vs 0.75s (12), Amber C6 10 vs 15s (19), Amber C4 12s CD (20):** 🎯 BOUNTY.
- **Venti Stormeye absorbed hits outliving the burst:** 🎯 BOUNTY (⚓ Nate 2026-10-18). We CUT the 15 absorbed hits at the Stormeye's end; gcsim queues all 15 unconditionally from the lock (`venti/burst.go:84-95`) and cites no test. Our cut stands until a log says otherwise.
- **Qiqi:** with her on field and not attacking, does the Herald's own swipe trigger coordinated attacks? Needs her Revelation unlocked.
- **Not a test:** Eula's/Kaveh's `plungeFrames` notes ("verify plunge in-game") — every character can plunge; close in the next curation pass.

- ✅ **Mavuika** — all four runs SETTLED 2026-10-16 (gcsim matches incl. the Ring's 3 pts/hit; record `docs/rounds/mizuki-holds-field-round-2026-10-16.md` F1).
- **Wanderer (F7):** needs another source (bounty / video).

## Dismissed 2026-10-16 (⚓ Nate)

- Columbina Lunacy shared duration — the shared model stands. · Kirara C2 — co-op only, confirmed online. · The ~4% Swirl bump after Columbina hits — not worth chasing.

## Settled 2026-10-16

- **Yaoyao Q** — `docs/library/ingame-logs/2026-10-16.md`: THREE Yuegui, ~1 throw/s each, ONE shared 1.5s-timer ICD (confirmed; our two applications within ~0.25s), spawn spacing VARIES run to run → the one-Yuegui model stands, no data change. ⚠️ the dummy's Test Start + Q pressed together is the anchor (a few frames' slack). Deepwood on Yaoyao shows as 734→898.
- **Diona Hold E** — same file: five 1U paws, 1st + 4th apply (Standard ICD) = our variant; paws fan out over ~0.2s (ours 4f); no data change.
- **Dahlia Shower** — same file: UNTOUCHED it fades ~10s after appearing (~10.5s after the press; stopwatch ±0.5s). ⏭ whether to draw a summon bar is Nate's call (touched, it explodes at f27).

## Settled 2026-10-14 (records hold the numbers)

- **Lumi** — `docs/rounds/summon-tick-gaps-round.md` §1.5: neither gcsim head wins; a Q RESTARTS her sequence; Geo applications follow standard ICD over both hits of a pair. ⏭ author her sequence from the live column.
- **Nilou** — same doc §3: Hydro every 2.0s from the Water Wheel's hit, 10 over 18s at C1 (12+6 confirmed), NO damage.
- **Dendro core (11)** — 6.47s Bloom→detonation = our 30 + 360f. gcsim's 300 wrong.
- **Burning (10)** — ends 3.54–3.78s after trigger = our model; the ×0.8 notes rejected. Leftover Pyro ~9.5s after the last Burning application. Unexplained: one skipped tick (~0.48s gap) before the 2nd application in 2 of 3 runs.
- **Collei Q (21)** — 12 leaps, 0.5s apart, first 0.75s after the explosion. ⏭ DATA FIX: our 6s draws 11 (gcsim's 378f status is right).
- **Frozen absorption (22)** — `docs/rounds/elemental-absorption-survey.md` §6 Q3: Frozen counts as CRYO, never Hydro (= gcsim `AuraContains(cryo)`); "absorbs nothing" was a thaw. Double swirl off Frozen + leftover aura matches our sequential `reduce`; library note in `docs/library/game/stellar-reactions.md`. The absorbed `866` is Cryo cyan (Nate confirmed).
- **Linnea taps** — 5 to Ultimate Power.

**How to apply:** record new results at each item's own site (round doc / data notes) and here; delete answered Open lines; delete this file when Open is empty.
