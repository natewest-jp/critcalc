<!--
  THE TRASH (notices design §5; ⚓ Nate 2026-10-26): ONE Trash outside every
  profile, like Settings, NEWEST FIRST (↻ Nate 2026-10-26: grouped by
  profile, a busy profile pushed another's fresh deletes out of sight), with
  one heading per stretch of one profile's things (`trashRuns`).
  ⚓ Every row wears its profile's colour (Nate: the Trash is universal, so
  each thing in it says which profile it goes back to). Restore puts a thing
  back where it came from; a thing whose profile is in the Trash brings the
  profile back with it, and the stretch says so before you press it.
  Strings are working copy.
-->
<script lang="ts">
	import Mark from './Mark.svelte';
	import SidePortrait from './SidePortrait.svelte';
	import { siteSettings } from '$lib/stores';
	import { notices } from '$lib/notices.svelte';
	import { storageSession } from '$lib/storage/session.svelte';
	import { lineupLabel, rotationLabel } from '$lib/storage/convert';
	import { pictureOf, type ProfileRecord } from '$lib/storage/records';
	import { TRASH_MS, type TrashEntry, type TrashRun } from '$lib/storage/trash';
	import { colourValue, pictureUrl } from '$lib/profileLook';

	let runs = $state<TrashRun[]>([]);
	let loaded = $state(false);
	$effect(() => {
		void storageSession.version;
		void storageSession.profiles.length;
		void storageSession.trash().then((r) => {
			runs = r;
			loaded = true;
		});
	});

	const KIND: Record<string, string> = {
		rotation: 'Rotation',
		lineup: 'Lineup',
		team: 'Team',
		profile: 'Profile'
	};
	const kindOf = (e: TrashEntry): string =>
		e.store === 'teams' ? 'team' : e.store === 'profiles' ? 'profile' : e.record.type;
	const label = (e: TrashEntry): string => {
		if (e.store === 'profiles') return e.record.name;
		if (e.store === 'teams') return e.record.name || rotationLabel(e.record.slots);
		const d = e.record;
		return d.name ?? (d.type === 'rotation' ? rotationLabel(d.body.slots) : lineupLabel(d.body));
	};
	const slotsOf = (e: TrashEntry): readonly (string | null)[] | null =>
		e.store === 'teams'
			? e.record.slots
			: e.store === 'documents' && e.record.type === 'rotation'
				? e.record.body.slots
				: null;
	const teamCount = (e: TrashEntry): number =>
		e.store === 'documents' && e.record.type === 'lineup' ? e.record.body.teams.length : 0;

	const DAY = 24 * 60 * 60 * 1000;
	const ago = (t: number): string => {
		const m = Math.round((Date.now() - t) / 60_000);
		if (m < 1) return 'Deleted just now';
		if (m < 60) return `Deleted ${m} min ago`;
		const h = Math.round(m / 60);
		if (h < 24) return `Deleted ${h} h ago`;
		const days = Math.round(h / 24);
		return days === 1 ? 'Deleted yesterday' : `Deleted ${days} days ago`;
	};
	const left = (t: number): string => {
		const days = Math.max(1, Math.ceil((t + TRASH_MS - Date.now()) / DAY));
		return days === 1 ? 'Cleared tomorrow' : `${days} days left`;
	};

	const pictureOfProfile = (p: ProfileRecord) =>
		pictureUrl(pictureOf(p), $siteSettings.useNewOutfits, p.twin);

	async function emptyTrash(): Promise<void> {
		const ok = await notices.ask({
			title: 'Empty Trash?',
			body: 'Everything in it is deleted for good.',
			confirm: 'Empty Trash',
			cancel: 'Keep it',
			danger: true
		});
		if (ok) await storageSession.emptyTrash();
	}
</script>

