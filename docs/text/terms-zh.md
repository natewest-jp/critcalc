# Simplified Chinese terms

How critcalc writes its terms in Simplified Chinese: the vocabulary the `zh` draft is written
from. Entries keep the numbers of `docs/text/terms-ja.md`, so entry 31 is the same concept in
both lists and a reader can answer by number.

**Status.** No reviewer yet. These are Claude's calls from the game's own Chinese text and the
Chinese community's sources. The calls with a real alternative are the open questions at the
end; they go to the Chinese Genshin community along with the hidden `/zh` draft. A community
answer rewrites the entry here, and the strings follow. Simplified only (⚓ Nate 2026-11-25);
Traditional would be its own list, since Taiwan and Hong Kong players differ in words as well
as glyphs.

## How the words were chosen

For CJK locales, critcalc uses the words that locale's players recognize (⚓ Nate,
2026-11-23; the rule is in `docs/design/i18n-plan.md` §2). Chinese is the game's original
language, so the game's text is the source text itself, and the Chinese theorycrafting
community has its own settled vocabulary (乘区, 减抗, 双暴分). Latin letters stay only where
Chinese players write them too (ICD, UP, C in 主C, 1U).

Each entry is marked with where its word comes from:

- **game**: the game's Simplified Chinese text, read from the game's text map
  (`assets-src/textmap/TextMapCHS.json`, matched to the English line by hash) or genshin-db's
  `ChineseSimplified`. Never translated by us.
- **players**: the community's word, from the bilibili wiki (wiki.biligame.com/ys, its
  元素, 元素附着论, and 伤害乘区论 pages) and community guides on bilibili, TapTap, and 17173.
