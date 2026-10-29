/**
 * summonTickBuffs.test.ts — a summon's ticks fire its owner's onHit effects
 * (2026-08-31).
 *
 * ⚓ A `skill`/`burst` `onHit` buff or shred is stated on the summon's hits —
 * Xiangling's C1 on Guoba's, Sigewinne's C2 on "Bolstering Bubblebalm", Venti's
 * C6 on "Wind's Grand Ode" — but until the summon-tick pass landed, the only
 * hit such an effect ever saw was the CAST's own. Every one of them opened at
 * the cast and never refreshed. Record: docs/rounds/summon-tick-stacks-round.md §9.
 *
 * ⚠️⚠️ THE DEFECT SURVIVED SIXTEEN DAYS BEHIND A COMMENT SAYING IT WAS FIXED.
 * Step 6c synthesized the hits on 2026-08-15 and both CLAUDE.md and
 * `finalize.ts` then described an uptime correction — but `hitsForTrack`
 * selects `normal|charged|plunge` and a tick is `skill|burst`, so the hits
 * reached the ARTIFACT branch and nothing else. ⚓ A hit reaching `hitRecords`
 * is not a hit reaching a CONSUMER. No existing test moved when the fix landed,
 * and none would move if it were reverted; this file is the one that would.
 *
 * ⚓⚓ WHY THIS IS STRUCTURAL AND NOT A SNAPSHOT. It asserts a RELATION between
 * two things the parse already publishes — a summon window's `ticks` and the
 * buff windows on the same character — rather than any frame number. A cadence
 * change, a re-tuned duration, a new lane or a projection rewrite move both
 * sides together and the assertion holds; a table of expected ends would break
 * on all of them and teach the next reader to re-bless it.
 *
 * ⚓ VERIFIED BY SEEDED NEGATIVE (a regression test nobody has watched fail is a
 * decoration). Two mutations, and they hit disjoint sets:
 *   · the pass's tick selection neutered in `deriveBuffWindows`
 *     (`.filter((h) => false && h.viaEntity === …)`) — ALL TEN sweep characters
 *     go red, plus the Xiangling boundary case: 11 of 18. The `source: 'active'`
 *     block stays green, which is why it is a separate block.
 *   · the `srcMode === 'active' && hit.viaEntity` clause removed from
 *     `onHitTriggerMatches` — EXACTLY ONE test goes red. That is the point of
 *     splitting them: each mutation names its own guard.
 *
 * ⚠️⚠️ THE SWEEP'S SIGNATURE TOOK TWO TRIES, and the first one was decoration.
 * "A window opens on a tick instant" passed under the mutation for three of the
 * ten (Sigewinne, Sucrose, Anemo Traveler) because a summon-spawning cast's
 * `fieldStart` is often exactly where its first tick lands — so the assertion
 * was satisfied by windows the pass had not produced. Excluding cast instants
 * then failed those same three on CORRECT code. The span signature
 * (`refreshedByTick`) is what actually distinguishes the two states. ⛔ Don't
 * "simplify" it back to a start comparison; watch a mutation first.
 */

import { describe, it, expect } from 'vitest';
import { parseNotation } from './notationParser';
import { onHitTriggerMatches, type HitEvent } from '$lib/sim/hits';
import type { CharacterData } from '$lib/types/character';
import type { Effect, Trigger } from '$lib/types/ability';
import { isActiveTargetOnly } from './effectCollection';

const modules = import.meta.glob('../data/characters/*.json', { eager: true });
const all: CharacterData[] = Object.values(modules).map(
	(m) => (m as { default: CharacterData }).default
);
const byId = new Map(all.map((c) => [c.id, c]));

/** Parse one character alone, so every window on the result is theirs. */
function parseSolo(c: CharacterData, cLevel: number) {
	return parseNotation(
		`${c.id} E Q N1 C P E Q`,
		(n) => (n.toLowerCase() === c.id ? c : null),
		8,
		{ [c.id]: cLevel },
		undefined,
		[c]
	);
}

