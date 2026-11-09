# `colour` becomes `color` (2026-11-09)

**Status:** merged in `0be1edb2`.

Nate's ruling from 2026-10-27, picked up once no feature branch was open: the code follows the site's US English.

## 1. The rename

Every `colour`, `Colour`, and `COLOUR` in `src/`, `scripts/`, `.claude/rules/`, and `docs/design/`, including word forms such as `recolour` and `element-coloured`, in about 90 files. Round records, curation records, and the term ledger keep the old word, because they record what was said or what the word is corrected to.

`elementIcons.generated.ts` came from its generator, and its icon hashes did not move. A collision check found no scope already holding a JavaScript `color` beside a `colour`.

## 2. The one stored key

`colour` was a stored field on `ProfileRecord` and in backup files. Nothing else persisted the word: no localStorage key, URL parameter, CSS token, or share format carries it.

- **The store:** `respellProfileColors` (`db.ts`, `localDb.ts`) runs at every open, in `boot.ts`, before anything reads a profile. It covers tombstones, because the Trash restores them, and leaves `updatedAt` alone, because the merge clock is for changes people make. A failure warns and carries on.
- **Backups:** `backup.ts` reads both spellings forever and writes the new one.

**Considered and not built:**

1. A `DB_VERSION` bump with an upgrade step. It is the conventional shape, but an older build can't open a newer database, so a rolled-back deploy would push every returning visitor onto an empty store in memory.
2. A one-time flag in `meta`. The pass is a few rows, and running it every time also repairs a record written by a tab left open across the deploy.
3. Normalizing inside `get`, `getAll`, `modify`, and `readAll`. It would need the same handling at each read in both homes.

**Known edge:** after a rollback, a respelled profile has no `colour` for the older build to read, so its ring falls back to an unset token until the next deploy. The work itself is untouched.

## 3. Checks

- `db.test.ts`: in both homes, old records are respelled, trashed ones too, clocks don't move, the pass can repeat, and the current key wins if both exist.
- `backup.test.ts`: both spellings restore, and only the new key is kept.
- `conventions.test.ts`: nothing in `src/` spells it `colour` except the two files that read the old key.
