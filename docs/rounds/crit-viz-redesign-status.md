# Crit Visualizer redesign / "Visualizers" tool family — status (2026-07-07)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

**MERGED & PUSHED 2026-07-08**: the whole branch fast-forwarded into `main` @ `8b8dc33` and pushed to origin — no longer disposable; `redesign/crit-viz` label now equals main (safe to delete). Original framing: **Branch: `redesign/crit-viz`** (off `main`, deliberately unmerged/disposable per the brief at
`docs/archive/crit-visualizer-redesign-brief.md` — read that first; it has operating rules + guardrails).
Nate has approved the direction enthusiastically ("big win") — this is likely a keeper, but merge
only when he says.

## Shipped on the branch (in order)

- `5069c11` refactor: shared pure `crit-visualizer/lib/crit.ts` (bounds, multiplier, CV, risk ramp,
  geometry) + tests; write-back $effect removed; `ink()` helper for SVG chrome
- `9f9a681` CV budget line (follows marker; drag-along-it = fixed budget) + pinned build marker
- `7128b68`/`67edc0e` **Dire border** (`(tools)/lib/DireBorder.svelte`) — themed tool-interior edge
  treatment from Nate's Stygian Onslaught "Dire mode" screenshots: waves (his SVG, inlined, 6:1
  aspect preserved, crest tops at `--dire-top-h` 75px / `--dire-bottom-h` 100px), bottom halftone
  ember field (static perforated plate over upward-scrolling noise on tint base, all 200px
  `--dire-halftone-h`), gradients. ALL compositor-only. Knobs on `.tool-shell` in
  `(tools)/+layout.svelte` (`--dire-tint` hsl(343 85% 46%), `--dire-speed` 1 = tuned feel,
  `--dire-noise-dur` 8s separate). Assets: `scripts/optimize-dire.js` → `static/assets/tools/`
  (masters in gitignored `assets-src/tools/`). WebKit rAF probe clean incl. ember-under-content.
- `3448dc3` **chrome strip + overlays + fonts**: brand (white logo → reverse portal, glow hover) +
  Bitter tool title from `(tools)/lib/toolChrome.ts` registry; text tool-switcher placeholders;
  solid off-white circular ?/settings buttons (Genshin pattern); `ChromeOverlay.svelte` (guide
  absorbed page intro + Read Guide panel; settings stubbed). **Typography unified**:
  `--font-display` Bitter / `--font-body` Atkinson Hyperlegible Next / `--font-mono` Atkinson
  Hyperlegible Mono (fontsource variable; Noto removed; planner's Space Grotesk/IBM Plex were
  never installed). All numbers/chart labels mono.
- `cb53ee1`/`5d9f46a`/`2fa93fc` tweaks: pad-top 3rem→4.25rem under chrome; editable CR/CD number
  chips (two-way with sliders, clamp+normalize on blur); isoline labels outside right plot edge
  (PAD.right 24→60); logo 125%.

## Form language (Nate-approved, carries to planner redesign later)

Flat solid shapes, NO hollow outlines; tight radii 2–8px or full circles; inset top hairline on
panels (`inset 0 1px 0 rgba(255,255,255,0.06)`); kickers with fading accent hairline rules;
mono for all data values; solid off-white circles for chrome actions; chart floats frameless on
black (its border ties to `--dire-tint`); blue accent = interactive/data, magenta = environment.
Warm accent still unspent. Chart DATA colors untouched (brief guardrail; ramp critique delivered:
keep as family signature, optional future rosier last stop `rgb(186,44,150)`).

## Design-language cleanup 2026-07-09 (SHIPPED to `main`, pushed — carries to planner redesign)

Committed `e472985` (design) + `20ee529` (noise) + `1fdac15` (prettier); on `main`, pushed. All
firmed-up, Nate-approved. These are the design-system decisions to carry into the planner:

- **Type system (FINAL):** Bitter = display/branding only; **Commit Mono = everything else (body +
  all data)** — `@fontsource/commit-mono` weights 400+600, static (no variable build on Fontsource).
  Atkinson Hyperlegible Next + Mono BOTH retired (packages uninstalled). Vars in `app.css`:
  `--font-body` = `--font-mono` = `'Commit Mono', ui-monospace, monospace`. Commit Mono's smart
  kerning is **ss05, but it's baked into `calt` (on by default) so it's already active** — the
  `font-feature-settings: 'ss05'` on `body` is redundant-but-explicit (verified: ss05 on/off = 0px;
  calt off = big change). cv01–cv11 + ss01–ss05 all toggleable via `font-feature-settings` if a
  glyph variant is ever wanted (no website custom-build needed). **Gotcha fixed:** `<button>`/inputs
  don't inherit `font-family` — added a global `button,input,select,textarea { font-family: inherit }`
  reset (was invisible under Atkinson-sans body; a monospace body exposed UA-sans buttons like
  `.ws-chip`/`.vz-chip`).
