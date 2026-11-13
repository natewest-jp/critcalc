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

// ⚠️ DRAFT WORDING for Nate's ruling: every `title`, `note` and `does` below.
export const KEY_AREAS: KeyArea[] = [
	{
		id: 'everywhere',
		title: 'Everywhere',
		rows: [
			// The scene layout (`+layout.svelte`).
			{ keys: [['?']], does: 'Show these shortcuts' },
			// Each dialog, menu and the menu state (`MenuState.svelte`).
			{ keys: [['Esc']], does: 'Close a menu, a dialog, or Help' },
			// The storage session's `#onKey`.
			{ keys: [['mod', 'S']], does: 'Check that your work is saved (it saves as you go)' }
		]
	},
	{
		id: 'planner',
		title: 'Rotation Planner',
		rows: [
			// `planner/+page.svelte` `onTransportKey`.
			{ keys: [['Space']], does: 'Play or pause' },
			{ keys: [['Home']], does: 'Back to the start' },
			// CodeMirror's own keymap, and the Undo and Redo buttons.
			{ keys: [['mod', 'Z']], does: 'Undo a notation change' },
			{ keys: [['mod', 'shift', 'Z']], does: 'Redo' },
			// The storage session's `#onFlipKey` → `other('planner')`.
			{
				keys: [['ctrl', '`']],
				does: 'Switch to the other rotation of a pair, or back to the last one you had open'
			},
			// `EventLog.svelte`.
			{ keys: [['up'], ['down']], does: 'Step through the event log' },
			{ keys: [['Home'], ['End']], does: 'Jump to the first or last event' }
		]
	},
	{
		id: 'builder',
		title: 'Team Builder',
		rows: [
			// The storage session's `#onFlipKey` → `other('builder')`.
			{ keys: [['ctrl', '`']], does: 'Back to the last lineup you had open' },
			// `builder/+page.svelte`.
			{ keys: [['Esc']], does: 'Cancel a swap' }
		]
	},
	{
		id: 'roster',
		title: 'Roster',
		note: 'While the roster is unlocked for editing.',
		rows: [
			// `RosterTab.svelte` `onItemKey` and `onWindowKey`.
			{ keys: [['left', 'right', 'up', 'down']], does: 'Move between characters' },
			{ keys: [['O']], does: 'Owned' },
			{ keys: [['X'], ['Delete']], does: 'Not owned' },
			{ keys: [['Enter'], ['Space']], does: 'Toggle owned' },
			{ keys: [['W']], does: 'Add to or remove from the wishlist' },
			{ keys: [['T']], does: 'Leave out of Imaginarium Theater, or put back' },
			{ keys: [['0–6']], does: 'Set the constellation' },
			{ keys: [['mod', 'Z']], does: 'Undo' },
			{ keys: [['mod', 'shift', 'Z']], does: 'Redo' }
		]
	},
	{
		id: 'teams',
		title: 'Teams',
		note: 'While a team is open.',
		rows: [
			// `TeamDetail.svelte` `onKey`.
			{ keys: [['1–4']], does: 'Choose a slot' },
			{ keys: [['Esc']], does: 'Leave the team (asks first if it has changes)' }
		]
	},
	{
		id: 'visualizers',
		title: 'Visualizers',
		note: 'In the Gauge Explorer, with an application selected.',
		rows: [
			// `GaugeInstrument.svelte` `onMarkerKey`.
			{ keys: [['left'], ['right']], does: 'Move it by 0.1s' },
			{
				keys: [
					['shift', 'left'],
					['shift', 'right']
				],
				does: 'Move it by 1s'
			},
			{ keys: [['Enter']], does: 'Edit it' },
			{ keys: [['Delete']], does: 'Remove it' }
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
	const path = page.url.pathname;
	for (const id of ['planner', 'builder', 'visualizers'] as const) {
		if (chapter === id || (!section && path.includes(`/${id}`))) return id;
	}
	return 'everywhere';
}

/** The areas in the order the sheet shows them: yours, then everywhere,
 *  then the rest in list order. */
export function orderedKeyAreas(first: KeyAreaId): KeyArea[] {
	const lead = KEY_AREAS.filter((a) => a.id === first);
	const everywhere = KEY_AREAS.filter((a) => a.id === 'everywhere' && a.id !== first);
	return [
		...lead,
		...everywhere,
		...KEY_AREAS.filter((a) => a.id !== first && a.id !== 'everywhere')
	];
}
