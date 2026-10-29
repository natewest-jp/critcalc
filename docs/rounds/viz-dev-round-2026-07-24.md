# Visualizers Dev Round (2026-07-24) — the last launch-gating per-tool session

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

**Plan of record:** a Claude plan file outside the repo (approved by Nate 2026-07-24). Launch gate = Phases A+B+C; Phase D (new instruments) built this round but non-gating.

## Nate's locked decisions

- Wish/Pity instrument **green-lit, this round** (Phase D, non-gating).
- First-load defaults **crit → gauge → rolls → icd → curves** (`DEFAULT_ASSIGNMENT` in workspace.ts).
- Tile switcher = **dropdown per tile** (InstrumentPicker.svelte, portal listbox).
- Gauge playback **0.25× slow default** (real-time optional); Sanctifying Elixir = domain 3/4-line odds (20% four-line) + 5.5 buff **≥2 upgrade rolls guaranteed into the crafted pair**.
- Wording: plain-language first, jargon/formula as sub-line ("Genshin players can't read" nugget). Plex **Mono for chart numerics/readouts, Condensed for chart word-labels + dense chip rows** — applied, Nate taste-review pending.

## ✅ MERGED TO MAIN `752d967` 2026-07-24 + PUSHED — round COMPLETE (branches deleted)

The "Visualizers dev round" launch-roadblocker is SATISFIED. Final additions before merge: per-instrument ↺ Reset beside ⤴ Share (InstrumentHandle.reset(), all 8 instruments; probe 48 checks). All Nate-reviewed across 3 feedback rounds + the tandem Anatomy design session.

## Build history (point-in-time; branches now deleted)

Stacked branches off `main`: `feat/vz-wording` (`7d6f29f`, Phase A) → `feat/vz-workspace` (`d76c747`, Phase B) → `feat/vz-features` (`d6d509d` + guide notes `1ccbc4d` + review fixes `e33058f`, Phase C). 1,258 vitest / check 0-0 / lint / build clean; **`scripts/probe-viz-workspace.mjs` = 33-check headless probe**.

**Review round 2 (`76a2437`, all applied):** panels = **CSS multicolumn** (`.vz-panels { columns: 22rem }`, one shared rule — masonry-style packing, no per-panel sizing; vz-panel-wide retired); **quicken = spring green `#3fd97f`** (citrine ALSO vetoed — Nate wants green-but-separated; anemo draws no aura lines so nearby teal is safe); playhead drag got `user-select:none`; scenario chips carry overlapping element badges (derived from preset apps); application rows' whole right edge = accent-tinted delete button.

**Review round 1 (Nate 2026-07-24, all applied):** Nate LOVED Roll-it, the aura fills, ICD→Gauge handoff, and the dropdown. Corrections now law: **Mono ONLY in KQM notation + input fields** (mid-dot zeros vetoed for readouts/chart text; Condensed = success, keep using); **panels flow via shared `.vz-panels` flex** (no full-width grid tracks); crit legend = rotated AVERAGE DMG right-edge label (no bar legend), "No-crit risk overlay" naming restored + ON by default; roll dots beside the button; **quicken = citrine `#ecd950`** (lime too close to dendro); **gauge playback 1× default** (slow chips remain); **hover scrub REMOVED — the playhead is the single time cursor, draggable while paused**; ICD ghost-compare feature removed (chart clutter).

- **A:** glosses (CV/U/RV/p10-p90/ICD premise), contour readout cut, "2.40x avg" isolines, curve notes plain-first + muted formula, fonts, sub-10px SVG text raised.
- **B:** `workspace.ts` (registry, `normalizeAssignment`, `critcalc:vizWorkspace` persistence, `InstrumentHandle` contract via bind:this export-functions, `HandoffMessage`), InstrumentPicker dropdown, `?i=` codec (`instrumentUrl.ts`; shared `urlCodec.ts` extracted from rotationUrl), per-tile ⤴ Share, ICD→Gauge handoff, portal action extracted to `$lib/actions/portal.ts`.
- **C:** heatmap color legend + CD=2×CR diagonal + tangency dot + Roll-it sampler; ICD anchors + no-ICD ghost lane; Elixir source + `cvDistributionMinPairRolls` conditioning; gauge playback (`playhead.ts` pure core + `playhead.svelte.ts` rune wrapper, suspend-in-place via `active` prop) + gradient area fills; curves marginal-gain readout.

