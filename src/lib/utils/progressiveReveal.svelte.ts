/** Time-sliced list mounting for roster-scale grids.
 *
 * Mounting ~122 CharacterCards synchronously is a long main-thread task in
 * every browser (~100ms in Chrome, and a multiple of that under Safari 26.x's
 * sibling-formatting-context layout bug). The first `initial` items cover the
 * viewport; the rest stream in `step`-sized rAF batches below the fold, so the
 * grid paints on the first frame and the page never blocks. Browser-agnostic
 * time-slicing — keep regardless of Safari's fix schedule.
 *
 * Usage (component init):
 *   const reveal = createProgressiveReveal();
 *   $effect(() => { reveal.target = filtered.length; });
 *   const shown = $derived(filtered.slice(0, reveal.limit));
 *
 * `limit` only ever grows — once the full roster has streamed in, later
 * filter changes render whole in one pass, exactly as before.
 */
export function createProgressiveReveal(initial = 36, step = 18) {
	let limit = $state(initial);
	let target = $state(initial);

	$effect(() => {
		if (limit >= target) return;
		const id = requestAnimationFrame(() => {
			limit = Math.min(limit + step, target);
		});
		return () => cancelAnimationFrame(id);
	});

	return {
		get limit() {
			return limit;
		},
		get target() {
			return target;
		},
		set target(v: number) {
			if (v > target) target = v;
		}
	};
}
