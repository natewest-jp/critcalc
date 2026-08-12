<script lang="ts">
	// Nate's close mark (assets-src/tools/close.svg), built like the three chrome
	// glyphs: the X is a HOLE in the disc (evenodd), so ONE path takes
	// currentColor and needs no mask. Inline rather than an <img> so it inherits
	// color and can't 404 on a prerendered page.
	//
	// Hover/focus brightening is fill-opacity on the glyph, never opacity on the
	// element and never a glow — the WebKit + no-hover-glow laws (/styleguide).
	// The host owns the hit target; this owns the mark. Size via --close-mark-size.

	let { size = '28px' }: { size?: string } = $props();
</script>

<svg
	class="close-mark"
	style:--close-mark-size={size}
	viewBox="0 0 56 56"
	fill-rule="evenodd"
	aria-hidden="true"
	><path
		d="M28,0C43.454,0 56,12.546 56,28C56,43.454 43.454,56 28,56C12.546,56 0,43.454 0,28C0,12.546 12.546,0 28,0ZM30.782,28.021C30.782,27.807 31.831,26.686 33.93,24.659C36.028,22.632 37.077,21.454 37.077,21.125C37.077,20.796 36.798,20.366 36.239,19.836C35.681,19.306 35.219,19.041 34.854,19.041C34.488,19.041 33.285,20.062 31.244,22.103C29.203,24.144 28.115,25.164 27.979,25.164C27.842,25.164 26.747,24.136 24.691,22.081C22.636,20.026 21.458,18.998 21.157,18.998C20.856,18.998 20.416,19.27 19.836,19.814C19.256,20.359 18.966,20.799 18.966,21.136C18.966,21.472 19.997,22.672 22.06,24.734C24.122,26.797 25.153,27.893 25.153,28.021C25.153,28.15 24.115,29.253 22.038,31.33C19.961,33.407 18.923,34.56 18.923,34.789L18.923,35.111C18.923,35.255 19.209,35.595 19.782,36.132C20.355,36.669 20.813,36.937 21.157,36.937C21.501,36.937 22.693,35.917 24.734,33.876C26.775,31.835 27.842,30.814 27.936,30.814C28.029,30.814 29.139,31.846 31.266,33.908C33.393,35.971 34.603,37.002 34.896,37.002C35.19,37.002 35.62,36.726 36.186,36.175C36.751,35.623 37.034,35.187 37.034,34.864C37.034,34.542 35.992,33.339 33.908,31.255C31.824,29.171 30.782,28.093 30.782,28.021Z"
	/></svg
>

<style>
	.close-mark {
		width: var(--close-mark-size);
		height: var(--close-mark-size);
		flex: none;
		fill: currentColor;
		fill-opacity: 0.85;
		transition: fill-opacity var(--t-quick);
	}

	/* :global — the states live on the host BUTTON, which is the consumer's. */
	:global(button:hover) > .close-mark,
	:global(button:focus-visible) > .close-mark {
		fill-opacity: 1;
	}

	/* (A reduced-motion block stood here. Retired 2026-08-12 with the fold onto
	   --t-quick — the band is zeroed at :root under the same query.) */
</style>
