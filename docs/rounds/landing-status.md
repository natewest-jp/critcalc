# Landing scene implementation status (2026-05 to 2026-07)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

> ✅ **MERGED TO `main` — verified 2026-07-09.** Branch `design/landing` has been merged into `main` (now `8b8dc33`) and deleted; the entire series below (Phase A `13e1d80` → portal `23cf0f1` → twinkle-suspend `08daf1e`) is in `main`'s first-parent history. This is no longer a live branch. The doc is retained as the design/implementation record and for the still-optional "NEXT" polish items (cyan counter-spiral, further tool-interior theming, ambient breathing) — none of which block launch.

In-flight implementation tracker for the cinematic landing scene. Living document — supersedes the `docs/rounds/launch-roadmap.md` L1 "Landing page" entry with concrete phase breakdown and shipped state.

## 🚩 SESSION END 2026-06-07 — Portal/iris tool transition SHIPPED (forward + reverse), replaces the FADE_ONLY stub

The deferred portal/iris transition is BUILT and committed on `design/landing`. It supersedes the `FADE_ONLY` interim stub (those consts kept but the dim/pan path is dormant under a new `PORTAL` master flag in `transition.ts`). It's the predicted **CSS/WAAPI iris — NOT video**. Everything is **transform + opacity on two pre-rendered layers → compositor-only, Firefox-safe by construction** — this is the "lean INTO the constraint" resolution of the cross-browser perf problem (the expanding aperture is local/cached-layer work, not a full-surface slide).

**Files:**

- `src/lib/components/landing/PortalTransition.svelte` — the overlay (z:3, above `.content`). A black backing div + the vortex `<picture>`. Always mounted (hidden when idle); WAAPI-driven imperatively via a runner registered with transition.ts.
- `src/lib/landing/transition.ts` — `PORTAL` flag + all knobs + orchestration (`registerPortalRunner`/`startPortalTransition`, the hero-origin Map, the tool-reveal handshake `registerToolReveal`/`revealToolNow`, `hasActivePortal`/`portalTimeUntilBlackout`).
- `scripts/optimize-portal.js` (+ `npm run optimize-portal`) — sharp AVIF+WebP for the vortex plate. `static/assets/transitions/vortex-plate.{avif,webp}`; `raw/` gitignored like `landing/raw`.
- Wired in `(scene)/+layout.svelte` (mounts `<PortalTransition/>`), `(scene)/+page.svelte` (forward click captures origin + `setHeroOrigin`), `(scene)/(tools)/+layout.svelte` (tool gets `background:#000`; brand-return triggers the reverse; tool-shell suppressed-until-blackout).

**Forward (hero → tool):** vortex spiral grows from the clicked card (`scale 0.02→END` + clockwise rotate, linear), black backing fills in, tool revealed at blackout, backing fades off → tool. The tool's `#000` bg makes the reveal a **dark-to-dark crossfade** (the key trick — distinct dark interior means bloom-then-resolve looks like a true see-through iris for free).

**Reverse (tool → landing):** cover (black fades in over the tool) → **swap at full black** (`onCovered` callback runs `goto` under the cover so the content change is unseen) → collapse (vortex appears full-screen and shrinks down to the hero card while the backing lifts to reveal the landing). Symmetric to forward (cover=`TOOL_FADE_MS` mirrors reveal; collapse=`SPIN_MS` mirrors spin). The click can be ANYWHERE (the bottom-left return logo) — the spiral always homes to **the tool's own hero card**. Robust because the cosmic scene lives in the persistent `(scene)` layout (never unmounts) → the backing always lifts onto a real scene, can't "gap".

**Hero-origin capture:** card centers captured on the forward click (cards at rest = accurate), keyed by destination path, in a module Map. Reverse reads it. **Cold-load straight into a tool → no stored origin → falls back to screen-center.** Known minor: in-tool resize leaves the stored origin slightly stale until the next forward click (mount-measure deliberately omitted to keep the pass tight).

**TWO GAP BUGS fixed (both about black-layer coverage, both cost me wrong guesses — log them):**

1. **Spin-end "dip" (the real one Nate kept seeing):** the backing eased IN late (so the vortex reads against the scene early) but the vortex began fading at `PORTAL_VORTEX_FADE_AT` — so the vortex's center coverage vanished while the backing was still ~60% opaque → the bare cosmic scene flashed through. FIX: backing keyframes reach FULL black exactly at `PORTAL_VORTEX_FADE_AT` and hold (per-keyframe easing), so the vortex only ever dissolves over an already-opaque backing. **This COUPLES `PORTAL_VORTEX_FADE_AT`** — it's both the vortex-fade-start AND the backing-full-black point; they move together by design.
2. **Reveal-handoff race:** the tool reveal (main-thread `visibility` flip) and the backing fade-out (compositor WAAPI) ran on two clocks; a fixed `PORTAL_HOLD_MS` could never reliably cover it (bumping it to 160ms still flashed). FIX: a **handshake** — at blackout the portal calls `revealToolNow()` (the tool shell registered its un-suppress via `registerToolReveal`), waits **two rAF** so the shell is actually PAINTED opaque, THEN fades the backing. `PORTAL_HOLD_MS` is now just optional dwell-on-black (Nate set it to 0).

**Tool suppression:** the tool shell stays `visibility:hidden` (laid out, UNPAINTED) through the spin so it never shows at the portal's growing edges and its own internal animations play unseen; revealed at blackout via the handshake. Cold-load / reduced-motion / no-portal → visible immediately.

