<script lang="ts">
	import { onMount } from 'svelte';

	export let name = 'Bennett';
	export let constellation = 'C6';
	export let elementColor = '#d95a2b';
	export let elementBorder = '#a01e14';

	let cardEl: HTMLDivElement;

	onMount(() => {
		if (!cardEl || typeof ResizeObserver === 'undefined') {
			return;
		}

		const styles = getComputedStyle(cardEl);
		const baseWidth = parseFloat(styles.getPropertyValue('--card-width')) || 320;
		const baseHeight = parseFloat(styles.getPropertyValue('--card-height')) || 180;

		const updateScale = (width: number, height: number) => {
			const next = Math.min(width / baseWidth, height / baseHeight);
			cardEl.style.setProperty('--scale', next.toString());
		};

		const observer = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const { width, height } = entry.contentRect;
				updateScale(width, height);
			}
		});

		observer.observe(cardEl);

		const rect = cardEl.getBoundingClientRect();
		updateScale(rect.width, rect.height);

		return () => observer.disconnect();
	});
</script>

<div
	class="card"
	style:--element-color={elementColor}
	style:--element-border={elementBorder}
	bind:this={cardEl}
>
	<div class="card-body">
		<div class="bio-col">
			<div class="bio">
				<img src="/assets/characters/full/bennett-newfit.webp" alt="Bennett" class="portrait" />
				<img src="/assets/weapon-types/sword.webp" alt="Sword" class="weapon-type" />
				<button class="constellation" aria-label="Select constellation">
					{constellation} <span class="constellation-caret">▾</span>
				</button>
				<!-- Avatar image goes here; gradient placeholder for now -->
			</div>

			<div class="nameplate">
				<span class="element-icon" aria-hidden="true">
					<img src="/assets/elements/flat-color/pyro.png" alt="Pyro" />
				</span>
				<span class="name">{name}</span>
			</div>
		</div>

		<div class="stats">
			<section class="ability">
				<header class="ability-header">
					<span class="key">E</span>
					<span class="title">Elemental Skill</span>
					<span class="icon-group">
						<span class="icon icd" title="No ICD">
							<img src="/noicd.svg" alt="" aria-hidden="true" />
						</span>
						<span class="icon snapshot" title="Snapshotting">
							<img src="/snapshots.svg" alt="" aria-hidden="true" />
						</span>
					</span>
				</header>

				<div class="stat-row">
					<span class="span-3 label muted">cooldown</span>
					<div class="grid-2">
						<span class="span-2 value muted">5</span>
						<span class="tap muted">tap</span>
					</div>
					<div class="grid-2">
						<span class="span-2 value muted">7.5</span>
						<span class="key-variant">
							<span class="key muted">h1</span>
							<span class="variant muted">hold 1</span>
						</span>
					</div>
					<div class="grid-2">
						<span class="span-2 value muted">10</span>
						<span class="key-variant">
							<span class="key muted">h2</span>
							<span class="variant muted">hold 2</span>
						</span>
					</div>
				</div>
			</section>

			<section class="ability">
				<header class="ability-header">
					<span class="key">Q</span>
					<span class="title">Elemental Burst</span>
					<span class="icon-group">
						<span class="icon icd" title="No ICD">
							<img src="/noicd.svg" alt="" aria-hidden="true" />
						</span>
						<span class="icon snapshot" title="Snapshotting">
							<img src="/snapshots.svg" alt="" aria-hidden="true" />
						</span>
					</span>
				</header>

				<div class="stat-row">
					<div class="grid-1">
						<span class="label">duration</span>
						<span class="value">12</span>
					</div>
					<div class="grid-1">
						<span class="label muted">cooldown</span>
						<span class="value muted">15</span>
					</div>
					<div class="grid-1">
						<span class="label">cost</span>
						<span class="value">60</span>
					</div>
				</div>
			</section>
		</div>
	</div>
</div>

