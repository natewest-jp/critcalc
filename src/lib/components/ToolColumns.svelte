<script lang="ts">
	import type { Snippet } from 'svelte';
	import { fade } from 'svelte/transition';
	import { beforeNavigate } from '$app/navigation';
	import { ASIDE_W, COLUMN_GAP } from '$lib/toolColumns';
	import { portal } from '$lib/actions/portal';
	import CloseMark from '$lib/components/CloseMark.svelte';
	import { T_QUICK, motion, introLive, outroInert } from '$lib/motion';

	// ---------------------------------------------------------------------------
	// THE TOOL COLUMNS — a tool surface split into a main box and an optional
	// aside box, with bare scene between them. See $lib/toolColumns.ts for the
	// diagram, the knobs, and why this is a shell rather than three arrangements.
	//
	// The shell owns GEOMETRY and the aside's ground; each tool supplies its own
	// main box (the planner's .rp-frame, the Team Builder's .tb-frame) and the
	// aside's contents.
	// ---------------------------------------------------------------------------

	let {
		main,
		aside,
		asideBare = false,
		sheet = false,
		asideTitle = '',
		onCloseAside
	}: {
		main: Snippet;
		/**
		 * The aside column's occupant. Absent = no second column at all, and the
		 * main box takes the full width — this is a presence test, not a
		 * visibility toggle, so a tool must not pass an empty snippet to "hide" it.
		 */
		aside?: Snippet;
		/**
		 * The aside is a GROUNDLESS gutter rather than a box (breathing-room
		 * round, 2026-08-08). For occupants that are a LIST OF GROUPS rather than
		 * one continuous reading: the filter rails paint their own sections, so
		 * the column becomes objects-on-the-scene instead of sections-in-a-box.
		 *
		 * The planner's NOTES keep the box — they are one continuous reading and
		 * would look shredded chopped into rows. So this is the occupant's call,
		 * which is why it is a prop and not a rule.
		 */
		asideBare?: boolean;
		/**
		 * ══ THE SHEET (responsive round, 2026-09-05) ══════════════════════════
		 * Below BP.toolMin the aside is not a COLUMN but a DRAWER: the same
		 * occupant, portalled to <body> as a right-anchored panel over a scrim.
		 * The tool passes `below('toolMin')` here — a tool decides its own
		 * breakpoint no more than it decides its own column width, but the
		 * matchMedia flag has to be read in script and this component has no
		 * reason to own a listener of its own.
		 *
		 * WHY A DRAWER AND NOT A NARROWER COLUMN: the survey (§ 8.4) measured the
		 * aside buying 0px of minimum width, because at phone width a 262px rail
		 * beside a 358px tool leaves ~80px for the roster grid — one column of
		 * nothing. Its value at these widths is browsing DENSITY, and the only
		 * way to keep a 123-character roster browsable beside its filters is to
		 * put the filters somewhere else and bring them when asked.
		 *
		 * Presence is still the tool's call (`aside` absent = no drawer), and so
		 * is what closing means: the planner nulls its panel, the Team Builder
		 * drops its filters-open flag. The drawer only reports.
		 */
		sheet?: boolean;
		/** The drawer's heading — "Filters", "Notes", "Aura log". */
		asideTitle?: string;
		/** The drawer's close (scrim, ✕, Escape). */
		onCloseAside?: () => void;
	} = $props();

	function onWindowKeydown(event: KeyboardEvent) {
		if (sheet && aside && event.key === 'Escape') onCloseAside?.();
	}

	// ⚠️ Leaving the tool does not destroy this page: the tool pan keeps it for
	// the slide-out with its effects PAUSED, so a close that lands then cannot
	// unmount the drawer, and its scrim sat over the incoming tool eating clicks
	// (the planner's dock had the same defect). A navigation hook is a plain
	// callback and still fires; closing here flushes while the block is live.
	// Only the DRAWER, which is a modal — an open column is a panel the reader
	// opened, and nothing resets one.
	beforeNavigate((nav) => {
		if (sheet && aside && nav.to?.url.pathname !== nav.from?.url.pathname) onCloseAside?.();
	});
</script>

<svelte:window onkeydown={onWindowKeydown} />

