import type { RepairAction } from '../types.ts';
import { injectDefaults } from './defaults.ts';
import { fuzzyMatchEnums } from './fuzzy-enum.ts';
import { normalizeKeys } from './key-normalize.ts';
import { semanticMatchEnums } from './semantic-enum.ts';
import { buildStructuredError, type StructuredToolError } from './structured-error.ts';
import { synonymMatchEnums } from './synonym-table.ts';
import { coerceTypes } from './type-coerce.ts';
import { repairJSON } from './json-repair.ts';

export { repairJSON } from './json-repair.ts';

type LayerDef = {
	name: string;
	strategies: string[];
	run: (
		data: Record<string, unknown>,
		schema: Record<string, unknown>,
		schemaKeys: string[],
	) => { data: Record<string, unknown>; repairs: RepairAction[] };
};

const LAYERS: LayerDef[] = [
	{
		name: 'key_normalize',
		strategies: ['key_normalize'],
		run: (data, _schema, schemaKeys) => normalizeKeys(data, schemaKeys),
	},
	{
		name: 'coerce',
		strategies: ['coerce'],
		run: (data, schema) => coerceTypes(data, schema),
	},
	{
		name: 'fuzzy_enum',
		strategies: ['fuzzy_enum'],
		run: (data, schema) => fuzzyMatchEnums(data, schema),
	},
	{
		name: 'synonym_enum',
		strategies: ['synonym_enum'],
		run: (data, schema) => synonymMatchEnums(data, schema),
	},
	{
		name: 'semantic_enum',
		strategies: ['semantic_enum'],
		run: (data, schema) => semanticMatchEnums(data, schema),
	},
	{
		name: 'default',
		strategies: ['default'],
		run: (data, schema) => injectDefaults(data, schema),
	},
];

function isLayerEnabled(
	layer: LayerDef,
	enabledLayers: string[] | undefined,
): boolean {
	if (!enabledLayers) return true;
	return layer.strategies.some((s) => enabledLayers.includes(s));
}

export interface RepairOptions {
	enabledLayers?: string[];
	toolName?: string;
	availableTools?: string[];
	onEvent?: (event: RepairEvent) => void;
}

export interface RepairEvent {
	type: 'repair_layer_used' | 'repair_skipped';
	timestamp: number;
	data: { layer?: string; repairCount?: number; reason?: string };
}

export interface RepairResult {
	ok: boolean;
	data: Record<string, unknown>;
	repairs: RepairAction[];
	error?: StructuredToolError;
}

export function repairArgs(
	args: Record<string, unknown>,
	schema: Record<string, unknown>,
	options?: RepairOptions,
): RepairResult {
	const enabledLayers = options?.enabledLayers;
	const onEvent = options?.onEvent;

	const schemaKeys = Object.keys(schema);
	const allRepairs: RepairAction[] = [];
	let data = { ...args };

	for (const layer of LAYERS) {
		if (!isLayerEnabled(layer, enabledLayers)) {
			onEvent?.({
				type: 'repair_skipped',
				timestamp: Date.now(),
				data: { layer: layer.name, reason: 'disabled_by_policy' },
			});
			continue;
		}

		const result = layer.run(data, schema, schemaKeys);
		if (result.repairs.length > 0) {
			onEvent?.({
				type: 'repair_layer_used',
				timestamp: Date.now(),
				data: { layer: layer.name, repairCount: result.repairs.length },
			});
		}
		allRepairs.push(...result.repairs);
		data = result.data;
	}

	return {
		ok: true,
		data,
		repairs: allRepairs,
	};
}
