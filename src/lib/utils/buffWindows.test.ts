/**
 * buffWindows.test.ts — behavioral coverage for the parser-side buff-window
 * derivation + thin row projections (post-P4 #5 phase 5). Ports the legacy
 * teamBuffRows/charReceivedBuffRows behavioral describes to END-TO-END form:
 * hermetic character fixtures are fed through the REAL parser (no
 * castFromBar shims — the parser now produces the casts), and assertions
 * run against the projected rows. Display-string parity with the legacy
 * formatters is guarded separately by the corpus parity test (phase 4–6).
 */

import { describe, it, expect } from 'vitest';
import { parseNotation } from './notationParser';
import { projectTeamBuffRows } from '$lib/timeline/teamBuffRows';
import { projectCharReceivedBuffRows } from '$lib/timeline/charReceivedBuffRows';
import type { CharacterData } from '$lib/types/character';
import type { Ability, Effect } from '$lib/types/ability';
import type { LoadoutEntry } from '$lib/stores';

// ── fixture builders ──

const mkNormal = (id: string): Ability =>
	({
		id: `${id}__normal__attack`,
		name: 'Attack',
		input: ['N'],
		abilityType: 'normal',
		hits: [{ frames: { swap: 20, N: 20, E: 20 } }, { frames: { swap: 20, N: 20, E: 20 } }]
	}) as unknown as Ability;

const mkSkill = (id: string, extra: Record<string, unknown> = {}): Ability =>
	({
		id: `${id}__skill__cast`,
		name: 'Skill',
		input: ['E'],
		abilityType: 'skill',
		behavior: 'instant',
		frames: { swap: 30 },
		cooldown: 8,
		...extra
	}) as unknown as Ability;

const mkBurst = (id: string, extra: Record<string, unknown> = {}): Ability =>
	({
		id: `${id}__burst__cast`,
		name: 'Burst',
		input: ['Q'],
		abilityType: 'burst',
		behavior: 'instant',
		frames: { swap: 30 },
		cooldown: 15,
		energyCost: 60,
		...extra
	}) as unknown as Ability;

const mkChar = (
	id: string,
	name: string,
	opts: { element?: string; region?: string; weapon?: string } = {}
): CharacterData =>
	({
		id,
		name,
		displayName: name,
		element: opts.element ?? 'pyro',
		weapon: opts.weapon ?? 'sword',
		gender: 'Female',
		affiliation: 'Test',
		region: opts.region ?? 'Test',
		rarity: 5,
		abilities: [mkNormal(id), mkSkill(id), mkBurst(id)],
		passives: [],
		constellations: []
	}) as unknown as CharacterData;

const teamBuff = (extra: Record<string, unknown> = {}): Effect =>
	({
		type: 'buff',
		target: 'team',
		trigger: { type: 'onCast', ability: 'skill' },
		duration: 8,
		source: 'character',
		stat: 'atk',
		value: 20,
		snapshottable: false,
		...extra
	}) as unknown as Effect;

function run(
	notation: string,
	chars: CharacterData[],
	constellations: Record<string, number> = {},
	loadout: Record<string, LoadoutEntry> = {}
) {
	const byName = new Map(chars.map((c) => [c.displayName, c]));
	const byId = new Map(chars.map((c) => [c.id, c]));
	const rotation = parseNotation(
		notation,
		(n) => byName.get(n) ?? null,
		8,
		constellations,
		loadout,
		chars
	);
	const getCharacter = (id: string): CharacterData | null => byId.get(id) ?? null;
	return {
		rotation,
		team: projectTeamBuffRows(rotation.windows, getCharacter),
		received: projectCharReceivedBuffRows(rotation.windows, getCharacter)
	};
}

// ── team surface ──

