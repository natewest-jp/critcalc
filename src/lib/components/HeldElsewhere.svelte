<!--
  The two-tab rule's notice (design §13.3): the document on screen is held by
  another browser tab, so this one is not saving it. "Edit here" takes it.
  ⏭ Interim, until the new bars give the editor a real read-only view (2b);
  its strings are working copy for Nate to rule on.
-->
<script lang="ts">
	let { onEditHere }: { onEditHere: () => void } = $props();
</script>

<div class="held ctx-glass" role="status">
	<span class="held-text">Open in another tab. Changes here aren’t saved.</span>
	<button type="button" class="btn btn--sm btn--primary" onclick={onEditHere}> Edit here </button>
</div>

<style>
	.held {
		position: fixed;
		left: 50%;
		bottom: 1.25rem;
		transform: translateX(-50%);
		z-index: 60;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem 0.5rem 0.5rem 0.875rem;
		border-radius: 999px;
		max-width: calc(100vw - 2rem);
	}

	.held-text {
		font-size: 0.8125rem;
		color: var(--text);
	}
</style>
