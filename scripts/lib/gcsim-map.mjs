/**
 * scripts/lib/gcsim-map.mjs
 *
 * Which gcsim capture describes which authored FrameMap.
 *
 * ⚓ Shared by `audit-gcsim-frames.mjs` (which reports) and
 * `migrate-frames-shape.mjs` (which writes) on purpose: if the two disagreed
 * about what a map corresponds to, the audit would clear a row the migration
 * then rewrote from the wrong source, silently. One module, one answer.
 */

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ⚓ THE REAL RESOLVER, imported — not a second copy. `frames.ts` has no runtime
// imports, so Node's type stripping loads it directly, and the migration therefore
// cannot disagree with the parser about what a FrameMap means. ⛔ Do not reimplement
// `frameAt` here; a duplicated fallback rule is precisely the class of bug L4b exists
// to remove.
import { frameAt } from '../../src/lib/utils/frames.ts';

export { frameAt };

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const CHAR_DIR = join(REPO_ROOT, 'src/lib/data/characters');
export const DRIVERS_PATH = join(REPO_ROOT, 'scripts/gcsim-dump/drivers.json');

/** Our FrameMap's action keys. */
export const KEYS = ['N', 'C', 'E', 'Q', 'D', 'J', 'P', 'swap'];

/** ⚓ The keys `InitNormalCancelSlice` overrides with the HITMARK. Everything else
 *  in a normal's slice is the animation length — the whole C4b finding. Mirrors
 *  `HIT_KEYS` in `$lib/utils/frames.ts`; ⚠️ the two must agree or the migration
 *  writes a shape the resolver reads differently. */
export const CANCEL_KEYS = new Set(['E', 'Q', 'D', 'J', 'swap']);

/** ⚠️ The six Travelers are NOT in the no-gcsim-source set — they map by name, not
 *  by the underscore rule. gcsim keys them by body (`aether…`); the corpus does not
 *  model the Aether/Lumine split for frames and the two are frame-identical upstream. */
const KEY_OVERRIDES = {
	traveler_anemo: 'aetheranemo',
	traveler_cryo: 'aethercryo',
	traveler_dendro: 'aetherdendro',
	traveler_electro: 'aetherelectro',
	traveler_geo: 'aethergeo',
	traveler_hydro: 'aetherhydro',
	traveler_pyro: 'aetherpyro'
};

export const gcsimKeyFor = (id) => KEY_OVERRIDES[id] ?? id.replace(/_/g, '');

export const loadDrivers = () => JSON.parse(readFileSync(DRIVERS_PATH, 'utf8'));

/**
 * ⚓ The corpus already says what gates each ability, so the prerequisite is DERIVED
 * from the ability's own `conditions` rather than hand-listed:
 *
 *   `chainStage {ability, index: N}`  →  N repeats of that action  (Diluc E2/E3,
 *                                        Keqing's recast, Xianyun's Skyladder, Dehya)
 *   `state {state: S}`                →  one lookup in drivers.json's `states`
 *   `stacks {key: K, min: M}`         →  M repeats of drivers.json's `stacks[K]`, the
 *                                        steps that earn ONE stack (2026-10-04, Nilou's
 *                                        dance-step counter). No row, or `min` 0 → nothing.
 *
 * That leaves the driver table answering exactly one question per row — "what puts
 * this character into that state", or what one stack of a counter costs — which is
 * the only part no rule derives.
 *
 * Returns `{ label, prereq }`, or `null` when the prerequisite cannot be built.
 * ⚠️ `null` is UNCOVERED, never "compare it against the base": reading a stance
 * ability off a grounded capture is how you manufacture a mismatch.
 */
