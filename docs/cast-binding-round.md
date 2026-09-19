# Binding an effect to ONE of two skills on a token — record (2026-09-19)

_Status: ✅ SHIPPED on `feat/cast-binding`. The queue's "`onCast` ability
binding" item (essential-characters §4: "an `onCast` trigger cannot bind to one
ability when two skill abilities share an input"), and §1.F's blind spot. There
was no separate scope; the measurement was the scope._

## 1. What the item turned out to be

Two directions, and neither needed the trigger `abilityId` the item had been
pencilled in as:

- **"The OPENER only"** (Clorinde C6: gcsim grants CR/CD only from the
  stance-opening press, and Impale the Night is also `E`, also a skill). Already
  solved by §1.G, the same day: `not(state: inStance)`. Impale is cast INSIDE a
  stance some other cast opened (gate false); the opening press is decided by
  the self-opened rule (a state the cast itself opens answers null), so it keeps
  the grant. Measured `Clorinde E N3 E N3 E` at C6: ONE 12s CR/CD window, from
  the opener; `E ~17s E N3 E`: two, one per Hunter's Vigil. The T1.5 note that
  called this unauthorable predates §1.G.
- **"The SIBLING only"** (Lohen's Secret Rite: "or hitting an opponent with the
  special Elemental Skill Etched Into Bone and Soul"). A state gate cannot do it
  — the self-opened rule keeps the cold-open E too — and the effect lives in
  `factionBonuses`, so `hostedElsewhere` cannot either. But the vocabulary
  already had the binding: an `onHit` trigger's `filter.abilityName`. It simply
  never worked for a cast, because…

## 2. 🐛 …the cast resolvers named the BASE ability whatever was cast (§1.F)

`resolveCastContext` and `resolveCastPair` (`effectCollection.ts`) took "the
unconditioned ability of this kind" and ignored `CastEvent.abilityId`, which
the parse has carried all along. So on the buff side Skirk's in-stance burst
was Havoc: Ruin, Clorinde's Impale was Hunter's Vigil, Lohen's Etched was
Unforeseen Strike — and `filter.abilityName` on a cast hit could only ever name
the base. ⚠️ The LIVE hit record (`run.ts`) already used the resolved ability's
name; the two sides disagreed.

Both resolvers read `cast.abilityId` now (no id → the base, the old reading),
and `resolveCastContext` is written in terms of `resolveCastPair`, so it also
takes the parse's `variantLabel` instead of re-matching the token — the defect
class the non-hitting-casts round had already fixed on one side only.
`castLandsNoHit` rides the same pair, so a sibling's own `nonHitting` is read
for the first time too (no corpus author yet).

## 3. Data

- **Clorinde C6**: the CR/CD pair leaves `manual` — `onCast skill`, 12s,
  `all[constellation 6, not(inStance)]`.
- **Lohen's Secret Rite**: an `onHit skill` twin of each effect, filtered
  `abilityName: 'Etched Into Bone and Soul'`. Measured `Lohen E E E` with
  Fischl: fires off the two Etched casts, not the cold open; with Bennett (one
  Hexerei member): nothing.

## 4. Measured

Corpus, resolver change alone: 0 of 630 / 0 of 252 digests moved — no corpus
rotation casts a sibling that a name filter distinguishes. With the data:
Clorinde@C6 only. Guarded by a hermetic case in `buffWindows.test.ts` (an
opener and its in-stance sibling each fire their own name-filtered effect);
seeded negative — ignoring `abilityId` — fails it.

## 5. ⏭ Still open from the same queue line

**No stack dispatcher listens to `onSwapIn`** (Neuvillette C1's free stack of
Past Draconic Glories). Not started. The non-obvious part, found while reading:
his key's HOME is the rotation-wide `onReaction` accumulator (its first grant
is `onReaction … source: 'team'`, `lifetime: 30`), so a swap-in grant has to
write THAT container, not the entering segment's pool — the round needs a
"write to the key's home" helper (`thresholds.ts` has the private read/spend
half), not just a new dispatch site.
