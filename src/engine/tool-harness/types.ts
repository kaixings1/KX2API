import type { z } from 'zod';

export type RepairStrategy =
	| 'json_fix'
	| 'key_normalize'
	| 'coerce'
	| 'fuzzy_enum'
	| 'synonym_enum'
	| 'semantic_enum'
	| 'default'
	| 'ai_repair';

export interface RepairAction {
	field: string;
	original: unknown;
	repaired: unknown;
	strategy: RepairStrategy;
}

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

export interface RepairPolicy {
	mode: 'never' | 'on_validation_failure' | 'always';
	enabledLayers?: RepairStrategy[];
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

export type Visibility = 'always' | 'listed' | 'hidden';
export type Category = 'read' | 'search' | 'task';

export interface ToolDef<TInput = Record<string, unknown>, TOutput = unknown> {
	description: string;
	category: Category;
	visibility: Visibility;
	schema: z.ZodObject<any>;
	execute: (input: TInput, context?: ToolExecutionContext) => Promise<TOutput>;
	examples?: TInput[];
	priority?: number;
	toModelOutput?: (opts: { output: TOutput }) => {
		type: 'text';
		value: string;
	};
}

export type ToolDefs = Record<string, ToolDef>;

export interface ToolExecutionContext {
	toolCallId: string;
	experimental_context?: unknown;
	[key: string]: unknown;
}
