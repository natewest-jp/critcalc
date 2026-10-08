<script lang="ts">
	/**
	 * The tab limit is reached and something wants to open: say which tab will
	 * close to make room, and let the reader pick another (⚓ Nate 2026-10-08,
	 * lineups design §9.3).
	 *
	 * ⚓ A CONFIRM EVERY TIME, arriving links included. That overrules the
	 * 2026-08-17 ruling that parked an arriving link in the bank rather than
	 * interrupt a flow the reader did not start: at twelve tabs the prompt
	 * should be rare, and a closed tab is never lost (it goes to Recently
	 * closed), so the prompt is a choice, not a warning.
	 *
	 * Replaces TabsFullDialog (the parked-link report), whose shape it keeps:
	 * an `alertdialog` whose backdrop does not dismiss, because a stray click on
	 * the way to the timeline is exactly how the choice would be missed.
	 */
	import { untrack } from 'svelte';
	import { fade } from 'svelte/transition';
	import { T_QUICK, motion, introLive, outroInert } from '$lib/motion';
	import { TAB_LIMIT } from '$lib/tabSet';
	import Mark from './Mark.svelte';

	let {
		tabs,
		candidateId,
		onConfirm,
		onCancel
	}: {
		tabs: readonly { id: string; label: string }[];
		candidateId: string;
		onConfirm: (id: string) => void;
		onCancel: () => void;
	} = $props();

	// The pre-selection is the candidate AT OPEN; the reader's pick then owns
	// it. (The layout keys this dialog on the request, so a new one re-seeds.)
	let chosen = $state(untrack(() => candidateId));

	let confirmEl = $state<HTMLButtonElement | undefined>();
	// Focus the confirm so Enter accepts the suggestion.
	$effect(() => confirmEl?.focus());

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onCancel();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Fades on --t-quick — the SURFACE band (a scrim over the whole viewport).
     `outroInert` is the outro-eats-your-click fix; ⛔ don't drop it. -->
<div
	class="tl-backdrop"
	transition:fade={{ duration: motion(T_QUICK) }}
	onintrostart={introLive}
	onoutrostart={outroInert}
	role="presentation"
>
	<div class="tl-panel ctx-dark" role="alertdialog" aria-modal="true" aria-labelledby="tl-title">
		<h2 class="title" id="tl-title">Close a tab to open this one</h2>
		<p class="tl-body">
			All {TAB_LIMIT} tabs are open. The tab you close goes to <strong>Recently closed</strong>,
			under Load, where you can reopen it.
		</p>
		<ul class="tl-list" role="radiogroup" aria-label="Tab to close">
			{#each tabs as tab (tab.id)}
				<li>
					<label class="tl-option">
						<input type="radio" name="tl-tab" value={tab.id} bind:group={chosen} />
						<span class="tl-label">{tab.label}</span>
						{#if tab.id === candidateId}
							<span class="tl-note">Viewed longest ago</span>
						{/if}
					</label>
				</li>
			{/each}
		</ul>
		<div class="tl-actions">
			<button class="btn btn--sm" type="button" onclick={onCancel}>Cancel</button>
			<button
				class="btn btn--sm btn--primary"
				type="button"
				bind:this={confirmEl}
				onclick={() => onConfirm(chosen)}
			>
				<Mark name="close" />
				Close and open
			</button>
		</div>
	</div>
</div>

<style>
	.tl-backdrop {
		position: fixed;
		inset: 0;
		z-index: 200;
		display: flex;
		align-items: center;
		justify-content: center;
		/* Alpha in the PAINT — this subtree is transform-placed by the panel's
		   centring, and an opacity subtree rasterizes at rounded coordinates in
		   WebKit (the sub-pixel laws). */
		background: rgba(16, 16, 19, 0.72);
	}
	.tl-panel {
		width: min(30rem, calc(100vw - 2rem));
		max-height: calc(100svh - 2rem);
		background: var(--surface);
		border-radius: 6px;
		padding: 18px 20px 16px;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.tl-body {
		margin: 0;
		font-size: var(--fs-xl);
		line-height: var(--lh-normal);
		color: var(--muted);
	}
	.tl-body strong {
		color: var(--text);
		font-weight: var(--fw-semibold);
	}
	.tl-list {
		list-style: none;
		margin: 0;
		padding: 0;
		overflow-y: auto;
		min-height: 0;
	}
	/* `position: relative` — a visually-hidden-input label must be positioned
	   (CLAUDE.md, 2026-08-17); the radio here is visible, but the rule costs
	   nothing and keeps the class out of that hazard. */
	.tl-option {
		position: relative;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 5px 6px;
		border-radius: 3px;
		cursor: pointer;
		font-size: var(--fs-md);
		color: var(--text);
		transition: background var(--t-snap);
	}
	.tl-option:hover {
		background: var(--fill-rest);
	}
	.tl-option input {
		accent-color: var(--accent);
		margin: 0;
	}
	.tl-label {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.tl-note {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: var(--fs-xs);
		color: var(--muted);
		white-space: nowrap;
	}
	.tl-actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		margin-top: 4px;
	}
</style>