export function prereqFor(conditions, drv) {
	if (!conditions) return { label: '', prereq: [] };
	if (conditions.type === 'chainStage') {
		const n = conditions.index ?? 0;
		if (n === 0) return { label: '', prereq: [] };
		const act = conditions.ability === 'burst' ? 'burst' : 'skill';
		return { label: `chain-${act}-${n}`, prereq: [{ action: act, params: {}, repeat: n }] };
	}
	if (conditions.type === 'state') {
		const steps = drv?.states?.[conditions.state];
		if (!steps) return null;
		// ⚓ An empty step list is a ROW that says "this state does not change the
		// frames"; it resolves to the BASE capture rather than a redundant second one.
		if (!steps.length) return { label: '', prereq: [] };
		return { label: `state-${conditions.state}`, prereq: steps };
	}
	if (conditions.type === 'stacks') {
		const steps = drv?.stacks?.[conditions.key];
		const n = conditions.min ?? 0;
		if (!steps || n <= 0) return { label: '', prereq: [] };
		return {
			label: `stacks-${conditions.key}-${n}`,
			prereq: Array.from({ length: n }, () => steps).flat(),
			stacks: true
		};
	}
	// ⚓ An `all` is as gated as its gating members (2026-10-04): a state-gated sibling
	// that also carries a cast cap — `inStance` AND a stack count, Lohen's and Zibai's
	// special skills — read the BASE capture until this, because the conjunction fell
	// through to "no prerequisite". The STATE (or chain) is entered first and a stack
	// count is earned inside it, so they sequence in that order; two different states
	// cannot be sequenced from here, so that is uncovered rather than a guess.
	// Constellation and team members contribute nothing (the empty label).
	if (conditions.type === 'all') {
		const ctxs = (conditions.conditions ?? []).map((c) => prereqFor(c, drv));
		if (ctxs.some((c) => c === null)) return null;
		const uniq = (xs) => [...new Map(xs.filter((c) => c.label).map((c) => [c.label, c])).values()];
		const gating = uniq(ctxs.filter((c) => !c.stacks));
		const counted = uniq(ctxs.filter((c) => c.stacks));
		if (gating.length > 1) return null;
		const parts = [...gating, ...counted];
		if (!parts.length) return { label: '', prereq: [] };
		return {
			label: parts.map((c) => c.label).join('+'),
			prereq: parts.flatMap((c) => c.prereq)
		};
	}
	// Constellation, ascension and team-composition gates do not change the frames a
	// C0 capture reads, so they are not prerequisites at all.
	return { label: '', prereq: [] };
}

/**
 * `hE`/`h1E` are gcsim's `skill[hold=1]`; `h2E` is `hold=2`.
 *
 * ⚠️ `sQ` (KQM short burst) has no known gcsl spelling — L0 §9 left it open and it is
 * still open.
 *
 * ⛔ A variant whose input is the PLAIN `E` returns null, not the base key. Such a
 * variant is selected by STATE, not by token — Varka's Four Winds' Ascension only
 * exists when a Pyro/Hydro/Electro/Cryo unit is in the party, which a single-character
 * dump can never produce — so comparing it against the base capture reports a
 * mismatch between two different abilities. Uncovered is the true answer.
 *
 * ⛔ A CONSTELLATION-GATED variant returns null whatever its token (2026-09-19). The
 * dumper runs every character at C0, so a variant that exists only at C4 — Sigewinne's
 * longer burst channel, which authors its own frames and fourteen waves — was filed
 * against the C0 capture's six the day it landed. ⚠️ Deliberately narrower than "any
 * plain `Q`": Albedo's and Xilonen's state/team-gated burst variants share the base
 * cast's schedule and the C0 capture does describe them.
 */
export function variantDumpKey(input, base, conditions) {
	if (conditions && JSON.stringify(conditions).includes('"type":"constellation"')) return null;
	if (input.includes('h2E')) return 'h2E';
	if (input.includes('hE') || input.includes('h1E')) return 'hE';
	if (input.includes('E')) return null;
	if (input.includes('sQ')) return null;
	return base;
}

/**
 * The prerequisite a skill/burst VARIANT is captured behind (2026-10-04). A variant
 * gated on a state the driver table can ENTER reads that state's capture —
 * Wanderer's Windfavored burst is `burstFramesE` only while `skillKey` is up. One
 * whose state has NO row (Albedo's `duringSummon`, Xilonen's team gate) keeps the
 * ability's own context, exactly as before: those were judged to share the base
 * schedule, and `null` there would turn a reading into "uncovered".
 * Returns the same shape as `prereqFor`; `null` only when two different
 * prerequisites would have to be sequenced.
 */