<div class="tool-columns" style:--aside-w="{ASIDE_W}px" style:--column-gap="{COLUMN_GAP}px">
	<div class="tc-main">{@render main()}</div>

	{#if aside && sheet}
		<!-- THE DRAWER. Portalled: the tool page layers carry transforms across
		     every tool→tool navigation and would otherwise become this panel's
		     containing block (BandMenu's reason, verbatim). The context class is
		     re-declared for the same reason — appending to <body> severs the
		     .ctx-* ancestry. The SURFACE band (--t-quick): a scrim plus a panel is
		     a region arriving, and size sets the clock; outroInert keeps the
		     dismissed scrim from eating the click that lands in its fade. -->
		<div
			class="tc-sheet-backdrop"
			use:portal
			transition:fade={{ duration: motion(T_QUICK) }}
			onintrostart={introLive}
			onoutrostart={outroInert}
			onclick={() => onCloseAside?.()}
			aria-hidden="true"
		></div>
		<div
			class="tc-sheet ctx-dark"
			use:portal
			transition:fade={{ duration: motion(T_QUICK) }}
			onintrostart={introLive}
			onoutrostart={outroInert}
			role="dialog"
			aria-modal="true"
			aria-label={asideTitle}
		>
			<header class="tc-sheet-head">
				<h2 class="tc-sheet-title">{asideTitle}</h2>
				<button class="tc-sheet-close" onclick={() => onCloseAside?.()} aria-label="Close">
					<CloseMark />
				</button>
			</header>
			<div class="tc-sheet-body" class:tc-sheet-body--bare={asideBare}>
				{@render aside()}
			</div>
		</div>
	{:else if aside}
		<!-- The wrapper reserves the width and stretches to the row's height; the
		     BOX inside it is absolutely positioned against that. Both halves are
		     load-bearing:
		     - the wrapper's own content height is 0, so on a content-height tool
		       (the planner) a long notes column can never grow the surface — the
		       main box alone sets the height, exactly as the old absolute panel
		       guaranteed inside the track area;
		     - the box then has a definite height to bound its own scroller
		       against, on a viewport-fit tool (the Team Builder) and a
		       content-height one alike.
		     A plain stretched flex child would do neither: its content height
		     joins the row's max() and the surface grows to fit the notes. -->
		<div class="tc-aside">
			<div class="tc-aside-box ctx-dark" class:tc-aside-box--bare={asideBare}>
				{@render aside()}
			</div>
		</div>
	{/if}
</div>

<style>
	.tool-columns {
		display: flex;
		flex-direction: row;
		align-items: stretch;
		gap: var(--column-gap);
		/* Harmless on the planner (a block parent ignores flex:1) and required on
		   the Team Builder, whose ToolStack --fill surface is a flex column. */
		flex: 1;
		min-width: 0;
		min-height: 0;
	}

	/* A flex column so a viewport-fit main box (.tb-frame is flex:1) can fill the
	   row; a content-height one (.rp-root) just sits at its natural height. */
	.tc-main {
		flex: 1;
		min-width: 0;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}

	.tc-aside {
		flex: 0 0 var(--aside-w);
		position: relative;
	}

	.tc-aside-box {
		position: absolute;
		inset: 0;
		/* The RAISED rung, not .frame's --frame-bg: the aside is a peer of the
		   main box, and on the planner --frame-bg is the CHART WELL's color — an
		   aside painted in it would read as a second well floating beside the
		   frame rather than as a frame of its own. Mirrors .rp-frame's override. */
		background: var(--surface-raised);
		border-radius: var(--r-sm);
		/* Clips the occupant's square scroll box to the rounded corners. */
		overflow: hidden;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	/* Groundless: the column stops being a box and becomes a gutter its occupant
	   fills with its own objects. Keeps the context (the sections inside still
	   read the dark palette) and keeps min-height/flex — it loses only the paint
	   and the corner, since there is no longer an edge for a radius to round. */
	.tc-aside-box--bare {
		background: none;
		border-radius: 0;
		/* The clip existed to round the occupant's square scroll box. With no
		   ground there is nothing to clip TO, and clipping here would eat the
		   focus rings the rail's own gutter is there to protect. */
		overflow: visible;
	}

	/* ── The drawer ─────────────────────────────────────────────────────────
	   ChromeOverlay's scrim and modal role (--surface, a full border, the modal
	   shadow), anchored to the RIGHT edge rather than centred: the column it
	   replaces stood at the tool's right, so the drawer comes from where the
	   reader's eye already expects the aside. Its width is the column's plus a
	   comfortable inset, capped at the viewport. z-index sits with the meta
	   overlays (50) — above the chrome (10) and the bench (3), below the band
	   menus (90) and the card popovers (949), which can open on top of it. */
	.tc-sheet-backdrop {
		position: fixed;
		inset: 0;
		z-index: 50;
		background: rgba(3, 6, 14, 0.45);
	}
	.tc-sheet {
		position: fixed;
		top: 0;
		right: 0;
		bottom: 0;
		z-index: 51;
		width: min(calc(var(--aside-w, 262px) + 2rem), 100%);
		display: flex;
		flex-direction: column;
		background: var(--surface);
		border-left: 1px solid var(--border);
		box-shadow: 0 18px 60px rgba(0, 0, 0, 0.55);
	}
	.tc-sheet-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.9rem 1rem 0.5rem;
		flex: none;
	}
	.tc-sheet-title {
		margin: 0;
		font-size: var(--fs-2xl);
		font-weight: var(--fw-semibold);
	}
	/* The hit target; CloseMark is the mark and owns its own states. */
	.tc-sheet-close {
		width: 30px;
		height: 30px;
		flex: none;
		display: grid;
		place-items: center;
		padding: 0;
		border: none;
		background: none;
		color: var(--text);
		cursor: pointer;
	}
	/* The occupant's box: the same flex column the aside box gives it, so a
	   scroller sized against the column is sized against the drawer. */
	.tc-sheet-body {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		padding: 0 1rem 1rem;
		overflow: hidden;
	}
	.tc-sheet-body--bare {
		overflow: visible;
	}
</style>
