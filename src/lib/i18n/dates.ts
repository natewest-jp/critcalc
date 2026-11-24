/**
 * A calendar day written in the page's language: "November 11" in English,
 * "11月11日" in Japanese. The day is read and written in UTC, so the build
 * machine's time zone can't move it a day.
 */
import { htmlLang } from './locale';
import type { Locale } from './locale';

export function formatDay(
	iso: string,
	options: Intl.DateTimeFormatOptions,
	locale?: Locale
): string {
	return new Date(`${iso}T00:00:00Z`).toLocaleDateString(htmlLang(locale), {
		...options,
		timeZone: 'UTC'
	});
}
