/**
 * src/lib/utils/stateIndex.ts
 *
 * Which named states a holder was in at an instant, answered at FINALIZE from
 * the parse's own windows (state-gates round, §1.G — 2026-09-19).
 *
 * ⚓ `deriveBuffWindows` evaluated every effect's `conditions` with an EMPTY
 * state set, so a `state` gate answered `null` and a buff pool keeps a `null`
 * — a buff gated on `inStance`, `duringSummon` or `nightsoulBlessing` drew
 * whether or not the state was up (measured: Citlali's A1 shred off a melt with
 * no Itzpapa, Iansan's A1 off a cold charged attack, Skirk's A4 off a hold-E
 * that opens no stance). The answer was already in the IR: a stance is a `state`
 * window named `inStance`, every opened state is a `state` window by name, and
 * `duringSummon` is the holder's `summon` windows — all with FINAL ends. This
 * is the one index over them.
 *
 * ⚓ It is the FINALIZE-TIME twin of `holderStatesAt` (`sim/states.ts`), not a
 * third meaning: any holder, any instant, off field included, and the BROAD
 * `duringSummon` (a following summon counts — Escoffier's Cooking Mek),
 * ⛔ not `inferredStates`' stationary-only one. It reads final window ends
 * where the live one reads a pre-extension `uptime` mid-parse, which is the
 * live one's documented approximation, not a second rule.
 *
 * ⚠️⚠️ CLOSED WORLD ONLY FOR STATES THE PARSE TRACKS FOR THAT HOLDER. A state
 * may be NEGATED only if the IR would have recorded it had it been up:
 * `afterNormalAttack` / `afterSkill` / `afterBurst` / `afterDurationEnds` have
 * no window anywhere, and `nightsoulBlessing` has none for a character whose
 * data never opens it. So "tracked" is derived per holder from what their own
 * data can OPEN (a stance, an `opensState`, a transient spec and its `onEnd`
 * chain, a summon) — everything else stays `null`, the optimistic answer it
 * always had. ⛔ A blanket "not active ⇒ false" silently deletes every effect
 * gated on an untracked state. `shielded` is deliberately untracked (shield
 * windows exist, but no buff gate on it was surveyed); `onField` / `offField`
 * belong to the per-segment slices, which already resolve them.
 *
 * ⚓⚓ A STATE THE CAST ITSELF OPENS IS NEITHER UP NOR DOWN AT THAT CAST. The
 * corpus authors both readings, and both are honest: Skirk's A4 (`onCast
 * skill`, gated `inStance`, on the E that OPENS the stance) means "after", and
 * Varesa's C4 (`onCast burst`, gated `not nightsoulBlessing`, on the Q that
 * opens it) means "before". No instant serves both, so a window whose
 * `sourceCastId` is the cast being evaluated answers `null` for its state —
 * the gate is then decided only by a window some OTHER cast opened. That keeps
 * Skirk's bar on `E` and drops it on `hE` (no stance window at all), and keeps
 * Varesa's on a cold Q and drops it on a Q cast inside a standing Blessing.
 *
 * ⚓ `duringSummon` MAY NAME ITS OPENER (summon-bound buffs round, 2026-09-21).
 * A `state` condition carrying `source: 'skill' | 'burst'` asks for the
 * qualified member `duringSummon:burst`, which this index builds from the same
 * summon windows narrowed by `TimelineWindow.source`. An unqualified gate is
 * untouched, and both spellings are published together — see `stateKey`.
 *
 * ⚠️ Half-open spans, `[start, end)` — the rule `holderStatesAt` uses. A state
 * a cast CONSUMES at its own instant therefore reads as already down for that
 * cast's effects; no surveyed effect sits on that edge (2026-09-19).
 *
 * Runtime-import-free besides types and `stateKey`, which is a pure one-liner
 * in `$lib/types/ability` — a module with NO imports of its own, so it cannot
 * drag a graph in behind it. ⛔ It is imported rather than mirrored because
 * three files have to agree on one string (see `stateKey`'s own note).
 */

import { stateKey } from '$lib/types/ability';
import type { CharacterData } from '$lib/types/character';
import type { TimelineWindow } from '$lib/utils/rotationEvents';

export type StatesAt = {
	/** States definitively UP — `evalCondition`'s `resolvedStates`. */
	active: ReadonlySet<string>;
	/** States definitively DOWN — `ConditionContext.negatedStates`. */
	negated: ReadonlySet<string>;
};

