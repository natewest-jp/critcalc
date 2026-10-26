/**
 * NOTICES: how the site tells people things (docs/notices-design.md; the
 * notices round, 2026-10-26). One channel for three of the five shapes:
 *
 * - a TOAST is an event: one home, bottom centre (`NoticeRegion`), glass,
 *   or paper for an error, which stays until dismissed;
 * - a BANNER is a condition: it stays while true and leaves by itself, at
 *   the top of the surface (`NoticeBanners`);
 * - a DIALOG is a decision whose cause is away from the eye (`ask`).
 *
 * The other two live where they are: the control that answers for itself,
 * and the save status beside the document's name.
 *
 * ⚓ A notice never replaces another (the old single slot let "Link copied"
 * erase "Couldn't save"): toasts queue, banners stack. ⚓ Text is body size.
 */

import { untrack } from 'svelte';
import { SvelteSet } from 'svelte/reactivity';

export type NoticeKind = 'success' | 'info' | 'warning' | 'error';

export type NoticeAction = { label: string; run: () => void };

export type Toast = {
	id: number;
	kind: NoticeKind;
	text: string;
	actions: NoticeAction[];
	/** A profile's colour, shown as a disc in place of the mark. */
	swatch?: string;
	/** How long it stays; null = until dismissed. */
	ms: number | null;
	paused: boolean;
};

export type Banner = {
	/** One banner per key; setting it again updates it in place. */
	key: string;
	kind: 'warning' | 'error';
	/** The bold lead clause, then the rest. */
	lead: string;
	body?: string;
	actions?: NoticeAction[];
	/** A warning may be put away for the session; an error may not. */
	dismissable?: boolean;
};

export type Ask = {
	title: string;
	body?: string;
	/** The destructive or committing answer. */
	confirm: string;
	/** The safe answer, focused, and Escape's. */
	cancel?: string;
	danger?: boolean;
};

/** 🎛️ How long a toast stays, by severity (Nate 2026-10-26; tune by eye once
 *  real messages flow). null = until dismissed. */
export const TOAST_MS: Record<NoticeKind, number | null> = {
	success: 4000,
	info: 6000,
	warning: 8000,
	error: null
};
/** 🎛️ A toast with a button stays at least this long, to reach it. */
export const TOAST_ACTION_MS = 8000;
/** 🎛️ The most toasts at once; the oldest that can fade makes room. */
export const MAX_TOASTS = 3;

class Notices {
	toasts = $state<Toast[]>([]);
	#banners = $state<Banner[]>([]);
	/** Banners put away this session, by key. */
	#dismissed = new SvelteSet<string>();
	/** Bumped per key when a refused action calls a banner back: the host
	 *  nudges on a change. */
	nudges = $state<Record<string, number>>({});
	asking = $state<(Ask & { resolve: (ok: boolean) => void }) | null>(null);

	#nextId = 1;
	// Bookkeeping, never rendered.
	#timers = new Map<number, { t: ReturnType<typeof setTimeout>; due: number; left: number }>();
	#onGone = new Map<number, () => void>();

	// ── Toasts ──────────────────────────────────────────────────────────────

	/**
	 * Say that something happened. `onGone` runs once the toast has left
	 * (its time ran out, or it was dismissed or acted on): a once-ever notice
	 * marks itself seen there, never before it shows.
	 */
	toast(
		kind: NoticeKind,
		text: string,
		opts: {
			actions?: NoticeAction[];
			swatch?: string;
			ms?: number | null;
			onGone?: () => void;
		} = {}
	): number {
		const actions = opts.actions ?? [];
		const base = opts.ms !== undefined ? opts.ms : TOAST_MS[kind];
		const ms = base === null ? null : actions.length ? Math.max(base, TOAST_ACTION_MS) : base;
		const t: Toast = {
			id: this.#nextId++,
			kind,
			text,
			actions,
			swatch: opts.swatch,
			ms,
			paused: false
		};
		if (opts.onGone) this.#onGone.set(t.id, opts.onGone);
		untrack(() => this.#push(t));
		if (ms !== null) this.#arm(t.id, ms);
		return t.id;
	}

	#push(t: Toast): void {
		let list = [...this.toasts, t];
		while (list.length > MAX_TOASTS) {
			const drop = list.find((x) => x.ms !== null) ?? list[0];
			this.#gone(drop.id);
			list = list.filter((x) => x !== drop);
		}
		this.toasts = list;
	}

