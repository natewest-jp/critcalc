# Worksheet — Landing

**Surface:** the landing page — three hero cards, the announcement band under them, and
the two screen-reader landmarks.
**Pass:** 1 (Nate leads) · **Strings:** 11 · **Guide:** `docs/text/style-guide.md` ·
**Glossary:** `docs/text/glossary.md`

⚓ **This is the highest-stakes surface on the site.** It is what a shared link resolves
to, what the OG card advertises, and — per the mobile call — the thing that has to sell
on a phone. There are eleven strings on it. Spend the time here.

---

## 1. The three cards

Each card carries two lines: the **kicker** (the tool's real name, small, gold, above)
and the **name** (the poetic one, below).

| key                      | Where               | Now              | New       |
| ------------------------ | ------------------- | ---------------- | --------- |
| `landing.card.tb.kicker` | Card 1, upper label | Team Builder     |           |
| `landing.card.tb.name`   | Card 1, lower label | Astrolabe        | 🔒 frozen |
| `landing.card.rp.kicker` | Card 2, upper label | Rotation Planner |           |
| `landing.card.rp.name`   | Card 2, lower label | Ephemeris        | 🔒 frozen |
| `landing.card.vz.kicker` | Card 3, upper label | Visualizers      |           |
| `landing.card.vz.name`   | Card 3, lower label | Observatory      | 🔒 frozen |

`src/routes/(scene)/+page.svelte:50–72`

⚠️⚠️ **The kickers translate and the names do not** (⚓ ruled 2026-09-22), so a localized
card carries one translated line over one English one. That is the design, not a gap.
⚠️ **tight — and the kicker is the line that grows.** "ROTATION PLANNER" already runs out
of card below a ~150px plate and is allowed to wrap; it loses its wide tracking below
40rem before it loses anything else. RU/FR/ES add 20–30% on top of that. ⛔ Don't lengthen
a kicker here without checking it at 360px.
⚠️ The kicker is uppercased by CSS, like the BETA tag — same note as `site-chrome.md` §3.

---

## 2. The announcement band

⚓ **This is a TRUST signal, not a news feed.** The first question a Genshin player asks
about any tool is whether it is current, and nothing else on the site answers it. It
renders only while an entry is live; an empty band is better than a stale one.

### `landing.announce.7-1.text` — the headline

**Where:** The gold line in the band under the cards. One line, must not wrap — it is
`white-space: nowrap` and the band is exactly the card group's width.
**Now:** Data current to Genshin Impact 7.1
**New:**
**Notes:** ⚠️ **tight, and hard-capped** — this one genuinely cannot wrap. At the group's
~880px on a 1440 screen there is room, but the band narrows with the cards.
⚠️ The patch number is data, not copy — whatever you write must keep `7.1` substitutable,
or every patch becomes a copy edit. Good: "Data current to Genshin Impact {version}".
`src/lib/landing/announcements.ts:28`

### `landing.announce.7-1.detail` — the fine print under it

**Where:** The quieter second line, same band. Wraps and is balanced.
**Now:** Vesna, Vodyanitsa and Alyosha in the works
**New:**
**Notes:** ⚠️ **"in the works" is doing precise work and reads as vague.** It means a kit
authored but waiting on gcsim frames — so the Team Builder has its capabilities and the
planner times it with generic cast lengths. ⚓ That distinction is the site's honesty
claim in miniature and the current phrasing throws it away. ⏭ The coverage page will read
this list from the index rather than have it hand-written, so the _names_ are temporary —
the **sentence pattern** is what you are choosing here.
⚠️ Character names are 🔒 frozen (genshin-db ships them per locale).
`src/lib/landing/announcements.ts:33`

🗒️ **Not a copy issue, flagging it anyway:** the entry says "current to 7.1" and the
source comment records 7.1 as going live **2026-09-23** — tomorrow. The data landed
ahead of the patch, so this is accurate-in-advance rather than wrong, but it is worth
knowing the band is making a currency claim about a patch that has not dropped.

---

## 3. Landmarks

| key                     | Where                         | Now            | New |
| ----------------------- | ----------------------------- | -------------- | --- |
| `landing.announce.aria` | The band's list landmark      | Announcements  |     |
| `landing.nav.aria`      | The three cards' nav landmark | critcalc tools |     |

`src/routes/(scene)/+page.svelte:128,138`

⚠️ A screen reader reads the card links as **"Team Builder Astrolabe"** — the plain name
is first in the DOM deliberately, so the announced order is right. ⛔ Don't reorder the
label block to fix a visual problem without re-checking that.

---

## 4. 🗒️ The tagline — cut, and staying cut

⚓ A tagline under the cards was cut 2026-09-16 (⚓ Nate: it belongs on the OG card; the
landing does not need it). Recorded here so it is not re-proposed as "the landing has no
sentence on it." ⛔ If a sentence is ever wanted there, it should be a different one.
