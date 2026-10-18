# critcalc style guide — the site's voice

**Status:** ✅ RULED by Nate 2026-09-22 — every recommendation below accepted as written.
Round record: `docs/text-round.md`.
**Scope:** every user-facing string except character `caveat`s, which have their own
guide (`docs/curation/caveat-style-guide.md`) and are ⛔ out of the rewrite.

⚓ **This is DERIVED, not invented.** The site already has a distinctive voice; almost
everything below is a description of what the best existing copy already does, written
down so it is reproducible across 800 strings, six locales and future sessions. Where a
rule is a genuine _change_, it says so and is marked ⏭ for Nate.

---

## 1. Voice

### 1.1 The one-line brief

> **A knowledgeable player explaining a mechanic to another player who is also good at
> this game — and saying plainly where the explanation stops.**

Not a manual, not marketing, not a tutorial. The reader is assumed competent. The
register is _peer_, and the site's confidence comes from knowing what it does not know.

### 1.2 Say what it is, then say why

⚠️ **What is worth keeping here is the MOVE, not the wording** — the passage below is
quoted as a working example of the technique, not as prose to preserve (round record R5).
It is also the clearest contrast with §1.3: this is a real explanation, where "no
verdicts" had become a slogan.

> **Walk-cancels aren't simulated.** KQM's `W` is recognized and then ignored — it
> changes nothing about the timing. That is deliberate rather than pending: a
> walk-cancel's whole value is ending an animation early while keeping the attack string
> […] and modelling it badly would be worse than not modelling it.

↻ **The passage's CLAIM is retired (2026-10-18)**: `W` is simulated now — gcsim resets the
attack string on a walk and starts it only at the animation's end, so the "keeping the
attack string" reasoning was wrong (branch `fix/walk-resets-string`). The move it
demonstrates stands.

A limitation stated _with its reason_ reads as rigor. The same limitation stated bare
reads as a gap. ⚓ **Never strip a "why" to save a line** — that sentence is the reason
the audience trusts the tool.

### 1.3 ↻ Describe what the tools do. ⛔ Don't recite a creed. (⚓ Nate, 2026-09-22)

⚠️⚠️ **This section previously held up the site's "no verdicts" phrasing as the voice's
high point. That was wrong, and Nate's account of where it came from is why:**

> _"The 'visualize mechanics, never calculate verdicts' phrasing was created by Claude
> while we were brainstorming guiding principles […] I thought the 'never verdicts' part
> would help be a kind of 'guiding star' for the AI. Little did I know that when something
> is set down as a rule, AI tends to become only more and more legalistic. That one phrase
> has spun down into more and more phrases that are very strict."_

⚓ **The underlying idea is true and stays: the tools show you how the game works and
leave the judgment to you.** What goes is the **register** — the absolutism, the
slogan-shape, and above all the repetition.

**Measured, because "it sounds like a catchphrase" deserves evidence.** The formula
appears **~10 times across 7 surfaces**:

| Surface                    |                                                                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `About.svelte`             | "visualizes mechanics, never verdicts" + "no damage totals, no tier lists, and no 'synergy scores.'"                                 |
| `Faq.svelte`               | "shows mechanics, not verdicts: no damage totals, no tier lists, no 'synergy scores.'" + "the judgment stays yours."                 |
| `TeamBuilder.svelte`       | "Facts, never a score."                                                                                                              |
| `RotationPlanner.svelte`   | "it never computes damage numbers."                                                                                                  |
| `AnatomyInstrument.svelte` | "Fixed order, no verdicts: the bars speak for themselves."                                                                           |
| `WishInstrument.svelte`    | "Odds only — no verdicts on whether to pull."                                                                                        |
| `seo.ts` ×3                | "Mechanics made visible — no tier lists, no verdicts." · "visualize mechanics rather than reduce them to a score." · the OG alt text |

🐛 **About and the FAQ are near-identical sentences.** ⚓ **Said once it is a position;
said ten times it is a jingle** — and a jingle is exactly what makes a one-person project
read as a company.

### The rules that replace it

- ⚓ **It is a DESCRIPTION, not a vow.** It says what the tools do today, ⛔ not what they
  will never do. ⚠️ The engine has got accurate enough that damage numbers are no longer
  out of reach — they are simply **not the goal right now**. ⛔ So never write "never"
  about the project's future.
