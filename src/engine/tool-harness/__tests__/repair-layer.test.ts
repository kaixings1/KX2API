import { describe, expect, it } from 'vitest';

import {
	synonymMatchEnums,
	buildSynonymTable,
} from '../repair/synonym-table.ts';

describe('buildSynonymTable', () => {
	it('creates lowercase and spaced variants', () => {
		const table = buildSynonymTable(['active_status']);
		expect(table.get('active_status')).toBe('active_status');
		expect(table.get('active status')).toBe('active_status');
	});
});

describe('synonymMatch', () => {
	it('matches exact lowercase', () => {
		const table = buildSynonymTable(['active', 'inactive']);
		const result = synonymMatchEnums({ status: 'active' }, { status: { _def: { typeName: 'ZodEnum', options: ['active', 'inactive'] } } });
		// Already valid — no repair needed
		expect(result.data.status).toBe('active');
	});
});
