// Tool chrome registry: identity + help content per tool route. The chrome
// strip (in the (tools) layout) derives the title, switcher links, and the
// "?" guide overlay from this. Guide copy absorbed the old in-page intros —
// power users shouldn't spend screen real estate on reference text.

export type ToolPath = '/crit-visualizer' | '/rotation-planner' | '/team-builder';

export type ToolInfo = {
	path: ToolPath;
	/** Chrome strip title, next to the brand mark */
	title: string;
	/** Compact label for the tool switcher */
	short: string;
	help: {
		intro: string;
		notes: string[];
	};
};

// Order is the task narrative — build the team, plan its rotation, then the
// reference shelf — and matches the landing hero cards left to right. Each
// tool's send-affordance sits on the edge facing the tool it sends to.
export const TOOLS: ToolInfo[] = [
	{
		path: '/team-builder',
		title: 'Team Builder',
		short: 'Teams',
		help: {
			intro:
				'Find characters by what they can actually provide — healing, shields, off-field damage, RES shred, ally buffs — with every capability derived from curated kit data and traced to the ability (and constellation) that grants it.',
			notes: [
				'Browse by capability in the Atlas, or by identity in the Roster — the two tabs of the middle panel.',
				'The constellation switch changes what counts: C0 shows base kits, My roster uses the constellation levels you’ve saved, C6 shows everything a kit can ever do.',
				'Capability filters combine: “Heals + ATK buff” means characters that provide both.',
				'Characters whose kits aren’t curated yet are listed separately when filtering, never silently hidden — a missing badge means “unknown”, not “no”.',
				'Conditional badges (italic) depend on runtime state — open a character’s details for the exact condition.',
				'Add characters to Compare to line their ability timings up on one ruler, or send a team to the Rotation Planner to run it.'
			]
		}
	},
	{
		path: '/rotation-planner',
		title: 'Rotation Planner',
		short: 'Planner',
		help: {
			intro:
				'Write your rotation in KQM-style notation and the timeline renders its choreography — ability uptimes, cooldowns, swap connectors, and team buff windows, frame-accurate.',
			notes: [
				'The planner visualizes timing and windows; it never computes damage numbers.',
				'Type notation in the composer along the bottom edge — the timeline above redraws as you write, and autocomplete suggests each character’s action tokens.',
				'Click a team portrait to change who fills that slot; set each character’s weapon, artifact, and constellation on their portrait chips.',
				'Copy your rotation as KQM text or export the timeline as a PNG from the buttons beside the composer.',
				'Open Notes (top-right) for the caveats behind the buffs and mechanics your rotation relies on.'
			]
		}
	},
	{
		path: '/crit-visualizer',
		title: 'Visualizers',
		short: 'Visualizers',
		help: {
			intro:
				'Visualizers is a family of small graph instruments. On wide screens several sit side by side — use the dropdown above each tile to choose which instrument lives where. Your layout is remembered; Reset workspace restores the default, and ⤴ Share copies a link that reopens an instrument exactly as it looks.',
			notes: [
				'Crit Heatmap — the average damage multiplier, 1 + (Crit Rate × Crit Damage), across every stat combination. Drag the marker or use the sliders; cool blue is lower output, yellow through red-purple higher.',
				'Dashed lines mark builds with the same average damage; the solid equal-budget line traces every build sharing your total crit value (CV = 2·CR + CD) — drag along it to see where a fixed stat budget pays out best.',
				'Pin a build to freeze a second marker and eyeball a trade against it. The no-crit risk overlay darkens regions where a whole rotation can land zero crits — and "Roll it" samples your rotation for real, so you can watch how often the coin flips betray the average.',
				'ICD Timeline — which hits of an attack string actually apply their element. Standard ICD allows an application every 2.5 seconds or every 3rd hit; the 3-hit rule does not reset the 2.5s timer, which is why application patterns look irregular.',
				'Faster attack strings do not mean proportionally more elemental application — watch the application rate as you drag the hit interval. "Send to Gauge Explorer" carries the applying hits across.',
				'Artifact Rolls — the real odds behind 5★ artifact farming, from datamined weights. Fresh Drop: how rare your target substat pair is; Upgrade Rolls: the exact crit-value distribution a piece can reach at +20; Reshape: what the Dust of Enlightenment guarantee actually does to the odds.',
				'The reshape guarantee is modeled as a conditional redistribution (at least N rolls into the selected pair, other outcomes renormalized) — the exact in-game implementation is not publicly documented. Sanctifying Elixir crafts skip the substat draw entirely and, since 5.5, guarantee at least 2 upgrade rolls into the crafted pair — the Elixir-crafted mode in Upgrade Rolls shows what that buys.',
				'Appraise — dial in a real +20 piece’s substat values and see exactly where it sits on its outcome distribution. The value wheels only offer numbers the game can actually display; roll counts are inferred from them (float32-faithful, cross-validated against the Genshin Optimizer), and the Reshape view picks up the appraised piece automatically.',
				'Gauge Explorer — how elemental auras live and die. Build a sequence of applications and watch the gauge decay, the 0.8× aura tax, and how each reaction consumes aura at its own rate (×2 forward vape/melt, ×0.5 reverse, ×0.5 swirl/crystallize, 1:1 the rest, 2:1 for bloom). Mechanics follow KQM gauge theory cross-checked against gcsim.',
				'The strip under the gauge chart shows which aura icons hang over the enemy at any moment — press play to watch the gauges drain (slow-motion speeds are a chip away), or drag the paused playhead to read exact values. Single target only: swirl spreading, shatter (blunt hits), and what happens to Dendro Cores after they spawn are out of scope.',
				'Reaction Curves — how reaction payouts scale with Elemental Mastery. Each family rides a different EM curve: amplifying 2.78·EM/(1400+EM), transformative 16·EM/(2000+EM), additive 5·EM/(1200+EM), crystallize 4.44·EM/(1400+EM). Hover or slide to compare; level multipliers come from the community-datamined table (characters cap at 90).',
				'Curve values are before enemy RES and exclude +% reaction bonuses (4pc Crimson Witch, character passives). Transformative damage cannot crit; additive flat damage joins the hit and crits with it.',
				'Enemy DEF & RES — the two hidden multipliers every hit passes through. DEF: your level against the enemy’s sets a baseline cut (equal levels already cost you half), and shred/ignore claw it back. RES: most enemies resist 10%; shred subtracts from it.',
				'Pushing RES below 0% still pays, but each negative point only counts half — exactly why 4pc Viridescent Venerer over-delivers on a 10%-RES enemy. Above 75% the curve flattens into deep diminishing returns.',
				'Wish Odds — which pull actually lands the featured 5★, from your current pity and guarantee state. The filled shape is "which pull gets it", the line is your cumulative chance, and the marker is your saved pulls — drag it.',
				'Pity model: 0.6% flat until soft pity ramps from pull 74 (weapons: 0.7% ramping from 63). Featured odds use the OFFICIAL consolidated rates (55% character incl. Capturing Radiance, 37.5% charted weapon, 1 fate point) — the Radiance streak counter is not fully datamined and is deliberately not guessed at.',
				'Damage Anatomy — your hit assembled as a living equation. Enter your real sheet numbers; each term shows its multiplier, and box WIDTH shows how much that bucket moves the hit (a ×2 box is the same width wherever it comes from — feeding a wide box barely widens it).',
				'Direct hits stay relative ("×8.1 vs a bare hit" — the game owns your real numbers). Additive chunks and transformative damage print exactly, because their formulas are complete without talents. "What the next roll buys" applies average 5★ substat rolls to YOUR sheet.'
			]
		}
	}
];
