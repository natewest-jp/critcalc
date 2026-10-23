<!--
  THE LIBRARY'S TWO PLACES (profiles and surfaces design §4.2, §6.3; build
  plan §13, phase 2c): Rotations as rows, Lineups as cards, both the active
  profile's documents from the store. ⚓ The Library is the SWITCHER: each tool
  holds one document, and a row puts its document in the tool and returns.
  Pinned rows head the list, because a recency list reorders itself on every
  switch. Rename and Delete live on the row (⚓ no ⋯ verbs menu in the bar).

  ⏭ Not yet: the mini timeline strip (a parse per row), guests nested under their row and pick mode (phase 4).
  Strings are working copy.
-->
<script lang="ts">
	import { onDestroy } from 'svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Mark from './Mark.svelte';
	import { menu } from '$lib/menuState.svelte';
	import { recency, storageSession, type DocTool } from '$lib/storage/session.svelte';
	import { lineupLabel, rotationLabel } from '$lib/storage/convert';
	import type { DocumentRecord, LineupDocument, RotationDocument } from '$lib/storage/records';
	import { getAvatar } from '$lib/utils/getAvatar';
	import { siteSettings } from '$lib/stores';
	import { teamKey } from '$lib/utils/notationEdit';
	import { moveRequest, MOVE_TO_PROFILE } from '$lib/moveRequest.svelte';

	let { place }: { place: DocTool } = $props();

	const type = $derived(place === 'planner' ? 'rotation' : 'lineup');
	const toolPath = $derived(resolve(place === 'planner' ? '/planner' : '/builder'));
	const twin = $derived(storageSession.profile?.twin ?? 'aether');

	let docs = $state<DocumentRecord[]>([]);
	let loaded = $state(false);
	$effect(() => {
		void storageSession.version;
		void storageSession.profile?.id;
		const t = type;
		void storageSession.documents(t).then((list) => {
			docs = list.sort((a, b) => recency(b) - recency(a));
			loaded = true;
		});
	});

	const currentId = $derived.by(() => {
		void storageSession.version;
		return storageSession.currentId(place);
	});
	/** Narrowed to one team's work (a team card's link, design §3); the
	 *  filter lasts while this place is showing. */
	const filter = $derived(menu.teamFilter);
	onDestroy(() => (menu.teamFilter = null));
	const ofTeam = (d: DocumentRecord): boolean =>
		!filter ||
		(d.type === 'rotation'
			? teamKey(d.body.slots) === filter.key
			: d.body.teams.some((t) => teamKey(t.slots) === filter.key));
	const shown = $derived(docs.filter(ofTeam));
	/** ⚓ Theorycraft's documents can move to a real profile (§4.3). */
	const canMove = $derived(
		storageSession.profile?.kind === 'theorycraft' && storageSession.moveTargets.length > 0
	);
	const pinned = $derived(shown.filter((d) => d.pinned));
	const recent = $derived(shown.filter((d) => !d.pinned));

	/** Back onto the tool if it is underneath, else go to it. */
	function arrive(): void {
		if (page.url.pathname.startsWith(toolPath) && !menu.routed) menu.close();
		else menu.leaveTo(toolPath);
	}

	async function choose(d: DocumentRecord): Promise<void> {
		await storageSession.open(d.id);
		arrive();
	}

	async function create(): Promise<void> {
		await storageSession.create(place);
		arrive();
	}

	// ── Rename, in place ────────────────────────────────────────────────────
	let renaming = $state<string | null>(null);
	let draft = $state('');
	function startRename(d: DocumentRecord): void {
		renaming = d.id;
		draft = d.name ?? '';
	}
	async function commitRename(): Promise<void> {
		const id = renaming;
		renaming = null;
		if (id) await storageSession.rename(id, draft);
	}
	function focusSelect(node: HTMLInputElement): void {
		node.focus();
		node.select();
	}

	// ── Delete, confirmed by a second click ─────────────────────────────────
	let armed = $state<string | null>(null);
	let armTimer: ReturnType<typeof setTimeout> | undefined;
	function del(d: DocumentRecord): void {
		if (armed !== d.id) {
			armed = d.id;
			clearTimeout(armTimer);
			armTimer = setTimeout(() => (armed = null), 3000);
			return;
		}
		armed = null;
		void storageSession.remove(d.id);
	}

	// ── Words ───────────────────────────────────────────────────────────────
	const label = (d: DocumentRecord): string =>
		d.name ??
		(d.type === 'rotation' ? rotationLabel(d.body.slots) : lineupLabel((d as LineupDocument).body));

	const ago = (t: number): string => {
		const m = Math.round((Date.now() - t) / 60_000);
		if (m < 1) return 'Just now';
		if (m < 60) return `${m} min ago`;
		const h = Math.round(m / 60);
		if (h < 24) return `${h} h ago`;
		const days = Math.round(h / 24);
		return days === 1 ? 'Yesterday' : `${days} days ago`;
	};

	const avatar = (id: string) => getAvatar(id, $siteSettings.useNewOutfits, 'circle', twin);
	const seated = (d: RotationDocument) => d.body.slots.filter((s): s is string => !!s);
