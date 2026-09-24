/**
 * notationParser.ir.test.ts — P4 event-stream IR invariants (corpus-driven).
 *
 * Companion to `notationParser.roster.test.ts` (which guards the legacy bar/
 * block output). This sweep drives the same per-character roster notation — plus
 * a handful of multi-character rotations that exercise swaps, cross-element
 * reactions, shields, and summons — and asserts the Phase-2 IR contract:
 *
 *   - `events` are time-sorted with finite times; `windows` all have end >= start
 *     and finite bounds.
 *   - Every eBar/qBar maps to exactly one `cast` event (bijection on
 *     time/label/kind) and there are no orphan `cast` events.
 *   - Summon windows match an INDEPENDENT geometry reconstruction from bar
 *     spans (spawn offset + terminatesOn swap/recast truncation) — the same
 *     computation `computeSummonSubrows` used to own pre-3c, now re-derived
 *     test-side so parser-authored spans stay covered after the renderer
 *     stopped reconstructing them.
 *   - Every stance owner bar's `start + uptime` equals its stance window's end
 *     (the finalize uptime stamp agrees with the window record); for cross-
 *     character rotations a swap-clamped stance may end earlier, so the relaxed
 *     bound `end <= start + uptime` is asserted there. (The summon spawn offset
 *     shifts only the bar's rendered active-overlay, not the state window.)
 */

import { describe, it, expect } from 'vitest';
import { parseNotation, type ParsedRotation, type TimelineBar } from './notationParser';
import type { CharacterData } from '$lib/types/character';
import { findCastSummons } from '$lib/timeline/summonSubrows';
import { framesOf } from '$lib/utils/frames';

/** ⚓ ZERO, not an epsilon. Every IR time is an integer frame count since
 *  2026-08-16 (gauge-round.md C1), so the comparisons below are exact — and
 *  keeping a tolerance would quietly hide the ±1-frame disagreements the L3
 *  refactor is going to need this test to catch. ⛔ Do not reintroduce one. */
const EPS = 0;

const modules = import.meta.glob('../data/characters/*.json', { eager: true });
const all: CharacterData[] = Object.values(modules).map(
	(m) => (m as { default: CharacterData }).default
);
const byId = new Map(all.map((c) => [c.id, c]));
const byName = new Map(all.map((c) => [c.displayName, c]));

// Roster notation generator — mirrors notationParser.roster.test.ts.
const SKILL_TOKENS = ['E', 'tE', 'pE', 'hE', 'h1E', 'h2E'] as const;
function declaredSkillTokens(c: CharacterData): string[] {
	const toks = new Set<string>();
	for (const a of c.abilities) {
		if (a.abilityType !== 'skill') continue;
		for (const t of a.input ?? []) toks.add(t);
		for (const v of a.variants ?? []) for (const t of v.input ?? []) toks.add(t);
	}
	const ordered = SKILL_TOKENS.filter((t) => toks.has(t));
	return ordered.length ? ordered : ['E'];
}
function declaredExtraBurstTokens(c: CharacterData): string[] {
	const toks = new Set<string>();
	for (const a of c.abilities) {
		if (a.abilityType !== 'burst') continue;
		for (const v of a.variants ?? []) for (const t of v.input ?? []) toks.add(t);
	}
	toks.delete('Q');
	return [...toks].sort();
}
function rosterNotation(c: CharacterData): string {
	const skills = declaredSkillTokens(c);
	return [
		c.displayName,
		...skills,
		'N1',
		'N2',
		'N3',
		'C',
		'P',
		'Q',
		skills[0],
		...declaredExtraBurstTokens(c)
	].join(' ');
}

const rosterLookup = (name: string): CharacterData | null => byName.get(name) ?? null;

type SummonTuple = {
	characterId: string;
	label: string;
	start: number;
	end: number;
	source: 'skill' | 'burst';
};
const tupleKey = (t: SummonTuple) => `${t.characterId}|${t.label}|${t.source}|${t.start}|${t.end}`;

/** Stand-in label for a shared window whose OCCUPANTS the oracle cannot name.
 *  ⛔ Not a real summon label — it never leaves this file. */
const FOLLOW_STATE = '\u0000followState';

