<script lang="ts">
	import { tick, type Snippet } from 'svelte';
	import { fade } from 'svelte/transition';
	import { portal } from '$lib/actions/portal';
	import Mark from './Mark.svelte';
	import type { MarkName } from '$lib/marks.generated';
	import { T_QUICK, motion, introLive, outroInert } from '$lib/motion';
	import { closeOnLeave } from '$lib/closeOnLeave';

	// ---------------------------------------------------------------------------
	// A dropdown for a band control (toolbar round, 2026-08-07).
	//
	// ⚠ PORTALLED, and not optionally: the band stack clips to its own radius
	// (`overflow: hidden` on .bands, which is what rounds the two abutting
	// tiers into one object), so an in-flow popover would be cut off at the
	// band's edge. Lifting to <body> also clears the tool page layers, which
	// carry transforms for the whole of every tool→tool navigation and would
	// otherwise become the menu's containing block mid-fade.
	//
	// The portal action carries the tool ZONE across the move (see its header);
	// the context class has to be re-declared here, because appending to <body>
	// severs the .ctx-* ancestry along with everything else.
	// ---------------------------------------------------------------------------

	let {
		label,
		mark,
		disabled = false,
		compact = false,
		ariaLabel,
		role = 'menu',
		align = 'end',
		size,
		glass = false,
		count = 0,
		items
	}: {
		/** Button text. Omit for an icon-only trigger (pass ariaLabel instead). */
		label?: string;
		mark?: MarkName;
		disabled?: boolean;
		/** Icon-only geometry — the overflow trigger. */
		compact?: boolean;
		ariaLabel?: string;
		/** `dialog` for a small control panel rather than a list of items (the
		 *  planner's zoom, 2026-09-30): same trigger, same anchored surface,
		 *  but its contents are controls, not `menuitem`s. */
		role?: 'menu' | 'dialog';
		/** Which trigger edge the menu hangs from. `end` (the band's END zone,
		 *  opening inward) unless the trigger leads its row (the Team Builder's
		 *  season picker, 2026-10-09). */
		align?: 'start' | 'end';
		/** `sm` = the compact `.btn--sm` trigger, for a menu inside content. */
		size?: 'sm';
		/** A glass PLATE (`.btn--glass`) — for a band B that paints no ground of
		 *  its own (ToolStack's `bandBFull`), where a bare trigger would have
		 *  nothing to stand on. */
		glass?: boolean;
		/** How many choices are set inside the menu (the Team Builder's More
		 *  filters): drawn after the label as "· N", in a box of its own so a
		 *  host that folds the WORD (.band-menu-word) keeps the number. 0 draws
		 *  nothing. */
		count?: number;
		/** Menu contents. Called with a `close` the items invoke when chosen. */
		items: Snippet<[() => void]>;
	} = $props();

	let open = $state(false);
	let triggerEl = $state<HTMLButtonElement | undefined>();
	let menuEl = $state<HTMLDivElement | undefined>();
	let menuX = $state(0);
	let menuY = $state(0);

	const MENU_MIN_W = 168;
	const GAP = 6;

	function openMenu() {
		if (!triggerEl) return;
		const r = triggerEl.getBoundingClientRect();
		// Right-aligned to the trigger — band menus live in the bands' END zone,
		// so they open inward. Clamped to the viewport at both edges.
		const place = (w: number) => {
			const x = align === 'start' ? r.left : r.right - w;
			menuX = Math.max(8, Math.min(x, window.innerWidth - w - 8));
		};
		place(MENU_MIN_W);
		menuY = r.bottom + GAP;
		open = true;
		// ⚠ Re-placed at its RENDERED width: an `end` menu wider than the minimum
		// (the Team Builder's More filters, 2026-10-10) used to hang from
		// `right − MENU_MIN_W` and grow PAST its trigger — over whatever stood
		// beyond it.
		void tick().then(() => {
			if (menuEl) place(menuEl.offsetWidth);
			menuEl?.focus();
		});
	}

	function close(refocus = true) {
		open = false;
		if (refocus) triggerEl?.focus();
	}

	// Portalled, so it outlived its page's leave (the Builder's More, on an
	// iPhone swipe-back). No refocus: the trigger is on the page going away.
	closeOnLeave(
		() => open,
		() => close(false)
	);
</script>

<button
	bind:this={triggerEl}
	class="btn band-menu-trigger"
	class:btn--icon={compact}
	class:btn--sm={size === 'sm'}
	class:btn--glass={glass}
	class:is-active={open}
	type="button"
	{disabled}
	aria-haspopup={role}
	aria-expanded={open}
	aria-label={ariaLabel}
	onclick={() => (open ? close(false) : openMenu())}
	onkeydown={(e) => {
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			openMenu();
		}
	}}