const EMPTY: StatesAt = { active: new Set(), negated: new Set() };

/**
 * The states this holder's data gates on AND the parse would have recorded —
 * gated ∩ openable. Empty for two thirds of the roster (42 holders track
 * something, 2026-09-19), which keeps the index free for everybody else.
 * ⚓ Measured the same day: every gated state in the corpus except `offField`
 * IS openable by its own holder, so the intersection drops nothing today — it
 * is the guard for the character who gates on a state we do not model for
 * them. Cached by object identity: a character's data does not change under a
 * parse.
 */
const trackedCache = new WeakMap<CharacterData, ReadonlySet<string>>();
function trackedStatesOf(char: CharacterData): ReadonlySet<string> {
	const hit = trackedCache.get(char);
	if (hit) return hit;
	const gated = new Set<string>();
	const openable = new Set<string>();
	const specStates = (spec: unknown): void => {
		if (!spec || typeof spec !== 'object') return;
		const s = spec as { state?: unknown; onEnd?: { state?: unknown } };
		if (typeof s.state === 'string') openable.add(s.state);
		if (typeof s.onEnd?.state === 'string') openable.add(s.onEnd.state);
	};
	// ⚠️ `kind` is the enclosing ability's class, carried down so a summon
	// declared on a VARIANT is still attributed to the skill or burst that
	// holds it — a qualified `duringSummon:burst` that is not `openable` would
	// be dropped from `tracked` and the gate would silently answer `null`.
	const walk = (node: unknown, kind: 'skill' | 'burst' | undefined): void => {
		if (!node || typeof node !== 'object') return;
		if (Array.isArray(node)) {
			for (const n of node) walk(n, kind);
			return;
		}
		const o = node as Record<string, unknown>;
		if (o.abilityType === 'skill' || o.abilityType === 'burst') kind = o.abilityType;
		if (o.type === 'state' && typeof o.state === 'string') {
			gated.add(
				stateKey(o.state, o.source === 'skill' || o.source === 'burst' ? o.source : undefined)
			);
		}
		if (o.behavior === 'stance') openable.add('inStance');
		if (typeof o.opensState === 'string') openable.add(o.opensState);
		if (o.opensTransientState) specStates(o.opensTransientState);
		if (o.actionOpensState && typeof o.actionOpensState === 'object') {
			for (const spec of Object.values(o.actionOpensState)) specStates(spec);
		}
		if (Array.isArray(o.summons) && o.summons.length > 0) {
			openable.add('duringSummon');
			if (kind) openable.add(stateKey('duringSummon', kind));
		}
		for (const v of Object.values(o)) walk(v, kind);
	};
	walk(char, undefined);
	const tracked = new Set<string>();
	for (const s of gated) if (openable.has(s)) tracked.add(s);
	trackedCache.set(char, tracked);
	return tracked;
}

/**
 * The closed world for a LIVE dispatcher: the holder's tracked states that are
 * not in `active`, as `ConditionContext.negatedStates`.
 *
 * ⚓ The live twin of the index above, and the same defect from the other end.
 * The stack dispatchers demand a definitive `true`, and with no negated set a
 * `not(state)` gate is `null` forever — so it never fired at all. Measured on
 * main: Lohen's `consumeStacks … not inStance` (the clear that resets his
 * special-skill count when he re-enters Masterstroke) had never run, and his
 * second Masterstroke got one special cast instead of three.
 *
 * ⚠️ `duringSummon` IS NEVER NEGATED HERE. The two live resolvers disagree
 * about it (`inferredStates` counts stationary summons only, `holderStatesAt`
 * counts following ones too) and both read a pre-extension `uptime` mid-parse,
 * so "not in the set" is not "down". No live effect gates on its absence.
 */
const NO_STATES: ReadonlySet<string> = new Set();
export function liveNegatedStates(
	char: CharacterData,
	active: ReadonlySet<string>
): ReadonlySet<string> {
	const tracked = trackedStatesOf(char);
	if (tracked.size === 0) return NO_STATES;
	let out: Set<string> | undefined;
	for (const s of tracked) {
		// ⚠️ `startsWith` so the QUALIFIED members are exempt too — the reason
		// `duringSummon` is never negated live is a property of the summon
		// resolvers, and naming the summon's kind does not repair either of them.
		if (s.startsWith('duringSummon') || active.has(s)) continue;
		(out ??= new Set()).add(s);
	}
	return out ?? NO_STATES;
}

