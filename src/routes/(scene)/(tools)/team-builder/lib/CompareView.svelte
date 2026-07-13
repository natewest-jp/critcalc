<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import { getCharacterIndexEntry } from '$lib/data/characterLookup';
	import { getLoadedCharacter, loadCharacter } from '$lib/data/characterData';
	import { constellations, siteSettings } from '$lib/stores';
	import { getAvatar, getAvatarFallback, hasAvatar } from '$lib/utils/getAvatar';
	import { elementColors, type ElementKey } from '$lib/utils/elementColors';
	import { deriveCharacterCapabilities } from '$lib/capabilities/deriveCapabilities';
	import { conCapFor, type ConMode } from './facets';
	import { buildCompareModel, glyphScaleSeconds, type CapCell } from './compare';
	import { TARGET_SHORT, caveatText } from './capabilityText';

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

	// One shared time scale for every uptime glyph — bar lengths compare truthfully.
	const glyphScale = $derived(model ? glyphScaleSeconds(model) : 0);

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

		<div class="cmp-scroll">
			<table class="cmp-table" style:--cols={ids.length}>
				<thead>
					<tr>
						<td></td>
						{#each columns as col (col.id)}
							<th class="cmp-char" style:--el-color={col.color} scope="col">
								<button
									class="cmp-char-remove"
									onclick={() => onRemove(col.id)}
									aria-label="Remove {col.entry?.displayName ?? col.id} from comparison"
									title="Remove from comparison">✕</button
								>
								<span class="cmp-avatar">
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
										<span class="cmp-avatar-initials"
											>{(col.entry?.displayName ?? col.id).slice(0, 2).toUpperCase()}</span
										>
									{/if}
								</span>
								<span class="cmp-char-name">{col.entry?.displayName ?? col.id}</span>
								<span class="cmp-char-meta">
									<span style:color={col.color}>{col.entry?.element ?? '?'}</span>
									· {col.entry?.weapon ?? '?'} · {col.entry?.rarity}★
								</span>
								{#if conMode === 'mine'}
									<span class="cmp-char-con">C{$constellations[col.id] ?? 0}</span>
								{/if}
								{#if col.entry && !col.entry.curated}
									<span
										class="cmp-char-stub"
										title="Kit not yet curated — blank rows mean “unknown”, not “no”"
										>not curated</span
									>
								{/if}
							</th>
						{/each}
					</tr>
				</thead>

				{#if !model}
					<tbody>
						<tr>
							<td class="cmp-loading" colspan={ids.length + 1}>Loading kit data…</td>
						</tr>
					</tbody>
				{:else}
					{#if model.timingRows.length > 0}
						<tbody>
							<tr class="cmp-section">
								<th colspan={ids.length + 1} scope="rowgroup">Timing</th>
							</tr>
							{#each model.timingRows as row (row.key)}
								<tr>
									<th class="cmp-rowlabel" scope="row">{row.label}</th>
									{#each row.cells as cell, i (ids[i])}
										<td class="cmp-cell cmp-cell--timing">
											{#if cell !== null}{cell}{:else}<span class="cmp-none">—</span>{/if}
										</td>
									{/each}
								</tr>
							{/each}
						</tbody>
					{/if}

					<tbody>
						<tr class="cmp-section">
							<th colspan={ids.length + 1} scope="rowgroup">Capabilities</th>
						</tr>
						{#if model.capRows.length === 0}
							<tr>
								<td class="cmp-loading" colspan={ids.length + 1}
									>Nothing team-facing derives from these kits.</td
								>
							</tr>
						{/if}
						{#each model.capRows as row (row.key)}
							<tr>
								<th class="cmp-rowlabel" scope="row">{row.label}</th>
								{#each row.cells as cell, i (ids[i])}
									<td class="cmp-cell">
										{#if cell === null}
											<span
												class="cmp-none"
												title={columns[i].entry && !columns[i].entry.curated
													? 'Unknown — kit not yet curated'
													: undefined}>—</span
											>
										{:else}
											{@const locked = cell.minCon > viewCons[i]}
											<span
												class="cmp-fact"
												class:cmp-fact--locked={locked}
												title={cellTitle(cell)}
											>
												<span
													class="cmp-gate"
													class:cmp-gate--base={cell.minCon === 0}
													style:--el-color={columns[i].color}
													>C{cell.minCon}{locked ? ' 🔒' : ''}</span
												>
												{#if cell.target}
													<span class="cmp-target">{TARGET_SHORT[cell.target] ?? cell.target}</span>
												{/if}
												{#if cell.conditional}
													<span class="cmp-cond" title={cell.caveats.map(caveatText).join(' · ')}
														>~</span
													>
												{/if}
											</span>
											{#if cell.glyph && glyphScale > 0}
												{@const g = cell.glyph}
												<span
													class="cmp-uptime"
													class:cmp-fact--locked={locked}
													style:--el-color={columns[i].color}
													title="~{g.uptime}s window per {g.cooldown}s cooldown (from cast; runtime conditions not modeled)"
												>
													<span
														class="cmp-uptime-solid"
														style:width="{(Math.min(g.uptime, g.cooldown) / glyphScale) * 100}%"
													></span>
													{#if g.uptime > g.cooldown}
														<span
															class="cmp-uptime-dim"
															style:width="{((g.uptime - g.cooldown) / glyphScale) * 100}%"
														></span>
													{:else if g.cooldown > g.uptime}
														<span
															class="cmp-uptime-ghost"
															style:width="{((g.cooldown - g.uptime) / glyphScale) * 100}%"
														></span>
													{/if}
												</span>
											{/if}
											{#if cell.details.length > 0}
												<span class="cmp-details">{cell.details.join(' · ')}</span>
											{/if}
											{#if cell.also}
												{@const alsoLocked = cell.also.minCon > viewCons[i]}
												<span class="cmp-also" class:cmp-fact--locked={alsoLocked}>
													{TARGET_SHORT[cell.also.target]} from C{cell.also.minCon}{alsoLocked
														? ' 🔒'
														: ''}
												</span>
											{/if}
										{/if}
									</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				{/if}
			</table>
		</div>

		<p class="cmp-footnote">
			~ = conditional (hover for the condition) · hover a fact for its source ability · bars =
			effect window (solid) vs cooldown (faint), all on one time scale · full provenance lives in
			each character’s detail card
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
		font-size: 1.25rem;
		font-weight: 600;
	}
	.cmp-mode {
		flex: 1;
		margin: 0;
		font-size: 0.7rem;
		color: var(--muted);
	}
	.cmp-close {
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
	.cmp-close:hover {
		color: var(--text);
		border-color: color-mix(in srgb, var(--accent) 55%, var(--border));
	}

	/* ── Table ────────────────────────────────────────────────── */
	.cmp-scroll {
		overflow: auto;
		min-height: 0;
	}

	.cmp-table {
		width: 100%;
		min-width: calc(108px + var(--cols) * 150px);
		border-collapse: collapse;
		font-size: 0.72rem;
	}

	.cmp-table thead td:first-child {
		width: 108px;
	}

	/* Column headers */
	.cmp-char {
		position: relative;
		padding: 0.4rem 0.6rem 0.6rem;
		border-bottom: 1px solid var(--border);
		text-align: left;
		font-weight: 400;
		vertical-align: top;
	}

	.cmp-char-remove {
		position: absolute;
		top: 0.15rem;
		right: 0.3rem;
		background: none;
		border: none;
		padding: 2px 4px;
		color: color-mix(in srgb, var(--muted) 60%, transparent);
		font-size: 0.62rem;
		cursor: pointer;
		transition: color 150ms ease;
	}
	.cmp-char-remove:hover {
		color: var(--text);
	}

	.cmp-avatar {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		border-radius: 50%;
		border: 1.5px solid var(--el-color);
		overflow: hidden;
		background: rgba(0, 0, 0, 0.5);
	}
	.cmp-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		transform: scale(1.333) translateY(-14%);
	}
	.cmp-avatar-initials {
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--el-color);
	}

	.cmp-char-name {
		display: block;
		margin-top: 0.35rem;
		font-family: var(--font-display);
		font-size: 0.85rem;
		font-weight: 600;
	}
	.cmp-char-meta {
		display: block;
		margin-top: 0.1rem;
		font-size: 0.62rem;
		color: var(--muted);
		text-transform: capitalize;
	}
	.cmp-char-con {
		display: inline-block;
		margin-top: 0.3rem;
		padding: 1px 6px;
		border-radius: 3px;
		border: 1px solid color-mix(in srgb, var(--el-color) 55%, transparent);
		font-size: 0.6rem;
		font-weight: 600;
	}
	.cmp-char-stub {
		display: inline-block;
		margin-top: 0.3rem;
		margin-left: 0.3rem;
		padding: 1px 6px;
		border-radius: 3px;
		border: 1px solid color-mix(in srgb, var(--el-geo-main, #ddb04a) 45%, transparent);
		background: color-mix(in srgb, var(--el-geo-main, #ddb04a) 8%, transparent);
		font-size: 0.58rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	/* Section + row labels */
	.cmp-section th {
		padding: 0.9rem 0 0.3rem;
		text-align: left;
		font-size: 0.62rem;
		font-weight: 600;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--muted);
	}

	.cmp-rowlabel {
		padding: 0.4rem 0.6rem 0.4rem 0;
		text-align: left;
		font-weight: 600;
		letter-spacing: 0.03em;
		color: var(--text);
		white-space: nowrap;
		vertical-align: baseline;
	}

	.cmp-table tbody tr:not(.cmp-section) th,
	.cmp-table tbody tr:not(.cmp-section) td {
		border-bottom: 1px solid color-mix(in srgb, var(--border) 50%, transparent);
	}

	/* Cells */
	.cmp-cell {
		padding: 0.4rem 0.6rem;
		vertical-align: baseline;
	}
	.cmp-cell--timing {
		white-space: nowrap;
	}

	.cmp-none {
		color: color-mix(in srgb, var(--muted) 55%, transparent);
	}

	.cmp-fact {
		display: inline-flex;
		align-items: baseline;
		gap: 0.35rem;
		white-space: nowrap;
	}
	.cmp-fact--locked {
		opacity: 0.5;
	}

	.cmp-gate {
		padding: 1px 6px;
		border-radius: 3px;
		font-size: 0.62rem;
		font-weight: 600;
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
		display: block;
		margin-top: 0.15rem;
		font-size: 0.64rem;
		color: var(--muted);
	}

	/* ── Uptime glyph — planner three-phase vocabulary, static ────
	   solid = effect window · dim = window continuing past CD ·
	   ghost = CD remainder · track = the shared time scale */
	.cmp-uptime {
		display: flex;
		width: 120px;
		max-width: 100%;
		height: 5px;
		margin-top: 0.35rem;
		border-radius: 3px;
		background: rgba(255, 255, 255, 0.05);
		overflow: hidden;
	}
	.cmp-uptime-solid {
		background: var(--el-color);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--el-color) 50%, white);
	}
	.cmp-uptime-dim {
		background: color-mix(in srgb, var(--el-color) 65%, transparent);
	}
	.cmp-uptime-ghost {
		background: color-mix(in srgb, var(--el-color) 23%, var(--surface));
	}

	.cmp-also {
		display: block;
		margin-top: 0.15rem;
		font-size: 0.64rem;
		font-style: italic;
		color: color-mix(in srgb, var(--muted) 80%, transparent);
	}

	.cmp-loading {
		padding: 1rem 0;
		color: var(--muted);
	}

	.cmp-footnote {
		margin: 0;
		font-size: 0.62rem;
		line-height: 1.5;
		color: color-mix(in srgb, var(--muted) 80%, transparent);
	}
</style>