>
	{#if mark}<Mark name={mark} />{/if}
	<!-- The label in its own box so a host can fold it away at narrow widths
	     (DocumentActions does, below BP.compact) while the mark stays. -->
	{#if label}<span class="band-menu-label"
			><span class="band-menu-word">{label}</span>{#if count > 0}<span class="band-menu-sep"
					>&nbsp;·&nbsp;</span
				><span class="band-menu-count">{count}</span>{/if}</span
		>{/if}
	{#if !compact}<Mark name="chevron" size={11} />{/if}
</button>

<!-- The SURFACE band (--t-quick): a menu is a region arriving, and size sets
     the clock. A fade and nothing else — it is viewport-fixed off a measured
     left/top, so a slide would mean a second transform over fractional
     coordinates, and the trigger already told you where it came from. See
     $lib/motion for the outro pair. -->
{#if open}
	<div
		class="band-menu-backdrop"
		use:portal
		transition:fade={{ duration: motion(T_QUICK) }}
		onintrostart={introLive}
		onoutrostart={outroInert}
		onclick={() => close(false)}
		aria-hidden="true"
	></div>
	<div
		bind:this={menuEl}
		class="band-menu ctx-dark"
		use:portal
		transition:fade={{ duration: motion(T_QUICK) }}
		onintrostart={introLive}
		onoutrostart={outroInert}
		style:left="{menuX}px"
		style:top="{menuY}px"
		style:min-width="{MENU_MIN_W}px"
		{role}
		tabindex="-1"
		aria-label={ariaLabel ?? label}
		onkeydown={(e) => {
			if (e.key === 'Escape') {
				e.preventDefault();
				close();
			}
		}}
	>
		{@render items(() => close(false))}
	</div>
{/if}

<style>
	.band-menu-trigger {
		gap: 0.35rem;
	}

	.band-menu-backdrop {
		position: fixed;
		inset: 0;
		z-index: 90;
		background: transparent;
	}

	/* The modal role (2026-07-31): a menu is a raised MODAL surface, so it wears
	   --surface and a full border rather than the in-page raised rung. Always
	   the dark context regardless of which band raised it — a popover floats
	   over the scene, not over the band, and the site's other over-scene
	   surfaces are dark.
	   🐛 ⚓ NATE 2026-08-14: the paragraph above described the intent, and the
	   markup had said `ctx-glass` the whole time — so --surface resolved to
	   --glass-panel and the two band-A/B menus (Share, the con lens) were the
	   only translucent modals on the site. The class now matches the rule.
	   ⚠ GLASS IS A BAND MATERIAL, NOT A MENU ONE: the band is worn over the
	   scene and its translucency is what ties it to the world behind it, but a
	   menu is portalled OUT of the band to <body> — there is no band left under
	   it to be continuous with, only the dimmed tool, and reading a list of
	   options through it is the cost with nothing bought. The other portalled
	   menu (InstrumentPicker) never claimed a context and so was already slate
	   via :root's safety net; these two now agree with it. */
	.band-menu {
		position: fixed;
		z-index: 91;
		display: flex;
		flex-direction: column;
		padding: 3px 0;
		border: 1px solid var(--border);
		border-radius: var(--r-md);
		background: var(--surface);
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
		outline: none;
	}

	/* Items are authored by the caller; these are the shared affordances.
	   :global because the markup comes in through a snippet and carries the
	   CALLER's scope class, not ours. */
	.band-menu :global(.band-menu-item) {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		width: 100%;
		padding: 7px 12px;
		border: none;
		background: transparent;
		color: var(--text);
		font-family: var(--font-body);
		font-size: var(--fs-md);
		text-align: left;
		white-space: nowrap;
		cursor: pointer;
		/* An item may be an <a> (Report a problem, 2026-10-15, opens the
		   feedback form in a new tab): no underline, and the padding inside
		   the 100% width as a button's is. */
		box-sizing: border-box;
		text-decoration: none;
	}

	.band-menu :global(.band-menu-item:hover:not(:disabled)),
	.band-menu :global(.band-menu-item:focus-visible) {
		background: var(--accent-hover-fill);
	}

	.band-menu :global(.band-menu-item:disabled) {
		opacity: 0.35;
		cursor: default;
	}

	.band-menu :global(.band-menu-item--danger) {
		color: color-mix(in srgb, var(--ui-danger) 70%, var(--text));
	}

	/* `.is-armed`: a destructive item waiting on its confirm holds the hover
	   reading, so the question stays lit when the pointer moves off it. */
	.band-menu :global(.band-menu-item--danger:hover:not(:disabled)),
	.band-menu :global(.band-menu-item--danger.is-armed) {
		background: var(--ui-danger-soft);
		color: var(--ui-danger);
	}

	.band-menu :global(.band-menu-rule) {
		height: 1px;
		margin: 3px 0;
		background: var(--frame-line);
	}
</style>
