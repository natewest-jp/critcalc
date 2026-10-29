# One site chrome, and Help and About as areas (2026-07-26)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

**✅ MERGED to `main` + PUSHED 2026-07-26 — merge commit `238a783`** (16 commits, branch `feat/unified-chrome`). Gates at merge: vitest 1292, check 0/0, lint clean, build prerenders all 7 new routes; probe-site-chrome 48/48, probe-loading-veil 27/27, probe-tool-slide 14/14, probe-tb-bench-right 14/14. Also landed on the same branch: `b53c41f` (seam + slide retune), `2b98e22` (loading veil site-wide — `docs/rounds/abyssal-loading-screen.md`), `ee67f98` (`docs/design/hrule.md`).

**Final tuned values (Nate, hand-dialled):** wordmark **1.33rem**, logo `margin-top` **−0.2em** (optical lift — the mark's mass sits low; was −0.285em until `02a54a2`), `--chrome-glyph-size` **28px**, `.chrome-actions` gap **0.6rem**, button hit box 30px (marks nearly fill it now — raise the box if the glyph grows again). Gates at commit: vitest 1292, check 0/0, lint clean, build prerenders all 7 new routes; `probe-site-chrome.mjs` 44/44, `probe-tool-slide` 14/14, `probe-tb-bench-right` 14/14.

## The shape Nate asked for

```
LANDING  ꩜ critcalc.app ─────────────────────────── ⓘ ? ⚙
TOOL     ꩜ critcalc.app ── Teams Planner Visualizers ── ⓘ ? ⚙
```

Center = "which tool am I in", empty ONLY on `/` (hero cards are the tool nav). It DOES render on the static page routes — a stranger arriving at `/privacy` from search needs a way in.

## The meta glyphs (`bcfe7f4`)

Rebuilt 2026-07-26 (`bcfe7f4` → `6ace08e`): the cluster was dark marks on solid discs faded to 72% — a workaround that made the corner read at a different weight from the rest of the bar. Now it sits at **the brand's own weight (85% → 100% on hover)** and quiets down by carrying **less mass**: the **cog is its own silhouette** (no disc; trapezoidal teeth, generated — 8 teeth, tip r 11.3, root r 8.6, hole r 4.3; **keeps its center hole** via a second subpath + `fill-rule="evenodd"`) and **i / ? are HOLES knocked through their discs** (evenodd subpaths — **no `<mask>`**, an earlier pass used one), so the sky/dire border shows through. All three share `--chrome-glyph-size` (**28px**) in a 30px hit box with nothing painted on it.

**Nate's final artwork landed `02a54a2` (2026-07-26)** — about/help redrawn (better-centered i and ?). His files export at **56×56** where the chrome's box is 40×40, which works out to _exactly_ the transform already on the elements (`scale(.9588)`), so re-exporting is a **two-string swap of the path `d`s** and nothing else. SVGO with `--precision=2` produces them directly.

⚠️ **NO FILTERS in the chrome, and the dimming lives on the GLYPH as `fill-opacity` — not on the button as `opacity`.** Both rules are Safari-driven and both were regressions Nate felt:

- The hover **drop-shadow halo is GONE** (`02a54a2`). A filter on a hovered element forces its own compositing layer and re-rasterizes the mark every frame of the fade — over a bar that sits above the animated scene on _every_ route. Hover is brightness alone now.
- **Element `opacity` < 1 makes WebKit render the subtree into a transparency layer rasterized at ROUNDED device coordinates.** This cluster never sits on whole pixels: the `0.6rem` gap is 9.6px, and `.scene-chrome` carries the cursor-parallax transform, so the marks live at fractional x that _moves with the pointer_. Rounding a moving fractional origin = a **1px horizontal jitter**, which Nate saw on the ⓘ **and only the ⓘ** — a single thin vertical stem is the one shape in the cluster where a subpixel shift is legible. `fill-opacity` is a paint property on the shape: no layer, no promotion, no rounding. **Nate confirmed fixed in real Safari.** (The cog's dark inner ring keeps its own 15% via a presentation attribute, unaffected.)
- Still open on the same mechanism: **the brand logo hovers on element `opacity`** and has the identical transparency-layer behavior. Unreported — a soft spiral gives a subpixel snap nothing to catch on — and it can't take the `fill-opacity` fix while it's an `<img>` rather than inline SVG.

**Artwork is Nate's** (`004cb4f`): `assets-src/tools/{about,help,settings}.svg`, SVGO'd and inlined. Glyphs are authored as **evenodd holes in their discs** (no mask). Baked `fill:#fff` is stripped so paths inherit `fill: currentColor`. ⚠️ The settings **ring stays explicitly `#000` at 15%** — it is SHADING (a dark wash reads as the indentation); currentColor is the light mark color and a light ring on a light cog vanishes. Only safe because this chrome is always on a dark ground. Sizing is **height-driven, `width: auto`** so each file keeps its aspect (cog 42×40, discs 40×40 — that extra width is side padding, not art). Measured: at equal height all three paint **1:1**, so one `--chrome-glyph-size` gives genuinely equal marks — Nate chose equal after trying the cog at a different size (`c206d37`). Override on `.is-cog` alone if the toothed silhouette ever needs more reach against the solid discs.

⚠️ **Every mark must be GEOMETRY, never `<text>`.** The first pass used `<text>` + `dominant-baseline: central` and produced TWO WebKit-only bugs Nate caught in Safari: letters sitting high in their circles (WebKit doesn't honour that baseline like Chrome), and the mark lifting ~1px on hover (WebKit re-rasterizes text down a different path once a _filter_ applies — a paint shift, not a reflow; layout never moved). Drawn shapes fixed both at once. Verified in real WebKit: hover paint shift 0.03px, identical coordinates across engines. That hover filter is gone now, but **the geometry rule outlives it** and is documented in the component header. ✅ Nate's own glyph designs landed `02a54a2`.

## Architecture — the load-bearing calls

- **Share the component, not the instance.** `SiteChrome.svelte` owns brand + the three glyphs; the **center is a host-supplied snippet**, so the tools keep their switcher markup and its measured gliding underline verbatim (probes assert `.chrome-nav` / `.chrome-nav-link` / `.chrome-nav-underline`). A single persistent chrome across both surfaces would sit above the opaque `.tool-shell` and stay painted through the portal blackout + reveal handshake. **Positioning is the host's** — `.scene-chrome` / `.tool-chrome-mount` pin it; SiteChrome renders in flow.
- **⚠️ The overlay NEVER moves the URL** (Nate's call, given the tradeoff). The tools layout keys its page layer on `{#key page.url.pathname}`, so a shallow-routed modal would **destroy and remount the entire tool** (CodeMirror re-init, timeline recompute, the ~200ms WebKit mount block). Routes exist for deep links/search only. Verified by probe: the planner survives an overlay round-trip.
- **⚠️ `<ChromeModals />` must be a SIBLING of the chrome, never a child.** `.scene-chrome` carries a parallax transform, and a transform is a containing block for `position: fixed` — an overlay nested under it would size `inset: 0` to a 64px bar. State lives in `chromeModal.svelte.ts` precisely so button and panel can sit in different subtrees.
- **Parallax on the panel, never the backdrop.** `parallaxLayer` now accepts a **null factor = register nothing** (meaningfully different from `{x:0,y:0}`), which is how the same overlay drifts on the scene and stays still in a tool.

## Geometry — 64px, and why the seam didn't move

One `:root` token `--chrome-h: 64px` (was tool 56 / site 70; `--site-chrome-h` DELETED). `--tool-pad-top` halved 1rem → **0.5rem** so tool content still starts at **72px**, ~2px below the dire border's 70px top-fade terminator — the retuned seam is preserved bit-for-bit. **The bar's own bottom edge now sits 6px above the terminator (was 14).** That clearance is the one thing to eyeball in real Safari. See `docs/rounds/simplification-round-2026-07-24.md`.

## Help / About as areas

| Area  | Chapters                                            | Routes                              |
| ----- | --------------------------------------------------- | ----------------------------------- |
| Help  | FAQ · Team Builder · Rotation Planner · Visualizers | `/help`, `/help/<tool>`             |
| About | About (incl. Credits) · Contribute · Privacy        | `/about`, `/contribute`, `/privacy` |

Help nests (chapters are subordinate); About's three are top-level peers (`/privacy` is the conventional legal URL). **`/faq` is now a 308 → `/help`.** Every chapter renders the SAME component in both presentations (`src/lib/help/chapters/`, manifest `src/lib/help/areas.ts`); routes import statically to prerender, the overlay lazy-loads. Wide = sidebar with the current chapter's TOC expanded; narrow = tabs, no TOC. **The TOC is read off the rendered `h2[id]`s, not a hand-kept list** — chapters are expected to grow (screenshots), and a derived TOC cannot drift. One obligation on a chapter: put an `id` on every `<h2>`.

**`ToolInfo.help` is DELETED** — `toolChrome.ts` is a pure identity registry now. Its copy and `/faq`'s per-tool sections had been drifting; there is one corpus. Tool paths and help chapter ids are deliberately the same slug (`helpChapterForPath` relies on it), which is what makes `?` contextual.

## ⚠️ Open — needs Nate

- **Contribute has an authoring hole**, marked `<!-- TODO -->` in `Contribute.svelte`: no public channel exists to send bug reports to. Pick one (public repo issues / an email alias on the domain / Discord) and the paragraph becomes a real link. The upstream-support half (gcsim/KQM/genshin-db — "a correction accepted upstream reaches every community tool") ships complete. A future Ko-fi / GitHub Sponsors link belongs in the same chapter, deliberately not promised until it exists.
- **Real-Safari pass** on the 64px bar against the dire terminator. (Partially exercised 2026-07-26: Nate caught + confirmed the fix for the ⓘ hover jitter above. The 6px terminator clearance is still uninspected.)
- **Page→tool clicks from the chrome switcher have no portal origin** (not a hero click), so they fall back to a plain fade rather than the spiral. Left as-is; firing `startPortalTransition(path, null)` for a screen-center spiral is the alternative.
- **≤400px the chrome is jammed** at the minimum 8px flank gaps — no overflow, but tight. "Visualizers" is the long label. A full mobile pass is its own job.

## Nate's decisions this session

Glyphs over words in the corner (translation-free for i18n, condense predictably) · ⓘ for About · Credits stays inside About, Contribute is the third chapter · routes AND modal, modal wins the interaction · 64px as the middle ground.

Supersedes the chrome/nav parts of [[project_static_pages_site_chrome.md]] and the `?`-guide parts of `docs/rounds/settings-help-consolidation.md`.
