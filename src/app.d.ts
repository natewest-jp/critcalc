// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	/** The year the site was built, inlined by Vite's `define` — see vite.config.ts
	 *  for why the footer must not read the clock at runtime. */
	const __BUILD_YEAR__: number;

	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
