/** The two meta content areas — Help and About — as one manifest.
 *
 * Each area is a short list of chapters, and every chapter exists twice: as a
 * real prerendered route (deep links, search results, "open as full page") and
 * as a pane inside the chrome overlay. Both render the SAME component from
 * `chapters/`, so there is one copy of every sentence.
 *
 * Routes import their chapter component statically — that is what lets them
 * prerender. The overlay uses `load()` instead, so the landing bundle does not
 * carry the whole help corpus just to have a `?` button.
 *
 * Chapter components own their own headings. Convention: give every `<h2>` an
 * `id` — HelpAreaShell derives the sidebar's table of contents from the
 * rendered `h2[id]` elements rather than from a list kept here, so the TOC
 * cannot drift as chapters grow.
 *
 * Titles are getters: a message read at module load would freeze one locale
 * for the whole prerender.
 */

import type { Component } from 'svelte';
import type { Pathname } from '$app/types';
import { m } from '$lib/paraglide/messages';

export type ChromeAreaId = 'help' | 'about';

export type Chapter = {
	/** Stable id, and the chapter's slug within its area. */
	id: string;
	title: string;
	/** Canonical route: localize it with `hrefTo` from `$lib/i18n/paths`. */
	path: Pathname;
	/** Overlay-only lazy loader; routes import the component directly. */
	load: () => Promise<{ default: Component }>;
	/** Renders WITHOUT the `.prose` article, whose typography would restyle a
	 *  table's lists and headings. */
	bare?: true;
};

export type Area = {
	id: ChromeAreaId;
	title: string;
	chapters: Chapter[];
};

// Chapter order = the sidebar order. Help leads with the general FAQ (what the
// ? opens from the landing, where there is no tool context) and then follows
// the tool order from toolChrome.ts.
export const HELP_AREA: Area = {
	id: 'help',
	get title() {
		return m.help_help();
	},
	chapters: [
		{
			id: 'faq',
			get title() {
				return m.help_faq();
			},
			path: '/help',
			load: () => import('./chapters/Faq.svelte')
		},
		{
			id: 'builder',
			get title() {
				return m.help_team_builder();
			},
			path: '/help/builder',
			load: () => import('./chapters/TeamBuilder.svelte')
		},
		{
			id: 'planner',
			get title() {
				return m.help_rotation_planner();
			},
			path: '/help/planner',
			load: () => import('./chapters/RotationPlanner.svelte')
		},
		{
			id: 'visualizers',
			get title() {
				return m.help_visualizers();
			},
			path: '/help/visualizers',
			load: () => import('./chapters/Visualizers.svelte')
		}
	]
};

// About's chapters are top-level peers rather than nested under /about: /privacy
// is the conventional URL for a privacy policy and /contribute is worth
// sharing on its own. Help's chapters nest because they genuinely are
// subordinate to "help".
export const ABOUT_AREA: Area = {
	id: 'about',
	get title() {
		return m.help_about();
	},
	chapters: [
		{
			id: 'about',
			get title() {
				return m.help_about();
			},
			path: '/about',
			load: () => import('./chapters/About.svelte')
		},
		{
			// ⚓ Nate 2026-10-21: the noticeable changes, newest first.
			id: 'changelog',
			get title() {
				return m.help_what_s_new();
			},
			path: '/changelog',
			load: () => import('./chapters/Changelog.svelte')
		},
		{
			id: 'contribute',
			get title() {
				return m.help_contribute();
			},
			path: '/contribute',
			load: () => import('./chapters/Contribute.svelte')
		},
		{
			id: 'beta',
			get title() {
				return m.help_beta();
			},
			path: '/beta',
			load: () => import('./chapters/Beta.svelte')
		},
		{
			id: 'privacy',
			get title() {
				return m.help_privacy();
			},
			path: '/privacy',
			load: () => import('./chapters/Privacy.svelte')
		},
		{
			// ⚓ Nate 2026-09-23: the coverage page's home in the navigation.
			id: 'coverage',
			get title() {
				return m.help_coverage();
			},
			path: '/coverage',
			load: () => import('$lib/components/CoverageList.svelte'),
			bare: true
		}
	]
};

export const AREAS: Record<ChromeAreaId, Area> = {
	help: HELP_AREA,
	about: ABOUT_AREA
};

/** First chapter of an area — what the chrome glyph opens with no context. */
export const defaultChapter = (area: ChromeAreaId): string => AREAS[area].chapters[0].id;

export const findChapter = (area: ChromeAreaId, id: string): Chapter =>
	AREAS[area].chapters.find((c) => c.id === id) ?? AREAS[area].chapters[0];

/**
 * The help chapter for a tool route, so the in-tool "?" opens that tool's own
 * chapter. Tool paths and help chapter ids are deliberately the same slug
 * ('/planner' → 'planner'); anything unrecognized falls back
 * to the FAQ.
 */
export function helpChapterForPath(pathname: string): string {
	const slug = pathname.split('/')[1] ?? '';
	return HELP_AREA.chapters.some((c) => c.id === slug) ? slug : 'faq';
}
