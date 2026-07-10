// Prerender the whole site by default. No route has server-side dynamic data:
// pages render from static imports and client-side (localStorage) state, so
// every page can be baked to static HTML at build time and served from the CDN
// edge. localStorage-backed routes (rotation planner, crit visualizer) SSR
// their deterministic default state and restore saved state after hydration —
// see rotation-planner/+page.svelte's onMount restore block.
export const prerender = true;
