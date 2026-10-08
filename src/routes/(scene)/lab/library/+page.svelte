<script lang="ts">
	/**
	 * THE LIBRARY — the Shelf layout (lineups design §10.1, build step 4; ⚓ Nate
	 * 2026-10-08 picked it over Index+detail and Gallery). A DEMO: fixture data,
	 * no store. Delete, Sync and Forget really act on the fixture so the flow can
	 * be felt; everything else shows what it would do.
	 *
	 * ⚓ THE STRIP IS THE BUTTON. A rotation's row and a team's heading are each
	 * one click target meaning "use this HERE": opened from the Planner, a
	 * rotation opens in a new tab and a heading opens a names-only tab; from the
	 * Builder, both put the team on the board (a rotation pinned); as its own
	 * page, each goes to its document's HOME (rotations → the Planner, boards →
	 * the Builder). A hover hint at the row's end names the click. Everything
	 * else lives in ⋯; Sync stays visible because it is a state, not an action.
	 *
	 * ⚓ FILTERING IS THE SEARCH BOX (Nate: a strip of every avatar is too clunky
	 * to find anyone in). Typing suggests; Enter turns the top suggestion into a
	 * TAG inside the box; tags AND together; leftover text searches names.
	 * Candidate extension, shown here: a tag may be a character, an ELEMENT or a
	 * REACTION, so a team can be found by what it does.
	 *
	 * Other rulings it follows: a team is a real names-only entry and the heading
	 * IS that entry; portraits smaller than the board's + composition chips +
	 * nickname + count + date, ⛔ no fingerprint; portrait order = the newest
	 * entry's; last-touched order; Sync is per ROTATION; delete is ONE confirm
	 * and the rotations go to Recently closed (a team with rotations too);
	 * Recently closed tops the side column, collapsed to three.
	 */
	import Mark from '$lib/components/Mark.svelte';
	import SidePortrait from '$lib/components/SidePortrait.svelte';
	import CompositionChips from '$lib/components/CompositionChips.svelte';
	import { getCharacterIndexEntry } from '$lib/data/characterLookup';
	import { elementIcon } from '$lib/data/elementIcons.generated';
	import { REACTION_INGREDIENTS, teamReactions } from '$lib/capabilities/deriveCapabilities';
	import { REACTION_FAMILY, REACTION_LABEL } from '$lib/utils/auraDisplay';
	import { slotsFromNotation } from '$lib/rotationTabs.svelte';
	import type { Reaction } from '$lib/types/ability';

	// ── Fixture ──────────────────────────────────────────────────────────────
	const DAY = 86_400_000;
	const HOUR = 3_600_000;
	const NOW = Date.UTC(2026, 9, 8, 18);

	type Rotation = {
		id: string;
		name: string;
		notation: string;
		touched: number;
		con: Record<string, number>;
		synced?: boolean;
	};
	let rotations = $state<Rotation[]>([
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
			touched: NOW - 3 * HOUR,
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
	]);
	/** Team entries (names-only). Every rotation's team has one — created on
	 *  save (§10.1) — plus a team saved with no rotation. */
	let teamEntries = $state<{ notation: string; touched: number }[]>([
		{ notation: 'Furina > Neuvillette > Kazuha > Zhongli', touched: NOW - 9 * DAY },
		{ notation: 'Varka > Durin > Prune > Nicole', touched: NOW - 12 * DAY },
		{ notation: 'Columbina > Nahida > Lauma > Nilou', touched: NOW - 12 * DAY },
		{ notation: 'Odette > Alyosha > Lynette > Cryo Traveler', touched: NOW - 12 * DAY },
		{ notation: 'Mavuika > Ororon > Chevreuse > Iansan', touched: NOW - 12 * DAY }
	]);
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
			touched: NOW - 5 * HOUR,
			teams: [
				{ notation: 'Mavuika > Ororon > Chevreuse > Iansan', pinned: 'r4' },
				{ notation: 'Columbina > Nahida > Lauma > Nilou', pinned: 'r2' },
				{ notation: 'Odette > Alyosha > Lynette > Cryo Traveler' }
			]
		},
		{
			id: 'b2',
			name: 'Abyss 12',
			preset: 'Abyss',
			touched: NOW - 7 * DAY,
			teams: [
				{ notation: 'Nicole > Durin > Prune > Varka', pinned: 'r1' },
				{ notation: 'Furina > Neuvillette > Kazuha > Zhongli' }
			]
		}
	];
	type Closed = {
		id: string;
		kind: 'rotation' | 'board';
		name: string;
		notation: string;
		when: number;
	};
	let closed = $state<Closed[]>([
		{
			id: 'c1',
			kind: 'rotation',
			name: 'Columbina CCC test',
			notation: 'Columbina EQ > Nilou EN2E > Columbina CCC',
			when: NOW - 40 * 60_000
		},
		{
			id: 'c2',
			kind: 'board',
			name: 'Board 3',
			notation: 'Mavuika > Ororon > Chevreuse > Iansan',
			when: NOW - 2 * DAY
		},
		{
			id: 'c3',
			kind: 'rotation',
			name: 'Untitled 4',
			notation: 'Furina E > Neuvillette Q > Kazuha hEQ',
			when: NOW - 3 * DAY
		},
		{
			id: 'c4',
			kind: 'rotation',
			name: 'Varka N5 loop',
			notation: 'Varka E N5 N5',
			when: NOW - 5 * DAY
		}
	]);
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
	type Ctx = 'planner' | 'builder' | 'page';
	let ctx = $state<Ctx>('planner');
	let teamSelected = $state(true);
	let rosterHasContent = $state(true);
	let closedOpen = $state(false);

	// ── Derived library ──────────────────────────────────────────────────────
	const ids = (n: string) => slotsFromNotation(n).filter((s) => s !== 'blank');
	const keyOf = (n: string) => [...ids(n)].sort().join('|');
	const nameOf = (id: string) => getCharacterIndexEntry(id)?.displayName ?? id;
	const first = (id: string) => nameOf(id).split(' ')[0];

	type Team = {
		key: string;
		slots: string[];
		nickname?: string;
		rotations: Rotation[];
		touched: number;
		boards: string[];
	};
	const teams = $derived.by((): Team[] => {
		// A plain object, not a Map: a pure fold, nothing here is state.
		const map: Record<string, Team> = {};
		for (const e of teamEntries) {
			const key = keyOf(e.notation);
			map[key] ??= {
				key,
				slots: ids(e.notation),
				nickname: NICKNAMES[key],
				rotations: [],
				touched: e.touched,
				boards: []
			};
		}
		for (const r of [...rotations].sort((a, b) => b.touched - a.touched)) {
			const t = map[keyOf(r.notation)];
			if (!t) continue;
			// Portrait order = the newest entry's.
			if (t.rotations.length === 0) t.slots = ids(r.notation);
			t.rotations.push(r);
			t.touched = Math.max(t.touched, r.touched);
		}
		for (const b of BOARDS)
			for (const bt of b.teams) {
				const t = map[keyOf(bt.notation)];
				if (t && !t.boards.includes(b.name)) t.boards.push(b.name);
			}
		return Object.values(map).sort((a, b) => b.touched - a.touched);
	});

	// ── Search: free text + TAGS (character · element · reaction) ───────────
	type Tag =
		| { kind: 'char'; id: string; label: string }
		| { kind: 'element'; id: string; label: string }
		| { kind: 'reaction'; id: string; label: string };
	let query = $state('');
	let tags = $state<Tag[]>([]);
	let activeSuggestion = $state(0);
	let inputEl = $state<HTMLInputElement>();

	const ELEMENTS = ['pyro', 'hydro', 'anemo', 'electro', 'dendro', 'cryo', 'geo'];
	const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
	/** A reaction tag names what a player calls it: the family, except a
	 *  converted reaction keeps its own name (the chips' rule). */
	const reactionName = (r: Reaction) =>
		REACTION_INGREDIENTS[r].enabler ? REACTION_LABEL[r] : REACTION_FAMILY[r];
	const membersOf = (slots: string[]) =>
		slots.map((id) => getCharacterIndexEntry(id)).filter((m) => m !== null);
	const reactionsOf = (slots: string[]) => teamReactions(membersOf(slots)).map(reactionName);

	const everyone = $derived([...new Set(teams.flatMap((t) => t.slots))]);
	const allReactions = $derived([...new Set(teams.flatMap((t) => reactionsOf(t.slots)))]);

	const suggestions = $derived.by((): Tag[] => {
		const q = query.trim().toLowerCase();
		if (!q) return [];
		const taken = (t: Tag) => tags.some((x) => x.kind === t.kind && x.id === t.id);
		const all: Tag[] = [
			...everyone.map((id) => ({ kind: 'char' as const, id, label: nameOf(id) })),
			...ELEMENTS.map((e) => ({ kind: 'element' as const, id: e, label: cap(e) })),
			...allReactions.map((r) => ({ kind: 'reaction' as const, id: r, label: r }))
		];
		// Prefix matches first, then any word starting with the query.
		const starts = all.filter((t) => t.label.toLowerCase().startsWith(q));
		const words = all.filter(
			(t) =>
				!starts.includes(t) &&
				t.label
					.toLowerCase()
					.split(/[\s-]/)
					.some((w) => w.startsWith(q))
		);
		return [...starts, ...words].filter((t) => !taken(t)).slice(0, 6);
	});

	function addTag(t: Tag) {
		tags = [...tags, t];
		query = '';
		activeSuggestion = 0;
		inputEl?.focus();
	}
	function onSearchKey(e: KeyboardEvent) {
		if (e.key === 'Enter' && suggestions.length) {
			e.preventDefault();
			addTag(suggestions[Math.min(activeSuggestion, suggestions.length - 1)]);
		} else if (e.key === 'ArrowDown' && suggestions.length) {
			e.preventDefault();
			activeSuggestion = (activeSuggestion + 1) % suggestions.length;
		} else if (e.key === 'ArrowUp' && suggestions.length) {
			e.preventDefault();
			activeSuggestion = (activeSuggestion - 1 + suggestions.length) % suggestions.length;
		} else if (e.key === 'Backspace' && query === '' && tags.length) {
			tags = tags.slice(0, -1);
		} else if (e.key === 'Escape') {
			query = '';
		}
	}

	const tagMatches = (t: Tag, slots: string[]) =>
		t.kind === 'char'
			? slots.includes(t.id)
			: t.kind === 'element'
				? membersOf(slots).some((m) => m.element === t.id)
				: reactionsOf(slots).includes(t.id);
	/** Tags AND together. Free text matches only while no suggestion is being
	 *  typed toward — otherwise "Mav" would empty the list before Enter. */
	const matches = (slots: string[], words: string[]) => {
		if (!tags.every((t) => tagMatches(t, slots))) return false;
		const q = query.trim().toLowerCase();
		if (!q || suggestions.length) return true;
		return words.some((w) => w.toLowerCase().includes(q));
	};

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
		closed
			.filter((c) => matches(ids(c.notation), [c.name, ...ids(c.notation).map(nameOf)]))
			.sort((a, b) => b.when - a.when)
	);
	const CLOSED_PEEK = 3;

	const ago = (t: number) => {
		const m = Math.round((NOW - t) / 60_000);
		if (m < 1) return 'Just now';
		if (m < 60) return `${m} min ago`;
		const h = Math.round(m / 60);
		if (h < 24) return `${h} h ago`;
		const d = Math.round(h / 24);
		return d === 1 ? 'Yesterday' : `${d} days ago`;
	};
	const ownedCon = (id: string): number | null | undefined =>
		!rosterHasContent ? undefined : id in OWNED ? OWNED[id] : null;

	// ── What a click does, per context (the hover hint says it) ─────────────
	const hint = {
		rotation: () =>
			ctx === 'planner'
				? 'Open in a new tab'
				: ctx === 'builder'
					? teamSelected
						? 'Pin to Team 2'
						: 'Add to the board, pinned'
					: 'Open in the Planner',
		team: () =>
			ctx === 'planner'
				? 'New tab with these four'
				: ctx === 'builder'
					? teamSelected
						? 'Put on Team 2'
						: 'Add to the board'
					: 'New rotation in the Planner',
		board: () => (ctx === 'builder' ? 'Open as a tab' : 'Open in the Team Builder'),
		closed: (c: Closed) =>
			c.kind === 'board'
				? ctx === 'builder'
					? 'Reopen'
					: 'Reopen in the Team Builder'
				: ctx === 'builder'
					? 'Reopen in the Planner'
					: 'Reopen'
	};

	// ── Demo feedback: a toast for what WOULD happen ────────────────────────
	let toast = $state<string | null>(null);
	let toastTimer: ReturnType<typeof setTimeout> | undefined;
	function say(msg: string) {
		toast = msg;
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => (toast = null), 2200);
	}

	// ── The ⋯ menu (one open at a time) ──────────────────────────────────────
	type MenuItem = { label: string; danger?: boolean; run: () => void };
	let menu = $state<{ id: string; items: MenuItem[] } | null>(null);
	function openMenu(e: MouseEvent, id: string, items: MenuItem[]) {
		e.stopPropagation();
		menu = menu?.id === id ? null : { id, items };
	}
	const otherTool = () => (ctx === 'builder' ? 'Open in the Planner' : 'Open in the Team Builder');

	// ── The one confirm ──────────────────────────────────────────────────────
	let confirm = $state<{ title: string; body: string; action: string; run: () => void } | null>(
		null
	);

	let nextId = 100;
	function toClosed(r: Rotation) {
		closed = [
			{ id: `c${nextId++}`, kind: 'rotation', name: r.name, notation: r.notation, when: NOW },
			...closed
		];
	}
	function deleteRotation(r: Rotation) {
		confirm = {
			title: `Delete “${r.name}”?`,
			body: 'It goes to Recently closed, where you can reopen it.',
			action: 'Delete',
			run: () => {
				rotations = rotations.filter((x) => x.id !== r.id);
				toClosed(r);
			}
		};
	}
	function deleteTeam(t: Team) {
		const n = t.rotations.length;
		confirm = {
			title: 'Delete this team?',
			body:
				n === 0
					? 'Boards that use it keep their four characters.'
					: `Its ${n === 1 ? 'rotation goes' : `${n} rotations go`} to Recently closed. Boards that use the team keep their four characters.`,
			action: 'Delete team',
			run: () => {
				for (const r of t.rotations) toClosed(r);
				rotations = rotations.filter((x) => keyOf(x.notation) !== t.key);
				teamEntries = teamEntries.filter((e) => keyOf(e.notation) !== t.key);
			}
		};
	}
	function syncRotation(r: Rotation) {
		confirm = {
			title: `Sync “${r.name}” to your roster?`,
			body: "Your roster's constellations will replace this rotation's for every character you own, and it will keep following your roster from now on.",
			action: 'Sync',
			run: () => {
				rotations = rotations.map((x) => {
					if (x.id !== r.id) return x;
					const con: Record<string, number> = {};
					for (const [id, c] of Object.entries(x.con)) con[id] = id in OWNED ? OWNED[id] : c;
					return { ...x, con, synced: true };
				});
			}
		};
	}

	const rotationMenu = (r: Rotation): MenuItem[] => [
		{ label: 'Rename', run: () => say(`Would rename “${r.name}”`) },
		{ label: 'Duplicate', run: () => say(`Would duplicate “${r.name}”`) },
		{ label: 'Copy share link', run: () => say('Would copy a share link') },
		{ label: otherTool(), run: () => say(`Would ${otherTool().toLowerCase()}`) },
		{ label: 'Delete', danger: true, run: () => deleteRotation(r) }
	];
	const teamMenu = (t: Team): MenuItem[] => [
		{
			label: t.nickname ? 'Rename nickname' : 'Add a nickname',
			run: () => say('Would edit the nickname')
		},
		...(ctx !== 'builder'
			? [{ label: 'Put on a board', run: () => say('Would put this team on a board') }]
			: []),
		{ label: 'Delete team', danger: true, run: () => deleteTeam(t) }
	];
	const boardMenu = (b: BoardFixture): MenuItem[] => [
		{ label: 'Rename', run: () => say(`Would rename “${b.name}”`) },
		{ label: 'Copy share link', run: () => say('Would copy a share link') },
		{
			label: 'Delete',
			danger: true,
			run: () => say('Would ask, then send it to Recently closed')
		}
	];
	const closedMenu = (c: Closed): MenuItem[] => [
		{ label: 'Save to library', run: () => say(`Would save “${c.name}”`) },
		{ label: 'Forget', danger: true, run: () => (closed = closed.filter((x) => x.id !== c.id)) }
	];

	/** A strip is a div with button semantics, so ⋯ and Sync can live inside it. */
	function activate(e: KeyboardEvent, run: () => void) {
		if (e.target !== e.currentTarget) return;
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			run();
		}
	}

	const HEAD_DISC = 48;
