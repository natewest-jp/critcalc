/**
 * src/lib/seo.ts
 *
 * Every piece of page-level meta copy on the site, in one map.
 *
 * ⚓ ONE EMISSION POINT. `SeoHead.svelte` renders from this map in the ROOT
 * layout and nowhere else. Pages do NOT write their own <svelte:head> titles.
 * That is not tidiness — `<svelte:head>` does not dedupe, so a layout title plus
 * a page title emits TWO <title> tags and leaves it to each scraper to pick one.
 * The same hazard applies to every og:/twitter: tag, which is exactly the class
 * of bug you cannot see locally and cannot fix once a link is in the wild.
 *
 * ⚠️ A NEW ROUTE NEEDS AN ENTRY HERE, and a matching line in static/sitemap.xml.
 * An unlisted path falls back to the site defaults rather than breaking.
 *
 * ⚓ Also the i18n staging ground: when the extraction pass runs, this file is
 * already the whole of the site's meta strings in one place, grouped by route.
 */

export const SITE_NAME = 'critcalc.app';

/** Absolute origin. og:url and canonical must be absolute — relative URLs are
 *  silently dropped by most scrapers, which is a failure you only see by
 *  pasting a link somewhere public. */
export const SITE_URL = 'https://critcalc.app';

/**
 * The social card image.
 *
 * ⚠️ VERSIONED FILENAME, ON PURPOSE — two contracts happen to agree here:
 *   · `/assets/*` is Cache-Control immutable for a year and ADD-ONLY (see
 *     static/_headers), so a changed asset must ship under a NEW name.
 *   · Social platforms cache og:image by URL, often for a long time and with no
 *     way to force a refresh.
 * So when the card is redrawn, bump to `-v2` rather than overwriting. Both the
 * CDN and every scraper then see a genuinely new resource.
 *
 * Spec for the artwork: 1200×630, opaque (no alpha), PNG or JPEG — not WebP,
 * which several scrapers still refuse.
 *
 * ⚠️ AND UNDER 600 KB, which is the constraint that actually binds. Facebook, X
 * and LinkedIn cap at 8/5/5 MB and merely *recommend* under 1 MB — but
 * **WhatsApp caps preview images at 600 KB and does not degrade gracefully:
 * over the cap it drops the preview entirely and the link unfurls bare.** The
 * card shipped as JPEG (q97, 272 KB) for exactly that reason; the source PNG
 * was 711 KB, and maximum-effort LOSSLESS optimization only reached 619 KB, so
 * clearing the cap was not possible without re-encoding. ⛔ Don't "upgrade" this
 * back to PNG for fidelity — platforms re-encode the card anyway, so the quality
 * delta is invisible at the ~400px it renders at, while the WhatsApp failure is
 * total. (Verified 2026-08-16.)
 */
export const OG_IMAGE = '/assets/og/critcalc-og-v2.jpg';
export const OG_IMAGE_W = 1200;
export const OG_IMAGE_H = 630;
export const OG_IMAGE_ALT = 'critcalc.app — tools for Genshin Impact';

/** Shown for any route with no entry below. */
export const DEFAULT_DESCRIPTION = 'Genshin Impact tools for planning and theorycrafting.';

export type PageMeta = {
	/** Bare page name. The site name is appended by `titleFor`, never here. */
	title: string;
	description: string;
};

/**
 * Path → meta. Keys are pathnames without a trailing slash.
 *
 * ⚠️ Descriptions for the three TOOL routes are NEW COPY (2026-08-14) — those
 * pages had titles and no description at all. They are written to be readable as
 * a social-card subtitle, not as keyword bait, and they are first in line for
 * Nate's wording pass.
 */