describe('buff windows — team surface', () => {
	it('onCast team buff: one row per source, bar per qualifying cast, duration span', () => {
		const c = mkChar('buffer', 'Buffer');
		c.abilities[1] = mkSkill('buffer', { effects: [teamBuff()] });
		const { team } = run('Buffer E ~8s E', [c]);
		expect(team).toHaveLength(1);
		expect(team[0].key).toBe('buffer::char::E');
		expect(team[0].sourceLabel).toBe('Buffer E');
		expect(team[0].primaryStat).toBe('atk');
		expect(team[0].bars).toHaveLength(2);
		expect(team[0].bars[0].start).toBe(0);
		expect(team[0].bars[0].end).toBe(8);
	});

	it('summon spawn offset shifts the buff start (fieldStart)', () => {
		const c = mkChar('spawner', 'Spawner');
		c.abilities[1] = mkSkill('spawner', {
			effects: [teamBuff()],
			summons: [{ name: 'Zone', duration: 10, spawnsAt: 60 }]
		});
		const { team } = run('Spawner E', [c]);
		expect(team[0].bars[0].start).toBe(1); // 60f offset
		expect(team[0].bars[0].end).toBe(9);
	});

	it('constellation-gated effect only fires at the required level', () => {
		const c = mkChar('consy', 'Consy');
		c.constellations = [
			{
				id: 'consy__constellation__c2',
				name: 'C2',
				abilityType: 'constellation',
				constellationLevel: 2,
				effects: [
					teamBuff({
						trigger: { type: 'onCast', ability: 'skill' },
						conditions: { type: 'constellation', level: 2 }
					})
				]
			} as unknown as Ability
		];
		expect(run('Consy E', [c]).team).toHaveLength(0);
		expect(run('Consy E', [c], { consy: 2 }).team).toHaveLength(1);
	});

	it('active-target-only effects are excluded from the team surface', () => {
		const c = mkChar('activator', 'Activator');
		c.abilities[1] = mkSkill('activator', { effects: [teamBuff({ target: 'active' })] });
		const { team, received } = run('Activator E', [c]);
		expect(team).toHaveLength(0);
		expect(received.length).toBeGreaterThan(0);
	});

	it('afterDuration buff anchors at the stance end with the (end) row identity', () => {
		const c = mkChar('stancer', 'Stancer');
		c.abilities[1] = mkSkill('stancer', { behavior: 'stance', duration: 6 });
		c.passives = [
			{
				id: 'stancer__passive__after',
				name: 'After',
				abilityType: 'passive',
				effects: [teamBuff({ trigger: { type: 'afterDuration', ability: 'skill' }, duration: 10 })]
			} as unknown as Ability
		];
		const { team } = run('Stancer E', [c]);
		expect(team).toHaveLength(1);
		expect(team[0].key).toBe('stancer::char::E::afterDuration');
		expect(team[0].sourceLabel).toBe('Stancer E (end)');
		expect(team[0].bars[0].start).toBe(6);
		expect(team[0].bars[0].end).toBe(16);
	});

	it('NB-triggered team buffs fire once per NB event even across repeated segments', () => {
		const nat = mkChar('natstub', 'NatStub', { region: 'Natlan' });
		nat.passives = [
			{
				id: 'natstub__passive__nb',
				name: 'NBBuff',
				abilityType: 'passive',
				effects: [teamBuff({ trigger: { type: 'onTeamNightsoulBurst' }, duration: 10 })]
			} as unknown as Ability
		];
		const other = mkChar('other', 'Other', { element: 'hydro' });
		const { rotation, team } = run('NatStub E > Other E > NatStub E', [nat, other]);
		const nbEvents = rotation.events.filter((e) => e.kind === 'nightsoulBurst');
		expect(nbEvents).toHaveLength(1); // 18s clock gates the later casts
		const nbRow = team.find((r) => r.key === 'natstub::char::NB');
		expect(nbRow).toBeTruthy();
		expect(nbRow!.bars).toHaveLength(1); // once per NB event, not per track
	});

	it('onReaction scoping: self fires on own reactions only, team on any member', () => {
		const applier = mkChar('applier', 'Applier', { element: 'pyro' });
		const reactor = mkChar('reactor', 'Reactor', { element: 'hydro' });
		// Holder = APPLIER (pyro). Reaction (vaporize) is emitted by REACTOR's
		// hydro cast onto the pyro aura — so a self-scoped effect on the
		// applier must NOT fire, while a team-scoped one must.
		const selfFx = teamBuff({
			trigger: { type: 'onReaction', reaction: 'vaporize' },
			duration: 5,
			stat: 'atk'
		});
		const teamFx = teamBuff({
			trigger: { type: 'onReaction', reaction: 'vaporize', source: 'team' },
			duration: 5,
			stat: 'em'
		});
		applier.passives = [
			{
				id: 'applier__passive__rxn',
				name: 'Rxn',
				abilityType: 'passive',
				effects: [selfFx, teamFx]
			} as unknown as Ability
		];
		const { team } = run('Applier E > Reactor E', [applier, reactor]);
		const keys = team.map((r) => r.key);
		expect(keys).toContain('applier::char::onReaction::em');
		expect(keys).not.toContain('applier::char::onReaction::atk');
	});

	// ↻ 2026-08-14 — THIS TEST'S EXPECTATION IS INVERTED ON PURPOSE. It used to
	// assert TWO rows with distinct keys, guarding the archived
	// `each_key_duplicate` crash: Chevreuse's two shreds share one sourceLabel,
	// so a row key coarser than the display stat collided. ⚓ Nate 2026-08-14:
	// two bars for one reaction, one span and one number was the wrong output
	// to be guarding — the onReaction sites now pool per application like every
	// other dispatch site, so the pair arrives as ONE window carrying both
	// effects. The collision hazard is gone by construction rather than by key
	// choice, and the tooltip is where the two elements are told apart.
	it('dual-element resShred on one reaction is ONE row carrying both effects', () => {
		const chev = mkChar('chevstub', 'ChevStub', { element: 'pyro' });
		const elec = mkChar('elecstub', 'ElecStub', { element: 'electro' });
		const shred = (element: string): Effect =>
			({
				type: 'resShred',
				target: 'enemy',
				trigger: { type: 'onReaction', reaction: 'overloaded', source: 'team' },
				duration: 6,
				element,
				value: -40
			}) as unknown as Effect;
		chev.passives = [
			{
				id: 'chevstub__passive__a4',
				name: 'A4',
				abilityType: 'passive',
				effects: [shred('pyro'), shred('electro')]
			} as unknown as Ability
		];
		// Electro aura first, then a pyro cast → overloaded.
		const { team } = run('ElecStub E > ChevStub E', [chev, elec]);
		const shredRows = team.filter((r) => r.kind === 'debuff');
		expect(shredRows).toHaveLength(1);
		// One bar, and it carries BOTH elements — the pair is readable in the
		// tooltip, which is the only place it was ever legible.
		expect(shredRows[0].bars).toHaveLength(1);
		expect(shredRows[0].bars[0].effects.map((e) => e.stat).sort()).toEqual([
			'electroRes',
			'pyroRes'
		]);
	});

	it('artifact 4pc onCast attaches to the trigger ability; stale set ids are tolerated', () => {
		const c = mkChar('holder', 'Holder');
		const withSet = (setId: string): Record<string, LoadoutEntry> => ({
			holder: { artifactSetId: setId }
		});
		const ok = run('Holder E Q', [c], {}, withSet('noblesse_oblige'));
		const artifactRows = ok.team.filter((r) => r.key.includes('::artifact::'));
		expect(artifactRows.length).toBeGreaterThan(0);
		expect(artifactRows.every((r) => r.key.includes('noblesse_oblige'))).toBe(true);
		// Stale id: no crash, no artifact rows.
		const stale = run('Holder E Q', [c], {}, withSet('deleted_set_id'));
		expect(stale.team.filter((r) => r.key.includes('::artifact::'))).toHaveLength(0);
	});
});

