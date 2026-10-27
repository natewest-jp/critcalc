<script lang="ts">
	import { nextLayout } from '$lib/nextLayout';
	import InspectModal from '$lib/components/InspectModal.svelte';
	/**
	 * A battlefield's boss, in full (Nate 2026-10-09) — opened from the
	 * magnifier on the board's boss avatar. The full art (not trimmed), the
	 * name, HP at Fearless and Dire side by side, the checks (with the team's
	 * standing), the boss's mechanics in the game's words, its
	 * description, and every other season it ran in.
	 *
	 * ⚠ PORTALLED: the board pane mints a containing block, so a fixed dialog
	 * inside it would be clipped to the pane (CLAUDE.md's band rule).
	 *
	 * ⏭ Working copy throughout (copy step 8). The game's highlighted runs
	 * (`**x**`) are set as <strong>.
	 */
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { T_QUICK, motion, introLive, outroInert } from '$lib/motion';
	import Mark from '$lib/components/Mark.svelte';
	import { portal } from '$lib/actions/portal';
	import { closeOnLeave } from '$lib/closeOnLeave';
	import {
		BOSSES,
		bossImage,
		bossRuns,
		inLang,
		loadBossText,
		type Battlefield,
		type BossText,
		type Season
	} from '$lib/endgame';
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
	/** The mechanics and the lore load with the modal (their own chunk); the
	 *  header — name, art, HP, checks — needs none of it and paints at once. */
	let text = $state<BossText | null>(null);
	$effect(() => {
		const slug = battlefield.boss;
		let live = true;
		loadBossText().then((all) => {
			if (live) text = all[slug] ?? null;
		});
		return () => {
			live = false;
		};
	});
	const otherRuns = $derived(
		bossRuns(battlefield.boss).filter((s) => s.version !== season.version)
	);
	const hp = (n: number) => n.toLocaleString('en-US');

	/** The game's highlight (`**x**`) → parts, so it renders as <strong>. */
	const runs = (text: string) =>
		text.split(/\*\*(.+?)\*\*/s).map((t, i) => ({ t, strong: i % 2 === 1 }));

	const fullName = $derived(inLang(boss.name));
	/** The game writes "Name: Title" — "Battle-Hardened Domovoy Sculptor: Gale
	 *  Hewing". The NAME leads (Nate 2026-10-09); the title is its epithet. */
	const cut = $derived(fullName.indexOf(': '));

	let closeBtn = $state<HTMLButtonElement>();
	onMount(() => closeBtn?.focus());
	// Portalled out of a page the tool pan keeps alive, paused, through the leave.
	closeOnLeave(
		() => true,
		() => onClose()
	);
</script>

<svelte:window onkeydown={(e) => !$nextLayout && e.key === 'Escape' && onClose()} />

