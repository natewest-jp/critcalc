/**
 * The open Move to a profile confirmation (design §4.3; build plan §13, phase
 * 3): the id of the Theorycraft document being moved. Kept free of imports so
 * the Library and the link notice can raise it without pulling the storage
 * session; the scene layout hosts the dialog while it is set.
 */
export const moveRequest = $state<{ id: string | null }>({ id: null });

/** The one-time "links open in Theorycraft" dialog (design §9.3; to-do,
 *  Nate 2026-10-22): open the FIRST time a link moves someone out of a real
 *  profile, carrying the arrival's id when it can be moved to a profile. */
export const linksIntro = $state<{ open: boolean; moveId: string | null }>({
	open: false,
	moveId: null
});

/** The notice button's label, beside "Opened in Theorycraft" (§9.3). */
export const MOVE_TO_PROFILE = 'Move to a profile';
