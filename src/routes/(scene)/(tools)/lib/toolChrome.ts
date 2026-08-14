// Tool registry: identity per tool route. The chrome strip (in the (tools)
// layout) derives its title and switcher links from this.
//
// The guide copy that used to live here is gone: it duplicated the /faq
// per-tool sections nearly sentence for sentence, and the two drifted. Help is
// now one corpus in $lib/help/chapters/, rendered both at /help/<tool> and in
// the chrome's "?" overlay. The overlay opens at the current tool's chapter —
// tool paths and help chapter ids are deliberately the same slug, which
// helpChapterForPath() relies on.

export type ToolPath = '/visualizers' | '/rotation-planner' | '/team-builder';

export type ToolInfo = {
	path: ToolPath;
	/** Chrome strip title, next to the brand mark */
	title: string;
	/** Compact label for the tool switcher */
	short: string;
};

// Order is the task narrative — build the team, plan its rotation, then the
// reference shelf — and matches the landing hero cards left to right. Each
// tool's send-affordance sits on the edge facing the tool it sends to.
export const TOOLS: ToolInfo[] = [
	{ path: '/team-builder', title: 'Team Builder', short: 'Teams' },
	{ path: '/rotation-planner', title: 'Rotation Planner', short: 'Planner' },
	{ path: '/visualizers', title: 'Visualizers', short: 'Visualizers' }
];