/** Independently reconstruct the expected summon spans from bar geometry — the
 *  spawn-offset + terminatesOn swap/recast truncation `computeSummonSubrows`
 *  owned pre-3c, re-derived here from `result.tracks` (a distinct code path from
 *  the parser's finalize summon pass, sharing only the `findCastSummons`
 *  resolution primitive). Swap-out is keyed by characterId, matching the
 *  parser; over the corpus + multi-segment fixtures characterId ↔ slotIdx is a
 *  bijection so this equals the renderer's former slotIdx-keyed computation. */
function reconstructSummonWindows(result: ParsedRotation): SummonTuple[] {
	const out: SummonTuple[] = [];
	const lastByKey = new Map<string, SummonTuple>();
	const castTerminable = new Map<string, SummonTuple[]>();
	const tracks = result.tracks;
	for (let ti = 0; ti < tracks.length; ti++) {
		const track = tracks[ti];
		const char = byId.get(track.characterId) ?? null;
		let swapOutAt = Infinity;
		for (let k = ti + 1; k < tracks.length; k++) {
			if (tracks[k].characterId !== track.characterId) {
				swapOutAt = tracks[k].activeStart;
				break;
			}
		}
		const emit = (bar: TimelineBar, kind: 'skill' | 'burst'): void => {
			for (const t of castTerminable.get(`${track.characterId}::${kind}`) ?? [])
				if (t.end > bar.start) t.end = Math.max(t.start, bar.start);
			castTerminable.delete(`${track.characterId}::${kind}`);
			if (bar.uptime <= 0) return;
			// ⚓⚓ A `summonsFollowState` CAST CANNOT BE RECONSTRUCTED FROM GEOMETRY,
			// and that is the honest answer rather than a gap (Arkhe round, landing
			// c). Which lineup occupies the window — and when it changes hands —
			// depends on the character's STATE at an instant inside the window, which
			// is exactly what this oracle has no access to. So it stops naming the
			// occupants and states the invariant it CAN reach independently: the
			// occupants TILE the shared window exactly. ⚠️ That is not a weaker
			// assertion than the equality it replaces — it is the one that would
			// catch a hand-off leaving a gap, an overlap, or a window running past
			// the cast's own end, which is every way the cut can go wrong.
			const castAbility = char?.abilities.find((a) => a.id === bar.abilityId);
			if (
				castAbility &&
				(castAbility as unknown as Record<string, unknown>).summonsFollowState === true
			) {
				const spawnAt = bar.start + (bar.summonActivatesAt ?? 0);
				out.push({
					characterId: track.characterId,
					label: FOLLOW_STATE,
					start: spawnAt,
					end: spawnAt + bar.uptime,
					source: kind
				});
				return;
			}
			// ↻ 2026-08-14: one tuple per summon, mirroring the parser's move off
			// `summons[0]`. The primary reads the BAR's spawn/uptime (the geometry
			// the ability accessors already resolved, extensions included); a
			// secondary reads its own authored spawnsAt/duration.
			// ↻ 2026-09-22: a STANCE's primary summon reads its own duration too —
			// the bar's uptime is the stance, and the thing it leaves in the world
			// has a lifetime of its own (Nilou's 10s Pirouette, 12s Aura). ⚠️ At C0
			// only: this oracle applies no `durationModifiers`, and the sweep runs
			// at C0, so a C1 Aura is the parser's own test to make.
			const ownerIsStance =
				castAbility !== undefined && 'behavior' in castAbility && castAbility.behavior === 'stance';
			findCastSummons(char, kind, bar.label, bar.abilityId, bar.variantLabel ?? null).forEach(
				(summon, i) => {
					const spawnAt =
						bar.start + (i === 0 ? (bar.summonActivatesAt ?? 0) : (summon.spawnsAt ?? 0));
					const ownLifetime = i !== 0 || ownerIsStance;
					let endAt = spawnAt + (ownLifetime ? framesOf(summon.duration) : bar.uptime);
					if (summon.terminatesOn === 'swap' && swapOutAt < endAt) endAt = swapOutAt;
					if (endAt <= spawnAt) return;
					const key = `${track.characterId}::${summon.label}`;
					if (summon.terminatesOn === 'recast') {
						const prev = lastByKey.get(key);
						if (prev && prev.end > spawnAt) prev.end = spawnAt;
					}
					const t: SummonTuple = {
						characterId: track.characterId,
						label: summon.label,
						start: spawnAt,
						end: endAt,
						source: kind
					};
					out.push(t);
					lastByKey.set(key, t);
					// ↻ 2026-09-19 (summon-ends-on-cast round): a summon its owner's
					// OTHER cast ends is cut at that cast's start.
					if (summon.terminatesOn === 'skill' || summon.terminatesOn === 'burst') {
						const tk = `${track.characterId}::${summon.terminatesOn}`;
						castTerminable.set(tk, [...(castTerminable.get(tk) ?? []), t]);
					}
				}
			);
		};
		// ↻ 2026-08-16 (L5e-a½) — CAST ORDER, not ability-family order. This
		// walked every eBar then every qBar, which made `lastByKey` mean "last
		// emitted" rather than "last cast", so recast truncation could shorten a
		// window whose cast had not happened yet. ⚓ The parser had the identical
		// defect and this reconstruction faithfully reproduced it — which is the
		// honest outcome for an independent oracle written from the same mental
		// model, and the reason it stayed invisible until Fischl's burst Oz was
		// given the `terminatesOn` it was missing.
		// ⚠️ Still re-derived rather than imported: the point of this function is
		// to reach the same geometry down a different path, so ⛔ don't collapse
		// it onto `summonEndAt`.
		const bars: [TimelineBar, 'skill' | 'burst'][] = [
			...track.eBars.map((b): [TimelineBar, 'skill' | 'burst'] => [b, 'skill']),
			...track.qBars.map((b): [TimelineBar, 'skill' | 'burst'] => [b, 'burst'])
		];
		bars.sort((a, b) => a[0].start - b[0].start);
		for (const [bar, kind] of bars) emit(bar, kind);
	}
	return out;
}

