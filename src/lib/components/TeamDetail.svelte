<!--
  A TEAM'S DETAILS (⚓ Nate 2026-10-25): where a team is made, changed, and
  given its loadouts — so it is "details", not "edit": a team that is already
  built still comes here to choose weapons and artifact sets. Opened by a
  card (any click on it) or New team, as a history entry over Teams
  (`menu.openTeam`), so Back returns to the cards.

  The Roster's tiles under the Builder's filter strip choose the members;
  the party strip above them holds the four in party order, each with its
  loadout plates, and the team's resonance and faction under it. A pick
  fills the selected slot and moves on to the next empty one; picking
  someone already on the team takes them off, leaving the slot to fill; a
  pick with no slot chosen nudges the party. The page carries no head and no
  ✕ (MenuState `headless`): the name is the title, Done the way out.

  ⚓ One team per SET of four (§3, kept 2026-10-25): a set that is already a
  team is said at once, naming it, and Save waits. Everything is a draft until
  Save: Cancel and Escape drop it, and every other way out asks first
  (below). Strings are working copy.
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { page } from '$app/state';
	import { beforeNavigate, goto, pushState } from '$app/navigation';
	import Mark from './Mark.svelte';
	import BandMenu from './BandMenu.svelte';
	import TeamMemberPortrait from './TeamMemberPortrait.svelte';
	import TeamLoadoutPlates from './TeamLoadoutPlates.svelte';
	import CharacterFilterStrip from './CharacterFilterStrip.svelte';
	import MoreFilters from './MoreFilters.svelte';
	import { BOARD_PRESETS, type BoardPreset } from '$lib/boards.svelte';
	import { menu } from '$lib/menuState.svelte';
	import { notices } from '$lib/notices.svelte';
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
	import { matchesIdentity, type GridFilters, type OwnershipView } from '$lib/characterFilters';
	import { inCategory, type RoleCategory } from '$lib/capabilities/roles';
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
	/** A clash Save found that the list hadn't yet (filed in another tab a
	 *  moment before), held while these four are still the four. */
	let lateClash = $state<TeamRecord | null>(null);
	/** The team these four already are, if it is another one. */
	const clash = $derived(
		full
			? (teams.find((t) => t.id !== start?.id && teamKey(t.slots) === teamKey(slots)) ??
					(lateClash && teamKey(lateClash.slots) === teamKey(slots) ? lateClash : undefined))
			: undefined
	);
	/** A save that didn't land, said where Save is. */
	let saveFailed = $state(false);
	const canSave = $derived(full && dirty && !clash);

	/** A pick with no slot chosen is refused, and the party says so. */
	let nudge = $state(false);
	function pick(id: string): void {
		const held = slots.indexOf(id);
		if (held >= 0) {
			slots[held] = null;
			at = held;
			return;
		}
		if (at < 0) {
			nudge = false;
			requestAnimationFrame(() => (nudge = true));
			return;
		}
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
	/** "Open it": the question names where the discard leads. */
	function openOther(t: TeamRecord): void {
		const go = () => menu.openTeam(t.id);
		if (!hold(go, `Discard your changes and open ${label(t)}?`)) go();
	}
	/** Back over the guard entry too, when there is one. */
	const leave = () => history.go(page.state.teamGuard ? -2 : -1);

	// ── Leaving with unsaved changes ────────────────────────────────────────
	// Every way out asks before it drops the draft. An untouched new team has
	// nothing to lose, though `dirty` (which arms Add team) is true.
	let committed = $state(false);
	const unsaved = $derived(
		!committed && (start ? dirty : !!name.trim() || slots.some((s) => s !== null))
	);
	/** Said to discard: the exit it held runs, and nothing asks again. */
	let released = false;
	/**
	 * Hold an exit while there is something to lose: true means it is held,
	 * and runs once the person says Discard. ↻ A DIALOG (notices §3.4, Nate
	 * 2026-10-26): the question first stood inline at the top right, far
	 * from a click on the sidebar, in the place Cancel and Save had been.
	 */
	function hold(go: () => void, question = 'Discard your changes?'): boolean {
		if (released || !unsaved) return false;
		void notices
			.ask({
				title: question,
				body: `Your changes to ${label({ name: name.trim(), slots })} haven’t been saved.`,
				confirm: 'Discard',
				cancel: 'Keep editing',
				danger: true
			})
			.then((ok) => {
				if (!ok) return;
				released = true;
				go();
			});
		return true;
	}

	// The menu state's exits: a section, Teams, another team, a profile.
	$effect(() => menu.guardLeaving((go) => hold(go)));

	// A real navigation (a tool door, the wordmark, a link). A tab closing
	// is left to the browser.
	beforeNavigate((nav) => {
		const to = nav.to?.url;
		if (nav.willUnload || !to) return;
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- the address SvelteKit was already going to
		if (hold(() => void goto(to))) nav.cancel();
	});

	// Back. The details are a SHALLOW entry and SvelteKit runs no
	// beforeNavigate for a shallow pop, so once there is something to lose a
	// guard entry goes on top: Back pops the guard instead of the details,
	// and the details ask, raising the guard again so a second Back cannot
	// slip through.
	let guardUp = false;
	function pushGuard(): void {
		pushState('', {
			...page.state,
			teamGuard: true,
			menuDepth: (page.state.menuDepth ?? 0) + 1
		});
	}
	$effect(() => {
		if (page.state.teamGuard) {
			guardUp = true;
			return;
		}
		if (!guardUp) {
			if (unsaved) pushGuard();
			return;
		}
		guardUp = false;
		if (untrack(() => hold(leave))) pushGuard();
		else history.back();
	});

	/** The draft kept: the saved team, or null if it could not be. */
	async function commit(): Promise<TeamRecord | null> {
		if (!full || clash) return null;
		if (!dirty && start) return start;
		let saved: TeamRecord | null = null;
		saveFailed = false;
		try {
			if (start) {
				const ok = await storageSession.updateTeam(start.id, draft);
				saved = ok ? { ...start, ...draft } : null;
			} else {
				const r = await storageSession.saveTeam(draft.slots, draft.name, draft.loadout);
				// The set was filed meanwhile: that is a clash, never this draft
				// saved (it would leave with the other team's name and loadouts).
				if (r && !r.created) {
					lateClash = r.team;
					return null;
				}
				saved = r?.team ?? null;
			}
		} catch (err) {
			console.error('[critcalc] team save failed', err);
		}
		if (!saved) {
			saveFailed = true;
			return null;
		}
		// Kept, so the way on (Plan a rotation, New lineup) has nothing to ask.
		committed = true;
		return saved;
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
			// ↻ Escape is an exit like any other: it asks (Nate, 2026-10-26).
			if (!hold(leave)) leave();
			return;
		}
		const t = e.target as HTMLElement | null;
		// A field, or an open popover (More, the loadout panel, New lineup's
		// menu), keeps its own digits.
		if (t?.closest('input, textarea, [contenteditable], [role="dialog"], [role="menu"]')) return;
		if (/^[1-4]$/.test(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey) {
			e.preventDefault();
			at = Number(e.key) - 1;
		}
	}

	// ── The party strip's size: four columns of what the strip is given ─────
	let partyW = $state(0);
	const GAP_PX = 12;
	/** 🎛️ Below this column width a plate's name cuts to a stub ("De…"), so
	 *  the plates go icon-only: 24px icon + ~70px of name + the plate's inset. */
	const PLATE_NAMES_MIN = 112;
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

	// ── The grid: the Roster's tiles, under the Builder's filter strip ─────
	// ↻ 2026-10-25 (Nate): the Roster's filter COLUMN stood beside the party
	// strip, a screen away from the grid it filters; the strip sits on the
	// grid, and hands the party and the grid the width the column took.
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
		search: '',
		factionBuffs: new SvelteSet<string>()
	});
	/** Who the grid offers: your owned characters first, once the roster
	 *  says who they are. */
	const defaultShow = (): OwnershipView => (hasOwned ? 'owned' : 'all');
	let show = $state<OwnershipView>(defaultShow());
	let role = $state<RoleCategory | null>(null);
	const passesShow = (id: string) =>
		show === 'all' ||
		(show === 'owned' && marks[id] === 'owned') ||
		(show === 'wishlist' && marks[id] === 'wishlist');
	const shown = $derived(
		ALL.filter(
			(c) =>
				matchesIdentity(c, filters) &&
				passesShow(c.id) &&
				(!role || inCategory(characterRoles[c.id], role))
		).sort((a, b) => a.displayName.localeCompare(b.displayName))
	);

	/** The Builder's Show toggles: Owned and Wishlist, both off is everyone. */
	const OWN_TOGGLES = [
		{ key: 'owned', mark: 'check', label: 'Owned' },
		{ key: 'wishlist', mark: 'star', label: 'Wishlist' }
	] as const;
	const moreCount = $derived(
		filters.weapons.size +
			filters.rarities.size +
			(filters.region ? 1 : 0) +
			(filters.factionBuffs?.size ?? 0)
	);
	const anyActive = $derived(
		moreCount > 0 ||
			filters.elements.size > 0 ||
			!!filters.search.trim() ||
			role !== null ||
			show !== defaultShow()
	);
	function clearAll(): void {
		filters.elements.clear();
		filters.weapons.clear();
		filters.rarities.clear();
		filters.factionBuffs?.clear();
		filters.region = '';
		filters.search = '';
		role = null;
		show = defaultShow();
	}
