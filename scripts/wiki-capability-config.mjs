/**
 * scripts/wiki-capability-config.mjs
 *
 * Shared configuration for the wiki capability sweep — the category menu,
 * category→CapabilityKind mapping with direction semantics, manual title
 * resolutions, and the verified-wrong suppression list. Consumed by
 * fetch-wiki-capabilities.mjs (network side) and audit-capability-sweep.mjs
 * (offline diff). Keeping triage results here — in reviewed code, not in the
 * machine-written snapshot — is deliberate: the snapshot can be refetched
 * wholesale without losing human decisions.
 *
 * Source: the Genshin Impact Fandom wiki's "Talents by Function" /
 * "Constellations by Function" category taxonomy (enumerated 2026-07-28).
 * Category names verified to exist at fetch time; the fetch script reports
 * any that have gone missing (wiki renames happen).
 */

export const WIKI_API = 'https://genshin-impact.fandom.com/api.php';
export const USER_AGENT = 'critcalc-curation/1.0 (capability sweep; repo natewest-jp/critcalc)';

/**
 * Direction semantics per group:
 *   missing — wiki attributes the capability, we derive nothing:
 *     'finding'   near-1:1 category → top-priority report section
 *     'candidate' wiki category is a superset of our kind (e.g. Energy
 *                 Generation includes particle talents; our `energy` effect is
 *                 flat energy only) → appendix, judgment required
 *   extra — we derive it, wiki doesn't list it:
 *     'finding'   possible over-derivation OR a wiki gap — both worth a look
 *     'off'       not checked
 *
 * `recurse: true` — the category is a container of subcategories (per-element
 * RES reduction); fetch expands one level and records leaf membership so the
 * sweep can cross-check resShred element details.
 *
 * `special` — not a talent→kind diff:
 *   'revival'    no revive primitive (Tier-2 freeze): check the matched source
 *                carries a heal capability or a revival caveat/_curatorNotes
 *   'characters' members are character pages, not talents (Off-Field
 *                Characters) — informational diff vs the editorial roles CSV
 */
export const CATEGORY_GROUPS = [
	{
		kind: 'heal',
		categories: [{ name: 'Healing Talents' }, { name: 'Healing Constellations' }],
		missing: 'finding',
		extra: 'finding'
	},
	{
		kind: 'shield',
		categories: [{ name: 'Shield Talents' }, { name: 'Shield Constellations' }],
		missing: 'finding',
		extra: 'finding'
	},
	{
		kind: 'resShred',
		categories: [
			{ name: 'RES Reduction Talents', recurse: true },
			{ name: 'RES Reduction Constellations', recurse: true },
			{ name: 'DEF Reduction Talents' },
			{ name: 'DEF Reduction Constellations' }
		],
		missing: 'finding',
		extra: 'finding'
	},
	{
		kind: 'taunt',
		categories: [{ name: 'Taunting Talents' }],
		missing: 'finding',
		extra: 'finding'
	},
	{
		// The wiki's term for pull/gather effects — exactly our `grouping` tag
		// (Venti Q, Kazuha E, Sucrose, Faruzan). NOT the broader crowd-control
		// umbrella (Category:Crowd Control Talents is a redirect).
		kind: 'grouping',
		categories: [{ name: 'Vacuum Field Talents' }],
		missing: 'finding',
		extra: 'finding'
	},
	{
		// Wiki includes self-infusions (Diluc, Cyno, …); our infuse capability is
		// only authored where the tools need it. Absence-in-wiki of one of OUR
		// infusions is the red flag; wiki-has is appendix material.
		kind: 'infuse',
		categories: [
			{ name: 'Elemental Infusion Talents' },
			{ name: 'Elemental Infusion Constellations' }
		],
		missing: 'candidate',
		extra: 'finding'
	},
	{
		// Facet-level capability (buff detail 'interruptionRes'), absent from the
		// expectations fixture — this is its first external cross-check. Wiki
		// includes self-only IR, so missing is candidate-grade.
		kind: 'interruptionRes',
		categories: [
			{ name: 'Interruption Resistance Talents' },
			{ name: 'Interruption Resistance Constellations' }
		],
		missing: 'candidate',
		extra: 'finding'
	},
	{
		// Wiki energy taxonomy is split: "Energy Generation *" is mostly particle
		// generation; flat energy regen lives in plain "Energy Talents"/"Energy
		// Constellations" (verified 2026-07-28: Stormeye, Gleeful Songs, A
		// Lingering Flavor). Our `energy` effect is flat/team energy only, so all
		// four feed wiki-presence; missing stays candidate-grade (superset).
		// NOT recursed — "Energy Cost N"/"Energy Recharge" subcats are unrelated.
		kind: 'energy',
		categories: [
			{ name: 'Energy Generation Talents' },
			{ name: 'Energy Generation Constellations' },
			{ name: 'Energy Talents' },
			{ name: 'Energy Constellations' },
			{ name: 'Energy Other Talents' },
			{ name: 'Energy Other Constellations' }
		],
		missing: 'candidate',
		extra: 'finding'
	},
	{
		kind: 'revival',
		special: 'revival',
		categories: [{ name: 'Revival Talents' }, { name: 'Revival Constellations' }]
	},
	{
		kind: 'offField',
		special: 'characters',
		categories: [{ name: 'Off-Field Characters' }]
	}
];

/** Every category name the fetch script must retrieve (flat). */
export const ALL_CATEGORIES = CATEGORY_GROUPS.flatMap((g) => g.categories);

/**
 * Manual resolutions for wiki titles the automatic ladder (unique ability-name
 * match → talent-page infobox fetch) can't place. Value is either
 *   { charId, abilityId? }  — resolve to this character (abilityId when known)
 *   'ignore'                — not applicable to the corpus (note why)
 * Keyed by exact wiki page title.
 */
export const TITLE_OVERRIDES = new Map([
	// Wonderland Manekin (event-only companion, not a playable roster character)
	['Combat Readiness', 'ignore']
]);

/**
 * Findings verified WRONG on the wiki side (or verified-fine on ours), with
 * evidence. Same contract as GDB_CD_KNOWN_WRONG in audit-genshin-db-diff.mjs:
 * suppressed findings still print, collapsed under "Suppressed (verified)",
 * so this list is itself auditable. RE-VERIFY entries if the snapshot is
 * refetched after a major game patch.
 *
 * Key: `${charId}|${kind}|${direction}` where direction ∈ 'missing'|'extra',
 * or `${charId}|role|${function}` for role-axis suppressions.
 */
export const WIKI_KNOWN_WRONG = new Map([
	// (populated during Phase 2 finding triage)
]);
