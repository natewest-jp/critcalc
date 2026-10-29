# Planner color-token standardization (2026-07-19)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

**Planner color-token standardization ✅ MERGED to main `a4f95c2` (--no-ff) 2026-07-19, Nate-steered live.** A follow-on to `docs/rounds/planner-cleanup-2026-07-18.md` (which was per-tool round 1/3). All four changes mirrored in the PNG painter (`timelineExport.ts`) — the keep-in-lockstep convention held. Gates: 1185 vitest / svelte-check / prettier+eslint clean.

**The standardized tint system (now in `src/app.css` :root — referenceable by ANY tool):**

- `--dire-tint: hsl(340,85%,46%)` (= `#d91254`) — the accent / adversarial / enemy-facing hue. Also `--accent`. **Debuff + weapon-proc bars** derive from it: fill = `color-mix(--dire-tint 24%, --rp-chart-bg)`, edge = `var(--dire-tint)`.
- `--calm-tint: #1c3254` — the ally/buff hue, and specifically the **buff bar BODY/fill**: the deep blue a time-scaling buff (Yelan Q ramp, Mavuika Q decay) reaches at full. Flat buff bars fill SOLID `var(--calm-tint)`; the ramp/decay envelopes build their gradient stops from it via `calmStop(alpha)` = `color-mix(--calm-tint {alpha}%, transparent)` (≡ old `rgba(28,50,84,α)`), so flat + ramping buffs share one color and future --calm-tint edits propagate.
- `--calm-edge: #6a96c0` — the bright accent STRIPE (buff bar `border-left`). Kept as its own token because `#6a96c0` is NOT a clean lightness-derivative of the deep `#1c3254` (mixing toward white gives a grayer stripe than Nate liked). Dire needs no edge token — the tint itself is bright enough to serve as both fill-base and edge; calm's deep fill can't, hence the split.
- History: `--calm-tint` was briefly `#6a96c0` (the edge), then Nate moved it to the ramp's deep-blue full end and asked to sync the time-scaling buffs to it.

**Other changes:**

- **Cooldown ghost bars** (`.rp-bar-cd--ghost`): outline on top/right/bottom (left stays open so it reads as flowing out of the cast pill), element mix dropped 45% → 25%. Was a single right-edge notch. `border-color` set inline per element; export strokes the 3 edges as fillRects.
- **Moonsign wash** (`.rp-moonsign-bar`): a flat 10% gray overlay (`linear-gradient(rgba(160,160,160,0.1), rgba(160,160,160,0.1))`) mutes the gravity-wave — Nate found it too intense. **Two gotchas fixed in Nate's WIP:** (1) a single-stop `linear-gradient(90deg, rgba(...))` is invalid per spec — Chrome tolerates it but **WebKit can drop the WHOLE `background-image`** (Safari risk); use two identical stops. (2) with 3 image layers but 2 `background-size` values the list **cycles**, silently swapping the base(719px)/counter(433px) wave widths — add an explicit third size (`auto` for the flat wash). Mirrored in the painter as an `alpha('#a0a0a0',0.1)` fillRect over the two waves.
- **Notation E/Q tokens** (`notationEditorExtension.ts`): E → gold `#f7cb56`, Q → coral `#ec6761` (was E=blue `#6ab0e8` / Q=gold `#f0c060`). Moved off the moonsign wave's blue+lemon, which they echoed. Warm pair, burst = the hotter coral. Names stay near-white (`.rp-tok-char` `#e8e8f0`); non-E/Q actions stay light-gray (`.rp-tok-label` 62% white). The export renders the notation header as PLAIN text, so token colors live ONLY in the extension (no lockstep needed there).

**Rethink status (updated 2026-07-19 EOD):**

- **Top = notation area ✅ DONE — see `docs/rounds/planner-frame-grammar-2026-07-19.md`** (merged `52acd28`): both color adjacencies RESOLVED by deleting the amber "Unrecognized:" row and the separate error red (unknowns speak dire now); the notation area became the bottom-edge composer; E/Q tokens promoted to `:root` as `--skill-tint`/`--burst-tint`.
- **Bottom = character panels** (`RotationCharacterPanel.svelte`, slot cards at page bottom) — general rethink, STILL OPEN, next up with Nate.

Read before touching planner bar/token colors or the moonsign lane. See also `docs/rounds/ui-design.md` (element palette) and the Safari tiled-background veto in `docs/rounds/planner-cleanup-2026-07-18.md`.
