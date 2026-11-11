<script lang="ts">
	/**
	 * A Theater lineup's SEASON and MODE, as two plates in band B's lineup rail
	 * (⚓ Nate 2026-11-11: dropdowns at the top of the right side), the
	 * Stygian season picker's grammar. The mode menu says, for each mode, what
	 * the roster's eligible characters make of it: open (and its extra
	 * members), or how many short.
	 */
	import Mark from '$lib/components/Mark.svelte';
	import BandMenu from '$lib/components/BandMenu.svelte';
	import {
		MODE_NAME,
		OPENING_CAST,
		type ModeVerdict,
		type TheaterMode,
		type TheaterSeason
	} from '$lib/theater';

	let {
		season,
		seasons,
		mode,
		verdicts,
		onSeason,
		onMode
	}: {
		season: TheaterSeason;
		/** Every season that has opened, newest first. */
		seasons: readonly TheaterSeason[];
		mode: TheaterMode;
		/** Each mode's answer for everyone the roster could bring. */
		verdicts: readonly ModeVerdict[];
		onSeason: (start: string) => void;
		onMode: (mode: TheaterMode) => void;
	} = $props();

	const fmtMonth = (iso: string, month: 'long' | 'short' = 'long') =>
		new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
			month,
			year: 'numeric',
			timeZone: 'UTC'
		});
</script>

<BandMenu glass ariaLabel="Season: {fmtMonth(season.start)}" align="start">
	{#snippet face()}<span class="tp-face">{fmtMonth(season.start, 'short')}</span>{/snippet}
	{#snippet items(close)}
		{#each seasons as s (s.start)}
			{@const current = s.start === season.start}
			<button
				class="band-menu-item"
				role="menuitemradio"
				aria-checked={current}
				onclick={() => {
					close();
					onSeason(s.start);
				}}
			>
				<span class="tp-check"
					>{#if current}<Mark name="check" size={12} />{/if}</span
				>
				<span class="tp-name">{fmtMonth(s.start)}</span>
			</button>
		{/each}
	{/snippet}
</BandMenu>

<BandMenu glass ariaLabel="Mode: {MODE_NAME[mode]}" align="start">
	{#snippet face()}<span class="tp-face">{MODE_NAME[mode]}</span>{/snippet}
	{#snippet items(close)}
		{#each verdicts as v (v.mode)}
			{@const current = v.mode === mode}
			{@const rules = season.modes.find((m) => m.mode === v.mode)}
			<button
				class="band-menu-item"
				role="menuitemradio"
				aria-checked={current}
				onclick={() => {
					close();
					onMode(v.mode);
				}}
			>
				<span class="tp-check"
					>{#if current}<Mark name="check" size={12} />{/if}</span
				>
				<span class="tp-name">{MODE_NAME[v.mode]}</span>
				<span class="tp-acts"
					>{rules?.acts}{rules?.arcana.length ? ` + ${rules.arcana.length}` : ''} acts</span
				>
				<span class="tp-need">{OPENING_CAST + v.need}–{OPENING_CAST + v.most}</span>
			</button>
		{/each}
	{/snippet}
</BandMenu>

<style>
	.tp-face {
		white-space: nowrap;
	}
	.tp-check {
		width: 12px;
		display: grid;
		place-items: center;
	}
	.tp-name {
		min-width: 5.5em;
		font-weight: var(--fw-semibold);
	}
	.tp-acts {
		min-width: 5.2em;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}
	.tp-need {
		margin-left: auto;
		font-variant-numeric: tabular-nums;
	}
</style>
