/**
 * Which Traveler twin the site shows. ⚓ An ACCOUNT fact (profiles design
 * §13.5; Nate 2026-10-26): every Genshin account chose Aether or Lumine once,
 * so under the new layout it is the ACTIVE profile's `twin`, set on its
 * Profile page (Theorycraft's too). The old layout has no profiles and keeps
 * reading Settings' `travelerVariant`.
 *
 * ⚠ The ONE reader: every portrait, the chrome's roster mark and the avatar
 * warmer read this, ⛔ never `siteSettings.travelerVariant` directly — that
 * was the bug sweep's "the Traveler twin has two sources" (2026-10-23).
 */

import { fromStore, toStore } from 'svelte/store';
import { siteSettings } from '$lib/stores';
import { nextLayout } from '$lib/nextLayout';
import { storageSession } from '$lib/storage/session.svelte';
import type { Twin } from '$lib/storage/records';

const settings = fromStore(siteSettings);
const next = fromStore(nextLayout);

export const travelerTwin = toStore(
	(): Twin =>
		next.current && storageSession.profile
			? storageSession.profile.twin
			: settings.current.travelerVariant
);
