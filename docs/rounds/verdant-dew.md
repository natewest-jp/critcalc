# Verdant Dew: Columbina's Moondew Cleanse as a proxy (2026-10-16)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

**Shipped 2026-10-16 (merged + pushed `2536aca2`):** `columbina__normal__moondew_cleanse`, a sibling normal ability gated `teamElementCount dendro >= 1` — every `C` with a Dendro teammate is Moondew Cleanse (3 Dendro hits at 50/58/80f, anim 124, N 82, C 80, E/Q/D/J/swap 43; gcsim `columbina/charge.go`). ⚓ Nate chose the proxy over simulating Dew ("not worth it yet"); the caveat (his wording) says a full Lunar-Bloom team can chain it, a hybrid gets 1–2.

**Two schema fields, one holder each** (`types/ability.ts`, read only in `sim/run.ts`'s charged branch): `NormalAbility.chargeElement {element, applies}` (tint + hit records Dendro, gauge gets nothing) and `chargeLandsAfterCancel` (landings queued at the press — the Dew is spent at 43f, the earliest cancel, so `C > swap` still lands 50/58/80). Pinned by `sim/chargeForms.test.ts` (seeded negative: flag off → 48 not 55).

**Why:** the Hydro C we drew applied 1U Hydro in exactly the teams where that feeds Blooms that never happen.

**How to apply — the follow-up pool (post-launch, engine queue):** gcsim `player/verdantdew.go`: each Lunar-Bloom keeps generation open 149f; +1 Dew per 146f of it; cap 3. Columbina A4 adds Moonridge Dew during her Q (1 per Lunar-Bloom, 0.05s ICD, 3 per 18s). Spenders: her Moondew Cleanse, **Lauma's Hold E** (up to 3, scales by count), **Nefer's Phantasm Performance** — both noted unmodelled in their data. Shape precedent: Mavuika's Nightsoul pool (`docs/rounds/mavuika-nightsoul-round-2026-10-16.md`). When it exists, ONLY the sibling's condition changes (Dew > 0), and gcsim's C→C 89 (next C not a Cleanse) becomes reachable.

⚠️ Deepwood does NOT hear these hits (skill/burst only, as in game; an earlier claim that it did was wrong); a listener on ANY damage (Raiden's Eye, coordinated attacks) is what sees them. ⚠️ The editor tints `C` Hydro (no state machine) — the accepted `nonHitting` gap. ⚠️ gcsim tags the hits direct Lunar-Bloom, not Charged; our hit records say `charged`. ⏭ In-game check queued in `docs/rounds/ingame-test-batch.md`.
