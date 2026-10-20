<script lang="ts">
	/**
	 * A Stygian lineup's SEASON, as a plate in band B's lineup rail (↻ L1,
	 * ⚓ Nate 2026-10-20). It stood under the band as the Lineup's own header
	 * beside a "Stygian Onslaught" title; the tab already names the mode, so
	 * the row went and the season moved up to the band that holds the
	 * lineup's other controls. The site's dropdown (a plate, an opaque slate
	 * menu) rather than the platform's select (Nate 2026-10-09).
	 */
	import Mark from '$lib/components/Mark.svelte';
	import BandMenu from '$lib/components/BandMenu.svelte';
	import { SEASONS, liveSeasons } from '$lib/endgame';

	let {
		version,
		onSeason
	}: {
		/** The board's stored season; unset follows the current one (§11.6). */
		version: string | undefined;
		onSeason: (version: string) => void;
	} = $props();

	const seasons = liveSeasons();
	const season = $derived(SEASONS.find((s) => s.version === version) ?? seasons[0]);
	const fmtDay = (iso: string) =>
		new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			timeZone: 'UTC'
		});
</script>

{#if season}
	<!-- Below `compact` the dates fold and the version names the season alone
	     (one Stygian per patch); the menu keeps them. -->
	<BandMenu
		glass
		ariaLabel="Season: {season.version}, {fmtDay(season.start)} – {fmtDay(season.end)}"
		align="start"
	>
		{#snippet face()}<span class="sp-face"
				>{season.version}<span class="sp-face-dates"
					>&nbsp;· {fmtDay(season.start)} – {fmtDay(season.end)}</span
				></span
			>{/snippet}
		{#snippet items(close)}
			{#each seasons as s (s.version)}
				{@const current = s.version === season.version}
				<button
					class="band-menu-item"
					role="menuitemradio"
					aria-checked={current}
					onclick={() => {
						close();
						onSeason(s.version);
					}}
				>
					<span class="sp-check"
						>{#if current}<Mark name="check" size={12} />{/if}</span
					>
					<span class="sp-version">{s.version}</span>
					<span class="sp-dates">{fmtDay(s.start)} – {fmtDay(s.end)}</span>
				</button>
			{/each}
		{/snippet}
	</BandMenu>
{/if}

<style>
	.sp-face {
		white-space: nowrap;
	}
	/* The menu's rows: a check column, the version, its dates. */
	.sp-check {
		width: 12px;
		display: grid;
		place-items: center;
	}
	.sp-version {
		min-width: 2.2em;
		font-weight: var(--fw-semibold);
		font-variant-numeric: tabular-nums;
	}
	.sp-dates {
		color: var(--muted);
	}
	/* Below `compact` (40rem — $lib/breakpoints.ts) the rail shares the band
	   with the pane switch, so the plate keeps only the version. */
	@media (max-width: 40rem) {
		.sp-face-dates {
			display: none;
		}
	}
</style>
