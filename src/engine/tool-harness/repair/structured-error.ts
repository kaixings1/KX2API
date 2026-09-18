import type { RepairAction } from '../types.ts';

export interface StructuredToolError {
	toolName: string;
	resolvedTo?: string;
	issues: FieldIssue[];
	suggestion?: string;
	availableTools?: string[];
}

export interface FieldIssue {
	path: string;
	expected: string;
	received: string;
	candidates?: string[];
}

export function buildStructuredError(
	toolName: string,
	args: Record<string, unknown>,
	schema: Record<string, unknown>,
	availableTools: string[],
	resolvedTo?: string,
): StructuredToolError {
	const issues: FieldIssue[] = [];

	for (const [field, fieldSchema] of Object.entries(schema)) {
		const value = args[field];
		// Check if the value is valid for this field's schema
		const unwrapped = unwrapSchema(fieldSchema);
		const enumValues = getEnumValues(unwrapped);

		if (enumValues && !enumValues.includes(String(value))) {
			issues.push({
				path: field,
				expected: `must be one of [${enumValues.join(', ')}]`,
				received: String(value),
				candidates: enumValues,
			});
		}
	}

	const suggestion =
		issues.length > 0
			? `Fix ${issues.length} field(s): ${issues.map((i) => i.path).join(', ')}`
			: undefined;

	return {
		toolName,
		resolvedTo,
		issues,
		suggestion,
		availableTools,
	};
}

// ==================== Helpers ====================

function getEnumValues(schema: unknown): string[] | null {
	const unwrapped = unwrapSchema(schema);
	const s = unwrapped as { _def?: { typeName?: string }; options?: string[] };
	if (s.options) return s.options;
	if (s._def?.typeName === 'ZodEnum') return (s as { options?: string[] }).options ?? null;
	return null;
}

function unwrapSchema(schema: unknown): unknown {
	const s = schema as { _def?: { innerType?: unknown; typeName?: string }; unwrap?: () => unknown };
	const typeName = s._def?.typeName;
	if (typeName === 'ZodOptional' || typeName === 'ZodDefault' || typeName === 'ZodNullable') {
		return unwrapSchema(s._def!.innerType!);
	}
	if (typeof s === 'object' && s !== null && 'unwrap' in s) {
		return unwrapSchema((s as { unwrap: () => unknown }).unwrap());
	}
	return s;
}

function isZodEnum(schema: unknown): boolean {
	const s = schema as { _def?: { typeName?: string }; options?: string[] };
	return !!s.options || s._def?.typeName === 'ZodEnum';
}
