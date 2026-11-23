# Japanese terms: the list for the reviewer

Claude's proposals for how critcalc writes its terms in Japanese, gathered in one place so
the reviewer can rule on them before the tool interiors (the Rotation Planner, the Team
Builder with Roster, and the Visualizers) are translated. Nothing here is ruled yet. Answer
by number ("12: ok", "31: プレイヤーは○○と言う"); a ruling then moves into
`ledger/terms.json` as the term's Japanese form, and the entry here is marked ruled.

The English terms and their classes come from the termbase (`ledger/terms.json`, ruled in
`glossary.md`). The interiors' strings are listed in `ledger/inventory/` (`planner`, `bench`,
`coverage`, `tb`, `vz`, `vz_*`).

## How the proposals were chosen

`docs/design/i18n-plan.md` §2 says to keep an English community term unless there is a
well-established local one. Japanese players have their own word for most of them, often a
katakana loan (ハイパーキャリー, オーラ), so the default here is the word Japanese players use,
and the English letters stay only where players write them too (ICD, CV, EM, 1U, C6).

Each entry is marked with where its word comes from:

- **game**: the game's own Japanese text, checked in genshin-db's Japanese talent,
  constellation, weapon, and artifact text. Never translated by us.
- **players**: the Japanese community's word, from the Japanese Genshin wiki's glossary
  (wikiwiki.jp `用語集/攻略`) and the large strategy sites (Altema, Game8).
- **ours**: a term critcalc coined. It translates once and is reused everywhere.
- **kept**: written in Latin letters, as Japanese players write it.

"Check" marks a proposal Claude is least sure of, with the reason.

## A. Already on /ja (for reference)

Drafted in the frame, notices, and sections rounds. Listed so the whole vocabulary is on one
sheet; they can be ruled on with the rest.