<style>
	.card {
		--element-color: #d95a2b;
		--element-border: #a01e14;
		--card-width: 350px;
		--card-height: 200px;
		--card-aspect: 7 / 4;
		--portrait-width: 165px;
		--portrait-height: 165px;
		--card-radius: 12px;
		--portrait-radius: 15px;
		--radius-2xs: 2px;
		--radius-xs: 3px;
		--radius-sm: 4px;
		--space-1: 2px;
		--space-2: 4px;
		--space-3: 6px;
		--space-4: 7px;
		--space-5: 8px;
		--space-6: 10px;
		--space-7: 12px;
		--space-8: 14px;
		--space-9: 16px;
		--type-2xs: 0.5rem;
		--type-xs: 0.5625rem;
		--type-sm: 0.65rem;
		--type-lg: 1rem;
		--type-md: 0.8rem;
		--type-xl: 2.5rem;
		--type-icon: 0.75rem;
		--scale: 1;

		width: 100%;
		height: 100%;
		aspect-ratio: var(--card-aspect);
		display: grid;
		place-items: center;
	}

	.card-body {
		width: var(--card-width);
		height: var(--card-height);
		transform-origin: center;
		transform: scale(var(--scale));
		display: grid;
		grid-template-columns: var(--portrait-width) 1fr;
		background: #0e1627;
		border: 1px solid #1a2540;
		border-radius: var(--card-radius);
		overflow: visible;
		box-shadow:
			0 2px 0 #060a10,
			0 8px 40px rgba(0, 0, 0, 0.55),
			inset 0 1px 0 rgba(255, 255, 255, 0.03);
	}

	.bio-col {
		position: relative;
		width: var(--portrait-width);
		display: grid;
		grid-template-rows: min-content min-content;
		align-content: start;
	}

	.bio {
		position: absolute;
		top: -6px;
		left: -6px;
		background: linear-gradient(160deg, #580c08 0%, #a01e14 100%);
		border: 1px solid var(--element-border);
		border-radius: var(--portrait-radius);
		width: var(--portrait-width);
		height: var(--portrait-height);
		overflow: hidden;
	}

	.portrait {
		width: 100%;
		height: 100%;
		object-fit: contain;
		display: block;
		transform: translateX(6px);
	}

	.weapon-type {
		position: absolute;
		top: 30px;
		left: 7px;
		width: 23px;
		height: 23px;
		object-fit: contain;
		display: block;
	}

	.constellation {
		position: absolute;
		top: 6px;
		left: 6px;
		display: inline-flex;
		align-items: center;
		padding: var(--space-1) var(--space-4);
		background: rgba(40, 4, 4, 0.8);
		border: 1px solid rgba(130, 32, 25, 1);
		border-radius: var(--card-radius);
		font-family: 'Noto Sans Display Variable';
		font-size: var(--type-sm);
		font-weight: 700;
		color: #fff;
		cursor: pointer;
		transition: background 0.15s;
	}
	.constellation:hover {
		background: rgba(40, 4, 4, 1);
	}
	.constellation-caret {
		font-size: var(--type-sm);
		line-height: 1;
	}

	.nameplate {
		position: absolute;
		top: 157px;
		left: -8px;
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-1);
		padding: var(--space-6) var(--space-7);
	}

	.element-icon {
		display: inline-flex;
		align-items: center;
		flex-shrink: 0;
		color: var(--element-color);
	}
	.element-icon img {
		width: 20px;
		height: 20px;
		display: block;
		transform: translateY(-2px);
	}

	.name {
		font-family: 'Bitter Variable', 'Bitter', serif;
		font-size: var(--type-lg);
		font-weight: 750;
		color: #e4ecff;
		letter-spacing: 0.04em;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.stats {
		display: grid;
		grid-auto-rows: min-content;
		align-items: start;
		align-content: space-between;
		padding: var(--space-7) var(--space-8) var(--space-7) var(--space-1);
		font-family: 'Noto Sans Display Variable', 'Noto Sans Display', sans-serif;
	}

	.ability {
		display: grid;
		gap: var(--space-3)
	}

	.ability-header {
		display: flex;
		align-items: center;
		gap: 4px;
	}
	.ability-header .icon-group {
		margin-left: auto;
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
	}

	.title {
		display: inline-flex;
		font-family: 'Bitter Variable', 'Bitter', serif;
		font-size: var(--type-sm);
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.icon {
		--icon-size: 0.68rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: var(--type-icon);
	}
	.icon img {
		display: block;
		height: var(--icon-size);
		width: auto;
	}
	.icon.snapshot img {
		transform: translateY(-1px);
		margin-left: 2px;
	}
	.icon.icd {
		--icon-size: 0.5rem;
	}

	.stat-row {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		position: relative;
		justify-items: center;
		align-items: center;
		line-height: 1;
		column-gap: var(--space-3);
		row-gap: var(--space-2);
	}
	.stat-row--two {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.key {
		justify-self: center;
		flex-shrink: 0;
		padding: 2px 3px 1px;
		border-radius: var(--radius-xs);
		background: #fff;
		color: #05091a;
		font-family: 'Bitter Variable', 'Bitter', serif;
		font-size: var(--type-xs);
		font-weight: 800;
		line-height: 1;
		letter-spacing: 0;
	}

	.tap {
		grid-column: 1 / 3;
		justify-self: center;
		font-family: 'Noto Sans Variable', 'Noto Sans', sans-serif;
		font-size: var(--type-2xs);
		font-weight: 700;
		border-radius: var(--radius-sm);
		padding: 1px var(--space-3);
		white-space: nowrap;
	}

	.key-variant {
		grid-column: 1 / -1;
		justify-self: center;
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
	}
	.key-variant .key {
		padding: 2px 2px 0;
		border-radius: var(--radius-2xs);
		font-size: var(--type-2xs);
	}
	.key-variant .variant {
		font-family: 'Noto Sans Variable', 'Noto Sans', sans-serif;
		font-size: var(--type-2xs);
		font-weight: 700;
		border-radius: var(--radius-sm);
		white-space: nowrap;
	}

	.grid-1 {
		display: grid;
		grid-template-columns: repeat(1, 1fr);
		justify-items: center;
		row-gap: var(--space-1);
	}

	.grid-2 {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		justify-items: center;
		row-gap: var(--space-1);
		column-gap: var(--space-2);
	}

	.span-2 {
		grid-column: span 2;
	}

	.span-3 {
		grid-column: span 3;
	}

	.span-3.label {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		justify-self: stretch;
		gap: var(--space-2);
		text-align: center;
		margin-bottom: calc(var(--space-1) - var(--space-2));
	}

	.span-3.label::before,
	.span-3.label::after {
		content: '';
		flex: 1;
		height: 1px;
		background: currentColor;
		opacity: 0.5;
	}

	.value {
		display: inline-flex;
		align-items: center;
		font-size: var(--type-xl);
		font-weight: 500;
		line-height: 1;
		letter-spacing: -0.01em;
		text-align: center;
		font-variant-numeric: tabular-nums;
	}

	.label {
		font-size: var(--type-2xs);
		font-weight: 800;
		line-height: 1;
		letter-spacing: 0.04em;
		white-space: nowrap;
	}
	
	.muted {
		color: #4e6080;
	}
	.muted.key {
		color: #05091a;
		background-color: #9CA6B8;
	}

	/* ════════════════════════════════════════
     RESPONSIVE — mobile
     Portrait becomes a small circle avatar;
     Stats layout identical, just narrower.
  ════════════════════════════════════════ */
	@media (max-width: 520px) {
		.card {
			--portrait-width: 72px;
		}

		.card-body {
			grid-template-columns: 1fr;
		}

		/* Portrait becomes a square that we clip to a circle */
		.portrait {
			width: 72px;
			height: 72px;
			min-height: unset;
			border-radius: 50%;
			margin: 14px auto 0;
			border: 2px solid var(--element-border);
			box-shadow: 0 0 0 3px #0e1627;
			overflow: hidden;
		}

		/* Hide nameplate text on mobile — name moves to top of stats col */
		.nameplate {
			display: none;
		}

		.stats {
			padding: var(--space-7) var(--space-8);
		}

		/* Inject name at top of stats col on mobile via a sibling trick —
       Instead, the nameplate is simply kept but repositioned.
       In SvelteKit you can conditionally render two separate elements.
       For this demo we show it via a mobile-only pseudo-header. */
	}
</style>
