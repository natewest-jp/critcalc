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
	import SidePortrait from './SidePortrait.svelte';
	import BandMenu from './BandMenu.svelte';
	import { BOARD_PRESETS, type BoardPreset } from '$lib/boards.svelte';
	import { menu } from '$lib/menuState.svelte';
	import { recency, storageSession, type DocTool } from '$lib/storage/session.svelte';
	import { lineupLabel, rotationLabel } from '$lib/storage/convert';
	import {
		THEORYCRAFT_ID,
		type DocumentRecord,
		type LineupDocument,
		type RotationDocument
	} from '$lib/storage/records';
	import { getCharacterIndexEntry } from '$lib/data/characterLookup';
	import { teamKey } from '$lib/utils/notationEdit';
	import { moveRequest, MOVE_TO_PROFILE } from '$lib/moveRequest.svelte';

	let { place }: { place: DocTool } = $props();

	const type = $derived(place === 'planner' ? 'rotation' : 'lineup');
	const toolPath = $derived(resolve(place === 'planner' ? '/planner' : '/builder'));

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
	/** PICK MODE (§6.3): choosing a partner for a rotation (Compare with…,
	 *  §4.6). The rotation itself is not a choice. */
	const pickFor = $derived(place === 'planner' ? menu.pickFor : null);
	onDestroy(() => (menu.pickFor = null));
	const listed = $derived(pickFor ? shown.filter((d) => d.id !== pickFor) : shown);

	/** Each paired document's partner. ⚓ A guest (a Theorycraft copy of a
	 *  profile's rotation) shows NESTED under the row it was copied from,
	 *  framed in Theorycraft's white, never as a row of its own (§6.3); in
	 *  Theorycraft, the copy carries a small "From <profile>" mark. */
	let partners = $state<Record<string, DocumentRecord>>({});
	$effect(() => {
		const list = docs;
		void storageSession.partners(list).then((p) => (partners = p));
	});
	const guestOf = (d: DocumentRecord): DocumentRecord | undefined => {
		const p = partners[d.id];
		return p && p.profileId !== d.profileId && p.profileId === THEORYCRAFT_ID ? p : undefined;
	};
	const fromProfile = (d: DocumentRecord): string | undefined => {
		const p = partners[d.id];
		if (!p || d.profileId !== THEORYCRAFT_ID || p.profileId === THEORYCRAFT_ID) return undefined;
		return storageSession.profiles.find((x) => x.id === p.profileId)?.name;
	};
	const plannerCurrent = $derived.by(() => {
		void storageSession.version;
		return storageSession.currentId('planner');
	});

	/** ⚓ A COMPARE PAIR is one entry (2026-10-25): A (the older side, as
	 *  the Planner's compare control names it) is the row, B rides under it.
	 *  A cross-profile pair is a guest instead (above). */
	const pairedB = (d: DocumentRecord): DocumentRecord | undefined => {
		const p = partners[d.id];
		return p && p.profileId === d.profileId && p.createdAt > d.createdAt ? p : undefined;
	};
	/** B shows under A, unless A is not in the list (a team filter, or pick
	 *  mode choosing a partner for A), when B stands on its own. */
	const nested = $derived.by((): Record<string, true> => {
		const ids = listed.map((d) => d.id);
		const out: Record<string, true> = {};
		for (const d of listed) {
			const b = pairedB(d);
			if (b && ids.includes(b.id)) out[b.id] = true;
		}
		return out;
	});
	/** An entry is as recent, and as pinned, as either of its sides. */
	const entries = $derived(
		listed
			.filter((d) => !nested[d.id])
			.map((d) => {
				const b = pairedB(d);
				const sideB = b && nested[b.id] ? b : undefined;
				return { d, b: sideB, at: Math.max(recency(d), sideB ? recency(sideB) : 0) };
			})
			.sort((x, y) => y.at - x.at)
	);
	const pinned = $derived(entries.filter((e) => e.d.pinned || e.b?.pinned));
	const recent = $derived(entries.filter((e) => !(e.d.pinned || e.b?.pinned)));

	/** Back onto the tool if it is underneath, else go to it. */
	function arrive(): void {
		if (page.url.pathname.startsWith(toolPath) && !menu.routed) menu.close();
		else menu.leaveTo(toolPath);
	}

	async function choose(d: DocumentRecord): Promise<void> {
		if (pickFor) {
			await storageSession.compareWith(d.id);
			menu.pickFor = null;
		} else await storageSession.open(d.id);
		arrive();
	}

	/** A new document; a lineup takes the shape chosen from New lineup's menu
	 *  (Stygian, Abyss or Custom, as band A's + offered off the switch). */
	async function create(preset?: BoardPreset): Promise<void> {
		await storageSession.create(place, preset);
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

	/** What a guest changes: its levels that differ from the rotation's own
	 *  reading (an owned character's roster level), e.g. "Xiangling C6". */
	function levelsLine(d: RotationDocument, g: RotationDocument): string {
		const roster = storageSession.profile?.roster;
		const out: string[] = [];
		for (const [id, lv] of Object.entries(g.body.con ?? {})) {
			const own =
				roster?.ownership[id] === 'owned'
					? (roster.constellations[id] ?? 0)
					: (d.body.con?.[id] ?? 0);
			if (lv !== own) out.push(`${getCharacterIndexEntry(id)?.displayName ?? id} C${lv}`);
		}
		return out.join(' · ');
	}

	/** The notation's opening, on one line: what tells two rotations of the
	 *  same four apart at a glance (no parse, so it costs nothing per card). */
	const notationHead = (d: RotationDocument): string => d.body.notation.replace(/\s+/g, ' ').trim();
</script>

<!-- The SIDE portraits, as the bench and the Builder wear them (Nate
     2026-10-25); an empty slot is the game's blank side portrait. Always four,
     so a three-character rotation reads as three and a seat. -->
{#snippet portraits(ids: readonly (string | null)[], size: number)}
	<span class="portraits">
		{#each { length: 4 } as _, i (i)}
			<SidePortrait id={ids[i] ?? null} {size} />
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
	<!-- With a pointer that hovers, the verbs appear over the card's corner on
	     hover or focus; on touch (no hover, whatever the width) they live in a
	     ⋯ menu, so the card's words keep their room. -->
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
	<span class="row-more">
		<BandMenu mark="more" compact size="sm" ariaLabel="More for {label(d)}">
			{#snippet items(close)}
				<button
					class="band-menu-item"
					role="menuitem"
					onclick={() => {
						close();
						void storageSession.setPinned(d.id, !d.pinned);
					}}><Mark name="pin" size={14} /> {d.pinned ? 'Unpin' : 'Pin'}</button
				>
				<button
					class="band-menu-item"
					role="menuitem"
					onclick={() => {
						close();
						startRename(d);
					}}><Mark name="edit" size={14} /> Rename</button
				>
				{#if canMove}
					<button
						class="band-menu-item"
						role="menuitem"
						onclick={() => {
							close();
							moveRequest.id = d.id;
						}}><Mark name="forward" size={14} /> {MOVE_TO_PROFILE}</button
					>
				{/if}
				<!-- The first tap arms, the second deletes (the inline button's
				     rule), so the menu stays open between them. -->
				<button
					class="band-menu-item row-menu-danger"
					role="menuitem"
					onclick={() => {
						if (armed === d.id) close();
						del(d);
					}}
					><Mark name={armed === d.id ? 'warn' : 'delete'} size={14} />
					{armed === d.id ? 'Tap again to delete' : 'Delete'}</button
				>
			{/snippet}
		</BandMenu>
	</span>
{/snippet}

{#snippet line(d: DocumentRecord, tag: 'A' | 'B' | null)}
	{@const isCurrent = d.id === currentId}
	{@const rot = d as RotationDocument}
	<div class="row-line" class:is-current={isCurrent} class:row-line--b={tag === 'B'}>
		<button class="row-main" onclick={() => choose(d)} disabled={renaming === d.id}>
			{#if tag}<span class="pair-tag" title="Compared as {tag}">{tag}</span>{/if}
			{@render portraits(rot.body.slots, 28)}
			<span class="row-text">
				<span class="card-head">
					{@render labelOrEdit(d)}
					{#if d.pinned}<span class="card-pin" title="Pinned"><Mark name="pin" size={12} /></span
						>{/if}
				</span>
				<span class="row-meta">
					{#if isCurrent}<span class="row-now">Open now</span>{/if}
					{#if d.fromLink}<span class="row-flag"><Mark name="link" size={11} /> From a link</span
						>{/if}
					{#if fromProfile(d)}<span class="row-flag row-flag--guest">From {fromProfile(d)}</span
						>{/if}
					<span>{ago(recency(d))}</span>
				</span>
			</span>
			<!-- The notation's opening, in the row's middle: what tells two
			     rotations of the same four apart. -->
			{#if notationHead(rot)}<span class="row-notation">{notationHead(rot)}</span>{/if}
		</button>
		{#if !pickFor}{@render actions(d)}{/if}
	</div>
{/snippet}

<!-- A pinned rotation on the shelf: the card form, larger than a row. A
     pair's B and a Theorycraft copy ride its foot. -->
{#snippet shelfCard(d: DocumentRecord, b?: DocumentRecord)}
	{@const isCurrent = d.id === currentId}
	{@const rot = d as RotationDocument}
	{@const guest = guestOf(d)}
	<li class="card" class:is-current={isCurrent}>
		<button class="card-main" onclick={() => choose(d)} disabled={renaming === d.id}>
			<span class="card-top">
				{#if b}<span class="pair-tag" title="Compared as A">A</span>{/if}
				{@render portraits(rot.body.slots, 34)}
			</span>
			<span class="card-head">
				{@render labelOrEdit(d)}
				<span class="card-pin" title="Pinned"><Mark name="pin" size={12} /></span>
			</span>
			{#if notationHead(rot)}<span class="card-notation">{notationHead(rot)}</span>{/if}
			<span class="row-meta">
				{#if isCurrent}<span class="row-now">Open now</span>{/if}
				{#if d.fromLink}<span class="row-flag"><Mark name="link" size={11} /> From a link</span
					>{/if}
				{#if fromProfile(d)}<span class="row-flag row-flag--guest">From {fromProfile(d)}</span>{/if}
				<span>{ago(recency(d))}</span>
			</span>
		</button>
		{#if !pickFor}{@render actions(d)}{/if}
		{#if b}
			<button class="card-foot" class:is-current={b.id === currentId} onclick={() => choose(b)}>
				<span class="pair-tag" title="Compared as B">B</span>
				<span class="row-label" class:is-derived={!b.name}>{label(b)}</span>
				{#if b.id === currentId}<span class="row-now">Open now</span>{/if}
			</button>
		{/if}
		{#if guest && !pickFor}
			<button
				class="guest-main"
				class:is-current={guest.id === plannerCurrent}
				onclick={() => choose(guest)}
			>
				<span class="guest-tag">Theorycraft copy</span>
				<span class="guest-levels">{levelsLine(rot, guest as RotationDocument)}</span>
				{#if guest.id === plannerCurrent}<span class="row-now">Open now</span>{/if}
			</button>
		{/if}
	</li>
{/snippet}

{#snippet row(d: DocumentRecord, b?: DocumentRecord)}
	{@const guest = guestOf(d)}
	<li class="row" class:is-pair={!!b}>
		{@render line(d, b ? 'A' : null)}
		{#if b}{@render line(b, 'B')}{/if}
		{#if guest && !pickFor}
			<!-- ⚓ A guest rides its row's foot, framed in Theorycraft's white
			     (§4.6, §6.3), with its words. -->
			<button
				class="guest-main"
				class:is-current={guest.id === plannerCurrent}
				onclick={() => choose(guest)}
			>
				<span class="guest-tag">Theorycraft copy</span>
				<span class="guest-levels"
					>{levelsLine(d as RotationDocument, guest as RotationDocument)}</span
				>
				{#if guest.id === plannerCurrent}<span class="row-now">Open now</span>{/if}
			</button>
		{/if}
	</li>
{/snippet}

<div class="place">
	<div class="place-acts">
		{#if pickFor}
			<p class="pick-head">Choose a rotation to compare with</p>
			<button class="btn" onclick={() => (menu.pickFor = null)}>Cancel</button>
		{:else if place === 'planner'}
			<button class="btn" onclick={() => create()}
				><Mark name="plus" size={14} /> New rotation</button
			>
		{:else}
			<BandMenu label="New lineup" mark="plus" align="start">
				{#snippet items(close)}
					{#each BOARD_PRESETS as p (p.key)}
						<button
							class="band-menu-item"
							role="menuitem"
							onclick={() => {
								close();
								void create(p.key);
							}}
						>
							<span class="preset-label">{p.label}</span>
							<span class="preset-hint">{p.hint}</span>
						</button>
					{/each}
				{/snippet}
			</BandMenu>
		{/if}
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
	{:else if loaded && listed.length === 0}
		<p class="empty">No {place === 'planner' ? 'rotations' : 'lineups'} for this team yet.</p>
	{:else if place === 'planner'}
		<!-- ⚓ THE SHELF (Nate 2026-10-25): pins are the rotations you reach for
		     most, so they stand FIRST and LARGER — a row of cards across the
		     top — and Recent runs beneath as full-width rows. (Tried first: a
		     column aside, which put the most-used ones out of the way.) -->
		{#if pinned.length}
			<p class="sec">Pinned</p>
			<ul class="cards shelf">
				{#each pinned as e (e.d.id)}{@render shelfCard(e.d, e.b)}{/each}
			</ul>
		{/if}
		{#if recent.length}
			<section class="lib-recent" aria-label="Recent">
				{#if pinned.length}<p class="sec">Recent</p>{/if}
				<ul class="rows">
					{#each recent as e (e.d.id)}{@render row(e.d, e.b)}{/each}
				</ul>
			</section>
		{/if}
	{:else}
		<ul class="cards">
			{#each [...pinned, ...recent].map((e) => e.d) as d (d.id)}
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
	.place {
		container: place / inline-size;
	}
	/* Recent is its own width question: the notation reads off it. */
	.lib-recent {
		container: library / inline-size;
		min-width: 0;
	}
	/* The shelf's cards are a touch wider than a lineup's: a rotation card
	   carries two lines of notation. */
	.shelf {
		grid-template-columns: repeat(auto-fill, minmax(19rem, 1fr));
	}
	.card-notation {
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		max-width: 100%;
		overflow: hidden;
		overflow-wrap: anywhere;
		font-family: var(--font-mono);
		font-size: var(--fs-sm);
		color: var(--muted);
	}
	/* A pair's B, or a Theorycraft copy, at the card's foot. */
	.card-foot {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.55rem;
		width: 100%;
		padding: 0.4rem 0.8rem;
		border: none;
		border-top: 1px solid var(--line-faint);
		border-radius: 0 0 var(--r-sm) var(--r-sm);
		background: none;
		color: var(--text);
		font: inherit;
		font-size: var(--fs-sm);
		text-align: left;
		cursor: pointer;
	}
	.card-foot:hover {
		background: var(--surface-hover);
	}
	.card-foot .row-label {
		min-width: 0;
		font-size: var(--fs-md);
	}
	.card-foot .row-now {
		flex: none;
		margin-left: auto;
		white-space: nowrap;
	}
	.place-acts {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin-bottom: 1rem;
	}
	.pick-head {
		margin: 0 0.4rem 0 0;
		font-size: var(--fs-lg);
		font-weight: var(--fw-semibold);
	}
	/* ⚓ A guest, at its card's foot, framed in Theorycraft's white (§4.6,
	   §6.3), with its words. */
	.guest-main {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.2rem 0.7rem;
		width: 100%;
		padding: 0.4rem 0.8rem;
		border: none;
		border-top: 1px solid var(--line-faint);
		box-shadow: inset 2px 0 0 var(--profile-theorycraft);
		border-radius: 0 0 var(--r-sm) var(--r-sm);
		background: none;
		color: var(--text);
		font: inherit;
		font-size: var(--fs-sm);
		text-align: left;
		cursor: pointer;
	}
	.guest-main:hover {
		background: var(--surface-hover);
	}
	.guest-main.is-current {
		box-shadow:
			inset 2px 0 0 var(--profile-theorycraft),
			inset 0 0 0 1px var(--profile-theorycraft);
	}
	.guest-tag {
		font-weight: var(--fw-semibold);
		color: var(--profile-theorycraft);
	}
	.guest-levels {
		color: var(--muted);
	}
	.row-flag--guest {
		color: var(--text);
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
	/* ── THE GRID (2026-10-25, the full-screen round) ──────────────────────
	   Rotations and lineups are both cards in one grid that fills the width:
	   reopening one means recognising it, and its portraits and name already
	   say who it is (⚓ Nate: no preview pane). */
	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
		gap: 0.6rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.card {
		position: relative;
		display: flex;
		flex-direction: column;
		border-radius: var(--r-sm);
		background: var(--surface-raised);
		transition: background var(--t-snap);
	}
	.card:hover {
		background: var(--surface-hover);
	}
	/* ⚓ The current ring is drawn ABOVE everything in the box (Nate
	   2026-10-25): as an inset shadow it sat under the floating verbs'
	   ground, which cut it. A pseudo-element after the box's children paints
	   over them and takes no clicks. */
	.card.is-current::after,
	.row-line.is-current::after,
	.card-foot.is-current::after {
		content: '';
		position: absolute;
		inset: 0;
		z-index: 1;
		border-radius: inherit;
		box-shadow: inset 0 0 0 1px var(--sel-ring);
		pointer-events: none;
	}
	.card-top {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}
	/* ── A rotation ROW (↻ 2026-10-25: rows again, Nate) ── */
	.rows {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.row {
		display: flex;
		flex-direction: column;
		border-radius: var(--r-sm);
		background: var(--surface-raised);
		transition: background var(--t-snap);
	}
	/* The hover and the current ring belong to a LINE, so a pair's two sides
	   answer separately. */
	.row-line {
		position: relative;
		display: flex;
		align-items: center;
		border-radius: var(--r-sm);
		transition: background var(--t-snap);
	}
	.row-line:hover {
		background: var(--surface-hover);
	}
	/* B rides under A: one rule between them, the pair one object. */
	.row-line--b {
		border-top: 1px solid var(--line-faint);
		border-radius: 0 0 var(--r-sm) var(--r-sm);
	}
	.is-pair > .row-line:first-child {
		border-radius: var(--r-sm) var(--r-sm) 0 0;
	}
	.pair-tag {
		flex: none;
		display: grid;
		place-items: center;
		width: 1.3rem;
		height: 1.3rem;
		border-radius: var(--r-sm);
		box-shadow: inset 0 0 0 1px var(--line-strong);
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		color: var(--muted);
	}
	.row-main {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.55rem 0.8rem;
		border: none;
		background: none;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.row-text {
		flex: 0 1 auto;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		min-width: 0;
		width: 18rem;
	}
	/* The notation's opening, filling the row's middle: the part that differs
	   between rotations of the same four. Gone where the row is too narrow to
	   give it room worth reading. */
	.row-notation {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-family: var(--font-mono);
		font-size: var(--fs-sm);
		color: var(--muted);
	}
	@container library (max-width: 40rem) {
		.row-notation {
			display: none;
		}
	}
	/* A row's verbs sit in the row, not over it. */
	.row .row-acts {
		position: static;
		margin-right: 0.5rem;
		background: none;
	}
	.row .row-more {
		position: static;
		margin-right: 0.35rem;
	}
	.row-line:hover .row-acts,
	.row-line:has(:focus-visible) .row-acts {
		opacity: 1;
	}
	/* In a narrow column the verbs FLOAT over the row's end on the hovered
	   ground, as they did on the cards, instead of holding ~100px of the
	   name's room while invisible. */
	@container library (max-width: 30rem) {
		.row .row-acts {
			/* The FULL height of the line, and a soft leading edge: the name
			   fades out under the verbs rather than peeking above or beside
			   them (Nate: a box of the buttons' own height let the name show
			   over it). Plain stops, no color-mix (the WebKit nesting law). */
			position: absolute;
			inset-block: 0;
			right: 0;
			align-items: center;
			margin: 0;
			padding: 0 0.4rem 0 1.5rem;
			border-radius: 0 var(--r-sm) var(--r-sm) 0;
			background: linear-gradient(to right, transparent, var(--surface-hover) 1.25rem);
		}
	}

	.card-main {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.45rem;
		padding: 0.7rem 0.8rem;
		border: none;
		background: none;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.card-head {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		min-width: 0;
		max-width: 100%;
	}
	.card-pin {
		flex: none;
		display: inline-flex;
		color: var(--accent);
	}
	.card-teams {
		display: flex;
		flex-direction: column;
		gap: 4px;
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
		flex-wrap: wrap;
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

	/* Side portraits stand a little apart: their art overhangs the disc
	   sideways (a ponytail), so they never overlap the way discs could. */
	.portraits {
		display: inline-flex;
		flex: none;
		gap: 2px;
	}

	/* ── The card's verbs: over its top-right corner on hover or focus ── */
	.row-acts {
		position: absolute;
		top: 0.4rem;
		right: 0.4rem;
		display: flex;
		gap: 2px;
		border-radius: var(--r-sm);
		/* The hovered card's own ground, so a long name runs UNDER the verbs
		   rather than through them. */
		background: var(--surface-hover);
		opacity: 0;
		transition: opacity var(--t-snap);
	}
	/* 🐛 KEYBOARD focus keeps them, ⛔ not any focus (Nate 2026-10-25): with
	   `:focus-within`, a clicked Pin kept its focus and held the verbs up
	   after the cursor left, until a click elsewhere. Rotations only escaped
	   it because pinning MOVES the row, and the remount dropped the focus. */
	.card:hover .row-acts,
	.card:has(:focus-visible) .row-acts,
	.row-acts:has(.is-armed) {
		opacity: 1;
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
		cursor: pointer;
		transition:
			background var(--t-snap),
			color var(--t-snap);
	}
	.row-act:hover {
		background: var(--surface-raised);
		color: var(--text);
	}
	.row-act.is-on {
		color: var(--accent);
	}
	.row-act--danger:hover,
	.row-act.is-armed {
		color: var(--ui-danger);
	}
	.row-more {
		display: none;
	}
	/* Touch: no hover to reveal them, so the verbs are a ⋯ in the corner. */
	@media (hover: none) {
		.row-acts {
			display: none;
		}
		.row-more {
			display: block;
			position: absolute;
			top: 0.35rem;
			right: 0.35rem;
		}
		.card-main {
			padding-right: 2.6rem;
		}
	}
	.row-menu-danger {
		color: var(--ui-danger);
	}
	/* New lineup's menu: the shape's name, then what it starts with. */
	.preset-label {
		font-weight: var(--fw-semibold);
		flex-shrink: 0;
		min-width: 9rem;
	}
	.preset-hint {
		font-size: var(--fs-sm);
		color: var(--muted);
	}
</style>
