<!-- Static content page — no state, fully prerendered. The per-tool sections
	 carry ids matching each tool's path so the in-tool "?" guide can deep-link
	 here (e.g. /faq#rotation-planner). -->
<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<title>Help &amp; FAQ · critcalc.app</title>
	<meta
		name="description"
		content="How to use critcalc's tools, plus answers to common questions about the site and its data."
	/>
</svelte:head>

<h1>Help &amp; FAQ</h1>

<p class="lede">How the tools work, and answers to the questions that come up most.</p>

<nav class="faq-jump" aria-label="Jump to section">
	<a href="#faq">General</a>
	<a href="#team-builder">Team Builder</a>
	<a href="#rotation-planner">Rotation Planner</a>
	<a href="#crit-visualizer">Crit Visualizer</a>
</nav>

<section id="faq">
	<h2>General</h2>

	<h3>What is critcalc?</h3>
	<p>
		A set of Genshin Impact theorycrafting tools that <em>visualize</em> mechanics — crit odds, rotation
		timing, team capabilities — instead of reducing them to a single score.
	</p>

	<h3>Does it tell me my damage number or the best team?</h3>
	<p>
		No, by design. critcalc shows mechanics, not verdicts: no damage totals, no tier lists, no
		"synergy scores." It helps you <em>see</em> how the pieces fit; the judgment stays yours.
	</p>

	<h3>Do I need an account? Is my data saved anywhere?</h3>
	<p>
		No account, no sign-in. Everything you set — your roster, loadouts, saved rotations, and
		settings — lives only in your own browser. You can back it up or move it to another device from
		<strong>Settings → Your data</strong>. See <a href={resolve('/privacy')}>Privacy</a> for the full
		picture.
	</p>

	<h3>Where does the data come from?</h3>
	<p>
		Character data is curated in-house and cross-checked against
		<a href="https://gcsim.app" target="_blank" rel="noopener noreferrer">gcsim</a> and
		<a href="https://keqingmains.com" target="_blank" rel="noopener noreferrer">Keqing Mains</a>,
		seeded from <a href={resolve('/about')}>the sources credited on the About page</a>.
	</p>

	<h3>A value looks wrong, or a character is missing.</h3>
	<p>
		Some newer or niche kits aren't fully curated yet — those are shown honestly as "not yet
		curated" rather than guessed, and timing is only ever taken from gcsim or kit text, never
		invented. If something still looks off, it's worth a second look against gcsim.
	</p>

	<h3>Is critcalc official?</h3>
	<p>
		No — it's an independent, non-commercial fan project, not affiliated with or endorsed by
		HoYoverse.
	</p>
</section>

<section id="team-builder">
	<h2>Team Builder</h2>
	<p>
		Find characters by what they can actually provide — healing, shields, off-field damage, RES
		shred, ally buffs — with every capability derived from curated kit data and traced to the
		ability (and constellation) that grants it.
	</p>
	<ul>
		<li>
			Browse by capability in the <strong>Atlas</strong>, or by identity in the
			<strong>Roster</strong>.
		</li>
		<li>
			The constellation switch changes what counts: C0 shows base kits, "My roster" uses the
			constellation levels you've saved, C6 shows everything a kit can ever do.
		</li>
		<li>Capability filters combine: "Heals + ATK buff" means characters that provide both.</li>
		<li>
			Characters whose kits aren't curated yet are listed separately when filtering, never silently
			hidden — a missing badge means "unknown," not "no." Conditional badges (italic) depend on
			runtime state; open a character's details for the exact condition.
		</li>
		<li>
			Add characters to <strong>Compare</strong> to line their ability timings up on one ruler, or send
			a team to the Rotation Planner to run it.
		</li>
	</ul>
</section>

<section id="rotation-planner">
	<h2>Rotation Planner</h2>
	<p>
		Write your rotation in KQM-style notation and the timeline renders its choreography — ability
		uptimes, cooldowns, swap connectors, and team-buff windows, frame-accurate. It visualizes timing
		and windows; it never computes damage numbers.
	</p>
	<ul>
		<li>
			Type notation in the composer along the bottom edge — the timeline above redraws as you write,
			and autocomplete suggests each character's action tokens.
		</li>
		<li>
			Click a team portrait to change who fills that slot; set each character's weapon, artifact,
			and constellation on their portrait chips.
		</li>
		<li>
			Copy your rotation as KQM text or export the timeline as a PNG from the buttons beside the
			composer.
		</li>
		<li>
			Open <strong>Notes</strong> for the caveats behind the buffs and mechanics you're relying on.
		</li>
	</ul>
	<p>
		New to the notation? It follows the
		<a href="https://compendium.keqingmains.com/" target="_blank" rel="noopener noreferrer"
			>KQM standard</a
		>: <code>E</code>/<code>Q</code> for skill/burst, <code>N</code> for normal attacks (<code
			>N2</code
		>
		= two hits), <code>C</code> charged, <code>D</code> dash, <code>J</code> jump, and
		<code>&gt;</code> to separate swaps.
	</p>
</section>

<section id="crit-visualizer">
	<h2>Crit Visualizer</h2>
	<p>
		A family of small graph instruments. On wide screens several sit side by side — use the chips
		above each tile to choose which instrument lives where.
	</p>
	<ul>
		<li>
			<strong>Crit Heatmap</strong> — the average damage multiplier, 1&nbsp;+&nbsp;(Crit Rate × Crit Damage),
			across every stat combination. Drag along the equal-crit-value line to see where a fixed stat budget
			pays out best, and pin a build to compare.
		</li>
		<li>
			<strong>ICD Timeline</strong> — which hits of an attack string actually apply their element (the
			standard "every 2.5s or every 3rd hit" rule, and why faster strings don't mean proportionally more
			application).
		</li>
		<li>
			<strong>Artifact Rolls</strong> — the real odds behind 5★ farming: how rare a substat pair is, the
			crit-value distribution a piece can reach at +20, and what the reshape guarantee does. The Appraise
			view places a real piece on its own outcome curve.
		</li>
		<li>
			<strong>Gauge Explorer</strong> — how elemental auras live and die: gauge decay, the aura tax, and
			how each reaction consumes aura at its own rate.
		</li>
		<li>
			<strong>Reaction Curves</strong> — how each reaction family scales with Elemental Mastery.
		</li>
	</ul>
</section>

<style>
	.faq-jump {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-bottom: 0.5rem;
	}

	.faq-jump a {
		padding: 0.35rem 0.7rem;
		border: 1px solid var(--border);
		border-radius: 999px;
		font-size: var(--fs-sm);
		font-weight: var(--fw-medium);
		color: var(--muted);
		border-bottom: 1px solid var(--border);
	}

	.faq-jump a:hover,
	.faq-jump a:focus-visible {
		color: var(--text);
		border-color: color-mix(in srgb, var(--accent) 55%, var(--border));
	}

	code {
		font-family: var(--font-mono);
		font-size: 0.9em;
		padding: 0.05em 0.3em;
		border-radius: 3px;
		background: color-mix(in srgb, var(--accent) 12%, transparent);
	}
</style>
