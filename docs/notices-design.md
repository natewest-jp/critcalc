# Notices: the design (draft, 2026-10-26)

How the site tells people things. Grounded in the survey
(`docs/notices-survey-2026-10-26.md`) and Nate's rulings of 2026-10-26; the
lab is `/lab/notices` (dev only). Status: **draft, before Nate's look at the
lab.** Strings are working copy and go through the style guide.

## 1. Why

A first-time user missed feedback that appeared away from his focus, or in
small text, sometimes while looking straight at it. The survey found one
notice slot, far top right, 11–13 px at 75% white, 2.2 s, invisible on a
phone, carrying "Link copied" and "Couldn't save your changes" alike.

Five things the design takes from how people see:

1. **Sharp vision is a few degrees wide.** The periphery sees movement,
   brightness and big shapes, not words. A notice is placed where the eye
   is, or it is big, bright and moves once.
2. **Attention filters out the rest.** Someone mid-task does not see what is
   outside the task (inattentional blindness).
3. **A change in place goes unseen** if it keeps its shape and style
   (change blindness): swapping Cancel/Save for a question is that case.
4. **A spot that carries trivia gets ignored.** Serious messages never share
   a home or a look with routine ones.
5. **Small text is not read.** Notice text is body size (`--fs-xl`, 16 px)
   or larger, never `--fs-sm`.

## 2. Principles

- **Answer where the action happened.** The control that was clicked
  answers for itself whenever it can.
- **Match the interruption to the stakes.** A quiet state, a fading toast, a
  toast that stays, a banner, a dialog: in that order of weight.
- **Bring a decision to the person.** A question whose cause is away from
  the eye is a dialog, which dims the rest and takes focus.
- **Quiet on success, loud on failure.**
- **Don't cry wolf.** No confirm or notice that fires on a no-op; a confirm
  stays rare enough to be read.
- **Every notice has a home at every width.** Nothing is `display: none` on
  a phone.
- **A notice never replaces another.** They queue (toasts) or stack
  (banners).

## 3. The shapes

Five shapes, plus a sixth (hints) to come. Each has one job; none can stand
in for another (a toast is an EVENT, a banner a CONDITION, the status a
STATE).

### 3.1 The control answers

**Job:** the outcome of clicking that control. **Place:** the control
itself. **Look:** its label and mark change ("✓ Copied", "Couldn't copy"),
with a ring in the severity colour. **Time:** 1.6 s success, 2.4 s failure.
**Confirm on the control:** the click-again pattern ("Delete?"), unified at
3 s on every delete and reset (today 3 s / 4 s / blur-only), announced
(`aria-live` on the label). **A11y:** the label change is announced.

Use it for: Copy link, Copy KQM, Copy image (success), Save (the Builder),
Save as team ("In Teams"), the Visualizers' Copy link (as now), every
click-again delete and reset.

### 3.2 Toast

