/**
 * The language switcher's model: which languages it offers, and the link to
 * the page the reader is on, in another language.
 *
 * A language is named in itself (日本語, not "Japanese"), so a reader finds
 * their own whatever language the page is in. The names are not messages
 * for that reason: they read the same in every locale.
 *
 * ⚠️ Moving between locales is a full page load (`./locale.ts` says why), so
 * every switcher link carries `data-sveltekit-reload`.
 */
import { dev } from '$app/environment';
import { localizeHref } from '$lib/paraglide/runtime';
import { getLocale, isIndexed, type Locale } from './locale';
import { routeOf } from './paths';

/** The languages a reader can pick, in the order offered. The pseudo-locale
 *  (`en-XA`) is a test surface and never offered. */
export const LANGUAGES: readonly { locale: Locale; name: string }[] = [
	{ locale: 'en', name: 'English' },
	{ locale: 'ja', name: '日本語' },
	{ locale: 'zh', name: '简体中文' }
];

/**
 * Which languages the switcher offers on this page. A hidden language
 * (unlinked and `noindex`, `isIndexed`) is offered only on a hidden
 * language's own pages, whose reader already found them, so English
 * visitors don't find a draft through the switcher. On English the switcher
 * lists the open languages, and shows only once there are two. In dev it
 * offers every language, for the demo.
 */
export function offeredLanguages(locale: Locale = getLocale()) {
	if (dev || !isIndexed(locale)) return LANGUAGES;
	return LANGUAGES.filter((l) => isIndexed(l.locale));
}

/** Whether the switcher shows at all on this page. */
export const showSwitcher = (locale: Locale = getLocale()) => offeredLanguages(locale).length > 1;

/** The page the reader is on, in `locale`, keeping its query and hash (a
 *  rotation's `?r=` survives the switch).
 *
 *  ⚠️ A prerendered page may not read `url.search`, so a component passes
 *  `withQuery` false until it has mounted: the server paints the bare path,
 *  and the browser adds the query. */
export function hrefIn(url: URL, locale: Locale, withQuery = true): string {
	const tail = withQuery ? `${url.search}${url.hash}` : '';
	return localizeHref(`${routeOf(url)}${tail}`, { locale });
}
