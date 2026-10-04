// The ICD Timeline's examples — real hit lists under their real ICD groups.
//
// ⚓ A preset is a HIT LIST plus a RULE (ICD Timeline pass, 2026-10-04). An even
// string cannot draw Layla: her stars fly in volleys of four with a gap after,
// and an even 0.45s string reaches the 8th hit her group would apply on, which
// no volley ever does. The shape is also the groundwork for loading a
// character's own string later — that is one more source of hit lists.
//
// ⚓ Every number here is gcsim's, in FRAMES (60 fps), and each example names
// its source file. A hit list starts at the first landing (t = 0), because ICD
// counts from the first hit, not from the button press. Groups are from
// `pkg/core/attacks/icd_groups.dm.go`; `cap` is the number of applications in
// the group's list (see `IcdParams.cap`).

import type { IcdParams } from '$lib/utils/icd';
import { FPS } from '$lib/utils/frames';

export type IcdExampleId = 'oz' | 'hutao' | 'chevreuse' | 'layla';

export type IcdExample = {
	id: IcdExampleId;
	label: string;
	element: 'pyro' | 'electro' | 'cryo';
	/** Landing times in seconds, first hit at 0. */
	hits: number[];
	/** The group's own rule, in seconds. */
	rule: IcdParams;
	/** What the hit list is, in a sentence. */
	note: string;
};

const sec = (frames: number[]) => frames.map((f) => f / FPS);

/** `n` hits `every` frames apart, from 0. */
const series = (n: number, every: number) => Array.from({ length: n }, (_, i) => i * every);

/**
 * Layla's Shooting Stars over one shield (gcsim `layla/shield.go`, `skill.go`).
 *
 * Her Skill grants 2 Night Stars and one more arrives every 90f while the
 * shield holds; at 4 she fires 6f later, spends 30f finding a target, then
 * shoots every 27f, each star travelling 35, 33, 30, 28f. The star clock
 * restarts after the last shot, so the next volley needs four fresh stars.
 *   Volley 1: shots 216, 243, 270, 297 → land 251, 276, 300, 325.
 *   Volley 2: stars at 387 … 657, shots 693, 720, 747, 774 → land 728, 753, 777, 802.
 * Both volleys fall inside the 12s shield.
 */
const LAYLA_LANDINGS = [251, 276, 300, 325, 728, 753, 777, 802];

export const ICD_EXAMPLES: IcdExample[] = [
	{
		// gcsim `fischl/skill.go`: first tick 64f after Oz appears, then every
		// 59f until he leaves 600f after appearing → 10 ticks. Oz's arrival hit
		// is `ICDTagNone` (on no counter) and is left out.
		id: 'oz',
		label: "Fischl's Oz",
		element: 'electro',
		hits: sec(series(10, 59)),
		rule: { timer: 5, hits: 4, cap: 8 },
		note: 'Oz strikes about once a second for 10 seconds.'
	},
	{
		// gcsim `hutao/attack.go` + `charge.go`, in Paramita Papilio: N1 cancels
		// into a charged attack at 20f, which lands 3f in and cancels back into
		// N1 at 42f — a charged attack every 62f. The N1s are on another counter
		// and are left out.
		id: 'hutao',
		label: "Hu Tao's charged attacks",
		element: 'pyro',
		hits: sec(series(9, 62)),
		rule: { timer: 0.5, hits: Infinity },
		note: 'N1 then a charged attack, repeated through her Skill: one charged attack every 1.03 seconds.'
	},
	{
		// gcsim `chevreuse/burst.go`: 8 shells in 5 groups, landing 24, 33, 33,
		// 42, 42, 51, 51, 60f after the Burst's first hit — pairs in the same frame.
		id: 'chevreuse',
		label: "Chevreuse's Burst",
		element: 'pyro',
		hits: sec([0, 9, 9, 18, 18, 27, 27, 36]),
		rule: { timer: 3, hits: 3, cap: 2 },
		note: 'Eight shells burst within 0.6 seconds, two at a time.'
	},
	{
		id: 'layla',
		label: "Layla's Shooting Stars",
		element: 'cryo',
		hits: sec(LAYLA_LANDINGS.map((f) => f - LAYLA_LANDINGS[0])),
		rule: { timer: 3, hits: 7, cap: 2 },
		note: 'Stars fly in volleys of four, about 8 seconds apart while her shield holds.'
	}
];
