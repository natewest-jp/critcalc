<script lang="ts">
	export type DropdownItem = {
		id: string;
		label: string;
		iconSrc?: string;
	};

	let {
		items,
		selected,
		placeholder,
		disabled = false,
		title,
		onSelect
	}: {
		items: DropdownItem[];
		selected?: string;
		placeholder: string;
		disabled?: boolean;
		title?: string;
		onSelect: (id: string | undefined) => void;
	} = $props();

	let open = $state(false);
	let containerEl = $state<HTMLDivElement | undefined>(undefined);

	let selectedItem = $derived(items.find((item) => item.id === selected));

	function toggle(e: MouseEvent) {
		e.stopPropagation();
		if (!disabled) open = !open;
	}

	function select(e: MouseEvent, id: string | undefined) {
		e.stopPropagation();
		onSelect(id);
		open = false;
	}

	function handleWindowClick(e: MouseEvent) {
		if (open && containerEl && !containerEl.contains(e.target as Node)) {
			open = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && open) {
			open = false;
		}
	}
</script>

<svelte:window onclick={handleWindowClick} onkeydown={handleKeydown} />

<div class="ld-wrap" bind:this={containerEl}>
	<button
		class="ld-trigger"
		class:ld-trigger--set={!!selected}
		class:ld-trigger--disabled={disabled}
		onclick={toggle}
		aria-expanded={open}
		aria-disabled={disabled}
		title={disabled ? title : undefined}
	>
		{#if selectedItem?.iconSrc}
			<img class="ld-trigger-icon" src={selectedItem.iconSrc} alt="" />
		{:else}
			<span class="ld-trigger-icon ld-trigger-icon--empty"></span>
		{/if}
		<span class="ld-trigger-label">{selectedItem?.label ?? placeholder}</span>
		<span class="ld-caret" aria-hidden="true">{open ? '▴' : '▾'}</span>
	</button>

	{#if open}
		<div class="ld-dropdown" role="listbox">
			<button
				class="ld-item"
				class:ld-item--selected={!selected}
				role="option"
				aria-selected={!selected}
				onclick={(e) => select(e, undefined)}
			>
				<span class="ld-item-icon ld-item-icon--empty"></span>
				<span class="ld-item-label ld-item-label--none">None</span>
			</button>
			{#each items as item (item.id)}
				<button
					class="ld-item"
					class:ld-item--selected={item.id === selected}
					role="option"
					aria-selected={item.id === selected}
					onclick={(e) => select(e, item.id)}
				>
					{#if item.iconSrc}
						<img class="ld-item-icon" src={item.iconSrc} alt="" />
					{:else}
						<span class="ld-item-icon ld-item-icon--empty"></span>
					{/if}
					<span class="ld-item-label">{item.label}</span>
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.ld-wrap {
		position: relative;
		width: 100%;
	}

	/* Trigger reads as a quiet solid chip — an editable slot, not a ghost row. */
	.ld-trigger {
		display: flex;
		align-items: center;
		gap: 5px;
		width: 100%;
		background: rgba(255, 255, 255, 0.045);
		border: none;
		padding: 3px 6px;
		cursor: pointer;
		border-radius: 3px;
		transition: background 150ms ease;
		min-height: 21px;
	}
	.ld-trigger:hover:not(.ld-trigger--disabled) {
		background: rgba(255, 255, 255, 0.09);
	}
	.ld-trigger--disabled {
		opacity: 0.35;
		cursor: default;
	}

	.ld-trigger-icon {
		flex-shrink: 0;
		width: 15px;
		height: 15px;
		border-radius: 2px;
		object-fit: cover;
	}
	.ld-trigger-icon--empty {
		background: rgba(255, 255, 255, 0.08);
		border-radius: 2px;
	}

	.ld-trigger-label {
		flex: 1;
		font-size: 0.625rem;
		font-weight: 500;
		color: var(--muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		text-align: left;
		letter-spacing: 0.03em;
	}
	.ld-trigger--set .ld-trigger-label {
		color: rgba(255, 255, 255, 0.8);
	}

	.ld-caret {
		flex-shrink: 0;
		font-size: 0.45rem;
		color: var(--muted);
		line-height: 1;
	}

	/* ── Dropdown list ──────────────────────────────────────────── */
	.ld-dropdown {
		position: absolute;
		top: calc(100% + 2px);
		left: 0;
		min-width: 160px;
		background: var(--surface-raised);
		border: none;
		border-radius: 6px;
		z-index: 200;
		padding: 3px 0;
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.06),
			0 6px 20px rgba(0, 0, 0, 0.5);
	}

	.ld-item {
		display: flex;
		align-items: center;
		gap: 6px;
		width: 100%;
		background: none;
		border: none;
		padding: 5px 8px;
		cursor: pointer;
		text-align: left;
		transition: background 0.1s;
	}
	.ld-item:hover {
		background: rgba(255, 255, 255, 0.07);
	}
	.ld-item--selected {
		background: rgba(255, 255, 255, 0.04);
	}
	.ld-item--selected .ld-item-label {
		color: rgba(255, 255, 255, 0.9);
	}

	.ld-item-icon {
		flex-shrink: 0;
		width: 18px;
		height: 18px;
		border-radius: 3px;
		object-fit: cover;
	}
	.ld-item-icon--empty {
		background: rgba(255, 255, 255, 0.06);
		border-radius: 3px;
	}

	.ld-item-label {
		font-size: 0.6875rem;
		font-weight: 500;
		color: rgba(255, 255, 255, 0.55);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		letter-spacing: 0.02em;
	}
	.ld-item-label--none {
		font-style: italic;
		color: rgba(255, 255, 255, 0.3);
	}
</style>
