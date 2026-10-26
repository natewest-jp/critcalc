<script lang="ts">
	/**
	 * THE NOTICES LAB (⚓ Nate 2026-10-26) — the five shapes of
	 * docs/notices-design.md, in a mock tool and a mock full-screen surface,
	 * at desktop and phone width, with the survey's real messages
	 * (docs/notices-survey-2026-10-26.md).
	 *
	 * Everything here is a PROPOSAL drawn locally (the /lab rule): nothing in
	 * app.css yet. Local state only. When a shape is settled it moves to
	 * $lib and this page renders the real thing.
	 */
	import { onDestroy } from 'svelte';
	import { fly, fade } from 'svelte/transition';
	import { flip } from 'svelte/animate';
	import { linear } from 'svelte/easing';
	import Mark from '$lib/components/Mark.svelte';
	import { motion, T_QUICK, T_MOVE } from '$lib/motion';

	// ── Severity ────────────────────────────────────────────────────────────
	type Kind = 'success' | 'info' | 'warning' | 'error';
	/** 🎛️ How long a toast stays, by severity. null = until dismissed. A toast
	 *  with a button stays at least ACTION_MS, and any toast pauses while it
	 *  is pointed at or focused. */
	const TOAST_MS: Record<Kind, number | null> = {
		success: 4000,
		info: 6000,
		warning: 8000,
		error: null
	};
	const ACTION_MS = 8000;
	/** 🎛️ The most toasts at once; the oldest that can fade makes room. */
	const MAX_TOASTS = 3;
	const KIND_MARK = { success: 'check', info: 'about', warning: 'warn', error: 'warn' } as const;

	type Action = { label: string; run?: () => void };
	type Toast = {
		id: number;
		kind: Kind;
		text: string;
		actions: Action[];
		/** A profile's colour, shown as a disc in place of the mark. */
		swatch?: string;
		ms: number | null;
		paused: boolean;
	};

	let toasts = $state<Toast[]>([]);
	let nextId = 1;
	// Bookkeeping, never rendered: a SvelteMap would track for nothing.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const timers = new Map<number, { t: ReturnType<typeof setTimeout>; due: number; left: number }>();

	function toast(kind: Kind, text: string, actions: Action[] = [], swatch?: string): void {
		const base = TOAST_MS[kind];
		const ms = base === null ? null : actions.length ? Math.max(base, ACTION_MS) : base;
		const t: Toast = { id: nextId++, kind, text, actions, swatch, ms, paused: false };
		let list = [...toasts, t];
		while (list.length > MAX_TOASTS) {
			const drop = list.find((x) => x.ms !== null) ?? list[0];
			clear(drop.id);
			list = list.filter((x) => x !== drop);
		}
		toasts = list;
		if (ms !== null) arm(t.id, ms);
	}
	function arm(id: number, ms: number): void {
		timers.set(id, { t: setTimeout(() => dismiss(id), ms), due: Date.now() + ms, left: ms });
	}
	function clear(id: number): void {
		const tm = timers.get(id);
		if (tm) clearTimeout(tm.t);
		timers.delete(id);
	}
	function dismiss(id: number): void {
		clear(id);
		toasts = toasts.filter((x) => x.id !== id);
	}
	function pause(t: Toast): void {
		const tm = timers.get(t.id);
		if (!tm || t.paused) return;
		clearTimeout(tm.t);
		tm.left = tm.due - Date.now();
		t.paused = true;
	}
	function resume(t: Toast): void {
		const tm = timers.get(t.id);
		if (!tm || !t.paused) return;
		t.paused = false;
		arm(t.id, tm.left);
	}
	onDestroy(() => timers.forEach((tm) => clearTimeout(tm.t)));

	// ── The stage ───────────────────────────────────────────────────────────
	let surface = $state<'tool' | 'menu'>('tool');
	/** The time-left candidates (Nate: "what else could count down?"). */
	const TIMERS = [
		{ key: 'line', label: 'Line' },
		{ key: 'ring', label: 'Ring' },
		{ key: 'edge', label: 'Edge' },
		{ key: 'fill', label: 'Fill' }
	] as const;
	let timer = $state<(typeof TIMERS)[number]['key']>('line');
	let width = $state<'desktop' | 'phone'>('desktop');
	const phone = $derived(width === 'phone');

	// Banners: CONDITIONS, so each is a switch, not an event.
	let heldElsewhere = $state(false);
	let saveFailing = $state(false);

	// Status: saving → saved, quiet; failing escalates to the banner.
	let status = $state<'idle' | 'saving' | 'saved'>('idle');
	let statusTimer: ReturnType<typeof setTimeout> | undefined;
	function saveOnce(): void {
		if (saveFailing) return;
		clearTimeout(statusTimer);
		status = 'saving';
		statusTimer = setTimeout(() => {
			status = 'saved';
			statusTimer = setTimeout(() => (status = 'idle'), 1600);
		}, 500);
	}

	// Dialog: a decision whose cause is away from where you are looking.
	let unsaved = $state(true);
	let dialog = $state<{ go: string } | null>(null);
	let keepEl = $state<HTMLButtonElement>();
	$effect(() => {
		if (dialog) keepEl?.focus();
	});
	let section = $state('Teams');
	function leaveTo(to: string): void {
		if (to === section) return;
		if (unsaved) dialog = { go: to };
		else section = to;
	}
	function discard(): void {
		if (dialog) section = dialog.go;
		dialog = null;
		unsaved = false;
	}

	// The account switch: the wash, and now words.
	const PROFILES = [
		{ name: 'My account', colour: '#5fb3ff' },
		{ name: 'Alt account', colour: '#ff7a59' },
		{ name: 'Theorycraft', colour: '#e8e6e1' }
	];
	let profile = $state(0);
	let wash = $state<{ key: number; colour: string } | null>(null);
	function switchProfile(): void {
		profile = (profile + 1) % PROFILES.length;
		const p = PROFILES[profile];
		wash = { key: Date.now(), colour: p.colour };
		setTimeout(() => (wash = null), motion(2000) || 1);
		toast('info', `Switched to ${p.name}`, [], p.colour);
	}

	// The control answers for itself.
	let copied = $state<'idle' | 'ok' | 'failed'>('idle');
	function copyLink(fail = false): void {
		copied = fail ? 'failed' : 'ok';
		setTimeout(() => (copied = 'idle'), fail ? 2400 : 1600);
	}
	let armed = $state(false);
	let armTimer: ReturnType<typeof setTimeout> | undefined;
	function del(): void {
		if (!armed) {
			armed = true;
			clearTimeout(armTimer);
			armTimer = setTimeout(() => (armed = false), 3000);
			return;
		}
		armed = false;
		toast('success', 'Moved to Trash', [{ label: 'Undo' }]);
	}

	// ── The survey's messages ───────────────────────────────────────────────
	const FIRE: { group: string; items: { label: string; run: () => void }[] }[] = [
		{
			group: 'Toasts',
			items: [
				{
					label: 'Lineup cleared · Undo',
					run: () => toast('success', 'Lineup cleared', [{ label: 'Undo' }])
				},
				{
					label: 'Opened in Theorycraft',
					run: () =>
						toast('info', 'Opened in Theorycraft. Your accounts are untouched.', [
							{ label: 'Move to an account' }
						])
				},
				{
					label: 'Copy fell back to a download',
					run: () => toast('warning', 'Couldn’t copy the image, so it was downloaded instead')
				},
				{
					label: 'Invalid share link',
					run: () =>
						toast(
							'error',
							'That share link couldn’t be read. It may have been cut short when it was copied.'
						)
				},
				{
					label: 'Three at once',
					run: () => {
						toast('success', 'Team saved');
						toast('info', 'Loaded a shared rotation');
						toast('warning', 'The lineup is full, so the team wasn’t added');
					}
				}
			]
		},
		{
			group: 'Account',
			items: [{ label: 'Switch account', run: switchProfile }]
		}
	];

	const doc = 'Raiden National';

	/** The paper set (app.css .ctx-light) and the one alternative to judge. */
	const PAPER_SWATCHES = [
		{
			label: 'Danger (unchanged)',
			value: 'var(--ui-danger)',
			code: '#e63946 · 3.33',
			mark: 'warn'
		},
		{
			label: 'Warning',
			value: 'var(--ui-warning)',
			code: '#c85d02 · 3.34 · hue 50°',
			mark: 'warn'
		},
		{
			label: 'Warning, night hue',
			value: '#bc6500',
			code: '#bc6500 · 3.35 · hue 58°',
			mark: 'warn'
		},
		{ label: 'Positive', value: 'var(--ui-positive)', code: '#018d65 · 3.35', mark: 'check' },
		{
			label: 'Provisional (existing)',
			value: 'var(--ui-provisional)',
			code: '#998136 · 3.02',
			mark: 'about'
		}
	] as const;
