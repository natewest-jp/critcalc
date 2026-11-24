# Finishing Japanese — 2026-11-24

Steps 1 to 4 of "Finishing Japanese" in `docs/todo.md`, after the pages
(`i18n-pages-2026-11-24.md`): the game's names in Japanese, the small extraction follow-ups,
Help's screenshots from the Japanese build, and the completeness and avoided-forms checks.
Japanese is still hidden. Four stacked rounds, each with its own branch, gates, and Chrome e2e:

1. `feat/i18n-game-names`: the endgame's Japanese, and character, weapon, and set names.
2. `feat/i18n-followups`: the words and ids the extractor could not see.
3. `feat/i18n-help-shots`: Help's screenshots, once per language.
4. `feat/i18n-checks`: Japanese stays complete and avoids 凸 and CD.

This record is on `docs/i18n-finishing`.

## 1. The game's names

- **The endgame had no Japanese source.** lunaris.moe serves Stygian, Abyss, and Theater text in
  English, Chinese, Portuguese, Russian, and French, and every Japanese endpoint answers 404.
  genshin-db carries base enemies (兆載永劫ドレイク) but not Stygian's titles, mechanics, or
  checks, nor the Abyss's blessings. The game's own text maps carry all of it, so
  `scripts/localize-endgame.mjs` looks each line's Chinese up in the Chinese text map and writes
  the Japanese line at the same hash. 318 of 329 lines match. The rest keep English through
  `inLang`'s fallback: one boss title (the Control Array's Will of the Hive, which the text map
  has only as another mode's variant, so it is not assembled), one check, and nine mechanics.
  The text maps come from Dimbreath's `animegamedata2` (the old `AnimeGameData` stopped at 6.x;
  the new one's branch is `main`), cached in the gitignored `assets-src/textmap/`.
  `fetch-endgame.mjs` runs the localizer last.
- **Checks and boss titles.** A check's verdict still reads the English, and the chip pairs each
  verdict with the shown alternative by position, so `endgame.test.ts` holds every translated
  check to English's alternatives and sprites. Japanese brackets a boss's variant (百風) where
  English uses a colon; `bossTitleParts` splits either form.
- **Character, weapon, and set names** come from genshin-db through
  `scripts/generate-game-names.mjs` (chained into predev and prebuild) into
  `gameNames.generated.ts`, read through `$lib/i18n/gameNames`. A name is taken only when
  genshin-db's English name is exactly ours. The game's full name shows where English shows a
  short one (楓原万葉 for Kazuha). Display only: notation, parser lookups, the feedback form's
  prefill, and saved data keep English. Search matches either name.
- **The Traveler** has no per-element entry in genshin-db, so it is 旅人（風）, the draft's 旅人
  with the element's name. Game8 and Altema write 主人公(風): open question 17 in
  `docs/text/terms-ja.md`, which gains section I for all of this. genshin-db's elements carry no
  Chinese, so Chinese Travelers wait for the Chinese term list.

## 2. The extraction follow-ups

- Reaction labels (Melt, Stellar-Conduct, Electro-Charged, the three Lunar reactions, and the
  family's "Lunar-Cryst."), ATK%, DEF%, and HP%, and the buff-value fragments ("/stack",
  "(cap N)", the afterDuration row's "(end)") are messages.
- Lookups by id: capability captions, per-ally and per-member buff values, the aura log, the
  detail card's kicker, the More filters' weapon and region chips, the bench's "no curated
  weapons" note, faction bonus names, the Inspector's kind tags (通常攻撃, 固有天賦; constellations
  stay C4), and Enemy RES & DEF's source names. Regions and weapon types are the game's, from
  genshin-db; "Other" is ours.
