/**
 * scripts/probe-team-builder.mjs
 *
 * Headless verification of the Team Builder Layer 1 surface against a served
 * build (default http://localhost:4998). Drives: roster grid render, capability
 * facet filtering (AND semantics), the uncurated bucket, constellation modes
 * (C0 / My roster / C6), detail-card lazy load + provenance + constellation
 * stepper persistence.
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

// ── 1. Cold load: full roster grid ─────────────────────────────────────────
await page.goto(`${BASE}/team-builder`, { waitUntil: 'networkidle' });
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
	'bucket holds the uncurated stubs (~15)',
	stubTiles >= 10 && stubTiles <= 20,
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
await page.locator('.tb-tile', { hasText: 'Gorou' }).first().click();
await page.locator('.dc-panel').waitFor({ timeout: 5000 });
await page.locator('.dc-caps .dc-cap').first().waitFor({ timeout: 5000 });
check(
	'detail card lazy-loads the character chunk',
	chunkRequests.length > 0,
	'no chunk request seen'
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
// Dori graduated to a C0 healer when her Q heal was authored (2026-07-12);
// Gaming's C1 self-heal is the remaining con-gated negative case.
check(
	'My roster mode: C-gated healers still absent (Gaming C1)',
	!mineNames.includes('Gaming'),
	''
);

// Persistence across reload
await page.reload({ waitUntil: 'networkidle' });
await facetChip('Heals').click();
await page.locator('.tb-conmode-btn', { hasText: 'My roster' }).click();
const reloadNames = await page.locator('.tb-grid').first().locator('.tb-tile-name').allInnerTexts();
check('constellation survives reload (Gorou still matches)', reloadNames.includes('Gorou'), '');

// ── 6. Compare: tray, aligned view, remove/close ───────────────────────────
await facetChip('Heals').click(); // clear facet → full grid
const addToCompare = async (name) => {
	const tile = page.locator('.tb-tile', { hasText: name }).first();
	await tile.hover();
	await tile.locator('.tb-tile-cmp').click();
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
	(await page.locator('.ts-slot--empty').count()) === 4
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
	(await page.locator('.ts-slot--filled').count()) === 1
);
check('?team= mirrors the slot state', page.url().includes('team=bennett'), page.url());
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
	(await page.locator('.ts-slot--filled').count()) === 4
);
await page.screenshot({ path: 'probe-team-builder-team.png', fullPage: false });
await page.locator('.ts-clear').click();
check('clear team empties slots', (await page.locator('.ts-slot--empty').count()) === 4);
check('clear team strips the URL param', !page.url().includes('team='), page.url());

// ── 8. Cross-injection: TB → planner → TB round trip ───────────────────────
// TB → planner: strip link carries the team; planner consumes ?team= into slots.
await page.goto(`${BASE}/team-builder?team=bennett,jean,diona,gorou`, {
	waitUntil: 'networkidle'
});
const plannerHref = await page.locator('.ts-planner-link').getAttribute('href');
check(
	'team strip links to the planner with the team',
	plannerHref === '/rotation-planner?team=bennett,jean,diona,gorou',
	plannerHref
);
await page.locator('.ts-planner-link').click();
await page.locator('.rp-char-name').first().waitFor({ timeout: 10000 });
const plannerNames = await page.locator('.rp-char-name').allInnerTexts();
check(
	'planner slots populated from ?team=',
	['Bennett', 'Jean', 'Diona', 'Gorou'].every((n) => plannerNames.includes(n)),
	plannerNames.join(',')
);
check('planner strips ?team= after consuming it', !page.url().includes('team='), page.url());

// Planner → TB: selector's per-slot replace link, capability filters pre-seeded.
await page.locator('.rp-avatar-chip').first().click();
await page.locator('.cs-panel').waitFor({ timeout: 5000 });
const replaceHref = await page.locator('.cs-slot-replace').first().getAttribute('href');
check(
	'selector replace link carries outgoing char + rest of team',
	replaceHref === '/team-builder?replace=bennett&team=jean,diona,gorou',
	replaceHref
);
await page.locator('.cs-slot-replace').first().click();
await page.locator('.tb-grid').first().waitFor({ timeout: 10000 });
check(
	'replace hand-off shows the pre-seed note',
	/Replacing/.test(await page.locator('.tb-replace-note').innerText())
);
const seeded = await page.locator('.tb-chip.active').allInnerTexts();
check(
	'capability filters pre-seeded from Bennett (Heals + ATK buff)',
	// innerText arrives capitalized (chip CSS text-transform) — compare lowercased.
	seeded.some((t) => t.toLowerCase() === 'heals') &&
		seeded.some((t) => t.toLowerCase() === 'atk buff'),
	seeded.join(',')
);
check(
	'rest of the team arrives in the slots (three filled)',
	(await page.locator('.ts-slot--filled').count()) === 3
);
check('replace param stripped after consuming', !page.url().includes('replace='), page.url());
const replacementNames = await page
	.locator('.tb-grid')
	.first()
	.locator('.tb-tile-name')
	.allInnerTexts();
check(
	'grid filtered to heal+ATK-buff providers (Bennett-shaped)',
	replacementNames.includes('Bennett') && replacementNames.length < 15,
	`${replacementNames.length}: ${replacementNames.slice(0, 6).join(',')}`
);
await page.screenshot({ path: 'probe-team-builder-replace.png', fullPage: false });

// ── 8b. Ownership ledger: mark, filter, persist ────────────────────────────
await page.locator('.tb-clear').click(); // clear the replace pre-seed → full grid

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

// Edit roster reveals the interactive ownership pips on every tile.
await page.locator('.tb-edit-toggle').click();
check('edit roster reveals ownership pips', (await page.locator('.tb-tile-own--btn').count()) > 5);
await page.locator('.tb-edit-toggle').click();

// ── 9. Screenshots + console health ────────────────────────────────────────
await page.screenshot({ path: 'probe-team-builder-grid.png', fullPage: false });
await page.locator('.tb-tile', { hasText: 'Bennett' }).first().click();
await page.locator('.dc-caps .dc-cap').first().waitFor({ timeout: 5000 });
await page.screenshot({ path: 'probe-team-builder-card.png', fullPage: false });
check('no unexpected console errors', consoleErrors.length === 0, consoleErrors.join(' | '));

await browser.close();
console.log(
	failures.length === 0 ? 'ALL CHECKS PASSED' : `${failures.length} FAILED: ${failures.join('; ')}`
);
process.exit(failures.length === 0 ? 0 : 1);