**Dim overlay neutralized in PORTAL mode:** `dimTarget` returns 0 when `PORTAL` (the tool's `#000` bg darkens; `startSceneTransition` is a no-op so the dim would never animate back). Without this, a cold load into a tool left a **0.6 black wash over the landing on return** (a bug Nate caught at the end).

**Asset / file-size lesson (reusable):** for a soft glow on transparency, WebP `quality` does almost nothing — the **ALPHA channel is encoded losslessly by default and dominates** the file. Levers: drop resolution (soft = no high-freq detail, scales fine), prefer **AVIF** (crushes smooth gradient + alpha), and for WebP set **`alphaQuality`**. Result: 2048² PNG 1.3–1.5MB → **AVIF 17KB / WebP 341KB**.

**Current Nate-tuned knobs:** `PORTAL_SPIN_MS=450`, `PORTAL_TOOL_FADE_MS=550`, `PORTAL_SPIN_DEG=240`, `PORTAL_SCALE_END=2.6`, `PORTAL_VORTEX_FADE_AT=0.65`, `PORTAL_HOLD_MS=0`, `PORTAL_BLACK_EASING_CSS=cubic-bezier(0.5,0,0.75,0.45)` (backing ease-in), `PORTAL_VORTEX_EASING_CSS=linear` (Nate made the spiral linear — and noted the bezier visibly drove scale far more than rotation; true, since scale runs 0.02→2.6 vs rotation 0→240° where easing barely reads). `npm run check` clean, build clean, 363 tests pass.

**NEXT (portal):** (1) the **cyan counter-spiral layer** — a second sprite (SVG strokes) on its own independent rotation over the vortex, per the Genshin-reference breakdown (3 elements: dark starfield bg + jagged magenta-rim shape + cyan inward swirls; the cyan = "surface-light dragged down", bridges landing-blue → tool-magenta); (2) the **tool-interior themed treatment** — Nate's vision: black sky + star tech (a _different_ starfield than landing) + a border effect imitating **Stygian Onslaught "Dire"** difficulty, folded into the tool-UI-redesign track; (3) optional polish — collapse-eye drift-to-center, reverse rotation sense, A/B dropping the black backing now the race is gone, refresh stored hero origins on landing mount (resize staleness).

## 🚩 SESSION END 2026-06-02 — DIRECTION PIVOT shipped: parallax + portal-plan + shooting stars + lean plates

The cross-browser perf question (below) is **resolved by pivoting, not by fixing the pan.** Decisions + rationale are in `docs/rounds/immersion-direction-handoff.md` and the amended memory `project_design_constitution` / `docs/rounds/design-decisions.md` (both edited this session). Headlines:

- **The slow camera-pan tool transition is RETIRED.** Confirmed unfixable cross-browser: even reduced to 2 stars + a static placeholder, Firefox couldn't pan a full-viewport surface smoothly. It's the _travel distance × surface size_ on WebRender, not the star count.
- **Cursor parallax SHIPPED and validated on Firefox** (Nate: "sells REALLY well", FF "perfectly smooth"). New [[parallax]] (`src/lib/landing/parallax.ts`): rigid whole-world shift wrapped in `.parallax-world` + a counter-shift of `.composition-inner` (brand+heroes). One rAF lerp writes `style.transform` DIRECTLY to the two wrappers (never an inherited CSS var → the ~1500 stars never restyle, same reason the pan was free). Gated `hover:hover`+`pointer:fine`, off under reduced-motion, suspends during transitions. Why it's a different perf class than the pan: tiny offset of cached layers + interactive lerp (no scripted easing trajectory for the eye to judge dropped frames against). **Nate-tuned knobs:** `PARALLAX_MAX_X_DVH=2.2`, `MAX_Y=1.0`, `LERP=0.09`, `WORLD_SIGN=-1`, `CONTENT_FACTOR=+0.5` (he flipped it positive → foreground drifts WITH the world, "window" feel vs my "diorama").
- **Tool transition is now an interim FADE-ONLY stub** pending the portal. `FADE_ONLY=true` flag in `transition.ts` collapses pan+crane to zero motion (panYTarget/sideXTerm/toolShellWorldFrom all return no-motion), keeps the **dim overlay** (Nate wants it kept for tool-page comps), skips the twinkle freeze. Timing retuned (TRANSITION_MS 2400→620, fade-in 460, out 320). Flip the flag back to restore the full geometric pan — geometry consts kept intact. **The portal/iris transition is the real replacement** (deferred; not video — likely CSS/SVG iris, see design decisions).
- **Shooting stars SHIPPED** (B2). New [[shooting-stars]] (`src/lib/landing/shootingStars.ts` + `ShootingStars.svelte`), mounted inside `.parallax-world` (rides parallax, clipped to sky). One meteor at a time, WAAPI transform+opacity (compositor-only, FF-safe — rotation baked as a LITERAL, not a CSS var which FF ignores in WAAPI keyframes). Hairline 1px gradient streak, **no head/box-shadow**, rotation DERIVED from travel vector via `atan2` (provably collinear tail↔travel, fixed the mirrored-meteor off-axis read). **Nate-tuned:** interval 5–30s, duration 380–680ms, `PEAK_OPACITY=0.62`, star-palette tints (white-weighted; magenta tried + rejected). Reduced-motion no-op, pauses on tab-hide.
- **Twinkle deepened+slowed** (Nate-approved): gentle trough 0.35→0.20, dramatic 0.30→0.15; durations gentle 2.5–6→3.5–8s, dramatic 3–7→4–9s.
- **Abyss theme PIVOTED** — magenta/purple now embraced for _tool interiors_ (Durin "power under mastery" archetype; landing stays blue, tools = focused-power; light↔dark spatial gradient). Eldritch/gore guardrail still holds. Full writeup in memory `project_design_constitution`.

**Lean plates (no pan headroom) — new master `scene-5340.png`, recomposed twice this session:**

- Master **5340×2326** = 21:9 frame (5120×2194) + parallax bleed **110px L/R, 66px T/B**. Horizon at master row **1451** (sky top 1451 / floor bottom 875). 2nd recompose (final) raised the galaxy band so the hero cards no longer block it.
- `optimize-bg.js`: input now `scene-5340.png`, `MASTER_W/H`+`HORIZON_Y` consts, tiers **2000/2670/3585/5340** (plate widths; top=master, never upscales). Combined AVIF ~29KB@1080p → ~89KB@4K-ultrawide.
- Coordinate system in `(scene)/+layout.svelte` split **`--frame-w-src` (5120, maps to viewport / basis for `--px`)** vs **`--plate-w-src` (5340, the image)**; floor hangs `--bleed-v` (66px) below viewport so the frame bottom lands at viewport bottom + bleed sits off-screen; `--horizon-y = (floor-h-src − bleed-v) × px`. `srcset`/`sizes` rebuilt from one `TIERS` array (`SIZES='calc(100dvh*21/9*5340/5120)'`) so markup+pipeline can't drift.
- Band coords in `generate-stars.js` re-measured for the new sky (height 1451, master-Y maps 1:1 to sky-crop px). **Final BAND_SRC: TL 725, TR 0, BL 1451, BR 725** (steep near-diagonal, hugs top-right, dips to horizon bottom-left).

**STATE: all of the above is on `design/landing`, COMMITTED this session (see latest commit). Tree clean, `npm run check` clean, 363 tests pass, prettier clean.** Old plate tiers (1920/2560/3440/5120) removed; new tiers added. `raw/scene-5120.png` gone, `raw/scene-5340.png` is the master (gitignored).

**Open next:** (1) the **portal/iris transition** is the big remaining landing piece (replaces the fade-only stub) — implementation approach (CSS/SVG iris vs canvas) still to design; (2) **ambient breathing/auto-drift** deferred-but-wanted (Nate wants to evaluate after living with parallax); (3) per-tool magenta/purple color-coding at each tool's redesign; (4) the non-landing launch threads still stand: `docs/rounds/lazy-character-loading-plan.md`, `docs/rounds/rotation-planner-ssr-fix.md`, L2 sharing, ~~real hero-card design~~ (✅ shipped 2026-07-26 — `docs/rounds/hero-cards.md`).

---

## 🚩 SESSION END 2026-05-30 — committed `2f91d8c`; OPEN: cross-browser perf rethink (SUPERSEDED by the pivot above)

All the side-crane + tool-reveal + shared-fade work from this session is **committed at `2f91d8c`** on `design/landing` (`feat(landing): side-tool crane + perf-driven tool reveal + shared fade knobs`). Tree clean. The detailed knob/architecture notes are in the sections below (crane, world-locked reveal, fade unification, all-linear fades, hero-card placeholder cleanup).

**The new strategic question to open the next context with — Nate tested cross-browser:** Safari and Chrome are fine; **Firefox is "disastrous"** — the transition trundles. Key truth Nate emphasized: for a _slow easing_ camera move, even a few dropped frames take it from "graceful" to "trundling" — the polish is fragile in exactly the way that matters. So "the drops are minimal" is cold comfort.

**My assessment (honest):** a 2.4s, slow, full-screen **DOM** camera-pan moving large image layers + ~1500 twinkle nodes + a heavy tool mount is near the cross-browser CEILING of CSS/compositor animation. Chrome/Safari (Skia / Core Animation) cope; Firefox (WebRender) doesn't. We've already done the serious DOM optimizations (WAAPI compositor transforms, twinkle freeze, suppress-during-pan reveal, preloadData). Remaining DOM levers (skeleton reveal, lighter moving payload, shorter duration) help but **won't make Firefox buttery — diminishing returns.** We are somewhat forcing a square peg.

**The reframe that decides the path:** is the immersion in the _camera MOVE_ or in the _persistent SCENE_? Priorities to hold: (1) immersion, (2) fit the 'abyss as possibility' theme, (3) easily performant / not a struggle.

**Alternative directions discussed (for the next session to weigh):**

1. **Pre-render the camera move as a video / image-sequence** — keep the exact cinematic move but bake it; hardware video decode is uniformly smooth across browsers. Live DOM scene only needed at the two rest states. Best "keep the cinematics, fix the perf." Wrinkles: end-frame must match the live tool-state scene exactly; reverse playback for the exit; the live twinkle field vs the video's baked stars at the handoff (likely cross-fade live twinkle in only at rest); file size (small for a dark scene).
2. **Shorten + lighten the DOM pan** — cut to ~600–900ms, bake stars into the sky image (so the twinkle isn't 1500 moving nodes), maybe hide twinkle during the move. Fewer frames + less to composite → Firefox copes. Trades grandeur; low-risk, cheap to try first.
3. **Drop the camera move; lean on the static scene + a fast cross-fade/dim** (maybe a tiny scale/vignette accent). The persistent scene carries the immersion; the transition becomes bulletproof. Biggest change to the current vision, safest floor. A short _characterful_ dissolve (motion-blur streak / a quick darkening "blink") can read as MORE polished than a fragile slow pan.
4. **WebGL/canvas scene** — the camera move becomes a GPU shader op → unlimited smooth cinematics + real depth/parallax/particle stars, cross-browser. Big rewrite; the "do it properly for unbounded cinematics" ceiling-remover. Likely overkill for a tooling site, but it's the real answer if cinematics stay central.
   - Skeleton reveal (cheap placeholder in during motion, swap full content after settle) remains relevant for the tool mount regardless of which path.

**My recommendation:** try #2 (shorten+lighten) first — cheap, might be "good enough" in Firefox; in parallel seriously evaluate #1 (pre-rendered video) as the way to keep the full cinematic move robustly; treat #4 as aspirational and #3 as the safe fallback. Decision is Nate's — it's fundamentally "how load-bearing is the slow camera move."

## Where to find things

- **Branch:** `design/landing` (off `main` at `ca63fff`)
- **Scene masters:** `static/assets/landing/raw/scene-5120.png` (gitignored; .blend in Blender is real source of truth). Single 5120×3840 master; the optimization pipeline crops it into floor + sky regions.
- **Optimized assets shipped (Phase E):**
  - `static/assets/landing/floor-{1920,2560,3440,5120}w.{avif,webp}` (opaque ground + reflections)
  - `static/assets/landing/sky-{1920,2560,3440,5120}w.{avif,webp}` (opaque sky gradient + galaxy dust + band + anchor stars)
  - `static/assets/landing/noise-128.{webp,png}` (8-bit grayscale Gaussian noise tile, CSS overlay for banding mitigation)
- **Landing composition:** `src/routes/(scene)/+page.svelte` (the heroes); scene shell lives at `src/routes/(scene)/+layout.svelte`
- **Twinkle component:** `src/lib/components/landing/TwinkleStars.svelte` (sized to sky region; whole-sky + band-specific distributions)
- **Twinkle POC (historical):** `claude-artifacts/css_twinkling_stars_preview.html`

Recent commits on branch (most recent first):

- `e747778` — perf(landing): twinkle rework — frozen pan, gradient halo, opacity flicker (2026-05-29)
- `5b60039` — fix(landing): horizon star margin, pan endpoint, hero-click jerk + logo (2026-05-29)
- (Phase E commit) — feat(landing): Phase E — 21:9 layered scene (floor/sky split + CSS noise + band stars)
- `fa9f736` — refactor(landing): WAAPI compositor-thread transitions + SSR rest state
- `8e69e46` — chore(landing): Phase C iteration — slower pan, motion blur, attached layers
- `9593d98` — feat(landing): Phase C — tilt-up transition + persistent scene architecture
- `d4212bb` — feat(landing): Phase B — twinkle star layer + plate aspect lock
- `13e1d80` — feat(landing): Phase A — cosmic landing scaffold + chrome restructure
- `2a6ec85` — chore(landing): plate optimization pipeline + first 16:9 master export
- `4fb1120` — chore: add CSS twinkling stars POC artifact (on main; inherited by branch)

---

## Phase A — Static cosmic landing — **SHIPPED 2026-05-21** at `13e1d80`

**Layout chrome restructure:**

- Root `+layout.svelte` stripped to a chrome-free pass-through (fonts, app.css, favicon, default title) so landing + tools live full-bleed at the root.
- New `(utility)/+layout.svelte` carries the site shell (header with quasar logo + Bitter wordmark, primary nav, HoYoverse fan-disclaimer footer) for utility routes only.
- `settings/` moved into `(utility)/settings/` via `git mv` (rename history preserved).
- Old `static/logo.webp` removed; replaced with `static/critcalc-logo.svg` (quasar mark from Affinity Designer).

**Cosmic landing scaffold:**

- Full-bleed `<picture>` with AVIF + WebP `srcset` across 1920/2560/3840 tiers.
- `object-fit: cover; object-position: 50% 100%` anchors plate to viewport bottom; top overflows = Phase C headroom.
- New `.composition` wrapper holds CSS variables for hero card geometry (`--card-h`, `--card-w`, `--gap`, `--group-w`); sizes itself to derived group width, centered. Brand mark at `left: 0` inside (= leftmost card edge by construction); heroes fill full width with `justify-content: space-between` (natural gap = `--gap`). **The VALUES here are historical** — see `docs/rounds/hero-cards.md` for current geometry.
- ~~Three solid-filled placeholder hero cards at 4:5 aspect — radial highlight + linear dark gradient + drop shadow.~~ **SUPERSEDED 2026-07-26 (`7099713`)** by Nate's real plate silhouette — see `docs/rounds/hero-cards.md`, which also holds the WebKit rules the placeholders never needed.
- Brand mark: quasar logo + Bitter-500 wordmark, text optically offset `0.2vh` below logo center for the SVG's lower-right-biased optical mass.
- Entry choreography: landing fades in over 600ms; heroes stagger fly-in 220ms apart starting at 500ms (the "cosmos first, then choices" hierarchy per `docs/rounds/design-decisions.md`). **The per-hero stagger is GONE** as of 2026-07-26 — the whole `.composition` fades as one; only the fade remains.
- Team Builder stub route created at `(tools)/team-builder/+page.svelte` so `resolve('/team-builder')` validates.
- `prefers-reduced-motion` respected on hero hover; entry transition + Phase C still need it.

---

## Phase B — CSS twinkle layer — **SHIPPED 2026-05-22** at `d4212bb`

**Plate aspect lock (bundled into the Phase B commit):**

- Plate now sized to `width: calc(100dvh * 16 / 9)` with `bottom: 0` anchor instead of `object-fit: cover`. The visible bottom 16:9 frame always fills viewport vertically; sides crop at narrower viewports; the top 7/16 of the 1:1 source overflows above the viewport (preserved as tilt-up headroom across all aspects). Wider-than-16:9 viewports get `--bg` gutters until a wider plate variant ships.
- `--pan-y` CSS variable on `.landing` drives the tilt-up transform across plate and twinkle siblings. Defaults to 0 via `var(--pan-y, 0)` fallback; Phase C will animate it. Positive values push the plate downward (revealing upper sky); negative would move it up (exposing `--bg` below the floor).

**Twinkle scope:**

- `scripts/generate-stars.js` (`npm run generate-stars`): Mulberry32 seeded PRNG with Mitchell's best-candidate spatial sampling. Fractional CANDIDATE_COUNT resolved stochastically per-star (1.5 = each star independently rolls k=1 or k=2). Tunable knobs at top of file: count, sky region %, animation mix, color mix, halo prob, size range.
- `src/lib/stars.ts` (committed; regenerate-only): typed `Star` interface, one star per line in the data array so diffs are readable across regens.
- `src/lib/components/landing/TwinkleStars.svelte`: DOM-span renderer. `.twinkle` sibling of `.plate`, sized identically (`width: calc(100dvh * 16 / 9); aspect-ratio: 1/1; bottom: 0`) so stars share plate coordinate space and tilt with it. Star positions are plate-relative %; sky region is Y ∈ [0, 65] per Nate's calc (top 65% of plate is sky, bottom 35% is ground). Five color tints (white-biased), 90/5/5 gentle/jitter/dramatic animation mix, ~30% halo probability with size boost. `prefers-reduced-motion` freezes the field at opacity 0.8.
- No galaxy-band masking — Nate purposely reduced the band's baked star count so the generated field can layer over it without conflict.

**Settled tuning (current values in `scripts/generate-stars.js`):**

- COUNT=800; size 2.0-2.6px (quadratic small-bias); CANDIDATE_COUNT=1.5
- Gentle: trough = `var(--base) * 0.35`, peak = 1.0 (deltas 0.7-0.9)
- Jitter: opacity [0.92, 1.0] (delta 0.08), 13-stop keyframes with dancing halo (3 desync variants), box-shadow blur radii ~40% smaller than original
- Dramatic: smooth pulse from `var(--base) * 0.3` to 1.0 with subtle 1.15x scale at peak (was a brief flash; rewrote to be a slower deeper sibling of gentle)
- Color mix biased toward white (70/15/10/4/1 white/warm/cool/yellow/amber), tints kept low-chroma via color-mix at 82-92% white

**Notes for future tuning:**

- Halo color uses `--c` CSS var per star, so adjusting tint palette in CSS auto-updates halo color.
- Opacity on the span scales box-shadow naturally — that's how the static halo pulses with the body during gentle/dramatic animations (only jitter animates `box-shadow` directly).
- Negative `animation-delay` desync'es the cycle start across stars so the field doesn't pulse in unison at t=0.

---

## Phase C — Tilt-up transition — **SHIPPED 2026-05-22** (initial `9593d98`, iterated through `8e69e46`)

Per `docs/rounds/design-decisions.md` default "lift and dim." **There is no parallax** — every scene element is at infinity, all layers move together.

**Architecture (Phase C absorbed most of Phase D's scope, by Nate's call):**

- New route group `(scene)/` wraps landing + tools. Its `+layout.svelte` owns the persistent scene (plate + twinkle + dim overlay) and lives across landing ↔ tool navigations — no remount of the cosmic backdrop between states. Utility routes (under `(utility)/`) stay outside `(scene)` and have no scene background.
- URL paths unchanged (`/`, `/crit-visualizer`, etc.) — route groups don't appear in URLs.
- `.scene-stack` wraps the layout's three layers (with `display: contents` so it doesn't contribute to layout). Hosts all the per-frame CSS variables (`--pan-y`, `--motion-blur`, `--twinkle-play`) so they inherit to descendants in BOTH the scene and the page-content side.
- Z-stacking inside scene layout: `.scene` (plate + twinkle, z:0) → `.dim` (overlay, z:1) → `.content` ({@render children()}, z:2). All `position: fixed; inset: 0`.

**Transition mechanism (current tuning):**

- `src/lib/landing/transition.ts` exposes tweened stores + constants. `createSceneStores(initialPath)` returns `panY`, `dimOpacity`, `motionBlur` — initialized to the correct state for the initial URL so direct hits (e.g. refresh on `/crit-visualizer`) snap to tool state without an entry animation.
- `TRANSITION_MS = 1600` — slower than first-cut 1000 per Nate's "too fast" feedback.
- `TILT_EASING = cubic-bezier(0.65, 0, 0.35, 1)` — strong symmetric ease-in-out, implemented in code via 8-iter Newton's-method bezier solver. Replaced the asymmetric (0.5, 0, 0.2, 1) curve from initial Phase C.
- Pan endpoint: **as of 2026-05-29 this is `75dvh`, derived** (see Corrections below). The `100dvh * 7 / 9 ≈ 77.78dvh` value documented here was correct for the Phase-C 1:1 / 16:9 plate but became wrong at Phase E and caused a bg-band bug — do not reintroduce it.
- Scene layout's `beforeNavigate` hook updates the tween targets based on `nav.to.url.pathname`. Path === `/` → pan 0, dim 0. Anything else (inside scene) → pan endpoint, dim 0.6.

**All four scene layers pan together via `--pan-y`:**

- `.plate` and `.twinkle`: `transform: translate(-50%, var(--pan-y, 0))` — same coordinate space, plate bottom-anchored at viewport bottom in landing state.
- `.composition` (landing UI): `transform: translate(-50%, var(--pan-y, 0))` — landing UI is attached to plate at its visible position; rides down with it while fading out.
- `.tool-shell`: `transform: translateY(calc(var(--pan-y, 0dvh) - 100dvh * 7 / 9))` — attached to plate's _top_ edge; slides into the viewport from above as plate pans down.
- All four have `will-change: transform, filter` to force compositor-layer promotion.

**Fade timing (1.25× faster than pan, both directions):**

- `FADE_DURATION_MS = 1280` (= TRANSITION_MS / 1.25)
- `FADE_OFFSET_MS = 320` (= TRANSITION_MS - FADE_DURATION_MS)
- Outgoing: `out:fade|global={{ duration: 1280 }}` — no delay, fades 0→1280ms.
- Incoming: `in:fade|global={{ duration: 1280, delay: 320 }}` — waits 320ms so outgoing has cleared substantially before incoming appears.
- Overlap remains 320-1280ms (960ms) but both elements are at lower opacity through it.

**Anti-judder treatments (experimental, may not stay):**

- **Motion blur**: `motionBlur` tween pulses `0 → 2.5px → 0` with symmetric `cubicInOut` on each half (matches the velocity bell curve of the pan). Exposed as unitless `--motion-blur` on `.scene-stack`; consumed by all four panning layers via `filter: blur(calc(var(--motion-blur, 0) * 1px))`. Gaussian, not directional — uncertain whether it stays long-term.
- **Twinkle pause** _(reworked 2026-05-29 — now pre-armed on pointerdown and set on the `.twinkle` element, not `.scene-stack`; see Twinkle Performance Pass below)_: `--twinkle-play` toggles between `'paused'` and `'running'` during the transition window. `.star` elements use `animation-play-state: var(--twinkle-play, running)`. Frees GPU paint cycles for ~800 star DOM nodes during the pan.
- `inMotion` state tracked via `$state`; cleared via `setTimeout` after `TRANSITION_MS`. Both motion-blur and twinkle-pause use the same gate.

**Cold load on tool URL**: scene snaps to tool state (no pan), but tool's `in:fade` still runs with 320ms delay + 1280ms duration. Total ~1600ms before tool is fully visible. May want to short-circuit on cold load if it feels slow.

**Tools layout redesign:**

- Transparent shell, scene shows through. Brand-return is just the quasar SVG (no wordmark) — clickable to `goto('/')`.
- Position: **bottom-left** at `clamp(1.5rem, 3vh, 2.5rem)` from bottom + left. Was top-left initially; moved 2026-05-22 because rotation-planner's content area collides with the top-left corner. Marked "Final placement TBD" in CSS comment.

**Cleanups done during Phase C iteration:**

- Removed orphaned `<p class="intro-kicker">Tool</p>` from rotation-planner and `<p class="cv-intro-kicker">Tool</p>` from crit-visualizer. Both had `text-transform: uppercase` and rendered as "TOOL" near the brand-return logo. CSS for these classes also removed.

**`prefers-reduced-motion`**: pan duration → 0 (snap), dim still animates over `REDUCED_MS = 200`. No motion blur, no twinkle pause. Tilt motion fully suppressed.

**Open Phase C polish items:**

- Per-tool transition #3 ("hero rises, world falls away") deferred — pick when authoring each tool's polish pass per the 2026-04-26 design decisions.
- Brand-return is minimal-logo-only at temporary bottom-left position. Final placement TBD.
- Cold-load reveal timing may feel slow on repeat visits — could detect initial mount vs. navigation arrival.
- Landing heroes still use existing in:fly stagger (delay 500 + 220×i, duration 700). Last hero finishes at 1640ms — 40ms after pan settles at 1600. Tight but OK.
- Gaussian motion blur is experimental. Real cinematographic motion blur is directional; CSS doesn't have it natively. Could be removed if it doesn't earn its keep, or replaced with a more elaborate trick (e.g., layered offset copies) if needed.
- Heuristic check: stutter is fundamentally temporal aliasing from discrete-frame motion. Browser is already at display refresh rate; can't push FPS. Further GPU optimization (direct transform writes via $effect, smaller star count, fewer animated halos) is on the table if needed.

---

## Phase D — Dimmed scene persistence in tools — **MOSTLY SHIPPED 2026-05-22** (bundled into Phase C)

Phase C's persistent-scene architecture _is_ Phase D's end state:

- Plate + twinkle live in `(scene)/+layout.svelte`, persist across landing ↔ tool routes.
- Dim overlay is an opacity-animated `var(--bg)` layer (max 0.6) between scene and tool content.
- Tool shells are transparent — scene shows through.
- Twinkle continues to animate inside tools (no pause). Reduced-motion freezes it as before.

**Still open / future-work:**

- Whether twinkle should slow down or partially fade inside tools (currently runs at full pace; may feel busy in a working context — judge once a tool is actually used at length).
- Whether the dim layer should be replaced by a dedicated Blender dim-pass plate variant for richer atmosphere. CSS dim is in place now; revisit if it reads flat.
- The dim layer is currently a flat color overlay. Could become a gradient (top darker, bottom less dark — sky reads more atmospheric) — defer until needed.

---

## Phase E — 21:9 layered scene — **SHIPPED 2026-05-25**

The single 1:1 plate was replaced by a four-layer composition (CSS sky, baked sky image, twinkle stars, baked floor image) at a 21:9 default viewport aspect. The big drivers were richer ultrawide support, parametric sky color (for future per-tool tonal variation), and dramatic file-size reduction.

**Layer architecture (z back-to-front, all panning in lockstep via WAAPI):**

- `.sky-bg` — CSS `linear-gradient` between `--sky-top` / `--sky-bottom`, with `noise-128.webp` overlay (`background-blend-mode: overlay`) for banding mitigation. Sized to `100dvw × --scene-h` (fills ultrawide gutters; covered by `.sky` inside the 21:9 frame). Pans as `translateY(panY)` (no `-50%` centering since it already spans full viewport).
- `.sky` — baked sky image (gradient + galaxy dust + band + anchor stars), `5120×2768` source, sized to `--scene-w × --sky-h`, bottom-anchored at `--horizon-y`.
- `<TwinkleStars />` — CSS-animated stars, two distributions: whole-sky (sparse) + galaxy-band (dense with edge falloff).
- `.floor` — baked floor image (ground + reflections), `5120×1072` source, sized to `--scene-w × --floor-h`, bottom-anchored at 0.

**Horizon-line coordinate system** (in `(scene)/+layout.svelte`'s `<style>` block on `.scene-stack`):

- Source-image dimensions are the single source of truth: `--scene-w-src`, `--scene-h-src`, `--floor-h-src`, `--sky-h-src`. Change these to swap masters; everything derives.
- `--px = calc(100dvh * var(--viewport-aspect) / var(--scene-w-src))` is the one scale factor that converts source-px to CSS units.
- Derived: `--scene-w`, `--scene-h`, `--floor-h`, `--sky-h`, `--horizon-y` (= `--floor-h`).
- `--viewport-aspect: calc(21 / 9)` is the visible aspect at landing rest; narrower viewports crop sides, ultrawide viewports show `.sky-bg` gutters.

**Asset pipeline (`scripts/optimize-bg.js`):**

- Single `raw/scene-5120.png` master (5120×3840, lossless, gitignored).
- Two `REGIONS`: `floor` (crop top:2768 h:1072, AVIF q=80, WebP q=88) and `sky` (crop top:0 h:2768, AVIF q=70, WebP q=82). Floor preserves detail; sky compresses well at lower quality.
- Four tier widths: `1920 / 2560 / 3440 / 5120` — tuned to common ultrawide hardware (1080p ultrawide → 1440p ultrawide → 4K ultrawide).
- **No noise bake** — that's now the CSS overlay. Removing baked noise was a major file-size win (~5–10× on the sky region) because noise is high-entropy and inflates AVIF.
- Per-visitor combined download (floor + sky in AVIF): ~35 KB at 1080p, ~72 KB at 1440p ultrawide, ~113 KB at 4K ultrawide. Roughly 10× smaller than the single-plate predecessor.

**Twinkle / galaxy band stars (`scripts/generate-stars.js`):**

- Two passes, total ~1500 stars:
  - Whole-sky pass: `SKY_COUNT=700`, uniform over the full `.twinkle` element. `SKY_PARAMS` size 2.0–2.6, halo 22% base.
  - Galaxy band pass: `BAND_COUNT=800`, concentrated within a quadrilateral defined by four source-px Y values (`BAND_SRC.{topLeft, topRight, bottomLeft, bottomRight}`). Internally converted to %.
- **Inward density falloff:** `BAND_FALLOFF=8` (% inside each band edge). Acceptance probability is 0 at each edge, tapering linearly to 1 across `BAND_FALLOFF` % inward. The band's center is full density; edges fade to nothing. Where the band is narrow (left side ≈17% thick), the taper zones meet near the center — full-density core shrinks. Dial `BAND_FALLOFF` down if narrow sections feel washed out.
- Best-candidate sampling sees BOTH distributions, so band stars don't co-locate with whole-sky stars at band edges.

**WAAPI / SceneLayerKind updates** (from refactor in `fa9f736`, extended in this phase):

- `SceneLayerKind` now: `'sky-bg' | 'sky' | 'twinkle' | 'floor' | 'composition' | 'tool-shell' | 'dim'`. The old `'plate'` kind is gone.
- `restTransform` returns `translateY(panY)` for `sky-bg` (no centering), `translate(-50%, panY)` for `sky`/`twinkle`/`floor`/`composition`, the existing tool-shell offset, null for dim.
- SSR-time inline `transform`/`opacity` rendered on every panning leaf element so the first paint matches the cold-load path without a hydration snap.

**Resolved open questions from earlier phases:**

- ✓ 21:9 ultrawide variant: shipped, now the default.
- ✓ Galaxy band CSS stars: shipped, with band-specific density falloff.
- Stays open: hero-vignette authoring — ✅ the CARD itself shipped 2026-07-26 (`docs/rounds/hero-cards.md`); what's still open is the ART inside it; per-tool sky tonal variation (`--sky-top`/`--sky-bottom` are now CSS vars, making this trivial when wanted).

---

## Corrections — 2026-05-29 (commit `5b60039`)

Three post-Phase-E scene fixes + a logo iteration, all on `design/landing`:

- **Starfield lifted off the horizon.** `scripts/generate-stars.js` gained a `BOTTOM_MARGIN` knob (% off the horizon; `HORIZON_CUTOFF = 100 - BOTTOM_MARGIN`), applied to the whole-sky pass (`SKY.yMax`) and as a `Math.min` clamp inside `bandBottomY`. Currently **`BOTTOM_MARGIN = 1`** (Nate dialed it from my initial 3). Stars no longer sit on or get clipped by the horizon line (`contain: paint` on `.twinkle` was clipping the straddlers). Regenerated `stars.ts`.

- **Pan endpoint bug fixed (the "bg band at top in tool state").** `PAN_TARGET_DVH` in `src/lib/landing/transition.ts` was a hard-coded `100×7/9 ≈ 77.78dvh` left over from the old 1:1 / 16:9 plate. The Phase-E 21:9 scene is exactly **175dvh** tall (`100 × 21/9 × 3840/5120`), so the correct pan-to-top is **`175 − 100 = 75dvh`**. The stale value overshot by ~2.78dvh, pushing the sky's top edge _below_ the viewport top and exposing `--bg` (`#060914`). Now derived from JS consts (`VIEWPORT_ASPECT`, `SCENE_W_SRC`, `SCENE_H_SRC` → `SCENE_H_DVH - 100`) that **must mirror the `--*-src` / `--viewport-aspect` values in `(scene)/+layout.svelte`'s `.scene-stack` CSS**.

- **Hero-click initial jerk fixed.** Root cause: the WAAPI pan runs on the compositor, but its _first_ frame can't commit until the main thread yields — and a normal `<a>` click commits the SvelteKit navigation in the same task, so the destination tool's mount/hydration floods the main thread on frame 0. Fix in `(scene)/+page.svelte`: a `navigateToTool()` click handler `preventDefault`s plain primary clicks, calls `startSceneTransition()` immediately, then defers `goto()` by **two `requestAnimationFrame`s** so the compositor owns the animation before the heavy work lands. Modified clicks (cmd/ctrl/shift/alt/middle) fall through to default nav. `beforeNavigate` in `(scene)/+layout.svelte` stays as the catch-all for other navs (brand-return, back/forward) — it's a no-op for hero clicks since `startSceneTransition` early-returns on a path match.

- **`--twinkle-play` pause removed** (in `5b60039`) — flipping `animation-play-state` on ~1500 nodes at t=0 was the very recalc spike it was meant to avoid. **NOTE: re-added (pre-armed) in `e747778`** — see the Twinkle Performance Pass section below for the final design.

- **Logo:** `static/critcalc-logo.svg` simplified (Nate's quasar-mark iteration) — bundled into the same commit at Nate's request.

## Twinkle performance pass — 2026-05-29 (commit `e747778`)

After `5b60039`, the startup jerk was better but **mid-pan judder returned** — because removing the pause let the ~1500-node starfield re-raster every frame while the compositor panned (opacity + box-shadow animations changing the shared `.twinkle` layer texture). The fix was to make the field cheap to paint _and_ freeze it during the pan without paying the freeze cost at t=0. Nate confirmed it "looks dreamy" / "big win"; startup + judder both meaningfully improved (not yet 100% — see open follow-up).

**The freeze, pre-armed (the key trick).** A WAAPI transform-pan is smooth only if the layers it moves are _static rasters_. The twinkle layer wasn't (its children animate). So we freeze it during the pan — but the freeze's style recalc must not land on the pan's first frame.

- `src/lib/landing/transition.ts` owns it: `armTwinkleFreeze()` sets `--twinkle-play: paused` on the `.twinkle` element (children inherit it via `animation-play-state: var(--twinkle-play, running)`). It's called on hero **`pointerdown`/`keydown`** in `(scene)/+page.svelte` — _before_ the click — so the recalc happens during the press, not on frame 0. An 800ms watchdog thaws if a press never navigates.
- `startSceneTransition()` re-asserts the freeze for the pan and schedules a thaw at `TRANSITION_MS + 100` (on a now-static scene, so the resume recalc is invisible). Covers non-hero navs (brand-return, back/forward) too, which just take the small recalc at transition start.

**Box-shadow eliminated entirely** (it was the priciest per-element paint op):

- Static halos → an **eased radial alpha-mask gradient glow** on `.halo::after` in `TwinkleStars.svelte`. Color is solid `var(--c)`; shape is a `--halo-mask` radial-gradient used as `mask-image` (mask, not `background: ...transparent`, because a `transparent` stop fades through gray). Falloff is **eased (~`(1−t)²`, multi-stop)** to avoid the hard ring a linear ramp leaves. **Tuning knobs:** `inset` (size), `opacity` (intensity), the `--halo-mask` stops (softness).
- Flicker (jitter) stars are **opacity-only** now, driven by a single **`--flicker` knob on `.t-jitter`** (default **0.4** — Nate-approved; each keyframe dips `--base` by a fraction of `--flicker`, deepest stop = full `--flicker`). The 13-stop jagged rhythm + 3 desync variants are preserved; per-stop fractions are structural, `--flicker` is the master dial. **An opacity-only flicker at the old 0.92–1.0 range is sub-perceptible** — the visible part of the old jitter was the box-shadow halo _dancing_, so it needed widening to ~0.4 to read.

**Generator (`scripts/generate-stars.js`) changes:**

- **Halo decoupled from animation type** — `const halo = rand() < haloProb` (was `animation === 'jitter' || …`). So flicker stars are drawn from the whole field; most are bare pinpoints, ~quarter are halo'd. Any star can flicker.
- **Per-star `will-change` dropped** from `.star`/`.t-dramatic`/`.t-jitter` — 1500 layer hints can't be honored; only `.twinkle` keeps `will-change: transform`.
- `ANIM_MIX` jitter weight `0.05 → 0.06` (Nate's final; flicker stars ≈ 89). **Count is stochastic per regen** even with the fixed seed (changing the weight shifts which stars roll jitter → the variant `rand()` shifts the whole sequence), so tune the weight by checking the resulting count, not arithmetic.

**`stars.ts` is generated + prettier-ignored.** `scripts/generate-stars.js` writes **one star per line** (compact, ~1532 lines) for readable diffs. Prettier would expand it ~10× (to ~16.6k lines) — which it silently did in `5b60039` (my miss). Fixed: `src/lib/stars.ts` is now in `.prettierignore`, and `e747778` restored the compact form. **Never run `prettier --write` on `stars.ts`; just `npm run generate-stars`.** (Aside: `npm run lint` has ~12 _pre-existing_ prettier warnings in unrelated character JSONs / parser files — not ours.)

**OPEN FOLLOW-UP — RESOLVED 2026-05-30.** The residual judder _was_ the tool's load. Diagnosed by DevTools trace and fixed via suppress-during-pan + reveal-after-settle. See the **Tool-load judder fix + side-tool crane** section below.

---

## Tool-load judder fix + side-tool crane — 2026-05-30 (working tree on `design/landing`, **uncommitted**)

Two coupled changes, both verified, awaiting Nate's review before commit.

### 1. Side-tool diagonal crane

The two flanking tools pan up _and sideways_ instead of straight up, using the 21:9 scene's horizontal overflow beyond the viewport. Crit Visualizer (left hero) → camera cranes up-left (world shifts right); Team Builder (right) → up-right; Rotation Planner (center) unchanged. All in `transition.ts`:

- `SIDE_LEAN_DEG = 16` — the one knob. Horizontal travel = `tan(angle) × 75dvh`, **self-clamped** to `0.9 × per-side overflow` so the scene edge / `--bg` gutter never enters frame. Overflow `O = (sceneW − 100dvw)/2`, `sceneW = 100dvh × 21/9`; O → 0 as the viewport approaches 21:9, so ultrawide degrades automatically to the straight tilt-up.
- `sideSign(path)`: crit-visualizer → +1, team-builder → −1, else 0. `sideXTerm` splices a signed CSS `min(...)` term into the world layers' `translate()` X (the −50% is element-relative centring; the term is the absolute crane offset).
- Applied to **sky / twinkle / floor / composition** (the world). `sky-bg` (vertical gradient — horizontal motion invisible) and `dim` stay un-craned. SSR inline transforms in `(scene)/+layout.svelte` now come from the exported `restTransform()` so a direct hit on a side tool paints leaned (no hydration snap); `TwinkleStars` takes the full `initialTransform` string.
- Leeway is viewport-aspect dependent: ~15.6dvw/side on 16:9, ~22.9 on 16:10, **0 on 21:9**.

### 2. Tool-load judder fix — "suppress during pan, world-locked slow-tail reveal"

**Trace method (reusable):** drove a profiled landing→tool navigation over CDP — raw Node + built-in `WebSocket` (Node 24), headful Chrome, against a **production `vite preview` build** (the dev build's unbundled module waterfall is NOT representative). Phase-split the 2500ms pan into mount[0–1000] / quiet[1000–1500] / fade[1500–2500] and measured raster ms / dropped frames / main-thread busy per phase + max presented-frame gap. Harness left in `/tmp/critcalc-trace.mjs` (analyzer) and `/tmp/critcalc-shots.mjs` (screenshots) — ephemeral, not committed.

**Diagnosis (the non-obvious part):** the bare scene pan is **free** — the "quiet" phase drops **0** frames in both tools, so sky/floor/frozen-twinkle translating on the compositor costs nothing. Judder was entirely the _tool_: (a) the mount flood (~740ms main-thread in the first second for the planner, but even the 14 KB crit-visualizer is ~490ms → it's mostly SvelteKit nav + hydrate baseline, not the tool), and (b) the old Svelte `in:fade`, which is a **main-thread rAF opacity loop** that re-rasterized the full-viewport tool layer every frame → **GPU raster (`CrGpuMain`) saturated** (planner fade-phase raster 1169ms). It was **raster starvation, not main-thread blocking**; the tile workers were idle and the 2-rAF defer already handled frame-0.

**Fix:**

- Tool-shell **removed from the WAAPI scene-layer system** — it no longer pans. During the pan it is `visibility: hidden`: mounted + laid out (so CodeMirror still measures — verified `cmContentH = 72`, _not_ 0) but **not painted**, so it's off the raster pipeline. `visibility` chosen over `content-visibility` precisely so layout (hence editor measurement) survives.
- **Reveal = slow-tail fade + world-locked transform** (refined 2026-05-30, see below — supersedes the first-cut "reveal fully after settle"). `revealed` state in `(scene)/(tools)/+layout.svelte`, initialized `!hasActiveSceneTransition()` → true on SSR/cold-load (instant) / reduced-motion; false on a transition arrival.
  - **World-lock:** `onMount` (during a transition) drives a WAAPI transform animation on the shell from `toolShellWorldFrom(toolPath)` → `translate(0,0)`, pinned to the scene's exact clock (`getActiveReveal()` returns the pan's `startTime`/`duration`/`toolPath`; `anim.startTime = active.startTime`) with `TILT_EASING_CSS`. Its motion delta (down `PAN_TARGET`, sideways by the crane) is then **identical to the background**, so the shell reads as fixed in the world, descending + craning into center. Verified: craned side tool rests at `matrix(1,0,0,1,0,0)` (dead center, no sign error).
  - **Fade-in (SHARED with the landing UI, unified 2026-05-30):** the shell stays `visibility:hidden` (unpainted) until its fade begins, then a CSS `@keyframes tool-fade-in` (opacity, `backwards` fill so the steady state carries no transition for the outro to fight) runs over `FADE_DURATION_MS` (800ms) ending exactly at settle — i.e. starting `FADE_OFFSET_MS` (1200ms) into the pan, the same instant the landing composition fades in. Reveal timer: `wait = max(0, timeUntilSettle() − FADE_DURATION_MS)`. So the one-time raster lands at ~60% of the pan (just past peak velocity).
- **Exit is also world-locked** (added 2026-05-30 — fixed a drift where the shell sat centered while the scene craned away behind it). A custom `out:lockedExit` transition starts a WAAPI transform animation synced to the _reverse_ pan's clock (`getActiveReveal()` returns the tool path for return navs too — `isLandingPath(toPath) ? fromPath : toPath`), so the shell recedes up + sideways locked to the scene while Svelte drives only the opacity (`css: t => opacity:${t}`). `entryAnim` is now component-scoped so the outro can cancel it and take over the transform. Verified: shell and `.sky` move by identical per-frame deltas during the reverse pan. The opacity fade length is `FADE_OUT_MS` (the shared faster outro); the transform rides the full reverse-pan duration until the shell unmounts.
- **Fade knobs unified across landing + tools (2026-05-30, Nate's request):** the separate `REVEAL_START_FRACTION` / `REVEAL_FADE_MS` / `REVEAL_OUT_MS` are GONE. The landing composition AND the tool shell now share these knobs (all in `transition.ts`):
  - `FADE_DURATION_MS` — fade-IN, = round(`TRANSITION_MS`/`FADE_SPEED_MULTIPLIER`).
  - `FADE_OFFSET_MS` — fade-in delay/start = `TRANSITION_MS` − `FADE_DURATION_MS`.
  - `FADE_OUT_MS` — outro = round(`FADE_DURATION_MS` × 0.75), deliberately quicker than the fade-in.
  - `FADE_OVERLAP_MS` (added 2026-05-30) — the incoming fade-in ENDS this many ms PAST settle (and starts that much later), so it "bleeds" past the camera end. **Both fades are settle-anchored:** tool reveal `wait = max(0, timeUntilSettle() − FADE_DURATION_MS + FADE_OVERLAP_MS)`; the landing `in:fade` `delay` uses the **same formula** (changed 2026-05-30 from the old fixed `FADE_OFFSET_MS + FADE_OVERLAP_MS`, so the landing fade ENDS at settle+overlap like the tool rather than ~mount-delay later). `FADE_OFFSET_MS` is now unused by the landing (still exported). **Dual purpose:** a larger value also pushes the tool's reveal raster later (toward/past settle, slower motion) → fewer reveal drops — the dial for trading "fade overlaps the moving camera" vs "reveal lands on a calm scene".
  - **Easing: ALL FOUR fades (landing + tool, in + out) are LINEAR.** Brief history: the tool reveal used CSS `ease`, the landing Svelte fade defaulted to `linear`; I unified them to ease-out (`cubicOut` / a shared `FADE_EASING_CSS`) on 2026-05-30 — but that introduced a NEW asymmetry: at equal durations an ease-out fade-IN looks ~40% SHORTER than a linear fade-OUT (the slow 0.94→1.0 tail is imperceptible). Nate wants a fade's visible time to equal its duration, so **reverted to linear everywhere** (FADE_EASING_CSS removed, the `--fade-ease` var + landing `cubicOut` gone). Verified: in and out now both ramp uniformly (~0.16 opacity / 400ms at FADE_DURATION=2500). **If we ever want a non-linear curve again, apply it to all four** — the tool reveal is a CSS animation (CSS string), the other three are Svelte fades (JS easing); both representations must match.
  - **Outgoing fades:** start at the camera's beginning (already overlap the start), linear over `FADE_OUT_MS`. A true "fade leads the camera at the start" would require _delaying the pan_ → reintroduces the frame-0 mount jerk + latency — deferred, flag if wanted.
  - Values are Nate-tuned and in active flux (he's been setting extreme test values to expose behavior, e.g. `FADE_SPEED_MULTIPLIER=1`, `FADE_OVERLAP_MS=2000`, `FADE_OUT_MS` ratio `×1.0`, to verify in==out). Read the live consts, don't trust a snapshot here. Reveal drops: lazy character loading (`docs/rounds/lazy-character-loading-plan.md`) trims the MOUNT drops, NOT the reveal drops (velocity-dependent, not weight-dependent — the light crit-visualizer drops the same as the planner); raising `FADE_OVERLAP_MS` toward settle is the lever for the reveal drops.

### Landing element fades (current tuning, for reference — unchanged)

What drives the landing UI (`.composition` in `(scene)/+page.svelte`, holds brand-mark + heroes):

- **Transform:** `use:sceneLayer={'composition'}` → rides the scene pan/crane via WAAPI, locked to the scene (same `TRANSITION_MS` clock + `TILT_EASING_CSS`). So the landing UI pans + cranes with the world on every transition.
- **Opacity:** `in:fade|global={{ duration: FADE_DURATION_MS, delay: FADE_OFFSET_MS }}` + `out:fade|global={{ duration: FADE_OUT_MS }}` — the **same three knobs the tool shell now uses** (unified 2026-05-30): `FADE_DURATION_MS`=800 (in), `FADE_OFFSET_MS`=1200 (in delay, ends at settle), `FADE_OUT_MS`=600 (faster out). Landing + tools fade identically.
- **Heroes:** `in:fly|global={{ y: 24, duration: 700, delay: 500 + i*220, easing: cubicOut }}` — **fixed literals, NOT tied to the transition constants** (and mostly masked on return — see below; untouched by the unification).

Behavioral semantics (verified):

- **Leave (landing→tool):** `out:fade` clears the UI over the first ~600ms (`FADE_OUT_MS`, no delay) while it cranes away locked to the scene.
- **Return (tool→landing):** `in:fade` waits 1200ms then fades in over 800ms → fully visible exactly at settle (1200+800=2000). The hero `in:fly` also plays (500–1640ms) but is **largely masked** because the wrapper opacity is 0 until 1200ms — so on return you mostly see the wrapper fade reveal already-settled heroes (the fly-stagger is mostly wasted on return).
- **Cold load (first visit): NO entry animation plays** — verified (composition + heroes at opacity 1 / transform none from the first sample). The landing SSRs and Svelte suppresses intro transitions on hydration, so the entry choreography only runs on client-side returns, not first paint.
- **Preload on pointerdown:** `warmTool()` in `(scene)/+page.svelte` calls `armTwinkleFreeze()` + `preloadData(resolve(path))` so module fetch/parse is out of the pan window.

**Verified results (production build, 1080p, real GPU), before → after on the planner:** pan max presented-frame gap **261ms → 16.6ms** (one frame interval); fade-phase raster **1169ms → 41ms** (the compositor reveal rasters the layer once, ~60ms, in the post-settle window — proving the old Svelte fade was the per-frame re-raster); fade-phase dropped frames **32 → 0**; gaps > 32ms **1 → 0**. Crit-visualizer improved in lockstep. Both tools render correctly post-reveal; tool cleanly invisible mid-pan. `npm run check` clean, 363 tests pass, prettier clean on touched files.

**Residual:** ~16 isolated single-frame drops during the mount burst (main-thread, but maxGap still one frame → imperceptible). Could be shaved with finer route code-splitting / lazy CodeMirror init, but not worth it now.

**Files touched:** `src/lib/landing/transition.ts` (crane consts + `sideSign`/`sideXTerm`, `REVEAL_*` + `toolRevealFrom`, `hasActiveSceneTransition`/`timeUntilSettle`, exported `restTransform`, dropped the `tool-shell` SceneLayerKind), `src/routes/(scene)/+layout.svelte` (SSR transforms via `restTransform`), `src/routes/(scene)/+page.svelte` (`warmTool` preload), `src/routes/(scene)/(tools)/+layout.svelte` (reveal-after-settle rewrite), `src/lib/components/landing/TwinkleStars.svelte` (`initialTransform` prop).

## Patterns landed in Phase A (worth carrying forward)

**Composition wrapper for parametric layouts.** When multiple elements share derived geometry (heroes + brand mark both anchored to card-group width), put them in a single container with CSS-variable geometry definitions. Wrapper sizes itself to derived width; children position relative to it. Robust across viewport aspects.

**Clamp policy.** Clamp values whose visual quality is bounded (font sizes, gaps, logo sizes — need floor/ceiling for readability/comfort). Don't clamp structural proportions meant to scale 1:1 with viewport (layout fractions). ⚠️ `--card-h` was the worked example here and **is now clamped** (`clamp(19rem, 58vh, 40rem)`, 2026-07-26): once the card got the real 2.6:1 plate, pure vh made it unreadable on a short laptop window and absurd on a tall one — so its visual quality IS bounded, and it moved into the first category. See `docs/rounds/hero-cards.md`. Don't clamp micro-values where variation is imperceptible (0.2vh offsets — clamping adds noise without benefit).

**SVG cursor quirk.** Affinity Designer / Serif-exported SVGs (`xmlns:serif`, `xml:space="preserve"`) can render as text-cursor inside `<img>` tags. Fix: `pointer-events: none` on the image (events bubble to anchor parent), plus `cursor: pointer` + `user-select: none` on the parent anchor for completeness.

**Scene asset pipeline** (`scripts/optimize-bg.js`, post-Phase-E): path-anchored to script location. Reads single 5120×3840 `raw/scene-5120.png` master; for each `REGION` (floor / sky), crops via `sharp.extract`, downsamples to each tier width, encodes AVIF (4:4:4 effort=6) + WebP (smartSubsample effort=6). Per-region quality settings (floor q=80/88, sky q=70/82) — sky tolerates lower quality because its content is smoother. **No noise bake** — it was removed when noise overlay moved to CSS. That removal was a 5–10× file-size win on the sky tier (noise is high-entropy and inflates AVIF). Bumping AVIF `effort: 6 → 9` for a final encode still saves ~15–20% bytes at identical quality (slower iteration, save for shipping).

---

## Open design questions

- **Per-tool transition choice** (default "lift and dim" #1 vs "hero rises, world falls away" #3) — decide per tool when authoring each
- **Per-tool sky tonal variation** — `--sky-top` / `--sky-bottom` are CSS vars now; trivial to override per tool when wanted (e.g. cooler sky for Crit Visualizer, warmer for Rotation Planner). No work needed until a design call lands on what variation to apply.
- **Dim-variant plate pass** vs CSS dim — currently CSS dim; could be replaced by a separate Blender dim-pass variant if atmospheric depth in tool state feels flat
- **Hero vignette authoring** (Nate's vector work) — will replace solid-filled placeholders; positioning is parametric so vignettes drop in cleanly without recomposition

## What's NOT done (small follow-ups)

- Hero entry fly transition not gated by `prefers-reduced-motion` (only hover transitions are)
- Tool-shell brand-return position is bottom-left "temporary" placement; final spot TBD

---

For broader context: `docs/rounds/launch-roadmap.md` · memory `project_design_constitution` · `docs/rounds/design-decisions.md` · `project_design_roadmap` (a retired note) · `docs/rounds/ui-design.md`
