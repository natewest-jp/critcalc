<!-- Help area, FAQ chapter. The chapter component is imported STATICALLY so this
	 route prerenders with its content in the HTML; the chrome overlay renders the
	 same component lazily instead (see $lib/help/areas.ts). -->
<script lang="ts">
	import HelpAreaShell from '$lib/components/HelpAreaShell.svelte';
	import { HELP_AREA } from '$lib/help/areas';
	import Chapter from '$lib/help/chapters/Faq.svelte';
</script>

<HelpAreaShell area={HELP_AREA} chapter="faq" chapterComponent={Chapter} />
