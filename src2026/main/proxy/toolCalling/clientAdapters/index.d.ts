import type { ToolClientAdapterId } from '../../../../shared/toolCalling.ts';
import type { ToolClientAdapter } from './types.ts';
export declare function getToolClientAdapter(clientAdapterId: ToolClientAdapterId): ToolClientAdapter;
export declare function listToolClientAdapters(): ToolClientAdapter[];
