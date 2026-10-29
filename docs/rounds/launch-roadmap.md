# critcalc launch roadmap

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

# 🚀 LAUNCH IS A JUDGMENT CALL — ⛔ NO DATE, AND NO FALLBACK DATE

⚓ **Nate, 2026-08-31 — the current framing. It supersedes BOTH the 08-16 hard date and the "softened" framing that followed it.**

> _"The launch is simply to be when we both feel the site is looking and feeling polished enough."_

⚠️ **This is the third and final revision of the launch trigger, and the change is a change of KIND, not of date.** The trigger is no longer temporal at all — it is a shared verdict on the site's state. Read it as three things:

1. ⛔ **There is no deadline and no fallback deadline.** The 08-16 date is retired, and so is the rule that used to sit here — _"if a week passes with no flip, the date should come back."_ ⛔ **Do not reinstate either, and do not invent a new one from elapsed time.** Time passing is not evidence about polish; a stretch of quiet is never a signal to ship or to escalate.
2. ⚓ **The flip needs BOTH of us to feel it.** "We both" is the operative word — ⛔ Claude does not declare the site launch-ready, and ⛔ neither does a green checklist. The checklist below says what is _un-rushable_; it does not say when polish is _enough_. That verdict is Nate's to share, and the useful thing Claude can do is keep raising the floor and say plainly what still looks unfinished.
3. ✅ **User feedback remains the right refinement input.** The launch-to-get-users argument was never wrong. It is _deferred_ by a few days, not overturned, and the feedback channel (§6) is still load-bearing rather than nice-to-have.
4. ⚓ **Some work is genuinely better BEFORE launch, and rushing it is the actual risk.** Launch text, the landing design, the OG card — first impressions are the one thing a later fix cannot recover.

**What flipped the call:** 2026-08-15 spent an entire day on parser/data correctness and produced **nine bugs of one class** — data authored correctly and read by nothing (see §16). That is not a reason to panic; those bugs were found by _building_, not by _using_, and users would not have surfaced most of them. But it did establish that the yield on deliberate auditing is high right now, which makes "a few more days of it" a better trade than it was on 08-14.

⚓ **The launch decision itself was reasoned through on 08-15 and the verdict is unchanged: LAUNCH, and take bug reports.** The two classes of defect are near-disjoint — auditing finds unwired data and model gaps; users find confusion, broken workflows and the characters they actually play. Holding does not automatically buy more of the first (only _auditing_ does, which can happen either side of the flip) and buys none of the second. The asymmetry is also favourable: the constitution is "visualise mechanics, never calculate verdicts," so a wrong bar is embarrassing, not harmful, and the one genuinely dangerous class (the remote tab-kill through `?r=`) is closed. ⚠️ **The nuance that earns the extra days:** the audience skews KQM-literate, so they _will_ notice a missing Bennett buff — which cuts both ways, because they will also report it precisely.

`critcalc.app` has been **live-but-noindexed** since 2026-07-21. The flip is:

1. Delete **ONLY** the `X-Robots-Tag: noindex` rule from `static/_headers` — ⛔ **NOT the file** (it holds the permanent `Cache-Control: immutable` rules the portrait perf work depends on)
2. Redeploy
3. ⚠️ **`curl -I` the live URL and confirm the header is actually gone.** A `noindex` you believe you removed but didn't costs weeks of invisibility, silently
4. Announce

---

## ✅ LANDED + MERGED + PUSHED 2026-08-14 — `6f4b71f` (`--no-ff`, branch deleted)

