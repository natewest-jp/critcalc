/**
 * src/lib/library.svelte.ts
 *
 * The Roster's arrival: a details card's "Edit in Roster" opens the menu
 * state's Roster section on one character. The Library's places are the menu
 * state's (build plan §13, 2c); the model they share (grouping, tags) is
 * `library.ts`.
 */

import { menu } from './menuState.svelte';

class LibraryState {
	/** The character the Roster should scroll to and flash when it opens.
	 *  Read once by the section, then cleared. */
	rosterFocus = $state<string | null>(null);

	/** The Roster section, optionally arriving on one character. */
	openRoster(focusId: string | null = null) {
		this.rosterFocus = focusId;
		menu.show('roster');
	}
}

export const library = new LibraryState();
