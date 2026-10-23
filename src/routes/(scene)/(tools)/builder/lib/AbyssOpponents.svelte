<script lang="ts">
	import { nextLayout } from '$lib/nextLayout';
	import InspectModal from '$lib/components/InspectModal.svelte';
	/**
	 * One half of Floor 12's opponents (Nate 2026-10-09). The game's "Opponent
	 * details" loops both halves together behind chamber tabs; here each HALF
	 * has its own — the planning question is "who is in the half this team
	 * fights", so the three chambers stack and nothing hides behind a tab.
	 * Rows as the game draws them: icon, name, level — plus HP, which the game
	 * leaves out and a player wants. ⏭ Working copy (copy step 8).
	 */
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { T_QUICK, motion, introLive, outroInert } from '$lib/motion';
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

<svelte:window onkeydown={(e) => !$nextLayout && e.key === 'Escape' && onClose()} />

{#snippet body(withClose: boolean)}
	<header class="op-head">
		<h2 class="op-title">{half === 0 ? 'First half' : 'Second half'} · Opponents</h2>
		{#if withClose}
			<button class="btn btn--icon" bind:this={closeBtn} aria-label="Close" onclick={onClose}
				><Mark name="close" size={16} /></button
			>
		{/if}
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
{/snippet}

{#if $nextLayout}
	<!-- ⚓ The inspector's modal shape (inspector round, Nate 2026-10-23): the
	     Builder's one shell, a margin that closes it. -->
	<InspectModal label="Opponents, {half === 0 ? 'first' : 'second'} half" width="40rem" {onClose}>
		<div class="op-in">{@render body(false)}</div>
	</InspectModal>
{:else}
	<!-- Fades on --t-quick — a SURFACE over a scrim; `outroInert` is the
	     outro-eats-your-click fix ($lib/motion). ⛔ don't drop it. -->
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
	<div
		class="op-scrim"
		use:portal
		onclick={onClose}
		transition:fade={{ duration: motion(T_QUICK) }}
		onintrostart={introLive}
		onoutrostart={outroInert}
	></div>
	<div
		class="op ctx-dark"
		use:portal
		role="dialog"
		aria-modal="true"
		aria-label="Opponents, {half === 0 ? 'first' : 'second'} half"
		transition:fade={{ duration: motion(T_QUICK) }}
		onintrostart={introLive}
		onoutrostart={outroInert}
	>
		{@render body(true)}
	</div>
{/if}

<style>
	/* Inside the InspectModal shell (inspector round): the shell is the ground
	   and the scroller; the content keeps its own column. */
	.op-in {
		display: flex;
		flex-direction: column;
	}
	/* The shell's header grammar: its insets, the display title at the
	   others' size, a hairline under it; the ✕ stands clear at the right. */
	.op-in .op-head {
		padding: var(--im-pad-top) 3.5rem 1.1rem var(--im-pad-x);
		border-bottom: 1px solid var(--line-faint);
	}
	.op-in .op-title {
		font-family: var(--font-display);
		font-size: var(--fs-4xl);
		line-height: 1.15;
	}
	/* The shell scrolls, so the body no longer needs to. */
	.op-in .op-body {
		overflow: visible;
		padding: 1.2rem var(--im-pad-x) 1.5rem;
	}
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
		/* auto-FIT: a lone enemy spans the row instead of taking half of it
		   beside an empty track (long boss names wrapped at 1440 with ~300px
		   of dialog spare); two still split it, three keep 2 + 1. */
		grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
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