</script>

<svelte:head><title>Library demo — critcalc.app</title></svelte:head>
<svelte:window onclick={() => (menu = null)} />

{#snippet tagMark(t: Tag, size: number)}
	{#if t.kind === 'char'}
		<SidePortrait id={t.id} {size} />
	{:else if t.kind === 'element' && elementIcon(t.id)}
		<img class="lib-tag-icon" src={elementIcon(t.id)} alt="" />
	{:else}
		<Mark name="aura" size={12} />
	{/if}
{/snippet}

{#snippet more(id: string, items: MenuItem[], label: string)}
	<span class="lib-more">
		<button
			class="btn btn--icon lib-more-btn"
			aria-label={label}
			aria-expanded={menu?.id === id}
			onclick={(e) => openMenu(e, id, items)}><Mark name="more" size={14} /></button
		>
		{#if menu?.id === id}
			<span class="lib-menu" role="menu">
				{#each menu.items as item (item.label)}
					<button
						role="menuitem"
						class="lib-menu-item"
						class:lib-menu-item--danger={item.danger}
						onclick={(e) => {
							e.stopPropagation();
							menu = null;
							item.run();
						}}>{item.label}</button
					>
				{/each}
			</span>
		{/if}
	</span>
{/snippet}

{#snippet heading(t: Team)}
	{@const run = () => say(`${hint.team()}: ${t.slots.map(first).join(', ')}`)}
	<div
		class="lib-strip lib-head"
		role="button"
		tabindex="0"
		onclick={run}
		onkeydown={(e) => activate(e, run)}
	>
		<div class="lib-faces">
			{#each t.slots as id (id)}<SidePortrait {id} size={HEAD_DISC} />{/each}
			{#each { length: 4 - t.slots.length } as _, i (i)}<SidePortrait
					id={null}
					size={HEAD_DISC}
				/>{/each}
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
		<span class="lib-end">
			<span class="lib-hint">{hint.team()}</span>
			{@render more(`t:${t.key}`, teamMenu(t), 'More: nickname, delete team')}
		</span>
	</div>
{/snippet}

{#snippet rotationRow(r: Rotation)}
	{@const run = () => say(`${hint.rotation()}: “${r.name}”`)}
	{@const raised = Object.entries(r.con).filter(
		([id, c]) => c > 0 || (rosterHasContent && (ownedCon(id) === null || (ownedCon(id) ?? 0) < c))
	)}
	<div
		class="lib-strip lib-rot"
		role="button"
		tabindex="0"
		onclick={run}
		onkeydown={(e) => activate(e, run)}
	>
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
						: ''}>{first(id)} C{c}</span
				>
			{/each}
			{#if rosterHasContent}
				{#if r.synced}
					<span class="lib-synced" title="Follows your roster's constellations"
						><Mark name="link" size={11} /> Synced</span
					>
				{:else}
					<button
						class="btn btn--sm lib-sync"
						title="Use your roster's constellations from now on"
						onclick={(e) => {
							e.stopPropagation();
							syncRotation(r);
						}}>Sync</button
					>
				{/if}
			{/if}
			<span class="lib-end lib-end--rot">
				<span class="lib-date">{ago(r.touched)}</span>
				<span class="lib-hint">{hint.rotation()}</span>
			</span>
			{@render more(`r:${r.id}`, rotationMenu(r), 'More: rename, duplicate, share, delete')}
		</div>
	</div>
{/snippet}

{#snippet boardCard(b: BoardFixture)}
	{@const run = () => say(`${hint.board()}: “${b.name}”`)}
	<div
		class="lib-strip lib-board"
		role="button"
		tabindex="0"
		onclick={run}
		onkeydown={(e) => activate(e, run)}
	>
		<header class="lib-board-head">
			<span class="lib-board-name">{b.name}</span>
			<span class="lib-meta">{b.preset} · {ago(b.touched)}</span>
			<span class="lib-end">
				<span class="lib-hint">{hint.board()}</span>
				{@render more(`b:${b.id}`, boardMenu(b), 'More: rename, share, delete')}
			</span>
		</header>
		{#each b.teams as bt, i (i)}
			{@const slots = ids(bt.notation)}
			{@const pin = rotations.find((r) => r.id === bt.pinned)}
			<div class="lib-board-team">
				<span class="lib-board-n">{i + 1}</span>
				<div class="lib-faces lib-faces--tight">
					{#each slots as id (id)}<SidePortrait {id} size={32} />{/each}
				</div>
				{#if pin}
					<span class="lib-pin" title="Pinned rotation"
						><Mark name="pin" size={11} /> {pin.name}</span
					>
				{/if}
			</div>
		{/each}
	</div>
{/snippet}

{#snippet closedRow(c: Closed)}
	{@const run = () => say(`${hint.closed(c)}: “${c.name}”`)}
	<div
		class="lib-strip lib-closed-row"
		role="button"
		tabindex="0"
		onclick={run}
		onkeydown={(e) => activate(e, run)}
	>
		<div class="lib-faces lib-faces--tight">
			{#each ids(c.notation) as id (id)}<SidePortrait {id} size={28} />{/each}
		</div>
		<span class="lib-closed-text">
			<span class="lib-closed-name">{c.name}</span>
			<span class="lib-end lib-end--rot">
				<span class="lib-meta lib-date"
					>{c.kind === 'board' ? 'Board' : 'Rotation'} · closed {ago(c.when)}</span
				>
				<span class="lib-hint">{hint.closed(c)}</span>
			</span>
		</span>
		{@render more(`c:${c.id}`, closedMenu(c), 'More: save, forget')}
	</div>
{/snippet}

<!-- ══ The page ══ -->

<div class="lib-scrim"></div>
<div class="lib ctx-dark" role="dialog" aria-label="Library">
	<header class="lib-top">
		<h2 class="lib-title">Library</h2>
		<div class="lib-search-wrap">
			<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
			<div class="lib-search" onclick={() => inputEl?.focus()}>
				<Mark name="search" size={14} />
				{#each tags as t, i (t.kind + t.id)}
					<span class="lib-tag lib-tag--{t.kind}">
						{@render tagMark(t, 18)}
						{t.label}
						<button
							class="lib-tag-x"
							aria-label="Remove {t.label}"
							onclick={(e) => {
								e.stopPropagation();
								tags = tags.filter((_, j) => j !== i);
							}}><Mark name="close" size={10} /></button
						>
					</span>
				{/each}
				<input
					bind:this={inputEl}
					type="search"
					placeholder={tags.length
						? 'Add another'
						: 'Search, or type a character, element or reaction'}
					bind:value={query}
					oninput={() => (activeSuggestion = 0)}
					onkeydown={onSearchKey}
				/>
			</div>
			{#if suggestions.length}
				<div class="lib-suggest" role="listbox">
					{#each suggestions as s, i (s.kind + s.id)}
						<button
							role="option"
							aria-selected={i === activeSuggestion}
							class="lib-suggest-item"
							class:lib-suggest-item--on={i === activeSuggestion}
							onmouseenter={() => (activeSuggestion = i)}
							onclick={() => addTag(s)}
						>
							{@render tagMark(s, 22)}
							<span>{s.label}</span>
							<span class="lib-meta lib-suggest-kind"
								>{s.kind === 'char'
									? 'Character'
									: s.kind === 'element'
										? 'Element'
										: 'Reaction'}</span
							>
							{#if i === activeSuggestion}<kbd class="lib-kbd">Enter</kbd>{/if}
						</button>
					{/each}
				</div>
			{/if}
		</div>
		<div class="lib-demo">
			<span class="lib-demo-tag">Demo · opened from</span>
			{#each [['planner', 'Planner'], ['builder', 'Builder'], ['page', 'Library page']] as [k, l] (k)}
				<button class="tab" class:active={ctx === k} onclick={() => (ctx = k as Ctx)}>{l}</button>
			{/each}
			{#if ctx === 'builder'}
				<label class="lib-demo-check"
					><input type="checkbox" bind:checked={teamSelected} /> Team 2 selected</label
				>
			{/if}
			<label class="lib-demo-check"
				><input type="checkbox" bind:checked={rosterHasContent} /> Roster has content</label
			>
		</div>
		<button class="btn btn--icon" aria-label="Close"><Mark name="close" size={16} /></button>
	</header>

	<div class="lib-body">
		<div class="lib-col lib-scroll">
			<p class="kicker">Teams</p>
			{#each shownTeams as t (t.key)}
				<section class="lib-team">
					{@render heading(t)}
					{#if t.rotations.length}
						<div class="lib-rots">
							{#each t.rotations as r (r.id)}{@render rotationRow(r)}{/each}
						</div>
					{/if}
				</section>
			{:else}
				<p class="lib-empty">No team matches.</p>
			{/each}
		</div>
		<div class="lib-col lib-scroll">
			{#if shownClosed.length}
				<p class="kicker">Recently closed</p>
				<div class="lib-closed">
					{#each closedOpen ? shownClosed : shownClosed.slice(0, CLOSED_PEEK) as c (c.id)}
						{@render closedRow(c)}
					{/each}
				</div>
				{#if shownClosed.length > CLOSED_PEEK}
					<button class="lib-closed-toggle" onclick={() => (closedOpen = !closedOpen)}>
						{closedOpen ? 'Show fewer' : `${shownClosed.length - CLOSED_PEEK} more`}
						<Mark name="chevron" size={12} />
					</button>
				{/if}
			{/if}
			<p class="kicker">Boards</p>
			{#each shownBoards as b (b.id)}{@render boardCard(b)}{:else}
				<p class="lib-empty">No board matches.</p>
			{/each}
		</div>
	</div>

	{#if toast}<div class="lib-toast" role="status">{toast}</div>{/if}
</div>

{#if confirm}
	{@const c = confirm}
	<div class="lib-confirm-scrim" role="presentation" onclick={() => (confirm = null)}></div>
	<div class="lib-confirm ctx-dark" role="alertdialog" aria-label={c.title}>
		<p class="lib-confirm-title">{c.title}</p>
		<p class="lib-confirm-body">{c.body}</p>
		<div class="lib-confirm-actions">
			<button class="btn" onclick={() => (confirm = null)}>Cancel</button>
			<button
				class="btn btn--primary"
				onclick={() => {
					c.run();
					confirm = null;
				}}>{c.action}</button
			>
		</div>
	</div>
{/if}

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
		gap: 0.9rem;
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

	/* ── search + tags ── */
	.lib-search-wrap {
		position: relative;
		flex: 1 1 22rem;
		max-width: 36rem;
	}
	.lib-search {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 5px;
		min-height: 32px;
		padding: 3px 0.6rem;
		border-radius: var(--r-sm, 3px);
		background: var(--surface-well);
		color: var(--muted);
		cursor: text;
	}
	.lib-search input {
		flex: 1 1 8rem;
		min-width: 6rem;
		border: none;
		background: none;
		color: var(--text);
		font: inherit;
		font-size: var(--fs-sm);
		outline: none;
	}
	.lib-tag {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		height: 24px;
		padding: 0 4px 0 3px;
		border-radius: var(--r-round);
		background: var(--surface-raised);
		color: var(--text);
		font-size: var(--fs-sm);
		white-space: nowrap;
	}
	/* A tag's portrait has no room to overhang: hold it to the disc. */
	.lib-tag :global(.spt),
	.lib-suggest-item :global(.spt) {
		height: var(--d) !important;
		overflow: hidden;
		border-radius: var(--r-round);
	}
	.lib-tag :global(.spt-art),
	.lib-suggest-item :global(.spt-art) {
		top: var(--art-top) !important;
	}
	.lib-tag-icon {
		width: 16px;
		height: 16px;
	}
	.lib-tag-x {
		display: grid;
		place-items: center;
		width: 16px;
		height: 16px;
		padding: 0;
		border: none;
		border-radius: var(--r-round);
		background: none;
		color: var(--muted);
		cursor: pointer;
	}
	.lib-tag-x:hover {
		color: var(--text);
		background: var(--surface-well);
	}
	.lib-suggest {
		position: absolute;
		left: 0;
		right: 0;
		top: calc(100% + 4px);
		z-index: 10;
		display: flex;
		flex-direction: column;
		padding: 4px;
		border-radius: var(--r-sm, 3px);
		background: var(--surface-raised);
		box-shadow: 0 8px 24px rgb(0 0 0 / 0.45);
	}
	.lib-suggest-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 5px 8px;
		border: none;
		border-radius: var(--r-sm, 3px);
		background: none;
		color: var(--text);
		font: inherit;
		font-size: var(--fs-sm);
		text-align: left;
		cursor: pointer;
	}
	.lib-suggest-item--on {
		background: var(--surface-well);
	}
	.lib-suggest-kind {
		margin-left: auto;
	}
	.lib-kbd {
		font-family: var(--font-mono);
		font-size: var(--fs-xs);
		padding: 1px 5px;
		border-radius: var(--r-sm, 3px);
		background: var(--surface-raised);
		color: var(--muted);
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

	.lib-body {
		flex: 1;
		min-height: 0;
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(18rem, 26rem);
		gap: 2rem;
	}
	.lib-col {
		min-height: 0;
	}
	.lib-scroll {
		overflow-y: auto;
		padding-bottom: 1.25rem;
	}
	.kicker {
		margin: 0.25rem 0 0.6rem;
	}
	.lib-empty {
		color: var(--muted);
		font-size: var(--fs-sm);
	}

	/* ── The strip: the whole row is the button ── */
	.lib-strip {
		cursor: pointer;
		border-radius: var(--r-sm, 3px);
		transition: background-color var(--t-snap);
	}
	.lib-strip:focus-visible {
		outline: 2px solid var(--sel-ring);
		outline-offset: 1px;
	}
	/* The hint takes the date's place on hover/focus, so nothing shifts. */
	.lib-end {
		display: inline-grid;
		align-items: center;
		justify-items: end;
		grid-auto-flow: column;
		gap: 4px;
	}
	.lib-end--rot > * {
		grid-area: 1 / 1;
	}
	.lib-hint {
		font-size: var(--fs-xs);
		color: var(--accent);
		white-space: nowrap;
		visibility: hidden;
	}
	.lib-strip:hover .lib-hint,
	.lib-strip:focus-visible .lib-hint {
		visibility: visible;
	}
	.lib-strip:hover .lib-end--rot .lib-date,
	.lib-strip:focus-visible .lib-end--rot .lib-date {
		visibility: hidden;
	}
	/* A hovered ⋯ / Sync / menu is its own target: the strip stands down. */
	.lib-strip:has(.lib-more-btn:hover, .lib-sync:hover, .lib-menu:hover) .lib-hint {
		visibility: hidden;
	}
	.lib-strip:has(.lib-more-btn:hover, .lib-sync:hover, .lib-menu:hover) .lib-end--rot .lib-date {
		visibility: visible;
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
		padding: 0.6rem 0 0.8rem;
		border-bottom: 1px solid var(--line-faint);
	}
	.lib-head {
		display: flex;
		align-items: flex-end;
		gap: 1rem;
		padding: 0.35rem 0.6rem 0.45rem;
		margin: 0 -0.6rem;
	}
	.lib-head:hover:not(:has(.lib-more-btn:hover, .lib-menu:hover)) {
		background: var(--surface-raised);
	}
	.lib-head-text {
		display: flex;
		flex-direction: column;
		gap: 5px;
		flex: 1 1 14rem;
		min-width: 0;
		padding-bottom: 2px;
	}
	.lib-head > .lib-end {
		align-self: center;
	}
	.lib-nick {
		font-family: var(--font-display);
		font-size: var(--fs-lg);
	}
	.lib-meta {
		font-size: var(--fs-xs);
		color: var(--muted);
	}
	.lib-rots {
		list-style: none;
		margin: 0.4rem 0 0;
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
		background: var(--surface-well);
	}
	.lib-rot:hover:not(:has(.lib-more-btn:hover, .lib-sync:hover, .lib-menu:hover)) {
		background: var(--surface-raised);
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
		color: var(--muted);
	}
	.lib-date {
		font-size: var(--fs-xs);
		color: var(--muted);
	}
	.lib-rot .lib-end--rot {
		min-width: 8.5rem;
	}

	/* ── ⋯ ── */
	.lib-more {
		position: relative;
	}
	.lib-menu {
		position: absolute;
		right: 0;
		top: calc(100% + 4px);
		z-index: 5;
		display: flex;
		flex-direction: column;
		min-width: 12rem;
		padding: 4px;
		border-radius: var(--r-sm, 3px);
		background: var(--surface-raised);
		box-shadow: 0 6px 20px rgb(0 0 0 / 0.4);
	}
	.lib-menu-item {
		padding: 6px 10px;
		border: none;
		border-radius: var(--r-sm, 3px);
		background: none;
		color: var(--text);
		font: inherit;
		font-size: var(--fs-sm);
		text-align: left;
		cursor: pointer;
	}
	.lib-menu-item:hover {
		background: var(--surface-well);
	}
	.lib-menu-item--danger {
		color: var(--debuff);
	}

	/* ── boards ── */
	.lib-board {
		padding: 0.7rem 0.8rem;
		background: var(--surface-well);
		margin-bottom: 0.6rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.lib-board:hover:not(:has(.lib-more-btn:hover, .lib-menu:hover)) {
		background: var(--surface-raised);
	}
	.lib-board-head {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
	}
	.lib-board-head .lib-end {
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

	/* ── recently closed ── */
	.lib-closed {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.lib-closed-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.3rem 0.4rem;
	}
	.lib-closed-row:hover:not(:has(.lib-more-btn:hover, .lib-menu:hover)) {
		background: var(--surface-raised);
	}
	.lib-closed-text {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-width: 0;
	}
	.lib-closed-text .lib-end--rot {
		justify-items: start;
	}
	.lib-closed-name {
		font-size: var(--fs-sm);
	}
	.lib-closed-toggle {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		margin: 0.3rem 0 1rem 0.4rem;
		padding: 0;
		border: none;
		background: none;
		color: var(--muted);
		font: inherit;
		font-size: var(--fs-xs);
		cursor: pointer;
	}
	.lib-closed-toggle:hover {
		color: var(--text);
	}

	/* ── demo feedback ── */
	.lib-toast {
		position: absolute;
		left: 50%;
		bottom: 1.25rem;
		transform: translateX(-50%);
		padding: 0.5rem 0.9rem;
		border-radius: var(--r-sm, 3px);
		background: var(--surface-raised);
		box-shadow: 0 6px 20px rgb(0 0 0 / 0.4);
		font-size: var(--fs-sm);
		pointer-events: none;
	}
	.lib-confirm-scrim {
		position: fixed;
		inset: 0;
		background: rgb(0 0 0 / 0.4);
	}
	.lib-confirm {
		position: fixed;
		left: 50%;
		top: 40%;
		transform: translate(-50%, -50%);
		width: min(26rem, calc(100vw - 2rem));
		padding: 1.1rem 1.25rem 1rem;
		border-radius: var(--r-lg, 6px);
		background: var(--surface-raised);
		color: var(--text);
		box-shadow: 0 10px 40px rgb(0 0 0 / 0.5);
	}
	.lib-confirm-title {
		margin: 0 0 0.4rem;
		font-weight: var(--fw-semibold);
	}
	.lib-confirm-body {
		margin: 0 0 1rem;
		font-size: var(--fs-sm);
		color: var(--muted);
	}
	.lib-confirm-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}

	/* ── Narrow: one column (roomy, 47.5rem — $lib/breakpoints.ts) ── */
	@media (max-width: 47.5rem) {
		.lib {
			inset: 3.5rem 0 0;
			border-radius: 0;
			padding: 0.75rem 1rem 0;
		}
		.lib-body {
			display: block;
			overflow-y: auto;
		}
		.lib-col {
			overflow: visible;
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
		.lib-hint {
			display: none;
		}
	}
</style>
