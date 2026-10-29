# One place for every tool (phase 2f), 2026-10-22

Under the switch (`?next`), every tool sits where the Planner sits, a tool changes in place on a short fade, and Settings can turn tool-to-tool transitions off (design §5.5). With the switch off, nothing changes: the crane and its Nate-tuned clocks stay the live site's until the release.

## What shipped

- **One pose** (`transition.ts` `sideSign` → 0 under the switch). It is the one place a side pose is decided, so the camera, the landing composition's world lock, a cold load's pose and `toolPoseShift` all follow: the rise from the landing goes straight up whichever card you pick, and a tool-to-tool leg has no camera move and no drift. Measured: the camera's x is 0 on all three tools.
- **A tool changes in place** (the tools layout): under the switch the tool-leg clocks are new in-place knobs. 🎛️ For Nate's pass: `INPLACE_FADE_OUT_MS` = `T_QUICK` (150, the SURFACE band), `INPLACE_FADE_IN_MS` = 200, no beat between them; the incoming layer is still paint-gated. Measured on the production build: the old tool gone by ~215 ms after the click, the new one in by ~480 ms (the crane leg was ~1.8 s). ⛔ The crane-era values (`TOOL_NAV_MS`, its /3 fades, the 150 ms beat) are untouched; they still run with the switch off.
- ⛔ ~~**Settings → Display → Tool transitions**~~ — RETIRED 2026-10-25 (⚓ Nate): the tool switch became a 150ms linear CROSSFADE (the full-screen state's speed, no dip to the night), too short to be worth an opt-out, and the off path was misbehaving. `prefers-reduced-motion` still changes a tool at once (`toolMotionOff`). Record: `docs/rounds/title-bar-round.md` § Tool switch.

## Strings (working copy)

"Tool transitions" / "Fade between tools. Off, a tool changes at once."

## Not changed

The scene and nav clocks (Nate-tuned) · the landing ↔ tool rise and its fades · `SCENE_NARROW_SHIFT` (the phone composition, not a crane) · ⛔ no sideways offset or knob, ⛔ no plate crop (§5.5).

## Verification

vitest 2557 · check · lint · build. Headless Chrome against the production build, under the switch: camera x = 0 on Planner, Builder and Visualizers; a Planner → Builder leg sampled per frame (above); with Tool transitions off, a Builder → Visualizers leg shows one layer, at full opacity, every frame. No page errors.

e2e 160 passed and the nav storm (`test:e2e:storm`) 2 passed, both with the switch OFF, which is the path this round must leave alone. The switch-ON path has no spec, so an inline storm (the storm spec's assertions, with interrupts at 80–1200 ms to fit the ~0.5 s leg, 36 legs) ran in Chrome and WebKit, transitions on and off: one visible layer at rest, 0 watchdog hits, no page errors, every time. ⏭ Promotion candidate: run `tool-layers.spec.ts` under `?next` too, once the switch is the default.