// ── received surface ──

describe('buff windows — received surface', () => {
	it('self-target buffs land on the caster row for the full duration', () => {
		const c = mkChar('selfy', 'Selfy');
		c.abilities[1] = mkSkill('selfy', { effects: [teamBuff({ target: 'self', duration: 12 })] });
		const { received, team } = run('Selfy E', [c]);
		expect(team).toHaveLength(0);
		expect(received).toHaveLength(1);
		expect(received[0].characterId).toBe('selfy');
		expect(received[0].sourceLabel).toBe('Selfy E');
		expect(received[0].bars[0]).toMatchObject({ start: 0, end: 12, duration: 12 });
	});

	it('a self buff gated on offField is dropped (self is always on-field)', () => {
		const c = mkChar('fielded', 'Fielded');
		c.abilities[1] = mkSkill('fielded', {
			effects: [teamBuff({ target: 'self', conditions: { type: 'state', state: 'offField' } })]
		});
		expect(run('Fielded E', [c]).received).toHaveLength(0);
	});

	it('active-target buffs slice per receiver; the last segment extends to the buff end', () => {
		const a = mkChar('sourcea', 'SourceA');
		a.abilities[1] = mkSkill('sourcea', {
			effects: [teamBuff({ target: 'active', duration: 10 })]
		});
		const b = mkChar('recvb', 'RecvB', { element: 'hydro' });
		const { received } = run('SourceA E ~1s > RecvB E ~2s', [a, b]);
		const rows = received.filter((r) => r.sourceLabel === 'SourceA E');
		expect(rows.map((r) => r.characterId).sort()).toEqual(['recvb', 'sourcea']);
		const aRow = rows.find((r) => r.characterId === 'sourcea')!;
		const bRow = rows.find((r) => r.characterId === 'recvb')!;
		// First slice covers the source's own on-field span; the LAST slice
		// (RecvB is on field when the rotation ends) extends to the buff end.
		expect(aRow.bars[0].start).toBe(0);
		expect(bRow.bars[0].end).toBe(10);
		expect(bRow.bars[0].duration).toBe(10);
	});

	it('TTDS-style swap procs fire on swap-out, honor the ICD, and skip same-character continuations', () => {
		const a = mkChar('carrier', 'Carrier');
		const b = mkChar('driver', 'Driver', { element: 'hydro' });
		const loadout: Record<string, LoadoutEntry> = {
			carrier: { weaponId: 'thrilling_tales_of_dragon_slayers', weaponRefinement: 5 }
		};
		// Carrier→Driver proc; Driver→Carrier (no weapon on driver: nothing);
		// Carrier→Driver again INSIDE the 20s ICD → suppressed. One bar.
		const swaps = run('Carrier E > Driver E > Carrier E > Driver E', [a, b], {}, loadout);
		const ttdsRows = swaps.received.filter((r) => r.sourceLabel !== 'Carrier E');
		expect(ttdsRows).toHaveLength(1);
		expect(ttdsRows[0].characterId).toBe('driver');
		expect(ttdsRows[0].bars).toHaveLength(1);
		expect(ttdsRows[0].bars[0].procCooldown).toBe(20);
		// Consecutive same-character segments are one field presence: no proc.
		const cont = run('Carrier E > Carrier E', [a, b], {}, loadout);
		expect(cont.received).toHaveLength(0);
	});

	it('Widsith-style swap-in merges its themes into one mutually-exclusive bar', () => {
		const a = mkChar('front', 'Front');
		const b = mkChar('bard', 'Bard', { element: 'electro', weapon: 'catalyst' });
		const loadout: Record<string, LoadoutEntry> = {
			bard: { weaponId: 'the_widsith', weaponRefinement: 1 }
		};
		const { received } = run('Front E > Bard E', [a, b], {}, loadout);
		expect(received).toHaveLength(1);
		expect(received[0].characterId).toBe('bard');
		expect(received[0].bars[0].isMutuallyExclusive).toBe(true);
		expect(received[0].bars[0].effects.length).toBeGreaterThan(1);
	});
});

