import { afterEach, describe, expect, it } from 'vitest';
import { baseLocale, overwriteGetLocale, type Locale } from '$lib/paraglide/runtime';
import { hrefTo, routeOf } from './paths';
import { htmlLang, isIndexed } from './locale';

const as = (locale: Locale) => overwriteGetLocale(() => locale);
afterEach(() => as(baseLocale));

describe('hrefTo', () => {
	it('leaves English unprefixed', () => {
		expect(hrefTo('/planner')).toBe('/planner');
		expect(hrefTo('/')).toBe('/');
	});

	it("prefixes the reader's locale and keeps the query and hash", () => {
		as('ja');
		expect(hrefTo('/planner?r=abc')).toBe('/ja/planner?r=abc');
		expect(hrefTo('/help/planner#time-token')).toBe('/ja/help/planner#time-token');
	});

	it('writes a locale landing without a trailing slash, as SvelteKit serves it', () => {
		as('zh');
		expect(hrefTo('/')).toBe('/zh');
	});

	it('returns a root path while prerendering, never an absolute URL', () => {
		as('ja');
		expect(hrefTo('/help')).toMatch(/^\/ja\/help$/);
	});
});

describe('routeOf', () => {
	it('strips a locale prefix from a path or a URL', () => {
		expect(routeOf('/ja/planner')).toBe('/planner');
		expect(routeOf(new URL('https://critcalc.app/zh/help/builder?x=1'))).toBe('/help/builder');
		expect(routeOf('/ja')).toBe('/');
	});

	it('leaves an English route alone', () => {
		expect(routeOf('/planner')).toBe('/planner');
		expect(routeOf('/')).toBe('/');
	});

	it('only strips a whole segment', () => {
		expect(routeOf('/japan')).toBe('/japan');
	});
});

describe('locale facts', () => {
	it('names Simplified Chinese in <html lang>', () => {
		expect(htmlLang('zh')).toBe('zh-Hans');
		expect(htmlLang('ja')).toBe('ja');
	});

	it('keeps every locale but English out of search', () => {
		expect(isIndexed('en')).toBe(true);
		expect(isIndexed('ja')).toBe(false);
		expect(isIndexed('zh')).toBe(false);
	});
});
