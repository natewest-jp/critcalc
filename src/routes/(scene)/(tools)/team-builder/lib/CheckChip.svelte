<script lang="ts">
	/**
	 * One battlefield check, drawn as the game draws it (lineups design §2.6):
	 * a thumb (favoured / disfavoured), then its alternatives — game icons and
	 * the game's words — divided by a hairline. When a TEAM is given, the chip
	 * says how that team stands (`$lib/endgameChecks`):
	 *   favoured + met     ✓ in --ui-positive — the team brings it
	 *   disfavoured + met  ⚠ in --ui-danger — the team does what the boss resists
	 *   unmet / unknown    the thumb, unchanged — ⛔ never guessed
	 * ⚓ The verdict mark REPLACES the thumb (Nate 2026-10-09) — the chip keeps
	 * its length, and the tint says the rest.
	 */
	import Mark from '$lib/components/Mark.svelte';
	import { checkAlternatives, inLang, spriteImage, type BattlefieldCheck } from '$lib/endgame';
	import type { CheckVerdict } from '$lib/endgameChecks';

	let {
		check,
		verdict
	}: {
		check: BattlefieldCheck;
		/** The team's standing, when the chip sits beside a team. */
		verdict?: CheckVerdict;
	} = $props();

	const alternatives = $derived(checkAlternatives(inLang(check.text)));
	const good = $derived(check.tag === 'favoured');
	const flag = $derived(verdict === 'met' ? (good ? 'met' : 'warn') : null);
	const title = $derived(
		flag === 'met'
			? 'This team brings it'
			: flag === 'warn'
				? 'This team does what this boss resists'
				: verdict === 'unmet'
					? good
						? 'This team does not bring it'
						: 'This team avoids it'
					: undefined
	);
</script>

<span
	class="ck"
	class:ck--good={good}
	class:ck--bad={!good}
	class:ck--met={flag === 'met'}
	class:ck--warn={flag === 'warn'}
	{title}
>
	<Mark
		name={flag === 'met' ? 'check' : flag === 'warn' ? 'warn' : good ? 'thumbsUp' : 'thumbsDown'}
		size={13}
	/>
	{#each alternatives as alt, i (i)}
		{#if i > 0}<span class="ck-sep" aria-hidden="true"></span>{/if}
		<span class="ck-alt">
			{#each alt as part, j (j)}
				{#if 'sprite' in part}
					<img class="ck-sprite" src={spriteImage(part.sprite)} alt="" />
				{:else}
					<span>{part.text}</span>
				{/if}
			{/each}
		</span>
	{/each}
</span>

<style>
	.ck {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-height: 24px;
		padding: 2px 10px 2px 8px;
		border-radius: var(--r-round);
		font-size: var(--fs-sm);
		color: var(--text);
		background: var(--surface-raised);
	}
	.ck--good > :global(.mark:first-child) {
		color: var(--ui-positive);
	}
	.ck--bad > :global(.mark:first-child) {
		color: var(--ui-danger);
	}
	/* The team's standing is a TINT of the chip's ground plus a mark at its end
	   — the words never change colour. */
	.ck--met {
		background: var(--ui-positive-soft);
	}
	.ck--met > :global(.mark:first-child) {
		color: var(--ui-positive);
	}
	.ck--warn {
		background: var(--ui-danger-soft);
	}
	.ck--warn > :global(.mark:first-child) {
		color: var(--ui-danger);
	}
	.ck-alt {
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}
	.ck-sprite {
		width: 18px;
		height: 18px;
	}
	.ck-sep {
		width: 1px;
		height: 12px;
		background: var(--line-strong);
	}
</style>