// ── phase-6 deliberate deltas (per-swing onHit anchoring) ──

describe('buff windows — per-swing onHit deltas (phase 6)', () => {
	it('DEF shred and RES shred from one source stay distinct debuff rows', () => {
		const c = mkChar('shredder', 'Shredder');
		const mk = (over: Record<string, unknown>): Effect =>
			({
				type: 'resShred',
				target: 'enemy',
				trigger: { type: 'onCast', ability: 'skill' },
				duration: 6,
				value: -20,
				...over
			}) as unknown as Effect;
		c.abilities[1] = mkSkill('shredder', {
			effects: [mk({ element: 'pyro' }), mk({ shredStat: 'def', element: undefined })]
		});
		const { team } = run('Shredder E', [c]);
		const debuffRows = team.filter((r) => r.kind === 'debuff');
		expect(debuffRows).toHaveLength(1); // one dispatch site → one row…
		expect(debuffRows[0].bars[0].effects).toHaveLength(2); // …carrying both shreds
		const stats = debuffRows[0].bars[0].effects.map((e) => e.stat);
		expect(new Set(stats).size).toBe(2);
	});

	it('a defIgnore-stat buff renders as a regular team buff row, not a debuff', () => {
		const c = mkChar('ignorer', 'Ignorer');
		c.abilities[1] = mkSkill('ignorer', { effects: [teamBuff({ stat: 'defIgnore', value: 30 })] });
		const { team } = run('Ignorer E', [c]);
		expect(team).toHaveLength(1);
		expect(team[0].kind).toBeUndefined();
		expect(team[0].primaryStat).toBe('defIgnore');
	});

	it('onHit team buffs anchor at each SWING hit, not the block end', () => {
		const c = mkChar('swinger', 'Swinger', { weapon: 'catalyst' });
		c.passives = [
			{
				id: 'swinger__passive__onhit',
				name: 'OnHitBuff',
				abilityType: 'passive',
				effects: [
					teamBuff({
						trigger: { type: 'onHit', abilityType: 'normal' },
						duration: 0.1 // shorter than the swing gap → no refresh-merge
					})
				]
			} as unknown as Ability
		];
		const { team } = run('Swinger N2', [c]);
		expect(team).toHaveLength(1);
		// Two swings (1/3s apart) → two non-overlapping windows anchored at
		// the swing ENDS (≈0.333s / ≈0.667s), not one at the block end.
		expect(team[0].bars).toHaveLength(2);
		expect(team[0].bars[0].start).toBeCloseTo(1 / 3, 5);
		expect(team[0].bars[1].start).toBeCloseTo(2 / 3, 5);
	});

	it('overlapping same-shape swing hits REFRESH one window in place', () => {
		const c = mkChar('refresher', 'Refresher', { weapon: 'catalyst' });
		c.passives = [
			{
				id: 'refresher__passive__onhit',
				name: 'OnHitBuff',
				abilityType: 'passive',
				effects: [teamBuff({ trigger: { type: 'onHit', abilityType: 'normal' }, duration: 7 })]
			} as unknown as Ability
		];
		const { team } = run('Refresher N2', [c]);
		expect(team).toHaveLength(1);
		expect(team[0].bars).toHaveLength(1); // merged
		expect(team[0].bars[0].start).toBeCloseTo(1 / 3, 5); // first swing end
		expect(team[0].bars[0].end).toBeCloseTo(2 / 3 + 7, 5); // refreshed off the last
	});
});

describe('buff windows — real-kit deltas (Yanfei A1, Flins C2)', () => {
	it('Yanfei A1 renders on the CA hit with the pre-consume seal count', async () => {
		const yanfei = (await import('$lib/data/characters/yanfei.json'))
			.default as unknown as CharacterData;
		const { received } = run('Yanfei N1 N2 N3 C', [yanfei]);
		const a1 = received.find((r) => r.characterId === 'yanfei' && r.sourceLabel === 'Yanfei CA');
		expect(a1, 'A1 row renders (the arc unblocked onHit-buff display)').toBeTruthy();
		expect(a1!.primaryStat).toBe('pyroDmgBonus');
		// 3 seals accrued from N1–N3, read PRE-consume at the CA hit → +15%.
		expect(a1!.bars[0].effects[0].displayValue).toContain('15');
	});

	it('Flins C2 Electro shred refreshes across an in-stance NA string as one window', async () => {
		const flins = (await import('$lib/data/characters/flins.json'))
			.default as unknown as CharacterData;
		const linnea = (await import('$lib/data/characters/linnea.json'))
			.default as unknown as CharacterData;
		const { team } = run('Flins E N1 N2 N3', [flins, linnea], { flins: 2 });
		const nRow = team.find((r) => r.key === 'flins::char::N::resShred');
		expect(nRow, 'per-swing N-class shred row exists').toBeTruthy();
		expect(nRow!.kind).toBe('debuff');
		// The three swings overlap inside the 7s refresh duration → ONE merged
		// window whose end trails the LAST swing by 7s.
		expect(nRow!.bars).toHaveLength(1);
		const bar = nRow!.bars[0];
		expect(bar.end - bar.start).toBeGreaterThan(7 - 1e-9);
		// The E cast itself is an Electro hit too — its own row exists.
		expect(team.some((r) => r.key === 'flins::char::E::resShred')).toBe(true);
	});
});