- ⚓ **Say it where someone actually asks.** About, once, in the project's own voice; and
  the FAQ question that literally asks "does it tell me my damage number or the best
  team?" ⛔ Everywhere else, just describe what the thing in front of the reader does.
- ⛔ **Don't append a refusal to a feature description.** "Ticks mark a summon's cadence"
  needs no "…and we pass no judgment on it."
- ✅ **Still true, and keep it:** state a limit plainly, and ⛔ never apologize for it. No
  "unfortunately", no "we hope to add", no hedging that turns a decision into a shortfall.
  ⚓ §1.2 is where that lives, and it is unaffected.
- ⚓⚓ **And be HUMBLE** — §1.3b, which is how that sits beside "never apologize."

### 1.3a ⚠️ The tells — what "corporate" sounds like here

⚓ Written out because the same tics will surface across all 17 remaining sheets, and they
are easier to catch by shape than by feel.

| Tell                                                                                | Live example                                                    |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| **The rule of three** — a triad of negations, the oldest marketing cadence there is | "no damage totals, no tier lists, no 'synergy scores'"          |
| **Antithesis as a crutch** — _X, never Y_                                           | "Facts, never a score" · "Odds only" · "Mechanics made visible" |
| **The aphorism** — a short clause hung on a dash, landing like a tagline            | "the bars speak for themselves" · "the judgment stays yours"    |
| **"by design"** — turns an explanation into a defense                               | "No, by design."                                                |
| **Abstract nouns doing the work** instead of a verb and a thing                     | "the judgment stays yours"                                      |

⚓ **The antidote is SPECIFICITY, not warmth.** The most personal phrase on the site does
not use "I" and is not friendly — it is **"critcalc is one person's project"** (the error
page). It reads that way because it is _specific and admits something_, which is what a
company's copy structurally cannot do.

⚠️⚠️ **Its own continuation is the counter-example**, and worth seeing side by side: the
clause that follows it — _"and reports are how problems get found"_ — immediately spends
the credit by explaining something the reader already knew (§1.3c). ⚓ One sentence, both
moves.

↻ **The "I" question was re-opened and re-ruled** (⚓ Nate, 2026-10-18): "I" for what is
personal, "we" for modelling decisions. See §1.4.

### 1.3b ⚓⚓ Humble, without apologizing (⚓ Nate, 2026-09-22)

⚠️ **These two rules sound like they contradict each other and do not, because they are
about different objects:**

|                   | Is about                                                                     | So                                                                       |
| ----------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **⛔ No apology** | **the work** — what the tool does, what it refuses, what it has not measured | Those are decisions. State them flatly.                                  |
| **⚓ Humility**   | **the authority** — how much we know, and whose judgment the answer is       | ⛔ Never posture. Cite, invite correction, leave the call to the reader. |

⚓ **Nate's intent, in his words, and it is the reason this rule exists:**

> _"I am not a 1.0 player, I don't have all the characters, I don't have the game knowledge
> or math skills that many others in the community do, and I am in need of as much help as
> I can get."_

**What that means on the page:**

- ⛔ **Never imply the reader knows less than the site does.** The audience is
  KQM-literate; many of them know more than we do, and some of them will be reading a
  mechanic they have measured themselves.
- ✅ **Cite instead of asserting.** "cross-checked against gcsim" is humble and stronger
  than a bare claim — it shows the work and lets a reader go check.
- ✅ **Admit the edges.** "Not yet curated" is humility about knowledge; "reports are how
  problems get found" is humility about correctness. Both already exist and both are the
  model.
- ⛔ **Don't perform it.** ⚠️ Humility is not self-deprecation, and ⛔ it is not a
  disclaimer bolted to the end of a paragraph. It is a _default posture_ — visible mostly
  in what the copy declines to claim.

⚓ **This is the same axis as §1.3a.** A jingle claims authority; humility disclaims it.
The corporate register and the immodest one are the same failure wearing two coats.

⚠️⚠️ **But humility is not the same as EXPLAINING YOURSELF, and this section originally
held up a sentence that fails on exactly that** — see §1.3c.

### 1.3c ⛔⛔ Don't explain what the reader can work out (⚓ Nate, 2026-09-22)

