import { m } from '$lib/paraglide/messages';
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
 *
 * ⚓ A section with work that leaving would lose (a team's unsaved draft)
 * HOLDS every way out (`guardLeaving`): `show`, `close` and `openTeam` ask it
 * first, and anything else that leaves (a profile switch) goes through
 * `attempt`. A shallow entry gets no `beforeNavigate`, so this is the only
 * place the exits meet.
 */

import type { TeamRecord } from '$lib/storage/records';
import type { Snippet } from 'svelte';
import { goto, pushState } from '$app/navigation';
import { page } from '$app/state';
import type { Pathname } from '$app/types';
import { hrefTo } from '$lib/i18n/paths';
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
	| 'trash'
	| `help/${string}`
	| `about/${string}`;

/** `path` is canonical (`/roster`): localize it with `hrefTo` where it becomes a
 *  link, and match it against `routeOf(page.url)`. */
export type SectionItem = { id: Section; label: string; path: Pathname };
export type SectionGroup = { id: string; title: string | null; items: SectionItem[] };

// Labels and titles are getters, so each read asks the message for the current
// locale: a plain string here would freeze one language for the whole prerender.
const LIBRARY_ITEMS: SectionItem[] = [
	{
		id: 'rotations',
		get label() {
			return m.menu_rotations();
		},
		path: '/library/rotations'
	},
	{
		id: 'lineups',
		get label() {
			return m.menu_lineups();
		},
		path: '/library/lineups'
	}
];

const chapterItems = (area: typeof HELP_AREA): SectionItem[] =>
	area.chapters.map((c) => ({
		id: `${area.id}/${c.id}` as Section,
		// A getter, so the label follows the page's language (areas.ts).
		get label() {
			return c.title;
		},
		path: c.path
	}));

/**
 * The sidebar (§6.1's table). The profile's group is titled with the profile's
 * own name by the shell, which also shows `profile` to a real profile and
 * `profile/new` to Theorycraft (`profileItems`). Getting started joins Help
 * when written; Keyboard shortcuts is a dialog (`$lib/keysSheet.svelte.ts`),
 * so `MenuState.svelte` draws it as a button, not a section.
 */
export const SECTION_GROUPS: SectionGroup[] = [
	{
		id: 'profile',
		title: null,
		items: [
			{
				id: 'profile',
				get label() {
					return m.menu_profile();
				},
				path: '/profile'
			},
			{
				id: 'profile/new',
				get label() {
					return m.menu_add_a_profile();
				},
				path: '/profile/new'
			},
			{
				id: 'roster',
				get label() {
					return m.menu_roster();
				},
				path: '/roster'
			},
			{
				id: 'teams',
				get label() {
					return m.menu_teams();
				},
				path: '/teams'
			}
		]
	},
	{
		id: 'library',
		get title() {
			return m.menu_library();
		},
		items: LIBRARY_ITEMS
	},
	{
		id: 'help',
		get title() {
			return m.menu_help_group();
		},
		items: chapterItems(HELP_AREA)
	},
	{
		id: 'about',
		get title() {
			return m.menu_about();
		},
		items: chapterItems(ABOUT_AREA)
	},
	{
		id: 'settings',
		get title() {
			return m.menu_settings();
		},
		items: [
			{
				id: 'settings',
				get label() {
					return m.menu_settings();
				},
				path: '/settings'
			},
			// ⚓ Outside every profile, as Settings is (notices design §5).
			{
				id: 'trash',
				get label() {
					return m.menu_trash();
				},
				path: '/trash'
			}
		]
	}
];

const ITEMS = SECTION_GROUPS.flatMap((g) => g.items);

/** The profile group's items for a profile of this kind: a real profile
 *  edits itself; Theorycraft can't be edited and invites an account instead. */
export const profileItems = (kind: 'real' | 'theorycraft'): SectionItem[] =>
	SECTION_GROUPS[0].items.filter((i) => i.id !== (kind === 'real' ? 'profile/new' : 'profile'));

export const itemOf = (id: Section): SectionItem | undefined => ITEMS.find((i) => i.id === id);

const normalize = (p: string) => (p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p);

/** The section a canonical route names, if any (`/library` is the old
 *  Library's, read as Rotations, and its `?tab=roster` as the Roster). Pass
 *  `routeOf(url)`, not the raw pathname. */
export function sectionForPath(pathname: string, search = ''): Section | null {
	const p = normalize(pathname);
	if (p === '/library') return /[?&]tab=roster(&|$)/.test(search) ? 'roster' : 'rotations';
	return ITEMS.find((i) => i.path === p)?.id ?? null;
}

/** The section a help or about door opens. */
export const chapterSection = (area: ChromeAreaId, chapter: string): Section =>
	`${area}/${chapter}` as Section;

/**
 * THE LAST SURFACE (2026-10-27, ⚓ Nate): the landing or tool this tab last
 * showed outside the menu state, so a section reloaded on its own route
 * still closes to where you were rather than to the landing. Per TAB, as
 * the shallow entries it stands in for are: sessionStorage outlives a
 * reload and dies with the tab. The pathname only, ⛔ never the search: a
 * `?r=` link would import its rotation a second time.
 */
const SURFACE_KEY = 'critcalc:lastSurface';

/** Pass the canonical route (`routeOf`), so a reload in any locale reads it. */
export function rememberSurface(pathname: string): void {
	try {
		sessionStorage.setItem(SURFACE_KEY, pathname);
	} catch {
		// Storage refused: closing falls back to the fixed exits.
	}
}

/** Canonical, as `rememberSurface` is handed it. */
function lastSurface(): Pathname | null {
	try {
		return sessionStorage.getItem(SURFACE_KEY) as Pathname | null;
	} catch {
		return null;
	}
}

class MenuState {
	/** The section on a route of its own, set by the pages layout while the
	 *  switch is on (a cold load of `/roster`, a link to `/about`). */
	routed = $state<Section | null>(null);

	/** The Library narrowed to one team's work (a team card's "2 rotations"
	 *  link, design §3): its set's key and its label. Cleared by the Library's
	 *  chip, and on leaving. */
	teamFilter = $state<{ team: TeamRecord; label: string } | null>(null);

	/** PICK MODE (design §6.3): the Library chooses a partner for this
	 *  rotation (Compare with…, §4.6) instead of opening a document. */
	pickFor = $state<string | null>(null);

	/** A section's own controls in the page head's row, left of the ✕ (the
	 *  Roster's edits and lock, 2026-10-26): the section sets it while it is
	 *  mounted and clears it on leaving. */
	headActions = $state<Snippet | null>(null);

	/** Asked with the way out: true means it took the exit, and carries it
	 *  out itself once the user has said to. One holder at a time. */
	#leaveGuard: ((go: () => void) => boolean) | null = null;

	/** Hold every way out while there is work to lose; returns the release. */
	guardLeaving(guard: (go: () => void) => boolean): () => void {
		this.#leaveGuard = guard;
		return () => {
			if (this.#leaveGuard === guard) this.#leaveGuard = null;
		};
	}

	/** Leave by `go`, unless a guard holds the exit. */
	attempt(go: () => void): void {
		if (!this.#leaveGuard?.(go)) go();
	}

	/** What is showing: the shallow entry's section, else the route's. */
	get section(): Section | null {
		return page.state.menu ?? this.routed;
	}

	get open(): boolean {
		return this.section !== null;
	}

	/** A place inside the section to open at: a chapter's `h2` id, read and
	 *  cleared by the menu state once the chapter is on screen (a tool's
	 *  "How it works" opens Help at that tool's own section). */
	anchor = $state<string | null>(null);

	/** Show a section: a new history entry, so Back returns to the last one. */
	show(section: Section, anchor?: string): void {
		this.anchor = anchor ?? null;
		// Teams from inside a team's details goes back to the cards.
		if (section === this.section && !page.state.teamDetail) return;
		this.attempt(() => this.#push(section));
	}

	#push(section: Section): void {
		const depth = (page.state.menuDepth ?? 0) + 1;
		const item = itemOf(section);
		pushState(item ? hrefTo(item.path) : '', {
			...page.state,
			menu: section,
			menuDepth: depth,
			teamDetail: undefined,
			teamSlot: undefined,
			teamGuard: undefined
		});
	}

	/** Teams' details for a team, or `'new'` for one being made: an entry of
	 *  its own over Teams, so Back (or leaving it) returns to the cards. */
	openTeam(id: string, slot?: number): void {
		this.attempt(() => this.#pushTeam(id, slot));
	}

	#pushTeam(id: string, slot?: number): void {
		const depth = (page.state.menuDepth ?? 0) + 1;
		pushState('', {
			...page.state,
			menu: 'teams',
			menuDepth: depth,
			teamDetail: id,
			teamSlot: slot,
			teamGuard: undefined
		});
	}

	get teamSlot(): number | null {
		return page.state.teamSlot ?? null;
	}

	get teamDetail(): string | null {
		return this.section === 'teams' ? (page.state.teamDetail ?? null) : null;
	}

	/** The current tool's button and its library place: in, or back out. */
	toggle(section: Section): void {
		if (this.section === section) this.close();
		else this.show(section);
	}

	/**
	 * Leave the menu state. Over a tool, back over every entry this visit
	 * pushed. On a section's own route there is nothing underneath, so it goes
	 * to the last surface this tab showed (a reload), else to a fixed exit.
	 */
	close(): void {
		this.attempt(() => this.#close());
	}

	#close(): void {
		const depth = page.state.menuDepth ?? 0;
		if (this.routed) {
			// The surface this tab last showed, when it has one (a reload).
			// Else a Library place's way out is its own tool; anything else, home.
			const place = this.section;
			const to =
				lastSurface() ??
				(place === 'rotations' ? '/planner' : place === 'lineups' ? '/builder' : '/');
			void goto(hrefTo(to));
			return;
		}
		if (depth > 0) history.go(-depth);
	}

	/** A pick that goes to a TOOL: leave the menu entries in history (a pop
	 *  and a goto would race) and navigate. The goto drops the shallow state. */
	leaveTo(path: Pathname): void {
		void goto(hrefTo(path));
	}
}

export const menu = new MenuState();
