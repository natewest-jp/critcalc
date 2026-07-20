<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import { getCharacterIndexEntry } from '$lib/data/characterLookup';
	import { getLoadedCharacter, loadCharacter } from '$lib/data/characterData';
	import { constellations, siteSettings, ownership } from '$lib/stores';
	import { getAvatar, getAvatarFallback, hasAvatar } from '$lib/utils/getAvatar';
	import { elementColors, type ElementKey } from '$lib/utils/elementColors';
	import { deriveCharacterCapabilities } from '$lib/capabilities/deriveCapabilities';
	import { rulerTicks } from '$lib/timeline/barGeometry';
	import { barPhases, type BarPhaseSegment } from '$lib/timeline/barPhases';
	import type { Ability } from '$lib/types/ability';
	import { conCapFor, type ConMode } from './facets';
	import { buildCompareModel, glyphScaleSeconds, type CapCell } from './compare';
	import { TARGET_SHORT, caveatText } from './capabilityText';
	import CompareBar from './CompareBar.svelte';

	let {
		ids,
		conMode,
		onClose,
		onRemove
	}: {
		ids: string[];
		conMode: ConMode;
		onClose: () => void;
		/** Remove one character from the comparison (tray stays in sync). */
		onRemove: (id: string) => void;
	} = $props();

	// Fixed pixel width of every bar track — all lanes share it, so the same
	// px/sec scale governs the whole view and stacked bars compare truthfully.
	const TRACK_W = 300;

	const columns = $derived(
		ids.map((id) => {
			const entry = getCharacterIndexEntry(id);
			return {
				id,
				entry,
				color: (elementColors[(entry?.element ?? 'none') as ElementKey] ?? elementColors.none).main
			};
		})
	);

	// Full payloads — lazy chunks, reactive as each lands.
	$effect(() => {
		for (const id of ids) void loadCharacter(id);
	});
	const loaded = $derived(ids.map((id) => getLoadedCharacter(id)));
	const allLoaded = $derived(loaded.every((d) => d !== null));

	// Same derivation brain as the DetailCard — the two surfaces can't disagree.
	const model = $derived.by(() => {
		if (!allLoaded) return null;
		return buildCompareModel(
			loaded.map((data, i) => ({
				id: ids[i],
				curated: columns[i].entry?.curated ?? false,
				abilities: data!.abilities ?? [],
				capabilities: deriveCharacterCapabilities(data!).capabilities
			}))
		);
	});

	// Convention: show everything; lock (dim) what the mode's constellation cap
	// hasn't unlocked — per column, since "My roster" caps differ per character.
	const viewCons = $derived(ids.map((id) => conCapFor(conMode, $constellations[id] ?? 0)));

	function abilityCooldown(abilities: readonly Ability[], type: 'skill' | 'burst'): number | null {
		for (const a of abilities) {
			if (a.abilityType === type && 'cooldown' in a && typeof a.cooldown === 'number' && a.cooldown)
				return a.cooldown;
		}
		return null;
	}
	function burstEnergy(abilities: readonly Ability[]): number | null {
		for (const a of abilities) {
			if (a.abilityType === 'burst' && 'energyCost' in a && a.energyCost) return a.energyCost;
		}
		return null;
	}

	const skillCd = $derived(
		loaded.map((d) => (d ? abilityCooldown(d.abilities ?? [], 'skill') : null))
	);
	const burstCd = $derived(
		loaded.map((d) => (d ? abilityCooldown(d.abilities ?? [], 'burst') : null))
	);
	const burstCost = $derived(loaded.map((d) => (d ? burstEnergy(d.abilities ?? []) : null)));

	// One shared time scale for every bar — the widest cycle across capability
	// glyphs AND the E/Q cooldown bars, floored so short kits still get a ruler.
	const scaleSeconds = $derived.by(() => {
		let max = model ? glyphScaleSeconds(model) : 0;
		for (const cd of skillCd) if (cd) max = Math.max(max, cd);
		for (const cd of burstCd) if (cd) max = Math.max(max, cd);
		return max > 0 ? Math.max(max, 6) : 0;
	});
	const pxPerSec = $derived(scaleSeconds > 0 ? TRACK_W / scaleSeconds : 0);
	const ruler = $derived(rulerTicks(scaleSeconds, pxPerSec));

	/** Three-phase segments for a capability glyph: solid window, dim overflow
	 *  past the cooldown, or a ghost cooldown remainder. */
	function glyphSegments(cell: CapCell): BarPhaseSegment[] {
		if (!cell.glyph) return [];
		return barPhases(
			{ start: 0, castTime: 0, cooldown: cell.glyph.cooldown, uptime: cell.glyph.uptime },
			false
		);
	}
	/** A bare cooldown bar (E/Q recharge): one ghost track the length of the CD. */
	function cooldownSegments(cd: number): BarPhaseSegment[] {
		return [{ role: 'ghost', start: 0, span: cd, cooldown: cd }];
	}

	function cellTitle(cell: CapCell): string {
		const parts = [`from ${cell.sources.join(', ')}`];
		if (cell.caveats.length > 0) parts.push(cell.caveats.map(caveatText).join(' · '));
		return parts.join(' — ');
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

	function handleBackdropClick(e: MouseEvent) {
		if ((e.target as HTMLElement).classList.contains('cmp-backdrop')) onClose();
	}
	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="cmp-backdrop" onclick={handleBackdropClick} role="presentation">
	<div class="cmp-panel" role="dialog" aria-modal="true" aria-label="Compare characters">
		<header class="cmp-titlebar">
			<h2>Compare</h2>
			<p class="cmp-mode">
				{#if conMode === 'c0'}at C0{:else if conMode === 'max'}at C6{:else}at your constellations{/if}
			</p>
			<button class="cmp-close" onclick={onClose} aria-label="Close">✕</button>
		</header>

		<!-- Character legend — the colour key the stacked lanes refer back to. -->
		<div class="cmp-legend">
			{#each columns as col (col.id)}
				<div class="cmp-chip" style:--el-color={col.color}>
					<span class="cmp-chip-avatar">
						{#if !fallbackFor(col.id)}
							<img
								src={getAvatar(
									col.id,
									$siteSettings.useNewOutfits,
									'side',
									$siteSettings.travelerVariant
								)}
								alt=""
								onerror={(e) => handleAvatarError(col.id, e)}
							/>
						{:else}
							<span class="cmp-chip-initials"
								>{(col.entry?.displayName ?? col.id).slice(0, 2).toUpperCase()}</span
							>
						{/if}
					</span>
					<span class="cmp-chip-body">
						<span class="cmp-chip-name"
							>{col.entry?.displayName ?? col.id}{#if $ownership[col.id] === 'wishlist'}<span
									class="cmp-chip-wish"
									title="Wishlisted">★</span
								>{/if}</span
						>
						<span class="cmp-chip-meta">
							{col.entry?.element ?? '?'} · {col.entry?.weapon ?? '?'}
							{#if conMode === 'mine'}· C{$constellations[col.id] ?? 0}{/if}
							{#if col.entry && !col.entry.curated}· <span class="cmp-chip-stub">not curated</span
								>{/if}
						</span>
					</span>
					<button
						class="cmp-chip-remove"
						onclick={() => onRemove(col.id)}
						aria-label="Remove {col.entry?.displayName ?? col.id} from comparison"
						title="Remove from comparison">✕</button
					>
				</div>
			{/each}
		</div>

		<div class="cmp-scroll">
			{#if !model}
				<p class="cmp-loading">Loading kit data…</p>
			{:else}
				<div class="cmp-timeline" style:--track-w="{TRACK_W}px">
					<!-- Shared ruler — every bar below hangs off this one scale. -->
					{#if scaleSeconds > 0}
						<div class="cmp-ruler-row">
							<div class="cmp-lane-name"></div>
							<div class="cmp-ruler">
								{#each ruler as tick (tick.t)}
									<span
										class="cmp-rtick"
										class:cmp-rtick--major={tick.major}
										style:left="{tick.x}px"
									>
										{#if tick.major}<span class="cmp-rtick-label">{tick.t}s</span>{/if}
									</span>
								{/each}
							</div>
							<div class="cmp-lane-fact"></div>
						</div>
					{/if}

					<!-- ── Timing ─────────────────────────────────────────── -->
					<div class="cmp-dim-group">Timing</div>

					{#if skillCd.some((c) => c !== null)}
						<div class="cmp-dim-label">E cooldown</div>
						{#each columns as col, i (col.id)}
							{#if skillCd[i] !== null}
								<div class="cmp-lane" style:--el-color={col.color}>
									<span class="cmp-lane-name">{col.entry?.displayName ?? col.id}</span>
									<CompareBar
										segments={cooldownSegments(skillCd[i]!)}
										color={col.color}
										{scaleSeconds}
										trackWidthPx={TRACK_W}
									/>
									<span class="cmp-lane-fact">{skillCd[i]}s</span>
								</div>
							{/if}
						{/each}
					{/if}

					{#if burstCd.some((c) => c !== null)}
						<div class="cmp-dim-label">Q cooldown</div>
						{#each columns as col, i (col.id)}
							{#if burstCd[i] !== null}
								<div class="cmp-lane" style:--el-color={col.color}>
									<span class="cmp-lane-name">{col.entry?.displayName ?? col.id}</span>
									<CompareBar
										segments={cooldownSegments(burstCd[i]!)}
										color={col.color}
										{scaleSeconds}
										trackWidthPx={TRACK_W}
									/>
									<span class="cmp-lane-fact">{burstCd[i]}s</span>
								</div>
							{/if}
						{/each}
					{/if}

					{#if burstCost.some((c) => c !== null)}
						<div class="cmp-dim-label">Q energy</div>
						{#each columns as col, i (col.id)}
							{#if burstCost[i] !== null}
								<div class="cmp-lane" style:--el-color={col.color}>
									<span class="cmp-lane-name">{col.entry?.displayName ?? col.id}</span>
									<span class="cmp-lane-value">{burstCost[i]}</span>
									<span class="cmp-lane-fact"></span>
								</div>
							{/if}
						{/each}
					{/if}

					<!-- ── Capabilities ───────────────────────────────────── -->
					<div class="cmp-dim-group">Capabilities</div>

					{#if model.capRows.length === 0}
						<p class="cmp-empty">Nothing team-facing derives from these kits.</p>
					{/if}

					{#each model.capRows as row (row.key)}
						<div class="cmp-dim-label">{row.label}</div>
						{#each row.cells as cell, i (ids[i])}
							{@const col = columns[i]}
							{#if cell === null}
								<div class="cmp-lane cmp-lane--absent" style:--el-color={col.color}>
									<span class="cmp-lane-name">{col.entry?.displayName ?? col.id}</span>
									<span class="cmp-lane-value cmp-none"
										>{col.entry && !col.entry.curated ? 'unknown' : '—'}</span
									>
									<span class="cmp-lane-fact"></span>
								</div>
							{:else}
								{@const locked = cell.minCon > viewCons[i]}
								<div class="cmp-lane" class:cmp-lane--locked={locked} style:--el-color={col.color}>
									<span class="cmp-lane-name">{col.entry?.displayName ?? col.id}</span>
									{#if cell.glyph}
										<CompareBar
											segments={glyphSegments(cell)}
											color={col.color}
											{scaleSeconds}
											trackWidthPx={TRACK_W}
											{locked}
										/>
									{:else}
										<span class="cmp-lane-value cmp-lane-value--soft">no timing</span>
									{/if}
									<span class="cmp-lane-fact" title={cellTitle(cell)}>
										<span class="cmp-gate" class:cmp-gate--base={cell.minCon === 0}
											>C{cell.minCon}{locked ? ' 🔒' : ''}</span
										>
										{#if cell.target}<span class="cmp-target"
												>{TARGET_SHORT[cell.target] ?? cell.target}</span
											>{/if}
										{#if cell.conditional}<span
												class="cmp-cond"
												title={cell.caveats.map(caveatText).join(' · ')}>~</span
											>{/if}
										{#if cell.details.length > 0}<span class="cmp-details"
												>{cell.details.join(' · ')}</span
											>{/if}
										{#if cell.also}
											{@const alsoLocked = cell.also.minCon > viewCons[i]}
											<span class="cmp-also" class:cmp-lane--locked={alsoLocked}
												>{TARGET_SHORT[cell.also.target]} from C{cell.also.minCon}{alsoLocked
													? ' 🔒'
													: ''}</span
											>
										{/if}
									</span>
								</div>
							{/if}
						{/each}
					{/each}
				</div>
			{/if}
		</div>

		<p class="cmp-footnote">
			Bars share one time scale — solid = effect window, dim = window past its cooldown, faint =
			cooldown remaining. ~ = conditional (hover for the condition) · hover a fact for its source ·
			full provenance lives in each character's detail card.
		</p>
	</div>
</div>

<style>
	.cmp-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.72);
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px;
	}

	.cmp-panel {
		box-sizing: border-box;
		width: 100%;
		max-width: min(980px, calc(100vw - 48px));
		max-height: min(820px, calc(100svh - 48px));
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		padding: 1.2rem 1.3rem 1.1rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 9px;
		font-family: var(--font-body);
		color: var(--text);
	}

	/* ── Title bar ────────────────────────────────────────────── */
	.cmp-titlebar {
		display: flex;
		align-items: baseline;
		gap: 0.8rem;
	}
	.cmp-titlebar h2 {
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--fs-3xl);
		font-weight: var(--fw-semibold);
	}
	.cmp-mode {
		flex: 1;
		margin: 0;
		font-size: var(--fs-sm);
		color: var(--muted);
	}
	.cmp-close {
		align-self: flex-start;
		background: none;
		border: 1px solid var(--border);
		border-radius: 3px;
		color: var(--muted);
		font-size: var(--fs-lg);
		line-height: var(--lh-none);
		padding: 0.3rem 0.5rem;
		cursor: pointer;
		transition:
			color 150ms ease,
			border-color 150ms ease;
	}
	.cmp-close:hover {
		color: var(--text);
		border-color: color-mix(in srgb, var(--accent) 55%, var(--border));
	}

	/* ── Legend ───────────────────────────────────────────────── */
	.cmp-legend {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.cmp-chip {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.3rem 0.5rem 0.3rem 0.35rem;
		border: 1px solid color-mix(in srgb, var(--el-color) 45%, var(--border));
		border-left: 3px solid var(--el-color);
		border-radius: 4px;
		background: color-mix(in srgb, var(--el-color) 7%, transparent);
	}
	.cmp-chip-avatar {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 30px;
		border-radius: 50%;
		border: 1.5px solid var(--el-color);
		overflow: hidden;
		background: rgba(0, 0, 0, 0.5);
		flex-shrink: 0;
	}
	.cmp-chip-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		transform: scale(1.333) translateY(-14%);
	}
	.cmp-chip-initials {
		font-size: var(--fs-2xs);
		font-weight: var(--fw-bold);
		color: var(--el-color);
	}
	.cmp-chip-body {
		display: flex;
		flex-direction: column;
		line-height: var(--lh-tight);
	}
	.cmp-chip-name {
		font-family: var(--font-display);
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
	}
	.cmp-chip-wish {
		margin-left: 0.25rem;
		color: var(--el-geo-hi, #eed8a5);
		font-size: var(--fs-sm);
	}
	.cmp-chip-meta {
		font-size: var(--fs-2xs);
		color: var(--muted);
		text-transform: capitalize;
	}
	.cmp-chip-stub {
		text-transform: uppercase;
		letter-spacing: var(--ls-wide);
		color: color-mix(in srgb, var(--el-geo-main, #ddb04a) 90%, var(--muted));
	}
	.cmp-chip-remove {
		background: none;
		border: none;
		padding: 2px 3px;
		color: color-mix(in srgb, var(--muted) 60%, transparent);
		font-size: var(--fs-xs);
		cursor: pointer;
		transition: color 150ms ease;
	}
	.cmp-chip-remove:hover {
		color: var(--text);
	}

	/* ── Stacked timeline ─────────────────────────────────────── */
	.cmp-scroll {
		overflow: auto;
		min-height: 0;
	}
	.cmp-timeline {
		min-width: calc(96px + var(--track-w) + 120px);
	}

	.cmp-ruler-row,
	.cmp-lane {
		display: grid;
		grid-template-columns: 96px var(--track-w) 1fr;
		align-items: center;
		gap: 0.6rem;
	}

	.cmp-ruler {
		position: relative;
		height: 16px;
	}
	.cmp-rtick {
		position: absolute;
		bottom: 0;
		width: 1px;
		height: 5px;
		background: color-mix(in srgb, var(--muted) 40%, transparent);
	}
	.cmp-rtick--major {
		height: 9px;
		background: color-mix(in srgb, var(--muted) 65%, transparent);
	}
	.cmp-rtick-label {
		position: absolute;
		bottom: 10px;
		left: 0;
		transform: translateX(-50%);
		font-size: var(--fs-2xs);
		color: var(--muted);
		white-space: nowrap;
	}

	.cmp-dim-group {
		margin: 0.9rem 0 0.35rem;
		font-size: var(--fs-xs);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-widest);
		text-transform: uppercase;
		color: var(--muted);
	}
	.cmp-dim-label {
		margin: 0.55rem 0 0.2rem;
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-mid);
		color: var(--text);
	}

	.cmp-lane {
		padding: 0.14rem 0;
	}
	.cmp-lane--locked {
		opacity: 0.55;
	}
	.cmp-lane--absent {
		opacity: 0.7;
	}
	.cmp-lane-name {
		font-size: var(--fs-xs);
		font-weight: var(--fw-semibold);
		color: var(--el-color);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.cmp-lane-value {
		font-size: var(--fs-sm);
		font-variant-numeric: tabular-nums;
	}
	.cmp-lane-value--soft {
		font-size: var(--fs-xs);
		font-style: italic;
		color: color-mix(in srgb, var(--muted) 70%, transparent);
	}

	.cmp-lane-fact {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 0.35rem;
		font-size: var(--fs-xs);
		min-width: 0;
	}
	.cmp-gate {
		padding: 1px 6px;
		border-radius: 3px;
		font-size: var(--fs-2xs);
		font-weight: var(--fw-semibold);
		background: color-mix(in srgb, var(--el-color) 18%, transparent);
	}
	.cmp-gate--base {
		background: rgba(255, 255, 255, 0.07);
		color: var(--muted);
	}
	.cmp-target {
		color: var(--muted);
	}
	.cmp-cond {
		font-style: italic;
		color: var(--muted);
		cursor: help;
	}
	.cmp-details {
		color: var(--muted);
	}
	.cmp-also {
		font-style: italic;
		color: color-mix(in srgb, var(--muted) 80%, transparent);
	}
	.cmp-none {
		color: color-mix(in srgb, var(--muted) 55%, transparent);
	}

	.cmp-empty,
	.cmp-loading {
		padding: 1rem 0;
		color: var(--muted);
	}

	.cmp-footnote {
		margin: 0;
		font-size: var(--fs-xs);
		line-height: var(--lh-normal);
		color: color-mix(in srgb, var(--muted) 80%, transparent);
	}
</style>