	dismiss(id: number): void {
		this.#gone(id);
		this.toasts = this.toasts.filter((x) => x.id !== id);
	}

	/** Run one of a toast's buttons: it has done its job. */
	act(id: number, action: NoticeAction): void {
		this.dismiss(id);
		action.run();
	}

	/** Pointed at or focused: the time stops (WCAG 2.2.1). */
	pause(id: number): void {
		const t = this.toasts.find((x) => x.id === id);
		const tm = this.#timers.get(id);
		if (!t || !tm || t.paused) return;
		clearTimeout(tm.t);
		tm.left = tm.due - Date.now();
		t.paused = true;
	}

	resume(id: number): void {
		const t = this.toasts.find((x) => x.id === id);
		const tm = this.#timers.get(id);
		if (!t || !tm || !t.paused) return;
		t.paused = false;
		this.#arm(id, tm.left);
	}

	#arm(id: number, ms: number): void {
		this.#timers.set(id, {
			t: setTimeout(() => this.dismiss(id), ms),
			due: Date.now() + ms,
			left: ms
		});
	}

	#gone(id: number): void {
		const tm = this.#timers.get(id);
		if (tm) clearTimeout(tm.t);
		this.#timers.delete(id);
		const done = this.#onGone.get(id);
		this.#onGone.delete(id);
		done?.();
	}

	// ── Banners ─────────────────────────────────────────────────────────────

	/** The banners showing: set, and not put away. */
	get banners(): Banner[] {
		return this.#banners.filter((b) => !this.#dismissed.has(b.key));
	}

	/** Raise (or update) the banner for a condition that is now true. */
	banner(b: Banner): void {
		// ⚠ A command never subscribes its caller: an effect that raises a
		// banner must not re-run because the list changed (it looped).
		untrack(() => {
			const i = this.#banners.findIndex((x) => x.key === b.key);
			if (i < 0) this.#banners = [...this.#banners, b];
			else this.#banners[i] = b;
		});
	}

	/** The condition is over: the banner goes, and so does its dismissal. */
	clearBanner(key: string): void {
		untrack(() => {
			this.#banners = this.#banners.filter((x) => x.key !== key);
			this.#dismissed.delete(key);
		});
	}

	/** Put a warning away for the session. */
	dismissBanner(key: string): void {
		const b = this.#banners.find((x) => x.key === key);
		if (b?.dismissable) this.#dismissed.add(key);
	}

	/** Something tried to do what the condition forbids: the banner comes
	 *  back if it was put away, and nudges. */
	recall(key: string): void {
		untrack(() => {
			this.#dismissed.delete(key);
			this.nudges[key] = (this.nudges[key] ?? 0) + 1;
		});
	}

	has(key: string): boolean {
		return this.#banners.some((x) => x.key === key);
	}

	// ── Dialogs ─────────────────────────────────────────────────────────────

	/** Ask a question: resolves true for `confirm`, false for the safe answer
	 *  (its button, Escape). A second question while one is open answers the
	 *  first as safe. */
	ask(q: Ask): Promise<boolean> {
		this.asking?.resolve(false);
		return new Promise((resolve) => (this.asking = { ...q, resolve }));
	}

	answer(ok: boolean): void {
		const a = this.asking;
		this.asking = null;
		a?.resolve(ok);
	}
}

export const notices = new Notices();

/** A success that happens just before a reload (a restore) is said once the
 *  page is back: kept in sessionStorage across the reload. */
const AFTER_RELOAD = 'critcalc:notice-after-reload';
export function announceAfterReload(text: string): void {
	try {
		sessionStorage.setItem(AFTER_RELOAD, text);
	} catch {
		/* storage blocked: nothing to say it with */
	}
}
/** Called once the page is up (the scene layout's mount). */
export function sayAfterReload(): void {
	try {
		const text = sessionStorage.getItem(AFTER_RELOAD);
		if (!text) return;
		sessionStorage.removeItem(AFTER_RELOAD);
		notices.toast('success', text);
	} catch {
		/* storage blocked */
	}
}

/** The "Open in another tab" banner's key, per document. */
export const heldKey = (id: string): string => `held:${id}`;