- **Animated chart-frame border (reusable):** shared `.vz-anim-frame` hook in `app.css` +
  `@property --vz-angle` + `@keyframes vz-frame-spin`; **12s ease-in-out `alternate`** conic sweep
  between `--dire-tint` and `color-mix(--dire-tint 22%, #081225)`, painted only in the 1px border via
  `linear-gradient(fill,fill) padding-box, conic-gradient(...) border-box`. Applied to all 5 chart
  frames (heatmap overrides `background` to keep its radial glows). Perf-clean (WebKit rAF probe: 0
  gaps at rest + during scroll). **Two CSS traps learned:** (1) a _registered_ `@property` var nested
  inside a `:root` custom property gets its value **baked at declaration** → conic froze; write the
  conic (with `var(--vz-angle)`) directly in a property applied ON the frame. (2) a **bare color is
  an invalid non-final background layer** → wrap the solid fill in `linear-gradient(x,x)`. Colors/stops
  are Nate's to tune next (all in the `.vz-anim-frame` conic).
- **Radii scale:** multiples of 3 → `3 / 6 / 9px`. Did 4→3 and 8→9 across workspace+instruments; 6px
  and 2px (slider track) kept deliberately.

**✅ LINT DEBT CLEARED (`43a47d0`, pushed)** — the 5 eslint errors were pre-existing from the
Visualizers merge `8b8dc33` (NOT the design cleanup) and are now fixed: `appraise.ts` dropped an
unused `SUBSTATS` import; `GaugeInstrument`+`ReactionCurvesInstrument` shed dead `svelte-ignore`
comments (the a11y warning no longer fired — `check` stays 0 warnings); `ArtifactInstrument`'s two
`new Map()` got precise `eslint-disable-next-line svelte/prefer-svelte-reactivity` suppressions
(Nate chose "suppress" over SvelteMap/refactor) — both are transient histogram-bin accumulators
inside a `$derived.by`, drained to a plain array and discarded, i.e. never reactive state, so the
rule is a false positive there (do NOT blind-swap to SvelteMap). Prettier was fixed at `1fdac15`.
**`npm run lint` now passes clean (prettier + eslint); `check` 0/0; 719 tests.** Lesson kept: run
`npm run lint` (not just `npm run check` = svelte-check only) before committing.

## Agreed next steps

1. ~~Workspace/instrument splits~~ **SHIPPED `6eccb5f` (2026-07-07)**: `+page.svelte` = workspace
   (slots by viewport: 1 / ≥1360px 2 / ≥2200px 3, capped at instrument count); per-tile picker
   chips (tabs at N=1, swap semantics); instruments mount once + display:none when unslotted
   (state survives swaps). `CritInstrument.svelte` extracted; instrument internals use CONTAINER
   queries (`instrument` container, wide ≥60rem) not media queries; heatmap 68svh cap in stacked
   mode. No persistence of slot assignment yet (session-only — candidate follow-up).
