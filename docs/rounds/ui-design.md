# UI and visual design conventions (early)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

**Element color palette** — 3 slots per element (as of 2026-04-10 cleanup):

- `main` — solid element color
- `border` — element color at 0.5 opacity (rgba), used for cast-time markers on active row
- `hi` — element color mixed 50/50 with white; used for inset border glow on Phase 1 and Phase 2 bars

`cd` and `active` palette fields were removed as unused — Phase 3 fill is now computed inline via `color-mix`, Phase 2 uses `p.main` at 0.65 opacity.

**Source of truth (consolidated 2026-04-26):** values live in `src/app.css` under `:root` as `--el-{element}-{slot}` (e.g. `var(--el-pyro-main)`). Stylesheets reference the variables directly; runtime inline-style construction reads from the TS mirror at `src/lib/utils/elementColors.ts` (`elementColors` constants + `elementPalette()` accessor). The two must stay in lockstep — when changing a value, update both. **Do NOT** reintroduce per-component palette objects. `none` only has `--el-none-main`; the accessor falls back to `none.main` for the absent `border`/`hi` slots (these were dead in practice — only consumed for empty character slots that don't render bars/badges).

**Element main colors (as of 2026-07-28):**

- pyro `#e2543e`, hydro `#1b8cee`, anemo `#4ecbb4`, electro `#c070f0`
- cryo `#97d4e6`, geo `#e7b236`, dendro `#80c840`, none `#6a7080`

⚠️ **These are a snapshot — `src/app.css` is the source of truth, and this list has gone stale before.** Hydro and geo were both retuned after this doc was first written (hydro `#1472f0` → `#1b96ee` → `#1b8cee`, geo `#ddb04a` → `#e7b236`); read the tokens, and read `docs/rounds/element-icon-generator.md` for the reasoning and for the icon-side offset before changing either.

Hydro note: several iterations to reach a rich royal blue distinct from cryo's icy pale, then pulled BACK from cyan (h214 → h205) because saturated blue is intrinsically dark, then one step toward royal again (h208) so it separates from cryo in a dense timeline. **Its icon deliberately sits 6° cyan-ward of the token** (h202) — the one element where the two disagree on purpose.

---

## Timeline E/Q Bar System — Three Phases (finalized 2026-04-10)

Each E or Q ability renders up to three bar segments depending on the relationship between `bar.cooldown` and `bar.uptime`:

### Case A — CD ≥ Duration (normal)

- **Phase 1** (solid, full duration): `p.main` fill, all-four-corner `border-radius: 3px` (overrides CSS default), full inset box-shadow `inset 0 0 0 1px var(--bar-hi)`. z-index: 2.
- **Phase 3** (ghost CD remainder): `color-mix(in srgb, {p.main} 23%, var(--bg))` fill (fully opaque, simulates transparency by mixing with timeline bg `#0f1528`), `border-color: transparent`. z-index: 0 (inline, goes under swap connectors).

### Case B — CD < Duration (e.g. Nahida skill: 5s CD, 25s duration)

- **Phase 1** (solid, to CD expiry): `p.main` fill, left-rounded only (`border-radius: 3px 0 0 3px` from CSS class), three-sided inset shadow (left + top + bottom, no right) — communicates "this continues into Phase 2". z-index: 2.
- **Phase 2** (dim continuation, CD ready to uptime end): `p.main` at 0.65 opacity, `border-color: {p.hi}`, `border: none` on left side, right-rounded corners from `rp-bar-cd` class. z-index: 2 (inline, stays above swap connectors).

### No-uptime / instant cast bars

- Cast bar: `p.main` fill, all-four-corner radius, full inset box-shadow. z-index: 2.
- Phase 3 (CD ghost): same as Case A Phase 3. z-index: 0.

### Z-index hierarchy (all within `rp-tracks` stacking context)

- Phase 1 (`rp-bar-uptime` CSS): z-index 2
- Phase 2 (inline): z-index 2
- Swap connectors (`rp-connector` CSS): z-index 1 — above ghost CD bars but below solid bars
- Phase 3 (inline): z-index 0

### CSS variable for hi border

`--bar-hi` is set on each `.rp-char-block` div via `style:--bar-hi={p.hi}`, inherited by all `.rp-bar-uptime` children. The CSS rule uses `box-shadow: inset 1px 0 0 0 var(--bar-hi), inset 0 1px 0 0 var(--bar-hi), inset 0 -1px 0 0 var(--bar-hi)` for three-sided (Phase 1→2 case), or the inline override `inset 0 0 0 1px var(--bar-hi)` for four-sided (Phase 1→3 / no-uptime case).

### Cast-time markers

`.rp-cast-marker` height is `calc(20% - 2px)` — marks cast times at the top of the active bar only (not full height).

---

**CSS conventions:**

- `rem` for typography
- Flexbox and CSS Grid for layout
- `aspect-ratio`-based scaling where appropriate
- CSS custom properties throughout for theming
- `color-mix(in srgb, ...)` used for Phase 3 fill (fully opaque tint simulation)

**Fonts in use:** Bitter (serif), Noto Sans variants (sans-serif display). The HTML artifacts use JetBrains Mono / IBM Plex Mono and Syne / Space Grotesk — these may inform the timeline component font choices.

**Tools layout:** Fullscreen fixed position (100dvw × 100dvh), "other tools" button top-right.

**CharacterAbilityCardWide:** The most complete component. Effect chips colored by stat type: ATK=red, DEF=blue, HP=orange, EM=teal, Crit=purple, DMG=gold, Heal=green. Portrait 140×210px with element gradient background.

**Rotation planner visual artifacts:**

- `claude-artifacts/rotation_v1_waveform.html` — V1 direction
- `claude-artifacts/rotation_v2_chip_stack.html` — V2 direction
  Both liked by the user. Key open question: active character "flow" between rows (not a bottom row) — user will describe this when building the timeline.