/** Assert the parser's `summon` windows equal the independent bar-geometry
 *  reconstruction — direct geometry coverage now that the renderer no longer
 *  reconstructs. */
function assertSummonWindowsMatchGeometry(result: ParsedRotation): void {
	const parserTuples: SummonTuple[] = result.windows
		.filter(
			(w): w is Extract<(typeof result.windows)[number], { kind: 'summon' }> => w.kind === 'summon'
		)
		.map((w) => ({
			characterId: w.characterId,
			label: w.label,
			start: w.start,
			end: w.end,
			source: w.source
		}));

	const expected = reconstructSummonWindows(result);

	// Shared windows first: consume the parser tuples that tile each one, then
	// hold the remainder to the exact-equality rule that has always applied.
	const shared = expected.filter((t) => t.label === FOLLOW_STATE);
	const remaining = new Set(parserTuples);
	for (const win of shared) {
		const occupants = [...remaining]
			.filter(
				(t) =>
					t.characterId === win.characterId &&
					t.source === win.source &&
					t.start >= win.start &&
					t.end <= win.end
			)
			.sort((a, b) => a.start - b.start);
		for (const o of occupants) remaining.delete(o);
		expect(occupants.length, `${win.characterId} shared window has an occupant`).toBeGreaterThan(0);
		expect(occupants[0].start, `${win.characterId} first occupant starts at the spawn`).toBe(
			win.start
		);
		expect(
			occupants[occupants.length - 1].end,
			`${win.characterId} last occupant ends at the shared end`
		).toBe(win.end);
		for (let i = 1; i < occupants.length; i++) {
			expect(
				occupants[i].start,
				`${win.characterId} occupant ${i} begins where ${i - 1} ended (no gap, no overlap)`
			).toBe(occupants[i - 1].end);
		}
	}

	expect([...remaining].map(tupleKey).sort()).toEqual(
		expected
			.filter((t) => t.label !== FOLLOW_STATE)
			.map(tupleKey)
			.sort()
	);
}

/** Post-P4 #2: reconstruct every track's `inputBlocks` PURELY from the IR
 *  (cast events + action-event groups) and assert byte-identity against the
 *  parser's output. Casts project as `{time, castTime, [label], ability}`;
 *  an action group (events sharing a `blockId`) projects as one block whose
 *  duration is the id-ordered sum of swing durations (the same float
 *  additions, in the same order, as the parser's accumulation) and whose
 *  kind derives from the action + element (`element` present ⇔ elemental), and
 *  whose `element` is the anchor swing's — the tint a renderer paints, which is
 *  NOT always the track's own (an infused N).
 *  Track assignment is characterId + [activeStart, activeEnd] containment —
 *  unambiguous because consecutive same-character tracks are separated by
 *  the swap gap. This is the projection safety net: it proves the blocks
 *  are derivable from events over the whole corpus. */