1. rotation → ローテーション · ours
2. lineup → ラインナップ · ours
3. Roster (the section) → 所持キャラ · ours
4. Owned / Not owned → 所持 / 未所持 · ours
5. wishlist → ほしいものリスト · ours (kept apart from the game's 祈願)
6. Rotation planner, Team builder, Visualizers → ローテーションプランナー, チームビルダー, ビジュアライザー · ours
7. notation, KQM notation → 表記, KQM表記 · ours (the tokens N1, E, Q, C, hE stay as written)
8. Human timing → 人の操作タイミング · ours
9. Padding → 入力間隔 · ours
10. Animations → モーション · ours
11. Swap ping → 交代時のPing · ours
12. coverage strip → カバレッジ帯 · ours
13. Character coverage → キャラクター対応状況 · ours
14. slot → 枠 · ours
15. pin, pinned rotation → ピン留め, ピン留めしたローテーション · ours
16. loadout → 装備 · ours
17. application (one hit's element landing) → 元素付着 · players
18. instrument (a Visualizers graph) → 計器 · ours
19. Party Setup → 編成 · game
20. theorycrafting → セオリークラフト · players (the built-in profile keeps its English name, Theorycraft)

## B. Mechanics shared by the tools

21. ICD → ICD · kept. Explained once as 元素付着のクールタイム; players also write 元素付着CT.
22. gauge (how much of an element is on the enemy) → 元素量 · players (the wiki's article name)
23. gauge units → U after a number, 元素量1U · kept
24. aura (the element sitting on the enemy) → オーラ · players (also 下地). It stays distinct from 元素量 (the amount) and 元素付着 (a hit landing), as the English keeps aura and gauge apart.
25. Target aura → 敵のオーラ · players
26. trigger (the element that reacts with an aura) → トリガー · players
27. decay → 減衰 · players. Check: common in explanations, but not in the wiki's glossary.
28. cooldown → クールタイム · game. CT only in dense labels. Never CD, which means CRIT DMG in English.
29. stacks → 層 · game ("3層まで重ね掛け"). Players also say スタック; the proposal follows the game.
30. on-field / off-field, in prose → フィールド上 / 待機中 · game. The role badges use the players' words (entries 70 and 71).
31. swap (switching characters in combat) → 交代 · players. The game writes キャラを切り替える; the frame already uses 交代. Swapping a character into a slot is a different thing, 入れ替え, as the Builder draft has it.
32. frame (1/60 s) → フレーム · players
33. buff → バフ · players. Team buffs → チームバフ; Always-on buffs → 常時バフ.
34. proc (a weapon or set effect firing) → 発動 · game. Trigger cooldown → 発動クールタイム.
35. Lasts / duration → 継続時間 · game
36. uptime (the share of the rotation a buff covers) → 維持率 · players. Check: understood, but less settled than the others.
37. summon → 召喚物 · players. Check: the game writes the verb 召喚 and names each summon.
38. charges → 使用可能回数 · game
39. a hit crits → 会心が発生する · game. "Average damage per hit" → 1ヒットあたりの平均ダメージ.
40. curated / modeled (critcalc has entered a kit's data) → 対応済み · ours, matching 対応状況. "Not curated yet" → 未対応.
41. measured (from gcsim or by hand) → 計測済み · ours
42. generic timing → 汎用タイミング · ours. stand-in → 代用 · ours.

## C. Rotation Planner

43. timeline → タイムライン · ours
44. the bench (the slot cards beside the timeline) → ベンチ · ours. Check: a reader may prefer キャラ枠, but 枠 already names one slot.
45. Inspector (the details panel) → 詳細 · ours
46. composer (where notation is typed) → 表記エディタ · ours
47. aura lane → オーラレーン · ours. gauge lines → 元素量ライン · ours. reaction spawns (Dendro Cores, Thunderclouds) → 反応生成物 · ours.
48. aura log → オーラログ · ours
49. Timeline layers → 表示レイヤー · ours
50. Laps (the rotation run again after its end) → 周回, with 2周目 for the second lap · ours
51. Playback → 再生; count-in → カウントイン · ours
52. Frame-perfect timing → 最速入力 · ours. Check: literal, but it is the plain way to say no human delay.
53. cast animation → モーション (entry 10); a cast → 発動
54. Ready again → 再使用可能 · ours
55. hold, tap (hE, E) → 長押し, 一回押し · game
56. dash, jump, plunge, aimed shot → ダッシュ, ジャンプ, 落下攻撃, 狙い撃ち · game
57. finisher (of a spinning charged attack) → 最終段 · players. Check.
58. short burst (sQ) → 短縮版の元素爆発 · ours. Check: the kits that have one describe it in their own words.
59. Flat DMG (Normal Flat DMG and the like) → ダメージ加算（固定値） · players. Check: the game words these as ダメージアップ, with the amount based on a stat.
60. DEF Ignore → 防御無視 · players
61. Reaction Bonus → 反応ダメージボーナス · ours. Check: the game writes ○○反応のダメージ+X% case by case.
62. Base DMG Bonus → the game's 基礎ダメージ wording · game
63. Hypercarry (a sample's name) → ハイパーキャリー · players
64. National (Raiden National) → ナショナル, as in 雷電ナショナル · players (Altema). Chinese players say 国家队.
65. Double Hydro (Hu Tao Double Hydro) → ダブル水 · players. Check: Claude could not find it in a glossary.
66. Sac Frags (the weapon, in a sample's name) → 祭礼の断片 · game
67. Nightsoul Burst, NB → 夜魂バースト · game. NB stays only in the timeline's dense labels.

## D. Team Builder and Roster

68. capabilities (who can heal, shield, buff, and at which constellation) → 能力; the team's capabilities → チームの能力 · ours. Check: 役割 would read well but is entry 69.
69. Role → 役割 · players
70. On-Field DPS → メインアタッカー · players. Japanese players name the role, not the field position.
71. Off-Field DPS → サブアタッカー · players
72. Off-field DMG (a capability) → 裏火力 · players. Check: the badge is about damage dealt off-field, which 待機中 says too formally.
73. Support → サポーター · players
74. Survivability → 生存力 · players
75. Healing, Shield → 回復, シールド · game
76. Cleanse (removes auras from the party) → 元素付着解除 · ours. Check: there may be a shorter players' word.
77. Taunt → 挑発 · game
78. Infuse, Infusion → 元素付与 · game
79. RES shred, Shred → 耐性ダウン · players
80. DEF shred → 防御力ダウン · players
81. Grouping (pulls or gathers enemies) → 集敵 · players
82. Energy (gives teammates flat Energy) → 元素エネルギー · game. Battery, if it appears, → バッテリー · players.
83. Interruption RES → 中断耐性 · game
84. coordinated attack → 協同攻撃 · game
85. ATK buff, CRIT buff, DMG% buff, EM buff, HP/DEF buff → 攻撃力バフ, 会心バフ, ダメージバフ, 元素熟知バフ, HP・防御力バフ · players
86. enabler (needs a Bloom enabler) → イネーブラー · players (the wiki keeps the loan). Check: 起点 reads more naturally to some players.
87. selfish carry → セルフィッシュキャリー · players. Check: the wiki has only the loan; 自己完結型アタッカー is clearer.
88. constellations → 命ノ星座 in prose; C0–C6 stay. Players also say 凸 (無凸, 完凸). The proposal keeps C0–C6 as notation, so the reviewer may want 凸 in the lens labels ("Base kits only", "My constellations", "C6").
89. Lock the roster → 所持キャラをロック · ours
90. Compare → 比較 · ours
91. audition (trying a character in a team's slot) → お試し · ours
92. Imaginarium Theater's roles and terms (Opening Character, Alternate Cast, Supporting Cast, Special Guest Stars, Visionary, Fantasia Flowers, Blessing Level, acts, Arcana) → the game's own UI text · game. These are not in genshin-db; the reviewer or an in-game screenshot is the source.
93. Stygian Onslaught's terms (Battlefield, Primary Antagonists, Dire HP, Fearless HP) → the game's own UI text · game, as entry 92.
94. Factions and states (Moonsign, Hexerei, Nightsoul's Blessing, Pneuma alignment) → 月兆, the game's word for Hexerei, 夜魂の加護, and the game's word for Pneuma · game

## E. Visualizers

The instrument names are ours and translate (glossary §1). Proposed:

95. Crit heatmap → 会心ヒートマップ
96. ICD timeline → ICDタイムライン
97. Gauge explorer → 元素量シミュレーター. Check: エクスプローラー is the literal loan, but a reader expects a tool name to say what it does.
98. Reaction curves → 元素反応カーブ
99. Damage breakdown → ダメージ内訳
100.  Enemy RES & DEF → 敵の耐性と防御力
101.  Artifact odds → 聖遺物の確率
102.  Wish odds → 祈願の確率
103.  tile (one place in the workspace) → パネル · ours

Crit heatmap:

104. CV, crit value → CV, 会心値 · players. Check: Japanese players more often rate artifacts by スコア, which also counts ATK%, so CV must not be rendered as スコア.
105. Hits per rotation → ローテーションあたりのヒット数 · ours
106. best split (of a crit budget) → 最適配分 · ours

ICD timeline:

107. hit counter, timer → ヒットカウンター, タイマー · players
108. timer window → 区間 · ours. Check.

Gauge explorer:

109. forward and reverse Vaporize or Melt → フォワード / リバース, with the multiplier: 2倍蒸発, 1.5倍溶解 · players (the wiki's words). Some players say 強蒸発 / 弱蒸発 instead; the reviewer's call.
110. Overvape → オーバーヴェイプ · players
111. aura tax (the ×0.8 on a new aura) → オーラ係数 · ours. Check.
112. Topped up, Refreshed, Too weak (what a re-application does) → 補充, 上書き, 不足 · ours
113. fuel (Burning's hidden gauge) → 燃料 · ours

Reaction curves:

114. Amplifying, Additive, Transformative → 増幅反応, 激化反応, 転化反応 · players. Japanese has no word for "additive"; Spread and Aggravate are the 激化 reactions, so the family takes that name.
115. Lunar reactions → 月反応 · game. Stellar reactions → the game's word · game.
116. Reaction family → 反応の系統 · ours
117. Crystallize shard → 結晶の欠片 · game
118. top contributor (the Lunar damage share) → 最大貢献者 · ours. Check against the game's Lunar text when it is sourced.

Enemy RES & DEF:

119. Immune → 無効 · players
120. diminishing returns → 逓減 · ours

Damage breakdown:

121. bracket (one multiplying term of the damage formula) → 項 · ours. Check: players say ○○枠 (バフ枠), but 枠 is already a slot (entry 14).
122. talent multiplier → 天賦倍率 · players
123. scaling stat → 参照ステータス · players (○○参照)
124. Elevation → the game's word · game. The game writes the verb only; the reviewer may know a players' noun.
125. level base → レベル基礎値 · ours

Artifact odds:

126. substat, main stat → サブOP, メインOP · players. Check: サブステータス is clearer to a casual reader.
127. roll (one upgrade into a substat) → 強化, with 伸び for its size · players
128. upgrade counts → 強化回数 · players
129. useful rolls, valued stats → 有効強化回数, 狙いのステータス · ours
130. reshape, Advanced, Decreed → the game's words · game
131. Sanctifying Elixir, Dust of Enlightenment → 祈聖のエリクシル, 聖啓の塵 · game
132. resin, domain → 天然樹脂, 秘境 · game
133. the unluckiest tenth → 下位10% · ours

Wish odds:

134. pity → 天井 · players
135. soft pity → 確率上昇 · players. Check: 仮天井 means something else (the 90th pull, before the guarantee).
136. the 50/50 → 50/50, and losing it → すり抜け · players
137. guarantee → 確定 · players
138. Capturing Radiance → 掴みし明光 · game
139. featured → ピックアップ · game
140. Fate Points, Epitomized Path → the game's words · game
141. pulls → 祈願回数, and N連 in counts · players
142. Character Event Wish, Weapon Event Wish → the game's banner names · game

## Questions for the reviewer

- 31: 交代 or the game's 切り替え for switching characters?
- 88: should the lens labels speak in 凸 (無凸, 完凸) rather than C0 and C6?
- 109: フォワード/リバース or 強/弱?
- 121: is ○○枠 so settled for damage brackets that 項 would read as wrong, despite 枠 also meaning a slot?
- 92 and 93: the Theater and Stygian names need the game's Japanese UI text, which genshin-db does not carry.