// ── variant effects (2026-08-14) ──
//
// The parser walked `src.effects` flat and never descended into `variants`, so
// a hold-E's own effects were dead data on the timeline while the Team Builder
// (deriveCapabilities, which DOES walk variants) reported them. Five corpus
// characters were affected; these lock the resolution rule in on real data so
// it can't silently regress to the base ability's list.
describe('variant effects resolve per cast token', () => {
	const load = async (id: string) =>
		(await import(`$lib/data/characters/${id}.json`)).default as unknown as CharacterData;

	it('Diona: the hold shield is 12s, the tap shield 4.8s', async () => {
		const diona = await load('diona');
		const dur = (n: string) => {
			const w = run(n, [diona]).rotation.windows.find((x) => x.kind === 'shield');
			return w ? w.end - w.start : undefined;
		};
		expect(dur('Diona E')).toBeCloseTo(4.8, 6);
		expect(dur('Diona hE')).toBeCloseTo(12, 6);
	});

	it('Shenhe: the hold buff runs 15s where the tap runs 10s', async () => {
		const shenhe = await load('shenhe');
		const span = (n: string) => {
			const bar = run(n, [shenhe]).team[0].bars[0];
			return bar.end - bar.start;
		};
		expect(span('Shenhe E')).toBeCloseTo(10, 6);
		expect(span('Shenhe hE')).toBeCloseTo(15, 6);
	});

	// ⚓ REPLACE, NOT ADD. Eula's base skill carries no effects and her hold
	// variant carries two resShreds; a tap must therefore emit NOTHING, which is
	// also what proves the variant list isn't leaking onto the base cast.
	it('Eula: the hold shred exists and the tap has none', async () => {
		const eula = await load('eula');
		expect(run('Eula E', [eula]).team).toHaveLength(0);
		const held = run('Eula hE', [eula]).team;
		expect(held).toHaveLength(1);
		expect(held[0].kind).toBe('debuff');
		expect(held[0].bars[0].effects.map((e) => e.stat).sort()).toEqual(['cryoRes', 'physicalRes']);
	});

	// Zhongli's Jade Shield lives ONLY on his hE variant — before this he had no
	// shield window at all, and his RES shred never fired.
	it('Zhongli: the hold cast raises a shield window and the shred', async () => {
		const zhongli = await load('zhongli');
		expect(run('Zhongli E', [zhongli]).rotation.windows.some((w) => w.kind === 'shield')).toBe(
			false
		);
		const held = run('Zhongli hE', [zhongli]);
		const shield = held.rotation.windows.find((w) => w.kind === 'shield');
		expect(shield).toBeTruthy();
		expect(shield!.end - shield!.start).toBeCloseTo(20, 6);
		expect(held.team.some((r) => r.kind === 'debuff')).toBe(true);
	});

	// A variant with `summons` but no `effects` must fall through to the base
	// ability's effect list — and its own summon duration still wins for the
	// summon-derived shield fallback.
	it('Yun Jin: the hold shield takes the variant’s own 0.8s, not the base 0.2s', async () => {
		const yunJin = await load('yun_jin');
		const dur = (n: string) => {
			const w = run(n, [yunJin]).rotation.windows.find((x) => x.kind === 'shield');
			return w ? w.end - w.start : undefined;
		};
		expect(dur('Yun Jin E')).toBeCloseTo(0.2, 6);
		expect(dur('Yun Jin hE')).toBeCloseTo(0.8, 6);
	});
});

// ── artifact onHit + summon-tick hits (2026-08-15) ──
//
// The hit stream used to stop at the active character, so every hit-triggered
// artifact set was authored-but-unreachable and any `onHit` effect held by an
// off-field damage dealer never fired. These cover the mechanism and the two
// outcomes that actually prove the model — see the step-6c note in the parser.

