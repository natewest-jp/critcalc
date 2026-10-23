<!--
  COMPARE, in the Planner's toolbar beside the Total (design §4.6, §5.3; build
  plan §13, phase 4). ⚓ A pair, not a mode: two rotations, ONE showing, ⇅
  flips between them (⌃` too), ⛔ never drawn over each other. Unpaired, it
  offers the two ways in: Duplicate and compare (copy this rotation, keep the
  original as the other side) and Compare with… (the Library, picking).

  The sides are named by their PROFILES when the pair crosses one (a what-if:
  your profile and Theorycraft's white copy), else A and B in the order made.
  Loaded under the switch only. Strings are working copy.
-->
<script lang="ts">
	import Mark from './Mark.svelte';
	import BandMenu from './BandMenu.svelte';
	import { storageSession } from '$lib/storage/session.svelte';
	import { menu } from '$lib/menuState.svelte';
	import { rotationTabs as rt } from '$lib/rotationTabs.svelte';
	import { THEORYCRAFT_ID } from '$lib/storage/records';

	const pair = $derived(storageSession.plannerPair);
	const nameOfProfile = (id: string) =>
		storageSession.profiles.find((p) => p.id === id)?.name ?? 'Theorycraft';

	/** The two sides, left to right, and which one is showing. */
	const sides = $derived.by(() => {
		if (!pair) return null;
		const self = { ...pair.self, current: true };
		const other = { profileId: pair.profileId, createdAt: pair.createdAt, current: false };
		const cross = self.profileId !== other.profileId;
		// A what-if: the real profile first, Theorycraft's copy second.
		const ordered = cross
			? [self, other].sort(
					(a, b) => Number(a.profileId === THEORYCRAFT_ID) - Number(b.profileId === THEORYCRAFT_ID)
				)
			: [self, other].sort((a, b) => a.createdAt - b.createdAt);
		return ordered.map((s, i) => ({
			...s,
			label: cross ? nameOfProfile(s.profileId) : i === 0 ? 'A' : 'B',
			guest: cross && s.profileId === THEORYCRAFT_ID
		}));
	});

	const flip = () => pair && void storageSession.open(pair.id);

	function pick(): void {
		menu.pickFor = rt.activeTabId;
		menu.show('rotations');
	}
</script>

{#if pair && sides}
	<span class="cmp" role="group" aria-label="Comparison">
		<button
			class="cmp-flip"
			type="button"
			title={`Show ${pair.label} (⌃\`)`}
			aria-label={`Show the other rotation: ${pair.label}`}
			onclick={flip}
		>
			<Mark name="swap" size={13} />
			{#each sides as s, i (i)}
				<span class="cmp-side" class:is-on={s.current} class:is-guest={s.guest}>{s.label}</span>
			{/each}
		</button>
		<button
			class="cmp-end"
			type="button"
			title="End the comparison (both rotations stay)"
			aria-label="End the comparison"
			onclick={() => void storageSession.endPair()}><Mark name="close" size={12} /></button
		>
	</span>
{:else if storageSession.active}
	<BandMenu mark="swap" label="Compare" ariaLabel="Compare" size="sm" align="end">
		{#snippet items(close)}
			<button
				class="band-menu-item"
				role="menuitem"
				onclick={() => {
					close();
					void storageSession.duplicateAndCompare();
				}}>Duplicate and compare</button
			>
			<button
				class="band-menu-item"
				role="menuitem"
				onclick={() => {
					close();
					pick();
				}}>Compare with…</button
			>
		{/snippet}
	</BandMenu>
{/if}

<style>
	.cmp {
		display: inline-flex;
		align-items: center;
		gap: 2px;
	}
	.cmp-flip {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		height: var(--ui-ctl-h, 28px);
		padding: 0 0.6rem;
		border: none;
		border-radius: var(--r-sm);
		background: none;
		color: var(--text);
		font: inherit;
		font-size: var(--fs-sm);
		cursor: pointer;
		transition: background var(--t-snap);
	}
	.cmp-flip:hover {
		background: var(--surface-hover);
	}
	.cmp-side {
		padding: 0.05rem 0.4rem;
		border-radius: var(--r-sm);
		color: var(--muted);
		font-weight: var(--fw-semibold);
		white-space: nowrap;
	}
	.cmp-side.is-on {
		color: var(--text);
		box-shadow: inset 0 0 0 1px var(--sel-ring);
	}
	/* ⚓ The guest's side wears Theorycraft's white (§4.6), with its word. */
	.cmp-side.is-guest.is-on {
		box-shadow: inset 0 0 0 1.5px var(--profile-theorycraft);
	}
	.cmp-end {
		display: grid;
		place-items: center;
		width: 1.6rem;
		height: 1.6rem;
		padding: 0;
		border: none;
		border-radius: var(--r-sm);
		background: none;
		color: var(--muted);
		cursor: pointer;
	}
	.cmp-end:hover {
		background: var(--surface-hover);
		color: var(--text);
	}
</style>
