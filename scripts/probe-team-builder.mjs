/**
 * scripts/probe-team-builder.mjs
 *
 * Headless verification of the Team Builder Layer 1 surface against a served
 * build (default http://localhost:4998). Drives: roster grid render, capability
 * facet filtering (AND semantics), the uncurated bucket, constellation modes
 * (C0 / My roster / C6), detail-card (modal) lazy load + provenance +
 * constellation stepper persistence, the Compare tab-as-accumulator (silent
 * add → avatar stack in the tab → center view with Timing ruler + Facts
 * table), and Audition (pin the incumbent, in-view candidates strip, commit
 * a slot swap).
 *
 *   npm run preview -- --port 4998 --strictPort &
 *   node scripts/probe-team-builder.mjs [--headed]
 */

import { chromium } from 'playwright';

const BASE = process.env.PROBE_BASE ?? 'http://localhost:4998';
const headless = !process.argv.includes('--headed');

const browser = await chromium.launch({ channel: 'chrome', headless });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

const failures = [];
const pass = (name) => console.log(`  ✓ ${name}`);
const fail = (name, detail) => {
	failures.push(name);
	console.log(`  ✗ ${name} — ${detail}`);
};
const check = (name, cond, detail = '') => (cond ? pass(name) : fail(name, detail));

const consoleErrors = [];
page.on('console', (msg) => {
	// Avatar 404 fallbacks are by design (verify skill notes); everything else counts.
	if (msg.type() === 'error' && !msg.text().includes('404')) consoleErrors.push(msg.text());
});
page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));

const tileCount = () => page.locator('.cg-grid').first().locator('.cc').count();
const matchCount = async () => {
	const text = await page.locator('.tb-count').innerText();
	return parseInt(text, 10);
};
const facetChip = (label) => page.locator('.tb-chips .chip', { hasText: label }).first();

console.log('team-builder probe @', BASE);

// ── 1. Cold load: Atlas front door → pivot to Roster ───────────────────────
await page.goto(`${BASE}/team-builder`, { waitUntil: 'networkidle' });
check(
	'atlas is the default front door (2×2 role cards)',
	(await page.locator('.tb-atlas .rolecard').count()) === 4,
	String(await page.locator('.tb-atlas .rolecard').count())
);
check('roster grid hidden on the atlas tab', (await page.locator('.cg-grid').count()) === 0);
// Switch to the Roster tab for the full grid. NOTE: the atlas→roster role-drill
// PIVOT (clicking a role card → role-filtered grid) is atlas-specific behavior
// from the 2026-07-22 role redesign and needs dedicated atlas-probe coverage; it
// is intentionally not asserted here (the prior facet-card pivot assertion was
// stale against the current `.rolecard` model).
await page.locator('.tb-tabs .tab', { hasText: 'Roster' }).click();
await page.locator('.cg-grid').first().waitFor({ timeout: 5000 });
const total = await tileCount();
// 122 = 123 character JSONs minus the 'blank' placeholder the grid filters out.
// (Was 124 before the 2026-07-12 Manekin/Manekina retirement, which post-dated
// the last probe-expectation refresh in fc814cf.)
check('roster grid renders the full roster (122)', total === 122, `got ${total}`);
check(
	'no uncurated bucket without capability facets',
	(await page.locator('.tb-stubs').count()) === 0
);

// ── 2. Heal facet: filtering + honest stub bucket ──────────────────────────
await facetChip('Heals').click();
const healers = await matchCount();
check('heal facet narrows the grid', healers > 15 && healers < 45, `got ${healers}`);
// The uncurated bucket collects ONLY capability-unknown characters
// (caps.length === 0 && !curated). Since the 2026-07-23 two-tool-split
// (7522845) gave the frameless stubs complete Stages-1-3 capabilities, none are
// capability-unknown today — so the bucket is currently empty and does not
// render; the stubs filter into the MAIN grid (flagged by the frame chip).
check(
	'no uncurated bucket while all known stubs carry capabilities',
	(await page.locator('.tb-stubs').count()) === 0
);
const names = await page.locator('.cg-grid').first().locator('.cc-name').allInnerTexts();
check('Bennett matches heal', names.includes('Bennett'), names.slice(0, 8).join(','));
check('Jean matches heal (passive-derived)', names.includes('Jean'));

