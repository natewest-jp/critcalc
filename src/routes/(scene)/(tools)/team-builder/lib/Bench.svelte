<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import { resolve } from '$app/paths';
	import { getCharacterIndexEntry } from '$lib/data/characterLookup';
	import { siteSettings } from '$lib/stores';
	import { getAvatar, getAvatarFallback, hasAvatar } from '$lib/utils/getAvatar';
	import { elementColors, type ElementKey } from '$lib/utils/elementColors';
	import { deriveTeamComposition } from '$lib/utils/teamComposition';
	import { deriveCoverage, deriveResonances, serializeTeamParam, type TeamSlot } from './team';
	import type { FacetKey } from './facets';

	let {
		slots,
		conCapOf,
		onRemove,
		onClear,
		onOpen,
		onFilterFacet,
		onAudition
	}: {
		slots: TeamSlot[];
		/** Constellation cap per character under the active con mode. */
		conCapOf: (id: string) => number;
		onRemove: (index: number) => void;
		onClear: () => void;
		onOpen: (id: string) => void;
		/** A coverage gap was clicked — drive the Source filter to fill it. */
		onFilterFacet: (facet: FacetKey) => void;
		/** Audition replacements for a filled slot — opens Compare with the
		 *  incumbent pinned as anchor. */
		onAudition: (index: number, incumbentId: string) => void;
	} = $props();

	const members = $derived(slots.map((id) => (id ? getCharacterIndexEntry(id) : null)));
	const filledCount = $derived(members.filter((m) => m !== null).length);

	const resonance = $derived(deriveResonances(members.map((m) => m?.element ?? null)));
	const comp = $derived(deriveTeamComposition(members));
	const coverage = $derived(deriveCoverage(members, conCapOf));

	const colorOf = (element: string | undefined) =>
		(elementColors[(element ?? 'none') as ElementKey] ?? elementColors.none).main;

	function coverageTitle(providers: string[], state: string, label: string): string {
		if (state === 'yes') return `${label} — provided by ${providers.join(', ')}`;
		if (state === 'unknown') return `${label} — unknown (an uncurated kit is in the team)`;
		return `${label} — no slotted character provides this. Click to find one.`;
	}

	const erroredAvatars = new SvelteSet<string>();
	function fallbackFor(id: string): boolean {
		return erroredAvatars.has(id) || !hasAvatar(id);
	}
	function handleAvatarError(id: string, event: Event) {
		const img = event.target as HTMLImageElement;
		if (img.src.includes('-newfit')) {
			img.src = getAvatarFallback(id, 'side', $siteSettings.travelerVariant);
		} else {
			erroredAvatars.add(id);
		}
	}
</script>

