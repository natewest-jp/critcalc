# The cross-character `onHit` round (2026-09-21)

The two queued engine defects from `docs/curation/essential-characters-2026-09-15.md`
§8 ("Engine queue, sharpened by this tranche"), both measured on 2026-09-16 and
both about the same thing: **an effect held by one character, fired by another
character's hit.** Branch `engine/cross-character-onhit`, three commits.

## 1. A character's `onHit` buff could not anchor on another character's hit

### 1.1 The defect

`getCharacterEffectsForOnHit` answers "which effects does THIS cast / swing /
tick of the holder's fire", and every buff pool built from it is anchored on the
holder's own casts and swings. An `onHit` buff whose trigger names
`source: 'others' | 'team' | 'active'` asks a different question — "which of
ANYBODY's hits fire me" — but was pooled with the rest, its `source` never read.

Measured on `main`, `Nicole E Q > Xiangling E N1 N2 N3 Q > Fischl E N1`: her A4
("when Elemental DMG from nearby ACTIVE party members hits an opponent") drew
0.15–8.15s and 2.33–10.33s — her own E and Q — and at none of her teammates'
hits. For `'others'` the holder's own casts are exactly the hits the talent
EXCLUDES, which is why Mizuki's A4 had been authored as an `onCast skill`
stand-in with a caveat (T0.5, 2026-09-16).

### 1.2 What shipped

- **`getCharacterEffectsForTeamHit(char, cLevel)`** (`effectCollection.ts`)
  collects these effects apart, each with its host's name, and
  `getCharacterEffectsForOnHit` no longer returns them (`listensToTeamHits`), so
  no cast / block / tick pool can anchor one on the holder's own action again.
- **One rotation-wide pass on the SELF surface** (`buffWindows.ts`, "listening
  to the PARTY's hits"), once per character. Every hit in the stream — casts,
  swings, summon ticks, off-field cast landings — goes through
  `onHitTriggerMatches`, the same gate the live stack and proc dispatchers ask,
  so `source`, `abilityType`, `damageType` and `filter` mean here what they mean
  there. The holder's **states** are read at the hit (§1.G's `stateIndex`) and
  so is its **on/off-field fact**, which at this site is a lookup rather than a
  given: the holder is usually not the one hitting. `procCooldown` is clocked
  per effect. One window per fire; `mergeRefreshedBars` fuses the refreshes, the
  N/CA/P self site's shape — ⛔ not extended in place, because `duration` feeds
  the tooltip and must stay the effect's LENGTH.
- **The row is named after the hosting passive** — `source.trigger: 'teamHit'`
  with a `hostLabel`, rendered `"Nicole Philokalia"`. The bar is no cast's of
  the holder's, so "Nicole E" was a claim about the wrong thing (and drew the
  one buff as two rows, E and Q). ⏭ Nate's eye: some passive names are long
  ("Mizuki Thoughts by Day Bring Dreams by Night").
- **`TriggerFilter.element` takes a list** — `abilityType`'s convention. Several
  elements under ONE effect is ONE `procCooldown` clock; four effects would have
  run four, where gcsim holds a single `a4ICDKey` for Mizuki.
- **Lint B.19** (`teamhit-buff-host`, `teamhit-buff-target`): such a buff must
  sit on a passive, a constellation or a faction bonus, and target `self`.

### 1.3 Scope rulings

- ⚓ **Self surface only, by census.** The corpus's holders are self-target
  buffs on passives (Nicole's A4; Mizuki's A4; Skirk's A4 if it is ever
  re-authored). The team and active-target surfaces were ⛔ not built
  speculatively — the summon-tick pass set that precedent — and B.19 turns the
  gap into a red test rather than a missing bar. A second surface is the same
  loop with a different target filter and emit.
- ⚓ **No cast-ability host.** A cast ability's effects belong to its casts
  (`hostedElsewhere`), a variant's REPLACE them, and with no cast in hand there
  is nothing to resolve either against. "While my burst is up" is a `state`
  condition on a passive host, which the per-hit gate answers.
- ⚠️ **`hit.stacks` is the HITTER's snapshot**, so the conditions get it only
  when the hitter is the holder. A `stacks` gate evaluated at a teammate's hit
  resolves `null` and rides. A holder-side snapshot per foreign hit does not
  exist at finalize; tiering a teammate-hit buff by the holder's own stacks
  would need one.
- ⚠️ `damage` / `heal` / `shield` / `gainStacks` with a party source are other
  machinery (`sim/procs.ts`, `sim/stacks.ts`, `sim/shields.ts`) and untouched.

### 1.4 Data

- **Nicole A4** — no data change beyond deleting the caveat, which described the
  defect. Fires at every Elemental hit the ACTIVE character lands (her own
  included, gcsim `asc.go` `a4Init`), refuses Guoba's and Oz's ticks and
  physical normals. Same rotation as §1.1: one fused bar 0.15–16.35s.