// ── 3. AND semantics: heal + ATK buff ──────────────────────────────────────
await facetChip('ATK buff').click();
const both = await matchCount();
const bothNames = await page.locator('.cg-grid').first().locator('.cc-name').allInnerTexts();
check(
	'heal+ATK-buff intersects (Bennett present, far fewer matches)',
	both < healers && bothNames.includes('Bennett'),
	`${both} matches: ${bothNames.join(',')}`
);
await facetChip('ATK buff').click(); // off

// ── 4. Constellation modes: C0 vs C6 widen gates ───────────────────────────
await page.locator('.tb-conmode .btn', { hasText: 'C0' }).click();
const atC0 = await matchCount();
await page.locator('.tb-conmode .btn', { hasText: 'C6' }).click();
const atC6 = await matchCount();
check(
	'C6 unlocks more healers than C0 (Gorou C4, Xianyun C4…)',
	atC6 > atC0,
	`C0=${atC0} C6=${atC6}`
);
const c6Names = await page.locator('.cg-grid').first().locator('.cc-name').allInnerTexts();
check('Gorou appears at C6 (C4-gated heal)', c6Names.includes('Gorou'), '');
check(
	'Gorou absent at C0',
	!(await (async () => {
		await page.locator('.tb-conmode .btn', { hasText: 'C0' }).click();
		const n = await page.locator('.cg-grid').first().locator('.cc-name').allInnerTexts();
		return n.includes('Gorou');
	})())
);

// ── 5. Detail card: lazy load, provenance, con stepper persistence ─────────
await facetChip('Heals').click(); // clear facet
const chunkRequests = [];
page.on('request', (req) => {
	if (req.url().includes('/chunks/') && req.url().endsWith('.js')) chunkRequests.push(req.url());
});
await page.locator('.cc', { hasText: 'Gorou' }).first().locator('.cc-main').click();
await page.locator('.dc-panel').waitFor({ timeout: 5000 });
await page.locator('.dc-caps .dc-cap').first().waitFor({ timeout: 5000 });
check(
	'detail card lazy-loads the character chunk',
	chunkRequests.length > 0,
	'no chunk request seen'
);
// The detail card is a modal at every width (the Stage column is retired) —
// a fixed scrim, and the source grid never reflows underneath it.
const dockPos = await page.locator('.dc-backdrop').evaluate((el) => getComputedStyle(el).position);
check('detail card opens as a modal (fixed scrim)', dockPos === 'fixed', `pos=${dockPos}`);
const capsText = await page.locator('.dc-caps').innerText();
check(
	'Gorou card shows C4 heal provenance',
	/Heal/.test(capsText) && /C4/.test(capsText),
	capsText.slice(0, 200)
);
// NOTE: no data-completeness assertions here — what SHOULD derive is the
// audit's job (scripts/audit-capabilities.mjs); this probe checks UI behavior.
const timing = await page.locator('.dc-timing').innerText();
check('timing reference shows E cooldown', /CD/.test(timing), timing);

// Constellation stepper → localStorage → "My roster" filtering
await page.locator('.dc-con-btn', { hasText: 'C4' }).click();
const stored = await page.evaluate(() =>
	JSON.parse(localStorage.getItem('critcalc:constellations') ?? '{}')
);
check('stepper persists to the constellations store', stored.gorou === 4, JSON.stringify(stored));
await page.keyboard.press('Escape');
check('Escape closes the card', (await page.locator('.dc-panel').count()) === 0);

await facetChip('Heals').click();
await page.locator('.tb-conmode .btn', { hasText: 'My roster' }).click();
const mineNames = await page.locator('.cg-grid').first().locator('.cc-name').allInnerTexts();
check('My roster mode: Gorou (your C4) now matches heal', mineNames.includes('Gorou'), '');
// Dori & Gaming graduated to C0 healers when their base heals were authored;
// Lauma's C1-gated active heal is the current con-gated negative case (owned at
// C0 by default → her heal stays locked in My-roster mode).
check('My roster mode: C-gated healers still absent (Lauma C1)', !mineNames.includes('Lauma'), '');

