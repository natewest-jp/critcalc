# The Japanese community request (2026-11-25)

The first community request for a locale's review: where Japanese players gather, what was posted, and what to carry over to the Chinese round. The term questions themselves are in `docs/text/terms-ja.md`; the to-do line under "Finishing Japanese" tracks the replies.

## 1. Where Japanese players gather

Claude's research converged with Nate's separate in-app search on HoYoLAB and the Genshin Impact (JPN) Discord.

- **X (#原神)** is where Japanese tool makers and theorycrafters announce work, but a new account with no followers gets almost no reach, link posts are down-ranked, and the tag moves fast. Skipped (⚓ Nate). Its value is when someone else mentions the site.
- **HoYoLAB (Japanese)** is official, allows tool posts, and translates posts itself, so a machine-assisted conversation breaks no rule. Its reach is low: a comparable Japanese tool post had 133 views and no comments in a week. Chosen as the request's home.
- **Genshin Impact (JPN) Discord**, about 36,900 members, built around co-op and chat. Rule 11 bars members who can't communicate in Japanese, machine translation included. See §3.
- **The Japanese wiki** (wikiwiki.jp/genshinwiki), updated daily, with a zawazawa chat board and an external links page listing fan tools. A fallback; read its rules first.
- **gwin7ok's 原神ローテーションプランナー** (GitHub `gwin7ok/Genshin-Rotation-Planner`), a Japanese rotation tool close to the Planner, and **genshin-dictionary** (term data in `genshin-langdata`). Personal notes to both are drafted and held (⚓ Nate).
- Skipped: 5ch (hostile to self-promotion), Game8 and GameWith boards (friend recruiting), Reddit (few Japanese players), Bluesky and Misskey (no Japanese Genshin community found).

## 2. What was posted

HoYoLAB, from the site's own account (`critcalc.app`), not a personal one: https://www.hoyolab.com/article/47560437. Title 【critcalc.app/ja】…, five captioned screenshots from `/ja` (Raiden National in the Planner, the Builder's Stygian view, two Visualizers tiles, the Planner on iPhone, the name suggestion), the landing as thumbnail, under Guides & Analyses with the Party topic. Seven term questions in the post and ten in its first comment; the to-do line maps the post's numbers to `terms-ja.md`'s.

Nate's rulings on the wording: the site was made for the English community and is now being translated for the world's communities (location-agnostic); critcalc is described plainly as showing mechanics visually, with no comparison to other tools; the translation is said to be AI's (Claude), with no mention of the language reviewer; signed "Nate". The URL in the title carries `/ja`, because nothing on the site links to Japanese yet.

## 3. The Discord, asked rather than posted

Rule 11 names machine translation, so instead of posting, Nate asked the staff through the server's inquiry bot (問い合わせ → 質問, a private thread): may a single pointer to the HoYoLAB post go in 考察部屋, with every reply going to HoYoLAB? The message says up front that it was written with AI and that rule 11 is why he asks. Waiting on their answer.

Getting in: the 認証 channel verifies a new member; the "Get Started" checklist doesn't. Allow direct messages from the server, since its bot sends notices that way.

## 4. For the Chinese round

- Check each venue's rules for machine translation before planning a post there.
- HoYoLAB's word filter masks substrings: イネーブラー came back as イネ\*\*\*ー (ブラ). Read a published post back through its API (`bbs-api-os.hoyolab.com/community/post/wapi/getPostFull?post_id=…`) and reword around a masked term.
- Chinese players write rotations in their own shorthand, not KQM with Chinese names (the to-do's Chinese-shorthand item).
- A `?r=` link opens a sample exactly for a phone screenshot; built in Node with `zlib.deflateRawSync` and base64url, as `urlCodec.ts` does.
