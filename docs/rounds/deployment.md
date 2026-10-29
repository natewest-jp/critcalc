# Deployment — Cloudflare Pages (decided 2026-07-04)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

**Target: Cloudflare Pages, GitHub → Pages flow.** Chosen over the earlier "GitHub → Vercel" plan.

> **UPDATE 2026-07-09:** the git remote now EXISTS and is pushed — `origin` = `github.com/natewest-jp/critcalc`, `main` tracks `origin/main` at `8b8dc33`. The deploy-config below (authored on `design/landing`) is now on `main`. Remaining open step: create the Cloudflare Pages project pointed at this repo + first deploy (dashboard settings in the section below).

> **UPDATE 2026-07-21 — 🚀 LIVE ON THE CUSTOM DOMAIN.** `critcalc.app` is wired to Cloudflare — its DNS zone is on Cloudflare's nameservers (Active + serving) and the apex is attached to the Pages project as a custom domain (CNAME-flattened, auto-SSL; `.app` is HSTS-preloaded so HTTPS-only). The "create the Pages project + first deploy" step above is **DONE**; the domain-connect launch action is **DONE**.
>
> **UPDATE 2026-07-22 — LAUNCH PLAN REVISED: ONE launch, no hard date.** The two-phase soft-launch (07-28) / full-launch (08-11) schedule is RETIRED. Nate won't promote heavily, so the early-"soft" audience ≈ the launch audience; a second public flip added nothing. Launch is now gated on the launch-roadblocking checklist in `docs/rounds/launch-roadmap.md` (finalize landing, static pages, Visualizers round, legibility pass), NOT a date — estimate ~1–2 weeks out, aimed BEFORE Genshin 7.0 (~Aug 12) so it isn't lost in the new-version focus. **The `static/_headers` noindex stays until that single launch, then gets removed.** (⚠️ the dated banner INSIDE `static/_headers` still says 2026-08-11 — stale; update or ignore, the removal action is what matters.)
>
> **Live but NOINDEXED until launch.** `static/_headers` ships `X-Robots-Tag: noindex` on `/*` (commit `0a16790`, deployed + confirmed serving) so search engines stay off the site while remaining pre-launch polish lands. `static/robots.txt` left as allow-all — the noindex _header_ is the lever (a robots.txt `Disallow` doesn't prevent indexing, and Googlebot must be allowed to CRAWL so it can READ the noindex). **⚠️ REMOVE `static/_headers` + redeploy AT LAUNCH (single launch, no hard date, ~1–2 wks out) to re-enable indexing** — the file carries a loud dated banner as a backstop (banner date now stale; the action, not the date, is what matters).
>
> **Cloudflare AI Crawl Control (shown during zone onboarding) — the settings + rationale:** Search=**Allow** (correct for eventual SEO _and_ required so Googlebot can crawl→read the noindex), Agent=**Allow** (answer-engine fetches = free distribution for a free tool), Training=**Nate's values call** — site is ad-free, so the "Block on pages with ads" default is effectively _allow_; Block is zero-cost (training crawlers give no traffic/discoverability, unlike Search/Agent). The "Block training in robots.txt" toggle appends AI-training-bot `Disallow` rules atop the served robots.txt (targets GPTBot/CCBot/Google-Extended — **NOT** Googlebot, so no SEO impact; verify the merged result via `curl https://critcalc.app/robots.txt` once active).
>
> **N/A for Pages:** the onboarding notice _"only allow Cloudflare IP addresses at your origin"_ does **not** apply — Pages has no self-managed origin server / public IP to firewall (Cloudflare _is_ the origin; origin-bypass attacks are structurally impossible here). It would only matter if critcalc ever moved off Pages onto a VPS/own server.

## Why Cloudflare Pages over Vercel

The app has **zero server-side runtime** — no `+server.ts`, no hooks, no form actions, no `.server.ts`, no DB/auth/API. All computation is client-side (pure notation parser, localStorage stores, CodeMirror). It's effectively a static site + one SPA route. So Vercel's edge (SSR/edge-functions/ISR maturity) buys this project nothing today.

Two decision factors, both the user's stated concerns:

1. **Traffic spikes** — Cloudflare Pages serves static assets with **unlimited free bandwidth + requests**; Vercel meters bandwidth (Hobby 100GB/mo throttles, Pro bills overage). A spike (subreddit/creator link) is exactly where Vercel's model hurts.
2. **One-location asset hosting** — project is asset-heavy and getting heavier (landing scene AVIF pipeline; WebGL/video floated). Pages + **R2 (zero egress)** is one home for site + large media.

## Config (shipped 2026-07-04, authored on `design/landing`; now on `main`)

- **Adapter: `@sveltejs/adapter-static`** (NOT adapter-cloudflare). Rationale: app is 100% prerendered with no server routes, so adapter-static emits a pure static bundle — **no Pages Function**, so every request is a CDN static hit with **zero Worker invocations** (Worker invocations count against the CF free-tier daily quota during a spike; avoiding them entirely is the win). `adapter-cloudflare` was tried first and warned "Dropping 403 exclude rules — unnecessary function invocations" (its Function's `_routes.json` exceeds CF's 100-rule limit); that's the symptom of using a server-capable adapter for a static app. **If a server-side route is ever added, swap the one `svelte.config.js` line back to `@sveltejs/adapter-cloudflare`.**
- **`src/routes/+layout.ts`: `export const prerender = true`** — site-wide. Every page bakes to static HTML at build time. Verified: `index.html` ships 275KB of real SSR'd scene markup.
- **Rotation planner stays `ssr = false`** (its `+page.ts`) — prerenders as a ~1.4KB client-hydrated shell, correct for a localStorage-backed SPA route.
- **`adapter({ fallback: '404.html' })`** — CF Pages auto-serves root `404.html` (404 status) for unmatched paths, giving the app's own error page instead of CF's generic one.
- **Dead-link crawler is strict (default).** The `/about` page now exists (built 2026-07-04, see below), so the temporary `handleHttpError` allowance was removed — the prerender crawler again fails the build on ANY broken internal link.
- **`.nvmrc` = `22`** — Vite 7 needs Node `^20.19 || >=22.12`; CF Pages default is often older and would fail the build. `.nvmrc` pins it.

Verified: `npm run build` clean, `npm run check` 0 errors/0 warnings, all 5 pages + 404.html prerender to `build/`.

## Cloudflare dashboard settings (for when the CF Pages project is created)

- Framework preset: **SvelteKit** (or None)
- Build command: **`npm run build`**
- Build output directory: **`build`**
- Node version comes from `.nvmrc` (22); no env var needed.

## Resolved 2026-07-04 (same session as the deploy setup)

- **Raw masters relocated out of `static/`.** Moved `static/assets/*/raw/` → top-level **`assets-src/`** (`assets-src/landing/scene-5340.png`, `assets-src/transitions/vortex-plate-2048.png`); updated `optimize-bg.js` / `optimize-portal.js` INPUT paths and `.gitignore` (now `/assets-src/`). Build dropped 61MB → 13MB locally; masters stay gitignored/local-only (regenerable from source). `static/` now contains only served files. **Note:** the 49MB master is uncommitted (local-only) — if it should be backed up, that's a separate decision (Git LFS if so, not raw history).
- **`/about` page built** — `src/routes/(utility)/about/+page.svelte` (simple prose: what critcalc is, the three tools, KQM/fan-project note). Fixes the dead nav link; `handleHttpError` allowance removed.

## Open follow-ups

- **⚠️ LAUNCH MUST-DO: remove ONLY the `X-Robots-Tag: noindex` RULE from `static/_headers` + redeploy. DO NOT DELETE THE FILE** — it also carries the permanent `Cache-Control: public, max-age=31536000, immutable` rules for `/assets/*` and `/_app/immutable/*`. Dropping those re-introduces the ~126 conditional requests per portrait grid that the perf work removed, and breaks the add-only asset contract the element-icon generator's hash naming is built on. The file says this in its own header comment.\*\* — the single action that makes the site publicly indexable. Launch is now a single flip on no hard date (~1–2 wks out; two-phase retired 2026-07-22). The pre-launch window is intentionally noindexed.
- Related client-side launch features that keep the "no server runtime" property true: URL-encoded rotation state + PNG export (both client-side by design — see `docs/rounds/launch-roadmap.md` L2). _(Both since shipped.)_

See also: `docs/rounds/launch-roadmap.md`, `docs/rounds/landing-status.md`, memory `project_design_constitution`.