`015f610` (the cap + the codec promise) · `cbedff0` (the error page + render boundary) · `a9f22d0` (SEO/social meta) · `37c01f4` + `16280f9` (**item 9 CLOSED**).
Closes checklist items **1**, **2** (all but Nate's image), **3**, **4**, **9 (fully)**, and the sitemap half of **10**.

### ✅ Item 9 CLOSED (`37c01f4`) — measured before → after

| Guard                     | Before                    | After                           |
| ------------------------- | ------------------------- | ------------------------------- |
| `MAX_EXPANDED_TOKENS` 20k | 1.78M events / ~1 GB      | 180k events / **139 ms**        |
| `MAX_TIME_ADVANCE_S` 3600 | `~99999999s` accepted     | clamped to 3,600 s              |
| `MAX_RULER_TICKS` 10k     | ~1e8 ticks (OOM)          | 10,000 ticks                    |
| tokenizer regex           | 80k digits = **9,439 ms** | **0 ms**                        |
| both `push(...spread)`    | RangeError past ~125k     | loops                           |
| _realistic rotation_      | —                         | 280 events, **9 ms**, 0 unknown |

⚓ **`MAX_TIME_ADVANCE_S` and `MAX_RULER_TICKS` are INDEPENDENT and both are needed** — the per-token clamp cannot bound a document full of small waits, which _sum_. ⛔ Don't delete one as redundant.
⚠️ **Chose 20k over a first cut of 50k after measuring** (50k gave 450k events / 222 ms). Heaviest plausible bracket expands to ~5k.
⚠️⚠️ **Correction to the sweep's §4:** the regex fix is behaviour-preserving, but **not for the reason the report gave**. Those three are only the **SCANNING** patterns; kinds are assigned by a separate `/^~[\d.]+s$/` — one quantifier over a character class, which never backtracked. `~12.s` and `~12.5.7s` still classify as `time` (verified across six forms). ⛔ **Do NOT "align" the permissive classifier with the strict scanner as a tidy-up** — that would be a real behaviour change wearing a consistency fix's costume. _(I nearly shipped a comment asserting a change that testing showed doesn't exist — measure, don't reason, about regex equivalence.)_
⏭ Still open, all non-blocking: bound the `[^)]*` scans · memoize `inferredStates` (real O(casts²), but the caps bound its input) · debounce the editor parse. Gates green on all three (vitest 1389/1389 · check 0-0 · lint · build). ⚠️ **e2e NOT run** — pre-merge gate; last green was `4ca5356`. Run before merging.

### Meta/SEO (`a9f22d0`) — ⚓ CENTRALIZED, and the reason is a hazard not a preference

⚠️⚠️ **`<svelte:head>` DOES NOT DEDUPE.** A default in the layout plus a per-page override emits **two `<title>` tags and two of every `og:` tag**, and which wins is up to each scraper. Invisible locally, invisible in tests, only visible when you paste a link somewhere public. ⛔ **Never add a per-page `<svelte:head>` title again** — give the route an entry in `$lib/seo.ts` instead.

- **`src/lib/seo.ts`** = the whole site's meta copy in one map, keyed by path. **`SeoHead.svelte`** renders it ONCE from the root layout. The eleven per-page head blocks were deleted.
- ⚓ **Also the i18n staging ground** — every title and description already sits in one route-grouped file, so the wording pass and the extraction pass both get it free.
- Centralizing surfaced hidden drift: pages used `·` while the three **tool** titles used `|`, and those three — the most shareable routes — **had no description at all**.
- ⚠️ **`OG_IMAGE` is versioned (`-v1`) on purpose**: `/assets/*` is immutable-for-a-year and add-only, AND platforms cache `og:image` by URL with no refresh mechanism. A redraw ships as `-v2`; both caches then see a new resource. ⛔ Never overwrite in place.
- ⚠️ Absolute URLs throughout — relative `og:url`/`og:image` are silently dropped by most scrapers.
- **Verified against the PRERENDERED build** (what scrapers read, since they don't run JS): exactly one `<title>` + one `og:title` on all 12 pages, canonicals absolute and correct.
- ℹ️ `build/faq.html` legitimately has neither — it is the pre-Help-area **redirect stub** (`/faq` → `/help`). Stays out of the sitemap; redirects don't belong there.
- ⏭ **New copy flagged for the wording pass:** the landing description + the three tool descriptions.
- ✅ **The OG image shipped** — ↻ 2026-10-16 `critcalc-og-v2.jpg` (`cfe98ff1`, pushed): the mark + "critcalc.app / tools for Genshin Impact" on the night sky, NO screenshots (⚓ Nate: they go stale and turn to mush at ~400px). The lockup fits the centre 630² square crop — keep it there. Same day the home-screen icons became the plain mark on the favicon plate at 92% width (`0e31688d`, `build-app-icons.mjs`, tune(nate)). The spec below is history.

### 🎨 OG image spec (for Nate)

**1200 × 630**, opaque, **PNG or JPEG — ⛔ not WebP** (several scrapers refuse it) and ⛔ **no alpha** (clients composite it on white or black inconsistently). Keep under ~500 KB; some scrapers time out.

⚠️⚠️ **The binding constraint is that it is usually displayed at ~400px wide**, a third of its native size. So: **nothing essential below ~32px at 1200 wide**, headline **60–80px**, and few words — a card is read in half a second. This is the single most common OG mistake.
⚠️ **Survive a centre-square crop** — Twitter's small `summary` card crops 630×630 from the middle, so identity must live near the centre, not in a corner. Keep everything ≥60px from every edge.

⚓ **Recommended concept: the timeline on the night ground.** Night background (the real scene gradient + stars) · wordmark + one line on the left · a slice of the **Gantt timeline** bleeding off the right ~55%. Rationale: the timeline is the most distinctive artifact the site produces — nothing else in Genshin tooling looks like it — and chunky coloured bars are the one element that stays legible at 400px. ⛔ A logo on a gradient would be indistinguishable from every other tool site.
Structure it so the right-hand artifact can be swapped later for per-tool cards (roster for TB, an instrument for Viz). **One great card beats four rushed ones** — most launch shares will be the bare domain anyway.

### The error surfaces (`cbedff0`) — ⚓ TWO of them, and they catch DIFFERENT things

⚠️ **Conflating these is how you end up believing you are covered when you are not.**

- **`src/routes/+error.svelte`** — SvelteKit's territory: routing + load failures, chiefly 404. ⚓ **Renders OUTSIDE the scene deliberately**: an unmatched URL resolves against no route, so no group layout applies and there is no GL canvas — and an error page should not boot WebGL to say a link was mistyped. `body` already paints `--bg`, so it paints no background; root roles only, no context claim, matching `/styleguide` (the only other off-scene route). Copy names the **truncated-link** case (predicted top cause) and offers the three tools.
- **`<svelte:boundary>` in `(tools)/+layout.svelte`** — a throw during component **RENDER**, which `+error.svelte` does **not** catch and which blanked the whole document. ⚓ **Scoped to `.tool-page` on purpose** — chrome, scene and bench band survive, so the reader can navigate away; a boundary any higher takes those down too, which was most of what made the blank page bad.

⚠️ **`adapter-static`'s `fallback: '404.html'` is an UNHYDRATED SPA SHELL** — it must serve any unmatched path, so the error page renders **client-side** after a brief blank moment. Verified it does render; the blank moment is inherent to the fallback, not a defect to hunt.

🐛 **Probe lesson:** an **init-time** throw fails _prerender_ (build error), so it can never ship — the obvious way to test a render boundary is the wrong shape. Gate the throw behind a runtime condition (a query param) instead.

**Both verified in headless Chrome against the production build**, not assumed: 404 path → HTTP 404, correct title, our copy, 3 tool links, zero page errors; gated render throw → notice appears, chrome + canvas survive. Probe reverted same turn.

- **Notation length cap** — `MAX_NOTATION_CHARS = 16_384` in `tokenizer.ts` (one home, so the share-link decoder and the editor cannot drift). Enforced in `decodeRotation` and via CodeMirror `EditorState.changeFilter`. ⚓ **Both REJECT rather than truncate** — a shortened rotation is a _different_ rotation applied silently; null surfaces through the existing "Invalid share link" notice. ⛔ Considered and rejected: capping the URL instead of the decoded string (compression ratio is attacker-controlled, so it bounds nothing).
- **Decoder retention rule** written into `rotationUrl.ts` **and** `instrumentUrl.ts`.
- **`static/_headers`** — HTML shell `max-age=0, must-revalidate` (`/` and `/*.html`), `nosniff`, `Referrer-Policy`.
- **`static/sitemap.xml`** (hand-maintained, 12 routes; ⛔ excludes `/styleguide` + `/lab`) + `Sitemap:` line in `robots.txt`. ⚠️ **A new route must be added by hand.**
- **`docs/rounds/parser-hardening-2026-08-14.md`** — the sweep persisted out of a temp dir that could be swept. ⚓ **Its CLEAN list is the valuable half.**

⏭ **Proposed, not added** (needs Nate's approval per memory `feedback_verification_policy`): promote the cap's behaviour check into `rotationUrl.test.ts` — round-trip / just-under / over-cap. It guards an observed defect and survives refactors, which is the promotion bar.

↻ **Correction:** `static/.DS_Store` was **already gitignored and untracked** — it never shipped. That checklist item was wrong and is dropped.

---

## ✅ ALSO LANDED 2026-08-14 (evening) — the strays round, unplanned

⚓ Nate brought a list of things he'd caught: _"a round of strays."_ **None of it was on this roadmap**, and it grew from six small fixes into four parser/schema rounds because each fix kept surfacing the reason behind it. Nine commits on `main`, unpushed, every one gated (vitest 1403 · check · lint · build · `test:e2e` 73+73 on five of them) and **verified in Safari by Nate as it went**.

`995063e` route rename · `996cc22` six strays · `181b036` buff pooling · `c430c19` summon lanes + shields drawn · `7d5aabc` variant effects · `82d4882` Zhongli physical RES · `5e0c840` shields leave `summons[]` · `54cc90b` shield row order · `3e8d26c` label halo

### ⚠️ The one piece that is LAUNCH-PERMANENCE, not polish

**`/crit-visualizer` → `/visualizers` (`995063e`).** The route had been outdated for months. ⚓ **Two days before launch was the last safe moment** — after 08-16 an indexed URL means a redirect obligation forever (§3's retention logic applies to routes, not just codecs). Touched `seo.ts`, `static/sitemap.xml`, `transition.ts`'s `TOOL_PATHS`, the landing card, `+error.svelte`'s tool list, the help area registry and five e2e specs; `static/_redirects` (new file) carries 301s from both old paths, and Pages forwards the query string so `?i=icd` deep links survive.
⚠️ **Add to the pre-flip sweep:** confirm the 301 actually fires on the deployed site, and that the sitemap says `/visualizers`.

### The rest — correctness a user would have hit

Not launch-blocking, but all of it was visible and wrong: Viridescent Venerer rendering **4× the debuff it applies** (element-less resShred read as "All Elemental RES"); Chevreuse/Sandrone drawing two or three identical bars for one reaction; **shields never drawn at all** for 6 characters (the `shield` window has existed since `741c6b8` with its renderer pass deferred and never picked up); **5 characters' hold-E rendering as their tap** because the parser never read variant `effects`; Ineffa's Birgitta unreachable because only `summons[0]` was ever resolved.

⚓ **Two schema additions came out of it** and are worth knowing before any character work: `activeDuration` (an instant cast's active window — ⛔ deliberately NOT `duration`, which twelve instant abilities already carry as dead data) and `ShieldEffect.label` (the shield's in-game name, rendered by the shield lane). Together they let the nine "shield authored as a zero-effect summon" stand-ins retire, so **`summons[]` now means only a thing left in the world**. Detail: `docs/rounds/shield-summon-split.md`.

### 🐛 Found, not fixed — the PNG export is stale (see §15)

Two divergences found while wiring the label halo: the export painted the E/Q badge and the summon label in **dark ink** under the retired bright-chip idiom, and the summon label at weight 700 after screen went to 500. Both fixed in `3e8d26c`. ⚠️ **The mirror test could not have caught either** — it asserts COLOUR TOKENS against `app.css` and says nothing about which ink a label picks or what weight it draws at. That blind spot is why §15 exists.

---

## The two-day checklist (2026-08-14 → 08-15)

Ranked by **"un-fixable once people are on it,"** not by effort. Derived from a launch-surface audit of the repo on 2026-08-14 — every ❗ below was verified absent/wrong in the source, not assumed.

### ❗ 1. Error boundary + 404 — THERE IS NO `+error.svelte` ANYWHERE

Verified: `find src -name "+error.svelte"` returns nothing. A runtime throw in a client-rendered tool currently drops the user on SvelteKit's default error page — no scene, no chrome, no way back, no way to report, nothing that looks like critcalc. 404s will arrive from truncated/mistyped shared URLs. **Highest value-per-hour item on the list.** (An Abyss-themed 404 was already an open follow-up from the static-pages merge — this absorbs it.)

### ❗ 2. Social preview — THERE ARE NO `og:`/`twitter:` TAGS AT ALL

Verified: the repo has `<title>` + `name="description"` only. Launch **is** a sharing event; every Reddit/Discord/Twitter post currently unfurls as a bare link. For a site whose pitch is how it looks, that's the worst possible place to lose. Needs `og:title/description/image/url/type`, `twitter:card=summary_large_image`, canonical, and a **1200×630 image**. 👤 **Nate makes the image** — visual call, and the scene is worth screenshotting. Per-tool cards so a shared planner link previews as the planner. ⛔ Don't chase dynamic per-`?r=` cards — needs a worker, not worth it.

### ❗ 3. Share links become a FOREVER CONTRACT AT THE FLIP

`rotationUrl.ts` is `FORMAT = '2'` with **deliberately no v1 decoder**, justified in-comment by _"Nate confirmed nobody else has used the site and he has saved no share URLs."_ **That justification expires at launch.** From the flip onward every format ever shipped needs a decoder forever — a link in a Reddit comment outlives several redesigns. Nothing to build; **write the retention rule into `rotationUrl.ts` and `instrumentUrl.ts`** (the latter is `FORMAT = '1'`) while the reason is fresh. Same applies to `?team=`, `?swap=N`, `?i=`.

### ❗ 4. Cache: assets are right, the HTML shell is not

`/assets/*` and `/_app/immutable/*` are correctly `immutable` for a year. **Nothing covers HTML** — it inherits Cloudflare Pages' 4h must-revalidate, so a user can sit on a stale shell for hours during the exact week you'll be shipping fixes fast. Add explicit `max-age=0, must-revalidate` for the shell. _(The adjacent worry — a tab open across a deploy 404ing on a lazy chunk — is already fine: Pages keeps each deploy's hashed assets reachable.)_

### 5. Mobile: REACHABLE, not CONVERTED ⚓ (agreed Nate + Claude, 2026-08-14)

↻⚓ **SUPERSEDED 2026-09-05 → verified 2026-09-08.** The survey (2026-09-01) found the planner's minimum was FURNITURE, not the Gantt, and the narrow round shipped both structural changes (`fd4113c`): the bench ribbon turns horizontal below 54rem, every band control folds to its mark below 40rem, and the aside is a drawer — **both benched tools reach 0px overflow from 320**, and ⚓ Nate checked it on a live phone: "very good". So the tools DO run on a phone now; **the designed small-screen notice is retired as a launch item** and the "reachable not converted" framing no longer binds. What is still Nate's eye: the compact card, the hand-tuned touch targets under `pointer: coarse`. Record + pick-up: `docs/rounds/responsive-survey-2026-09-01.md` Part IV.
**Verified state:** a handful of ad-hoc breakpoints (620/780/1000/1180/1260px, no system) and **zero** touch / `pointer: coarse` handling anywhere in `src/`.

⚓ **Nate's framing, and the reason this is the right call:** a real conversion faces a **trilemma** — overflow the frame / shrink below touch-target size / remove elements and thereby change what the tool _is_. Especially the planner. That is a lot of thinking and might not resolve at all.

**So, for launch:** landing + static/help pages made genuinely good on a phone (prose and cards — achievable), and a **designed** small-screen notice on the tools instead of a mangled layout. ⚠️ This matters more than it sounds: a Genshin link shared to Reddit/Discord is opened on a phone by **most** people who see it, so the landing page has to _sell_ on a phone even though the tools don't run there. A broken tool on mobile is a worse first impression than an honest "this wants a bigger screen."
⛔ Don't reintroduce ad-hoc breakpoints doing this — see `docs/rounds/mobile-conversion-plan.md`.

### ✅ DECIDED 2026-08-14 — analytics + feedback channel

⚓ **Analytics: YES, Cloudflare Web Analytics.** Cookieless, no consent banner, same platform. ⚠️ `/privacy` currently claims localStorage-only / no third parties — that page now needs a **real rewrite, not a tweak**, and it lands in rewrite pass 2 (§13).

⚓ **Feedback: Google Form primary, GitHub Issues secondary.** The Form is the right primary because it can **require** the fields that make a report actionable — "the planner broke" is useless, "the planner broke, here's the share link" is fixable in one pass, and free-text email cannot enforce that.
⚓ **Use Google Forms URL PREFILL** (`?usp=pp_url&entry.<id>=<value>`) so the in-tool report button hands over the share link, build hash and UA already filled in. That is what makes §6's diagnostics idea work end-to-end rather than being a button that opens a blank form.
⚠️ GitHub Issues as secondary **requires the repo to be public** — unconfirmed. If it isn't, the secondary channel simply doesn't exist yet, which is fine.
⚠️ Both decisions add third parties, so `/privacy` must cover Cloudflare Analytics AND Google Forms.

### 6. Feedback channel — pick the LOW-FRICTION one, and instrument it

`Contribute.svelte` still says there is no channel and lists candidates. ⚠️ **GitHub issues is high friction for a Genshin audience** — most players have no account. Recommendation: **email alias on the domain** as the baseline (works for everyone), GitHub secondary if the repo is public.

The high-leverage half is an in-tool **"report a problem" that pre-fills context**: current share link + build hash + UA. A report without the notation that broke is nearly useless, and asking a user to reproduce is asking for work they won't do.

### 7. Analytics — a DECISION, not a default

Stated goal of launching is feedback; unaided you get only what people bother to write, which is a small and negatively-biased slice. **Cloudflare Web Analytics**: free, cookieless, no consent banner, one tag, same platform. Would answer the mobile question **with data instead of guesses**. Cost: `/privacy` currently says localStorage-only/no-tracking and must be updated. There is a legitimate no-tracking-ever position — recommendation is to add it, but make the call deliberately.

### 8. BETA tag ⚓ (Nate's idea, endorsed + extended)

⚓ **Nate's reasoning, which is the correct reasoning:** the site _looks_ like it has a team behind it, so a rough edge reads as _"this site is unreliable"_ rather than _"one person's project, still moving."_ The tag re-frames that jolt.

**Extension:** a bare tag only does half the job — it lowers expectations without giving anyone anywhere to go. Make it a **link**: BETA → a short "what beta means here" note (one person, active development, data hand-curated against gcsim, what to do if something looks wrong) → the feedback channel. That converts expectation-setting into the feedback funnel, which is the actual point of launching.

- ⏳ **Give it an END CONDITION now** — proposed: _drops when the first round of user-reported issues is cleared_. Left indefinitely it stops reading as humility and starts reading as abandonment.
- ⚠️ **Point it at the SURFACE, not the DATA.** The curation is the most rigorous part of the project and must not be hedged. "The surface may be rough," never "the numbers may be wrong." That distinction lives in the linked note — "BETA" alone doesn't carry it.
- 🎨 It sits beside branding, which stays `--chrome` white. ⛔ **Not gold** — gold names a BLOCK, never a word (`docs/rounds/palette-definition-round.md`). A small chrome-toned pill.

### ❗ 9. Parser hardening — ↻ **DONE INVESTIGATING, NOW A REAL WORK ITEM** (workflow, 2026-08-14)

~~One deliberate 20-minute garbage-input session.~~ The sweep ran (5 attack angles → adversarial verify, 14 agents) and found a **genuine launch blocker**. Full report: `docs/rounds/parser-hardening-2026-08-14.md`.

⚓ **The headline is that the parser's LOGIC is sound.** ~70,000 fuzzed + hand-built inputs — nesting to depth 1000, Zalgo, lone surrogates, all 123 names in one line, `sQ` in impossible orders, 8MB of whitespace — produced **zero throws, zero NaN/Infinity, zero out-of-order events, zero inverted windows**. ⛔ **Do not re-hunt corrupt IR; it is not there.** The defect class is singular: **nothing bounds how much work or output one line of input may produce.**

**Verified in source (not taken on trust):**

- `notationParser.ts:3471` — `if (isFinite(delta)) localCursor += delta;` **no upper bound.** `Ifa ~99999999s` = 14 chars, parses in 2.5ms, `unknownTokens: []`, hands `totalDuration = 99999999` to a per-second tick allocator.
- `notationParser.ts:900` — `Math.min(count, MAX_BRACKET_REPEATS)` sits under a comment saying an unbounded repeat _"would freeze or OOM the tab."_ ⚠️ **The guard caps the repeat count but not the bracket body — one of two multiplicands.**
- `decodeRotation` validates marker + `v === 2` + `typeof notation === 'string'` and **nothing else**. A grep for any length cap across the whole notation path returns **nothing**.

⚠️⚠️ **The `?r=` link is a REMOTE vector — this is why it blocks launch.** Payloads deflate to **52–360 character URLs** that freeze or kill the _recipient's_ tab on load: no error, no error boundary, and `importShared` writes to localStorage so the planner re-kills itself on every reload until site data is cleared. It converts "a user can hurt themselves" into "a user can hurt others." ⚓ **The share link is not just a format contract (§3) — it is an attack surface.**

**Fix order — ⚓ item 1 alone blunts all of them:**

1. **Hard length cap in `decodeRotation`** (reject/truncate above ~8–16 KB) + `maxLength` on the editor. Closes the remote vector; everything else becomes self-inflicted-only. _(Safe headroom: a realistic 4-char rotation cycled to 5,319 chars parses in 19 ms.)_
2. **Total-expansion budget in `expandBrackets`** — cap `result.length`, flag when hit.
3. **Clamp the `~Xs` delta** + cap tick count in `rulerTicks`.
4. **Regex fix** `~(?:\d+(?:\.\d+)?|\.\d+)s` at `tokenizer.ts:114, 146, 237` — mechanical, zero behaviour change.
5. ⏭ Can wait: bound the `[^)]*`/`[^\]]*` scans; memoize `inferredStates` (real O(casts²), but item 1 caps its input); debounce the editor parse.

⚠️ **Two unverified-but-code-confirmed THROWS my workflow's cap dropped:** `notationParser.ts:904` (`result.push(...innerTokens)`) and `:4139` (`windows.push(...buffWindows)`). V8 throws `RangeError: Maximum call stack size exceeded` at 200k spread elements — confirmed by direct test. ⚓ **A throw is WORSE than a hang here** (white screen, no boundary), so ranking `hang` above `throw` in the verify cap was the wrong order — a lesson for the next sweep, and the reason `docs/rounds/launch-roadmap.md` §1 (error boundary) and this item are coupled.

⚠️ **Honest caveats:** tab-death is **inferred from Node heap figures**, not observed in Chrome/Safari — the multi-second main-thread freezes ARE directly measured. And none of this touches normal use.

### 10. Small

- `static/.DS_Store` is **committed and ships to production** — delete + gitignore
- No `X-Content-Type-Options: nosniff` / `Referrer-Policy` — cosmetic for a static site with no auth, but one-liners in a file being edited anyway
- No `sitemap.xml`; `robots.txt` allows everything (fine). Add a small static sitemap for the ~14 routes
- 👤 Nate's accumulated cleanup list

---

## Part B — design + content work (added by Nate, 2026-08-14)

Different in kind from the hardening list above: these are surface/taste passes, not risk mitigation. Sequenced so the **text settles before anything extracts it**.

### 11. ❗ Landing page — final design 🔄 **IN PROGRESS — Nate is drawing the card outlines**

⚠️ **The design decisions live in `docs/rounds/landing-card-round.md`** — the derived **1:1.8** aspect and its interior grid, the two-outline rule (ornate desktop / simplified mobile), the three silhouette concepts, the settled naming, the announcement-banner call, and the ⛔ rotate-and-stack rejection. Read that first; the note below is only the framing.
⚓ **Nate, 2026-08-14: "the one surface that really hasn't had its final design."** It genuinely was the last one — every other surface got an on-the-scene / redesign round through 2026-08. Nate expects it to be quick. ⚠️ **It is also the single highest-stakes surface at launch**: it's what a shared link resolves to, what the OG card advertises, and — per the mobile call — the thing that has to _sell_ on a phone even though the tools don't run there. Scene itself is shipped (`docs/rounds/landing-status.md`, `docs/rounds/ascend-revival-2026-08-02.md`); this is the finishing pass over it.

### 12. Wide-screen pass — the OTHER end of responsive 🗓️ with the mobile work

⚓ **Nate's call, 2026-08-14.** Reasoning-through, not a build: on extra-wide displays, what stretches past usefulness and needs a `max-width` / max-size? Candidates by construction — measured text columns on the static/help pages (line length is the classic failure), the tool bands spanning very wide surfaces, `ToolColumns` main+aside proportions, the landing composition, chart/instrument tiles that gain width without gaining information. ⚠️ Note `docs/rounds/tb-card-round.md`'s calibration point (7-across-at-150) — a grid that reflows wider is fine; _prose_ that reflows wider is not. Pairs naturally with the mobile work since it's the same audit from the opposite end.

### 13. Text rewrite — TWO passes, both TODAY ⚓ (Nate's shape)

The plain-language work, pulled BEFORE i18n deliberately (see §i18n below — translating unsettled text is the one ordering mistake to avoid).

- **Pass 1 — Nate leads, Claude updates.** Nate looks at a whole text surface at a time and directs the rewording; Claude applies it. ⚠️ Whole-surface, not string-by-string — a label is judged against its neighbors, which is the same reason the i18n inventory must be grouped by surface.
- **Pass 2 — static pages: brainstorm together, Claude leads the rewrite.** First decide _what sections and content the static pages need_, Nate says how he wants it written, then Claude does a focused rewrite. Scope: about / help (+3 per-tool chapters) / FAQ / contribute / privacy / settings.

⚠️ **Pass 2 overlaps the hardening list** — `/contribute`'s channel copy (item 6), the BETA explainer (item 8), and the `/privacy` update if analytics lands (item 7) are all static-page text. Do them _inside_ pass 2 rather than twice.

#### 📌 Queued FAQ entry ⚓ (Nate, 2026-08-15) — "Why is my skill recast a few frames later?"

Goes in `src/lib/help/chapters/Faq.svelte` during pass 2. **The tool is right and the player's intuition is wrong**, which is exactly why it needs saying: a skill's cooldown does **not** start on the button press — it starts a few frames after, and we model that per-character from gcsim's `SetCDWithDelay`. It rides `Ability.cooldownStartDelay` (frames); Nahida's `11` is literally gcsim's `SetCDWithDelay(action.ActionSkill, skillPressCD, 11)`. **124 abilities carry it**, ~122 in the 1–35 frame band (0.02–0.6 s).
⚓ Nate's framing: _"this is exactly the kind of game behavior that even regular Genshin players might not know is true"_ — so write it as a "no, that gap is real" answer, not an apology for an artifact. Worth pairing with the Nightsoul case (a Natlan stance skill's CD starts when the stance ENDS — Xilonen 9 s + 7 s), since that one looks like a bug and isn't.

### 14. Embellishments / decorations 🗓️ TOMORROW

⚓ **Nate, 2026-08-14: "tastefully here and there — faint background washes, inset borders, etc."** Expected fast. ⚠️ **The vocabulary already exists — use it, don't invent:** `--inset-line` is the gold inset frame (zoned by context; 1.5px default, 2px large panels), `--glass-*` is the compositing layer, and the element wash has a fixed recipe (`docs/design/element-wash-recipe.md` — ONE ground, only the element travels, at the BOTTOM). ⛔ Hard constraints from settled rounds: **no light glass** · **no `color-mix` fed by a `color-mix`** (crashes WebKit) · **`.frame` is retired** · on night, `--muted` is illegal and there are no rungs · alpha belongs in the **paint**, never element `opacity`, on anything transform-placed. Judge on `/lab`.

### 15. 🖼️ PNG export — stale, and it is a DESIGN round not a sync chore ⚓ NEW 2026-08-14

⚓ **Nate, from an export he saved:** _"the swap bars were not aligned, the portrait area was messy, and the text definitely could use some styling work, but the bars are mostly looking the same."_

⚠️⚠️ **READ `timelineExport.ts`'s OWN HEADER FIRST — it already answers the framing question.** The export is deliberately **NOT a screenshot mirror**; it is a DOCUMENT (notation header, labelled timeline, watermark) that paints the WHOLE rotation, not the viewport, which is the thing a user cannot produce by screenshotting. The header states the rule explicitly: **COLOUR must track the CSS; SHAPE, GEOMETRY and CHROME need not.** So this is not "make it match the screen" — several divergences are _correct_ (the export keeps slot separators, the ruler seam and lane rules precisely because it has no scene behind it to do that work).

**What that means for scoping:** it is a **design pass on a second artifact**, so it needs Nate's eye per surface, and it does not fan out to a workflow (⛔ per the delegation rule — "does this feel right" is not workflow work). The mechanical half is small; the taste half is the job.

**Known state, verified in source 2026-08-14:**

- 🐛 **Two ink/weight drifts already fixed** (`3e8d26c`) — E/Q badge and summon label were dark ink under the retired bright-chip idiom, summon label at weight 700 vs screen's 500.
- ⚠️ **The mirror test cannot catch this class.** It asserts colour tokens against `app.css` only. Ink choice, font weight, size and position are unguarded, so **every drift here is found by eye or not at all**. Expect more than the two found.
- 👤 **The portrait label column is the big open question, and it is a decision not a fix.** The header already flags it: the export draws a portrait column _the on-screen chart has not had since the tall-bench round_ (the bench ribbon names slots now). So "messy" may mean redesign-it or may mean drop-it — that call is Nate's and it should be made before any pixel work, because it decides whether `labelW`, `avatarFor`, `elementGlyphFor` and ~50 lines of painting survive at all.
- **Swap connectors** are pre-resolved into the snapshot as `{x, w, yTop, yBottom, downward}` from active-row edges; the alignment complaint most likely traces to row geometry that moved in the RP scene round (condensed row/gap ladder) without the snapshot's y-derivation following. Bounded and findable.
- **Text**: no type scale of its own — sizes/weights are inline literals (`600 11px`, `700 9px`, `500 9px`). A small set of named constants would make the next drift visible.
- ✅ **Bars are fine and stay fine** — Nate confirms, and they are the part the mirror test actually guards.

**Not launch-blocking.** The export works and produces a correct chart; it is the _presentation_ that is behind. ⚓ Nate: _"we should try to knock it out any time"_ — a good independent-session candidate, and it is genuinely independent: one file (1,186 lines), one entry point, no shared surface to regress.

### 16. 🕳️ Keep hunting unwired data ⚓ NEW 2026-08-15 — the workstream that softened the date

⚓ **Nate: "uncover other missed / unwired things."** This is now a named pre-launch activity rather than a thing that keeps happening by accident.

**The class:** data authored correctly, typechecking, linting clean, and read by **no code path** — so it silently does nothing. 2026-08-15 produced **nine** instances: `factionBonuses`, the five `infuse` effects, `shield` windows, variant `effects`, `summons[1]`, `noICD`, Citlali's `onState`, Hu Tao's `onStanceEnd`, and the `onReaction` self/active target. ⚠️ Nothing in the toolchain could see any of them.

**What is now in place:** `docs/curation/orphaned-schema-audit.md` (the sweep + findings) and `src/lib/data/orphanedSchema.test.ts` (a gate on new ones). Full detail in `docs/curation/orphaned-schema-audit.md`.

⚠️⚠️ **The guard CANNOT see partially-wired data, and most of the nine were partially wired** — `infuse` effects reached the capability layer and the Team Builder and were missing only from the parser. **A green run is not proof the class is exhausted.** The per-consumer pass that narrows it is documented but not automated; running it by hand is what "keep hunting" means.

🐛 **The lesson that justifies doing this before launch rather than after:** fixing an _invisible_ bar is how you find a _wrong_ one. Hu Tao's newly-drawing buff fired 6s late, which exposed a stance-window clamp bug affecting **27 characters** and five existing `afterDuration` authors. An orphan can hide a timing error indefinitely, because a bar that never draws can never draw at the wrong time.

⏭ **Open from the audit** (findings 2–6, all judgment calls rather than clear bugs): `durationType` (321 authored values, never branched on) · `mobility` (84 authorings, accessor with zero callers) · `durationModel` (a _required_ field that does nothing) · `shortName` · `framesSource`.

⛔ **Not a flip gate.** Findings-only; each fix is judged on its own. The point is to spend the softened days on the highest-yield thing available, not to block on an empty backlog.

---

## Schedule

**🗓️ Today (08-14) — ✅ CLOSED.** Landed: error + 404 (1) · OG/meta (2, all but the image) · share-link permanence (3) · cache + headers (4) · parser hardening (9) · sitemap half of (10) — all merged in `6f4b71f`. **Plus the unplanned strays round** (nine commits, above), which was not on this list and absorbed the afternoon.
↻ **SLIPPED: §13 text rewrite, both passes — not started.** §11 landing is 👤 Nate's and in progress; he reports the design work (cards, OG image) is close.

**🗓️ 08-15 — ✅ CLOSED, and it went somewhere else entirely.** ~20 commits that day, **all parser/data correctness, zero launch-checklist items.** Off-field summon hits + three artifact sets woken (`1c52b96`) · buff-bar refresh merge · Silken Moon Moonsign tiers · the stance-end cooldown clock + Xilonen's swap (`891a558`) · Sucrose EM + scaling-buff labels · faction bonuses reaching the timeline (`fec93f8`) · onReaction self/active (`b0feb37`) · **the ICD round** (`d0a3bc0`) · **infuse effects + `weaponType`** (`d886429`) · the infused-block tint (`c470e27`) · **the orphaned-schema audit + guard** (`2c9dba6`).

⚠️ **None of that was on this roadmap, and all of it was real.** §13 slipped a _second_ time. That is the fact that softened the date — not a slip in the plan, but the discovery that the un-audited surface still had this much in it.

**🗓️ Next — no date, in this order.** ⛔ The list is short on purpose; if it grows without something coming off, that is the failure mode the framing above warns about.

↻ **RE-TRIAGED 2026-09-22 (⚓ Nate, launch "this week, maybe the next couple of days").** The list below is superseded by this sequence, in order:

- ✅ **Quick open items knocked out — MERGED + PUSHED `bfd0612e` 2026-09-22, e2e green — `bfd0612e` is origin/main** (was branch `data/7-1-refresh`): genshin-db 5.2.14 + Vesna/Vodyanitsa stubs + banner → 7.1 · Nilou's Pirouette 10s · the responsive smalls + the breakpoint grep guard · the drawer's one title · orphaned findings 2–6 ruled · stale records brought current.
- ⏭ **The TEXT SURVEY, in a NEW session** — survey every text surface, design the shape of Nate's rewrite workflow (pass 1 = Nate leads, per surface; pass 2 = static pages, Claude leads), report back so Nate can start rewriting on his own clock. **§13 has slipped THREE times; this is the un-cuttable item.**
- ✅ **The COVERAGE PAGE SHIPPED 2026-09-23** — MERGED `774bf495` + PUSHED, e2e 78 + 78 (`docs/rounds/coverage-round.md`, record `docs/rounds/coverage-round.md` §11). It also unified the static pages (About | Help tabs, 72rem) and moved every text link to a real underline. ⏭ Its new user-facing strings are in NO text worksheet yet (`src/lib/coverage/coverageText.ts` holds most) — fold them into the text round.
- ⏭ 🆕 **REWRITE `docs/rounds/tool-constitutions.md` — queued 2026-09-22, and ⚠️ it is NOT purely housekeeping.** The memory is **partly FALSE**: its "will never simulate" lists forbid the aura/gauge simulation that shipped in gauge rounds L3–L6, and two of its three tool descriptions predate the tools ("Crit Visualizer"; "Team Builder _(planned)_"). ⚠️⚠️ **It collides with the coverage page directly** — that page documents what IS and IS NOT modelled, so building it beside a constitution claiming auras are never simulated is a live contradiction. ⚓ Rewrite to describe **current scope**, ⛔ with no "never" (the framing the text round retired — `docs/rounds/text-round.md`). ⚓ Keep the sound half: the in-game-DPS-dummy reasoning, the "window vs calculation" judgment aid, the curation implications. ⚠️ A staleness block is already at the top of the memory so nothing acts on it meanwhile. Cheap — well under an hour.
- ⏭ 🆕 **PRUNE `CLAUDE.md` — queued 2026-09-22 WITH the constitutions rewrite, and ⚓ they are one job.** Measured: **56.8k tokens**, and it loads on **every session ever run on this project** — the single largest fixed cost there is. ⚓ The reason to pair it with the constitutions: today proved a project doc can go stale _into being false_ and keep being read as true, and CLAUDE.md is where that does the most damage because nobody chooses to read it. ⚠️⚠️ **It is NOT a length exercise** — the file's density is deliberate and its ⚓/⛔/⚠️ markers are load-bearing. The question per line is **"is this still true, and does a session need it BEFORE it asks?"** ⏭ Likely candidates: round entries that are fully recorded in `docs/rounds/round-history.md` and a `docs/*-round.md` (the file's own rule says a round gets ONE line) · superseded ↻ passages kept for history · anything a memory already carries in full. ⛔ Do NOT strip the hazard markers or the "⛔ never do X again" lines — those are the highest-value content in it. ⚓ Verify each cut against the record it points to before removing it.
- 👤 Nate: portrait art for Vesna + Vodyanitsa (waiting on the side avatars, ~a day after 7.1 goes live) · the in-game test batch (postponed) · the Google Form ID · the LICENSE decision (⚓ queued WITH the Form/analytics work — discuss first).
- ⚓ **BETA tag drops when Nate says so** — no end condition; ⛔ don't propose one again.
- 🗒️ Post-launch, first: Vesna + Vodyanitsa Stage 1–2 authoring (⚠️ 7.x kit text needs Fandom's Extra Effect tooltips) · the queued engine rounds (`docs/rounds/engine-queue-2026-09-17.md`).

1. 👤 **§11 landing cards + silhouettes** ✅ SHIPPED `46688278` 2026-09-21 — what remains (the announcements box redesign, the portrait composition, the BETA explainer page) is on Nate's clock, `docs/rounds/landing-card-round.md`.
2. ~~👤 **OG image**~~ ✅ **SHIPPED 2026-08-16 (`8b3aa64`)** — Nate's card, JPEG q97, 272 KB, 1200×630, no alpha. Verified against the production build: the asset is emitted and **every prerendered page's `og:image` resolves to a real file.** ⚓ **The binding constraint was WhatsApp's 600 KB preview cap**, not the ~500 KB rule of thumb this roadmap used to cite — Facebook/X/LinkedIn cap at 8/5/5 MB and only _recommend_ under 1 MB, but WhatsApp drops the preview **entirely** over 600 KB. Maximum-effort LOSSLESS PNG optimization reached only 619 KB, so re-encoding was the only way to clear it. ⛔ **Don't "upgrade" it back to PNG for fidelity** — the reason is recorded at the `OG_IMAGE` declaration in `seo.ts`.
3. ❗ **§13 text rewrite, both passes** — still the largest item, still ⛔ the one that must not be cut. Pass 1 is Nate-led by construction; pass 2 Claude leads once the static-page sections are decided.
4. **§16 keep hunting unwired data** (new — see below). Findings-only, no gate on the flip.
5. **§6 feedback channel** — ⚓ promoted: it is the mechanism that converts "shipped with defects" into "found the defects that matter." Launching without it takes the risk and collects none of the return. Blocked on a Google Form ID.
6. **§8 BETA tag** · **§5/§12 mobile + wide-screen audits** · **§14 embellishments** · **§7 analytics** (blocked on a CF site token).

⏭ 🆕 **PRE-LAUNCH: a site-wide ANIMATION SWEEP (⚓ Nate 2026-10-13, queued — not scoped to any round).** Trigger: on the bench's /lab board the portrait ring faded on the shared `--t-snap` while the magnifier beside it SNAPPED (visibility only), so one hover ran two clocks and the magnifier led the ring. Sweep every transition/appear for the same mismatch — parts of ONE gesture must share one band (memory `docs/rounds/motion-round-handoff.md`); ⚠️ a fade on the transform-placed ribbon must be PAINT alpha, never element opacity.
⏭ 🆕 **PRE-LAUNCH: the PNG EXPORT, given proper attention (⚓ Nate 2026-10-14, queued like the animation sweep — not scoped to any round).** Trigger: its label column still draws the pre-bench portrait label (stale since before the bench portrait round), on top of the §15 drift class the mirror test cannot see (which ink a label picks, what weight it draws at). ↻ This moves §15 from post-launch to PRE-launch. Re-survey the export against the live chart end to end, don't patch the one label. ⛔ **TALK THE LOOK THROUGH WITH NATE BEFORE ANY WORK ON IT** (⚓ Nate 2026-10-14) — the survey can be read-only prep, but no design or code change until that conversation.

## 🏁 FINAL STRETCH PLAN (⚓ Nate 2026-10-14 — aiming to launch the week of 10-14)

**Claude-solo items (big three), in order:** ① **bug + leftovers sweep** (workflow, started 10-14, with a static-pages INVENTORY alongside: current content, stale bits, proposed section list — inventory only, no rewriting) → ② **mobile + extra-widescreen sweep** (Nate judges visual calls by day) → ③ **static pages rewrite** LAST (after the tools stop moving and the blockers below exist; first a short sections conversation using the inventory; copy proposed line-by-line per memory `feedback_copy_proposed_first`) → a quick width re-check of the rewritten pages.

**Daytime / together items (⚓ Nate: all important, all done WITH him):** the Google Form (ID + prefill fields) · Cloudflare Analytics token + beacon (not wired as of 10-14 — no `cloudflareinsights` in `src/`) · the LICENSE decision (no LICENSE file in the repo) · the animation sweep's fixes (they need his eye; the bug sweep may LIST candidates) · the PNG export look (above) · the BETA note's content. ⚠️ `/privacy` + `/contribute` copy DEPEND on the Form + analytics + license, so they gate ③'s final text.

**Carried into the static-pages rewrite from the sweep's §3 (⚓ Nate 2026-10-15):** ⚓ the CREED LINES (About :38–40, FAQ :26–27, About :85–87, Contribute :19–20/:81–82, `seo.ts` `/about`) are discussed WITH Nate right before the rewrite — ⛔ the new line must NOT resemble the old "visualizes mechanics, never verdicts" register at all · a new Team Builder help section replacing "Comparing and assembling" (outline in the sweep record §3 item 13; glossary names, never "fingerprint") · Nate re-checks the needs-nate texts applied anyway (record §3 item 17) · ⚓ credit **EODGamer** as the Crit Heatmap's INSPIRATION (their spreadsheet heatmap, https://www.hoyolab.com/article/622264 — Nate's idea was to make it visual + interactive) in About's credits and/or the heatmap's Help chapter · the landing's "Data current to 7.1" announcement banner gets a REWORK (Nate wants to redo it; expires 2026-11-04).
**Re-sweep:** ⚓ agreed shape — one more, narrower sweep after the mobile pass + rewrite, before the flip: changed code since `sweep/prelaunch` + browser-driven user flows; harsher verifiers (round 1 refuted 0/116).

🧹 **CHORE QUEUE (Nate 2026-10-15) — ✅ BOTH DONE 2026-10-16, merged `01ea91d4` + pushed:** Columbina's details card (Builder magnifier) shows the raw text "during duringSummon" on her C6 buffs — a condition-label leak, found by the responsive follow-up agent. · the Artifact Odds value wheel's reel (`ValueWheel.svelte`, ⚠️ NOT Wish Odds) still has a LINEAR fixed-% mask, outside the shared `.scroll-fade` — give it the eased smootherstep stops from `polish/eased-fades` (Nate OK'd 2026-10-15).

**⚓ LICENSE DECIDED (Nate 2026-10-15):** the repo goes PUBLIC (community give-back + portfolio). CODE = AGPL-3.0 (gcsim went MIT → AGPL-3.0 on 2026-09-19; `gauge.ts` mirrors gcsim logic written under MIT → keep gcsim's MIT notice) · curated DATA + DOCS = CC BY-SA 4.0 · Nate's own ART = all rights reserved · HoYoverse content excluded (non-affiliation notice) · THIRD_PARTY_NOTICES for gcsim + genshin-db (MIT). Drafted on `chore/license` (worktree `../critcalc-license`); a read-only pre-publication history audit runs before the repo flips public. ⚠️ Cloudflare Web Analytics ENABLED by Nate in the Pages dashboard 2026-10-15 (auto-injected, no code) → `/privacy` must name it in the rewrite. Feedback Form built 2026-10-15 (one form, 4 categories, branching); site wiring MERGED `77d505f7` + PUSHED 2026-10-15. ✅ `chore/license` MERGED `bd84f24f` + PUSHED ( © Nate West, AGPL-3.0-only, Nate's art + 7 glyphs + About/Help glyphs + vortex reserved; Settings glyph is HoYoverse's). ✅ 2026-10-15 evening: `sweep/responsive` MERGED `39d98c18`, `polish/eased-fades` MERGED `91415d48` (smootherstep, `--scroll-fade-scale` .7, chrome fade 10px below → icon midline — Nate approved by eye), `polish/builder-phone-filters` MERGED `dd96cab1` (Nate approved on iPhone) — + `polish/rp-bench-hide` MERGED `3dc35e18` (the Bench plate + the phone timeline edge-bleed) — ALL PUSHED 2026-10-15 (origin at `3dc35e18`; e2e 76+76). A Builder crash on Nate's iPhone reproduced only on the DEV server (prod preview clean) — recheck in the Safari pass. ⚠️ AGPL §13: the live site needs a visible Source link before launch.

**Pre-flip:** e2e both engines → Nate's real-Safari pass → delete ONLY the `X-Robots-Tag` line → redeploy → `curl -I` (noindex gone, old routes 301).
✅ **DONE 2026-10-14 (MERGED + PUSHED `651d34ac`): a WEB APP MANIFEST (⚓ Nate, the mobile round)** — `static/manifest.webmanifest` (standalone, `#050b19`, short name "critcalc", black iOS status bar) + head tags in the root layout + the starfield icons; Nate installed it to his iPhone and it opens without browser bars. ⏭ Optional later: `black-translucent` status bar (needs safe-area padding on the chrome). Original note: Trigger: on iPhone, Safari and Chrome both spend the strip above the keyboard on browser chrome the page cannot remove (the address bar, Safari's ^ ∨ ✓ bar, Chrome's passwords/card/location bar). A manifest with `display: standalone` lets the site be added to the home screen and open without the address bar. ⚠️ It does nothing for a normal browser tab — the in-tab answer is the dock's own key row. Small; not scoped to a round.

**🗓️ Pre-flip, whenever it comes** — vitest/check/lint/build → **`test:e2e` both engines** (pre-merge gate, memory `feedback_gate_cadence`) → 👤 **Nate's real-Safari pass** (⚠️ policy stands; the backlog is currently OPEN — the ICD/infusion/orphan rounds are all new visual output) → the pre-flip verification sweep → flip → `curl -I` → announce.

✅ **Already verified against the production build (2026-08-15) — don't re-check:** sitemap covers 12 routes and says `/visualizers` · both `/crit-visualizer` 301s present with the query-string note · `og:` tags on every real route (only `404.html` and the `/faq` stub lack them, correctly) · `X-Robots-Tag: noindex` still in `_headers`, as it should be until the flip. ⏭ Still deploy-dependent: that the 301 actually fires live, and that the `noindex` is really gone after the flip.

⚠️ ~~**This is a full two days.**~~ ↻ **Corrected 2026-08-14** — see memory `feedback_estimation_calibration`: my duration estimates on this project run **5–20× conservative**, so this list is likely far less than two days of model-executed work. ⛔ **Do not scope-cut on a duration guess.** If something genuinely slips, cut for _risk_, in this order: embellishments (14) → wide-screen (12) → analytics (7). ⛔ **Never cut 1, 2, 3, 4, or 9** — the un-fixable-later ones, plus the parser cap (↻ **9 was promoted 2026-08-14**: the sweep found a remote tab-kill vector through `?r=`, so it is no longer a nice-to-have).

↻ **The cut order OUTLIVED the date entirely, and matters MORE with no date than it did with one.** ⚠️⚠️ A trigger made of judgment rather than time is where scope quietly grows — "polished enough" has no natural edge, so the _list_ has to supply it. The 08-15 softening bought time for the _named_ un-rushable items (§11, §13, the OG file, §16), and the 08-31 retirement of the date buys none for anything else. ⛔ Anything that is not on the "Next" list above is post-launch by default, and §15 (PNG export) is still below everything on the cut order.

⚓ **The real constraint is NOT throughput — it is Nate's review bandwidth** (visual judgment, the Safari pass, taste calls) plus the fixed gates (`test:e2e` ~6 min cross-engine). Optimize for _how fast work reaches Nate for judgment_, not for how fast it is produced.

---

## ⚙️ Workflow delegation — ⚓ GREENLIT (Nate, 2026-08-14)

Multi-agent workflows are **pre-authorized** on this project, for the time efficiency. ⚠️ Size to the session's workflow guideline (default here: medium, <15 agents).

⚓ **The selection rule, and it follows directly from the constraint above: delegate what Nate does NOT have to look at.** Audits, surveys, adversarial testing, mechanical sweeps, verification fan-outs — work whose output is _findings_ or _verifiable transformations_. ⛔ **Never fan out work whose spec is "does this feel right"** — parallel generation of design-touching work floods the review queue rather than shortening it.

⚠️ **A second, non-obvious exclusion: anything requiring a consistent VOICE.** Parallel agents rewriting different text surfaces produce measurably inconsistent prose — the exact opposite of the wording pass's goal. For voice work the correct shape is **fan out to GATHER, barrier, then write once with the whole picture in hand.**

### ✅ Strong fits

- **§9 Parser garbage-input hardening — the standout on this roadmap.** Textbook multi-modal sweep + adversarial verify: fan out attackers each on a distinct angle (pathological repeat counts · nesting depth · unicode/RTL · multi-MB input · malformed brackets · unknown tokens · contradictory state tokens), schema-returning `{input, symptom: throw|hang|wrong}`, then verify each hit. Fully objective — _did it throw, did it hang_ needs no taste. Run this one.
- **i18n Phase 1 inventory — best _technical_ fit, but ⏬ DEMOTED TO LAST (⚓ Nate, 2026-08-14).** Genuinely scale-y (27 components + ~4,000 words of help prose + **256 caveats across 89 character files**), mechanical, schema-verifiable. ⚠️ **And that size is exactly the problem: Nate flagged it as a token-usage risk** — a sweep this large can crowd out the other work in a session. ⚓ **Run it LAST, and ideally alone** — never alongside other planned work. ⛔ Don't let its good technical fit pull it earlier in a queue. Fan out by surface; each agent returns strings + location + tier + a non-extractable flag (⚠️ notation tokens). ⚠️ **Gather only — the tier _decisions_ (caveats-as-fourth-tier, notation exclusions) are calls, not outputs.**
- **Pre-flip verification sweep** 🗓️ whenever the flip is called (was scheduled for 08-16; the date is retired, the sweep is not). Fan out one checker per launch-permanence claim: `X-Robots-Tag` actually gone from the live response · `og:` tags present on every route · sitemap covers all ~14 **and says `/visualizers`** · **the `/crit-visualizer` 301 actually fires on the deployed site, query string preserved** · error + 404 actually render · cache headers as intended. Cheap, and it catches the one item that got missed — which is the classic launch failure.
- **Wide-screen (§12) and mobile (§5) — the AUDIT halves.** Read-only fan-out reporting what overflows at ~360px and what stretches without gaining information at ~2560px, per surface. ⚠️ The _decisions_ (which max-width, what the small-screen notice says) stay Nate's.
- **i18n Phase 3 extraction** (post-inventory) — mechanical per-file transformation, and parallel agents touch _different_ files so no worktree isolation needed.
- **i18n Phase 4 pseudo-locale** — generating the padded locale and reporting every break is mechanical fan-out; fixing the breaks is design.

### ⚠️ Partial fits

- **7.0 character ingest** (Odette / Alyosha / Cryo Traveler, once genshin-db lands) — natural 3-item pipeline, but ⚠️ effect authoring is judgment against `~/Code/gcsim`, and `project_stance_chain_pilot` (a retired note) warns char-JSON edits want a FRESH context. **Fan out the stub + research gather; author effects deliberately.**
- **§2 OG/meta** — per-route mechanics fan out fine, but the descriptions are _voice_. Gather-then-write-once.
- **§13 rewrite pass 2** — same shape: fan out to find over-technical strings and jargon-by-location, barrier, then one voice does the rewriting.

### ⛔ Not workflow work

§11 landing final design · §14 embellishments · §8 BETA tag wording · §1 error/404 _design_ (the scaffolding is trivial either way) · §13 pass 1 (Nate-led by construction) · §5 small-screen notice copy · every taste call and every Safari verdict.

---

## 🌐 The wording pass, then i18n — IN THAT ORDER

⚓ **Localization is NOT a launch condition** (Nate, confirmed again 2026-08-14). ↻ **But the wording pass moved PRE-launch** (Part B §13) — the ordering rule below is what makes that the right call rather than a scope creep.

### ⚓ Locale priority (Nate, 2026-08-14) — SUPERSEDES the plan's flat seven-locale list

**Tier 1: Simplified Chinese + Japanese.** The reasoning is _reach_, not headcount: these are the two large player populations **least likely to be able to use the site in English**. That is the correct axis and it should stay the stated one.
**Tier 2 (lower): European languages** — ES/FR/RU. High English-literacy overlap in the theorycrafting community specifically.
**Tier 2 (lower): Korean** — ⚠️ Nate is unsure of Genshin's KR popularity. Don't guess; **analytics will answer it** within weeks of launch. Same for whether zh/ja users actually arrive in the numbers that justify the work.

### ⚠️ Pre-launch zh-Hans + ja was CONSIDERED and deferred — the reason matters

Nate asked whether at least the **UI** could ship in Simplified Chinese + Japanese pre-launch. Assessment 2026-08-14:

- ✅ **More feasible than `docs/design/i18n-plan.md` §4.1 implies.** The plan treats IBM Plex Sans SC/JP + subsetting as _mandatory_, which reads as a multi-day font project. It isn't, for a v1: **fall back to system CJK fonts** (PingFang / Hiragino / Yu Gothic / Noto). Excellent on every platform, zero bytes, standard practice. ⚓ **This de-risk should be folded into the plan** — it removes the single largest anticipated cost.
- ⛔ **But the ORDERING kills it, and that is decisive.** The wording rewrite (§13) is happening _today_. Extracting and translating before that text settles means translating strings we are about to rewrite and keying strings we are about to change — paying twice and churning the locale files immediately. Self-inflicted.
- ⚠️ Secondary: day 2 is already full, and **Tier C (theorycrafting jargon) is text the plan says to leave in English anyway** — so "UI in Chinese" would in practice be chrome/nav/static/buttons translated while tool interiors stay English. Defensible v1, smaller win than it sounds.

**→ Resolution: FIRST post-launch work, ~a week out. zh-Hans + ja only, system CJK fallback, no Plex CJK.**

### ⚓ The near-zero-cost pre-launch move — a REAL constraint on Part A + B

**The launch checklist is about to write a lot of NEW user-facing English:** the error page, the 404, the small-screen notice, the BETA explainer, the feedback copy, OG descriptions, and two passes of rewritten static prose. If that lands as scattered hardcoded literals, every line has to be hunted down again in Phase 3. **Write the new strings extraction-ready** (or minimally, land them in one place) — pre-pays a real chunk of the extraction pass for almost nothing.

⚓ **The UI half of the legibility/simplification pass is DONE** — absorbed by the per-tool surface reworkings (on-the-scene rounds, Compare/Audition, bench card, motion). ⛔ It is no longer an open launch gate; stop treating it as one.

**What remains is a plain-language pass:** making user-facing notes, labels and instructions **simpler / less technical**. 👤 Nate drives; Claude helps on specific wordings when asked.

### The sequencing call ↻ REVISED 2026-08-14 (Nate pulled the rewrite pre-launch)

Nate's question was whether the i18n Phase-1 audit is the natural way to gather text for the rewrite. **Yes as the vehicle — but the rewrite runs FIRST and does not wait for it:**

```
rewrite IN PLACE, pre-launch (Part B §13 — Nate-led, surface by surface)
   → LAUNCH
      → touch-up rewrite, informed by real feedback   ← the cheap second bite
         → inventory / audit (grouped by surface, tier as a column)
            → extract to keyed strings (Paraglide)
               → zh-Hans + ja  → everything else
```

⚠️ **An earlier version of this plan put the whole rewrite AFTER launch**, reasoning that user feedback is the best input to "make this less technical." That reasoning is still true — but it is now served by the **touch-up** step, and Nate's pre-launch pass wins on two counts the deferred version couldn't: launch text should be good _on arrival_ (first impressions are the one thing a later fix can't recover), and the static pages are being restructured _anyway_ as part of the checklist. ⛔ Don't re-litigate this back to the deferred version — the touch-up step is what preserves its benefit.

- ⚠️ **Rewrite IN PLACE first, extract second — never both at once.** Otherwise every wording change is entangled with a structural refactor and neither reviews cleanly. This is why translation cannot precede the rewrite.
- ⚠️ **A flat string catalog is the WRONG medium for a wording review.** i18n wants atomic, dedupable, tier-classified strings; the English pass wants **context** — a label is judged against its neighbors on its surface, never alone. Same sweep, different ordering: emit the inventory **grouped by surface/route with where-it-renders noted**, with Tier A/B/C as a _column_, not the organizing axis.

### Two gaps in `docs/design/i18n-plan.md` found by the 08-14 audit

- ❗ **`caveat` strings are a FOURTH tier the plan has no bucket for.** Measured: **256 caveats across 89 of 123 characters** — more player-facing prose than the help pages (~4,000 words). Not Tier A (not game data, not free from genshin-db), not Tier B (not UI chrome). They are **curated prose**. ⚠️ **Decide translatability AT AUDIT TIME**: if caveats are translatable, every future character ingest adds permanent translation debt in six locales, coupling the curation pipeline to a translation loop. Cheap now, very expensive to reverse. _(Note: they may need the least English rewriting — the A7 pass + `caveat-style-guide.md` already did that deliberately. Confirm, don't assume.)_
- ❗ **KQM notation tokens are NON-EXTRACTABLE and the audit must mark them so.** `E`, `Q`, `N5`, `sQ`, and character names used as parser input. The parser matches on names — localized names would break both the notation contract and **every `?r=` link in the wild**. §1's canonical-key rule implies this; the audit must state it so nobody later localizes them "helpfully."

Everything else in `docs/design/i18n-plan.md` stands and is good: Tier A free from genshin-db, Tier B ~150–300 strings LLM-translatable, Tier C = keep the English jargon + localize the _explanation_ (an ethnography problem, not a translation one), Paraglide, IBM Plex as the extensible superfamily (✅ swap already merged `e0aa387`), and the orthogonality rule — **locale lives in the path/preference, NEVER in `?r=`.**

### Other post-launch

- **Mobile: real conversion decision** — ↻ 2026-09-05: CONVERTED in the structural sense (see §5); what analytics would still decide is how much polish the phone forms get (touch targets, the compact card). `docs/rounds/responsive-survey-2026-09-01.md` Part IV.
- **BETA tag removal** when the first feedback round clears.
- **Sample rotations** — seed 4–6 famous comps so the planner doesn't open empty; reuses the `?r=` deserializer. 👤 Comp selection is Nate's; wiring is Opus. _(Strong empty-state work — also the standing answer to "onboarding," see below.)_
- **Onboarding** — ⛔ standing recommendation: **no forced product tour.** Audience skews KQM-literate (would skip), tours anchor to CSS selectors so they break under any UI churn, and a "click Next 8×" modal fights the ethos. Prefer sample rotations + strong empty states, a "How it works" help section, and at most ONE dismissible coach-mark on the notation composer. If ever wanted: Driver.js, opt-in, after the UI settles.
- **⏳ 7.0 characters — Odette, Alyosha, Cryo Traveler — BLOCKED ON genshin-db, but the unblock is IMMINENT.** Checked 2026-08-14: installed **and** latest-on-npm are both `5.2.12`, published **2026-07-01** — six weeks _before_ 7.0 shipped (08-12). All three miss; a prefix scan of the 120-name list shows only Albedo/Alhaitham/Aloy. **Nothing to ingest yet.** ⚠️ But the release cadence is strikingly regular — `5.2.8`→`5.2.12` at +38/+42/+45/+40/+41 days — which put the next drop at **~2026-08-11, already 3 days overdue**, almost certainly holding for 7.0. **Re-check every few days; it may well land inside launch week.** When it does, everything but frames is ready via the `ingest-character` skill (frames follow separately via `gcsim-frames`). ⛔ Not launch-blocking — a missing brand-new character is a normal, expected state for a Genshin tool, and shipping stubs would be worse.
- **Data:** `docs/rounds/hexerei-stellar-todo.md` 7.0 watch-list · Ayaka + Emilie FrameMaps · authorable stubs. Upstream-blocked (pre-release): columbina, durin, ifa, illuga, kachina, varka, zibai.
- **Deferred design:** Mono placement evaluation (numeric readouts / timeline E-Q badges / capability tags), `--font-condensed` (registered, applied nowhere), `docs/rounds/team-builder-atlas-roles-facets.md` Increment 2.

---

## ✅ Shipped — the record

All three tools are built, merged, and on `main`. Launch readiness has been a **presentation + usability** question, not a curation-depth one, since 2026-07.

**Tools:** Rotation Planner redesign `80da4f5` (+ PNG export) · Team Builder feature-complete `3742300` · Visualizers 8-instrument roster `752d967` · P4 parser event-stream refactor `70daaec` · KQM-text export `26bd860`

**Data:** pipeline + A6 rigor pass `150f0d6` (1,688 constants verified) · capability sweep closed 2026-07-28 at 0 actionable · faction-buffs round (Hexerei + Stellar) 2026-07-29 · A7 caveat pass `8ca144e`

**Design system:** IBM Plex swap `e0aa387` (Bitter display / Plex Sans body / Plex Mono data — the i18n type foundation) + Sans/Mono standardization + site-wide type scale · design system + `/styleguide` `f625bc4` · unified chrome + Help/About areas `238a783` · static pages `60d828c` · brand mark + favicon `0ffd408`→`953a86f`

**The 2026-08 surface arc** (this is what closed the usability half): Genshin Night palette `0d1bcf3` → palette definition `6607b78` → band plates `e692de3` → bench band `9516685`/`c5fb762` → tall bench `c869861` → aside column `a5ea9bc` → bench card `35b8085` → bench tail `07933ca` → element palette `771910e`/`1ec509e` → UI state colours `fe9b031` → motion round `9ec6c10` → RP scene `a9950f4`-era → VZ on-the-scene `847acdb` → notation single truth `5b08b3a` → TB Compare/Audition `803ed86`→`4ca5356` → RP Source retirement `a9950f4`

**Infra:** Cloudflare Pages, `adapter-static`, `critcalc.app` live-but-noindexed since 2026-07-21 (`docs/rounds/deployment.md`)

**Verification:** 👤 Real-Safari backlog is **CLEAR as of 2026-08-17** — Nate verified the gauge round's L6/reposition/event-log/feed-order work, and then the mark-triggered round (Nahida's Tri-Karma pips and Fischl's A4, `docs/rounds/mark-triggered-damage-round.md`), in real Safari. ⛔ The policy stands: new visual work re-opens a backlog of one. ↻ _History, kept because it is the pattern:_ the backlog was cleared 2026-08-14 and **RE-OPENED 2026-08-15/16** — Nate has confirmed the 08-15 rounds **functionally** — "bars are emitting properly", the infused-block tint, the ICD and infusion output — but that was in-tool, ⚠️ **not a stated Safari pass.** Everything from `fec93f8` onward is new visual output: reaction-driven buff bars, infused inputs drawing in their infused element, Citlali's and Hu Tao's new bars, and **stance bars on 27 characters now ending at their real duration instead of at the swap**. ⛔ The policy stands: nothing Safari-facing is verified until he looks.

---

## 👤 Nate-only actions

- The **OG image** (1200×630) — visual call
- The **analytics** decision (and `/privacy` if yes)
- The **feedback channel** pick + whether the repo is public
- **BETA tag** wording + its end condition
- His **accumulated cleanup list**
- The **real-Safari pass** before the flip
- **The flip itself** — delete only the `X-Robots-Tag` rule, redeploy, `curl -I` to verify, announce

---

## Read for context

- `docs/rounds/deployment.md` — Cloudflare Pages / DNS / AI-crawler detail
- `docs/rounds/mobile-conversion-plan.md` — ⛔ don't reintroduce ad-hoc breakpoints
- memory `feedback_gate_cadence` · memory `feedback_verification_policy` — ⏱️ `test:e2e` is a PRE-MERGE gate; visual + Safari verdicts are Nate's eyes
- `docs/design/i18n-plan.md` — the localization plan (⚠️ two gaps flagged above)
- `docs/rounds/palette-definition-round.md` · `docs/rounds/style-reference.md` — for the BETA tag and the small-screen notice
- `docs/rounds/tool-constitutions.md` · memory `project_design_constitution` — what the tools refuse to do, and why

---

## 📦 Index lines retired from MEMORY.md 2026-10-18 (verbatim, superseded by the LAUNCH DAY line)

- **🧭 Next session:** ⚓ Nate: after the chore pass + landing look (🏁 below), **(re)write the STATIC PAGES' content** (checklist `docs/rounds/bench-portrait-round-2026-10-13.md` §4; absorbs TB step 6 copy + Help) — read the style guide + glossary + `docs/rounds/text-round.md` first; ask demo-vs-proposal (memory `feedback_ui_decisions`). ⚓ Rulings: ⛔ no gold fill/glow on paper · ⛔ no rules inside a control strip · toolbar groups at EVEN gaps · ⚠️ verify a width rule APPLIES · ⚓ a blocked hit still wears its element (faint). Pass shape: Nate live on `npm run dev -- --port 5179`; ⚠️ `git merge -F -` does NOT read stdin.
- **🚀 LAUNCH STATE (end of 2026-10-17):** ⚓ Nate postponed the flip to Sat 10-18 or Sun 10-19. `main` PUSHED at `54ccff9d` (e2e 75+75 on that exact commit): everything through the PNG parity sweep, nothing local unpushed. The day's rounds, all merged: Lumi, Neuvillette's Equitable Judgment, Varesa, Prune, the small-fix batch, absorption + Sayu, absorbed fill, Lunar gleam, tick ink, PNG parity.
  - `polish/static-pages` is LOCAL + UNMERGED (⚓ Nate: push main only). It is checked out in the main worktree, Nate's dev server on 5179. He has reviewed About only; his WIP is committed `654672d4`, and the spots flagged to him are open (a coverage sentence lost its verb, a `...` ellipsis, trailing spaces).
  - ⏭ **Nate next:** real-SAFARI pass, including today's visuals (absorbed fill, Lunar gleam `mask-image`, tick ink, PNG export). Also still wanting his eye: the Varesa and Neuvillette visuals, and Qiqi C4's new `notModeled` string.
  - ⏭ **Launch order:** Nate's page review → merge static-pages (merge main into it first) → landing mobile + banner → e2e on final main → Safari pass → push → delete the noindex line.
  - Worktrees: ↻ 2026-10-18 all swept — only the main checkout remains (on `polish/static-pages`, main merged in at `ac7e4964`); every extra worktree and merged branch deleted. ⚠️ A worktree whose `node_modules` is a SYMLINK breaks `vite dev` (fs.allow); clone it instead (`cp -Rc ../critcalc/node_modules`).
- **🏁 FINAL STRETCH** — [Launch Roadmap](launch-roadmap.md) § FINAL STRETCH PLAN + 🧹 CHORE QUEUE. ✅ bug sweep, feedback form, LICENSE, mobile + widescreen sweep, first `/daily-checkin`. ✅ chore pass (`01ea91d4`) · ⏭ landing on mobile WITH Nate · ⏳ Stardread Moon Chinese-only on lunaris — re-check, then its `abyss` line + fetcher · ③ static-pages rewrite (creed lines talk FIRST; `docs/rounds/static-pages-inventory-2026-10-14.md`) · ✅ PNG export redesigned + merged `2d6a2a52` 2026-10-16 (scene backdrop with a soft star keep-out, the live ribbon/cards via `exportBench.ts`, notation + tab name beside the lockup, timing + length lead the footer, full-width trailing bars — ⛔ the end-cut + fade was tried and REJECTED by Nate, adaptive DPR for canvas caps) · ✅ Stardread Moon Abyss merged `3bf3999c` (fetcher matches a blank-English cycle on its Chinese name) · ✅ first-visit SAMPLES merged `68a1bf42` (15 in `plannerSamples.ts`, tab-level builds, Notes credit; ⚓ first visit only, ⛔ no Library section — a future catalog reads the list, not storage) · ✅ Lumi's strikes merged `504131f1` 2026-10-17 · ✅ Neuvillette EJ merged `83cfb027` (droplets COUNTED, ⚓ Nate; no count notation) · ✅ Varesa Fiery Passion merged `bbf31938` (timed Blessing, `sim/timedBlessing.ts`, shared charges) · ✅ Prune merged `db700d30` (`'reactor'` target, `source: 'others'`) · ✅ small-fix batch merged `6dc64d1d` (Collei 6.3s, Charlotte, Qiqi C4, Nilou aura `appliesOnly`, Mavuika Phase 3) · ✅ ELEMENTAL ABSORPTION merged `3930b806` + Sayu / absorbed fill / Lunar gleam / tick ink / PNG parity (see `docs/rounds/elemental-absorption-survey.md`, memory `feedback_png_export_mirror`) · main PUSHED at `54ccff9d` 2026-10-17 (e2e 75+75 green, incl. PNG parity); polish/static-pages still LOCAL, unmerged (Nate: push main only) · Mona pop/Omen: low priority / post-launch · pre-flip: animation sweep, BETA note, Source link (AGPL §13), narrower re-sweep, real-Safari pass.

## ⏭ Post-launch ideas logged 2026-10-18 (⚓ Nate)

- A dedicated visual style for the static pages (/about, /help, /library, …) — they share the pages panel today; Nate is "debating" a distinct look. Not before launch.
- The Roster/Library page's look (it renders the overlay's body in the pages panel).
- 🆕 2026-10-19 AURA AUDIT (pre-launch agent, gcsim-verified, reproduced in a throwaway vitest) — POST-LAUNCH ENGINE, first:
  1. ⚠️ CORES HEAR ONLY POST-ICD HITS: the gauge is fed post-ICD applications (aura.ts ~460/672/803/885), but in gcsim a dendro core is its own target with fresh ICD (`dendrocore.go` Attack checks nominal Durability; ICD applied to the enemy's copy, `pkg/enemy/attack.go:137,143`). An Electro N3 on Standard ICD pops 1 core for us vs 2–3 in gcsim; Burning can Burgeon up to 8×/2s vs our 1×. Fix = split the gauge input: raw hit stream for cores, post-ICD for the aura. Undercounts Hyperbloom/Burgeon. Game behaviour not in docs/library — confirm.
  2. BURNING-TICK BURGEON DROPPED: Burning's internal Pyro (gauge.ts ~582) can consume a core → `burgeon` with appIndex null → aura.ts ~320 `continue`s it away. Breaks the "internal Pyro never reacts" premise (SimEvent.appIndex doc, offerApplication ruling, gauge.test 'never null'). Needs an owner for the Burning tick (gcsim: burning attack's ActorIndex).
  3. minor: Nilou A1 Bountiful Cores (0.4s, not hyperbloom/burgeon-able; gcsim nilou/asc.go, bountifulcore.go) unmodelled — gadget strip only.
     Not a bug: Swirl on Burning-without-Pyro (library §3.9 sides with us over gcsim's TrySwirlPyro).
- 🆕 2026-10-19 TRANSITIONS REVIEW (post-launch): Back→Forward within the 600ms exit revives the tools layout at full opacity (out-only transition resumed); same-path nav within HOLD_MAX_MS blinks (bail when from===to); resize mid-transition leaves a stale pose (target computed once, transition.ts:363); same-tab EXTERNAL links would start a descend (guard on nav.willUnload/origin) — latent while every external link is target=\_blank, so the AGPL Source link must be \_blank. Speed proposal: PAN_MS 2400→2100, TOOL_NAV_MS 2000→1750 (or 1800); smallest knob = localStorage override read at load + `__scene.clocks({pan, toolNav})` that reloads.
- 🆕 2026-10-19 (⚓ Nate): GAUGE EXPLORER — add Lunar-Charged and Lunar-Crystallize as options. LC ticks every ~2s (gcsim `lunarcharged.go`, per-enemy `lcIcdKey` 2\*60; 0.4U off both auras per tick, as EC) so auras drain ~half as fast; LCrys consumes Hydro ×0.5 like Crystallize but has NO 1s cooldown (`lunarcrystallize.go` never reads `crystallizeGCD`). The help chapter discloses both as unmodeled until then.
- 🆕 2026-10-19 (⚓ Nate): PLAYBACK LATENCY CALIBRATION (Genshin rhythm-mode tap test in Settings) — ONLY IF the automatic correction (cursor reads `ctx.outputLatency + baseLatency` late, commit 'the cursor follows what you hear') proves wrong on real Bluetooth devices. `__playback.delay(ms)` in the console is the by-ear offset such a screen would set. ✅ Nate tested 2026-10-19 over Bluetooth audio in Chrome AND Safari: the reported latency is precise enough, a mid-play device switch re-aligns. So calibration is NOT needed — revisit only if a user reports drift on another device.
- 🆕 2026-10-19 (⚓ Nate): ONE TRAVELER in the Planner. The Builder enforces it since `0d81b2cb` (`characterKey` in `characterLookup.ts`: every `traveler_*` is one character; a second variant takes the Traveler's slot), but the Planner's notation can still name two variants in one rotation. Likely a composer flag (notationFlags.ts) rather than a parser refusal; decide with Nate.

## 🧭 HAND-OFF, end of 2026-10-18 session (read first next time)

Shipped today (all merged to main; see git log for hashes): pinned composer, Lynette last shot (gcsim), TB two-click move (§11.6 overturned), motion sweep (one shared nudge), star veil (live + PNG, `__scene.veil()` knobs; tune(nate) floor .5 / ceiling .9 / inset 90), PNG wordmark 400 + tracked, NB bloom fix, brand keep-out returns with the lockup, aura-log head trimmed to 2 lines, sample 4★ cons + `plannerSamples.test.ts`, `/library` page + chrome About/Help/Roster as LINKS off-tool (Settings modal), Library window border, and the PHONE LANDING round (`polish/landing-launch`): `__scene.shift()` = 0.21 (world right, narrow only), banner = endgame line ("Spiral Abyss (Oct 16) · Stygian Onslaught 7.1", data-driven) + "117 characters modeled · 4 in progress" (Traveler once, Blank excluded), headline a rung above lines, TALL card on phones narrower than 3:5 (`heroArt.ts` TALL_EXTRA 140 inserted at y 515, TALL_ART_DROP 70), phone cards hang from the scene layout's CSS `--horizon-y` (HORIZON_POINT_DEPTH 0.3), footer "an unofficial fan project not affiliated with HoYoverse" site-wide, HRule `--rule-size` (7.5px on phones for cards + footer).
⚠️ Traps learned today: an inline `style` on .composition beats media queries — inline only -base/-tall var NAMES; `--horizon-y` already exists in the scene layout (distance from BOTTOM) — never shadow it; a worktree with a SYMLINKED node_modules breaks `vite dev` (cp -Rc).
⏭ NEXT SESSION — Nate's chores:

1. Team Builder: a one-click "Clear lineup" button (check §11.6 + band B's fold first; copy needs Nate's approval).
2. Tune the ascend (PAN_MS 2400) and tool-to-tool (TOOL_NAV_MS) speeds by eye — ⛔ these are Nate-tuned clocks; expose live console knobs (the `__scene.veil()` pattern) and land his values as tune(nate).
3. Audit the "extraneous spots" (agent-friendly, findings first): the loading veil's logic, +error.svelte (404), the render-error boundary in (tools)/+layout, any server-error page/\_headers/\_redirects behaviour on Cloudflare Pages.
   Still open from before: static-pages review (polish/static-pages, local) → merge; AGPL §13 Source link (repo must go public first; history audit); real-Safari pass (today's visuals added); delete noindex at flip.

- ✅ **DONE 2026-10-19** (merge `6da0d023` into polish/static-pages): 155 maps carry `W`, 16 held back (writer `migrate-frames-shape.mjs --walk`), W flag retired. ⏭ The Planner help's W paragraph still says a walk "saves no frames" — now false for many kits; Nate to reword. Original entry: **Walk overrides data round (queued 2026-10-18):** step 1 (`W` resets the string, the previous action ends at `anim`, 1-frame walk) went to an agent on `fix/walk-resets-string`. Still owed: capture gcsim's per-character `ActionWalk` overrides (36 normal-attack entries + plunges/skills, 79 characters) through gcsim-dump → frames audit → writer. Evidence: gcsim `exec.go` resets the normal counter on any non-attack action; `InitNormalCancelSlice` leaves Walk at the full animation. The old "a walk keeps the string going" belief (tokens.ts comment, help copy) was WRONG.

## ⏭ HAND-OFF — end of the 2026-10-18 session (second note)

- Branch `polish/static-pages` at `ab6e3900`, clean, NOT pushed, NOT merged to main (main merged INTO it at `ac7e4964`; main itself = origin/main `77f6900f`). Only one worktree; every merged branch deleted.
- ✅ Reviewed + committed with Nate: About, Beta (first person), Contribute (genshin-db off the upstream list), FAQ (home-screen links, question headings styled `.prose h3` → chrome/fs-2xl/1.8rem↑), Privacy (claims verified vs code), Planner help (both halves; composer squiggles demoed via `.prose code.flag-warning/.flag-approx`).
- ✅ Engine: `W` resets the attack string + ends the prior action at `anim` (merge `43da2938`); W carries a yellow squiggle UNTIL the walk-overrides data round lands (Nate: keep it till then).
- ⏭ Left: the Builder and Visualizers Help chapters → merge static-pages → the rest of the launch order above (landing polish with Nate, animation sweep, e2e on final main, Safari pass, push, delete noindex). e2e last ran green on main `77f6900f`; NOT run on this branch.
- ⏭ Rulings from today: "I" for the personal, "we" for modelling decisions (style guide §1.4); Oxford comma everywhere (Nate asked me to watch for it on every page); no AI credit on site (memory `feedback_no_ai_credit_on_site`); the details-card link reads "Something not right with this character?".
- ⏭ Chores: ledger inventory still carries old W strings (`extract-strings.mjs --write` rewrites 28 stale files — its own chore).
