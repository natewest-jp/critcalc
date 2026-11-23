import { describe, expect, it } from 'vitest';
import { named, namedMessage, plainText } from './notices.svelte';

describe('namedMessage', () => {
	it('marks each string value as a name, where the message puts it', () => {
		const ja = ({ name }: { name: string }) => `${name}を復元しました`;
		expect(namedMessage(ja, { name: 'Main' })).toEqual([{ name: 'Main' }, 'を復元しました']);
	});

	it('splices a NoticeText value in as it is, so a phrase keeps its own name', () => {
		const where = named`${'Alt'}’s Library`;
		const msg = ({ label, where }: { label: string; where: string }) =>
			`Comparison closed · ${label} is in ${where}`;
		const text = namedMessage(msg, { label: 'Rotation 2', where });
		expect(text).toEqual([
			'Comparison closed · ',
			{ name: 'Rotation 2' },
			' is in ',
			{ name: 'Alt' },
			'’s Library'
		]);
		expect(plainText(text)).toBe('Comparison closed · Rotation 2 is in Alt’s Library');
	});

	it('reads the same as named for the English it replaces', () => {
		const p = { name: 'Main' };
		expect(namedMessage(({ name }) => `Moved ${name} to Trash`, { name: p.name })).toEqual(
			named`Moved ${p.name} to Trash`
		);
	});
});
