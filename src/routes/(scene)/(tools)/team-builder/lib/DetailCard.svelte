<script lang="ts">
	import { getCharacterIndexEntry } from '$lib/data/characterLookup';
	import { getLoadedCharacter, loadCharacter } from '$lib/data/characterData';
	import { constellations, siteSettings, ownership } from '$lib/stores';
	import { getAvatar, getAvatarFallback, hasAvatar } from '$lib/utils/getAvatar';
	import CloseMark from '$lib/components/CloseMark.svelte';
	import Mark from '$lib/components/Mark.svelte';
	import { elementColors, type ElementKey } from '$lib/utils/elementColors';
	import {
		deriveCharacterCapabilities,
		type DerivedCapability
	} from '$lib/capabilities/deriveCapabilities';
	import type { ConMode } from './facets';
	import { conCapFor } from './facets';
	import {
		KIND_LABEL,
		KIND_ORDER,
		TARGET_LABEL,
		capDetailText,
		caveatText
	} from './capabilityText';

	let {
		id,
		conMode,
		onClose,
		teamState,
		onToggleTeam,
		compareState,
		onToggleCompare
	}: {
		id: string;
		conMode: ConMode;
		onClose: () => void;
		/** Slot membership for the team strip; undefined hides the button. */
		teamState?: 'in' | 'out' | 'full';
		onToggleTeam?: (id: string) => void;
		/** Compare membership — mirrors the card hover action's silent add; the
		 *  Compare tab's avatar stack is the feedback. Undefined hides the button. */
		compareState?: 'in' | 'out' | 'full';
		onToggleCompare?: (id: string) => void;
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
     workspace is the point. Esc / backdrop / ✕ all dismiss. -->
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
				{#if (onToggleTeam && teamState) || (onToggleCompare && compareState)}
					<div class="dc-actions">
						{#if onToggleTeam && teamState}
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
						{/if}
						{#if onToggleCompare && compareState}
							<button
								class="dc-compare"
								class:dc-team--in={compareState === 'in'}
								disabled={compareState === 'full'}
								onclick={() => onToggleCompare(id)}
								title={compareState === 'in'
									? 'Remove from the comparison'
									: compareState === 'full'
										? 'Comparison is full (4)'
										: 'Add to the comparison — it loads into the Compare tab'}
							>
								<Mark name={compareState === 'in' ? 'check' : 'forward'} />
								{compareState === 'in'
									? 'Comparing — remove'
									: compareState === 'full'
										? 'Compare full'
										: 'Compare'}
							</button>
						{/if}
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
					><Mark name="check" /> Owned</button
				>
				<button
					class="btn dc-own-btn--wish"
					class:is-active={myOwnership === 'wishlist'}
					aria-pressed={myOwnership === 'wishlist'}
					onclick={() => ownership.setMark(id, myOwnership === 'wishlist' ? null : 'wishlist')}
					><Mark name="star" /> Wishlist</button
				>
			</div>
			{#if entry?.noConstellations}
				<p class="note dc-note">
					{entry.displayName}’s constellations can’t be unlocked, so there is no level to set —
					owning the character is the whole story.
				</p>
			{:else}
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
				<p class="note dc-note">
					Saved to your roster — “My roster” filtering across the site uses it. Setting a
					constellation marks the character owned.
				</p>
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
		border: 1.5px solid var(--el-color);
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
	/* Two names, one register: .dc-compare is .dc-team's twin, kept distinct so
	   probes/tests can target each action unambiguously. */
	.dc-team,
	.dc-compare {
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
			background 150ms ease,
			border-color 150ms ease;
	}
	.dc-team:hover:not(:disabled),
	.dc-compare:hover:not(:disabled) {
		background: color-mix(in srgb, var(--el-color) 14%, transparent);
	}
	.dc-team--in {
		background: color-mix(in srgb, var(--el-color) 18%, transparent);
	}
	.dc-team:disabled,
	.dc-compare:disabled {
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
	/* ↻ 2026-08-11: --accent, not --el-geo-main. A wishlist is not a Geo fact —
	   that token was borrowed for being the gold-coloured one, which is exactly
	   the drift the layer law exists to catch. Same correction .cc-wish took on
	   the roster card (it had borrowed --el-geo-HI for the same reason). */
	.dc-own-btn--wish.is-active {
		border-color: var(--sel-ring);
		background: var(--sel-fill);
	}

	.dc-stub-note {
		margin: 0;
		padding: 0.55rem 0.7rem;
		border-radius: 3px;
		/* ↻ 2026-08-11: --ui-danger, not --el-geo-main. This note reports the SAME
		   fact the ∅ marker does — frame timing isn't curated — and the
		   dire-retirement round settled that as a DATA-QUALITY state rather than a
		   domain colour. It was wearing a borrowed element token; now the note and
		   the mark that summarises it speak with one voice. */
		border: 1px solid color-mix(in srgb, var(--ui-danger) 40%, transparent);
		background: var(--ui-danger-soft);
		font-size: var(--fs-md);
		line-height: var(--lh-normal);
		color: var(--text);
	}

	/* ── Ownership toggle ─────────────────────────────────────── */
	.dc-note {
		margin-top: 0.5rem;
		font-size: var(--fs-md);
	}

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
