import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		// Deploy target: Cloudflare Pages (GitHub → Pages). The app has no
		// server-side runtime — every page is prerendered to static HTML (see
		// the site-wide `prerender = true` in src/routes/+layout.ts) — so we use
		// adapter-static for a pure static bundle: no Pages Function, so every
		// request is a CDN static hit with zero Worker invocations. That's the
		// point of choosing Cloudflare Pages over Vercel here — unlimited free
		// bandwidth/requests for traffic-spike resilience. Output dir: build/.
		// If a server-side route is ever added, swap this one line back to
		// @sveltejs/adapter-cloudflare. See svelte.dev/docs/kit/adapter-static.
		//
		// fallback: emits a 404.html shell for any path without a prerendered
		// file. Cloudflare Pages serves a root 404.html (with a 404 status) for
		// unmatched requests, so this gives visitors the app's own error page
		// instead of Cloudflare's generic one. All real routes are prerendered,
		// so the fallback only ever fires for genuine not-found paths.
		adapter: adapter({ fallback: '404.html' })
	}
};

export default config;