describe('artifact onHit — summon-borne hits', () => {
	const tenacity: Record<string, LoadoutEntry> = {
		holder: { artifactSetId: 'tenacity_of_the_millelith' }
	};
	const tickEffect = (type: 'damage' | 'heal') =>
		({
			type,
			trigger: { type: 'summonTick', interval: 2 },
			...(type === 'damage' ? { element: 'electro' } : {}),
			scaling: 100,
			stat: 'atk'
		}) as unknown as Effect;

	const holderWithSummon = (tick: 'damage' | 'heal') => {
		const c = mkChar('holder', 'Holder');
		c.abilities[1] = mkSkill('holder', {
			summons: [{ label: 'Turret', duration: 12, effects: [tickEffect(tick)] }]
		});
		return c;
	};

	// The load-bearing pair. Tenacity is skill-hit-only with a 3s window, so a
	// holder whose skill leaves nothing behind gets exactly one 3s stub off the
	// cast, while a holder whose skill leaves a DAMAGING summon gets one long
	// merged bar. That 3s-vs-covered split is the real Xingqiu/Xiangling
	// difference, and it is the whole reason these sets are worth drawing.
	it('a damaging summon carries the buff; refreshes merge into ONE bar', () => {
		const { team } = run('Holder E ~14s', [holderWithSummon('damage')], {}, tenacity);
		const rows = team.filter((r) => r.key.includes('tenacity_of_the_millelith'));
		expect(rows).toHaveLength(1);
		expect(rows[0].bars).toHaveLength(1);
		// Ticks at +2/4/6/8/10 each re-trigger inside the open 3s window.
		expect(rows[0].bars[0].end - rows[0].bars[0].start).toBeGreaterThan(10);
	});

	it('⛔ a HEAL-only summon carries nothing — a heal tick is not a hit', () => {
		const { team } = run('Holder E ~14s', [holderWithSummon('heal')], {}, tenacity);
		const rows = team.filter((r) => r.key.includes('tenacity_of_the_millelith'));
		// The E cast itself still hits, so the set fires once for its 3s.
		expect(rows).toHaveLength(1);
		expect(rows[0].bars).toHaveLength(1);
		expect(rows[0].bars[0].end - rows[0].bars[0].start).toBeCloseTo(3, 6);
	});

	it('a summon with no damage effect at all leaves the same 3s stub', () => {
		const c = mkChar('holder', 'Holder');
		c.abilities[1] = mkSkill('holder', { summons: [{ label: 'Inert', duration: 12 }] });
		const { team } = run('Holder E ~14s', [c], {}, tenacity);
		const rows = team.filter((r) => r.key.includes('tenacity_of_the_millelith'));
		expect(rows[0].bars[0].end - rows[0].bars[0].start).toBeCloseTo(3, 6);
	});

	// Deepwood authors its shred TWICE (once keyed to skill hits, once to burst).
	// A Dendro RES −30% from an E and one from a Q are the same debuff, so the
	// shape grouping must collapse them rather than stack two identical rows.
	it('Deepwood: two trigger entries render as ONE shred row', () => {
		const c = mkChar('holder', 'Holder');
		const { team } = run('Holder E Q', [c], {}, { holder: { artifactSetId: 'deepwood_memories' } });
		const rows = team.filter((r) => r.key.includes('deepwood_memories'));
		expect(rows).toHaveLength(1);
		expect(rows[0].kind).toBe('debuff');
	});
});

describe('artifact onHit — real characters', () => {
	const load = async (id: string) =>
		(await import(`$lib/data/characters/${id}.json`)).default as unknown as CharacterData;
	const tenacity: Record<string, LoadoutEntry> = {
		xingqiu: { artifactSetId: 'tenacity_of_the_millelith' },
		xiangling: { artifactSetId: 'tenacity_of_the_millelith' }
	};
	const span = (rows: ReturnType<typeof projectTeamBuffRows>) => {
		const r = rows.filter((x) => x.key.includes('tenacity_of_the_millelith'));
		if (r.length === 0) return 0;
		return r[0].bars.reduce((acc, b) => acc + (b.end - b.start), 0);
	};

	// ⚓ Xingqiu's off-field damage is his BURST rain; Tenacity is SKILL-hit-only,
	// so it stays a 3s stub on him no matter how much off-field damage he deals.
	// Xiangling's Guoba is a skill summon and ticks, so hers is covered. The set's
	// whole reputation is this difference — if these two ever report the same
	// number, the hit synthesis has stopped distinguishing skill from burst.
	it('Xingqiu keeps a 3s stub; Xiangling rides Guoba', async () => {
		const [xingqiu, xiangling] = await Promise.all([load('xingqiu'), load('xiangling')]);
		const xq = span(run('Xingqiu E Q ~20s', [xingqiu], {}, tenacity).team);
		const xl = span(run('Xiangling E Q ~20s', [xiangling], {}, tenacity).team);
		expect(xq).toBeCloseTo(3, 6);
		// Observed 10.1s — Guoba's ticks, merged. Asserted loosely so a Guoba
		// cadence recuration moves the number without breaking the invariant.
		expect(xl).toBeGreaterThan(6);
	});
});

