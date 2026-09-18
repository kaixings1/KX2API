import { describe, expect, it } from 'vitest';

import { repairArgs } from '../repair/index.ts';
import type { RepairAction } from '../types.ts';

describe('repairArgs — Layer 1: key_normalize', () => {
	it('maps camelCase keys to snake_case schema keys', () => {
		const schema = {
			field_name: { _def: { typeName: 'ZodString' } },
		};
		const result = repairArgs({ fieldName: 'hello' }, schema);
		expect(result.data).toEqual({ field_name: 'hello' });
		expect(result.repairs[0]?.strategy).toBe('key_normalize');
	});

	it('maps case-insensitive keys', () => {
		const schema = {
			NAME: { _def: { typeName: 'ZodString' } },
		};
		const result = repairArgs({ name: 'hello' }, schema);
		expect(result.data).toEqual({ NAME: 'hello' });
	});
});

describe('repairArgs — Layer 2: coerce', () => {
	it('coerces string to number', () => {
		const schema = {
			count: { _def: { typeName: 'ZodNumber' } },
		};
		const result = repairArgs({ count: '42' }, schema);
		expect(result.data.count).toBe(42);
		expect(result.repairs.some((r) => r.strategy === 'coerce')).toBe(true);
	});

	it('coerces string to boolean', () => {
		const schema = {
			enabled: { _def: { typeName: 'ZodBoolean' } },
		};
		const result = repairArgs({ enabled: 'yes' }, schema);
		expect(result.data.enabled).toBe(true);
	});
});

describe('repairArgs — Layer 3: fuzzy_enum', () => {
	it('matches enum case-insensitively', () => {
		const schema = {
			status: {
				_def: {
					typeName: 'ZodEnum',
					options: ['active', 'inactive'],
				},
			},
		};
		const result = repairArgs({ status: 'ACTIVE' }, schema);
		expect(result.data.status).toBe('active');
		expect(result.repairs.some((r) => r.strategy === 'fuzzy_enum')).toBe(true);
	});
});

describe('repairArgs — Layer 5: default', () => {
	it('injects default values', () => {
		const schema = {
			name: { _def: { typeName: 'ZodString' } },
			timeout: {
				_def: {
					typeName: 'ZodDefault',
					innerType: { _def: { typeName: 'ZodNumber' } },
					defaultValue: 30,
				},
			},
		};
		const result = repairArgs({ name: 'test' }, schema);
		expect(result.data.timeout).toBe(30);
		expect(result.repairs.some((r) => r.strategy === 'default')).toBe(true);
	});
});

describe('repairArgs — pipeline composition', () => {
	it('runs multiple layers in sequence', () => {
		const schema = {
			user_name: {
				_def: {
					typeName: 'ZodDefault',
					innerType: { _def: { typeName: 'ZodString' } },
					defaultValue: 'anon',
				},
			},
		};
		const result = repairArgs({ userName: 'kai' }, schema);
		// Layer 1 normalizes userName -> user_name, Layer 5 sees it's already set
		expect(result.data.user_name).toBe('kai');
		const strategies = result.repairs.map((r) => r.strategy);
		expect(strategies).toContain('key_normalize');
	});
});

describe('repairArgs — skip already valid', () => {
	it('returns empty repairs when input matches schema', () => {
		const schema = {
			name: { _def: { typeName: 'ZodString' } },
		};
		const result = repairArgs({ name: 'hello' }, schema);
		expect(result.data).toEqual({ name: 'hello' });
		expect(result.repairs).toHaveLength(0);
	});
});
