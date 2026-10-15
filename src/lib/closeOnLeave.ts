import { beforeNavigate } from '$app/navigation';

/**
 * CLOSE AS YOU LEAVE — for a surface PORTALLED out of a tool page (a menu, a
 * popover, a drawer, a dialog).
 *
 * ⚠️ Leaving a tool does not destroy its page: the tool pan keeps it for the
 * slide-out, up to HOLD_MAX_MS (4s), with its effects PAUSED. A portalled
 * surface has escaped the page layer that fades, so it stayed on screen over
 * the incoming tool until the destroy came (Nate on the iPhone, 2026-10-15:
 * the Builder's More menu "stays open during the whole transition and for a
 * second or two after settling"), and a close that lands while the page is
 * paused cannot unmount it. A navigation hook is a plain callback and still
 * fires, so closing HERE flushes while the block is live and the surface's
 * own outro plays as part of the leave.
 *
 * Only a change of PATHNAME is a leave: a same-tool navigation (a query
 * change) keeps whatever the reader opened.
 *
 * Call it during component init, as `beforeNavigate` itself requires.
 */
export function closeOnLeave(isOpen: () => boolean, close: () => void): void {
	beforeNavigate((nav) => {
		if (isOpen() && nav.to?.url.pathname !== nav.from?.url.pathname) close();
	});
}
