---
name: verify
description: Build, serve, and drive critcalc in headless Chrome to verify changes at the browser surface. Use when a change needs runtime verification (tools are client-rendered; curl can't exercise them).
---

# Verifying critcalc changes

The tools (rotation planner, crit visualizer) are client-rendered
(`ssr=false`), so verification means driving a real browser. No playwright in
devDependencies — install it ad hoc in a scratch dir and use system Chrome.

## Build + serve

```bash
npm run build                      # prebuild regenerates newfit + character index
npm run preview -- --port 4998 --strictPort   # serve production build (background)
```

Verify against the **production** build when the change touches bundling or
code-splitting; `npm run dev` is fine for pure behavior changes.

## Headless Chrome handle

```bash
cd <scratch-dir> && npm init -y && npm install playwright --no-save
```

```js
import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome', headless: true }); // system Chrome, no download
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await page.goto('http://localhost:4998/rotation-planner', { waitUntil: 'networkidle' });
```

## Driving the rotation planner

- **Type notation:** `await page.click('.cm-content')` then `page.keyboard.type('Furina E Q > Bennett E Q', { delay: 30 })` — CodeMirror, not a textarea.
- **Panel names:** `document.querySelectorAll('.rcp-name')` → slotted character display names.
- **Autocomplete popup:** `.cm-tooltip-autocomplete li`.
- **Network watch:** `page.on('request', ...)` — character payloads fetch as `/_app/immutable/chunks/*.js` on first reference (lazy loading, 2026-07-06).
- **Persistence probe:** reload the page — tabs/notation restore from localStorage (`critcalc:rotationTabs`).
- Screenshot the timeline to confirm bars/summon rows/team-buffs render; panel names alone don't prove the Gantt built.

## Gotchas

- Avatar images intentionally 404 on missing `-newfit` assets then fall back
  (`handleAvatarError`) — a single image 404 in the console is by design, not
  a break.
- `npm run lint` passes clean on `main` (as of 2026-07-06) — treat any lint
  failure as caused by the change under test.
- Kill the preview server by port: `lsof -ti:4998 | xargs kill`. Rebuilding
  while preview is serving can kill it — re-check with curl after a rebuild.
