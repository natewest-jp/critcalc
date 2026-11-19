/**
 * Paraglide's compiler options, read by both the Vite plugin (vite.config.ts)
 * and `paraglide-js compile` (the `i18n` script, which `check` runs because
 * svelte-check has no Vite). One home, so the two cannot drift.
 *
 * The locale lives in the path (`/ja/planner`), and English, the base locale,
 * has no prefix. Nothing else picks a locale: no cookie, no browser language,
 * so a shared link renders in the language of its path for every reader, and
 * the `?r=` state never carries a locale. See docs/design/i18n-plan.md §3.
 */
export default {
	outdir: './src/lib/paraglide',
	strategy: ['url', 'baseLocale'],
	// SvelteKit's own default, so the Japanese landing is `/ja`, never `/ja/`.
	trailingSlash: 'never',
	// Real files on disk rather than Vite's virtual modules, so svelte-check,
	// vitest and the build all read the same output.
	outputStructure: 'message-modules',
	emitTsDeclarations: true
};
