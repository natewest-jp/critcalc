# The cooldown-reduction round — queued, scoped 2026-09-16

_Bookmark, not a plan to execute in the session that wrote it. Scoped while
Varka's two-claymores round was loaded, because that is where the need surfaced
and where the facts were already in hand._

## 0. Why it is queued rather than ridden along

Varka's Four Winds' Ascension wants **`charges: 2` + "starts on cooldown"**, and
⛔ **that half cannot ship alone — it would make the tool worse.** The kit says
"Starts on cooldown and has 2 maximum uses", but the loop only closes because
each in-stance Normal that HITS cuts the 11s cooldown by 0.5s (1.0s with 2+
Hexerei, max 15 per stance). Today the planner says Four Winds is ready at
t = 0, which is too generous; with `startsOnCooldown` and no reduction it would
say 11s into a 12s stance, which is further from a real rotation than the
status quo. The two are one round.

## 1. Three pieces, and only one of them is about Varka

### A. Wire `cooldownReduce`

⚠️⚠️ It is declared in the schema and has **no consumer anywhere in `src`** —
its only occurrences are its own type declaration and one doc cross-reference.
Raiden and Beidou author it and both are inert. ⛔ `orphanedSchema.test.ts`
cannot see the class, because it matches property ACCESS and this is a `type`
VALUE; that blind spot is worth a note of its own when this lands.

The work is a dispatcher on the hit stream that shifts a queued charge earlier
in `ctx.eChargeQueues`.

⚓ **The ordering is less delicate than it looks, and the reason is worth
writing down before someone re-derives it nervously.** The charge-queue forward
scan (`run.ts`, the `scanGuard` loop) is PURE and reads the queue; a reduction
mutates it. They cannot race, because a reduction fires on a HIT and a scan runs
when an E token is reached — and you cannot swing during a cooldown wait, so
every reduction a wait should see has already dispatched in parse order before
the scan reads the queue. ⚠️ Verify that rather than trust it: the sweep
2026-07-05 #5 lessons are all about this loop.

### B. A proc cap — ⚓ THE PIECE THAT IS NOT VARKA'S

"Up to 15 times per stance" is one instance of a shape **21 characters are
waiting on** (27 curator notes, censused 2026-09-16): arataki_itto, charlotte,
chasca, collei, cyno, dori, escoffier, faruzan, lauma, mika, mualani, nahida,
ororon, raiden_shogun and seven more. Cyno's C4 ("5 times per burst"),
Escoffier's C6 (6 per Mek), Mika's burst (5 per Q) and Collei's A4 (a capped
duration extension) are each a different scoping of the same idea.

⚓⚓ **So the cap must be designed against that census, not against Varka.** The
axes the census already shows: per CAST, per STANCE/window, per SUMMON
instance, and whether the cap resets on recast. ⛔ Shipping a Varka-shaped
`maxProcs` and generalising later is how the corpus gets a field that means
four things.

### C. `startsOnCooldown`

The charge queue initialises every charge READY
(`new Array(n).fill(0)`). One flag, and ⚓ it has a second holder waiting in any
"charges begin recharging on entry" kit.

## 2. What it unblocks

- Varka: Four Winds' real charge model, and with it **Azure Devour's cost** —
  `sC` draws the attack today without spending the use, which is the one thing
  that token cannot say.
- The 21 characters above, to the extent each one's cap fits the shape B lands.
- Raiden's and Beidou's inert `cooldownReduce` effects start meaning something.

## 3. Why a fresh context

Not because it is hard — because two of the three pieces want a corpus census
and a design pass, and both are cheaper and less biased read cold than read
through Varka. ⚓ The project's own hand-off convention agrees: `Opus 5 per tier
for §3, **Fable for the engine rounds**` (essential-characters, Nate 2026-09-15),
and this is an engine round with no character tranche attached.

⏭ Start here, then `docs/curation/varka-two-elements-scope.md` §7 for the
Varka half.
