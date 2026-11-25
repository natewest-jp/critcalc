# The Japanese close-out cleanups (2026-11-25)

Nate's pass over the site after the Japanese draft was whole. Merge: `Merge fix/ja-cleanups`.

## What changed

1. **The planner inspector's "Edit in Roster"** was a `<button class="link link--quiet">`, and `.link` set only color and underline, so the browser's button chrome showed in every language. `button.link` in `app.css` now sheds it.
2. **Help's and About's chapters on a phone.** The groups unfolded only while one of their chapters was current, and the phone index is a screen of its own, so the chapters after the first were unreachable. On a phone they always show unfolded (`MenuState.svelte`, `unfolded`); the in-group mark still follows the current section.
3. **The Breakdown's stats face** ran off a phone in Japanese. Its menu button may now shrink to the setup bar and the face wraps between stats (`word-break: keep-all`). Eliding was rejected: it would hide crit DMG.
4. **The Breakdown's result fade** runs light at its head and dark at its tail, upright and in rows (Nate, `tune(nate)`; knob `TOTAL_FADE_FROM_TAIL`). Subtotals keep the stripes' direction.
5. **The menu's shortcuts item** reads ショートカットキー in Japanese (Nate approved): キーボードショートカット wrapped its last ト. The sheet's own title keeps the long name.
6. **The phone's tool tiles** never break a tool's name. In Japanese the name sets `palt` and shrinks to its tile only when needed (`--tile-name-cjk-fit`, 13cqi: 14px at 430 and up, 13.6px at 390, 10.5px at 320). A shorter word was rejected, so the name matches the top bar and Help.
7. **A Japanese feedback form.** Google Forms holds one language per form, so Nate made a translated copy. It kept the English form's entry ids and branching, and its answers land in "Form responses 2" of the same Sheet. `src/lib/feedback.ts` picks the form and its option strings by locale at call time; a locale without its own form uses the English one. The check-in reads both tabs (`feedback.lastRowJa` in its state).

## Queued

Game names typed in other languages, suggested in the notation box (`docs/todo.md` § Queue).

## Verification

Vitest (3,025, including the per-locale form tests, written failing first), svelte-check, lint, the production build, and `npm run test:e2e` (147 passed on Chrome and WebKit). Items 2–6 were looked at in headless Chrome at phone widths; real Safari and the iPhone are Nate's.
