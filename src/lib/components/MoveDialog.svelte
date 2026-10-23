<!--
  MOVE TO A PROFILE (design §4.3, §9.3; build plan §13, phase 3): a
  Theorycraft document goes to a real profile, where its owned characters read
  the roster. ⚓ The confirmation LISTS WHAT CHANGES before you commit, because
  moving silently changes every owned character whose level differs; if the
  document exists because of those levels, the list is what tells you to leave
  it in Theorycraft. ⚓ Move, not copy (draft 5).

  An `alertdialog` whose backdrop does not dismiss (TabLimitDialog's shape): a
  stray click must not decide a move. Strings are working copy.
-->
<script lang="ts">
	import { fade } from 'svelte/transition';
	import { T_QUICK, motion, introLive, outroInert } from '$lib/motion';
	import { moveRequest } from '$lib/moveRequest.svelte';
	import { storageSession } from '$lib/storage/session.svelte';
	import { pictureOf, type ProfileRecord } from '$lib/storage/records';
	import type { LevelChange } from '$lib/storage/move';
	import { pictureUrl } from '$lib/profileLook';
	import { getCharacterIndexEntry } from '$lib/data/characterLookup';
	import { siteSettings } from '$lib/stores';

	let { id }: { id: string } = $props();

	const targets = $derived(storageSession.moveTargets);
	let chosen = $state<string | null>(null);
	const target = $derived(targets.find((p) => p.id === chosen) ?? targets[0]);

	let changes = $state<LevelChange[] | null>(null);
	let kind = $state<'rotation' | 'lineup'>('rotation');
	$effect(() => {
		const t = target;
		changes = null;
		if (!t) return;
		void storageSession.moveChanges(id, t.id).then((c) => {
			if (target === t) changes = c ?? [];
		});
	});
	$effect(() => {
		void storageSession
			.documents('lineup')
			.then((l) => (kind = l.some((d) => d.id === id) ? 'lineup' : 'rotation'));
	});

	const nameOf = (cid: string) => getCharacterIndexEntry(cid)?.displayName ?? cid;
	const picture = (p: ProfileRecord) =>
		pictureUrl(pictureOf(p), $siteSettings.useNewOutfits, p.twin);

	let busy = $state(false);
	async function confirm(): Promise<void> {
		if (!target || busy) return;
		busy = true;
		await storageSession.moveTo(id, target.id);
		moveRequest.id = null;
	}
	const cancel = () => (moveRequest.id = null);

	let confirmEl = $state<HTMLButtonElement | undefined>();
	$effect(() => confirmEl?.focus());

	function onKey(e: KeyboardEvent): void {
		if (e.key !== 'Escape') return;
		e.preventDefault();
		cancel();
	}
</script>

<svelte:window onkeydown={onKey} />

<!-- `outroInert` is the outro-eats-your-click fix; ⛔ don't drop it. -->
<div
	class="mv-backdrop"
	transition:fade={{ duration: motion(T_QUICK) }}
	onintrostart={introLive}
	onoutrostart={outroInert}
	role="presentation"
>
	<div class="mv-panel ctx-dark" role="alertdialog" aria-modal="true" aria-labelledby="mv-title">
		<h2 class="title" id="mv-title">
			Move to {targets.length === 1 && target ? target.name : 'a profile'}
		</h2>

		{#if targets.length > 1}
			<div class="targets" role="radiogroup" aria-label="Profile">
				{#each targets as p (p.id)}
					<button
						class="target"
						role="radio"
						aria-checked={p.id === target?.id}
						class:is-on={p.id === target?.id}
						onclick={() => (chosen = p.id)}
					>
						<img src={picture(p)} alt="" />
						<span>{p.name}</span>
					</button>
				{/each}
			</div>
		{/if}

		{#if changes === null}
			<p class="note">&nbsp;</p>
		{:else if changes.length === 0}
			<p class="note">
				No levels change in {target?.name}.
			</p>
		{:else}
			<p class="note">
				In {target?.name}, owned characters read the roster, so this {kind} changes:
			</p>
			<ul class="changes">
				{#each changes as c (c.id)}
					<li>
						<span class="who">{nameOf(c.id)}</span>
						<span class="lv">C{c.from} → C{c.to}</span>
					</li>
				{/each}
			</ul>
			<p class="note note--quiet">
				If this {kind} depends on those levels, keep it in Theorycraft.
			</p>
		{/if}

		<div class="actions">
			<button class="btn" onclick={cancel}>Cancel</button>
			<button
				class="btn btn--primary"
				bind:this={confirmEl}
				disabled={!target || changes === null || busy}
				onclick={confirm}>Move</button
			>
		</div>
	</div>
</div>

<style>
	.mv-backdrop {
		position: fixed;
		inset: 0;
		z-index: 200;
		display: grid;
		place-items: center;
		padding: 1rem;
		background: rgba(16, 16, 19, 0.72);
	}
	.mv-panel {
		width: min(26rem, 100%);
		padding: 1.2rem 1.3rem 1.1rem;
		border-radius: var(--r-md);
		background: var(--surface);
		color: var(--text);
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
	}
	.title {
		margin: 0 0 0.9rem;
		font-family: var(--font-display);
		font-size: var(--fs-2xl);
		font-weight: var(--fw-semibold);
	}
	.targets {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-bottom: 0.9rem;
	}
	.target {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.25rem 0.7rem 0.25rem 0.25rem;
		border: 1px solid var(--line-faint);
		border-radius: 999px;
		background: none;
		color: var(--text);
		font: inherit;
		cursor: pointer;
		transition:
			border-color var(--t-snap),
			background var(--t-snap);
	}
	.target img {
		width: 1.6rem;
		height: 1.6rem;
		border-radius: 50%;
	}
	.target:hover {
		background: var(--surface-hover);
	}
	.target.is-on {
		border-color: var(--sel-ring);
		background: var(--surface-raised);
	}
	.note {
		margin: 0 0 0.6rem;
		font-size: var(--fs-md);
		line-height: 1.5;
	}
	.note--quiet {
		color: var(--muted);
	}
	.changes {
		margin: 0 0 0.8rem;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.changes li {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.3rem 0.6rem;
		border-radius: var(--r-sm);
		background: var(--surface-raised);
	}
	.lv {
		font-variant-numeric: tabular-nums;
		color: var(--muted);
	}
	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.4rem;
		margin-top: 1rem;
	}
</style>
