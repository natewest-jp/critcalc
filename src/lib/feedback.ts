// The feedback form — the ONE place that knows its id, its entry ids and the
// exact option strings (2026-10-15).
//
// critcalc's reports go to a Google Form. Every "Report a problem" link on the
// site is built here, prefilled through the form's own `usp=pp_url` mechanism
// so the reader lands on the right section with the share link and the
// technical details already typed in.
//
// ⚠️⚠️ The option strings must match the form's choices EXACTLY, apostrophe
// included (a straight `'`, as the form has them). A prefill that matches no
// choice is silently dropped by Google, and the form's branching then never
// sends the reader to the section the category should have opened. Edit the
// form and this file together.
//
// ⚓ SSR-safe: nothing here reads `navigator` at import time — the browser
// string is read only when a URL is built, and only when asked for.

/** The form's viewform address (short link: https://forms.gle/k7MhVXdC6oS6EDzJ9,
 *  which cannot carry a prefill). A plain link to the form uses this as is. */
export const FEEDBACK_FORM_URL =
	'https://docs.google.com/forms/d/e/1FAIpQLSezoj64z3Rpf_a2M7sazZwtKcZePURWUDpllpjZFehtMi9E4g/viewform';

/** "What's this about?" — the choice that BRANCHES the form. */
export const FEEDBACK_CATEGORY = {
	broken: "Something's broken",
	character: "A character isn't right",
	idea: 'An idea or a request',
	other: 'Something else'
} as const;
export type FeedbackCategory = keyof typeof FEEDBACK_CATEGORY;

/** "Where?" */
export const FEEDBACK_TOOL = {
	planner: 'Rotation planner',
	builder: 'Team builder',
	visualizers: 'Visualizers',
	site: 'The rest of the site'
} as const;
export type FeedbackTool = keyof typeof FEEDBACK_TOOL;

const ENTRY = {
	category: 'entry.1492565433',
	tool: 'entry.581506306',
	character: 'entry.1079047765',
	constellation: 'entry.389684346',
	shareLink: 'entry.543945332',
	tech: 'entry.833981546'
} as const;

/**
 * The longest prefill URL we hand out.
 *
 * ⚓ MEASURED 2026-10-15 with curl against the live form: a viewform URL of
 * 8,177 characters returned 200 with the value intact, and one of 8,227
 * returned a bare `400 Bad Request` (Google's front end refuses a request line
 * past ~8 KiB; nothing truncates — it simply fails). 6,000 leaves ~2,000 for
 * whatever a browser or a proxy adds. Past it, the share link is the field
 * dropped (it is the only one that can grow): the reader pastes it instead.
 */
export const MAX_FEEDBACK_URL = 6000;

/** Cap on the browser string, so "Technical details" stays readable. */
const MAX_UA = 200;
/** Cap on an error message carried in "Technical details". */
const MAX_ERROR = 160;

export interface FeedbackPrefill {
	category?: FeedbackCategory;
	tool?: FeedbackTool;
	/** The character's DISPLAY name, as the UI shows it ("Anemo Traveler"). */
	character?: string;
	/** 0–6; becomes "C0".."C6". */
	constellation?: number;
	shareLink?: string | null;
	/** Fill "Technical details" with the site version and the browser. */
	includeTech?: boolean;
	/** A render error to append to the technical details (implies includeTech). */
	error?: unknown;
	/** Overrides `navigator.userAgent` — for tests. */
	userAgent?: string;
}

function clip(s: string, max: number): string {
	return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/** The site version — `__BUILD_ID__` from vite.config.ts. */
export function siteVersion(): string {
	return typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'unknown';
}

/** "Technical details": site version · browser, plus an error when given. */
export function techDetails(opts: { error?: unknown; userAgent?: string } = {}): string {
	const ua =
		opts.userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown browser');
	const parts = [`critcalc ${siteVersion()}`, clip(ua, MAX_UA)];
	if (opts.error !== undefined) {
		const msg = opts.error instanceof Error ? opts.error.message : String(opts.error);
		parts.push(`Error: ${clip(msg.replace(/\s+/g, ' ').trim(), MAX_ERROR)}`);
	}
	return parts.join(' · ');
}

/** encodeURIComponent, plus the five characters it leaves bare — the form's
 *  own option strings carry apostrophes. */
function enc(s: string): string {
	return encodeURIComponent(s).replace(
		/[!'()*]/g,
		(c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
	);
}

/**
 * A prefilled link to the form. Empty fields are omitted; a share link that
 * would push the URL past MAX_FEEDBACK_URL is omitted too.
 */
export function feedbackUrl(p: FeedbackPrefill = {}): string {
	const fields: [string, string][] = [];
	if (p.category) fields.push([ENTRY.category, FEEDBACK_CATEGORY[p.category]]);
	if (p.tool) fields.push([ENTRY.tool, FEEDBACK_TOOL[p.tool]]);
	if (p.character) fields.push([ENTRY.character, p.character]);
	if (p.constellation !== undefined && p.constellation >= 0 && p.constellation <= 6)
		fields.push([ENTRY.constellation, `C${Math.round(p.constellation)}`]);
	if (p.includeTech || p.error !== undefined)
		fields.push([ENTRY.tech, techDetails({ error: p.error, userAgent: p.userAgent })]);
	if (fields.length === 0 && !p.shareLink) return FEEDBACK_FORM_URL;

	const build = (f: [string, string][]) =>
		`${FEEDBACK_FORM_URL}?usp=pp_url${f.map(([k, v]) => `&${k}=${enc(v)}`).join('')}`;
	const base = build(fields);
	if (!p.shareLink) return base;
	const withLink = build([...fields, [ENTRY.shareLink, p.shareLink]]);
	return withLink.length <= MAX_FEEDBACK_URL ? withLink : base;
}

/** Which tool a pathname belongs to — the form's "Where?". */
export function feedbackToolForPath(pathname: string): FeedbackTool {
	if (pathname.startsWith('/planner')) return 'planner';
	if (pathname.startsWith('/builder')) return 'builder';
	if (pathname.startsWith('/visualizers')) return 'visualizers';
	return 'site';
}
