<script lang="ts">
	import { getCharacterIndexEntry } from '$lib/data/characterLookup';
	import { getLoadedCharacter, loadCharacter } from '$lib/data/characterData';
	import { constellations, siteSettings } from '$lib/stores';
	import { getAvatar, getAvatarFallback, hasAvatar } from '$lib/utils/getAvatar';
	import { elementColors, type ElementKey } from '$lib/utils/elementColors';
	import {
		deriveCharacterCapabilities,
		type DerivedCapability
	} from '$lib/capabilities/deriveCapabilities';
	import type { ConMode } from './facets';
	import { conCapFor } from './facets';
	import { KIND_LABEL, KIND_ORDER, TARGET_LABEL, caveatText } from './capabilityText';

	let {
		id,
		conMode,
		onClose
	}: {
		id: string;
		conMode: ConMode;
		onClose: () => void;
	} = $props();

	const entry = $derived(getCharacterIndexEntry(id));
	const color = $derived(
		(elementColors[(entry?.element ?? 'none') as ElementKey] ?? elementColors.none).main
	);

	// Full payload — lazy chunk, reactive once landed.
	$effect(() => {
		void loadCharacter(id);
	});
	const data = $derived(getLoadedCharacter(id));

	const myCon = $derived($constellations[id] ?? 0);
	const viewCon = $derived(conCapFor(conMode, myCon));

	// Full provenance derivation, client-side from the loaded payload — the same
	// brain as the build-time index, so badges and card can never disagree.
	const capabilities = $derived(data ? deriveCharacterCapabilities(data).capabilities : []);
	const sortedCaps = $derived(
		[...capabilities].sort(
			(a, b) =>
				KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
				a.minConstellation - b.minConstellation
		)
	);

	// Convention (settled 2026-05-12, constellationFilter.ts): the planner hides
	// locked effects; the Team Builder shows everything with a locked badge.
	const locked = (cap: DerivedCapability) => cap.minConstellation > viewCon;

	function sectionLabel(cap: DerivedCapability): string {
		const { section, abilityName, variant } = cap.source;
		const name = variant ? `${abilityName} (${variant})` : abilityName;
		if (section === 'passive') return `${name} · passive`;
		if (section === 'constellation') return name;
		return name;
	}

	// Timing reference — skill/burst rows.
	const castAbilities = $derived(
		(data?.abilities ?? []).filter((a) => a.abilityType === 'skill' || a.abilityType === 'burst')
	);

	let avatarErrored = $state(false);
	const avatarFallback = $derived(avatarErrored || !hasAvatar(id));
	function handleAvatarError(event: Event) {
		const img = event.target as HTMLImageElement;
		if (img.src.includes('-newfit')) {
			img.src = getAvatarFallback(id, 'side', $siteSettings.travelerVariant);
		} else {
			avatarErrored = true;
		}
	}

	function handleBackdropClick(e: MouseEvent) {
		if ((e.target as HTMLElement).classList.contains('dc-backdrop')) onClose();
	}
	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="dc-backdrop" onclick={handleBackdropClick} role="presentation">
	<div
		class="dc-panel"
		style:--el-color={color}
		role="dialog"
		aria-modal="true"
		aria-label="{entry?.displayName ?? id} details"
	>
		<!-- ── Header ─────────────────────────────────────────── -->
		<header class="dc-header">
			<div class="dc-avatar">
				{#if !avatarFallback}
					<img
						src={getAvatar(id, $siteSettings.useNewOutfits, 'side', $siteSettings.travelerVariant)}
						alt=""
						onerror={handleAvatarError}
					/>
				{:else}
					<span class="dc-avatar-initials"
						>{(entry?.displayName ?? id).slice(0, 2).toUpperCase()}</span
					>
				{/if}
			</div>
			<div class="dc-title">
				<h2>{entry?.displayName ?? id}</h2>
				<p class="dc-subtitle">
					<span style:color>{entry?.element ?? '?'}</span>
					· {entry?.weapon ?? '?'} · {entry?.rarity}★{entry?.region ? ` · ${entry.region}` : ''}
				</p>
			</div>
			<button class="dc-close" onclick={onClose} aria-label="Close">✕</button>
		</header>

		{#if entry && !entry.curated}
			<p class="dc-stub-note">
				Kit not yet curated — capability data below is incomplete. Missing entries mean “unknown”,
				not “no”.
			</p>
		{/if}

		<!-- ── Your constellation ─────────────────────────────── -->
		<section>
			<p class="vz-kicker">Your constellation</p>
			<div class="dc-constepper" role="radiogroup" aria-label="Your constellation">
				{#each [0, 1, 2, 3, 4, 5, 6] as level (level)}
					<button
						class="dc-con-btn"
						class:active={myCon === level}
						role="radio"
						aria-checked={myCon === level}
						onclick={() => constellations.setLevel(id, level)}>C{level}</button
					>
				{/each}
			</div>
			<p class="dc-note">Saved to your roster — “My roster” filtering across the site uses it.</p>
		</section>

		<!-- ── Capabilities ───────────────────────────────────── -->
		<section>
			<p class="vz-kicker">Capabilities</p>
			{#if !data}
				<p class="dc-note">Loading kit data…</p>
			{:else if sortedCaps.length === 0}
				<p class="dc-note">
					Nothing team-facing derives from this kit{entry?.curated
						? ' — likely a selfish carry, or curation hasn’t covered its utility yet'
						: ''}.
				</p>
			{:else}
				<ul class="dc-caps">
					{#each sortedCaps as cap, i (i)}
						<li class="dc-cap" class:dc-cap--locked={locked(cap)}>
							<span class="dc-cap-kind"
								>{KIND_LABEL[cap.kind] ?? cap.kind}{cap.kind === 'buff' && cap.detail
									? `: ${cap.detail}`
									: cap.kind === 'resShred' || cap.kind === 'infuse'
										? `: ${cap.detail}`
										: ''}</span
							>
							<span class="dc-cap-src">
								{sectionLabel(cap)}
								{#if cap.target}· {TARGET_LABEL[cap.target] ?? cap.target}{/if}
								{#if cap.via === 'tag'}
									<span
										class="dc-cap-tagged"
										title="Marked on the ability, but target/scaling not yet curated">tagged</span
									>
								{/if}
							</span>
							<span class="dc-cap-gate">
								{#if cap.minConstellation > 0}
									<span class="dc-gate-chip" class:dc-gate-chip--locked={locked(cap)}
										>C{cap.minConstellation}{locked(cap) ? ' 🔒' : ''}</span
									>
								{:else}
									<span class="dc-gate-chip dc-gate-chip--base">C0</span>
								{/if}
							</span>
							{#if cap.caveats.length > 0}
								<span class="dc-cap-caveats">{cap.caveats.map(caveatText).join(' · ')}</span>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<!-- ── Timing reference ───────────────────────────────── -->
		{#if data && castAbilities.length > 0}
			<section>
				<p class="vz-kicker">Timing reference</p>
				<table class="dc-timing">
					<tbody>
						{#each castAbilities as ability (ability.id)}
							<tr>
								<td class="dc-timing-slot">{ability.abilityType === 'skill' ? 'E' : 'Q'}</td>
								<td class="dc-timing-name">{ability.name}</td>
								<td class="dc-timing-val">
									{#if 'cooldown' in ability && ability.cooldown}{ability.cooldown}s CD{/if}
									{#if 'charges' in ability && ability.charges && ability.charges > 1}
										· {ability.charges} charges{/if}
									{#if 'energyCost' in ability && ability.energyCost}
										· {ability.energyCost} energy{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</section>
		{/if}
	</div>
</div>

<style>
	.dc-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.72);
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px;
	}

	.dc-panel {
		box-sizing: border-box;
		width: 100%;
		max-width: 620px;
		max-height: min(780px, calc(100svh - 48px));
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
		padding: 1.2rem 1.3rem 1.4rem;
		background: var(--surface);
		border: 1px solid color-mix(in srgb, var(--el-color) 35%, var(--border));
		border-radius: 9px;
		font-family: var(--font-mono);
		color: var(--text);
	}

	/* ── Header ───────────────────────────────────────────────── */
	.dc-header {
		display: flex;
		align-items: center;
		gap: 0.9rem;
	}

	.dc-avatar {
		width: 56px;
		height: 56px;
		flex-shrink: 0;
		border-radius: 50%;
		border: 1.5px solid var(--el-color);
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.5);
	}
	.dc-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		transform: scale(1.333) translateY(-14%);
	}
	.dc-avatar-initials {
		font-size: 0.9rem;
		font-weight: 700;
		color: var(--el-color);
	}

	.dc-title {
		flex: 1;
		min-width: 0;
	}
	.dc-title h2 {
		margin: 0;
		font-family: var(--font-display);
		font-size: 1.25rem;
		font-weight: 600;
	}
	.dc-subtitle {
		margin: 0.15rem 0 0;
		font-size: 0.72rem;
		color: var(--muted);
		text-transform: capitalize;
	}

	.dc-close {
		align-self: flex-start;
		background: none;
		border: 1px solid var(--border);
		border-radius: 3px;
		color: var(--muted);
		font-size: 0.9rem;
		line-height: 1;
		padding: 0.3rem 0.5rem;
		cursor: pointer;
		transition:
			color 150ms ease,
			border-color 150ms ease;
	}
	.dc-close:hover {
		color: var(--text);
		border-color: color-mix(in srgb, var(--accent) 55%, var(--border));
	}

	.dc-stub-note {
		margin: 0;
		padding: 0.55rem 0.7rem;
		border-radius: 3px;
		border: 1px solid color-mix(in srgb, var(--el-geo-main, #ddb04a) 40%, transparent);
		background: color-mix(in srgb, var(--el-geo-main, #ddb04a) 8%, transparent);
		font-size: 0.7rem;
		line-height: 1.5;
		color: var(--text);
	}

	.dc-note {
		margin: 0.5rem 0 0;
		font-size: 0.68rem;
		line-height: 1.5;
		color: var(--muted);
	}

	/* ── Constellation stepper ────────────────────────────────── */
	.dc-constepper {
		display: flex;
		border: 1px solid var(--border);
		border-radius: 3px;
		overflow: hidden;
		margin-top: 0.55rem;
	}
	.dc-con-btn {
		flex: 1;
		padding: 0.4rem 0;
		border: none;
		background: none;
		color: var(--muted);
		font-family: var(--font-mono);
		font-size: 0.7rem;
		font-weight: 600;
		cursor: pointer;
		transition:
			background 150ms ease,
			color 150ms ease;
	}
	.dc-con-btn + .dc-con-btn {
		border-left: 1px solid var(--border);
	}
	.dc-con-btn:hover {
		color: var(--text);
	}
	.dc-con-btn.active {
		background: color-mix(in srgb, var(--el-color) 22%, transparent);
		color: var(--text);
	}

	/* ── Capabilities list ────────────────────────────────────── */
	.dc-caps {
		list-style: none;
		margin: 0.55rem 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.dc-cap {
		display: grid;
		grid-template-columns: minmax(108px, auto) minmax(0, 1fr) auto;
		gap: 0.15rem 0.7rem;
		align-items: baseline;
		padding: 0.45rem 0.6rem;
		border-radius: 3px;
		background: rgba(255, 255, 255, 0.04);
		font-size: 0.72rem;
	}
	.dc-cap--locked {
		opacity: 0.5;
	}

	.dc-cap-kind {
		font-weight: 600;
		letter-spacing: 0.03em;
	}

	.dc-cap-src {
		color: var(--muted);
		min-width: 0;
	}

	.dc-cap-tagged {
		margin-left: 0.35rem;
		padding: 0 4px;
		border-radius: 3px;
		background: rgba(255, 255, 255, 0.07);
		font-size: 0.58rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.dc-cap-gate {
		justify-self: end;
	}

	.dc-gate-chip {
		padding: 1px 6px;
		border-radius: 3px;
		font-size: 0.62rem;
		font-weight: 600;
		background: color-mix(in srgb, var(--el-color) 18%, transparent);
	}
	.dc-gate-chip--base {
		background: rgba(255, 255, 255, 0.07);
		color: var(--muted);
	}
	.dc-gate-chip--locked {
		background: rgba(255, 255, 255, 0.06);
		color: var(--muted);
	}

	.dc-cap-caveats {
		grid-column: 1 / -1;
		font-size: 0.64rem;
		font-style: italic;
		color: color-mix(in srgb, var(--muted) 80%, transparent);
	}

	/* ── Timing table ─────────────────────────────────────────── */
	.dc-timing {
		margin-top: 0.55rem;
		width: 100%;
		border-collapse: collapse;
		font-size: 0.72rem;
	}
	.dc-timing td {
		padding: 0.35rem 0.6rem 0.35rem 0;
		border-bottom: 1px solid color-mix(in srgb, var(--border) 50%, transparent);
		vertical-align: baseline;
	}
	.dc-timing-slot {
		width: 1.6rem;
		font-weight: 700;
		color: var(--el-color);
	}
	.dc-timing-name {
		color: var(--text);
	}
	.dc-timing-val {
		text-align: right;
		white-space: nowrap;
		color: var(--muted);
	}
</style>
