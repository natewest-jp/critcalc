# Worksheet — Site chrome

**Surface:** the one bar on every page (`SiteChrome`), the compass overlay (`NavPanel`),
the footer, and the tool registry that feeds both.
**Pass:** 1 · **Strings:** 24 · **Guide:** `docs/text/style-guide.md` ·
**Glossary:** `docs/text/glossary.md`

## ✅ CLOSED AND APPLIED — 2026-09-22

⚓ Nate ruled the calls he wanted and **authorized the remainder to Claude**; the
outstanding blanks were decided and the whole sheet is in the code. A blank **New:** was
an approval, so those strings are unchanged by design.

**Applied:** `SiteChrome.svelte` · `NavPanel.svelte` · `ChromeModals.svelte` ·
`SiteFooter.svelte` · `tools.ts` · `vite.config.ts` + `app.d.ts` (the build-year
constant) · three e2e specs that asserted on a changed string.

⚠️ **Not applied, and deliberately:** the `/about` chapter's `<h1>` is still
"About critcalc". It is a different string from the chrome's glyph and it belongs to
**pass 2** — `e2e/site-chrome.spec.ts:147` still asserts it.

⏭ **Left for pass 2:** the footer's "unofficial fan project" now disagrees with About and
the FAQ, which say "independent, non-commercial fan project". ⚓ Nate's wording here wins
(glossary §4a); pass 2 aligns the other two.

---

## 1. The bar

| key                      | Where                                    | Now               | New              |
| ------------------------ | ---------------------------------------- | ----------------- | ---------------- |
| `chrome.brand.aria`      | Logo link, screen-reader name            | critcalc.app home | _kept_           |
| `chrome.wordmark`        | The wordmark beside the logo             | critcalc.app      | _kept_           |
| `chrome.about.aria`      | About glyph, screen-reader name          | About critcalc    | **About**        |
| `chrome.about.title`     | About glyph, hover tooltip               | About             | _kept_           |
| `chrome.help.aria`       | Help glyph, screen-reader name + tooltip | Help              | _kept_           |
| `chrome.settings.aria`   | Cog, screen-reader name + tooltip        | Settings          | _kept_           |
| `chrome.actions.aria` 🆕 | The glyph cluster's `<nav>` landmark     | Site              | **Site actions** |

`src/lib/components/SiteChrome.svelte:39,41,76,116,117,129,142`

✅ **The About pair now agrees with its neighbors** — one word for both the
`aria-label` and the tooltip, matching Help and Settings.

🆕 `chrome.actions.aria` was **missed in the first cut of this sheet** and is the fourth
"Site" (below). Called by Claude: the cluster is About/Help/Settings plus the compass —
**actions**, not destinations — so it must not share a name with the tool switcher's
"Tools" nor with the overlay's landmark.

---

## 2. ✅ "Go to" → **Navigate**, in all three places

🐛 It was an incomplete phrase, not a short one — no object. Almost certainly the first
half of "Go to {tool}", never finished.

⚠️⚠️ **And it lived in three places, not one** — the second and third were missed in the
first cut of this sheet:

| key                           | Where                                             | Now   | New          |
| ----------------------------- | ------------------------------------------------- | ----- | ------------ |
| `chrome.nav.label`            | The compass button's `aria-label` **and** `title` | Go to | **Navigate** |
| `chrome.overlay.nav.title` 🆕 | The overlay's **visible heading**                 | Go to | **Navigate** |
| `nav.aria`                    | The `<nav>` landmark inside the overlay           | Site  | **Navigate** |

`src/lib/components/SiteChrome.svelte:95` · `ChromeModals.svelte:22` ·
`NavPanel.svelte:34`

⚓ **One name for the control, the panel it opens, and the landmark inside it.** That is
what makes the button and its destination recognisably the same thing to a screen-reader
user — and it is also what frees "Site" to mean only the section heading (§4).

🆕 **`chrome.overlay.settings.title`** — `ChromeModals.svelte:26`, the cog overlay's
visible heading, **"Settings"**, also missed in the first cut. _Kept_: it already matches
its button.

---

## 3. ⚠️ The BETA tag

### `chrome.beta.label` — the tag beside the wordmark

**Where:** Site chrome, column 1, next to the wordmark. A link.
**Now:** beta
**New:** BETA
**Notes:** ⚠️ **Written lowercase and rendered uppercase by CSS.** Two consequences:
(a) in CJK there is no case, so the tag renders exactly as written — decide whether the
locale files carry `beta`, `BETA`, or the loanword; (b) any test matching on the rendered
text must match the _source_ casing (the e2e trap in `e2e/fixtures/critcalc.ts`).
`src/lib/components/SiteChrome.svelte:55`

### `chrome.beta.title` — its hover tooltip

**Where:** Same link. ⚠️ It currently points at **/contribute**, not at a beta explainer
— that page is not written yet and is owed by this round (roadmap §8).
**Now:** What beta means here
**New:**
**Notes:** ⚓ The roadmap's constraint on whatever this eventually links to: it points at
the **surface**, never the **data**. "The surface may be rough," ⛔ never "the numbers may
be wrong." The curation is the most rigorous part of the project and must not be hedged.
`src/lib/components/SiteChrome.svelte:55`