// Persistence across reload (cold load lands on Atlas → switch to Roster)
await page.reload({ waitUntil: 'networkidle' });
await page.locator('.tb-tabs .tab', { hasText: 'Roster' }).click();
await facetChip('Heals').click();
await page.locator('.tb-conmode .btn', { hasText: 'My roster' }).click();
const reloadNames = await page.locator('.cg-grid').first().locator('.cc-name').allInnerTexts();
check('constellation survives reload (Gorou still matches)', reloadNames.includes('Gorou'), '');

// ── 6. Compare: the tab IS the accumulator ─────────────────────────────────
await facetChip('Heals').click(); // clear facet → full grid
const addToCompare = async (name) => {
	const tile = page.locator('.cc', { hasText: name }).first();
	// The action bar reveals on hover, and the fixed nav overlaps tiles at the
	// viewport edges — dispatch the click directly to exercise the handler
	// without fighting hit-testing (the hover reveal is verified visually).
	await tile.locator('.tb-act--compare').dispatchEvent('click');
};
const compareTab = page.locator('.tb-tabs .tab', { hasText: 'Compare' });
check(
	'compare tab starts with no avatar stack',
	(await page.locator('.tb-tabstack').count()) === 0
);
await addToCompare('Bennett');
// The add is SILENT: the roster stays put; the tab grows an avatar.
check(
	'first pick lands in the tab avatar stack without navigating',
	(await page.locator('.tb-tabstack-circle').count()) === 1 &&
		(await page.locator('.cg-grid').first().isVisible()),
	`circles=${await page.locator('.tb-tabstack-circle').count()}`
);
await addToCompare('Jean');
await addToCompare('Diona');
check(
	'tab stack tracks every pick (3 circles)',
	(await page.locator('.tb-tabstack-circle').count()) === 3,
	String(await page.locator('.tb-tabstack-circle').count())
);
await compareTab.click();
await page.locator('.cmp').waitFor({ timeout: 5000 });
await page.locator('.cmp-dim-label').first().waitFor({ timeout: 5000 });

// Compare is a center Source view — in normal flow, no scrim, no dock rules.
const cmpPos = await page.locator('.cmp').evaluate((el) => getComputedStyle(el).position);
check('compare renders in-flow in the center (no modal)', cmpPos === 'static', `pos=${cmpPos}`);

check('compare view shows all three characters', (await page.locator('.cmp-chip').count()) === 3);
const dimLabels = await page.locator('.cmp-dim-label').allInnerTexts();
check(
	'timing ruler lanes present (E cooldown / Q cooldown)',
	['E cooldown', 'Q cooldown'].every((l) => dimLabels.includes(l)),
	dimLabels.join(',')
);
check('heal lane present for three healers', dimLabels.includes('Heal'), dimLabels.join(','));

// Shared ruler renders ticks for the one common time scale.
check('shared ruler renders ticks', (await page.locator('.cmp-ruler .cmp-rtick').count()) > 0);

// The Facts table: one column per character, Q energy now a table row, and
// every capability cell carries a constellation gate chip.
const factLabels = await page.locator('.cmp-table .cmp-td-label').allInnerTexts();
check(
	'facts table aligns timing rows (Q energy lives here now)',
	factLabels.includes('Q energy'),
	factLabels.join(',')
);
check(
	'facts table has one column per character',
	(await page.locator('.cmp-table thead th').count()) === 4, // label col + 3
	String(await page.locator('.cmp-table thead th').count())
);
check(
	'capability cells show constellation gates',
	(await page.locator('.cmp-cell .cmp-gate').count()) >= 3,
	''
);

// Stacked bars share one scale: cooldown ghost tracks exist for every character
// and — being different cooldowns — have nonzero, non-uniform widths.
const ghostWidths = await page
	.locator('.cb-ghost')
	.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().width));
