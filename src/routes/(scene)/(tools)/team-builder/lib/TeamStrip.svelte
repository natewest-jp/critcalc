<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import { getCharacterIndexEntry } from '$lib/data/characterLookup';
	import { siteSettings } from '$lib/stores';
	import { getAvatar, getAvatarFallback, hasAvatar } from '$lib/utils/getAvatar';
	import { elementColors, type ElementKey } from '$lib/utils/elementColors';
	import { deriveTeamComposition } from '$lib/utils/teamComposition';
	import { deriveCoverage, deriveResonances, type TeamSlot } from './team';

	let {
		slots,
		conCapOf,
		onRemove,
		onClear,
		onOpen
	}: {
		slots: TeamSlot[];
		/** Constellation cap per character under the active con mode. */
		conCapOf: (id: string) => number;
		onRemove: (index: number) => void;
		onClear: () => void;
		onOpen: (id: string) => void;
	} = $props();

	const members = $derived(slots.map((id) => (id ? getCharacterIndexEntry(id) : null)));
	const filledCount = $derived(members.filter((m) => m !== null).length);

	const resonance = $derived(deriveResonances(members.map((m) => m?.element ?? null)));
	const comp = $derived(deriveTeamComposition(members));
	const coverage = $derived(deriveCoverage(members, conCapOf));

	const colorOf = (element: string | undefined) =>
		(elementColors[(element ?? 'none') as ElementKey] ?? elementColors.none).main;

	function coverageTitle(providers: string[], state: string): string {
		if (state === 'yes') return `provided by ${providers.join(', ')}`;
		if (state === 'unknown') return 'Unknown — an uncurated kit is in the team';
		return 'No slotted character provides this';
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

<section class="ts vz-panel" aria-label="Team">
	<header class="ts-head">
		<p class="vz-kicker">Team</p>
		{#if filledCount > 0}
			<button class="ts-clear" onclick={onClear}>Clear team</button>
		{/if}
	</header>

	<div class="ts-body">
		<div class="ts-slots">
			{#each slots as id, i (i)}
				{#if id !== null}
					{@const entry = members[i]}
					<div class="ts-slot ts-slot--filled" style:--el-color={colorOf(entry?.element)}>
						<button
							class="ts-slot-open"
							onclick={() => onOpen(id)}
							title="Open {entry?.displayName ?? id} details"
						>
							<span class="ts-avatar">
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
									<span class="ts-initials"
										>{(entry?.displayName ?? id).slice(0, 2).toUpperCase()}</span
									>
								{/if}
							</span>
							<span class="ts-slot-name">{entry?.displayName ?? id}</span>
						</button>
						<button
							class="ts-slot-remove"
							onclick={() => onRemove(i)}
							aria-label="Remove {entry?.displayName ?? id} from team">✕</button
						>
					</div>
				{:else}
					<div class="ts-slot ts-slot--empty" aria-label="Empty team slot">
						<span class="ts-slot-emptymark">·</span>
					</div>
				{/if}
			{/each}
		</div>

		<div class="ts-facts">
			{#if filledCount === 0}
				<p class="ts-hint">
					Assemble a team — add characters from their detail cards. Facts (resonance, coverage)
					derive as slots fill.
				</p>
			{:else}
				<div class="ts-factrow">
					{#if resonance.needsFullTeam}
						<span class="ts-resnote">resonance needs a full party of 4</span>
					{:else}
						{#each resonance.active as res (res.key)}
							<span
								class="ts-res"
								style:--el-color={res.element ? colorOf(res.element) : 'var(--muted)'}
								title={res.effect}>{res.label}</span
							>
						{/each}
					{/if}
					{#if comp.natlanCount > 0}
						<span
							class="ts-fact"
							title="Nightsoul Burst triggers scale with Natlan members in the team"
							>Nightsoul Burst · {comp.natlanCount} Natlan</span
						>
					{/if}
					{#if comp.hasAscendantGleam}
						<span class="ts-fact">Moonsign: Ascendant Gleam</span>
					{/if}
					{#if comp.hasSecretRite}
						<span class="ts-fact">Hexerei: Secret Rite</span>
					{/if}
				</div>

				<div class="ts-coverage">
					{#each coverage as c (c.facet)}
						<span class="ts-cov ts-cov--{c.state}" title={coverageTitle(c.providers, c.state)}
							>{c.label}
							{c.state === 'yes' ? '✓' : c.state === 'unknown' ? '?' : '✗'}</span
						>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</section>

<style>
	.ts {
		gap: 0.6rem;
	}

	.ts-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
	}
	.ts-head .vz-kicker {
		margin: 0;
	}

	.ts-clear {
		padding: 0.25rem 0.5rem;
		border: 1px solid var(--border);
		border-radius: 3px;
		background: none;
		color: var(--muted);
		font-family: var(--font-mono);
		font-size: 0.64rem;
		font-weight: 600;
		cursor: pointer;
		transition:
			border-color 150ms ease,
			color 150ms ease;
	}
	.ts-clear:hover {
		border-color: color-mix(in srgb, var(--accent) 55%, var(--border));
		color: var(--text);
	}

	.ts-body {
		display: flex;
		gap: 1.1rem;
		align-items: flex-start;
		flex-wrap: wrap;
	}

	/* ── Slots ────────────────────────────────────────────────── */
	.ts-slots {
		display: flex;
		gap: 0.45rem;
		flex-shrink: 0;
	}

	.ts-slot {
		position: relative;
		width: 74px;
		border-radius: 6px;
	}

	.ts-slot--filled {
		border: 1px solid color-mix(in srgb, var(--el-color) 45%, var(--border));
		background: color-mix(in srgb, var(--el-color) 6%, transparent);
	}

	.ts-slot-open {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		width: 100%;
		padding: 0.45rem 0.2rem 0.4rem;
		border: none;
		background: none;
		cursor: pointer;
		color: inherit;
		font: inherit;
	}

	.ts-avatar {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 38px;
		height: 38px;
		border-radius: 50%;
		border: 1.5px solid var(--el-color);
		overflow: hidden;
		background: rgba(0, 0, 0, 0.5);
	}
	.ts-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		transform: scale(1.333) translateY(-14%);
	}
	.ts-initials {
		font-size: 0.6rem;
		font-weight: 700;
		color: var(--el-color);
	}

	.ts-slot-name {
		max-width: 100%;
		font-family: var(--font-mono);
		font-size: 0.6rem;
		font-weight: 600;
		color: var(--text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.ts-slot-remove {
		position: absolute;
		top: 1px;
		right: 1px;
		padding: 2px 5px;
		border: none;
		background: none;
		color: color-mix(in srgb, var(--muted) 60%, transparent);
		font-size: 0.58rem;
		cursor: pointer;
		transition: color 150ms ease;
	}
	.ts-slot-remove:hover {
		color: var(--text);
	}

	.ts-slot--empty {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 76px;
		border: 1px dashed color-mix(in srgb, var(--border) 80%, transparent);
	}
	.ts-slot-emptymark {
		color: color-mix(in srgb, var(--muted) 50%, transparent);
		font-size: 1.1rem;
	}

	/* ── Facts ────────────────────────────────────────────────── */
	.ts-facts {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-width: 0;
		flex: 1;
	}

	.ts-hint {
		margin: 0;
		font-size: 0.68rem;
		line-height: 1.5;
		color: var(--muted);
		align-self: center;
	}

	.ts-factrow {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		align-items: baseline;
	}

	.ts-res {
		padding: 0.25rem 0.55rem;
		border-radius: 3px;
		border: 1px solid color-mix(in srgb, var(--el-color) 50%, transparent);
		background: color-mix(in srgb, var(--el-color) 10%, transparent);
		font-family: var(--font-mono);
		font-size: 0.66rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		cursor: help;
	}

	.ts-resnote {
		font-family: var(--font-mono);
		font-size: 0.64rem;
		font-style: italic;
		color: var(--muted);
	}

	.ts-fact {
		padding: 0.25rem 0.55rem;
		border-radius: 3px;
		border: 1px solid var(--border);
		background: rgba(255, 255, 255, 0.04);
		font-family: var(--font-mono);
		font-size: 0.66rem;
		font-weight: 600;
		letter-spacing: 0.04em;
	}

	.ts-coverage {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}

	.ts-cov {
		padding: 0.2rem 0.45rem;
		border-radius: 3px;
		font-family: var(--font-mono);
		font-size: 0.6rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		cursor: help;
	}
	.ts-cov--yes {
		color: var(--text);
		background: color-mix(in srgb, var(--accent) 18%, transparent);
	}
	.ts-cov--no {
		color: color-mix(in srgb, var(--muted) 70%, transparent);
		background: rgba(255, 255, 255, 0.04);
	}
	.ts-cov--unknown {
		color: var(--el-geo-main, #ddb04a);
		background: color-mix(in srgb, var(--el-geo-main, #ddb04a) 8%, transparent);
	}
</style>
