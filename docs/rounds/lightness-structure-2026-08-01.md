# Lightness-structure round — 2026-08-01 (branch `feat/lightness-structure`)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

**✅ MERGED TO MAIN `2a986b7` + PUSHED 2026-08-05 (Nate's call — "valuable enough"), live on the noindexed site.** Merged just AHEAD of the ascend-pan merge (`795ab22`); the one overlapping file (tools layout: twilight knobs + ascend reveal) merged clean. ⚠ The twilight-ramp BORDER commits in here are retirement-bound — removed in `docs/rounds/dire-retirement-round.md`, where the survivors list also lives (grounds/`--ink`/`--control-face`/barMix/beige all stay). Nate at merge: the round also surfaced a few loose elements not yet looped into the styling rules — sweep candidates recorded in the retirement round file. ✅ Real-Safari soak CLEARED by Nate 2026-08-12.

**↻ Line-layer redesign `44b8fbc` (+ Nate's 2nd tuning pass `b793c3e`):** two body waves with HORIZONTAL screen-space hue gradients (`--dire-wave-far-l/-r`, `--dire-wave-near-l/-r`; mid station retired into the shared middle hue) + the old mid slot reborn as a stroke-only LINE wave (`--dire-crest`) whose opacity breathes in/out of transparency (`--dire-crest-fade-n/-dur/-min` — drifting sine in the shader). Bodies carry no edge line. `--dire-crest-a` default restored to 0.85 (his 0 was a veto of lines-on-everything, superseded by this design).

## ↻↻↻ The dark well + vivid mains (`0e84519` — day's close)

**`--rp-chart-bg` is planner-LOCAL now: `#15151c` ⚓ NATE** (the notation well's resolved shade sampled back as the chart ground — a well cut into the `#23232d` frame; no longer a `--frame-bg` alias — the mirror test + round probe read it from RotationTimeline). `--rp-grid`/`--rp-line` derive toward the chart ground (45%/85% border → `#262631`/`#343443`); ruler ticks off stranded navy literals onto tokens; view-cluster fade ramps to `--frame-bg` (its strip stayed on the frame ground). **ELEMENT MAINS BOOSTED whole-palette** (+.04 L, ~×1.12 C; pyro `#f9563e` hydro `#1c88e8` anemo `#47dbc1` electro `#cd7cfe` cryo `#9de2f7` geo `#fabd22` dendro `#85d736`; icons regenerated; pyro–hydro ΔL .05 kept). **Ghost knobs livelier: KEEP 75 / FILL 30 / EDGE 40** (cooldowns are content-adjacent, not mud — Nate).

## ↻↻ THE WHISPER LAW (`b0d0d4e` — the round's closing law, session 3)

**Structure is a near-neutral lit by the scene: C .010–.025, hue borrowed from the scene family, L by the ladder — never an identity color.** Ground = FIELD not figure; chroma on it white-balances every element bar. Measured: every working reference ground C ≤ .034, every failed critcalc ground C ≥ .040 — the search axis was chroma, not hue. Anchor: **Nate's Stygian-sampled `--frame-bg #23232d`** (L.26 C.019 H285). Re-derived: `--surface #2f2f3b` (modal) · `--border #3a3a4a` (⚓ NATE, on-law) · `--control-face #5e5e70` · fills tint from `--neutral` now (revert note in app.css). **`--bg` deliberately NOT re-anchored** (landing/meta stays calm cosmic blue — the law governs TOOL structure). Supersedes chroma-rises-with-lightness for structural members; content keeps identity chroma. The four-part economy is complete: chromatic scene · neutral structure · colorful content · beige selection. Dire border itself: "basically exactly where I'd like it" (Nate) — see `docs/archive/dire-border-handoff.md`.

## ↻ Session 2 additions (same day)

- **`3408b0c` Nate's tuning pass committed:** `--surface-raised: #ede8de` (BEIGE in-page panels — he made the jump), `--frame-bg #2b2d43` (the lit lavender-slate, L.31 H280), `--border #424462`, tool base `#0e0c0f`, wave cover 0.1 (washes). Mirror sweep rode along; the three viz cutout strokes now read `stroke: var(--frame-bg)` from the cascade (off the hand-mirror list forever). ⚠ `--surface` (#1c2844 H265) vs frame/border (H280) = two structural hues, open exploration; the elevation-ladder re-derivation is still pending.
- **`a9103bc` DIRE BORDER REBUILT — the twilight ramp** (commissioned): color model = explicit station knobs (`--dire-base/-sky/-horizon/-wave-far/-mid/-near/-crest(-w/-a)/-ember` on `.tool-shell`), replacing one tint × nine lightness scalars. Measured basis: Arlecchino Aug-2026 wallpaper (hue rotates 248→265→311→353→10→31 down its sky — its upper sky IS our old --frame-bg) + Stygian waves (equiluminant hue drift H288→H329). New crest-line shader pass (thin bright arc, `--dire-crest-a` independent of `--dire-wave-cover` so it survives Nate's 0.1 wash bodies). Embers = `--dire-ember` (chroma peak). Details in `docs/archive/dire-border-handoff.md`.

## The diagnosis (measured, keep — it's the round's why)

OKLCH-sampled Nate's screenshots vs Genshin (ffmpeg pixel sampling + `scripts/oklch.mjs`): **Genshin's darks ≈ ours (L 0.25–0.33); what we lacked was the populated upper ladder** — their L 0.49 button faces, L 0.6–0.8 chips w/ dark ink, L 0.87–0.93 beige plates. critcalc carried hierarchy in HUE on a compressed band (everything L 0.15–0.39) → grayscale mud. Chroma was also inverted: their structure is near-neutral (C 0.01–0.034), chroma spikes only on small marks (C 0.19). Two gifts found by measurement: **Genshin's button face #586071 sits at H265.4 — our exact hue constant** (adopted verbatim as `--control-face`), and **`--gilt-soft` #ede8de ≈ their beige #ece5d8** (became `--sel-surface`). Guiding line: _lightness is the skeleton, hue is the clothing._

## The five experiments (one commit each)

- **A `866a416`** — dev-only grayscale overlay, **Cmd/Ctrl+Shift+G**, root layout. `backdrop-filter` OVERLAY, never `filter` on root (containing-block breaks fixed chrome/portals). Verified absent from prod build. § Laws: "hierarchy must survive grayscale."
- **B `032e605`** — `--control-face` #586071 / `--control-face-hover` (opaque, ground-agnostic, NOT accent-derived → no zone re-declaration). Consumers: `.btn--primary` (solid face, ring dropped), planner view cluster + KQM/PNG composer buttons (local `:hover` REQUIRED — global `.btn:hover` would drop hover below rest), `.rp-explore-link`.
- **C `ea126cf`** — `--ink` #081225 (promoted from GaugeInstrument's literal). **Ink policy: full-strength castFill fills only** (E/Q pills, summon bars) — ink + NO halo; dim (`.rp-bar-uptime--dim` hook) / ghost / NB / moonsign stay white+halo, and the halo block now ENUMERATES its members. Moonsign/NB ink = queued follow-up.
- **D `5e8cdf7`** — the lightness contract. Hydro **#1b8cee → #0b7cd7** (L.632→.58; it sat at EXACTLY pyro's L — identical in grayscale; icons regenerated, hydro png re-hashed). Ghost tracks DESATURATE before mixing (`desaturate()` in elementColors, hex→hex). **`src/lib/timeline/barMix.ts`** = the knob module, imported by BOTH DOM and exporter (drift impossible). `--calm-fill` #224577→**#2b5590** (l30→l37); `--dire-fill` pinned l moves with it (30%→37%, resolves #932a4d). `calmStop()` now mixes vs `--rp-chart-bg` not transparent (alpha law). **NEW `timelineExport.mirror.test.ts`** re-derives every hand-mirrored literal from app.css/RotationTimeline — caught a REAL drift on first run (MUTED still #9baabf). The mirror is no longer trust-based.
- **E `1eacd83`** — beige selected pilot, SCOPE LOCKED (no beige panels): `--sel-surface: var(--gilt-soft)` + `--sel-ink: var(--ink)` on `.rp-tab-bar .tab.active`, `.tb-tabs .tab.active`, Help `.area-chapter.is-current`. Tab-rename input flips to ink on an opaque well; TB tabstack circles need nothing (own `--surface` ground).
- **probes `a00fff8`** — `scripts/probe-lightness-round.mjs` (14 browser checks, parity vs the app's own TS helpers via Node type stripping); `probe-png-dl.mjs` REPAIRED (zoom slider→buttons, `.tb-png-item`→`.rp-png-item`, tmpdir).

## ⚠ The knob list (Nate tunes; say these when he asks)

| Knob                                                                   | Where                                        | Default / note                                                                                      |
| ---------------------------------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `--control-face` (+hover mix 86%)                                      | app.css interaction block                    | #586071 — Genshin's slate                                                                           |
| NOTES active accent share                                              | RotationTimeline `.rp-notes-btn.is-active`   | `accent 20% into control-face`                                                                      |
| `--ink`                                                                | app.css structure block                      | #081225                                                                                             |
| `UPTIME_DIM_MIX / GHOST_FILL_MIX / GHOST_EDGE_MIX / GHOST_CHROMA_KEEP` | `src/lib/timeline/barMix.ts`                 | 65 / 20 / 25 / **40** (last is the new one)                                                         |
| hydro anchor                                                           | app.css `--el-hydro-main` + elementColors.ts | #0b7cd7; deeper alt #0f74c8 needs WHITE badge ink (documented in both files); re-run icon gen after |
| `--calm-fill` (+ `--dire-fill` l, coupled)                             | app.css                                      | #2b5590 / 37% — exporter literals must follow (mirror test enforces)                                |
| `--sel-surface` / `--sel-ink` + pilot extent                           | app.css                                      | gilt-soft / ink; extent = the scoped rule beside the dire-grounds block                             |
| `.tab-close:hover` on beige                                            | flagged, unchanged                           | translucent dire wash — revisit if it reads pink                                                    |

## Laws added/amended (§ Laws · Color on /styleguide)

Grayscale gate · bright-fill-carries-ink-no-halo · the lightness contract (content earns ΔL; recessive drops chroma) · selection-is-accent EXCEPT the ladder top (beige pilot) · **the beige-belongs-to-the-sister-site split is RETIRED (Nate 2026-08-01): gray AND beige freely available to BOTH sites** (constitution amended).

## Follow-ups

Moonsign/NB lane ink · beige-extent decision after Nate's pass · possible deeper-hydro cut · ✅ real-Safari soak cleared 2026-08-12 · landing hero-card contrast may look even fainter next to brighter tools (pre-existing note from the brightness round).

Related: `docs/rounds/tool-scene-brightness-2026-07-31.md` (the floor; this round built the ceiling) · `docs/rounds/color-families.md` (hex values for calm-fill/dire-fill/hydro there are superseded) · `docs/rounds/style-reference.md`
