# Chinese rotation shorthand: research (2026-11-26)

The research round Nate queued (⚓ 2026-11-26): how Chinese guides write rotations, which parts are
settled, and a converter proposal for Nate to rule on. No code. Branch
`docs/zh-shorthand-research`.

**In short.** Chinese shorthand is close enough to KQM to convert mechanically, with one trap:
**`A` is a normal attack**, where KQM's `A` is an aimed shot (the planner reads it as a charged
attack). `Z` is the charged attack. Names are mostly the game's own, with a handful of nicknames.
`→` and `、` separate turns, but `→` also separates actions inside one turn, so a separator starts
a new segment only when a name follows it. The todo's premise that a capital E means a hold turned
up once, in a 2021 guide; today's guides write the hold as 长E or 长按E.

## 1. Sources

Read through a fetching agent, with strings copied verbatim from the page body. Dates are the
page's own.

- **bilibili wiki (BWIKI)**, the strategy pages of 胡桃, 雷电将军, 阿蕾奇诺, 纳西妲, and 枫原万叶
  (`wiki.biligame.com/ys/<name>/攻略`, updated 2026-04 to 2026-08). The pages run past 130k
  characters, so only their first ~40k were read verbatim; BWIKI strings below come from that part.
- **17173**: 阿蕾奇诺 (2025-11-11, from 米游社), 玛薇卡 and 那维莱特 (2025-01-20), 芙宁娜 V5.4
  (2025-03-15, from 米游社).
- **Gamersky**, mostly reposts from the 米游社 forum: 莱欧斯利 (2023-10-21), 玛薇卡 page 6
  (2025-01-01), 娜维娅 (2024-07-29), 提纳里 (2022-09-11), two 优菈 guides (2021-05), 雷神+九条
  (2021-09-05, from NGA), the all-teams list (2023-12-04).
- **18183**: 八重神子 teams (2024-01-26), team abbreviations (2022-08-01).
- **7723** 那维莱特 teams (2024-12-05), **cg.163.com** Bloom mechanics (2025-09-15).
- **Slang and nickname lists:** ali213 外号大全 (2024-12-17) and 黑话大全 (2024-10-08), TapTap
  黑话总结 (2023-11-21).

**Not reached:** bilibili articles and opus posts (a captcha every time), NGA (not attempted past
its guest wall), a 米游社 frame study of 雷神国家队 (404), and 9game (a script blob). NGA and
bilibili video descriptions are where the theorycrafting community writes, so they are the gap.
A human read, or the community request, closes it.

## 2. Four shapes

1. **The compact chain**, the common form in 2024–25: each turn is a name with its letters run
   together, turns joined by `→`.
   `那维莱特E→芙宁娜EQ→希诺宁EQAA→玛薇卡EQ→那维莱特EQ接4发重击→循环。` (17173, 2025-01)
2. **The list**, turns joined by `、`, often after a team code and a colon.
   `玛夜希班：班尼特E、希诺宁EAA、夜兰QE、班尼特Q、玛薇卡QE接输出` (Gamersky, 2025-01)
   `仆人E、班尼特EQ、希诺宁EAA、茜特菈莉AEQ/EE、仆人Z接输出` (17173, 2025-11)
3. **One character's string**, no names: `EQE+AZ*4+EE` (刻晴, 18183, 2024-01),
   `e Q A e A A A A A E A A A A……` (优菈, 2021).
4. **Numbered prose** (BWIKI): `夜兰 上场，施放元素战技「萦络纵命索」，随后施放元素爆发「渊图玲珑骰」。`
   Skills by their names in 「」, not by letters.

## 3. The conventions

### Names

- **The game's names dominate** in rotation strings: 班尼特, 夜兰, 芙宁娜, 希诺宁, 茜特菈莉,
  那维莱特, 玛薇卡, and 枫原万叶 in full (17173, 2025-03).