export function variantPrereq(ability, variant, drv) {
	const ctx = prereqFor(ability.conditions, drv);
	const own = variant.conditions ? prereqFor(variant.conditions, drv) : null;
	if (!own || !own.label || ctx === null) return ctx;
	if (ctx.label && ctx.label !== own.label) return null;
	return own;
}

/**
 * The dumper's driver entry for one character: the capture SETS derived from the
 * corpus, plus `before` — the state ONE capture needs, stated in drivers.json
 * (ICD cap round follow-up, 2026-10-04). `null` when there is nothing to send.
 * ⚓ ONE builder for every dumper caller: four scripts hand-built `{ sets }`, which
 * is how a new driver key goes missing at three of them.
 */
export function dumperDriverEntry(char, drv) {
	const sets = driverSetsFor(char, drv);
	const before = drv?.before;
	if (!sets.length && !before) return null;
	return { ...(sets.length ? { sets } : {}), ...(before ? { before } : {}) };
}

/** The capture sets a character needs, derived from its own abilities. */
export function driverSetsFor(char, drv) {
	const sets = new Map();
	for (const a of char.abilities ?? []) {
		const ctxs = [
			prereqFor(a.conditions, drv),
			...(a.variants ?? []).map((v) => variantPrereq(a, v, drv))
		];
		for (const ctx of ctxs) {
			if (!ctx || !ctx.label) continue;
			if (!sets.has(ctx.label))
				sets.set(ctx.label, { label: ctx.label, prereq: ctx.prereq, captures: [] });
		}
	}
	return [...sets.values()];
}

/**
 * Every authored FrameMap, paired with the dump key that should describe it and a
 * `set(newMap)` that writes it back into the character object.
 *
 * A map whose `dumpKey` is null has no gcsim reading; ⚠️ that is UNCOVERED and must
 * never be reported or migrated as though it were a match.
 */
