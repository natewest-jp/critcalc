# The summon-`conditions` round — RECORD (2026-09-19)

**Status:** ✅ SHIPPED on `feat/summon-conditions`. §1–§5 below are the record and
win over the spec this file used to be (2026-08-31; kept as §6 for the list it
triaged).

**The one-line result:** ⛔ **`Summon.conditions` was NOT built, and should not
be.** The triage the spec demanded found its premise stale, and the two cases
that did need a gate are expressed by a shape the corpus already had — a
**constellation-gated variant on the base ability's own token**.

---

## 1. What the triage found

The spec said 32 constellations want to change a summon's duration and "every
one of them is description-only". Read one by one (33, with Chiori C2):

| class                                                                | n   | who                                                                                                                                                                                                                                           |
| -------------------------------------------------------------------- | --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Already authored** as `summons[0].durationModifiers`               | 13  | candace C1 · emilie C4 (the +2s half) · faruzan C2 · kuki_shinobu C2 · nilou C1 · rosaria C2 · sucrose C2 · thoma C2 · traveler_hydro C2 · xiangling C4 (flat +4 = the kit's 40% of 10s) · iansan C6 · dehya C2 · alyosha C2 (Tugarin's half) |
| **Authored by this round**                                           | 4   | chiori C2 · emilie C4 (the moved Case) · alyosha C2 (the Field) · sigewinne C4                                                                                                                                                                |
| Regex false positive — the text says "duration", the mechanic is not | 9   | furina C2 · xingqiu C4 · mona C1 · clorinde C2 · clorinde C4 · cyno C1 · alhaitham C6 · traveler_dendro C4 · nefer C2 (a stack lifetime)                                                                                                      |
| No pixel — the thing extended is drawn nowhere                       | 4   | ifa C4 (the restraining current) · shikanoin_heizou C2 (the Windtunnel) · yoimiya C1 (Aurous Blaze has no window) · lauma C1 (the MAX length of a movement state; an action ends it long before)                                              |
| Per-trigger extension — `durationExtensions`' business, ⛔ not this  | 5   | gorou C2 (a shard PICKUP, which a Crystallize event is not) · kaeya C2 (kills) · dehya C6 (crits) · wriothesley C1 (caveated) · lohen C6                                                                                                      |

