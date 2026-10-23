<script lang="ts">
	import { resolve } from '$app/paths';
	import CharacterDetails from '$lib/components/CharacterDetails.svelte';
	import BuffDetailRows from '$lib/components/BuffDetailRows.svelte';
	import Mark from '$lib/components/Mark.svelte';
	import { openCoverage } from '$lib/coverage/openCoverage';
	import { getCharacterIndexEntry } from '$lib/data/characterLookup';
	import type { PlannerSample } from '$lib/data/plannerSamples';
	import { siteSettings } from '$lib/stores';
	import type { SlotCaveatEntry } from '$lib/timeline/slotCaveats';
	import { plannerView as pv } from '$lib/plannerView.svelte';
	import { getAvatar, hasAvatar } from '$lib/utils/getAvatar';
	import { elementPalette } from '$lib/utils/elementColors';

	/**
	 * THE PLANNER'S INSPECTOR (inspector round, 2026-10-23; design §7). The
	 * aside's third occupant, beside the aura log, and the one the Notes button
	 * became: reference about ONE thing picked out of the rotation, read beside
	 * the timeline, never editing it (⚓ Nate: "the inspector inspects").
	 *
	 * THREE PAGES, chosen by `plannerView.target`:
	 *   null        the TEAM — the four seated characters, each a door to their
	 *               page, with the notes of their kit under them. ⚓ Nate: Notes
	 *               disabled itself with nothing to say, so it was dead weight
	 *               until it had; the team page always has the team.
	 *   character   that character's details (the modal's body, `CharacterDetails`)
	 *               with their notes after the roster line
	 *   bar         a buff bar: what the tooltip says, pinned, plus where it runs
	 *   bonus       an always-on chip under the chart (a resonance or a passive)
	 *   cast        an E or Q (its pill, or a summon or shield it raised): the
	 *               ability, its timings as drawn, what it left on the field,
	 *               and the editor's stand-in note when it has one — the
	 *               token that made it is marked in the notation meanwhile
	 *
	 * ⏭ Working copy throughout — every string here goes to Nate (style guide).
	 */
	let {
		team,
		entries,
		sample = null,
		onRemove
	}: {
		/** The seated characters, in slot order, each once. */
		team: string[];
		/** The kits' caveats (`collectSlotCaveats`), keyed by character. */
		entries: SlotCaveatEntry[];
		sample?: PlannerSample | null;
		/** The phone's Remove from team (bench-buttons round: the bench row has
		 *  no rail there). Absent on the desk, where the rail's ✕ is the way. */
		onRemove?: (id: string) => void;
	} = $props();

	const notesFor = (id: string) => entries.find((e) => e.id === id)?.caveats ?? [];

	const fmtSecs = (frames: number) => Number((frames / 60).toFixed(2));

	const charId = $derived(pv.target?.kind === 'character' ? pv.target.id : null);
	const charEntry = $derived(charId ? getCharacterIndexEntry(charId) : undefined);
	const tip = $derived(pv.target?.kind === 'bar' ? pv.inspectedTip : null);
	const cast = $derived(pv.target?.kind === 'cast' ? pv.inspectedCast : null);
	const bonus = $derived(pv.target?.kind === 'bonus' ? pv.inspectedBonus : null);

	const avatarFor = (id: string) =>
		hasAvatar(id)
			? getAvatar(id, $siteSettings.useNewOutfits, 'side', $siteSettings.travelerVariant)
			: null;
	const colorFor = (id: string) => elementPalette(getCharacterIndexEntry(id)?.element).main;
</script>