function assertBlocksProjectFromEvents(result: ParsedRotation): void {
	type ExpectedBlock = {
		start: number;
		duration: number;
		parts: string[];
		kind: string;
		element?: string;
	};
	const actionBlockKind = (e: Extract<ParsedRotation['events'][number], { kind: 'action' }>) => {
		if (e.action === 'dash' || e.action === 'jump') return 'movement';
		if (e.action === 'unset') return 'unset';
		return e.element !== undefined ? 'elemental-normal' : 'normal';
	};
	for (const track of result.tracks) {
		const contains = (t: number) => t >= track.activeStart - EPS && t <= track.activeEnd + EPS;
		const items: { sortId: number; block: ExpectedBlock }[] = [];
		// Cast events → skill/burst blocks.
		for (const e of result.events) {
			if (e.kind !== 'cast' || e.characterId !== track.characterId || !contains(e.time)) continue;
			items.push({
				sortId: e.id,
				block: { start: e.time, duration: e.castTime, parts: [e.label], kind: e.ability }
			});
		}
		// Action groups → normal/elemental-normal/movement/unset blocks.
		const groups = new Map<
			number,
			Extract<ParsedRotation['events'][number], { kind: 'action' }>[]
		>();
		for (const e of result.events) {
			if (e.kind !== 'action' || e.characterId !== track.characterId || !contains(e.time)) continue;
			const g = groups.get(e.blockId);
			if (g) g.push(e);
			else groups.set(e.blockId, [e]);
		}
		for (const [blockId, g] of groups) {
			g.sort((a, b) => a.id - b.id);
			const anchor = g[0];
			expect(anchor.id, 'group anchor is its blockId').toBe(blockId);
			// ↻ A group is one block PER RUN OF ONE ELEMENT (Radiance-window round,
			// 2026-09-19): infusion resolves per swing, so a string whose infusion
			// opens or lapses mid-way splits where it changes. The continuation is
			// label-less and sorts by its own first swing.
			let run = [g[0]];
			const flush = (first: boolean): void => {
				let duration = 0;
				for (const e of run) duration += e.duration;
				items.push({
					sortId: first ? blockId : run[0].id,
					block: {
						start: run[0].time,
						duration,
						parts: first ? [anchor.label] : [],
						kind: actionBlockKind(run[0]),
						...(run[0].element !== undefined ? { element: run[0].element } : {})
					}
				});
			};
			let first = true;
			for (const e of g.slice(1)) {
				if (e.element === run[0].element) {
					run.push(e);
					continue;
				}
				flush(first);
				first = false;
				run = [e];
			}
			flush(first);
		}
		items.sort((a, b) => a.sortId - b.sortId);
		const expected = items.map((i) => i.block);
		expect(expected, `inputBlocks project from events (${track.characterId})`).toEqual(
			track.inputBlocks
		);
		// Byte-identity (float bit-equality + field order), not just deep-equal.
		expect(JSON.stringify(expected)).toBe(JSON.stringify(track.inputBlocks));
	}
}