export function authoredMaps(char, drv, dumped) {
	const out = [];
	const isBow = char.weapon === 'bow';
	// ⛔ gcsim models ONE aimed shot per bow: for 18 of 19, `aim[hold=1]` returns the
	// identical slice, so the partial draw has no reading at all. Ganyu is the lone
	// exception — detected, never special-cased by name.
	const aimFull = dumped?.get('A');
	const aimHold = dumped?.get('hA');
	const hasPartialAim =
		isBow &&
		aimFull?.frames &&
		aimHold?.frames &&
		JSON.stringify(aimFull.frames) !== JSON.stringify(aimHold.frames);
	// ⚓ Same shape as `hasPartialAim`: gcsim models a distinct HOLD for only 47 of
	// 109 characters, and for the rest `skill[hold=1]` returns the tap's slice
	// verbatim. ⛔ That is NOT "the hold equals the tap" — it is gcsim declining to
	// model one, and taking it as data overwrites a genuinely distinct authored hold
	// with the tap reading. (Caught by the roster gate's hold-distinctness invariant
	// on the geo Traveler, which is exactly what that gate is for.)
	const distinctFrom = (a, b) => {
		const x = dumped?.get(a);
		const y = dumped?.get(b);
		return !!(x?.frames && y?.frames && JSON.stringify(x.frames) !== JSON.stringify(y.frames));
	};
	const holdKeys = new Set(
		[
			['hE', 'E'],
			['h2E', 'E']
		]
			.filter(([h, base]) => distinctFrom(h, base))
			.map(([h]) => h)
	);
	const suffixed = (key, ctx) => (ctx === null ? null : ctx.label ? `${key}@${ctx.label}` : key);

	for (const a of char.abilities ?? []) {
		const ctx = prereqFor(a.conditions, drv);
		if (a.abilityType === 'normal') {
			(a.hits ?? []).forEach((h, i) =>
				out.push({
					group: `hits[${i}]`,
					path: `${a.id}.hits[${i}]`,
					frames: h.frames,
					dumpKey: suffixed(`N${i + 1}`, ctx),
					normalStyle: true,
					set: (fm) => (h.frames = fm)
				})
			);
			if (a.chargeFrames)
				out.push({
					group: 'chargeFrames',
					path: `${a.id}.chargeFrames`,
					frames: a.chargeFrames,
					dumpKey: suffixed('C', ctx),
					normalStyle: true,
					set: (fm) => (a.chargeFrames = fm)
				});
			// ⚓⚓ A bow's charged attack is gcsim's `aim`, and its default reading is the
			// FULLY-charged shot — measured (Amber `aim` = 96f = our "Fully-Charged
			// Aimed Shot"), not assumed. ⛔ Pair by NAME, never by index: our arrays run
			// 1–3 long and the full shot is not always last. Faruzan's is
			// `[Fully-Charged, Hurricane Arrow]`, so an index rule hands gcsim's one
			// aimed reading to her signature shot instead — and Sethos, Tighnari,
			// Sigewinne, Lyney and Yelan all carry a third entry that is a kit-specific
			// shot with no gcsim analogue at all.
			const partialKey = hasPartialAim ? 'hA' : null;
			const named = (h) =>
				String(h?.name ?? '')
					.trim()
					.toLowerCase();
			const chargeHits = a.chargeHits ?? [];
			let fullIdx = chargeHits.findIndex((h) => named(h) === 'fully-charged aimed shot');
			if (fullIdx < 0) fullIdx = chargeHits.length - 1;
			// ⚓⚓ A DECLARED PAIRING WINS (drivers.json `aim`, 2026-09-17). `hA` is `hold: 1` —
			// gcsim's AimParamLv1, "fully charged aimshot for most bow characters" — and `A`
			// is the character's DEFAULT hold. The detection above reads `A` ≠ `hA` as "`hA`
			// is the partial draw", which is right for Ganyu (default Lv2 Frostflake) and
			// Sethos, and WRONG for a bow whose default is a kit-specific shot: Lyney's Prop
			// Arrow (default Lv2) and Yelan's Breakthrough Barb (taken whenever ready), where
			// `hA` is the fully-charged shot. Guessed, it filed both corrected maps as
			// disagreements and would have MIGRATED the full shot's numbers into the partial
			// slot. ⛔ Not detectable from the captures without pairing by VALUE, so it is
			// declared per character, by entry NAME.
			const declared = drv?.aim;
			chargeHits.forEach((h, i) => {
				const isPartial = named(h) === 'aimed shot';
				const key = declared
					? named(h) === String(declared.A ?? '').toLowerCase()
						? 'A'
						: named(h) === String(declared.hA ?? '').toLowerCase()
							? 'hA'
							: null
					: i === fullIdx
						? 'A'
						: isPartial && partialKey
							? partialKey
							: null;
				out.push({
					group: `chargeHits[${i}]`,
					path: `${a.id}.chargeHits[${i}]`,
					frames: h.frames,
					dumpKey: isBow ? key : suffixed('C', ctx),
					normalStyle: true,
					uncoveredReason:
						isBow && key === null
							? isPartial
								? 'gcsim models one aimed shot per bow (no partial draw)'
								: `no gcsim analogue for "${h.name ?? '?'}"`
							: undefined,
					set: (fm) => (h.frames = fm)
				});
			});
			// ⚓⚓ `plungeFrames` is the HIGH plunge and `lowPlungeFrames` is `lP`
			// (L4b — Nate: the high plunge is what players actually perform, so it keeps
			// the plain name and the bare `P` token). ⚠️ Before L4b there was ONE map and
			// 36 of its 41 authors were carrying LOW-plunge numbers, so this pairing
			// moves almost every plunge value — that is the intended migration, not drift.
			if (a.plungeFrames)
				out.push({
					group: 'plungeFrames',
					path: `${a.id}.plungeFrames`,
					frames: a.plungeFrames,
					dumpKey: suffixed('P', ctx),
					normalStyle: true,
					set: (fm) => (a.plungeFrames = fm)
				});
			if (a.lowPlungeFrames)
				out.push({
					group: 'lowPlungeFrames',
					path: `${a.id}.lowPlungeFrames`,
					frames: a.lowPlungeFrames,
					dumpKey: suffixed('lP', ctx),
					normalStyle: true,
					set: (fm) => (a.lowPlungeFrames = fm)
				});
			// ⛔ plungeVariants have no gcsim analogue — gcsim models one plunge per
			// character, launched by Xianyun. Left uncovered on purpose.
			for (const v of a.plungeVariants ?? [])
				out.push({
					group: 'plungeVariants',
					path: `${a.id}.plungeVariants[${v.label}]`,
					frames: v.frames,
					dumpKey: null,
					normalStyle: true,
					set: (fm) => (v.frames = fm)
				});
			continue;
		}
		if (a.abilityType !== 'skill' && a.abilityType !== 'burst') continue;
		const base = a.abilityType === 'burst' ? 'Q' : 'E';
		if (a.frames)
			out.push({
				group: a.abilityType,
				path: `${a.id}.frames`,
				frames: a.frames,
				dumpKey: suffixed(base, ctx),
				normalStyle: false,
				set: (fm) => (a.frames = fm)
			});
		for (const v of a.variants ?? []) {
			if (!v.frames) continue;
			let vk = variantDumpKey(v.input ?? [], base, v.conditions);
			let why;
			if ((vk === 'hE' || vk === 'h2E') && !holdKeys.has(vk)) {
				vk = null;
				why = 'gcsim models no distinct hold for this character (its hold slice IS the tap)';
			}
			out.push({
				group: a.abilityType,
				path: `${a.id}.variants[${v.input?.join('/') ?? '?'}]`,
				frames: v.frames,
				dumpKey: vk === null ? null : suffixed(vk, variantPrereq(a, v, drv)),
				normalStyle: false,
				uncoveredReason: why,
				set: (fm) => (v.frames = fm)
			});
		}
	}
	return out;
}