/** Does this character leave a summon whose ticks DEAL DAMAGE? */
function hasDamagingSummon(c: CharacterData): boolean {
	for (const ab of c.abilities) {
		if (ab.abilityType !== 'skill' && ab.abilityType !== 'burst') continue;
		const summons = [...(ab.summons ?? []), ...(ab.variants ?? []).flatMap((v) => v.summons ?? [])];
		for (const s of summons)
			for (const e of s.effects ?? [])
				if (e.type === 'damage' && e.trigger?.type === 'summonTick') return true;
	}
	return false;
}

/** The character's own damaging summons, as the synthetic hits their ticks make.
 *  ⚠ Mirrors `finalize.ts` step 6c exactly — a tick's class is its SPAWNING
 *  cast's, its `abilityName` is the summon's label, it carries no `hitIndex`,
 *  and it is flagged `viaEntity`. */
function syntheticTickHits(c: CharacterData): HitEvent[] {
	const out: HitEvent[] = [];
	for (const ab of c.abilities) {
		if (ab.abilityType !== 'skill' && ab.abilityType !== 'burst') continue;
		const summons = [...(ab.summons ?? []), ...(ab.variants ?? []).flatMap((v) => v.summons ?? [])];
		for (const s of summons)
			for (const e of s.effects ?? [])
				if (e.type === 'damage' && e.trigger?.type === 'summonTick')
					out.push({
						characterId: c.id,
						time: 0,
						abilityType: ab.abilityType,
						element: e.element,
						damageTag: ab.abilityType,
						abilityName: s.label,
						sourceEventId: 0,
						viaEntity: true
					});
	}
	return out;
}

/** Buff/shred effects one of THIS character's own ticks can actually fire ON THE
 *  TEAM SURFACE — the pass this file guards.
 *
 *  ⚓ Selection goes through `onHitTriggerMatches` — the same gate the pass
 *  uses — rather than a hand-rolled copy of it, exactly the way
 *  `constellationGating.test.ts` selects with `unlockedConstellations`. The
 *  ASSERTION is still on the parse; only the "who should qualify" question
 *  borrows the shared primitive, and a class mismatch is precisely what a loose
 *  filter gets wrong (Kinich holds a skill-class shred and a BURST-spawned
 *  summon, so no tick of his can ever reach it).
 *
 *  ↻ ⚠️ ACTIVE-TARGET BUFFS ARE EXCLUDED, and that is a SURFACE distinction, not
 *  a loosening (summon-tick stacks round, 2026-08-31). They are fired by a
 *  different pass with a different output shape: a team-surface window is
 *  extended IN PLACE by the next tick, so its SPAN is the signature this file
 *  asserts on, while an active-target window is a per-RECEIVER slice and one
 *  activation is several windows that `mergeRefreshedBars` fuses at the
 *  projection. Asserting a long span on a slice would be asserting the wrong
 *  thing about the right behaviour. Alyosha is the only corpus holder and his
 *  guard is `src/lib/sim/summonTickStacks.test.ts`, which asserts the projected
 *  BAR. ⛔ Don't "fix" this by relaxing the span assertion below. */
function tickReachableOnHit(c: CharacterData): Effect[] {
	const ticks = syntheticTickHits(c);
	if (ticks.length === 0) return [];
	const sources = [...c.abilities, ...(c.passives ?? []), ...(c.constellations ?? [])];
	return sources.flatMap((a) =>
		(a.effects ?? []).filter((e) => {
			if (e.type !== 'buff' && e.type !== 'resShred') return false;
			if (e.trigger?.type !== 'onHit') return false;
			if (e.duration == null) return false;
			if (e.type === 'buff' && isActiveTargetOnly(e.target)) return false;
			const trigger = e.trigger as Extract<Trigger, { type: 'onHit' }>;
			return ticks.some((h) => onHitTriggerMatches(trigger, h, c.id));
		})
	);
}

/** Every tick instant the parse published. ⚠ `src` narrows to summons spawned by
 *  one cast class, which the Xiangling case needs: her C1 is stated on her
 *  SKILL's summon, and her burst leaves a second, later-ticking one that can
 *  never fire it. */
function tickInstants(
	windows: ReturnType<typeof parseSolo>['windows'],
	src?: 'skill' | 'burst'
): Set<number> {
	const out = new Set<number>();
	for (const w of windows)
		if (w.kind === 'summon' && (src === undefined || w.source === src))
			for (const t of w.ticks ?? []) out.add(t);
	return out;
}

