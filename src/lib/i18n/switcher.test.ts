import { afterEach, describe, expect, it, vi } from 'vitest';
import { baseLocale, overwriteGetLocale, type Locale } from '$lib/paraglide/runtime';
import { hrefIn, offeredLanguages } from './switcher';

const as = (locale: Locale) => overwriteGetLocale(() => locale);
afterEach(() => as(baseLocale));

vi.mock('$app/environment', () => ({ dev: false, browser: false }));

const url = (path: string) => new URL(path, 'https://critcalc.app');

describe('hrefIn', () => {
	it('links the same page in another language, keeping the query and hash', () => {
		expect(hrefIn(url('/planner?r=3~abc#x'), 'ja')).toBe('/ja/planner?r=3~abc#x');
		as('ja');
		expect(hrefIn(url('/ja/help/planner'), 'zh')).toBe('/zh/help/planner');
		expect(hrefIn(url('/ja/builder'), 'en')).toBe('/builder');
	});

	it('drops the query when asked, for a prerendered page', () => {
		expect(hrefIn(url('/planner?r=abc'), 'ja', false)).toBe('/ja/planner');
	});

	it('links a landing without a trailing slash', () => {
		expect(hrefIn(url('/'), 'ja')).toBe('/ja');
		as('zh');
		expect(hrefIn(url('/zh'), 'en')).toBe('/');
	});
});

describe('offeredLanguages', () => {
	it('offers every language on a hidden language’s own pages', () => {
		expect(offeredLanguages('ja').map((l) => l.locale)).toEqual(['en', 'ja', 'zh']);
	});

	it('offers only open languages on English, so a draft stays unlinked', () => {
		expect(offeredLanguages('en').map((l) => l.locale)).toEqual(['en']);
	});

	it('never offers the pseudo-locale', () => {
		expect(offeredLanguages('ja').some((l) => l.locale === 'en-XA')).toBe(false);
	});
});