> _"If it's obvious, we don't need to tell the user — that's where it sounds
> condescending. […] using phrases that sound like instruction for something as clear as
> 'if you submit a report, we will learn about a problem' has the wrong kind of tone."_

⚓⚓ **Telling someone what they already know implies they did not know it.** That is the
whole mechanism, and it is why these sentences land badly even though every one of them
was written with good intent.

⚠️ **It contradicts the site's own brief.** §1.1 says the reader is assumed competent;
explaining the obvious says the opposite in the same breath.

### ⚠️ How this differs from §1.2, which is the rule it looks like it contradicts

|                 | Explains                                                                                   | Verdict                         |
| --------------- | ------------------------------------------------------------------------------------------ | ------------------------------- |
| **§1.2 — keep** | What the reader **cannot** know: a decision we made, a hidden mechanic, why a limit exists | ✅ This is the site's best move |
| **§1.3c — cut** | What the reader **can derive** from what is already on screen plus common sense            | ⛔ Condescending                |

⚓ **The test: could the reader have worked this out unaided? If yes, cut it.**

### ✅ Instruction is WELCOME — that is not what this bans

⚓ Nate is explicit: _"something like 'click here to do such-and-such' — that kind of
instruction is welcomed."_ ⛔ This rule does **not** make the copy terser or more coy. It
bans one specific move: **motivating an action by explaining its value**, rather than
offering the action and saying what it does.

| ⛔ Explains the obvious              | ✅ Tells them something                                           |
| ------------------------------------ | ----------------------------------------------------------------- |
| "reports are how problems get found" | "Report a problem" — and "include the share link if you have one" |
| "the judgment stays yours"           | (nothing — just show the chart)                                   |
| "the bars speak for themselves"      | "a ×2 box is the same width wherever it comes from"               |

⚠️ Note the right-hand column is often **shorter and more useful**: a non-obvious detail
does more work than a paragraph about why something matters.

### The 7 live instances

| Surface                    |                                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------ |
| `About.svelte`             | "so the judgment stays yours" · "the best thing you can do is…"                                  |
| `Faq.svelte`               | "the judgment stays yours" — 🐛 the same sentence as About, again                                |
| `Contribute.svelte`        | "The most useful thing you can do for this site is…" · "which is the point of the section above" |
| `AnatomyInstrument.svelte` | "the bars speak for themselves"                                                                  |
| `+error.svelte`            | "telling us what you were doing is genuinely useful — … reports are how problems get found"      |

⚠️ **"which is the point of the section above"** is the purest case: it explains the
page's own structure to the person reading the page.
⚠️ **"the best thing you can do" / "the most useful thing you can do"** are the same claim
on two pages, and both are prescriptive. ⚓ The underlying fact — that an upstream fix
reaches every community tool, not just this one — is genuinely **not** obvious and is
worth keeping. It is the framing around it that preaches.

### 1.4 ✅ Who is speaking — four speakers, each with a job (⚓ Nate, 2026-09-22; ↻ 2026-10-18)

↻ **2026-10-18 — "I" joins, for what is PERSONAL** (⚓ Nate, the static-pages review). Nate
writes in the first person where the sentence is about him: what he has tested, which
characters he owns, what he is asking readers for (the Beta page is the first). **"We" stays
for modelling decisions** in the Help chapters and the FAQ ("a token we don't simulate").
The split is option (a) of two; ⛔ (b), "I" everywhere a person speaks, was not taken.

| Form     | When                                                                              | Example                                                         |
| -------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| **"I"**  | the sentence is about Nate himself: his devices, his roster, his request for help | "I've only been able to test the site on the few devices I own" |
| **"we"** | a modelling decision (below)                                                      | "a token we don't simulate"                                     |

⚠️ Claude is credited in the repo, never on the site — so the reasoning in the "we, never I"
subsection below no longer explains "we" to a READER. It stays because it explains why
modelling decisions keep the plural.

Three speakers were in use before that, sometimes within a paragraph:

| Form           | Example                                                                 | Where                      |
| -------------- | ----------------------------------------------------------------------- | -------------------------- |
| **"we"**       | "a token we don't simulate", "we do not model walking out of it"        | Rotation Planner help, FAQ |
| **"critcalc"** | "critcalc takes no money", "critcalc deliberately visualizes mechanics" | About, Privacy, Contribute |
| **agentless**  | "Shatter is not modelled", "Timing is only ever taken from gcsim"       | everywhere                 |

