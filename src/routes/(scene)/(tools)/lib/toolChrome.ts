// ↻ MOVED TO $lib/tools.ts (2026-09-04, the chrome compass round).
//
// The registry had to leave this route group: the nav overlay renders on the
// landing and the content pages too, and neither is inside the (tools) layout.
// Re-exported here so every existing importer is untouched — the same courtesy
// the sim façade pays its 22 consumers.
export { TOOLS, type ToolInfo, type ToolPath } from '$lib/tools';
