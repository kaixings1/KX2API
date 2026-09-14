import type { ToolCallingConfig } from '../../../shared/toolCalling.ts';
import type { NormalizedClientToolRequest } from './clientAdapters/types.ts';
import type { ToolCallingPlan } from './types.ts';
export declare function buildToolCallingRuntimePlan(input: {
    requestId?: string;
    providerId: string;
    actualModel?: string;
    model?: string;
    config: ToolCallingConfig;
    clientRequest: NormalizedClientToolRequest;
}): ToolCallingPlan;
