<script lang="ts">
	/**
	 * THE LIBRARY — three layouts to choose between (lineups design §10.1, build
	 * step 4; Nate 2026-10-08). A DEMO: fixture data, no store, inert actions.
	 *
	 *   A · Shelf          teams on the left; boards + recently closed beside them.
	 *   B · Index + detail a compact list of everything; the selection opens wide.
	 *   C · Gallery        boards as a strip, teams as cards, recently closed folded.
	 *
	 * Rulings it follows: a team is a real names-only entry and the heading IS
	 * that entry (never a rotation row); headings show portraits (smaller than
	 * the board's) + composition chips + nickname + count + date, ⛔ no
	 * fingerprint; portrait order = the newest entry's; sorted by last touched;
	 * a character filter (AND) and a search; Sync badges and constellation chips
	 * only once the roster has content.
	 */
	import Mark from '$lib/components/Mark.svelte';
	import SidePortrait from '$lib/components/SidePortrait.svelte';
	import CompositionChips from '$lib/components/CompositionChips.svelte';
	import { getCharacterIndexEntry } from '$lib/data/characterLookup';
	import { slotsFromNotation } from '$lib/rotationTabs.svelte';

	// ── Fixture ──────────────────────────────────────────────────────────────
	const DAY = 86_400_000;
	const NOW = Date.UTC(2026, 9, 8, 18);

	type Rotation = {
		id: string;
		name: string;
		notation: string;
		touched: number;
		con: Record<string, number>;
		synced?: boolean;
	};
	const ROTATIONS: Rotation[] = [
		{
			id: 'r1',
			name: 'Varka quickswap',
			notation: 'Nicole E > Durin EEQ > Prune ENQ > Varka E QN5sCN5sC',
			touched: NOW - 2 * DAY,
			con: { varka: 0, durin: 0, prune: 0, nicole: 1 }
		},
		{
			id: 'r2',
			name: 'Columbina Lunar-Bloom',
			notation: 'Columbina EQ > Nahida hEQ > Lauma hEQ > Nilou EN2E > Columbina CCC',
			touched: NOW - 3 * 3_600_000,
			con: { columbina: 0, nahida: 2, lauma: 0, nilou: 0 },
			synced: true
		},
		{
			id: 'r3',
			name: 'Odette freeze',
			notation: 'Odette EE > Alyosha EQ > Lynette EQ > Cryo Traveler E3[N2C]Q',
			touched: NOW - 6 * DAY,
			con: { odette: 0, alyosha: 0, lynette: 6, traveler_cryo: 0 }
		},
		{
			id: 'r4',
			name: 'Mavuika · E first',
			notation: 'Mavuika E > Ororon EQ > Chevreuse hE > Iansan ENQ > Mavuika Q',
			touched: NOW - 1 * DAY,
			con: { mavuika: 2, ororon: 0, chevreuse: 6, iansan: 0 }
		},
		{
			id: 'r5',
			name: 'Mavuika · double Chevreuse',
			notation: 'Ororon EQ > Chevreuse QhEhE > Iansan ENQ > Mavuika Q',
			touched: NOW - 4 * DAY,
			con: { mavuika: 0, ororon: 0, chevreuse: 6, iansan: 0 },
			synced: true
		}
	];
	/** Teams saved with no rotation (a names-only entry). */
	const BARE_TEAMS = [
		{ notation: 'Furina > Neuvillette > Kazuha > Zhongli', touched: NOW - 9 * DAY }
	];
	const NICKNAMES: Record<string, string> = {
		'chevreuse|iansan|mavuika|ororon': 'Natlan Overloaded'
	};
	type BoardFixture = {
		id: string;
		name: string;
		preset: string;
		touched: number;
		teams: { notation: string; pinned?: string }[];
	};
	const BOARDS: BoardFixture[] = [
		{
			id: 'b1',
			name: 'Stygian · October',
			preset: 'Stygian',
			touched: NOW - 5 * 3_600_000,
			teams: [
				{ notation: ROTATIONS[3].notation, pinned: 'r4' },
				{ notation: ROTATIONS[1].notation, pinned: 'r2' },
				{ notation: ROTATIONS[2].notation }
			]
		},
		{
			id: 'b2',
			name: 'Abyss 12',
			preset: 'Abyss',
			touched: NOW - 7 * DAY,
			teams: [
				{ notation: ROTATIONS[0].notation, pinned: 'r1' },
				{ notation: BARE_TEAMS[0].notation }
			]
		}
	];
	const CLOSED = [
		{
			kind: 'rotation' as const,
			name: 'Columbina CCC test',
			notation: 'Columbina EQ > Nilou EN2E > Columbina CCC',
			when: NOW - 40 * 60_000
		},
		{
			kind: 'board' as const,
			name: 'Board 3',
			notation: ROTATIONS[3].notation,
			when: NOW - 2 * DAY
		}
	];
	/** Your account, when the roster has content. */
	const OWNED: Record<string, number> = {
		columbina: 0,
		nahida: 0,
		lauma: 0,
		nilou: 0,
		odette: 0,
		lynette: 6,
		traveler_cryo: 6,
		mavuika: 2,
		ororon: 0,
		chevreuse: 2,
		iansan: 0,
		nicole: 0,
		prune: 0,
		furina: 1,
		neuvillette: 0,
		kaedehara_kazuha: 0,
		zhongli: 0
	};

	// ── Demo controls ────────────────────────────────────────────────────────
	let layout = $state<'A' | 'B' | 'C'>('A');
	let rosterHasContent = $state(true);
	let query = $state('');
	let picked = $state<string[]>([]);

	// ── Derived library ──────────────────────────────────────────────────────
	const ids = (n: string) => slotsFromNotation(n).filter((s) => s !== 'blank');
	const keyOf = (n: string) => [...ids(n)].sort().join('|');
	const nameOf = (id: string) => getCharacterIndexEntry(id)?.displayName ?? id;

	type Team = {
		key: string;
		slots: string[];
		nickname?: string;
		rotations: Rotation[];
		touched: number;
		boards: string[];
	};
	const teams: Team[] = (() => {
		const map: Record<string, Team> = {};
		const ensure = (n: string, touched: number) => {
			const key = keyOf(n);
			let t = map[key];
			if (!t) {
				t = { key, slots: ids(n), nickname: NICKNAMES[key], rotations: [], touched, boards: [] };
				map[key] = t;
			}
			return t;
		};
		for (const b of BARE_TEAMS) ensure(b.notation, b.touched);
		for (const r of [...ROTATIONS].sort((a, b) => b.touched - a.touched)) {
			const t = ensure(r.notation, r.touched);
			t.rotations.push(r);
			t.touched = Math.max(t.touched, r.touched);
		}
		for (const b of BOARDS)
			for (const bt of b.teams) {
				const t = map[keyOf(bt.notation)];
				if (t && !t.boards.includes(b.name)) t.boards.push(b.name);
			}
		return Object.values(map).sort((a, b) => b.touched - a.touched);
	})();

	/** Every character in the library, for the filter row. */
	const everyone = [...new Set(teams.flatMap((t) => t.slots))].sort((a, b) =>
		nameOf(a).localeCompare(nameOf(b))
	);

	const matches = (slots: string[], words: string[]) =>
		picked.every((p) => slots.includes(p)) &&
		(query.trim() === '' ||
			words.some((w) => w.toLowerCase().includes(query.trim().toLowerCase())));

	const shownTeams = $derived(
		teams.filter((t) =>
			matches(t.slots, [
				...t.slots.map(nameOf),
				t.nickname ?? '',
				...t.rotations.map((r) => r.name)
			])
		)
	);
	const shownBoards = $derived(
		BOARDS.filter((b) =>
			b.teams.some((bt) => matches(ids(bt.notation), [b.name, ...ids(bt.notation).map(nameOf)]))
		)
	);
	const shownClosed = $derived(
		CLOSED.filter((c) => matches(ids(c.notation), [c.name, ...ids(c.notation).map(nameOf)]))
	);

	const togglePick = (id: string) =>
		(picked = picked.includes(id) ? picked.filter((p) => p !== id) : [...picked, id]);

	const ago = (t: number) => {
		const m = Math.round((NOW - t) / 60_000);
		if (m < 60) return `${m} min ago`;
		const h = Math.round(m / 60);
		if (h < 24) return `${h} h ago`;
		const d = Math.round(h / 24);
		return d === 1 ? 'Yesterday' : `${d} days ago`;
	};
	const ownedCon = (id: string): number | null | undefined =>
		!rosterHasContent ? undefined : id in OWNED ? OWNED[id] : null;

	// B's selection: a team key, or a board id.
	let selected = $state<string | null>(teams[0]?.key ?? null);
	const selTeam = $derived(teams.find((t) => t.key === selected));
	const selBoard = $derived(BOARDS.find((b) => b.id === selected));

	const HEAD_DISC = 48;
