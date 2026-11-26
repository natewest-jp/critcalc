# The Chinese community request (2026-11-26)

The second community request for a locale's review, after Japanese
(`ja-community-outreach-2026-11-25.md`): a Chinese feedback form, where Chinese players gather and
where the site could get an account, NGA's rules, and the drafted post. The term questions are in
`docs/text/terms-zh.md`; the shorthand questions in `zh-shorthand-research-2026-11-26.md` §6.

## 1. The Chinese feedback form

Nate made a Chinese copy of the feedback form, as he did for Japanese: the English form's entry ids
and branching, answers in "Form responses 3" of the check-in Sheet. `/zh`'s links use it
(`src/lib/feedback.ts`). Its contact field asks for a Discord name, QQ number, or email, since
Chinese players use QQ far more than Discord.

⚠️ Google is blocked in mainland China, so mainland players can reach the form only through a VPN.
It serves Simplified Chinese readers elsewhere. For the mainland, replies in the thread are the
feedback channel. critcalc loads nothing from Google itself.

## 2. Where Chinese players gather, and where the site can post

- **NGA (bbs.nga.cn, the 原神 board, fid 650):** the center of Chinese theorycrafting. Nate
  registered an account (`critcalc`) with no trouble. Chosen (⚓ Nate). Rules in §3.
- **HoYoLAB in Simplified Chinese:** the site's account works there, and its API serves `zh-cn`
  posts, but its readers are mostly outside the mainland and its reach is low (the Japanese post
  had 21 views on its first day). A fallback, with the Google form.
- **Bilibili:** where the Chinese guides live. Signup reportedly takes an international number, but
  a new account reaches no one; its use would be comments under guide videos or notes to their
  makers.
- **Chinese Discord servers:** easy to join; the largest found, 星原酒馆, has about 12,300 members
  across several HoYoverse games. Rules unread.
- **Probably closed:** 米游社 (signup reported as +86 only), Tieba (Baidu rejects most foreign
  numbers), Xiaohongshu (foreign-number accounts now go to a separate international site).

## 3. NGA's rules, as they bear on the post

Read: the board's rules (`tid=28339827`, v2.2), its supplementary rules (`tid=31482928`), the
board's permission page, the tools roundup (`tid=30751515`), and two recent tool threads. The
posting guide (`tid=32852620`) needs 999 reputation in a user forum to read; the rules covered it.

- **The account can post:** a thread needs an activated, unbanned account with board reputation of
  at least −500. A new account starts at 0. ⚠️ NGA also holds a new account's first thread for 48 hours
  after registration: Nate's first try, the day he registered, landed on a waiting-period page.
- **Tools are welcome.** The supplementary rules say the moderators support authors of data guides
  and useful tools, and punish baseless attacks on them. Featured posts in blue cover tools.
- **The precedent:** 梅信心 (meropide.cn) posted a rotation-planning web tool in June 2026
  (`tid=47049926`) and its mechanics database in May (`tid=46742837`): a direct link, what it
  solves, its features, feedback by email. A moderator replied with praise, and both were rewarded
  with reputation. Players call such a tool a 排轴工具 and its output a 循环轴, which supports the
  draft's term (open question 1).
- **The section:** 天命既定, for damage calculation, guides, numbers, mechanics, and bugs; the
  tools roundup lives there. Tag: [数据讨论].
- **A wrong section** costs only a lock the first time; penalties start the second.
- **Limits that shape the post:** no strength rankings without data (Article 19, Article 40 item
  23); no damage-number, stat-panel, or artifact screenshots (Article 26); no comparisons with
  other games (Article 22); no QQ or WeChat groups and no commercial links (Article 30); no
  promoting another platform or reposting from one (Article 40 items 13 and 18); no hit-and-run
  posting (Article 18), so replies get answered; replying more than 7 days after a thread's last
  edit is necroposting (Article 27).
- **Tools that touch the game get banned** (a DPS-capture plugin, Article 37), and a tool whose
  numbers mislead gets locked (the 提瓦特小助手 mini-program). The post says critcalc never touches
  the game and invites corrections.
