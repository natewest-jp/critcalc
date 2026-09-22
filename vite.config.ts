import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

/** Dev-only: let the browser cache /assets/* (portraits, icons) instead of
 *  Vite's default no-cache. The dev server is HTTP/1.1 (6 connections), so on
 *  every reload ~117 portrait revalidations queue behind the unbundled module
 *  flood — the grids visibly trickle in. Assets are add-only (see
 *  static/_headers), so an hour of dev-side caching is safe; hard-reload
 *  (cmd+shift+R) still busts it. */
const devAssetCache: Plugin = {
	name: 'dev-asset-cache',
	apply: 'serve',
	configureServer(server) {
		// stack.unshift, not use(): SvelteKit's own dev middleware (registered
		// first) serves static/ without calling next(), so appended middlewares
		// never see /assets requests. The server's later setHeader('no-cache')
		// is neutralized by pinning ours and swallowing subsequent writes.
		server.middlewares.stack.unshift({
			route: '',
			handle: (req: IncomingMessage, res: ServerResponse, next: () => void) => {
				if (req.url?.startsWith('/assets/')) {
					const orig = res.setHeader.bind(res);
					orig('Cache-Control', 'public, max-age=3600');
					res.setHeader = (name, value) =>
						String(name).toLowerCase() === 'cache-control' ? res : orig(name, value);
				}
				next();
			}
		});
	}
};

export default defineConfig({
	plugins: [sveltekit(), devAssetCache],
	define: {
		/* The footer's copyright year, inlined at BUILD time.
		 *
		 * ⚠ IT HAS TO BE A BUILD CONSTANT, NOT A CLOCK READ. The site is
		 * prerendered, so `new Date().getFullYear()` inside the component would
		 * bake the BUILD year into the static HTML and then compute the VISIT
		 * year again during hydration — the two disagree the moment a year rolls
		 * over between a deploy and a visit, which is exactly the mismatch
		 * $lib/landing/announcements.ts forbids. Defining it here inlines ONE
		 * literal into both the prerendered HTML and the client bundle, so they
		 * cannot disagree. ⚠ A redeploy is what moves it, which is correct for a
		 * copyright line. */
		__BUILD_YEAR__: new Date().getFullYear()
	},
	test: {
		include: ['src/**/*.{test,spec}.ts']
	}
});
