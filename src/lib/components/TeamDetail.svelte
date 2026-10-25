<!--
  A TEAM'S DETAILS (⚓ Nate 2026-10-25): where a team is made, changed, and
  given its loadouts — so it is "details", not "edit": a team that is already
  built still comes here to choose weapons and artifact sets. Opened by a
  card (any click on it) or New team, as a history entry over Teams
  (`menu.openTeam`), so Back returns to the cards.

  The Roster's grid and filter column choose the members; the party strip
  above it holds the four in party order, each with its loadout plates. A
  pick fills the selected slot and moves on to the next empty one; picking
  someone already on the team takes them off, leaving the slot to fill.

  ⚓ One team per SET of four (§3, kept 2026-10-25): a set that is already a
  team is said at once, naming it, and Save waits. Everything is a draft until
  Save: Cancel and Escape drop it. Strings are working copy.
-->
<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import Mark from './Mark.svelte';
	import BandMenu from './BandMenu.svelte';
	import TeamMemberPortrait from './TeamMemberPortrait.svelte';
	import TeamLoadoutPlates from './TeamLoadoutPlates.svelte';
	import CharacterFilterRail from './CharacterFilterRail.svelte';
	import { BOARD_PRESETS, type BoardPreset } from '$lib/boards.svelte';
	import { menu } from '$lib/menuState.svelte';
	import { storageSession } from '$lib/storage/session.svelte';
	import { rotationLabel } from '$lib/storage/convert';
	import type { TeamRecord } from '$lib/storage/records';
	import {
		compactEntry,
		compactLoadouts,
		membersOnly,
		type Loadouts
	} from '$lib/storage/teamLoadout';
	import { getAllCharacterIndex, getCharacterIndexEntry } from '$lib/data/characterLookup';
	import { characterRoles } from '$lib/data/characterRoles.generated';
	import { elementIcon } from '$lib/data/elementIcons.generated';
	import { matchesIdentity, type GridFilters } from '$lib/characterFilters';
	import { ROLE_CATEGORIES, inCategory, type RoleCategory } from '$lib/capabilities/roles';
	import { positionIcon, functionIcon } from '$lib/utils/roleIcons';
	import { elementColors, elementPalette, type ElementKey } from '$lib/utils/elementColors';
	import { deriveResonances } from '$lib/utils/resonance';
	import { deriveTeamComposition } from '$lib/utils/teamComposition';
	import { teamKey, TEAM_SIZE } from '$lib/utils/notationEdit';
	import { scrollFade } from '$lib/actions/scrollFade';
	import { ownership, type LoadoutEntry } from '$lib/stores';

	let {
		team,
		teams,
		slot = null,
		avatar,
		work,
		onPlan,
		onNewLineup,
		onShowWork
	}: {
		/** The team, or null for one being made. */
		team: TeamRecord | null;
		/** Every team in the profile, for the one-team-per-set check. */
		teams: TeamRecord[];
		/** The slot to open on (a portrait clicked on the card). */
		slot?: number | null;
		avatar: (id: string) => string | null;
		/** What is made from this team, for its links. */
		work?: { rotations: number; lineups: number };
		onPlan: (t: TeamRecord) => void;
		onNewLineup: (t: TeamRecord, preset: BoardPreset) => void;
		onShowWork: (t: TeamRecord, section: 'rotations' | 'lineups') => void;
	} = $props();

	const nameOf = (id: string) => getCharacterIndexEntry(id)?.displayName ?? id;
	const label = (t: Pick<TeamRecord, 'name' | 'slots'>) => t.name || rotationLabel(t.slots);
	const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

	// ── The draft ───────────────────────────────────────────────────────────
	// Read once: the details are keyed on the team by their host, so a
	// different team is a fresh draft.
	// svelte-ignore state_referenced_locally
	const start = team;
	let name = $state(start?.name ?? '');
	let slots = $state<(string | null)[]>(
		start ? [...start.slots] : Array<string | null>(TEAM_SIZE).fill(null)
	);
	let loadout = $state<Loadouts>({ ...(start?.loadout ?? {}) });
	const firstEmpty = () => slots.findIndex((s) => s === null);
	// svelte-ignore state_referenced_locally
	let at = $state(slot ?? firstEmpty());

	const full = $derived(slots.every((s) => s !== null));
	const draft = $derived({
		name: name.trim(),
		slots: [...slots],
		loadout: compactLoadouts(membersOnly(loadout, slots))
	});
	const dirty = $derived(
		!start ||
			JSON.stringify(draft) !==
				JSON.stringify({
					name: start.name,
					slots: start.slots,
					loadout: compactLoadouts(start.loadout ?? {})
				})
	);
	/** The team these four already are, if it is another one. */
	const clash = $derived(
		full ? teams.find((t) => t.id !== start?.id && teamKey(t.slots) === teamKey(slots)) : undefined
	);
	const canSave = $derived(full && dirty && !clash);

	function pick(id: string): void {
		const held = slots.indexOf(id);
		if (held >= 0) {
			slots[held] = null;
			at = held;
			return;
		}
		if (at < 0) return;
		slots[at] = id;
		const next = slots.findIndex((s, i) => s === null && i !== at);
		if (next >= 0) at = next;
	}
	function remove(i: number): void {
		slots[i] = null;
		at = i;
	}
	function setLoadout(id: string, update: Partial<LoadoutEntry>): void {
		loadout[id] = compactEntry({ ...(loadout[id] ?? {}), ...update });
	}

	// ── Reordering: drag a member onto another slot to trade places ─────────
	let dragFrom = $state<number | null>(null);
	let dragOver = $state<number | null>(null);

	// ── The two halves point at each other: a member hovered in the party
	// lights their tile in the grid, and an added tile hovered lights their
	// slot. Whichever was hovered last wins. ─────────────────────────────────
	let litSlot = $state<number | null>(null);
	let litId = $state<string | null>(null);
	const slotLit = (i: number) => litSlot === i || (!!litId && slots[i] === litId);
	const tileLit = (id: string) => litId === id || (litSlot !== null && slots[litSlot] === id);
	function drop(i: number): void {
		const from = dragFrom;
		dragFrom = dragOver = null;
		if (from === null || from === i) return;
		[slots[from], slots[i]] = [slots[i], slots[from]];
		at = i;
	}

	// ── Leaving ─────────────────────────────────────────────────────────────
	const leave = () => history.back();

	/** The draft kept: the saved team, or null if it could not be. */
	async function commit(): Promise<TeamRecord | null> {
		if (!full || clash) return null;
		if (!dirty && start) return start;
		if (start) {
			const ok = await storageSession.updateTeam(start.id, draft);
			return ok ? { ...start, ...draft } : null;
		}
		const r = await storageSession.saveTeam(draft.slots, draft.name, draft.loadout);
		return r?.team ?? null;
	}
	async function save(): Promise<void> {
		if (await commit()) leave();
	}
	async function then(go: (t: TeamRecord) => void): Promise<void> {
		const t = await commit();
		if (t) go(t);
	}

	let armed = $state(false);
	let armTimer: ReturnType<typeof setTimeout> | undefined;
	function del(): void {
		if (!start) return;
		if (!armed) {
			armed = true;
			clearTimeout(armTimer);
			armTimer = setTimeout(() => (armed = false), 3000);
			return;
		}
		void storageSession.deleteTeam(start.id).then(leave);
	}

	/** Escape drops the draft, and 1–4 choose a slot. On the DOCUMENT, so a
	 *  field or a popover that spends the key first (defaultPrevented) keeps
	 *  it, and the menu state's window listener after this one stays shut. */
	function onKey(e: KeyboardEvent): void {
		if (e.defaultPrevented) return;
		if (e.key === 'Escape') {
			e.preventDefault();
			leave();
			return;
		}
		const t = e.target as HTMLElement | null;
		if (t?.closest('input, textarea, [contenteditable]')) return;
		if (/^[1-4]$/.test(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey) {
			e.preventDefault();
			at = Number(e.key) - 1;
		}
	}

	// ── The party strip's size: four columns of what the strip is given ─────
	let partyW = $state(0);
	const GAP_PX = 12;
	const colW = $derived(Math.min(176, (partyW - 3 * GAP_PX) / 4));
	const portrait = $derived(Math.round(Math.max(52, Math.min(96, colW * 0.62))));

	// ── What the team's make-up gives it: resonance and faction ─────────────
	const members = $derived(slots.map((id) => (id ? getCharacterIndexEntry(id) : null)));
	const resonances = $derived(
		deriveResonances(
			members.map((c) => c?.element ?? null),
			{ requireFullParty: false }
		).active
	);
	const comp = $derived(deriveTeamComposition(members));
	const pillColor = (el?: string) => (el ? elementPalette(el).main : 'var(--accent)');

	// ── The grid: the Roster's, with its filter column ──────────────────────
	const ALL = getAllCharacterIndex().filter((c) => c.id !== 'blank');
	const marks = $derived($ownership);
	const hasOwned = $derived(Object.values(marks).includes('owned'));
	const owned = (id: string) => !hasOwned || marks[id] === 'owned';
	const elColor = (el?: string) =>
		(elementColors[(el ?? 'none') as ElementKey] ?? elementColors.none).main;

	const filters: GridFilters = $state({
		elements: new SvelteSet<string>(),
		weapons: new SvelteSet<string>(),
		rarities: new SvelteSet<number>(),
		region: '',
		search: ''
	});
	type Show = 'all' | 'owned' | 'wishlist' | 'unowned';
	// svelte-ignore state_referenced_locally
	let show = $state<Show>(hasOwned ? 'owned' : 'all');
	let role = $state<RoleCategory | null>(null);
	const passesShow = (id: string) =>
		show === 'all' ||
		(show === 'owned' && marks[id] === 'owned') ||
		(show === 'wishlist' && marks[id] === 'wishlist') ||
		(show === 'unowned' && marks[id] !== 'owned');
	const shown = $derived(
		ALL.filter(
			(c) =>
				matchesIdentity(c, filters) &&
				passesShow(c.id) &&
				(!role || inCategory(characterRoles[c.id], role))
		).sort((a, b) => a.displayName.localeCompare(b.displayName))
	);
	const extraActive = $derived(show !== (hasOwned ? 'owned' : 'all') || role !== null);
	let filtersOpen = $state(false);
</script>

<svelte:document onkeydown={onKey} />

<div class="td">
	<div class="td-main">
		<div class="td-head">
			<input
				class="td-name"
				bind:value={name}
				placeholder={full ? rotationLabel(slots) : 'New team'}
				aria-label="Team name"
				onkeydown={(e) => {
					if (e.key === 'Enter' && canSave) void save();
				}}
			/>
			<span class="td-acts">
				{#if dirty}
					<button class="btn" onclick={leave}>Cancel</button>
					<button class="btn btn--primary" disabled={!canSave} onclick={save}
						>{start ? 'Save team' : 'Add team'}</button
					>
				{:else}
					<button class="btn" onclick={leave}>Done</button>
				{/if}
			</span>
		</div>

		{#if clash}
			<p class="td-clash" role="status">
				<Mark name="warn" size={14} />
				<span>These four are already a team: <strong>{label(clash)}</strong>.</span>
				<button class="td-link" onclick={() => menu.openTeam(clash.id)}>Open it</button>
			</p>
		{/if}

		<!-- ── The party, in order ── -->
		<ol class="td-party" bind:clientWidth={partyW} style:--col="{colW}px">
			{#each slots as id, i (i)}
				<li
					class="td-member"
					class:is-over={dragOver === i && dragFrom !== i}
					class:is-lit={!!id && slotLit(i)}
					onpointerenter={() => {
						litId = null;
						litSlot = id ? i : null;
					}}
					onpointerleave={() => {
						if (litSlot === i) litSlot = null;
					}}
					ondragover={(e) => {
						if (dragFrom === null) return;
						e.preventDefault();
						dragOver = i;
					}}
					ondragleave={() => {
						if (dragOver === i) dragOver = null;
					}}
					ondrop={(e) => {
						e.preventDefault();
						drop(i);
					}}
				>
					<span class="td-seat">
						<button
							class="td-slot"
							draggable={!!id}
							aria-pressed={at === i}
							aria-label={id ? `Slot ${i + 1}: ${nameOf(id)}` : `Slot ${i + 1}: empty`}
							title={id ? `${nameOf(id)} (drag to reorder)` : 'Choose a character'}
							onclick={() => (at = i)}
							ondragstart={(e) => {
								dragFrom = i;
								e.dataTransfer?.setData('text/plain', String(i));
							}}
							ondragend={() => (dragFrom = dragOver = null)}
						>
							<TeamMemberPortrait
								src={id ? avatar(id) : null}
								charId={id}
								size={portrait}
								faded={!!id && !owned(id)}
								selected={at === i}
							/>
						</button>
						{#if id}
							<button
								class="td-x"
								aria-label="Take {nameOf(id)} off the team"
								title="Take off the team"
								onclick={() => remove(i)}><Mark name="close" size={11} /></button
							>
						{/if}
					</span>
					<span class="td-member-name" class:is-empty={!id}
						>{id ? nameOf(id) : `Slot ${i + 1}`}</span
					>
					{#if id}
						<TeamLoadoutPlates
							charId={id}
							entry={loadout[id] ?? {}}
							onSet={(u) => setLoadout(id, u)}
						/>
					{/if}
				</li>
			{/each}
		</ol>

		<!-- ── What the four make, and what to do with them ── -->
		<div class="td-foot">
			{#if resonances.length || comp.hasAscendantGleam || comp.hasSecretRite}
				<span class="td-bonuses" aria-label="Team bonuses">
					{#each resonances as res (res.key)}
						<span class="td-res" style:--pill-color={pillColor(res.element)} title={res.effect}>
							{#if res.element}<img src={elementIcon(res.element)} alt="" />{/if}
							{res.label}
						</span>
					{/each}
					{#if comp.hasAscendantGleam}
						<span class="td-res td-res--faction">Moonsign: Ascendant Gleam</span>
					{/if}
					{#if comp.hasSecretRite}
						<span class="td-res td-res--faction">Hexerei: Secret Rite</span>
					{/if}
				</span>
			{/if}
			<span class="td-work">
				{#if start && work?.rotations}<button
						class="td-link"
						onclick={() => onShowWork(start, 'rotations')}
						>{plural(work.rotations, 'rotation', 'rotations')}</button
					>{/if}
				{#if start && work?.rotations && work?.lineups}<span aria-hidden="true">·</span>{/if}
				{#if start && work?.lineups}<button
						class="td-link"
						onclick={() => onShowWork(start, 'lineups')}
						>{plural(work.lineups, 'lineup', 'lineups')}</button
					>{/if}
			</span>
			<span class="td-go">
				<button class="btn btn--sm" disabled={!full || !!clash} onclick={() => then(onPlan)}
					>Plan a rotation</button
				>
				<BandMenu label="New lineup" align="end" size="sm" disabled={!full || !!clash}>
					{#snippet items(close)}
						{#each BOARD_PRESETS as p (p.key)}
							<button
								class="band-menu-item"
								role="menuitem"
								onclick={() => {
									close();
									void then((t) => onNewLineup(t, p.key));
								}}
							>
								<span class="preset-label">{p.label}</span>
								<span class="preset-hint">{p.hint}</span>
							</button>
						{/each}
					{/snippet}
				</BandMenu>
				{#if start}
					<button
						class="btn btn--sm td-del"
						class:is-armed={armed}
						onclick={del}
						title={armed ? 'Click again to delete' : undefined}
						><Mark name={armed ? 'warn' : 'delete'} size={13} />
						{armed ? 'Delete?' : 'Delete team'}</button
					>
				{/if}
			</span>
		</div>

		<div class="td-bar">
			<p class="td-hint">
				{#if at < 0}
					Choose a slot to change, then a character.
				{:else if slots[at]}
					Choose who takes {nameOf(slots[at]!)}’s place in slot {at + 1}.
				{:else}
					Choose a character for slot {at + 1}.
				{/if}
			</p>
			<button class="btn btn--sm td-filters-btn" onclick={() => (filtersOpen = true)}
				><Mark name="filter" size={13} /> Filters</button
			>
		</div>

		<div class="td-scroll scroll-fade" use:scrollFade>
			<ul class="til">
				{#each shown as c (c.id)}
					{@const inAt = slots.indexOf(c.id)}
					{@const src = avatar(c.id)}
					<li>
						<button
							class="til-card"
							class:is-in={inAt >= 0}
							class:is-lit={inAt >= 0 && tileLit(c.id)}
							class:is-owned={owned(c.id)}
							onpointerenter={() => {
								litSlot = null;
								litId = inAt >= 0 ? c.id : null;
							}}
							onpointerleave={() => {
								if (litId === c.id) litId = null;
							}}
							aria-pressed={inAt >= 0}
							title={inAt >= 0 ? 'Take off the team' : undefined}
							onclick={() => pick(c.id)}
						>
							<span class="til-head" style:--el={elColor(c.element)}>
								<span class="til-face"
									>{#if src}<img {src} alt="" loading="lazy" />{/if}</span
								>
								{#if c.element}
									<span class="til-corner"><img src={elementIcon(c.element)} alt="" /></span>
								{/if}
								{#if inAt >= 0}
									<span class="til-slot" aria-label="Slot {inAt + 1}">{inAt + 1}</span>
								{/if}
							</span>
							<span class="til-name">{c.displayName}</span>
						</button>
					</li>
				{/each}
			</ul>
			{#if !shown.length}<p class="td-hint">No character matches.</p>{/if}
		</div>
	</div>

	<div class="td-side" class:is-open={filtersOpen}>
		<div class="td-sheet-head">
			<p class="td-count">{shown.length} of {ALL.length} characters</p>
			<button class="btn btn--sm" onclick={() => (filtersOpen = false)}>Done</button>
		</div>
		<CharacterFilterRail
			roster={ALL}
			{filters}
			extraFiltersActive={extraActive}
			onClearExtras={() => {
				show = hasOwned ? 'owned' : 'all';
				role = null;
			}}
			searchPlaceholder="Search characters"
		>
			{#snippet railStart()}
				{#if hasOwned}
					<div class="side-sec">
						<p class="kicker">Show</p>
						<div class="segment side-seg">
							{#each [['owned', 'Owned'], ['all', 'All'], ['wishlist', 'Wishlist'], ['unowned', 'Not owned']] as const as [k, text] (k)}
								<button class="btn btn--sm" class:is-active={show === k} onclick={() => (show = k)}
									>{text}</button
								>
							{/each}
						</div>
					</div>
				{/if}
				<div class="side-sec">
					<p class="kicker">Role</p>
					<div class="chips">
						{#each ROLE_CATEGORIES as cat (cat.key)}
							<button
								class="chip side-role"
								class:active={role?.key === cat.key}
								aria-pressed={role?.key === cat.key}
								onclick={() => (role = role?.key === cat.key ? null : cat)}
							>
								{#if cat.position}<img src={positionIcon(cat.position, 'color')} alt="" />{/if}
								<img src={functionIcon(cat.function, 'color')} alt="" />
								{cat.label}
							</button>
						{/each}
					</div>
				</div>
			{/snippet}
		</CharacterFilterRail>
	</div>
</div>

<style>
	/* The Roster's two columns (RosterTab .ros): the work, and the filters. */
	.td {
		position: relative;
		flex: 1;
		min-height: 0;
		display: grid;
		grid-template-columns: minmax(0, 1fr) 18rem;
		gap: 1.5rem;
	}
	.td-main {
		min-height: 0;
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}
	.td-side {
		min-height: 0;
		display: flex;
		flex-direction: column;
		padding-bottom: 1rem;
	}
	.td-sheet-head,
	.td-filters-btn {
		display: none;
	}

	/* ── Head: the name, and keeping or dropping the draft ── */
	.td-head {
		display: flex;
		align-items: center;
		gap: 0.8rem;
	}
	.td-name {
		flex: 1;
		min-width: 0;
		max-width: 28rem;
		padding: 0.3rem 0.5rem;
		border: 1px solid transparent;
		border-radius: var(--r-sm);
		background: none;
		color: var(--text);
		font: inherit;
		font-size: var(--fs-xl);
		font-weight: var(--fw-semibold);
		transition:
			border-color var(--t-snap),
			background-color var(--t-snap);
	}
	.td-name::placeholder {
		color: var(--muted);
		font-weight: var(--fw-medium);
	}
	.td-name:hover {
		border-color: var(--border);
	}
	.td-name:focus {
		border-color: var(--border);
		background: var(--surface-well);
		outline: none;
	}
	.td-acts {
		display: flex;
		gap: 0.4rem;
		margin-left: auto;
	}
	.td-clash {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
		margin: 0;
		color: var(--ui-warning);
		font-size: var(--fs-sm);
	}
	.td-clash strong {
		color: var(--text);
		font-weight: var(--fw-semibold);
	}
	.td-link {
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
	.td-link:hover {
		text-decoration-color: currentColor;
	}

	/* ── The party strip ── */
	.td-party {
		display: flex;
		gap: 12px;
		max-width: 46rem;
		margin: 0;
		padding: 4px 0 0;
		list-style: none;
	}
	.td-member {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.45rem;
		width: var(--col);
		padding: 0.5rem 0.4rem 0.4rem;
		border-radius: var(--r-md);
		transition: background-color var(--t-snap);
	}
	.td-member.is-over,
	.td-member.is-lit {
		background: var(--surface-raised);
	}
	.td-seat {
		position: relative;
		--pip-ground: var(--surface);
	}
	.td-member.is-over .td-seat,
	.td-member.is-lit .td-seat {
		--pip-ground: var(--surface-raised);
	}
	.td-slot {
		display: block;
		padding: 0;
		border: none;
		border-radius: var(--r-round);
		background: none;
		cursor: pointer;
	}
	.td-slot[draggable='true'] {
		cursor: grab;
	}
	.td-slot:focus-visible {
		outline: 2px solid var(--sel-ring);
		outline-offset: 4px;
	}
	/* The Roster's corner disc (RosterTab .til-corner), top right, on hover. */
	.td-x {
		position: absolute;
		top: -1px;
		right: -1px;
		display: grid;
		place-items: center;
		width: 20px;
		height: 20px;
		padding: 0;
		border: none;
		border-radius: var(--r-round);
		background-color: transparent;
		color: transparent;
		cursor: pointer;
		visibility: hidden;
		transition:
			background-color var(--t-snap),
			color var(--t-snap),
			visibility var(--t-snap);
	}
	.td-member:hover .td-x,
	.td-x:focus-visible {
		visibility: visible;
		background-color: var(--surface);
		color: var(--muted);
	}
	.td-member:hover .td-x:hover {
		color: var(--text);
	}
	@media (hover: none) {
		.td-x {
			visibility: visible;
			background-color: var(--surface);
			color: var(--muted);
		}
	}
	.td-member-name {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--text);
		font-size: var(--fs-md);
		font-weight: var(--fw-medium);
	}
	.td-member-name.is-empty {
		color: var(--muted);
		font-weight: var(--fw-normal);
	}

	/* ── Foot: bonuses, the work made from it, starting more ── */
	.td-foot {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.6rem 1rem;
		max-width: 46rem;
	}
	.td-bonuses {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}
	/* The planner's resonance chip (TeamBonusesBlock .res-badge). */
	.td-res {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 3px 8px 3px 5px;
		border-radius: var(--r-sm);
		background: color-mix(in srgb, var(--pill-color) 22%, transparent);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--pill-color) 45%, transparent);
		color: var(--text);
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		cursor: help;
	}
	.td-res:not(:has(img)) {
		padding-left: 8px;
	}
	.td-res img {
		width: 15px;
		height: 15px;
	}
	.td-res--faction {
		background: var(--surface-raised);
		box-shadow: none;
		cursor: default;
	}
	.td-work {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		color: var(--muted);
		font-size: var(--fs-sm);
	}
	.td-go {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-left: auto;
	}
	.td-del.is-armed,
	.td-del:hover {
		color: var(--ui-danger);
	}
	.preset-label {
		flex-shrink: 0;
		min-width: 9rem;
		font-weight: var(--fw-semibold);
	}
	.preset-hint {
		color: var(--muted);
		font-size: var(--fs-sm);
	}

	/* ── The grid ── */
	.td-bar {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-top: 0.3rem;
		padding-top: 0.8rem;
		border-top: 1px solid var(--line-faint);
	}
	.td-hint {
		margin: 0;
		color: var(--muted);
		font-size: var(--fs-sm);
	}
	.td-scroll {
		--scroll-fade: 28px;
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 4px 6px 1.25rem 4px;
	}
	/* The Roster's tiles (RosterTab .til), as buttons. */
	.til {
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
		gap: 0.9rem 0.6rem;
	}
	.til-card {
		width: 100%;
		display: grid;
		justify-items: center;
		align-content: start;
		gap: 5px;
		padding: 8px 4px 7px;
		border: none;
		border-radius: var(--r-md);
		background: none;
		color: inherit;
		font: inherit;
		cursor: pointer;
		transition: background-color var(--t-snap);
	}
	.til-card:hover {
		background: var(--surface-hover);
	}
	.til-card:focus-visible {
		outline: none;
		box-shadow: inset 0 0 0 1px var(--sel-ring);
	}
	.til-head {
		position: relative;
		width: 76px;
		height: 76px;
	}
	.til-face {
		display: block;
		width: 100%;
		height: 100%;
		border-radius: var(--r-round);
		background: color-mix(in srgb, var(--el) 28%, var(--surface-well));
		transition: box-shadow var(--t-snap);
	}
	.til-face > img {
		display: block;
		width: 100%;
		height: 100%;
		border-radius: var(--r-round);
		object-fit: cover;
		filter: var(--portrait-unowned);
	}
	.is-owned .til-face {
		box-shadow: 0 0 0 2px var(--el);
	}
	.is-owned .til-face > img {
		filter: none;
	}
	/* ⚓ On the team (Nate 2026-10-25): a gold ring with a soft gold glow,
	   whoever owns them, so the four stand out of a grid of element rings.
	   ⚠ The glow mixes from --accent, never --sel-ring: that is a color-mix
	   already, and a color-mix fed by a color-mix crashes WebKit. */
	.is-in .til-face {
		box-shadow:
			0 0 0 2px var(--accent),
			0 0 14px 3px color-mix(in srgb, var(--accent) 35%, transparent);
	}
	/* Their slot lit from the party strip: the tile's own hover ground. */
	.til-card.is-lit {
		background: var(--surface-hover);
	}
	/* Which slot they are in: the pips' cutout disc, at the bottom right. */
	.til-slot {
		position: absolute;
		right: -2px;
		bottom: -2px;
		display: grid;
		place-items: center;
		width: 22px;
		height: 22px;
		border-radius: var(--r-round);
		background: var(--surface);
		color: var(--accent);
		font-size: var(--fs-sm);
		font-weight: var(--fw-bold);
		font-variant-numeric: tabular-nums;
		line-height: var(--lh-none);
		transition: background-color var(--t-snap);
	}
	.til-card:hover .til-slot,
	.til-card.is-lit .til-slot {
		background: var(--surface-hover);
	}
	.til-corner {
		position: absolute;
		top: -1px;
		left: -1px;
		display: grid;
		place-items: center;
		width: 18px;
		height: 18px;
		border-radius: var(--r-round);
		background: var(--surface);
	}
	.til-corner > img {
		width: 16px;
		height: 16px;
	}
	.til-name {
		max-width: 100%;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		color: var(--muted);
		font-size: var(--fs-sm);
	}
	.is-owned .til-name,
	.is-in .til-name {
		color: var(--text);
	}

	/* The Roster's rail sections (RosterTab .side-*). */
	.side-sec {
		display: grid;
		gap: 0.4rem;
	}
	.side-sec .kicker {
		margin: 0;
	}
	.side-seg {
		display: flex;
	}
	.side-seg > .btn {
		flex: 1;
		height: 26px;
		padding: 0 0.4rem;
	}
	.side-role {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		text-transform: none;
	}
	.side-role img {
		width: 14px;
		height: 14px;
		object-fit: contain;
	}
	.td-count {
		margin: 0;
		color: var(--muted);
		font-size: var(--fs-sm);
	}

	/* ── Below toolMin (54rem — $lib/breakpoints.ts): the filters are a SHEET
	   over the grid, as the Roster's are. ── */
	@media (max-width: 54rem) {
		.td {
			display: flex;
			flex-direction: column;
		}
		.td-main {
			flex: 1;
		}
		.td-filters-btn {
			display: inline-flex;
			margin-left: auto;
		}
		.td-side {
			display: none;
		}
		.td-side.is-open {
			position: absolute;
			inset: 0;
			z-index: 4;
			display: flex;
			padding-bottom: 0.75rem;
			background: var(--surface);
		}
		.td-sheet-head {
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 0 6px 8px;
		}
	}
	/* ── Below compact (40rem): three tiles at 320, as the Roster's. ── */
	@media (max-width: 40rem) {
		.td-member {
			padding-inline: 0;
		}
		.til {
			grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
			gap: 0.75rem 0.25rem;
		}
	}
</style>
