/**
 * THE MENU STATE (profiles and surfaces design §6; build plan §13, phase 2c):
 * everything you go to on purpose (the Library, the Roster, Help, About,
 * Settings) as one full-screen state on slate, the top bar on it. ⚓ A STATE,
 * not an overlay: the UI flips between the world and the menus, as Genshin's
 * own Party Setup and Archive do.
 *
 * ⚓ EVERY SECTION HAS ITS OWN ADDRESS (§13.4), and opening one never remounts
 * the tool underneath: a section is a SHALLOW history entry (`pushState` with
 * the section's path), so the address bar, Back and a copied link all name
 * the section while `page.url` (and so the tools layout's `{#key}`) still
 * names the tool. A reload of that address lands on the section's own route,
 * which shows the menu state with no tool under it.
 *
 * ⚓ Leaving goes back over every section entry this visit pushed (`depth`),
 * so one Escape returns to the tool, not to the previous section.
 */

import { goto, pushState } from '$app/navigation';
import { page } from '$app/state';
import { resolve } from '$app/paths';
import { ABOUT_AREA, HELP_AREA, type ChromeAreaId } from '$lib/help/areas';

export type Section =
	| 'index'
	| 'profile'
	| 'profile/new'
	| 'roster'
	| 'teams'
	| 'rotations'
	| 'lineups'
	| 'settings'
	| `help/${string}`
	| `about/${string}`;

export type SectionItem = { id: Section; label: string; path: string; tool?: string };
export type SectionGroup = { id: string; title: string | null; items: SectionItem[] };

const LIBRARY_ITEMS: SectionItem[] = [
	{ id: 'rotations', label: 'Rotations', path: resolve('/library/rotations'), tool: 'Planner' },
	{ id: 'lineups', label: 'Lineups', path: resolve('/library/lineups'), tool: 'Builder' }
];

const chapterItems = (area: typeof HELP_AREA): SectionItem[] =>
	area.chapters.map((c) => ({ id: `${area.id}/${c.id}` as Section, label: c.title, path: c.path }));

/**
 * The sidebar (§6.1's table). The profile's group is titled with the profile's
 * own name by the shell, which also shows `profile` to a real profile and
 * `profile/new` to Theorycraft (`profileItems`). Getting started and
 * Keyboard shortcuts join Help when written.
 */
export const SECTION_GROUPS: SectionGroup[] = [
	{
		id: 'profile',
		title: null,
		items: [
			{ id: 'profile', label: 'Profile', path: resolve('/profile') },
			{ id: 'profile/new', label: 'Add your account', path: resolve('/profile/new') },
			{ id: 'roster', label: 'Roster', path: resolve('/roster') },
			{ id: 'teams', label: 'Teams', path: resolve('/teams') }
		]
	},
	{ id: 'library', title: 'Library', items: LIBRARY_ITEMS },
	{ id: 'help', title: 'Help', items: chapterItems(HELP_AREA) },
	{ id: 'about', title: 'About', items: chapterItems(ABOUT_AREA) },
	{
		id: 'settings',
		title: 'Settings',
		items: [{ id: 'settings', label: 'Settings', path: resolve('/settings') }]
	}
];

const ITEMS = SECTION_GROUPS.flatMap((g) => g.items);

/** The profile group's items for a profile of this kind: a real profile
 *  edits itself; Theorycraft can't be edited and invites an account instead. */
export const profileItems = (kind: 'real' | 'theorycraft'): SectionItem[] =>
	SECTION_GROUPS[0].items.filter((i) => i.id !== (kind === 'real' ? 'profile/new' : 'profile'));

export const itemOf = (id: Section): SectionItem | undefined => ITEMS.find((i) => i.id === id);

const normalize = (p: string) => (p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p);

/** The section an address names, if any (`/library` is the old Library's,
 *  read as Rotations). */
export function sectionForPath(pathname: string): Section | null {
	const p = normalize(pathname);
	if (p === resolve('/library')) return 'rotations';
	return ITEMS.find((i) => i.path === p)?.id ?? null;
}

/** The section a help or about door opens. */
export const chapterSection = (area: ChromeAreaId, chapter: string): Section =>
	`${area}/${chapter}` as Section;

class MenuState {
	/** The section on a route of its own, set by the pages layout while the
	 *  switch is on (a cold load of `/roster`, a link to `/about`). */
	routed = $state<Section | null>(null);

	/** The Library narrowed to one team's work (a team card's "2 rotations"
	 *  link, design §3): its set's key and its label. Cleared by the Library's
	 *  chip, and on leaving. */
	teamFilter = $state<{ key: string; label: string } | null>(null);

	/** What is showing: the shallow entry's section, else the route's. */
	get section(): Section | null {
		return page.state.menu ?? this.routed;
	}

	get open(): boolean {
		return this.section !== null;
	}

	/** Show a section: a new history entry, so Back returns to the last one. */
	show(section: Section): void {
		if (section === this.section) return;
		const depth = (page.state.menuDepth ?? 0) + 1;
		const path = itemOf(section)?.path ?? '';
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- section paths are resolved in SECTION_GROUPS
		pushState(path, { ...page.state, menu: section, menuDepth: depth });
	}

	/** The current tool's button and its library place: in, or back out. */
	toggle(section: Section): void {
		if (this.section === section) this.close();
		else this.show(section);
	}

	/**
	 * Leave the menu state. Over a tool, back over every entry this visit
	 * pushed. On a section's own route there is nothing underneath, so it goes
	 * to the landing (as a static page's Escape always has).
	 */
	close(): void {
		const depth = page.state.menuDepth ?? 0;
		if (this.routed) {
			// A Library place's way out is its own tool; anything else, home.
			const place = this.section;
			const to =
				place === 'rotations'
					? resolve('/planner')
					: place === 'lineups'
						? resolve('/builder')
						: resolve('/');
			// eslint-disable-next-line svelte/no-navigation-without-resolve -- resolved above
			void goto(to);
			return;
		}
		if (depth > 0) history.go(-depth);
	}

	/** A pick that goes to a TOOL: leave the menu entries in history (a pop
	 *  and a goto would race) and navigate. The goto drops the shallow state. */
	leaveTo(path: string): void {
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- callers pass a resolved path
		void goto(path);
	}
}

export const menu = new MenuState();