**Review round 3 (`769276f`) + Phase D.1 (`0b270bb`, branch `feat/vz-phase-d` stacked on features):** gauge app rows = 3 calm lines (elements / U chips / slider+time); delete edge quiet until accent-14% hover; "Example Scenarios" kicker. **Enemy DEF & RES instrument SHIPPED** (`defres.ts` gcsim-verified — note the gcsim exact-0.75 res branch fallthrough quirk, we implement the continuous form; RES view default w/ regime boundaries + VV anchor; DEF view w/ no-modifier ghost). Roster = SIX instruments; probe = 37 checks; 1,268 vitest.

**Phase D.2 Wish Odds SHIPPED (`141d135`):** research pass pinned the model to GGanalysis (OneBST) + wiki-via-MediaWiki-API → **`docs/library/game/wish-mechanics.md`** (Nate-requested library entry; holds the pity tables, CR official facts + counter-unmodeled stance, Epitomized Path, weapon 80-vs-77 note). wish.ts exact pmf/cdf; instrument = pmf silhouette + cdf line + draggable pulls-saved marker; CR modeled at OFFICIAL consolidated 55% with counter explicitly unmodeled in-app (reshape-assumption pattern). Roster = SEVEN instruments; probe 40 checks; 1,279 vitest. Fandom fetch trick: `api.php?action=parse&prop=wikitext` (direct fetch 402s); HoYoLAB articles are JS shells (unfetchable).

**Phase D.3 Damage Anatomy SHIPPED (`ad64a52`) — PHASE D COMPLETE, roster = EIGHT instruments.** Designed tandem via a mockup artifact (not in the repo) + two question rounds. **Nate's design calls:** A+B hybrid (equation capsules whose WIDTH ∝ |ln(factor)| — a ×2 box same size anywhere; sliders OUTSIDE in panels; Stat Lab as accompanying panel); ALL THREE reaction families (family chips swap the equation shape); **"real in, relative out" number line** — sheet-style inputs, direct hits print only "×N vs a bare hit", additive chunks + transformative damage print EXACTLY (complete formulas, Reaction Curves precedent); roll-sized marginal steps from artifactRolls tier averages; "Scaling Stat" generic label + ATK-for-most note. Provisional bucket palette local to the component — Nate tunes at review. anatomy.ts reuses defres + reactionCurves + artifactRolls. Probe = 46 checks; 1,292 vitest.

## Next

1. Deferred follow-ups: PNG chart export (companion to share links), further handoffs (rolls→crit, icd→anatomy), first-load default lineup revisit now that the roster is 8 (new three sit on the bench), anatomy bucket-palette tuning if Nate wants.
2. Next launch-roadblockers (per `docs/rounds/launch-roadmap.md`): landing page finalize · onboarding/empty-states · site-wide legibility pass · i18n.

Adding-an-instrument pattern + registry now live in `workspace.ts` (register there, not +page). `docs/rounds/launch-roadmap.md` Visualizers item satisfied by A+B+C once merged.

**↻ 2026-09-30 — Crit heatmap (merged `16022501`):** the ramp is an OKLab reflected-end B-spline + `RAMP_CHROMA_GAIN` 1.08 (`visualizers/lib/critRamp.ts`, a 1024-entry LUT) — ⚓ Nate's pick on the live chart; the old straight sRGB blend creased at every stop. OKLCH itself buys nothing with 8 close stops. ⏭ every vivid curve shows an emerald band ~2.2x from the GREEN STOP's chroma spike — fix the stop if it's ever raised. Axis titles sit one `AXIS_TITLE_GAP` (10) of INK from their ticks (`AXIS_INK` metrics in crit.ts; ⚠️ text-box gaps lie by 3–6px); PAD derives from it.