export const PAGE_META: Record<string, PageMeta> = {
	'/': {
		title: 'Genshin Impact tools',
		description:
			'Three tools for seeing how Genshin works: a frame-accurate rotation timeline, a team builder that shows what each team can provide, and eight graph instruments.'
	},

	'/planner': {
		title: 'Rotation Planner',
		description:
			'Write a rotation in KQM notation and watch it become a frame-accurate timeline: cooldowns, buff windows, auras, and who is on field when.'
	},
	'/builder': {
		title: 'Team Builder',
		description:
			'Build lineups for Stygian Onslaught and the Spiral Abyss: See what each team brings (healing, shields, RES shred, buffs) at your constellations, and what a swap would change.'
	},
	'/visualizers': {
		title: 'Visualizers',
		description:
			'Eight instruments for the mechanics behind the numbers: crit distribution, elemental gauge and ICD, reaction curves, artifact odds, enemy defense and more.'
	},

	'/help': {
		title: 'Help & FAQ',
		description:
			"How to use critcalc's tools, plus answers to common questions about the site and its data."
	},
	'/help/planner': {
		title: 'Rotation Planner help',
		description:
			'How the critcalc Rotation Planner works: KQM-style notation, the team, reading the timeline, playback, and the enemy’s aura.'
	},
	'/help/builder': {
		title: 'Team Builder help',
		description:
			'How the critcalc Team Builder works: capability filters, constellations, lineups, and swapping a character.'
	},
	'/help/visualizers': {
		title: 'Visualizers help',
		description:
			'The critcalc Visualizers: the workspace, and what each of the eight graph instruments shows.'
	},

	'/coverage': {
		title: 'Character coverage',
		description:
			'Which parts of each Genshin character’s kit the critcalc Rotation Planner draws, ability by ability, and what is missing or left out.'
	},

	'/about': {
		title: 'About',
		description:
			'What critcalc is: three Genshin Impact theorycrafting tools, where their data comes from, and who makes them.'
	},
	'/changelog': {
		title: 'What’s new',
		description:
			'The noticeable changes to critcalc’s Genshin Impact tools, newest first, and the known gaps the tools don’t model yet.'
	},
	'/contribute': {
		title: 'Contribute',
		description:
			'How to report a problem with critcalc, and the community projects its data is built on.'
	},
	'/beta': {
		title: 'Beta',
		description:
			'What the beta tag on critcalc means: the tools are still changing; the character data is curated against gcsim.'
	},
	'/library': {
		title: 'Library',
		description:
			'Your saved teams, rotations, and lineups, and the roster of characters you own. All of it is kept in this browser.'
	},
	'/privacy': {
		title: 'Privacy',
		description:
			'What critcalc keeps in your browser, and what leaves it: share links, reports, and visit counts. No accounts, no cookies.'
	},
	'/settings': {
		title: 'Settings',
		description:
			'Display, Human timing, playback sound, and your saved data. All of it is stored in this browser.'
	}
};

/** Trailing slashes are stripped so `/about/` and `/about` resolve alike. */
function normalize(pathname: string): string {
	if (pathname.length > 1 && pathname.endsWith('/')) return pathname.slice(0, -1);
	return pathname;
}

export function metaFor(pathname: string): PageMeta {
	return PAGE_META[normalize(pathname)] ?? { title: '', description: DEFAULT_DESCRIPTION };
}

/**
 * Full document title, `<page> · critcalc.app`.
 *
 * ⚓ The landing keeps a DESCRIPTIVE title ("Genshin Impact tools · critcalc.app")
 * rather than the bare domain. On a Discord or Twitter card the title is the bold
 * line people actually read and the description is small grey text underneath —
 * "critcalc.app" alone tells a stranger nothing, and the home card is the one
 * most shares will use. A route with an empty title falls back to the site name.
 */
export function titleFor(pathname: string): string {
	const { title } = metaFor(pathname);
	return title ? `${title} · ${SITE_NAME}` : SITE_NAME;
}

/** Absolute canonical URL for a path. */
export function canonicalFor(pathname: string): string {
	return `${SITE_URL}${normalize(pathname)}`;
}
