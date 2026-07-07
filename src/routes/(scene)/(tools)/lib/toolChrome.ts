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
				'The heatmap shows the average damage multiplier — 1 + (Crit Rate × Crit Damage) — across every stat combination. Drag the marker on the chart or use the sliders to explore your build and nearby tradeoff points.',
			notes: [
				'Cool blue regions are lower average output; yellow, orange, and red-purple are higher.',
				'Dashed isolines trace equal-multiplier bands — every build on the same line has the same average output.',
				'The solid blue line traces every build sharing your total crit value (CV = 2·CR + CD). Drag along it to see where a fixed stat budget pays out best.',
				'Pin a build to freeze a second marker on the chart and eyeball a trade against it.',
				'With the no-crit risk overlay on, darker areas mean a higher chance of landing zero crits across a full rotation.'
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
