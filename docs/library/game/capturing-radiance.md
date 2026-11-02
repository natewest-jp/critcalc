# Capturing Radiance: the counter model

Compiled 2026-11-02 for the Wish Odds rework. Capturing Radiance (since 5.0) is the
mechanism behind the character banner's 55% consolidated featured rate. The official facts
are in `wish-mechanics.md` § Featured-character rules. This file covers what the community
has reverse-engineered on top of them, how strong that evidence is, and what is still open.

⚠️ **Only the official facts are official.** Everything below them is a community model. It
fits every history checked so far, but HoYoverse has not confirmed it.

## 1. Official facts (for reference)

- Radiance applies only to a non-guaranteed 5★ on the Character Event Wish and Wish-2.
  When it triggers, that 5★ is the featured character. It never affects a guarantee.
- Consolidated featured rate, Radiance included: 55%.
- "The base probability of triggering Capturing Radiance is 0.018%" (in the banner details
  since 5.4).
- "If the promotional 5-star character is the second 5-star character you obtain on three
  consecutive occasions, Capturing Radiance is guaranteed to be triggered the next time you
  obtain a 5-star character."
- A triggered Radiance plays its own animation (an extra Intertwined Fate over the gold
  shine), so players can tell a Radiance win from an ordinary one. Wish history does not
  record which kind of win it was.

## 2. The model

Proposed by OneBST (the author of GGanalysis) in December 2024, from about 4 million
post-5.0 character banner pulls (feixiaoqiu.com) plus sequences recorded by hand from
wishing videos. It is implemented in GGanalysis as `CapturingRadianceModel`.

A hidden **counter** with four states, 0 to 3:

| Counter | Next non-guaranteed 5★                  | After a win         | After a loss  |
| ------- | --------------------------------------- | ------------------- | ------------- |
| 0       | ordinary 50/50                          | stays 0             | 1             |
| 1       | ordinary 50/50                          | 0                   | 2             |
| 2       | 50/50 plus a small Radiance chance (§4) | 1 (Radiance or not) | 3             |
| 3       | Radiance, always                        | 1                   | cannot happen |

- **Start:** everyone's counter was set to 1 when 5.0 went live. Accounts created after 5.0
  are presumed to start at 1 too; that is inferred, not checked separately.
- **A Radiance resets the counter to 1, not 0.** So right after a Radiance, two losses in a
  row are enough to reach 3. Three losses in a row are only possible from 0, which takes an
  ordinary win at 1 or 0. The official "three consecutive" wording describes that worst case.
- **Only 50/50s move it.** A guarantee leaves it alone, including a guarantee carried over
  from a pre-5.0 loss. Pre-5.0 results don't count.
- **It is per account, not per banner.** Banner changes don't reset it. Wish and Wish-2
  share it, as they share pity and the guarantee.
- **Other banners:** the Chronicled Wish and the weapon banner are believed not to count. The
  official text names the character banners only, and nobody has tested the others.

The worst case is a repeating loss, loss, Radiance cycle (1 featured in 3 non-guaranteed
5★s).

## 3. Evidence

- **No counterexample.** As of June 2025, everyone known to have reached counter 3 got a
  Radiance next. Several players posted their history in advance, predicted a Radiance and
  then got it. The threads also contain claimed exceptions. Every one whose poster listed
  every 5★ since 5.0 replayed as consistent (typically an earlier win had taken the counter
  to 0); two posters never answered the follow-up questions.
- **The test history used for development** (a Paimon.moe export, 26 character banner 5★s
  from 2025-07 to 2026-09, an account started after 5.0) replays with no contradiction. It
  reached counter 3 four times, each time after exactly two losses in a row from 1, and won
  all four. A flat 55% would give four wins in a row about 9% of the time. The player
  remembers the Radiance animation on three of the four for certain and on the fourth less
  clearly, and not on the two wins at counter 2, where the model makes a Radiance unlikely.
  Recollection, not a recording, but every remembered case matches the model.
- **The 5.0 start at 1** rests on there being no known player who lost their first three
  post-5.0 50/50s in a row. The test history adds a case for accounts made after 5.0: its
  first Radiance came after loss, win, loss, loss. From a start at 1 that is counter 3, a
  certain Radiance. From a start at 0 it would be counter 2, where a Radiance is unlikely.

## 4. Open questions

### 4a. The Radiance chance at counter 2

Unknown. These are the estimates, as Radiance's share of counter-2 50/50s (the featured
chance there is 50% plus half of it):

