/**
 * src/lib/sim/projections.ts
 *
 * Every row surface the timeline draws off the IR, in one bundle. Test-only —
 * the renderer builds these itself, per lane; this exists so a sweep can run all
 * seven over the whole corpus at once (`projections.test.ts`).
 *
 * ⚓ It is what survived the L3 differ. Through L3c/L3d this was one of three
 * comparison surfaces against a frozen copy of the parser, and the one that
 * answered the question gauge-round.md C2 actually asks: not "is the IR equal"
 * but "did anything MOVE ON SCREEN". The two-engine comparison is gone with the
 * copy; the bundle is worth keeping.
 */

import type { ParsedRotation } from '$lib/utils/notationParser';
import type { CharacterData } from '$lib/types/character';
import type { LoadoutEntry } from '$lib/stores';
import type { SlottedTrack } from '$lib/timeline/types';
import { projectTeamBuffRows } from '$lib/timeline/teamBuffRows';
import { projectCharReceivedBuffRows } from '$lib/timeline/charReceivedBuffRows';
import { computeSummonSubrows } from '$lib/timeline/summonSubrows';
import { computeShieldSubrows } from '$lib/timeline/shieldRows';
import { computeNBBars } from '$lib/timeline/nbRows';
import { computeMoonsignRows } from '$lib/timeline/moonsignRows';
import { computeWeaponProcRows } from '$lib/timeline/weaponProcRows';

/** Mirrors `mapTracksToSlots` in RotationTimeline.svelte — a track with no slot
 *  is DROPPED (a fifth character; the composer squiggles it), and a character
 *  appearing twice cycles its matching slots. */
function mapTracksToSlots(r: ParsedRotation, slots: string[]): SlottedTrack[] {
	const slotUsage: Record<string, number> = {};
	const out: SlottedTrack[] = [];
	for (const track of r.tracks) {
		const matching = slots
			.map((id, idx) => (id === track.characterId ? idx : -1))
			.filter((idx) => idx >= 0);
		if (matching.length === 0) continue;
		const usage = slotUsage[track.characterId] ?? 0;
		out.push({ ...track, slotIdx: matching[usage % matching.length] });
		slotUsage[track.characterId] = usage + 1;
	}
	return out;
}

/** The notation-derived team: first four distinct characters in track order
 *  (`notation as single source of truth`, 2026-08-13). */
export function slotsOf(r: ParsedRotation): string[] {
	const seen: string[] = [];
	for (const t of r.tracks) {
		if (!seen.includes(t.characterId)) seen.push(t.characterId);
		if (seen.length === 4) break;
	}
	return seen;
}

export type ProjectionInput = {
	getCharacter: (id: string) => CharacterData | null;
	constellationLevels: Record<string, number>;
	loadoutMap: Record<string, LoadoutEntry>;
};

/** Every row surface the timeline draws off the IR, in one bundle. */
export function projectAll(r: ParsedRotation, input: ProjectionInput) {
	const slots = slotsOf(r);
	const annotated = mapTracksToSlots(r, slots);
	const moonsignSlots = slots
		.map((id, idx) => ({ id, idx }))
		.filter(({ id }) => !(input.getCharacter(id)?.factions ?? []).includes('moonsign'))
		.map(({ idx }) => idx);
	return {
		teamBuff: projectTeamBuffRows(r.windows, input.getCharacter),
		received: projectCharReceivedBuffRows(r.windows, input.getCharacter),
		summon: computeSummonSubrows(
			annotated,
			r.windows,
			input.constellationLevels,
			input.getCharacter
		),
		shield: computeShieldSubrows(r.windows, (id) => {
			const i = slots.indexOf(id);
			return i === -1 ? undefined : i;
		}),
		nb: computeNBBars(r.events),
		moonsign: computeMoonsignRows(r.events, moonsignSlots, slots),
		weaponProc: computeWeaponProcRows(r.windows, input.loadoutMap)
	};
}