<div class="trash">
	<div class="trash-acts">
		<p class="lede">Deleted work stays here for 30 days, then it’s cleared.</p>
		{#if runs.length}
			<button class="btn btn--danger" onclick={emptyTrash}
				><Mark name="delete" size={14} /> Empty Trash</button
			>
		{/if}
	</div>

	{#if loaded && !runs.length}
		<p class="empty">The Trash is empty.</p>
	{/if}

	{#each runs as r (r.profile.id + r.entries[0].record.id)}
		{@const p = r.profile}
		{@const url = pictureOfProfile(p)}
		<section class="group" style:--pp-color={colourValue(p.colour)} aria-label={p.name}>
			<header class="group-head">
				<span class="pp">
					{#if url}<img src={url} alt="" />{:else}<span class="pp-fallback">{p.name[0]}</span>{/if}
				</span>
				<span class="group-text">
					<span class="group-name">{p.name}</span>
					{#if r.gone}
						<span class="group-meta">Deleted profile</span>
					{:else if p.id === storageSession.profile?.id}
						<span class="group-meta">Your current profile</span>
					{/if}
				</span>
			</header>
			{#if r.gone && r.entries.some((e) => e.store !== 'profiles')}
				<p class="group-note">Restoring anything of {p.name}’s brings the profile back too.</p>
			{/if}

			<ul class="rows">
				{#each r.entries as e (e.record.id)}
					{@const slots = slotsOf(e)}
					<li class="row">
						<span class="row-kind">{KIND[kindOf(e)]}</span>
						{#if slots}
							<span class="portraits">
								{#each { length: 4 } as _, i (i)}
									<SidePortrait id={slots[i] ?? null} size={32} />
								{/each}
							</span>
						{/if}
						<span class="row-text">
							<span class="row-label">{label(e)}</span>
							<span class="row-meta">
								{#if teamCount(e)}<span
										>{teamCount(e) === 1 ? '1 team' : `${teamCount(e)} teams`}</span
									>{/if}
								<span>{ago(e.record.updatedAt)}</span>
								<span>{left(e.record.updatedAt)}</span>
							</span>
						</span>
						<button
							class="btn row-restore"
							onclick={() => storageSession.untrash(e.store, e.record.id)}
							><Mark name="undo" size={14} /> Restore</button
						>
					</li>
				{/each}
			</ul>
		</section>
	{/each}
</div>

<style>
	.trash {
		display: flex;
		flex-direction: column;
		gap: 1.6rem;
		max-width: 56rem;
	}
	.trash-acts {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem 1rem;
	}
	.lede {
		margin: 0;
		font-size: var(--fs-md);
		color: var(--muted);
	}
	.empty {
		margin: 0;
		font-size: var(--fs-lg);
		color: var(--muted);
	}

	/* ── A profile's group: its picture in its ring, as the switcher draws
	      it, and every row below in the same colour ── */
	.group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.group-head {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	.pp {
		flex: none;
		display: grid;
		place-items: center;
		width: 2.25rem;
		height: 2.25rem;
		border-radius: 50%;
		box-shadow: 0 0 0 2px var(--pp-color);
		background: var(--surface-raised);
		overflow: hidden;
	}
	.pp img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.pp-fallback {
		font-weight: var(--fw-semibold);
		color: var(--pp-color);
	}
	.group-text {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.group-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: var(--fs-lg);
		font-weight: var(--fw-semibold);
		color: var(--text);
	}
	.group-meta {
		font-size: var(--fs-sm);
		color: var(--muted);
	}
	.group-note {
		margin: 0;
		font-size: var(--fs-sm);
		color: var(--muted);
	}

	/* ── A row: the Library's row, with the profile's colour down its edge ── */
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
		align-items: center;
		gap: 1rem;
		padding: 0.55rem 0.6rem 0.55rem 0.9rem;
		border-radius: var(--r-sm);
		background: var(--surface-raised);
		/* The profile's mark: an inset edge, so it follows the corner. */
		box-shadow: inset 3px 0 0 var(--pp-color);
	}
	.row-kind {
		flex: none;
		width: 4.5rem;
		font-size: var(--fs-sm);
		color: var(--muted);
	}
	.portraits {
		display: inline-flex;
		flex: none;
		gap: 2px;
	}
	.row-text {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}
	.row-label {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: var(--fs-lg);
		font-weight: var(--fw-semibold);
		color: var(--text);
	}
	.row-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0 0.8rem;
		font-size: var(--fs-sm);
		color: var(--muted);
	}
	.row-restore {
		flex: none;
	}

	/* Phone (compact, 40rem — $lib/breakpoints.ts): the kind rides the
	   meta's line instead of a column of its own. */
	@media (max-width: 40rem) {
		.row {
			flex-wrap: wrap;
			gap: 0.5rem 0.75rem;
		}
		.row-kind {
			width: auto;
			flex-basis: 100%;
		}
		.portraits {
			display: none;
		}
		.group-head {
			flex-wrap: wrap;
		}
	}
</style>
