/**
 * Reactive breakpoint flags — the JS half of the breakpoint table.
 *
 * A stylesheet reads the table by writing its literal into an `@media` (see
 * $lib/breakpoints.ts for why it cannot do otherwise); a component that has to
 * DECIDE something in script — which form the bench ribbon takes, whether a
 * band folds its flanks into a menu — reads it here, from matchMedia on the
 * identical string. One table, two readers, no second number.
 *
 * ⚠ SSR renders every flag FALSE (the desk form), per the deterministic-first-
 * paint rule; the tools layout attaches the listeners in onMount and the
 * flags flip before the ribbon is first measured. A phone therefore paints
 * the desk arrangement for the pre-hydration instant — the tools are
 * client-rendered shells until then anyway.
 *
 * ⚠ Attached ONCE, from the layout, rather than lazily on first read: a lazy
 * attach would be a state write inside whatever `$derived` first asked, which
 * Svelte 5 refuses (and rightly).
 */
import { belowQuery, BP, SHORT_QUERY, type Breakpoint } from './breakpoints';

const flags = $state<Record<Breakpoint, boolean>>({
	paneWord: false,
	compact: false,
	roomy: false,
	toolMin: false,
	wide: false,
	broad: false,
	vast: false
});

/** The height axis's one condition (breakpoints.ts § THE HEIGHT AXIS). */
const height = $state({ short: false });

let attached = false;

/** Start tracking the viewport against every breakpoint. Idempotent; browser only. */
export function attachMediaFlags(): () => void {
	if (attached || typeof window === 'undefined') return () => {};
	attached = true;
	const detach: (() => void)[] = [];
	for (const bp of Object.keys(BP) as Breakpoint[]) {
		const mq = window.matchMedia(belowQuery(bp));
		const apply = () => {
			flags[bp] = mq.matches;
		};
		apply();
		mq.addEventListener('change', apply);
		detach.push(() => mq.removeEventListener('change', apply));
	}
	const shortMq = window.matchMedia(SHORT_QUERY);
	const applyShort = () => {
		height.short = shortMq.matches;
	};
	applyShort();
	shortMq.addEventListener('change', applyShort);
	detach.push(() => shortMq.removeEventListener('change', applyShort));
	return () => {
		for (const d of detach) d();
		attached = false;
	};
}

/** Is the viewport at or below this breakpoint? Reactive when read in a rune. */
export function below(bp: Breakpoint): boolean {
	return flags[bp];
}

/** Is the viewport short (`(max-height: 30rem)`, a landscape phone)? Reactive. */
export function short(): boolean {
	return height.short;
}

/** The planner's narrow form: below `toolMin` OR short (`narrowFormQuery`). */
export function narrowForm(): boolean {
	return flags.toolMin || height.short;
}
