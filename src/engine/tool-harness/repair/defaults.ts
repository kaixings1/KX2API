import type { RepairAction } from '../types.js';

export function injectDefaults(
	input: Record<string, unknown>,
	schema: Record<string, unknown>,
): { data: Record<string, unknown>; repairs: RepairAction[] } {
	const result = { ...input };
	const repairs: RepairAction[] = [];
	const shape = schema as Record<string, { _def?: { defaultValue?: unknown }; instanceof?: unknown }>;

	for (const [key, fieldSchema] of Object.entries(shape)) {
		if (key in result && result[key] !== undefined) continue;

		const def = (fieldSchema as { _def?: { defaultValue?: unknown } })?._def;
		if (def?.defaultValue !== undefined) {
			result[key] = def.defaultValue;
			repairs.push({
				field: key,
				original: undefined,
				repaired: def.defaultValue,
				strategy: 'default',
			});
		}
	}

	return { data: result, repairs };
}