</script>

<svelte:head><title>Library demo — critcalc.app</title></svelte:head>

<!-- ══ Snippets: the pieces every layout shares ══ -->

{#snippet heading(t: Team, size = HEAD_DISC)}
	<div class="lib-head">
		<div class="lib-faces">
			{#each t.slots as id (id)}<SidePortrait {id} {size} />{/each}
			{#each { length: 4 - t.slots.length } as _, i (i)}<SidePortrait id={null} {size} />{/each}
		</div>
		<div class="lib-head-text">
			{#if t.nickname}<span class="lib-nick">{t.nickname}</span>{/if}
			<CompositionChips ids={t.slots} />
			<span class="lib-meta">
				{t.rotations.length === 0
					? 'No rotation yet'
					: t.rotations.length === 1
						? '1 rotation'
						: `${t.rotations.length} rotations`} · {ago(t.touched)}{#if t.boards.length}
					· on {t.boards.join(', ')}{/if}
			</span>
		</div>
		<div class="lib-actions">
			<button class="btn btn--sm" title="Open these four in a new Planner tab"
				><Mark name="plus" size={12} /> New rotation</button
			>
			<button class="btn btn--sm" title="Add this team to a board"
				><Mark name="forward" size={12} /> To board</button
			>
			<button class="btn btn--icon" aria-label="More: nickname, delete team"
				><Mark name="more" size={14} /></button
			>
		</div>
	</div>
{/snippet}

{#snippet rotationRow(r: Rotation)}
	{@const raised = Object.entries(r.con).filter(
		([id, c]) => c > 0 || (rosterHasContent && (ownedCon(id) === null || (ownedCon(id) ?? 0) < c))
	)}
	<li class="lib-rot">
		<div class="lib-rot-main">
			<span class="lib-rot-name">{r.name}</span>
			<code class="lib-rot-notation">{r.notation}</code>
		</div>
		<div class="lib-rot-side">
			{#each raised as [id, c] (id)}
				{@const own = ownedCon(id)}
				{@const short = own !== undefined && (own === null || own < c)}
				<span
					class="lib-con"
					class:lib-con--short={short}
					title={short
						? own === null
							? `You don't own ${nameOf(id)}`
							: `This rotation uses C${c} · you own C${own}`
						: ''}>{nameOf(id).split(' ')[0]} C{c}</span
				>
			{/each}
			{#if rosterHasContent}
				{#if r.synced}
					<span class="lib-synced" title="Follows your roster's constellations"
						><Mark name="link" size={11} /> Synced</span
					>
				{:else}
					<button class="btn btn--sm lib-sync" title="Use your roster's constellations from now on"
						>Sync</button
					>
				{/if}
			{/if}
			<span class="lib-date">{ago(r.touched)}</span>
			<button class="btn btn--sm btn--primary">Open</button>
			<button class="btn btn--icon" aria-label="More: rename, duplicate, share, delete"
				><Mark name="more" size={14} /></button
			>
		</div>
	</li>
{/snippet}

{#snippet teamBlock(t: Team)}
	<section class="lib-team">
		{@render heading(t)}
		{#if t.rotations.length}
			<ul class="lib-rots">
				{#each t.rotations as r (r.id)}{@render rotationRow(r)}{/each}
			</ul>
		{/if}
	</section>
{/snippet}

{#snippet boardCard(b: BoardFixture, size = 32)}
	<article class="lib-board">
		<header class="lib-board-head">
			<span class="lib-board-name">{b.name}</span>
			<span class="lib-meta">{b.preset} · {ago(b.touched)}</span>
			<button class="btn btn--sm btn--primary">Open</button>
		</header>
		{#each b.teams as bt, i (i)}
			{@const slots = ids(bt.notation)}
			<div class="lib-board-team">
				<span class="lib-board-n">{i + 1}</span>
				<div class="lib-faces lib-faces--tight">
					{#each slots as id (id)}<SidePortrait {id} {size} />{/each}
				</div>
				{#if bt.pinned}
					<span class="lib-pin" title="Pinned rotation"
						><Mark name="pin" size={11} />
						{ROTATIONS.find((r) => r.id === bt.pinned)?.name}</span
					>
				{/if}
			</div>
		{/each}
	</article>
{/snippet}

{#snippet closedList()}
	<ul class="lib-closed">
		{#each shownClosed as c (c.name)}
			<li class="lib-closed-row">
				<div class="lib-faces lib-faces--tight">
					{#each ids(c.notation) as id (id)}<SidePortrait {id} size={28} />{/each}
				</div>
				<span class="lib-closed-name"
					>{c.name} <span class="lib-meta">· {c.kind} · closed {ago(c.when)}</span></span
				>
				<button class="btn btn--sm">Save</button>
				<button class="btn btn--sm btn--primary">Reopen</button>
			</li>
		{/each}
	</ul>
{/snippet}

<!-- ══ The page ══ -->

<div class="lib-scrim"></div>
<div class="lib ctx-dark" role="dialog" aria-label="Library">
	<header class="lib-top">
		<h2 class="lib-title">Library</h2>
		<label class="lib-search">
			<Mark name="search" size={14} />
			<input type="search" placeholder="Search teams, rotations, names" bind:value={query} />
		</label>
		<div class="lib-demo">
			<span class="lib-demo-tag">Demo</span>
			{#each [['A', 'Shelf'], ['B', 'Index + detail'], ['C', 'Gallery']] as [k, l] (k)}
				<button
					class="tab"
					class:active={layout === k}
					onclick={() => (layout = k as 'A' | 'B' | 'C')}>{k} · {l}</button
				>
			{/each}
			<label class="lib-demo-check"
				><input type="checkbox" bind:checked={rosterHasContent} /> Roster has content</label
			>
		</div>
		<button class="btn btn--icon" aria-label="Close"><Mark name="close" size={16} /></button>
	</header>

	<div class="lib-filter" role="group" aria-label="Filter by character">
		{#each everyone as id (id)}
			<button
				class="lib-filter-face"
				class:lib-filter-face--on={picked.includes(id)}
				aria-pressed={picked.includes(id)}
				title={nameOf(id)}
				onclick={() => togglePick(id)}
				><SidePortrait {id} size={30} selected={picked.includes(id)} /></button
			>
		{/each}
		{#if picked.length}
			<button class="btn btn--sm" onclick={() => (picked = [])}>Clear</button>
		{/if}
	</div>

	{#if layout === 'A'}
		<div class="lib-body lib-a">
			<div class="lib-col lib-scroll">
				<p class="kicker">Teams</p>
				{#each shownTeams as t (t.key)}{@render teamBlock(t)}{/each}
			</div>
			<div class="lib-col lib-scroll">
				<p class="kicker">Boards</p>
				{#each shownBoards as b (b.id)}{@render boardCard(b)}{/each}
				<p class="kicker">Recently closed</p>
				{@render closedList()}
			</div>
		</div>
	{:else if layout === 'B'}
		<div class="lib-body lib-b" class:lib-b--detail={selected !== null}>
			<nav class="lib-index lib-scroll">
				<p class="kicker">Teams</p>
				{#each shownTeams as t (t.key)}
					<button
						class="lib-index-row"
						class:lib-index-row--on={selected === t.key}
						onclick={() => (selected = t.key)}
					>
						<span class="lib-faces lib-faces--tight">
							{#each t.slots as id (id)}<SidePortrait {id} size={32} />{/each}
						</span>
						<span class="lib-index-text">
							<span class="lib-index-name"
								>{t.nickname ?? t.slots.map((id) => nameOf(id).split(' ')[0]).join(', ')}</span
							>
							<span class="lib-meta"
								>{t.rotations.length || 'No'} rotation{t.rotations.length === 1 ? '' : 's'} · {ago(
									t.touched
								)}</span
							>
						</span>
					</button>
				{/each}
				<p class="kicker">Boards</p>
				{#each shownBoards as b (b.id)}
					<button
						class="lib-index-row"
						class:lib-index-row--on={selected === b.id}
						onclick={() => (selected = b.id)}
					>
						<span class="lib-index-text">
							<span class="lib-index-name">{b.name}</span>
							<span class="lib-meta">{b.preset} · {b.teams.length} teams · {ago(b.touched)}</span>
						</span>
					</button>
				{/each}
				<p class="kicker">Recently closed</p>
				{@render closedList()}
			</nav>
			<div class="lib-detail lib-scroll">
				<button class="btn btn--sm lib-back" onclick={() => (selected = null)}
					><Mark name="back" size={12} /> All</button
				>
				{#if selTeam}
					{@render heading(selTeam, 64)}
					{#if selTeam.rotations.length}
						<ul class="lib-rots">
							{#each selTeam.rotations as r (r.id)}{@render rotationRow(r)}{/each}
						</ul>
					{:else}
						<p class="lib-empty">
							No rotation yet. <b>New rotation</b> opens these four in the Planner.
						</p>
					{/if}
				{:else if selBoard}
					{@render boardCard(selBoard, 48)}
				{/if}
			</div>
		</div>
	{:else}
		<div class="lib-body lib-c lib-scroll">
			<p class="kicker">Boards</p>
			<div class="lib-strip">
				{#each shownBoards as b (b.id)}{@render boardCard(b)}{/each}
			</div>
			<p class="kicker">Teams</p>
			<div class="lib-cards">
				{#each shownTeams as t (t.key)}{@render teamBlock(t)}{/each}
			</div>
			<details class="lib-fold">
				<summary>Recently closed · {shownClosed.length}</summary>
				{@render closedList()}
			</details>
		</div>
	{/if}
</div>

<style>
	.lib-scrim {
		position: fixed;
		inset: 0;
		background: rgb(0 0 0 / 0.35);
	}
	.lib {
		position: fixed;
		inset: 4.25rem 1.5rem 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1rem 1.25rem 0;
		border-radius: var(--r-lg, 6px);
		background: var(--surface);
		color: var(--text);
		overflow: hidden;
	}
	.lib-top {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
	}
	.lib-title {
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--fs-xl);
		font-weight: var(--fw-regular, 400);
	}
	.lib-search {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		flex: 1 1 16rem;
		max-width: 26rem;
		padding: 0 0.6rem;
		height: 30px;
		border-radius: var(--r-sm, 3px);
		background: var(--surface-well);
		color: var(--muted);
	}
	.lib-search input {
		flex: 1;
		min-width: 0;
		border: none;
		background: none;
		color: var(--text);
		font: inherit;
		font-size: var(--fs-sm);
		outline: none;
	}
	.lib-demo {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin-left: auto;
		flex-wrap: wrap;
		font-size: var(--fs-sm);
	}
	.lib-demo-tag {
		font-size: var(--fs-xs);
		text-transform: uppercase;
		letter-spacing: var(--ls-mid, 0.06em);
		color: var(--accent);
	}
	.lib-demo-check {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		margin-left: 0.5rem;
	}
	.lib-filter {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 6px;
	}
	.lib-filter-face {
		padding: 0;
		border: none;
		background: none;
		cursor: pointer;
	}
	.lib-filter-face:not(.lib-filter-face--on):hover :global(.spt-disc) {
		box-shadow: 0 0 0 1px var(--glass-ring);
	}

	.lib-body {
		flex: 1;
		min-height: 0;
	}
	.lib-scroll {
		overflow-y: auto;
		padding-bottom: 1.25rem;
	}
	.kicker {
		margin: 0.25rem 0 0.6rem;
	}

	/* ── shared pieces ── */
	.lib-faces {
		display: flex;
		align-items: flex-end;
		gap: 6px;
	}
	.lib-faces--tight {
		gap: 3px;
	}
	.lib-team {
		padding: 0.75rem 0 0.9rem;
		border-bottom: 1px solid var(--line-faint);
	}
	.lib-head {
		display: flex;
		align-items: flex-end;
		gap: 1rem;
		flex-wrap: wrap;
	}
	.lib-head-text {
		display: flex;
		flex-direction: column;
		gap: 5px;
		flex: 1 1 14rem;
		min-width: 0;
		padding-bottom: 2px;
	}
	.lib-nick {
		font-family: var(--font-display);
		font-size: var(--fs-lg);
	}
	.lib-meta {
		font-size: var(--fs-xs);
		color: var(--muted);
	}
	.lib-actions {
		display: flex;
		gap: 4px;
		align-items: center;
	}
	.lib-rots {
		list-style: none;
		margin: 0.6rem 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.lib-rot {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.45rem 0.6rem;
		border-radius: var(--r-sm, 3px);
		background: var(--surface-well);
	}
	.lib-rot-main {
		display: flex;
		flex-direction: column;
		gap: 2px;
		flex: 1;
		min-width: 0;
	}
	.lib-rot-name {
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
	}
	.lib-rot-notation {
		font-size: var(--fs-xs);
		color: var(--muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.lib-rot-side {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
		justify-content: flex-end;
	}
	.lib-con {
		font-size: var(--fs-xs);
		padding: 1px 6px;
		border-radius: var(--r-round);
		background: var(--line-strong);
	}
	.lib-con--short {
		background: none;
		box-shadow: inset 0 0 0 1px var(--muted);
		color: var(--muted);
	}
	.lib-synced {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		font-size: var(--fs-xs);
		color: var(--accent);
	}
	.lib-date {
		font-size: var(--fs-xs);
		color: var(--muted);
		min-width: 5.5rem;
		text-align: right;
	}

	.lib-board {
		padding: 0.7rem 0.8rem;
		border-radius: var(--r-sm, 3px);
		background: var(--surface-well);
		margin-bottom: 0.6rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.lib-board-head {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
	}
	.lib-board-head .btn {
		margin-left: auto;
	}
	.lib-board-name {
		font-weight: var(--fw-semibold);
	}
	.lib-board-team {
		display: flex;
		align-items: flex-end;
		gap: 0.6rem;
	}
	.lib-board-n {
		width: 1rem;
		font-size: var(--fs-xs);
		color: var(--muted);
		padding-bottom: 8px;
	}
	.lib-pin {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		font-size: var(--fs-xs);
		color: var(--muted);
		padding-bottom: 8px;
	}
	.lib-closed {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.lib-closed-row {
		display: flex;
		align-items: flex-end;
		gap: 0.6rem;
	}
	.lib-closed-name {
		flex: 1;
		min-width: 0;
		font-size: var(--fs-sm);
		padding-bottom: 5px;
	}
	.lib-closed-row .btn {
		margin-bottom: 2px;
	}

	/* ── A · Shelf ── */
	.lib-a {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(18rem, 26rem);
		gap: 2rem;
	}
	.lib-col {
		min-height: 0;
	}

	/* ── B · Index + detail ── */
	.lib-b {
		display: grid;
		grid-template-columns: minmax(16rem, 22rem) minmax(0, 1fr);
		gap: 2rem;
	}
	.lib-index {
		min-height: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.lib-index-row {
		display: flex;
		align-items: flex-end;
		gap: 0.6rem;
		padding: 0.35rem 0.5rem;
		border: none;
		border-radius: var(--r-sm, 3px);
		background: none;
		color: var(--text);
		text-align: left;
		cursor: pointer;
		font: inherit;
	}
	.lib-index-row:hover {
		background: var(--surface-raised);
	}
	.lib-index-row--on {
		background: var(--surface-well);
		box-shadow: inset 2px 0 0 var(--accent);
	}
	.lib-index-text {
		display: flex;
		flex-direction: column;
		min-width: 0;
		padding-bottom: 2px;
	}
	.lib-index-name {
		font-size: var(--fs-sm);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.lib-detail {
		min-height: 0;
	}
	.lib-back {
		display: none;
	}
	.lib-empty {
		color: var(--muted);
		font-size: var(--fs-sm);
	}

	/* ── C · Gallery ── */
	.lib-c {
		min-height: 0;
	}
	.lib-strip {
		display: flex;
		gap: 0.75rem;
		overflow-x: auto;
		padding-bottom: 0.25rem;
	}
	.lib-strip .lib-board {
		flex: 0 0 22rem;
	}
	.lib-cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(30rem, 1fr));
		gap: 0 2rem;
	}
	.lib-fold {
		margin-top: 1rem;
	}
	.lib-fold summary {
		cursor: pointer;
		font-size: var(--fs-sm);
		margin-bottom: 0.6rem;
	}

	/* ── Narrow: stacked (roomy, 47.5rem — $lib/breakpoints.ts) ── */
	@media (max-width: 47.5rem) {
		.lib {
			inset: 3.5rem 0 0;
			border-radius: 0;
			padding: 0.75rem 1rem 0;
		}
		.lib-a {
			display: block;
			overflow-y: auto;
		}
		.lib-a .lib-col {
			overflow: visible;
		}
		.lib-b {
			display: block;
		}
		.lib-b--detail .lib-index,
		.lib-b:not(.lib-b--detail) .lib-detail {
			display: none;
		}
		.lib-b .lib-index,
		.lib-b .lib-detail {
			height: 100%;
		}
		.lib-back {
			display: inline-flex;
			margin-bottom: 0.75rem;
		}
		.lib-cards {
			grid-template-columns: minmax(0, 1fr);
		}
		.lib-rot {
			flex-wrap: wrap;
		}
		.lib-rot-main {
			flex-basis: 100%;
		}
		.lib-rot-side {
			flex: 1;
		}
	}
</style>
