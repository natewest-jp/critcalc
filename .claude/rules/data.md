---
paths:
  - 'src/lib/data/**'
  - 'src/lib/types/**'
  - 'src/lib/capabilities/**'
  - 'src/lib/utils/characterLint*.ts'
  - 'scripts/ingest-character.mjs'
  - 'scripts/migrate*.mjs'
  - 'scripts/normalize-talent-levels.mjs'
  - 'docs/curation/**'
---

# Character data

Budget: about 10,000 characters. Rules in the present tense; history belongs in the round records in `docs/rounds/`.

## Where it lives

- One JSON per character in `src/lib/data/characters/`, typed as `CharacterData` (`src/lib/types/`). Full payloads are lazy-loaded by `characterData.ts`. The eager index `characterIndex.generated.ts` carries identity fields plus derived capability summaries, and is regenerated on predev and prebuild.
- New characters come from `scripts/ingest-character.mjs` (genshin-db stub plus a talent sidecar in `docs/curation/talents/{id}.json`). The full recipe is the `ingest-character` skill; frame extraction is the `gcsim-frames` skill.
- Capabilities (heal, shield, off-field damage, RES shred, buffs, cleanse, grouping and so on) are derived from effects and tags by `src/lib/capabilities/deriveCapabilities.ts`, never hand-maintained, each with provenance. It is runtime-import-free so Node scripts can execute it.

## Editing

- Edit JSON with `jsonc-parser`'s `modify`. A Python `json` round-trip expands every hand-compact object.
- After any character JSON edit, run `npm run generate-character-index`.
- ⚠️ A genshin-db upgrade is not additive. Run `audit-genshin-db-text.mjs` (its patch sweep), and when a rename adds a converted reaction to a trigger, re-read the numbers. Mizuki's C1 once drew double this way.
- ⚠️ genshin-db's 7.x kit text is incomplete: mechanics live in the Fandom wiki's Extra Effect tooltips. Never author a 7.x kit from genshin-db alone. `ingest-character.mjs` splits `extraPassives` by position, which 7.0 broke.
- Travelers are hand-built (the generator refuses them), share the `aether`/`lumine` portrait slug, and need two e2e counts updated (`ROSTER_SIZE` and `e2e/traveler.spec.ts`).
- Manekin and Manekina are not supported (scope ruling).

## Authoring conventions

- Values are at talent level 10 (the sidecar rows' tenth column), enforced by `normalize-talent-levels.mjs`.
- `atk%` buff values are whole numbers (store `22.5`, not `0.225`); `BuffValue` scaling ratios are percentage points too.
- A faction tier is a condition on the effect, never a runtime state the parser tracks: Ascendant Gleam is `{ type: 'teamFaction', faction: 'moonsign', min: 2 }`, and the Nascent rung is the same gate wrapped in `not` (sanctioned in `docs/library/game/factions.md`). ⚠️ Check the tier-0 case: gcsim gives a Moonsign set nothing with no Moonsign character.
- `twoPiece` is declared on `ArtifactSetBonus` and read by nothing, so a 2-piece bonus is inert data. Don't add a `Stat` key for one until a consumer exists.
- A character without frames lives in `FRAMELESS_EXEMPT` (`characterLint.test.ts`) and renders honestly ("not yet curated" in the Builder, generic cast times in the planner). Frames flip `isCurated`, so never land frames on a kit with no effects.
- Never fake timing. Tick intervals and durations come only from gcsim or kit text. Unknowns are `~?s`; unmodellable effects go in `_curatorNotes`.
- A buff re-applied per tick is authored at its honest length (Nate's ruling): Bennett's field is 14.1s, Faruzan 16s/22s. The buff outlives the field and the bar says so.
- Never author `value: 0` for an unknown buff. Use `BuffValue {type: 'unknown'}`.
- `manual` triggers do not exist (lint B.18 refuses one), and every `onReaction` needs a `source` (lint B.12d). Author one effect per in-game source.
- `BuffValue.scaling.offset` exists (lint D.38). A scaling `ratio` is per 100 stat units.
- Faction bonuses: Hexerei uses `factionBonuses`; Stellar enablers use `enablesReactions`. "<Reaction> DMG Bonus" is `*ReactionBonus`; "Base DMG Bonus" is `*DmgBonus`. Reference: `docs/library/game/stellar-reactions.md`.

## Caveats

- `caveat` is player-facing; `_curatorNotes` is curator-only and technical. Caveats follow `docs/curation/caveat-style-guide.md` (lint E.26).
- The test is "name the pixel": a caveat exists only to repair confusion on screen. If you can't point at a bar, marker, tick or printed value that is wrong, approximate or conspicuously missing, there is no caveat. A general fact about the game is never a caveat; an under-claim is an omission, not a divergence; and no window means no row, which means no blank to explain.
- ⚠️ A caveat may live only on an ability-shaped host (an ability, passive or constellation entry; lint E.28). On an effect it renders to nobody, and `orphanedSchema.test.ts` can't see that, because the defect is positional.
- Never write "add it manually": manual triggers don't exist.
- The engine-capability rubric (`docs/curation/engine-capability-rubric.md`) is a snapshot. Re-derive it at the start of any caveat pass.

## Shields

- A cast's shields are its resolved ability's own effects plus `getNonAbilityEffectsForCast`. Never `getCharacterEffectsForCast`. One span, one bar (lint B.8a).
- Co-op shields are unmodelled: Nicole C2, Diona C2's splash. Kirara C2 is the house form: the description is kept, with no `effects`. Traveler (Hydro) C4 stays inert.
- A shield with no in-game label renders as the lane's generic "Shield". Never invent a label.
- Record: `docs/rounds/constellation-shield-gap.md` §7.

## Summons

- `summonTick` is a fixed interval and about half the corpus's summons are not, so an `application[]` carrying summon damage is sometimes correct (Charlotte, Qiqi). Two arrays agreeing is not duplication when the kit says they should.
- Only `summons[0]`'s `durationModifiers` reach the bar, so summon order matters.
- A mark consumed by re-application is a stack resource gated `min: 2`.
- `BuffEffect.stacks` has no consumer.
- A character without frames can still carry ability structure.
- ⚠️ Adding a `State` member takes two edits: the union and `characterLint`'s `STATES`.
- Record: `docs/rounds/furina-arkhe-round.md` §6–§9.

## Measuring a data round

- The corpus digest cannot see several things per tranche (one E and one Q each, no `readyAt`, no Geo partner, and a `passive` buff makes no window). Measure at the site too.
- A hit reaching `hitRecords` is not a hit reaching a consumer, and a comment claiming a fix is not evidence of one (`docs/rounds/summon-tick-stacks-round.md`).
- Never scope a multi-character measurement to a single character.

## Checks that guard this data

- `characterLint.test.ts` (the lint rules cited above by number), `characterIndex.test.ts`, and the parser-invariant gate `notationParser.roster.test.ts`, which drives every character's declared input tokens.
- `orphanedSchema.test.ts` fails when authored data has no consumer. It matches property access, not mentions, so a type declaration does not count. On failure: wire it, retire it, or add it to `INERT` with a reason. ⚠️ It cannot see partially-wired data, so a green run is not proof (`docs/curation/orphaned-schema-audit.md`).
- The audit scripts are described in `.claude/rules/scripts.md`.