</script>

<svelte:document onkeydown={onKey} />

<div class="td">
	<div class="td-main">
		<!-- ↻ The TOP BAR (Nate 2026-10-25): the details carry no page head and
		     no ✕ — the team's name is the title, and Done (or Save / Cancel) is
		     the way out, so there is one close on the screen, not two. Each zone
		     names its own grid column. -->
		<div class="td-top">
			<span class="td-title">
				<!-- A label, so the pencil is part of the field: a click on it edits
				     too. -->
				<label class="td-name-wrap">
					<input
						class="td-name"
						bind:value={name}
						placeholder={full ? rotationLabel(slots) : 'New team'}
						aria-label="Team name"
						size={Math.max(8, (name || (full ? rotationLabel(slots) : 'New team')).length + 1)}
						onkeydown={(e) => {
							if (e.key === 'Enter' && canSave) void save();
						}}
					/>
					<Mark name="edit" size={15} />
				</label>
				{#if start}
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
						{#if start && !work?.rotations && !work?.lineups}<span>No rotations or lineups yet</span
							>{/if}
					</span>
				{/if}
			</span>
			<!-- ↻ One right-hand group (Nate 2026-10-25): the team's verbs, then
			     the way out. -->
			<span class="td-end">
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
							title={armed ? 'Click again to delete' : 'Delete team'}
							><Mark name={armed ? 'warn' : 'delete'} size={13} />
							<span class="td-del-word">{armed ? 'Delete?' : 'Delete team'}</span></button
						>
					{/if}
				</span>
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
			</span>
		</div>

		{#if saveFailed && !clash}
			<p class="td-clash" role="alert">
				<Mark name="warn" size={14} />
				<span>Couldn’t save the team. Try again.</span>
			</p>
		{/if}
		{#if clash}
			<p class="td-clash" role="status">
				<Mark name="warn" size={14} />
				<span>These four are already a team: <strong>{label(clash)}</strong>.</span>
				<button class="td-link" onclick={() => openOther(clash)}>Open it</button>
			</p>
		{/if}

		<!-- ── The party, in order ── -->
		<ol
			class="td-party"
			class:is-nudged={nudge}
			onanimationend={() => (nudge = false)}
			bind:clientWidth={partyW}
			style:--col="{colW}px"
		>
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
					<!-- ↻ The hint line retired (Nate 2026-10-25): the selected empty
					     seat says what to do, and a pick with no seat chosen nudges
					     the party. -->
					<span class="td-member-name" class:is-empty={!id}
						>{id ? nameOf(id) : at === i ? 'Choose a character' : `Slot ${i + 1}`}</span
					>
					{#if id}
						<TeamLoadoutPlates
							charId={id}
							entry={loadout[id] ?? {}}
							onSet={(u) => setLoadout(id, u)}
							iconsOnly={colW < PLATE_NAMES_MIN}
						/>
					{/if}
				</li>
			{/each}
		</ol>

		<!-- What the four make: under the four (Nate 2026-10-25). -->
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

		<!-- The filters sit ON the grid, and the rule under them is where the
		     grid's roll-off ends. -->
		<div class="td-filters">
			<CharacterFilterStrip
				slate
				{filters}
				activeRole={role?.key ?? null}
				onRole={(cat) => (role = role?.key === cat.key ? null : cat)}
				{anyActive}
				onClear={clearAll}
			>
				{#snippet start()}
					<span class="td-search">
						<Mark name="search" size={12} />
						<input
							class="field td-search-field"
							type="text"
							placeholder="Search…"
							aria-label="Search characters"
							bind:value={filters.search}
							autocomplete="off"
							autocorrect="off"
							spellcheck={false}
						/>
					</span>
				{/snippet}
				{#snippet end()}
					{#if hasOwned}
						<span class="segment td-own" role="group" aria-label="Your roster">
							{#each OWN_TOGGLES as t (t.key)}
								{@const on = show === t.key}
								<button
									class="btn btn--icon"
									class:is-active={on}
									aria-pressed={on}
									aria-label={t.label}
									title={on ? 'Show everyone' : t.label}
									onclick={() => (show = on ? 'all' : t.key)}
									><Mark name={t.mark} size={14} /></button
								>
							{/each}
						</span>
					{/if}
					<BandMenu
						size="sm"
						role="dialog"
						mark="filter"
						label="More"
						count={moreCount}
						ariaLabel={moreCount > 0 ? `More filters, ${moreCount} set` : 'More filters'}
					>
						{#snippet items(close)}
							<MoreFilters roster={ALL} {filters} ownershipView={show} {close} />
						{/snippet}
					</BandMenu>
				{/snippet}
			</CharacterFilterStrip>
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
							title={inAt >= 0
								? 'Take off the team'
								: at < 0
									? 'Choose a slot first'
									: slots[at]
										? `Put in slot ${at + 1}, in ${nameOf(slots[at]!)}’s place`
										: `Put in slot ${at + 1}`}
							onclick={() => pick(c.id)}
						>
							<span class="til-head" style:--el={elColor(c.element)}>
								<span class="til-face"
									>{#if src}<img {src} alt="" loading="lazy" />{/if}</span
								>
								{#if c.element}
									<span class="til-corner"><img src={elementIcon(c.element)} alt="" /></span>
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
</div>

<style>
	/* ONE column since the filter strip (2026-10-25): the party and the grid
	   take the width the Roster's filter column took. */
	.td {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}
	.td-main {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}
	/* ── The top bar: the name with the work made from it · the team's verbs
	   and the way out, as ONE right-hand group (Nate 2026-10-25). ⚠ Each zone
	   names its own grid column (the SiteChrome lesson). ── */
	.td-top {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: start;
		gap: 1.5rem;
	}
	/* The name, and beside it the work made from it (Nate 2026-10-26: under
	   it, the line cost a row on a phone, where the verbs already wrap below). */
	.td-title {
		grid-column: 1;
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		column-gap: 0.9rem;
		min-width: 0;
	}
	.td-end {
		grid-column: 2;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: flex-end;
		gap: 0.4rem 1rem;
		padding-top: 0.3rem;
	}
	/* The pencil says the name is a field you can click into. */
	.td-name-wrap {
		display: flex;
		align-items: center;
		gap: 0.15rem;
		min-width: 0;
		color: var(--muted);
		cursor: text;
		transition: color var(--t-snap);
	}
	.td-name-wrap:hover,
	.td-name-wrap:focus-within {
		color: var(--text);
	}
	/* The name is the screen's title, in the title's face. The field fits its text, so the pencil sits beside the name
	   (`field-sizing`); where that isn't supported, `size` stands in and
	   leaves a little air. */
	.td-name {
		field-sizing: content;
		min-width: 4ch;
		max-width: 100%;
		margin-left: -0.5rem;
		padding: 0.15rem 0.5rem;
		border: 1px solid transparent;
		border-radius: var(--r-sm);
		background: none;
		color: var(--text);
		font: inherit;
		text-overflow: ellipsis;
		font-family: var(--font-display);
		font-size: var(--fs-2xl);
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
		align-items: center;
		gap: 0.4rem;
	}
	/* Below toolMin the right-hand group comes apart: Done stays on the
	   name's row, the verbs take the row beneath, so the bar is two rows and
	   never three. The name gives way (an ellipsis) before Done does. */
	@media (max-width: 54rem) {
		.td-top {
			display: flex;
			flex-wrap: wrap;
			align-items: center;
			gap: 0.6rem 1rem;
		}
		.td-title {
			flex: 1 1 0;
		}
		.td-end {
			display: contents;
		}
		.td-acts {
			order: 2;
		}
		.td-go {
			order: 3;
			flex-basis: 100%;
		}
	}
	/* Below compact every control keeps its MARK and drops its WORD
	   (the narrow round's rule): Delete team and More. */
	@media (max-width: 40rem) {
		.td-del-word {
			display: none;
		}
		.td-filters :global(.band-menu-word),
		.td-filters :global(.band-menu-sep) {
			display: none;
		}
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
	/* Centred over the grid (Nate 2026-10-25). */
	.td-party {
		display: flex;
		justify-content: center;
		gap: 12px;
		width: 100%;
		max-width: 46rem;
		margin: 0 auto;
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
	/* Its plates move up a rung with it, or they vanish into the ground
	   (and a plate hovered there goes one rung DOWN, the card-verb rule). */
	.td-member.is-over,
	.td-member.is-lit {
		--plate-ground: var(--surface-hover);
		--plate-hover: var(--surface-raised);
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

	/* Under the four, centred with them. */
	.td-bonuses {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.35rem;
		margin-top: -0.3rem;
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
	/* The strip ON the grid; no rule under it (Nate 2026-10-25): the strip
	   is edge enough, and the grid's roll-off ends at it. */
	.td-filters {
		margin-bottom: -0.9rem;
	}
	/* The Builder's search field (builder .tb-search), sized to the strip
	   (Nate 2026-10-25): its 30px bars, and the strip's small type rather
	   than the band's --fs-xl. The mark is painted over the field, which
	   keeps its own stroke and ring. */
	/* ⚠ A wrapping line breaks on the flex BASIS before anything shrinks, so
	   the basis is small and the field GROWS into what the line has left:
	   at 12rem fixed, More wrapped alone at 760 and at 1024. */
	.td-search {
		position: relative;
		flex: 1 1 8rem;
		max-width: 13rem;
		min-width: 7rem;
		display: flex;
		align-items: center;
	}
	.td-search :global(.mark) {
		position: absolute;
		left: 0.55rem;
		color: var(--muted);
		pointer-events: none;
	}
	.td-search-field {
		width: 100%;
		height: 30px;
		padding-block: 0;
		padding-left: calc(0.55rem + 12px + 0.35rem);
		font-size: var(--fs-sm);
	}
	/* Owned and Wishlist: the Builder's two icon toggles. */
	.td-own > .btn {
		height: 26px;
		min-width: 28px;
	}
	/* A pick with no seat chosen (the shared refusal, app.css). */
	.td-party.is-nudged {
		animation: nudge 120ms 2;
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
		padding: 0.9rem 6px 1.25rem 4px;
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
	/* ⚓ On the team (Nate 2026-10-25): the house SELECTED state, on the
	   tile — a ground that stays, and a gold ring round the tile's box
	   (hover is the same ground with no ring; /styleguide: density separates
	   resting from engaged, hue separates the two engaged states). The
	   portrait keeps its own ring. Lit from the party strip: one rung up. */
	.til-card.is-in {
		background: var(--surface-raised);
		box-shadow: inset 0 0 0 1.5px var(--sel-ring);
	}
	.til-card.is-in:hover,
	.til-card.is-lit {
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
