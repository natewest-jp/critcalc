# Lazy character loading: plan and outcome (2026-07-06)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

**✅ EXECUTED 2026-07-06, MERGED & PUSHED same day.** `main` fast-forwarded `1e9f3f7` → `6a8bcc1` (= `4ac3c06` lazy loading + `6a8bcc1` new repo verify skill `.claude/skills/verify/SKILL.md` with the headless-Chrome recipe); `design/landing` fast-forwarded to match; feature branch deleted. Outcome vs plan:

- **Route chunk: 1,827,694 → 472,549 bytes** (147KB gz). Not "tens of KB" — the remainder is CodeMirror + timeline/parser components, which the plan under-weighted. Character data is 100% code-split: 121 per-character chunks, all <30KB, verified no payload strings leak into the route chunk.
- **Headless-Chrome verification against the production build** (playwright `channel: 'chrome'`, `npm run preview`): cold load = 230KB total JS wire; typing `Furina E Q > Bennett E Q` fetched exactly 2 chunks and rendered full Gantt (bars, summon rows, swap connector, team buffs); garbage token fetched 0 chunks; page reload restored tabs from localStorage and repopulated. One console 404 = avatar `-newfit` fallback, by design.
- Implementation followed the plan's architecture exactly, plus two deltas: (1) the load `$effect` keys on `slots ∪ autoSlots` so notation-named characters still resolve when manualSlots overrides; (2) `RotationCharacterPanel` headers render from the index entry (name/element/weapon) so first-use load never flashes "No character" — only the ability table waits on the payload.
- Generator chained into `predev`/`prebuild`; drift-guarded by new `src/lib/data/characterIndex.test.ts`. 630 tests pass (628 + 2). `characterLint.test.ts` now eager-globs its own corpus.
- **Pre-existing issue found (NOT from this change):** `npm run lint` (prettier --check) fails on `main` — RotationTimeline.svelte, notationParser.ts, characterLint.ts, about/+page.svelte, 4 character JSONs, others. Likely prettier version drift. Needs its own cleanup pass.
- Verification recipe (playwright + system Chrome + preview server + `.cm-content` typing + `.rcp-name` assertions) was blocked from being persisted as a repo `.claude/skills/verify/SKILL.md` by the permission classifier — offer it to Nate next session.

Original plan below, retained for rationale.

---

