# critcalc

Budget: about 12,000 characters. This file holds what applies everywhere. Area rules live in `.claude/rules/`, history lives in `docs/`, and the upkeep rules are at the bottom.

## What this is

critcalc.app is a Genshin Impact tooling site: SvelteKit (Svelte 5 runes) and TypeScript (strict), built with `adapter-static` and deployed by Cloudflare Pages. A push to `main` deploys the live site. The repo is public.

The tools show how the game's mechanics work and leave the judgment to the player. Today that means windows, timings and distributions rather than damage totals or rankings. That is the current scope, not a vow: never write "never" about the project's future.

- **Rotation Planner** (`/planner`), the flagship: KQM notation in, a frame-accurate timeline out.
- **Team Builder** (`/builder`): a capability-faceted roster ("who can heal, shield, buff, at which constellation") and lineups.
- **Visualizers** (`/visualizers`): eight graph instruments in a tiled workspace.
- Around them, full-screen sections: Roster, Teams, Library, Help, Settings, Profile, Trash.

Since 2026-10-27 the site runs the profiles layout: each profile holds its own documents in IndexedDB, under a top bar and per-tool toolbars. The previous layout survives only as the switch's off state (`src/lib/nextLayout.ts`, read for browsers without IndexedDB and by `?next=0` in dev) until it is deleted. Build nothing new on the old layout.

## How we work

- Nate directs and designs: requests, rulings, art and the final eye. Claude engineers and architects, and owns the codebase.
- **Nate's call:** anything visual (build it, describe what changed, let him look), real Safari and iPhone checks, user-facing copy, taste, and anything public about himself. A value he tunes by eye lands verbatim as a `tune(nate)` commit and is never "corrected" or regenerated.
- **Claude's call:** engineering, structure, tests and refactors. Give a clear recommendation with its reason, not an open menu.
- User-facing text: read `docs/text/style-guide.md` and `docs/text/glossary.md` before writing or editing any string. US English, Oxford comma, no capitals for emphasis. Propose copy before landing it. The existing prose was AI-written, so all of it is fair game.
- The repo is public, so nothing private goes in: credentials and private IDs, email addresses, home-directory paths, personal circumstances, or third parties by name. Scrub before committing; a pushed commit is effectively permanent.
- Push only when asked. Never commit feature work straight to `main`.

## Standing rules

- No speculative abstractions. Flag a data gap as `// TODO: data gap — [field]`.
- SSR and hydration: paint a deterministic default first, then restore client state in `onMount`.
- Page meta comes from one map, `src/lib/seo.ts`, rendered once by `SeoHead.svelte` in the root layout. Never give a page its own `<svelte:head>` title: `<svelte:head>` does not dedupe, so the page would ship two of every tag. A new route needs an entry in `seo.ts` and in `static/sitemap.xml`.
- Errors have two surfaces that catch different things: `src/routes/+error.svelte` handles routing and load failures (chiefly 404, rendered outside the scene), and the `<svelte:boundary>` in `(tools)/+layout.svelte` catches a throw during render. ⚠️ That boundary is the only one, so the full-screen sections under `(pages)` have none yet.
- `/assets/*` is immutable and add-only. A redrawn asset ships under a new name (`-v2`), never as an overwrite.
- Mechanics are verified against the local gcsim checkout at `~/Code/gcsim` (tick cadences, scalings, targeting, in `internal/characters/{id}/`). Fetch it first.
- Terminology follows KQM (Keqing Mains) throughout.
- Node 22 (`.nvmrc`). Scripts import TypeScript modules through Node's native type stripping, which needs 22.18 or later.

## Gates and verification

Before every commit: `npx vitest run`, `npm run check` (svelte-check), `npm run lint` (Prettier and ESLint), and `npm run build`. The production build is the real gate: never verify against dev alone.

End-to-end tests: `npm run test:e2e:chrome` after every round, `npm run test:e2e` (both engines) before a merge. The rules for running and writing them are in `.claude/rules/e2e.md`.

