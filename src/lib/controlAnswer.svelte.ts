/**
 * THE CONTROL ANSWERS (docs/notices-design.md §3.1): the outcome of a click
 * said ON the control that was clicked, "✓ Copied" / "Couldn't copy", where
 * the eye already is. When the control is out of sight (an item inside the
 * phone's ⋯ menu, which closes on the click), the same outcome goes to a
 * toast in its long form instead.
 */

import { notices } from './notices.svelte';

/** What an action reports: its short form for the control, its long form
 *  for a toast. */
export type Outcome = { ok: boolean; short: string; long: string };

/** 🎛️ How long the control keeps its answer. */
export const ANSWER_MS = { ok: 1600, failed: 2400 };

export class ControlAnswer {
	now = $state<Outcome | null>(null);
	#timer: ReturnType<typeof setTimeout> | undefined;

	show(o: Outcome): void {
		clearTimeout(this.#timer);
		this.now = o;
		this.#timer = setTimeout(() => (this.now = null), o.ok ? ANSWER_MS.ok : ANSWER_MS.failed);
	}
}

/** Say an outcome on a control in sight, else as a toast. */
export function sayOutcome(o: Outcome | null, on: ControlAnswer | null): void {
	if (!o) return;
	if (on) on.show(o);
	// An empty long form: the action said it itself (a warning toast).
	else if (o.long) notices.toast(o.ok ? 'success' : 'error', o.long);
}
