<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	
	let { children } = $props();

	function goHome() {
		goto(resolve('/'));
	}

	function handleKeydown(event: KeyboardEvent) {
	    if (event.key === 'Escape') {
	    	goHome();
	    }
    }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="tool-shell">
	<button
		class="close-button"
		aria-label="Return to home"
		onclick={goHome}
	>
		other tools
	</button>

	<div class="tool-main">
		{@render children()}
	</div>
</div>

<style>
	.tool-shell {
		position: fixed;
		inset: 0;
		width: 100dvw;
		height: 100dvh;
		padding: 2rem;
		overflow: scroll;
		background: var(--bg);
	}

	.tool-main {
		width: 100%;
		height: 100%;
	}

	.close-button {
		position: absolute;
		top: 1.5rem;
		right: 1.5rem;
		z-index: 10;
        padding-top: .4rem;

		width: 6rem;
		height: 2rem;

		display: grid;
		place-items: center;

		font-size: .8rem;
        font-weight: 700;
		cursor: pointer;

		color: var(--navy-gray);
        background: none;
		border: none;
        transition: all 0.25s ease;
	}

    .close-button::after {
        content: "\21BD";
        position: relative;
        top: -3rem;
        left: .2rem;
        font-size: 4rem;
        color: rgba(255,255,255,.15);
        z-index: -1;
        transition: all 0.25s ease;
    }

	.close-button:hover {
		color: var(--light-navy-gray);
	}

    .close-button:hover::after {
        color: rgba(255,255,255,.2);
        left: -.3rem;
    }
</style>