<section class="bn vz-panel" aria-label="Team">
	<header class="bn-head">
		<p class="vz-kicker">Team</p>
		{#if filledCount > 0}
			<button class="bn-clear" onclick={onClear}>Clear</button>
		{/if}
	</header>

	<div class="bn-slots">
		{#each slots as id, i (i)}
			{#if id !== null}
				{@const entry = members[i]}
				<div class="bn-slot bn-slot--filled" style:--el-color={colorOf(entry?.element)}>
					<button
						class="bn-slot-open"
						onclick={() => onOpen(id)}
						title="Open {entry?.displayName ?? id}"
					>
						<span class="bn-avatar">
							{#if !fallbackFor(id)}
								<img
									src={getAvatar(
										id,
										$siteSettings.useNewOutfits,
										'side',
										$siteSettings.travelerVariant
									)}
									alt=""
									onerror={(e) => handleAvatarError(id, e)}
								/>
							{:else}
								<span class="bn-initials"
									>{(entry?.displayName ?? id).slice(0, 2).toUpperCase()}</span
								>
							{/if}
						</span>
						<span class="bn-slot-name">{entry?.displayName ?? id}</span>
					</button>
					<button
						class="bn-slot-audition"
						onclick={() => onAudition(i, id)}
						title="Compare {entry?.displayName ?? id} against replacements">⇄ Audition</button
					>
					<button
						class="bn-slot-remove"
						onclick={() => onRemove(i)}
						aria-label="Remove {entry?.displayName ?? id} from team">✕</button
					>
				</div>
			{:else}
				<div class="bn-slot bn-slot--empty" aria-label="Empty team slot">
					<span class="bn-slot-emptymark">+</span>
				</div>
			{/if}
		{/each}
	</div>

	{#if filledCount === 0}
		<p class="bn-hint">
			Add characters from the roster to build a team. Resonance and coverage appear as slots fill.
		</p>
	{:else}
		<div class="bn-factrow">
			{#if resonance.needsFullTeam}
				<span class="bn-resnote">resonance needs a full party of 4</span>
			{:else}
				{#each resonance.active as res (res.key)}
					<span
						class="bn-res"
						style:--el-color={res.element ? colorOf(res.element) : 'var(--muted)'}
						title={res.effect}>{res.label}</span
					>
				{/each}
			{/if}
			{#if comp.natlanCount > 0}
				<span class="bn-fact" title="Nightsoul Burst triggers scale with Natlan members in the team"
					>NB · {comp.natlanCount} Natlan</span
				>
			{/if}
			{#if comp.hasAscendantGleam}
				<span class="bn-fact">Ascendant Gleam</span>
			{/if}
			{#if comp.hasSecretRite}
				<span class="bn-fact">Secret Rite</span>
			{/if}
		</div>

		<div class="bn-coverage">
			{#each coverage as c (c.facet)}
				{#if c.state === 'no'}
					<button
						class="bn-cov bn-cov--no"
						title={coverageTitle(c.providers, c.state, c.label)}
						onclick={() => onFilterFacet(c.facet)}>{c.label} ✗</button
					>
				{:else}
					<span
						class="bn-cov bn-cov--{c.state}"
						title={coverageTitle(c.providers, c.state, c.label)}
						>{c.label} {c.state === 'yes' ? '✓' : '?'}</span
					>
				{/if}
			{/each}
		</div>
	{/if}

	{#if filledCount > 0}
		<a
			class="bn-send"
			href="{resolve('/rotation-planner')}?team={serializeTeamParam(slots)}"
			title="Open the Rotation Planner with this team in the slots">← Send to Rotation Planner</a
		>
	{/if}
</section>

<style>
	.bn {
		gap: 0.7rem;
	}

	.bn-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
	}
	.bn-head .vz-kicker {
		margin: 0;
	}
	.bn-clear {
		padding: 0.15rem 0.4rem;
		border: 1px solid var(--border);
		border-radius: 3px;
		background: none;
		color: var(--muted);
		font-family: var(--font-body);
		font-size: var(--fs-2xs);
		font-weight: var(--fw-semibold);
		cursor: pointer;
		transition:
			border-color 150ms ease,
			color 150ms ease;
	}
	.bn-clear:hover {
		border-color: color-mix(in srgb, var(--accent) 55%, var(--border));
		color: var(--text);
	}

	/* ── Slots (stacked vertically) ───────────────────────────── */
	.bn-slots {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.bn-slot {
		position: relative;
		border-radius: 6px;
	}
	.bn-slot--filled {
		border: 1px solid color-mix(in srgb, var(--el-color) 45%, var(--border));
		background: color-mix(in srgb, var(--el-color) 7%, transparent);
	}

	.bn-slot-open {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.35rem 0.45rem;
		border: none;
		background: none;
		cursor: pointer;
		color: inherit;
		font: inherit;
		text-align: left;
	}
	.bn-avatar {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 34px;
		height: 34px;
		border-radius: 50%;
		border: 1.5px solid var(--el-color);
		overflow: hidden;
		background: rgba(0, 0, 0, 0.5);
		flex-shrink: 0;
	}
	.bn-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		transform: scale(1.333) translateY(-14%);
	}
	.bn-initials {
		font-size: var(--fs-2xs);
		font-weight: var(--fw-bold);
		color: var(--el-color);
	}
	.bn-slot-name {
		min-width: 0;
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		color: var(--text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.bn-slot-remove {
		position: absolute;
		top: 2px;
		right: 3px;
		padding: 1px 4px;
		border: none;
		background: none;
		color: color-mix(in srgb, var(--muted) 55%, transparent);
		font-size: var(--fs-2xs);
		cursor: pointer;
		transition: color 150ms ease;
	}
	.bn-slot-remove:hover {
		color: var(--text);
	}

	.bn-slot-audition {
		display: block;
		width: 100%;
		padding: 0.2rem 0.45rem 0.3rem;
		border: none;
		border-top: 1px solid color-mix(in srgb, var(--el-color) 22%, transparent);
		background: none;
		color: color-mix(in srgb, var(--muted) 88%, transparent);
		font-family: var(--font-body);
		font-size: var(--fs-2xs);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-mid);
		text-align: left;
		cursor: pointer;
		transition:
			color 150ms ease,
			background 150ms ease;
	}
	.bn-slot-audition:hover {
		color: var(--text);
		background: color-mix(in srgb, var(--el-color) 10%, transparent);
	}

	.bn-slot--empty {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 46px;
		border: 1px dashed color-mix(in srgb, var(--border) 80%, transparent);
	}
	.bn-slot-emptymark {
		color: color-mix(in srgb, var(--muted) 45%, transparent);
		font-size: var(--fs-xl);
	}

	.bn-hint {
		margin: 0;
		font-size: var(--fs-xs);
		line-height: var(--lh-normal);
		color: var(--muted);
	}

	/* ── Facts ────────────────────────────────────────────────── */
	.bn-factrow {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
	}
	.bn-res {
		padding: 0.2rem 0.45rem;
		border-radius: 3px;
		border: 1px solid color-mix(in srgb, var(--el-color) 50%, transparent);
		background: color-mix(in srgb, var(--el-color) 10%, transparent);
		font-size: var(--fs-xs);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-mid);
		cursor: help;
	}
	.bn-resnote {
		font-size: var(--fs-2xs);
		font-style: italic;
		color: var(--muted);
	}
	.bn-fact {
		padding: 0.2rem 0.45rem;
		border-radius: 3px;
		border: 1px solid var(--border);
		background: rgba(255, 255, 255, 0.04);
		font-size: var(--fs-xs);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-mid);
	}

	.bn-coverage {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}
	.bn-cov {
		padding: 0.18rem 0.4rem;
		border: none;
		border-radius: 3px;
		font-family: var(--font-body);
		font-size: var(--fs-2xs);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-mid);
		text-transform: uppercase;
	}
	.bn-cov--yes {
		color: var(--text);
		background: color-mix(in srgb, var(--accent) 18%, transparent);
		cursor: help;
	}
	.bn-cov--no {
		color: color-mix(in srgb, var(--muted) 75%, transparent);
		background: rgba(255, 255, 255, 0.04);
		cursor: pointer;
		transition:
			background 150ms ease,
			color 150ms ease;
	}
	.bn-cov--no:hover {
		color: var(--text);
		background: color-mix(in srgb, var(--accent) 16%, transparent);
	}
	.bn-cov--unknown {
		color: var(--el-geo-main, #ddb04a);
		background: color-mix(in srgb, var(--el-geo-main, #ddb04a) 8%, transparent);
		cursor: help;
	}

	.bn-send {
		display: block;
		margin-top: 0.15rem;
		padding: 0.45rem 0.55rem;
		border: 1px solid color-mix(in srgb, var(--accent) 45%, var(--border));
		border-radius: 3px;
		background: color-mix(in srgb, var(--accent) 12%, transparent);
		color: var(--text);
		font-family: var(--font-body);
		font-size: var(--fs-xs);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-mid);
		text-align: center;
		text-decoration: none;
		transition: background 150ms ease;
	}
	.bn-send:hover {
		background: color-mix(in srgb, var(--accent) 22%, transparent);
	}

	/* Narrow screens: the Bench flattens from a left-edge column into a compact
	   horizontal strip above the Source (the pre-redesign TeamStrip posture),
	   so it doesn't eat a screenful before the roster. */
	@media (max-width: 900px) {
		.bn-slots {
			flex-direction: row;
			flex-wrap: wrap;
		}
		.bn-slot--filled,
		.bn-slot--empty {
			flex: 1 1 130px;
			min-width: 130px;
		}
	}
</style>
