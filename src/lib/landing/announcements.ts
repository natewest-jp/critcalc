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

import { inTheWorks } from '$lib/data/characterIndex.generated';

export interface Announcement {
	id: string;
	/** The headline — the fact. */
	text: string;
	/** One quieter line under it, optional — the fact's fine print. */
	detail?: string;
	/** The banner stops showing this entry at local midnight on this date. */
	expires: string;
	href?: string;
}

export const ANNOUNCEMENTS: readonly Announcement[] = [
	{
		id: 'current-7-1',
		text: 'Data current to Genshin Impact 7.1',
		// ⚓ READ from the index (coverage round, 2026-09-23): "in the works"
		// means a kit waiting on frame data, so the planner times it with
		// generic lengths. It was hand-written and had drifted — it named three
		// of the six. The line links to the coverage page, which says the rest.
		detail: inTheWorksLine(),
		href: '/coverage',
		// 7.1 went live 2026-09-23; the next patch is ~six weeks out.
		expires: '2026-11-04'
	}
];

/** "Alyosha, Lohen, and Zibai in the works" — the list formatted by the
 *  locale, so the sentence stays whole (style guide §3.1). */
function inTheWorksLine(): string | undefined {
	if (inTheWorks.length === 0) return undefined;
	const names = new Intl.ListFormat('en-US', { style: 'long', type: 'conjunction' }).format(
		inTheWorks
	);
	return `${names} in the works`;
}

/** The entries still live at `now` — an expiry is exclusive of its own day. */
export function currentAnnouncements(now: Date = new Date()): Announcement[] {
	return ANNOUNCEMENTS.filter((a) => now < new Date(`${a.expires}T00:00:00`));
}