(Emilie C4 and Alyosha C2 appear in two rows — one half was already authored, the
other is this round's — so the rows sum to 35 over 33 constellations.)

⚠️ The spec's count was a regex over descriptions. **A census that reads prose
finds the word, not the mechanic** — 13 of 33 were the wrong class outright.

## 2. The ruling — a gated VARIANT, not a gated summon

The approved approach was "author the summon twice with mutually exclusive
conditions". That is exactly what a variant is, one level up — and at that level
the hazard the spec warned about is **already solved**:

- `matchVariant` requires the input token AND the variant's `conditions`, with
  the full `ConditionContext`. It resolves ONCE, at the cast.
- The answer is published as `CastEvent.variantLabel` (the three-state from the
  Arkhe round) and every summon reader already takes it: `findSummonsForBar`,
  `resolveActiveDuration`, the live tick chain, finalize, `holderStatesAt`,
  `summonSubrows`.
- A variant's `summons` REPLACE the base list, so "exists only at C2" is a variant
  with the summon on a base without it, and "spawns 120f later at C4" is the list
  restated.

A `Summon.conditions` field would have needed every one of those readers — plus
the five `summons[0]` geometry accessors the Team Builder shares, which have no
condition context at all — to filter the list identically. That is the
"every reader must take the same context" problem, created in order to solve
it. ⛔ Don't add the field unless a case appears that a variant cannot state.

The shape was not new: **seven** plain-token conditioned variants exist (Albedo's
`duringSummon` burst, Furina's Pneuma, Xilonen's Heal mode, Kujou Sara's C2
Ambush, and this round's three). Team Builder: `deriveCapabilities` composes a
variant's conditions into the capability's gate, so Chiori gains an off-field
DMG capability **at C2** and a `Q (C2 Kinu) · Kinu` Compare lane; Emilie's C4
variant shares the base lane's key (`abilityId::label`) and adds nothing.

### ⚠️⚠️ The hazard that comes with it — lint `variant-gated-effects`

The cast-EFFECT collectors do **not** read `variantLabel`. `effectsForCast` and
`resolveCastContext` (`utils/effectCollection.ts`) pick a variant by input token
ALONE, so `effects` / `tags` / `damageTag` on a gated plain-token variant would
apply on every cast of the token, gate or no gate. No such variant authors any
today; the new strict lint rule refuses one. ⏭ The proper fix is to hand those
collectors the resolved label — a `buffWindows` call-site change, not attempted
here.

## 3. What shipped

**Data (four characters):**

- **Chiori C2** — the burst's `C2 Kinu` variant: a 10s `Kinu` summon spawning at
  91f, three strikes at cast + 312 / 492 / 672f (gcsim `cons.go` c2: a 600f ticker
  every 180f, each Kinu striking 41f after its spawn), 170% of the Tamoto slash,
  `icdGate {timer: 114}`. ⚠️ The kit calls it Skill DMG; a tick inherits its host
  cast's class, so an `onHit` consumer sees burst hits.
- **Emilie C4** — the burst's `C4 Heart Note` variant restates both summons: the
  Level 3 Case at 4.8s on the 0.6s cadence, and the Case it leaves behind at
  **426f** (306 + the 120f extension). The base is now the plain C<4 form (its
  gated twin series and `durationModifiers` moved into the variant). Her C4
  caveat ("drawn 2s early and ends 2s early") is retired.
- **Alyosha C2** — the +6s is on BOTH burst summons; the Fulgurite Hunting Field
  runs 20s at C2. C2 caveat retired. ⚠️ Open, unauthored: at C2 the burst (18s
  cooldown) can be recast 2s before either summon expires and both then overlap.
  The kit says nothing about replacement and gcsim has no Alyosha — ⛔ not faked.
- **Sigewinne C4** — the burst is a CHANNEL, not an entity, so "+3s" is the
  cast's own frames and hits: a `C4` variant with every slot + 184f and fourteen
  waves (99 + 25k) instead of six. Three applications (99 / 224 / 349) under the
  ability's inherited `icdGate`, where C0 has two.

**Engine (two fixes, both found by measuring the data):**

- ⚓ **A secondary summon reads its own `durationModifiers`** (`summonEndAt`).
  The field is on every `Summon`; only `summons[0]`'s were ever applied, through
  the cast's geometry accessors. `cLevel` is a REQUIRED argument now and all five
  call sites pass the tick walk's own context. Byte-identical on its own (no
  secondary authored one). ⚠️ No resolved states — a STATE-gated modifier on a
  secondary is skipped.
- 🐛 **One ICD clock never runs two windows.** A tick series' clock was keyed
  `character:summon:label:seriesIndex`. The label is what lets a recast carry its
  counter (Fischl's E-Oz and Q-Oz are one gcsim counter) — and it is also what
  recast truncation keys on, so since T1.5 gave Emilie's Level 3 Case the E Case's
  label (so it STOWS it), the two alternated a 120f window and the standard one
  on a single counter. **Live on `main` at C0**: in `Emilie E Q` the volley's first
  hit applied nothing because the E Case had ticked 39f earlier. gcsim has them on
  `ICDTagEmilieLumidouce` / `ICDTagElementalBurst`, and the frames report's own
  row shows the first Level 3 hit applying. The window now joins the key. Corpus:
  exactly three digests move (emilie @C0/C1/C2 — at C4+ the twin series sat at
  index 1 and had escaped by accident).

**Smaller:** the renderer's three `hasSummon` presence tests pass the bar's
resolved `abilityId` / `variantLabel` like the summon lane does (they matched by
token, which picks the first variant regardless of its gate — harmless today
because the flag is read only when a bar has uptime). The frames audit files a
**constellation-gated** variant as uncovered (`variantDumpKey` takes the
variant's conditions): the dumper runs at C0, and Sigewinne's C4 map was filed
against the C0 capture the moment it landed. ⚠️ Deliberately narrower than "any
plain `Q`" — that first cut cost Albedo and Xilonen their observed schedules.

## 4. Measurement

A summon-aware corpus digest (every character × C0/1/2/4/6, `E Q … E Q` with two
partners; summon windows + ticks, applications, reactions, bars): **13 of 630
move**, all attributed — alyosha @C2/4/6 · chiori @C2/4/6 · sigewinne @C4/6 ·
emilie @C4/6 (the moved Case) · emilie @C0/1/2 (the ICD fix). Every other C0
digest is byte-identical, which is the spec's own proof. ⚠️ The buff-only digest
from the earlier engine rounds is BLIND to this whole round.

Gates: vitest 1910/1910, check, lint, build. Reports regenerated (frames
disagreeing 47 → 47; uncovered 101 → 102).

## 5. Still open

- The cast-effect collectors take the resolved variant label (§2's hazard).
- Alyosha's recast overlap (§3).
- A tick cannot state its own damage class (Chiori's Kinu is Skill DMG on a burst).
- The `durationExtensions` class in §1 — each is its own trigger question
  (a shard pickup, a kill, a crit), none is this round's.

---

## 6. The original spec's list (2026-08-31), for the record

FLAT: `alyosha C2` · `candace C1` · `emilie C4` · `faruzan C2` · `kuki_shinobu C2` ·
`lohen C6` · `nilou C1` · `rosaria C2` · `sigewinne C4` · `sucrose C2` · `thoma C2` ·
`traveler_hydro C2`. CONDITIONAL: `gorou C2` · `kaeya C2` · `dehya C2` · `iansan C6` ·
`nefer C2` · `yoimiya C1` · `mona C1` · `clorinde C2/C4` · `cyno C1` · `lauma C1` ·
`alhaitham C6` · `wriothesley C1` · `traveler_dendro C4`. UNCLEAR: `xiangling C4` ·
`dehya C6` · `furina C2` · `ifa C4` · `shikanoin_heizou C2` · `xingqiu C4`. Addendum
(T1.5): `chiori C2`.
