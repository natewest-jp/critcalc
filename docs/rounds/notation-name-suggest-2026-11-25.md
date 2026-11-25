# Japanese names suggested in the composer (2026-11-25)

A character name typed in Japanese at the head of a segment is offered as its KQM name, with a one-tap replace, in every locale (⚓ Nate 2026-11-25). Branch `feat/notation-name-suggest`. Waiting on Nate's eye and his ruling on the one new string.

## What a player sees

1. In the composer, at the start of a segment, a Japanese player types ふーたお and converts it to 胡桃. Nothing shows while the IME is composing.
2. When the conversion is committed (Enter or the IME's confirm key), the composer's existing name list opens under a small header, "Name in notation". Its row reads **Hu Tao** with 胡桃 beside it in the secondary voice.
3. A second Enter, a click, or a tap picks it. 胡桃 becomes `Hu Tao ` and the caret is ready for the actions. Escape, or simply typing on, leaves 胡桃 as typed, and the amber "no character called" squiggle marks it once the caret leaves.

English typing is unchanged.

## How it is built

- **The lookup** is `$lib/i18n/notationNames.ts`, over `GAME_NAMES` (the table `/ja` already shows). `SUGGEST_FROM` lists the languages it reads, today only `ja`. Adding Chinese is a line there. Its test checks that no folded name belongs to two characters across the offered tables, which is the risk with Chinese, whose kanji names overlap Japanese ones.
- **The list** is the composer's own CodeMirror autocomplete (`characterCompletionSource` in `notationEditorExtension.ts`). A word with any character outside printable ASCII goes to `foreignNameCompletion`, and everything else takes the English path as before. The foreign result uses `filter: false` and decides its own matches and order. It replaces the whole word, past the caret too, and adds a space only when none follows.
- **The look:** the notation name in the list's ink, the typed name upright in `--muted`, a header in `--muted` over a `--border` hairline. The knobs are `--rp-suggest-native-gap` (0.75em, the gap between the names) and `--rp-suggest-head-size` (0.72rem, the header), as fallbacks at their use sites in the editor theme. The `pointer: coarse` row size from `RotationTimeline.svelte` applies unchanged.

## Matching rules

- **A whole name** matches at any length. 魈 (Xiao) is one character.
- **A prefix** matches from two letters (`MIN_PREFIX`). One kana (リ) starts about a dozen names.
- **Never inside a name.** 桃 does not reach 胡桃, and 将軍 does not reach 雷電将軍.
- **A whole name comes first** when it also starts a longer one. リネ is Lyney and the start of リネット (Lynette), so it lists Lyney, then Lynette. This is the only such pair in the Japanese table, and no two characters share a name.
- **Travelers:** 旅人 lists all seven `<Element> Traveler`. 旅人（風）, 旅人(風) and 旅人風 each reach Anemo Traveler.
- **Folding** before comparing: NFKC (full-width brackets and half-width katakana), hiragana to katakana (ふりーな reaches フリーナ), brackets and spaces dropped.
- **Weapons and artifact sets are left out.** Notation never names them, so there is no place in the composer where a weapon name would be typed.

## The IME rule

- While a composition is open (`view.compositionStarted`), the foreign source answers nothing, so no list flashes for kana mid-conversion. On `compositionend` the composer asks again (20ms later, once CodeMirror has read the committed text).
- A `Prec.highest` keydown guard keeps Enter and Tab from the completion keymap while the list is open and the key belongs to the IME: `isComposing`, keyCode 229, or within 100ms of `compositionend` (Safari's late Enter). The key is not prevented, so the IME still gets it. The rule is `isImeKey`, tested without the DOM.
- English keeps answering mid-composition, because an Android keyboard composes every Latin word and the guard would otherwise turn off English completion there.
- Checked in headless Chrome against the production build, through CDP's IME events: no list during a composition of ふーたお or 胡桃, the list after the commit, Enter then giving `Hu Tao `, and a synthetic `isComposing` Enter leaving 胡桃 alone. A real Japanese keyboard on macOS Safari and on the iPhone is Nate's check.

## Rejected

- **Label as the Japanese name with an English `displayLabel`,** so CodeMirror's filter could match. Its fuzzy matcher also matches inside a name, and the order of whole names and prefixes is better decided here.
- **A separate suggestion chip** beside the composer. That would be a second system next to the autocomplete the composer already has.

## Open

- The string "Name in notation" (ja: KQM表記での名前) is a proposal.
- A pasted Japanese rotation is not offered anything (only typing opens the list), and a name left in Japanese is offered again only by retyping it or with Ctrl+Space.
- 空 and 蛍 (Aether and Lumine) are not in the table, so they offer nothing.
- Full-width notation letters from a Japanese IME (Ｅ, ＞) are outside this round.

## Verification

Vitest (3,040, including `src/lib/i18n/notationNames.test.ts`), svelte-check, lint on `src/`, the production build, and `npm run test:e2e:chrome` (73 passed, 1 skipped). Both engines run before the merge.
