<script lang="ts">
	import Mark from '$lib/components/Mark.svelte';

	/**
	 * THE SPECIMEN BOARD (/lab) — ⚓ NATE 2026-08-10.
	 *
	 * "I want to see the actual panels and text we'll be using on the scene with
	 * dim so that I can judge things clearly." Neither existing surface could:
	 * the Team Builder shows whatever that tool happens to use, never the whole
	 * set side by side; /styleguide shows the whole set but on the bare root
	 * layout, in chips, against a hand-drawn stand-in sky.
	 *
	 * SO THIS PAGE HAS EXACTLY ONE JOB: every ground we own, at real size, with
	 * the same content in each, AT THE CREST UNDER THE REAL WASH. It is a board
	 * to judge from, not a reference to look things up in — /styleguide stays the
	 * authority and stays exhaustive. Two surfaces, opposite virtues: reference
	 * wants completeness, judging wants one screenful at true scale.
	 *
	 * ⚠ WHAT MAY BE STYLED HERE. Shipped patterns are rendered with their REAL
	 * global classes and are not restyled — same law as /styleguide, and for the
	 * same reason (a board that paints its own copy of a button is showing you a
	 * button that does not exist). The exception is the CANDIDATES section: those
	 * are proposals with no home in app.css yet, so they are drawn locally and
	 * labelled as proposals. When one is adopted it moves to app.css and this
	 * page renders the real thing instead.
	 */

	/** The same content in every ground, so the only variable is the ground. */
	const SPECIMEN_GROUNDS = [
		{
			key: 'night',
			cls: '',
			label: 'ctx-night — the world itself',
			note: 'no paint · one ground, no rungs · lines must carry alpha'
		},
		{
			key: 'glass',
			cls: 'ctx-glass',
			label: 'ctx-glass — the material',
			note: 'slate at an alpha · 8% of the world survives it'
		},
		{ key: 'dark', cls: 'ctx-dark', label: 'ctx-dark — slate', note: 'ground · raised · well' },
		{
			key: 'light',
			cls: 'ctx-light',
			label: 'ctx-light — parchment',
			note: 'the inversion · navy ink'
		}
	];

	const LINE_STOPS = ['--line-faint', '--line-soft', '--line-strong', '--line-edge'];

	/**
	 * THE INK LADDER, rendered identically in every ground — ⚓ Nate 2026-08-10:
	 * "what are the exact text body sizes, headings, section breaks etc we're
	 * using right now?"
	 *
	 * Every row carries its own size tag, so each panel doubles as a legend for
	 * the type system ON THAT GROUND. That pairing is the point: the size and the
	 * ink role are one decision, not two, and the light context INVERTS the ink
	 * half of it (prose recedes, labels anchor) while keeping the sizes.
	 *
	 * ⚠ THE TAGS ARE MAINTAINED BY HAND, and the CSS below is pinned by hand to
	 * match them — /lab is excluded from the mechanical size sweep on purpose.
	 * A board that rode the scale would always agree with itself and could never
	 * show you a rung that had gone missing.
	 */
	const TYPE_ROWS = [
		{ cls: 'ty-h1', tag: '4xl · 24', text: 'Section heading' },
		{ cls: 'ty-h2', tag: '3xl · 20', text: 'Subheading · .title' },
		{ cls: 'ty-h3', tag: '2xl · 18', text: 'Emphasized body' },
		{ cls: 'ty-body', tag: 'xl · 16', text: 'Body — prose.' },
		{ cls: 'ty-dense', tag: 'lg · 14', text: 'Dense body — tables, data rows.' },
		{ cls: 'ty-label', tag: 'md · 12', text: 'Controls · tabs · chips' },
		{ cls: 'ty-caption', tag: 'sm · 11', text: 'Labels / meta' }
	];

	/**
	 * THE SIZE-UP — ⚓ APPROVED AND SHIPPED 2026-08-10. Kept on the board as the
	 * record of what moved, because the interesting part is the SHAPE of the
	 * change rather than the sizes themselves.
	 *
	 * ROLES MOVED UP A RUNG; THE RUNGS DID NOT MOVE. That direction is the whole
	 * decision. The px values are quoted in dozens of comments and in the export
	 * mirror, so a scale re-cut would have made every one of them quietly wrong
	 * — where re-pointing 208 declarations one step up leaves the ladder exactly
	 * where it was and just has everything stand higher on it.
	 *
	 * ⚠ TWO ENDS ARE PINNED. 4xl is the section heading AND the brand (Nate's
	 * unification — SiteChrome reads it through --brand-size), and 5xl held
	 * because it is the instrument-readout rung with nothing above it to climb
	 * to. Page titles moved up INTO 5xl, so those two share a rung: different
	 * roles on one rung is fine, a role with no rung is not.
	 */
	const SIZE_UP = [
		{ role: 'page title', now: '4xl · 24', next: '5xl · 32', moved: true },
		{ role: 'section heading · brand', now: '3xl · 20', next: '4xl · 24', moved: true },
		{ role: 'subheading · .title', now: '2xl · 18', next: '3xl · 20', moved: true },
		{ role: 'body / prose', now: 'lg · 14', next: 'xl · 16', moved: true },
		{ role: 'dense body', now: 'md · 12', next: 'lg · 14', moved: true },
		{ role: 'controls · tabs · chips', now: 'sm · 11', next: 'md · 12', moved: true },
		{ role: 'labels · meta', now: 'xs · 10', next: 'sm · 11', moved: true },
		{ role: 'micro / badges', now: '2xs · 9', next: 'xs · 10', moved: true },
		{ role: 'instrument readout', now: '5xl · 32', next: '5xl · 32', moved: false }
	];

	/**
	 * BORDERS IN GOLD — ⚓ Nate 2026-08-10: "I think Genshin uses gold for BOTH
	 * contexts. I'm not sure which brightness stop."
	 *
	 * Every candidate rung against both grounds, at the two alphas that survived
	 * the cut. Mixed OPAQUELY against each ground (the compositing law) and one
	 * level deep — both inputs are primitives, never aliases of each other, so
	 * no color-mix is ever fed a color-mix.
	 *
	 * The control row is the shipped ink line, so the question being asked is
	 * "gold instead of THIS", not "gold in the abstract".
	 */
	const BORDER_CANDIDATES = [
		{ key: 'ink', label: 'ink — shipped', src: null },
		{ key: 'gold-300', label: '--gold-300', src: 'var(--gold-300)' },
		{ key: 'gold-400', label: '--gold-400 · the accent', src: 'var(--gold-400)' },
		{ key: 'gold-500', label: '--gold-500', src: 'var(--gold-500)' },
		{ key: 'gold-600', label: '--gold-600', src: 'var(--gold-600)' },
		{ key: 'gold-700', label: '--gold-700', src: 'var(--gold-700)' }
	];

	/**
	 * THE THREE STATES OF A PANE, side by side and forced. Rendered as one run
	 * because the ladder is the point — each step is legible only against the
	 * one before it, and hovering shows you exactly one at a time.
	 */
	const PANE_STATES = [
		{ key: 'rest', label: 'rest · .58', cls: '' },
		{ key: 'hover', label: 'hover · .80 + ink ring', cls: 'is-dense is-ring' },
		{ key: 'sel', label: 'selected · .80 + gold ring', cls: 'is-sel' }
	];

	/** The open question the ring cannot answer on its own — see --glass-ring. */
	const RING_CANDIDATES = [
		{ key: 'ink', label: 'parchment ink — shipped', ring: 'var(--line-edge)' },
		{
			key: 'gold',
			label: 'gold-400 @ .45',
			ring: 'color-mix(in srgb, var(--gold-400) 45%, transparent)'
		},
		{
			key: 'slate',
			label: 'brighter slate — slate-300',
			ring: 'color-mix(in srgb, var(--slate-300) 75%, transparent)'
		}
	];