| Source                                                     | Radiance chance  | Featured chance   |
| ---------------------------------------------------------- | ---------------- | ----------------- |
| OneBST (post edit, Dec 2024)                               | about 4–20%      | 52–60%            |
| The post's co-editor (Dec 2024)                            | 5–20%            | 52.5–60%          |
| Later readings of the Chinese community's data (June 2025) | 2–10%            | 51–55%            |
| Back-solved from a long-run 55%                            | 1/11, about 9.1% | 6/11, about 54.5% |

The raw data: 52.2% featured at counter 2 across all players, and 62.1% among players with
at least 14 featured 5★s since 5.0. OneBST warns that short uploaded histories are strongly
biased (people choose which ones to upload), so neither figure is reliable.

Back-solving from the official 55% is fragile in both directions:

- The long-run rate barely moves with this chance: 0% gives 54.55%, 1/11 gives 55.00%, 20%
  gives 55.56%, and 50% gives 57.14%. A small rounding in the 55% therefore swings the
  answer a lot.
- HoYoverse's published rates have tended to be slightly generous to players (OneBST: the
  standard 5★ consolidated rate is 1.6052% against 1.6%, and the weapon banner's hard pity is
  77 against 80), so 55% may be rounded down.

⛔ The "75%" figure that still circulates is not a counter-2 rate. It came from an earlier
model built on loss streaks. Players with two losses in a row are a mix of counter 2 and
counter 3, and the mix averages near 75%.

**What this means for predictions:** little. Between the estimates, counter 2 is a 51–60%
featured chance, close to an ordinary 50/50. The state that changes a prediction is 3
(100%).

### 4b. The official 0.018%

Unexplained. It appeared in the banner details in 5.4, after the model was proposed, and
suggests a small Radiance chance outside counter 2 and 3. It is 3% of the base 5★ rate
(0.6% per pull), but the official text does not say what it is a probability of. A
commenter close to the original analysis relays at least one claimed Radiance at counter 0
or 1, unconfirmed.

If it is real, a win at counter 0 or 1 might have been a Radiance, which sends the counter
to 1 instead of down. A state read from history then becomes a probability over two
neighbouring states instead of an exact value. The cost is small, because the case is rare.

### 4c. Alternatives not ruled out

A "karma" model (a long-term net of wins and losses) has been floated and is untested; it
needs many long histories from the same players. A model in which every win resets the
counter to 0 fits some histories but not the documented cases of three losses in a row.

## 5. Reading the counter from a wish history

Replay every character banner 5★ since 5.0 (or since the account began, if later), from
counter 1:

- A 5★ that is not the banner's featured character is a loss: the counter goes up by 1, and
  the next 5★ is a guarantee.
- A guarantee leaves the counter alone.
- A featured 5★ that was not guaranteed is a win: the counter goes down by 1 (from 2 or 3,
  it ends at 1 either way).

Under the model with no Radiance chance at 0 or 1, this gives an exact state. The only
ambiguity is §4b's. The replay needs the complete history since 5.0, and a gap cannot be
detected from the file.

A Paimon.moe export ("Wish History Export", version 3; a workbook with one sheet per banner
type, and Type, Name, Time, ⭐, Pity, #Roll, Group, Banner and Part columns) carries
everything the replay needs. The banner is named, and a loss is a standard-pool 5★, so the
replay needs the standard 5★ list with the date each joined the pool. The export does not
record whether a win was a Radiance.

## Sources

- OneBST, "Understanding Genshin Impact's Capturing Radiance: In-Depth Analysis of 4 Million
  Pulls", r/Genshin_Impact, 2024-12-13 (`/comments/1hd1sqa/`), and its comment thread. The
  video version (Chinese, English subtitles): youtube.com/watch?v=nk6Ty6SLLJo, bilibili
  BV13XBiYZErT.
- "Reminder on Updated Capturing Radiance Theory" (`/comments/1le3avp/`) and "Re-design of
  Updated Capturing Radiance Theory Chart" (`/comments/1leo4ph/`), r/Genshin_Impact,
  2025-06-18/19. The flowchart there draws counter 2 as about 10% Radiance, 50% win and 40%
  loss, marked as uncertain.
- GGanalysis `games/genshin_impact/gacha_model.py`: `CapturingRadianceModel`,
  `capturing_radiance_dp`, and `CR_P = [0, 0, 0, 1]`, the cautious default (no Radiance
  below 3).
- Genshin Impact Wiki, `Character_Event_Wish` § Capturing Radiance (official text, via the
  MediaWiki API); HoYoverse news 125274.
