# critcalc

**[critcalc.app](https://critcalc.app)** — theorycrafting tools for Genshin Impact that help you visualize and plan: rotation timings, durations, and uptimes; endgame lineups and how character swaps change team composition; elemental gauges, crit ratios, wish and artifact odds, and more.

## The tools

- **Rotation Planner** — type a rotation in [KQM notation](https://library.keqingmains.com/theorycrafting#combat-notation) to see the rotation drawn as a frame-accurate timeline. Makes the order of events and uptimes visible at a glance and easy to compare. Supports playback at game speed with audio cues for rotation practice.
- **Team Builder** — lineups for the Spiral Abyss and Stygian Onslaught, with each team's capabilities (healing, shields, RES shred, buffs, grouping…) derived from the character data at your constellations, and what swapping a member would change.
- **Visualizers** — a variety of instruments making game mechanics visual and interactive: a crit-ratio heatmap, ICD timeline, gauge explorer, reaction curves, enemy RES & DEF, damage breakdown, artifact odds and wish odds.

## How the data is built

The character files in `src/lib/data/characters/` start as stubs generated from [genshin-db](https://github.com/theBowja/genshin-db) and are curated by hand: effects, conditions, durations and stacks, each with its source. Frame data, tick cadences, ICD and elemental application are checked against [gcsim](https://github.com/genshinsim/gcsim) by an oracle that links gcsim as a library (`scripts/gcsim-dump/`). Audit scripts in `scripts/` diff the data against gcsim, genshin-db and the Fandom wiki, and write their reports to `docs/curation/`. Capabilities such as "heals" or "shreds Pyro RES" are derived from the effects, never maintained by hand.

`docs/` holds the project's design and decision records, and `CLAUDE.md` is the working context for the AI-assisted development this project uses.

## Stack

SvelteKit (Svelte 5 runes) and TypeScript, built with `adapter-static` and deployed on Cloudflare Pages. The landing scene is WebGL; the notation editor is CodeMirror. No UI framework — styling is CSS custom properties in four layers (ramps, compositing, roles, grounds).

## Running it

Requires Node 22.18 or later (`.nvmrc`).

```sh
npm install
npm run dev
```

| Command            | What it does                                                                 |
| ------------------ | ---------------------------------------------------------------------------- |
| `npm run build`    | production build (also regenerates the character index and generated assets) |
| `npm run test`     | Vitest: parser, simulation, data lint, codecs, projections                   |
| `npm run check`    | svelte-check                                                                 |
| `npm run lint`     | Prettier + ESLint                                                            |
| `npm run test:e2e` | Playwright on Chrome and WebKit                                              |

## License

critcalc is split across four sets of terms. [`COPYRIGHT.md`](COPYRIGHT.md) maps each path to its license.

- **Code**: [GNU AGPL-3.0](LICENSE). If you run a modified version as a public website, you must offer its users the source.
- **Curated data and docs** (`src/lib/data/`, `docs/`): [CC BY-SA 4.0](LICENSE-DATA). Credit it as "Data from critcalc (critcalc.app), CC BY-SA 4.0".
- **critcalc's own artwork** (the logo, app icons, social card, scene plates and landing art): all rights reserved.
- **Genshin Impact content**: © HoYoverse. critcalc is a fan project and is not affiliated with or endorsed by HoYoverse.

Third-party code, fonts and data sources are credited in [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
