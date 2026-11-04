# Visualizers overhaul, round 2: type, spacing and the kit (2026-11-02)

**Status:** ✅ merged to `main` 2026-11-02 (`feat/viz-type-kit`, merged in order with the overhaul's other rounds; pushed 2026-11-04). Nate: "All of these changes are solid"; refinement continues in a fresh session. The copy in §7 approved by Nate on 2026-11-03 (`docs/rounds/viz-stage-tidy-2026-11-03.md`). Real Safari checked by Nate on 2026-11-04; the phone pass is on the to-do.

## 1. Why

Nate: the layouts read as messy, mostly from fonts and spacing. Measured: a slider label was
16px, semibold, tracked and all caps, louder than the 14px gold kicker over its section, so the
hierarchy ran upside down. Controls within a section sat 11–23px apart and sections 20–26px,
too close a ratio for space to show grouping. Five label styles were in use, and the eight
instruments held about twenty copies of the slider markup and three of the level slider.
Separately, Nate asked for typeable values wherever a player would rather type a number.

## 2. What changed

- **Labels:** `.slider-label` is sentence case at `--fs-lg`, semibold, in the ink, the voice of
  Settings' row names. The kicker is the one caps voice. Breakdown's two local caps labels and
  the Gauge's "Aura log" follow. RES & DEF's shred group heads step up to `--fs-lg`, so they no
  longer sit under their own Other sources label.
- **The spacing ladder** 🎛️ (`app.css`, beside the other instrument knobs): `--inst-gap-in`
  0.5rem (inside one control), `--inst-gap-control` 1rem (control to control),
  `--inst-gap-section` 2rem (section to section), with `.inst-sections`, `.inst-section` and
  `.inst-hint` (a control's own hint, `--fs-md`, a rung closer). Each instrument's local margin
  stacks moved onto it. No control changed panel; that is round 3.
- **The Readout head:** `.readout-head` + `.readout-sentence`, the figure on its own line and
  its sentence beneath, replacing five copies. ICD and RES & DEF's sentences used to sit beside
  the number; they now wrap the same way everywhere.
- **The kit** (`visualizers/lib/kit/`):
  - `InstrumentSlider.svelte`: label, typeable field, track. Options for a fraction shown as
    percent (`scale`), snapping and stepping (`snap`, `stepKey`), tick marks, a non-linear
    track (`track`, Artifact odds' square-root days, keeping its thumb under the pointer), a word
    at rest (`text`: Immune, Off, None) and words typed as numbers (`words`).
  - `numberField.ts` (tested, 14): decimals from a step, the field's format (no trailing zeros,
    no grouping, so a shown value can be typed back), forgiving parsing ("1,260", "70 %",
    "0.5s", "off"), and the fixed width.
  - `level.ts`: the level slider (1–90, 95, 100; marks; arrows step the stops).
- **Typing** (⚓ Nate): focus selects the value; a number inside the range applies as you type;
  Enter or leaving sets it (clamped, snapped); Escape restores; ↑/↓ step (Shift ×10). The field
  writes only a change, so a binding with a side effect (RES & DEF clears Immune) isn't tripped
  by tabbing through. Typed values may be finer than the track's step (EM 187), down to the
  field's own decimals, so field and model agree: Breakdown's percent stats, CRIT DMG and ICD's
  timer take finer decimals; counts and levels are whole. Wish odds' Pulls saved types past
  the chart's domain, to 2000.
- Breakdown's Base and Flat ATK inputs wear the kit's field look; its reaction chips gain
  `aria-pressed` and a group.

## 3. Bugs found while building

- A click into the field could leave a caret, not the selection, so typing appended ("1,40"
  became 90140, clamped to 2000). The focusing click's mouseup is cancelled; select runs after
  the draft renders.
- The field wrote its value back on blur and Escape even when unchanged, which would have
  cleared Immune when tabbing through RES & DEF. It writes only changes now.

## 4. Considered and not taken

- A Readout head component: a shared class pair does the job, and templates with conditionals
  stay readable.
- A fixed-decimals display ("0.50s"): the field drops trailing zeros so what it shows can be
  typed back. ICD's interval now reads "0.5s".
- Grouped thousands in the field ("1,000 days"): dropped so the field shows what you'd type.
  Screen readers still hear the grouped number.

## 5. For round 3

- The long tracks and far-right summaries (Wish odds' pity, Goal) are the rail's to fix.
- ICD's head reads "5" over "of 12 hits apply"; "5 of 12" over "hits apply" may read better.
  Copy, so proposed with round 3's.
- Gauge's "Aura log" is faint at 11px now that it's sentence case.
- Three Readouts have no headline (Reaction curves, Gauge, Breakdown).

## 6. Gates

Vitest 2726 passed (numberField +14), svelte-check, lint and build clean, Chrome e2e 72 passed
(the workspace spec reads the kit's field and the shared head). No horizontal overflow at 390px
on any instrument. Every instrument checked one up at 1600×1000 in the production build.

## 7. Copy for Nate

- The field's accessible name: "<label>, type a value" (screen readers only).
- Breakdown's reaction chips' group: "Reaction" (screen readers only).