**Job:** an event: something happened that you may want to know, undo or
act on. **Place:** ONE home per page, bottom centre of the surface; on a
phone tool, above the notation dock. Rendered once, at layout level, for
every surface (tools, full screen, landing). **Look:** glass plate
(`--glass-plate` + blur), body size, a mark in the severity colour (or a
profile's colour disc), optional buttons, a ✕, and a thin line along the
bottom showing the time left. **An error toast is PAPER** with a danger rule.
On a narrow surface the buttons drop to their own row.

**Time** (🎛️): success 4 s, info 6 s, warning 8 s; with a button at least 8 s;
**error stays until dismissed** (Nate: an escalated notice must be
dismissed). Any toast pauses while pointed at or focused (WCAG 2.2.1).

**Queue:** up to 3 at once, newest at the bottom; when a fourth arrives the
oldest that can fade makes room (an error never does). A once-ever notice is
marked seen only once it has been on screen (or dismissed), never before.

**Motion:** in, a 16 px rise with a linear fade (`--t-quick`); out, a linear
fade; the stack reflows with `--t-move`. Reduced motion: the tokens zero.

**A11y:** the region is `aria-live="polite"` and stays mounted (a live region
inserted with its text is often not announced); an error is `role="alert"`.

### 3.3 Banner

**Job:** a condition that is true now, and clears itself when it stops being
true. **Place:** the top of the surface: under the toolbar on a tool, at the
top of the content area on the full-screen surface. **Look:** paper, a
severity rule and mark, a bold lead clause, body size, optional buttons.
**Time:** while the condition holds. A warning banner may be dismissed for
the session; an error banner may not. Up to two stack.

⚠ `--ui-warning` fails on paper (1.65:1, app.css `.ctx-light`): a paper
warning rung is needed (lab candidate `#a35a12`).

### 3.4 Dialog

**Job:** a decision whose cause is away from where the person is looking,
or whose consequence needs a list (what goes with a profile). **Place:**
centred, the surface dimmed. **Look:** paper, a question as the title, a
body that names the consequence and the destination ("Going to Roster drops
them"), the safe action focused and on the right, the destructive one in
`--ui-danger`. Escape = the safe action; the backdrop does not dismiss (the
house rule of `LinksDialog` / `MoveDialog`).

**The confirm rule (Nate, 2026-10-26):** confirm ON the control when the
question is about that control (click-again); a dialog when the cause is
elsewhere.

### 3.5 Status indicator

**Job:** a state, not an event: is my work saved? **Place:** beside the
document's name (the tool button on desktop; the phone needs a home, it has
none today). **Look:** quiet: "Saving…" with a pulsing dot, "✓ Saved" for
1.6 s, then nothing. **Failure escalates:** "Not saved" in `--ui-danger`
stays in the status AND the error banner opens.

### 3.6 Hint (later; not in this round)

**Job:** TEACHING: how a tool or interface is used ("Drag a pill to move
it", "Click a portrait to swap"). Nate, 2026-10-26: a family of its own with
its own shape. What sets it apart, so it never borrows another's:

- It is about the INTERFACE, not about an event or a condition.
- It is ANCHORED to the thing it teaches (a callout pointing at the control),
  never in the toast home or the banner place.
- It is shown once, its dismissal is remembered (`siteSettings`), and it
  must never look like an alarm: no severity colour.
- It waits for the streamlining work (the on-hold "one-time dismissible
  hints" item in the to-do list): fixing a control may remove the need.

## 4. Severity

| Severity | Mark                     | Colour                           | Toast material | Toast time          | Banner             |
| -------- | ------------------------ | -------------------------------- | -------------- | ------------------- | ------------------ |
| Success  | check                    | `--ui-positive`                  | glass          | 4 s                 | –                  |
| Info     | info (or a profile disc) | `--text`                         | glass          | 6 s                 | –                  |
| Warning  | warn                     | `--ui-warning` (paper: new rung) | glass          | 8 s                 | paper, dismissable |
| Error    | warn                     | `--ui-danger`                    | **paper**      | **until dismissed** | paper, stays       |

## 5. Deletes and the Trash

**Nate, 2026-10-26: keep a confirm on every delete, and consider a Trash.**

- Click-again confirm on the control (3.1), then a toast "Moved to Trash ·
  Undo". The Trash catches the later regret.
- **One Trash, outside any profile** (like Settings): a deleted profile has
  nowhere to go in a per-profile trash. Grouped by profile, the active one
  first. Restore puts an item back where it came from; a rotation whose
  profile is in the Trash offers to restore the profile.
- Kept 30 days, then cleared; "Empty Trash" asks (a dialog).
- A delete is already a tombstone in storage, so the Trash is a screen,
  Restore and the clearing.
- Two cases to solve: restoring a profile when seven exist (the cap), and a
  deleted profile's colour taken since.
- Built after the notice system, so its toasts and confirms are born in the
  new shapes.

## 6. Every current message, assigned

From the survey; ⊕ = a message that doesn't exist yet.

**The control answers:** Link copied / Share failed · KQM copied / Copy
failed (and Copy KQM disabled, not failing, on an empty notation) · Image
copied · Saved (Builder) · Save as team → In Teams · Viz Copy link · all
click-again deletes and resets.

**Toast, success:** Team saved · Saved as new · Team added to the lineup ·
⊕ Moved to Trash · Undo · ⊕ Restored from your backup (after the reload) ·
undo notices: {Name} left {Team} · Lineup cleared · {X} replaced {Y}.

**Toast, info:** Loaded a shared rotation / lineup · Team loaded · Already
saved as "X" · Opened in Theorycraft (+ Move to an account) · ⊕ Switched to
{profile} (with the wash, and words for reduced motion) · the what-if fork
"Saved to Theorycraft · it doesn't match X's roster" (EVERY fork, not once
ever: it moves you to another document) · the migration notice (+ Download a
backup; stays until dismissed: once ever, with a button that matters) · ⊕ A
document deleted in another tab.

**Toast, warning:** The lineup is full (+ how to make room) · Couldn't copy
the image, so it was downloaded instead · ⊕ a deep link that didn't decode
(`?team=`, `?swap=`, `?i=`) · ⊕ That profile was deleted in another tab · ⊕
the notation cap refusing a paste.

**Toast, error:** Invalid share link (with a reason) · Export failed · ⊕ any
write that fails outside autosave (switch, move, delete, rename, pin, pair) ·
⊕ a Help chapter that failed to load.

**Banner:** Couldn't save your changes (error; + Download a backup) · Open in
another tab (warning; + Edit here; ⊕ "your changes here were replaced" when
the lock returns) · ⊕ storage refused / the browser may clear data
(warning) · pick mode "Choose a rotation to compare with" (a mode is a
condition).

**Dialog:** Discard your changes? (team details; every exit) · Replace
everything with this backup? (Settings import, now inline) · ⊕ Delete
profile, with what goes and a backup offer · ⊕ Empty Trash · Move to an
account · Links intro (as now).

**Status:** Saving… / Saved / Not saved, on desktop AND phone.

**In place (unchanged in kind):** the clash line · the Builder destination
banner · the errand row · lint squiggles · Artifact Odds validation · empty
states. Their hover-only explanations are the next round (below).

## 7. Building it

- `$lib/notices.svelte.ts`: the channel: `toast(kind, text, actions?)`,
  `banner(key, …)` / `clearBanner(key)`, `confirm({...}): Promise<boolean>`.
  `documentBar.showNotice` becomes a shim over `toast`, then its callers move.
- One `NoticeRegion` (toasts + the dialog host), mounted by both the scene
  and the tools layouts; banners rendered by each surface at its top.
- The top bar's notice slot is retired (it also fixes the squeeze).
- The status indicator gains a phone home.
- Tokens: the paper warning rung; the toast/banner materials move to
  app.css as roles once settled.
- Order: channel + region → move every existing message → the ⊕ messages →
  the Trash.

## 8. Next round: explanations that live in a hover

Not notices, the same problem: lint messages, disabled-button reasons
(swallowed by `.btn:disabled { pointer-events: none }`), bench cues, check
verdicts and ellipsized text explain themselves only in a `title`, which
touch never shows and nobody finds.

## 9. Open for Nate

1. The toast home: bottom centre on every surface?
2. Toast times (4 / 6 / 8 s) and the stack of three.
3. Paper for error toasts and for all banners; glass for the rest.
4. Can a warning banner be dismissed for the session?
5. The what-if fork toasting on every fork rather than once ever.
