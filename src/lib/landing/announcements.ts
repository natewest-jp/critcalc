// Landing announcements — the "is this current?" signal.
//
// ⚓ The first question a Genshin player asks about any tool is whether it is
// updated for the current patch, and nothing on the site used to answer it.
// So this is a TRUST signal, not a news feed, and it has one hard rule
// (memory `project_landing_card_round`): it renders ONLY while there is
// something current. An empty slot is worse than none, and a stale one
// ("New: 7.0 support!" in November) actively signals abandonment — so every
// entry carries its own expiry, and the failure mode is that NOTHING shows,
// never that something stale does.
//
// Copy is draft until Nate's wording pass. Dates are ISO, local-midnight.

export interface Announcement {
	id: string;
	/** The one line the banner shows. */
	text: string;
	/** Small, after the text — when this became true. */
	since: string;
	/** The banner stops showing this entry at local midnight on this date. */
	expires: string;
	href?: string;
}

export const ANNOUNCEMENTS: readonly Announcement[] = [
	{
		id: 'current-7-0',
		text: 'Data current to Genshin Impact 7.0',
		since: '2026-09-16',
		expires: '2026-10-28'
	}
];

/** The entries still live at `now` — an expiry is exclusive of its own day. */
export function currentAnnouncements(now: Date = new Date()): Announcement[] {
	return ANNOUNCEMENTS.filter((a) => now < new Date(`${a.expires}T00:00:00`));
}

/** `2026-09-16` → `Sep 16, 2026`, for the banner's date. */
export function formatSince(iso: string): string {
	return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', {
		day: 'numeric',
		month: 'short',
		year: 'numeric'
	});
}