- **New accounts:** Article 7 treats an account that looks like an alt more strictly. The
  precedent's account was four months old with no reputation, so this did not stop it.
- Nothing in the rules mentions machine translation, foreigners, or feedback requests.

## 4. The draft post (proposed, for Nate's ruling)

For 天命既定, tagged [数据讨论]. NGA formats with BBCode; `[collapse]` folds the shorthand
questions. No link but the site's, no Google form, no HoYoLAB.

Screenshots, from `/zh`, attached in NGA's editor where `[图]` stands: the planner with a rotation
converted from Chinese shorthand, the builder's Stygian view, two visualizers (the gauge explorer
and the ICD timeline: no damage numbers, no artifacts), and the planner on a phone.

### Chinese

```
标题：[数据讨论] critcalc.app 中文版试运行：把排轴、配队和机制画出来的免费网页工具（求帮忙看看用词）

大家好，我是 critcalc.app 的作者 Nate。critcalc 是一组在浏览器里运行的免费原神工具。它原本是为英语圈的原神社区做的，现在正在翻译给世界各地的原神社区，继日语之后，现在是中文。

[b]【critcalc 是什么】[/b]
critcalc 把游戏机制画成图，方便阅读和比较。它不给角色排强度，判断留给玩家自己。

[b]排轴工具[/b]：输入循环，生成按帧计时的时间轴。施放与切人、冷却、增益持续时间和敌人的附着元素一目了然。还可以按游戏速度回放，配合音效练习手法。
[图]
[b]配队工具[/b]：根据你拥有的角色和命之座，显示谁能提供治疗、护盾、减抗、增益等，并据此为幽境危战、深境螺旋或自己的阵容配队。
[图]
[b]可视化工具[/b]：8个小图表，分别对应暴击、元素量、ICD、反应倍率、伤害公式、敌人抗性与防御、圣遗物概率和祈愿概率。
[图]

无需注册，数据只保存在你自己的浏览器里，手机浏览器也能用。它只是一个网页，不会接触游戏客户端或账号。帧数以开源战斗模拟器 gcsim 为准，发现不对的地方欢迎指正。
[图]

[b]【关于中文版】[/b]
中文由 AI（Claude）翻译。角色、武器、圣遗物和技能的名称取自游戏内的中文文本。中文版还在试运行，网站上暂时没有入口，请从 critcalc.app/zh 打开。网站服务器不在大陆，访问可能会慢一些。

[b]【中文简写也能用】[/b]
排轴工具读的是英语圈通用的 KQM 记法。中文版加了一个转换：把攻略里常见的中文简写粘贴进去，例如「仆人E、班尼特EQ、希诺宁EAA、茜特菈莉AEQ、仆人Z接输出」，会提示一键转换成 KQM 记法。只写了中文角色名的记法，也会提示替换。
[图]

[b]【想请大家帮忙的】[/b]
主要是用词。游戏内的说法和玩家的说法不一样时，翻译只能选一个。最没把握的是下面这些（前面的是网站现在用的）：

1. 工具名：「排轴工具」「配队工具」，还是「循环规划器」「队伍构建器」？
2. buff：游戏内的「增益」，还是玩家常用的 buff（团队buff、buff覆盖率）？
3. 帧级的精确操作：「帧级精准操作」，还是「极限操作」？
4. 示例队伍的名字：hypercarry 写作「单核」，雷电国家队写作「雷神国家队」。还是用更短的「雷国」？hypercarry 有没有更好的说法？
5. enabler 和 selfish carry：「挂元素角色」和「自给自足型主C」，还是别的说法？
6. 标签里的命之座：写 C0–C6，还是 0命–6命？
7. 蒸发、融化的 forward / reverse：「正向 / 反向」，还是「大 / 小」（大蒸发、小蒸发）？
8. 副词条和主词条：玩家常说的「副词条」「主词条」，还是游戏内的说法？

[collapse=中文简写的转换规则，也想请教几点]
9. 现在的攻略里，「火神」指玛薇卡还是班尼特？「水神」指芙宁娜还是行秋？
10. 还有攻略用大写 E 表示长按吗，还是都写「长E」？
11. 数字写在前面时，是只算后面第一个字母（3AZ：三次普攻加一次重击），还是算整组（9AZJ：九轮 AZJ）？
12. 你希望排轴工具认识哪些外号？「散兵」指流浪者算吗？
13. 「普攻4秒」应该理解为普攻持续4秒吗？
14. 「接输出」理解为「主C站场，时长不定」对吗？还是大家会期望写一个具体时长？
[/collapse]

其他不自然的地方也欢迎指出。请直接在本帖回复，我会在这里回复大家。
谢谢阅读！
```