</script>

{#snippet portraits(ids: readonly (string | null)[], size: number)}
	<span class="portraits" style:--p="{size}px">
		{#each ids as id, i (i)}
			{#if id}<img src={avatar(id)} alt="" />{:else}<span class="p-empty"></span>{/if}
		{/each}
	</span>
{/snippet}

{#snippet labelOrEdit(d: DocumentRecord)}
	{#if renaming === d.id}
		<input
			class="rename"
			bind:value={draft}
			placeholder={d.type === 'rotation'
				? rotationLabel(d.body.slots)
				: lineupLabel((d as LineupDocument).body)}
			aria-label="Name"
			use:focusSelect
			onclick={(e) => e.stopPropagation()}
			onblur={commitRename}
			onkeydown={(e) => {
				if (e.key === 'Enter') commitRename();
				if (e.key === 'Escape') {
					e.preventDefault();
					renaming = null;
				}
			}}
		/>
	{:else}
		<span class="row-label" class:is-derived={!d.name}>{label(d)}</span>
	{/if}
{/snippet}

{#snippet actions(d: DocumentRecord)}
	<span class="row-acts">
		<button
			class="row-act"
			class:is-on={d.pinned}
			aria-label={d.pinned ? 'Unpin' : 'Pin'}
			title={d.pinned ? 'Unpin' : 'Pin'}
			onclick={() => storageSession.setPinned(d.id, !d.pinned)}
			><Mark name="pin" size={14} /></button
		>
		<button class="row-act" aria-label="Rename" title="Rename" onclick={() => startRename(d)}
			><Mark name="edit" size={14} /></button
		>
		{#if canMove}
			<button
				class="row-act"
				aria-label={MOVE_TO_PROFILE}
				title={MOVE_TO_PROFILE}
				onclick={() => (moveRequest.id = d.id)}><Mark name="forward" size={14} /></button
			>
		{/if}
		<button
			class="row-act row-act--danger"
			class:is-armed={armed === d.id}
			aria-label={armed === d.id ? 'Delete: click again to confirm' : 'Delete'}
			title={armed === d.id ? 'Click again to delete' : 'Delete'}
			onclick={() => del(d)}
			><Mark name={armed === d.id ? 'warn' : 'delete'} size={14} />{#if armed === d.id}<span
					>Delete?</span
				>{/if}</button
		>
	</span>
{/snippet}

{#snippet row(d: DocumentRecord)}
	{@const isCurrent = d.id === currentId}
	<li class="row" class:is-current={isCurrent}>
		<button class="row-main" onclick={() => choose(d)} disabled={renaming === d.id}>
			{@render portraits(seated(d as RotationDocument), 30)}
			<span class="row-text">
				{@render labelOrEdit(d)}
				<span class="row-meta">
					{#if isCurrent}<span class="row-now">Open now</span>{/if}
					{#if d.fromLink}<span class="row-flag"><Mark name="link" size={11} /> From a link</span
						>{/if}
					<span>{ago(recency(d))}</span>
				</span>
			</span>
		</button>
		{@render actions(d)}
	</li>
{/snippet}

<div class="place">
	<div class="place-acts">
		<button class="btn" onclick={create}
			><Mark name="plus" size={14} /> New {place === 'planner' ? 'rotation' : 'lineup'}</button
		>
		{#if filter}
			<button
				class="chip"
				onclick={() => (menu.teamFilter = null)}
				aria-label={`Show all, not only ${filter.label}`}
				title="Show all">{filter.label} <Mark name="close" size={12} /></button
			>
		{/if}
	</div>

	{#if loaded && docs.length === 0}
		<p class="empty">
			Nothing saved yet. {place === 'planner' ? 'A rotation' : 'A lineup'} is saved here as soon as you
			start one.
		</p>
	{:else if loaded && shown.length === 0}
		<p class="empty">No {place === 'planner' ? 'rotations' : 'lineups'} for this team yet.</p>
	{:else if place === 'planner'}
		{#if pinned.length}
			<p class="sec">Pinned</p>
			<ul class="rows">
				{#each pinned as d (d.id)}{@render row(d)}{/each}
			</ul>
		{/if}
		{#if recent.length}
			{#if pinned.length}<p class="sec">Recent</p>{/if}
			<ul class="rows">
				{#each recent as d (d.id)}{@render row(d)}{/each}
			</ul>
		{/if}
	{:else}
		<ul class="cards">
			{#each [...pinned, ...recent] as d (d.id)}
				{@const isCurrent = d.id === currentId}
				{@const lineup = d as LineupDocument}
				<li class="card" class:is-current={isCurrent}>
					<button class="card-main" onclick={() => choose(d)} disabled={renaming === d.id}>
						<span class="card-head">
							{@render labelOrEdit(d)}
							{#if d.pinned}<span class="card-pin"><Mark name="pin" size={12} /></span>{/if}
						</span>
						<span class="card-teams">
							{#each lineup.body.teams.slice(0, 4) as team (team.id)}
								{@render portraits(team.slots, 24)}
							{/each}
						</span>
						<span class="row-meta">
							{#if isCurrent}<span class="row-now">Open now</span>{/if}
							{#if d.fromLink}<span class="row-flag"
									><Mark name="link" size={11} /> From a link</span
								>{/if}
							<span>{ago(recency(d))}</span>
						</span>
					</button>
					{@render actions(d)}
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.place-acts {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin-bottom: 1rem;
	}
	/* The team the list is narrowed to; ✕ shows everything again. */
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		margin-left: 0.4rem;
		padding: 0.25rem 0.55rem;
		border: 1px solid var(--sel-ring);
		border-radius: 999px;
		background: none;
		color: var(--text);
		font: inherit;
		font-size: var(--fs-sm);
		cursor: pointer;
	}
	.chip:hover {
		background: var(--surface-hover);
	}
	.empty {
		max-width: 34rem;
		font-size: var(--fs-lg);
		color: var(--muted);
	}
	.sec {
		margin: 1.2rem 0 0.4rem;
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		color: var(--muted);
	}
	.rows,
	.cards {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.rows {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	/* ── A rotation row ── */
	.row,
	.card {
		position: relative;
		display: flex;
		align-items: center;
		border-radius: var(--r-sm);
		background: var(--surface-raised);
		transition: background var(--t-snap);
	}
	.row:hover,
	.card:hover {
		background: var(--surface-hover);
	}
	.row.is-current,
	.card.is-current {
		box-shadow: inset 0 0 0 1px var(--sel-ring);
	}
	.row-main,
	.card-main {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.6rem 0.8rem;
		border: none;
		background: none;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.row-text {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		min-width: 0;
	}
	.row-label {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: var(--fs-lg);
		font-weight: var(--fw-semibold);
		color: var(--text);
	}
	/* A derived label is a placeholder: the name is not set (§4.2). */
	.row-label.is-derived {
		font-weight: var(--fw-medium);
		color: var(--muted);
	}
	.rename {
		min-width: 0;
		width: min(24rem, 100%);
		padding: 0.15rem 0.4rem;
		border: 1px solid var(--border);
		border-radius: var(--r-sm);
		background: var(--surface-well);
		color: var(--text);
		font: inherit;
		font-size: var(--fs-lg);
	}
	.row-meta {
		display: flex;
		gap: 0.6rem;
		font-size: var(--fs-sm);
		color: var(--muted);
	}
	.row-flag {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
	}
	.row-now {
		color: var(--accent);
		font-weight: var(--fw-semibold);
	}

	.portraits {
		display: inline-flex;
		flex: none;
	}
	.portraits img,
	.p-empty {
		width: var(--p);
		height: var(--p);
		border-radius: 50%;
		background: var(--surface-well);
	}
	.portraits > :not(:first-child) {
		margin-left: calc(var(--p) * -0.18);
	}
	.p-empty {
		box-shadow: inset 0 0 0 1px var(--line-faint);
	}

	/* ── The row's verbs: quiet at rest, brighter on the row's hover ── */
	.row-acts {
		display: flex;
		gap: 2px;
		padding-right: 0.5rem;
	}
	.row-act {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.35rem;
		border: none;
		border-radius: var(--r-sm);
		background: none;
		color: var(--muted);
		font: inherit;
		font-size: var(--fs-sm);
		opacity: 0.55;
		cursor: pointer;
		transition:
			opacity var(--t-snap),
			background var(--t-snap),
			color var(--t-snap);
	}
	.row:hover .row-act,
	.card:hover .row-act,
	.row-act:focus-visible,
	.row-act.is-on,
	.row-act.is-armed {
		opacity: 1;
	}
	.row-act:hover {
		background: var(--surface-hover);
		color: var(--text);
	}
	.row-act.is-on {
		color: var(--accent);
	}
	.row-act--danger:hover,
	.row-act.is-armed {
		color: var(--ui-danger);
	}

	/* ── Lineups as cards: the teams inside, so a lineup is recognised by
	      its contents (§6.3) ── */
	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
		gap: 0.6rem;
	}
	.card {
		align-items: flex-start;
	}
	.card-main {
		flex-direction: column;
		align-items: flex-start;
		gap: 0.55rem;
	}
	.card-head {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		min-width: 0;
		max-width: 100%;
	}
	.card-pin {
		display: inline-flex;
		color: var(--accent);
	}
	.card-teams {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.card .row-acts {
		padding-top: 0.5rem;
	}
</style>