⚓ **The ruling: all three stay, but each gets a job.** ⛔ Not "pick one" — flattening to
a single speaker would have cost About/Privacy/Contribute the register they already have.

- **"critcalc"** when the sentence is about _the project_ — what it is, what it costs,
  who it is affiliated with. (Keeps About/Privacy/Contribute exactly as they read now.)
- **"we"** when the sentence is about _a modelling decision someone made_ — "we use 1U
  and mark that tick yellow." This is where "we" earns its place: a choice has an author,
  and naming one is what makes §1.2's "why" credible.
- **agentless passive** for _facts about the game or the data_ — "Shatter is not
  modelled." No one's opinion is involved.

### ↻ "We", never "I" — the 2026-09-22 ruling, now narrowed to modelling decisions

> _"I'd like to use we, not I […] first of all I don't consider it 100% solo — you've made
> 100% of the actual wiring of the site, Claude — and from launch onwards I want to accept
> help wherever I can get it. So it's not really 'I'."_

⚓⚓ **This is a genuine plural, not a corporate one**, and that distinction is the whole
ruling. "We" is not a company voice being borrowed for gravitas — it is an accurate count
of who built the thing, and an open door to whoever helps next.

↻⚠️ **So the warning that used to sit here is WITHDRAWN.** It read: _"the failure mode is
'we' leaking into project statements, which sounds like a company."_ ⛔ That was wrong
about the risk. "We" is honest here and carries none of that freight.

⚓ **The three-speaker split still stands, but for a plainer reason:** match the speaker to
the **subject**, not to a fear of sounding corporate. "critcalc takes no money" is about
the _project_; "we use 1U and mark that tick yellow" is about a _choice someone made_.

⚓ **And "we" is the humbler pronoun** (§1.3b) — it declines to claim sole authorship,
which "I" cannot do. ⚠️ Nate keeps every judgment call; that is authorship of the
_decisions_, and it is not what the pronoun is reporting.

### 1.5 The reader is "you", always

Consistent today. Keep it. ⛔ Never "the user".

### 1.6 Concrete over abstract

> "under _Heal_, Bennett's burst lines up beside Kokomi's skill"

Named characters, real numbers, actual buttons. ⛔ Avoid "various", "a number of",
"certain characters".

### 1.7 Length: earn the second sentence

The corpus runs long, and mostly earns it. The test: **the first sentence says the
thing; every sentence after it is a "why" or a "what it assumes."** A second sentence
that only restates the first is cut.

⚠️ **Tooltips and empty states get one sentence.** The long form belongs in help.

### 1.8 ⚓ A reading of the reader's own settings says "would" (⚓ Nate, 2026-10-01)

When a sentence reads out a number computed from the reader's sliders, it takes the
conditional: _"Transformative reactions **would** deal 3.8 times their base damage."_ The
plain present ("deal") states a rule of the game; the number is only what the reader's
settings produce. ⚓ Tables, columns and chart labels stay bare — a number in a table
already reads as "at these settings". First applied: the Reaction Curves readout.

### 1.9 ⚓ Say only what the screen doesn't (⚓ Nate, 2026-10-01)

§1.3c's test applied to an instrument: ⛔ cut a clause the chart, the row or the table
already shows — "diminishing returns" under a curve that visibly flattens, "at 600 EM" beside
the slider that says 600, a sentence that restates a column. ✅ Keep what no part of the
screen can show: who it doesn't apply to, what a figure leaves out, why a control is absent.
Reaction Curves lost ~40px of readout to this with nothing essential gone.

### 1.10 ⚓ Write from the player's side of the screen (⚓ Nate, 2026-10-04)

Say what happens to **you** when you play, in the words players already use, ⛔ not what
the game's tables say about the items. ✅ "Without a guarantee, you'll win the 50/50 about
55% of the time." ⛔ "A 5★ that isn't guaranteed is the featured character 55% of the time"
is the same fact from the pool's side, and a player thinking "I want to win my 50/50"
can't map it back ("55% of… what?"). The Wish Odds explainers were rewritten this way;
tightening alone fixed the length and kept the wrong vantage. ⚠️ Keep what the number is
PER when the player's phrase hides it ("each 4★ you pull", ⛔ not per wish). First applied:
the Wish Odds pass.