/** Buff windows that OPEN on a tick instant AND NOT on a cast instant — the
 *  pass's signature, with the coincidences removed.
 *
 *  ⚠️⚠️ THE EXCLUSION IS LOAD-BEARING, and it was added after watching the guard
 *  fail to fail. A cast-anchored window opens at `fieldStart`, which for a
 *  summon-spawning cast is ALSO where the first tick can land — so a plain
 *  "some window starts on a tick" test was satisfiable by coincidence, and
 *  under the seeded negative three of eleven sweep characters (Sigewinne,
 *  Sucrose, Anemo Traveler) stayed green on windows the pass had not produced.
 *  ⛔ Never relax this back: an assertion a mutation cannot break is decoration. */
function tickAnchoredWindows(r: ReturnType<typeof parseSolo>) {
	const ticks = tickInstants(r.windows);
	const castInstants = new Set<number>();
	for (const e of r.events)
		if (e.kind === 'cast') {
			castInstants.add(e.time);
			castInstants.add(e.fieldStart);
		}
	return r.windows.filter(
		(w) => w.kind === 'buff' && ticks.has(w.start) && !castInstants.has(w.start)
	);
}

describe('summon ticks fire their owner onHit buffs — corpus sweep', () => {
	// ⚠ C6 so constellation-hosted effects are unlocked: seven of the ten
	// affected characters carry theirs on a constellation (Xiangling C1, Emilie
	// C2, Navia C4, Rosaria C6, Sigewinne C2, Traveler Anemo C6, Venti C6), and
	// a C0-only sweep would see three.
	const qualifying = all.filter((c) => hasDamagingSummon(c) && tickReachableOnHit(c).length > 0);

	it('finds characters that structurally qualify', () => {
		// ⚠ NOT a count assertion — the corpus grows. The claim is only that the
		// mechanism has live subjects, so a sweep that silently matched nobody
		// (the way a filter typo would) fails here rather than passing vacuously.
		expect(qualifying.length).toBeGreaterThan(0);
	});

	for (const c of qualifying) {
		it(`${c.id} — a tick REFRESHES a buff window past its own duration`, () => {
			const r = parseSolo(c, 6);
			// A qualifying character whose summon never ticked in this rotation
			// has nothing to assert; the sweep is about the ones that did.
			if (tickInstants(r.windows).size === 0) return;
			expect(refreshedByTick(r, c).length).toBeGreaterThan(0);
		});
	}
});

/** Buff windows carrying a tick-reachable effect and SPANNING LONGER than that
 *  effect's own duration — i.e. windows something refreshed after they opened.
 *
 *  ⚓⚓ THE SIGNATURE IS THE SPAN, NOT THE START, and that took two tries to get
 *  right. "A window opens on a tick instant" reads like the obvious claim, but a
 *  summon-spawning cast's `fieldStart` is often exactly where its first tick
 *  lands — so for Sigewinne, Sucrose and Anemo Traveler every tick-driven window
 *  legitimately opens at a cast instant, and a start-based test either passes by
 *  coincidence (before excluding cast instants) or fails on correct code (after).
 *  A window LONGER than one application of its own effect can only have been
 *  refreshed, and for these characters nothing but a summon tick can do it:
 *  their qualifying effects are `skill`/`burst`-class, so no N/CA/P swing
 *  reaches them.
 *
 *  ⚠ Effect IDENTITY is the join. Effects are stable object references off the
 *  loaded JSON and no pass on this path clones them (only `elevate` is cloned,
 *  by `normalizeBuffLikeEffect`, and no elevate is tick-reachable). */
function refreshedByTick(r: ReturnType<typeof parseSolo>, c: CharacterData) {
	const reachable = new Set(tickReachableOnHit(c));
	return r.windows.filter((w) => {
		if (w.kind !== 'buff') return false;
		const own = w.effects.find((e) => reachable.has(e));
		if (!own || own.duration == null) return false;
		return w.end - w.start > Math.round(own.duration * 60);
	});
}

