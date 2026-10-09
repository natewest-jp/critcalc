<script lang="ts">
	/**
	 * A battlefield's boss, in full (Nate 2026-10-09) — opened from the
	 * magnifier on the board's boss avatar. The full art (not trimmed), the
	 * name, HP at Fearless and Dire side by side, the checks (with the team's
	 * standing), elemental RES, the boss's mechanics in the game's words, its
	 * description, and every other season it ran in.
	 *
	 * ⚠ PORTALLED: the board pane mints a containing block, so a fixed dialog
	 * inside it would be clipped to the pane (CLAUDE.md's band rule).
	 *
	 * ⏭ Working copy throughout (copy step 8). The game's highlighted runs
	 * (`**x**`) are set as <strong>.
	 */
	import { onMount } from 'svelte';
	import Mark from '$lib/components/Mark.svelte';
	import { portal } from '$lib/actions/portal';
	import { elementIcon } from '$lib/data/elementIcons.generated';
	import { BOSSES, bossImage, bossRuns, inLang, type Battlefield, type Season } from '$lib/endgame';
	import type { CheckVerdict } from '$lib/endgameChecks';
	import CheckChip from './CheckChip.svelte';

	let {
		battlefield,
		season,
		index,
		verdicts,
		onClose
	}: {
		battlefield: Battlefield;
		season: Season;
		/** 0-based battlefield number. */
		index: number;
		verdicts?: CheckVerdict[];
		onClose: () => void;
	} = $props();

	const boss = $derived(BOSSES[battlefield.boss]);
	const otherRuns = $derived(
		bossRuns(battlefield.boss).filter((s) => s.version !== season.version)
	);
	const hp = (n: number) => n.toLocaleString('en-US');
	const RES_ORDER = [
		'pyro',
		'hydro',
		'electro',
		'cryo',
		'dendro',
		'anemo',
		'geo',
		'physical'
	] as const;

	/** The game's highlight (`**x**`) → parts, so it renders as <strong>. */
	const runs = (text: string) =>
		text.split(/\*\*(.+?)\*\*/s).map((t, i) => ({ t, strong: i % 2 === 1 }));

	let closeBtn = $state<HTMLButtonElement>();
	onMount(() => closeBtn?.focus());
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onClose()} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="bd-scrim" use:portal onclick={onClose}></div>
<div class="bd ctx-dark" use:portal role="dialog" aria-modal="true" aria-label={inLang(boss.name)}>
	<button class="btn btn--icon bd-close" bind:this={closeBtn} aria-label="Close" onclick={onClose}
		><Mark name="close" size={16} /></button
	>
	<div class="bd-art">
		<img src={bossImage(battlefield.boss, 'art')} alt="" />
	</div>
	<div class="bd-body">
		<p class="kicker">Battlefield {index + 1} · Stygian Onslaught {season.version}</p>
		<h2 class="bd-name">{inLang(boss.name)}</h2>

		<div class="bd-hp">
			<div>
				<span class="bd-hp-label">Fearless</span><span class="bd-hp-value"
					>{hp(battlefield.hp.fearless)}</span
				>
			</div>
			<div>
				<span class="bd-hp-label">Dire</span><span class="bd-hp-value"
					>{hp(battlefield.hp.dire)}</span
				>
			</div>
		</div>

		{#if battlefield.checks.length}
			<div class="bd-checks">
				{#each battlefield.checks as c, i (i)}<CheckChip check={c} verdict={verdicts?.[i]} />{/each}
			</div>
		{/if}

		<ul class="bd-res" aria-label="Elemental RES">
			{#each RES_ORDER as el (el)}
				<li>
					{#if el !== 'physical' && elementIcon(el)}
						<img src={elementIcon(el)} alt={el} />
					{:else}
						<span class="bd-res-phys">Phys</span>
					{/if}
					<span>{boss.res[el]}%</span>
				</li>
			{/each}
		</ul>

		{#each boss.mechanics as m, i (i)}
			<section class="bd-mech">
				<h3>{inLang(m.name)}</h3>
				{#each inLang(m.text).split('\n') as para, j (j)}
					<p>
						{#each runs(para) as r, k (k)}{#if r.strong}<strong>{r.t}</strong
								>{:else}{r.t}{/if}{/each}
					</p>
				{/each}
			</section>
		{/each}

		{#each inLang(boss.description).split('\n') as para, j (j)}
			<p class="bd-lore">{para}</p>
		{/each}

		{#if otherRuns.length}
			<p class="bd-runs">
				Also in {otherRuns.map((s) => s.version).join(', ')}
			</p>
		{/if}
	</div>
</div>

<style>
	.bd-scrim {
		position: fixed;
		inset: 0;
		z-index: 70;
		background: rgb(0 0 0 / 0.45);
	}
	/* Centred by margins, ⛔ not a translate: a transform at a fractional
	   offset rasterises its text soft (the sub-pixel law). */
	.bd {
		position: fixed;
		z-index: 71;
		inset: 0;
		margin: auto;
		height: fit-content;
		width: min(56rem, calc(100vw - 2rem));
		max-height: calc(100svh - 6rem);
		display: grid;
		grid-template-columns: minmax(0, 20rem) minmax(0, 1fr);
		gap: 1.5rem;
		padding: 1.5rem;
		border-radius: var(--r-lg, 6px);
		background: var(--surface);
		color: var(--text);
		overflow: auto;
	}
	.bd-close {
		position: absolute;
		top: 0.75rem;
		right: 0.75rem;
	}
	.bd-art img {
		width: 100%;
		height: auto;
		display: block;
	}
	.bd-body {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.bd-body .kicker {
		margin: 0;
	}
	.bd-name {
		margin: 0;
		font-size: var(--fs-3xl);
		padding-right: 2rem;
	}
	.bd-hp {
		display: flex;
		gap: 2rem;
	}
	.bd-hp > div {
		display: flex;
		flex-direction: column;
	}
	.bd-hp-label {
		font-size: var(--fs-sm);
		color: var(--muted);
	}
	.bd-hp-value {
		font-size: var(--fs-2xl);
		font-variant-numeric: tabular-nums;
	}
	.bd-checks {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.bd-res {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem 0.9rem;
		font-size: var(--fs-sm);
		font-variant-numeric: tabular-nums;
	}
	.bd-res li {
		display: flex;
		align-items: center;
		gap: 4px;
	}
	.bd-res img {
		width: 18px;
		height: 18px;
	}
	.bd-res-phys {
		font-size: var(--fs-xs);
		color: var(--muted);
	}
	.bd-mech h3 {
		margin: 0 0 0.25rem;
		font-size: var(--fs-xl);
	}
	.bd-mech p {
		margin: 0 0 0.4rem;
		font-size: var(--fs-lg);
		line-height: 1.5;
	}
	.bd-mech strong {
		font-weight: var(--fw-semibold);
		color: var(--text);
	}
	.bd-lore {
		margin: 0;
		font-size: var(--fs-md);
		line-height: 1.5;
		color: var(--muted);
	}
	.bd-runs {
		margin: 0;
		font-size: var(--fs-sm);
		color: var(--muted);
	}
	/* A phone: the art above, smaller. */
	@media (max-width: 47.5rem) {
		.bd {
			grid-template-columns: minmax(0, 1fr);
		}
		.bd-art {
			max-width: 14rem;
		}
	}
</style>
