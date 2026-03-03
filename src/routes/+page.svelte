<section class="home-stage" aria-label="critcalc tool selection">
	<a class="home-card-link" href="/crit-visualizer">
		<article class="home-card" aria-label="crit rate vs crit damage visualizer">
			<p class="kicker"></p>
			<h2>Crit ratio visualizer</h2>
			<p>
				See just how your crit ratio affects your average 
				damage output after one or more rotations.
			</p>
		</article>
	</a>
	<a class="home-card-link" href="/rotation-planner">
		<article class="home-card" aria-label="team rotation planner">
			<p class="kicker"></p>
			<h2>Team rotation planner</h2>
			<p>
				Visually plan your rotation by charting uptimes, 
				cooldowns, and buffs.
			</p>
		</article>
	</a>
	<a class="home-card-link" href="/character-stats">
		<article class="home-card" aria-label="character stats">
			<p class="kicker"></p>
			<h2>Clear character stat cards</h2>
			<p>
				See at a glance character's burst costs, durations, 
				cooldowns, and more.
			</p>
		</article>
	</a>
</section>
<a class="home-banner-link" href="/">
	<article class="home-banner" aria-label="weaselthief games">
		<p class="kicker"></p>
		<h2>Switch to Genshin games</h2>
		<p>
			Dig up some lols with the team builder slot machine, 
			character wheel, Genshin mad libs, and more
		</p>
	</article>
</a>

<style>
	.home-stage {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.home-card-link {
		flex: 1;
	}

	.home-card {
		min-height: 15rem;
		padding: .8rem 1rem;
		border-radius: 0.5rem;
		border: 1px solid var(--border);
		background: var(--surface-raised);
	}

	.home-banner {
		padding: .8rem 1rem;
		border-radius: 0.5rem;
		border: 1px solid var(--border);
		background: var(--surface-raised);
	}

	.kicker {
		margin: 0;
		font-size: 0.68rem;
		font-weight: 700;
		text-transform: uppercase;
		color: var(--muted);
	}

	@media (min-width: 760px) {
		.home-stage {
			flex-direction: row;
		}
	}
</style>