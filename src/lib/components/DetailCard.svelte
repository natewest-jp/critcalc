<script lang="ts">
	import { getCharacterIndexEntry } from '$lib/data/characterLookup';
	import { siteSettings } from '$lib/stores';
	import { getAvatar, getAvatarFallback, hasAvatar } from '$lib/utils/getAvatar';
	import CloseMark from '$lib/components/CloseMark.svelte';
	import CharacterDetails from '$lib/components/CharacterDetails.svelte';
	import Mark from '$lib/components/Mark.svelte';
	import { fade } from 'svelte/transition';
	import { portal } from '$lib/actions/portal';
	import { closeOnLeave } from '$lib/closeOnLeave';
	import { T_QUICK, motion, introLive, outroInert } from '$lib/motion';
	import { elementColors, type ElementKey } from '$lib/utils/elementColors';
	import type { ConMode } from '$lib/capabilities/facets';
	import type { Snippet } from 'svelte';
	import { nextLayout } from '$lib/nextLayout';
	import InspectModal from '$lib/components/InspectModal.svelte';

	// ↻ Inspector round (2026-10-23): this is the SHELL now — backdrop, header,
	// close. The body is `CharacterDetails`, which the Planner's inspector pane
	// reads too, so the two can never disagree about a character.

	let {
		id,
		conMode,
		onClose,
		teamState,
		elsewhereLabel,
		onToggleTeam,
		defaultBuild = true,
		lead
	}: {
		id: string;
		conMode: ConMode;
		onClose: () => void;
		/** Slot membership for the team strip; undefined hides the button. */
		teamState?: 'in' | 'out' | 'full' | 'elsewhere';
		/** 'elsewhere': the team the pick takes them off (No repeats — the
		 *  game's first of two clicks). */
		elsewhereLabel?: string;
		onToggleTeam?: (id: string) => void;
		/**
		 * The Team Builder's "Default build" (the roster's Layer-1 loadout); false
		 * on the Rotation Planner, which edits a rotation's own loadout on the
		 * bench. ↻ 2026-10-11 this was `conEditable`, and it held a PARKED
		 * problem — two constellation steppers one click apart writing different
		 * layers. The Roster tab settled it: the roster is edited there only, and
		 * this card reads it in both tools.
		 */
		defaultBuild?: boolean;
		/** A line under the header, from the host (the Builder's "Adds to …",
		 *  inspector round). Rendered under the switch only. */
		lead?: Snippet;
	} = $props();

	const entry = $derived(getCharacterIndexEntry(id));
	const color = $derived(
		(elementColors[(entry?.element ?? 'none') as ElementKey] ?? elementColors.none).main
	);

	let avatarErrored = $state(false);
	const avatarFallback = $derived(avatarErrored || !hasAvatar(id));
	function handleAvatarError(event: Event) {
		const img = event.target as HTMLImageElement;
		if (img.src.includes('-newfit')) {
			img.src = getAvatarFallback(id, 'side', $siteSettings.travelerVariant);
		} else {
			avatarErrored = true;
		}
	}

	// Portalled to <body>: a tool page's .tool-main is a stacking context
	// (z-index 1) under the site chrome's mount (z-index 10), so a z-1000
	// scrim left inside it still painted BELOW the chrome — the name and ✕
	// sat under the bar on any screen shorter than ~908px, and the chrome's
	// buttons stayed live over the card. Mounted only while open, so it
	// closes on every leave (the page is paused, not destroyed, then).
	// ↻ Under the switch the InspectModal shell owns leaving, Escape and the
	// scrim (inspector round), so these stand down rather than fire twice.
	closeOnLeave(
		() => !$nextLayout,
		() => onClose()
	);

	function handleBackdropClick(e: MouseEvent) {
		if ((e.target as HTMLElement).classList.contains('dc-backdrop')) onClose();
	}
	function handleKeydown(e: KeyboardEvent) {
		if (!$nextLayout && e.key === 'Escape') onClose();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- The Team Builder's one deliberate modal (documented exception to the
     non-modal principle): a focused single-character read, where covering the
     workspace is the point. Esc / backdrop / ✕ all dismiss.

     ↻ 2026-08-12 (motion round): it fades, on --t-quick — the SURFACE band,
     because size sets the clock and this is a scrim over the whole viewport.
     The card is the SAME REGISTER as ChromeOverlay, dismissed the same three
     ways, and ChromeOverlay has faded since it was built; the card snapping in
     was not a choice anyone made, just the one modal that never got the
     treatment. Both on T_QUICK now. -->
{#snippet card(withClose: boolean)}
	<header class="dc-header">
		<div class="dc-avatar ctx-dark">
			{#if !avatarFallback}
				<img
					src={getAvatar(id, $siteSettings.useNewOutfits, 'side', $siteSettings.travelerVariant)}
					alt=""
					onerror={handleAvatarError}
				/>
			{:else}
				<span class="dc-avatar-initials"
					>{(entry?.displayName ?? id).slice(0, 2).toUpperCase()}</span
				>
			{/if}
		</div>
		<div class="dc-title">
			<h2 class="title">{entry?.displayName ?? id}</h2>
			<p class="subtitle">
				<span style:color>{entry?.element ?? '?'}</span>
				· {entry?.weapon ?? '?'} · {entry?.rarity}★{entry?.region ? ` · ${entry.region}` : ''}
			</p>
			{#if onToggleTeam && teamState}
				<div class="dc-actions">
					<button
						class="dc-team"
						class:dc-team--in={teamState === 'in'}
						disabled={teamState === 'full'}
						onclick={() => onToggleTeam(id)}
						title={teamState === 'full' ? 'All four team slots are filled' : undefined}
					>
						<Mark name={teamState === 'in' || teamState === 'elsewhere' ? 'check' : 'plus'} />
						{teamState === 'in'
							? 'In team — remove'
							: teamState === 'elsewhere'
								? `In ${elsewhereLabel ?? 'another team'} — remove`
								: teamState === 'full'
									? 'Team full'
									: 'Add to team'}
					</button>
				</div>
			{/if}
		</div>
		{#if withClose}
			<button class="dc-close" onclick={onClose} aria-label="Close">
				<CloseMark />
			</button>
		{/if}
	</header>
	{#if !withClose && lead}<div class="dc-lead">{@render lead()}</div>{/if}

	<!-- ⚓ Under the switch the details are the INSPECTOR, which reads and never
	     edits (Nate 2026-10-23), so the default build leaves the modal; it moves
	     to Teams (⏭ queued). The old path keeps it until step 5. -->
	{#if $nextLayout}
		<CharacterDetails {id} {conMode} defaultBuild={false} rotationNote={false} onLeave={onClose} />
	{:else}
		<CharacterDetails {id} {conMode} {defaultBuild} onLeave={onClose} />
	{/if}
{/snippet}

{#if $nextLayout}
	<!-- ⚓ The inspector's modal shape (inspector round, Nate 2026-10-23): one
	     shell for the Builder's three, a margin that closes it. -->
	<InspectModal label="{entry?.displayName ?? id} details" width="38rem" accent={color} {onClose}>
		<div class="dc-panel dc-panel--im" style:--el-color={color}>{@render card(false)}</div>
	</InspectModal>
{:else}
	<div
		class="dc-backdrop"
		use:portal
		transition:fade={{ duration: motion(T_QUICK) }}
		onintrostart={introLive}
		onoutrostart={outroInert}
		onclick={handleBackdropClick}
		role="presentation"
	>
		<div
			class="dc-panel"
			style:--el-color={color}
			role="dialog"
			aria-modal="true"
			aria-label="{entry?.displayName ?? id} details"
		>
			<!-- ── Header ─────────────────────────────────────────── -->
			{@render card(true)}
		</div>
	</div>
{/if}

<style>
	.dc-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.72);
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px;
	}

	.dc-panel {
		box-sizing: border-box;
		width: 100%;
		max-width: 620px;
		max-height: min(780px, calc(100svh - 48px));
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
		padding: 1.2rem 1.3rem 1.4rem;
		background: var(--surface);
		/* The ONE modal that keeps an element-tinted border (Nate 2026-07-31):
		   a single-character read earns the identity edge; every other modal
		   wears the plain --border. */
		border: 1px solid color-mix(in srgb, var(--el-color) 35%, var(--border));
		border-radius: 9px;
		font-family: var(--font-body);
		color: var(--text);
	}

	/* ── Header ───────────────────────────────────────────────── */
	.dc-header {
		display: flex;
		align-items: center;
		gap: 0.9rem;
	}

	.dc-avatar {
		width: 56px;
		height: 56px;
		flex-shrink: 0;
		border-radius: 50%;
		/* 1px, not 1.5 — Chrome floors border-width to whole CSS px, so this has
		   always painted 1px there; see the measurement at --inset-stroke. */
		border: 1px solid var(--el-color);
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
		/* The element wash, pinned to slate by the .ctx-dark on the element — the
		   same treatment every character portrait on the site wears, and the same
		   reason it claims a context rather than inheriting one. See the note at
		   CompareView's .cmp-chip-avatar. Was rgba(0,0,0,.5): a translucent disc
		   under a cut-out avatar, i.e. a ground nobody had named. */
		background: color-mix(in srgb, var(--el-color) 26%, var(--surface-well));
	}
	.dc-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		transform: scale(1.333) translateY(-14%);
	}
	.dc-avatar-initials {
		font-size: var(--fs-xl);
		font-weight: var(--fw-bold);
		color: var(--el-color);
	}

	.dc-title {
		flex: 1;
		min-width: 0;
	}
	.dc-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-top: 0.45rem;
	}
	.dc-team {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.3rem 0.6rem;
		border: 1px solid color-mix(in srgb, var(--el-color) 45%, var(--border));
		border-radius: 3px;
		background: none;
		color: var(--text);
		font-family: var(--font-body);
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-mid);
		cursor: pointer;
		transition:
			background var(--t-snap),
			border-color var(--t-snap);
	}
	.dc-team:hover:not(:disabled) {
		background: color-mix(in srgb, var(--el-color) 14%, transparent);
	}
	.dc-team--in {
		background: color-mix(in srgb, var(--el-color) 18%, transparent);
	}
	.dc-team:disabled {
		opacity: 0.5;
		cursor: default;
	}

	/* Local bits only. The wishlist variant keeps its geo tint. */
	/* A bare hit target around Nate's close mark — the same treatment the meta
	   overlays' close wears. Deliberately not .btn--icon: the mark is already a
	   disc, and a bordered box around it reads as two shapes. */
	/* Inside the InspectModal shell: the shell is the ground, the border and the
	   scroller, so the panel keeps only its padding and rhythm; the header
	   leaves room for the shell's ✕. */
	.dc-panel--im {
		max-width: none;
		max-height: none;
		overflow: visible;
		border: none;
		border-radius: 0;
		background: none;
	}
	.dc-panel--im .dc-header {
		padding-right: 2.5rem;
	}
	.dc-lead {
		margin-top: -0.3rem;
	}
	.dc-close {
		align-self: flex-start;
		display: grid;
		place-items: center;
		width: 30px;
		height: 30px;
		flex: none;
		padding: 0;
		border: none;
		background: none;
		color: var(--text);
		cursor: pointer;
	}
</style>
