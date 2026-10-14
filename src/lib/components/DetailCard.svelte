<script lang="ts">
	import { resolve } from '$app/paths';
	import { openCoverage } from '$lib/coverage/openCoverage';
	import { getCharacterIndexEntry } from '$lib/data/characterLookup';
	import { getLoadedCharacter, loadCharacter } from '$lib/data/characterData';
	import { constellations, siteSettings, ownership, loadout } from '$lib/stores';
	import { library } from '$lib/library.svelte';
	import LoadoutPanel from '$lib/components/LoadoutPanel.svelte';
	import { getAvatar, getAvatarFallback, hasAvatar } from '$lib/utils/getAvatar';
	import CloseMark from '$lib/components/CloseMark.svelte';
	import Mark from '$lib/components/Mark.svelte';
	import { fade } from 'svelte/transition';
	import { T_QUICK, motion, introLive, outroInert } from '$lib/motion';
	import { elementColors, type ElementKey } from '$lib/utils/elementColors';
	import {
		deriveCharacterCapabilities,
		type DerivedCapability
	} from '$lib/capabilities/deriveCapabilities';
	import type { ConMode } from '$lib/capabilities/facets';
	import { conCapFor } from '$lib/capabilities/facets';
	import {
		KIND_LABEL,
		KIND_ORDER,
		TARGET_LABEL,
		capDetailText,
		caveatText
	} from '$lib/capabilities/capabilityText';

	let {
		id,
		conMode,
		onClose,
		teamState,
		onToggleTeam,
		defaultBuild = true
	}: {
		id: string;
		conMode: ConMode;
		onClose: () => void;
		/** Slot membership for the team strip; undefined hides the button. */
		teamState?: 'in' | 'out' | 'full';
		onToggleTeam?: (id: string) => void;
		/**
		 * The Team Builder's "Default build" (the roster's Layer-1 loadout); false
		 * on the Rotation Planner, which edits a rotation's own loadout on the
		 * bench. ↻ 2026-10-11 this was `conEditable`, and it held a PARKED
		 * problem — two constellation steppers one click apart writing different
		 * layers. The Roster tab settled it: the roster is edited there only, and
		 * this card reads it in both tools.
		 */
		defaultBuild?: boolean;
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
		if (section === 'factionBonus') return `${name} · team bonus`;
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

<!-- The Team Builder's one deliberate modal (documented exception to the
     non-modal principle): a focused single-character read, where covering the
     workspace is the point. Esc / backdrop / ✕ all dismiss.

     ↻ 2026-08-12 (motion round): it fades, on --t-quick — the SURFACE band,
     because size sets the clock and this is a scrim over the whole viewport.
     The card is the SAME REGISTER as ChromeOverlay, dismissed the same three
     ways, and ChromeOverlay has faded since it was built; the card snapping in
     was not a choice anyone made, just the one modal that never got the
     treatment. Both on T_QUICK now. -->
<div
	class="dc-backdrop"
	transition:fade={{ duration: motion(T_QUICK) }}
	onintrostart={introLive}
	onoutrostart={outroInert}
	onclick={handleBackdropClick}
	role="presentation"
