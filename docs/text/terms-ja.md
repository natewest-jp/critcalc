# Japanese terms

How critcalc writes its terms in Japanese: the vocabulary the Japanese draft of the tool
interiors (the Rotation Planner, the Team Builder with Roster, and the Visualizers), of
Help, and of the About area's pages is written from. Each entry is numbered so a reader can answer by number.

**Status.** Nate's reviewer ruled entries 31 and 88; the reviewer is not a Genshin
player, so the rest are Claude's calls from the game's text and the Japanese community's own
sources. The calls with a real alternative are the open questions at the end, which go to the
Japanese Genshin community along with the hidden `/ja` draft. A community answer rewrites the
entry here, and the strings follow.

The English terms and their classes come from the termbase (`ledger/terms.json`, ruled in
`glossary.md`). The interiors' strings are listed in `ledger/inventory/` (`planner`, `bench`,
`coverage`, `tb`, `vz`, `vz_*`).

## How the words were chosen

For CJK locales, critcalc uses the words that locale's players recognize (⚓ Nate,
2026-11-23; the rule is in `docs/design/i18n-plan.md` §2). For Japanese that is often a
katakana loan (オーラ, ハイパーキャリー). Latin letters stay only where Japanese players write
them too (ICD, CV, EM, 1U, C0–C6).

Each entry is marked with where its word comes from:

- **game**: the game's own Japanese text, checked in genshin-db's Japanese talent,
  constellation, weapon, and artifact text, or quoted from the game's UI by the Japanese wiki
  and strategy sites. Never translated by us.
- **players**: the Japanese community's word, from the Japanese Genshin wiki's glossary
  (wikiwiki.jp `用語集/攻略`) and the large strategy sites (Altema, Game8, GameWith).
- **ours**: a term critcalc coined. It translates once and is reused everywhere.
- **kept**: written in Latin letters, as Japanese players write it.

## A. Already on /ja

