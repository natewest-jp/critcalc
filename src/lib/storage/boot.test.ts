import { describe, expect, it } from 'vitest';
import { parseBackup } from '$lib/utils/settingsBackup';
import { hadLegacyData } from './boot';

/** A `localStorage` stand-in holding exactly these raw values. */
function storage(raw: Record<string, string>): Pick<Storage, 'getItem'> {
	return { getItem: (k) => raw[k] ?? null };
}

/** What `open()` parses: the live keys through the backup sanitizers. */
function parsed(raw: Record<string, string>) {
	const data = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, JSON.parse(v)]));
	return parseBackup(JSON.stringify({ app: 'critcalc', version: 2, exportedAt: 0, data }), 0);
}

describe('the returning-visitor signal (flip-readiness §1 item 4)', () => {
	it('an empty browser is a first visit', () => {
		expect(hadLegacyData(storage({}))).toBe(false);
	});

	it('any backup key present raw is a returning visitor', () => {
		expect(hadLegacyData(storage({ 'critcalc:constellations': '{"bennett":6}' }))).toBe(true);
	});

	it('a key the sanitizers DROP still counts (⛔ not `parsed.ok`)', () => {
		// The old tools layout writes its tabs on any visit; an empty list is
		// dropped by the sanitizer, so the parse alone would read a new visitor.
		const raw = { 'critcalc:rotationTabs': '{"tabs":[],"activeTabId":null}' };
		expect(parsed(raw).ok).toBe(false);
		expect(hadLegacyData(storage(raw))).toBe(true);
	});

	it('a key outside the backup set does not count', () => {
		expect(hadLegacyData(storage({ 'critcalc:nextLayout': '1' }))).toBe(false);
	});

	it('the Visualizers layout alone does not count (it is saved on load)', () => {
		const viz = { 'critcalc:vizWorkspace': '{"v":1,"assignment":[],"slots":"auto"}' };
		expect(hadLegacyData(storage(viz))).toBe(false);
	});

	it('blocked site data reads as a first visit', () => {
		const blocked = {
			getItem: () => {
				throw new Error('SecurityError');
			}
		};
		expect(hadLegacyData(blocked)).toBe(false);
	});
});