- **players, unsourced**: a word Claude knows the community to use but could not confirm in a
  readable source (the bilibili wiki's 黑话 page refuses automated reads). Each is worth a
  community check, and the ones with a real alternative are open questions.
- **ours**: a term critcalc coined. It translates once and is reused everywhere.
- **kept**: written in Latin letters, as Chinese players write it.

Punctuation: full-width （）：，、 in prose, the game's middle dot · in names (魔导·秘仪), and
no space between Chinese and a Latin token or number (1U水, 第2轮), as the game writes them.

## A. The frame and sections

1. rotation → 循环 · players (the wiki and guides: a team's fixed damage sequence; 轴 is a rotation laid out in time, 长轴 and 短轴)
2. lineup → 阵容 · game (助演阵容) and players
3. Roster (the section) → 我的角色 · ours
4. Owned / Not owned → 已拥有 / 未拥有 · ours
5. wishlist → 心愿单 · ours (kept apart from the game's 祈愿)
6. Rotation planner, Team builder, Visualizers → 排轴工具, 配队工具, 可视化工具 · players' 排轴 and 配队, ours as names (open question 1)
7. notation, KQM notation → 记法, KQM记法 · ours (the tokens N1, E, Q, C, hE stay as written)
8. Human timing → 真人操作时机 · ours
9. Padding → 操作间隔 · ours
10. Animations → 动作 · players (前摇 and 后摇 for its two halves)
11. Swap ping → 切人延迟 · ours, from 31
12. coverage strip → 覆盖条 · ours
13. Character coverage → 角色适配情况 · ours
14. slot → 位置 · ours, as players speak of a C位 and a team's four positions
15. pin, pinned rotation → 固定, 已固定的循环 · ours
16. loadout → 配装 · players, unsourced
17. application (one hit's element landing) → 元素附着 · players (the wiki)
18. instrument (a Visualizers graph) → 图表 · ours
19. Party Setup → 队伍配置 · game
20. theorycrafting → 理论计算 · players, unsourced (the built-in profile keeps its English name, Theorycraft)

## B. Mechanics shared by the tools

21. ICD → ICD · kept. Explained once as 元素附着冷却, the wiki's 附着冷却.
22. gauge → 元素量 · players (the wiki)
23. gauge units → U after a number, 1U · kept. The wiki writes 1单位; guides write 1U.
24. aura (the element sitting on the enemy) → 附着元素 · players (the wiki). Distinct from 元素量 (the amount) and 元素附着 (a hit landing).
25. Target aura → 敌人的附着元素 · players
26. trigger → 触发元素 · players (the wiki)
27. decay → 衰减 · players (the wiki's 自然衰减)
28. cooldown → 冷却时间 · game; 冷却 in dense labels. Not CD in prose.
29. stacks → 层 · game (层数)
30. on-field / off-field → 场上 / 后台 · game. The role badges use the players' words (70 to 72).
31. swap (switching characters in combat) → 切人 · players. Swapping a character into a slot is 替换.
32. frame (1/60 s) → 帧 · players (the wiki)
33. buff → 增益; Team buffs → 团队增益; Always-on buffs → 常驻增益 · game (属性增益) (open question 2)
34. proc → 触发; trigger cooldown → 触发冷却 · game
35. Lasts / duration → 持续时间 · game
36. uptime → 覆盖率 · players, unsourced
37. summon → 召唤物 · players
38. charges → 可用次数 · ours
39. a hit crits → 暴击 · game. "Average damage per hit" → 单次命中平均伤害.
40. curated / modeled → 已适配; not yet → 未适配 · ours
41. measured → 已实测 · ours
42. generic timing → 通用时间; stand-in → 替代 · ours

## C. Rotation Planner

43. timeline → 时间轴 · players
44. the bench → 角色栏 · ours
45. Inspector → 详情 · ours
46. composer → 记法编辑器 · ours
47. aura lane → 附着轨; gauge lines → 元素量曲线; reaction spawns → 反应产物 · ours
48. aura log → 附着记录 · ours
49. Timeline layers → 显示图层 · ours
50. Laps → 轮, with 第2轮 for the second lap · ours
51. Playback → 回放; count-in → 预备倒数 · ours
52. Frame-perfect timing → 帧级精准操作 · ours (open question 3)
53. cast animation → 动作 (10); a cast → 施放 · game
54. Ready again → 冷却完毕 · ours
55. hold, tap (hE, E) → 长按, 点按 · game
56. charged attack, dash, jump, plunge, aimed shot → 重击, 冲刺, 跳跃, 下落攻击, 瞄准射击 · game
57. finisher (of a spinning charged attack) → 终结 · game (重击终结伤害)
58. short burst (sQ) → 短版元素爆发 · ours
59. Flat DMG → 伤害值提升 · game ("造成的伤害值提升")
60. DEF Ignore → 无视防御 · players (the wiki; also 穿防)
61. Reaction Bonus → 反应伤害提升 · game, as kit text writes "反应造成的伤害提升"
62. Base DMG Bonus → 基础伤害提升 · players (the wiki)
63. Hypercarry → 单核 · players, unsourced (open question 4)
64. National (Raiden National) → 国家队, as in 雷神国家队 · players (open question 4)
65. Double Hydro (Hu Tao Double Hydro) → 双水, as in 胡桃双水 · players
66. Sac Frags → 祭礼残章 · game
67. Nightsoul Burst → 夜魂迸发 · game

## D. Team Builder and Roster

68. capabilities → 能力; the team's capabilities → 队伍能力 · ours
69. Role → 定位 · players, unsourced
70. On-Field DPS → 站场输出 · players (站场C)
71. Off-Field DPS → 后台输出 · players (脱手C)
72. Off-field DMG (a capability) → 后台伤害 · players
73. Support → 辅助 · players
74. Survivability → 生存 · players
75. Healing, Shield → 治疗, 护盾 · game
76. Cleanse → 解除附着 · ours
77. Taunt → 挑衅 · game
78. Infuse, Infusion → 附魔 · game (附魔持续时间)
79. RES shred → 减抗 · players (the wiki)
80. DEF shred → 减防 · players (the wiki)
81. Grouping → 聚怪 · players, unsourced
82. Energy → 元素能量 · game. Battery → 充能 · players (充能辅助; the wiki's 充电宝 is slangier)
83. Interruption RES → 抗打断 · game (抗打断能力)
84. coordinated attack → 协同攻击 · game
85. ATK, CRIT, DMG%, EM, HP/DEF buffs → 攻击力增益, 暴击增益, 增伤, 精通增益, 生命值/防御力增益 · players' 增伤, ours for the rest
86. enabler → 挂元素角色, as in 挂草 · players, unsourced (open question 5)
87. selfish carry → 自给自足型主C · players' 主C, ours as a whole (open question 5)
88. constellations → 命之座; one constellation level in prose → N命 (1命, 6命), as players write it; C0–C6 as written in labels and notation · game, players, kept (open question 6)
89. Lock the roster → 锁定角色 · ours
90. Compare → 对比 · ours
91. audition → 试用 · ours
92. Imaginarium Theater (幻想真境剧诗) · game:
    - Opening Characters → 开幕角色; Alternate Cast → 待命角色; Supporting Cast → 助演角色; Special Guest Stars → 特邀角色
    - the modes Easy, Normal, Hard, Visionary, Lunar → 简单, 普通, 困难, 卓越, 月谕
    - act → 幕; Arcana → 圣牌 (the game's 月谕圣牌)
    - Fantasia Flowers → 幻剧之花; Blessing Level → 祝福等级
    - Primary Antagonists → 主要对手 · game, from the text map
93. Stygian Onslaught (幽境危战) · game:
    - Menacing, Fearless, Dire → 险恶, 无畏, 绝境, so Fearless HP and Dire HP → 无畏生命值 and 绝境生命值
    - Battlefield → 战场 · ours, as the text map has no term
    - Disturbance Outbreak → 紊乱爆发期
94. Factions and states · game: Moonsign → 月兆; Ascendant Gleam → 满辉; Hexerei → 魔导; Secret Rite → 魔导·秘仪; Nightsoul's Blessing → 夜魂加持; Pneuma → 芒; Ousia → 荒

## E. Visualizers

The instrument names are ours and translate (glossary §1):

95. Crit heatmap → 暴击热力图
96. ICD timeline → ICD时间轴
97. Gauge explorer → 元素量模拟器
98. Reaction curves → 反应曲线
99. Damage breakdown → 伤害拆解
100.  Enemy RES & DEF → 敌人抗性与防御
101.  Artifact odds → 圣遗物概率
102.  Wish odds → 祈愿概率
103.  tile → 面板 · ours

Crit heatmap:

104. CV, crit value → 双暴分 · players (guides: 暴击率×2+暴击伤害)
105. Hits per rotation → 每轮命中次数 · ours
106. best split → 最优分配 · ours

ICD timeline:

107. hit counter, timer → 计次器, 计时器; reset → 归零 · players (the wiki)
108. timer window → 计时区间 · ours

Gauge explorer:

109. forward and reverse Vaporize or Melt → 正向 / 反向, as in 正向蒸发, 反向融化 · players, unsourced (open question 7)
110. Overvape → 过量蒸发 · ours; no source names it
111. aura tax (the ×0.8 on a new aura) → 附着系数 · ours
112. Topped up, Refreshed, Too weak → 补充, 覆盖, 不足 · ours
113. fuel (Burning's hidden gauge) → 燃料 · ours

Reaction curves:

114. Amplifying, Additive, Transformative → 增幅反应, 激化反应, 剧变反应 · players (the wiki)
115. Lunar reactions → 月曜反应 (月感电, 月绽放, 月结晶); Stellar reactions → 星烁反应 (星超导, 星扩散); Radiance → 辉映; Stellar Glimmer, the state → 辉映·星烁 · game
116. Reaction family → 反应类别 · ours
117. Crystallize shard → 结晶晶片 · ours, unchecked: the text map has no English line to match
118. top contributor → 最大贡献者 · ours

Enemy RES & DEF:

119. Immune → 免疫 · players
120. diminishing returns → 收益递减 · players

Damage breakdown:

121. bracket → 乘区, as in 增伤区, 防御区, 抗性区 · players (the wiki)
122. talent multiplier → 技能倍率 · players (the wiki)
123. scaling stat → 基准属性 · ours
124. Elevation → 擢升 · game
125. level base → 等级基数 · ours

Artifact odds:

126. substat, main stat → 副词条, 主词条 · players (open question 8)
127. roll → 词条, one upgrade's worth; its size → 档位 · players, ours
128. upgrade counts → 强化次数 · players
129. useful rolls, valued stats → 有效词条, 目标属性 · players, ours
130. reshape, Advanced, Decreed → 重塑, 高阶重塑, 谕告重塑 · game
131. Sanctifying Elixir, Dust of Enlightenment → 祝圣之霜, 启圣之尘 · game. Defined substats → 定义副属性 · game (每个套装可定义)
132. resin, domain → 原粹树脂, 秘境 · game
133. the unluckiest tenth → 运气最差的10% · ours

Wish odds:

134. pity → 保底 · players
135. soft pity → 软保底 · players
136. the 50/50 → 小保底, and losing it → 歪 · players
137. guarantee → 大保底 · players
138. Capturing Radiance → 捕获明光 · players, from guides; the text map has no English line to match
139. featured → UP · kept, as the game's 概率UP
140. Fate Points, Epitomized Path → 命定值, 神铸定轨 · game
141. pulls → 抽, as in 90抽 · players
142. Character Event Wish, Weapon Event Wish → 角色活动祈愿, 武器活动祈愿 · game

## F. Added while drafting the interiors

The Japanese draft found these; Chinese settles them up front.

143. Elemental Resonance → 元素共鸣, each by its game name (热诚之火, 愈疗之水, 粉碎之冰, 强能之雷, 迅捷之风, 坚定之岩, 蔓生之草) · game
144. Protective Canopy → 交织之护 · game
145. Refinement → 精炼等级 · game
146. CRIT Rate, CRIT DMG, Healing Bonus, Interruption Resistance, All Elemental RES, Physical RES → 暴击率, 暴击伤害, 治疗加成, 抗打断, 所有元素抗性, 物理抗性 · game
147. the weapon types → 单手剑, 双手剑, 长柄武器, 法器, 弓 · game
148. Polestar Field, Moondrift, Thundercloud, Dendro Core → 极星辉域, 月笼, 雳云, 草原核 · game. Thundercloud has two game names (雳云 and 雷暴云); the draft checks each kit's own text.
149. Starlight Prism → 星辉棱晶 · game
150. Notes, Total, Share, Playback speed → 备注, 合计, 占比, 回放速度 · ours
151. Standing, Alongside, Recorded hits → 存在中, 同时存在, 记录命中数 · ours
152. Original, What-if, Comparing → 原方案, 假设, 对比中 · ours
153. resting → 空闲 · ours, kept apart from 后台
154. Not modeled, Nothing to model → 未纳入, 无需建模 · ours
155. Opponents → 敌人情报 · ours
156. Battlefield N, Chamber N, Floor 12 → 战场N, 第N间, 第12层 · players
157. the swap tiers → 全部保留, 有得有失, 新增, 无损失 · ours
158. the fingerprint → 队伍能力 · ours
159. the buff badges → 攻击+, 精通+, 暴击+, 增伤+, 生命/防御+ · ours
160. Cycle, Stats, Available Characters → 周期, 统计, 可选角色 · ours
161. the artifact slots → 生之花, 死之羽, 时之沙, 空之杯, 理之冠 · game
162. ER and CRIT DMG in dense labels → 充能, 暴伤; EM → 精通 · players
163. DMG Bonus → 伤害加成, and 增伤 in the Stats face · game, players
164. Base DMG Bonus → 基础伤害提升 · players
165. a farmed piece → 刷取 · players
166. Shred (the setup segment) → 减益 · ours
167. Applies, Ignored, blocked → 生效, 无视, 未附着 · ours
168. Example scenarios, Single aura, Even spacing → 示例场景, 单一附着, 等间隔 · ours
169. Radiance counter → 明光计数 · ours, from 138's 明光 (the Japanese draft's mismatch is its open question 16)
170. Paimon.moe's Wish Counter, Settings, Export to Excel → 祈愿计数器, 设置, 导出到Excel · unchecked against Paimon.moe's Chinese page

## G. Help

171. Help's character and ability names in prose → the game's Chinese, from the ability-names table (193) · game. Notation stays as written.
172. caveats → 注意事项 · ours
173. active row → 场上行 · ours, from 30
174. walk-cancel → 走路取消 · players, unsourced
175. time token → 时间标记 · ours
176. the ruler, the baseline, a connector → 刻度, 基准线, 连接线 · ours
177. portrait → 立绘; magnifier → 放大镜; a hollow chip → 空心标签 · ours
178. the Visualizers' Readout → 读数 · ours
179. Starglitter → 星辉 · game
180. "Menacing or lower" → 险恶及以下 · game, with 93's names

## H. The pages

181. What's new's ability names in prose → the game's Chinese (193) · game
182. Witch's Revelation → 魔女的谕示 · game, from the text map
183. Known gaps → 已知未适配项 · ours, from 40
184. tick cadence → 判定间隔 · ours
185. training dummy → 木桩 · players (木桩测试)
186. co-op → 多人游戏 · game
187. Shatter → 碎冰 · game
188. mains ("Calling all mains!") → 本命玩家 · ours, from the players' 本命
189. Dates follow the page's language through `Intl` (11月11日, 2026年11月), so they are not messages.

## I. The game's names

Read from the game's data, never drafted, so they are not messages.

190. Character, weapon, and artifact set names → genshin-db's `ChineseSimplified` (枫原万叶, 流浪乐章, 昔日宗室之仪) · game
191. The Traveler of an element → 旅行者（风） · ours, from genshin-db's names
192. The endgame's bosses, mechanics, checks, and blessings → the game's Chinese text map. lunaris.moe serves these lines in Chinese, so they need no match · game
193. Ability, passive, constellation, summon, and shield names → the game's Chinese, from genshin-db and the text maps (`scripts/generate-ability-names.mjs`) · game

## J. Labels composed from a game name

194. "A1: X", "C2: X" → A1：X, C2：X · ours, the full-width colon
195. "X (E1)", "X (Hold)", "C4 (X)" → X（E1）, X（长按）, C4（X） · ours; two details join with 、
196. "X: Y", a name and its part → X·Y · game, as the game writes such names (协同攻击·雷落)
197. "X 1", a step of a name → X1 · ours
198. X Shield, X Field, X Mark → X护盾, X领域, X印记 · game; X Bubble, X Aura, X Wall, X Strikes, X RES shred → X泡泡, X附着, X之壁, X连击, X减抗 · ours
199. End X, With X, in X → X结束, 有X, X内 · ours
200. Hold Lv.2, Lv 4 → 长按Lv.2, Lv.4 · ours
201. Hold, Press, Tap → 长按, 点按, 短按 · game (55). Short Hold, Holding → 短长按, 长按中 · ours
202. Aimed Shot, Fully-Charged Aimed Shot → 瞄准射击, 满蓄力瞄准射击 · game
203. Normal Attack, Elemental Skill, Elemental Burst, Infusion → 普通攻击, 元素战技, 元素爆发, 附魔 · game
204. The planner's own words in labels → drafted with the labels, from the entries above · ours

## K. Kit notes

Drafted into `src/lib/data/kitNotes/zh.json`. Plain written register, the way the game's own
descriptions read.

205. The Rotation Planner doesn't draw damage amounts → 排轴工具不显示伤害数值 · ours
206. doesn't track energy / Nightsoul points / HP → 不追踪元素能量／夜魂值／生命值 · ours, the game's words
207. doesn't simulate chance → 不模拟概率，因此同一循环对每个人都画出相同的条 · ours
208. pickups, positioning, pulling opponents together, co-op → 拾取, 站位, 聚怪, 多人游戏 · players
209. Listed as always active; in game… → 按常驻生效显示；游戏中… · ours
210. Not modeled: … → 未适配：… · ours, from 40

## L. Added while drafting

Words the draft needed that the sections above did not settle. The game's words come from the
text map.

The frame and sections:

211. profile → 档案; My profile and Theorycraft keep their English names, as built-in names · ours
212. Library → 资料库; Trash → 回收站; Backup → 备份; Export, Import, Restore → 导出, 导入, 还原 · ours
213. What's new, About, Contribute, Beta, Privacy, Help & FAQ → 更新日志, 关于, 参与贡献, 测试版, 隐私, 帮助与常见问题 · ours
214. top bar → 顶栏; Report a problem → 报告问题 · ours
215. Slot N → N号位; the Abyss's halves → 上半, 下半 · players
216. outfits → 装扮; the sounds and note sets of Settings → named for what they evoke (马林巴, 灯笼, 草甸) · ours

The tools:

217. kit → 技能组; Normal, Skill, Burst as short labels → 普攻, 战技, 爆发 · players
218. Theater, short form → 剧诗; the cast → 出演角色 · players, ours
219. Spiral Abyss → 深境螺旋; its blessing → 渊月祝福 · game
220. Stygian's checks → 战场要点 · ours
221. buffering an input → 预输入 · players
222. Cooldown Reduction → 冷却缩短 · ours; the text map has no line for it
223. Laps, as the toggle → 轮次 · ours, from 50
224. bench card → 角色卡 · ours, from 44
225. Fagio overheating → 功率过载, the mode he enters at full 解算功率 · game
226. Won and lost (a 50/50's badges) → 没歪, 歪了; Featured 5★ and 4★ → UP五星, UP四星 · players
227. unactivated (a fourth substat not yet rolled) → 待激活 · game
228. Thundercloud: 雷暴云 in Lunar-Charged prose, as the game's Lunar text has it; 雳云 where a kit's own text uses it · game (148)
229. Elemental Absorption → 元素转化, the word in the Anemo absorption texts · game
230. Twin → 双子 · players

## Open questions for the Chinese community

Each is a real split between words a player might expect. The draft uses the first.

1. (6) The tools' names: 排轴工具 and 配队工具, or 循环规划器 and 队伍构建器?
2. (33) buff: the game's 增益, or the players' Latin buff (团队buff, buff覆盖率)?
3. (52) Frame-perfect timing: 帧级精准操作, or 极限操作?
4. (63, 64) Hypercarry and Raiden National in sample names: 单核 and 雷神国家队, or the players' shorter 雷国, and is there a better word for a hypercarry?
5. (86, 87) enabler and selfish carry: 挂元素角色 and 自给自足型主C, or other words?
6. (88) Constellations in labels: C0–C6, or 0命–6命?
7. (109) Forward and reverse Vaporize and Melt: 正向 / 反向, or 大 / 小 (大蒸发, 小蒸发)?
8. (126) substat and main stat: the players' 副词条 and 主词条, or the game's own words?
