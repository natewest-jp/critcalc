/**
 * Portal a node to <body>, lifting it to the root stacking context so
 * viewport-fixed popovers clear ANY host stacking context (sticky panels,
 * transformed ancestors). The compiled Svelte scope class rides along, so
 * scoped styles still apply. Actions only run in the browser; render the
 * portaled node only while open.
 *
 * Extracted verbatim from SlotPortrait.svelte for reuse (InstrumentPicker).
 */
export function portal(node: HTMLElement) {
	// Theming zone rides along too. --accent is ZONED (app.css): gilt outside
	// the portal, dire inside a tool, scoped by .tool-shell ancestry. Appending
	// to <body> severs that ancestry, so a tool popover would silently flip to
	// the gilt accent. Read the zone BEFORE the move, stamp it after. One choke
	// point covers every portalled surface, present and future.
	const inTool = !!node.closest('.tool-shell');
	document.body.appendChild(node);
	if (inTool) node.dataset.zone = 'tool';
	return {
		destroy() {
			node.remove();
		}
	};
}
