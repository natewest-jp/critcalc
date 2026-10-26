<!--
  A PROFILE's own section of the menu state (design §2.3; build plan §13,
  phase 2d; ⚓ Nate 2026-10-22: a section, not a dialog). `new` adds an
  account; `edit` changes the active one in place, as everything else saves
  itself. A name, one of the seven element colours for the picture's frame,
  and a picture: the art set, or any character.
  ↻ Nate 2026-10-26: colours and pictures are no longer exclusive or tied to
  the roster. A loved character you don't own is a fine picture, and a new
  profile has no roster yet. A new profile still starts on the least worn
  colour, and a name matching another account is pointed out, never refused.
  Only Theorycraft's name is reserved.

  Strings are working copy.
-->
<script lang="ts">
	import Mark from './Mark.svelte';
	import { menu } from '$lib/menuState.svelte';
	import { notices } from '$lib/notices.svelte';
	import { storageSession } from '$lib/storage/session.svelte';
	import { pictureOf, type Picture, type ProfileColour } from '$lib/storage/records';
	import { PROFILE_PICTURES } from '$lib/profilePictures.generated';
	import {
		COLOUR_NAME,
		REAL_COLOURS,
		colourValue,
		isReservedName,
		nextColour,
		pictureUrl
	} from '$lib/profileLook';
	import {
		characterKey,
		getAllCharacterIndex,
		getCharacterIndexEntry,
		searchCharacterIndex
	} from '$lib/data/characterLookup';
	import { constellations, loadout, ownership, siteSettings } from '$lib/stores';
	import { hasAvatar } from '$lib/utils/getAvatar';

	let { mode }: { mode: 'new' | 'edit' } = $props();

	const profile = $derived(storageSession.profile);
	const editing = $derived(mode === 'edit' && profile?.kind === 'real' ? profile : null);
	const twin = $derived(editing?.twin ?? 'aether');

	// ── The new profile's draft (an edit writes straight through) ───────────
	let name = $state('');
	let colour = $state<ProfileColour | null>(null);
	let picture = $state<Picture | null>(null);

	const shownColour = $derived(editing ? editing.colour : colour);
	const shownPicture = $derived(editing ? pictureOf(editing) : picture);

	// A new profile starts on the least worn colour.
	$effect(() => {
		if (mode === 'new' && !colour) {
			colour = nextColour(
				storageSession.profiles.filter((p) => p.kind === 'real').map((p) => p.colour)
			);
		}
	});

	// ── The name: what is being typed, checked as it is ─────────────────────
	let typed = $state<string | null>(null);
	$effect(() => {
		void editing?.id;
		typed = null;
	});
	const nameNow = $derived((editing ? (typed ?? editing.name) : name).trim());
	const reserved = $derived(isReservedName(nameNow));
	const twinNamed = $derived(
		nameNow
			? storageSession.profiles.find(
					(p) =>
						p.kind === 'real' &&
						p.id !== editing?.id &&
						p.name.toLowerCase() === nameNow.toLowerCase()
				)
			: undefined
	);

	function pickColour(c: ProfileColour): void {
		if (editing) void storageSession.updateProfile(editing.id, { colour: c });
		else colour = c;
	}

	function pickPicture(p: Picture): void {
		if (editing) void storageSession.updateProfile(editing.id, { picture: p });
		else picture = p;
	}

	const samePicture = (a: Picture | null, b: Picture) =>
		!!a &&
		a.kind === b.kind &&
		(a.kind === 'art' ? a.name : a.id) === (b.kind === 'art' ? b.name : b.id);

	// ── Character pictures: any character, the profile's own first ─────────
	/** ⚓ ONE Traveler (characterLookup): the variants share a portrait. */
	const pictureName = (id: string) =>
		id.startsWith('traveler_') ? 'Traveler' : (getCharacterIndexEntry(id)?.displayName ?? id);
	/** ⚓ `blank` is the notation's empty seat, not a character. */
	const oneEach = (ids: string[]): string[] => {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local to one call, never read reactively
		const seen = new Set<string>();
		return ids
			.filter((id) => {
				if (id === 'blank') return false;
				const k = characterKey(id);
				return !seen.has(k) && !!seen.add(k);
			})
			.sort((a, b) => pictureName(a).localeCompare(pictureName(b)));
	};
	// A character with no circle art yet would 404.
	const allCharacters = oneEach(getAllCharacterIndex().map((e) => e.id)).filter(hasAvatar);

	let query = $state('');
	const owned = $derived(
		editing
			? oneEach(
					Object.entries(editing.roster.ownership)
						.filter(([, m]) => m === 'owned')
						.map(([id]) => id)
						.filter((id) => getCharacterIndexEntry(id))
				)
			: []
	);
	const ownedKeys = $derived(new Set(owned.map(characterKey)));
	const found = $derived(
		query.trim()
			? oneEach(searchCharacterIndex(query.trim(), Infinity).map((e) => e.id)).filter(hasAvatar)
			: allCharacters.filter((id) => !ownedKeys.has(characterKey(id)))
	);

	async function create(): Promise<void> {
		if (!colour || reserved) return;
		const made = await storageSession.createProfile({
			name,
			colour,
			...(picture ? { picture } : {})
		});
		// ⚓ The next step is the roster (§9.2) — only for a profile that exists:
		// otherwise the Roster would show Theorycraft's invitation.
		if (made) menu.show('roster');
	}

	function commitName(e: Event): void {
		if (!editing) return;
		const v = (e.currentTarget as HTMLInputElement).value.trim();
		if (v && v !== editing.name && !isReservedName(v))
			void storageSession.updateProfile(editing.id, { name: v });
	}

	// ── Clear data (2026-10-26, from Settings' old Reset saved data) ────────
	// ⚓ It lives HERE because it acts on THIS profile: Settings sits outside
	// every profile, and a reset there aimed at "whoever is active". Pick what
	// to clear, then one dialog says what goes and what can come back.
	const CLEARABLE = [
		['constellations', 'Constellation levels'],
		['loadouts', 'Loadouts'],
		['ownership', 'Owned and wishlisted'],
		['rotations', 'Rotations'],
		['lineups', 'Lineups'],
		['teams', 'Teams']
	] as const;
	type Clearable = (typeof CLEARABLE)[number][0];
	let toClear = $state<Record<Clearable, boolean>>({
		constellations: false,
		loadouts: false,
		ownership: false,
		rotations: false,
		lineups: false,
		teams: false
	});
	const anyToClear = $derived(Object.values(toClear).some(Boolean));
	async function clearData(): Promise<void> {
		const target = editing;
		if (!target || !anyToClear) return;
		const c = toClear;
		const trashed = c.rotations || c.lineups || c.teams;
		const gone = c.constellations || c.loadouts || c.ownership;
		const body = [
			trashed && 'Rotations, lineups, and teams go to the Trash for 30 days.',
			gone && 'Constellation levels, loadouts, and owned marks can’t be brought back.'
		]
			.filter(Boolean)
			.join(' ');
		const ok = await notices.ask({
			title: `Clear ${target.name}’s data?`,
			body,
			confirm: 'Clear',
			cancel: 'Keep it',
			danger: true
		});
		if (!ok) return;
		if (c.constellations) constellations.clear();
		if (c.loadouts) loadout.clear();
		if (c.ownership) ownership.clear();
		if (c.rotations) await storageSession.removeAll('rotation');
		if (c.lineups) await storageSession.removeAll('lineup');
		if (c.teams) await storageSession.removeAllTeams();
		for (const k of Object.keys(toClear) as Clearable[]) toClear[k] = false;
		notices.toast('success', `Cleared ${target.name}’s data`);
	}

	// ── Delete, asked as a DIALOG (notices §3.4) ────────────────────────────
	// The one delete that isn't a click-again: its consequence is a LIST
	// (everything in the account goes with it), which a button's label cannot
	// hold (Nate, 2026-10-26). ↻ Since the Trash it no longer offers a backup:
	// the whole account can come back from there for 30 days (§5).
	const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
	async function del(): Promise<void> {
		const target = editing;
		if (!target) return;
		const live = (xs: { deleted?: unknown }[]) => xs.filter((x) => !x.deleted).length;
		const [rot, lin, tms] = await Promise.all([
			storageSession.documents('rotation').then(live),
			storageSession.documents('lineup').then(live),
			storageSession.teams().then(live)
		]);
		const what = [
			plural(rot, 'rotation', 'rotations'),
			plural(lin, 'lineup', 'lineups'),
			plural(tms, 'team', 'teams')
		].join(', ');
		const ok = await notices.ask({
			title: `Delete ${target.name}?`,
			body: `Its roster and ${what} go with it. You can restore it from the Trash for 30 days.`,
			confirm: 'Delete account',
			cancel: 'Keep it',
			danger: true
		});
		if (!ok) return;
		await storageSession.deleteProfile(target.id);
		menu.show('profile/new');
	}