{#snippet notes(id: string)}
	{#each notesFor(id) as item, ci (ci)}
		<div class="pi-note">
			<span class="pi-note-ability"><span class="pi-note-kind">{item.kind}</span>{item.name}</span>
			<p class="pi-note-text">{item.caveat}</p>
		</div>
	{/each}
{/snippet}

{#snippet face(id: string, size: number)}
	{@const src = avatarFor(id)}
	<span
		class="pi-face ctx-dark"
		style:--pi-el={colorFor(id)}
		style:width="{size}px"
		style:height="{size}px"
		aria-hidden="true"
	>
		{#if src}<img {src} alt="" />{:else}{(getCharacterIndexEntry(id)?.displayName ?? id).slice(
				0,
				2
			)}{/if}
	</span>
{/snippet}

<div class="pi">
	{#if pv.target}
		<!-- One step back: every page but the team's leads with the way to it. -->
		<button class="pi-crumb" type="button" onclick={() => pv.inspectTeam()}>
			<Mark name="back" size={13} /> Team
		</button>
	{/if}

	{#if charId}
		<!-- ── A CHARACTER ────────────────────────────────────────────────── -->
		<header class="pi-head">
			{@render face(charId, 40)}
			<div class="pi-head-text">
				<h2 class="pi-title">{charEntry?.displayName ?? charId}</h2>
				<p class="pi-sub">
					<span style:color={colorFor(charId)}>{charEntry?.element ?? '?'}</span>
					· {charEntry?.weapon ?? '?'} · {charEntry?.rarity}★
				</p>
			</div>
		</header>
		{#if onRemove && team.includes(charId)}
			<button class="btn btn--sm pi-remove" type="button" onclick={() => onRemove(charId)}>
				<Mark name="close" size={12} /> Remove from team
			</button>
		{/if}
		<CharacterDetails id={charId} conMode="mine" defaultBuild={false} compact>
			{#snippet afterRoster()}
				{#if notesFor(charId).length > 0}
					<section class="pi-section">
						<p class="kicker">Notes</p>
						{@render notes(charId)}
					</section>
				{/if}
			{/snippet}
		</CharacterDetails>
	{:else if cast}
		<!-- ── A CAST ─────────────────────────────────────────────────────── -->
		<header class="pi-head">
			{@render face(cast.characterId, 32)}
			<div class="pi-head-text">
				<h2 class="pi-title">
					{cast.abilityName}{#if cast.variantLabel}<span class="pi-variant">
							· {cast.variantLabel}</span
						>{/if}
				</h2>
				<p class="pi-sub">
					<button
						class="pi-link"
						type="button"
						onclick={() => pv.inspect({ kind: 'character', id: cast.characterId })}
						>{cast.displayName}</button
					>
					· <span class="pi-token">{cast.label}</span> at {fmtSecs(cast.time)}s
				</p>
			</div>
		</header>
		{#if cast.standIn}
			<p class="pi-flag">{cast.standIn}</p>
		{:else if cast.uncurated}
			<p class="pi-flag">
				This character’s frames aren’t curated yet, so these timings are generic.
			</p>
		{/if}
		<dl class="pi-facts">
			<dt>Cast animation</dt>
			<dd>{fmtSecs(cast.castTime)}s</dd>
			{#if cast.uptime > 0}
				<dt>Lasts</dt>
				<dd>{fmtSecs(cast.uptime)}s</dd>
			{/if}
			{#if cast.cooldown > 0}
				<dt>Cooldown</dt>
				<dd>
					{fmtSecs(cast.cooldown)}s{#if cast.charges && cast.charges > 1}
						· {cast.charges} charges{/if}
				</dd>
				<dt>Ready again</dt>
				<dd>
					{fmtSecs(cast.readyAt)}s{#if cast.cdReduced}
						<span class="pi-quiet">({fmtSecs(cast.cdReduced)}s sooner)</span>{/if}
				</dd>
			{/if}
			{#if cast.ability === 'burst' && cast.energyCost}
				<dt>Energy</dt>
				<dd>{cast.energyCost}</dd>
			{/if}
		</dl>
		{#if cast.raised.length > 0}
			<section class="pi-section">
				<p class="kicker">On the field</p>
				{#each cast.raised as label (label)}
					<p class="pi-raised">{label}</p>
				{/each}
			</section>
		{/if}
	{:else if bonus}
		<!-- ── AN ALWAYS-ON CHIP ──────────────────────────────────────────── -->
		<header class="pi-head pi-head--bar">
			<h2 class="pi-title">{bonus.sourceLabel}</h2>
			<p class="pi-sub">Always on, for the whole rotation</p>
		</header>
		<div class="pi-rows"><BuffDetailRows effects={bonus.effects} /></div>
	{:else if tip}
		<!-- ── A BAR ──────────────────────────────────────────────────────── -->
		<header class="pi-head pi-head--bar">
			<h2 class="pi-title">{tip.sourceLabel}</h2>
			<p class="pi-sub">
				{tip.on ? `On ${tip.on}` : 'On the team'} · {fmtSecs(tip.start)}s to {fmtSecs(tip.end)}s
			</p>
		</header>
		<div class="pi-rows">
			<BuffDetailRows
				effects={tip.effects}
				isMutuallyExclusive={tip.isMutuallyExclusive}
				duration={tip.duration}
				procCooldown={tip.procCooldown}
			/>
		</div>
	{:else}
		<!-- ── THE TEAM ───────────────────────────────────────────────────── -->
		{#if sample}
			<!-- eslint-disable svelte/no-navigation-without-resolve -- the source's own site -->
			<p class="pi-credit">
				{#if !sample.source}
					A sample rotation, written for critcalc.
				{:else if sample.adapted}
					A sample rotation, adapted from
					<a class="link" href={sample.source.url} target="_blank" rel="noopener noreferrer"
						>{sample.source.name}</a
					>.
				{:else}
					A sample rotation, from
					<a class="link" href={sample.source.url} target="_blank" rel="noopener noreferrer"
						>{sample.source.name}</a
					>.
				{/if}
			</p>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		{/if}
		{#if team.length === 0}
			<p class="pi-empty">Put a character on the team, and their details show here.</p>
		{/if}
		{#each team as id (id)}
			<div class="pi-member">
				<button
					class="pi-member-name"
					type="button"
					onclick={() => pv.inspect({ kind: 'character', id })}
				>
					{@render face(id, 26)}
					<span style:color={colorFor(id)}>{getCharacterIndexEntry(id)?.displayName ?? id}</span>
					<Mark name="forwardSlim" size={12} />
				</button>
				{@render notes(id)}
			</div>
		{/each}
		{#if team.length > 1}
			<div class="pi-coverage">
				<a
					class="link"
					href="{resolve('/coverage')}?c={team.join(',')}"
					onclick={(e) => openCoverage(e, team)}>Coverage for this team</a
				>
			</div>
		{/if}
		<p class="pi-hint">
			Click an ability or a buff on the timeline, or a portrait on the bench, to see it here.
		</p>
	{/if}
</div>

<style>
	/* Fills the aside box and scrolls inside it — RotationNotes' arrangement, for
	   its reason: the box is the main column's height (sticky, `asideSticky`),
	   so a long page scrolls in place and can never grow the tool. */
	.pi {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 10px 12px 14px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.pi-crumb {
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		gap: 3px;
		margin: -2px 0 -4px -3px;
		padding: 2px 4px;
		border: none;
		border-radius: var(--r-sm);
		background: none;
		color: var(--muted);
		font: inherit;
		font-size: var(--fs-sm);
		font-weight: var(--fw-bold);
		letter-spacing: var(--ls-widest);
		text-transform: uppercase;
		cursor: pointer;
		transition: color var(--t-snap);
	}
	.pi-crumb:hover {
		color: var(--text);
	}

	.pi-head {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.pi-head--bar {
		flex-direction: column;
		align-items: stretch;
		gap: 2px;
	}
	.pi-head-text {
		min-width: 0;
	}
	.pi-title {
		margin: 0;
		font-size: var(--fs-lg);
		font-weight: var(--fw-bold);
		line-height: var(--lh-tight);
		color: var(--text);
	}
	.pi-sub {
		margin: 2px 0 0;
		font-size: var(--fs-sm);
		color: var(--muted);
	}
	.pi-variant {
		font-weight: var(--fw-semibold);
		color: var(--muted);
	}
	/* The character's name in a cast's subtitle: a door to their page, in the
	   subtitle's own ink until hovered. */
	.pi-link {
		padding: 0;
		border: none;
		background: none;
		font: inherit;
		color: var(--text);
		text-decoration: underline;
		text-decoration-color: color-mix(in srgb, currentColor 35%, transparent);
		text-underline-offset: 2px;
		cursor: pointer;
	}
	.pi-link:hover {
		text-decoration-color: currentColor;
	}
	.pi-token {
		font-family: var(--font-mono);
		color: var(--text);
	}
	/* The editor's stand-in note, in the stand-in register: the amber of the
	   squiggle under the same token (--ui-provisional). */
	.pi-flag {
		margin: 0;
		padding: 0.45rem 0.6rem;
		border-radius: 3px;
		border: 1px solid color-mix(in srgb, var(--ui-provisional) 40%, transparent);
		background: var(--ui-provisional-soft);
		font-size: var(--fs-sm);
		line-height: var(--lh-normal);
		color: var(--text);
	}
	.pi-facts {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 4px 12px;
		margin: 0;
		font-size: var(--fs-sm);
	}
	.pi-facts dt {
		color: var(--muted);
	}
	.pi-facts dd {
		margin: 0;
		text-align: right;
		font-variant-numeric: tabular-nums;
		color: var(--text);
	}
	.pi-quiet {
		color: var(--muted);
	}
	.pi-raised {
		margin: 0;
		font-size: var(--fs-sm);
		color: var(--text);
	}
	.pi-remove {
		align-self: flex-start;
	}
	.pi-rows {
		display: flex;
		flex-direction: column;
		gap: 5px;
	}

	/* The portrait disc: the element wash on slate, the DetailCard's avatar
	   at the pane's size. */
	.pi-face {
		flex: none;
		display: grid;
		place-items: center;
		border-radius: 50%;
		border: 1px solid var(--pi-el);
		overflow: hidden;
		background: color-mix(in srgb, var(--pi-el) 26%, var(--surface-well));
		font-size: var(--fs-xs);
		font-weight: var(--fw-bold);
		color: var(--pi-el);
	}
	.pi-face img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		transform: scale(1.333) translateY(-14%);
	}

	/* ── The team page ──────────────────────────────────────────────────── */
	.pi-member {
		display: flex;
		flex-direction: column;
		gap: 5px;
	}
	.pi-member-name {
		align-self: stretch;
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 0 -4px;
		padding: 3px 4px;
		border: none;
		border-radius: var(--r-sm);
		background: none;
		font: inherit;
		font-size: var(--fs-sm);
		font-weight: var(--fw-bold);
		letter-spacing: var(--ls-widest);
		text-transform: uppercase;
		text-align: left;
		color: var(--muted);
		cursor: pointer;
		transition: background var(--t-snap);
	}
	.pi-member-name > span:not(.pi-face) {
		flex: 1;
	}
	.pi-member-name:hover {
		background: var(--fill-rest);
	}
	.pi-section {
		display: flex;
		flex-direction: column;
		gap: 5px;
	}
	.pi-note {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.pi-note-ability {
		font-size: var(--fs-sm);
		font-weight: var(--fw-bold);
		color: var(--muted);
		letter-spacing: var(--ls-mid);
	}
	.pi-note-kind {
		display: inline-block;
		margin-right: 6px;
		padding: 0 4px;
		border: 1px solid var(--border);
		border-radius: var(--r-sm);
		font-size: var(--fs-sm);
		text-transform: uppercase;
		letter-spacing: var(--ls-widest);
		opacity: 0.8;
	}
	.pi-note-text {
		margin: 0;
		font-size: var(--fs-sm);
		line-height: var(--lh-normal);
		color: color-mix(in srgb, var(--text) 75%, transparent);
	}
	.pi-coverage {
		padding-top: 10px;
		border-top: 1px solid var(--border);
		font-size: var(--fs-sm);
	}
	.pi-credit,
	.pi-empty,
	.pi-hint {
		margin: 0;
		font-size: var(--fs-sm);
		line-height: var(--lh-normal);
		color: var(--muted);
	}
	.pi-hint {
		margin-top: auto;
		padding-top: 6px;
	}
</style>
