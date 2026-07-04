<!-- Static content page — no state, fully prerendered. -->
<div class="about-page">
	<h1 class="page-title">About critcalc</h1>

	<section class="prose">
		<p>
			<strong>critcalc.app</strong> is a small set of theorycrafting tools for Genshin Impact. The
			goal is to <em>visualize</em> the mechanics behind a team's damage — how buffs, cooldowns, and
			crit rolls actually stack up over a rotation — rather than reduce everything to a single number.
		</p>

		<p>Three tools live here:</p>
		<ul>
			<li>
				<strong>Crit Visualizer</strong> — see how crit rate and crit damage combine across the full
				spread of possible rolls, not just the average.
			</li>
			<li>
				<strong>Rotation Planner</strong> — lay a team's rotation out on a timeline: ability windows,
				buff uptime, cooldowns, and swaps.
			</li>
			<li>
				<strong>Team Builder</strong> — compare characters and their loadouts side by side.
			</li>
		</ul>

		<p>
			Terminology throughout follows the
			<a href="https://keqingmains.com" target="_blank" rel="noopener noreferrer">Keqing Mains</a>
			(KQM) standards. critcalc is an independent, non-commercial fan project — see the notice in the
			footer below.
		</p>
	</section>
</div>

<style>
	.about-page {
		max-width: 640px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.page-title {
		font-size: 1.5rem;
		font-weight: 700;
		margin: 0;
	}

	.prose {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		color: var(--text);
		line-height: 1.6;
	}

	.prose p {
		margin: 0;
	}

	.prose ul {
		margin: 0;
		padding-left: 1.2rem;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.prose li {
		padding-left: 0.2rem;
	}

	.prose a {
		color: var(--accent);
		text-decoration: none;
		border-bottom: 1px solid transparent;
		transition: border-color 150ms ease;
	}

	.prose a:hover,
	.prose a:focus-visible {
		border-bottom-color: var(--accent);
	}
</style>
