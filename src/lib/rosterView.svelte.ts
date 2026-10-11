/**
 * The Roster tab's Show filter, shared by the tab and the Library header's
 * totals ("29 owned · 4 on your wishlist"), which ARE that filter (⚓ Nate
 * 2026-10-11): a click on a total shows just those characters. The two live in
 * different parts of the overlay, so the state lives here.
 */
export type RosterShow = 'all' | 'owned' | 'wishlist' | 'unowned';

export const rosterView = $state({ show: 'all' as RosterShow });