- Joined labels with a Latin colon or full stop (the coverage strip's title, a capability's kind
  and detail, the ICD reading's verdict) are messages.
- The text maps settle two terms genshin-db's Japanese lacks: Stellar Glimmer's reactions are
  星反応 (the state is 輝映・星閃), and the Starlight Prism is スターライトプリズム, as drafted.
  Entries 115 and 149 say so.
- The Inspector tags and DefRes names were found while shooting Help in Japanese, so they are a
  second commit on this round's branch, and round 3 was replayed onto it.

## 3. Help's screenshots

Every shot is taken once per drafted language (`LANGS` in `capture.mjs`), from that language's
pages and with the browser in that locale, and written as `<id>.ja.webp` beside English's with
its own size and pins. `HelpFigure` shows the page's own, else English's. A shot with no words in
it comes out byte-identical, so capture drops it: 20 of 25 shots have a Japanese file. A
selector that named English words reads them through `t(key)` at capture time, so the shot list
stays one list; `--lang` re-shoots one language. A rerun of English, to prove the reworked
selectors, came out byte-identical for 24 shots and differed by thin rendering noise for
`vz-artifact-piece`, identical by eye, so the committed English file stays.

## 4. The checks

In `messages.test.ts`: every English message has a line in each locale whose draft is whole
(`COMPLETE`, Japanese today), and Japanese uses neither 凸 (entry 88) nor CD (entry 28). A locale
joins `COMPLETE` when its draft is whole rather than when it opens, so it can't decay before
then. Each check was seen to fail against a seeded break before the file was restored.
`CLAUDE.md` says the everywhere half: a new English message gets its Japanese line, and game
names come from the game's data.

## English changes

Visible English is unchanged except five captions and buff values that printed a raw id in
lowercase and now use the game's capitalized name: "needs Moonsign teammates", "vs
Pyro-affected enemies", "+15%/Geo ally", "+10%/Hexerei member", and "No Polearm-type weapons are
curated yet." The More filters' chips and the detail card's kicker already capitalized by CSS.

## Still English in /ja

- **Ability, passive, and constellation names** (Gravity Ripple, Shrine of Maya, Rainbow
  Bladework) on the timeline, in tooltips, and in the Inspector. They reach the screen through
  the sim's labels, which also serve as row keys, and some are not whole talents in genshin-db
  (a field or a summon), so they need their own pass. This is now the largest English in `/ja`.
- **Kit notes** (each ability's `caveat` in the character data), the English prose the
  Inspector and the detail card show.
- A capability caption for a stack condition prints the stack's raw key in every language
  ("needs impactMomentum stacks"): copy proposal 1 below.
- One boss title, one check, and nine boss mechanics the text map has no line for.
- Names that stay Latin on purpose: critcalc, notation, Theorycraft, and the sample rotations'
  names (they are saved as tab labels the code recognizes).

## Verified

- Gates on each round branch: vitest (3,011 at the end), check, lint, build.
- Chrome e2e after each round: 73 passed, 1 skipped (round 3's run had one flake, coverage's
  detail expansion on a 19-second cold start, passed on retry). Both engines on the final stack:
  146 passed, 1 skipped, 1 flaky (the scene's GL mount failed to decode an image under parallel
  load in Chrome, passed on retry; nothing this run changed touches the scene).
- English against `main`'s build in headless Chrome: the text and labels of the Builder,
  Planner, Visualizers, coverage, Library, and Help's three tool chapters at 1600 and 390 wide
  match line for line (5,676 lines), apart from the bootstrap script's build hashes.
- `/ja`: the Builder's roster and Stygian board, the Planner, and the Visualizers show no English
  but what the list above names, with no page errors.

## For Nate's eye

- Game names are the game's full names, so a card that read "Kazuha" reads 楓原万葉, and the
  Traveler reads 旅人（風）. The roster's name sort still follows English, which looks unordered in
  Japanese; a kana order needs readings for the kanji names (香菱, 楓原万葉) that genshin-db doesn't
  carry. Claude's pick: leave it until the community says what players expect.
- On a phone, the Stygian board's short boss names (百戦錬磨のドモヴォーイの彫刻師) are longer than
  the English before the colon.
- Help's Japanese screenshots, at `/ja/help/planner`, `/ja/help/builder`, and
  `/ja/help/visualizers`: the pins should sit on the same things as in English.

## Copy proposals

1. The capability caption for a stack condition (`tb_needs_arg_stacks`), which shows a raw key:
   Now: needs impactMomentum stacks
   → depends on stacks

## Next

Steps 1 to 3 of "Finishing Japanese" in `docs/todo.md`, and a proposed pass for ability names
and kit notes before the community request.