/**
 * A gcsim slice → our minimal FrameMap.
 *
 * ⚓ MINIMAL is the point. gcsim's slice has a value for every action; writing all
 * of them would bury the two or three numbers that actually carry information. So:
 * `anim` always, `hit` when the five cancel keys agree on a value that is not
 * `anim`, and then only the keys that still differ from what `frameAt` would
 * resolve. Xiangling's N1 goes from `{swap:12, N:20, C:20}` to `{anim:20, hit:12}`.
 *
 * ⚠️ `hit` is offered for normal-style maps only. An E/Q slice has no hitmark tier
 * (`InitAbilSlice` takes one number) and characterLint rejects one there.
 */
export const GCSIM_ILLEGAL_F = 500;

export function toFrameMap(slice, { normalStyle }) {
	const out = { anim: slice.anim };
	// ⛔ 500 is gcsim's "this action is illegal" SENTINEL, not frame data — it is
	// written on `ActionCharge` after a final normal with the comment "TODO: this
	// action is illegal; need better way to handle it", 30 times across the roster.
	// Migrating it verbatim would cost 8.3 seconds for an `N5 C`.
	//
	// ⚓ Dropping it is not just pragmatic, it is the game-accurate reading: the combo
	// resets when the animation ends, and a charge after that IS legal. So the key
	// falls back to `anim`, which is exactly when you could do it. ⛔ We have no
	// vocabulary for "illegal" and inventing one would be a verdict, which the tool
	// constitution forbids.
	const isSentinel = (v) => v === GCSIM_ILLEGAL_F && v > slice.anim;
	const resolved = (key) => (CANCEL_KEYS.has(key) && out.hit !== undefined ? out.hit : out.anim);
	if (normalStyle) {
		const h = slice.swap;
		if (h !== slice.anim && [...CANCEL_KEYS].every((k) => slice[k] === h)) out.hit = h;
	}
	for (const k of KEYS) {
		const v = slice[k];
		if (typeof v !== 'number' || isSentinel(v)) continue;
		if (v !== resolved(k)) out[k] = v;
	}
	return out;
}

