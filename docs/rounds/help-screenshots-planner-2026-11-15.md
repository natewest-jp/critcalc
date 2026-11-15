# 2026-11-15: Help screenshots, the pipeline and the Rotation planner chapter

The to-do's Help screenshots item, picked at the 2026-11-14 check-in (⚓ Nate). Branch `feat/help-screenshots`. This round is the pipeline and its first chapter; the Team builder and Visualizers chapters are their own rounds.

## What was decided

- **Desktop shots throughout, phone shots only in the two "On a phone" sections** (Claude recommended, Nate agreed).
- **Three demos before the full set** (Nate's pick over a written proposal), each judged in real Safari:
  1. Numbered markers with a legend under the image. Nate: the numbers sat right beside their key, so the key repeated them.
  2. Labels beside the image with lines to each control, and markers with a key below 24rem. Nate rejected a width-dependent second design, and Safari placed the side labels at the top of their cell (it doesn't resolve a grid item's percentage offset against the cell's height). The in-prose numbers on the phone shot read well.
  3. **Numbered pins, named by numbers in the prose** (Nate's call). A pin is a round head with one sharp tip turned toward its control, set off the control on a side the shot list gives, so it never covers what it names. Nate's styling: a dark gold body, a bright gold rim, and a light number (`--marker-fill`, `--marker-rim` and `--marker-ink` in `app.css`). One design at every width.
- **Where a figure stands:** in the margin when it's open (56rem of content), floated right with its text wrapping it when the shot is tall (a phone screen, the inspector) at middle widths, and under its paragraphs when narrow. No click-to-enlarge: nothing turned out too small to read.
- **Staging is agreed per chapter before capture** (Nate). One recurring cast per chapter. Nothing that dates: a Custom lineup, and released characters only. The newer outfits throughout. The Team builder's lineups are teams people would actually play, and not too dated.
- **The planner's cast is Flins Lunar-Charged**, the planner's own first-visit sample, at its constellations (Flins C1, which the rotation needs, and Sucrose C6) and loadouts (Nate). `shots.mjs` reads it from `plannerSamples.ts`, so the two can't drift.
- A change to a surface that Help shows reruns `npm run help-shots`, and Nate sees the before and after (`.claude/rules/ui.md`).

## How it works

- `scripts/help-shots/shots.mjs` is the shot list; `capture.mjs` serves the production build, seeds old-layout storage (migrated into a profile on first load, as the e2e fixture does), crops at 2×, writes WebP at quality 92, and writes `shots.generated.json` and `.ts` through Prettier's API so lint passes. Reduced motion holds the night sky still, so a rerun gives the same pixels.
- Pins are drawn by `HelpFigure.svelte` over the image from the manifest's points; `HelpRef.svelte` is the number in the prose. Neither is in the image, so restyling never needs a capture.
- The reading layout's container is named `help-reading`, so a container nested inside it can't capture an unnamed query.

## Traps met

- A `vite preview` started before a rebuild keeps the old build's manifest in memory and serves an unstyled, never-hydrating page. Restart it after `npm run help-shots`.
- In headless Chromium the loading veil on `/help/*` can stay up; a viewing script waits for it, then removes it.
- The script can't capture a native `title` tooltip (the composer's lint reasons), and can't stage a resting (dimmed) bench card, since a name in the notation counts as written.
- A lazy-loaded figure screenshots blank until it's scrolled into view.

## Copy

Nate approved the alt texts, the number placements, the composer example (`Kazuah` → `Flinz`), and the phone section's fold line (the toolbar Bench button no longer exists; the rail's arrow folds the row).

## Left open

- The Team builder and Visualizers chapters (to-do, Now), each staged with Nate first.