---

## 4. The compass overlay

| key                 | Where                                     | Now            | New               |
| ------------------- | ----------------------------------------- | -------------- | ----------------- |
| `nav.aria`          | The overlay's nav landmark                | Site           | **Navigate** (§2) |
| `nav.section.tools` | Section heading above the three tools     | Tools          | _kept_            |
| `nav.section.site`  | Section heading above About/Help/Settings | Site           | _kept_ ⚓         |
| `nav.here`          | Badge on the tool you are currently in    | You are here   | _kept_            |
| `nav.about`         | Row label                                 | About critcalc | **About**         |
| `nav.help`          | Row label                                 | Help           | _kept_            |
| `nav.settings`      | Row label                                 | Settings       | _kept_            |

`src/lib/components/NavPanel.svelte:34,36,47,53,58,61,64`

✅ **There were FOUR "Site"s, and the landmark was the wrong one.** ⚓ The decisive fact:
`nav.aria` wraps **both** sections — Tools _and_ Site — so naming it "Site" named the nav
after half its own contents. That is wrong on the merits, not merely duplicative.

⚓ **"Site" stays as the section heading** (⚓ Nate): "Pages" and "Documents" are both
worse, because About/Help/Settings do not open pages — they open overlays.

So the four resolve as: heading **Site** · overlay landmark **Navigate** · bar cluster
**Site actions** · overlay title **Navigate**.

---

## 5. Tool names

| key             | Where                             | Now              | New         |
| --------------- | --------------------------------- | ---------------- | ----------- |
| `tool.tb.title` | Nav overlay row, chrome title     | Team Builder     | _kept_      |
| `tool.tb.short` | Tool switcher (center of the bar) | Teams            | **Builder** |
| `tool.rp.title` | Nav overlay row, chrome title     | Rotation Planner | _kept_      |
| `tool.rp.short` | Tool switcher                     | Planner          | _kept_      |
| `tool.vz.title` | Nav overlay row, chrome title     | Visualizers      | _kept_      |
| `tool.vz.short` | Tool switcher                     | Visualizers      | _kept_      |

`src/lib/tools.ts:31–33`

✅ **"Builder" is the better set, not just the one Nate wanted.** Widths go **5 / 7 / 11 →
7 / 7 / 11**, so Builder and Planner become a matched pair instead of three different
lengths; and both are **agent nouns**, where "Teams" was a plural noun and read as a
different part of speech.

⚠️ **Width checked, not assumed:** the responsive survey measures the chrome's full form
at **664.8px** against the 47.5rem (**760px**) threshold — ~95px of slack. Two characters
at the switcher's size is ~12–16px, so the form lands near 679px and ⛔ the breakpoint
does **not** move. ⚠️ Re-check if another band-A control ever grows.

⚠️ **tight** — the switcher is the collapsible center of the bar and the first thing to
fold below 47.5rem. These three remain the strings most exposed to RU/FR/ES growth.

---

## 6. 🐛 The footer

### `footer.legal` — the whole line

**Where:** Bottom of the landing and every static page. One sentence, sized to sit on one
line at a laptop width.
**Now:** © 2026 **critcalc.app** — an unofficial fan project, not affiliated with or
endorsed by HoYoverse. Genshin Impact and all related trademarks and assets are ©
HoYoverse.
**New:** © {year} critcalc.app — an unofficial fan project, not affiliated with or
endorsed by HoYoverse. Genshin Impact and all related trademarks and assets are ©
HoYoverse.
**Notes:** Yes to making the date a rendered value. Let's remove the strong/bold.
And this wording wins; please save it for our glossary.

✅ **All three done.**

- ✅ **The `<strong>` is gone, so the line is ONE string.** That is what makes it
  translatable at all (style guide §3.1) — three fragments cannot be reordered.
- ✅ **"an unofficial fan project" is now the house phrase** and is recorded in the
  glossary §4a. ⏭ About and the FAQ still say "independent, non-commercial fan project";
  aligning them is pass 2.
- ✅ **The year is a build constant** — `__BUILD_YEAR__`, defined in `vite.config.ts`.
  ⚠️⚠️ **It could not be a clock read in the component.** The site is prerendered, so
  `new Date().getFullYear()` would bake the BUILD year into the static HTML and then
  compute the VISIT year again at hydration — the two disagree the first time a year
  rolls over between a deploy and a visit, which is precisely the mismatch
  `$lib/landing/announcements.ts` forbids. One `define` inlines the same literal into the
  prerendered HTML and the client bundle, so they cannot disagree. ⚠️ A redeploy moves
  it, which is the right behavior for a copyright line.
- ⚠️ **tight, and it did not grow** — the line was already stepped down a size
  (⚓ Nate, 2026-09-16) because it wrapped mid-phrase. The new text is the same length
  bar the markup. It still cannot absorb +30%.
  `src/lib/components/SiteFooter.svelte:16`

---

## Not in this sheet

The **tool switcher's glide**, the **help/about overlay shell** and the **settings
panel** carry their own strings and have their own sheets. The three glyph `alt=""`
attributes are correctly empty (the buttons carry the names) and are ⛔ not translatable
content.
