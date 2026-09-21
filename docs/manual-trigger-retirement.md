# Retiring the `manual` trigger — plan (2026-09-15)

_Status: ✅ **ALL THREE STEPS SHIPPED. The record is
`docs/manual-trigger-retirement-round.md`, which WINS over this file wherever
they differ** — in particular this plan's "retire the flat-DMG add-ons" (it
named Gorou A4) was overturned by ⚓ Nate on 2026-09-21 in favour of the
`passive` + `*FlatDmg` house form, and its "re-trigger OR caveat the rest"
framing was replaced by ⚓⚓ one effect PER IN-GAME SOURCE. Final census was 127
effects / 62 characters, not the 167 / 69 below; `manual` is now struck from the
`Trigger` union and characterLint B.18 refuses it._

_Original status: STEP 1 SHIPPED 2026-09-15 (`deriveCapabilities` skips `manual`;
derived capabilities 783 → 669, 114 claims gone across 55 characters, 0 added —
the census is in `essential-characters-2026-09-15.md` §6.6). Steps 2–3 open.
⚓ Nate's decision 2026-09-15: retire the channel. ↻ 2026-09-18: the
stack-threshold round re-triggered 11 of Columbina's 12 to `onStack`
(`docs/stack-threshold-round.md` §5); the corpus stands at **130 effects across
63 characters**._

## 0. What it is and why now

`trigger: { type: 'manual' }` was meant as "the player toggles it". It has ONE
occurrence in `src` — its own type declaration — so no planner surface has ever
read it. **167 effects across 69 characters** are authored into it. Found
2026-08-18 (rubric N1), left as a fork in `docs/curation/caveat-open-items.md`
§4, and then hidden twice: the ruthless caveat pass deleted the caveats over
those gaps, and `deriveCapabilities` never inspects triggers, so the **Team
Builder derives all 167 as live capabilities** — including at least one
fabricated value (Wriothesley's +50% ATK on Icefang Rush, no source in game or
gcsim). The two surfaces disagree about the same effect, and only one of them
can be caveated.

## 1. Three steps, in this order

1. **The TB skips `manual` today.** One filter in `deriveCapabilities` (and
   the index regenerates). Measure: the capability diff before/after — every
   claim that vanishes is a claim the planner never honoured. ⚠️ Some vanish
   that a user would miss (Columbina C6, Xiangling C6, Sucrose C6): that is the
   point — they were never true on the timeline, and step 3 brings back the
   ones that can be.
2. **Lint refuses the trigger** (`characterLint`, strict) — after step 3 lands
   for a file, or as a corpus-wide rule with an allowlist that shrinks. Strike
   `'manual'` from the `Trigger` union last, once the count is 0; strike the
   rubric's N1 and the open-items §4 entry.
3. **Work the 167.** Per effect, one of:
   - **re-trigger** — many are `onCast`-shaped (Arlecchino C6, Nahida C4,
     Xiangling C6, Shenhe A1/C2, Clorinde C6, Chevreuse A4) or `onHit`/proc
     shaped (Citlali C4 skull, Yelan C2, Ororon's Hypersense host);
   - **retire** to `description` + `_curatorNotes` where no trigger exists or
     the value is damage magnitude (Mualani A4/C1, Bennett C4, Emilie A4,
     Lauma C2/C6, Gorou A4, most Wriothesley entries);
   - **defer** to a named engine primitive where one is already queued
     (Columbina → `docs/stack-threshold-round.md`; Yae C4 / Chevreuse C6 →
     summon-tick buff collector; `maxProcs` cases).
     Order: the 65 essential characters first (the per-character calls are
     already made in `essential-characters-2026-09-15.md` §2–§3), then the rest.
     ⚠️ Each retire needs a caveat check: if the absence is a visible blank
     (a lane the character populates elsewhere), name the pixel.

## 2. Measurement

- Step 1: TB capability census before/after, listed by character.
- Step 3: corpus parse at C0 and C6 per file — a re-trigger must ADD windows,
  a retire must be byte-identical (it never drew).
- Guard: the lint rule itself, plus `orphanedSchema` no longer needing a
  `manual` entry.
