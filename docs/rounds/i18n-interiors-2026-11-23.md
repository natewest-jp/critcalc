# The tool interiors — 2026-11-23

Round 7 of the translation item in `docs/todo.md`: the Rotation Planner, the Team Builder with
Roster, and the Visualizers, extracted with English unchanged and drafted in Japanese from
`docs/text/terms-ja.md`, still hidden. Stacked branches: `feat/i18n-interiors` (extraction),
`feat/i18n-ja-interiors` (the Japanese draft), and this record on `docs/i18n-interiors`.

## How it ran

The 1,705 interior strings were split by ledger surface into five groups with disjoint source
files, each extracted and drafted by its own agent in a worktree, then merged: planner;
bench and coverage; tb; vz, vz_artifact, vz_breakdown, and vz_crit; vz_defres, vz_gauge,
vz_icd, vz_rc, and vz_wish. Each group's branches (`feat/i18n-<group>`,
`feat/i18n-ja-<group>`) are merged into the two round branches. `messages/*.json` were
merged as the union of both sides; the pseudo-locale and the ledger inventory were
regenerated after each merge.

## What was built

- **1,614 messages extracted** into `messages/en.json` (2,172 in all). A string kept in code
  on purpose carries a comment saying why: notation (C0–C6, R1, the A and B tags), units,
  sample rotations (their names are saved as tab labels that `isMintedLabel` reads), values
  matched against an imported Paimon.moe file, formulas the ledger notes keep as they are,
  SVG and canvas strings, and errors that never reach a screen.
- **Whole messages:** assembled sentences became one message per case, as plural messages,
  select messages over an id (a reshape tier, a weapon type, a slot), or markup rendered by
  `Msg.svelte`. Module-level tables read their messages at each use (`labels()`, getters).
  Lists use `Intl.ListFormat` in the page's language, and dates follow it.
- **Strings the extractor's heuristics skip** but which show on screen (the Gauge's "Top
  up", the coverage legend's "Stand-in", the Roster's key sheet words) are messages under
  the keys the extractor would mint, with its hash suffix where a key collides.
- **The extractor files a message under the surface of the file that calls it**, when the
  key carries that prefix. The workspace's instrument names (`vz_crit_heatmap`…) had been
  filed under the instruments' surfaces.
- **The Japanese draft** covers every new message. Section F of `terms-ja.md` lists the 28
  entries the drafting added, and open questions 12 and 13 are new.

## English changes

Visible English is unchanged except where a count of one read wrong or a list lacked the
Oxford comma:

- "1 application", "1 frame", "Every 1st hit" (was "1 applications", "1 frames", "1th").
  Plural messages also cover counts that do not reach one in use ("1 act", "1 character").
- The Artifact instrument's lists: "CR, CD, and ER", "+0–3, +4–7, or +8–11", and "chance an
  Advanced reshape" (was "a Advanced").
- Screen-reader labels on element icons and the Builder's element filter read "Pyro" where
  they read "pyro".

## Fixed along the way

- **Resonance names:** the bench draft named them from memory (熱誠の炎…), and Altema's
  Hydro name differs, so the draft takes the players' 炎元素共鳴 form, which Game8 confirms.
- **The two-tab storage tests** allow 20 seconds: each simulated tab re-imports the message
  catalog, which pushed the first past 5 seconds under a full run, and the timed-out test
  then broke the next one.
- **`scripts/lib/alias-hook.mjs`** resolves `$lib/paraglide/messages` to the file, not the
  `messages/` directory, so Node scripts that import the parser still run.

## Still English in /ja

- Game data: character, weapon, artifact, and boss names, and the Stygian check texts,
  waiting on genshin-db's lookups. Stellar Glimmer has no Japanese text yet.
- The planner's reaction labels (Melt, the Lunar reactions), ATK%, DEF%, and HP%, and the
  buff-value fragments "/stack", "(cap N)", and "(end)": the extractor does not list them.
- The capability conditions' raw ids ("needs moonsign teammates"), and the weapon type in
  the bench's "no polearm weapons are curated" note. Both need a lookup by id.
- `"{label}: {value}"` aria-labels joined in code keep a Latin colon, and the ICD reading's
  verdict a Latin period.
- The menu's entries for pages not yet translated (What's new, Contribute, Beta, Privacy,
  Coverage), which wait for Help and the pages.

## Verified

- Gates on both round branches: vitest (2,984), check, lint, build.
- English: each surface's ledger before and after, key by key, differs only by placeholder
  renames, plural and select variants, markup, and folded fragments. The text and labels of
  the Planner, Builder, Roster, coverage, and all eight instruments, at 1600 and 390 wide,
  match `main`'s build line for line in headless Chrome (7,414 lines), apart from the Total
  readout's "40.3s", which now arrives as two text pieces and renders the same.
- `/ja`: the same views, with no page errors.
- `npm run test:e2e:chrome`: 73 passed, 1 skipped. Both engines are still to run before a
  merge.

## For Nate's eye

Japanese is shorter than English but set in wider glyphs. Places to look at in `/ja`:

- The Artifact chart's crossing and dot labels, which size themselves by Latin character
  count (`LABEL_CHAR_PX`), and the Crit heatmap's 10px chart words.
- The Builder's swap foot buttons, the constellation lens (能力を読む命ノ星座), and the
  Theater's Blessing Level line.
- The DEF & RES setup chips (自分のレベル, 敵のレベル), the Wish "You have" row (未所持), and
  the bench's compare rail (比較元, もしも).

## Next

Help, then the open questions to the Japanese community with the whole hidden draft. The
English-in-`/ja` items above are small extraction follow-ups.
