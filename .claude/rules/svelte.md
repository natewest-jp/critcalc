---
paths:
  - 'src/**/*.svelte'
  - 'src/**/*.svelte.ts'
---

# Svelte 5 traps

Budget: about 4,000 characters. Each of these froze a page or silently did nothing at least once.

- ⚠️ A keyed `{#each}` key must be exactly as unique as the key that deduped the collection. Carry the map key onto the row rather than re-deriving a coarser one, and never key on a value that can become NaN: a duplicate key freezes the page (`each_key_duplicate`). The timeline's projections are checked by `src/lib/timeline/buffRowKeys.test.ts`; change a projection's dedup key and its `{#each}` key together.
- A fallible `$derived` catches and returns a safe empty value. An uncaught throw stops the signal subtree and freezes the page (the pattern is in `RotationTimeline.svelte`'s parse derivation).
- An action's `update()` runs inside the effect that reads its parameter. With an object parameter and a body that writes state it reads, it loops until `effect_update_depth_exceeded`, so wrap the body in `untrack`.
- Writing a `$state` class field reads the old value to compare it, and that read is tracked by the effect doing the write. A field that nothing needs to react to is a plain field (`plannerView.scrollToSeconds` is the example).
- A child component's `onMount` runs before its parent layout's. State the `(tools)` layout restores in its `onMount` isn't ready in a page's `onMount`: gate on the store's restored flag with an `$effect`.
- Don't gate a global keyboard shortcut on `:focus-visible`: Chrome makes a clicked button focus-visible at the first key pressed on it. Track pointer focus instead. A window listener on a tool page also checks the route, because a page you left is paused, not destroyed.
- On iOS a tap is a `pointerup` within a slop, never `click`, and the keyboard rises only for a focus made inside the gesture. Check a phone crash against `vite preview --host`, not the dev server.
