# The title bar round, 2026-10-25

Hands-on with Nate, under the switch (`?next`; the top bar is `TopBar.svelte`, rendered only there). The question: what does a player need in one click, and what can sit one layer down? It came after the Planner and Builder toolbar rounds (`docs/toolbar-refine-round.md`, `docs/builder-toolbar-round.md`).

## The rule

The top bar holds the places you START work from and the things you reach for MID-TASK; places you set up once sit one layer down.

| Section                              | One click?                                        |
| ------------------------------------ | ------------------------------------------------- |
| Rotations / Lineups (Library)        | yes, already: the current tool's button           |
| **Teams**                            | **yes, new**: where work begins, like Party Setup |
| Help (`?`)                           | yes: mid-task stalls; carries Report a problem    |
| Settings (⚙)                         | yes (already ruled)                               |
| Roster                               | no: set up once, behind the profile picture       |
| About, What's new, Privacy, Coverage | no: behind `?`                                    |

## Rulings (⚓ Nate)

- **Order**: tools centred, then picture · Teams · `?` · Share · ⚙. The picture leads the run so that Theorycraft's "Add your account" grows toward the centre and pushes none of the icons.
- **Teams** (Nate's art, `assets-src/tools/teams.svg`) opens the Teams section on every profile; in Theorycraft that section is the invitation to make a profile. The profile menu keeps Roster one step in.
- **Icons are sized by INK, not box**, the old bar's rule, lost in the conversion. Ink per height² (rasterised at 400px): help 0.71 · share 0.67 · cog 0.56 · compass 0.43 · teams 0.35. Discs, cog and compass take one step up together (`--disc` 1.12, ⚓ Nate by eye), the compass ×1.1 of them (his 2026-09-04 ratio) and lifted 1px; Teams ×1.22 of the base. Ratios ride `--ui-ctl-h`, so every interface size keeps them.
- **The compass's two facet washes are back** (`fill="#000"` had been dropped, so they painted solid white). Nate's redrawn share and settings art shipped with it, the settings shade now a black wash like the others.
- **The profile picture** is 2px over the disc height (was 6px, and outweighed every icon); the dark outer ring is gone, only the element ring stays.
- **Tool names stay Bitter.** Uppercase Plex at rest was tried and reverted; the current tool's small label is small BOLD Bitter instead, so the face never changes on a switch.
- **The current tool is its FILL alone** (glass, not gold): on is a fill. A 1px `--line-edge` ring on hover, the toolbar's own ink, only on the Builder and Planner buttons, which open the Library. `--line-strong` was tried first and read fainter.
- **BETA is anchored to the wordmark** (centred with it, Nate's `−0.5em` lift from 2026-09-16). It hung from the bar's height, so it sat 7.2 / 11.2 / 15.1px below the word's top at Small / Medium / Large.
- **The landing shows no tool buttons** (its cards are the nav). They are hidden but keep their space, so the bar does not shift between the landing and a tool.
- **The phone bar**: logo · document · picture · Teams · compass · ⚙, the icons pinned to the right edge on every page. The compass took SHARE's place: if the tools fold behind one tap, sharing can too. Share is its own block in the index, first under the tools (`MenuState.svelte` `.side-share`). Tried and rejected: the compass between logo and document, then between document and picture. Below 22.5rem the document drops its Library mark (a TRIAL, a named content stop in `breakpoints.test.ts`). At 320 the name gets 107px.

## Fixed on the way

- Disabled Share was dimmed with element `opacity`, which the sub-pixel law forbids on the parallax-placed chrome; it is `fill-opacity` now.

## Parked (to-do list)

- The full-screen refinement pass: Share's findability in the phone index; Report a problem is missing on the phone; how an icon reads while its section is open.
- Phone tap targets (30px boxes, ~2px apart at 320): test on a real phone first.
- A conversation about notices: the phone shows no save status.

## Tool switch (same day, `polish/tool-crossfade`)

- **A CROSSFADE, not a dip to the night** (⚓ Nate): with every tool at one pose there is no drift to shear, so the two tools overlap. The old tool HOLDS, lit, until the new one passes its paint gate (a slow mount shows the old tool, not the night), then both fade on one start.
- **Linear, at `--t-quick` (150ms)**, the full-screen state's own speed. An eased pair (ease-out in, ease-in out) was tried: it holds the light where both tools put glass in one place (~94% against linear's 75% at the midpoint), and Nate kept the fade law (2026-05-30: an eased fade's visible time is not its duration). Knobs: `INPLACE_CROSSFADE`, `XFADE_MS` in `(tools)/+layout.svelte`.
- **The Tool transitions setting RETIRED**: at this speed there is nothing to opt out of. ⚠ Its off path is the `prefers-reduced-motion` path, where Nate saw the Planner not load or unload properly: to reproduce there.

## Share moves to the toolbars (same day)

- **Share LEFT the top bar** (⚓ Nate): it acts on the DOCUMENT, not the site, and it already vanished on the Visualizers and the landing. It is the last plate of each tool's toolbar, over the document it shares: the Planner's as a menu (link, KQM, two image actions; one `shareItems` snippet), the Builder's on the lineup side as one plate (the link). On a phone the Planner's sits in the ⋯ as a "Share" section, and the Builder's is a mark-only plate (fits at 320, 0 overflow). The index's Share block retired with it.
- ⚠ This reverses design §5.1's "Share stays visible (never behind an interaction)" for the phone Planner, which had already folded it behind the compass.

## Verification

vitest · check · lint · build · the full e2e run, Chrome + WebKit. Measured in resized same-origin iframes: no overflow at 320 / 360 / 375, the icons flush right on the landing at 320 and 1456, BETA at the same offset across the three sizes.
