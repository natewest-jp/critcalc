<script lang="ts">
	/**
	 * One half of Floor 12's opponents (Nate 2026-10-09). The game's "Opponent
	 * details" loops both halves together behind chamber tabs; here each HALF
	 * has its own — the planning question is "who is in the half this team
	 * fights", so the three chambers stack and nothing hides behind a tab.
	 * Rows as the game draws them: icon, name, level — plus HP, which the game
	 * leaves out and a player wants. ⏭ Working copy (copy step 8).
	 */
	import { onMount } from 'svelte';
	import Mark from '$lib/components/Mark.svelte';
	import { portal } from '$lib/actions/portal';
	import { closeOnLeave } from '$lib/closeOnLeave';
	import { inLang, monsterImage, type AbyssCycle } from '$lib/endgame';

	let { cycle, half, onClose }: { cycle: AbyssCycle; half: 0 | 1; onClose: () => void } = $props();

	const hp = (n: number) => n.toLocaleString('en-US');
	let closeBtn = $state<HTMLButtonElement>();
	onMount(() => closeBtn?.focus());
	// Portalled out of a page the tool pan keeps alive, paused, through the leave.
	closeOnLeave(
		() => true,
		() => onClose()
	);
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onClose()} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="op-scrim" use:portal onclick={onClose}></div>
<div
	class="op ctx-dark"
	use:portal
	role="dialog"
	aria-modal="true"
	aria-label="Opponents, {half === 0 ? 'first' : 'second'} half"
>
	<header class="op-head">
		<h2 class="op-title">{half === 0 ? 'First half' : 'Second half'} · Opponents</h2>
		<button class="btn btn--icon" bind:this={closeBtn} aria-label="Close" onclick={onClose}
			><Mark name="close" size={16} /></button
		>
	</header>
	<div class="op-body">
		{#each cycle.chambers as ch, i (i)}
			<section class="op-chamber">
				<p class="kicker op-kicker">Chamber {i + 1}</p>
				<ul class="op-list">
					{#each ch.halves[half] as m, j (j)}
						<li class="op-row">
							<img src={monsterImage(m.icon)} alt="" />
							<span class="op-name">{inLang(m.name)}</span>
							<span class="op-meta">Lv. {ch.level} · {hp(m.hp)} HP</span>
						</li>
					{/each}
				</ul>
			</section>
		{/each}
	</div>
</div>

<style>
	.op-scrim {
		position: fixed;
		inset: 0;
		z-index: 70;
		background: rgb(0 0 0 / 0.5);
	}
	/* Centred by margins, ⛔ not a translate (the sub-pixel law). */
	.op {
		position: fixed;
		z-index: 71;
		inset: 0;
		margin: auto;
		height: fit-content;
		width: min(40rem, calc(100vw - 2rem));
		max-height: calc(100svh - 5rem);
		display: flex;
		flex-direction: column;
		border-radius: var(--r-lg, 6px);
		background: var(--surface);
		color: var(--text);
		overflow: hidden;
	}
	.op-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1rem 1rem 0.5rem 1.4rem;
	}
	.op-title {
		margin: 0;
		font-size: var(--fs-3xl);
	}
	.op-body {
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
		padding: 0.5rem 1.4rem 1.4rem;
	}
	.op-kicker {
		font-size: var(--fs-sm);
		margin-bottom: 0.5rem;
	}
	.op-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
		gap: 6px;
	}
	.op-row {
		display: grid;
		grid-template-columns: 40px minmax(0, 1fr);
		grid-template-rows: auto auto;
		column-gap: 0.7rem;
		align-items: center;
		padding: 0.45rem 0.6rem;
		border-radius: var(--r-sm);
		/* One rung UP from the modal's ground (slate-700 on slate-800). */
		background: var(--surface-raised);
	}
	.op-row img {
		grid-row: 1 / 3;
		width: 40px;
		height: 40px;
		border-radius: var(--r-sm);
	}
	.op-name {
		font-size: var(--fs-lg);
		font-weight: var(--fw-semibold);
		line-height: 1.25;
	}
	.op-meta {
		font-size: var(--fs-sm);
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}
</style>