---

## 2. Mechanics

|                               | Rule                                                                                                                              | Note                                                                                                                     |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Spelling**                  | ⚓⚓ **US English, everywhere** — modeling, labeled, canceling, behavior, color, center, defense, analyze, visualize              | ↻ Ruled 2026-09-22. ⛔ The old "Oxford" entry was an AI artifact described as a style. Glossary §4 has the 12 live fixes |
| **Headings**                  | Sentence case                                                                                                                     | Already consistent.                                                                                                      |
| **Buttons / tabs / controls** | Sentence case, no terminal period                                                                                                 | "Reset zoom", "Take slot"                                                                                                |
| **UI control named in prose** | **Bold**, matching the control's own label exactly                                                                                | `press **Compare**` — see §3.3, this is an extraction hazard                                                             |
| **Notation token in prose**   | `<code>`                                                                                                                          | `<code>N2</code>`                                                                                                        |
| **Time**                      | `6s`, `2.5s`, `×0.8` — no space, lowercase `s`                                                                                    | Consistent today                                                                                                         |
| **Frames**                    | "ten frames" in prose; `66f` only in dense chart furniture                                                                        |                                                                                                                          |
| **Percentages**               | `20%`, no space                                                                                                                   |                                                                                                                          |
| **Multiplication**            | `×`, not `x` — and it goes **before** the number (`×1.234`), ruled 2026-09-23                                                     | `×2 forward vape`                                                                                                        |
| **Quotes**                    | Curly `“ ”` in prose; straight in code                                                                                            |                                                                                                                          |
| **Em dash**                   | A space on each side (word, space, `—`, space, word) — and ⚠️ **at most one per sentence in new writing**                         | §3.4. ⛔ Keep the dashes; cap the density. §3.4a has en dash vs hyphen                                                   |
| **Oxford comma**              | Yes                                                                                                                               | Already consistent                                                                                                       |
| **Ellipsis**                  | ⛔ Avoid entirely — it reads as trailing off, which is the opposite of the voice                                                  |                                                                                                                          |
| **Exclamation marks**         | ⛔ None                                                                                                                           |                                                                                                                          |
| **Unicode symbols in prose**  | ⚠️ `⇄` and `✕` currently appear in help prose. Acceptable _only_ where the prose is naming a control that renders that exact mark | ⛔ Never decorative; the site's symbols are `<Mark>` geometry                                                            |

### 2.1 ⛔⛔ Capitals are NEVER emphasis — ⚓ Nate, 2026-09-22, absolute

> _"I never want to use uppercase as emphasis on the site, ever, period. I think it reads
> as amateur and immature."_

⛔ **No exceptions, no surface, no instrument.** Emphasis is `<strong>` or italics.

⚠️ Note this is a rule about **emphasis**, not about labels: an uppercase lane heading or
axis label styled by CSS is a separate question (§D of the instrument conventions sheet,
and `rotation-planner.md` §1), and it is decided on its own merits.

⚠️⚠️ **It is also the right call for translation independently of taste** — capitals
cannot carry emphasis in CJK at all, so the stress is simply deleted there, while
`<strong>` survives every locale.

**All three live sites** (a full sweep of extracted user-facing strings, not a sample):

| File                           | Now                                          |
| ------------------------------ | -------------------------------------------- |
| `AnatomyInstrument.svelte:511` | applied to **YOUR** current sheet            |
| `DefResInstrument.svelte:258`  | pushing **BELOW** zero still helps           |
| `WishInstrument.svelte:261`    | is **YOUR** charted weapon 37.5% of the time |

---

## 3. Writing for translation

⚓ **The English written here is the source text for six locales.** These rules are
structural, not stylistic: each one is free to follow now and expensive to retrofit.

### 3.1 ⛔⛔ A string is a whole sentence. Never assemble one from parts.

```svelte
❌  {count} characters match {filterName}
❌  <span>Cooldown</span> <span>{s}s</span>
✅  m.roster_match_count({ count, filter: filterName })
```