describe('summon ticks EXTEND the cast-anchored window (Xiangling C1)', () => {
	// ⚓ THE BOUNDARY CASE, and the one measured while finding the defect: her C1
	// Pyro shred is stated on Guoba's hits (her own curator note records that
	// gcsim fires it from Guoba's hit callbacks), and before the fix it drew a
	// single window ending 6s after the cast while Guoba went on ticking.
	const xiangling = byId.get('xiangling')!;

	it('is gated off at C0 — the control', () => {
		const r = parseSolo(xiangling, 0);
		expect(r.windows.filter((w) => w.kind === 'buff' && w.debuff)).toHaveLength(0);
	});

	it('reaches past the last Guoba tick at C1', () => {
		const r = parseSolo(xiangling, 1);
		// ⚠ SKILL ticks only — Guoba's. Her burst leaves Pyronado, which ticks
		// later and cannot fire a shred authored `abilityType: 'skill'`; measuring
		// against ALL ticks compares the shred to a summon it has nothing to do
		// with, and the assertion fails for the wrong reason.
		const ticks = [...tickInstants(r.windows, 'skill')].sort((a, b) => a - b);
		expect(ticks.length).toBeGreaterThan(1);
		const shreds = r.windows.filter((w) => w.kind === 'buff' && w.debuff);
		expect(shreds.length).toBeGreaterThan(0);

		const lastTick = ticks[ticks.length - 1];
		const latestEnd = Math.max(...shreds.map((w) => w.end));
		// ⚓ The whole claim, in one line: the shred outlives the last tick, which
		// it cannot do while it is anchored only to the cast. ⛔ Not an equality —
		// the effect's duration is data and may be re-tuned.
		expect(latestEnd).toBeGreaterThan(lastTick);

		// …and it got there by firing ON a tick, not by some other window being
		// longer. This is what distinguishes the fix from a duration change.
		const anchored = tickAnchoredWindows(r);
		expect(anchored.length).toBeGreaterThan(0);
		expect(ticks).toContain(Math.min(...anchored.map((w) => w.start)));
	});

	it('a character with no damaging summon is untouched — the negative control', () => {
		// ⚠ Keqing holds no ticking summon, so no window of hers may open on a
		// tick instant. Without this, a pass that anchored windows to something
		// other than a tick would still satisfy the sweep above.
		const keqing = byId.get('keqing');
		expect(keqing).toBeDefined();
		const r = parseSolo(keqing!, 6);
		expect(tickInstants(r.windows).size).toBe(0);
	});
});

describe("onHit source 'active' refuses an entity-delivered hit", () => {
	// ⚓ Guards a DIFFERENT clause from the sweep — `onHitTriggerMatches`, not
	// the projection pass — which is why these are their own block. Nicole's A4
	// is the corpus's only `source: 'team'`-shaped effect with no ability-class
	// filter, so she is the only effect a tick pass could reach indiscriminately;
	// her text says "nearby ACTIVE party members" and a tick is not one.
	const hit = (over: Partial<HitEvent> = {}): HitEvent => ({
		characterId: 'fischl',
		time: 100,
		abilityType: 'skill',
		element: 'electro',
		damageTag: 'skill',
		sourceEventId: 0,
		...over
	});

	it("'team' accepts a summon tick", () => {
		expect(
			onHitTriggerMatches({ type: 'onHit', source: 'team' }, hit({ viaEntity: true }), 'nicole')
		).toBe(true);
	});

	it("'active' refuses a summon tick", () => {
		expect(
			onHitTriggerMatches({ type: 'onHit', source: 'active' }, hit({ viaEntity: true }), 'nicole')
		).toBe(false);
	});

	it("'active' still accepts a hit the character landed itself", () => {
		expect(onHitTriggerMatches({ type: 'onHit', source: 'active' }, hit(), 'nicole')).toBe(true);
	});

	it('Nicole authors it, so a future tick pass cannot reach her', () => {
		// ⚠ A data assertion on purpose: the clause above is only load-bearing
		// while she uses it, and she is the one effect it was added for.
		const nicole = byId.get('nicole')!;
		const philokalia = (nicole.passives ?? []).find((p) => p.name === 'Philokalia');
		expect(philokalia).toBeDefined();
		const onHit = (philokalia!.effects ?? []).filter((e) => e.trigger?.type === 'onHit');
		expect(onHit.length).toBeGreaterThan(0);
		for (const e of onHit) {
			expect((e.trigger as Extract<Trigger, { type: 'onHit' }>).source).toBe('active');
		}
	});
});
