# Copyright and licensing

critcalc is copyright © 2026 Nate West.

Everything in this repository falls under one of the rows below, and the sections after the table say which paths go where. Where a path fits two entries, the more specific one wins.

| What                         | License                                                     | Full text                                          |
| ---------------------------- | ----------------------------------------------------------- | -------------------------------------------------- |
| Source code                  | GNU Affero General Public License v3.0 only (AGPL-3.0-only) | [`LICENSE`](LICENSE)                               |
| Curated data + documentation | Creative Commons Attribution-ShareAlike 4.0 (CC BY-SA 4.0)  | [`LICENSE-DATA`](LICENSE-DATA)                     |
| critcalc's own artwork       | All rights reserved                                         | —                                                  |
| Genshin Impact content       | © HoYoverse; not ours to license                            | —                                                  |
| Third-party components       | Their own licenses                                          | [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) |

## Source code — AGPL-3.0-only

Everything not listed in a later section, including:

- `src/` — the application: components, routes, the parser, the simulator, the stores and styles, and every hand-written `.ts` file under `src/lib/data/`
- `scripts/` — the data pipeline, audits, generators and asset builders
- `scripts/gcsim-dump/` — the frame-data dumper. It links [gcsim](https://github.com/genshinsim/gcsim) as a library, and gcsim has been AGPL-3.0 since 2026-09-19, so the dumper is a combined work with gcsim. The repository's AGPL license already covers it and meets gcsim's terms; it is not a separate exception.
- `e2e/`, the configuration files at the root, and the server config in `static/` (`_headers`, `_redirects`, `robots.txt`, `sitemap.xml`, `manifest.webmanifest`)
- Generated code: `src/lib/marks.generated.ts`, `src/lib/stars.ts`, `src/lib/data/elementIcons.generated.ts`, `src/lib/data/sceneAssets.generated.ts`
- The scene's grain and noise tiles in `static/assets/landing/` (`grain-*.png`, `noise-128.*`), which a script generates

The AGPL is a network license. If you run a modified version of critcalc as a public website, you must offer that site's users its source code (section 13).

## Curated data + documentation — CC BY-SA 4.0

- `src/lib/data/**/*.json` — character, weapon, artifact and endgame data (the fetched endgame files are excepted below)
- `src/lib/data/characterIndex.generated.ts`, `characterRoles.generated.ts`, `shredSources.generated.ts` — data tables generated from those files
- `docs/` — everything in it: `docs/curation/` (audit reports, talent sidecars, caveat ledgers), `docs/library/` (the game-mechanics library), `docs/text/` and every design record and round note, except the third-party files listed below
- The other Markdown documentation: `README.md`, the `CLAUDE.md` files, `.claude/skills/`, and the handoff notes at the root

To credit the data, write:

> Data from critcalc (critcalc.app), CC BY-SA 4.0

If you share an adapted version, it must carry CC BY-SA 4.0 too.

This license covers critcalc's own work: how the data is chosen and arranged, the effects, conditions, frames and caveats we wrote, and the writing in the docs. It does not license the game content inside the data (see below). Character data is seeded from genshin-db (MIT), and frame data is measured against gcsim. Both notices are in `THIRD_PARTY_NOTICES.md`.

## critcalc's own artwork — all rights reserved

Drawn or rendered for critcalc. It is not covered by either license above: you may not reuse it, including in a fork. A fork has to replace it with its own artwork.

- **The brand mark / logo**: `static/critcalc-logo-white.svg`, `src/lib/assets/favicon.svg`, and any copy of the mark inlined in source
- **The app icons (the starfield tile)**: `static/apple-touch-icon.png`, `static/icon-192.png`, `static/icon-512.png`
- **The social card**: `static/assets/og/`
- **The scene plates** (the rendered sky and floor): `static/assets/landing/sky-*`, `static/assets/landing/floor-*`
- **The landing card artwork**: the path data in `src/lib/landing/heroArt.ts`
- **The site chrome's About and Help glyphs**: their inline SVG artwork in `src/lib/components/SiteChrome.svelte`
- **The capability glyphs drawn for critcalc**: `static/assets/effects/Icon_Attribute_Cleanse.svg`, `Icon_Attribute_Taunt.svg`, `Icon_Attribute_DMG_Buff.svg` (DMG%), `Icon_Attribute_RES_Shred.svg`, `Icon_Attribute_Grouping.svg`, `Icon_Attribute_Infusion.svg` and `Icon_Attribute_Interruption_Res.svg`, and their paths in `src/lib/fingerprintGlyphs.generated.ts`
- **The constellation marks**: `static/assets/constellations/` and `src/lib/constellationMarks.generated.ts`. The glyphs are cut from IBM Plex Sans (SIL OFL 1.1; see `THIRD_PARTY_NOTICES.md`).
- **The vortex plate** from the retired portal transition: `static/assets/transitions/`

The code around the embedded artwork is still AGPL-3.0. Only the artwork itself is reserved.

## Genshin Impact content — © HoYoverse

Genshin Impact and its content are © HoYoverse. critcalc is a fan project and is not affiliated with or endorsed by HoYoverse.

critcalc's licenses do not cover HoYoverse's material. It is used here as fan content, and HoYoverse keeps every right to it. That material includes:

- Character, weapon, artifact, talent, constellation, enemy and place names, and in-game text quoted in the data, docs and site
- `static/assets/characters/` — character portraits
- `static/assets/weapons/`, `static/assets/artifacts/`, `static/assets/weapon-types/` — item and weapon-type art
- `static/assets/elements/` — element icons, including the `tinted/` set generated from them, and the `lunar`, `omni` and `stellar` icons traced from art the game uses
- `static/assets/effects/` — attribute icons. The `.webp` files are the game's own icons. The other `.svg` files (and their paths in `src/lib/fingerprintGlyphs.generated.ts`) are traced from the game's own icons; the seven drawn for critcalc are listed above.
- `static/assets/roles/` — the Imaginarium Theater role icons
- The site chrome's Settings glyph (inline in `src/lib/components/SiteChrome.svelte`), traced from the game's settings icon
- `static/assets/endgame/` — Spiral Abyss and Stygian Onslaught boss art, sprites and blessing art

Game numbers (scalings, cooldowns, frame counts) are facts about the game. They appear in the data as measurements.

## Third-party material in the repository

These files are not critcalc's work, and their sources keep their rights:

- `docs/library/wiki/capability-categories.json` — category membership from the [Genshin Impact Fandom wiki](https://genshin-impact.fandom.com), whose text is CC BY-SA 3.0
- `docs/library/game/genshin-character-roles.csv` — Genshin's Imaginarium Theater role table, plus critcalc's documented amendments
- `src/lib/data/endgame/stygian.json`, `stygian-bosses.json`, `abyss.json` — Stygian Onslaught and Spiral Abyss data fetched from [lunaris.moe](https://lunaris.moe), which serves the game's own data. Only `season-dates.json`, written by hand, is critcalc's.

Code from third parties (bundled libraries, fonts, the icon set, and the logic ported from gcsim) is listed with its license text in [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
