<script lang="ts">
	import { flushSync, onMount, tick } from 'svelte';
	import { fade } from 'svelte/transition';
	import { T_QUICK, motion, introLive, outroInert } from '$lib/motion';
	import { portal } from '$lib/actions/portal';
	import Mark from '$lib/components/Mark.svelte';
	import { matchName, matchValue, type FieldOption } from './statEntry';

	/**
	 * A FIELD ON THE PIECE CARD: a substat's name or its value, typed or
	 * picked from a list (a combobox). It replaces the value wheel, a reel
	 * with scroll snapping: a mouse wheel that moves in steps jumped several
	 * values a notch, and the streamer couldn't reach some (2026-11-03). The
	 * list here is a plain scroller, so a step moves it and every row it shows
	 * can be clicked.
	 *
	 * What you type is a search, never the value: the field only ever sets an
	 * option from the list (`statEntry.ts`). Enter sets the highlighted row;
	 * Tab or leaving sets the option the text names exactly, and otherwise
	 * puts the field back. Escape puts it back. ↑/↓ move the highlight.
	 */
	let {
		options,
		value,
		label,
		kind,
		placeholder = '',
		display,
		onpick
	}: {
		options: FieldOption[];
		/** The option's value now ('' for no name). */
		value: string;
		/** The accessible name. */
		label: string;
		kind: 'name' | 'value';
		/** Shown at rest when the value is ''. */
		placeholder?: string;
		/** The text at rest, when it differs from the option's label (a short name). */
		display?: string;
		onpick: (value: string) => void;
	} = $props();

	const id = $props.id();
	/** 🎛️ A list row's height, and the most rows the list shows at once. */
	const ROW_H = 28;
	const MAX_ROWS = 8;

	let inputEl = $state<HTMLInputElement>();
	let listEl = $state<HTMLElement>();
	let open = $state(false);
	/** The text while the field has focus; null at rest. */
	let draft = $state<string | null>(null);
	/** Typed since the field took focus: until then the list is the whole list. */
	let typed = $state(false);
	let active = $state(-1);
	let pos = $state({ x: 0, y: 0, w: 0, above: false });
	/** No keyboard on a touch screen for a name: ten rows are quicker tapped. */
	let coarse = $state(false);
	onMount(() => (coarse = matchMedia('(pointer: coarse)').matches));

	const current = $derived(options.find((o) => o.value === value) ?? null);
	const restText = $derived(value === '' ? '' : (display ?? current?.label ?? value));
	const match = $derived.by(() => {
		if (!typed || draft === null) return { options, exact: current, nearest: false };
		return kind === 'value' ? matchValue(draft, options) : matchName(draft, options);
	});
	const shown = $derived(match.options);

	function place() {
		if (!inputEl) return;
		const r = inputEl.getBoundingClientRect();
		const rows = Math.min(MAX_ROWS, Math.max(1, shown.length) + (match.nearest ? 1 : 0));
		const h = rows * ROW_H + 8;
		const vh = document.documentElement.clientHeight;
		const above = r.bottom + 4 + h > vh - 8 && r.top - 4 - h > 8;
		const w = Math.max(r.width, kind === 'value' ? 144 : 176);
		pos = {
			x: Math.max(8, Math.min(kind === 'value' ? r.right - w : r.left, window.innerWidth - w - 8)),
			y: above ? r.top - 4 - h : r.bottom + 4,
			w,
			above
		};
	}

	async function openList() {
		if (open) return;
		place();
		open = true;
		active = typed ? (match.exact ? shown.indexOf(match.exact) : -1) : shown.indexOf(current!);
		await tick();
		// the value you have sits in the middle of the list, as the wheel's did
		if (listEl && active >= 0)
			listEl.scrollTop = active * ROW_H - (listEl.clientHeight - ROW_H) / 2;
	}

	function close() {
		open = false;
		active = -1;
	}

	/** Back to the value the field had: the field shows it again. */
	function revert() {
		draft = null;
		typed = false;
		close();
	}

	function pick(o: FieldOption) {
		draft = null;
		typed = false;
		close();
		if (o.value === value) return;
		onpick(o.value);
		// ⚠ Now, not at the next microtask: a Tab that set this field moves
		// focus on as soon as the blur returns, and the next field (a line's
		// value, after its name) must already hold its new value, or its
		// select-all on focus selects nothing and the typing appends.
		flushSync();
	}

	/** Tab or leaving: set what the text names exactly, or put it back. */
	function settle() {
		if (typed && match.exact) pick(match.exact);
		else revert();
	}

	function onFocus() {
		typed = false;
		// typing replaces the whole value, as in the slider's field
		inputEl?.select();
	}

	/**
	 * A press on a field that isn't focused focuses it with the whole value
	 * selected, and opens the list. ⚠ Done here, with the press's own caret
	 * placement prevented: a select() after focus is undone by Chrome's
	 * mouseup, and the typing then appended to the old value ("6.610.9").
	 * A press on the focused field places the caret as usual.
	 */
	function onMouseDown(e: MouseEvent) {
		if (document.activeElement !== inputEl) {
			e.preventDefault();
			inputEl?.focus();
		}
		void openList();
	}

	function onInput(e: Event) {
		draft = (e.currentTarget as HTMLInputElement).value;
		typed = true;
		if (!open) void openList();
		else place();
		active = match.exact ? shown.indexOf(match.exact) : kind === 'name' && shown.length ? 0 : -1;
	}

	function scrollToActive() {
		if (!listEl || active < 0) return;
		const top = active * ROW_H;
		if (top < listEl.scrollTop) listEl.scrollTop = top;
		else if (top + ROW_H > listEl.scrollTop + listEl.clientHeight)
			listEl.scrollTop = top + ROW_H - listEl.clientHeight;
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
			e.preventDefault();
			if (!open) {
				void openList();
				return;
			}
			const n = shown.length;
			if (!n) return;
			const step = e.key === 'ArrowDown' ? 1 : -1;
			active = active < 0 ? (step > 0 ? 0 : n - 1) : Math.max(0, Math.min(n - 1, active + step));
			scrollToActive();
		} else if (e.key === 'Enter') {
			e.preventDefault();
			if (!open) void openList();
			else if (active >= 0 && shown[active]) pick(shown[active]);
			else nudge();
		} else if (e.key === 'Escape') {
			if (open || typed) {
				e.preventDefault();
				revert();
				void tick().then(() => inputEl?.select());
			}
		}
	}

	/** A refused Enter: the shared nudge (app.css `@keyframes nudge`). */
	let nudging = $state(false);
	function nudge() {
		nudging = false;
		void tick().then(() => (nudging = true));
	}

	function onBlur(e: FocusEvent) {
		// a tap on the list (touch) moves focus to it: the list still decides
		if (listEl && listEl.contains(e.relatedTarget as Node | null)) return;
		settle();
	}

	function onListFocusOut(e: FocusEvent) {
		if (e.relatedTarget === inputEl || listEl?.contains(e.relatedTarget as Node | null)) return;
		settle();
	}

	function onRowClick(o: FieldOption, e: MouseEvent) {
		pick(o);
		// the mouse keeps the field (Tab goes on from it); a touch lets go
		if (e.detail > 0 && !coarse) inputEl?.focus();
	}

	// The field moves with the tile's scroller: the list follows it.
	$effect(() => {
		if (!open) return;
		const follow = (e: Event) => {
			if (e.target !== listEl) place();
		};
		window.addEventListener('scroll', follow, true);
		window.addEventListener('resize', follow);
		return () => {
			window.removeEventListener('scroll', follow, true);
			window.removeEventListener('resize', follow);
		};
	});
