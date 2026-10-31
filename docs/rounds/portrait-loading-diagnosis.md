# Portrait loading diagnosis (2026-07-25)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

Measured 2026-07-25 (headless Chrome+WebKit vs local preview, dev server, AND live critcalc.app). **Raw serving is NOT the bottleneck**: portraits are 256px webp ~17KB each (~2.2MB for all ~120), prod serves HTTP/3 edge-cached — 91 in-viewport portraits complete in **~91ms** on a typical connection; selector reopen = zero requests (memory cache); click→painted ~140ms in preview.

The perceived slowness is the **loading pattern**:

1. Every grid portrait has `loading="lazy"` (`CharacterCard.svelte`) → "Low" fetch priority even in-viewport, below-fold tiles never prefetched, so every scroll shows blank tiles popping in, and grids arriving via the 1200ms tool→tool slide start fetching only as tiles intersect the viewport (i.e. after the pan).
2. Nothing warms the cache — the RP Source remounts fresh per open (`{#if sourceOpen}`, RotationTimeline.svelte:1589), first open = ~91 fetches at click time.
3. Cloudflare Pages default `Cache-Control: max-age=14400, must-revalidate` → any visit >4h later re-runs ~126 conditional GETs; a deploy purges the edge (full MISS refetch).

**How to apply — fixes 1–3 IMPLEMENTED 2026-07-25 (uncommitted, Nate checking before commit):**

- ✅ CharacterCard portrait now eager (`decoding="async"`, no `loading="lazy"`).
- ✅ `src/lib/utils/warmAvatars.ts` — idle prefetch of all `full/` portraits (once/session, Save-Data-respecting), called from RP + TB page onMount. Verified: 117 fetches at mount, 0 network on selector open / roster scroll.
- ✅ `static/_headers` now ALSO carries `Cache-Control: public, max-age=31536000, immutable` for `/assets/*` and `/_app/immutable/*` — **assets are ADD-ONLY now: never edit an art file in place, ship a new filename**. Takes effect on next Pages deploy (vite preview ignores `_headers`). ⚠️ At launch, delete only the noindex RULE — the cache rules stay (`docs/rounds/launch-roadmap.md`).
- Deferred (Nate to check first): fix 4 — keep RP Source mounted (`display:none` vs `{#if}`) to skip ~55ms remount.

**Round 3 (same day): Safari STILL lagged ~1.3s per grid mount — root cause: Safari 26.x ENGINE REGRESSION on dynamically-created `<img>`-with-src (~2ms EACH, native `before()` self-time in Safari's profiler; fixed upstream in Safari TP 245, absent in Playwright WebKit — why headless never reproduced). Console-confirmed in real Safari 26.5.2: 122 img-with-src = 222ms, src-set-after-insert EQUALLY slow (205ms — defer-src workaround dead), 122 background-image divs = 2ms.** Fix (probe-verified both engines, zero `<img>` in grids):

- ✅ CharacterCard portrait/weapon/element art → background-image div/spans (role="img" + aria-label for glyphs; runtime onerror fallback dropped — hasAvatar manifest gates instead)
- ✅ Keep-mounted grids: TB roster (`rosterEverShown` sticky + `hidden` attr + `.tb-roster[hidden]{display:none}` since author display beats UA hidden) and RP Source overlay (`sourceEverOpened` in RotationTimeline) — toggles/reopens skip remount everywhere
- ✅ warmAvatars uses fetch() not new Image()
- Probes updated: traveler (reads style.backgroundImage), TB (close = hidden not removed), bench-right (nav-underline span is timing-dependent — scope to .chrome-nav-link)
- ✅ Time-sliced mounting (`src/lib/utils/progressiveReveal.svelte.ts`): first 36 cards paint frame 1, rest streams in 18-card rAF batches (CharacterGrid + TB roster grid). Genuine technique, keep post-Safari-27. Nate-measured Safari first-mount 1.5s→~550ms before slicing; residual is the sibling-formatting-context layout bug (fixed in Safari 27 beta, ships ~Sept 2026).
- **ALL MERGED+PUSHED `6c3e743` 2026-07-25** (rounds 1–2 in `74ce7c6`). Nate-verified in real Safari (repeat toggles instant).
- ⚠️ Pattern for the future: ANY roster-scale surface must avoid per-item `<img>` until Safari's fix ships (~Safari 27, fall 2026) — REVISIT then (img is the more native citizen); the background-image conversion is the one deliberately workaround-flavored change
- Follow-up spotted in a Safari trace: `parallax.ts:101` writes styles every ~60ms ON TOOL ROUTES (~0.2ms/tick) — violates the scene-suspend rule; check in a future session

**Round 2 (same day): "still lags in dev" — dev-server bottleneck is separate.** Vite dev = HTTP/1.1 (6 connections) + hundreds of unbundled module requests + `no-cache` on /assets → ~117 portrait fetches queue with 100-320ms stalls EACH reload (server itself: 0.8ms TTFB — it's pure connection queueing). Fixed:

- ✅ `devAssetCache` plugin in `vite.config.ts` — dev-only `max-age=3600` on `/assets/*`. **Gotcha: must `middlewares.stack.unshift`, not `use()` — SvelteKit's dev middleware serves static/ without calling next(); also must pin the header (override res.setHeader) or sirv's later no-cache wins.** Verified in real Chrome: 2nd load = 0 network requests, all from disk cache.
- ✅ warmAvatars rIC now `{timeout: 400}` + BATCH 24 — without timeout, a busy page starved idle callbacks (41/117 after 6s). NB hidden tabs still throttle rIC — irrelevant in real use, but don't chase it in headless/backgrounded probes.

**Round 4 (2026-10-31): Safari 27 fixed the `<img>` regression, so the cards draw `<img>` again.** The same measurement in real Safari 27.0.1 (122 cards, 5 runs, insert plus a forced layout, on the live landing): `<img>` 137–141ms, `background-image` 130–138ms. That's level, where 26.5.2 had 222ms against 2ms. Nate found the Builder and the Roster snappy on the branch. `CharacterCard`'s portrait and element icon are `<img>` again (`object-fit`, `alt`, `draggable="false"`), and the `background-image` rule left `.claude/rules/ui.md` and `/styleguide`.

- ⏭ Open: both methods cost ~135ms in real Safari against 1–3ms in headless Chrome and WebKit. It's shared, so it didn't bear on the choice. It may be the forced layout of the whole landing page rather than the insert; a split measurement would tell.
- Time-sliced mounting (`progressiveReveal.svelte.ts`) stays, as round 3 ruled.
