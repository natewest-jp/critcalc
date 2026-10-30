# The memory triage round (2026-10-30)

The old working memories carried about 60 open items that `docs/todo.md` didn't (listed in `docs/rounds/instructions-overhaul-round.md` §14). Each was checked against the code on 2026-10-30, then ruled on with Nate. This is the record of where each went, and of the clear-out that followed.

## 1. Rulings (⚓ Nate, 2026-10-30)

1. **The fingerprint "find" ignores the current team, on purpose.** It shows anyone who can provide the capability, whether or not the current four would light it, because the player may change the team to use that character. The code already did this; a comment at the filter now says why.
2. **The monotone role icons are unused** (only the `color` set is loaded), so editing them in place broke nothing. The item is dropped. If they're ever used again, they ship as `-v2`.
3. **Gold as inline emphasis stays as it is.** The palette round had parked the question for "the `--el-*` round", which shipped on 2026-08-11 (`docs/rounds/element-palette-round.md`) without taking it up.
4. **The BETA tag comes off when Nate says so.** The dated 2026-09-22 ruling stands over the undated "after the first feedback round"; the roadmap line is struck through.
5. **Elevate is not frozen.** The schema was unfrozen on 2026-07-29, and since 2026-08-31 every `elevate` in the corpus renders as a buff window (Columbina, Flins, Lauma, Linnea, Nefer, Odette, Sandrone). The only shape that wouldn't render, two of the three Lunar reactions together, has no character. The "still frozen" lines in `docs/curation/` now say so. Reaction-DMG derivation stays out, as damage math.
6. **Help's Artifact Odds and Wish Odds text is approved** (written with Nate at launch).
7. **The announcements box:** its contents are right, and a small design improvement stays in the Queue with its shape undecided.

## 2. Where the open items went

- **Now:** the Planner's ruler click (no way to set the playback start) joins the streamlining as a candidate.
- **Next:** the Atlas's Imaginarium Theater roles line, grouped with the screenshots pipeline and the cheat sheet as Help additions.
- **Queue:** grouped into "Touch and small screens" (Teams reorder is drag-only, the landing in phone landscape, Report a problem on the phone, with the existing tap-target, hover-only and lineup-fit items), "Small UI bugs", Planner, Visualizers, Housekeeping, the in-game test batch, and one Engine and data line whose detail is in `docs/rounds/launch-roadmap.md` § Engine and data leftovers.
- **On hold:** attack speed, the two curation audit proposals (JSON Schema, LLM semantic audit), and the Safari 26 roster-card workaround until Safari 27.

## 3. Dropped as done or no longer applying (evidence as of 2026-10-30)

- A swap-ended stance drawing its full bar: `clampStance` in `sim/states.ts`, tested in `notationParser.ir.test.ts`.
- Teams' Back dropping an unsaved draft: `TeamDetail.svelte` asks first (`beforeNavigate` plus a guard history entry).
- The 187 KB of season data in the Builder chunk: the boss text loads on demand (`endgame.ts`).
- Side-by-side Visualizer panels stretching to equal height, and most of the surplus-width policy: four instruments cap, Gauge and ICD span on purpose. Breakdown's width went to the Queue as a ruling.
- The drawer's duplicate "Target aura" kicker, and `--cg-tile-min` (now 108px).
- Varka A1 and Skirk A4 (both authored), Radiance (shipped 2026-09-19), Collei's 12th leap (6.3s), Alyosha's offset summon ticks (authored from gcsim), the infusion wrong-pool hazard (`infusions.ts`).
- Memoizing `inferredStates`: rejected as a correctness bug (`sim/states.ts`) and replaced by a newest-first scan.
- The brand logo's opacity hover (the top bar changes paint only), the BETA explainer page, and the phone landing composition.
- Alhaitham C4's `mirrors` gate: it never had one. Only C6 does (see §4).

## 4. The clear-out (in progress)

Nothing visible, so it runs while Nate works on other things.

- **Engine fix bundle**: Alhaitham C6 (its four effects need a `mirrors` stack nothing grants, so they never fire) · Ifa's stance ending early through `endsStance` · Chongyun C2's cooldown reduction, if the schema can express it · Wriothesley's Revelation against gcsim · `CA`/`CS` as charged-attack aliases · a `MAX_NOTATION_CHARS` test and bounded scans · stale notes.
- **Housekeeping**: a banned-Unicode convention test · retire `DerivedCapability.summon` and the unused `monotone` role-icon variant · the library's bucket numbering · Resonance and Weapon Infusion docs.
- **Then Kokomi A1**, on its own branch.
