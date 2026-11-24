# Ability names and kit notes — 2026-11-24

The plan in `docs/design/i18n-plan.md` §7 (⚓ Nate 2026-11-24): every ability, passive,
constellation, summon, and shield name, every label composed from one, and every kit note, in
Japanese, so the community request shows the whole tool. Japanese is still hidden. Four stacked
rounds, each with its own branch, gates, and Chrome e2e:

1. `feat/i18n-ability-names`: the game's names, from its own data.
2. `feat/i18n-composed-labels`: labels joining a game name to notation or our words.
3. `feat/i18n-kit-notes`: the caveats and `notModeled` reasons, drafted.
4. `feat/i18n-close-out`: Help's shots, the `/ja` scan, and this record.

## 1. The game's names

- **Three sources, nothing translated by us.** `scripts/generate-ability-names.mjs` reads
  genshin-db by talent and constellation position (1,423 names), then the English text map
  matched to the Japanese by hash (106; where two hashes differ only in the middle dot, ・ wins),
  then the talent tables' row labels less their suffix (46: "Tamoto DMG|…" is
  「たもと」のダメージ|…, so Tamoto is 「たもと」). The third source was not in the plan: summons,
  fields, and stances are rarely printed alone, and the plan's 1,385 + 70 counted only the first
  two. Its suffixes are a closed list (`LABEL_SUFFIXES`), and every label found must agree.
- **Run by hand.** The text maps are about 300 MB and absent where the site deploys, so the
  table is committed as `src/lib/data/abilityNames/ja.json` and `abilityNames.test.ts` fails on
  a name with no line. Which names count is one list, `abilityNameSources.ts`, shared by the
  generator and the test.
- **Loaded only in Japanese.** The table is about 78 KB, so it is a lazy chunk a non-English page
  fetches with its first character payload (`loadCharacter` waits for it, so no name shows
  English first). English pages carry none of it. `localeTables.ts` is the loader, shared with
  the kit notes.
- **Display only.** `abilityName(id, english)` translates where a name is shown: the detail
  card, the Inspector, the notes' headings, the summon lane on screen and in the PNG, buff-row
  labels, bonus chips, coverage forms, and DEF & RES titles. Row keys, chip keys, and parser
  lookups stay English; the test holds that no two of a character's names become one.

## 2. Composed labels

- `src/lib/data/nameParts.ts` splits a label one level at a time: notation and a name
  ("A1: Rekindle"), a name and a detail ("Searing Onslaught (E1)"), a name and its part
  ("Molten Inferno: Ranging Flame"), a step ("Whirling Steps 1"), a suffix ("Opening Flourish
  Shield"), and coverage's cast and variant ("… · Hold"). `abilityName` composes the parts back
  through `ability_*` messages: 逆焔の刃（E1）, A1：…, 長押しLv.2. The test holds that English
  composes back letter for letter for every label in the corpus.
- **Short words never go to the text maps.** "Press" matched プレス and "Field" a rice field
  (田んぼ), so our words and the game's fixed terms are one list (`OUR_WORDS`), each a message.
- **By hand.** Thirty-six parts the game prints only inside a description (Clorinde's
  明燭の影, Nicole's 熾光の護り) are matched by hand in `BY_HAND`, each citing its line. After
  it, every part of every label resolves.
- The name list grew to what the planner prints for an entry: variant labels, attributions,
  threshold fire labels, drawn stack counts, and faction bonus names.

## 3. Kit notes

- 338 lines in 120 characters (about 43,000 characters of English): the 152 caveats the plan
  named, and the `notModeled` reasons, which are the same kind of prose and show in coverage.
  They live in `src/lib/data/kitNotes/ja.json`, keyed by character and entry id, each line
  carrying a fingerprint of its English (`kitNoteHash`). `kitNotes.test.ts` fails on a missing
  line, a line whose English moved, and a line whose note is gone; `scripts/kit-notes.mjs`
  lists the work (`todo`) and stamps a draft (`merge`).
- Drafted by Claude in the site's polite form, from `docs/text/terms-ja.md` (section K holds the
  recurring phrasing). Game names inside a note come from the names table and the text maps.
  The avoided forms (凸, CD) are checked here too, from `avoidedForms.ts`, now shared with
  `messages.test.ts`. One 凸 was written and caught before the check existed.
- `deriveCoverage` stays English because the index generator runs it under Node; coverage
  finds the entry behind a reason and translates at display.

## 4. Close-out

- **Help's shots.** The Japanese pass changed three planner shots: the Inspector and the phone
  dock carry Japanese names and notes, and `planner-timeline`, which matched English before, now
  has a Japanese file of its own (its summon labels). The Builder's shots still match English.
- **A capture bug.** A partial run (`--only`, `--lang`) kept English's manifest entry whole,
  `locales` included, so a language whose shot had since matched English stayed in the data,
  and a later partial run imported a file that no longer exists (the build failed on
  `builder-capabilities.ja.webp`). `capture.mjs` now keeps English's entry without its locales;
  a full Japanese pass cleaned the data (21 entries, 21 files), and a partial run after it builds.
- **The `/ja` scan,** in headless Chrome against the build: coverage with all 129 rows open,
  eight Builder detail cards, and the planner with the Inspector open over four different
  sample teams. It found three gaps, now fixed:
  - Coverage joins a cast and its variant with " · ", which the splitter didn't know.
  - Two faction badges were hard-coded English in `TeamBonusesBlock.svelte` and
    `TeamDetail.svelte`; they use the existing messages.
  - A capability's element printed its English id ("耐性ダウン：Cryo"); `capDetailText` names
    elements through the element labels, and Physical is a new message, `tb_physical`.

## English changes

Four names in the data were wrong against the game's text and are fixed: the Dendro and Pyro
Travelers' normal attacks are Foreign Fieldcleaver and Foreign Blaze (were Foreign Thunderwood
and Foreign Emberblade), the Dendro Traveler's lamp is Lea Lotus Lamp (was LeaLotus), and
Ororon's C4 attribution names As the Mysteries of the Night Wind (was Reverence for the Wondrous
Wind). Nothing else in English changes: every new message carries the English it replaces.

## Still English in /ja

- Notation and the names written in it (`Columbina E Q > …`), and notation inside a note
  (`{coldDish:N}`, `C ~Xs`).
- Names that stay Latin on purpose: critcalc, HoYoverse, and sources credited by name (Prydwen,
  Keqing Mains).
- From the finishing record: one boss title, one check, and nine boss mechanics the text map has
  no line for.

## Verified

- Gates on each round branch: vitest (3,023 at the end), check, lint, build.
- Chrome e2e after each round: round 1, 72 passed, 1 skipped, 1 flaky (the scene's image decode,
  as before); rounds 2 and 3, 73 passed, 1 skipped. Both engines on the final stack: 146 passed,
  1 skipped, 1 flaky (WebKit, the board's reload test, failed on the scene's GL mount when the
  reload canceled an image load, and passed on retry; the scene is untouched here).
- The `/ja` scan above, with no page errors.

## For Nate's eye

- `/ja/planner` and `/ja/coverage`: ability names, summon lanes, and notes now read in Japanese.
  The composing words (section J of `terms-ja.md`) are Claude's calls for the community to check.
- The Japanese Help shots at `/ja/help/planner`: the Inspector, phone dock, and timeline shots
  changed; the pins should sit where English's do.
