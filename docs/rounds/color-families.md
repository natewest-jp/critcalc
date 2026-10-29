# The dire, calm and gilt color families (2026-07-27)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

**🪦 ↻ 2026-08-05: THIS FILE IS HISTORY — dire AND gilt are DELETED from the codebase (dire-retirement round, merged `824f92f`). The palette's primary axis is now the CONTEXT system (.ctx-dark/.ctx-light, Genshin-UI archetype — see `docs/rounds/dire-retirement-round.md` for values + assignments). Survivors: calm (buff bars), the element palette, --debuff (enemy-facing successor, interim), --chrome white, --ink. The zoning MECHANISM notes below (substituted-at-declaration law, portal data-zone stamping, ChromeModals placement) are still accurate; every dire/gilt VALUE and rule is not.**

**critcalc's color identity is a triad: `dire` / `calm` / `gilt`** (names settled by Nate 2026-07-27). Each family _means_ something — they are not interchangeable palettes. Tokens live in `src/app.css`; the rendered reference is `docs/rounds/style-reference.md` (`/styleguide`).

**↻ 2026-08-01: see `docs/rounds/lightness-structure-2026-08-01.md` before quoting values from this file** — that round changed `--calm-fill` (#224577→#2b5590), `--dire-fill` (l30→l37), and hydro (#1b8cee→#0b7cd7), and added `--ink`, `--control-face(-hover)`, `--sel-surface`/`--sel-ink` (beige selected states — gilt-soft is no longer text-only). Gilt-as-surface is now sanctioned at the selection ladder's top; the grayscale gate (Cmd/Ctrl+Shift+G in dev) is a standing review step.

- **`--dire`** `hsl(340,85%,46%)` / **`--dire-fill`** `hsl(from var(--dire) h 56% 30%)` = `#77223e` — magenta, **enemy-facing** (debuffs, res shred, adversarial game model). **Lives past the portal — never on the landing scene or static pages.** `--dire-fill` is the debuff-bar body, the exact counterpart of `--calm-fill`: debuff bars used to be `color-mix(dire 24%, chart-bg)` = l15 vs the buff bar's l30 (half the lightness, hue dragged 25° toward purple). **Coupling is deliberate — hue inherited from `--dire` via relative-color syntax, s/l pinned to `--calm-fill`'s weight** (dire is a bright l46 EDGE color; a fill needs different weight).
- **`--calm`** `#6b99c7` / **`--calm-fill`** `#224577` — blue/navy, **ally-facing**. **The surface stack IS this family** with ROLE names. ⚠ ↻ SURFACE VALUES + ROLES RE-CUT 2026-07-31 — see `docs/rounds/tool-scene-brightness-2026-07-31.md`: hue-constant H≈265 stack from Nate anchors, --surface=MODAL role vs --surface-raised=IN-PAGE-PANEL role, lines derive from --border, fills tinted, hairline highlights retired, and the ⚠ alpha-compositing law. The hex values listed anywhere in THIS file predate that re-cut.
- **`--gilt-soft` `#ede8de` · `--gilt-hi` `#e1d4b7` · `--gilt` `#d2bd90` · `--gilt-dim` `#a19378` · `--gilt-fill` `#3e331e`** — gold/beige, **light/structure/guidance**.

**The zoning rule has teeth — it decided a real call (2026-07-29).** Choosing the favicon plate, dire was rejected _on the rule, not on taste_: a favicon is the most outside-the-portal surface there is (the brand's mark in a tab strip, seen before anyone has arrived), so dire there would break the zoning the whole palette rests on. The winner was the loading veil's **mauve `#312537`** — Nate's read is that **mauve is the site's chameleon, belonging to whichever scene you're on rather than committing to a zone**, which is exactly the property a both-sides-of-the-portal surface needs. See `docs/rounds/brand-mark-pipeline.md`.

**Two rules make the calm ramp a ramp, not a pile** (the design thinking Nate asked for):

1. **One hue with a deliberate drift** — 224° darkest easing to 210° brightest. Deep shadow reads slightly violet, lit surface slightly cyan, as atmosphere actually behaves. The old values wandered 209–228° with no pattern, which is what made them read muddy.
2. **Saturation encodes role** — structure members LOW saturation, content members HIGH. This is what separates `--calm-fill` from `--border` (they used to sit at l22 vs l23 with similar chroma = effectively one color). Applies within every family.

**`--gilt-hi` is reserved for the BRAND WORDMARK, essentially only there** (Nate 2026-07-27). It was on `.prose h1` first and read too hot at that size — all heading levels now take the workhorse `--gilt`. Scarcity is the point.

**⚠️ GILT SATURATION CEILING: `#d2bd90`** — the most saturated gold in Genshin's own UI (Nate's reference), and `--gilt` _is_ that value. The first cut ran s62–s77 and read garish in context. **Gilt MAY fill, but only at the ends of its ramp** (`--gilt-fill` deep bronze, or `--gilt-soft`/`-hi` bright); mid-tones stay text and hairlines. At s41 vs geo's s68 there's no real risk of reading as an element — the earlier "never a fill" rule was over-strict and Nate relaxed it.

**Structure** keeps `--bg` `#060914` (**the anchor — deliberately unchanged**, the whole calm ramp is built up from it), `--text` `#e8ecf3`, `--muted` `#9baabf`, and **`--neutral` `#768093`** (universal "inactive/unknown" gray, promoted from the planner's local `--rp-active`). Saturation _falls_ as lightness rises — `--text` used to carry s60, which tinted the whole UI blue and fought the gilt voice.

**⚠️ LINKS CARRY A RESTING UNDERLINE — do not "clean it up"** (Nate 2026-07-27, `0ad0bd2`). Headings and links both use `--gilt` and _no color can separate them_: `--gilt-hi` measures **1.24 against `--text`** (vs `--gilt`'s 1.55), so links there would be HARDER to spot in a paragraph while only mildly separating from headings (1.25). Hue was carrying two distinctions at once; the underline carries one instead. **`--gilt-hi` still has NO consumer** — rejected on h1, the wordmark, and links.

**Which voice:** the gilt family maps onto the existing type law's chrome axis — **chrome wears gilt, data stays cool.** Brand, nav, headings, kickers, panel titles, links, input text, field labels → gilt. Values, table cells, timeline text, character names, numbers → the cool `--text`/`--muted` ramp. (The origin story: Nate noticed beige in the TB roster search field — an input is chrome, not data.)

## Accent zoning — the mechanism

`--accent` is ONE alias read **148× across 26 files**, so scoping it re-themes the whole control layer on both sides of the portal for free:

```css
:root {
	--accent: var(--gilt);
} /* outside the portal */
.tool-shell,
[data-zone='tool'] {
	--accent: var(--dire);
}
```

- **`[data-zone='tool']` is required for PORTALS.** `$lib/actions/portal` appends popovers to `<body>`, severing `.tool-shell` ancestry; the action reads `closest('.tool-shell')` before the move and stamps the zone after. One choke point covers every portalled surface.
- **`ChromeModals` is mounted OUTSIDE `.tool-shell` deliberately**, so Help/About/Settings inherit gilt in _both_ zones. Intended — they're meta surfaces, not tool surfaces.
- Verified live: landing + `/help` resolve `#d2bd90`; planner + team-builder resolve dire.

## Domain vs UI-state vs encoding

Three color buckets that must not raid each other:

1. **Domain** (dire/calm/elements/reactions) — describes the _game model_. A noun.
2. **UI state** (`--ui-danger` `#e63946` · `--ui-warning` `#f4a261` · `--ui-positive` `#51c89a`, each with a `-soft` fill) — from the crit-visualizer slider gradient (Nate's pick) — describes a _consequence to the user's data_. A verb. Generic and boring on purpose.
3. **Encoding** — chart series, good/bad ramps inside an instrument. Never leaves its instrument.

**The test: is the color describing the game, or a consequence to the user?** Game → domain. Consequence → UI state. So debuff bars are dire, but _Reset all_ is `--ui-danger`. Law: domain colors never appear on a control's destructive/positive state; UI-state colors never appear inside a visualization.

**Three grays, three questions — deliberately NOT unified** (resolved 2026-07-27): `--neutral` `#768093` = "this UI is inactive" (structure); `--el-none-main` `#6a7080` = "this thing has no element" (domain, via `elementPalette()`) and is deliberately _flatter_ — RotationTimeline's `BLANK_PAL` comment records that choice; `physical` `#9ea4b3` = "real damage, not elemental". ⚠️ **`physical` has NO CSS variable** — it exists only in the TS mirror, so stylesheets can't reach it.

⚠️ `--ui-positive` is nudged to h157 because the gradient's own teal `#4ecca3` is within 5° of `--el-anemo-main` — effectively the same color. Revert if the adjacency doesn't matter in practice. `--ui-warning` is close to `--rx-burning`, but that's an encoding color that never leaves its instrument.

**✅ ALL MERGED + PUSHED — `f625bc4`.**

**`.kicker` is `--gilt-dim`, not `--gilt`** (Nate, final call): a section label is a quiet marker, so it takes the receded slot. `.title` and `.prose` headings keep the workhorse `--gilt`.

## Also settled 2026-07-27

- **US ENGLISH EVERYWHERE** (Nate 2026-07-27) — color not color, visualize not visualize, center not center, gray not gray. Applies to UI copy, comments, docs, commit messages. Repo swept clean 2026-07-27 (~130 substitutions across 37 files); only survivor is `GGanalysis`, a real library name.
- **Unknown notation tokens now speak `--ui-warning`**, not dire — an unparsed token is a UI state, not a game fact.
- **`.prose` headings are gilt** — h1 `--gilt-hi`, h2/h3 `--gilt`.
- **The design constitution's ~5–8 warm-accent cap is RETIRED** — superseded by gilt as a full family.
- **⚠️ `timelineExport.ts` holds a hand-maintained palette mirror** — canvas can't resolve `var()`, so every token it paints is duplicated as a literal. Change a token, change it there too or exported PNGs silently desync. Same for `BLANK_PAL` in RotationTimeline.
- **`--skill-tint` / `--burst-tint` RETIRED.** They were live as the `.rp-tok-E`/`.rp-tok-Q` fallback for an unresolved caster (not dead, as assumed) — the fallback now speaks `--el-none-main`, which is the honest reading: element unknown ⇒ imply none.
- **Radii: only `--r-sm` 3px / `--r-md` 6px / `--r-lg` 9px / `--r-round` 50%.** No `0.3rem`/4/5/7/8/11px exceptions.
- **One interaction duration: `--t-quick` 150ms ease** (it was already 150ms × 123; it just had no name). Scene and tool-slide transitions own their own timing.
- **Selection idiom is named:** `--sel-fill` (accent 20%) + `--sel-ring` (accent 55%), plus `--fill-rest`/`--fill-hover`/`--accent-hover-fill`. These were already the converged spikes across the codebase.
- Legacy aliases `--dire-tint`/`--calm-tint`/`--calm-edge` still exist so the token pass stayed additive — **remove them in the pattern migration**.

**Declined 2026-07-27 — meta surfaces do NOT take the tool zone.** Nate floated having static-page headings/links go dire when the overlay is opened over a tool. Rejected because the same Help chapter renders BOTH as a prerendered route and as an overlay pane: flipping the overlay would make identical content two different colors, which reads as inconsistency rather than context. It would also dilute what dire means (currently "this is a tool"), and Help headings are chrome — chrome wears gilt. Trivially reversible (drop the `ChromeModals`-outside-`.tool-shell` exemption) if ever revisited.

Related: `docs/rounds/style-reference.md` · `docs/rounds/ui-design.md` · `docs/rounds/design-decisions.md` · memory `project_design_constitution` (⚠️ its ~5–8 warm-accent cap is RETIRED, superseded by gilt — the constitution file itself still needs that amendment written in).
