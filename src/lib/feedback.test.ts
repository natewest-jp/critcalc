import { describe, expect, it } from 'vitest';
import {
	FEEDBACK_FORM_URL,
	MAX_FEEDBACK_URL,
	feedbackToolForPath,
	feedbackUrl,
	techDetails
} from './feedback';

/** The prefill fields as Google will read them (form-decoded). */
function fields(url: string): Record<string, string> {
	const u = new URL(url);
	return Object.fromEntries([...u.searchParams.entries()]);
}

describe('feedbackUrl', () => {
	it('is the bare form with nothing to prefill', () => {
		expect(feedbackUrl()).toBe(FEEDBACK_FORM_URL);
	});

	it('writes the option strings exactly, apostrophes encoded', () => {
		const url = feedbackUrl({ category: 'broken', tool: 'planner' });
		expect(url).toContain('?usp=pp_url&');
		expect(url).toContain('entry.1492565433=Something%27s%20broken');
		expect(url).not.toContain("'");
		expect(fields(url)).toEqual({
			usp: 'pp_url',
			'entry.1492565433': "Something's broken",
			'entry.581506306': 'Rotation planner'
		});
		expect(fields(feedbackUrl({ category: 'character' }))['entry.1492565433']).toBe(
			"A character isn't right"
		);
		expect(fields(feedbackUrl({ tool: 'site' }))['entry.581506306']).toBe('The rest of the site');
	});

	it('encodes a + so it survives form decoding', () => {
		const link = 'https://critcalc.app/planner?r=2.ab+cd/ef=';
		const url = feedbackUrl({ shareLink: link });
		expect(url).toContain('%2B');
		expect(fields(url)['entry.543945332']).toBe(link);
	});

	it('names the character and the constellation, and omits empty fields', () => {
		const f = fields(
			feedbackUrl({ category: 'character', character: 'Anemo Traveler', constellation: 0 })
		);
		expect(f['entry.1079047765']).toBe('Anemo Traveler');
		expect(f['entry.389684346']).toBe('C0');
		expect(f).not.toHaveProperty('entry.543945332');
		expect(f).not.toHaveProperty('entry.833981546');
		expect(fields(feedbackUrl({ character: '', shareLink: null }))).toEqual({});
	});

	it('drops the share link, and only it, past the length cap', () => {
		const long = `https://critcalc.app/planner?r=${'a'.repeat(MAX_FEEDBACK_URL)}`;
		const url = feedbackUrl({ category: 'broken', tool: 'planner', shareLink: long });
		expect(url.length).toBeLessThanOrEqual(MAX_FEEDBACK_URL);
		expect(fields(url)).not.toHaveProperty('entry.543945332');
		expect(fields(url)['entry.581506306']).toBe('Rotation planner');
	});

	it('carries the site version, a capped browser string and an error', () => {
		const ua = 'Mozilla/5.0 '.repeat(40);
		const f = fields(feedbackUrl({ includeTech: true, userAgent: ua }));
		const tech = f['entry.833981546'];
		expect(tech.startsWith('critcalc ')).toBe(true);
		expect(tech.length).toBeLessThan(300);
		const withErr = techDetails({ userAgent: 'UA', error: new RangeError('x'.repeat(500)) });
		expect(withErr).toContain('Error: xxx');
		expect(withErr.length).toBeLessThan(300);
	});
});

describe('feedbackToolForPath', () => {
	it('maps the tool routes, and everything else to the site', () => {
		expect(feedbackToolForPath('/planner')).toBe('planner');
		expect(feedbackToolForPath('/builder')).toBe('builder');
		expect(feedbackToolForPath('/visualizers')).toBe('visualizers');
		expect(feedbackToolForPath('/contribute')).toBe('site');
	});
});
