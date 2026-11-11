# Imaginarium Theater

**Sources:** the Fandom wiki's [Imaginarium Theater](https://genshin-impact.fandom.com/wiki/Imaginarium_Theater) page (read through its MediaWiki API on 2026-11-11, since the page itself is paywalled to fetchers); lunaris.moe's live build data (`7.2.0`), checked against the wiki field by field; Nate's in-game screenshot of a Lunar Mode Party Setup.
**Game version reflected:** 7.2.
**See also:** [`release-calendar.md`](release-calendar.md) (when a season opens), [`genshin-character-roles.csv`](genshin-character-roles.csv) (the role model, which is the Theater's own).

Imaginarium Theater is a monthly endgame mode. Each season names three elements, and the player brings a cast of characters, not fixed teams. Which characters come in at each act is decided by events and chance, so the cast is the plan. The question a player asks each month is how far up the difficulties their roster reaches.

---

## 1. The season

- **A season opens on the 1st of each month** and runs to the end of it (`release-calendar.md` rule 4). lunaris carries the times as `04:00:00` server time.
- **Three elements.** Only characters of these elements may join, except the four Special Guest Stars (§2).
- **Unlock:** Adventure Rank 35 and the quest "Unbegun, Unending Story". Visionary Mode unlocks after clearing Hard Mode, and Lunar Mode after clearing Visionary Mode.

## 2. The casts

| Cast                    | Who                                                                         | Notes                                                                                                                                                                                                                                                                                                                                |
| ----------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Opening Characters**  | 6 per season, two of each element                                           | The initial Principal Cast. The Theater offers a Trial version of all six, so they never depend on the roster. A player who owns one may use their own. Owning one gives the Fantastical Blessing: +20% Max HP, ATK, and DEF for the season, inside and outside the Theater. An Opening Character can't be a Supporting Cast member. |
| **Alternate Cast**      | The player's own characters of the three elements, plus Special Guest Stars | Can't fight until it joins the Principal Cast, through Battle Events (pick one of two) or Companion Events. The difficulty sets how many the player must bring (§3).                                                                                                                                                                 |
| **Special Guest Stars** | 4 per season, outside the three elements                                    | Join the Alternate Cast without meeting the element rule, but only if the player owns them or invites one as Supporting Cast. Blessing Level buffs on them are doubled (§4).                                                                                                                                                         |
| **Supporting Cast**     | A friend's character                                                        | Each difficulty allows one invite. One invite per friend per season. A character can't be in the player's Alternate Cast and invited from a friend at once. Friends' lists are filtered to the season's rules. A player can offer up to 7 of their own, each usable up to 15 times a season.                                         |
| **Principal Cast**      | Whoever can fight in the current act                                        | Starts as the Opening Characters and grows from the Alternate Cast.                                                                                                                                                                                                                                                                  |

Every stage takes four characters. Each character has 2 Vigor and spends 1 per Battle Event; at 0 it can't fight again that run.

## 3. Difficulty

The game's own requirement lines count the **whole cast, Opening Characters included**. lunaris counts only the **Alternate Cast**. The two agree once the six Opening Characters are added, at every difficulty:

| Mode      | Acts           | Cast to start | Cast maximum | Alternate Cast (lunaris `invitePoolSize`) | Extra slots (lunaris `invitePoolBonus`) | Level | Supporting Cast |
| --------- | -------------- | ------------- | ------------ | ----------------------------------------- | --------------------------------------- | ----- | --------------- |
| Easy      | 3              | 8             | 10           | 2                                         | 2                                       | 60    | 1               |
| Normal    | 6              | 12            | 14           | 6                                         | 2                                       | 60    | 1               |
| Hard      | 8              | 16            | 20           | 10                                        | 4                                       | 70    | 1               |
| Visionary | 10             | 22            | 26           | 16                                        | 4                                       | 70    | 1               |
| Lunar     | 10 + 2 Arcanum | 28            | 32           | 22                                        | 4                                       | 70    | 1               |

- **Cast to start = 6 Opening Characters + the Alternate Cast minimum.** Every character past the minimum, up to the maximum, raises the Blessing Level (§4).
- **The level requirement** applies to every character the player brings. Trials of Opening Characters meet it by definition.
- **Lunar Mode's Arcanum Challenges** are two optional extra fights. They unlock after Acts 3 and 6, can be taken any time before Act 10, and are on par with the final act. lunaris lists them under `hardRooms`, keyed `4` and `7`. Clearing both lets the player draw one Lunar Arcanum after Act 10.
- **The game's recommendations** (not requirements), counting the whole cast:

| Mode      | On-Field | Off-Field |
| --------- | -------- | --------- |
| Easy      | 2+       | 5+        |
| Normal    | 3+       | 8+        |
| Hard      | 4+       | 10+       |
| Visionary | 6+       | 14+       |
| Lunar     | 8+       | 18+       |

The role tags are the game's [Character Role](genshin-character-roles.csv) classification: On-Field or Off-Field, and DPS, Support, or Survivability. The Party Setup screen counts the chosen cast by element and by position, and the filter rail beside it adds the three functions.

## 4. Blessing Level

Each Alternate Cast member past the minimum gives **+2 Blessing Levels**. Obtaining or upgrading a Brilliant Blessing during the run gives +1. Each level gives every character in the performance:

| Attribute         | Per Blessing Level |
| ----------------- | ------------------ |
| Max HP            | +800               |
| ATK               | +50                |
| DEF               | +50                |
| Elemental Mastery | +20                |

The buff on Special Guest Stars is doubled.

**Checked against Nate's screenshot.** A Lunar Mode setup with 23 Alternate Cast members (one past the 22) shows "1/4 extra Alternate Cast members" and "Gain 2 Blessing Level(s): Increases Max HP by 1600, ATK by 100, DEF by 100, and Elemental Mastery by 40", which is 2 × the table above. Its Stats row counts 29 characters (23 + 6 Opening), and its element counts total 28, consistent with one Special Guest Star in the cast.

⚠️ NEEDS-CONFIRM: the same screen gives **30 Fantasia Flowers** for the one extra member. The wiki doesn't say how Flowers scale per extra member, so whether it's 30 each is unconfirmed.

## 5. During the run (reference only)

None of this is modeled; it's here so the words have a home.

- **Fantasia Flowers** are earned in Battle Events and spent on the other events.
- **Events:** Battle (Flowers, then pick one of two Alternate Cast members), Companion (spend Flowers to invite: Random and Select are cheaper with a smaller pool, Invitation costs more with a larger one), Brilliant Blessing (reaction-themed buffs, which replaced Wondrous Boons in 5.0), Mystery Cache (Standard or Rare, sometimes with a drawback), and Lunar Mode's Arcana Challenges.
- **Climactic Showdowns** are the boss acts. A run can rewind to the last one a limited number of times.
- **Stella** come from each act's Star Challenge (a time, a kill count, or protecting a Ley Line Monolith). Since the June 2025 season, every 3 Stella in a run gives an artifact-related reward.

## 6. Reading lunaris

- **Endpoints:** `https://api.lunaris.moe/data/{build}/roleplaylist.json` (every season: dates, element codes, Special Guest Stars) and `.../{build}/{lang}/roleplay/{id}.json` (one season in full).
- ⚠️ **Read the live build's folder (`x.y.0`), never a beta folder.** In a beta folder (`7.2.51` on 2026-11-11), the upcoming seasons are rewritten as one-day test records, so the live month goes missing. `7.2.0` lists October, November, and December 2026 as normal months. December is there before it opens, so the date gate still applies (`release-calendar.md`).
- Season `101` is dated 2099 and is a test record. Skip it.
- **Element codes** (`elementRestrictions`, padded with a trailing `0`), confirmed against the Opening Characters of twelve seasons from 2024-08 to 2026-12:

| Code    | 2    | 3     | 4      | 5       | 6    | 7     | 8   |
| ------- | ---- | ----- | ------ | ------- | ---- | ----- | --- |
| Element | Pyro | Hydro | Dendro | Electro | Cryo | Anemo | Geo |

- ⚠️ **The field names don't match the game's terms:**
  - `avatarConfig.bonusAvatars` = the **Opening Characters** (each `description` is the +20% Fantastical Blessing).
  - `avatarConfig.featuredAvatars` (also on the list) = the **Special Guest Stars**.
- `difficultyConfig."1"`–`"5"` = Easy to Lunar: `invitePoolSize` (the Alternate Cast minimum), `invitePoolBonus` (extra slots), `minAvatarLevel`, `roomCount`, and `rooms` (each act's monster level, plus `bossName`, `bossDescription`, and `monsters` on the boss acts).
- **History in the data:** the 2024-08 season has three difficulties, 2024-12 has four (Visionary arrived in 5.0), and seasons from 2025-12 have five (Lunar).
- No mode names, no Blessing Level figures, and no recommendations. Those come from §3 and §4.

## → Schema mapping

- **Data:** `src/lib/data/endgame/theater.json`, written by `scripts/fetch-endgame.mjs` from the live build, for each season named under `theater` in `season-dates.json`. Per season: `elements`, `opening` and `guests` (our character ids), and `modes`, Easy to Lunar, each with `alternate` (the Alternate Cast minimum), `extra`, `level`, `acts`, its boss acts, and Lunar's `arcana`. A character the corpus doesn't have yet is listed under `characters` with its name and element.
- **Model:** `src/lib/theater.ts`. `eligibleCast` is the roster's Alternate Cast: owned, not marked "can't enter Theater", of the season's elements or a Special Guest Star, and not an Opening Character. `modeVerdicts` turns that count (plus one Supporting Cast invite, if asked) into each mode's open/short, extra members, Blessing Levels, and whole cast. `blessingStats` and `castStats` are §4 and the Party Setup screen's Stats row.
- **One Traveler:** the roster keeps one Traveler per element, but the game has one, so at most one counts.
