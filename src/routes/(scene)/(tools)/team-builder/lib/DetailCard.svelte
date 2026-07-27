<script lang="ts">
	import { getCharacterIndexEntry } from '$lib/data/characterLookup';
	import { getLoadedCharacter, loadCharacter } from '$lib/data/characterData';
	import { constellations, siteSettings, ownership } from '$lib/stores';
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
		onClose,
		teamState,
		onToggleTeam,
		docked = false
	}: {
		id: string;
		conMode: ConMode;
		onClose: () => void;
		/** Slot membership for the team strip; undefined hides the button. */
		teamState?: 'in' | 'out' | 'full';
		onToggleTeam?: (id: string) => void;
		/** Placed in the Stage column: dock in-flow on wide screens (overlay on
		 *  narrow). Without it the card is always a centered overlay. */
		docked?: boolean;
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
	const myOwnership = $derived($ownership[id]);

	// Setting a constellation implies you own the character — enforced here at the
	// call site, not baked into store cross-coupling.
	function setCon(level: number): void {
		constellations.setLevel(id, level);
		if (!$ownership[id]) ownership.setMark(id, 'owned');
	}
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
		// When docked in-flow, there's no scrim to click out of — close via ✕/Esc.
		if (!docked && (e.target as HTMLElement).classList.contains('dc-backdrop')) onClose();
	}
	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div
	class="dc-backdrop"
	class:dc-backdrop--docked={docked}
	onclick={handleBackdropClick}
	role="presentation"
