# The interiors' Japanese terms — 2026-11-23

Round 6 of the translation item in `docs/todo.md`: the Tier C term list for the tool
interiors (the Rotation Planner, the Team Builder with Roster, and the Visualizers), written
for the Japanese reviewer before any of their strings are drafted. One branch,
`docs/i18n-interior-terms`. No code changed.

## What was built

- **`docs/text/terms-ja.md`**, 142 numbered proposals and five questions. Section A gathers
  the terms already drafted on `/ja` by the earlier rounds, so the reviewer has one sheet;
  sections B to E are the interiors' terms, swept from all 1,705 of their strings in the
  ledger inventory (regenerated first; it was current).
- **Where each word comes from** is marked: the game's Japanese text, the Japanese players'
  word, a term of ours, or kept in Latin letters. The game's words were checked against
  genshin-db's Japanese talent, constellation, weapon, and artifact text; the players' words
  against the Japanese Genshin wiki's glossary (wikiwiki.jp `用語集/攻略`) and the large
  strategy sites.
- **The to-do** points at the list, and notes that extracting the interiors' English can run
  during the review.

## The default, and why it differs from the plan

`docs/design/i18n-plan.md` §2 defaults to keeping English community terms. Japanese players
have a settled word for most of them, often a katakana loan (オーラ, ハイパーキャリー,
セルフィッシュキャリー), so the list proposes the players' word, and keeps Latin letters only where
players write them too (ICD, CV, EM, 1U, C6). Claude's proposal; the reviewer rules term by
term.

## Found along the way

- The game writes stacks as 層, off-field as 待機中, tap and hold as 一回押し and 長押し, and
  switching characters as 切り替え. The frame's draft uses the players' 交代 for a swap; that is
  question 31.
- Japanese players rate artifacts by スコア, which also counts ATK%, so crit value (CV) must
  not be rendered as スコア (entry 104).
- 枠 already means a slot, which rules out the players' ○○枠 for a damage bracket unless the
  reviewer judges otherwise (question 121).
- Imaginarium Theater's and Stygian Onslaught's role and difficulty names are game UI text
  that genshin-db does not carry: `// TODO: data gap` when the Builder is extracted.

## Next

Extract the interiors with English unchanged (it needs no rulings), then draft their Japanese
from the ruled list, then Help. Rulings move into `ledger/terms.json` as each term's Japanese
form.
