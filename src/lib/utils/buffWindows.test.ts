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

	it('dual-element resShred on one reaction yields two rows with distinct keys', () => {
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
		expect(shredRows).toHaveLength(2);
		expect(new Set(shredRows.map((r) => r.key)).size).toBe(2);
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
