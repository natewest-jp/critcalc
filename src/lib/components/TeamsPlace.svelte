<!--
  TEAMS (profiles and surfaces design §3, §6.2; build plan §13, phase 3): a
  Party Setup grid of the profile's named teams, four portraits each in party
  order. ⚓ Teams are curated, never filed into: Teams is where you build
  presets and START new work from them.

  ⚓ Nate 2026-10-23: New team adds a card with four empty slots, and a slot
  opens the character grid HERE, in the menu state. Plan a rotation always
  opens a new rotation (the four resting, an empty notation, §8.1); Add to a
  lineup puts the team in the current lineup's first empty team, never over
  one. A card links to its work without containing it ("2 rotations ·
  1 lineup"), each a link into the Library narrowed to that team.

  ⚓ One team per SET of four (§3): a set that is already a team is refused,
  and says which team holds it. Strings are working copy.
-->
<script lang="ts">
	import { tick } from 'svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Mark from './Mark.svelte';
	import { menu } from '$lib/menuState.svelte';
	import { storageSession } from '$lib/storage/session.svelte';
	import { documentsReady } from '$lib/storage/arrivals';
	import { rotationLabel } from '$lib/storage/convert';
	import type { DocumentRecord, TeamRecord } from '$lib/storage/records';
	import { documentBar } from '$lib/documentBar.svelte';
	import { getAllCharacterIndex, getCharacterIndexEntry } from '$lib/data/characterLookup';
	import { elementIcon } from '$lib/data/elementIcons.generated';
	import { getAvatar } from '$lib/utils/getAvatar';
	import { teamKey, TEAM_SIZE } from '$lib/utils/notationEdit';
	import { ownership, siteSettings } from '$lib/stores';

	const twin = $derived(storageSession.profile?.twin ?? 'aether');
	const avatar = (id: string) => getAvatar(id, $siteSettings.useNewOutfits, 'circle', twin);
	const nameOf = (id: string) => getCharacterIndexEntry(id)?.displayName ?? id;
	/** ⚓ An unnamed team shows its members, as an unnamed document does (§4.2). */
	const label = (t: Pick<TeamRecord, 'name' | 'slots'>) => t.name || rotationLabel(t.slots);

	// ── The profile's teams, and the work made from each ────────────────────
	let teams = $state<TeamRecord[]>([]);
	let loaded = $state(false);
	$effect(() => {
		void storageSession.teamsVersion;
		void storageSession.profile?.id;
		void storageSession.teams().then((list) => {
			teams = list;
			loaded = true;
		});
	});

	/** Rotations and lineups per team key. A lineup counts once, however many
	 *  of its teams are the set. */
	let counts = $state<Record<string, { rotations: number; lineups: number }>>({});
	$effect(() => {
		void storageSession.version;
		void storageSession.profile?.id;
		void Promise.all([
			storageSession.documents('rotation'),
			storageSession.documents('lineup')
		]).then(([rots, lineups]) => {
			const m: Record<string, { rotations: number; lineups: number }> = {};
			const bump = (key: string, kind: 'rotations' | 'lineups') => {
				if (!key) return;
				const c = (m[key] ??= { rotations: 0, lineups: 0 });
				c[kind]++;
			};
			for (const d of rots as DocumentRecord[])
				if (d.type === 'rotation') bump(teamKey(d.body.slots), 'rotations');
			for (const d of lineups as DocumentRecord[]) {
				if (d.type !== 'lineup') continue;
				for (const k of new Set(d.body.teams.map((t) => teamKey(t.slots)))) bump(k, 'lineups');
			}
			counts = m;
		});
	});

	const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

	function showWork(t: TeamRecord, section: 'rotations' | 'lineups'): void {
		menu.teamFilter = { key: teamKey(t.slots), label: label(t) };
		menu.show(section);
	}

	// ── Starting work from a team ───────────────────────────────────────────

	/** Onto a tool: back onto it if it is underneath, else go to it. */
	function arrive(path: string): void {
		if (page.url.pathname.startsWith(path) && !menu.routed) menu.close();
		else menu.leaveTo(path);
	}

	async function plan(t: TeamRecord): Promise<void> {
		await storageSession.planTeam(t.slots);
		arrive(resolve('/planner'));
	}

	async function addToLineup(t: TeamRecord): Promise<void> {
		const builder = resolve('/builder');
		// The lineup lives in the Builder's memory: off a tool, go there first
		// and wait for the session to load it.
		if (!storageSession.active) {
			menu.leaveTo(builder);
			if (!(await documentsReady)) return;
			await tick();
			place(t);
			return;
		}
		if (place(t)) arrive(builder);
	}

	function place(t: TeamRecord): boolean {
		if (storageSession.addToLineup(t.slots)) return true;
		documentBar.showNotice('The lineup is full');
		return false;
	}

	// ── Rename, in place ────────────────────────────────────────────────────
	let renaming = $state<string | null>(null);
	let draftName = $state('');
	function startRename(t: TeamRecord): void {
		renaming = t.id;
		draftName = t.name;
	}
	async function commitRename(): Promise<void> {
		const id = renaming;
		renaming = null;
		if (id) await storageSession.updateTeam(id, { name: draftName });
	}
	function focusSelect(node: HTMLInputElement): void {
		node.focus();
		node.select();
	}

	// ── Delete, confirmed by a second click ─────────────────────────────────
	let armed = $state<string | null>(null);
	let armTimer: ReturnType<typeof setTimeout> | undefined;
	function del(t: TeamRecord): void {
		if (armed !== t.id) {
			armed = t.id;
			clearTimeout(armTimer);
			armTimer = setTimeout(() => (armed = null), 3000);
			return;
		}
		armed = null;
		void storageSession.deleteTeam(t.id);
	}

	// ── Choosing members: the character grid, here ──────────────────────────
	//
	// One team is edited at a time — a new one (`id` null) or an existing one.
	// A pick fills the chosen slot and moves on to the next empty one; picking
	// someone already on the team takes them off, leaving the slot to fill.

	type Edit = { id: string | null; slots: (string | null)[]; at: number };
	let edit = $state<Edit | null>(null);
	/** Why the edit cannot be kept yet (a set that is another team's). */
	let clash = $state<string | null>(null);

	function startNew(): void {
		edit = { id: null, slots: Array(TEAM_SIZE).fill(null), at: 0 };
		clash = null;
	}
	function startEdit(t: TeamRecord, at: number): void {
		edit = { id: t.id, slots: [...t.slots], at };
		clash = null;
	}

	function pick(id: string): void {
		if (!edit) return;
		clash = null;
		const held = edit.slots.indexOf(id);
		if (held >= 0) {
			edit.slots[held] = null;
			edit.at = held;
			return;
		}
		edit.slots[edit.at] = id;
		const next = edit.slots.findIndex((s, i) => s === null && i !== edit!.at);
		if (next >= 0) edit.at = next;
	}

	const full = $derived(!!edit && edit.slots.every((s) => s !== null));

	async function keep(): Promise<void> {
		if (!edit || !full) return;
		const { id, slots } = edit;
		const other = teams.find((t) => t.id !== id && teamKey(t.slots) === teamKey(slots));
		if (other) {
			clash = `Already a team: ${label(other)}`;
			return;
		}
		if (id) await storageSession.updateTeam(id, { slots });
		else await storageSession.saveTeam(slots);
		edit = null;
	}

	// The grid: search, element, and Owned (once the roster says who is).
	const ALL = getAllCharacterIndex().filter((c) => c.id !== 'blank');
	const ELEMENTS = ['pyro', 'hydro', 'anemo', 'electro', 'dendro', 'cryo', 'geo'] as const;
	let query = $state('');
	let element = $state<string | null>(null);
	const hasOwned = $derived(Object.values($ownership).includes('owned'));
	let ownedOnly = $state(true);
	const shown = $derived.by(() => {
		const q = query.trim().toLowerCase();
		return ALL.filter(
			(c) =>
				(!q || c.displayName.toLowerCase().includes(q)) &&
				(!element || c.element === element) &&
				(!hasOwned || !ownedOnly || $ownership[c.id] === 'owned')
		).sort((a, b) => a.displayName.localeCompare(b.displayName));
	});

	function onPickerKey(e: KeyboardEvent): void {
		if (e.key !== 'Escape') return;
		// Spent here: the menu state does not close under an open picker.
		e.preventDefault();
		edit = null;
	}
</script>

{#snippet slotsOf(t: { id: string | null; slots: readonly (string | null)[] }, editing: boolean)}
	<span class="slots">
		{#each t.slots as id, i (i)}
			<button
				class="slot"
				class:is-at={editing && edit?.at === i}
				aria-label={id ? `Slot ${i + 1}: ${nameOf(id)}` : `Slot ${i + 1}: empty`}
				title={id ? nameOf(id) : 'Choose a character'}
				onclick={() => {
					if (editing && edit) {
						edit.at = i;
					} else {
						const team = teams.find((x) => x.id === t.id);
						if (team) startEdit(team, i);
					}
				}}
			>
				{#if id}<img src={avatar(id)} alt="" />{:else}<Mark name="plus" size={16} />{/if}
				<span class="slot-key" aria-hidden="true">{i + 1}</span>
			</button>
		{/each}
	</span>
{/snippet}

{#if edit}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="picker" onkeydown={onPickerKey}>
		<div class="picker-team">
			{@render slotsOf(edit, true)}
			<div class="picker-acts">
				{#if clash}<span class="clash" role="status">{clash}</span>{/if}
				<button class="btn" onclick={() => (edit = null)}>Cancel</button>
				<button class="btn btn--primary" disabled={!full} onclick={keep}
					>{edit.id ? 'Save team' : 'Add team'}</button
				>
			</div>
		</div>
		<div class="picker-filters">
			<input
				class="search"
				type="search"
				placeholder="Search characters"
				aria-label="Search characters"
				bind:value={query}
			/>
			<span class="elements" role="group" aria-label="Element">
				{#each ELEMENTS as el (el)}
					{@const icon = elementIcon(el)}
					<button
						class="el"
						class:is-on={element === el}
						aria-pressed={element === el}
						aria-label={el}
						title={el[0].toUpperCase() + el.slice(1)}
						onclick={() => (element = element === el ? null : el)}
						>{#if icon}<img src={icon} alt="" />{/if}</button
					>
				{/each}
			</span>
			{#if hasOwned}
				<label class="check"
					><input type="checkbox" bind:checked={ownedOnly} /> <span>Owned</span></label
				>
			{/if}
		</div>
		<ul class="grid">
			{#each shown as c (c.id)}
				{@const at = edit.slots.indexOf(c.id)}
				<li>
					<button class="tile" class:is-in={at >= 0} onclick={() => pick(c.id)}>
						<img src={avatar(c.id)} alt="" />
						{#if at >= 0}<span class="tile-key">{at + 1}</span>{/if}
						<span class="tile-name">{c.displayName}</span>
					</button>
				</li>
			{/each}
		</ul>
		{#if shown.length === 0}<p class="empty">No characters match.</p>{/if}
	</div>
{:else}
	<div class="place">
		<div class="place-acts">
			<button class="btn" onclick={startNew}><Mark name="plus" size={14} /> New team</button>
		</div>

		{#if loaded && teams.length === 0}
			<p class="empty">
				No teams yet. Make one here, or save the team on the Planner's bench as a team.
			</p>
		{/if}

		<ul class="cards">
			{#each teams as t (t.id)}
				{@const c = counts[teamKey(t.slots)]}
				<li class="card">
					<div class="card-head">
						{#if renaming === t.id}
							<input
								class="rename"
								bind:value={draftName}
								placeholder={rotationLabel(t.slots)}
								aria-label="Team name"
								use:focusSelect
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
							<span class="card-label" class:is-derived={!t.name}>{label(t)}</span>
						{/if}
						<span class="card-verbs">
							<button class="verb" aria-label="Rename" title="Rename" onclick={() => startRename(t)}
								><Mark name="edit" size={14} /></button
							>
							<button
								class="verb verb--danger"
								class:is-armed={armed === t.id}
								aria-label={armed === t.id ? 'Delete: click again to confirm' : 'Delete'}
								title={armed === t.id ? 'Click again to delete' : 'Delete'}
								onclick={() => del(t)}
								><Mark
									name={armed === t.id ? 'warn' : 'delete'}
									size={14}
								/>{#if armed === t.id}<span>Delete?</span>{/if}</button
							>
						</span>
					</div>
					{@render slotsOf(t, false)}
					<span class="card-work">
						{#if c?.rotations}<button class="work" onclick={() => showWork(t, 'rotations')}
								>{plural(c.rotations, 'rotation', 'rotations')}</button
							>{/if}
						{#if c?.rotations && c?.lineups}<span aria-hidden="true">·</span>{/if}
						{#if c?.lineups}<button class="work" onclick={() => showWork(t, 'lineups')}
								>{plural(c.lineups, 'lineup', 'lineups')}</button
							>{/if}
						{#if !c}<span>No rotations or lineups yet</span>{/if}
					</span>
					<span class="card-acts">
						<button class="btn btn--primary" onclick={() => plan(t)}>Plan a rotation</button>
						<button class="btn" onclick={() => addToLineup(t)}>Add to a lineup</button>
					</span>
				</li>
			{/each}
		</ul>
	</div>
{/if}

<style>
	.place-acts {
		display: flex;
		gap: 0.4rem;
		margin-bottom: 1rem;
	}
	.empty {
		max-width: 34rem;
		font-size: var(--fs-lg);
		color: var(--muted);
	}

	/* ── The Party Setup grid ── */
	.cards,
	.grid {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(19rem, 1fr));
		gap: 0.6rem;
	}
	.card {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
		padding: 0.8rem 0.9rem 0.9rem;
		border-radius: var(--r-sm);
		background: var(--surface-raised);
		transition: background var(--t-snap);
	}
	.card:hover {
		background: var(--surface-hover);
	}
	.card-head {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		min-width: 0;
	}
	.card-label {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: var(--fs-lg);
		font-weight: var(--fw-semibold);
		color: var(--text);
	}
	/* A derived label is a placeholder: the name is not set (§4.2). */
	.card-label.is-derived {
		font-weight: var(--fw-medium);
		color: var(--muted);
	}
	.rename {
		flex: 1;
		min-width: 0;
		padding: 0.15rem 0.4rem;
		border: 1px solid var(--border);
		border-radius: var(--r-sm);
		background: var(--surface-well);
		color: var(--text);
		font: inherit;
		font-size: var(--fs-lg);
	}

	/* The verbs: quiet at rest, brighter on the card's hover (the Library's). */
	.card-verbs {
		display: flex;
		gap: 2px;
	}
	.verb {
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
	.card:hover .verb,
	.verb:focus-visible,
	.verb.is-armed {
		opacity: 1;
	}
	.verb:hover {
		background: var(--surface-hover);
		color: var(--text);
	}
	.verb--danger:hover,
	.verb.is-armed {
		color: var(--ui-danger);
	}

	/* ── Four slots in party order, the key each sits on ── */
	.slots {
		display: flex;
		gap: 0.5rem;
	}
	.slot {
		position: relative;
		display: grid;
		place-items: center;
		width: 3.75rem;
		height: 3.75rem;
		padding: 0;
		border: none;
		border-radius: 50%;
		background: var(--surface-well);
		box-shadow: inset 0 0 0 1px var(--line-faint);
		color: var(--muted);
		cursor: pointer;
		transition: box-shadow var(--t-snap);
	}
	.slot img {
		width: 100%;
		height: 100%;
		border-radius: 50%;
	}
	.slot:hover {
		box-shadow: inset 0 0 0 1px var(--border);
	}
	.slot.is-at {
		box-shadow: 0 0 0 2px var(--sel-ring);
	}
	.slot-key {
		position: absolute;
		right: -2px;
		bottom: -2px;
		display: grid;
		place-items: center;
		width: 1.1rem;
		height: 1.1rem;
		border-radius: 50%;
		background: var(--surface);
		color: var(--muted);
		font-size: var(--fs-xs);
		font-weight: var(--fw-semibold);
		font-variant-numeric: tabular-nums;
	}

	.card-work {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: var(--fs-sm);
		color: var(--muted);
	}
	.work {
		padding: 0;
		border: none;
		background: none;
		color: var(--text);
		font: inherit;
		text-decoration: underline;
		text-decoration-color: var(--line-faint);
		text-underline-offset: 3px;
		cursor: pointer;
	}
	.work:hover {
		text-decoration-color: currentColor;
	}
	.card-acts {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	/* ── The picker ── */
	.picker {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.picker-team {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.8rem;
	}
	.picker-acts {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}
	.clash {
		font-size: var(--fs-sm);
		color: var(--ui-warning);
	}
	.picker-filters {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.8rem;
	}
	.search {
		width: min(16rem, 100%);
		padding: 0.3rem 0.5rem;
		border: 1px solid var(--border);
		border-radius: var(--r-sm);
		background: var(--surface-well);
		color: var(--text);
		font: inherit;
	}
	.elements {
		display: flex;
		gap: 2px;
	}
	.el {
		display: grid;
		place-items: center;
		width: 1.9rem;
		height: 1.9rem;
		padding: 0;
		border: none;
		border-radius: var(--r-sm);
		background: none;
		opacity: 0.5;
		cursor: pointer;
		transition:
			opacity var(--t-snap),
			background var(--t-snap);
	}
	.el img {
		width: 1.2rem;
		height: 1.2rem;
	}
	.el:hover,
	.el.is-on {
		opacity: 1;
	}
	.el.is-on {
		background: var(--surface-hover);
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(5rem, 1fr));
		gap: 0.4rem;
	}
	.tile {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.3rem;
		width: 100%;
		padding: 0.45rem 0.2rem;
		border: none;
		border-radius: var(--r-sm);
		background: none;
		color: var(--text);
		font: inherit;
		cursor: pointer;
		transition: background var(--t-snap);
	}
	.tile:hover {
		background: var(--surface-hover);
	}
	.tile img {
		width: 3.25rem;
		height: 3.25rem;
		border-radius: 50%;
		background: var(--surface-well);
	}
	.tile.is-in img {
		box-shadow: 0 0 0 2px var(--sel-ring);
	}
	.tile-key {
		position: absolute;
		top: 0.3rem;
		right: calc(50% - 1.9rem);
		display: grid;
		place-items: center;
		width: 1.1rem;
		height: 1.1rem;
		border-radius: 50%;
		background: var(--surface);
		font-size: var(--fs-xs);
		font-weight: var(--fw-semibold);
	}
	.tile-name {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: var(--fs-sm);
	}
</style>