</script>

<span class="sf sf--{kind}" class:is-blank={value === ''} class:is-nudging={nudging}>
	<input
		bind:this={inputEl}
		class="sf-input"
		type="text"
		role="combobox"
		aria-label={label}
		aria-expanded={open}
		aria-controls="{id}-list"
		aria-autocomplete="list"
		aria-activedescendant={open && active >= 0 ? `${id}-${active}` : undefined}
		autocomplete="off"
		autocapitalize="off"
		spellcheck="false"
		inputmode={kind === 'value' ? 'decimal' : coarse ? 'none' : 'text'}
		{placeholder}
		value={draft ?? restText}
		onfocus={onFocus}
		onblur={onBlur}
		oninput={onInput}
		onkeydown={onKeydown}
		onmousedown={onMouseDown}
		onanimationend={() => (nudging = false)}
	/>
	{#if kind === 'name'}<Mark name="chevron" size={12} />{/if}
</span>

{#if open}
	<!-- The list: a plain scroller (no snapping), one row per option. A mouse
	     press on it keeps the field's focus; a touch takes it, and the list
	     settles when focus leaves both. -->
	<div
		bind:this={listEl}
		id="{id}-list"
		class="sf-list sf-list--{kind} ctx-dark"
		role="listbox"
		aria-label={label}
		tabindex="-1"
		use:portal
		style:left="{pos.x}px"
		style:top="{pos.y}px"
		style:width="{pos.w}px"
		style:max-height="{MAX_ROWS * ROW_H + 8}px"
		style:--sf-row-h="{ROW_H}px"
		transition:fade={{ duration: motion(T_QUICK) }}
		onintrostart={introLive}
		onoutrostart={outroInert}
		onmousedown={(e) => e.preventDefault()}
		onfocusout={onListFocusOut}
	>
		{#if match.nearest}
			<p class="sf-note">Not a value the game shows. Nearest:</p>
		{:else if !shown.length}
			<p class="sf-note">
				{kind === 'name'
					? 'No substat by that name'
					: options.length
						? 'Not a value'
						: 'Pick the substat first'}
			</p>
		{/if}
		{#each shown as o, i (o.value)}
			<div
				id="{id}-{i}"
				class="sf-row"
				class:is-active={i === active}
				class:is-current={o.value === value}
				class:is-clear={o.value === ''}
				role="option"
				aria-selected={o.value === value}
				tabindex="-1"
				onclick={(e) => onRowClick(o, e)}
				onkeydown={() => {}}
				onpointerenter={(e) => {
					if (e.pointerType === 'mouse') active = i;
				}}
			>
				{o.label}
			</div>
		{/each}
	</div>
{/if}

<style>
	.sf {
		position: relative;
		display: grid;
		min-width: 0;
	}

	.sf-input {
		width: 100%;
		min-width: 0;
		height: 2rem;
		border: none;
		border-radius: 3px;
		background: var(--fill-rest);
		color: var(--text);
		font-size: var(--fs-lg);
		font-weight: var(--fw-semibold);
		text-overflow: ellipsis;
		cursor: pointer;
		transition: background var(--t-snap);
	}

	.sf-input:hover {
		background: var(--fill-hover);
	}

	.sf-input:focus {
		cursor: text;
		outline: 2px solid color-mix(in srgb, var(--accent) 55%, transparent);
		outline-offset: 1px;
	}

	.sf-input::placeholder {
		color: var(--muted);
		font-weight: var(--fw-normal);
		opacity: 1;
	}

	/* A name: the body face, its chevron on the right, as the select it replaced */
	.sf--name .sf-input {
		padding: 0 1.7rem 0 0.6rem;
		font-family: var(--font-body);
	}

	.sf--name :global(svg) {
		position: absolute;
		right: 0.55rem;
		top: 50%;
		translate: 0 -50%;
		pointer-events: none;
		color: var(--muted);
	}

	/* A value: an input field, one of the two sanctioned Mono homes (Nate
	   2026-07-24), right aligned so the decimals line up down the card */
	.sf--value .sf-input {
		padding: 0 0.45rem;
		font-family: var(--font-mono);
		font-size: var(--fs-xl);
		text-align: right;
	}

	.sf.is-nudging {
		animation: nudge 120ms 2;
	}

	/* The list: a popover over the instrument, the modal role */
	.sf-list {
		position: fixed;
		z-index: 91;
		overflow-y: auto;
		overscroll-behavior: contain;
		padding: 4px 0;
		border: 1px solid var(--border);
		border-radius: var(--r-md);
		background: var(--surface);
		box-shadow: 0 10px 32px rgba(0, 0, 0, 0.55);
		outline: none;
	}

	.sf-row {
		display: flex;
		align-items: center;
		height: var(--sf-row-h);
		padding: 0 0.7rem;
		color: var(--muted);
		font-size: var(--fs-lg);
		font-weight: var(--fw-semibold);
		cursor: pointer;
	}

	.sf-list--value .sf-row {
		justify-content: flex-end;
		font-family: var(--font-mono);
		font-size: var(--fs-xl);
	}

	.sf-row.is-current {
		color: var(--accent);
	}

	.sf-row.is-active {
		background: color-mix(in srgb, var(--accent) 20%, transparent);
		color: var(--text);
	}

	.sf-row.is-clear {
		font-weight: var(--fw-normal);
	}

	.sf-note {
		margin: 0;
		padding: 0.3rem 0.7rem;
		font-size: var(--fs-sm);
		line-height: var(--lh-snug);
		color: var(--muted);
		text-align: left;
	}
</style>