check(
	'cooldown bars render on a shared scale (nonzero, non-uniform widths)',
	ghostWidths.length >= 3 &&
		ghostWidths.every((w) => w > 0) &&
		new Set(ghostWidths.map(Math.round)).size > 1,
	ghostWidths.join(',')
);
// At least one durationed window renders as a solid uptime segment.
check(
	'durationed windows render solid uptime bars',
	(await page.locator('.cb-uptime').count()) >= 1,
	''
);
await page.screenshot({ path: 'probe-team-builder-compare.png', fullPage: false });

// Removing a character from inside the view syncs the tab stack.
await page.locator('.cmp-chip-remove').first().click();
check('character remove drops to two', (await page.locator('.cmp-chip').count()) === 2);
check(
	'tab stack syncs the removal (2 circles)',
	(await page.locator('.tb-tabstack-circle').count()) === 2
);
// Clear from the view header → the taught empty state; the stack empties.
await page.locator('.cmp-headact').click();
check('clear drops to the empty state', (await page.locator('.tb-cmp-empty').count()) === 1);
check('clear empties the tab stack', (await page.locator('.tb-tabstack').count()) === 0);
await page.locator('.tb-tabs .tab', { hasText: 'Roster' }).click();
await page.locator('.cg-grid').first().waitFor({ timeout: 5000 });

// ── 7. Team strip: slots, facts, checklist ─────────────────────────────────
// The slot cards are the layout-level bench band now (bench-band round): a
// filled slot is a band card with a non-empty name; empties render blank.
const filledSlots = async () =>
	(await page.locator('.bench-band-mount .sp-char-name').allInnerTexts()).filter(
		(t) => t.trim() !== ''
	).length;
check('team strip renders with four empty slots', (await filledSlots()) === 0);

const addToTeam = async (name) => {
	await page.locator('.cc', { hasText: name }).first().locator('.cc-main').click();
	await page.locator('.dc-panel').waitFor({ timeout: 5000 });
	await page.locator('.dc-team').click();
	await page.keyboard.press('Escape');
};
await addToTeam('Bennett');
check('first slot fills from the detail card', (await filledSlots()) === 1);
check(
	'the slots→URL mirror is retired (working team lives in tab state)',
	!page.url().includes('team='),
	page.url()
);
check(
	'partial team: resonance withheld (needs full party)',
	(await page.locator('.ts-resnote').count()) === 1
);

await addToTeam('Jean');
await addToTeam('Diona');
await addToTeam('Gorou');
// pyro + anemo + cryo + geo = four distinct elements → Protective Canopy
const resLabels = await page.locator('.ts-res').allInnerTexts();
check(
	'four distinct elements → Protective Canopy',
	resLabels.length === 1 && /Protective Canopy/.test(resLabels[0]),
	resLabels.join(',')
);
const covYes = await page.locator('.ts-cov--yes').allInnerTexts();
check(
	'coverage checklist marks Heals ✓',
	// innerText arrives uppercased (chip CSS text-transform) — case-insensitive.
	covYes.some((t) => /heal/i.test(t)),
	covYes.join(',')
);
check(
	'coverage checklist keeps absent capabilities visible as ✗',
	(await page.locator('.ts-cov--no').count()) > 0
);

// Detail card of a slotted character offers removal; a fifth character sees "full"
await page.locator('.cc', { hasText: 'Bennett' }).first().locator('.cc-main').click();
await page.locator('.dc-panel').waitFor({ timeout: 5000 });
check(
	'slotted character card shows in-team state',
	/In team/.test(await page.locator('.dc-team').innerText())
);
await page.keyboard.press('Escape');
await page.locator('.cc', { hasText: 'Furina' }).first().locator('.cc-main').click();
await page.locator('.dc-panel').waitFor({ timeout: 5000 });
check('full team disables adding a fifth', await page.locator('.dc-team').isDisabled());
await page.keyboard.press('Escape');

