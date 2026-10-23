<!--
  A PROFILE's own section of the menu state (design §2.3; build plan §13,
  phase 2d; ⚓ Nate 2026-10-22: a section, not a dialog). `new` adds an
  account; `edit` changes the active one in place, as everything else saves
  itself. A name, one of the seven element colours (exclusive: one profile
  each, so seven at most), and a picture: the art set, or a character the
  profile owns.

  Strings are working copy.
-->
<script lang="ts">
	import Mark from './Mark.svelte';
	import { menu } from '$lib/menuState.svelte';
	import { storageSession } from '$lib/storage/session.svelte';
	import { pictureOf, type Picture, type ProfileColour } from '$lib/storage/records';
	import { PROFILE_PICTURES } from '$lib/profilePictures.generated';
	import { COLOUR_NAME, REAL_COLOURS, colourValue, pictureUrl } from '$lib/profileLook';
	import { getCharacterIndexEntry } from '$lib/data/characterLookup';
	import { siteSettings } from '$lib/stores';

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

	// A new profile starts on the first colour nobody wears.
	$effect(() => {
		if (mode === 'new' && !colour) {
			colour = REAL_COLOURS.find((c) => !storageSession.colourOwner(c)) ?? null;
		}
	});

	const takenBy = (c: ProfileColour) => {
		const owner = storageSession.colourOwner(c);
		return owner && owner.id !== editing?.id ? owner : undefined;
	};

	function pickColour(c: ProfileColour): void {
		if (takenBy(c)) return;
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

	/** ⚓ The circle avatar of any character the profile OWNS (§2.3). */
	const ownedCharacters = $derived(
		editing
			? Object.entries(editing.roster.ownership)
					.filter(([, m]) => m === 'owned')
					.map(([id]) => id)
					.filter((id) => getCharacterIndexEntry(id))
					.sort((a, b) =>
						(getCharacterIndexEntry(a)?.displayName ?? a).localeCompare(
							getCharacterIndexEntry(b)?.displayName ?? b
						)
					)
			: []
	);

	async function create(): Promise<void> {
		if (!colour) return;
		await storageSession.createProfile({ name, colour, ...(picture ? { picture } : {}) });
		// ⚓ The next step is the roster (§9.2).
		menu.show('roster');
	}

	function commitName(e: Event): void {
		if (!editing) return;
		const v = (e.currentTarget as HTMLInputElement).value.trim();
		if (v && v !== editing.name) void storageSession.updateProfile(editing.id, { name: v });
	}

	// ── Delete, confirmed by a second click ─────────────────────────────────
	let armed = $state(false);
	let armTimer: ReturnType<typeof setTimeout> | undefined;
	function del(): void {
		if (!editing) return;
		if (!armed) {
			armed = true;
			clearTimeout(armTimer);
			armTimer = setTimeout(() => (armed = false), 4000);
			return;
		}
		armed = false;
		void storageSession.deleteProfile(editing.id);
		menu.show('profile/new');
	}
</script>

{#if mode === 'new' && !storageSession.canAddProfile}
	<p class="lede">
		This browser holds seven accounts, one for each element color. Delete one to add another.
	</p>
{:else if mode === 'edit' && !editing}
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
				<input class="text" value={editing.name} onchange={commitName} maxlength="40" />
			{:else}
				<input class="text" bind:value={name} placeholder="My account" maxlength="40" />
			{/if}
		</label>

		<div class="pf-field">
			<span class="pf-name">Color</span>
			<div class="swatches" role="radiogroup" aria-label="Color">
				{#each REAL_COLOURS as c (c)}
					{@const owner = takenBy(c)}
					<button
						class="swatch"
						class:is-on={shownColour === c}
						role="radio"
						aria-checked={shownColour === c}
						aria-label={COLOUR_NAME[c]}
						title={owner ? `${COLOUR_NAME[c]} · ${owner.name}` : COLOUR_NAME[c]}
						disabled={!!owner}
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
			{#if editing}
				<span class="pf-sub"
					>{ownedCharacters.length
						? 'Characters you own'
						: 'Characters you own appear here once you mark them in the Roster.'}</span
				>
				{#if ownedCharacters.length}
					<div class="pictures">
						{#each ownedCharacters as id (id)}
							{@const p: Picture = { kind: 'character', id }}
							{@const url = pictureUrl(p, $siteSettings.useNewOutfits, twin)}
							<button
								class="pic"
								class:is-on={samePicture(shownPicture, p)}
								title={getCharacterIndexEntry(id)?.displayName ?? id}
								aria-label={getCharacterIndexEntry(id)?.displayName ?? id}
								aria-pressed={samePicture(shownPicture, p)}
								style:--sw={colourValue(editing.colour)}
								onclick={() => pickPicture(p)}
							>
								{#if url}<img src={url} alt="" loading="lazy" />{/if}
							</button>
						{/each}
					</div>
				{/if}
			{/if}
		</div>

		<div class="acts">
			{#if editing}
				<button class="btn btn--danger" class:is-confirming={armed} onclick={del}
					><Mark name={armed ? 'warn' : 'delete'} />
					{armed ? 'Delete it and everything in it?' : 'Delete profile'}</button
				>
			{:else}
				<button class="btn btn--primary" disabled={!colour} onclick={create}
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
	/* Taken by another profile: a colour is exclusive (§2.3). */
	.swatch:disabled {
		cursor: not-allowed;
		background: color-mix(in srgb, var(--sw) 25%, transparent);
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
	.acts {
		display: flex;
		gap: 0.5rem;
	}
</style>
