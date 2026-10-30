# The section boundary round

`docs/todo.md` Now 2: a render throw in a full-screen section blanked the whole document, because the only `<svelte:boundary>` wrapped the tool page. Branch `feat/section-boundary`.

## What landed

- **The boundary is in `MenuState.svelte`, around `.body`.** Under the profiles layout the `(pages)` layout draws nothing: every section (Roster, Teams, Library places, Profile, Settings, Trash, Help and About chapters) renders inside the menu state, which the scene layout mounts outside the tools layout. So a boundary in `(pages)/+layout.svelte` would have caught nothing. Around the body, the top bar, the sidebar and the page head all survive a crash.
- **`RenderCrash.svelte`**, the fallback both boundaries now show: title, body, Try again, Report this, and the stack in dev. The tool boundary's markup and styles moved into it unchanged, with its copy passed in.
- **Moving resets the boundary.** A failed boundary renders only its fallback, so without a reset the next section would never mount. The crash records its address (the section, and a team's details within Teams), and an effect calls the boundary's reset when the address changes. Every menu move is a history entry, so Back runs the same reset (not driven).
- **The head comes back on a crash.** A team's details are headless (no ✕, no Menu button; Done is the way out). If the details crash, Done is gone, and on a phone the head holds the only ways out. A crash also drops the section's fill layout.
- The report goes to the form with "Where?" set to the rest of the site, and no share link (a section has no document).

## Rulings and why

- **Rejected: `{#key section}` around the boundary.** It would reset on a section change but not when a team's details open or close inside Teams, and keying on the details too would remount `TeamsPlace` on every open.
- **Not covered:** the landing, the top bar and the dialogs. A throw there still blanks the document. `CLAUDE.md` § Standing rules says so.
- A chapter that fails to load is a promise rejection, not a render throw; it keeps its toast.

## Verification

- Gates: Vitest, svelte-check, lint, production build.
- Dev server in headless Chrome with a planted throw (removed): `/settings` shows the fallback with sidebar and head; Trash then Settings from the sidebar both render; Try again on a throw that keeps happening re-fails once, no loop; at 390px the Menu button leaves the crash. The planner's boundary shows the same fallback as before.
- Not driven: a crash inside a team's details (needs a real profile with a team). The change there is the `!crash` term on `headless`.

## Copy

The section's title and body are working copy, awaiting Nate (`docs/text/sheets/errors-and-frame.md` §2).
