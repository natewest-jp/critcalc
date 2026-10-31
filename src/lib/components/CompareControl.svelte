<!--
  COMPARE, on the Planner's BENCH (design §4.6; build plan §13, phase 4).
  ⚓ A pair, not a mode: two rotations, ONE showing, a flip between them (⌃`
  too), ⛔ never drawn over each other. Unpaired, it offers the two ways in:
  Duplicate and compare (copy this rotation, keep the original as the other
  side) and Compare with… (the Library, picking). ↻ 2026-10-27: the original
  is HOME, on the left; the comparison's side carries the ✕ that ends the
  pair and returns home.

  ↻ 2026-10-24 (toolbar refinement, ⚓ Nate): it left the toolbar for the
  bench. A comparison is a second VERSION OF THIS TEAM — it is usually born on
  the bench, when a constellation you do not own opens a Theorycraft copy — so
  it fits neither bar's question, and the bench has the room to name BOTH
  sides: a segmented pair, the side on screen chosen, rather than a button
  that names only the side it would switch to. Two forms, one logic:
  - `foot`  the desktop column's foot, above Save as team (Save as team comes
            and goes; the pair under your pointer must not move when it does)
  - `rail`  the end of the phone bench's rail, open or folded (ToolStack
            `benchRail`); `compact` drops the unpaired plate's word
  ⛔ Text, never profile pictures: beside a bench of character portraits a
  picture reads as a character, and many profile pictures ARE characters.

  The sides are named by their PROFILES when the pair crosses one (a what-if:
  your profile and Theorycraft's white copy), else A and B in the order made.
  Strings are working copy.
-->
<script lang="ts">
	import Mark from './Mark.svelte';
	import BandMenu from './BandMenu.svelte';
	import { storageSession } from '$lib/storage/session.svelte';
	import { menu } from '$lib/menuState.svelte';
	import { rotationTabs as rt } from '$lib/rotationTabs.svelte';
	import { THEORYCRAFT_ID } from '$lib/storage/records';

	let {
		form,
		compact = false,
		paired = $bindable(false)
	}: {
		form: 'foot' | 'rail';
		/** `rail` only: the folded bench, where the unpaired plate is its mark. */
		compact?: boolean;
		/** Out: a pair exists (the rail gives it the team status's room). */
		paired?: boolean;
	} = $props();

	const pair = $derived(storageSession.plannerPair);
	const nameOfProfile = (id: string) =>
		storageSession.profiles.find((p) => p.id === id)?.name ?? 'Theorycraft';

	/** The two sides, left to right, and which one is showing. ⚓ HOME is
	 *  the left (Nate 2026-10-27): the side the comparison was started from.
	 *  A pair from before `pairHome` keeps its old order — a what-if's real
	 *  profile first, else the older — and its left side counts as home. */
	const sides = $derived.by(() => {
		if (!pair) return null;
		const self = { ...pair.self, current: true, which: 'self' as const };
		const other = {
			profileId: pair.profileId,
			createdAt: pair.createdAt,
			current: false,
			which: 'other' as const
		};
		const cross = self.profileId !== other.profileId;
		const ordered = pair.home
			? pair.home === 'self'
				? [self, other]
				: [other, self]
			: cross
				? [self, other].sort(
						(a, b) =>
							Number(a.profileId === THEORYCRAFT_ID) - Number(b.profileId === THEORYCRAFT_ID)
					)
				: [self, other].sort((a, b) => a.createdAt - b.createdAt);
		return ordered.map((s, i) => ({
			...s,
			// The phone's rail has no room for two profile names: a what-if's
			// sides say what they ARE there (⚓ Nate 2026-10-24).
			label: cross
				? form === 'rail'
					? s.profileId === THEORYCRAFT_ID
						? 'What-if'
						: 'Original'
					: nameOfProfile(s.profileId)
				: i === 0
					? 'A'
					: 'B',
			guest: cross && s.profileId === THEORYCRAFT_ID,
			home: i === 0
		}));
	});

	$effect(() => {
		paired = !!sides;
	});

	const flip = () => pair && void storageSession.open(pair.id);

	/** An empty blank is not a document yet, so there is nothing to duplicate
	 *  (the same test the session's save applies). */
	const blank = $derived(
		!rt.activeTab.notation.trim() && (rt.activeTab.slots ?? []).every((s) => !s)
	);

	function pick(): void {
		menu.pickFor = rt.activeTabId;
		menu.show('rotations');
	}
</script>

{#snippet pairControl()}
	<div class="cmp-pair">
		<div class="segment cmp-seg" role="group" aria-label="Comparing">
			{#each sides ?? [] as s (s.which)}
				{@const pick = () => !s.current && flip()}
				{@const pickTitle = s.current ? `${s.label}: on screen` : `Switch to ${s.label} (⌃\`)`}
				{#if s.home}
					<button
						class="btn btn--sm"
						class:is-active={s.current}
						class:is-guest={s.guest}
						type="button"
						aria-pressed={s.current}
						title={pickTitle}
						onclick={pick}><span class="cmp-label">{s.label}</span></button
					>
				{:else}
					<!-- ⚓ THE ✕ RIDES IN THE COMPARISON'S OWN SIDE (Nate 2026-10-27):
					     it closes THIS one and returns home, so it sits on what it
					     closes. Two buttons in one segment, never one nested in the
					     other. -->
					<span class="cmp-away" class:is-active={s.current} class:is-guest={s.guest}>
						<button
							class="btn btn--sm cmp-away-pick"
							type="button"
							aria-pressed={s.current}
							title={pickTitle}
							onclick={pick}><span class="cmp-label">{s.label}</span></button
						>
						<button
							class="btn btn--sm btn--icon cmp-away-end"
							type="button"
							aria-label="End the comparison"
							title={`End the comparison and return to ${sides?.[0].label ?? 'the original'} (both rotations stay)`}
							onclick={() => void storageSession.endPair(sides?.[0].which ?? 'self')}
							><Mark name="close" size={12} /></button
						>
					</span>
				{/if}
			{/each}
		</div>
	</div>
{/snippet}

{#snippet ways(done: () => void)}
	<button
		class="band-menu-item"
		role="menuitem"
		disabled={blank}
		onclick={() => {
			done();
			void storageSession.duplicateAndCompare();
		}}>Duplicate and compare</button
	>
	<button
		class="band-menu-item"
		role="menuitem"
		onclick={() => {
			done();
			pick();
		}}>Compare with…</button
	>
{/snippet}

{#if form === 'rail'}
	{#if sides}
		<!-- No room for the kicker: the swap mark says it, as on the plate it
		     replaces. -->
		<div class="cmp-rail" title="Comparing">
			<!-- Folded, the faces need the room, and the pair with its ✕ reads
			     as one without it. -->
			{#if !compact}<span class="cmp-rail-mark" aria-hidden="true"><Mark name="swap" /></span>{/if}
			{@render pairControl()}
		</div>
	{:else if storageSession.active}
		<BandMenu
			mark="swap"
			label={compact ? undefined : 'Compare'}
			ariaLabel="Compare"
			size="sm"
			{compact}
			align="end"
		>
			{#snippet items(done)}{@render ways(done)}{/snippet}
		</BandMenu>
	{/if}
{:else if sides}
	<div class="cmp-foot">
		<span class="cmp-kicker">Comparing</span>
		{@render pairControl()}
	</div>
{:else if storageSession.active}
	<span class="cmp-start">
		<BandMenu mark="swap" label="Compare" ariaLabel="Compare" size="sm" align="start">
			{#snippet items(done)}{@render ways(done)}{/snippet}
		</BandMenu>
	</span>
{/if}

<style>
	.cmp-foot {
		display: flex;
		flex-direction: column;
		gap: 4px;
		width: 100%;
	}
	.cmp-seg > :global(.btn) {
		padding-inline: 0.35rem;
	}
	.cmp-kicker {
		font-size: var(--fs-xs);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		color: var(--muted);
	}
	.cmp-pair {
		display: flex;
		align-items: center;
		gap: 4px;
		min-width: 0;
	}
	.cmp-seg {
		display: flex;
		flex: 1 1 auto;
		min-width: 0;
	}
	.cmp-seg > :global(.btn),
	.cmp-away {
		flex: 1 1 0;
		min-width: 0;
	}
	/* The comparison's side: one segment holding its pick and its ✕. The
	   SEGMENT wears the chosen fill (app.css, .segment > .btn.is-active), so
	   the two buttons read as one side; each keeps its own hover. */
	.cmp-away {
		display: flex;
		border-radius: var(--r-xs);
	}
	.cmp-away > :global(.btn) {
		border-radius: var(--r-xs);
		background: transparent;
	}
	.cmp-away-pick {
		flex: 1 1 auto;
		min-width: 0;
		padding-inline: 0.35rem;
	}
	.cmp-away-end {
		flex: none;
		min-width: 0;
		padding-inline: 0.3rem;
		color: var(--muted);
	}
	@media (hover: hover) {
		.cmp-away > :global(.btn:hover) {
			background: var(--fill-hover);
		}
		.cmp-away-end:hover {
			color: var(--text);
		}
	}
	.cmp-away.is-active {
		background: color-mix(in srgb, var(--accent) 20%, var(--btn-face));
	}
	.cmp-away.is-active .cmp-away-pick {
		color: var(--ink-active);
	}
	.cmp-label {
		overflow: hidden;
		text-overflow: ellipsis;
	}
	/* ⚓ The guest's side wears Theorycraft's white (§4.6). */
	.cmp-seg > :global(.btn.is-guest.is-active),
	.cmp-away.is-guest.is-active {
		box-shadow: inset 0 0 0 1.5px var(--profile-theorycraft);
	}
	.cmp-start,
	.cmp-start > :global(.band-menu-trigger) {
		display: flex;
		width: 100%;
	}
	/* The phone rail's end: the pair takes what the rail leaves. */
	.cmp-rail {
		display: flex;
		align-items: center;
		gap: 4px;
		flex: 1 1 auto;
		min-width: 0;
	}
	.cmp-rail-mark {
		display: inline-flex;
		color: var(--muted);
	}
	.cmp-rail .cmp-pair {
		flex: 1 1 auto;
	}
</style>