// Deep link: cold load with ?team= imports the team into a tab (the inbound
// half of ?team= survives the mirror's retirement) and strips the param.
await page.goto(`${BASE}/team-builder?team=bennett,jean,diona,gorou`, {
	waitUntil: 'networkidle'
});
check('?team= cold load imports four slots', (await filledSlots()) === 4);
check('?team= is stripped after import', !page.url().includes('team='), page.url());
await page.screenshot({ path: 'probe-team-builder-team.png', fullPage: false });

// ── 7b. Audition: pin the incumbent, in-view candidates, commit a swap ─────
// Bennett holds slot 0 — audition replacements for him from the Bench. This
// navigates to the Compare tab (an explicit "start comparing" action, unlike
// a card's silent add) with the candidates strip rendered inside the view.
await page.locator('.bb-act[aria-label^="Audition"]').first().click();
await page.locator('.cmp').waitFor({ timeout: 5000 });
await page.locator('.cmp-chip--anchor').first().waitFor({ timeout: 5000 });
check(
	'audition opens the Compare tab with the incumbent anchored',
	(await page.locator('.cmp-chip--anchor').count()) === 1 &&
		(await page.locator('.cmp-chip-current').count()) === 1,
	`anchor=${await page.locator('.cmp-chip--anchor').count()} current=${await page
		.locator('.cmp-chip-current')
		.count()}`
);
check(
	'the audition anchor has no remove control (it stays pinned)',
	(await page.locator('.cmp-chip--anchor .cmp-chip-remove').count()) === 0
);
// The in-view candidates strip: the incumbent's facets as toggleable chips
// (all active at open), suggesting who covers the same ground.
check(
	'candidates strip renders with the incumbent’s facet chips active',
	(await page.locator('.tb-aud').count()) === 1 &&
		(await page.locator('.tb-aud-facets .chip.active').count()) > 0,
	`strip=${await page.locator('.tb-aud').count()} active=${await page
		.locator('.tb-aud-facets .chip.active')
		.count()}`
);
// Toggling every seed chip off broadens the strip to the whole roster minus
// the team (122 − 4) — the deterministic bound, and the AND-relax escape hatch.
while ((await page.locator('.tb-aud-facets .chip.active').count()) > 0) {
	await page.locator('.tb-aud-facets .chip.active').first().click();
}
check(
	'relaxing every facet broadens candidates to roster minus team',
	(await page.locator('.tb-cand').count()) === 118,
	String(await page.locator('.tb-cand').count())
);
// Add Furina from the strip → she joins the comparison with a commit control.
await page.locator('.tb-cand', { hasText: 'Furina' }).first().click();
await page.locator('.cmp-chip-commit').first().waitFor({ timeout: 5000 });
check(
	'a candidate joins the audition with a commit control',
	(await page.locator('.cmp-chip').count()) === 2 &&
		(await page.locator('.cmp-chip-commit').count()) >= 1
);
// Commit Furina → she replaces Bennett in slot 0 and the view returns whence
// the audition began (the Atlas, on this ?team= arrival).
await page.locator('.cmp-chip-commit').first().click();
await page.locator('.cmp').waitFor({ state: 'detached', timeout: 5000 });
check(
	'committing returns to the originating tab',
	(await page.locator('.tb-atlas').count()) === 1 && (await page.locator('.cmp').count()) === 0
);
const auditionedNames = await page.locator('.bench-band-mount .sp-char-name').allInnerTexts();
check(
	'committing swaps the slot (Furina replaces Bennett)',
	auditionedNames.includes('Furina') && !auditionedNames.includes('Bennett'),
	auditionedNames.join(',')
);
check(
	'the swap does not touch the URL (mirror retired)',
	!page.url().includes('team='),
	page.url()
);
check(
	'the audition-scoped picks are cleared (no leftover tab stack)',
	(await page.locator('.tb-tabstack').count()) === 0
);
await page.screenshot({ path: 'probe-team-builder-audition.png', fullPage: false });

await page.locator('.ts-clear').click();
check('clear team empties slots', (await filledSlots()) === 0);

