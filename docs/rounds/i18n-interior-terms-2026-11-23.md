# The interiors' Japanese terms — 2026-11-23

Round 6 of the translation item in `docs/todo.md`: the Tier C term list for the tool
interiors (the Rotation Planner, the Team Builder with Roster, and the Visualizers), written
for the Japanese reviewer before any of their strings are drafted. Two branches:
`docs/i18n-interior-terms` (the proposals) and `docs/i18n-interior-terms-calls` (the calls). No code changed.

## What was built

- **`docs/text/terms-ja.md`**, 142 numbered entries. Section A gathers
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

`docs/design/i18n-plan.md` §2 defaulted to keeping English community terms. Japanese players
have a settled word for most of them, often a katakana loan, so Claude proposed the players'
words. ⚓ Nate agreed (2026-11-23): English terms are for the European locales, which are
English-adjacent; CJK locales use the words their players recognize. The plan's §2 and step
5 now say so.

## The review, and the calls

Nate's reviewer is not a Genshin player. She ruled the questions she could: 交代 for a swap
(31), C0–C6 rather than 凸 (88), and 強 / 弱 for forward and reverse reactions (109). ⚓ Nate
then asked for best calls from web sources on everything else, with any real split kept as an
open question for the Japanese Genshin community, the same plan as Chinese.

So the list became the settled vocabulary: every "check" resolved, and 11 open questions at
its end. The lookups settled what the first pass could not:

- **Imaginarium Theater**, from the Japanese wiki: 開幕キャスト, 待機キャスト, サポートキャスト,
  特別招待キャスト, 幻戯の花, 祝福レベル, 幕, アルカナ, and the modes イージー, ノーマル, ハード, マスター
  (Visionary), 月諭.
- **Stygian Onslaught**: Fearless and Dire are difficulties 5 and 6 (エクストラ, アルティメット),
  not HP labels, so the Builder's "Fearless HP" and "Dire HP" are エクストラのHP and アルティメットのHP.
  No Japanese name was found for Battlefield or the Theater's Primary Antagonists heading.
- **The game's text** (genshin-db): Elevation is 向上, Hexerei and Secret Rite are 魔導 and
  魔導秘儀, the Lunar and Stellar families are 月反応 and 星反応, Radiance is 輝映, a Charged
  Attack is 重撃.
- **Artifacts and wishes**: reshape is 再構築 (上級再構築, 絶対再構築), Disturbance Outbreak is
  乱れた地脈, Fate Points and Epitomized Path are 命定値 and 神鋳定軌, Capturing Radiance is
  掴みし明光.

## Found along the way

- The game writes stacks as 層, off-field as 待機中, tap and hold as 一回押し and 長押し, and
  switching characters as 切り替え. The frame's draft uses the players' 交代 for a swap; that is
  question 31.
- Japanese players rate artifacts by スコア, which also counts ATK%, so crit value (CV) must
  not be rendered as スコア (entry 104).
- 枠 already means a slot, which rules out the players' ○○枠 for a damage bracket unless the
  reviewer judges otherwise (question 121).
- Imaginarium Theater's and Stygian Onslaught's names are game UI text that genshin-db does
  not carry, so they come from the Japanese wiki; Stellar Glimmer has no Japanese text yet.

## Next

Extract the interiors with English unchanged, then draft their Japanese from the list, then
Help. The community's answers to the open questions rewrite the list's entries, and the strings
follow.
