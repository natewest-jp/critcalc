<script lang="ts">
	import { resolve } from '$app/paths';
	import { getCharacterIndexEntry } from '$lib/data/characterLookup';
	import { constellations, loadout, ownership } from '$lib/stores';
	import { elementColors, type ElementKey } from '$lib/utils/elementColors';
	import { deriveTeamComposition } from '$lib/utils/teamComposition';
	import { deriveCoverage, deriveResonances, serializeTeamParam, type TeamSlot } from './team';
	import type { FacetKey } from './facets';
	import SlotPortrait from '$lib/components/SlotPortrait.svelte';

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
	const filledCount = $derived(members.filter((m) => m != null).length);

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

	// Layer-1 (roster) constellation write. Setting a constellation implies you own
	// the character — the same rule the Detail card enforces at its call site.
	function setCon(id: string, level: number): void {
		constellations.setLevel(id, level);
		if (!$ownership[id]) ownership.setMark(id, 'owned');
	}
</script>

<!-- A ZONE of the Team Builder's frame, not a framed island of its own: the
     page owns the surface, this owns its column. Exactly how the planner's
     portrait column sits inside .rp-frame — the two are mirror images at the
     tool-slide seam. No kicker, no empty-state copy: four empty slot cards
     ARE the explanation, same as the planner's. -->
<section class="bn" aria-label="Team">
	<div class="bn-slots">
		{#each slots as id, i (i)}
			{@const entry = members[i]}
			<div class="bn-slot" class:bn-slot--filled={id !== null} class:bn-slot--empty={id === null}>
				<!-- The shared roster card (identical to the Rotation Planner's slot).
				     Constellation/loadout edits here write Layer 1 (the roster) — the
				     "Bennett always runs Noblesse at C1" defaults the whole site reads. -->
				<SlotPortrait
					slotId={id ?? 'blank'}
					char={entry ?? null}
					conLevel={id ? ($constellations[id] ?? 0) : 0}
					loadoutEntry={id ? ($loadout[id] ?? {}) : {}}
					onSetCon={(level) => id && setCon(id, level)}
					onSetArtifact={(artId) => id && loadout.setArtifact(id, artId)}
					onSetWeapon={(wid, ref) => id && loadout.setWeapon(id, wid, ref)}
					onSetRefinement={(r) => id && loadout.setWeapon(id, $loadout[id]?.weaponId, r)}
					onPortraitClick={id ? () => onOpen(id) : undefined}
					portraitLabel={entry ? `Open ${entry.displayName}` : undefined}
					emptyLabel=""
				>
					{#snippet actions()}
						{#if id !== null}
							<!-- SlotPortrait pins the first action to the portrait's left
							     margin and the last to its right. They lived in the identity
							     row briefly and starved the name to five letters; a footer band
							     would cost the bench ~30px per card in the tool with the least
							     height to spare. -->
							<button
								class="bn-act"
								onclick={() => onAudition(i, id)}
								title="Compare {entry?.displayName ?? id} against replacements"
								aria-label="Audition replacements for {entry?.displayName ?? id}">⇄</button
							>
							<button
								class="bn-act bn-act--remove"
								onclick={() => onRemove(i)}
								title="Remove {entry?.displayName ?? id} from team"
								aria-label="Remove {entry?.displayName ?? id} from team">✕</button
							>
						{/if}
					{/snippet}
				</SlotPortrait>
			</div>
		{/each}
	</div>

	{#if filledCount > 0}
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
			title="Open the Rotation Planner with this team in the slots">Send to Rotation Planner →</a
		>
		<button class="btn bn-clear" onclick={onClear}>✕ Clear team</button>
	{/if}
</section>

<style>
	/* Zone layout only — border, fill and radius belong to the containing
	   .tb-frame; the padding echoes .rp-frame's so the column sits at the same
	   inset as the planner's portraits. */
	.bn {
		display: grid;
		gap: 0.7rem;
		padding: 10px 12px 10px;
		align-content: start;
	}

	/* Slot actions — SlotPortrait seats these either side of the loadout pill, so
	   they wear the card's shared capsule treatment (--sp-pill-*, which inherits
	   through the snippet) at the pill's own height. Round, not capsule: they are
	   square, and --r-round is the token for that. Glyph-only — title/aria carry
	   the meaning. */
	.bn-act {
		box-sizing: border-box;
		flex-shrink: 0;
		width: var(--sp-pill-h);
		height: var(--sp-pill-h);
		display: grid;
		place-items: center;
		padding: 0;
		border: var(--sp-pill-border);
		border-radius: var(--r-round);
		background: var(--sp-pill-fill);
		color: var(--muted);
		font-family: var(--font-body);
		font-size: var(--fs-2xs);
		line-height: var(--lh-none);
		cursor: pointer;
		transition:
			border-color 150ms ease,
			background 150ms ease,
			color 150ms ease;
	}
	.bn-act:hover {
		border-color: color-mix(in srgb, var(--el) 45%, var(--frame-line));
		color: var(--text);
	}
	.bn-act--remove:hover {
		border-color: color-mix(in srgb, var(--ui-danger) 55%, var(--frame-line));
		color: color-mix(in srgb, var(--ui-danger) 45%, var(--text));
	}

	.bn-clear {
		justify-self: center;
		padding: 0.15rem 0.5rem;
		border: none;
		border-radius: var(--r-sm);
		background: none;
		color: color-mix(in srgb, var(--muted) 80%, transparent);
		font-family: var(--font-body);
		font-size: var(--fs-2xs);
		font-weight: var(--fw-semibold);
		cursor: pointer;
		transition: color 150ms ease;
	}
	.bn-clear:hover {
		color: var(--text);
	}

	/* ── Slots (stacked SlotPortrait cards) ───────────────────────────────────
	   The same roster card the planner uses, stacked with a faint divider between
	   them (the planner's slot-separator language). Filled slots gain an actions
	   footer (audition / remove) the planner doesn't need. */
	.bn-slots {
		display: flex;
		flex-direction: column;
	}
	.bn-slot {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.bn-slot + .bn-slot {
		border-top: 1px solid color-mix(in srgb, var(--border) 55%, transparent);
	}

	/* ── Facts ────────────────────────────────────────────────── */
	.bn-factrow {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
	}
	.bn-res {
		padding: 0.2rem 0.45rem;
		border-radius: var(--r-sm);
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
		border-radius: var(--r-sm);
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
		border-radius: var(--r-sm);
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
		border-radius: var(--r-sm);
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
	/* No narrow-screen flip: the bench holds its edge at every width, as the
	   planner's portrait column always has. A real mobile treatment is the
	   mobile usability pass's job, not a breakpoint that moves the one thing
	   the two tools mirror each other on. */
</style>