// ── 8. One working team: TB ⇄ planner share the slots through tab state ────
// The old ?team= cross-injection is retired — navigating to the planner finds
// the SAME team already in the slots, because both tools edit the active
// rotation tab. (The bench band itself glides across during the pan.)
await page.goto(`${BASE}/team-builder?team=bennett,jean,diona,gorou`, {
	waitUntil: 'networkidle'
});
check(
	'send-to-planner link is retired (the shared team travels by itself)',
	(await page.locator('.ts-send').count()) === 0
);
await page.locator('.chrome-nav a[href*="rotation-planner"]').click();
await page.waitForTimeout(1400); // the pan + band travel
const plannerNames = await page.locator('.bench-band-mount .sp-char-name').allInnerTexts();
check(
	'planner slots hold the SAME working team (no URL hand-off needed)',
	['Bennett', 'Jean', 'Diona', 'Gorou'].every((n) => plannerNames.includes(n)),
	plannerNames.join(',')
);
check('no ?team= appears anywhere in the trip', !page.url().includes('team='), page.url());

// Planner → TB: the in-frame Source overlay + the whole-team "Explore
// alternatives →" hand-off (the retired ?replace= single-char pre-seed).
await page.locator('.sp-avatar-chip').first().click();
await page.locator('.cs-panel').waitFor({ timeout: 5000 });
check(
	'portrait click opens the in-frame Source overlay (non-modal, inside the frame)',
	(await page.locator('.rp-source-overlay .cs-panel').count()) === 1
);
check(
	'Source overlay renders the character grid',
	(await page.locator('.cc').count()) > 100,
	String(await page.locator('.cc').count())
);
check(
	'the current team shows as selected in the overlay (4 slot badges)',
	(await page.locator('.cc-slot').count()) === 4,
	String(await page.locator('.cc-slot').count())
);
// Live edit: deselecting a selected card frees a slot immediately (no Confirm).
await page.locator('.cc-main[aria-pressed="true"]').first().click();
check(
	'deselecting in the overlay frees a slot live (3 badges)',
	(await page.locator('.cc-slot').count()) === 3,
	String(await page.locator('.cc-slot').count())
);
// Re-add Bennett (alphabetically first) so the hand-off carries the full four.
await page.locator('.cc', { hasText: 'Bennett' }).first().click();
check('re-adding refills the slot (4 badges)', (await page.locator('.cc-slot').count()) === 4);
await page.locator('.cs-close-btn').click();
// The Source stays MOUNTED after first open (Safari-26 remount-stall fix) —
// closed now means hidden, not removed from the DOM.
check('close button dismisses the overlay', !(await page.locator('.cs-panel').isVisible()));
check(
	'"Explore alternatives →" is tied to the picker (unreachable from the main surface)',
	// It lives INSIDE the Source overlay now (tall-bench round: the ribbon owns
	// the label column it used to dock in), and the overlay stays MOUNTED but
	// [hidden] after first open — so this is a visibility check, not a count.
	!(await page.locator('.rp-explore-link').isVisible())
);

// Re-open the picker — the Explore hand-off rides the picker's own bottom edge
// while you're choosing team members. The team no longer rides
// the URL (it IS the shared working team); ?alts=1 just requests the per-slot
// alternatives view.
await page.locator('.sp-avatar-chip').first().click();
await page.locator('.rp-explore-link').waitFor({ timeout: 5000 });
const exploreHref = await page.locator('.rp-explore-link').getAttribute('href');
check(
	'Explore alternatives → asks for the alternatives view (team already shared)',
	exploreHref === '/team-builder?alts=1',
	exploreHref
);
await page.locator('.rp-explore-link').click();
await page.locator('.tb-source').waitFor({ timeout: 10000 });
await page.waitForTimeout(1400); // the pan + band travel
check(
	'Team Builder shows the same working team (four filled)',
	(await filledSlots()) === 4,
	String(await filledSlots())
);
check(
	'arrival opens the per-slot alternatives view',
	(await page.locator('.tb-slotrow').count()) > 0,
	String(await page.locator('.tb-slotrow').count())
);
// Let the outgoing planner layer finish its retention hold (HOLD_MAX_MS 4000)
// before counting chips — its Source rail duplicates rail selectors until then.
await page.waitForTimeout(4400);
await page.screenshot({ path: 'probe-team-builder-explore.png', fullPage: false });

