# The release calendar: when patches and endgame modes go live

What is live in Genshin Impact follows a fixed calendar. These rules come from Nate (2026-11-06). Use them to know what to expect: whether a version is out, when its endgame modes arrive, and when to act on upstream data.

## The rules

1. **A patch goes live on a Wednesday, and one patch cycle is six weeks.** The next patch is 42 days after the last.
2. **Stygian Onslaught goes live on the Wednesday one week after its patch.** Version 7.2 went live on 2026-11-04, so Stygian 7.2 starts on 2026-11-11, and each season runs six weeks to the next one.
3. **The Spiral Abyss resets on the 16th of each month.**
4. **Imaginarium Theater opens on the 1st of each month.** Its rules are in [`imaginarium-theater.md`](imaginarium-theater.md).

## Reading upstream data with it

- **A version is live from its patch Wednesday.** Before that, a character or season for it in lunaris.moe or genshin-db comes from the beta. lunaris tracks beta builds, and genshin-db can carry a version's characters before its patch day.
- **The site shows endgame data only after its date.** A Stygian season appears once `src/lib/data/endgame/season-dates.json` names its version and the date has passed. An Abyss cycle appears from its 16th, and a Theater season from its 1st. That file is hand-maintained on purpose: one line per season or cycle is the guard that keeps beta data off the site. The calendar says when a line is due, and the line itself still waits for the live date (stygian.moe) or the English name (lunaris).
- **Upstream dates can be wrong.** lunaris's beta records carry beta dates (the 7.2.50 Abyss list puts cycles on the 1st and the 17th). Trust the rules here over a beta date.

## Checked by a test

`src/lib/endgame.test.ts` holds the committed dates to rules 2 and 3: every Stygian date is a Wednesday, 42 days after the one before, every Abyss date is the 16th, and every Theater date is the 1st. If the game ever breaks a rule (a delayed patch, say), that test fails at the edit, and this page should then say what changed.

## The anchor

Patch 7.2: Wednesday 2026-11-04. Stygian 7.2: Wednesday 2026-11-11. Count forward and back in steps of 42 days.
