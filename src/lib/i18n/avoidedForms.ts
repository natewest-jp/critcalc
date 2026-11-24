/**
 * Forms a locale's term list rules out (`docs/text/terms-<locale>.md`), the
 * way the English termbase's `avoid` lists do for English. Checked against
 * every message (`messages.test.ts`) and every kit note (`kitNotes.test.ts`).
 */
export const AVOID: Record<string, { form: RegExp; why: string }[]> = {
	ja: [
		{ form: /凸/, why: 'entry 88: constellations are C0–C6, never 凸' },
		{
			form: /(?<![A-Za-z])CD(?![A-Za-z])/,
			why: 'entry 28: cooldown is クールタイム (CT in dense labels), never CD'
		}
	]
};