/**
 * Where an authored FrameMap and a gcsim slice DISAGREE — the audit's mismatch rule.
 *
 * ⚓⚓ THE COMPARED SET IS THE ACTION KEYS **PLUS `anim` AND `hit`** (2026-09-15). Until
 * then the audit compared `KEYS` alone, so a pre-L4b stand-in — `anim === swap`, with
 * no `hit`, every cancel slot holding the OLD `swap` fallback — passed as "matching"
 * whenever its overrides happened to agree, while the two fields that carry a
 * normal's actual timing (its animation length and its hitmark) were never read.
 * The essential-characters scoping (§1.E) found the class by hand on twelve
 * characters — Nefer's every map, Linnea's and Iansan's normals, Cyno's inverted
 * in-stance N5 (`{anim:40, N:62}` for `{anim:62, hit:40}`), Furina's charged attack
 * at 33 for 253 — and a green audit row over every one of them.
 *
 * `anim` is compared wherever the corpus authors it (characterLint requires it).
 * `hit` is compared on normal-style maps against the hitmark tier gcsim's own
 * `InitNormalCancelSlice` leaves in the slice, derived by the SAME rule
 * `toFrameMap` writes it by — so the migration's output is by construction what
 * this comparison accepts. An E/Q slice has no such tier and `hit` is a lint error
 * there, so it is not compared.
 *
 * ⚠️ Still over the keys the corpus ASSERTS for the action keys: an absent `D` is
 * not a claim (see the migration's holdback note), so it is not a disagreement.
 *
 * Returns `[]` when the map agrees; otherwise one `"key ours→theirs"` per key, in
 * report order.
 */
export function frameMapDisagreements(fm, slice, { normalStyle }) {
	const out = [];
	for (const k of KEYS) {
		if (fm[k] !== undefined && fm[k] !== slice[k]) out.push(`${k} ${fm[k]}→${slice[k]}`);
	}
	if (fm.anim !== undefined && fm.anim !== slice.anim) out.push(`anim ${fm.anim}→${slice.anim}`);
	if (normalStyle) {
		const want = toFrameMap(slice, { normalStyle: true }).hit;
		if (fm.hit !== want) out.push(`hit ${fm.hit ?? '—'}→${want ?? '—'}`);
	}
	return out;
}

/** Every key's RESOLVED value — the shape-independent reading of a FrameMap.
 *
 * ⚓ The migration's guards compare these, never the authored keys. A guard that looks
 * only at present keys is not stable across a reshape: Itto's charge map was held back
 * on pass one, preserved WITHOUT its `swap` key (it had become redundant), and then
 * migrated on pass two because the delta was now computed over two keys instead of
 * three. Resolving first makes the decision the same on every pass. */
export const resolvedKeys = (fm) => KEYS.map((k) => frameAt(fm, k));

/**
 * Preserve today's behaviour for a map with no gcsim reading, or one held back.
 *
 * ⚓ The old fallback WAS `swap`, so `anim = swap` reproduces it exactly and changes
 * nothing. ⚠️ `swap` is then written again alongside it, redundant on purpose, for two
 * reasons: `anim === swap` is a legible signal that the animation length was NOT
 * measured but stood in for, and — the practical one — keeping every authored key means
 * the migration's holdback test sees the same key set on a second pass. Dropping the
 * redundant `swap` made Itto's charge map hold back on pass one and migrate on pass two,
 * because the delta was suddenly computed over two keys instead of three.
 */
export function preserveFrameMap(fm) {
	const anim = fm.anim ?? fm.swap ?? Math.max(0, ...Object.values(fm));
	const out = { anim };
	if (fm.hit !== undefined) out.hit = fm.hit;
	// ⚠️ `lands` is not in any gcsim slice, so a writer that rebuilds a map from one
	// would silently DROP it — every rebuild goes through here or `withLands`.
	if (fm.lands !== undefined) out.lands = fm.lands;
	for (const k of KEYS) {
		if (typeof fm[k] === 'number') out[k] = fm[k];
	}
	// ⚠️⚠️ Only where there is NO `hit` tier. With one, an unlisted `swap` resolves to the
	// HITMARK (`frameAt`), so writing `swap: anim` is not redundant at all — it moves the
	// swap cancel from the hitmark to the full animation. Found 2026-09-20 on Iansan's
	// stance normals (13f → 28f), which a "preserve" had been about to rewrite. The rule
	// below predates `hit` (L4b); preserve must be a behavioural NO-OP or it is misnamed.
	if (out.swap === undefined && out.hit === undefined) out.swap = anim;
	return out;
}

