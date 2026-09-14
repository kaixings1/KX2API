import type { ChatCompletionRequest } from '../types.ts';
import type { Provider } from '../../store/types.ts';
import { type ToolCallingConfig } from '../../../shared/toolCalling.ts';
import type { ToolCallingPlan, ToolCallingTransformResult } from './types.ts';
export declare class ToolCallingEngine {
    private readonly config;
    private readonly PATH_CACHE_TTL_MS;
    private readonly PATH_CACHE_MAX_ENTRIES;
    private readonly pathCache;
    getCachedPaths(requestId?: string): string[];
    clearCache(requestId: string): void;
    cachePath(requestId?: string, path: string): void;
    resolvePath(requestId?: string, filename: string): string | null;
    private _pruneExpired;
    private extractFilename;
    constructor(config?: Partial<ToolCallingConfig>);
    transformRequest(input: {
        request: ChatCompletionRequest;
        provider: Provider;
        actualModel: string;
        requestId?: string;
    }): ToolCallingTransformResult;
    applyNonStreamResponse(result: any, plan: ToolCallingPlan): void;
}