</script>

<svelte:head><title>Specimen Board — critcalc.app</title></svelte:head>

<div class="lab">
	<header class="lab-head">
		<h1>Specimen board</h1>
		<p>
			Every ground at real size, same content in each, at the crest under the real wash. Dev-only —
			<code>/styleguide</code> stays the exhaustive reference; this is the thing to judge from.
		</p>
	</header>

	<!-- ══════════════════════════════════════════════════ 1 · THE GROUNDS ══ -->
	<section>
		<h2 class="lab-h">The grounds</h2>
		<div class="lab-grid">
			{#each SPECIMEN_GROUNDS as g (g.key)}
				<div class="spec {g.cls}" class:spec--bare={g.key === 'night'}>
					<div class="spec-tag">{g.label}</div>

					<!-- THE TYPE LADDER. Each row is sample + size tag, so the panel is
					     both a specimen and a legend. -->
					{#each TYPE_ROWS as t (t.cls)}
						<div class="ty-row">
							<span class={t.cls}>{t.text}</span>
							<span class="ty-tag">{t.tag}</span>
						</div>
					{/each}

					<!-- SECTION BREAK — the shipped .kicker: a label whose rule runs out
					     of its right-hand side. ⚠ It must DECLARE the body face; a
					     heading face here is the bug that keeps coming back. -->
					<p class="kicker">Section break</p>

					<p class="spec-prose">
						Prose with an <b>accent</b> in it, and a
						<a href="#top">link</a> to see the two apart.
					</p>
					<div class="spec-row">
						<span class="spec-label">Constellation</span>
						<span class="spec-value">C2</span>
					</div>
					<hr class="spec-rule" />
					<div class="spec-controls">
						<button class="btn" type="button"><Mark name="save" />Save</button>
						<button class="btn btn--primary" type="button">Apply</button>
						<button class="btn" type="button" disabled>Off</button>
					</div>
					<div class="spec-controls">
						<button class="tab active" type="button">Selected</button>
						<button class="tab" type="button">Resting</button>
					</div>
					<div class="spec-inset inset inset--plain">inset · gold</div>
					<div class="spec-lines">
						{#each LINE_STOPS as stop (stop)}
							<span class="spec-line" style:background="var({stop})"></span>
						{/each}
					</div>
					<div class="spec-note">{g.note}</div>
				</div>
			{/each}
		</div>
	</section>

	<!-- ══════════════════════════════════════════════ 2 · THE SIZE-UP ══ -->
	<section>
		<h2 class="lab-h">
			The size-up <span class="lab-badge">shipped</span>
		</h2>
		<p class="lab-note">
			⚓ Approved and landed:
			<strong>every role moved up one rung, and the rungs did not move.</strong> 208 declarations across
			40 files were re-pointed one step up rather than the scale being re-cut — the direction matters,
			because those px values are quoted in dozens of comments and in the export mirror, and a scale whose
			numbers change under fixed names makes every one of them quietly wrong. A ladder is for climbing,
			not for sliding.
		</p>
		<p class="lab-note">
			Two ends are pinned. <strong>4xl · 24 is now the section heading AND the brand</strong> (⚓
			"unify Section headings and branding") — the masthead reads <code>--brand-size</code>, which
			is this token, so the two gain or lose it together. And <strong>5xl · 32 held</strong>: it is
			the instrument-readout rung, already as large as it wants to be, with nothing above it to
			climb to. Page titles moved up into it, so the two now share — different roles on one rung is
			fine, a role with no rung is not.
		</p>
		<div class="lab-row">
			<div class="su-table">
				{#each SIZE_UP as s (s.role)}
					<div class="su-trow" class:is-moved={s.moved}>
						<span class="su-role">{s.role}</span>
						<span class="ty-tag">{s.now}</span>
						<span class="su-arrow">{s.moved ? '→' : '·'}</span>
						<span class="ty-tag su-next">{s.next}</span>
					</div>
				{/each}
			</div>
			<div class="cand">
				<span class="cand-tag">a panel at the new sizes</span>
				<div class="ctx-dark sizeup">
					<h3 class="su-h3">Off-field DMG</h3>
					<p class="su-body">
						Coordinated attacks or damaging summons. Provided by <b>35</b> characters in the roster,
						of which you own <b>0</b>.
					</p>
					<div class="su-row"><span>Constellation</span><span>C2</span></div>
					<div class="spec-controls">
						<button class="btn" type="button">Filter</button>
						<button class="tab active" type="button">Atlas</button>
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- ═════════════════════════════════════════ 3 · THE NIGHT PAINTS ══ -->
	<section>
		<h2 class="lab-h">
			What may paint on the night <span class="lab-badge">proposal</span>
		</h2>
		<p class="lab-note">
			⚓ Nate: three, and all very transparent — a dark ribbon, a red ribbon, a gradient fade. The
			rule that keeps <em>night has no rungs</em> intact:
			<strong>these condition the world, they do not become grounds.</strong>
			None of them carries an ink ladder of its own; text on a scrim ribbon is still night text. The red
			one is the exception worth watching — it carries STATE (blocked / unavailable), so it is the one
			that must never be reached for as decoration.
		</p>
		<div class="lab-stack">
			<div class="night-ribbon">
				<h3 class="spec-title">Special Rules</h3>
			</div>
			<p class="spec-prose spec-prose--wide">
				A header needs a ribbon because it has to hold across whatever the sky is doing behind it.
				The prose under it does not — at <b>6.87:1</b> against the worst pixel it survives on its own,
				which is what the deeper wash bought.
			</p>
			<div class="night-ribbon night-ribbon--danger">
				<Mark name="gated" /> Challenge criteria not met
			</div>
			<div class="night-fade">
				<span>gradient fade — the landing footer's idiom, named</span>
			</div>
		</div>
	</section>

	<!-- ═══════════════════════════════════════════ 3 · BORDERS IN GOLD ══ -->
	<section>
		<h2 class="lab-h">
			Borders stay ink · the inset went gold <span class="lab-badge">shipped</span>
		</h2>
		<p class="lab-note">
			⚓ Settled here: <strong
				>a border is STRUCTURE and stays ink; the inset is ORNAMENT and went gold</strong
			>, zoned by context —
			<code>gold-400</code> on dark, <code>gold-700</code> on light. This grid is what settled it,
			and it is kept because the reason is visible in it: gold-600/700 barely lift off slate,
			gold-300/400 all but vanish into parchment. One hue can't serve both grounds, which is the
			same two-rung zoning
			<code>--accent</code> already uses. The shipped stop is <strong>α .18</strong>; the quiet stop
			(<code>--inset-line-quiet</code>, for <code>--double</code>) is .10.
		</p>
		<div class="border-grid">
			<div class="border-head">
				<span></span>
				<span class="cand-tag">on slate</span>
				<span class="cand-tag">on parchment</span>
			</div>
			{#each BORDER_CANDIDATES as c (c.key)}
				<div class="border-row">
					<span class="cand-tag border-name">{c.label}</span>
					{#each ['ctx-dark', 'ctx-light'] as ground (ground)}
						<div
							class="border-cell {ground}"
							style:--frame-line={c.src
								? `color-mix(in srgb, ${c.src} 18%, var(--frame-bg))`
								: null}
							style:--frame-line-quiet={c.src
								? `color-mix(in srgb, ${c.src} 10%, var(--frame-bg))`
								: null}
						>
							<div class="border-inset inset inset--plain">inset · α .18</div>
							<hr class="border-rule" />
							<hr class="border-rule border-rule--quiet" />
						</div>
					{/each}
				</div>
			{/each}
		</div>
	</section>

	<!-- ══════════════════════════════════════ 4 · GLASS HOVER + THE RING ══ -->
	<section>
		<h2 class="lab-h">
			The three states of a pane <span class="lab-badge">shipped</span>
		</h2>
		<p class="lab-note">
			<strong>rest .58 → hover .80 + an INK ring → selected .80 + a GOLD ring.</strong>
			<strong>Density separates resting from engaged; hue separates the two engaged states.</strong>
			⚓ Nate, correcting a version that took selected all the way to opaque: three densities meant the
			eye had to measure how solid a pane was to know what it was looking at, when the ring was already
			saying it in colour. Forced side by side, because
			<strong>you cannot judge a hover by hovering</strong>: you never see two states at once.
		</p>
		<p class="lab-note">
			⚓ The ring's colour settled with the row above. <strong>Borders stayed ink</strong>, which
			left gold free to mean SELECTED, so the hover ring keeps the pane's own ink. Had lines gone
			gold globally, a gold hover ring would have stopped distinguishing hover from selected — the
			one thing it has to do. The two rejected candidates stay below as the evidence.
		</p>
		<div class="lab-row">
			<div class="cand">
				<span class="cand-tag">the three states, shipped</span>
				{#each PANE_STATES as st (st.key)}
					<div class="ctx-glass glasspane {st.cls}">{st.label}</div>
				{/each}
			</div>
			{#each RING_CANDIDATES as r (r.key)}
				<div class="cand">
					<span class="cand-tag">hover ring · {r.label}</span>
					<div class="ctx-glass glasspane">rest · .58</div>
					<div class="ctx-glass glasspane is-dense" style:box-shadow="inset 0 0 0 1px {r.ring}">
						hover · .80
					</div>
				</div>
			{/each}
		</div>
	</section>

	<!-- ══════════════════════════════════════ 5 · THE TWO PARCHMENTS ══ -->
	<section>
		<h2 class="lab-h">
			The two parchments <span class="lab-badge">shipped</span>
		</h2>
		<p class="lab-note">
			⚓ Nate sampled Genshin's two paper grounds — <code>#F2F1EC</code> for large panels and
			<code>#E8E5DD</code> for character cards. Our nearest rungs are
			<code>parchment-50</code> and <code>parchment-100</code>, both at a distance of 6, and — his
			constraint — <strong>they are ADJACENT rungs</strong>, so the pair is a half-step apart rather
			than a jump.
		</p>
		<p class="lab-note">
			<strong>The axis is SIZE, not depth.</strong> A large panel, a heading ribbon, or parchment
			carrying other parchment takes the lighter one (<code>--surface-broad</code>); a smaller item
			— a card, a button, a layer sitting on a broad panel — takes the darker one (<code
				>--surface</code
			>). ⚠ So the thing ON the paper is DARKER than the paper, which reverses what this system
			assumed a day earlier by reasoning from the dark context's ladder. Sampled beats symmetrical.
			⚠ And <code>ctx-light</code> therefore has
			<strong>no raised rung at all</strong> — it does not express depth by lightness, the way glass doesn't
			either.
		</p>
		<div class="lab-row">
			<div class="ctx-light paper-broad">
				<span class="paper-tag">--surface-broad · parchment-50 · the panel</span>
				<h3 class="su-h3">Off-field DMG</h3>
				<div class="ctx-light paper-object">
					<span class="paper-tag">--surface · parchment-100 · a card on it</span>
					<p class="spec-prose">The same paper a character card is made of.</p>
					<button class="btn" type="button">Filter</button>
				</div>
			</div>
			<div class="ctx-light paper-object paper-object--alone">
				<span class="paper-tag">--surface · standalone card</span>
				<p class="spec-prose">
					A smaller light object on the scene takes the same rung whether or not it sits on a broad
					panel — which is why this is a TOKEN and not a context modifier.
				</p>
			</div>
		</div>
	</section>

	<!-- ══════════════════════════════════════════ 6 · GOLD IN TEXT ══ -->
	<section>
		<h2 class="lab-h">
			Gold in text <span class="lab-badge">proposal</span>
		</h2>
		<p class="lab-note">
			Read off the five Genshin screenshots, the pattern is narrower than "an accent colour" and
			surprisingly consistent: <strong>gold names a BLOCK; it never emphasises a WORD.</strong> Their
			section labels — "Opening Characters", "Performance Requirements", "Challenge Criteria", "Special
			Rules" — are all gold. Their titles are not: those are white on dark, dark ink on light. And inline
			emphasis inside prose is never gold either — it is a hotter ORANGE, or the element's own hue.
		</p>
		<p class="lab-note">
			⚠ <strong>So gold sits BELOW the title in the hierarchy</strong>, which is the
			counterintuitive part and the reason it is worth writing down rather than applying by feel:
			you would expect the accent on the most important thing, and Genshin puts it on the
			second-most. The title is the loudest by SIZE; gold marks the thing that names a region.
		</p>
		<div class="lab-row">
			{#each [{ k: 'dark', cls: 'ctx-dark', t: 'on slate' }, { k: 'light', cls: 'ctx-light', t: 'on parchment' }] as g (g.k)}
				<div class="cand">
					<span class="cand-tag">{g.t} — today</span>
					<div class="{g.cls} goldspec">
						<h3 class="ty-h1">Off-field DMG</h3>
						<p class="kicker">Who provides it</p>
						<p class="spec-prose">
							Coordinated attacks or damaging summons, from <b>35</b> characters.
						</p>
					</div>
					<span class="cand-tag">{g.t} — gold names the block</span>
					<div class="{g.cls} goldspec goldspec--next">
						<h3 class="ty-h1">Off-field DMG</h3>
						<p class="kicker">Who provides it</p>
						<p class="spec-prose">
							Coordinated attacks or damaging summons, from <b>35</b> characters.
						</p>
					</div>
				</div>
			{/each}
		</div>
		<p class="lab-note sg-note--flag">
			⚠ <strong>THE GAP THIS OPENS: we have no inline-emphasis colour.</strong> Genshin's is an
			orange (<code>#f39000</code>) that belongs to no other role — it marks "takes DMG", "bolt of
			lightning", a level number. Ours is gold today (the bold runs above), and if gold becomes the
			block label then using it inside prose as well puts one hue on two unrelated jobs, which is
			exactly the drift the census exists to catch. Three ways out, none chosen: borrow the element
			hue where the emphasised thing HAS an element, promote a warm rung of our own, or accept that
			emphasis is weight-only. Worth deciding with the <code>--el-*</code> round, not before it.
		</p>
	</section>

	<!-- ══════════════════════════════════════════ 4 · THE SPLIT CARD ══ -->
	<section>
		<h2 class="lab-h">
			The Atlas card, split <span class="lab-badge">proposal</span>
		</h2>
		<p class="lab-note">
			Identity on the dark half, content on the light half — Genshin's own split, turned side-on for
			our aspect. Today's all-glass card sits beside it at the same size.
			<strong>The inversion is the information</strong>: the seam says "this side is what it is,
			that side is what it holds".
		</p>
		<div class="lab-row">
			<div class="atlas atlas--glass ctx-glass">
				<div class="atlas-id"><span class="atlas-glyph">◈</span></div>
				<div class="atlas-body">
					<h3 class="spec-title">On-field DPS</h3>
					<p class="spec-prose"><b>48</b> provides · <b>0</b> owned</p>
				</div>
			</div>
			<div class="atlas atlas--split">
				<div class="atlas-id ctx-dark"><span class="atlas-glyph">◈</span></div>
				<div class="atlas-body ctx-light">
					<h3 class="spec-title">On-field DPS</h3>
					<p class="spec-prose"><b>48</b> provides · <b>0</b> owned</p>
				</div>
			</div>
		</div>
	</section>
</div>

<style>
	/* The board sits in the (scene) group with the site chrome suppressed (/lab
	   is in TOOL_PATHS), so it owns the whole viewport. Generous padding: the
	   specimens have to be judged with sky around them, not edge to edge. */
	/* ⚠ THE PAGE OWNS ITS OWN SCROLLER. (scene)'s .content is `position: fixed;
	   inset: 0` — the scene has to stay pinned behind whatever is on top of it —
	   so a page inside it that does not scroll itself simply loses everything
	   below the fold with no scrollbar to tell you. (The tools get this from
	   .tool-shell; this page is not in that group.) */
	.lab {
		position: relative;
		z-index: 1;
		height: 100%;
		overflow-y: auto;
		padding: 2rem max(2rem, calc((100% - 1560px) / 2)) 6rem;
		display: flex;
		flex-direction: column;
		gap: 2.5rem;
	}

	.lab-head h1 {
		margin: 0 0 0.3rem;
		font-family: var(--font-display);
		font-size: var(--fs-4xl);
		color: var(--chrome);
	}
	/* On the world, prose takes the BRIGHT ink — there is no panel here to set a
	   dim rung, and --muted does not clear 4.5:1 against a star even at the
	   deeper wash. See TOOL_DIM. */
	.lab-head p,
	.lab-note {
		margin: 0;
		max-width: 90ch;
		font-size: var(--fs-md);
		line-height: var(--lh-relaxed);
		color: var(--text);
	}
	.lab-note {
		margin-bottom: 1rem;
	}

	.lab-h {
		margin: 0 0 0.5rem;
		font-family: var(--font-display);
		font-size: var(--fs-2xl);
		color: var(--chrome);
	}

	.lab-badge {
		padding: 0.1rem 0.45rem;
		border-radius: var(--r-round);
		background: color-mix(in srgb, var(--accent) 22%, transparent);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 45%, transparent);
		color: var(--accent);
		font-family: var(--font-body);
		font-size: var(--fs-xs);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		vertical-align: middle;
	}

	.lab-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1rem;
		align-items: start;
	}
	.lab-row {
		display: flex;
		flex-wrap: wrap;
		gap: 1.2rem;
		align-items: flex-start;
	}
	.lab-stack {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		max-width: 780px;
	}

	/* ── the ground specimens ──────────────────────────────────────────────
	   Identical box in all four; only the context class differs. The bare one
	   paints nothing at all, which is the whole claim of ctx-night. */
	.spec {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
		padding: 1.1rem 1.2rem;
		border-radius: var(--r-sm);
		background: var(--surface);
		color: var(--text);
	}
	.spec--bare {
		background: none;
	}
	.spec.ctx-glass {
		-webkit-backdrop-filter: blur(var(--glass-blur));
		backdrop-filter: blur(var(--glass-blur));
	}

	.spec-tag {
		font-family: var(--font-mono);
		font-size: var(--fs-xs);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		color: var(--muted);
	}
	/* ⚠ Bare night uses --text for the tag too: --muted is 4.16:1 out here. */
	.spec--bare .spec-tag,
	.spec--bare .spec-label,
	.spec--bare .spec-note {
		color: var(--text);
	}

	.spec-title {
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--fs-2xl);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-tight);
		color: var(--text);
	}

	/* ── the ink ladder ───────────────────────────────────────────────────
	   Sample on the left, size tag right-aligned. The tag is deliberately the
	   quietest thing in the panel — it is an annotation on the specimen, not a
	   member of it, and it must not compete with the rung it is labelling. */
	.ty-row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.8rem;
		min-width: 0;
	}
	.ty-tag {
		flex: none;
		font-family: var(--font-mono);
		font-size: var(--fs-2xs);
		color: var(--muted);
		opacity: 0.65;
	}
	.spec--bare .ty-tag {
		color: var(--text);
	}
	/* ⚠ THESE RUNGS ARE PINNED BY HAND, and /lab is excluded from the mechanical
	   size-shift for exactly that reason: the ladder here has to SHOW the scale,
	   not ride it. If a sweep moved these too, the board would always agree with
	   itself and never reveal a rung that had gone missing. Keep the tags and
	   the tokens in step by hand — that is the job. */
	.ty-h1 {
		font-family: var(--font-display);
		font-size: var(--fs-4xl);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-tight);
		color: var(--text);
	}
	.ty-h2 {
		font-family: var(--font-display);
		font-size: var(--fs-3xl);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-tight);
		color: var(--text);
	}
	.ty-h3 {
		font-family: var(--font-display);
		font-size: var(--fs-2xl);
		font-weight: var(--fw-semibold);
		color: var(--text);
	}
	.ty-body {
		font-size: var(--fs-xl);
		color: var(--text);
	}
	.ty-dense {
		font-size: var(--fs-lg);
		color: var(--text);
	}
	/* ⚠ THE LABEL VOICE IS WHERE THE CONTEXTS DISAGREE. --muted is the DIM rung
	   on dark and the ANCHORING rung on paper, so this one row inverts while
	   every other row holds — which is the clearest single demonstration of the
	   ink ladder flipping, and the reason the ladder is rendered per ground
	   rather than once. */
	.ty-label {
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		color: var(--muted);
	}
	.ty-caption {
		font-size: var(--fs-sm);
		color: var(--muted);
	}
	.spec--bare .ty-label,
	.spec--bare .ty-caption {
		color: var(--text);
	}

	/* ── the size-up comparison ───────────────────────────────────────────── */
	.sizeup {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		width: 330px;
		padding: 1rem 1.1rem;
		border-radius: var(--r-sm);
		background: var(--surface);
	}
	.su-h3 {
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--fs-3xl);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-tight);
		color: var(--text);
	}
	.su-body {
		margin: 0;
		font-size: var(--fs-xl);
		line-height: var(--lh-relaxed);
		color: var(--text);
	}
	.su-body b {
		color: var(--accent);
	}
	.su-row {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		font-size: var(--fs-md);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		color: var(--muted);
	}

	.su-table {
		display: grid;
		gap: 3px;
		align-content: start;
		font-family: var(--font-mono);
	}
	.su-trow {
		display: grid;
		grid-template-columns: 12rem 5rem 1.4rem 5rem;
		align-items: center;
		gap: 0.4rem;
		padding: 0.25rem 0.5rem;
		border-radius: var(--r-sm);
	}
	.su-trow.is-moved {
		background: color-mix(in srgb, var(--accent) 12%, transparent);
	}
	.su-role {
		font-family: var(--font-body);
		font-size: var(--fs-sm);
		color: var(--text);
	}
	.su-arrow,
	.su-next {
		color: var(--accent);
		opacity: 1;
	}
	.spec-prose {
		margin: 0;
		font-size: var(--fs-md);
		line-height: var(--lh-relaxed);
		color: var(--text);
	}
	.spec-prose--wide {
		max-width: none;
	}
	.spec-prose a {
		color: var(--accent);
	}
	.spec-prose b {
		color: var(--accent);
		font-weight: var(--fw-semibold);
	}
	.spec-row {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		font-size: var(--fs-sm);
	}
	.spec-label {
		color: var(--muted);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
	}
	.spec-value {
		color: var(--text);
		font-weight: var(--fw-semibold);
	}
	.spec-rule {
		height: 2px;
		margin: 0;
		border: none;
		background: var(--frame-line);
	}
	.spec-controls {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}
	.spec-inset {
		display: grid;
		place-items: center;
		height: 54px;
		border-radius: var(--r-sm);
		font-family: var(--font-mono);
		font-size: var(--fs-xs);
		color: var(--muted);
		--frame-inset: 5px;
	}
	.spec--bare .spec-inset {
		color: var(--text);
	}
	/* The four line stops as a run, so the STEP between them is judgeable —
	   a single line tells you nothing about whether the ladder is spaced. */
	.spec-lines {
		display: grid;
		gap: 3px;
	}
	.spec-line {
		height: 2px;
	}
	.spec-note {
		font-size: var(--fs-xs);
		line-height: var(--lh-normal);
		color: var(--muted);
	}

	/* ── candidates: the night paints ─────────────────────────────────────
	   Local styling, deliberately — these have no home in app.css yet. When one
	   is adopted it moves there and this block shrinks. */
	.night-ribbon {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		border-radius: var(--r-sm);
		background: rgb(20 22 28 / 0.55);
		color: var(--text);
		font-weight: var(--fw-semibold);
	}
	.night-ribbon--danger {
		background: color-mix(in srgb, var(--ui-danger) 38%, transparent);
	}
	.night-fade {
		display: grid;
		place-items: end center;
		height: 110px;
		padding-bottom: 0.6rem;
		border-radius: var(--r-sm);
		background: linear-gradient(to bottom, transparent, rgb(16 16 19 / 0.85));
		color: var(--text);
		font-size: var(--fs-sm);
	}

	/* ── candidates: glass hover ──────────────────────────────────────────── */
	.cand {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.cand-tag {
		font-family: var(--font-mono);
		font-size: var(--fs-xs);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		color: var(--text);
	}
	.glasspane {
		display: grid;
		place-items: center;
		width: 190px;
		height: 62px;
		border-radius: var(--r-sm);
		background: var(--surface);
		-webkit-backdrop-filter: blur(var(--glass-blur));
		backdrop-filter: blur(var(--glass-blur));
		color: var(--muted);
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
	}
	/* The retired wash, kept as the control — a layer over the pane, never a
	   color-mix fed by a color-mix. */
	.glasspane.is-wash {
		background: linear-gradient(var(--fill-hover), var(--fill-hover)), var(--surface);
	}
	/* The shipped hover: the MATERIAL thickens. Reads --surface-hover so this
	   specimen tracks the real token rather than restating its value. */
	.glasspane.is-dense {
		background: var(--surface-hover);
	}
	/* Selected: the SAME density as hover, and a gold ring instead of an ink one.
	   Density separates resting from engaged; hue separates the two engaged
	   states (⚓ Nate). */
	.glasspane.is-sel {
		background: var(--surface-hover);
		box-shadow: inset 0 0 0 1px var(--sel-ring);
		color: var(--text);
	}

	/* ── candidate: borders in gold ───────────────────────────────────────
	   Each cell re-declares --frame-line / --frame-line-quiet inline and then
	   renders the SHIPPED .inset--plain and a plain rule, so the specimen is the
	   real idiom wearing a candidate value — not a drawing of one. */
	.border-grid {
		display: grid;
		gap: 6px;
		max-width: 1000px;
	}
	.border-head,
	.border-row {
		display: grid;
		grid-template-columns: 12rem 1fr 1fr;
		align-items: center;
		gap: 10px;
	}
	.border-name {
		color: var(--text);
	}
	.border-cell {
		display: grid;
		gap: 7px;
		padding: 0.7rem 0.8rem;
		border-radius: var(--r-sm);
		background: var(--surface);
	}
	.border-inset {
		display: grid;
		place-items: center;
		height: 46px;
		border-radius: var(--r-sm);
		font-family: var(--font-mono);
		font-size: var(--fs-xs);
		color: var(--muted);
		--frame-inset: 4px;
	}
	.border-rule {
		height: 2px;
		margin: 0;
		border: none;
		background: var(--frame-line);
	}
	.border-rule--quiet {
		background: var(--frame-line-quiet);
	}

	/* ── gold in text (proposal) ──────────────────────────────────────────── */
	.goldspec {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		width: 340px;
		padding: 1rem 1.1rem;
		border-radius: var(--r-sm);
		background: var(--surface);
	}
	/* The whole proposal, in one declaration: the KICKER goes gold. Nothing else
	   moves — the title stays the context's brightest ink, the prose stays body
	   ink, and the emphasis stays where it is until the --el-* round settles it. */
	.goldspec--next :global(.kicker) {
		color: var(--accent);
	}
	/* ⚠ ...and its rule with it. The kicker's ::after is a mix of --muted; left
	   alone it would read as a grey tail on a gold label, which is precisely the
	   kind of half-applied idiom the board exists to expose before it ships. */
	.goldspec--next :global(.kicker::after) {
		background: color-mix(in srgb, var(--accent) 30%, transparent);
	}

	/* ── the two parchments ───────────────────────────────────────────────── */
	.paper-broad {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
		width: 420px;
		padding: 1.1rem 1.2rem;
		border-radius: var(--r-sm);
		background: var(--surface-broad);
	}
	.paper-object {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.5rem;
		padding: 0.9rem 1rem;
		border-radius: var(--r-sm);
		background: var(--surface);
	}
	.paper-object--alone {
		width: 320px;
	}
	.paper-tag {
		font-family: var(--font-mono);
		font-size: var(--fs-sm);
		color: var(--muted);
	}

	/* ── candidate: the split Atlas card ──────────────────────────────────── */
	.atlas {
		display: grid;
		grid-template-columns: 150px 1fr;
		width: 480px;
		min-height: 132px;
		border-radius: var(--r-sm);
		overflow: hidden;
	}
	.atlas--glass {
		background: var(--surface);
		-webkit-backdrop-filter: blur(var(--glass-blur));
		backdrop-filter: blur(var(--glass-blur));
	}
	.atlas-id {
		display: grid;
		place-items: center;
		background: var(--surface);
	}
	.atlas--glass .atlas-id {
		background: none;
	}
	/* ⚠ THE GLYPH IS CLIPPED TO THE DARK HALF, and that is not a detail: the real
	   role artwork is near-black, drawn to read as a deeper pool IN dark slate.
	   Cross it onto parchment and it inverts wrongly. A stand-in glyph here. */
	.atlas-glyph {
		font-size: 64px;
		line-height: 1;
		color: rgb(0 0 0 / 0.35);
	}
	.atlas-body {
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 0.3rem;
		padding: 1rem 1.2rem;
		background: var(--surface);
	}
	.atlas--glass .atlas-body {
		background: none;
	}
</style>