</script>

{#snippet character(id: string)}
	{@const p: Picture = { kind: 'character', id }}
	{@const url = pictureUrl(p, $siteSettings.useNewOutfits, twin)}
	<button
		class="pic"
		class:is-on={samePicture(shownPicture, p)}
		title={pictureName(id)}
		aria-label={pictureName(id)}
		aria-pressed={samePicture(shownPicture, p)}
		style:--sw={shownColour ? colourValue(shownColour) : 'var(--accent)'}
		onclick={() => pickPicture(p)}
	>
		{#if url}<img src={url} alt="" loading="lazy" />{/if}
	</button>
{/snippet}

{#if mode === 'edit' && !editing}
	<p class="lede">Theorycraft is built in and can't be changed.</p>
{:else}
	{#if mode === 'new'}
		<p class="lede">
			A profile is one Genshin account, kept in this browser: its roster, teams, rotations, and
			lineups. Shared links open in Theorycraft, so your profiles stay as you left them.
		</p>
	{/if}

	<div class="form">
		<label class="pf-field">
			<span class="pf-name">Name</span>
			{#if editing}
				<input
					class="text"
					value={editing.name}
					oninput={(e) => (typed = e.currentTarget.value)}
					onchange={commitName}
					maxlength="40"
					aria-invalid={reserved}
				/>
			{:else}
				<input
					class="text"
					bind:value={name}
					placeholder="My account"
					maxlength="40"
					aria-invalid={reserved}
				/>
			{/if}
			{#if reserved}
				<span class="pf-hint pf-hint--warn">Theorycraft is the built-in profile’s name.</span>
			{:else if twinNamed}
				<span class="pf-hint">Another account is called {twinNamed.name}.</span>
			{/if}
		</label>

		<div class="pf-field">
			<span class="pf-name">Color</span>
			<div class="swatches" role="radiogroup" aria-label="Color">
				{#each REAL_COLOURS as c (c)}
					<button
						class="swatch"
						class:is-on={shownColour === c}
						role="radio"
						aria-checked={shownColour === c}
						aria-label={COLOUR_NAME[c]}
						title={COLOUR_NAME[c]}
						style:--sw={colourValue(c)}
						onclick={() => pickColour(c)}
					></button>
				{/each}
			</div>
		</div>

		<div class="pf-field">
			<span class="pf-name">Picture</span>
			<div class="pictures">
				{#each PROFILE_PICTURES as art (art.id)}
					{@const p: Picture = { kind: 'art', name: art.id }}
					<button
						class="pic"
						class:is-on={samePicture(shownPicture, p)}
						title={art.name}
						aria-label={art.name}
						aria-pressed={samePicture(shownPicture, p)}
						style:--sw={shownColour ? colourValue(shownColour) : 'var(--accent)'}
						onclick={() => pickPicture(p)}
					>
						<img src={art.url} alt="" loading="lazy" />
					</button>
				{/each}
			</div>
			<div class="pf-chars">
				<input
					class="text pf-search"
					type="search"
					bind:value={query}
					placeholder="Search characters"
					aria-label="Search characters"
				/>
				{#if owned.length && !query.trim()}
					<span class="pf-sub">Characters you own</span>
					<div class="pictures">
						{#each owned as id (id)}{@render character(id)}{/each}
					</div>
					<span class="pf-sub">Everyone else</span>
				{/if}
				<div class="pictures">
					{#each found as id (id)}{@render character(id)}{/each}
				</div>
				{#if !found.length}<span class="pf-sub">No character matches “{query.trim()}”.</span>{/if}
			</div>
		</div>

		{#if editing}
			<div class="pf-field">
				<span class="pf-name">Clear data</span>
				<div class="pf-clear">
					{#each CLEARABLE as [key, label] (key)}
						<label class="check">
							<input type="checkbox" bind:checked={toClear[key]} />
							<span class="check-box"></span>
							{label}
						</label>
					{/each}
				</div>
				<div>
					<button class="btn btn--danger" disabled={!anyToClear} onclick={() => void clearData()}
						><Mark name="clear" /> Clear…</button
					>
				</div>
			</div>
		{/if}

		<div class="acts">
			{#if editing}
				<button class="btn btn--danger" onclick={() => void del()}
					><Mark name="delete" /> Delete profile</button
				>
			{:else}
				<button class="btn btn--primary" disabled={!colour || reserved} onclick={create}
					><Mark name="plus" /> Add account</button
				>
			{/if}
		</div>
	</div>
{/if}

<style>
	.lede {
		max-width: 36rem;
		margin: 0 0 1.5rem;
		font-size: var(--fs-lg);
		line-height: 1.5;
		color: var(--text);
	}
	.form {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		max-width: 44rem;
	}
	.pf-field {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.pf-name {
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		color: var(--muted);
	}
	.pf-sub {
		margin-top: 0.5rem;
		font-size: var(--fs-md);
		color: var(--muted);
	}
	.pf-hint {
		font-size: var(--fs-md);
		color: var(--muted);
	}
	.pf-hint--warn {
		color: var(--ui-warning);
	}
	.pf-chars {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-top: 0.75rem;
	}
	.text.pf-search {
		width: min(16rem, 100%);
		font-size: var(--fs-md);
	}
	.text {
		width: min(22rem, 100%);
		padding: 0.4rem 0.6rem;
		border: 1px solid var(--border);
		border-radius: var(--r-sm);
		background: var(--surface-well);
		color: var(--text);
		font: inherit;
		font-size: var(--fs-lg);
	}

	.swatches {
		display: flex;
		gap: 0.6rem;
	}
	.swatch {
		width: 2rem;
		height: 2rem;
		padding: 0;
		border: none;
		border-radius: 50%;
		background: var(--sw);
		cursor: pointer;
		box-shadow:
			0 0 0 2px var(--surface),
			0 0 0 2px transparent;
		transition: box-shadow var(--t-snap);
	}
	.swatch.is-on {
		box-shadow:
			0 0 0 2px var(--surface),
			0 0 0 4px var(--text);
	}

	.pictures {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(3.5rem, 1fr));
		gap: 0.6rem;
	}
	.pic {
		aspect-ratio: 1;
		padding: 0;
		border: none;
		border-radius: 50%;
		background: var(--surface-well);
		cursor: pointer;
		box-shadow: 0 0 0 2px transparent;
		transition: box-shadow var(--t-snap);
	}
	.pic img {
		width: 100%;
		height: 100%;
		border-radius: 50%;
		object-fit: cover;
	}
	.pic:hover {
		box-shadow: 0 0 0 2px var(--line-soft);
	}
	.pic.is-on {
		box-shadow:
			0 0 0 2px var(--surface),
			0 0 0 4px var(--sw);
	}
	/* Two columns, filled DOWN: the roster's three, then the saved work's
	   three (CLEARABLE's order), so each column is one kind of thing. */
	.pf-clear {
		display: grid;
		grid-auto-flow: column;
		grid-template-rows: repeat(3, auto);
		grid-template-columns: repeat(2, max-content);
		gap: 0.55rem 2.5rem;
	}
	@media (max-width: 40rem) /* compact — $lib/breakpoints.ts */ {
		.pf-clear {
			grid-auto-flow: row;
			grid-template-rows: none;
			grid-template-columns: max-content;
		}
	}
	.acts {
		display: flex;
		gap: 0.5rem;
	}
</style>
