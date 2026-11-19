// Tool registry: identity per tool route — the ONE list of what this site's
// three tools are.
//
// ⚠ IT LIVES IN $lib, NOT IN THE (tools) ROUTE GROUP, and that is load-bearing
// since the nav overlay (2026-09-04). The compass in the site chrome opens a
// navigation panel on EVERY surface — the landing and the content pages
// included — and none of those are inside the tools layout, so a registry
// scoped to that route group could not reach them. `(tools)/lib/toolChrome.ts`
// re-exports every name it used to own, so no existing importer changed.
//
// The guide copy that used to live beside this is gone: it duplicated the /faq
// per-tool sections nearly sentence for sentence, and the two drifted. Help is
// one corpus in $lib/help/chapters/, rendered both at /help/<tool> and in the
// chrome's "?" overlay. Tool paths and help chapter ids are deliberately the
// same slug, which helpChapterForPath() relies on.

import { m } from '$lib/paraglide/messages';

export type ToolPath = '/visualizers' | '/planner' | '/builder';

export type ToolInfo = {
	path: ToolPath;
	/** Chrome strip title, next to the brand mark — and the nav overlay's label. */
	title: string;
	/** Compact label for the tool switcher */
	short: string;
};

// Order is the task narrative — build the team, plan its rotation, then the
// reference shelf — and matches the landing hero cards left to right. Each
// tool's send-affordance sits on the edge facing the tool it sends to.
//
// The names are getters, so each read asks the message for the current
// locale: a plain string here would be read once, at module load, and freeze
// one language for the whole prerender.
export const TOOLS: ToolInfo[] = [
	{
		path: '/builder',
		get title() {
			return m.chrome_team_builder();
		},
		get short() {
			return m.chrome_builder();
		}
	},
	{
		path: '/planner',
		get title() {
			return m.chrome_rotation_planner();
		},
		get short() {
			return m.chrome_planner();
		}
	},
	{
		path: '/visualizers',
		get title() {
			return m.chrome_visualizers();
		},
		get short() {
			return m.chrome_visualizers();
		}
	}
];
