import type { RepairAction } from '../types.ts';

const BOOL_MAP: Record<string, boolean> = {
	true: true,
	false: false,
	yes: true,
	no: false,
	'1': true,
	'0': false,
};

export function coerceTypes(
	input: Record<string, unknown>,
	schema: Record<string, unknown>,
): { data: Record<string, unknown>; repairs: RepairAction[] } {
	const result = { ...input };
	const repairs: RepairAction[] = [];
	const shape = schema as Record<string, { _def?: { typeName?: string; innerType?: unknown; defaultValue?: unknown } }>;

	for (const [key, fieldSchema] of Object.entries(shape)) {
		if (!(key in result)) continue;
		const value = result[key];
		const unwrapped = unwrapSchema(fieldSchema);

		// String -> Number
		if (isZodNumber(unwrapped) && typeof value === 'string') {
			if (value.trim() === '') {
				// Empty string for number -> remove (let defaults/required handle it)
				delete result[key];
				repairs.push({
					field: key,
					original: value,
					repaired: undefined,
					strategy: 'coerce',
				});
				continue;
			}
			const num = Number(value);
			if (!Number.isNaN(num)) {
				result[key] = num;
				repairs.push({
					field: key,
					original: value,
					repaired: num,
					strategy: 'coerce',
				});
			}
		}

		// String -> Boolean (custom, NOT z.coerce)
		if (isZodBoolean(unwrapped) && typeof value === 'string') {
			const mapped = BOOL_MAP[value.toLowerCase()];
			if (mapped !== undefined) {
				result[key] = mapped;
				repairs.push({
					field: key,
					original: value,
					repaired: mapped,
					strategy: 'coerce',
				});
			}
		}

		// Single value -> Array
		if (isZodArray(unwrapped) && !Array.isArray(value) && value !== undefined) {
			result[key] = [value];
			repairs.push({
				field: key,
				original: value,
				repaired: [value],
				strategy: 'coerce',
			});
		}
	}

	return { data: result, repairs };
}

// ==================== Zod type guards ====================

function getTypeName(schema: unknown): string | undefined {
	const s = schema as { _def?: { typeName?: string } };
	return s._def?.typeName;
}

function isZodNumber(schema: unknown): boolean {
	const name = getTypeName(unwrapSchema(schema));
	return name === 'ZodNumber';
}

function isZodBoolean(schema: unknown): boolean {
	const name = getTypeName(unwrapSchema(schema));
	return name === 'ZodBoolean';
}

function isZodArray(schema: unknown): boolean {
	const name = getTypeName(unwrapSchema(schema));
	return name === 'ZodArray';
}

function unwrapSchema(schema: unknown): unknown {
	const s = schema as { _def?: { innerType?: unknown } };
	if (s._def?.innerType) {
		return unwrapSchema(s._def.innerType);
	}
	return schema;
}
