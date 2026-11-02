<script lang="ts">
	import { INSTRUMENTS, type InstrumentId } from './workspace';

	/**
	 * The eight instruments as one row of plates, for a ONE-UP workspace with
	 * the room to spell them all out (the Visualizers overhaul, round 1:
	 * `docs/rounds/viz-workspace-bars-2026-11-02.md`). The dropdown
	 * (`InstrumentPicker`) hid seven of eight behind a click; this row shows
	 * what the tool holds. Below the width the row needs, the cell shows the
	 * dropdown instead (the container query in `+page.svelte`).
	 *
	 * The plates are the band's own: glass, the current one lit with the dim
	 * gold fill that means "on" (app.css § ON IS A DIM GOLD FILL). Tabs, by
	 * the ARIA pattern: one tab stop, arrows move along the row, and moving IS
	 * choosing (automatic activation), since an instrument opens instantly.
	 */
	let {
		current,
		onPick,
		panelId
	}: {
		current: InstrumentId;
		onPick: (id: InstrumentId) => void;
		/** The tile the tabs switch, for `aria-controls`. */
		panelId: string;
	} = $props();

	let row = $state<HTMLDivElement | null>(null);

	function onKeydown(e: KeyboardEvent) {
		const i = INSTRUMENTS.findIndex((inst) => inst.id === current);
		let next = -1;
		if (e.key === 'ArrowRight') next = (i + 1) % INSTRUMENTS.length;
		else if (e.key === 'ArrowLeft') next = (i - 1 + INSTRUMENTS.length) % INSTRUMENTS.length;
		else if (e.key === 'Home') next = 0;
		else if (e.key === 'End') next = INSTRUMENTS.length - 1;
		if (next === -1) return;
		e.preventDefault();
		onPick(INSTRUMENTS[next].id);
		queueMicrotask(() => row?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus());
	}
</script>

<div class="it-row" role="tablist" aria-label="Instruments" bind:this={row}>
	{#each INSTRUMENTS as inst (inst.id)}
		{@const on = inst.id === current}
		<button
			class="btn btn--glass it-tab"
			class:is-active={on}
			role="tab"
			aria-selected={on}
			aria-controls={panelId}
			tabindex={on ? 0 : -1}
			onclick={() => onPick(inst.id)}
			onkeydown={onKeydown}
		>
			{inst.name}
		</button>
	{/each}
</div>

<style>
	.it-row {
		display: flex;
		align-items: center;
		gap: var(--band-item-gap, 4px);
		min-width: 0;
	}

	/* Every word on one line: the cell trades the row for the dropdown before
	   a name would wrap (the threshold beside `.ws-band-cell` in +page). */
	.it-tab {
		white-space: nowrap;
	}
</style>
