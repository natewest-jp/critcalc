<!--
  A message with markup in it (`{#value}never{/value}`), rendered as real
  elements. The caller says what each tag becomes with a snippet, which is
  given the tag's text, so the element keeps the caller's own scoped styles:

    <Msg parts={m.settings_last_backup.parts({ when })} tags={{ value }} />
    {#snippet value(text: string)}<strong class="sp-value">{text}</strong>{/snippet}

  Markup is how a translator moves the bold words: a sentence split around a
  <strong> could not be reordered. ⛔ Not `{@html}`: a message is text, and a
  tag the caller did not name renders as its plain text. Tags don't nest.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { MessagePart } from '$lib/paraglide/runtime';

	let { parts, tags }: { parts: MessagePart[]; tags: Record<string, Snippet<[string]>> } = $props();

	type Run = { text: string; tag?: string };
	const runs = $derived.by(() => {
		const out: Run[] = [];
		let open: Run | null = null;
		for (const p of parts) {
			if (p.type === 'text') {
				if (open) open.text += p.value;
				else out.push({ text: p.value });
			} else if (p.type === 'markup-start') {
				open = { text: '', tag: p.name };
				out.push(open);
			} else if (p.type === 'markup-end') open = null;
		}
		return out;
	});
</script>

{#each runs as run, i (i)}{#if run.tag && tags[run.tag]}{@render tags[run.tag](
			run.text
		)}{:else}{run.text}{/if}{/each}
