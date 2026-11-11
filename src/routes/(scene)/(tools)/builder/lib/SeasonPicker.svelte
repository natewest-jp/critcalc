<script lang="ts">
	/**
	 * A Stygian lineup's SEASON, or an Abyss lineup's CYCLE (⚓ Nate
	 * 2026-11-11: Abyss lineups keep their cycle too), as a plate in band B's
	 * lineup rail (↻ L1, ⚓ Nate 2026-10-20). It stood under the band as the
	 * Lineup's own header beside a "Stygian Onslaught" title; the tab already
	 * names the mode, so the row went and the season moved up to the band
	 * that holds the lineup's other controls. The site's dropdown (a plate, an
	 * opaque slate menu) rather than the platform's select (Nate 2026-10-09).
	 */
	import Mark from '$lib/components/Mark.svelte';
	import BandMenu from '$lib/components/BandMenu.svelte';
	import NewTag from '$lib/components/NewTag.svelte';
	import {
		ABYSS_CYCLES,
		SEASONS,
		currentAbyss,
		inLang,
		liveAbyssCycles,
		liveSeasons
	} from '$lib/endgame';

	let {
		kind,
		value,
		onPick,
		fresh = false,
		onOpen
	}: {
		kind: 'stygian' | 'abyss';
		/** The board's stored cycle; unset follows the current one (§11.6). */
		value: string | undefined;
		onPick: (id: string) => void;
		/** A newer cycle is running than the lineup's: the New tag stands on
		 *  the plate's corner until the plate is clicked (`onOpen`). */
		fresh?: boolean;
		onOpen?: () => void;
	} = $props();

	type Option = { id: string; name: string; start: string; end: string };

	/** Every cycle that has opened, newest first: a Stygian season named by
	 *  its version, an Abyss cycle by its Moon. */
	const options: Option[] = $derived(
		kind === 'stygian'
			? liveSeasons().map((s) => ({ id: s.version, name: s.version, start: s.start, end: s.end }))
			: liveAbyssCycles().map((c) => ({
					id: c.start,
					name: inLang(c.name),
					start: c.start,
					end: c.end
				}))
	);
	/** The lineup's own cycle, else the running one (the Abyss has none
	 *  between cycles, `currentAbyss`'s end guard). */
	const chosen = $derived.by((): Option | undefined => {
		if (kind === 'stygian') {
			const s = SEASONS.find((x) => x.version === value) ?? liveSeasons()[0];
			return s && { id: s.version, name: s.version, start: s.start, end: s.end };
		}
		const c = ABYSS_CYCLES.find((x) => x.start === value) ?? currentAbyss();
		return c && { id: c.start, name: inLang(c.name), start: c.start, end: c.end };
	});
	const fmtDay = (iso: string) =>
		new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			timeZone: 'UTC'
		});
</script>

{#if chosen}
	{@const c = chosen}
	<!-- Below `compact` the dates fold and the name stands alone (one Stygian
	     per patch, one Moon per Abyss cycle); the menu keeps them. -->
	<!-- The host the New tag stands on: a click anywhere on the plate reaches
	     it and acknowledges the new cycle. -->
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
	<span class="sp-host" onclick={fresh ? onOpen : undefined}>
		<BandMenu
			glass
			ariaLabel="{kind === 'stygian' ? 'Season' : 'Cycle'}: {c.name}, {fmtDay(c.start)} – {fmtDay(
				c.end
			)}"
			align="start"
		>
			{#snippet face()}<span class="sp-face"
					>{c.name}<span class="sp-face-dates">&nbsp;· {fmtDay(c.start)} – {fmtDay(c.end)}</span
					></span
				>{/snippet}
			{#snippet items(close)}
				{#each options as o (o.id)}
					{@const current = o.id === c.id}
					<button
						class="band-menu-item"
						role="menuitemradio"
						aria-checked={current}
						onclick={() => {
							close();
							onPick(o.id);
						}}
					>
						<span class="sp-check"
							>{#if current}<Mark name="check" size={12} />{/if}</span
						>
						<span class="sp-cycle" class:sp-cycle--version={kind === 'stygian'}>{o.name}</span>
						<span class="sp-dates">{fmtDay(o.start)} – {fmtDay(o.end)}</span>
					</button>
				{/each}
			{/snippet}
		</BandMenu>
		{#if fresh}<NewTag on="builder" />{/if}
	</span>
{/if}

<style>
	.sp-host {
		position: relative;
		display: inline-flex;
	}
	.sp-face {
		white-space: nowrap;
	}
	/* The menu's rows: a check column, the name, its dates. */
	.sp-check {
		width: 12px;
		display: grid;
		place-items: center;
	}
	/* A Moon's name, wide enough that the dates line up down the menu. */
	.sp-cycle {
		min-width: 8.5em;
		font-weight: var(--fw-semibold);
	}
	.sp-cycle.sp-cycle--version {
		min-width: 2.2em;
		font-variant-numeric: tabular-nums;
	}
	.sp-dates {
		color: var(--muted);
	}
	/* Below `compact` (40rem — $lib/breakpoints.ts) the rail shares the band
	   with the pane switch, so the plate keeps only the name. */
	@media (max-width: 40rem) {
		.sp-face-dates {
			display: none;
		}
	}
</style>