>
	<div
		class="dc-panel"
		style:--el-color={color}
		role="dialog"
		aria-modal="true"
		aria-label="{entry?.displayName ?? id} details"
	>
		<!-- ── Header ─────────────────────────────────────────── -->
		<header class="dc-header">
			<div class="dc-avatar ctx-dark">
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
				<h2 class="title">{entry?.displayName ?? id}</h2>
				<p class="subtitle">
					<span style:color>{entry?.element ?? '?'}</span>
					· {entry?.weapon ?? '?'} · {entry?.rarity}★{entry?.region ? ` · ${entry.region}` : ''}
				</p>
				{#if onToggleTeam && teamState}
					<div class="dc-actions">
						<button
							class="dc-team"
							class:dc-team--in={teamState === 'in'}
							disabled={teamState === 'full'}
							onclick={() => onToggleTeam(id)}
							title={teamState === 'full' ? 'All four team slots are filled' : undefined}
						>
							<Mark name={teamState === 'in' ? 'check' : 'plus'} />
							{teamState === 'in'
								? 'In team — remove'
								: teamState === 'full'
									? 'Team full'
									: 'Add to team'}
						</button>
					</div>
				{/if}
			</div>
			<button class="dc-close" onclick={onClose} aria-label="Close">
				<CloseMark />
			</button>
		</header>

		{#if entry && !entry.curated}
			{#if entry.caps.length === 0}
				<p class="dc-stub-note">
					Kit not yet curated — capability data below is incomplete. Missing entries mean “unknown”,
					not “no”.
					<a
						class="link dc-stub-link"
						href="{resolve('/coverage')}?c={entry.id}"
						onclick={(e) => entry && openCoverage(e, [entry.id])}>See coverage</a
					>
				</p>
			{:else}
				<p class="dc-stub-note">
					Capabilities below are complete. Frame timing isn’t curated yet, so only this character’s
					rotation timing is approximate in the Planner.
					<a
						class="link dc-stub-link"
						href="{resolve('/coverage')}?c={entry.id}"
						onclick={(e) => entry && openCoverage(e, [entry.id])}>See coverage</a
					>
				</p>
			{/if}
		{/if}

		<!-- ── Your roster ────────────────────────────────────── -->
		<!-- ⚓ READ-ONLY (lineups design §11.6 item 2): the Library's Roster tab is
		     the one place the roster is edited, so details in both tools say what
		     it holds and link there, arriving on this character. -->
		<section>
			<p class="kicker">Your roster</p>
			<p class="dc-roster">
				<span class="dc-roster-state"
					>{#if myOwnership === 'owned'}<Mark name="check" size={13} /> Owned{#if !entry?.noConstellations}{` · C${myCon}`}{/if}{:else if myOwnership === 'wishlist'}<Mark
							name="star"
							size={13}
							filled
						/> On your wishlist{:else}Not owned{/if}</span
				>
				<button
					class="btn btn--sm"
					onclick={() => {
						// ⚠ Read the id BEFORE closing: props are live, and the host
						// clears the one this card was opened with.
						const target = id;
						onClose();
						library.openRoster(target);
					}}>Edit in Roster</button
				>
			</p>
			{#if !defaultBuild}
				<p class="note dc-note">
					To set this character’s constellation for this rotation only, use the selector on the
					Planner rather than the Roster.
				</p>
			{/if}
			<!-- The roster's LOADOUT (Layer 1), beside its constellation (lineups
			     design §2.1): it was editable only through the bench, and the Team
			     Builder has no bench any more. Same panel the bench opens; writes
			     land in the roster, where a rotation's own picks fall back to it. -->
			{#if defaultBuild}
				<p class="kicker dc-build-kicker">Default build</p>
				<LoadoutPanel
					loadoutEntry={$loadout[id] ?? {}}
					weaponType={entry?.weapon}
					elementColor={color}
					onSetArtifact={(setId) => loadout.setArtifact(id, setId)}
					onSetWeapon={(weaponId, r) => loadout.setWeapon(id, weaponId, r)}
					onSetRefinement={(r) => loadout.setWeapon(id, $loadout[id]?.weaponId, r)}
				/>
			{/if}
		</section>

		<!-- ── Capabilities ───────────────────────────────────── -->
		<section>
			<p class="kicker">Capabilities</p>
			{#if !data}
				<p class="note dc-note">Loading kit data…</p>
			{:else if sortedCaps.length === 0}
				<p class="note dc-note">
					Nothing team-facing derives from this kit{entry?.curated
						? ' — likely a selfish carry, or curation hasn’t covered its utility yet'
						: ''}.
				</p>
			{:else}
				<ul class="dc-caps">
					{#each sortedCaps as cap, i (i)}
						<li class="dc-cap" class:dc-cap--locked={locked(cap)}>
							<span class="dc-cap-kind"
								>{KIND_LABEL[cap.kind] ?? cap.kind}{(cap.kind === 'buff' ||
									cap.kind === 'resShred' ||
									cap.kind === 'infuse') &&
								cap.detail
									? `: ${capDetailText(cap.kind, cap.detail)}`
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
										>C{cap.minConstellation}{#if locked(cap)}<Mark
												name="gated"
												size={11}
											/>{/if}</span
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
									{#if 'cooldown' in ability && ability.cooldown}{ability.cooldown}s cooldown{/if}
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
	.dc-build-kicker {
		margin-top: 1rem;
	}
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
		/* The ONE modal that keeps an element-tinted border (Nate 2026-07-31):
		   a single-character read earns the identity edge; every other modal
		   wears the plain --border. */
		border: 1px solid color-mix(in srgb, var(--el-color) 35%, var(--border));
		border-radius: 9px;
		font-family: var(--font-body);
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
		/* 1px, not 1.5 — Chrome floors border-width to whole CSS px, so this has
		   always painted 1px there; see the measurement at --inset-stroke. */
		border: 1px solid var(--el-color);
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
		/* The element wash, pinned to slate by the .ctx-dark on the element — the
		   same treatment every character portrait on the site wears, and the same
		   reason it claims a context rather than inheriting one. See the note at
		   CompareView's .cmp-chip-avatar. Was rgba(0,0,0,.5): a translucent disc
		   under a cut-out avatar, i.e. a ground nobody had named. */
		background: color-mix(in srgb, var(--el-color) 26%, var(--surface-well));
	}
	.dc-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		transform: scale(1.333) translateY(-14%);
	}
	.dc-avatar-initials {
		font-size: var(--fs-xl);
		font-weight: var(--fw-bold);
		color: var(--el-color);
	}

	.dc-title {
		flex: 1;
		min-width: 0;
	}
	.dc-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-top: 0.45rem;
	}
	.dc-team {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.3rem 0.6rem;
		border: 1px solid color-mix(in srgb, var(--el-color) 45%, var(--border));
		border-radius: 3px;
		background: none;
		color: var(--text);
		font-family: var(--font-body);
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-mid);
		cursor: pointer;
		transition:
			background var(--t-snap),
			border-color var(--t-snap);
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
	/* A bare hit target around Nate's close mark — the same treatment the meta
	   overlays' close wears. Deliberately not .btn--icon: the mark is already a
	   disc, and a bordered box around it reads as two shapes. */
	.dc-close {
		align-self: flex-start;
		display: grid;
		place-items: center;
		width: 30px;
		height: 30px;
		flex: none;
		padding: 0;
		border: none;
		background: none;
		color: var(--text);
		cursor: pointer;
	}
	.dc-stub-link {
		white-space: nowrap;
	}
	.dc-stub-note {
		margin: 0;
		padding: 0.55rem 0.7rem;
		border-radius: 3px;
		/* ↻ 2026-08-11: --ui-danger, not --el-geo-main. This note reports the SAME
		   fact the ∅ marker does — frame timing isn't curated — and the
		   dire-retirement round settled that as a DATA-QUALITY state rather than a
		   domain colour. It was wearing a borrowed element token; now the note and
		   the mark that summarises it speak with one voice.
		   ↻ 2026-08-12: and that one voice is now --ui-provisional. The 08-11 move
		   settled state-over-domain; this one settles WHICH state, now that the
		   family has a value for "incomplete" that isn't "wrong". */
		border: 1px solid color-mix(in srgb, var(--ui-provisional) 40%, transparent);
		background: var(--ui-provisional-soft);
		font-size: var(--fs-md);
		line-height: var(--lh-normal);
		color: var(--text);
	}

	/* ── Your roster (read-only) ───────────────────────────────── */
	.dc-note {
		margin-top: 0.5rem;
		font-size: var(--fs-md);
	}
	.dc-roster {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem 1rem;
		margin: 0;
	}
	.dc-roster-state {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: var(--fs-md);
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
		background: var(--fill-rest);
		font-size: var(--fs-lg);
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
		background: var(--fill-rest);
		font-size: var(--fs-xs);
		text-transform: uppercase;
		letter-spacing: var(--ls-wide);
	}

	.dc-cap-gate {
		justify-self: end;
	}

	/* inline-flex, because the locked state's Mark is a block-level <svg> and a
	   block child would break the chip's inline box. */
	.dc-gate-chip {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		padding: 1px 6px;
		border-radius: 3px;
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		background: color-mix(in srgb, var(--el-color) 18%, transparent);
	}
	.dc-gate-chip--base {
		background: var(--fill-rest);
		color: var(--muted);
	}
	.dc-gate-chip--locked {
		background: var(--fill-rest);
		color: var(--muted);
	}

	.dc-cap-caveats {
		grid-column: 1 / -1;
		font-size: var(--fs-sm);
		font-style: italic;
		color: color-mix(in srgb, var(--muted) 80%, transparent);
	}

	/* ── Timing table ─────────────────────────────────────────── */
	.dc-timing {
		margin-top: 0.55rem;
		width: 100%;
		border-collapse: collapse;
		font-size: var(--fs-lg);
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
