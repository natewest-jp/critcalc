// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	/** The year the site was built, inlined by Vite's `define` — see vite.config.ts
	 *  for why the footer must not read the clock at runtime. */
	const __BUILD_YEAR__: number;
	/** The build's short commit SHA and date (`abde521d · 2026-10-15`), inlined
	 *  by Vite's `define` — see vite.config.ts. Read by $lib/feedback.ts. */
	const __BUILD_ID__: string;

	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		interface PageState {
			/** The library overlay is open (lib/library.svelte.ts) — a shallow
			 *  history entry, so Back closes it. */
			library?: boolean;
			/** The menu state's section (lib/menuState.svelte.ts) — a shallow
			 *  entry at the section's own address, so the tool stays mounted. */
			menu?: import('$lib/menuState.svelte').Section;
			/** How many section entries this visit pushed, so leaving goes
			 *  back over all of them at once. */
			menuDepth?: number;
			/** Teams' details for one team (its id), or `'new'` for a team
			 *  being made — an entry over Teams, so Back returns to the cards. */
			teamDetail?: string;
			/** The slot the details open on (a portrait clicked on a card). */
			teamSlot?: number;
			/** A guard entry over a team's details with unsaved changes:
			 *  Back pops it and the details ask before dropping the draft. */
			teamGuard?: boolean;
		}
		// interface Platform {}
	}
}

export {};