// ── Silken Moon's Serenade: Moonsign tiering (2026-08-15) ──
//
// The pattern any future faction-gated set should copy: the TIER is a
// `teamFaction` condition on the effect, resolved once off team composition,
// not a runtime state the parser has to track. Mechanics from gcsim
// internal/artifacts/silkenmoonsserenade — level 0 gives NOTHING, 1 gives
// +60 EM, 2+ gives +120.
describe('artifact onHit — Silken Moon Moonsign tiers', () => {
	const load = async (id: string) =>
		(await import(`$lib/data/characters/${id}.json`)).default as unknown as CharacterData;
	const silken: Record<string, LoadoutEntry> = {
		flins: { artifactSetId: 'silken_moons_serenade' }
	};
	const silkenRows = (rows: ReturnType<typeof projectTeamBuffRows>) =>
		rows.filter((x) => x.key.includes('silken_moons_serenade'));
	const emValue = (rows: ReturnType<typeof projectTeamBuffRows>) => {
		const r = silkenRows(rows);
		if (r.length === 0) return null;
		return r[0].bars[0].effects.find((e) => e.stat === 'em')?.displayValue ?? null;
	};

	it('Moonsign 1 → +60 EM; Moonsign 2 → +120 EM; the tiers never both fire', async () => {
		const [flins, ineffa, bennett] = await Promise.all([
			load('flins'),
			load('ineffa'),
			load('bennett')
		]);
		// Flins alone is Moonsign level 1 (Bennett is not Moonsign).
		const nascent = run('Flins E Q > Bennett E', [flins, bennett], {}, silken);
		expect(emValue(nascent.team)).toBe('+60');
		// Flins + Ineffa is level 2 — Ascendant.
		const ascendant = run('Flins E Q > Ineffa E', [flins, ineffa], {}, silken);
		expect(emValue(ascendant.team)).toBe('+120');
		// Exactly one EM rung fires in each case — the negation on the Nascent
		// entry is what stops both landing in one pooled bar.
		for (const res of [nascent, ascendant]) {
			for (const bar of silkenRows(res.team)[0].bars) {
				expect(bar.effects.filter((e) => e.stat === 'em')).toHaveLength(1);
			}
		}
	});

	it('⛔ Moonsign 0 → the 4pc does nothing at all', async () => {
		const [bennett, xingqiu] = await Promise.all([load('bennett'), load('xingqiu')]);
		const { team } = run(
			'Bennett E Q > Xingqiu E',
			[bennett, xingqiu],
			{},
			{ bennett: { artifactSetId: 'silken_moons_serenade' } }
		);
		expect(silkenRows(team)).toHaveLength(0);
	});

	// The set grants EM plus three lunar Reaction Bonus stats on one trigger.
	// They must pool into ONE bar, the way a multi-stat onCast set does — not
	// split into four rows saying the same thing at the same time.
	it('all four stats pool into a single bar', async () => {
		const [flins, ineffa] = await Promise.all([load('flins'), load('ineffa')]);
		const { team } = run('Flins E Q > Ineffa E', [flins, ineffa], {}, silken);
		const rows = silkenRows(team);
		expect(rows).toHaveLength(1);
		expect(rows[0].bars[0].effects.map((e) => e.stat).sort()).toEqual([
			'em',
			'lunarBloomReactionBonus',
			'lunarChargedReactionBonus',
			'lunarCrystallizeReactionBonus'
		]);
	});
});

// ── refresh-merge on the row projection (2026-08-15) ──
//
// A buff re-applied before it expires is ONE covered span. The windows stay
// one-per-trigger (provenance, export); only the drawing merges — which is what
// kills the duplicate labels stacking on each other.
describe('buff rows — refresh merge', () => {
	it('a recast inside the duration extends one bar instead of stacking two', () => {
		const c = mkChar('buffer', 'Buffer');
		c.abilities[1] = mkSkill('buffer', { effects: [teamBuff({ duration: 12 })] });
		const { team, rotation } = run('Buffer E ~8s E', [c]);
		expect(team[0].bars).toHaveLength(1);
		expect(team[0].bars[0].start).toBe(0);
		// Spans to the SECOND cast's end, not the first's.
		expect(team[0].bars[0].end).toBeGreaterThan(12);
		// ⚓ The IR is untouched — two triggers, still two windows.
		expect(rotation.windows.filter((w) => w.kind === 'buff')).toHaveLength(2);
	});

	it('a recast after expiry still draws two bars', () => {
		const c = mkChar('buffer', 'Buffer');
		c.abilities[1] = mkSkill('buffer', { effects: [teamBuff({ duration: 8 })] });
		const { team } = run('Buffer E ~10s E', [c]);
		expect(team[0].bars).toHaveLength(2);
	});
});

// ── weaponType conditions resolve against the RECEIVER (infusion round, 2026-08-15) ──
//
// ⚓ Census over all 123 characters: every `weaponType` condition in the corpus
// sits on an `active`-target effect (Bennett C6's Pyro DMG bonus + its infusion,
// Candace's burst infusion), so the weapon the condition asks about is the
// receiver's, never the holder's. `evalCondition` used to return null for it —
// lumped in with the HP conditions the planner genuinely cannot simulate — so
// the buff drew for every teammate regardless of what they were holding.
//
// ⚠️ A per-segment slice is the ONE scope where the receiver is concrete, which
// is why the fact is supplied there and nowhere else. Team-wide pools have no
// receiver to ask about.
describe('active-target buffs — weaponType gates on the receiver', () => {
	const load = async (id: string) =>
		(await import(`$lib/data/characters/${id}.json`)).default as unknown as CharacterData;
	/** The stats Bennett's C6 hands `receiverId` during his burst. */
	const statsFor = (rows: ReturnType<typeof projectCharReceivedBuffRows>, receiverId: string) =>
		rows
			.filter((r) => r.characterId === receiverId)
			.flatMap((r) => r.bars.flatMap((b) => b.effects ?? []))
			.map((e) => (e as { stat?: string }).stat)
			.filter((s): s is string => s !== undefined);

	it('a sword receiver gets the Pyro DMG bonus; a bow receiver gets only the ATK buff', async () => {
		const [bennett, xingqiu, ganyu] = await Promise.all([
			load('bennett'),
			load('xingqiu'),
			load('ganyu')
		]);
		const sword = run('Bennett Q > Xingqiu N3', [bennett, xingqiu], { bennett: 6 }).received;
		const bow = run('Bennett Q > Ganyu N3', [bennett, ganyu], { bennett: 6 }).received;
		expect(statsFor(sword, 'xingqiu')).toContain('pyroDmgBonus');
		expect(statsFor(bow, 'ganyu')).not.toContain('pyroDmgBonus');
		// ⚠️ The ATK buff has no weaponType gate and must still reach the bow user —
		// the fix narrows one effect, not the whole bar.
		expect(statsFor(bow, 'ganyu')).toContain('atk');
	});
});

