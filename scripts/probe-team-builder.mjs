/**
 * scripts/probe-team-builder.mjs
 *
 * Headless verification of the Team Builder Layer 1 surface against a served
 * build (default http://localhost:4998). Drives: roster grid render, capability
 * facet filtering (AND semantics), the uncurated bucket, constellation modes
 * (C0 / My roster / C6), detail-card lazy load + provenance + constellation
 * stepper persistence, stacked-bar Compare docked into the widened Stage, and
 * Audition (pin the incumbent, pre-seed the Source, commit a slot swap).
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

const tileCount = () => page.locator('.tb-grid').first().locator('.tb-tile').count();
const matchCount = async () => {
	const text = await page.locator('.tb-count').innerText();
	return parseInt(text, 10);
};
const facetChip = (label) => page.locator('.tb-chip', { hasText: label }).first();

console.log('team-builder probe @', BASE);

// ── 1. Cold load: Atlas front door → pivot to Roster ───────────────────────
await page.goto(`${BASE}/team-builder`, { waitUntil: 'networkidle' });
check(
	'atlas is the default front door',
	(await page.locator('.tb-atlas .atlas-card').count()) > 8,
	''
);
check('roster grid hidden on the atlas tab', (await page.locator('.tb-grid').count()) === 0);
// Atlas card click pivots to the filtered Roster.
await page.locator('.atlas-card', { hasText: 'Heals' }).first().locator('.atlas-card-main').click();
await page.locator('.tb-grid').first().waitFor({ timeout: 5000 });
const pivotCount = await matchCount();
check(
	'atlas card pivots to filtered roster (heal providers)',
	pivotCount > 15 && pivotCount < 45,
	`got ${pivotCount}`
);
await page.locator('.tb-clear').click(); // clear the pivot's facet → full grid
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
const bucket = page.locator('.tb-stubs');
check('uncurated bucket appears under capability facets', (await bucket.count()) === 1);
const stubTiles = await bucket.locator('.tb-tile').count();
check(
	'bucket holds the remaining uncurated stubs',
	stubTiles >= 1 && stubTiles <= 20,
	`got ${stubTiles}`
);
const names = await page.locator('.tb-grid').first().locator('.tb-tile-name').allInnerTexts();
check('Bennett matches heal', names.includes('Bennett'), names.slice(0, 8).join(','));
check('Jean matches heal (passive-derived)', names.includes('Jean'));

// ── 3. AND semantics: heal + ATK buff ──────────────────────────────────────
await facetChip('ATK buff').click();
const both = await matchCount();
const bothNames = await page.locator('.tb-grid').first().locator('.tb-tile-name').allInnerTexts();
check(
	'heal+ATK-buff intersects (Bennett present, far fewer matches)',
	both < healers && bothNames.includes('Bennett'),
	`${both} matches: ${bothNames.join(',')}`
);
await facetChip('ATK buff').click(); // off

// ── 4. Constellation modes: C0 vs C6 widen gates ───────────────────────────
await page.locator('.tb-conmode-btn', { hasText: 'C0' }).click();
const atC0 = await matchCount();
await page.locator('.tb-conmode-btn', { hasText: 'C6' }).click();
const atC6 = await matchCount();
check(
	'C6 unlocks more healers than C0 (Gorou C4, Xianyun C4…)',
	atC6 > atC0,
	`C0=${atC0} C6=${atC6}`
);
const c6Names = await page.locator('.tb-grid').first().locator('.tb-tile-name').allInnerTexts();
check('Gorou appears at C6 (C4-gated heal)', c6Names.includes('Gorou'), '');
check(
	'Gorou absent at C0',
	!(await (async () => {
		await page.locator('.tb-conmode-btn', { hasText: 'C0' }).click();
		const n = await page.locator('.tb-grid').first().locator('.tb-tile-name').allInnerTexts();
		return n.includes('Gorou');
	})())
);

// ── 5. Detail card: lazy load, provenance, con stepper persistence ─────────
await facetChip('Heals').click(); // clear facet
const chunkRequests = [];
page.on('request', (req) => {
	if (req.url().includes('/chunks/') && req.url().endsWith('.js')) chunkRequests.push(req.url());
});
await page.locator('.tb-tile', { hasText: 'Gorou' }).first().locator('.tb-tile-open').click();
await page.locator('.dc-panel').waitFor({ timeout: 5000 });
await page.locator('.dc-caps .dc-cap').first().waitFor({ timeout: 5000 });
check(
	'detail card lazy-loads the character chunk',
	chunkRequests.length > 0,
	'no chunk request seen'
);
// Wide viewport (1600px) → the card docks into the Stage column (in-flow, no scrim).
const dockPos = await page
	.locator('.dc-backdrop--docked')
	.evaluate((el) => getComputedStyle(el).position);
check(
	'detail card docks into the stage on a wide viewport',
	(await page.locator('.tb-stage').count()) === 1 && dockPos === 'static',
	`stage=${await page.locator('.tb-stage').count()} pos=${dockPos}`
);
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
await page.locator('.tb-conmode-btn', { hasText: 'My roster' }).click();
const mineNames = await page.locator('.tb-grid').first().locator('.tb-tile-name').allInnerTexts();
check('My roster mode: Gorou (your C4) now matches heal', mineNames.includes('Gorou'), '');
// Dori & Gaming graduated to C0 healers when their base heals were authored;
// Lauma's C1-gated active heal is the current con-gated negative case (owned at
// C0 by default → her heal stays locked in My-roster mode).
check('My roster mode: C-gated healers still absent (Lauma C1)', !mineNames.includes('Lauma'), '');

// Persistence across reload (cold load lands on Atlas → switch to Roster)
await page.reload({ waitUntil: 'networkidle' });
await page.locator('.tb-tab', { hasText: 'Roster' }).click();
await facetChip('Heals').click();
await page.locator('.tb-conmode-btn', { hasText: 'My roster' }).click();
const reloadNames = await page.locator('.tb-grid').first().locator('.tb-tile-name').allInnerTexts();
check('constellation survives reload (Gorou still matches)', reloadNames.includes('Gorou'), '');

// ── 6. Compare: tray, aligned view, remove/close ───────────────────────────
await facetChip('Heals').click(); // clear facet → full grid
const addToCompare = async (name) => {
	const tile = page.locator('.tb-tile', { hasText: name }).first();
	// The action bar reveals on hover, and the fixed nav (top) / Compare tray
	// (bottom) overlap tiles at the viewport edges — dispatch the click directly
	// to exercise the handler without fighting hit-testing (the hover reveal is
	// verified visually, not here).
	await tile.locator('.tb-tile-act--compare').dispatchEvent('click');
};
await addToCompare('Bennett');
check('tray appears after first pick', (await page.locator('.tray').count()) === 1);
check(
	'compare disabled below two picks',
	await page.locator('.tray-go').isDisabled(),
	'button enabled with 1 pick'
);
await addToCompare('Jean');
await addToCompare('Diona');
await page.locator('.tray-go').click();
await page.locator('.cmp-panel').waitFor({ timeout: 5000 });
await page.locator('.cmp-dim-label').first().waitFor({ timeout: 5000 });

// Compare now docks into a widened Stage column rather than floating as a modal
// — mirror the DetailCard dock check (scrim dissolves, panel sits in-flow).
const cmpDockPos = await page
	.locator('.cmp-backdrop--docked')
	.evaluate((el) => getComputedStyle(el).position)
	.catch(() => 'missing');
check(
	'compare docks into the stage on a wide viewport',
	(await page.locator('.tb-stage .cmp-panel').count()) === 1 && cmpDockPos === 'static',
	`stage=${await page.locator('.tb-stage .cmp-panel').count()} pos=${cmpDockPos}`
);
check(
	'comparing widens the stage (.tb--compare)',
	(await page.locator('.tb--compare').count()) === 1
);

check('compare view shows all three characters', (await page.locator('.cmp-chip').count()) === 3);
const dimLabels = await page.locator('.cmp-dim-label').allInnerTexts();
check(
	'timing dimensions present (E cooldown / Q cooldown / Q energy)',
	['E cooldown', 'Q cooldown', 'Q energy'].every((l) => dimLabels.includes(l)),
	dimLabels.join(',')
);
check('heal dimension present for three healers', dimLabels.includes('Heal'), dimLabels.join(','));

// Shared ruler renders ticks for the one common time scale.
check('shared ruler renders ticks', (await page.locator('.cmp-ruler .cmp-rtick').count()) > 0);

// Every capability lane carries a constellation gate chip.
check(
	'capability lanes show constellation gates',
	(await page.locator('.cmp-lane .cmp-gate').count()) >= 3,
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

// Removing a character from inside the view
await page.locator('.cmp-chip-remove').first().click();
check('character remove drops to two', (await page.locator('.cmp-chip').count()) === 2);
await page.keyboard.press('Escape');
check('Escape closes compare view', (await page.locator('.cmp-panel').count()) === 0);
check('tray survives with remaining picks', (await page.locator('.tray-pick').count()) === 2);
await page.locator('.tray-clear').click();
check('clear empties the tray', (await page.locator('.tray').count()) === 0);

// ── 7. Team strip: slots, facts, checklist, ?team= URL ─────────────────────
check(
	'team strip renders with four empty slots',
	(await page.locator('.bn-slot--empty').count()) === 4
);

const addToTeam = async (name) => {
	await page.locator('.tb-tile', { hasText: name }).first().locator('.tb-tile-open').click();
	await page.locator('.dc-panel').waitFor({ timeout: 5000 });
	await page.locator('.dc-team').click();
	await page.keyboard.press('Escape');
};
await addToTeam('Bennett');
check(
	'first slot fills from the detail card',
	(await page.locator('.bn-slot--filled').count()) === 1
);
check('?team= mirrors the slot state', page.url().includes('team=bennett'), page.url());
check(
	'partial team: resonance withheld (needs full party)',
	(await page.locator('.bn-resnote').count()) === 1
);

await addToTeam('Jean');
await addToTeam('Diona');
await addToTeam('Gorou');
// pyro + anemo + cryo + geo = four distinct elements → Protective Canopy
const resLabels = await page.locator('.bn-res').allInnerTexts();
check(
	'four distinct elements → Protective Canopy',
	resLabels.length === 1 && /Protective Canopy/.test(resLabels[0]),
	resLabels.join(',')
);
const covYes = await page.locator('.bn-cov--yes').allInnerTexts();
check(
	'coverage checklist marks Heals ✓',
	// innerText arrives uppercased (chip CSS text-transform) — case-insensitive.
	covYes.some((t) => /heal/i.test(t)),
	covYes.join(',')
);
check(
	'coverage checklist keeps absent capabilities visible as ✗',
	(await page.locator('.bn-cov--no').count()) > 0
);

// Detail card of a slotted character offers removal; a fifth character sees "full"
await page.locator('.tb-tile', { hasText: 'Bennett' }).first().locator('.tb-tile-open').click();
await page.locator('.dc-panel').waitFor({ timeout: 5000 });
check(
	'slotted character card shows in-team state',
	/In team/.test(await page.locator('.dc-team').innerText())
);
await page.keyboard.press('Escape');
await page.locator('.tb-tile', { hasText: 'Furina' }).first().locator('.tb-tile-open').click();
await page.locator('.dc-panel').waitFor({ timeout: 5000 });
check('full team disables adding a fifth', await page.locator('.dc-team').isDisabled());
await page.keyboard.press('Escape');

// URL round-trip: cold load with ?team= restores the slots
await page.goto(`${BASE}/team-builder?team=bennett,jean,diona,gorou`, {
	waitUntil: 'networkidle'
});
check(
	'?team= cold load restores four slots',
	(await page.locator('.bn-slot--filled').count()) === 4
);
await page.screenshot({ path: 'probe-team-builder-team.png', fullPage: false });

// ── 7b. Audition: pin the incumbent, pre-seed the Source, commit a swap ─────
// Bennett holds slot 0 — audition replacements for him from the Bench.
await page.locator('.bn-act--audition').first().click();
await page.locator('.tb-stage .cmp-panel').waitFor({ timeout: 5000 });
await page.locator('.cmp-chip--anchor').first().waitFor({ timeout: 5000 });
check(
	'audition docks Compare into the Stage with the incumbent anchored',
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
check(
	'audition pre-seeds the Source with the incumbent’s facets',
	(await page.locator('.tb-chip.active').count()) > 0,
	`active chips=${await page.locator('.tb-chip.active').count()}`
);
// Clear the seed to browse the full roster, then add a candidate to the audition.
await page.locator('.tb-clear').click();
const furina = page.locator('.tb-grid').first().locator('.tb-tile', { hasText: 'Furina' }).first();
await furina.locator('.tb-tile-act--compare').dispatchEvent('click');
await page.locator('.cmp-chip-commit').first().waitFor({ timeout: 5000 });
check(
	'a candidate joins the audition with a commit control',
	(await page.locator('.cmp-chip-commit').count()) >= 1
);
// Commit Furina → she replaces Bennett in slot 0 and the Stage closes.
await page.locator('.cmp-chip-commit').first().click();
await page.locator('.cmp-panel').waitFor({ state: 'detached', timeout: 5000 });
check('committing an audition closes the Stage', (await page.locator('.cmp-panel').count()) === 0);
const auditionedNames = await page.locator('.bn-slot--filled .sp-char-name').allInnerTexts();
check(
	'committing swaps the slot (Furina replaces Bennett)',
	auditionedNames.includes('Furina') && !auditionedNames.includes('Bennett'),
	auditionedNames.join(',')
);
check(
	'the swap is mirrored to ?team=',
	page.url().includes('furina') && !/\bbennett\b/.test(page.url()),
	page.url()
);
await page.screenshot({ path: 'probe-team-builder-audition.png', fullPage: false });

await page.locator('.bn-clear').click();
check('clear team empties slots', (await page.locator('.bn-slot--empty').count()) === 4);
check('clear team strips the URL param', !page.url().includes('team='), page.url());

// ── 8. Cross-injection: TB → planner → TB round trip ───────────────────────
// TB → planner: strip link carries the team; planner consumes ?team= into slots.
await page.goto(`${BASE}/team-builder?team=bennett,jean,diona,gorou`, {
	waitUntil: 'networkidle'
});
const plannerHref = await page.locator('.bn-send').getAttribute('href');
check(
	'team strip links to the planner with the team',
	plannerHref === '/rotation-planner?team=bennett,jean,diona,gorou',
	plannerHref
);
await page.locator('.bn-send').click();
await page.locator('.sp-char-name').first().waitFor({ timeout: 10000 });
const plannerNames = await page.locator('.sp-char-name').allInnerTexts();
check(
	'planner slots populated from ?team=',
	['Bennett', 'Jean', 'Diona', 'Gorou'].every((n) => plannerNames.includes(n)),
	plannerNames.join(',')
);
check('planner strips ?team= after consuming it', !page.url().includes('team='), page.url());

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
	(await page.locator('.cs-char-card').count()) > 100,
	String(await page.locator('.cs-char-card').count())
);
check(
	'the current team shows as selected in the overlay (4 slot badges)',
	(await page.locator('.cs-slot-badge').count()) === 4,
	String(await page.locator('.cs-slot-badge').count())
);
// Live edit: deselecting a selected card frees a slot immediately (no Confirm).
await page.locator('.cs-char-card--selected').first().click();
check(
	'deselecting in the overlay frees a slot live (3 badges)',
	(await page.locator('.cs-slot-badge').count()) === 3,
	String(await page.locator('.cs-slot-badge').count())
);
// Re-add Bennett (alphabetically first) so the hand-off carries the full four.
await page.locator('.cs-char-card', { hasText: 'Bennett' }).first().click();
check(
	're-adding refills the slot (4 badges)',
	(await page.locator('.cs-slot-badge').count()) === 4
);
await page.locator('.cs-close-btn').click();
check('close button dismisses the overlay', (await page.locator('.cs-panel').count()) === 0);
check(
	'"Explore alternatives →" is tied to the picker (absent from the main surface)',
	(await page.locator('.rp-explore-link').count()) === 0
);

// Re-open the picker — the Explore hand-off docks in the label column beneath
// the portraits while you're choosing team members.
await page.locator('.sp-avatar-chip').first().click();
await page.locator('.rp-explore-link').waitFor({ timeout: 5000 });
const exploreHref = await page.locator('.rp-explore-link').getAttribute('href');
check(
	'Explore alternatives → carries the whole team to the Team Builder',
	exploreHref === '/team-builder?team=bennett,jean,diona,gorou',
	exploreHref
);
await page.locator('.rp-explore-link').click();
await page.locator('.tb-source').waitFor({ timeout: 10000 });
check(
	'Team Builder receives the whole team into the slots (four filled)',
	(await page.locator('.bn-slot--filled').count()) === 4,
	String(await page.locator('.bn-slot--filled').count())
);
await page.screenshot({ path: 'probe-team-builder-explore.png', fullPage: false });

// ── 8b. Ownership ledger: mark, filter, persist ────────────────────────────
// Arriving via ?team= lands on Atlas — switch to the Roster grid to mark owners.
await page.locator('.tb-tab', { hasText: 'Roster' }).click();
await page.locator('.tb-grid').first().waitFor({ timeout: 10000 });

// Wishlist Bennett via the detail card's ownership toggle.
await page.locator('.tb-tile', { hasText: 'Bennett' }).first().locator('.tb-tile-open').click();
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
await page.locator('.tb-conmode-btn', { hasText: 'Wishlist' }).click();
const wishNames = await page.locator('.tb-grid').first().locator('.tb-tile-name').allInnerTexts();
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
await page.locator('.tb-conmode-btn', { hasText: 'All' }).click();

// Edit roster: clicking a tile toggles owned (faded ↔ full opacity).
await page.locator('.tb-edit-toggle').click();
await page.locator('.tb-tile', { hasText: 'Diona' }).first().locator('.tb-tile-open').click();
check(
	'edit-mode tile click marks the character owned',
	await page.evaluate(
		() => JSON.parse(localStorage.getItem('critcalc:ownership') ?? '{}').diona === 'owned'
	),
	''
);
check(
	'not-owned characters fade while editing',
	(await page.locator('.tb-tile--faded').count()) > 0
);
await page.locator('.tb-edit-toggle').click();

// ── 9. Screenshots + console health ────────────────────────────────────────
await page.screenshot({ path: 'probe-team-builder-grid.png', fullPage: false });
await page.locator('.tb-tile', { hasText: 'Bennett' }).first().locator('.tb-tile-open').click();
await page.locator('.dc-caps .dc-cap').first().waitFor({ timeout: 5000 });
await page.screenshot({ path: 'probe-team-builder-card.png', fullPage: false });
check('no unexpected console errors', consoleErrors.length === 0, consoleErrors.join(' | '));

await browser.close();
console.log(
	failures.length === 0 ? 'ALL CHECKS PASSED' : `${failures.length} FAILED: ${failures.join('; ')}`
);
process.exit(failures.length === 0 ? 0 : 1);
