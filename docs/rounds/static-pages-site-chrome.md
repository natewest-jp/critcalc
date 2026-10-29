# Static pages and the unified site chrome (2026-07-22)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

**✅ SHIPPED — squash-merged to `main` 2026-07-22 (`60d828c`), pushed. Branch `feat/static-pages` (6 rounds) squashed; local branch lingers (sandbox blocks `git branch -D` — harmless, content is on main).** Built iteratively with Nate over one session. Gates at merge: vitest 1227, check 0/0, lint clean, build prerenders all pages; browser-verified (Playwright) across landing/pages/tools, 0 console errors.

## Architecture (read before touching the landing / pages / chrome)

- **Route groups.** The old plain `(utility)` group is RETIRED. Static pages now live under **`src/routes/(scene)/(pages)/`** so they render OVER the shared starry scene: `about`, `faq`, `privacy`, `settings` (settings = thin route rendering `SettingsPanel`). URLs unchanged (`/about` etc. — route groups don't affect paths).
- **`SiteChrome.svelte` + `SiteFooter.svelte` live in the SCENE layout** (`(scene)/+layout.svelte`), rendered `{#if !isToolPath(pathname)}` as single **persistent fixed bars** (chrome top, footer bottom) — identical on landing + every page, absent on tool routes (which keep their own `.tool-chrome`). So they don't remount on landing↔page nav; content crossfades beneath them. Chrome = brand (→home) + `About · Help · Privacy` nav (Bitter, copied from the tool chrome, NO ?/gear). Footer = disclaimer only (dim, no hover). The landing's big hero wordmark was RETIRED — the chrome brand replaces it.
- **Fixed content panels.** Each page is a `position: fixed` opaque `--surface` panel between chrome and footer (`top: calc(var(--site-chrome-h)+gap)`, `bottom: calc(var(--site-footer-h)+gap)`), **content scrolls INSIDE it** (`overflow-y:auto`) while the frame + scene stay put. `--site-chrome-h: 70px` / `--site-footer-h: 64px` in app.css `:root`. Panel z:2 sits ABOVE the footer gradient (z:1) so it's never darkened; chrome z:3, footer z:4.
- **Modal behavior.** `.pages-shell` (absolute, transparent) is the backdrop: click outside the panel OR press Escape → `goto('/')`.

## ⚠️ The `isToolPath` gate — occlusion AND the star fields

`transition.ts` `isToolPath(path)` = true ONLY for the 3 tool routes. Everything that used to key off `!isLandingPath` now keys off `isToolPath`, because the static pages are scene-VISIBLE (not tools):

- **Scene occlusion** (`sceneOccluded`) seeds/clears on `isToolPath`, not `!isLandingPath`.
- **TwinkleStars + ShootingStars** `suspended = isToolPath(...)` (was `!isLandingPath` — that BUG suspended the live stars on the scene-visible static pages, so a cold load showed only the baked sky). **Don't reintroduce `!isLandingPath` as a scene-visibility test.**

## Parallax

- The cursor-parallax controller is started in the **scene layout `onMount`** (was per-page in the landing). It persists across landing↔pages, so the scene no longer snaps back to center on page-click (the reset-jump). Registered layers: scene `.parallax-world` (world factor), landing `.composition-inner`, the pages `.pages-panel`, and the **chrome + footer wrappers** — all ride the same `PARALLAX_CONTENT_FACTOR` and move together.
- Travel tuned down over the session: `PARALLAX_MAX_X_DVH` 2.2→1.2, `PARALLAX_MAX_Y_DVH` 0.8→0.45.

## Typography (Nate's reversal)

Global `h1–h6` default to **IBM Plex Sans** (`--font-body`) now; **Bitter (`--font-display`) is reserved for branding (wordmarks) + chrome nav**, which opt in explicitly. Site chrome branding is ~25% larger than the tool chrome (logo 4.25rem, wordmark 1.4rem, 70px bar). **NOTE: the TOOL chrome brand was left at the original size (3.4rem / 56px) — a matching scale-up is an open follow-up if the size shift landing→tool bothers.**

## Content + the help link

About (expanded + Credits: gcsim/KQM/genshin-db), Help & FAQ (`#faq` general + per-tool `#crit-visualizer`/`#rotation-planner`/`#team-builder` sections), Privacy (localStorage-only, no tracking). The in-tool `?` guide gained a **"Full guide & FAQ →"** link to `/faq#<tool>` (the deferred item from `docs/rounds/settings-help-consolidation.md` — now DONE). Footer gradient = 200px `linear-gradient(to top, rgba(2,9,31,1), rgba(3,6,16,0))`, z:1 behind the panel.

See `docs/rounds/settings-help-consolidation.md` (settings modal + backup, the `?` help pointers), `docs/rounds/launch-roadmap.md` (static pages were a launch-roadblocking item — now done), `docs/rounds/design-principle-nonmodal-tools.md`.
