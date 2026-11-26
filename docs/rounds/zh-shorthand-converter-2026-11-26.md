# The Chinese shorthand converter (2026-11-26)

Built from the research round's proposal, which Nate approved whole (⚓ 2026-11-26): the six
rulings in `zh-shorthand-research-2026-11-26.md` §7. Branch `feat/zh-shorthand`, stacked on
`docs/zh-shorthand-research`. It waits on Nate's look at the offer.

## What a player sees

1. A Chinese player pastes `仆人E、班尼特EQ、希诺宁EAA、茜特菈莉AEQ/EE、仆人Z接输出` into the
   composer. An info toast says the rotation is in Chinese shorthand, with one button, **Convert
   notation**.
2. Pressing it rewrites the rotation in one undoable edit:
   `Arlecchino E > Bennett E Q > Xilonen E N2 > Citlali N1 E Q > Arlecchino C ~?s`.
3. When the conversion left something out (here the `/EE` alternative), a second toast says how
   many notes and alternatives went, and that Undo brings them back.
4. Notation with Chinese names but no shorthand (`胡桃 E > 钟离 hE`) gets the name offer the
   Japanese round built, now worded for Chinese when the names are.

Both offers come on a paste or a load, in every locale, as the Japanese name offer does.

## How it is built

- **The converter** is `$lib/i18n/shorthandZh.ts`, pure, with its fixtures from real guides in
  `shorthandZh.test.ts`. The mapping is the research record's §5 table. Only `>` segments that
  start in Chinese are rewritten; everything else keeps every character where it was, so a
  rotation that is partly notation already comes through unchanged.
- **Names** come from `$lib/i18n/notationNames.ts`, which now reads Chinese too (`SUGGEST_FROM` is
  `['ja', 'zh']`) plus the nickname table `nicknamesZh.ts`, each entry with where it was seen. A
  nickname with two owners (火神, 水神, 神里) is offered as either when typed, and never converted.
  `nameAtStart` reads the longest name at the start of a turn, so 那维莱特 beats 那维.
- **The offer** is in `notationEditor.ts`. `readsAsShorthand` decides between the two offers: a
  text is shorthand when converting it does more than swapping its names. Japanese text (any kana)
  never is, because Japanese players write KQM itself, where `A` is an aimed shot.
- **The wording's language** for the name offer is `headsLanguage`: Chinese when a name is written
  only in Chinese (钟离), Japanese when only in Japanese (鍾離), and the page's language when
  every name is the same in both (胡桃).
- `conventions.test.ts` allows the `'→'` span in the converter: it reads the arrow and renders
  nothing.

## Choices made while building

- **A team label before a colon** (`仆钟千班：`) is dropped and counted with the notes, so the
  count says something left.
- **An English word in a Chinese turn** stays whole (`buff`, `QTE`), since only a run made of
  shorthand letters alone reads as actions.
- **A normal-attack run past nine** becomes `[N1]xN`, since KQM's N stops at nine.
- **A repeat** wraps the turn's actions since its last separator, so `雷神Q+AAAZ*3` repeats
  `AAAZ` and not the Q.

## Copy (⚓ Nate 2026-11-26)

Nate's wording for 1, 2, and 4, landed verbatim; 3 as proposed. Japanese and Chinese are
Claude's drafts, like the rest of the hidden drafts.

1. The shorthand offer: "This rotation is in Chinese shorthand. critcalc currently uses English
   names and KQM notation for all languages."
2. Its button: "Convert notation"
3. What was left out: "One note or alternative was left out. Undo brings it back." / "{count}
   notes and alternatives were left out. Undo brings them back."
4. The Chinese name offer: "These character names are in Chinese. critcalc currently uses English
   names and KQM notation for all languages."

The Japanese name offer takes the same shape (⚓ Nate): "These character names are in Japanese.
critcalc currently uses English names and KQM notation for all languages."

**Why `钟离E（长按）` is `hE`, not `(hE)`** (Nate asked): a bracket of actions is optional
(`希诺宁E(Q)AA` → `Xilonen E (Q) N2`), but 长按 is not an action. It says how the E before it is
pressed, as guides also write without brackets (`钟离长E`). `Zhongli E (hE)` would be a tap and
then a second, optional hold.

## Checked in headless Chrome, production build

- A paste of `仆钟千班：仆人E、钟离E（长按）、班尼特EQ、千织EE、仆人Z接输出` showed the shorthand toast.
  Its button gave `Arlecchino E > Zhongli hE > Bennett E Q > Chiori E E > Arlecchino C ~?s`, the
  second toast said one note was left out, and ⌘Z restored the paste.
- A paste of `胡桃 E > 钟离 hE > 行秋 Q` showed the Chinese name toast, and its button gave
  `Hu Tao E > Zhongli hE > Xingqiu Q`.

How the toasts look is Nate's call, as is a real Chinese keyboard on Safari and the iPhone.

## Open

- The six questions for a Chinese player (research record §6) can join the Chinese community
  request. Each answer becomes a table change: a nickname added or split, or a rule in
  `shorthandZh.ts`.
- No e2e spec was added; the offer's wiring needs a live editor, and the pure parts are tested.

## Verification

Vitest (3,098), svelte-check, lint, the production build, and `npm run test:e2e:chrome` (73
passed, 1 skipped), run three times. The second run failed once, with its retry:
`team-builder.spec.ts` "wishlisting persists and narrows the roster view" (`toBeHidden`). It
passed in the other two full runs and three times alone, and this round touches nothing in the
Builder, so it reads as a flake under five workers. It goes in the to-do if it comes back. Both
engines run before the merge.