- **Nicknames seen inside rotation strings:** 雷神 (雷电将军; 18183, and the todo's example),
  仆人 (阿蕾奇诺; 17173, throughout), 万叶 (枫原万叶; everywhere), 那维 (那维莱特; Gamersky 2025),
  龙王 (那维莱特; 7723, stated), 火神 (玛薇卡; 17173 "火神开E"), 九条 (九条裟罗), 神子 (八重神子).
- **Seen in prose and team names, not yet in a rotation string:** 公子 (达达利亚, stated), 水神
  (芙宁娜 in 7723's context), 草神 (纳西妲), 风神 (温迪), 帝君 and 岩王爷 (钟离), 巴尔 and 影
  (雷电将军), 皇女 (菲谢尔), 心海, 绫人, 阿忍 (久岐忍), 黑芙 (芙宁娜 in Ousia), 雷主 and 草主
  (Travelers). 散兵 (流浪者) is the community's word, but no page read used it.
- **Misspellings** turn up too: 钟璃 for 钟离 and 优拉 for 优菈 (Gamersky, 2021).
- **Nicknames with two owners:** 火神 is 玛薇卡 in 2025 guides and 班尼特 in the 2024 nickname list
  (a meme). 水神 is 芙宁娜 in guides and 行秋 in the list (六星水神). 神里 is 绫华 in the list and
  is also 绫人's family name. 奶奶 is 珐露珊 in the list and someone unnamed in a 2025 guide.
- **Single characters** (那芙万希, 胡夜万班, 玛夜希班) appear only in team codes, never as a turn's
  head. They collide: 玛 is 玛薇卡 and 玛拉妮 (双玛), 雷 is 雷电将军 or the element, and 神 starts
  神里绫华's code and the words 神子, 草神, 水神.

### Attacks

- **`A` is one normal attack**, counted by repetition (`AAA`) or a number in front (`3A`). Either
  case: `aaaz*n` (Gamersky 2023) and `AAAZ*3+AZ` (18183) mean the same. Two guides give legends:
  "a表示普攻，z表示重击" (莱欧斯利, Gamersky 2023) and "a表示普攻，e代表元素战技，q则是元素爆发"
  (cg.163.com 2025).
- ⚠️ **Against KQM, `A` is the one clash.** In KQM `A` is an aimed shot, which the planner reads
  as a charged attack, so a pasted `AAAZ` today draws three charged attacks and an unknown `Z`.
- **`Z` is the charged attack**, also written 重击 (`4发重击`, `3次重击`). A bow's aimed charge is
  蓄力射箭 or 蓄力射击.
- **Letter case and bold can carry a guide's own meaning.** The 莱欧斯利 guide: "大写表示融化，小写
  表示直伤；粗体表示强化重击" (capitals melt, lower case doesn't, bold is an enhanced charged
  attack). Most guides treat case as nothing.

### The skill: tap and hold

- **A bare `E` is a tap** in today's guides. 17173 (2025-03) spells it out: "班尼特E闪Q ... 并点按E
  产球".
- **A hold is written in words:** 长E, 长按E, `钟离长E`, `钟离E（长按）` (17173, 2025-11), `长按E×2`
  (娜维娅, 2024).
- **A tap in words**, when a guide contrasts the two: 短E, 点E, 点按E, 短按E.
- **Case as tap and hold**, the todo's premise, was found once: "e代表点按元素战绩，E代表长按元素战绩"
  (优菈, Gamersky 2021, from 米游社). Its own strings follow it (`e e E Q A e e E A A A A……`).
- **Repeated presses:** `EE`, `EEE`, `2E` (夜兰's two casts, 八重神子's three).

### Dodge, dash, jump, plunge

- **闪** (闪避), and `S` in one BWIKI legend ("S代表闪避", 胡桃): a dodge, which in Genshin is the
  dash, KQM's `D`. **冲刺** is the same action (`冲刺2次`).
- **跳** (跳跃), `J` in BWIKI's `8AAZJ`: KQM's `J`.
- **下落** (下落攻击): KQM's `P`. Usually a word (`仆人Z接下落输出`).

### Separators and joining words

- **Between turns:** `→` (the most common in 2024–25), `、` (common), `-` and `—` (2021–24), `>`
  (2021, an NGA piece), and spaces.
- ⚠️ **`→` also separates actions inside one turn:** `大招→切人操作QE→叠6枚晶片，点按战技→普攻4秒→长按E`
  (娜维娅, Gamersky 2024). So a separator starts a new turn only when a name follows it.
- **`+` joins actions inside one turn** (`雷神Q+AAAZ闪`, `3次重击+Q+E`), and joins members in a team
  list (`那维莱特+芙宁娜+希诺宁+玛薇卡`). A line of names and `+` is a team, not a rotation.
- **Words between actions:** 接 (then), 接输出 / 接站场输出 / 站场输出 (then the carry plays out),
  起手 (opener), 收尾 (finisher), 开 / 放 / 交 before a letter (cast: 开Q, 交Q), 切 / 切回 (swap in),
  上场 (on field), and 循环 at the end (loop back to the start).

### Repeats

- **`*n` and `×n`** after a group: `AAAZ*3`, `AZ*4`, `长按E×2`, and `aaaz*n` with a literal n.
- **A number in front** counts the letter after it (`3A1Z`, `3A闪`, `5az`) or, in BWIKI's 胡桃, the
  whole group (`8AAZJ`, "8轮2次普通攻击+重击+跳"). ⚠️ `3AZ` (three attacks, one charged) and `9AZJ`
  (nine rounds of AZJ) are the same shape. Ranges too: `10~11AAZS`.
- **Words:** 2轮, 4发重击, 3次重击, 四轮4A闪.

### Optional steps and alternatives

- **Brackets around letters are optional,** as in KQM: `希诺宁E(Q)AA`, `那维莱特Z(E)Q(Z)` (17173,
  2025-03).
- **Brackets around words are notes:** `钟离E（长按）` (a hold), `班尼特（宗室）` (an artifact set),
  `(满命或有专武长按)`, `(受攻速影响)`, `（Q收尾）`. Full- and half-width brackets mix, sometimes in
  one pair.
- **Alternatives:** `/` (`EQ/EE`, `AEQ/EE`) and 或 / 或者 (`枫原万叶E或Q`, `AAAZ*3+AZ或者一直AZ`). The
  slash can cover a whole step, not one letter.

### Time

- Rotations rarely carry waits. Seen: `普攻4秒` (attack for four seconds), `等四秒` (wait four
  seconds), seconds in prose (`7秒`). `～` writes a range (`3～5秒`), never a wait.
- **接输出 stands where KQM would put a duration:** the carry stays on field for the rest of the
  rotation.

## 4. Settled, and guide by guide

**Settled** (several sites and years agree): `A` normal attack, `Z` charged attack, `E` and `Q`
with `E` a tap, letters run together after a name, `→` or `、` between turns, 长E and 短E for hold
and tap, 闪 for a dodge, letters in brackets optional, 或 and `/` for alternatives, 接输出.

**Guide by guide:** letter case (hold in one guide, melt in another), bold, what a number in front
covers, the nicknames with two owners, `普攻N秒`, and `-`, `—`, `+` as separators.

## 5. The converter, proposed

### Where it sits

**In the composer, offered on a paste or a load,** the way the Japanese round offers "Use notation
names" (`notation-ja-input-2026-11-25.md` §2). A pure function turns shorthand into notation and
reports what it did, in `$lib/i18n/` beside `notationNames.ts`. When a pasted or loaded text has
Chinese in it and reads as shorthand (a name followed by a run of `AEQZ`, or `→`/`、` between
names), the info toast offers one button that converts the whole document in one undoable edit.
For such text it takes the place of the name swap, since a name swap is one part of the
conversion. It is offered in every locale, as the name suggestions are, because a Chinese player
may well use the English site.

**Rejected:**

- **A lenient parser that reads shorthand directly.** The reason is the one the Japanese round gave
  for full-width input: notation stays plain KQM, so a saved rotation, a `?r=` link, and KQM's
  own readers see one language. Here it is stronger, because `A` would mean two things.
- **A separate import dialog.** A second system beside the composer's paste path.
- **Converting as the player types.** The letters are ASCII, and `A` can't be read before the
  turn is finished.

### What it reads

| Shorthand                                             | Notation                                                      |
| ----------------------------------------------------- | ------------------------------------------------------------- |
| a game name, or a nickname with one owner             | the notation name (`雷神` → `Raiden`)                         |
| a nickname with two owners (火神, 水神, 神里)         | left as written; the name list offers both                    |
| `→` `、` `，` `-` `—` `>` with a name after           | `>`, a new turn                                               |
| the same with no name after, and `+`                  | a space, the same turn                                        |
| `A` or `a` runs, `nA`                                 | `N<count>` (`AAA`, `3A` → `N3`)                               |
| `Z`, `z`, 重击, 蓄力射箭, 蓄力射击                    | `C`                                                           |
| `E`, `e`, 点E, 短E, 点按E, 短按E                      | `E`                                                           |
| 长E, 长按E, `E（长按）`                               | `hE`                                                          |
| `Q`, `q`, 大招, 开Q, 交Q                              | `Q`                                                           |
| 闪, 闪避, `S`, 冲刺                                   | `D`                                                           |
| 跳, 跳跃, `J`                                         | `J`                                                           |
| 下落, 下落攻击                                        | `P`                                                           |
| a group with `*n` or `×n`                             | `[group]xn` (the planner simulates repeat groups)             |
| a number before a doubled letter (`8AAZJ`)            | `[N2CJ]x8`                                                    |
| letters in brackets, `(Q)`                            | `(Q)`, optional                                               |
| words in brackets, `（宗室）`                         | dropped, and counted                                          |
| `X/Y`, X或Y, X或者Y                                   | `X/Y` for one action; for whole steps, the first kept         |
| 接输出, 接站场输出, 站场输出                          | `~?s`, the planner's "duration unset", drawn with its warning |
| 等N秒, 等待N秒                                        | `~Ns`                                                         |
| 循环 at the end, 起手, 收尾, 切, 切回, 上场, 然后, 再 | dropped                                                       |
| anything else                                         | left as written, where the amber squiggle marks it            |

Three real lines, converted by these rules:

- `雷神E→夜兰EQ→班尼特QE→香菱QE→雷神Q+AAAZ闪`
  → `Raiden E > Yelan E Q > Bennett Q E > Xiangling Q E > Raiden Q N3 C D`
- `仆人E、班尼特EQ、希诺宁EAA、茜特菈莉AEQ/EE、仆人Z接输出`
  → `Arlecchino E > Bennett E Q > Xilonen E N2 > Citlali N1 E Q > Arlecchino C ~?s`
- `那维莱特短E→芙宁娜QE→希诺宁E(Q)AA→枫原万叶E或Q→那维莱特Z(E)Q(Z)`
  → `Neuvillette E > Furina Q E > Xilonen E (Q) N2 > Kazuha E/Q > Neuvillette C (E) Q (C)`

### What it flags

- **Whatever it can't read stays in place,** under the existing amber squiggle, so nothing is lost
  quietly. Only notes in brackets are dropped, because their form says they are commentary.
- **The toast says what happened:** how many turns converted, and how many notes and alternatives
  were dropped. One ⌘Z brings the original back.
- **No new surface.** The squiggles and the toast are the composer's own.

### The names

- **The game's names:** add `'zh'` to `SUGGEST_FROM` (`$lib/i18n/notationNames.ts`). Its test
  already checks that no folded name means two characters across the Japanese and Chinese tables.
  Typing 那维莱特 then offers Neuvillette too, as Japanese names do today.
- **Nicknames:** a short hand-written table beside it, each entry with its source, starting with
  the ones found here in rotation strings. A nickname with two owners is listed with both, so it
  is offered and never converted.

### Left for later

- **BWIKI's numbered prose.** Its skill names in 「」 could map to E and Q through the ability-name
  table (`$lib/i18n/abilityNames.ts`), but the prose around them varies too much for a first
  version.
- **Team codes** (那芙万希). Seating a team from a code belongs to the Builder, if anywhere.
- **Japanese guides' own shorthand.** The same machinery with a Japanese vocabulary (長押し, 重撃),
  if Japanese players ask for it.
- **Traditional Chinese** (長按, 閃避), along with the locale itself (⚓ Simplified only).

### Tests

A Vitest file beside the module, whose fixtures are the real lines above with their sources. No
e2e spec.

## 6. Open questions for a Chinese player

These can join the Chinese community request beside `terms-zh.md`'s eight.

1. In a rotation today, does 火神 mean 玛薇卡 or 班尼特, and does 水神 mean 芙宁娜 or 行秋?
2. Does any guide you read still use a capital E for a hold, or is it always 长E?
3. When a number comes first, does it count the first letter (`3AZ`) or the whole group (`9AZJ`)?
4. Which nicknames would you expect a planner to read? Is 散兵 for 流浪者 one of them?
5. `普攻4秒`: should it read as normal attacks for four seconds?
6. `接输出`: is "the carry's field time, length unset" the right reading, or do players expect a
   number?

## 7. For Nate to rule on

1. **Where it sits:** an offer in the composer on paste and load, as the Japanese name swap is.
   Recommended, for the reasons in §5.
2. **The first version's scope:** compact chains, lists, and single-character strings. Prose,
   team codes, Japanese, and Traditional wait.
3. **What happens to the unreadable:** left in place under the squiggle, except bracketed notes,
   which are dropped and counted.
4. **接输出 becomes `~?s`.**
5. **Nicknames with two owners are never converted.**
6. **When to build:** now, from the settled core, with the community's answers becoming table
   changes. The converter serves the English site as well, so it doesn't wait for `/zh` to open.

Copy (the toast's lines and button) is proposed in the build round.