{#snippet body()}
	<!-- THE HERO (Nate 2026-10-09, second arrangement): the boss stands at the
     top right corner, fading leftward and down into the panel; the name and
     the battlefield's checks sit beside it. -->
	<header class="bd-hero">
		<img class="bd-art" src={bossImage(battlefield.boss, 'art')} alt="" />
		<div class="bd-hero-text">
			<p class="kicker bd-kicker">Battlefield {index + 1} · Stygian Onslaught {season.version}</p>
			<h2 class="bd-title">{cut > 0 ? fullName.slice(0, cut) : fullName}</h2>
			{#if cut > 0}<p class="bd-family">{fullName.slice(cut + 2)}</p>{/if}
			{#if battlefield.checks.length}
				<div class="bd-checks">
					{#each battlefield.checks as c, i (i)}<CheckChip
							check={c}
							verdict={verdicts?.[i]}
						/>{/each}
				</div>
			{/if}
		</div>

		<!-- THE readout: one paper card ("paper answers") — HP at both
	     difficulties. -->
		<div class="panel panel--paper bd-card">
			<div class="bd-hp">
				<span class="bd-hp-label">Fearless HP</span>
				<span class="bd-hp-value">{hp(battlefield.hp.fearless)}</span>
			</div>
			<div class="bd-hp">
				<span class="bd-hp-label">Dire HP</span>
				<span class="bd-hp-value">{hp(battlefield.hp.dire)}</span>
			</div>
		</div>
	</header>

	<!-- The body: the mechanics in the reading column, the lore and the other
     seasons beside them — what a player reads vs what they glance at. -->
	<div class="bd-body">
		<div class="bd-mechs">
			{#each text?.mechanics ?? [] as m, i (i)}
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
		</div>

		<aside class="bd-aside">
			{#each text ? inLang(text.description).split('\n') : [] as para, j (j)}
				<p class="bd-lore">{para}</p>
			{/each}
			{#if otherRuns.length}
				<p class="bd-runs">
					Also in Stygian Onslaught {otherRuns.map((s) => s.version).join(', ')}
				</p>
			{/if}
		</aside>
	</div>
{/snippet}

{#if $nextLayout}
	<!-- ⚓ The inspector's modal shape (inspector round, Nate 2026-10-23): the
	     Builder's one shell, a margin that closes it. -->
	<InspectModal label={fullName} width="52rem" {onClose}>
		<div class="bd-in">{@render body()}</div>
	</InspectModal>
{:else}
	<!-- Fades on --t-quick — a SURFACE over a scrim; `outroInert` is the
	     outro-eats-your-click fix ($lib/motion). ⛔ don't drop it. -->
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
	<div
		class="bd-scrim"
		use:portal
		onclick={onClose}
		transition:fade={{ duration: motion(T_QUICK) }}
		onintrostart={introLive}
		onoutrostart={outroInert}
	></div>
	<div
		class="bd ctx-dark"
		use:portal
		role="dialog"
		aria-modal="true"
		aria-label={fullName}
		transition:fade={{ duration: motion(T_QUICK) }}
		onintrostart={introLive}
		onoutrostart={outroInert}
	>
		<button class="btn btn--icon bd-close" bind:this={closeBtn} aria-label="Close" onclick={onClose}
			><Mark name="close" size={16} /></button
		>
		{@render body()}
	</div>
{/if}

<style>
	/* Inside the InspectModal shell (inspector round): the shell is the ground
	   and the scroller; the content keeps its own column. */
	.bd-in {
		display: flex;
		flex-direction: column;
	}
	/* The shell's shared insets (one x for all three modals' text). */
	.bd-in .bd-hero {
		padding: var(--im-pad-top) var(--im-pad-x) 1.3rem;
	}
	.bd-in .bd-body {
		padding: 1.2rem var(--im-pad-x) 1.5rem;
	}
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
		border-radius: var(--r-md);
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

	/* ── The hero: the boss in the top right corner, the name beside it ── */
	.bd-hero {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
		padding: 1.5rem 1.6rem 1.3rem;
		overflow: hidden;
	}
	/* Out of flow, so the art sets no height of its own: it fills the hero's
	   top right and fades left and down into the panel. */
	.bd-art {
		position: absolute;
		top: -1rem;
		right: -1rem;
		width: 22rem;
		height: auto;
		max-width: none;
		mask-image:
			linear-gradient(to top, transparent 8%, #000 45%),
			linear-gradient(to right, transparent 0%, #000 35%);
		-webkit-mask-composite: source-in; /* WebKit's spelling of intersect */
		mask-composite: intersect;
		pointer-events: none;
	}
	/* Positioned: the art's mask makes it a stacking context, which would
	   otherwise paint over in-flow content. */
	.bd-hero-text,
	.bd-card {
		position: relative;
	}
	.bd-hero-text {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		max-width: calc(100% - 15rem);
		min-width: 0;
	}
	.bd-kicker {
		font-size: var(--fs-sm);
	}
	.bd-title {
		margin: 0.15rem 0 0;
		font-size: var(--fs-4xl);
		line-height: 1.15;
	}
	.bd-family {
		margin: -0.3rem 0 0;
		font-size: var(--fs-lg);
		color: var(--muted);
	}
	.bd-checks {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-top: 0.35rem;
	}

	/* The readout: HP at both difficulties. ⛔ No elemental RES (Nate
	   2026-10-09) — the data had the base template, not the fight's values,
	   which step with most bosses' mechanics; stygian.moe has them. */
	.bd-card {
		grid-template-columns: auto auto;
		align-self: flex-start;
		column-gap: 2.5rem;
		padding: 0.8rem 1.4rem 0.85rem 1.2rem;
	}
	.bd-hp {
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

	/* ── The body: mechanics to read, lore to glance at ── */
	.bd-body {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 14rem;
		gap: 1.25rem 2rem;
		padding: 1.2rem 1.6rem 1.5rem;
		border-top: 1px solid var(--line-faint);
	}
	.bd-mechs {
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
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
	}
	.bd-mech strong {
		font-weight: var(--fw-semibold);
	}
	.bd-aside {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		padding-top: 0.35rem;
	}
	.bd-lore {
		margin: 0;
		font-size: var(--fs-md);
		line-height: 1.55;
		font-style: italic;
		color: var(--muted);
	}
	.bd-runs {
		margin: 0.3rem 0 0;
		font-size: var(--fs-sm);
		color: var(--muted);
	}
	/* A phone: the boss smaller behind the top right, one column below. */
	@media (max-width: 47.5rem) {
		.bd-art {
			width: 12rem;
		}
		.bd-hero-text {
			max-width: calc(100% - 6rem);
		}
		.bd-card {
			column-gap: 1.5rem;
		}
		.bd-body {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