type Span = { start: number; end: number; castId: number | undefined };
type SpanList = {
	spans: Span[];
	/** `maxEnd[i]` = the latest `end` among `spans[0..i]` — lets a lookup stop
	 *  walking back the moment nothing earlier can still cover `t`. */
	maxEnd: number[];
	/** Every cast that opened one of these spans — a Set, because a linear scan
	 *  per cast is quadratic on a long rotation of one opener. */
	openers: Set<number>;
};

export type StateIndex = {
	/**
	 * The holder's resolved states at `t`. `castId` names the cast being
	 * evaluated, so a window THAT cast opened answers `null` for its state (see
	 * the header); omit it at a hit, a reaction or a fire.
	 */
	at(holderId: string, t: number, castId?: number): StatesAt;
};

export function buildStateIndex(
	windows: readonly TimelineWindow[],
	getCharacter: (id: string) => CharacterData | null,
	/** The summon windows that are their cast's PRIMARY summon (`summons[0]`).
	 *  `duringSummon` is "is this character's summon out", answered by the
	 *  ability's own geometry — `holderStatesAt` reads the primary only, on
	 *  purpose, and this must not widen it behind its back. */
	primarySummonWindows: ReadonlySet<TimelineWindow>
): StateIndex {
	// holder → state → spans. Built lazily per holder, because most holders
	// track nothing and never reach this.
	const byHolder = new Map<string, Map<string, SpanList> | null>();
	const listsFor = (holderId: string): Map<string, SpanList> | null => {
		const cached = byHolder.get(holderId);
		if (cached !== undefined) return cached;
		const char = getCharacter(holderId);
		const tracked = char ? trackedStatesOf(char) : new Set<string>();
		if (tracked.size === 0) {
			byHolder.set(holderId, null);
			return null;
		}
		const raw = new Map<string, Span[]>();
		for (const name of tracked) raw.set(name, []);
		for (const w of windows) {
			// ⚠️ Kind test FIRST — the `gadget` arm has no `characterId`.
			// ⚓ A summon window feeds TWO lists — the bare `duringSummon` and the
			// one qualified by the cast kind the window already carries — so a
			// qualified gate reads the same spans narrowed to one opener.
			let names: readonly string[];
			if (w.kind === 'state') names = [w.name];
			else if (w.kind === 'summon' && primarySummonWindows.has(w))
				names = ['duringSummon', stateKey('duringSummon', w.source)];
			else continue;
			if (w.characterId !== holderId) continue;
			for (const name of names) {
				raw.get(name)?.push({ start: w.start, end: w.end, castId: w.sourceCastId });
			}
		}
		const lists = new Map<string, SpanList>();
		for (const [name, spans] of raw) {
			spans.sort((a, b) => a.start - b.start);
			const maxEnd: number[] = [];
			let m = -Infinity;
			for (const s of spans) {
				m = Math.max(m, s.end);
				maxEnd.push(m);
			}
			const openers = new Set<number>();
			for (const s of spans) if (s.castId !== undefined) openers.add(s.castId);
			lists.set(name, { spans, maxEnd, openers });
		}
		byHolder.set(holderId, lists);
		return lists;
	};

	return {
		at(holderId, t, castId) {
			const lists = listsFor(holderId);
			if (!lists) return EMPTY;
			const active = new Set<string>();
			const negated = new Set<string>();
			for (const [name, { spans, maxEnd, openers }] of lists) {
				// Last span with `start <= t`.
				let lo = 0;
				let hi = spans.length;
				while (lo < hi) {
					const mid = (lo + hi) >> 1;
					if (spans[mid].start <= t) lo = mid + 1;
					else hi = mid;
				}
				let up = false;
				for (let i = lo - 1; i >= 0 && maxEnd[i] > t; i--) {
					const s = spans[i];
					if (s.end > t && (castId === undefined || s.castId !== castId)) {
						up = true;
						break;
					}
				}
				if (up) {
					active.add(name);
					continue;
				}
				// Opened by the cast under evaluation — covering `t` or spawning
				// after it (Durin's dragon lands 97f after the burst that gates on
				// it) — is unresolved, not down.
				if (castId !== undefined && openers.has(castId)) continue;
				negated.add(name);
			}
			return { active, negated };
		}
	};
}
