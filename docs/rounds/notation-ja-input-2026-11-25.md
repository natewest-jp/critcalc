# Japanese input in the composer (2026-11-25)

The follow-up to `notation-name-suggest-2026-11-25.md`, from Nate's read of that round. Branch `feat/notation-ja-input`, stacked on `feat/notation-name-suggest`. It waits on Nate's eye and his ruling on two new strings.

## 1. Full-width notation becomes ASCII

A player who stays in Japanese input types Ｅ, Ｑ, ＞, ～２ｓ, ：, 「」 and the ideographic space. The composer folds them to ASCII as they land (`src/lib/utils/notationWidth.ts`):

- Typed text is folded in the same transaction, so one ⌘Z undoes both.
- A composition is never touched while it is open. Its commit is folded on `compositionend`.
- Every paste is folded too.

**Why the editor and not the parser** (Nate's lean, and Claude's pick): a lenient parser would leave full-width text in saved rotations and `?r=` links. Then every other reader of notation (KQM docs, other tools, people) would also have to be lenient. Folding in the editor keeps a copied or shared rotation plain ASCII, and the parser stays strict.

The rules:

- Every rule maps one character to one character, so carets and ranges never move.
- A full-width bracket pair （…） folds only once it is closed and holds ASCII. That way 旅人（風） keeps its brackets and stays one token, and 空（風） does too.
- 。, ー and ・ fold only between ASCII letters or digits: ~1。5s, 1ー3[N], E・Q. Elsewhere they belong to Japanese words (フリーナ).
- 〜 (macOS's `~`) folds everywhere.

**Left out:**

- **、** Notation has no comma, so there is nothing to map it to.
- **→** Japanese and Chinese guides write it between actions as well as between characters (E→Q). Reading it as `>` would turn Q into a character. → belongs to the Chinese-shorthand round Nate queued.
- **Kana for letters (え for E).** A kana word may be the start of a name.

A fix found on the way: the paste handler's transaction carried no user event, so a paste got past the read-only filter on a document another tab holds. It is now `input.paste` and is refused like typing.

## 2. Japanese names in a paste or a loaded rotation

When a paste, or a rotation the composer opens, has segment heads that are whole Japanese names, an info toast says so and carries one button, "Use notation names". Pressing it writes every such head as its notation name in one undoable edit (`notationEditor.ts`, `foreignHeads` in `$lib/i18n/notationNames`).

- Only a whole name with a single answer is replaced. A prefix, a bare 空 or 蛍, or an unknown word stays, and the squiggle marks it.
- The button acts only on the document it was offered for, if that document can still be edited, and reads the heads from the text as it is when pressed.
- A loaded document is offered once per text. A paste always asks.
- It is a toast, not a banner, because a paste or a load is an event, not a condition (`notices-design.md` §3.2). A toast with a button stays at least 8s.

## 3. Aether and Lumine

`generate-game-names.mjs` now writes, from genshin-db, the twins' names (`twin`: 空, 蛍) and the Travelers' one-character element names (`element`: 風 …). No name is written by hand.

From those, 空（風）, 空(風) and 空風 read as `Anemo Aether`. A bare 空 lists Aether's seven elements, and 蛍 does the same for Lumine. A twin matches only as a whole word at a segment head: 空気 and 蛍光 offer nothing, and no one-character prefix offers anything. The Chinese table carries 空 and 荧 too, unused until Chinese is switched on.

## Checked in headless Chrome, production build

- Full-width typed outside a composition became `Bennett E` at once.
- During a CDP composition the provisional `　＞　Ｘ` stayed untouched.
- The commit gave `Bennett E > Xiangling Q ~1.5s`.
- A pasted `胡桃　Ｅ　＞　鍾離　ｈＥ　＞　空（風）　Ｑ　＞　空 E` became `胡桃 E > 鍾離 hE > 空（風） Q > 空 E`, with the toast's button. The button gave `Hu Tao E > Zhongli hE > Anemo Aether Q > 空 E`, and ⌘Z restored the paste.
- Typing 空 listed the seven Aethers.

A real Japanese keyboard on macOS Safari and on the iPhone is Nate's check.

## Open

- The two toast strings are proposals.
- No e2e spec was added. The offer's wiring in `notationEditor.ts` has no unit test, because it needs a live editor. The pure parts (`foreignHeads`, `halfWidthNotation`) are tested.

## Verification

Vitest (3,056, including `notationWidth.test.ts` and the extended `notationNames.test.ts`), svelte-check, lint on `src/`, the production build, and `npm run test:e2e:chrome` (73 passed, 1 skipped). Both engines run before the merge.
