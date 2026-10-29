# Stance-cooldown round — closed

**Status:** DONE, 2026-08-15. Scoped after `4b5f1df`, executed the same day.
**Origin:** ⚓ Nate reported Xilonen's E recast landing "WAY farther than it should." That produced three findings; two were fixed in the originating session, and this doc covered the third.

---

## What shipped

### 1. `cooldownStartsAtStanceEnd` replaces the delay hack

Two abilities encode **"the cooldown starts when the STANCE ends"**. Both were authored as `cooldownStartDelay` equal to the stance duration:

| ability         | was          | duration | cooldown |
| --------------- | ------------ | -------- | -------- |
| `xilonen skill` | 540f = 9.00s | 9        | 7        |
| `ifa skill`     | 600f = 10.0s | 10       | 7.5      |

That computes the right _first_ cast, but `cooldownStartDelay` means **animation frames** — the other ~122 abilities carrying it sit at 1–35f and are genuine gcsim `SetCDWithDelay` transcriptions — and being static it could not express an early exit at all. Both now carry the explicit flag and no delay. ⛔ The ~122 were not touched.

**characterLint D.21** rejects both cooldown fields on one ability. **D.22** rejects the flag beside `durationExtensions[]`: the recast is placed mid-parse from the stance's expected end, so an extension firing later would move the real end past a placement already written. Early exit moves it _earlier_ and is handled. Both rules were checked by seeding the negative into `xilonen.json` and watching them fire.

### 2. `readyAt` follows the actual stance end

`readyAt` derives from the resolved stance length at cast, so the charge queue and the ghost tail are written from one number. The swap-close site (`notationParser.ts`, the `terminatesOnSwap` block) then moves **both** to `swapTime + cd` when the stance is cut short — taking the value outright, ⛔ not min/max against the stale one, which is an upper bound being corrected rather than a competitor. The queue is keyed by exact ability id, so the patch cannot reach a teammate's clock; the entry is found by its stale value rather than assuming `q[0]`.

### 3. ⚓ Xilonen `terminatesOnSwap: false → true`

The handoff's step-one question. Called by Nate on the evidence below, then **verified in-game the same day — settled, not a standing assumption.** Kept in her `_curatorNotes` only so nobody re-opens it:

- **For:** gcsim's `onExitField` (`xilonen.go:78`) exits her Nightsoul on swap-out, and the same pattern appears independently in kinich/mualani/mavuika — all three authored `true` here. C2 reads "Geo Source Sample will be active **even when she is off-field**", which is only a gain if the base "active while in Nightsoul's Blessing" does _not_ reach off-field. And the state is a movement mode (Blade Roller, with sprint/climb point drain), which off-field has no meaning for.
- **Against:** the in-game text lists only two exits (points depleted, skill re-used); the Fandom Gameplay Notes are otherwise exhaustive and never mention swapping; Citlali/Ororon/Chasca prove off-field Nightsoul is per-character, not a blanket rule.

Effect: `Xilonen E > … > Xilonen E` returns her skill at **swap + 7s (~7.3s)** instead of a flat 16s.

---

## What verification actually settled

⚠️ The handoff said gcsim and the curator note contradicted each other and neither could break the tie. **The Fandom wiki's per-talent Gameplay Notes settle the mechanic outright**, in words, for both abilities:

> The **7s** cooldown starts once Xilonen's Nightsoul's Blessing state ends and not upon the Elemental Skill cast.

> The **7.5s** cooldown starts once Ifa's Nightsoul's Blessing state ends and not upon the Elemental Skill cast.

That matters most for **Ifa, who is not in the gcsim checkout at all** (`d146b6d`, 2026-07-26) — his curator note cited a `skill.go exitNightsoul` that does not exist, written by analogy to Xilonen. The mechanic is now independently sourced; only his 10s duration remains authored (80 Nightsoul points ÷ the wiki's 8/s base consumption = exactly 10s, which corroborates it).

Reaching those notes is `action=parse&prop=wikitext` against the MediaWiki API used by `scripts/fetch-wiki-capabilities.mjs` — the talent page, not the character page. Cheap, and the one sanctioned network path.

---

## Still open

- ⛔ **Ifa's `terminatesOnSwap: false` is CORRECT — do not flip it to match Xilonen.** ⚓ Nate verified in-game 2026-08-15. This doc originally claimed the Xilonen argument applied to him verbatim; **it does not.** Xilonen swaps out instantly and Blade Roller dies with the swap. Ifa is **airborne**: he has to be brought down first — cancel the flight, or use the in-flight Hold-E plunge — and only then can you swap. His cooldown starts when he **LANDS**, which is neither the swap nor a fixed offset from the cast. So he is not a one-field edit; he needs **stance-CANCEL mechanics** — a token that _terminates_ a stance rather than opening one, the same machinery Xilonen's E-re-press would need and which the parser has no notion of. Its own round, and not a small one. Until then the authored 10s hover is the natural point-drain landing, `cooldownStartsAtStanceEnd` reads it correctly, and an early landing is the unmodelled case (already in his caveat).
- **A swap-terminated stance still keeps its FULL nominal bar width** while only its gating window clamps (the deliberate P4 note at the swap site). Cast Raiden Q, swap at 1s, and the pill still draws 7s. ⚓ Nate 2026-08-15: leave it, out of scope. For Xilonen this now lands in `barPhases` case B (stance window outlasts the cooldown), which is coherent — the bar says she is ready before the nominal window ends. Changing it corpus-wide across ~25 stances would be its own round, and wants Nate's eyes.

## ⛔ Ruled out, do not re-derive

- **Not gauge modelling.** The constitution is windows-not-gauges. Exit-by-drain stays unmodelled; C1's +45% timer stays unmodelled for the same reason.
- **Not the E-re-press cancel.** ⚓ Nate: players do not use it. It would mean teaching the parser that a token can _terminate_ a stance rather than open one.
- **Her RES shred does NOT ride the stance window.** It is five per-element `onCast` effects on a separate 15s window (A1 Netotiliztli's Echoes; gcsim `asc.go:75`). Fixing the stance does not touch the shred.

## Tests

`notationParser.test.ts` — two describes. The Xilonen/Nahida/Bennett one pins shipped behaviour (full stance → 16s; swap → swap + 7; an 11f delay unchanged at 5.183; no delay unchanged at 4.0, Bennett's 5s less the 20% his ascension passive takes off). The early-exit one is pinned to a **synthetic** fixture, deliberately: pinning the mechanism to Xilonen would make it a hostage of the open `terminatesOnSwap` question and would silently stop testing anything the day that flips.

`barPhases` needed no work — its geometry was already fixed in `4fa17a7` and is covered by the delayed-cooldown describe in `barPhases.test.ts`.
