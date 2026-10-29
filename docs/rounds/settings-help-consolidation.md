# Settings and help consolidation (2026-07-22)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

**✅ SHIPPED — MERGED + PUSHED to `main` 2026-07-22 (`--no-ff` merge `af0a372`, feature commit `33e2b7c`; branch deleted).** Nate-requested (settings/help modal round, precursor to the static-pages work). Gates: vitest 1227, check 0/0, lint clean, build prerenders.

## What shipped

**One shared settings surface.** Before this, settings lived in TWO drifted places: the gear `⚙` ChromeOverlay modal (in `(scene)/(tools)/+layout.svelte`) had swap-ping + outfits; a separate **orphaned** `/settings` route (`(utility)/settings/+page.svelte`, NOTHING linked to it) had outfits + Traveler + reset-data. Consolidated onto **`src/lib/components/SettingsPanel.svelte`** — rendered by BOTH the gear modal and the `/settings` route, so they can't diverge again. `sp-*` classes. Three sections:

- **Display** — Updated outfits toggle · Traveler (Aether/Lumine segmented — was stranded on the dead route, now reachable from the gear) · Swap ping.
- **Your data** — Export (downloads `critcalc-backup-YYYY-MM-DD.json`) + Import (file picker → validated summary → "Replace & reload").
- **Reset saved data** — per-store clears (constellations, loadout, ownership, saved rotations) + **Clear all**, two-click confirm each. Display prefs deliberately NOT reset.

**`/settings` route KEPT** as a thin wrapper (`<SettingsPanel />` + page title) — still has no inbound link; the intended home is a footer "Settings" link landing with the static-pages work.

**Backup/restore — `src/lib/utils/settingsBackup.ts`.** Versioned envelope `{ app:'critcalc', version:1, exportedAt, data: {critcalc:* → parsed} }`. **`parseBackup` is PURE + sanitizing** (no localStorage/DOM) — clamps constellation 0–6, drops bad ownership marks / traveler variants, clamps ping, skips malformed saved-notations — so a corrupt/hand-edited file can never reach the stores unsanitized (guards the NaN-poison-freeze class). `applyBackup` writes localStorage then the caller `location.reload()`s (stores only read localStorage at module init, so reload is the clean whole-app re-hydrate). `settingsBackup.test.ts` = 9 pure tests. Store additions: `savedNotations.clear()` (was missing; `constellations`/`ownership`/`loadout` already had it).

## ⚠️ Swap delay is PING (ms) now, NOT frames — do not revert

Nate 2026-07-22: users don't know frames, they know their **ping** (Genshin shows it top-right). The old "Swap ping" slider secretly displayed FRAMES (`{n}f`); that was a bad earlier change. Fixed:

- Store field renamed `siteSettings.swapFrames` → **`swapPing`** (ms, default **60** ≈ 7 frames — a typical "decent connection"; Nate 2026-07-22, no authoritative median-ping dataset, reasoned from server geography). Setter `setSwapPing`.
- **Conversion (gcsim-documented, verified 2026-07-22): `frames = ping × 2 × 60 / 1000 = ping × 0.12`** (gcsim docs: swap_delay 4 ≈ 30ms, 12 ≈ 100ms). Applied ONLY at the parser boundary — `RotationTimeline.svelte` `swapFrames = Math.round($siteSettings.swapPing * 0.12)`. The parser stays frame-based (`swapS = swapFrames/60`, unchanged).
- **Legacy migration** in `loadSiteSettings` AND in `settingsBackup`'s sanitizer: old `swapFrames` → `swapPing = round(frames / 0.12)`. Round-trips to IDENTICAL frame timing for every old value (4→33ms→4, 8→67ms→8, 12→100ms→12, 20→167ms→20) — no planner behavior change for existing users or the default. Slider is ms: min 0, max 200, step 5.

## Help `?` modal

Structure already did per-tool short pointers (`toolChrome.ts` `help.intro`/`notes`, rendered by the ChromeOverlay). Refreshed STALE notes: planner no longer cites the deleted character panels; Team Builder no longer says Compare/team-slots are "coming next" (both shipped). **"Full guide & FAQ →" link ✅ DONE 2026-07-22** (`60d828c`, `docs/rounds/static-pages-site-chrome.md`) — the `?` guide links to `/faq#<tool>`; the Help & FAQ page is sectioned by tool with matching `#ids`.

## Follow-up planner cleanup (same session, MERGED `cb0b026` 2026-07-22)

Nate testing surfaced two planner items, fixed alongside:

- **Buff-bar z-order bug.** Swap connectors were overlapping buff bars — the buff-family lane bars (`.rp-team-buff-bar`, `.rp-weapon-proc-bar`, `.rp-nb-bar`, `.rp-moonsign-bar`) were `z-index: 1` (same as `.rp-connector`) and rendered LATER in DOM, so connectors painted over them. Lifted all four to **`z-index: 2`** (matching `.rp-summon-bar`, which was already correct). **Layering invariant (don't regress — it broke once in `be8962c`): E/Q/summon/buff bars `z:2` > swap connectors `z:1` > cooldown ghosts `z:0`.** The PNG export (`timelineExport.ts`) already drew lanes AFTER connectors, so this only aligned the on-screen view to the already-correct export.
- **Active/connector tint.** `--rp-active` `#5a6180` → **`#717898`** (brighter, cooler neutral; Nate iterated #7981a3→#717898). Drives active strip + connectors + unset dashes + elemental block mix. **FOUR synced spots** (grep the old value to find them): `--rp-active` def + the hardcoded movement-block twin `rgba(113,120,152,0.45)` in RotationTimeline, and the `ACTIVE` const + movement rgba in `timelineExport.ts`. Also input-block divider `rgba(8,18,37,·)` 0.25 → 0.2. **Any --rp-active change must update all four + the export mirror.**

See `docs/design/profiles-and-surfaces-design.md` (store shapes), `docs/rounds/launch-roadmap.md` (this was the settings+help checklist item), `docs/rounds/design-principle-nonmodal-tools.md` (settings-as-modal is constitution-consistent — it's meta, not a tool feature).