2. ~~B1 ICD Timeline~~ **SHIPPED same commit**: `lib/icd.ts` pure sim, KQM-verified (2.5s timer /
   3-hit counter; counter apps do NOT reset timer; timer expiry resets counter; first hit
   applies) + 7 tests; `IcdInstrument.svelte` pixel-true SVG hit timeline (element-colored
   applications, counter values, timer-window bands w/ start notches), presets
   Standard/None/Custom, element picker (presentational), readout. 649 tests total.
   ~~B4 artifact rolls~~ **SHIPPED `3793d44` (2026-07-07)**: `lib/artifactRolls.ts` exact 5★
   model (tiers from `docs/Main Stat and Sub Stat Artifact Values.xlsx`; weights/odds/lines/
   reshape rules from fandom wiki via MediaWiki API — direct page fetch is bot-blocked, use
   `api.php?action=parse&prop=wikitext`); 14 tests cross-check wiki Occurrence numbers exactly.
   `ArtifactInstrument.svelte`: Fresh Drop ladder / Upgrade CV histogram / Reshape (conditioned
   vs ghost, P(better/same/worse)). **OPEN ASSUMPTION: reshape guarantee modeled as conditional
   redistribution, not forced allocation — flagged in-app; revisit if datamined.** 5★ only per
   Nate. Slot icons: `static/assets/artifacts/generic-full-set/*.webp`.
   **Appraise view added `a3a595f` (2026-07-08)**: `lib/appraise.ts` — displayed-value →
   roll-count inference (float32 fround chains + game display rounding; enumerates ordered
   sequences ≤6). Cross-validated against Genshin Optimizer `artifact_sub_rolls.json` — identical
   count sets for all 10 substats (a local shallow clone of the GO repo, 1.9GB,
   only needed for re-validation). resolvePiece auto-infers 3/4-line start from
   total rolls (8 vs 9); ambiguity → user chips. Value luck: CV engine for crit pair, stat-
   agnostic rvDistribution otherwise; percentile marker on histogram. Reshape slider auto-follows
   appraisal. `cb12c05`: ValueWheel.svelte dial pickers (scroll-snap reel over possibleValues() —
   only game-legal values offered), Appraise tab before Reshape, reshape wording clarified
   (comparison is roll-count only; tier strengths reroll but aren't compared — a value-level
   reshape comparison would need an assumption about whether initial line values survive
   reshaping, undocumented).
   ~~B2 Gauge Explorer~~ **SHIPPED `df9b0ea` (2026-07-08)**: `lib/gauge.ts` pure frame-stepped
   (60fps) aura sim — KQM TCL (docs/library/game/elemental-reactions.md) cross-referenced against gcsim
   `pkg/reactable` (fetched via raw.githubusercontent, sources cached in session scratchpad).
   Encodes: 0.8× tax; top-up-to-max keeping ORIGINAL decay rate (pyro re-derives when ≥ current);
   trigger-gauge flow-down the React() priority chains (pyro on EC = overload+vape); frozen
   0.4 U/s + 0.1 U/s² ramp; EC coexist + 0.4U tick drains (first tick +10f, then 60f, wane +6f);
   burning = fixed 2U non-decaying aura + fuel at 0.4 U/s floor + 1U pyro self-tick per 0.25s
   (fuel death sweeps burning/dendro/quicken; consuming Burning-as-Pyro sweeps fuel);
   quicken strongest-wins, 5U+6s; bloom 2:1; crystallize 1s GCD; swirl cascade → double swirl.
   Mirrored gcsim quirks: reverse melt doesn't spend the cryo trigger; burning ignition doesn't
   consume or block pyro attach; BurningFuel counts as Dendro / Burning as Pyro in reduce().
   **Quirk adjudication (Nate-settled 2026-07-08):** reverse-melt no-spend = LEAVE AS-IS
   (almost certainly a gcsim dropped assignment — asymmetric w/ reverse vape, uncommented,
   untested in melt_test.go — but unobservable in-game AND in the instrument since pyro+hydro
   can't coexist; KQM is silent, not contradicting). **PENDING in-game test by Nate: burning
   fuel magnitude** — gcsim shipped code (fuel = existing aura gauge, ×1) vs their WIP
   dendro_notes.md (×0.8). Protocol: apply known 2U dendro (→1.6U aura) to a dummy, ignite with
   pyro immediately, stopwatch until burning drops: shipped predicts ~4.0s, notes ~3.2s
   (duration = fuel ÷ 0.4 U/s). Fold the result into gauge.ts `startBurning` when he reports.
   19 tests pin KQM worked examples. `GaugeInstrument.svelte`: chart + numbered app markers w/
   reaction labels, aura-presence strip w/ in-game icons (`/assets/elements/flat-color/*.png`;
   frozen/quicken/burning reuse cryo/dendro/pyro icons + labels; fuel = dashed line), hover
   scrub → Enemy Status panel, 12 teaching presets, editable app rows (element/1-1.5-2-4U/time,
   max 8), event log (EC drains collapsed to runs, burning self-ticks hidden). Out of scope by
   design (noted in guide): swirl spread to other targets, shatter, core aftermath, self-auras.
   695 tests; headless-Chrome verified (all 12 presets + custom editing, zero console errors).
   **Remaining B-tier: B5 reaction curves next.** Slot-assignment persistence + workspace-reset
   deliberately deferred until instrument roster nears completion (Nate call, incl. defaults).
3. Reserved chrome slot for share/export (L2). Instrument-level URLs deferred. Slider/panel/kicker
   CSS is duplicated between Crit/Icd instruments — extract a shared pattern when a third
   instrument lands (rule of three).

Preview-server verify loop: build + `npm run preview -- --port 4998` + playwright scripts in the
session scratchpad (screenshots + WebKit stall probe pattern per `.claude/skills/verify/SKILL.md`).
Gotcha: `npm install <x> --no-save` in the scratch dir prunes playwright — reinstall after.

## Next session starts here — B-tier COMPLETE

Session end state 2026-07-08 (second session): `main` @ `8b8dc33` (merged+pushed), tree clean,
702 tests, prod build + headless-Chrome verified. **Nate reviewed B2 live and was thrilled**
("everything I hoped it would be and more"). ~~B5 Reaction Curves~~ **SHIPPED `e53b0ef`**:
`lib/reactionCurves.ts` — four EM formulas (amp 2.78/1400, transformative 16/2000, additive
5/1200, crystallize 4.44/1400 — crystallize confirmed from wiki Crystallize page) + per-level
character & crystallize-shield multiplier tables lv1–90 (fandom wiki
`Elemental_Reaction/Level_Scaling` via MediaWiki API; levels 91–99 are character-blank on the
wiki, characters cap at 90); 7 tests pin wiki anchors (lv90 = 1446.853458 = TCL's quote).
`ReactionCurvesInstrument.svelte`: family chips (Amplifying / Transformative ×6 tiers /
Additive / Crystallize), EM 0–1200 + level sliders, hover-scrubs-EM, right-edge multiplier
tags (PADR 44 for tag room), per-curve readout w/ reaction names. Pre-RES, no +% reaction
bonuses (guide-noted). Instrument roster now FIVE: crit / icd / rolls / gauge / curves.

**Now unblocked (Nate-gated earlier, roster near-complete):** slot-assignment persistence +
workspace-reset button + first-load defaults — Nate wants to pick defaults himself. ~~CSS extraction~~ DONE `cd1330d`: shared `vz-` panel/kicker/chips/chip/slider set lives in app.css; Icd/Artifact/Gauge/ReactionCurves converted (−537 lines), Crit keeps its richer native set deliberately. ALSO `8b8dc33`: canonical element palette — app.css --el-_ is the declared single source (mirror elementColors.ts in lockstep); pyro/cryo/geo retuned vs the in-game tcg icons (pyro #e2543e richer orange-red, cryo #97d4e6 pale ice-teal separating it from hydro, geo #ddb04a clean gold); NEW --rx-_ single-slot reaction tokens (frozen/quicken/burning/burning-fuel/dendro-core; quicken is hand-picked lime — srgb dendro+electro mix grays out); translucency/shadow = alpha or mix-toward-surface, never a new hue (governance comment in app.css). Nate satisfied ~90% before tuning; retune is subtle by design. Then
redesign-brief steps 6 (planner redesign) / 7 (team builder).

**Verify-loop gotcha learned this session:** rebuilding while `npm run preview` serves makes the
open page auto-reload on stale chunk fetch → playwright clicks get undone; RESTART the preview
server after every rebuild before screenshotting.

**B2 was built on** (for revisits): TCL doc + gcsim `pkg/reactable/*.go` — no gaps found; one
notes-vs-code discrepancy (gcsim dendro_notes.md says fuel gets 0.8× on ignite; shipped
burning.go says mult 1 from existing aura gauge) resolved in favor of shipped code. Nate
explicitly offered to source KQM's SRP Google Doc if simultaneous-reaction edge cases ever bite.

**Adding an instrument (established pattern):** component in
`src/routes/(scene)/(tools)/crit-visualizer/lib/`, pure math module + colocated vitest file,
register in `+page.svelte` INSTRUMENTS + assignment array + if-chain, guide notes in
`(tools)/lib/toolChrome.ts`. Instrument root: `height:100%; overflow-y:auto;
container-type:inline-size; container-name:<x>` + panels grid with @container 44rem/72rem tiers.
Form language: solid panels + inset top hairline, kickers with fading accent rule, chips, flat
4px-track sliders, mono values, chart frame = `#081225` + `--dire-tint` 38% border, 8px radius.
Graphs: pixel-true SVG via `bind:clientWidth`, `{@const}` only as immediate block children
(compute geometry as $deriveds), mono `text` via scoped CSS.

**Cleanup now at rule-of-FIVE (deliberately deferred out of B2):** the panel/kicker/chip/slider
CSS is duplicated across Crit/Icd/Artifact/Gauge instruments (`gx-` prefix in Gauge kept
1:1 with the icd- classes to make extraction mechanical). Extract to shared classes in app.css
or a shared component (Nate's no-framework rule: NOT utility classes) as its own visual-checked
pass — good B5-adjacent chunk.

**Deferred, Nate-decided:** slot-assignment persistence + workspace-reset button wait until the
instrument roster is near-complete (he wants to pick first-load/reset defaults then). B5
(reaction curves) after B2. Redesign-brief steps 6 (planner redesign) / 7 (team builder) remain.
A local shallow clone of Genshin Optimizer (1.9GB) is only needed for re-validating appraise inference.
