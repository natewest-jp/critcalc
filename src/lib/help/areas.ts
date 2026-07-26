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
 */

import type { Component } from 'svelte';
import { resolve } from '$app/paths';

export type ChromeAreaId = 'help' | 'about';

export type Chapter = {
	/** Stable id, and the chapter's slug within its area. */
	id: string;
	title: string;
	/** Canonical route, already base-resolved — hrefs use it verbatim. */
	path: string;
	/** Overlay-only lazy loader; routes import the component directly. */
	load: () => Promise<{ default: Component }>;
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
	title: 'Help',
	chapters: [
		{
			id: 'faq',
			title: 'FAQ',
			path: resolve('/help'),
			load: () => import('./chapters/Faq.svelte')
		},
		{
			id: 'team-builder',
			title: 'Team Builder',
			path: resolve('/help/team-builder'),
			load: () => import('./chapters/TeamBuilder.svelte')
		},
		{
			id: 'rotation-planner',
			title: 'Rotation Planner',
			path: resolve('/help/rotation-planner'),
			load: () => import('./chapters/RotationPlanner.svelte')
		},
		{
			id: 'crit-visualizer',
			title: 'Visualizers',
			path: resolve('/help/crit-visualizer'),
			load: () => import('./chapters/Visualizers.svelte')
		}
	]
};

// About's three are top-level peers rather than nested under /about: /privacy
// is the conventional URL for a privacy policy and /contribute is worth
// sharing on its own. Help's chapters nest because they genuinely are
// subordinate to "help".
export const ABOUT_AREA: Area = {
	id: 'about',
	title: 'About',
	chapters: [
		{
			id: 'about',
			title: 'About',
			path: resolve('/about'),
			load: () => import('./chapters/About.svelte')
		},
		{
			id: 'contribute',
			title: 'Contribute',
			path: resolve('/contribute'),
			load: () => import('./chapters/Contribute.svelte')
		},
		{
			id: 'privacy',
			title: 'Privacy',
			path: resolve('/privacy'),
			load: () => import('./chapters/Privacy.svelte')
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
 * ('/rotation-planner' → 'rotation-planner'); anything unrecognised falls back
 * to the FAQ.
 */
export function helpChapterForPath(pathname: string): string {
	const slug = pathname.split('/')[1] ?? '';
	return HELP_AREA.chapters.some((c) => c.id === slug) ? slug : 'faq';
}
