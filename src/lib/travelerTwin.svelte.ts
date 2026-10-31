/**
 * Which Traveler twin the site shows. ⚓ An ACCOUNT fact (profiles design
 * §13.5; Nate 2026-10-26): every Genshin account chose Aether or Lumine once,
 * so under the new layout it is the ACTIVE profile's `twin`, set on its
 * Profile page (Theorycraft's too). Until the session has a profile, it
 * reads Settings' `travelerVariant`.
 *
 * ⚠ The ONE reader: every portrait, the chrome's roster mark and the avatar
 * warmer read this, ⛔ never `siteSettings.travelerVariant` directly — that
 * was the bug sweep's "the Traveler twin has two sources" (2026-10-23).
 */

import { fromStore, toStore } from 'svelte/store';
import { siteSettings } from '$lib/stores';
import { storageSession } from '$lib/storage/session.svelte';
import type { Twin } from '$lib/storage/records';
import { rotationTabs } from '$lib/rotationTabs.svelte';
import { notationTwin } from '$lib/data/characterLookup';

const settings = fromStore(siteSettings);

export const travelerTwin = toStore(
	(): Twin =>
		storageSession.profile ? storageSession.profile.twin : settings.current.travelerVariant
);

const profileTwin = fromStore(travelerTwin);

/**
 * ⚓ The twin the Planner's rotation PLAYS (twin frames round, 2026-10-28; Nate:
 * the portrait follows the notation): the one its notation pins with
 * `<Element> Aether|Lumine`, else the profile's. The bench, the Planner's rail
 * and inspector read this, so a Lumine rotation shows Lumine in any profile.
 * Every other portrait (roster, Builder, Library) stays the account's.
 */
export const rotationTwin = toStore(
	(): Twin => notationTwin(rotationTabs.notation) ?? profileTwin.current
);

/** Whether the Planner is in a REAL profile's own rotation, where a twin the
 *  profile did not choose routes to a Theorycraft guest (`whatIfTwin`). */
export const twinRoutes = (): boolean =>
	storageSession.profile?.kind === 'real' && !storageSession.plannerGuest;
/** Whether the Planner is showing a guest, whose names are always explicit. */
export const plannerGuest = (): boolean => storageSession.plannerGuest;
