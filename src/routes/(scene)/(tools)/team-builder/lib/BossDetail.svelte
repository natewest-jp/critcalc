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

	const fullName = $derived(inLang(boss.name));
	/** The game writes "Family: Title" — the title is the battlefield's name. */
	const cut = $derived(fullName.indexOf(': '));

	let closeBtn = $state<HTMLButtonElement>();
	onMount(() => closeBtn?.focus());
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onClose()} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="bd-scrim" use:portal onclick={onClose}></div>
<div class="bd ctx-dark" use:portal role="dialog" aria-modal="true" aria-label={fullName}>
	<button class="btn btn--icon bd-close" bind:this={closeBtn} aria-label="Close" onclick={onClose}
		><Mark name="close" size={16} /></button
	>

	<!-- THE HERO (Nate 2026-10-09: a square art column was too much screen for
	     one image). The boss stands at the header's right, fading into the
	     panel; what you need first sits beside it on the left. -->
	<header class="bd-hero">
		<img class="bd-art" src={bossImage(battlefield.boss, 'art')} alt="" />
		<div class="bd-hero-text">
			<p class="kicker bd-kicker">Battlefield {index + 1} · Stygian Onslaught {season.version}</p>
			<h2 class="bd-title">{cut > 0 ? fullName.slice(cut + 2) : fullName}</h2>
			{#if cut > 0}<p class="bd-family">{fullName.slice(0, cut)}</p>{/if}

			<!-- THE readout: one paper card ("paper answers"). -->
			<div class="panel panel--paper bd-hp">
				<div>
					<span class="bd-hp-label">Fearless HP</span>
					<span class="bd-hp-value">{hp(battlefield.hp.fearless)}</span>
				</div>
				<div>
					<span class="bd-hp-label">Dire HP</span>
					<span class="bd-hp-value">{hp(battlefield.hp.dire)}</span>
				</div>
			</div>

			{#if battlefield.checks.length}
				<div class="bd-checks">
					{#each battlefield.checks as c, i (i)}<CheckChip
							check={c}
							verdict={verdicts?.[i]}
						/>{/each}
				</div>
			{/if}

			<ul class="bd-res" aria-label="Elemental RES">
				{#each RES_ORDER as el (el)}
					<li class:bd-res--high={boss.res[el] > 10}>
						{#if el !== 'physical' && elementIcon(el)}
							<img src={elementIcon(el)} alt={el} />
						{:else}
							<span class="bd-res-phys">Phys</span>
						{/if}
						<span>{boss.res[el]}%</span>
					</li>
				{/each}
			</ul>
		</div>
	</header>

	<div class="bd-body">
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

		<footer class="bd-foot">
			{#each inLang(boss.description).split('\n') as para, j (j)}
				<p class="bd-lore">{para}</p>
			{/each}
			{#if otherRuns.length}
				<p class="bd-runs">
					Also in Stygian Onslaught {otherRuns.map((s) => s.version).join(', ')}
				</p>
			{/if}
		</footer>
	</div>
</div>

<style>
	.bd-scrim {
		position: fixed;
		inset: 0;
		z-index: 70;
		background: rgb(0 0 0 / 0.5);
	}
	/* Centred by margins, ⛔ not a translate: a transform at a fractional
	   offset rasterises its text soft (the sub-pixel law). */
	.bd {
		position: fixed;
		z-index: 71;
		inset: 0;
		margin: auto;
		height: fit-content;
		width: min(52rem, calc(100vw - 2rem));
		max-height: calc(100svh - 5rem);
		display: flex;
		flex-direction: column;
		border-radius: var(--r-lg, 6px);
		background: var(--surface);
		color: var(--text);
		overflow: hidden auto;
	}
	.bd-close {
		position: absolute;
		top: 0.75rem;
		right: 0.75rem;
		z-index: 2;
	}

	/* ── The hero: text on the left, the boss standing at the right ── */
	.bd-hero {
		position: relative;
		display: grid;
		grid-template-columns: minmax(0, 1fr) 17rem;
		background: radial-gradient(
			ellipse 22rem 20rem at 85% 55%,
			var(--surface-raised) 0%,
			transparent 70%
		);
	}
	.bd-art {
		grid-column: 2;
		grid-row: 1;
		align-self: end;
		width: 17rem;
		height: auto;
		/* Fading into the panel at its foot and its inner edge. */
		mask-image:
			linear-gradient(to top, transparent 0%, #000 22%),
			linear-gradient(to right, transparent 0%, #000 18%);
		-webkit-mask-composite: source-in; /* WebKit's spelling of intersect */
		mask-composite: intersect;
	}
	.bd-hero-text {
		grid-column: 1;
		grid-row: 1;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1.4rem 0 1.2rem 1.6rem;
		min-width: 0;
		position: relative;
		z-index: 1;
	}
	.bd-kicker {
		font-size: var(--fs-sm);
	}
	.bd-title {
		margin: 0;
		font-size: var(--fs-4xl);
		line-height: 1.15;
	}
	.bd-family {
		margin: -0.5rem 0 0;
		font-size: var(--fs-lg);
		color: var(--muted);
	}
	.bd-hp {
		grid-template-columns: 1fr 1fr;
		padding: 0.75rem 1.1rem;
		max-width: 26rem;
	}
	.bd-hp > div {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.bd-hp-label {
		font-size: var(--fs-sm);
		color: var(--muted);
	}
	.bd-hp-value {
		font-family: var(--font-display);
		font-weight: var(--fw-semibold);
		font-size: var(--fs-3xl);
		font-variant-numeric: tabular-nums;
		color: var(--text);
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
		gap: 0.4rem 1rem;
		font-size: var(--fs-md);
		font-variant-numeric: tabular-nums;
		color: var(--muted);
	}
	.bd-res li {
		display: flex;
		align-items: center;
		gap: 4px;
	}
	/* A resistance above the usual 10% is what a player looks for. */
	.bd-res--high {
		color: var(--text);
		font-weight: var(--fw-semibold);
	}
	.bd-res img {
		width: 18px;
		height: 18px;
	}
	.bd-res-phys {
		font-size: var(--fs-xs);
	}

	/* ── The body: the mechanics, full width, then the description ── */
	.bd-body {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1.1rem 1.6rem 1.5rem;
		border-top: 1px solid var(--line-faint);
	}
	.bd-mech {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.bd-mech h3 {
		margin: 0;
		font-size: var(--fs-2xl);
	}
	.bd-mech p {
		margin: 0;
		font-size: var(--fs-lg);
		line-height: 1.55;
		max-width: 46rem;
	}
	.bd-mech strong {
		font-weight: var(--fw-semibold);
	}
	.bd-foot {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding-top: 0.9rem;
		border-top: 1px solid var(--line-faint);
	}
	.bd-lore {
		margin: 0;
		font-size: var(--fs-md);
		line-height: 1.55;
		font-style: italic;
		color: var(--muted);
		max-width: 46rem;
	}
	.bd-runs {
		margin: 0;
		font-size: var(--fs-sm);
		color: var(--muted);
	}
	/* A phone: the boss behind the header's top right, smaller and quieter. */
	@media (max-width: 47.5rem) {
		.bd-hero {
			grid-template-columns: minmax(0, 1fr);
		}
		.bd-art {
			grid-column: 1;
			justify-self: end;
			align-self: start;
			width: 9rem;
		}
		.bd-hero-text {
			padding-right: 1.6rem;
		}
	}
</style>