### English (what the Chinese says)

```
Title: [Data discussion] critcalc.app's Chinese version, in trial: a free web tool that draws
rotations, teams, and mechanics (please help check the wording)

Hello, I'm Nate, who makes critcalc.app. critcalc is a set of free Genshin tools that run in the
browser. It was made for the English-speaking Genshin community and is now being translated for
Genshin communities around the world; after Japanese, now Chinese.

[About critcalc]
critcalc draws the game's mechanics as pictures, so they're easy to read and compare. It doesn't
rank characters; the judgment stays with the player.

Rotation planner: type a rotation and get a frame-timed timeline. Casts and swaps, cooldowns, buff
durations, and the enemy's aura at a glance. You can also play it back at game speed with sound
cues to practice.
Team builder: from the characters and constellations you own, it shows who can heal, shield, shred
RES, buff, and so on, and you build teams from that for Stygian Onslaught, the Spiral Abyss, or
your own lineups.
Visualizers: eight small graphs, for crit, elemental gauge, ICD, reaction scaling, the damage
formula, enemy RES and DEF, artifact odds, and wish odds.

No account needed; your data stays in your own browser, and it works in a phone browser. It's only
a web page and never touches the game client or your account. Frame counts follow the open-source
combat simulator gcsim; corrections are welcome.

[About the Chinese version]
The Chinese was translated by AI (Claude). Character, weapon, artifact, and ability names come from
the game's own Chinese text. The Chinese version is still in trial and nothing on the site links to
it yet; open it at critcalc.app/zh. The site's server is outside the mainland, so it may load a
little slowly.

[Chinese shorthand works too]
The rotation planner reads KQM notation, the English-speaking standard. The Chinese version adds a
conversion: paste the Chinese shorthand common in guides, such as "仆人E、班尼特EQ、希诺宁EAA、
茜特菈莉AEQ、仆人Z接输出", and it offers a one-click conversion to KQM notation. Notation written
with only Chinese character names gets an offer to swap them too.

[What I'd like help with]
Mainly wording. Where the game's words and the players' words differ, the translation had to pick
one. The ones I'm least sure of (the first is what the site uses now):

1–8: the eight open questions in terms-zh.md, in order.
[Folded: "A few questions about the shorthand conversion rules too"]
9–14: the six shorthand questions in zh-shorthand-research §6, in order.

Anything else that reads unnaturally, please point it out too. Please reply right here in the
thread, and I'll answer here.
Thanks for reading!
```

Choices in the draft, each open to Nate's ruling:

- One post, all fourteen questions, the shorthand ones folded. NGA has no first-comment split to
  work around, and a fold keeps the post short.
- "It doesn't rank characters" stands in for the English site's "windows, not totals". The
  visualizers include the damage formula, so "shows no damage" would not be true.
- "The server is outside the mainland" rather than naming Cloudflare or the missing ICP record.
- The sample rotation drops the original guide's `/EE` alternative, so the example stays simple.
- No mention of where the data is mined from: the word 解包 sits near the board's rules on leaks.

## 5. After posting

- Post once the 48-hour wait from 2026-11-26 has passed (2026-11-28 or later).

- Read the thread daily for the first week, and answer every reply (Article 18). The thread
  closes to replies in practice 7 days after its last edit.
- Each answer becomes a term change in `terms-zh.md` or a nickname or rule change in the converter.
- The to-do's Chinese item tracks the thread once it exists.