English word order is not universal. A fragment that reads fine concatenated here is
unorderable in Japanese and ungendered in French. ⚠️⚠️ **This is the single rule that
decides whether the extraction pass is mechanical or a refactor** — every `⚠ ASSEMBLED`
row in a worksheet is a small refactor deferred, so mark them and count them.

⚠️ Plurals go through **ICU** from the start (`{count, plural, one {…} other {…}}`) —
six locales have between two and four plural forms, and English's two hide the problem.

### 3.2 ⚠️⚠️ Dedupe by MEANING, never by spelling

`aria-label="Close"` appears five times and means the same thing five times → **one
key.** But if "Set" is ever a verb on one surface and a noun on another, those are **two
keys that share five letters**, and merging them produces a bug that is invisible in
English and wrong in every other locale.

⚓ The test is not "is the text identical" but **"would a translator, told only what this
string does, write the same word for both?"**

### 3.3 A control named in prose is a REFERENCE, not a copy

> "Press **Compare** on a character card…"

Today that word is typed twice — once on the button, once in the sentence. In six
locales that is a drift waiting to happen: the button gets translated, the prose doesn't,
and the instruction now names a control that does not exist.

⏭ **Recommendation, for the extraction pass rather than this one:** prose interpolates
the control's own message (`m.help_press_compare({ label: m.btn_compare() })`). For
_this_ round, the worksheet just needs to **flag every prose mention of a control** so
extraction can find them. ⚠️ There are dozens in the help chapters.

### 3.4 ↻ The em dash — ⛔ KEEP IT. I overstated the problem. (⚓ Nate asked, 2026-09-22)

↻⚠️ **Correction first.** This section, and the §2 table, called the em dash _"the biggest
translation friction in the current voice."_ ⛔ That was overstated and it is withdrawn.
The biggest friction by a wide margin is **§3.1, the ~25 assembled strings** — those force
a refactor. The dash is second-order.

⚓⚓ **The character is not the problem. DENSITY is.** Every target language has an
equivalent device — CJK uses a doubled `——`, French reaches for commas, and any of them
can split the sentence in two. A single dash setting off an aside translates cleanly. The
guessing starts when **one sentence's grammar depends on parsing two or three of them**,
because then the translator has to decide which clause modifies which.

⛔ **So do not eliminate them, and this is a recommendation against Nate's own offer to.**
Three reasons:

1. ⚓ **They are how §1.2 is built.** "Say what it is, then say why" is a dash construction
   almost every time it appears. Replacing each one with a colon or a period flattens the
   prose from _someone thinking_ into _someone listing_.
2. ⚠️⚠️ **The dash is INFORMAL — a colon is the formal option.** So swapping them out
   would push the site _toward_ the stiff register §1.3 just ruled against, not away from
   it. The dash is actively serving the personal voice Nate asked for.
3. ⚓ **It is Nate's natural voice.** It was amplified by AI, but it did not originate
   there, and there is no reason to spend a genuine signature on a second-order problem.

✅ **The rule stands unchanged, and it was already the right one:** at most **one per
sentence** in new writing, and ⚠️ rewrite an existing sentence only where the meaning
cannot be recovered without parsing its dashes. ⚓ That fixes the real problem and costs
the voice nothing.

### 3.4a ⚓ Real dashes, and why "too proper" is the wrong worry

⚓ **Correct typography is invisible; incorrect typography is what readers notice.** Nobody
has ever read an em dash and thought "how formal" — but a hyphen standing in for one reads
as a typo, and _that_ is visible even in Twitch chat. So the worry inverts: the risk of
being "too proper" is much smaller than the risk of looking sloppy.

|                 | Use                                    | Example                                               |
| --------------- | -------------------------------------- | ----------------------------------------------------- |
| **`—` em dash** | An aside or a reason inside a sentence | "most enemies resist 10% — shred subtracts from that" |
| **`–` en dash** | A numeric range, always                | `70–100%` · `0–75%` · `1–35 frames`                   |
| **`-` hyphen**  | Compounds only                         | `frame-accurate` · `off-field` · `4-line start`       |

⚠️ **The en dash in ranges is the one to protect.** It is genuinely correct, completely
unremarkable to a casual reader, and translates everywhere without a thought. ⛔ Never let
a range become `70-100%`.

