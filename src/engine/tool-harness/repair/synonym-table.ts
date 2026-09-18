import type { RepairAction } from '../types.ts';
import { ABBREVIATIONS } from './semantic-enum.ts';

/**
 * Expand known abbreviations in a space-separated word string.
 * Uses the shared ABBREVIATIONS map from semantic-enum.
 */
function expandAbbreviations(phrase: string): string {
	return phrase
		.split(/\s+/)
		.map((w) => ABBREVIATIONS[w] ?? w)
		.join(' ');
}

/**
 * Build a synonym lookup table from a list of enum values.
 *
 * Each key is a lowercased natural-language phrase that should map to
 * the canonical enum value.
 */
export function buildSynonymTable(enumValues: string[]): Map<string, string> {
	const table = new Map<string, string>();

	for (const value of enumValues) {
		// 1. The value itself (lowercase)
		table.set(value.toLowerCase(), value);

		// 2. Split on _ and - -> join with spaces
		const words = value.replace(/[_-]/g, ' ').toLowerCase();
		table.set(words, value);

		// 3. Expand known abbreviations in the words
		const expanded = expandAbbreviations(words);
		if (expanded !== words) table.set(expanded, value);

		// 4. Key substrings: for long enums like "infrastructure_scaling_completed",
		//    generate shorter forms from every contiguous word subsequence.
		const wordList = value.split(/[_-]/).filter((w) => w.length > 2);
		for (let i = 0; i < wordList.length; i++) {
			for (let j = i + 1; j <= wordList.length; j++) {
				const sub = wordList.slice(i, j).join(' ').toLowerCase();
				if (sub.length >= 4 && !table.has(sub)) {
					table.set(sub, value);
				}
			}
		}

		// 5. Common natural language rewrites (contraction expansion)
		const natural = words
			.replace(/doesnt/g, "doesn't")
			.replace(/cant/g, "can't")
			.replace(/wont/g, "won't")
			.replace(/isnt/g, "isn't")
			.replace(/didnt/g, "didn't")
			.replace(/hasnt/g, "hasn't")
			.replace(/shouldnt/g, "shouldn't")
			.replace(/couldnt/g, "couldn't")
			.replace(/wouldnt/g, "wouldn't");
		if (natural !== words) table.set(natural, value);
	}

	return table;
}

const FILLER_WORDS =
	/\b(a|an|the|my|this|that|some|very|really|just|also|too)\b/g;

/**
 * Look up a model-produced value in the synonym table.
 * Returns the canonical enum value or null.
 */
export function synonymMatch(input: string, synonymTable: Map<string, string>): string | null {
	const normalized = input.toLowerCase().trim();

	// Direct lookup
	if (synonymTable.has(normalized)) return synonymTable.get(normalized) ?? null;

	// Remove common filler words and retry
	const stripped = normalized
		.replace(FILLER_WORDS, '')
		.replace(/\s+/g, ' ')
		.trim();
	if (stripped !== normalized && synonymTable.has(stripped)) {
		return synonymTable.get(stripped) ?? null;
	}

	// Expand abbreviations in the input and retry
	const expandedInput = expandAbbreviations(normalized);
	if (expandedInput !== normalized && synonymTable.has(expandedInput)) {
		return synonymTable.get(expandedInput) ?? null;
	}

	// Check if input contains any synonym key as a substring
	for (const [key, value] of Array.from(synonymTable.entries())) {
		if (key.length >= 4 && normalized.includes(key)) return value;
	}

	// Check if any synonym key contains the (non-trivial) input as substring
	if (normalized.length >= 4) {
		for (const [key, value] of Array.from(synonymTable.entries())) {
			if (key.length >= 4 && key.includes(normalized)) return value;
		}
	}

	return null;
}

/**
 * Layer 4a: Synonym-table enum matching.
 *
 * Runs after fuzzy-enum (Layer 4) and before semantic-enum (Layer 4b).
 * Pre-computes a synonym table per enum field and uses it to resolve
 * natural-language paraphrases that are too different for Levenshtein
 * but map cleanly through abbreviation expansion or substring keys.
 */
export function synonymMatchEnums(
	input: Record<string, unknown>,
	schema: Record<string, unknown>,
): { data: Record<string, unknown>; repairs: RepairAction[] } {
	const result = { ...input };
	const repairs: RepairAction[] = [];
	const shape = schema as Record<string, { _def?: { typeName?: string; options?: string[] } }>;

	for (const [key, fieldSchema] of Object.entries(shape)) {
		if (!(key in result) || typeof result[key] !== 'string') continue;
		const value = result[key] as string;

		const unwrapped = unwrapSchema(fieldSchema);
		const options = getEnumOptions(unwrapped);
		if (!options) continue;

		// Skip if already valid
		if (options.includes(value)) continue;

		const table = buildSynonymTable(options);
		const match = synonymMatch(value, table);

		if (match) {
			result[key] = match;
			repairs.push({
				field: key,
				original: value,
				repaired: match,
				strategy: 'synonym_enum',
			});
		}
	}

	return { data: result, repairs };
}

// ==================== Helpers ====================

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

function getEnumOptions(schema: unknown): string[] | null {
	const s = schema as { _def?: { typeName?: string; options?: string[] }; options?: string[] };
	// Check if it's a ZodEnum
	if (s._def?.typeName === 'ZodEnum' || !!s.options) {
		return s.options ?? s._def?.options ?? null;
	}
	return null;
}
