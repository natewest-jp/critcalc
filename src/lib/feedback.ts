// The feedback forms — the ONE place that knows their ids, their entry ids and
// the exact option strings (2026-10-15).
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
// string is read only when a URL is built, and only when asked for. The
// locale is read then too, never at module load (a prerender serves every
// locale from one module).

import { getLocale, type Locale } from '$lib/i18n/locale';

/** One form per language: Google Forms holds one language per form. The
 *  Japanese and Chinese forms are copies of the English one, so they keep the
 *  English form's entry ids and branching, and answers land in their own tabs
 *  of the same Sheet. A locale with no form of its own uses the English one. */
type FeedbackForm = {
	/** The viewform address. A plain link to the form uses this as is. */
	url: string;
	/** "What's this about?": the choice that BRANCHES the form. */
	category: Record<FeedbackCategory, string>;
	/** "Where?" */
	tool: Record<FeedbackTool, string>;
};

export type FeedbackCategory = 'broken' | 'character' | 'idea' | 'other';
export type FeedbackTool = 'planner' | 'builder' | 'visualizers' | 'site';

const FORMS: Partial<Record<Locale, FeedbackForm>> & { en: FeedbackForm } = {
	en: {
		// Short link: https://forms.gle/k7MhVXdC6oS6EDzJ9 (it can't carry a prefill).
		url: 'https://docs.google.com/forms/d/e/1FAIpQLSezoj64z3Rpf_a2M7sazZwtKcZePURWUDpllpjZFehtMi9E4g/viewform',
		category: {
			broken: "Something's broken",
			character: "A character isn't right",
			idea: 'An idea or a request',
			other: 'Something else'
		},
		tool: {
			planner: 'Rotation planner',
			builder: 'Team builder',
			visualizers: 'Visualizers',
			site: 'The rest of the site'
		}
	},
	ja: {
		url: 'https://docs.google.com/forms/d/e/1FAIpQLSdZOXkQullJPX4a1pWV1DHLeit_wtNUGQJJs50WfC3as19OQg/viewform',
		category: {
			broken: '不具合がある',
			character: 'キャラクターの情報に誤りがある',
			idea: 'アイデアやリクエスト',
			other: 'その他'
		},
		tool: {
			planner: 'ローテーションプランナー',
			builder: 'チームビルダー',
			visualizers: 'ビジュアライザー',
			site: 'サイトのその他の部分'
		}
	},
	zh: {
		url: 'https://docs.google.com/forms/d/e/1FAIpQLSd3GCCYMb8eoW1bDFl7smIsDbPZEIkaT-axAMgQxas_xNY-YA/viewform',
		category: {
			broken: '功能出了问题',
			character: '角色数据有误',
			idea: '想法或需求',
			other: '其他'
		},
		tool: {
			planner: '排轴工具',
			builder: '配队工具',
			visualizers: '可视化工具',
			site: '网站的其他部分'
		}
	}
};

const formFor = (locale: Locale): FeedbackForm => FORMS[locale] ?? FORMS.en;

/** The form a reader in this locale should land on. */
export const feedbackFormUrl = (locale: Locale = getLocale()) => formFor(locale).url;

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
export function feedbackUrl(p: FeedbackPrefill = {}, locale: Locale = getLocale()): string {
	const form = formFor(locale);
	const fields: [string, string][] = [];
	if (p.category) fields.push([ENTRY.category, form.category[p.category]]);
	if (p.tool) fields.push([ENTRY.tool, form.tool[p.tool]]);
	if (p.character) fields.push([ENTRY.character, p.character]);
	if (p.constellation !== undefined && p.constellation >= 0 && p.constellation <= 6)
		fields.push([ENTRY.constellation, `C${Math.round(p.constellation)}`]);
	if (p.includeTech || p.error !== undefined)
		fields.push([ENTRY.tech, techDetails({ error: p.error, userAgent: p.userAgent })]);
	if (fields.length === 0 && !p.shareLink) return form.url;

	const build = (f: [string, string][]) =>
		`${form.url}?usp=pp_url${f.map(([k, v]) => `&${k}=${enc(v)}`).join('')}`;
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