⚠️ **Spaced or unspaced is a separate question from US English, and the site's spaced
`—` stays.** US style guides disagree with each other (Chicago sets it closed, AP sets
it spaced), so ⚓ Nate's US-English ruling does not reach it. Spaced reads better at the
small sizes this site uses. ⛔ It is not a Britishism.

### ✅ Type the real characters. ⛔ There is nothing to convert. (measured 2026-09-22)

⚠️⚠️ **The corpus is already correct**, which retires the "type hyphens and I will convert
them later" offer that used to sit here. Swept across every extracted user-facing string:

|                                    | Count   |
| ---------------------------------- | ------- |
| `—` em dash, correctly typed       | **112** |
| `–` en dash, correctly typed       | **4**   |
| hyphen standing in for a **range** | **0**   |
| hyphen standing in for a **dash**  | **0**   |

⚓ So the practice is established at 116 instances and there is no backlog. ⛔ Don't batch a
conversion; there is nothing to batch.

**Typing them** — macOS: `⌥ -` for the en dash, `⌥ ⇧ -` for the em dash. ⚓ Type them
straight into prose.

### ⛔ HTML entities are dated — with one exception that earns its place

⛔ **Never `&mdash;` / `&ndash;` / `&hellip;` / `&times;`.** Those solved a problem that no
longer exists: source files, Svelte components and the served pages are all UTF-8, so the
literal character works everywhere. ⚠️⚠️ **And for i18n they are actively harmful** — an
entity written into a string survives into the locale files, where every translator then
has to preserve a piece of markup they have no reason to understand. ⚓ Measured: the
corpus contains **zero** dash entities already.

✅ **`&nbsp;` stays, and it is the exception because the character is INVISIBLE in
source.** A literal non-breaking space is indistinguishable from an ordinary one in an
editor, so the entity is doing real work — it marks intent. 4 in use (the crit-multiplier
formula in the help chapter). ⚓ The rule generalizes: **use the literal character unless
the character cannot be seen or told apart in source.**

⚠️ `&amp;` ×8 is belt-and-braces rather than required, and is harmless. ⛔ Not worth a
sweep.

### 3.5 Every string carries a context note

One line: where it renders, what it does, what each variable is. Written while the
surface is in your head it costs seconds; reconstructed later from a flat `en.json` it
costs an hour and is often guessed wrong. This is what the worksheet's **`Where:`** field
becomes.

### 3.6 Length budget

RU / FR / ES run **20–30% longer**; CJK runs shorter with different line-breaking. Any
string already tight in its container is a future break. ⚠️ Flag it in the worksheet's
`Notes:` rather than discovering it in the pseudo-locale pass — a label that must stay
short is a _content_ constraint the rewrite should honor, not a layout bug to fix later.

### 3.7 Numbers through `Intl`

⛔ Never hand-format. French writes `1,95` where English writes `1.95`, and in a tool
about crit ratios that is not cosmetic.

### 3.8 ⛔ Never translate the frozen list

Notation tokens, character/ability/weapon names, stat and element names, theorycrafting
jargon, the brand. Full table with reasons: `docs/text-round.md` §2 R2.

⚓ For jargon the rule has a positive half: **keep the English term as the label and
localize the explanation.** "ICD" stays "ICD"; the sentence explaining what an ICD is
gets translated. This turns an impossible research task into a tractable one.

---

## 4. Quick checklist for a rewritten string

1. Does it say the thing in the first sentence?
2. If it states a limit, does it say **why**? (§1.2)
3. ⛔ Does it **recite the creed** instead of describing what is in front of the reader?
   Does it use the word **"never"** about the future? (§1.3)
4. ⛔ Does it **posture** — claim authority the project does not have? (§1.3b)
   ⛔ Does it **explain something the reader could work out unaided**? (§1.3c)
5. ⚠️ Any of the tells: a triad, an _X-never-Y_, a tagline-shaped aphorism, "by design"?
   (§1.3a)
6. Is it a **whole sentence**, not a template of fragments? (§3.1)
7. Right speaker for the claim — critcalc / I (personal) / we (modelling decisions) / nobody? (§1.4)
8. Any term on the glossary's banned list? (`docs/text/glossary.md`)
9. Does it fit its container at **+30%**? (§3.6)
10. More than one em dash? ⛔ Any capitals used as emphasis? (§3.4, §2.1)
11. Does it have a context note? (§3.5)
