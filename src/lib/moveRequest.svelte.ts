/**
 * The open Move to a profile confirmation (design §4.3; build plan §13, phase
 * 3): the id of the Theorycraft document being moved. Kept free of imports so
 * the Library and the link notice can raise it without pulling the storage
 * session; the scene layout hosts the dialog while it is set.
 */
export const moveRequest = $state<{ id: string | null }>({ id: null });

/** The notice button's label, beside "Opened in Theorycraft" (§9.3). */
export const MOVE_TO_PROFILE = 'Move to a profile';
