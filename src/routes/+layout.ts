// Prerender the whole site by default. No route has server-side dynamic data:
// pages render from static imports and client-side (localStorage) state, so
// every page can be baked to static HTML at build time and served from the CDN
// edge. The rotation planner opts out of SSR (see its +page.ts) and prerenders
// as a client-hydrated shell, which is the correct shape for a localStorage-
// backed SPA route.
export const prerender = true;
