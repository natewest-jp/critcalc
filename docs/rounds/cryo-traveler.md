# Cryo Traveler (2026-08-31, merged `396516f`)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

> ↻ Correction (2026-10-29): the slot-versus-segment roster asymmetry described below is fixed (one roster, `rosterChars` in `src/lib/utils/notationParser.ts`), and the summon's tick cadence is authored (`traveler_cryo.json`).

The last open item from the 5.2.13 pull. ⚠️ It appeared in the text differential
as a **REVISED** entry, not a new one — genshin-db has carried `travelercryo` as
an unreleased stub all along and 7.0 filled it in — so the report's "🆕 New
characters" column never mentioned it. ⚓ **Read the revised column for stubs
coming alive, not just the new column.**

## ⛔ A TRAVELER IS HAND-BUILT

`ingest-character.mjs:203` refuses Travelers outright and the ingest skill routes
them out of every wave. Identity and file shape come from the six existing
variants. ⚓ The sidecar IS generatable: genshin-db has `talents('Traveler (Cryo)')`
but no `characters()` entry, and `buildSidecar` only wants `char.name` — patch that
one lookup and it builds. (↻ 2026-09-15: Geo/Electro/Dendro/Pyro have sidecars now, built through the same patch in the re-ingest; Anemo/Hydro still have none.)

## ⚓ The normal frames are DERIVED, not copied on faith

Three independent agreements: the six Traveler JSONs are byte-identical; gcsim
writes the same `attackHitmarks = {{13, 13, 16, 30, 25}, …}` in **all six**
element packages under `internal/characters/traveler/common/`; genshin-db gives
Cryo the same level-10 multipliers as Anemo and Pyro. The sword string is
element-independent. ⚠️ E/Q still have no frames, so `isCurated` stays false and
the character sits in `FRAMELESS_EXEMPT` — gcsim has no Cryo Traveler on
origin/main or in any PR.

## ⛔⛔ NO POLESTAR FIELD MIRROR — an enabler needs `enablesReactions` and nothing else

Odette's own notes predicted this character would be the third to need the
+20/+20/−40 copy. It needs none: `docs/curation/polestar-field-round.md` made the Prism a thing
the PARSE produces. Verified — Cryo Traveler + Fischl draws one Starlight Prism
and one `Polestar Field` row with a live ledger. ⚠️ His Stellar Jubilee rate is
**half** the other two enablers' (0.35% per 100 ATK, cap 7%, vs 0.7/14).

## ⚠️⚠️ ONE UNSTATED NUMBER BLOCKS HALF THE KIT

The Frostpierce Star "periodically fires ice crystals" and **no source says how
often** — genshin-db 5.2.13 has no interval label, the Fandom talent page is a
`{{Stub}}` with its Gameplay Notes commented out and empty, gcsim has nothing.
So no `summonTick` series (never fake timing), and with it go **Frostglow stacks,
C2's ice-crystal EM buff, C6's per-stack team bonus and the burst's stack-scaled
strikes**. All four are specced in `_curatorNotes` and unblock together.
⚓ The capability fixture carries the `offFieldDamage` expectation anyway, so the
audit files it as a backlog item rather than letting silence read as "this kit
does nothing" — ⛔ resolve it by authoring the cadence, never by deleting the row.

⛔ **The Radiance: Stellar-Conduct branch is unauthored for a DIFFERENT reason —
keep them apart.** It IS fully specified (an `onHit` damage proc on the Star's own
liveness, 0.2s ICD) but `sim/procs.ts` registers a proc only when it carries a
non-empty `application[]`, and the crystal TRAVELS, so its frame offset is a
measurement nobody has made. ⛔ `frame: 0` would be inventing a travel time.

## ⚓ Ever-Keen Frost — the infusion, and how it was proven

An `infuse` effect, `target: 'self'`, `onCast` skill, 12s (the Star's lifetime),
gated on the Radiance idiom. ⚠️ It does NOT follow C4 to 15s — `durationModifiers`
live on the summon and an infuse effect cannot read them.

⚓⚓ **A sword normal is PHYSICAL and applies nothing, so the infusion is the whole
mechanism, and a differential is how you see it**: with an Electro teammate the
normals resolve cryo, apply (ICD-gated, 2 of 5), trigger `stellarConduct` and
raise the field; with an Anemo teammate or alone they stay physical and apply
nothing. ⛔ Don't test it on the applications alone — a cryo character infusing
cryo is invisible there.

⚠️⚠️ **The first differential measured the wrong thing** and named a real latent
asymmetry: `teamEnabledReactions` prefers the SLOT roster while
`teamElementCounts` is built from the SEGMENT roster, so a teammate passed as a
slot but absent from the notation satisfies the enabler clause and fails the
element clause. Put the teammate IN the notation. Details + the ruling not to fix
it in `docs/rounds/reaction-conversion-model.md`.

## ⚓ A NEW TRAVELER NEEDS NO PORTRAIT ASSETS — but it DOES need an e2e count

`slugifyCharacterId` maps **every** `traveler_*` id to the shared `aether` /
`lumine` slug, so a new variant wears the existing portrait and `hasAvatar` is
true on day one. ⛔ **A Traveler is NOT a Stage-5 hand-off.**

⚠️⚠️ The flip side, and the **e2e gate is what caught it**: `e2e/traveler.spec.ts`
counts traveler CARDS, so its two `toHaveLength(6)` became **7**. ⚠️ Bumping
`ROSTER_SIZE` in `team-builder.spec.ts` does NOT cover this — ⚓ a new Traveler
touches **two** e2e counts, and vitest/check/lint/build are all green either way.

## Still open

- **Stage 4** unblocks if gcsim ever ships the character — and it would resolve the
  cadence and the crystal's travel frames in one go.
- No roles-CSV row (the IT table has none for him), which is the Odette/Alyosha
  precedent — ⛔ never invent one.
