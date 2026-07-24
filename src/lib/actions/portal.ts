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
	document.body.appendChild(node);
	return {
		destroy() {
			node.remove();
		}
	};
}