- **Mizuki A4** — re-authored as written: `onHit`, `source: 'others'`,
  `filter.element: [pyro, hydro, cryo, electro]`, `procCooldown: 0.3`, 4s
  refreshing, gated `inStance`. A summon's tick counts (gcsim refuses only the
  holder's own `ActorIndex`). Measured: `Mizuki E Q > Xiangling E N1 N2 N3`
  draws nothing (her own hits; then the stance is down);
  `Xiangling E Q > Fischl E > Mizuki E ~4s` draws one fused bar 3.63–15.32s
  over an extended 2.93–12.93s Dreamdrifter; a Sucrose-only party draws
  nothing. Caveat removed. ⚠️ Residue: gcsim starts the 0.3s ICD BEFORE its
  element test, so a non-qualifying teammate hit can eat a window there and
  cannot here.

### 1.5 ⏭ Skirk's A4 — NOT re-authored, and it is Nate's call

↻ **RESOLVED the same day** — ⚓ Nate made it a round, and `whileState` shipped:
`docs/rounds/event-ended-buffs-round.md`. What follows is the reasoning that queued it.

The judgment pass (2026-09-21) pencilled her in as "an `onHit` buff on a
teammate's hit, blocked on this defect". Unblocked, it is a DISPLAY question,
not a data fix. Prototyped in memory (`source: 'others'`,
`filter.element: [hydro, cryo]`, 20s, the `inStance` gate dropped since gcsim's
Death's Crossing has no stance in it) on
`Furina E Q > Escoffier E Q > Skirk E N1 N2 N3 N4 N5 Q`:

| authoring                 | bar                                                     |
| ------------------------- | ------------------------------------------------------- |
| today (`onCast` + stance) | 5.35–17.92s — the stance, tier by party composition     |
| teammate-hit buff         | **0.30s → past the end of the rotation**, one fused bar |

The second is the true window of the Death's Crossing STATUS and says nothing
about when it matters: the +NA DMG applies only to Seven-Phase Flash normals.
The honest bar is `Death's Crossing ∩ stance`, which is the **state-bound buff
end** already queued as Nate's call (Varka's A1 multiplier is its other
holder). With that primitive Skirk is: teammate-hit opens it, the stance bounds
it, `teamElementCount` still tiers it. Without it, today's stand-in is the
better picture in every rotation except `Skirk E` cast before any teammate has
hit. ⚠️ Her v0.8 authoring (`gainStacks` + `sourceLifetime: 20`, replaced
2026-05-14) is the per-teammate stack model and still has its dispatcher
(`stacks.ts`, the `sourceLifetime` home).

### 1.6 Measured

Buff digest: **4 of 252** moved (Nicole C0/C6, Mizuki C0/C6). Summon-aware
digest: **10 of 630**, the same two characters at five levels. Nobody else.

## 2. A rotation-scoped stack pool was not drained by a teammate's hit

### 2.1 The defect

`dispatchConsumeStacksOnHit` wrote through `poolsFor` only when the holder WAS
the hitter; for any other hitter it wrote `CharState.onHitStacks`, whatever the
key. Right for a key that a team/others `onHit` grant accrues there, wrong for
everything else. Illuga's Nightingale's Song is seeded by her burst into the
ROTATION pool (`scope: 'rotation'`) and spent by "the active character's Geo
hits" (`consumeStacks`, `source: 'active'`, `filter.element: geo`), so the
spend landed in a container nothing reads.

Measured on `main`, `Illuga Q > Ningguang N1 N2 N3 N1 N2 N3 E > Illuga E`: her
second cast's snapshot read **20** — her own burst hit and nothing else.

### 2.2 The fix

The non-self arm asks **`homeOf(holder, key)`**, the one answer to "which
container" the threshold reader and the swap-in grant already share, through a
small `poolsAtHome(hcs, home, seg)` both writers use (the swap-in grant's
inline ladder folded into it, behaviour unchanged). ⚠️ No mirror and no segment
home at that site: `segPools` there is the HITTER's pool, never the holder's;
the next settle point carries a rotation-scoped key into the holder's own — the
summon ticks' rule.

Measured after: the Ningguang rotation reads **0** (twelve swings, two Geo
landings each); a Zhongli partner spends **1** for his E and none for the
stele's pulses (`'active'` refuses an entity); a Pyro partner spends nothing.

⚠️ The corpus digests are unmoved and **BLIND** to it — they carry no Geo
partner. The site probe is the measurement. Illuga is the corpus's one holder
(census: one `consumeStacks` with a non-self `onHit` source).

### 2.3 ⏭ What it was the prerequisite for, still unbuilt

gcsim deletes Illuga's 20s burst status the moment the pool empties, so her A1
crit/EM bars and the C4 DEF bar should end early and today draw a flat 20s.
**A timed window ended by a stack count has no primitive.** It is a cousin of
the state-bound buff end (§1.5): both are "a buff whose end is an EVENT, not a
duration". Worth scoping together.

## 3. Guards

- `buffWindows.test.ts` — "onHit buffs that listen to the party's hits" (five
  cases: `others` vs the holder's own casts; ticks heard by `others`, refused
  by `active`; `team` draws once; the state gate at the teammate's hit; an
  element list on one `procCooldown` clock) and "consumeStacks on a teammate's
  hit" (two). Each positive case was run against the pre-fix module and fails.
- `characterLint.test.ts` — B.19, three cases.
- Gates: vitest 1974, check, lint, build green per commit.