// ── orphaned triggers, wired 2026-08-15 (docs/curation/orphaned-schema-audit.md) ──
//
// Both effects were authored correctly, typechecked, linted clean, and drew
// nothing — no consumer matched their trigger. They are the reason that audit
// exists.
describe('onState / post-stance buffs — triggers that were authored and never matched', () => {
	const load = async (id: string) =>
		(await import(`$lib/data/characters/${id}.json`)).default as unknown as CharacterData;
	const barsOf = (rows: ReturnType<typeof projectTeamBuffRows>, needle: string) =>
		rows.filter((r) => r.key.includes(needle)).flatMap((r) => r.bars);

	it('Hu Tao A1 fires at the STANCE END, not at the swap', async () => {
		// Flutter By: +12% CRIT Rate to teammates for 8s when Paramita Papilio
		// ends. Her stance is 9s, and she is on field here for ~15s.
		const [huTao, xingqiu] = await Promise.all([load('hu_tao'), load('xingqiu')]);
		const { team } = run('Hu Tao E ~14s > Xingqiu E', [huTao, xingqiu]);
		const bars = barsOf(team, 'hu_tao::char::E::afterDuration');
		expect(bars).toHaveLength(1);
		expect(bars[0].start).toBeCloseTo(9, 6);
		expect(bars[0].end).toBeCloseTo(17, 6);
	});

	it('🐛 a stance ends at its DURATION even when the holder stays on field past it', async () => {
		// The bug the fix above uncovered: the swap-close assigned the stance
		// window's end unconditionally, so staying on field longer than the
		// stance EXTENDED a window that had already closed. `terminatesOnSwap` is
		// on 27 characters, and every `afterDuration` author read the stretched
		// span — Hu Tao's buff landed at 14.87s instead of 9s. A swap can only
		// ever end a stance early, so the close is a clamp.
		const [huTao, xingqiu] = await Promise.all([load('hu_tao'), load('xingqiu')]);
		const { rotation } = run('Hu Tao E ~14s > Xingqiu E', [huTao, xingqiu]);
		const stance = rotation.windows.find(
			(w) => w.kind === 'state' && w.name === 'inStance' && w.characterId === 'hu_tao'
		)!;
		expect(stance.end - stance.start).toBeCloseTo(9, 6);
	});

	it('a swap BEFORE the stance duration still truncates it', async () => {
		// The other side of the clamp — it must not become a no-op.
		const [huTao, xingqiu] = await Promise.all([load('hu_tao'), load('xingqiu')]);
		const { rotation } = run('Hu Tao E ~3s > Xingqiu E', [huTao, xingqiu]);
		const stance = rotation.windows.find(
			(w) => w.kind === 'state' && w.name === 'inStance' && w.characterId === 'hu_tao'
		)!;
		expect(stance.end - stance.start).toBeLessThan(9);
	});

	it('Citlali C2 spans her SHIELD window — an onState buff has no duration of its own', async () => {
		// ⚠️ `shielded` is a State in the union that nothing ever puts into
		// `resolvedStates`; it resolves to shield WINDOWS. Matching only
		// `kind: 'state'` would leave this bar invisible exactly as it was.
		const [citlali, xingqiu] = await Promise.all([load('citlali'), load('xingqiu')]);
		const { rotation, team } = run('Citlali E ~20s > Xingqiu E', [citlali, xingqiu], {
			citlali: 2
		});
		const shield = rotation.windows.find(
			(w) => w.kind === 'shield' && w.characterId === 'citlali'
		)!;
		const bars = barsOf(team, 'citlali::char::onState::em');
		expect(bars).toHaveLength(1);
		expect(bars[0].start).toBeCloseTo(shield.start, 6);
		expect(bars[0].end).toBeCloseTo(shield.end, 6);
	});

	it('…and nothing below C2, since the constellation is the holder’s gate', async () => {
		const [citlali, xingqiu] = await Promise.all([load('citlali'), load('xingqiu')]);
		const { team } = run('Citlali E ~20s > Xingqiu E', [citlali, xingqiu], { citlali: 1 });
		expect(barsOf(team, 'citlali::char::onState')).toHaveLength(0);
	});
});
