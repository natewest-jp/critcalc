# The Save button — "Save changes", and the fork that makes it safe

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

✅ 2026-08-07, `169c84a` (pushed 2026-08-08). Nate raised it: _"I don't think it's
obvious what Update updates. Update the tool software or something?"_

## What was wrong

Band A's document button read **`Update`** with the **`RefreshCw`** mark once
the tab was linked to a bank entry. Two separate faults:

- **The word named no object.** "Update" what?
- **The mark was the universal reload/sync glyph.** It is _why_ it read as a
  software update. And the button swapped floppy → circular-arrows the instant
  the document linked, so it stopped looking like the same control at all.

## Why NOT "Overwrite" (Nate's proposal — talked through, he agreed)

Accurate, but it is the loudest possible framing of the site's most routine
action — the word a _dialog_ uses when it is warning you, pressed every couple
of minutes while iterating a rotation. And it answers the wrong question: the
doubt was never "what does this do to the file", it was **"WHICH file"**.

## What shipped

- **ONE mark in both states** (`save`). It is Save either way; only the word
  grows to "Save changes". `update`/RefreshCw retired from the set.
- **The object was never missing.** The bank entry's name IS the active tab's
  label (`documentBar.save()` uses `activeTab.label`), sitting one zone left in
  the same band. The `title` spells it: `Save changes to "Vape Hu Tao"`.
- Notice says `Saved` in both branches — nothing about the action differs.
- **`Save as new` in the overflow** (linked only). ⚠️ **This is the half that
  actually removes the fear**: until now a linked tab had NO fork — every Save
  wrote over the entry and the original was gone.

## ⚠️ The bug worth remembering

`copyName` is an **exported pure function with a test**, not a private line,
_because it was wrong_: forking a fork gave `Vape Hu Tao copy copy` — the
suffix stacked instead of numbering. **A browser probe caught it on the second
fork; no unit test could have, because the logic wasn't reachable.** Strip the
suffix before re-applying, and skip gaps rather than reusing a number.

The lint rule `svelte/prefer-svelte-reactivity` fires on a plain `new Set()`
even inside a pure function — it wants SvelteSet, which would be wrong there.
Use an array scan.

Related: `docs/design/icon-set.md` (the mark set + the sweep), `docs/rounds/toolbar-round-2026-08-07.md`
(band A's shape), `docs/rounds/style-reference.md` (the /styleguide re-cut).
