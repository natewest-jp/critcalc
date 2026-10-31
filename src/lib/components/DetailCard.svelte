<script lang="ts">
	import { travelerTwin } from '$lib/travelerTwin.svelte';
	import { getCharacterIndexEntry } from '$lib/data/characterLookup';
	import { siteSettings } from '$lib/stores';
	import { getAvatar, getAvatarFallback } from '$lib/utils/getAvatar';
	import CharacterDetails from '$lib/components/CharacterDetails.svelte';
	import Mark from '$lib/components/Mark.svelte';
	import { elementColors, type ElementKey } from '$lib/utils/elementColors';
	import type { ConMode } from '$lib/capabilities/facets';
	import type { Snippet } from 'svelte';
	import InspectModal from '$lib/components/InspectModal.svelte';
	import { below } from '$lib/media.svelte';

	// ↻ Inspector round (2026-10-23): this is the SHELL now, in an InspectModal. The body is `CharacterDetails`, which the Planner's inspector pane
	// reads too, so the two can never disagree about a character.

	let {
		id,
		conMode,
		onClose,
		teamState,
		elsewhereLabel,
		onToggleTeam,
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
		/** A line under the header, from the host (the Builder's "Adds to …",
		 *  inspector round). */
		lead?: Snippet;
	} = $props();

	const entry = $derived(getCharacterIndexEntry(id));
	const color = $derived(
		(elementColors[(entry?.element ?? 'none') as ElementKey] ?? elementColors.none).main
	);

	let heroErrored = $state(false);

	/** The hero's art: the new outfit falls back to the base art, then to
	 *  nothing (the header reads without it). */
	function handleHeroError(event: Event) {
		const img = event.target as HTMLImageElement;
		if (img.src.includes('-newfit')) {
			img.src = getAvatarFallback(id, 'full', $travelerTwin);
		} else {
			heroErrored = true;
		}
	}
</script>

<!-- ⚓ THE INSPECTOR'S CHARACTER (Nate 2026-10-23: one design language with
     the boss and the opponents). The boss's arrangement: the art stands at the
     top right and fades into the panel, a gold kicker gives the context (here
     element · weapon · rarity · region), the name is set in the display face,
     and a hairline closes the header. ⛔ No element-tinted frame, ring or
     button: the identity lives in the art and the element's word, and the
     team action is an ordinary button. ⚠ `full` art is 256px, so the hero
     holds it at ≤ 9.5rem (crisp at 2×). -->
{#snippet hero()}
	<header class="dc-hero">
		<div class="dc-hero-row">
			<div class="dc-hero-text">
				<p class="kicker dc-hero-kicker">
					{entry?.element ?? '?'} · {entry?.weapon ?? '?'} · {entry?.rarity}★{entry?.region
						? ` · ${entry.region}`
						: ''}
				</p>
				<h2 class="dc-hero-title">{entry?.displayName ?? id}</h2>
				{#if onToggleTeam && teamState}
					<div class="dc-actions">
						<button
							class="btn btn--sm"
							class:is-active={teamState === 'in'}
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
			{#if !heroErrored}
				<img
					class="dc-hero-art"
					src={getAvatar(id, $siteSettings.useNewOutfits, 'full', $travelerTwin)}
					alt=""
					onerror={handleHeroError}
				/>
			{/if}
		</div>
		<!-- Full width, and the art STANDS ON IT: a delta runs long, and
		     squeezed beside the art it wrapped item by item. -->
		{#if lead}<div class="dc-lead">{@render lead()}</div>{/if}
	</header>
	<div class="dc-im-body">
		<!-- ⚓ The inspector reads (Nate 2026-10-23): no default build here; it
		     moves to Teams (⏭ queued). A phone takes the narrow column's rows. -->
		<CharacterDetails
			{id}
			{conMode}
			defaultBuild={false}
			rotationNote={false}
			compact={below('compact')}
			onLeave={onClose}
		/>
	</div>
{/snippet}

<!-- ⚓ The inspector's modal shape (inspector round, Nate 2026-10-23): one
     shell for the Builder's three, a margin that closes it. -->
<InspectModal label="{entry?.displayName ?? id} details" width="38rem" {onClose}>
	<div class="dc-im" style:--el-color={color}>{@render hero()}</div>
</InspectModal>

<style>
	.dc-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-top: 0.45rem;
	}

	/* Local bits only. The wishlist variant keeps its geo tint. */
	/* A bare hit target around Nate's close mark — the same treatment the meta
	   overlays' close wears. Deliberately not .btn--icon: the mark is already a
	   disc, and a bordered box around it reads as two shapes. */
	/* ── The inspector's character (the boss's header grammar) ────────── */
	.dc-im {
		display: flex;
		flex-direction: column;
		font-family: var(--font-body);
	}
	/* ⚓ THE ART ENDS ON A SHARP EDGE (Nate 2026-10-23): no fade. The `full`
	   art's own bottom edge is flat, so the art stands IN the header's top row,
	   bottom-aligned, and that edge lands on whatever comes next — the "Adds
	   to" box, or the header's hairline when the team has no room. Its top
	   rises into the header's padding, to the frame. ⚠ 256px art: ≤ 9.5rem. */
	.dc-hero {
		position: relative;
		display: flex;
		flex-direction: column;
		padding: var(--im-pad-top) var(--im-pad-x) 0;
		border-bottom: 1px solid var(--line-faint);
	}
	.dc-hero-row {
		display: flex;
		align-items: flex-end;
		gap: 1.2rem;
	}
	.dc-hero-art {
		display: block;
		flex: none;
		width: 9.5rem;
		height: 9.5rem;
		margin-top: calc(-1 * var(--im-pad-top));
		object-fit: contain;
		object-position: bottom;
		pointer-events: none;
	}
	/* ⚓ On the RIGHT (Nate 2026-10-23, over a left placement he compared):
	   the boss's side, so the three modals read as one family and the name
	   keeps the content's left inset. Clear of the shell's ✕ at the corner. */
	.dc-hero-art {
		margin-right: 1.4rem;
	}
	.dc-hero-text {
		flex: 1;
		align-self: flex-start;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-width: 0;
		padding-bottom: 1.2rem;
	}
	.dc-hero-kicker {
		font-size: var(--fs-sm);
	}
	.dc-hero-title {
		margin: 0.15rem 0 0;
		font-family: var(--font-display);
		font-size: var(--fs-4xl);
		line-height: 1.15;
	}
	.dc-lead {
		margin-bottom: 1.2rem;
	}
	.dc-im-body {
		display: flex;
		flex-direction: column;
		padding: 1.2rem var(--im-pad-x) 1.5rem;
	}
	/* A phone: the art steps down, as the boss's does. */
	@media (max-width: 47.5rem) /* roomy — $lib/breakpoints.ts */ {
		.dc-hero-art {
			width: 7rem;
			height: 7rem;
		}
		.dc-hero-art {
			margin-right: 2rem;
		}
	}
</style>