function assertCore(result: ParsedRotation, opts: { strictStanceGeom: boolean }): void {
	const { events, windows } = result;

	// events time-sorted + finite.
	for (let i = 0; i < events.length; i++) {
		expect(Number.isFinite(events[i].time), `event[${i}].time finite`).toBe(true);
		if (i > 0) expect(events[i].time).toBeGreaterThanOrEqual(events[i - 1].time - EPS);
	}

	// ⚓⚓ APPLICATIONS ARE IN FEED ORDER, AND FEED ORDER IS TIME ORDER (2026-08-17).
	// `collectApplications` used to SORT this list, which made the projection
	// honest while the gauge — fed in offer order, and whose `advanceTo` no-ops
	// backwards — went on applying an out-of-order application at the LATER
	// offer's frame. ⚠️ This assertion is the whole guarantee now that the sort
	// is gone, and it must run over MULTI-CHARACTER rotations to mean anything:
	// the defect's original `<name> E Q` census reported zero cross-element
	// inversions because a summon and its caster share an element, so one
	// character cannot exhibit the case that matters.
	for (let i = 1; i < result.applications.length; i++) {
		const prev = result.applications[i - 1];
		const app = result.applications[i];
		expect(
			app.time,
			`application[${i}] (${app.characterId} ${app.element}@${app.time}) reaches the gauge ` +
				`after application[${i - 1}] (${prev.characterId} ${prev.element}@${prev.time})`
		).toBeGreaterThanOrEqual(prev.time - EPS);
	}

	// windows finite + end >= start.
	for (const w of windows) {
		expect(Number.isFinite(w.start), `${w.kind} window start finite`).toBe(true);
		expect(Number.isFinite(w.end), `${w.kind} window end finite`).toBe(true);
		expect(w.end).toBeGreaterThanOrEqual(w.start - EPS);
	}

	// Event ids are unique (identity invariant, post-P4 #1).
	const ids = new Set(events.map((e) => e.id));
	expect(ids.size, 'event ids unique').toBe(events.length);

	// Action events (post-P4 #2): group/anchor integrity + per-kind field shape.
	// Every `blockId` resolves to an action event that anchors itself
	// (blockId === id) and agrees on character/label/action; only normals carry
	// comboIndex or span multiple events per block.
	const actionById = new Map(
		events.filter((e) => e.kind === 'action').map((e) => [e.id, e] as const)
	);
	for (const e of events) {
		if (e.kind !== 'action') continue;
		expect(e.duration, `action ${e.id} duration non-negative`).toBeGreaterThanOrEqual(0);
		const anchor = actionById.get(e.blockId);
		expect(anchor, `action ${e.id} blockId ${e.blockId} resolves to an action event`).toBeTruthy();
		if (!anchor) continue;
		expect(anchor.blockId, 'anchor events anchor themselves').toBe(anchor.id);
		expect(anchor.characterId, 'group shares characterId').toBe(e.characterId);
		expect(anchor.label, 'group shares label').toBe(e.label);
		expect(anchor.action, 'group shares action kind').toBe(e.action);
		expect(anchor.time, 'anchor starts its group').toBeLessThanOrEqual(e.time + EPS);
		if (e.action !== 'normal') {
			expect(e.comboIndex, 'comboIndex only on normals').toBeUndefined();
			expect(e.blockId, 'non-normal actions anchor themselves').toBe(e.id);
		}
		if (e.action === 'dash' || e.action === 'jump' || e.action === 'unset') {
			expect(e.abilityId, `${e.action} carries no abilityId`).toBeUndefined();
			expect(e.element, `${e.action} carries no element`).toBeUndefined();
		}
	}

	// Nightsoul-Burst events (post-P4 #5 arc, phase 3): team-clock fires carry
	// the discrete Natlan-count cooldown, one shared cooldown per parse, and
	// consecutive fires respect it (the greedy gate).
	const nbEvents = events.filter((e) => e.kind === 'nightsoulBurst');
	for (let i = 0; i < nbEvents.length; i++) {
		const nb = nbEvents[i];
		expect([18, 12, 9].map(framesOf), `nb event cooldown discrete`).toContain(nb.cooldown);
		expect(nb.characterId.length, 'nb event carries its trigger character').toBeGreaterThan(0);
		expect(nb.cooldown, 'one NB cooldown per parse').toBe(nbEvents[0].cooldown);
		if (i > 0) {
			expect(
				nb.time - nbEvents[i - 1].time,
				'consecutive NB fires respect the cooldown'
			).toBeGreaterThanOrEqual(nb.cooldown - EPS);
		}
	}

	// Buff windows (post-P4 #5): every window carries a non-empty effect
	// list; emission ids are unique (the row projections order by them);
	// received-surface windows carry their logical duration; weapon windows
	// are received-surface and carry a refinement index. Provenance ids are
	// validated by the generic loops below.
	const buffWins = windows.filter((w) => w.kind === 'buff');
	const buffIds = new Set(buffWins.map((w) => w.id));
	expect(buffIds.size, 'buff window ids unique').toBe(buffWins.length);
	for (const w of buffWins) {
		expect(w.effects.length, 'buff window carries effects').toBeGreaterThan(0);
		if (w.receiverId !== undefined) {
			expect(w.duration, 'received buff window carries its logical duration').toBeGreaterThan(0);
		}
		if (w.source.type === 'weapon') {
			expect(w.receiverId, 'weapon windows are received-surface').toBeTruthy();
			expect(w.refinementIndex, 'weapon window carries a refinement index').toBeGreaterThanOrEqual(
				0
			);
		}
	}

	// Window provenance: every cast-opened window's sourceCastId references an
	// existing `cast` event by the same character, whose time is <= the window
	// start (a window can't open before the cast that opened it).
	const castById = new Map(events.filter((e) => e.kind === 'cast').map((e) => [e.id, e] as const));
	for (const w of windows) {
		// ⚓ A gadget has no cast to be provenance FOR — any party member's
		// reaction leaves the same core or Prism (Polestar-Field round).
		if (w.kind === 'gadget') continue;
		if (w.sourceCastId === undefined) continue;
		const src = castById.get(w.sourceCastId);
		expect(src, `${w.kind} window sourceCastId ${w.sourceCastId} resolves to a cast`).toBeTruthy();
		if (!src) continue;
		expect(src.characterId, `${w.kind} window owner matches its source cast`).toBe(w.characterId);
		expect(src.time).toBeLessThanOrEqual(w.start + EPS);
	}

	// Action-opened window provenance (post-P4 #2): sourceActionId resolves to
	// an `action` event by the same character at/before the window start, and
	// a window never carries both provenance ids.
	for (const w of windows) {
		if (w.kind === 'gadget') continue;
		if (w.sourceActionId === undefined) continue;
		expect(w.sourceCastId, `${w.kind} window carries at most one provenance id`).toBeUndefined();
		const src = actionById.get(w.sourceActionId);
		expect(
			src,
			`${w.kind} window sourceActionId ${w.sourceActionId} resolves to an action`
		).toBeTruthy();
		if (!src) continue;
		expect(src.characterId, `${w.kind} window owner matches its source action`).toBe(w.characterId);
		expect(src.time).toBeLessThanOrEqual(w.start + EPS);
	}

	// Bar ↔ cast-event bijection + full field agreement (post-P4 #3: bars are
	// projections of cast events, so every geometric field must match).
	const casts = events.filter((e) => e.kind === 'cast');
	let matched = 0;
	for (const track of result.tracks) {
		const lanes: [TimelineBar[], 'skill' | 'burst'][] = [
			[track.eBars, 'skill'],
			[track.qBars, 'burst']
		];
		for (const [bars, kind] of lanes) {
			for (const bar of bars) {
				const hits = casts.filter(
					(c) =>
						c.kind === 'cast' &&
						c.ability === kind &&
						c.characterId === track.characterId &&
						c.label === bar.label &&
						c.time === bar.start
				);
				expect(hits.length, `bar ${track.characterId} ${kind} ${bar.label}@${bar.start}`).toBe(1);
				matched++;
				const c = hits[0];
				if (c.kind !== 'cast') continue;
				expect(c.uptime, 'bar/cast uptime agree').toBe(bar.uptime);
				expect(c.abilityId, 'bar/cast abilityId agree').toBe(bar.abilityId);
				expect(c.cooldown, 'bar/cast cooldown agree').toBe(bar.cooldown);
				expect(c.castTime, 'bar/cast castTime agree').toBe(bar.castTime);
				expect(c.summonActivatesAt, 'bar/cast spawn offset agree').toBe(bar.summonActivatesAt ?? 0);
				expect(c.sacProcFired ?? false, 'bar/cast sacProcFired agree').toBe(
					bar.sacProcFired ?? false
				);
				expect(c.stackContext, 'bar/cast stackContext agree').toBe(bar.stackContext);
				// readyAt sanity: never before the cast; equals the hitmark on a
				// sac proc, else >= time + cooldown (delay-adjusted) less whatever a
				// cdReset / cooldownReduce took off it, which the event states
				// (`cdReduced`, cooldown-reduction round) — a tail that moved
				// without saying so is the bug this line now catches.
				expect(c.readyAt).toBeGreaterThanOrEqual(c.time - EPS);
				if (!c.sacProcFired)
					expect(c.readyAt).toBeGreaterThanOrEqual(c.time + c.cooldown - (c.cdReduced ?? 0) - EPS);
			}
		}
	}
	expect(casts.length, 'no orphan cast events').toBe(matched);

	// Stance geometry: the finalize uptime stamp agrees with the window end.
	// Post-P4 #4 stance windows are `state` windows named "inStance" (source =
	// opening cast kind; the ONLY state windows carrying `source`). The window
	// runs [castStart, castStart + duration]; the summon spawn offset shifts
	// only the bar's rendered active-overlay, not the state window, so the
	// relationship is `window.end === bar.start + bar.uptime`.
	for (const w of windows) {
		if (w.kind !== 'state' || w.name !== 'inStance') continue;
		expect(w.source, `inStance window @${w.start} carries its opening cast kind`).toBeTruthy();
		const bars =
			w.source === 'burst'
				? result.tracks.filter((t) => t.characterId === w.characterId).flatMap((t) => t.qBars)
				: result.tracks.filter((t) => t.characterId === w.characterId).flatMap((t) => t.eBars);
		const owner = bars.find((b) => b.start === w.start);
		expect(owner, `stance owner bar for ${w.characterId}@${w.start}`).toBeTruthy();
		if (!owner) continue;
		if (w.transient) {
			// Transient-opened inStance (Cyno's skill-opened Pathclearer): the
			// opener is an INSTANT cast, so the window outlives its bar by
			// design — assert it's cast-anchored and forward, not geometry.
			expect(w.end, `transient inStance @${w.start} runs forward`).toBeGreaterThan(w.start);
			continue;
		}
		const geomEnd = owner.start + owner.uptime;
		if (opts.strictStanceGeom) {
			expect(geomEnd).toBe(w.end);
		} else {
			expect(w.end).toBeLessThanOrEqual(geomEnd + EPS);
		}
	}
	// Conversely: only inStance state windows carry `source`.
	for (const w of windows) {
		if (w.kind === 'state' && w.name !== 'inStance') {
			expect(w.source, `non-inStance state window "${w.name}" has no source`).toBeUndefined();
		}
	}
}

