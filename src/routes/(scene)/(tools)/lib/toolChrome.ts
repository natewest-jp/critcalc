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

export const TOOLS: ToolInfo[] = [
	{
		path: '/crit-visualizer',
		title: 'Visualizers',
		short: 'Visualizers',
		help: {
			intro:
				'Visualizers is a family of small graph instruments. On wide screens several sit side by side — use the chips above each tile to choose which instrument lives where.',
			notes: [
				'Crit Heatmap — the average damage multiplier, 1 + (Crit Rate × Crit Damage), across every stat combination. Drag the marker or use the sliders; cool blue is lower output, yellow through red-purple higher.',
				'Dashed isolines trace equal-multiplier bands; the solid blue line traces every build sharing your total crit value (CV = 2·CR + CD) — drag along it to see where a fixed stat budget pays out best.',
				'Pin a build to freeze a second marker and eyeball a trade against it. The no-crit risk overlay darkens regions where a full rotation can land zero crits.',
				'ICD Timeline — which hits of an attack string actually apply their element. Standard ICD allows an application every 2.5 seconds or every 3rd hit; the 3-hit rule does not reset the 2.5s timer, which is why application patterns look irregular.',
				'Faster attack strings do not mean proportionally more elemental application — watch the application rate as you drag the hit interval.',
				'Artifact Rolls — the real odds behind 5★ artifact farming, from datamined weights. Fresh Drop: how rare your target substat pair is; Upgrade Rolls: the exact crit-value distribution a piece can reach at +20; Reshape: what the Dust of Enlightenment guarantee actually does to the odds.',
				'The reshape guarantee is modeled as a conditional redistribution (at least N rolls into the selected pair, other outcomes renormalized) — the exact in-game implementation is not publicly documented.'
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
				'Use the character panels below the timeline for ability timing reference.'
			]
		}
	},
	{
		path: '/team-builder',
		title: 'Team Builder',
		short: 'Teams',
		help: {
			intro:
				'Side-by-side character kit comparison is planned here — a reference surface for studying kits before placing them on a timeline.',
			notes: []
		}
	}
];
