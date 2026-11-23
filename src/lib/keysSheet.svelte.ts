/**
 * THE KEYBOARD SHORTCUTS SHEET (to-do, ⚓ Nate 2026-11-13): one dialog over
 * the tool, opened by `?` and from Help's sidebar. It shows the area you are
 * in first, then the keys that work everywhere, then the other areas.
 *
 * ⚠️ This list is read off the handlers, not the other way round: a new
 * shortcut needs a row here, or the sheet quietly stops being the whole
 * truth. Each row names where its handler lives.
 *
 * Kept free of component imports so the scene layout and the menu state can
 * open it without pulling the dialog in.
 */

import { page } from '$app/state';
import { menu } from '$lib/menuState.svelte';
import { routeOf } from '$lib/i18n/paths';
import { m } from '$lib/paraglide/messages';

export const keysSheet = $state<{ open: boolean }>({ open: false });

/** A key as the sheet draws it: `mod` is ⌘ on a Mac and Ctrl elsewhere,
 *  `shift` and `ctrl` follow the platform too, and the four arrows are marks
 *  (`.claude/rules/ui.md`: symbol marks are geometry). */
export type Key = 'mod' | 'shift' | 'ctrl' | 'left' | 'right' | 'up' | 'down' | (string & {});

/** One row: each inner list is a combination, and the rows' alternatives are
 *  joined with "or". */
export type Shortcut = { keys: Key[][]; does: string };

export type KeyAreaId = 'everywhere' | 'planner' | 'builder' | 'roster' | 'teams' | 'visualizers';
export type KeyArea = { id: KeyAreaId; title: string; note?: string; rows: Shortcut[] };

// Wording approved by Nate 2026-11-13; changes are proposed first.
/** Built at each opening, so the sheet reads the page's language. */
export const keyAreas = (): KeyArea[] => [
	{
		id: 'everywhere',
		title: m.keys_everywhere(),
		rows: [
			// The scene layout (`+layout.svelte`).
			{ keys: [['?']], does: m.keys_show_these_shortcuts() },
			// Each dialog, menu and the menu state (`MenuState.svelte`).
			{ keys: [['Esc']], does: m.keys_close_a_menu_a_dialog_or_help() },
			// The storage session's `#onKey`.
			{ keys: [['mod', 'S']], does: m.keys_check_that_your_work_is_saved_it_saves() }
		]
	},
	{
		id: 'planner',
		title: m.keys_rotation_planner(),
		rows: [
			// `planner/+page.svelte` `onTransportKey`.
			{ keys: [['Space']], does: m.keys_play_or_pause() },
			{ keys: [['Home']], does: m.keys_back_to_the_start() },
			// CodeMirror's own keymap, and the Undo and Redo buttons.
			{ keys: [['mod', 'Z']], does: m.keys_undo_a_notation_change() },
			{ keys: [['mod', 'shift', 'Z']], does: m.keys_redo() },
			// The storage session's `#onFlipKey` → `other('planner')`.
			{
				keys: [['ctrl', '`']],
				does: m.keys_switch_to_the_other_rotation_of_a_pair()
			},
			// `EventLog.svelte`.
			{ keys: [['up'], ['down']], does: m.keys_step_through_the_event_log() },
			{ keys: [['Home'], ['End']], does: m.keys_jump_to_the_first_or_last_event() }
		]
	},
	{
		id: 'builder',
		title: m.keys_team_builder(),
		rows: [
			// The storage session's `#onFlipKey` → `other('builder')`.
			{ keys: [['ctrl', '`']], does: m.keys_back_to_the_last_lineup_you_had_open() },
			// `builder/+page.svelte`.
			{ keys: [['Esc']], does: m.keys_cancel_a_swap() }
		]
	},
	{
		id: 'roster',
		title: m.keys_roster(),
		note: m.keys_while_the_roster_is_unlocked_for_editing(),
		rows: [
			// `RosterTab.svelte` `onItemKey` and `onWindowKey`.
			{ keys: [['left', 'right', 'up', 'down']], does: m.keys_move_between_characters() },
			{ keys: [['O']], does: m.keys_owned() },
			{ keys: [['X'], ['Delete']], does: m.keys_not_owned() },
			{ keys: [['Enter'], ['Space']], does: m.keys_toggle_owned() },
			{ keys: [['W']], does: m.keys_add_to_or_remove_from_the_wishlist() },
			{ keys: [['T']], does: m.keys_leave_out_of_imaginarium_theater_or_put() },
			{ keys: [['0–6']], does: m.keys_set_the_constellation() },
			{ keys: [['mod', 'Z']], does: m.keys_undo() },
			{ keys: [['mod', 'shift', 'Z']], does: m.keys_redo() }
		]
	},
	{
		id: 'teams',
		title: m.keys_teams(),
		note: m.keys_while_a_team_is_open(),
		rows: [
			// `TeamDetail.svelte` `onKey`.
			{ keys: [['1–4']], does: m.keys_choose_a_slot() },
			{ keys: [['Esc']], does: m.keys_leave_the_team_asks_first_if_it_has() }
		]
	},
	{
		id: 'visualizers',
		title: m.keys_visualizers(),
		note: m.keys_in_the_gauge_explorer_with_an(),
		rows: [
			// `GaugeInstrument.svelte` `onMarkerKey`.
			{ keys: [['left'], ['right']], does: m.keys_move_it_by_0_1s() },
			{
				keys: [
					['shift', 'left'],
					['shift', 'right']
				],
				does: m.keys_move_it_by_1s()
			},
			{ keys: [['Enter']], does: m.keys_edit_it() },
			{ keys: [['Delete']], does: m.keys_remove_it() }
		]
	}
];

/** The area you are in: a menu section first (it covers the tool), then a
 *  Help chapter's tool, then the tool under the address. */
export function currentKeyArea(): KeyAreaId {
	const section = menu.section;
	if (section === 'roster') return 'roster';
	if (section === 'teams') return 'teams';
	const chapter = section?.startsWith('help/') ? section.slice(5) : null;
	const path = routeOf(page.url);
	for (const id of ['planner', 'builder', 'visualizers'] as const) {
		if (chapter === id || (!section && path.includes(`/${id}`))) return id;
	}
	return 'everywhere';
}

/** The areas in the order the sheet shows them: yours, then everywhere,
 *  then the rest in list order. */
export function orderedKeyAreas(first: KeyAreaId): KeyArea[] {
	const all = keyAreas();
	const lead = all.filter((a) => a.id === first);
	const everywhere = all.filter((a) => a.id === 'everywhere' && a.id !== first);
	return [...lead, ...everywhere, ...all.filter((a) => a.id !== first && a.id !== 'everywhere')];
}
