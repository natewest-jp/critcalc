/**
 * The site's locales, and the per-locale values the platform needs beside
 * Paraglide's own list.
 *
 * ⚠️ The locale is fixed for the life of a document. It comes from the path
 * (`/ja/…`), every internal link keeps that prefix (`./paths.ts`), and moving
 * between locales is a full page load, so nothing re-renders on a change and
 * nothing needs to. A future language switcher links with
 * `data-sveltekit-reload`.
 */
import { baseLocale, getLocale, type Locale } from '$lib/paraglide/runtime';

export { baseLocale, getLocale, locales, type Locale } from '$lib/paraglide/runtime';

/** `<html lang>`. Chinese is Simplified, and saying so lets the browser pick
 *  Simplified glyph forms from the system CJK font. `en-XA` is the
 *  pseudo-locale (`./pseudo.ts`): accented English, never opened to search. */
const HTML_LANG: Record<Locale, string> = { en: 'en', ja: 'ja', zh: 'zh-Hans', 'en-XA': 'en-XA' };

/** `og:locale` wants a territory. */
const OG_LOCALE: Record<Locale, string> = {
	en: 'en_US',
	ja: 'ja_JP',
	zh: 'zh_CN',
	'en-XA': 'en_XA'
};

export const htmlLang = (locale: Locale = getLocale()) => HTML_LANG[locale];
export const ogLocale = (locale: Locale = getLocale()) => OG_LOCALE[locale];

/**
 * Whether this locale is open to search. Only English is, for now: the other
 * locales ship unlinked and `noindex` until Nate opens each one
 * (docs/todo.md § Translation). Opening a locale is a change here, in
 * `static/_headers`, and in `static/sitemap.xml`.
 */
export const isIndexed = (locale: Locale = getLocale()) => locale === baseLocale;