</script>

<div class="nl-scroll">
	<div class="nl">
		<header class="nl-head">
			<p class="kicker">Lab · proposal</p>
			<h1 class="nl-title">Notices</h1>
			<p class="nl-lede">
				Five shapes, each with one job. Try each one in the stage below, at both widths, and on both
				surfaces. Then judge the specimens at the bottom side by side.
			</p>
		</header>

		<div class="nl-controls ctx-glass">
			<div class="nl-seg" role="group" aria-label="Surface">
				<button
					class="btn btn--sm"
					class:is-on={surface === 'tool'}
					onclick={() => (surface = 'tool')}>Tool</button
				>
				<button
					class="btn btn--sm"
					class:is-on={surface === 'menu'}
					onclick={() => (surface = 'menu')}>Full screen</button
				>
			</div>
			<div class="nl-seg" role="group" aria-label="Width">
				<button
					class="btn btn--sm"
					class:is-on={width === 'desktop'}
					onclick={() => (width = 'desktop')}>Desktop</button
				>
				<button
					class="btn btn--sm"
					class:is-on={width === 'phone'}
					onclick={() => (width = 'phone')}>Phone</button
				>
			</div>

			<div class="nl-seg" role="group" aria-label="Timer">
				<span class="nl-glabel">Timer</span>
				{#each TIMERS as tm (tm.key)}
					<button
						class="btn btn--sm"
						class:is-on={timer === tm.key}
						onclick={() => (timer = tm.key)}>{tm.label}</button
					>
				{/each}
			</div>

			{#each FIRE as g (g.group)}
				<div class="nl-group">
					<span class="nl-glabel">{g.group}</span>
					{#each g.items as it (it.label)}
						<button class="btn btn--sm" onclick={it.run}>{it.label}</button>
					{/each}
				</div>
			{/each}

			<div class="nl-group">
				<span class="nl-glabel">Banners (conditions)</span>
				<label class="check"
					><input type="checkbox" bind:checked={heldElsewhere} /> Open in another tab</label
				>
				<label class="check"
					><input type="checkbox" bind:checked={saveFailing} onchange={() => (status = 'idle')} /> Saves
					failing</label
				>
			</div>

			<div class="nl-group">
				<span class="nl-glabel">Status</span>
				<button class="btn btn--sm" onclick={saveOnce} disabled={saveFailing}>Autosave once</button>
			</div>

			<div class="nl-group">
				<span class="nl-glabel">Dialog</span>
				<label class="check"><input type="checkbox" bind:checked={unsaved} /> Unsaved changes</label
				>
				<span class="nl-hint">then click the sidebar (Full screen) or a tool door</span>
			</div>
		</div>

		<!-- ── THE STAGE ─────────────────────────────────────────────────────── -->
		<div class="stage-wrap">
			<div class="stage" class:is-phone={phone} class:is-menu={surface === 'menu'}>
				{#if wash}
					{#key wash.key}
						<div
							class="st-wash"
							style:--wash={wash.colour}
							style:--wash-ms="{motion(2000)}ms"
							aria-hidden="true"
						></div>
					{/key}
				{/if}

				<!-- Top bar -->
				<div class="st-top">
					<span class="st-brand">critcalc</span>
					{#if !phone}
						<span class="st-doors">
							{#each ['Planner', 'Builder', 'Visualizers'] as d (d)}
								<button class="st-door" onclick={() => leaveTo(d)} title={d}>{d}</button>
							{/each}
						</span>
					{/if}
					<span class="st-acts">
						<button
							class="st-pp"
							style:--pp={PROFILES[profile].colour}
							onclick={switchProfile}
							title="Switch account"
							aria-label="Switch account"
						></button>
					</span>
				</div>

				{#if surface === 'tool'}
					<!-- Toolbar: the document, its status, and a control that answers -->
					<div class="st-bar ctx-glass">
						<span class="st-doc">
							<span class="st-docname">{doc}</span>
							{#if saveFailing}
								<span class="st-status st-status--bad"
									><Mark name="warn" size={13} /> Not saved</span
								>
							{:else if status === 'saving'}
								<span class="st-status"><span class="st-dot"></span> Saving…</span>
							{:else if status === 'saved'}
								<span class="st-status" out:fade={{ duration: motion(T_QUICK), easing: linear }}
									><Mark name="check" size={13} /> Saved</span
								>
							{/if}
						</span>
						<span class="st-tools">
							<button
								class="btn btn--sm st-answer"
								class:is-ok={copied === 'ok'}
								class:is-bad={copied === 'failed'}
								onclick={() => copyLink(false)}
							>
								{#if copied === 'ok'}<Mark name="check" size={14} /> Copied{:else if copied === 'failed'}<Mark
										name="warn"
										size={14}
									/> Couldn’t copy{:else}<Mark name="link" size={14} /> Copy link{/if}
							</button>
							<button class="btn btn--sm" onclick={() => copyLink(true)} title="Fails, to show it"
								>Copy (fails)</button
							>
						</span>
					</div>

					{@render banners()}

					<!-- The chart, mocked -->
					<div class="st-chart" aria-hidden="true">
						{#each [0, 1, 2, 3] as r (r)}
							<div class="st-row">
								<span class="st-bar1" style:left="{8 + r * 9}%" style:width="{18 + r * 3}%"></span>
								<span class="st-bar2" style:left="{40 + r * 6}%" style:width="{12 + r * 2}%"></span>
							</div>
						{/each}
					</div>
					{#if phone}
						<div class="st-dock ctx-glass" aria-hidden="true">Raiden E &gt; Bennett Q E …</div>
					{/if}
				{:else}
					<!-- Full screen: sidebar + a team's details -->
					<div class="st-menu ctx-dark">
						{#if !phone}
							<nav class="st-side">
								{#each ['Roster', 'Teams', 'Rotations', 'Lineups', 'Settings'] as it (it)}
									<button class="st-item" class:is-on={section === it} onclick={() => leaveTo(it)}
										>{it}</button
									>
								{/each}
							</nav>
						{/if}
						<div class="st-content">
							{@render banners()}
							<div class="st-detail-head">
								<span class="st-team">Raiden National</span>
								<span class="st-detail-acts">
									<button class="btn btn--sm st-del" class:is-armed={armed} onclick={del}
										><Mark name={armed ? 'warn' : 'delete'} size={13} />
										{armed ? 'Delete?' : 'Delete team'}</button
									>
									{#if unsaved}
										<button class="btn btn--sm" onclick={() => (unsaved = false)}>Cancel</button>
										<button class="btn btn--sm btn--primary" onclick={() => (unsaved = false)}
											>Save team</button
										>
									{:else}
										<button class="btn btn--sm" onclick={() => (unsaved = true)}
											>Make an edit</button
										>
									{/if}
								</span>
							</div>
							<p class="st-section">Showing: {section}</p>
							<div class="st-cards" aria-hidden="true">
								{#each [0, 1, 2, 3] as c (c)}<span class="st-card"></span>{/each}
							</div>
						</div>
					</div>
				{/if}

				<!-- Toasts: one home, bottom centre of the surface -->
				<div class="st-toasts" aria-live="polite">
					{#each toasts as t (t.id)}
						<div
							animate:flip={{ duration: motion(T_MOVE) }}
							in:fly={{ y: 16, duration: motion(T_QUICK), easing: linear }}
							out:fade={{ duration: motion(T_QUICK), easing: linear }}
						>
							{@render toastView(t, true)}
						</div>
					{/each}
				</div>

				{#if dialog}
					<div
						class="st-scrim"
						transition:fade={{ duration: motion(T_QUICK), easing: linear }}
						onkeydown={(e) => e.key === 'Escape' && (dialog = null)}
						role="presentation"
					>
						<div
							class="st-dialog ctx-light"
							role="alertdialog"
							aria-modal="true"
							aria-labelledby="nl-dlg-t"
						>
							<h2 id="nl-dlg-t" class="st-dlg-title">Discard your changes?</h2>
							<p class="st-dlg-body">
								Your changes to <strong>Raiden National</strong> haven’t been saved. Going to {dialog.go}
								drops them.
							</p>
							<div class="st-dlg-acts">
								<button class="btn st-dlg-discard" onclick={discard}>Discard</button>
								<button class="btn btn--primary" bind:this={keepEl} onclick={() => (dialog = null)}
									>Keep editing</button
								>
							</div>
						</div>
					</div>
				{/if}
			</div>
		</div>

		<!-- ── SPECIMENS ─────────────────────────────────────────────────────── -->
		<section class="nl-specs">
			<h2 class="nl-h2">Toasts, by severity</h2>
			<p class="nl-note">
				Success, info and warning fade (4 s, 6 s, 8 s; at least 8 s with a button; paused while
				pointed at or focused). An error stays until dismissed, and it is paper.
			</p>
			<div class="nl-spec-col">
				{@render toastView(
					{
						id: -1,
						kind: 'success',
						text: 'Lineup cleared',
						actions: [{ label: 'Undo' }],
						ms: 8000,
						paused: true
					},
					false
				)}
				{@render toastView(
					{
						id: -2,
						kind: 'info',
						text: 'Opened in Theorycraft. Your accounts are untouched.',
						actions: [{ label: 'Move to an account' }],
						ms: 8000,
						paused: true
					},
					false
				)}
				{@render toastView(
					{
						id: -3,
						kind: 'info',
						text: 'Switched to Alt account',
						actions: [],
						swatch: '#ff7a59',
						ms: 6000,
						paused: true
					},
					false
				)}
				{@render toastView(
					{
						id: -4,
						kind: 'warning',
						text: 'Couldn’t copy the image, so it was downloaded instead',
						actions: [],
						ms: 8000,
						paused: true
					},
					false
				)}
				{@render toastView(
					{
						id: -5,
						kind: 'error',
						text: 'That share link couldn’t be read. It may have been cut short when it was copied.',
						actions: [],
						ms: null,
						paused: false
					},
					false
				)}
			</div>

			<h2 class="nl-h2">Banners</h2>
			<p class="nl-note">
				A condition, not an event: it stays while it is true and leaves by itself. Paper, across the
				top of the surface.
			</p>
			<div class="nl-spec-col nl-spec-col--wide">
				{@render bannerView('warning')}
				{@render bannerView('error')}
			</div>

			<h2 class="nl-h2">The UI colours on paper</h2>
			<p class="nl-note">
				Matched at danger's contrast (3.33:1 on parchment), each at the most saturation the screen
				can show. The second warning keeps the night hue; the first is nudged toward red-orange,
				which is less bronze.
			</p>
			<div class="pc ctx-light">
				{#each PAPER_SWATCHES as sw (sw.label)}
					<div class="pc-row" style:--sw={sw.value}>
						<span class="pc-mark"><Mark name={sw.mark} size={18} /></span>
						<span class="pc-chip"></span>
						<span class="pc-label">{sw.label}</span>
						<code class="pc-code">{sw.code}</code>
					</div>
				{/each}
			</div>
		</section>
	</div>
</div>

{#snippet toastView(t: Toast, live: boolean)}
	<div
		class="nt nt--{t.kind}"
		class:ctx-light={t.kind === 'error'}
		class:ctx-glass={t.kind !== 'error'}
		role={t.kind === 'error' ? 'alert' : 'status'}
		onpointerenter={() => live && pause(t)}
		onpointerleave={() => live && resume(t)}
		onfocusin={() => live && pause(t)}
		onfocusout={() => live && resume(t)}
	>
		{#if t.swatch}
			<span class="nt-swatch" style:--pp={t.swatch}></span>
		{:else}
			<span class="nt-mark"><Mark name={KIND_MARK[t.kind]} size={18} /></span>
		{/if}
		<span class="nt-text">{t.text}</span>
		{#if t.actions.length}
			<span class="nt-acts">
				{#each t.actions as a (a.label)}
					<button
						class="btn btn--sm nt-act"
						onclick={() => {
							a.run?.();
							if (live) dismiss(t.id);
						}}>{a.label}</button
					>
				{/each}
			</span>
		{/if}
		<button
			class="nt-x"
			class:has-ring={timer === 'ring' && t.ms !== null}
			aria-label="Dismiss"
			title="Dismiss"
			onclick={() => live && dismiss(t.id)}
		>
			{#if timer === 'ring' && t.ms !== null}
				<svg class="nt-ring" viewBox="0 0 28 28" aria-hidden="true">
					<circle class="nt-ring-track" cx="14" cy="14" r="12" />
					<circle
						class="nt-ring-arc"
						class:is-paused={t.paused}
						style:--ms="{t.ms}ms"
						cx="14"
						cy="14"
						r="12"
					/>
				</svg>
			{/if}
			<Mark name="close" size={14} />
		</button>
		{#if t.ms !== null && timer !== 'ring'}
			<span
				class="nt-time nt-time--{timer}"
				class:is-paused={t.paused}
				style:--ms="{t.ms}ms"
				aria-hidden="true"
			></span>
		{/if}
	</div>
{/snippet}

{#snippet bannerView(kind: 'warning' | 'error')}
	<div class="nb nb--{kind} ctx-light" role={kind === 'error' ? 'alert' : 'status'}>
		<span class="nb-mark"><Mark name="warn" size={18} /></span>
		{#if kind === 'warning'}
			<span class="nb-text"
				><strong>Open in another tab.</strong> Changes here aren’t saved until you edit here.</span
			>
			<button class="btn btn--sm btn--primary" onclick={() => (heldElsewhere = false)}
				>Edit here</button
			>
		{:else}
			<span class="nb-text"
				><strong>Couldn’t save your changes.</strong> Trying again… Your work is kept in this tab until
				it saves.</span
			>
			<button class="btn btn--sm">Download a backup</button>
		{/if}
	</div>
{/snippet}

{#snippet banners()}
	{#if saveFailing || heldElsewhere}
		<div class="st-banners" transition:fade={{ duration: motion(T_QUICK), easing: linear }}>
			{#if saveFailing}{@render bannerView('error')}{/if}
			{#if heldElsewhere}{@render bannerView('warning')}{/if}
		</div>
	{/if}
{/snippet}

<style>
	/* The scene layout pins its content with inset: 0, so a page that doesn't
	   scroll itself loses everything below the fold (the /lab rule). */
	.nl-scroll {
		position: relative;
		z-index: 1;
		height: 100%;
		overflow-y: auto;
	}
	.nl {
		max-width: 72rem;
		margin: 0 auto;
		padding: 5rem var(--site-pad-x, 1rem) 4rem;
		color: var(--text);
	}
	.nl-title {
		font-family: var(--font-display);
		font-size: var(--fs-5xl);
		color: var(--chrome);
		margin: 0.2rem 0 0.4rem;
	}
	.nl-lede,
	.nl-note {
		font-size: var(--fs-xl);
		max-width: 60ch;
		margin: 0 0 1rem;
	}
	.nl-note {
		font-size: var(--fs-lg);
	}
	.nl-h2 {
		font-family: var(--font-display);
		font-size: var(--fs-3xl);
		color: var(--chrome);
		margin: 2.5rem 0 0.4rem;
	}

	/* ── Controls ── */
	.nl-controls {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem 1.4rem;
		align-items: center;
		padding: 0.75rem 1rem;
		border-radius: 10px;
		background: var(--glass-panel);
		margin-bottom: 1rem;
	}
	.nl-seg {
		display: inline-flex;
		align-items: center;
		gap: 2px;
	}
	.nl-seg .is-on {
		box-shadow: inset 0 0 0 1.5px var(--accent);
	}
	.nl-group {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		align-items: center;
	}
	.nl-glabel {
		font-size: var(--fs-sm);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--muted);
		margin-right: 0.2rem;
	}
	.nl-hint {
		font-size: var(--fs-md);
		color: var(--muted);
	}

	/* ── Stage ── */
	.stage-wrap {
		display: flex;
		justify-content: center;
	}
	.stage {
		position: relative;
		overflow: hidden;
		width: 100%;
		height: 600px;
		border-radius: 14px;
		outline: 1px dashed rgb(255 255 255 / 0.18);
		display: flex;
		flex-direction: column;
		isolation: isolate;
	}
	.stage.is-phone {
		width: 390px;
		height: 760px;
	}
	.st-wash {
		position: absolute;
		inset: 0 0 auto;
		height: 38%;
		z-index: -1;
		pointer-events: none;
		background: linear-gradient(color-mix(in srgb, var(--wash) 32%, transparent), transparent);
		animation: wash var(--wash-ms) linear forwards;
	}
	@keyframes wash {
		to {
			opacity: 0;
		}
	}
	.st-top {
		display: flex;
		align-items: center;
		gap: 1rem;
		height: 48px;
		padding: 0 1rem;
		flex-shrink: 0;
	}
	.st-brand {
		font-family: var(--font-display);
		font-size: var(--fs-2xl);
		color: var(--chrome);
	}
	.st-doors {
		display: flex;
		gap: 0.3rem;
		margin: 0 auto;
	}
	.st-door {
		background: none;
		border: none;
		color: color-mix(in srgb, var(--chrome) 75%, transparent);
		font: inherit;
		font-size: var(--fs-md);
		padding: 0.3rem 0.6rem;
		cursor: pointer;
		border-radius: 6px;
	}
	.st-door:hover {
		background: rgb(255 255 255 / 0.08);
	}
	.st-acts {
		margin-left: auto;
	}
	.st-pp {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		border: 2px solid var(--pp);
		background: color-mix(in srgb, var(--pp) 35%, var(--slate-800));
		cursor: pointer;
	}
	.st-bar {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin: 0 0.75rem;
		padding: 0.4rem 0.6rem;
		border-radius: 8px;
		background: var(--glass-panel);
		flex-shrink: 0;
	}
	.st-doc {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		min-width: 0;
	}
	.st-docname {
		font-size: var(--fs-lg);
		font-weight: var(--fw-semibold);
		white-space: nowrap;
	}
	.st-status {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-size: var(--fs-md);
		color: var(--muted);
		white-space: nowrap;
	}
	.st-status--bad {
		color: var(--ui-danger);
		font-weight: var(--fw-semibold);
	}
	.st-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: currentColor;
		animation: pulse 1s linear infinite alternate;
	}
	@keyframes pulse {
		to {
			opacity: 0.3;
		}
	}
	.st-tools {
		display: flex;
		gap: 0.4rem;
		margin-left: auto;
	}
	.st-answer.is-ok {
		box-shadow: inset 0 0 0 1.5px var(--ui-positive);
		color: var(--ui-positive);
	}
	.st-answer.is-bad {
		box-shadow: inset 0 0 0 1.5px var(--ui-danger);
		color: var(--ui-danger);
	}
	.st-banners {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin: 0.6rem 0.75rem 0;
	}
	.st-chart {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 22px;
		padding: 2.5rem 1.5rem;
	}
	.st-row {
		position: relative;
		height: 18px;
		border-bottom: 1px solid rgb(255 255 255 / 0.06);
	}
	.st-bar1,
	.st-bar2 {
		position: absolute;
		top: 0;
		height: 14px;
		border-radius: 7px;
		background: rgb(155 120 255 / 0.55);
	}
	.st-bar2 {
		background: rgb(255 110 70 / 0.5);
	}
	.st-dock {
		margin: 0 0.5rem 0.5rem;
		padding: 0.9rem 1rem;
		border-radius: 12px;
		background: var(--glass-dock);
		font-family: var(--font-mono);
		font-size: var(--fs-lg);
		flex-shrink: 0;
	}

	/* full-screen mock */
	.st-menu {
		flex: 1;
		display: flex;
		min-height: 0;
		background: var(--surface);
	}
	.st-side {
		width: 13rem;
		padding: 1rem 0.6rem;
		display: flex;
		flex-direction: column;
		gap: 2px;
		border-right: 1px solid var(--line-faint);
	}
	.st-item {
		text-align: left;
		background: none;
		border: none;
		font: inherit;
		font-size: var(--fs-xl);
		color: var(--text);
		padding: 0.45rem 0.7rem;
		border-radius: 6px;
		cursor: pointer;
	}
	.st-item:hover {
		background: var(--surface-hover);
	}
	.st-item.is-on {
		background: var(--surface-hover);
		box-shadow: inset 2px 0 0 var(--accent);
	}
	.st-content {
		flex: 1;
		min-width: 0;
		padding: 0 1rem 1rem;
		display: flex;
		flex-direction: column;
	}
	.st-content .st-banners {
		margin: 0.75rem 0 0;
	}
	.st-detail-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.6rem 1rem;
		padding: 1rem 0 0.5rem;
	}
	.st-team {
		font-family: var(--font-display);
		font-size: var(--fs-3xl);
		color: var(--chrome);
	}
	.st-detail-acts {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-left: auto;
	}
	.st-del.is-armed {
		color: var(--ui-danger);
	}
	.st-section {
		font-size: var(--fs-md);
		color: var(--muted);
		margin: 0 0 0.75rem;
	}
	.st-cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
		gap: 0.75rem;
	}
	.st-card {
		height: 7rem;
		border-radius: 10px;
		background: var(--surface-raised);
	}

	/* ── TOAST (proposal) ── one home: bottom centre of the surface; on a phone
	   tool, above the dock. Body size, a mark, and the time it has left. */
	.st-toasts {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 1.5rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		padding: 0 1rem;
		pointer-events: none;
		z-index: 5;
		container-type: inline-size;
	}
	.stage.is-phone:not(.is-menu) .st-toasts {
		bottom: 4.6rem;
	}
	.nt {
		pointer-events: auto;
		position: relative;
		display: grid;
		grid-template-columns: auto 1fr auto auto;
		grid-template-areas: 'mark text acts x';
		align-items: center;
		gap: 0.4rem 0.7rem;
		max-width: 34rem;
		min-height: 3rem;
		padding: 0.6rem 0.6rem 0.6rem 0.9rem;
		border-radius: var(--r-md);
		overflow: hidden;
		font-size: var(--fs-xl);
		line-height: 1.35;
		box-shadow:
			0 10px 30px rgb(0 0 0 / 0.45),
			inset 0 0 0 1px rgb(255 255 255 / 0.1);
	}
	.nt.ctx-glass {
		background: var(--glass-plate);
		backdrop-filter: blur(14px);
		color: var(--text);
	}
	.nt.ctx-light {
		background: var(--surface);
		color: var(--muted);
		box-shadow:
			0 10px 30px rgb(0 0 0 / 0.5),
			inset 4px 0 0 var(--ui-danger);
		padding-left: 1.1rem;
	}
	.nt-mark,
	.nt-swatch {
		grid-area: mark;
	}
	.nt-mark {
		display: inline-flex;
	}
	/* Narrow (a phone): the buttons take their own row under the words,
	   rather than squeezing them into a column. */
	@container (max-width: 30rem) {
		.nt {
			grid-template-columns: auto 1fr auto;
			grid-template-areas: 'mark text x' '. acts acts';
		}
	}
	.nt--success .nt-mark {
		color: var(--ui-positive);
	}
	.nt--info .nt-mark {
		color: var(--text);
	}
	.nt--warning .nt-mark {
		color: var(--ui-warning);
	}
	.nt--error .nt-mark {
		color: var(--ui-danger);
	}
	.nt-swatch {
		width: 20px;
		height: 20px;
		flex-shrink: 0;
		border-radius: 50%;
		border: 2px solid var(--pp);
		background: color-mix(in srgb, var(--pp) 35%, var(--slate-800));
	}
	.nt-text {
		grid-area: text;
		min-width: 0;
	}
	.nt-acts {
		grid-area: acts;
		display: flex;
		gap: 0.4rem;
	}
	.nt-act {
		font-weight: var(--fw-semibold);
	}
	.nt-x {
		grid-area: x;
		display: inline-flex;
		padding: 0.35rem;
		border: none;
		border-radius: 6px;
		background: none;
		color: inherit;
		opacity: 0.7;
		cursor: pointer;
	}
	.nt-x:hover {
		opacity: 1;
		background: rgb(127 127 127 / 0.18);
	}
	/* ── The time left: four candidates (the lab's Timer switch). Each one is
	   a linear drain that pauses with the toast. */
	.nt {
		isolation: isolate;
	}
	.nt--success {
		--tone: var(--ui-positive);
	}
	.nt--info {
		--tone: var(--text);
	}
	.nt--warning {
		--tone: var(--ui-warning);
	}
	.nt-time {
		position: absolute;
		pointer-events: none;
	}
	.nt-time.is-paused,
	.nt-ring-arc.is-paused {
		animation-play-state: paused;
	}
	/* A. Line: a hairline along the bottom, shrinking to the left. */
	.nt-time--line {
		left: 0;
		bottom: 0;
		height: 2px;
		width: 100%;
		background: rgb(255 255 255 / 0.35);
		transform-origin: left;
		animation: drain-x var(--ms) linear forwards;
	}
	/* B. Ring: an arc round the ✕, the thing that will happen. */
	.nt-x.has-ring {
		position: relative;
		width: 28px;
		height: 28px;
		padding: 0;
		justify-content: center;
		align-items: center;
		opacity: 1;
	}
	.nt-ring {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		transform: rotate(-90deg);
	}
	.nt-ring circle {
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
	}
	.nt-ring-track {
		stroke-opacity: 0.14;
	}
	.nt-ring-arc {
		stroke-opacity: 0.75;
		stroke-dasharray: 75.4;
		animation: drain-ring var(--ms) linear forwards;
	}
	@keyframes drain-ring {
		to {
			stroke-dashoffset: 75.4;
		}
	}
	/* C. Edge: the severity rule down the left side (paper's rule, on glass),
	   draining downward. */
	.nt-time--edge {
		left: 0;
		top: 0;
		bottom: 0;
		width: 4px;
		background: var(--tone);
		transform-origin: bottom;
		animation: drain-y var(--ms) linear forwards;
	}
	.nt:has(.nt-time--edge) {
		padding-left: 1.1rem;
	}
	/* D. Fill: a faint ground behind the words, emptying to the left. */
	.nt-time--fill {
		inset: 0;
		z-index: -1;
		background: rgb(255 255 255 / 0.07);
		transform-origin: left;
		animation: drain-x var(--ms) linear forwards;
	}
	@keyframes drain-x {
		to {
			transform: scaleX(0);
		}
	}
	@keyframes drain-y {
		to {
			transform: scaleY(0);
		}
	}

	/* ── BANNER (proposal) ── a condition, paper, across the surface's top. */
	.nb {
		--nb-ink: var(--ui-danger);
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.6rem 0.9rem;
		padding: 0.7rem 0.8rem 0.7rem 1.1rem;
		border-radius: var(--r-md);
		background: var(--surface);
		color: var(--text);
		font-size: var(--fs-xl);
		line-height: 1.4;
		box-shadow:
			0 6px 20px rgb(0 0 0 / 0.35),
			inset 4px 0 0 var(--nb-ink);
	}
	/* Paper's own warning rung (app.css .ctx-light, 2026-10-26). */
	.nb--warning {
		--nb-ink: var(--ui-warning);
	}
	.nb strong {
		color: var(--muted);
	}
	.nb-mark {
		display: inline-flex;
		color: var(--nb-ink);
	}
	.nb-text {
		flex: 1 1 16rem;
	}

	/* ── DIALOG (proposal) ── the decision comes to you: the surface dims. */
	.st-scrim {
		position: absolute;
		inset: 0;
		z-index: 10;
		display: grid;
		place-items: center;
		padding: 1rem;
		background: rgb(6 9 16 / 0.6);
	}
	.st-dialog {
		width: min(28rem, 100%);
		padding: 1.5rem 1.5rem 1.25rem;
		border-radius: var(--r-md);
		background: var(--surface-broad);
		color: var(--text);
		box-shadow: 0 20px 60px rgb(0 0 0 / 0.55);
	}
	.st-dlg-title {
		font-family: var(--font-display);
		font-size: var(--fs-3xl);
		color: var(--muted);
		margin: 0 0 0.5rem;
	}
	.st-dlg-body {
		font-size: var(--fs-xl);
		line-height: 1.45;
		margin: 0 0 1.25rem;
	}
	.st-dlg-acts {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}
	.st-dlg-discard {
		color: var(--ui-danger);
	}

	/* ── paper colours ── */
	.pc {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		max-width: 34rem;
		padding: 1rem 1.25rem;
		border-radius: var(--r-md);
		background: var(--surface);
		color: var(--text);
	}
	.pc-row {
		display: grid;
		grid-template-columns: 20px 3rem 1fr auto;
		align-items: center;
		gap: 0.75rem;
	}
	.pc-mark {
		display: inline-flex;
		color: var(--sw);
	}
	.pc-chip {
		height: 1.1rem;
		border-radius: var(--r-sm);
		background: var(--sw);
	}
	.pc-label {
		font-size: var(--fs-lg);
		color: var(--muted);
	}
	.pc-code {
		font-size: var(--fs-md);
	}

	/* ── specimens ── */
	.nl-spec-col {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.75rem;
	}
	.nl-spec-col--wide {
		align-items: stretch;
		max-width: 48rem;
	}
</style>