// ── 8b. Ownership ledger: mark, filter, persist ────────────────────────────
// Arriving via ?team= lands on Atlas — switch to the Roster grid to mark owners.
await page.locator('.tb-tabs .tab', { hasText: 'Roster' }).click();
await page.locator('.cg-grid').first().waitFor({ timeout: 10000 });

// Wishlist Bennett via the detail card's ownership toggle.
await page.locator('.cc', { hasText: 'Bennett' }).first().locator('.cc-main').click();
await page.locator('.dc-panel').waitFor({ timeout: 5000 });
await page.locator('.dc-own-btn--wish').click();
check(
	'wishlist mark persists to localStorage',
	await page.evaluate(
		() => JSON.parse(localStorage.getItem('critcalc:ownership') ?? '{}').bennett === 'wishlist'
	),
	''
);
await page.keyboard.press('Escape');

// Roster view → Wishlist narrows the grid to the wishlisted character only.
await page.locator('.tb-seg .btn', { hasText: 'Wishlist' }).click();
const wishNames = await page.locator('.cg-grid').first().locator('.cc-name').allInnerTexts();
check(
	'wishlist view shows the wishlisted character',
	wishNames.includes('Bennett'),
	wishNames.join(',')
);
check(
	'wishlist view excludes unwishlisted characters',
	!wishNames.includes('Jean') && wishNames.length < 5,
	`${wishNames.length}: ${wishNames.join(',')}`
);
await page.locator('.tb-seg .btn', { hasText: 'All' }).click();

// Edit roster: clicking a tile toggles owned (faded ↔ full opacity).
await page.locator('.tb-edit-toggle').click();
await page.locator('.cc', { hasText: 'Diona' }).first().locator('.cc-main').click();
check(
	'edit-mode tile click marks the character owned',
	await page.evaluate(
		() => JSON.parse(localStorage.getItem('critcalc:ownership') ?? '{}').diona === 'owned'
	),
	''
);
check('not-owned characters fade while editing', (await page.locator('.cc--faded').count()) > 0);
await page.locator('.tb-edit-toggle').click();

// ── 8b. Factions / Buffs filter group (2026-07-29) ──────────────────────────
// Moonsign/Hexerei filter faction membership; Stellar = enabler-or-gated-buffs
// (Sandrone enables; Diona carries a stellar-gated C6 buff; Bennett is neither).
const fbChips = page.locator('.cg-rail .chip', { hasText: /^(Moonsign|Hexerei|Stellar)$/ });
check('Factions/Buffs group renders its three chips', (await fbChips.count()) === 3);
await page.locator('.cg-rail .chip', { hasText: 'Stellar' }).click();
const stellarNames = await page.locator('.cg-grid').first().locator('.cc-name').allInnerTexts();
check(
	'Stellar filter finds the enabler and a gated-buff carrier',
	stellarNames.includes('Sandrone') && stellarNames.includes('Diona'),
	stellarNames.join(',')
);
check(
	'Stellar filter excludes unrelated characters',
	!stellarNames.includes('Bennett') && stellarNames.length < 15,
	`${stellarNames.length}`
);
await page.locator('.cg-rail .chip', { hasText: 'Stellar' }).click();

// ── 9. Screenshots + console health ────────────────────────────────────────
await page.screenshot({ path: 'probe-team-builder-grid.png', fullPage: false });
await page.locator('.cc', { hasText: 'Bennett' }).first().locator('.cc-main').click();
await page.locator('.dc-caps .dc-cap').first().waitFor({ timeout: 5000 });
await page.screenshot({ path: 'probe-team-builder-card.png', fullPage: false });
check('no unexpected console errors', consoleErrors.length === 0, consoleErrors.join(' | '));

await browser.close();
console.log(
	failures.length === 0 ? 'ALL CHECKS PASSED' : `${failures.length} FAILED: ${failures.join('; ')}`
);
process.exit(failures.length === 0 ? 0 : 1);