**Tests.** A bug fix or a new mechanic in the engine or data layer (parser, sim, gauge, reactions, codecs, timing, notation edits, data conventions) ships with a Vitest test beside the module, named in the commit and in the report. No approval needed. The test checks behaviour, not internals, so it survives unrelated refactors. Where a right answer exists before the fix (gcsim, an in-game log, Nate's report), write the failing test first. A verified damage or buff figure becomes a regression fixture.

**Still proposed first:** a new e2e spec (each one adds browser time to every round and merge), and anything that would verify visual or rendering work. That work is built and shown to Nate, never scripted. Nothing Safari-facing is verified until Nate has looked at it in real Safari; Playwright's WebKit catches thrown errors, not rendering differences.

⚠️ A backgrounded browser tab freezes `requestAnimationFrame`, so anything smooth-scrolled or rAF-driven measures as broken there. Check tab focus before blaming the code.

**Never:** a committed one-off probe, or a coverage target. Answer what the source or the SvelteKit and Vite docs already say by reading them. Observe runtime state inline (`node -e`, `curl | grep`, `npm run build && grep build/`). If a file is unavoidable, it goes in `scratch/` (gitignored) and is deleted in the same turn.

## Commits and branches

- Conventional commit types (`feat` `fix` `refactor` `perf` `test` `docs` `chore` `revert`) plus three of ours: `tune` (hand-tuned values, not behaviour), `polish` (refining an existing surface, no new capability), and `experiment` (exploratory work, usually on an `experiment/` branch). The scope names the area: `(planner)`, `(data)`, `(builder)`, `(visualizers)`, `(sim)`, `(pages)`, `(text)` and so on.
- The subject names the change; the body says why, including what was tried and rejected.
- Feature branches merge with `--no-ff` and the message `Merge <branch> — <summary>`. The merge commit is the hash to cite later.
- `git merge -F -` does not read stdin.

## Where to find things

| Need                                                                               | Go to                                                                                                                                                           |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Area rules (each loads on its own when you read or edit a file its `paths:` match) | `.claude/rules/`: `data` · `schema` · `sim` · `gauge` · `timeline` · `planner` · `builder` · `visualizers` · `ui` · `tool-chrome` · `scene` · `scripts` · `e2e` |
| Character data and its types                                                       | `src/lib/data/characters/`, `src/lib/types/`                                                                                                                    |
| Derived capabilities                                                               | `src/lib/capabilities/deriveCapabilities.ts`                                                                                                                    |
| Parser and sim                                                                     | `src/lib/utils/notationParser.ts` (the façade), `src/lib/sim/`                                                                                                  |
| Timeline projections                                                               | `src/lib/timeline/`, drawn by `src/lib/components/RotationTimeline.svelte`                                                                                      |
| Rotation links (`?r=`)                                                             | `src/lib/utils/rotationUrl.ts`                                                                                                                                  |
| Profiles and documents (IndexedDB)                                                 | `src/lib/storage/`                                                                                                                                              |
| Settings and small local stores (localStorage)                                     | `src/lib/stores.ts` (`siteSettings`, `constellations`, `loadout`)                                                                                               |
| Breakpoints                                                                        | `src/lib/breakpoints.ts` (the table) and `src/lib/media.svelte.ts`                                                                                              |
| Design tokens and global styles                                                    | `src/app.css`; judge on `/lab`, look things up on `/styleguide`                                                                                                 |
| The scene (WebGL night sky)                                                        | `src/lib/landing/`                                                                                                                                              |
| Audits, generators, writers                                                        | `scripts/`                                                                                                                                                      |
| Skills (step-by-step recipes)                                                      | `.claude/skills/`: `ingest-character`, `gcsim-frames`, `verify`, `daily-checkin`                                                                                |
| Why something is the way it is                                                     | the round records in `docs/` (`*-round.md`), and `docs/round-history.md`                                                                                        |
| Current design of a surface                                                        | `docs/profiles-and-surfaces-design.md`, `docs/team-builder-lineups-design.md`, `docs/notices-design.md`                                                         |
| What's next                                                                        | memory `project_post_launch_todo` (the one to-do list)                                                                                                          |

House words: a **round** is one unit of work with its own branch and record. **The oracle** is gcsim, run through `scripts/gcsim-dump/`. **The corpus** is the full set of character JSONs. **Night, glass and paper** are the three materials (`.claude/rules/ui.md`). **The bench** is the planner's slot cards beside the timeline.

## Keeping these files tidy

- One home per fact. Everywhere else links to it.
- A trap about one spot in the code is a comment at that spot. A rule about an area goes in that area's `.claude/rules/` file. Only rules that apply everywhere go here.
- Instruction files speak in the present tense: no dates, commit hashes, round names, or notes about what something used to be. When a rule changes, rewrite it in place.
- A rule is one sentence, its reason, and where to read more. ⚠️ marks a genuine trap and nothing else. No capitals for emphasis.
- If a test, lint rule or hook can check a rule, it does, and the prose shrinks to one line naming the check.
- At the end of a round: its record goes in `docs/`, and only there. A rule file changes only if a standing rule changed. Memory gets only lessons about working together.
- Budgets: this file about 12,000 characters, each rule file about 10,000. When one runs over, move detail out rather than raising the budget.
