# The top bar (phase 2b), 2026-10-22

Under the switch (`?next`) every surface wears the new top bar (`src/lib/components/TopBar.svelte`, design §5.1–5.2) instead of `SiteChrome`, and the Planner and Builder lose band A. With the switch off, nothing changes.

## Rulings landed (⚓ Nate, 2026-10-22)

- **Profile pictures**: 29 choosable + Theorycraft's, which is RESERVED (never in the picker; `pictureOf` answers it for Theorycraft whatever a record holds, so it cannot be changed). Built offline by `scripts/build-profile-pictures.mjs` from the gitignored `assets-src/profile-pictures/` into `static/assets/profiles/{id}-{contenthash}.webp` (128px, 184 KB in all) plus `src/lib/profilePictures.generated.ts`; the output is committed, as the endgame art's is. Re-run it when the art set changes.
- **ONE control size, three steps** (app.css § THE INTERFACE SIZE): Small 11px · 28 · 48 bar (the phone, always), Medium 12 · 32 · 56 (default, demo 1's), Large 13 · 36 · 64 (from the new `huge` rung, 2200px, so a 1920 monitor stays Medium). Settings → **Interface size** (Auto · Small · Medium · Large) pins one on desktop; hidden below `compact` and shown only under the switch. 🎛️ Nate tunes the values by eye.
- **No ⋯ verbs menu** beside the document name (§12 Q29): Rename and Delete live on the Library row (2c).
- The held-elsewhere notice's wording stands.

## What shipped

- **The bar**: brand (logo, wordmark, Beta) · three equal tool buttons, centred; the current one shows the tool as a faint kicker, the brief save status (Saving… → ✓ Saved, cleared after 1.6 s), and the document's label (its stored name, else derived, styled as a placeholder) · Share (Copy link; the Planner adds KQM and the two image actions) · `?` (Help, About, Report a problem, carrying the document's share link as band A's ⋯ did) · ⚙ · the profile picture in its colour ring. The phone form (below `roomy`): logo, the document as a button, Share, ☰, ⚙, picture. Band A's notices ("KQM copied") show in the right flank.
- **Band A retires under the switch**: `ToolStack noBandA`, with every surface reserve rewritten through `--band-a-reserve` (band A's height + its gap; 0 without it), and the bench ribbon's head following (`ribbonHead(trackTop, noBandA)`). The Visualizers keep band A (their Layout controls) until the toolbar step.
- **`--chrome-h` follows the bar** under the switch (`:root[data-next]`), so the tools reclaim 8px at Medium and band A's 33px.
- `storageSession.nameOf` (reactive stored names) and `peekProfile` (the profile for surfaces with no document).
- 🐛 **Fixed: a save could throw `DataCloneError`** — records carried Svelte `$state` proxies (a sample rotation's loadout), which IndexedDB cannot clone; both writes now `$state.snapshot`. 2a's check missed it because its rotation had no loadout.

## Stand-ins until the steps that own them

The current tool's button opens today's Library overlay (2c's Library) · ☰ opens today's compass (2c's index) · the profile picture opens the Roster (2d's profile menu) · no guest ring yet (2d/4) · Clear and Close all are unreachable under the switch (band A's ⋯ is gone; Clear moves onto the tool's own controls in 2e).

## Verification

vitest · check · lint · build · e2e 160 passed (Chrome + WebKit, 9.5 min); headless Chrome against the production build at 1920–320: no overflow anywhere, the bar 56px (Medium) / 48px (phone), band A gone in the Planner and Builder, the bar on the landing and a content page, and the landing → Planner rise arriving at the top bar. The wordmark's 75rem stop was measured (fits from ~1160px at rest; 75rem keeps ~40px for a notice) and registered in `breakpoints.test.ts`.
