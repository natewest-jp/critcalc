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

import { characterIndex, inTheWorks } from '$lib/data/characterIndex.generated';
import { currentAbyss, currentSeason } from '$lib/endgame';

/** One quieter line under the headline — its fine print, optionally a link. */
export interface AnnouncementLine {
	text: string;
	href?: '/coverage' | '/builder';
}

export interface Announcement {
	id: string;
	/** The headline — the fact. */
	text: string;
	/** The lines under it, in order. */
	lines: AnnouncementLine[];
	/** The banner stops showing this entry at local midnight on this date. */
	expires: string;
}

/**
 * ↻ 2026-10-18 (⚓ Nate, shapes A + B): "current" is PROVED by what is useful
 * rather than by a list of what is missing. The old fine print named the
 * characters in the works and nothing else, so the banner's only news was a
 * gap. Now:
 *   - the endgame line — this cycle's Spiral Abyss and Stygian Onslaught, read
 *     from the same data the Team Builder's presets use, so it follows the
 *     calendar by itself and links to where those teams are planned;
 *   - the count — characters modeled beside those in progress, so the gap is
 *     a ratio, and the names live on the coverage page it links to.
 * Both are computed AT `now`, which is why this is a function: the page bakes
 * the build-time answer for the first paint and re-asks once mounted.
 */
function announcementsAt(now: Date): Announcement[] {
	return [
		{
			id: 'current-7-1',
			text: 'Data current to Genshin Impact 7.1',
			lines: [endgameLine(now), countLine()].filter((l): l is AnnouncementLine => !!l),
			// 7.1 went live 2026-09-23; the next patch is ~six weeks out.
			expires: '2026-11-04'
		}
	];
}

/** "Spiral Abyss: Stardread Moon · Stygian Onslaught 7.1" — whichever of the
 *  two is live at `now` (both, normally). */
function endgameLine(now: Date): AnnouncementLine | undefined {
	const abyss = currentAbyss(now);
	const season = currentSeason(now);
	const parts = [
		abyss && `Spiral Abyss: ${abyss.name.en}`,
		season && `Stygian Onslaught ${season.version}`
	].filter(Boolean);
	return parts.length ? { text: parts.join(' · '), href: '/builder' } : undefined;
}

/** "117 characters modeled · 4 in progress". ⚠ The Traveler counts ONCE, as
 *  a player counts them — the index carries one entry per element (7) — and
 *  the Blank placeholder not at all. "In the
 *  works" is READ from the index (coverage round, 2026-09-23): a kit waiting
 *  on frame data, which the planner times with generic lengths. */
function countLine(): AnnouncementLine {
	const isTraveler = (id: string) => id.startsWith('traveler');
	// ⛔ Not 'blank' — the empty-slot placeholder is in the index but is not a
	// character (⚓ Nate, 2026-10-18).
	const total = characterIndex.filter((c) => c.id !== 'blank' && !isTraveler(c.id)).length + 1;
	const modeled = total - inTheWorks.length;
	const text = inTheWorks.length
		? `${modeled} characters modeled · ${inTheWorks.length} in progress`
		: `${modeled} characters modeled`;
	return { text, href: '/coverage' };
}

/** The entries still live at `now` — an expiry is exclusive of its own day. */
export function currentAnnouncements(now: Date = new Date()): Announcement[] {
	return announcementsAt(now).filter((a) => now < new Date(`${a.expires}T00:00:00`));
}
