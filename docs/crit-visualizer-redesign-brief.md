# Crit Visualizer — Redesign & Expansion Brief (for Fable)

> **You are Fable.** This brief hands you a scoped, multi-phase engagement on critcalc's Crit
> Visualizer, authored by Opus after a codebase recon. Nate (the developer) drives; you execute
> and advise. Read this top-to-bottom, then read the design docs in **§Context to load** before
> touching anything.

---

## Operating rules (apply to every phase)

1. **Chunk and check in.** Nate is watching usage availability and needs to be able to pause
   between chunks without losing work. End every work chunk with: a short status, a "✅ safe to
   pause here" marker, and one line on what the next chunk is. **Never** start a large multi-file
   build without a checkpoint first. When in doubt, stop and ask.

2. **Programmatic-work decision rule.** For any change that's straightforward code (the kind Opus
   could do):
   - **Easy win, clearable while context is already loaded?** → just do it as Fable.
   - **Opus-friendly but would burn a lot of Fable compute (large/mechanical/multi-file)?** →
     don't spend Fable cycles on it; write it up crisply for Opus to execute later (file paths,
     exact change, acceptance check) and move on.
   - **Default bias: lean toward doing it directly** rather than deferring. Defer only when the
     compute cost is clearly disproportionate to the value of you (Fable) doing it.

3. **Keep the redesign disposable.** All redesign work happens on a **new branch off `main`**
   (the abyss scene shell already lives on `main`'s working tree — `(scene)` + `(scene)/(tools)`
   layouts, portal transition, twinkle/shooting stars). **Nothing merges** until Nate says so;
   the whole point is that we can throw it away. Do not modify `main` directly for design work.

4. **Preserve the chart colors.** The heatmap ramp and its companion color scales are Nate's and
   stay exactly as-is through the redesign. Exact do-not-touch list in §Guardrails.

5. **Respect the tool's constitution.** critcalc _visualizes mechanics; it does not optimize
   numbers._ No verdicts, no "optimal build," no damage calculation. Details in §Guardrails.

---

## Context to load first (memory + code)

**Design memory** (`/Users/producer/.claude/projects/-Users-producer-Code-critcalc/memory/`):

- `project_tool_constitutions.md` — **the guardrail for the feature brainstorm.** Crit Visualizer
  scope: "graph + slider shape," visualization-not-calculation, what it will never be.
- `project_design_constitution.md` — mission, Abyss-as-possibility theme, audience, warm-accent
  philosophy. Strategic foundation.
- `project_design_decisions.md` — settled calls + open questions. Note especially: **tool-chrome
  unification is an open question** (back-to-landing, settings entry, tool-internal nav; current
  planner top-right "other tools" link is a placeholder). Warm accent = sparing, ~5–8 instances
  site-wide, active/live/accomplishment only. Two chrome layers (site vs tool). Desktop-first.
- `project_landing_status.md` — the abyss/portal/magenta direction and tool-interior intent
  (black sky, themed starfield, a Stygian "Dire" border effect — this is where "Dire" comes from).
- `project_ui_design.md` — element color palette, three-phase bar system, CSS conventions.
- `project_design_roadmap.md` — what's queued in design.

**Code — the Crit Visualizer (2 files, ~960 LOC, zero shared deps):**

- `src/routes/(scene)/(tools)/crit-visualizer/+page.svelte` (365 LOC) — owns sliders, readouts,
  layout, the "Current Build" + "Read Guide" panels.
- `src/routes/(scene)/(tools)/crit-visualizer/lib/CritHeatmap.svelte` (598 LOC) — canvas heatmap +
  overlay + inline SVG axes/isolines/tooltip + pointer/drag. All math is inlined here.

**Code — the shared shell/chrome (affects step 4, shared with the planner):**

- `src/routes/(scene)/+layout.svelte` (~281 LOC) — the scene background for all tools: sky
  gradient, baked sky image, `TwinkleStars`, `ShootingStars`, floor, cursor parallax, `dim`
  overlay, `PortalTransition`. Content mounts at z-index 2.
- `src/routes/(scene)/(tools)/+layout.svelte` (~141 LOC) — `.tool-shell`: an **opaque `#000`
  backdrop** (prototype — commented "Starfield/themed interior TBD"), a brand/home-return logo
  that fires the reverse portal, `.tool-main` content wrapper (`padding:2rem`), and the portal
  reveal handshake (`visibility:hidden` until portal blackout). **This black backdrop is the tool
  chrome you'll be designing in step 4.**
