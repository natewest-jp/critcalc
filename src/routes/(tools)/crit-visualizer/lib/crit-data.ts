export const CRIT_RATE_MIN = 0.1;
export const CRIT_RATE_MAX = 1.0;
export const CRIT_RATE_STEP = 0.1;

export const CRIT_DAMAGE_MIN = 0.5;
export const CRIT_DAMAGE_MAX = 3.0;
export const CRIT_DAMAGE_STEP = 0.05;

const rounded = (value: number) => Number(value.toFixed(4));

const steps = (min: number, max: number, step: number) => Math.round((max - min) / step) + 1;

export const critRateValues = Array.from({ length: steps(CRIT_RATE_MIN, CRIT_RATE_MAX, CRIT_RATE_STEP) }, (_, i) =>
	rounded(CRIT_RATE_MIN + i * CRIT_RATE_STEP)
);

export const critDamageValues = Array.from(
	{ length: steps(CRIT_DAMAGE_MIN, CRIT_DAMAGE_MAX, CRIT_DAMAGE_STEP) },
	(_, i) => rounded(CRIT_DAMAGE_MIN + i * CRIT_DAMAGE_STEP)
);

export type Tier = {
	min: number;
	max: number;
	color: string;
	label: string;
};

export const tiers: Tier[] = [
	{ min: 1.0, max: 1.2, color: '#f9e4b7', label: 'Entry' },
	{ min: 1.2, max: 1.4, color: '#ffd966', label: 'Warm-up' },
	{ min: 1.4, max: 1.6, color: '#b6d7a8', label: 'Solid' },
	{ min: 1.6, max: 1.8, color: '#a4c2f4', label: 'Strong' },
	{ min: 1.8, max: 2.0, color: '#d5a6bd', label: 'Great' },
	{ min: 2.0, max: 2.4, color: '#ea9999', label: 'Elite' },
	{ min: 2.4, max: 2.8, color: '#b4a7d6', label: 'Peak' },
	{ min: 2.8, max: 3.2, color: '#666666', label: 'Extreme' },
	{ min: 3.2, max: Infinity, color: '#222222', label: 'Maxed' }
];

export function averageDamageMultiplier(critRate: number, critDamage: number) {
	return 1 + critRate * critDamage;
}

export function getTier(value: number) {
	return tiers.find((tier) => value >= tier.min && value < tier.max) ?? tiers[tiers.length - 1];
}

export function getTierColor(value: number) {
	return getTier(value).color;
}

export function getTierTextColor(value: number) {
	return value >= 2.8 ? '#f6f6f6' : '#1a1a1a';
}

