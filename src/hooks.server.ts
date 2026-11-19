import type { Handle } from '@sveltejs/kit';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { htmlLang } from '$lib/i18n/locale';

/**
 * Runs for every page the build prerenders (the site has no server at
 * runtime). The middleware scopes the request's locale, read from its path,
 * so every message on that page renders in it, and fills `<html lang>` from
 * the same locale.
 *
 * ⚠️ SvelteKit's own event goes on, not the middleware's de-localized request:
 * `reroute` in `hooks.ts` already strips the prefix, and stripping it twice is
 * the redirect loop Paraglide's middleware notes warn about.
 */
export const handle: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ locale }) =>
		resolve(event, {
			transformPageChunk: ({ html }) => html.replace('%critcalc.lang%', htmlLang(locale))
		})
	);
