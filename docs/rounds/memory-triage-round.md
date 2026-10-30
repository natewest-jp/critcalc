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

## 4. The clear-out

Nothing visible changed, so it ran while Nate worked on other things.

### The engine bundle (`fix/triage-engine-bundle`)

- **Ifa's Skill ends his hover** (`624169cb`). gcsim `ifa/skill.go`: a Tap in Nightsoul's Blessing exits at the press, and a Hold is the Nightsoul plunge, which exits at its 39f landing. Either way the 7.5s cooldown starts at the exit. Authored as an `inStance` sibling with a Hold variant, Mizuki's End Dreamdrifter shape. Dashes still don't shorten the hover, and the caveat now names only them. Test: `notationParser.test.ts` "Ifa ends his hover with the Skill".
- **Hold variants start their cooldown at their own frame** (`6c69619f`). The stale "no cooldownStartDelay field" notes turned out to be missing data: 14 Hold variants (and Furina's Pneuma) inherited the tap's delay, because the variant field came later (Alyosha, 2026-10-16). Each value is re-read from gcsim, at the minimum hold where the hold is parametric. Test: `sim/holdCooldownDelay.test.ts`.
- **Wriothesley's Witch's Revelation** cross-checked against gcsim (`64ce1608`, notes only): gcsim now implements it and agrees with everything we draw.
- **The share link's length cap** is pinned at its edge (`36d7cbda`). Test: `rotationUrl.test.ts`.
- **Collei's and Sucrose's contradicted notes** are marked superseded (`69749b16`).

### Dropped or held back, and why

- **Alhaitham C6 was never broken.** `mirrors` is a stack the player asserts in the notation (`{mirrors:3}`), chosen in the manual-trigger retirement (2026-09-21) because his Mirror economy can't be modelled; the old memory, and the triage's own check, missed the assertion. The triage proposal to Nate called it a real bug; that was wrong. Whether the planner should hint that the assertion exists is a copy question for Nate.
- **Chongyun C2 needs a new primitive.** gcsim's C2 is a cooldown modifier on whoever is active, for as long as the field's infusion lasts. The schema has an ability's own modifiers and static team ones (Anemo Resonance), but nothing timed and cross-character. Back to the engine leftovers.
- **`CA`/`CS` aliases wait for Nate.** `CA` already tokenizes as a charged attack followed by an aimed shot, so an alias would change what existing documents and shared links mean.
- **Bounding the tokenizer's group scans was reverted.** The two open-ended scans are quadratic on unclosed openers (about 190ms at the 16,384-character cap). Stopping them at a second opener brings that to 7ms, but `Bennett (E (Q) N)` would then absorb "(E" into the character name. The cost is bounded by the cap, so it stays.
- **Yun Jin's Hold Lv.2 is unreachable**: both levels read `hE`. Found along the way, not fixed.

### Housekeeping (`chore/triage-housekeeping`)

See §5.