Drafted in the frame, notices, and sections rounds.

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
22. gauge (how much of an element is on the enemy) → 元素量 · players
23. gauge units → U after a number, 元素量1U · kept
24. aura (the element sitting on the enemy) → オーラ · players. It stays distinct from 元素量 (the amount) and 元素付着 (a hit landing), as the English keeps aura and gauge apart.
25. Target aura → 敵のオーラ · players
26. trigger (the element that reacts with an aura) → トリガー · players
27. decay → 減衰 · players
28. cooldown → クールタイム · game. CT only in dense labels, and never CD.
29. stacks → 層 · game ("3層まで重ね掛け")
30. on-field / off-field, in prose → フィールド上 / 待機中 · game. The role badges use the players' words (70 to 72).
31. swap (switching characters in combat) → 交代 · players. ⚓ Ruled by Nate's reviewer. Swapping a character into a slot is a different thing, 入れ替え.
32. frame (1/60 s) → フレーム · players
33. buff → バフ; Team buffs → チームバフ; Always-on buffs → 常時バフ · players
34. proc (a weapon or set effect firing) → 発動; trigger cooldown → 発動クールタイム · game
35. Lasts / duration → 継続時間 · game
36. uptime (the share of the rotation a buff covers) → 維持率 · players
37. summon → 召喚物 · players
38. charges → 使用可能回数 · game
39. a hit crits → 会心が発生する · game. "Average damage per hit" → 1ヒットあたりの平均ダメージ.
40. curated / modeled (critcalc has entered a kit's data) → 対応済み; not yet → 未対応 · ours
41. measured (from gcsim or by hand) → 計測済み · ours
42. generic timing → 汎用タイミング; stand-in → 代用 · ours

## C. Rotation Planner

43. timeline → タイムライン · ours
44. the bench (the slot cards beside the timeline) → ベンチ · ours
45. Inspector (the details panel) → 詳細 · ours
46. composer (where notation is typed) → 表記エディタ · ours
47. aura lane → オーラレーン; gauge lines → 元素量ライン; reaction spawns (Dendro Cores, Thunderclouds) → 反応生成物 · ours
48. aura log → オーラログ · ours
49. Timeline layers → 表示レイヤー · ours
50. Laps (the rotation run again after its end) → 周回, with 2周目 for the second lap · ours
51. Playback → 再生; count-in → カウントイン · ours
52. Frame-perfect timing → 最速入力 · ours (open question 1)
53. cast animation → モーション (10); a cast → 発動
54. Ready again → 再使用可能 · ours
55. hold, tap (hE, E) → 長押し, 一回押し · game
56. charged attack, dash, jump, plunge, aimed shot → 重撃, ダッシュ, ジャンプ, 落下攻撃, 狙い撃ち · game
57. finisher (of a spinning charged attack) → 最終段 · players
58. short burst (sQ) → 短縮版の元素爆発 · ours
59. Flat DMG (Normal Flat DMG and the like) → ダメージ加算（固定値） · players
60. DEF Ignore → 防御無視 · players
61. Reaction Bonus → 反応ダメージボーナス · ours (open question 2). The game writes ○○反応のダメージ+X% case by case.
62. Base DMG Bonus → the game's 基礎ダメージ wording · game
63. Hypercarry (a sample's name) → ハイパーキャリー · players
64. National (Raiden National) → ナショナル, as in 雷電ナショナル · players
65. Double Hydro (Hu Tao Double Hydro) → ダブル水 · players (open question 3)
66. Sac Frags (the weapon, in a sample's name) → 祭礼の断片 · game
67. Nightsoul Burst, NB → 夜魂バースト · game. NB stays only in the timeline's dense labels.

## D. Team Builder and Roster

68. capabilities (who can heal, shield, buff, and at which constellation) → 能力; the team's capabilities → チームの能力 · ours (open question 4)
69. Role → 役割 · players
70. On-Field DPS → メインアタッカー · players. Japanese players name the role rather than the field position.
71. Off-Field DPS → サブアタッカー · players
72. Off-field DMG (a capability) → 裏火力 · players
73. Support → サポーター · players
74. Survivability → 生存力 · players
75. Healing, Shield → 回復, シールド · game
76. Cleanse (removes auras from the party) → 元素付着解除 · ours
77. Taunt → 挑発 · game
78. Infuse, Infusion → 元素付与 · game
79. RES shred, Shred → 耐性ダウン · players
80. DEF shred → 防御力ダウン · players
81. Grouping (pulls or gathers enemies) → 集敵 · players
82. Energy (gives teammates flat Energy) → 元素エネルギー · game. Battery, where it appears, → バッテリー · players.
83. Interruption RES → 中断耐性 · game
84. coordinated attack → 協同攻撃 · game
85. ATK buff, CRIT buff, DMG% buff, EM buff, HP/DEF buff → 攻撃力バフ, 会心バフ, ダメージバフ, 元素熟知バフ, HP・防御力バフ · players
86. enabler (needs a Bloom enabler) → イネーブラー · players (open question 5)
87. selfish carry → セルフィッシュキャリー · players (open question 5)
88. constellations → 命ノ星座 in prose, with C0–C6 as written · game, kept. ⚓ Ruled by Nate's reviewer: C0–C6, not 凸.
89. Lock the roster → 所持キャラをロック · ours
90. Compare → 比較 · ours
91. audition (trying a character in a team's slot) → お試し · ours
92. Imaginarium Theater · game, from the Japanese wiki's 幻想シアター page:
    - Opening Characters → 開幕キャスト
    - Alternate Cast → 待機キャスト
    - Supporting Cast (a friend's character) → サポートキャスト
    - Special Guest Stars → 特別招待キャスト
    - the modes Easy, Normal, Hard, Visionary, Lunar → イージー, ノーマル, ハード, マスター, 月諭 (Visionary is the fourth mode, which Japanese calls マスター)
    - act → 幕 (第3幕); Arcana → アルカナ
    - Fantasia Flowers → 幻戯の花; Blessing Level → 祝福レベル
    - Primary Antagonists (the heading over the boss acts) → 主な敵 · ours, as the wiki names no heading (open question 6)
93. Stygian Onslaught · game, from the Japanese wiki's 幽境の激戦 page:
    - Fearless and Dire are difficulties 5 and 6, エクストラ and アルティメット, so Fearless HP and Dire HP → エクストラのHP and アルティメットのHP
    - Battlefield (one of the season's three fights) → 戦場 · ours, as the wiki names no term (open question 6)
    - Disturbance Outbreak (extra artifact drops) → 乱れた地脈
94. Factions and states · game: Moonsign → 月兆; Ascendant Gleam → 月兆・満照; Hexerei → 魔導; Secret Rite → 魔導秘儀; Nightsoul's Blessing → 夜魂の加護; Pneuma → プネウマ

## E. Visualizers

The instrument names are ours and translate (glossary §1):

95. Crit heatmap → 会心ヒートマップ
96. ICD timeline → ICDタイムライン
97. Gauge explorer → 元素量シミュレーター. エクスプローラー is the literal loan; a tool name that says what it does reads better (open question 7).
98. Reaction curves → 元素反応カーブ
99. Damage breakdown → ダメージ内訳
100.  Enemy RES & DEF → 敵の耐性と防御力
101.  Artifact odds → 聖遺物の確率
102.  Wish odds → 祈願の確率
103.  tile (one place in the workspace) → パネル · ours

Crit heatmap:

104. CV, crit value → CV, 会心値 · players. Not スコア: the players' artifact score also counts ATK%.
105. Hits per rotation → ローテーションあたりのヒット数 · ours
106. best split (of a crit budget) → 最適配分 · ours

ICD timeline:

107. hit counter, timer → ヒットカウンター, タイマー · players
108. timer window → 区間 · ours

Gauge explorer:

109. forward and reverse Vaporize or Melt → フォワード / リバース, as in フォワード蒸発, リバース溶解 · players (the wiki's glossary). ⚓ Nate chose the community's words over the reviewer's 強 / 弱, which stays an open question (8).
110. Overvape → オーバーヴェイプ · players
111. aura tax (the ×0.8 on a new aura) → オーラ係数 · ours
112. Topped up, Refreshed, Too weak (what a re-application does) → 補充, 上書き, 不足 · ours
113. fuel (Burning's hidden gauge) → 燃料 · ours

Reaction curves:

114. Amplifying, Additive, Transformative → 増幅反応, 激化反応, 転化反応 · players. Japanese has no word for "additive"; Spread and Aggravate are the 激化 reactions, so the family takes that name.
115. Lunar reactions → 月反応 (月感電, 月開花, 月結晶); Stellar reactions → 星反応 (星電導, 星拡散); Radiance → 輝映 · game. Stellar Glimmer is not in genshin-db's Japanese text yet: `// TODO: data gap` when it is extracted.
116. Reaction family → 反応の系統 · ours
117. Crystallize shard → 結晶の欠片 · game
118. top contributor (the Lunar damage share) → 最大貢献者 · ours

Enemy RES & DEF:

119. Immune → 無効 · players
120. diminishing returns → 逓減 · ours

Damage breakdown:

121. bracket (one multiplying term of the damage formula) → 乗算枠 · players (open question 9). Players say ○○枠 (バフ枠); the compound keeps it apart from a slot (14), which is 枠 alone.
122. talent multiplier → 天賦倍率 · players
123. scaling stat → 参照ステータス · players
124. Elevation → 向上 · game (the kit text links the word: ダメージが7%向上する)
125. level base → レベル基礎値 · ours

Artifact odds:

126. substat, main stat → サブ効果, メイン効果 · game (the reshape screen's words) (open question 10)
127. roll (one upgrade into a substat) → 強化, with 伸び for its size · players
128. upgrade counts → 強化回数 · players
129. useful rolls, valued stats → 有効強化回数, 狙いのステータス · ours
130. reshape, Advanced, Decreed → 再構築, 上級再構築, 絶対再構築 · game
131. Sanctifying Elixir, Dust of Enlightenment → 祈聖のエリクシル, 聖啓の塵 · game. Defined substats → 指定ステータス · game.
132. resin, domain → 天然樹脂, 秘境 · game
133. the unluckiest tenth → 下位10% · ours

Wish odds:

134. pity → 天井 · players
135. soft pity → ソフト天井 · players (open question 11)
136. the 50/50 → 50/50, and losing it → すり抜け · players
137. guarantee → 確定 · players
138. Capturing Radiance → 掴みし明光 · game
139. featured → ピックアップ · game
140. Fate Points, Epitomized Path → 命定値, 神鋳定軌 · game
141. pulls → 祈願回数, and N連 in counts · players
142. Character Event Wish, Weapon Event Wish → イベント祈願・キャラクター, イベント祈願・武器 · game

## F. Added while drafting the interiors

Words the interiors needed that the sections above did not settle. The game's words come from
genshin-db's Japanese text unless marked otherwise.

Shared and the Planner:

143. Elemental Resonance → 元素共鳴, and each one by its element: 炎元素共鳴 to 岩元素共鳴 · players (Game8; genshin-db does not carry resonances)
144. Protective Canopy → 元素共鳴（異なる4種） · ours (open question 12)
145. Refinement → 精錬ランク · game
146. CRIT Rate, CRIT DMG, Healing Bonus, Interruption Resistance, All Elemental RES, Physical RES → 会心率, 会心ダメージ, 与える治療効果, 中断耐性, 全元素耐性, 物理耐性 · game
147. the weapon types → 片手剣, 両手剣, 長柄武器, 法器, 弓 · game
148. Polestar Field, Moondrift, Thundercloud, Dendro Core → 極星フィールド, 月籠, 雷雲, 草原核 · game
149. Starlight Prism → スターライトプリズム · ours, until genshin-db carries it. Stellar Glimmer stays English for the same reason.
150. Notes, Total, Share, Playback speed → 注記, 合計, 共有, 再生速度 · ours
151. Standing, Alongside, Recorded hits → 存在中, 同時存在, 記録されたヒット数 · ours
152. Original, What-if, Comparing → 比較元, もしも, 比較中 · ours
153. resting (a slot with nothing to do) → 出番なし · ours, kept apart from 待機中 (off-field)
154. Not modeled, Nothing to model → 対象外, 該当なし · ours

The Team Builder and Roster:

155. Opponents → 敵情報 · ours
156. Battlefield N, Chamber N, Floor 12 → 戦場N, 第N間, 第12層 · players
157. the swap tiers → すべて維持, トレードオフ, 追加, 失うものなし · ours
158. the fingerprint → チームの能力 · ours
159. the buff badges → 攻撃力+, 熟知+, 会心+, ダメージ+, HP・防御力+ · ours
160. Cycle, Stats, Available Characters → 期間, 統計, 選択可能なキャラクター · ours

The Visualizers:

161. the artifact slots → 生の花, 死の羽, 時の砂, 空の杯, 理の冠 · game
162. ER and CRIT DMG in dense labels → 元チャ, 会心ダメ · players (open question 13). EM stays EM.
163. DMG Bonus → ダメージバフ, and ダメバフ in the Stats face · players
164. Base DMG Bonus → 基礎ダメージアップ · game
165. a farmed piece → 厳選 · players
166. Shred (the setup segment) → デバフ · players
167. Applies, Ignored, blocked → 有効, 無視, 付着なし · ours
168. Example scenarios, Single aura, Even spacing → シナリオ例, 単一オーラ, 等間隔 · ours
169. Radiance counter → 輝映カウンター · ours, from the game's 輝映
170. Paimon.moe's Wish Counter, Settings, Export to Excel → 祈願カウンター, 設定, Excelにエクスポート · unchecked against Paimon.moe's Japanese page

## G. Added while drafting Help

Help's prose needed these. The game's words come from genshin-db's Japanese talent text.

171. Help's character and ability names in prose → the game's Japanese: 夢見月瑞希の夢浮かみ (Dreamdrifter), スピリット・レインズ (Spirit Reins, Shadow Hunt), ファジオ and 演算負荷 (Fagio, Decoding Power; overheating is 高負荷), 冥蝶の舞 (Paramita Papilio), 大掃除 (Sweeping Time), オズ (Oz), 飛星 (Shooting Stars) · game. Notation stays as written (`Mizuki E ~2s`), and the composer's names are the English game's display names, which the draft says.
172. caveats (the inspector's notes on a kit) → 注意点 · ours
173. active row (the on-field row) → フィールド上の行 · ours, from 30
174. walk-cancel → 歩きキャンセル · players
175. time token → 時間トークン · ours
176. the ruler, the baseline, a connector → 目盛り, 基準線, 接続線 · ours
177. portrait → 立ち絵, as the interiors have it; magnifier → 虫眼鏡; a hollow chip → 中抜き · ours
178. the Visualizers' Readout → 読み取り表示 · ours
179. Starglitter → 星輝 · game
180. "Menacing or lower" (Stygian's fourth difficulty and below) → エクストラより下の難易度 · ours, naming the difficulty above it, since the draft has no checked name for the fourth (open question 14)

## H. Added while drafting the pages

About, What's new, Contribute, Beta, and Privacy needed these. The game's words come from
genshin-db's Japanese talent text unless marked otherwise.

181. What's new's ability names in prose → the game's Japanese: 衡平な裁量 (Equitable Judgment, as 重撃·衡平な裁量), 変転・漆黒の否 (Denial of Darkness), 白焔の龍 and 黒蝕の龍 (Durin's White and Dark forms), 鳳跡随翦舞 and 翦月輪 (Swallow-Wisp Pinion Dance, Feathermoon Rings), 化海月 and 葛籠の中の玉櫛 (Bake-Kurage, Tamakushi Casket), 聖祝の導き (Guidance of Theosis), フリーズキャッツクロー (Icy Paws), 琢光鏡 and 光幕攻撃 (Chisel-Light Mirror, Projection Attack), 夜魂値 (Nightsoul points), 万象、灰に帰す (All Is Ash) · game
182. Witch's Revelation (the Hexerei talents unlocked by a quest) → 魔女の啓示 · ours, unchecked: genshin-db does not carry these talents yet (open question 15)
183. Known gaps → 既知の未対応事項 · ours, from 40
184. tick cadence → 判定間隔, from the interiors' 1回の判定 · ours
185. training dummy → 木人 · players
186. co-op → マルチプレイ · game
187. Shatter → 氷砕き · game, as Help has it
188. mains ("Calling all mains!") → キャラ愛好家 · ours. Japanese has no loan for a "main" as a player devoted to one character.
189. Dates follow the page's language through `Intl` (11月11日, 2026年11月, 2026年10月26日), so they are not messages.

## Open questions for the Japanese community

Each is a real split between two words a player might expect. The draft uses the first.

1. (52) Frame-perfect timing: 最速入力, or フレーム単位の正確な入力?
2. (61) Reaction Bonus: 反応ダメージボーナス, or a players' word for the formula's reaction bonus?
3. (65) Double Hydro, in team names: ダブル水, or 水2?
4. (68) A character's capabilities (heal, shield, buff): 能力, or 役割 (which the draft gives to Role)?
5. (86, 87) enabler and selfish carry: the loans イネーブラー and セルフィッシュキャリー, or 起点 and 自己完結型アタッカー?
6. (92, 93) The Theater's Primary Antagonists heading and Stygian's Battlefield: does the game name them? The draft has 主な敵 and 戦場.
7. (97) Gauge explorer: 元素量シミュレーター, or 元素量エクスプローラー?
8. (109) Forward and reverse Vaporize and Melt: フォワード / リバース, or 強 / 弱?
9. (121) A damage-formula bracket: 乗算枠, or 項?
10. (126) substat: the game's サブ効果, or the players' サブOP?
11. (135) soft pity: ソフト天井, or 確率上昇?
12. (144) The four-element resonance: does the game name it in Japanese? The draft has 元素共鳴（異なる4種）.
13. (162) Dense stat labels: 元チャ and 会心ダメ, or the Latin ER and CD?
14. (180) Stygian Onslaught's fourth difficulty, Menacing: what does the game call it? The draft writes around it as エクストラより下の難易度.
15. (182) Witch's Revelation: what does the game call these talents in Japanese? The draft has 魔女の啓示.
16. (138, 169) The wish counter: the draft writes it 輝映カウンター, after the Stellar reactions' 輝映, while the mechanic it counts is 掴みし明光. Should the counter be 明光カウンター?