- `src/app.css:1–42` — base tokens (`--bg #060914`, `--surface`, `--surface-raised`, `--border`,
  `--text`, `--muted`, `--accent #6cb5ff`) + element palette `--el-{element}-{main,border,hi}`.
  Runtime mirror: `src/lib/utils/elementColors.ts` (kept in lockstep).

Structural note: crit-visualizer, rotation-planner, and team-builder are siblings under
`(scene)/(tools)/`. They **share the shell chrome and `app.css` tokens only** — no shared tool-body
components. So tool-chrome decisions made here carry to the planner; tool _interiors_ are per-tool.

---

## The progression (Nate's plan — follow in order)

### Step 1 — Evaluate current state; clear immediate refactors

The two files duplicate logic that has already drifted. Clear the safe wins now (they make the
redesign cleaner and are cheap while context is loaded). Confirmed smells:

- **Duplicated axis bounds** — `CR_MIN/CR_MAX/CD_MIN/CD_MAX` in both files (comments say "must stay
  in sync"). → single source.
- **Duplicated isoline list** — `ISOLINES` (`+page.svelte:12`) vs `ISOLINE_VALUES`
  (`CritHeatmap.svelte:16`). → single source.
- **Duplicated + divergent `averageDamageMultiplier`** — unclamped (`+page.svelte:15–16`) vs
  clamped (`CritHeatmap.svelte:70–71`). **This divergence is a latent bug**; reconcile deliberately.
- **Duplicated `zeroCritProbability`** — `+page.svelte:30–32` vs `CritHeatmap.svelte:88–90`.
- **Duplicated risk color ramp** — CSS gradient (`+page.svelte:287`) vs JS thresholds
  (`CritHeatmap.svelte:93–98`).
- **Prop write-back `$effect`** (`CritHeatmap.svelte:312–318`) clamps/re-writes its own `$bindable`
  props — split ownership between page `$state` and component `$bindable`; mild feedback-loop risk.
- **Hardcoded SVG chrome colors** — many inline `rgba(255,255,255,x)` literals (367–535); tokenize
  opportunistically (but see chart-color guardrail — the _chart_ colors stay).

**Recommended shape:** extract a pure `lib/crit.ts` (calc + geometry: multiplier, zero-crit
probability, isoline values, axis bounds, coordinate transforms, the risk-ramp thresholds) that
both files import. Pure and unit-testable — add a small test if a `*.test.ts` convention exists
nearby. This is an easy win; **do it**, then checkpoint.

> ⏸ **Checkpoint:** report what you found, what you cleared, what (if anything) you deferred to Opus.

### Step 2 — Brainstorm feature improvements & adjacent tools

Think like a theorycrafter: **what visualizers would you want at your side?** Cover both (a) new
_modes_ of the crit visualizer and (b) _adjacent_ graph-driven tools that could live alongside it.
**Brainstorm independently and widely first — Nate has his own ideas but wants to see yours before
he shares his, to avoid anchoring you.** Then present.

Hard guardrails from the constitution (stay inside these or flag when you're testing the edge):

- Must fit the **graph + slider** interaction shape. If it isn't a graph driven by sliders, it's a
  different tool — say so rather than forcing it in.
- **Visualization, not calculation. No verdicts.** Expose a mechanic so the player builds intuition;
  don't return "optimal X" or a damage number. The crit visualizer will _never_ do team/rotation
  damage, motion values, enemy res, or buff math.
- Explicit room exists for _new standalone graph+slider modes_ ("explore during refactor" is
  sanctioned in the constitution) — so greenfield modes are welcome; team/rotation _calculators_
  are not.
  > ⏸ **Required checkpoint:** present the brainstorm and stop. Nate will react and add his own ideas
  > before anything is built.

### Step 3 — Easy build wins (or write-ups for Opus)

From what step 2 settles: anything that's an easy win you can clear while loaded → build it.
Anything conceptually straightforward but compute-heavy for you → write it up for Opus (paths,
exact change, acceptance check). Apply the §Operating-rules decision rule.

> ⏸ **Checkpoint** before/after any non-trivial build.

### Step 4 — Design the crit visualizer + tool chrome ← **design-input gate**

Bring in all the design context (constitution, decisions, landing status, ui-design). Fold in
**tool chrome** here too — the `.tool-shell` is currently a prototype `#000` backdrop and Nate wants
to nail down the themed tool-interior/chrome now (it's a tracked open question, and it carries to
the planner). Nate will provide:

- a **screenshot of "Dire mode"** as design guidance (it doesn't exist in code — it's net-new),
- direction on tool-chrome contents (back-to-landing, settings, tool-internal nav),
- the constraint that **chart colors are preserved** (see §Guardrails).

**Do not build the redesign yet.** Present your design thinking — chrome contents, tool-interior
treatment (black sky / themed starfield / Stygian "Dire" border per landing status), how the crit
viz sits inside it, how the preserved chart palette anchors the composition — and **check in with
Nate for input**, then go back and forth until the direction is agreed.

> ⏸ **Required design-input checkpoint.** Expect iteration here.

### Step 5 — Attempt the redesign (disposable)

Once direction is agreed, build it on the throwaway branch off `main`. Keep it **completely
unmerged** so it can be discarded. Present for evaluation.

> ⏸ **Checkpoint:** Nate evaluates; keep or throw.

### Step 6 — Rotation planner redesign (conditional)

Only if the crit viz design is clearly the right direction (needn't be 100%). Carry the shared
chrome/design-system decisions into the planner. The planner's feature surface is still moving, so
apply the shared **chrome/system** first and be conservative about redesigning volatile feature UI.

> ⏸ **Checkpoint** before starting; this is a big chunk.

### Step 7 — Team Builder (only if usage allows)

Greenfield (`team-builder/+page.svelte` is a 26-LOC placeholder). Dream it up with Nate and take a
stab — but **only if usage comfortably allows.** Kit-comparison reference surface, never a
recommender/tier-list (per constitution). Treat as a stretch goal.

---

## Guardrails

### Chart colors — DO NOT TOUCH (all in `CritHeatmap.svelte` unless noted)

- **Heatmap ramp** — `colorStops` array, **lines 56–65** (8 RGB triples, deep-blue→red-purple),
  interpolated in `damageToColor()` (124–137) over multiplier [1.0, 4.0].
- **Heatmap background fill** — `#081225` (canvas fill line 148; CSS frame bg line 560).
- **Frame radial-gradient glow** — blue `rgba(38,102,214,0.2)` + magenta `rgba(188,55,119,0.2)`
  over `#081225` (CSS 558–560) — the existing blue→magenta abyss feel; keep it.
- **No-crit risk scale** — `zeroCritRiskColor` thresholds `#4ecca3 / #f6d365 / #f4a261 / #e63946`
  (lines 93–98) and its mirror gradient in `+page.svelte:287`.
- Marker dot `#f7fafc`, tooltip fill `rgba(5,10,24,0.82)` — chart chrome, keep unless Nate okays.

If the redesign wants to re-theme surrounding UI chrome, that's fine — but the **data-bearing chart
colors above are fixed.** When a refactor touches these regions, preserve values verbatim.

### Constitution guardrail (feature & scope calls)

- critcalc **visualizes mechanics; it does not optimize numbers.** Default to visualized over
  calculated; expose the mechanic, don't deliver a verdict.
- Crit Visualizer = graph + slider, single-hit, stats-only. Never team/rotation/damage/enemy/buff.
- New modes are welcome **if** they fit graph+slider and stay visualization-not-calculation.
- When a call is grey, ask: _window / marker / graph — or a number/verdict?_ The first three belong.

### Warm-accent guardrail (design)

Reserved, sparing (~5–8 instances site-wide): branding, active states, "live now" signaling,
moments of accomplishment. Never ambient chrome or broad UI. Don't spend it cheaply in the redesign.

---

## Checkpoints summary (where to stop and check in)

1. After step 1 — refactor report.
2. **After step 2 — brainstorm (required; Nate adds his ideas before any build).**
3. Around step 3 — before/after any non-trivial build.
4. **Step 4 — design-input gate (required; expect iteration; Nate provides the Dire-mode screenshot).**
5. After step 5 — evaluate the redesign; keep or throw.
6. Before step 6 — planner redesign is a big chunk.
7. Step 7 — team builder only if usage allows.

Between all of these: honor the chunk-and-check-in rule. A pause should never lose meaningful work.
