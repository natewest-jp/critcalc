<!--
  TEAMS (profiles and surfaces design §3, §6.2; build plan §13, phase 3): a
  Party Setup grid of the profile's named teams, four portraits each in party
  order. ⚓ Teams are curated, never filed into: Teams is where you build
  presets and START new work from them.

  ↻ 2026-10-25 (⚓ Nate): a card is a door to the team's DETAILS
  (TeamDetail), where members, name and loadouts are chosen — any click on
  it opens them, a portrait opening on its slot. The card shows each member
  as the Roster draws them, with what they equip as pips on the portrait
  (TeamMemberPortrait); only Delete stays on the card. Plan a rotation always
  opens a new rotation (the four resting, an empty notation, §8.1). A card
  links to its work without containing it ("2 rotations · 1 lineup"), each a
  link into the Library narrowed to that team.

  ⚓ One team per SET of four (§3; kept 2026-10-25): the details say which
  team already holds a set. Strings are working copy.
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import Mark from './Mark.svelte';
	import BandMenu from './BandMenu.svelte';
	import TeamMemberPortrait from './TeamMemberPortrait.svelte';
	import TeamDetail from './TeamDetail.svelte';
	import { BOARD_PRESETS, type BoardPreset } from '$lib/boards.svelte';
	import { menu } from '$lib/menuState.svelte';
	import { storageSession } from '$lib/storage/session.svelte';
	import { rotationLabel } from '$lib/storage/convert';
	import type { DocumentRecord, TeamRecord } from '$lib/storage/records';
	import { getCharacterIndexEntry } from '$lib/data/characterLookup';
	import { getAvatar, hasAvatar } from '$lib/utils/getAvatar';
	import { teamKey } from '$lib/utils/notationEdit';
	import { ownership, siteSettings } from '$lib/stores';

	const twin = $derived(storageSession.profile?.twin ?? 'aether');
	const avatar = (id: string) =>
		hasAvatar(id) ? getAvatar(id, $siteSettings.useNewOutfits, 'circle', twin) : null;
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

	/** ⚓ A NEW lineup of the chosen shape, holding this team (Nate
	 *  2026-10-23); placing a team into an existing lineup is a later design. */
	async function newLineup(t: TeamRecord, preset: BoardPreset): Promise<void> {
		await storageSession.create('builder', preset, t.slots);
		arrive(resolve('/builder'));
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

	// ── Details: a history entry of their own (menu.openTeam) ───────────────
	const detailId = $derived(menu.teamDetail);
	const detailTeam = $derived(
		detailId && detailId !== 'new' ? teams.find((t) => t.id === detailId) : undefined
	);
	/** Details for a team that is gone (deleted in another tab) show the cards. */
	const inDetail = $derived(loaded && (detailId === 'new' || !!detailTeam));
	// …and the entry stops claiming to be details, or the menu state keeps
	// treating it as one (no page head, no ✕) over the cards.
	$effect(() => {
		if (loaded && detailId && !inDetail)
			replaceState('', {
				...page.state,
				teamDetail: undefined,
				teamSlot: undefined,
				teamGuard: undefined
			});
	});

	const hasOwned = $derived(Object.values($ownership).includes('owned'));
	const owned = (id: string) => !hasOwned || $ownership[id] === 'owned';
</script>

{#if inDetail}
	<!-- A profile switch is a fresh draft too (a new team's stays mounted). -->
	{#key `${storageSession.profile?.id}:${detailId}`}
		<TeamDetail
			team={detailTeam ?? null}
			{teams}
			slot={menu.teamSlot}
			{avatar}
			work={detailTeam ? counts[teamKey(detailTeam.slots)] : undefined}
			onPlan={plan}
			onNewLineup={newLineup}
			onShowWork={showWork}
		/>
	{/key}
{:else}
	<div class="place">
		<div class="place-acts">
			<button class="btn place-new" onclick={() => menu.openTeam('new')}
				><Mark name="plus" size={14} /> New team</button
			>
		</div>

		{#if loaded && teams.length === 0}
			<p class="empty">
				No teams yet. Make one here, or use <strong>Save as team</strong> on the Planner’s bench.
			</p>
		{/if}

		<ul class="cards">
			{#each teams as t (t.id)}
				{@const c = counts[teamKey(t.slots)]}
				<li class="card">
					<div class="card-head">
						<!-- The card's door: its name, stretched over the whole card, so
						     any click opens the details and the keyboard has one stop.
						     What else the card holds sits above it. -->
						<button class="card-open" class:is-derived={!t.name} onclick={() => menu.openTeam(t.id)}
							>{label(t)}</button
						>
						<button
							class="verb verb--danger"
							class:is-armed={armed === t.id}
							aria-label={armed === t.id ? 'Delete: click again to confirm' : `Delete ${label(t)}`}
							title={armed === t.id ? 'Click again to delete' : 'Delete'}
							onclick={() => del(t)}
							><Mark name={armed === t.id ? 'warn' : 'delete'} size={14} />{#if armed === t.id}<span
									>Delete?</span
								>{/if}</button
						>
					</div>
					<span class="members">
						{#each t.slots as id, i (i)}
							<button
								class="member"
								tabindex="-1"
								title={id ? nameOf(id) : undefined}
								aria-label={id ? `${nameOf(id)}: open the team on slot ${i + 1}` : `Slot ${i + 1}`}
								onclick={() => menu.openTeam(t.id, i)}
							>
								<TeamMemberPortrait
									src={id ? avatar(id) : null}
									charId={id}
									entry={id ? t.loadout?.[id] : undefined}
									faded={!!id && !owned(id)}
								/>
							</button>
						{/each}
					</span>
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
						<BandMenu label="New lineup" align="start">
							{#snippet items(close)}
								{#each BOARD_PRESETS as p (p.key)}
									<button
										class="band-menu-item"
										role="menuitem"
										onclick={() => {
											close();
											void newLineup(t, p.key);
										}}
									>
										<span class="preset-label">{p.label}</span>
										<span class="preset-hint">{p.hint}</span>
									</button>
								{/each}
							{/snippet}
						</BandMenu>
					</span>
				</li>
			{/each}
		</ul>
	</div>
{/if}

<style>
	/* Scrolls on its own only when the content area hands it a height (a
	   details entry whose team is gone, MenuState's .is-fill). */
	.place {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
	}
	.place-acts {
		display: flex;
		gap: 0.4rem;
		margin-bottom: 1rem;
	}
	/* The place's one verb, a size up (Nate 2026-10-26), as in the Library. */
	.place-new {
		gap: 0.4rem;
		font-size: var(--fs-lg);
	}
	.empty {
		max-width: 34rem;
		font-size: var(--fs-lg);
		color: var(--muted);
	}

	/* ── The Party Setup grid ── */
	.cards {
		display: grid;
		/* `min()`, so one card still fits a 320 screen (288px of content). */
		grid-template-columns: repeat(auto-fill, minmax(min(19rem, 100%), 1fr));
		gap: 0.6rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	/* `--pip-ground` follows the card's own ground, so a member's loadout pips
	   stay cut out of it at rest and on hover. */
	.card {
		--card-ground: var(--surface-raised);
		--pip-ground: var(--card-ground);
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
		padding: 0.8rem 0.9rem 0.9rem;
		border-radius: var(--r-sm);
		background: var(--card-ground);
		transition: background-color var(--t-snap);
	}
	.card:hover {
		--card-ground: var(--surface-hover);
	}
	.card:has(.card-open:focus-visible) {
		box-shadow: inset 0 0 0 1px var(--sel-ring);
	}
	.card-head {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		min-width: 0;
	}
	.card-open {
		flex: 1;
		min-width: 0;
		padding: 0;
		border: none;
		background: none;
		color: var(--text);
		font: inherit;
		font-size: var(--fs-lg);
		font-weight: var(--fw-semibold);
		text-align: left;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		cursor: pointer;
		outline: none;
	}
	.card-open::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
	}
	/* A derived label is a placeholder: the name is not set (§4.2). */
	.card-open.is-derived {
		font-weight: var(--fw-medium);
		color: var(--muted);
	}
	/* Everything the card holds besides its door sits over the stretched hit
	   area and keeps its own click. */
	/* ⚠ The controls themselves, never their rows: a row spans the card, and
	   raising it would take the card's empty space with it. */
	.verb,
	.member,
	.work,
	.card-acts > :global(*) {
		position: relative;
		z-index: 1;
	}

	/* ⚓ Delete follows the Library's verbs (2026-10-25): hidden at rest, shown
	   on the card's hover or a KEYBOARD focus inside it (⛔ not any focus: a
	   clicked verb would hold it up after the cursor left); always there on
	   touch, where it is the card's only verb. */
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
		opacity: 0;
		cursor: pointer;
		transition:
			opacity var(--t-snap),
			background-color var(--t-snap),
			color var(--t-snap);
	}
	.card:hover .verb,
	.card:has(:focus-visible) .verb,
	.verb.is-armed {
		opacity: 1;
	}
	@media (hover: none) {
		.verb {
			opacity: 1;
		}
	}
	/* One rung DOWN: the card is already at --surface-hover when its verbs
	   show, so the same rung would be no change at all. */
	.verb:hover {
		background: var(--surface-raised);
	}
	.verb--danger:hover,
	.verb.is-armed {
		color: var(--ui-danger);
	}

	/* ── Four members in party order ── */
	.members {
		display: flex;
		gap: 0.6rem;
	}
	.member {
		display: block;
		padding: 0;
		border: none;
		border-radius: var(--r-round);
		background: none;
		cursor: pointer;
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
	/* Below compact (40rem — $lib/breakpoints.ts): four portraits in a 320
	   screen's card, so the gaps and the card's own inset give way. */
	@media (max-width: 40rem) {
		.card {
			padding-inline: 0.7rem;
		}
		.members {
			gap: 0.35rem;
		}
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