Scoped, ready-to-execute plan for making the rotation planner lighter by lazy-loading character data. **Do this in its own branch off `main` (NOT on `design/landing` — keep the landing scene work separate).** Surfaced 2026-05-30 during landing transition-perf work; see `docs/rounds/landing-status.md` for how it connects (the planner's heavy mount is the residual mount-phase frame drops).

**⚠️ 2026-07-06 pre-start notes (post bug-sweep, `main` at `1e9f3f7`):**

- All `file:line` citations below pre-date the 2026-07-05/06 bug-sweep (`docs/rounds/bug-sweep-2026-07-05.md`) — `notationParser.ts` and `RotationTimeline.svelte` grew by dozens of lines. The consumer LIST is still accurate; re-grep for line numbers, don't trust the cited ones.
- Test count is now 628, not 363. New in `characterLint.test.ts`: a roster-wide parse smoke test + FrameMap coverage tracker, BOTH iterating `getAllCharacters()` from `characterLookup.ts` — these are vitest/node-context consumers (eager is fine there per the plan), but they'll need the renamed accessor if `getAllCharacters()` goes index-only. Simplest: keep a test-only eager-glob helper or point them at the same eager corpus `characterLint.test.ts` already uses.
- `parseNotation`'s lookup-resolver contract was exercised heavily by the sweep's new tests — the "parser needs zero changes" claim still holds (verified during the sweep: resolver is a pure callback, null-tolerant).

## The problem (measured, not guessed)

- The rotation-planner client route chunk is **1.78 MB** (`.svelte-kit/output/client/_app/immutable/nodes/7.*.js`), **519 KB gzipped over the wire**, but the JS engine still parses/instantiates the full 1.78 MB on mount.
- It's **character data, ~entirely.** `src/lib/data/characterLookup.ts` does `import.meta.glob('./characters/*.json', { eager: true })` → all **121** character JSONs (**1.57 MB raw**) bundle into the chunk. CodeMirror lives in the same chunk but is a small fraction.
- This is the dominant cost of the ~740 ms main-thread mount flood (parse + instantiate all 121 characters), which is the source of the residual single-frame drops in the landing→planner transition AND slow cold loads / navigations.
- Weapons (24 KB / 6 files) and artifacts (28 KB / 7 files) use the same eager-glob pattern but are **negligible — explicitly out of scope.** Only characters matter.

## The key insight: index vs payload

Two classes of consumer, and the split is clean (verified by reading every call site):

**INDEX-level consumers** — need only lightweight scalar fields (`id`, `name`, `displayName`, `element`, `weapon`, `rarity`, `region`, `affiliation`, `factions`), NOT `abilities`/`passives`/`constellations`/frame-maps. These run on ALL 121 and/or on every keystroke, so they must stay **synchronous**:

- `CharacterSelector.svelte` — `getAllCharacters()`; reads id/displayName/element/weapon/rarity/region for the full grid + filters.
- `notationEditorExtension.ts:139` — `searchCharacters()` for CodeMirror autocomplete; searches name/displayName, inserts displayName.
- `SavedNotationsOverlay.svelte:9,34` — `getCharacterById(charId)?.element` (element dots) + `getCharacterByDisplayName` (name resolution).
- `rotation-planner/+page.svelte:349` — `autoSlots` `$derived` resolves notation words → character via `getCharacterByDisplayName`, reads only `.id`. **Runs on every notation keystroke.** Index-level.

**PAYLOAD-level consumers** — need full `CharacterData` (abilities, passives, frame-maps), but ONLY for the **≤4 slotted characters**, never all 121:

- `RotationTimeline.svelte` — `slotCharacters = $derived(characterSlots.map(getCharacterById))` (line 1387) + ~6 other `getCharacterById` calls (track render, swap connectors). Builds the Gantt from frame-maps.
- `RotationCharacterPanel.svelte:34` — `getCharacterById(characterId)` ability-reference panel.
- `TeamBonusesBlock.svelte:18,23` — `getCharacterById(id)` → reads `.passives` for faction bonuses (+ `.factions` which is index-level).
- The **parser's resolver**: `RotationTimeline.svelte:1395` calls `parseNotation(notation, getCharacterByDisplayName, …)`; the parser's param is `lookupChar: (name) => CharacterData | null` (`notationParser.ts:1579`). The notation references the slotted characters, so the payloads needed == the slotted set.

**The parser (`notationParser.ts`) itself needs NO changes** — it's a pure sync function that receives a `lookupChar` callback and already handles `lookupChar` returning `null` (unknown/unmatched tokens are normal). We just feed it a resolver backed by the loaded-payload cache; transiently-null (still-loading) characters degrade to "unknown token" for the ~50 ms until the payload lands, then the reactive re-parse resolves them. This is the entire reason the refactor is contained.

## Target architecture

1. **Generated eager index** (tiny, sync). A committed generated file `src/lib/data/characterIndex.generated.ts` (one entry per line, `.prettierignore`'d — same pattern as `src/lib/stars.ts`), produced by a new `scripts/generate-character-index.mjs` that reads `src/lib/data/characters/*.json` and emits `CharacterIndexEntry[]`. Run it after the (external) character generator; guard drift with a test (below). ~24 KB raw / ~8 KB gz — bundled into the route chunk, replacing the 1.78 MB.
   - `export type CharacterIndexEntry = Pick<CharacterData, 'id' | 'name' | 'displayName' | 'element' | 'weapon' | 'gender' | 'affiliation' | 'region' | 'rarity' | 'factions'>;` (add to `types/character.ts`).
   - Why generated vs eager-glob-then-strip: `import.meta.glob` bundles whole JSON regardless of which fields you read — Vite doesn't tree-shake JSON. A separately-built index is the only way to get a tiny sync index.

2. **Lazy payload loader** — new `src/lib/data/characterData.ts`:
   - `const loaders = import.meta.glob('./characters/*.json');` (NO `eager`) → `Record<path, () => Promise<module>>`; each character becomes its own code-split chunk (~10 KB), fetched on demand. (121 small chunks; HTTP/2-multiplexed, only ≤4 fetched in normal use. Acceptable; note the manifest grows.)
   - `const cache = new Map<string, CharacterData>();`
   - `loadCharacter(id): Promise<CharacterData | null>` — resolves the loader by id (build a path↔id map from the index), imports, caches, returns. Dedupes in-flight loads.
   - `getLoadedCharacter(id): CharacterData | null` — sync; returns cached payload or `null`.

3. **Split `characterLookup.ts`** into index accessors (sync, from the generated index) — keep the existing names where they're index-level, rename where they were payload:
   - `getCharacterIndexEntry(id)`, `getIndexEntryByDisplayName(name)`, `getAllCharacterIndex()`, `searchCharacterIndex(query, limit)` → all sync, index-backed, return `CharacterIndexEntry`.
   - Payload access goes through `characterData.ts` (`loadCharacter` / `getLoadedCharacter`).

4. **Reactive payload loading in the planner.** A reactive `loadedCharacters` Map (Svelte `$state`/store). An `$effect` keyed on `slots` (the resolved ids from `autoSlots`/`manualSlots`) calls `loadCharacter(id)` for each non-blank, writing results into `loadedCharacters` on resolve. Then:
   - `slotCharacters = $derived(slots.map((id) => loadedCharacters.get(id) ?? null))` — null while loading; populates reactively.
   - The parser resolver becomes `(name) => { const id = getIndexEntryByDisplayName(name)?.id; return id ? loadedCharacters.get(id) ?? null : null; }` — reading `loadedCharacters` makes the `$derived.by` parse re-run when payloads arrive.
   - `RotationCharacterPanel` / `TeamBonusesBlock` read `getLoadedCharacter` (or the shared `loadedCharacters`) + a load trigger; show a light loading state until present.

## Consumer-by-consumer change list

| Call site                                         | Current                                                      | Change                                                              |
| ------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------- |
| `CharacterSelector.svelte:38`                     | `getAllCharacters()`                                         | → `getAllCharacterIndex()` (index)                                  |
| `notationEditorExtension.ts:139`                  | `searchCharacters()`                                         | → `searchCharacterIndex()` (index; returns entries w/ displayName)  |
| `SavedNotationsOverlay.svelte:9,34`               | `getCharacterById(...).element`, `getCharacterByDisplayName` | → `getCharacterIndexEntry`, `getIndexEntryByDisplayName` (index)    |
| `rotation-planner/+page.svelte:349` (`autoSlots`) | `getCharacterByDisplayName`                                  | → `getIndexEntryByDisplayName` (index; reads `.id`)                 |
| `RotationTimeline.svelte:1387` + ~6 sites         | `getCharacterById`                                           | → `loadedCharacters.get` / `getLoadedCharacter`; add load `$effect` |
| `RotationTimeline.svelte:1395` (parser)           | passes `getCharacterByDisplayName`                           | → pass loaded-payload resolver (see above)                          |
| `RotationCharacterPanel.svelte:34`                | `getCharacterById`                                           | → `getLoadedCharacter` + trigger load + loading state               |
| `TeamBonusesBlock.svelte:18`                      | `getCharacterById`                                           | → `getLoadedCharacter` (reads `.passives`)                          |

## Sequencing

1. Index generator + `characterIndex.generated.ts` + `CharacterIndexEntry` type + `npm run generate-character-index` + `.prettierignore` entry.
2. `characterData.ts` lazy loader (loaders map, cache, `loadCharacter`, `getLoadedCharacter`).
3. Rewrite `characterLookup.ts` to index-only sync accessors.
4. Update the 4 index-level consumers (mechanical).
5. Add the reactive `loadedCharacters` + load `$effect` in the planner; rewire `slotCharacters`, the parser resolver, panel, team-bonuses.
6. Verify parser handles transient-null gracefully (no error, shows loading not broken).
7. Tests + verification.

## Testing

- **Index-consistency test** (extend `characterLint.test.ts`, which already eager-globs all characters in the vitest/node context — eager is fine there, it's not shipped): assert every source character has an index entry and the index fields match the source JSON. Catches generator drift.
- Existing 363 tests must stay green (parser untouched → they should).
- Manual: type a multi-character rotation; confirm timeline populates (with a brief first-use load per new character), saved-tab load resolves slots, autocomplete works.

## UX tradeoff + mitigations

- **The one behavioral change:** the first time a character is referenced (typed or slotted) in a session, its ~10 KB payload fetches (~sub-100 ms), so the timeline bars for it appear a beat after the slot resolves. Instant on every subsequent reference (cached). Net: ~20–40× faster initial load for a tiny, one-time-per-character first-use cost.
- **Mitigations (optional, add only if first-use lag is felt):**
  - Idle prefetch: after first paint, `requestIdleCallback` to warm payloads in the background (start with the slotted set, then optionally all 121 chunked) so they're cached before the user types.
  - Selector prefetch: when the CharacterSelector overlay opens, prefetch payloads for the filtered/visible characters so picking one is instant.

## Risks / edge cases

- Notation naming a character that isn't slotted: today resolves (all loaded); after, resolves only if its payload happens to be loaded. Normal flow auto-slots named characters (so they load), but a >4th named character won't slot (autoSlots caps at 4). Acceptable — matches the 4-slot model — but note the transient "unknown token" appearance during load.
- Tab/saved-rotation load: slots re-derive from restored notation (or `manualSlots`); the load `$effect` keyed on `slots` covers it — no special cold-load path needed.
- 121 dynamic chunks enlarge the build manifest slightly; if it's a problem, group payloads into ~8–10 bundles (trades per-character optimality for fewer chunks). Recommend per-character first.
- SSR: planner is `ssr=false` (see `docs/rounds/rotation-planner-ssr-fix.md`), so this is all client-side; the generated index imports into the client chunk. The two are orthogonal but both touch planner load — could be tackled in the same session.

## Verification (done = these hold)

- Rebuild: the planner route chunk drops from 1.78 MB to ~tens of KB (index + components + CodeMirror); character chunks appear as separate ~10 KB files.
- Re-run the landing→planner trace (harness pattern in `docs/rounds/landing-status.md`, `/tmp/critcalc-trace.mjs`): the mount-phase main-thread busy and the residual single-frame drops should fall sharply.
- `npm run check` clean; 363 tests pass; index-consistency test passes.

## Effort

Medium. The data-layer split + loader is small and clean; the bulk is the reactive loading wiring in the planner (timeline/panel/bonuses) and getting the transient-loading states right. The parser — the scariest-sounding part — needs zero changes. ~1 focused session.
