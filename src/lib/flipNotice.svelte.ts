/**
 * The returning-visitor dialog (flip-readiness §1 item 4): shown ONCE to a
 * browser that held the old layout's data when the new storage migrated it
 * (`Meta.flipNotice`, decided in `storage/boot.ts`). Kept free of storage
 * imports, like `moveRequest.svelte.ts`: the scene layout raises it and hosts
 * the dialog, and the storage session only asks to wait for it.
 *
 * ⚓ It HOLDS the other first-visit notices (the migration toast, the links
 * dialog) until it is answered: the browser sweep saw two notices at once on
 * a shared link, and a notice never replaces another (notices design).
 */

export const flipNotice = $state<{ open: boolean }>({ open: false });

/** Resolved when the dialog is answered. Created by whichever side asks
 *  first, since the session can read the store's flag before the layout
 *  has raised the dialog. */
let gate: { promise: Promise<void>; release: () => void } | null = null;
let onGone: (() => void) | undefined;
/** Answered in this page: a flag the session read before the answer must
 *  not open a gate nothing will release. */
let answered = false;

function ensureGate(): Promise<void> {
	if (!gate) {
		let release!: () => void;
		const promise = new Promise<void>((r) => (release = r));
		gate = { promise, release };
	}
	return gate.promise;
}

/** Show the dialog. `gone` runs once it is answered (clearing the stored
 *  flag; the dev trigger passes none, so it shows on every load). */
export function raiseFlipNotice(gone?: () => void): void {
	if (flipNotice.open) return;
	ensureGate();
	onGone = gone;
	flipNotice.open = true;
}

/** The dialog was answered: clear the flag and let the held notices through. */
export function dismissFlipNotice(): void {
	if (!flipNotice.open) return;
	answered = true;
	flipNotice.open = false;
	const gone = onGone;
	onGone = undefined;
	gate?.release();
	gate = null;
	gone?.();
}

/** Whether a notice raised now must wait: the store says the dialog is due
 *  (`pending`), or it is on screen. */
export function flipNoticeHolds(pending: boolean): boolean {
	if (answered) return false;
	return pending || flipNotice.open || gate !== null;
}

/** Resolves once the dialog has been answered (at once if it is not due). */
export function afterFlipNotice(pending: boolean): Promise<void> {
	return flipNoticeHolds(pending) ? ensureGate() : Promise.resolve();
}
