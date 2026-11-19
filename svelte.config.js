import adapter from '@sveltejs/adapter-static';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Every page in every locale but English, for the prerenderer. English is
 * found by crawling from `*`; the other locales are linked from nowhere until
 * Nate opens them, so the crawler would never reach them. The list is read from
 * the route tree and the inlang project, so neither has a second copy to keep.
 * Dev-only routes (/lab, /styleguide) are left out: they never prerender.
 */
function localeEntries() {
	const { baseLocale, locales } = JSON.parse(readFileSync('project.inlang/settings.json', 'utf8'));
	const routes = [];
	const walk = (dir) => {
		for (const name of readdirSync(dir)) {
			const p = join(dir, name);
			if (statSync(p).isDirectory()) walk(p);
			else if (name === '+page.svelte' || name === '+page.ts') {
				const segs = relative('src/routes', dir)
					.split('/')
					.filter((seg) => seg && !/^\(.*\)$/.test(seg));
				if (segs[0] === 'lab' || segs[0] === 'styleguide') continue;
				routes.push('/' + segs.join('/'));
			}
		}
	};
	walk('src/routes');
	return locales
		.filter((l) => l !== baseLocale)
		.flatMap((l) => [...new Set(routes)].map((r) => (r === '/' ? `/${l}` : `/${l}${r}`)));
}

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
		adapter: adapter({ fallback: '404.html' }),
		prerender: { entries: ['*', ...localeEntries()] }
	}
};

export default config;