/**
 * Every cast and action event points back at the token that produced it
 * (`src`, notation-follows-chart 2026-09-24) — the editor tints that exact
 * range with what the chart resolved, so a wrong offset colours the wrong
 * characters. ⚠ Bracket groups are the case at risk: their inner tokens are
 * re-tokenized from a synthetic string and shifted back onto the source.
 */
function assertEventsPointAtTheirTokens(notation: string, result: ParsedRotation): void {
	for (const ev of result.events) {
		if (ev.kind !== 'cast' && ev.kind !== 'action') continue;
		expect(ev.src, `${ev.kind} "${ev.label}" @${ev.time} carries its source range`).toBeDefined();
		const text = notation.slice(ev.src!.from, ev.src!.to);
		if (ev.kind === 'action' && ev.action === 'unset') expect(text.startsWith('~?')).toBe(true);
		else expect(text, `${ev.kind} "${ev.label}" @${ev.time}`).toBe(ev.label);
	}
}

describe('parser IR invariants — roster sweep', () => {
	for (const c of all) {
		it(`${c.id}: IR is consistent for its declared inputs`, () => {
			const notation = rosterNotation(c);
			const result = parseNotation(notation, rosterLookup, 8);
			assertCore(result, { strictStanceGeom: true });
			assertEventsPointAtTheirTokens(notation, result);
			assertSummonWindowsMatchGeometry(result);
			assertBlocksProjectFromEvents(result);
		});
	}
});

describe('parser IR invariants — multi-character rotations', () => {
	const rotations: { id: string; notation: string; cons?: Record<string, number> }[] = [
		{ id: 'pyro-hydro-swap', notation: 'Xiangling E Q > Xingqiu E Q' },
		{ id: 'shields', notation: 'Noelle E Q > Zhongli E Q' },
		{ id: 'summon-swap', notation: 'Fischl E Q > Bennett E Q > Fischl E' },
		{ id: 'stance-swap', notation: 'Cyno Q E E > Bennett Q' },
		{ id: 'collei-zone', notation: 'Collei E Q > Xingqiu E Q > Collei E' },
		{ id: 'bracket-repeat', notation: '  Xiangling  2[ N1 C ]  E ~? > Xingqiu 3[N2]x2 E' }
	];
	for (const r of rotations) {
		it(`${r.id}: IR consistent across swaps`, () => {
			const result = parseNotation(r.notation, rosterLookup, 8, r.cons);
			assertCore(result, { strictStanceGeom: false });
			assertEventsPointAtTheirTokens(r.notation, result);
			assertSummonWindowsMatchGeometry(result);
			assertBlocksProjectFromEvents(result);
		});
	}
});
