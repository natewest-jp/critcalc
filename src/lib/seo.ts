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
 * The words themselves are messages (`messages/*.json`, keys `seo_*`).
 */

import { m } from '$lib/paraglide/messages';

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
export const OG_IMAGE_ALT = m.seo_critcalc_app_tools_for_genshin_impact;

/** Shown for any route with no entry below. */
export const DEFAULT_DESCRIPTION = m.seo_genshin_impact_tools_for_planning_and;

export type PageMeta = {
	/** Bare page name. The site name is appended by `titleFor`, never here. */
	title: string;
	description: string;
	/** Kept out of search: `SeoHead` emits `robots: noindex` and no canonical,
	 *  and the page stays out of static/sitemap.xml (conventions.test.ts). For a
	 *  page that shows only this browser's data: it prerenders empty, and Google
	 *  reports a set of identical empty pages as not indexed. */
	noindex?: true;
};

/** An entry whose words are read at each use, in the page's language: the map
 *  is built at module load, where a called message would freeze one locale
 *  for the whole prerender. */
function entry(title: () => string, description: () => string, noindex?: true): PageMeta {
	return {
		get title() {
			return title();
		},
		get description() {
			return description();
		},
		...(noindex && { noindex })
	};
}

/**
 * Path → meta. Keys are pathnames without a trailing slash.
 *
 * ⚠️ Descriptions for the three TOOL routes are NEW COPY (2026-08-14) — those
 * pages had titles and no description at all. They are written to be readable as
 * a social-card subtitle, not as keyword bait, and they are first in line for
 * Nate's wording pass.
 */
export const PAGE_META: Record<string, PageMeta> = {
	'/': entry(m.seo_genshin_impact_tools, m.seo_three_tools_for_seeing_how_genshin_works),
	'/planner': entry(m.seo_rotation_planner, m.seo_write_a_rotation_in_kqm_notation_and),
	'/builder': entry(m.seo_team_builder, m.seo_build_lineups_for_stygian_onslaught_and),
	'/visualizers': entry(m.seo_visualizers, m.seo_eight_instruments_for_the_mechanics),
	'/help': entry(m.seo_help_faq, m.seo_how_to_use_critcalc_s_tools_plus_answers),
	'/help/planner': entry(
		m.seo_rotation_planner_help,
		m.seo_how_the_critcalc_rotation_planner_works
	),
	'/help/builder': entry(m.seo_team_builder_help, m.seo_how_the_critcalc_team_builder_works),
	'/help/visualizers': entry(m.seo_visualizers_help, m.seo_the_critcalc_visualizers_the_workspace),
	'/coverage': entry(m.seo_character_coverage, m.seo_which_parts_of_each_genshin_character_s),
	'/about': entry(m.seo_about, m.seo_what_critcalc_is_three_genshin_impact),
	'/changelog': entry(m.seo_what_s_new, m.seo_the_noticeable_changes_to_critcalc_s),
	'/contribute': entry(m.seo_contribute, m.seo_how_to_report_a_problem_with_critcalc),
	'/beta': entry(m.seo_beta, m.seo_what_the_beta_tag_on_critcalc_means_the),
	'/library': entry(m.seo_library, m.seo_your_saved_teams_rotations_and_lineups, true),
	// The menu state's addresses (build plan §13.4). Each prerenders an empty,
	// generic page (a profile's data lives in this browser and never reaches a
	// crawler), so each is noindex (⚓ Nate 2026-11-11, after Search Console
	// reported them as not indexed). Settings and Privacy have text of their own
	// and stay indexable.
	'/library/rotations': entry(m.seo_rotations, m.seo_your_saved_rotations_all_of_them_are, true),
	'/library/lineups': entry(m.seo_lineups, m.seo_your_saved_lineups_all_of_them_are_kept, true),
	'/profile': entry(m.seo_profile, m.seo_your_profile_in_this_browser_its_name, true),
	'/profile/new': entry(m.seo_add_a_profile, m.seo_add_a_profile_for_your_genshin_account, true),
	'/roster': entry(m.seo_roster, m.seo_the_characters_you_own_and_their, true),
	'/teams': entry(m.seo_teams, m.seo_your_named_teams_ready_to_plan_a, true),
	'/privacy': entry(m.seo_privacy, m.seo_what_critcalc_keeps_in_your_browser_and),
	'/trash': entry(m.seo_trash, m.seo_deleted_rotations_lineups_teams_and, true),
	'/settings': entry(m.seo_settings, m.seo_display_human_timing_playback_sound_and)
};

/** Trailing slashes are stripped so `/about/` and `/about` resolve alike. */
function normalize(pathname: string): string {
	if (pathname.length > 1 && pathname.endsWith('/')) return pathname.slice(0, -1);
	return pathname;
}

export function metaFor(pathname: string): PageMeta {
	return PAGE_META[normalize(pathname)] ?? { title: '', description: DEFAULT_DESCRIPTION() };
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