>
	<div
		class="dc-panel"
		class:dc-panel--docked={docked}
		style:--el-color={color}
		role="dialog"
		aria-modal={!docked}
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
				{#if onToggleTeam && teamState}
					<button
						class="dc-team"
						class:dc-team--in={teamState === 'in'}
						disabled={teamState === 'full'}
						onclick={() => onToggleTeam(id)}
						title={teamState === 'full' ? 'All four team slots are filled' : undefined}
					>
						{teamState === 'in'
							? '✓ In team — remove'
							: teamState === 'full'
								? 'Team full'
								: '+ Add to team'}
					</button>
				{/if}
			</div>
			<button class="btn btn--icon dc-close" onclick={onClose} aria-label="Close">✕</button>
		</header>

		{#if entry && !entry.curated}
			{#if entry.caps.length === 0}
				<p class="dc-stub-note">
					Kit not yet curated — capability data below is incomplete. Missing entries mean “unknown”,
					not “no”.
				</p>
			{:else}
				<p class="dc-stub-note">
					Capabilities below are complete. Frame timing isn’t curated yet, so only this character’s
					rotation timing is approximate in the Planner.
				</p>
			{/if}
		{/if}

		<!-- ── Your roster ────────────────────────────────────── -->
		<section>
			<p class="kicker">Your roster</p>
			<div class="dc-own" role="group" aria-label="Ownership">
				<button
					class="btn"
					class:is-active={myOwnership === 'owned'}
					aria-pressed={myOwnership === 'owned'}
					onclick={() => ownership.setMark(id, myOwnership === 'owned' ? null : 'owned')}
					>● Owned</button
				>
				<button
					class="btn dc-own-btn--wish"
					class:is-active={myOwnership === 'wishlist'}
					aria-pressed={myOwnership === 'wishlist'}
					onclick={() => ownership.setMark(id, myOwnership === 'wishlist' ? null : 'wishlist')}
					>★ Wishlist</button
				>
			</div>
			<div class="segment dc-constepper" role="radiogroup" aria-label="Your constellation">
				{#each [0, 1, 2, 3, 4, 5, 6] as level (level)}
					<button
						class="btn dc-con-btn"
						class:is-active={myCon === level}
						role="radio"
						aria-checked={myCon === level}
						onclick={() => setCon(level)}>C{level}</button
					>
				{/each}
			</div>
			<p class="dc-note">
				Saved to your roster — “My roster” filtering across the site uses it. Setting a
				constellation marks the character owned.
			</p>
		</section>

		<!-- ── Capabilities ───────────────────────────────────── -->
		<section>
			<p class="kicker">Capabilities</p>
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
				<p class="kicker">Timing reference</p>
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
		font-family: var(--font-body);
		color: var(--text);
	}

	/* Docked in the Stage column (wide screens only): the scrim dissolves and the
	   panel sits in normal flow, filling the sticky column. Below the breakpoint
	   the `docked` flag is inert and the card stays a centered overlay. */
	@media (min-width: 1200px) {
		.dc-backdrop--docked {
			position: static;
			inset: auto;
			z-index: auto;
			display: block;
			padding: 0;
			background: none;
		}
		.dc-panel--docked {
			max-width: none;
			max-height: none;
			border-radius: 6px;
		}
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
		font-size: var(--fs-lg);
		font-weight: var(--fw-bold);
		color: var(--el-color);
	}

	.dc-title {
		flex: 1;
		min-width: 0;
	}
	.dc-title h2 {
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--fs-3xl);
		font-weight: var(--fw-semibold);
	}
	.dc-subtitle {
		margin: 0.15rem 0 0;
		font-size: var(--fs-md);
		color: var(--muted);
		text-transform: capitalize;
	}

	.dc-team {
		margin-top: 0.45rem;
		padding: 0.3rem 0.6rem;
		border: 1px solid color-mix(in srgb, var(--el-color) 45%, var(--border));
		border-radius: 3px;
		background: none;
		color: var(--text);
		font-family: var(--font-body);
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-mid);
		cursor: pointer;
		transition:
			background 150ms ease,
			border-color 150ms ease;
	}
	.dc-team:hover:not(:disabled) {
		background: color-mix(in srgb, var(--el-color) 14%, transparent);
	}
	.dc-team--in {
		background: color-mix(in srgb, var(--el-color) 18%, transparent);
	}
	.dc-team:disabled {
		opacity: 0.5;
		cursor: default;
	}

	/* Local bits only. The wishlist variant keeps its geo tint. */
	.dc-close {
		align-self: flex-start;
		font-size: var(--fs-lg);
		line-height: var(--lh-none);
	}
	.dc-own-btn--wish.is-active {
		border-color: color-mix(in srgb, var(--el-geo-main) 65%, var(--border));
		background: color-mix(in srgb, var(--el-geo-main) 18%, transparent);
	}

	.dc-stub-note {
		margin: 0;
		padding: 0.55rem 0.7rem;
		border-radius: 3px;
		border: 1px solid color-mix(in srgb, var(--el-geo-main, #ddb04a) 40%, transparent);
		background: color-mix(in srgb, var(--el-geo-main, #ddb04a) 8%, transparent);
		font-size: var(--fs-sm);
		line-height: var(--lh-normal);
		color: var(--text);
	}

	.dc-note {
		margin: 0.5rem 0 0;
		font-size: var(--fs-sm);
		line-height: var(--lh-normal);
		color: var(--muted);
	}

	/* ── Ownership toggle ─────────────────────────────────────── */
	.dc-own {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 0.55rem;
	}
	/* ── Constellation stepper ────────────────────────────────── */

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
		font-size: var(--fs-md);
	}
	.dc-cap--locked {
		opacity: 0.5;
	}

	.dc-cap-kind {
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-mid);
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
		font-size: var(--fs-2xs);
		text-transform: uppercase;
		letter-spacing: var(--ls-wide);
	}

	.dc-cap-gate {
		justify-self: end;
	}

	.dc-gate-chip {
		padding: 1px 6px;
		border-radius: 3px;
		font-size: var(--fs-xs);
		font-weight: var(--fw-semibold);
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
		font-size: var(--fs-xs);
		font-style: italic;
		color: color-mix(in srgb, var(--muted) 80%, transparent);
	}

	/* ── Timing table ─────────────────────────────────────────── */
	.dc-timing {
		margin-top: 0.55rem;
		width: 100%;
		border-collapse: collapse;
		font-size: var(--fs-md);
	}
	.dc-timing td {
		padding: 0.35rem 0.6rem 0.35rem 0;
		border-bottom: 1px solid color-mix(in srgb, var(--border) 50%, transparent);
		vertical-align: baseline;
	}
	.dc-timing-slot {
		width: 1.6rem;
		font-weight: var(--fw-bold);
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