/**
 * `fm` with its landing frame set (or, with `lands` undefined, carried over from
 * `from`) — in the corpus's key order: `anim`, `hit`, `lands`, then the cancels.
 *
 * ⚓ `lands` comes from the DAMAGE stream and the rest of a FrameMap from the CANCEL
 * slice, so the two have different writers (`migrate-swing-landings` and
 * `migrate-frames-shape`). This is the seam: the second must not erase the first.
 */
export function withLands(fm, lands, from) {
	const value = lands ?? from?.lands;
	const out = {};
	for (const [k, v] of Object.entries(fm)) {
		if (k === 'lands') continue;
		out[k] = v;
		if (k === (fm.hit !== undefined ? 'hit' : 'anim') && value !== undefined) out.lands = value;
	}
	return out;
}

// ---------------------------------------------------------------------------
// Application attribution
// ---------------------------------------------------------------------------

/**
 * Split one ability's dumped hit stream into the cast's own hits and its summons' ticks.
 *
 * ⚓ Only one ability ever ran, so everything in the stream belongs to this cast — the
 * question is which BAR it belongs to, and the answer decides whether an application
 * gets authored (`application[]`) or is already covered (`interval` / `firstTickDelay`).
 *
 * Two signals, and BOTH are needed:
 *
 *   1. an EXACT name match against a declared summon label, and
 *   2. a recurring, evenly-spaced stream of 3+ on an ability that declares a summon.
 *
 * ⛔ Exact, not substring. `"Pyronado Hit 1"` contains `"Pyronado"`, so a substring match
 * swallowed all three of Xiangling's burst cast hits into her summon and made her Q read
 * as applying nothing — a false "applies nothing" is the one failure this whole field
 * must not have.
 *
 * ⛔ Cadence alone is not enough either: Keqing's eight consecutive slashes and Ayaka's
 * nineteen Soumetsu cuts are evenly spaced and belong to the CAST. `summons[]` means a
 * thing left in the world, and only the corpus can say that.
 *
 * ⚠️ A one-off hit named for a summon but NOT matching its label exactly — Fischl's
 * `"Oz (Summon)"` at +38, Zhongli's `"Stone Stele (Initial)"` at +24 — stays a cast
 * application, and that is right: the summon's tick schedule does not cover its arrival
 * hit, so calling it a tick would silently drop a real application.
 */
export function splitApplications(apps, ability) {
	const summonLabels = new Set(
		(ability.summons ?? []).map((s) => String(s.label ?? '').toLowerCase()).filter(Boolean)
	);
	const byAbil = new Map();
	for (const a of apps) {
		if (!byAbil.has(a.abil)) byAbil.set(a.abil, []);
		byAbil.get(a.abil).push(a);
	}
	const cast = [];
	const ticks = [];
	const regular = [];
	for (const [abil, group] of byAbil) {
		const named = summonLabels.has(abil.trim().toLowerCase());
		const gaps = group.slice(1).map((x, i) => x.frame - group[i].frame);
		const even = gaps.length >= 2 && new Set(gaps).size === 1 && gaps[0] > 0;
		const isTick = named || (even && summonLabels.size > 0);
		(isTick ? ticks : cast).push(...group);
		// ⚠️ A regular stream on an ability that declares NO summon is a finding: either a
		// multi-hit cast (author it) or a thing left in the world we have not modelled.
		if (even && !isTick) regular.push(`${abil} ×${group.length}/${gaps[0]}f`);
	}
	cast.sort((a, b) => a.frame - b.frame);
	ticks.sort((a, b) => a.frame - b.frame);
	return { cast, ticks, regular };
}
